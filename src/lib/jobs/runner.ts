import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getPublicAuthConfig, getSiteOrigin } from '@/features/auth/config';
import { claimedJobSchema, type ClaimedJob } from './contracts';
import { budgetDecision, emailConfiguration, LIMITS } from './runner-policy.mjs';
import { dispatchNotificationClaim } from '@/lib/notifications/server';

export function runnerBackend() {
  const config=getPublicAuthConfig();
  const key=process.env.IOJH_JOBS_SERVICE_KEY?.trim();
  if(!config || !key || key.length<40 || key===config.key) throw Error('Runner backend unavailable');
  return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export type RunnerBackend=ReturnType<typeof runnerBackend>;
export type RunnerSummary={claimed:number;completed:number;submitted:number;suppressed:number;retry:number;dead:number;review:number;stale:number;errors:number};
export async function runJobs():Promise<{busy:boolean;ok:boolean;summary:RunnerSummary}> {
  if(process.env.IOJH_JOBS_RUNNER_ENABLED!=='true') throw Error('Runner disabled');
  const summary:RunnerSummary={claimed:0,completed:0,submitted:0,suppressed:0,retry:0,dead:0,review:0,stale:0,errors:0};
  const client=runnerBackend();
  const email=emailConfiguration(process.env,getSiteOrigin());
  const start=await client.rpc('iojh_runner_begin').abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
  if(start.error) throw Error('Runner coordination unavailable');
  if(start.data===null) return {busy:true,ok:true,summary};
  if(typeof start.data!=='string') throw Error('Runner coordination unavailable');
  const run=start.data;
  const deadline=performance.now()+LIMITS.durationMs;
  const worker=`c07c-${randomUUID()}`;
  let ok=true;
  try {
    while(summary.claimed<LIMITS.maxJobs) {
      const budget=budgetDecision(deadline-performance.now(),email!==null);
      if(!budget.claim) break;
      const claim=await client.rpc('iojh_runner_claim',{p_run:run,p_worker:worker,p_email:budget.email,p_recipient:email?.recipient??null,p_notification:email?.notificationId??null}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
      if(claim.error || !Array.isArray(claim.data)) throw Error('Claim rejected');
      if(!claim.data.length) break;
      if(claim.data.length!==1) throw Error('Invalid claim batch');
      const job:ClaimedJob=claimedJobSchema.parse(claim.data[0]);
      summary.claimed++;
      const lease={p_job:job.jobId,p_token:job.leaseToken,p_generation:job.leaseGeneration};
      // Explicit versioned registry. Database filters supported kinds/version before claiming.
      switch(job.kind) {
        case 'ops.probe': {
          const result=await client.rpc('iojh_jobs_complete',lease).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
          if(result.error || typeof result.data!=='boolean') throw Error('Probe settlement unavailable');
          if(result.data) summary.completed++; else summary.stale++;
          break;
        }
        case 'notification.email': {
          // A claim may have been delayed; never start an external call without remaining time.
          if(!email || deadline-performance.now()<20_000) {summary.stale++;ok=false;break;}
          const status=await dispatchNotificationClaim(job,{run,client,email});
          summary[status]++;
          break;
        }
      }
      if(summary.stale>0){ok=false;break;}
    }
  }catch{summary.errors++;ok=false;}
  // Calls are awaited; no detached processing. An unreachable end RPC leaves a 90s expiring lock.
  const end=await client.rpc('iojh_runner_end',{p_run:run,p_ok:ok,p_summary:summary}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
  if(end.error || end.data!==true) ok=false;
  return {busy:false,ok,summary};
}
