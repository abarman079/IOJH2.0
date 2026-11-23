import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderNotification,validateTemplateInput,escapeHtml} from '../../src/lib/notifications/templates.mjs';
import {sendResend,classifyResendStatus} from '../../src/lib/notifications/provider.mjs';
import {verifyResendWebhook,parseResendEvent} from '../../src/lib/notifications/webhook.mjs';
import {createHmac} from 'node:crypto';
const base={templateId:'account_notice',templateVersion:1,reference:'IOJH-REFERENCE-001'};
const uuid='3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001';
const api={apiKey:'re_test-key-for-unit-test-only-0000',from:'IOJH <notice@example.org>',to:'someone@example.org',subject:'Operational notice',html:'<p>Notice</p>',text:'Notice',notificationId:uuid};
test('C07b bilingual operational email renders correct language, subject and text',()=>{
 for(const locale of ['en','bn']){
  const out=renderNotification({...base,locale},'https://iojh.com.bd');
  assert.match(out.html,new RegExp(`lang="${locale}"`));
  assert.ok(out.subject.length>=8);assert.ok(out.text.includes(`https://iojh.com.bd/${locale}/account`));
  assert.ok(out.html.includes(base.reference));assert.ok(out.html.includes('viewport'));
 }
});
test('C07b version, locale, template, and missing values fail closed',()=>{
 for(const override of [{templateVersion:2},{locale:'fr'},{templateId:'arbitrary'},{reference:''},{reference:'a'.repeat(41)},{reference:'BAD<script>'}]){
  assert.throws(()=>validateTemplateInput({...base,locale:'en',...override}));
 }
 assert.throws(()=>validateTemplateInput({...base,locale:'en',body:'Injected'}));
});
test('C07b HTML escaping and approved-origin handling',()=>{
 assert.equal(escapeHtml('<script>"&\'x'), '&lt;script&gt;&quot;&amp;&#39;x');
 for(const bad of ['https://evil.test/evil','javascript:alert(1)','https://user:pass@evil.test/','http://iojh.com.bd']){
  assert.throws(()=>renderNotification({...base,locale:'en'},bad));
 }
});
test('C07b Resend status codes classify transient, permanent and conflict responses',()=>{
 assert.deepEqual(classifyResendStatus(429),{outcome:'retry',code:'rate_limited'});
 assert.equal(classifyResendStatus(502).outcome,'retry');
 assert.equal(classifyResendStatus(409,'concurrent_idempotent_requests').outcome,'retry');
 assert.equal(classifyResendStatus(409,'invalid_idempotent_request').outcome,'permanent');
 assert.equal(classifyResendStatus(422).outcome,'permanent');
});
test('C07b provider adapter sends stable idempotency key without leaking secrets',async()=>{
 let seen;
 const r=await sendResend({...api,fetchImpl:async(url,init)=>{
  seen={url,init};return{status:200,json:async()=>({id:uuid})};
 }});
 assert.deepEqual(r,{outcome:'accepted',providerId:uuid});
 assert.equal(seen.url,'https://api.resend.com/emails');
 assert.equal(seen.init.headers['Idempotency-Key'],`iojh-notice-v1-${uuid}`);
 assert.ok(!seen.init.body.includes(api.apiKey));
 assert.equal(JSON.parse(seen.init.body).to[0],api.to);
});
test('C07b provider timeout remains ambiguous and retryable',async()=>{
 const r=await sendResend({...api,fetchImpl:async()=>{throw Error('secret network error');}});
 assert.deepEqual(r,{outcome:'retry',code:'timeout'});
});
test('C07b provider missing config fails before network request',async()=>{
 await assert.rejects(()=>sendResend({...api,apiKey:'',fetchImpl:()=>{throw Error('network called')}}),/Invalid/);
});
test('C07b webhook signatures, age limits, tampering and event shape',()=>{
 const id='evt_test-event-00001',timestamp=String(Math.floor(Date.now()/1000));
 const body=JSON.stringify({type:'email.bounced',data:{email_id:uuid}});
 const secret='whsec_'+Buffer.from('test_only_webhook_signing_secret_0123456789').toString('base64');
 const h=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.${body}`).digest('base64');
 assert.equal(verifyResendWebhook({id,timestamp,body,secret,signature:`v1,${h}`}),true);
 assert.equal(verifyResendWebhook({id,timestamp,body:body+' ',secret,signature:`v1,${h}`}),false);
 assert.equal(verifyResendWebhook({id,timestamp,body,secret,signature:`v1,${h}`,now:Date.now()+400000}),false);
 assert.deepEqual(parseResendEvent(JSON.parse(body)),{type:'email.bounced',emailId:uuid});
 assert.throws(()=>parseResendEvent({type:'email.opened',data:{email_id:uuid}}));
});
