import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyResendWebhook({id,timestamp,signature,body,secret,now=Date.now()}) {
  if (typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,128}$/.test(id)||
      typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||
      typeof signature!=='string'||signature.length>500||
      typeof body!=='string'||Buffer.byteLength(body)>32768||
      typeof secret!=='string'||!/^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(secret)) return false;
  if (Math.abs(Math.floor(now/1000)-Number(timestamp))>300) return false;
  let key;
  try {key=Buffer.from(secret.slice(6),'base64');}catch{return false;}
  if (!key.length) return false;
  const expected=createHmac('sha256',key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some((part)=>{
    if(!part.startsWith('v1,'))return false;
    let got;
    try{got=Buffer.from(part.slice(3),'base64');}catch{return false;}
    return got.length===expected.length&&timingSafeEqual(got,expected);
  });
}
export function parseResendEvent(input) {
  if (!input||typeof input!=='object')throw new TypeError('Invalid event');
  const type=input.type, emailId=input.data?.email_id;
  if (!['email.delivered','email.bounced','email.complained','email.suppressed'].includes(type)||
      typeof emailId!=='string'||!(/^[0-9a-f-]{36}$/i.test(emailId)))throw new TypeError('Unsupported event');
  return {type,emailId};
}
