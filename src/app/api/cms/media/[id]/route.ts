import { getPublishedMedia } from '@/features/content/public';
import { getCmsStorageAdmin,CMS_MEDIA_BUCKET } from '@/features/content/server/storage';
export const dynamic='force-dynamic';
export const revalidate=0;
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const meta=await getPublishedMedia(id);if(!meta)return new Response(null,{status:404,headers});
 const storage=getCmsStorageAdmin();if(!storage)return new Response(null,{status:503,headers});
 const {data,error}=await storage.storage.from(CMS_MEDIA_BUCKET).download(meta.key);
 if(error||!data||data.size>4194304)return new Response(null,{status:404,headers});
 return new Response(data,{headers:{...headers,'Content-Type':meta.mime,'Content-Disposition':'inline'}});
}
