import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { publishedPageSchema, type PublishedPage } from './schemas';
import { validCmsSlug } from './safety.mjs';

/** No shared caches: an unpublish must take effect on the very next request. */
export async function getPublishedPage(locale:string,slug:string):Promise<PublishedPage|null>{
 if(!['en','bn'].includes(locale)||!validCmsSlug(slug))return null;
 try{
  const client=await createServerSupabaseClient();if(!client)return null;
  const {data,error}=await client.rpc('iojh_cms_public_page',{p_locale:locale,p_slug:slug});
  if(error||!data)return null;
  const checked=publishedPageSchema.safeParse(data);
  return checked.success?checked.data:null;
 }catch{return null;}
}
export type PublicMedia = {key:string;mime:'image/png'|'image/jpeg'|'image/webp';bytes:number;width:number;height:number;altEn:string;altBn:string};
export async function getPublishedMedia(id:string):Promise<PublicMedia|null>{
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return null;
 try{
  const client=await createServerSupabaseClient();if(!client)return null;
  const {data,error}=await client.rpc('iojh_cms_public_media',{p_id:id});
  if(error||!data||typeof data!=='object'||Array.isArray(data))return null;
  const x=data as Record<string,unknown>;
  if(typeof x.key!=='string'||!/^assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(x.key)||
     !['image/png','image/jpeg','image/webp'].includes(String(x.mime))||typeof x.bytes!=='number'||typeof x.width!=='number'||typeof x.height!=='number')return null;
  return {key:x.key,mime:x.mime as PublicMedia['mime'],bytes:x.bytes,width:x.width,height:x.height,altEn:String(x.altEn??''),altBn:String(x.altBn??'')};
 }catch{return null;}
}
