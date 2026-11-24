import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAuthConfig } from '@/features/auth/config';
import { notificationReferenceSchema, type ClaimedJob } from '@/lib/jobs/contracts';
import { cooldownFor, fingerprint, LIMITS, type EmailConfiguration } from '@/lib/jobs/runner-policy.mjs';
import type { RunnerBackend } from '@/lib/jobs/runner';
import { renderNotification } from './templates.mjs';
import { sendResend } from './provider.mjs';

const prepared=z.discriminatedUnion('action',[
 z.object({action:z.enum(['stale','invalid','already_submitted','suppressed','review'])}).strict(),
 z.object({action:z.literal('send'),notificationId:z.uuid(),recipient:z.email(),locale:z.enum(['en','bn']),templateId:z.literal('account_notice'),templateVersion:z.literal(1),variables:z.object({reference:z.string().regex(/^[A-Za-z0-9-]{8,40}$/)}).strict()}).strict(),
]);
function serviceClient(){
 const config=getPublicAuthConfig();const key=process.env.IOJH_JOBS_SERVICE_KEY?.trim();
 if(!config||!key||key.length<40||key===config.key)throw Error('Notification backend unavailable');
 return createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function recordVerifiedProviderEvent(eventId:string,emailId:string,eventType:string):Promise<void>{
 const {error}=await serviceClient().rpc('iojh_notifications_provider_event',{p_event_id:eventId,p_provider_id:emailId,p_type:eventType}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
 if(error)throw Error('Provider status could not be recorded');
}
export type DispatchStatus='submitted'|'suppressed'|'stale'|'retry'|'dead'|'review';
/** Internal worker only; no caller-controlled sender, recipient, template or arbitrary text. */
export async function dispatchNotificationClaim(job:ClaimedJob,ctx:{run:string;client:RunnerBackend;email:EmailConfiguration}):Promise<DispatchStatus>{
 if(job.kind!=='notification.email'||job.payloadVersion!==1)throw TypeError('Unsupported notification job');
 if(process.env.IOJH_NOTIFICATIONS_SEND_ENABLED!=='true')throw Error('Delivery disabled');
 const input=notificationReferenceSchema.parse(job.payload),{client,email,run}=ctx;
 const lease={p_job:job.jobId,p_token:job.leaseToken,p_generation:job.leaseGeneration};
 const {data,error}=await client.rpc('iojh_notifications_prepare',lease).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
 if(error)throw Error('Notification preparation rejected');
 const parsed=prepared.parse(data);
 async function finish(result:'accepted'|'retry'|'dead'|'suppressed'|'uncertain',providerId?:string,code?:string):Promise<DispatchStatus>{
  const r=await client.rpc('iojh_notifications_finish',{...lease,p_result:result,p_provider_id:providerId??null,p_code:code??null}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
  if(r.error||typeof r.data!=='string')throw Error('Notification settlement unavailable');
  switch(r.data){case 'stale':return 'stale';case 'queued':return 'retry';case 'uncertain':return 'review';case 'suppressed':return 'suppressed';case 'delivered':case 'submitted':return 'submitted';case 'failed':return result==='accepted'?'review':'dead';default:throw Error('Unknown notification settlement');}
 }
 if(parsed.action==='stale')return 'stale';
 // Prepare atomically settles an already accepted record's job under its lease.
 if(parsed.action==='already_submitted')return 'submitted';
 if(parsed.action==='suppressed')return finish('suppressed');
 if(parsed.action==='review')return finish('uncertain',undefined,'timeout');
 if(parsed.action==='invalid')return finish('dead',undefined,'invalid_reference');
 if(parsed.action!=='send')throw Error('Unsupported preparation state');
 if(parsed.notificationId!==input.notificationId||parsed.notificationId!==email.notificationId||parsed.locale!==input.locale||parsed.templateVersion!==input.templateVersion||parsed.recipient!==email.recipient||parsed.recipient.endsWith('.invalid'))return finish('dead',undefined,'invalid_reference');
 const rendered=renderNotification({templateId:parsed.templateId,templateVersion:1,locale:parsed.locale,...parsed.variables},email.site);
 const message={apiKey:email.apiKey,from:email.from,to:parsed.recipient,notificationId:parsed.notificationId,subject:`[STAGING TEST] ${rendered.subject}`,html:rendered.html.replace('</main>','<p><strong>STAGING TEST / পরীক্ষামূলক বার্তা — no account action required.</strong></p></main>'),text:`STAGING TEST / পরীক্ষামূলক বার্তা — no account action required.\n\n${rendered.text}`};
 const permit=await client.rpc('iojh_runner_authorize_send',{p_run:run,...lease,p_hash:fingerprint(message)}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
 if(permit.error)throw Error('Send authorization unavailable');
 if(permit.data==='stale')return 'stale';
 if(permit.data==='review')return finish('uncertain',undefined,'timeout');
 if(permit.data==='suppressed')return finish('suppressed');
 if(permit.data!=='send')throw Error('Unknown send authorization');
 const response=await sendResend({...message,signal:AbortSignal.timeout(LIMITS.providerMs)});
 // Durable cooldown before settlement; if RPC fails, preserve existing pessimistic reservation and recover by lease expiry.
 if(response.outcome!=='accepted'){
  const cool=await client.rpc('iojh_runner_cooldown',{p_run:run,p_seconds:cooldownFor(response)}).abortSignal(AbortSignal.timeout(LIMITS.rpcMs));
  if(cool.error||cool.data!==true)throw Error('Provider cooldown unavailable');
 }
 if(response.outcome==='accepted')return finish('accepted',response.providerId);
 if(response.code==='idempotency_conflict')return finish('uncertain',undefined,'idempotency_conflict');
 return finish(response.outcome==='permanent'?'dead':'retry',undefined,response.code);
}
