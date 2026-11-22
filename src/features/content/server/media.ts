import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { inspectImage, MAX_IMAGE_BYTES } from '../safety.mjs';
import { mediaMetadataSchema } from '../schemas';
import { getCmsStorageAdmin, CMS_MEDIA_BUCKET } from './storage';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function uploadCmsMedia(file:File,metadata:unknown){
 const info=mediaMetadataSchema.safeParse(metadata);
 if(!info.success)return {ok:false as const,status:400,message:'Invalid rights, licensing, or alternative-text information.'};
 if(file.size<64||file.size>MAX_IMAGE_BYTES||!/^[^/\\\x00-\x1f]{1,120}\.(png|jpg|jpeg|webp)$/i.test(file.name))
  return {ok:false as const,status:400,message:'Invalid filename or file size (maximum 4 MB).'};
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))
  return {ok:false as const,status:400,message:'Unsupported media type.'};
 let bytes:Buffer,ext:string,width:number,height:number;
 try{
  bytes=Buffer.from(await file.arrayBuffer());
  const inspected=inspectImage(bytes,file.type);ext=inspected.ext;width=inspected.width;height=inspected.height;
  const expected=file.name.toLowerCase().split('.').at(-1);
  if(ext==='jpg'?!['jpg','jpeg'].includes(expected??''):ext!==expected)throw Error('MIME mismatch');
 }catch{return {ok:false as const,status:400,message:'Image signature or dimensions failed validation.'};}
 const storage=getCmsStorageAdmin(),userClient=await createServerSupabaseClient();
 if(!storage||!userClient)return {ok:false as const,status:503,message:'Media Storage has not been configured.'};
 const id=randomUUID(),key=`assets/${randomUUID()}/${id}.${ext}`;
 const digest=createHash('sha256').update(bytes).digest('hex');
 const {error:uploadError}=await storage.storage.from(CMS_MEDIA_BUCKET).upload(key,bytes,{contentType:file.type,upsert:false,cacheControl:'31536000'});
 if(uploadError)return {ok:false as const,status:503,message:'Storage could not accept this file.'};
 try{
  const {data,error}=await userClient.rpc('iojh_cms_register_media',{
   p_id:id,p_key:key,p_mime:file.type,p_bytes:bytes.length,p_width:width,p_height:height,p_sha256:digest,
   p_holder:info.data.rightsHolder,p_license:info.data.license,p_alt_en:info.data.altEn,
   p_alt_bn:info.data.altBn,p_public_rights:info.data.publicRights,p_previous:info.data.previous??null
  });
  if(error||!data)throw Error('Database registration failed');
  return {ok:true as const,value:data};
 }catch{
  const {error:cleanupError}=await storage.storage.from(CMS_MEDIA_BUCKET).remove([key]);
  if(cleanupError)console.error('C06 media cleanup requires owner review; check orphan inventory.');
  return {ok:false as const,status:503,message:'Media registration could not be completed. No media record was published.'};
 }
}
