import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getAdminAccess} from '@/features/admin/authorization';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {sameOriginRequest} from '@/features/content/server/http';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const input=z.object({notificationId:z.uuid(),reason:z.enum(['operator_reviewed','provider_recovered','incident_recovery'])}).strict();
export async function POST(req:NextRequest){
 if(!sameOriginRequest(req))return NextResponse.json({error:'Origin rejected'},{status:403,headers});
 const access=await getAdminAccess();
 if(access!=='authorized')return NextResponse.json({error:'Access denied'},{status:access==='signed_out'?401:403,headers});
 if(Number(req.headers.get('content-length')??0)>2048)return NextResponse.json({error:'Payload too large'},{status:413,headers});
 let data:unknown;try{data=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400,headers});}
 const parsed=input.safeParse(data);if(!parsed.success)return NextResponse.json({error:'Invalid request'},{status:400,headers});
 const client=await createServerSupabaseClient();if(!client)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 try{
  const {data:accepted,error}=await client.rpc('iojh_notifications_admin_retry',{p_notification:parsed.data.notificationId,p_reason:parsed.data.reason});
  if(error)return NextResponse.json({error:'Recovery not authorized'},{status:403,headers});
  if(accepted!==true)return NextResponse.json({error:'Not eligible for recovery'},{status:409,headers});
  return NextResponse.json({requeued:true,delivered:false},{status:200,headers});
 }catch{return NextResponse.json({error:'Recovery service unavailable'},{status:503,headers});}
}
