import { sameOriginRequest } from '@/features/content/server/http';
import { NextResponse } from 'next/server';
import { getAdminAccess } from '@/features/admin/authorization';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCmsStorageAdmin, CMS_MEDIA_BUCKET } from '@/features/content/server/storage';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
type Props={params:Promise<{id:string}>};
export async function GET(_req:Request,{params}:Props){const access=await getAdminAccess();if(access!=='authorized')return new Response(null,{status:access==='signed_out'?401:403,headers});
 const {id}=await params;if(!/^[a-f\d-]{36}$/i.test(id))return new Response(null,{status:404,headers});
 const client=await createServerSupabaseClient(),storage=getCmsStorageAdmin();if(!client||!storage)return new Response(null,{status:503,headers});
 const {data}=await client.rpc('iojh_cms_admin_media_one',{p_id:id});
 if(!data||typeof data!=='object'||typeof data.key!=='string'||data.status!=='ready')return new Response(null,{status:404,headers});
 const {data:blob,error}=await storage.storage.from(CMS_MEDIA_BUCKET).download(data.key);
 if(error||!blob)return new Response(null,{status:404,headers});
 return new Response(blob,{headers:{...headers,'Content-Type':data.mime,'Content-Disposition':'inline'}});
}
export async function DELETE(req:Request,{params}:Props){if(!sameOriginRequest(req))return NextResponse.json({error:'Origin rejected'},{status:403,headers});const access=await getAdminAccess();if(access!=='authorized')return NextResponse.json({error:'Access denied'},{status:access==='signed_out'?401:403,headers});
 const {id}=await params;if(!/^[a-f\d-]{36}$/i.test(id))return NextResponse.json({error:'Not found'},{status:404,headers});
 const client=await createServerSupabaseClient();if(!client)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 const {data,error}=await client.rpc('iojh_cms_retire_media',{p_id:id});
 if(error)return NextResponse.json({error:'Referenced or protected assets cannot be retired.'},{status:409,headers});
 return NextResponse.json({retired:data===true,storageRetained:true},{headers});
}
