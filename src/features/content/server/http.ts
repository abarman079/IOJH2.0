import 'server-only';
export function sameOriginRequest(req:Request){
 const origin=req.headers.get('origin');
 if(!origin)return false; // CSRF defense in depth: browser mutations must provide same-origin Origin.
 try{return new URL(origin).origin===new URL(req.url).origin;}catch{return false;}
}
export async function safeJson(req:Request,max=50_000):Promise<unknown>{
 const size=Number(req.headers.get('content-length')??0);
 if(!Number.isSafeInteger(size)||size<=0||size>max)throw Error('Payload exceeds allowed size');
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('Expected JSON');
 return req.json();
}
