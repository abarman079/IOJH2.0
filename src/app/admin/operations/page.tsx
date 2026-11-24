import Link from 'next/link';
import type {Metadata} from 'next';
import {requireAdminAal2} from '@/features/admin/authorization';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {getSiteOrigin} from '@/features/auth/config';
import {emailConfiguration,runnerConfiguration} from '@/lib/jobs/runner-policy.mjs';
import {AdminSignOut} from '@/features/admin/ui/admin-sign-out';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Worker operations — IOJH Admin',robots:{index:false,follow:false}};
const metrics=[['due','Due jobs'],['leased','Leased jobs'],['dead','Dead jobs'],['oldestDueSeconds','Oldest due age (seconds)'],['lastStarted','Last admitted invocation / heartbeat'],['lastFinished','Last finished invocation'],['lastSuccess','Last successful invocation'],['cooldownUntil','Provider cooldown until'],['lastError','Last worker error']] as const;
function display(v:unknown){return typeof v==='string'||typeof v==='number'?String(v):'No record';}
export default async function OperationsPage(){
 await requireAdminAal2();
 const client=await createServerSupabaseClient();
 const result=client?await client.rpc('iojh_runner_admin_health').abortSignal(AbortSignal.timeout(3000)):null;
 const health:Record<string,unknown>|null=result&&!result.error&&result.data&&typeof result.data==='object'&&!Array.isArray(result.data)?result.data:null;
 const runner=runnerConfiguration(process.env).state==='ready';
 const email=runner&&emailConfiguration(process.env,getSiteOrigin())!==null;
 return <main className="admin-workspace" id="main-content"><header className="admin-top"><Link href="/admin" className="admin-wordmark">IOJH<span>.</span></Link><span>SECURE / WORKER OPERATIONS</span><AdminSignOut/></header><div className="admin-content"><p className="admin-eyebrow">OPERATIONS / C07c</p><h1>Worker health.</h1><p>Redacted database aggregates. Provider acceptance is not confirmed delivery.</p><p>Runner configuration: {runner?'enabled':'disabled or invalid'}. Staging email configuration: {email?'enabled':'disabled or invalid'}. Scheduler freshness: {!runner?'not enabled':!health?.lastStarted?'not verified':health.stale===true?'stale':'recent invocation'}.</p><Link href="/admin/notifications" className="admin-text-link">Review notification failures</Link>{health?<section className="admin-note"><h2>Queue and scheduler</h2><dl>{metrics.map(([key,label])=><div key={key}><dt><strong>{label}</strong></dt><dd>{display(health[key])}</dd></div>)}</dl><h2>Last run counts</h2><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(health.lastSummary??{},null,2)}</pre><h2>Notifications updated in the last 24 hours</h2><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(health.recentNotifications??{},null,2)}</pre></section>:<p role="alert">Worker health unavailable. Confirm migration and administrator access.</p>}</div></main>;
}
