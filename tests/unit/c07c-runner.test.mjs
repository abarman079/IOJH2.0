import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runnerConfiguration,authorizedBearer,emailConfiguration,budgetDecision,fingerprint,cooldownFor,validRunnerBody,handleRunnerRequest} from '../../src/lib/jobs/runner-policy.mjs';
import {sendResend} from '../../src/lib/notifications/provider.mjs';
const secret='a'.repeat(64),env={IOJH_JOBS_RUNNER_ENABLED:'true',IOJH_JOBS_RUNNER_SECRET:secret};
const email={IOJH_NOTIFICATIONS_SEND_ENABLED:'true',IOJH_NOTIFICATIONS_RESEND_API_KEY:'re_unit-only-not-real-00000',IOJH_NOTIFICATIONS_FROM:'IOJH <notice@example.org>',IOJH_NOTIFICATIONS_STAGING_ORIGIN:'https://staging.example.org',IOJH_NOTIFICATIONS_STAGING_RECIPIENT:'approved@example.org',IOJH_NOTIFICATIONS_STAGING_NOTIFICATION_ID:'3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001'};
const message={apiKey:email.IOJH_NOTIFICATIONS_RESEND_API_KEY,from:email.IOJH_NOTIFICATIONS_FROM,to:'approved@example.org',subject:'Notice',html:'<p>Notice</p>',text:'Notice',notificationId:'3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001'};
test('runner disabled and missing/short credentials fail closed',()=>{
 assert.equal(runnerConfiguration({}).state,'disabled');assert.equal(runnerConfiguration({...env,IOJH_JOBS_RUNNER_SECRET:'short'}).state,'invalid');
 assert.equal(runnerConfiguration(env).state,'ready');
 for(const bad of [null,'Bearer short',`Basic ${secret}`,`Bearer ${'b'.repeat(64)}`,`Bearer ${secret} extra`])assert.equal(authorizedBearer(bad,secret),false);
 assert.equal(authorizedBearer(`Bearer ${secret}`,secret),true);
});
test('email requires enabled flag, valid provider and explicit staging recipient and HTTPS',()=>{
 assert.equal(emailConfiguration(email,'https://staging.example.org').recipient,'approved@example.org');
 for(const x of [{IOJH_NOTIFICATIONS_SEND_ENABLED:'false'},{IOJH_NOTIFICATIONS_RESEND_API_KEY:'bad'},{IOJH_NOTIFICATIONS_FROM:'bad'},{IOJH_NOTIFICATIONS_STAGING_RECIPIENT:'fixture@example.invalid'},{IOJH_NOTIFICATIONS_STAGING_RECIPIENT:''}])assert.equal(emailConfiguration({...email,...x},'https://staging.example.org'),null);
 assert.equal(emailConfiguration(email,'http://localhost:3000'),null);
});
test('deadline allows only work that fits, never claims email with disabled config',()=>{
 assert.deepEqual(budgetDecision(28000,true),{claim:true,email:true});
 assert.deepEqual(budgetDecision(28000,false),{claim:true,email:false});
 assert.deepEqual(budgetDecision(20000,true),{claim:true,email:false});
 assert.deepEqual(budgetDecision(9000,true),{claim:false,email:false});
});
test('body parser rejects arbitrary parameters, invalid JSON and chunked oversize',async()=>{
 const req=(body,headers={})=>new Request('http://localhost/run',{method:'POST',body,headers});
 for(const body of ['', '{}',' { } '])assert.equal(await validRunnerBody(req(body)),true);
 for(const body of ['{"limit":20}','[]','x',' '.repeat(65)])assert.equal(await validRunnerBody(req(body)),false);
 assert.equal(await validRunnerBody(req('{}',{'content-length':'65'})),false);
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(65));c.close();}});
 assert.equal(await validRunnerBody(new Request('http://localhost/run',{method:'POST',body:stream,duplex:'half'})),false);
});
test('fingerprint pins exact request and credential; output never includes plaintext',()=>{
 const hash=fingerprint(message);assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(hash,fingerprint({...message}));
 for(const change of [{from:'different@example.org'},{apiKey:'re_other'},{html:'Changed'},{to:'else@example.org'}])assert.notEqual(hash,fingerprint({...message,...change}));
});
test('provider malformed success and idempotency conflict are ambiguous; rate limit is bounded',async()=>{
 const mock=(status,body,header)=>async()=>({status,json:async()=>body,headers:new Headers(header)});
 assert.deepEqual(await sendResend({...message,fetchImpl:mock(200,{})}),{outcome:'retry',code:'timeout'});
 assert.equal((await sendResend({...message,fetchImpl:mock(409,{name:'invalid_idempotent_request'})})).code,'idempotency_conflict');
 assert.equal(cooldownFor(await sendResend({...message,fetchImpl:mock(429,{}, {'retry-after':'720'})})),720);
 assert.equal(cooldownFor(await sendResend({...message,fetchImpl:mock(429,{}, {'retry-after':'999999'})})),86400);
 assert.equal(cooldownFor(await sendResend({...message,fetchImpl:mock(401,{})})),3600);
 assert.equal(cooldownFor({outcome:'retry',code:'timeout'}),300);
});
test('provider cancellation stays ambiguous; permanent bad address never automatically retries',async()=>{
 const signal=AbortSignal.abort();
 assert.deepEqual(await sendResend({...message,signal,fetchImpl:async(_u,init)=>{assert.equal(init.signal,signal);throw new Error('cancelled');}}),{outcome:'retry',code:'timeout'});
 assert.equal((await sendResend({...message,fetchImpl:async()=>({status:422,json:async()=>({})})})).outcome,'permanent');
});

test('HTTP guard invokes backend only after enabled, authenticated, bounded POST; response redacts extra fields',async()=>{
 let calls=0;
 const execute=async()=>{calls++;return {busy:false,ok:true,summary:{claimed:1,completed:1,submitted:0,suppressed:0,retry:0,dead:0,review:0,stale:0,errors:0,secret:'private'},token:'private'};};
 const req=(method='POST',credential,body='{}')=>new Request('https://staging.example.org/api/internal/jobs/run',{method,headers:credential?{Authorization:credential}:{},...(method==='POST'?{body}:{})});
 for(const [request,settings,status] of [[req(),env,401],[req('POST','Bearer '+secret),{},503],[req('GET','Bearer '+secret),env,405],[req('POST','Bearer '+secret,'{"limit":3}'),env,400]]){
  const r=await handleRunnerRequest(request,settings,execute);assert.equal(r.status,status);assert.match(r.headers.get('cache-control'),/no-store/);
 }
 assert.equal(calls,0);
 const r=await handleRunnerRequest(req('POST','Bearer '+secret),env,execute);assert.equal(r.status,200);assert.equal(calls,1);assert.ok(!(await r.text()).includes('private'));
});
