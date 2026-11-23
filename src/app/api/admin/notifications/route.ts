import {NextRequest,NextResponse} from 'next/server';
import {getAdminAccess} from '@/features/admin/authorization';
import {createServerSupabaseClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(req:NextRequest){
  const access=await getAdminAccess();
  if(access!=='authorized')return NextResponse.json({error:'Access denied'},{status:access==='signed_out'?401:403,headers});
  const limit=Number(req.nextUrl.searchParams.get('limit')??25);
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)return NextResponse.json({error:'Invalid pagination limit'},{status:400,headers});
  const before=req.nextUrl.searchParams.get('before');
  const beforeId=req.nextUrl.searchParams.get('beforeId');
  if ((before!==null || beforeId!==null) &&
      (!before || Number.isNaN(Date.parse(before)) || !beforeId || !/^[0-9a-f-]{36}$/i.test(beforeId)))
    return NextResponse.json({error:'Invalid pagination cursor'},{status:400,headers});
  const client=await createServerSupabaseClient();
  if(!client)return NextResponse.json({error:'Unavailable'},{status:503,headers});
  try{
    const {data,error}=await client.rpc('iojh_notifications_admin_failures',{p_limit:limit,p_before:before??null,p_before_id:beforeId??null});
    if(error||!Array.isArray(data))throw new Error('failure RPC');
    return NextResponse.json({rows:data},{status:200,headers});
  }catch{return NextResponse.json({error:'Unable to read notification status'},{status:503,headers});}
}
