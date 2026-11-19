import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAccess } from '@/features/admin/authorization';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sameOriginRequest } from '@/features/content/server/http';
import { uploadCmsMedia } from '@/features/content/server/media';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
async function guard(){const x=await getAdminAccess();return x==='authorized'?null:NextResponse.json({error:'Access denied'}, {status:x==='signed_out'?401:403,headers});}
export async function GET(){const denied=await guard();if(denied)return denied;
 const client=await createServerSupabaseClient();if(!client)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 const {data,error}=await client.rpc('iojh_cms_admin_media');
 if(error||!Array.isArray(data))return NextResponse.json({error:'Unable to load assets'},{status:503,headers});
 return NextResponse.json({assets:data},{headers});
}
export async function POST(req:NextRequest){const denied=await guard();if(denied)return denied;
 if(!sameOriginRequest(req))return NextResponse.json({error:'Origin rejected'},{status:403,headers});
 const size=Number(req.headers.get('content-length')??0);
 if(!Number.isSafeInteger(size)||size<=0||size>5_500_000)return NextResponse.json({error:'Upload exceeds limit'},{status:413,headers});
 let form:FormData;
 try{form=await req.formData();}catch{return NextResponse.json({error:'Invalid multipart form'},{status:400,headers});}
 const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'Missing file'},{status:400,headers});
 const meta={rightsHolder:form.get('rightsHolder'),license:form.get('license'),altEn:form.get('altEn'),altBn:form.get('altBn')??'',
  publicRights:form.get('publicRights')==='true',...(form.get('previous')?{previous:form.get('previous')}: {})};
 const result=await uploadCmsMedia(file,meta);
 return result.ok?NextResponse.json(result.value,{status:201,headers}):NextResponse.json({error:result.message},{status:result.status,headers});
}
