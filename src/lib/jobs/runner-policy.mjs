import { timingSafeEqual, createHash } from 'node:crypto';
export const LIMITS = Object.freeze({durationMs: 28_000, maxJobs: 3, rpcMs: 3_000, providerMs: 8_000, emailBudgetMs: 26_000, probeBudgetMs: 10_000, leaseSeconds: 90});
export function runnerConfiguration(env) {
  const secret = env.IOJH_JOBS_RUNNER_SECRET;
  if (env.IOJH_JOBS_RUNNER_ENABLED !== 'true') return {state:'disabled'};
  if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/i.test(secret)) return {state:'invalid'};
  return {state:'ready',secret};
}
export function authorizedBearer(header, secret) {
  if (typeof header !== 'string' || !/^Bearer [0-9a-f]{64}$/i.test(header)) return false;
  return timingSafeEqual(Buffer.from(header.slice(7)), Buffer.from(secret));
}
export function emailConfiguration(env, site) {
  if(env.IOJH_NOTIFICATIONS_SEND_ENABLED!=='true') return null;
  const apiKey=env.IOJH_NOTIFICATIONS_RESEND_API_KEY?.trim(),from=env.IOJH_NOTIFICATIONS_FROM?.trim(),recipient=env.IOJH_NOTIFICATIONS_STAGING_RECIPIENT?.trim().toLowerCase();
  const notificationId=env.IOJH_NOTIFICATIONS_STAGING_NOTIFICATION_ID?.trim().toLowerCase();
  if(site!==env.IOJH_NOTIFICATIONS_STAGING_ORIGIN || site==='https://iojh.com.bd' || site==='https://www.iojh.com.bd') return null;
  if(!notificationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(notificationId) || !apiKey || !/^re_\S{12,}$/.test(apiKey) || !from || !/^[^\r\n<>]*<?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}>?$/i.test(from) || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.endsWith('.invalid') || !site?.startsWith('https://')) return null;
  return {apiKey,from,recipient,site,notificationId};
}
export function budgetDecision(remaining, emailReady) {
  return {claim:remaining>=LIMITS.probeBudgetMs,email:emailReady && remaining>=LIMITS.emailBudgetMs};
}
export function fingerprint({apiKey,from,to,subject,html,text}) {
  // Bind provider account credential as well as the exact request. Never persist the key or body.
  return createHash('sha256').update(JSON.stringify([apiKey,from,to,subject,html,text])).digest('hex');
}
export function cooldownFor(result) {
  if(result.outcome==='accepted') return 60;
  if(result.cooldownSeconds!==undefined) return Math.max(60,Math.min(86400,result.cooldownSeconds));
  return result.outcome==='retry'?300:60;
}
// Read at most 64 bytes, including chunked input; only {} or empty body permitted.
export async function validRunnerBody(request) {
  const declared=request.headers.get('content-length');
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>64)) return false;
  if(!request.body) return true;
  const reader=request.body.getReader();let size=0;const chunks=[];const deadline=performance.now()+1000;
  let timer;
  try {
    while(true){
      if(performance.now()>=deadline)return false;
      const part=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('body timeout')),Math.max(0,deadline-performance.now()));})]);
      clearTimeout(timer);
      if(part.done) break;
      size+=part.value.byteLength;
      if(size>64) return false;
      chunks.push(part.value);
    }
    const raw=Buffer.concat(chunks).toString('utf8').trim();
    return raw==='' || /^\{\s*\}$/.test(raw);
  }catch{return false;}finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
}

const responseHeaders={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
export function methodDenied(){return Response.json({error:'Method not allowed'},{status:405,headers:{...responseHeaders,Allow:'POST'}});}
export async function handleRunnerRequest(request,env,execute){
 const reply=(status,body)=>Response.json(body,{status,headers:responseHeaders});
 if(request.method!=='POST')return methodDenied();
 const config=runnerConfiguration(env);
 if(config.state!=='ready')return reply(503,{error:'Runner unavailable'});
 if(!authorizedBearer(request.headers.get('authorization'),config.secret))return reply(401,{error:'Unauthorized'});
 if(new URL(request.url).search||!(await validRunnerBody(request)))return reply(400,{error:'Invalid request'});
 try{
  const result=await execute();
  const summary={};
  for(const key of ['claimed','completed','submitted','suppressed','retry','dead','review','stale','errors']){
   const n=result.summary?.[key];if(!Number.isInteger(n)||n<0||n>LIMITS.maxJobs)throw Error('Invalid summary');summary[key]=n;
  }
  if(typeof result.ok!=='boolean'||typeof result.busy!=='boolean')throw Error('Invalid result');
  return reply(result.ok?200:503,{busy:result.busy,ok:result.ok,summary});
 }catch{return reply(503,{error:'Runner unavailable'});}
}
