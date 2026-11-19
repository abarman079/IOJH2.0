import {NextResponse} from 'next/server';
import {saveContentRevision} from '@/features/content/server/commands';
import {sameOriginRequest,safeJson} from '@/features/content/server/http';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export async function POST(req:Request){
 if(!sameOriginRequest(req))return NextResponse.json({error:'Origin rejected'},{status:403,headers});
 let body:unknown;try{body=await safeJson(req);}catch{return NextResponse.json({error:'Invalid request body'},{status:400,headers});}
 const r=await saveContentRevision(body);
 return r.ok?NextResponse.json(r.value,{status:201,headers}):NextResponse.json({error:r.error},{status:r.status,headers});
}
