import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAuthConfig, getSiteOrigin } from '@/features/auth/config';
import { notificationReferenceSchema, type ClaimedJob } from '@/lib/jobs/contracts';
import { completeLease } from '@/lib/jobs/server';
import { renderNotification } from './templates.mjs';
import { sendResend } from './provider.mjs';

const uuid = z.uuid();
const prepared = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['stale','invalid','already_submitted','suppressed','review']) }).strict(),
  z.object({action:z.literal('send'),notificationId:uuid,recipient:z.email(),locale:z.enum(['en','bn']),
    templateId:z.literal('account_notice'),templateVersion:z.literal(1),
    variables:z.object({reference:z.string().regex(/^[A-Za-z0-9-]{8,40}$/)}).strict()}).strict(),
]);

function serviceClient() {
  const config = getPublicAuthConfig();
  const key = process.env.IOJH_JOBS_SERVICE_KEY?.trim();
  if (!config || !key || key.length < 40 || key === config.key) throw new Error('Notification backend unavailable');
  return createClient(config.url, key, {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function recordVerifiedProviderEvent(eventId:string,emailId:string,eventType:string):Promise<void> {
  const {error} = await serviceClient().rpc('iojh_notifications_provider_event', {
    p_event_id:eventId,p_provider_id:emailId,p_type:eventType,
  });
  if (error) throw new Error('Provider status could not be recorded');
}

/**
 * C07c handler contract, not a runner. No HTTP endpoint calls this function.
 * Feature-disabled unless an owner explicitly configures the send flag and a
 * separate authenticated C07c worker. Never run from a browser or Server Action.
 */
export async function dispatchNotificationClaim(job:ClaimedJob):Promise<'submitted'|'suppressed'|'stale'|'retry'|'dead'|'review'> {
  if (job.kind!=='notification.email') throw new TypeError('Not a notification job');
  const input = notificationReferenceSchema.parse(job.payload);
  if (job.payloadVersion!==1) throw new TypeError('Unsupported notification version');
  if (process.env.IOJH_NOTIFICATIONS_SEND_ENABLED!=='true') throw new Error('Notification delivery disabled');
  const site = getSiteOrigin();
  const apiKey = process.env.IOJH_NOTIFICATIONS_RESEND_API_KEY;
  const from = process.env.IOJH_NOTIFICATIONS_FROM;
  if (!site || !apiKey || !from) throw new Error('Notification provider unavailable');
  const client = serviceClient();
  const lease = {p_job:job.jobId,p_token:job.leaseToken,p_generation:job.leaseGeneration};
  const {data,error} = await client.rpc('iojh_notifications_prepare',lease);
  if(error) throw new Error('Notification preparation rejected');
  const parsed=prepared.parse(data);
  if(parsed.action==='stale') return 'stale';
  if(parsed.action==='already_submitted') return (await completeLease(job))?'submitted':'stale';
  async function finish(result:'accepted'|'retry'|'dead'|'suppressed'|'uncertain',providerId?:string,code?:string){
    const response=await client.rpc('iojh_notifications_finish',{
      ...lease,p_result:result,p_provider_id:providerId??null,p_code:code??null,
    });
    if(response.error || typeof response.data!=='string')throw new Error('Notification result could not be committed');
    return response.data as string;
  }
  if(parsed.action==='suppressed')return (await finish('suppressed'))==='stale'?'stale':'suppressed';
  if(parsed.action==='review')return (await finish('uncertain',undefined,'timeout'))==='stale'?'stale':'review';
  if(parsed.action==='invalid')return (await finish('dead',undefined,'invalid_reference'))==='stale'?'stale':'dead';
  if(parsed.action!=='send')throw new Error('Unsupported notification preparation state');
  // The database supplies the only permitted template/recipient for the leased job.
  if(parsed.notificationId!==input.notificationId || parsed.locale!==input.locale ||
      parsed.templateVersion!==input.templateVersion) {
    return (await finish('dead',undefined,'invalid_reference'))==='stale'?'stale':'dead';
  }
  const rendered=renderNotification({templateId:parsed.templateId,templateVersion:1,locale:parsed.locale,...parsed.variables},site);
  const response=await sendResend({
    apiKey,from,to:parsed.recipient,notificationId:parsed.notificationId,
    subject:rendered.subject,html:rendered.html,text:rendered.text,
    signal:AbortSignal.timeout(8_000),
  });
  if(response.outcome==='accepted'){
    const settled=await finish('accepted',response.providerId);
    return settled==='stale'?'stale':settled==='failed'?'review':'submitted';
  }
  const status=await finish(response.outcome==='permanent'?'dead':'retry',undefined,response.code);
  return status==='stale'?'stale':status==='failed'?'dead':status==='queued'?'retry':'dead';
}
