import {NextRequest,NextResponse} from 'next/server';
import {verifyResendWebhook,parseResendEvent} from '@/lib/notifications/webhook.mjs';
import {recordVerifiedProviderEvent} from '@/lib/notifications/server';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(req:NextRequest){
 if(process.env.IOJH_NOTIFICATIONS_WEBHOOK_ENABLED!=='true'||!process.env.IOJH_NOTIFICATIONS_WEBHOOK_SECRET)
  return new NextResponse(null,{status:404,headers});
 if(Number(req.headers.get('content-length')??0)>32768)return new NextResponse(null,{status:413,headers});
 let body='';try{body=await req.text();if(Buffer.byteLength(body)>32768)return new NextResponse(null,{status:413,headers});}catch{return new NextResponse(null,{status:400,headers});}
 const verified=verifyResendWebhook({body,id:req.headers.get('svix-id'),timestamp:req.headers.get('svix-timestamp'),
  signature:req.headers.get('svix-signature'),secret:process.env.IOJH_NOTIFICATIONS_WEBHOOK_SECRET});
 if(!verified)return new NextResponse(null,{status:401,headers});
 let event:{type:string;emailId:string};try{event=parseResendEvent(JSON.parse(body));}catch{return new NextResponse(null,{status:202,headers});}
 try{await recordVerifiedProviderEvent(req.headers.get('svix-id')!,event.emailId,event.type);
   return NextResponse.json({received:true},{status:200,headers});
 }catch{return NextResponse.json({received:false},{status:503,headers});}
}
