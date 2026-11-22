import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getPublicAuthConfig } from '@/features/auth/config';

export const CMS_MEDIA_BUCKET = 'iojh-cms-media';
/** Strictly server-only Storage adapter. Never import into a Client Component. */
export function getCmsStorageAdmin(){
 const cfg=getPublicAuthConfig();
 const secret=process.env.IOJH_CMS_STORAGE_SERVICE_KEY?.trim();
 if(!cfg||!secret||secret.length<20)return null;
 return createClient(cfg.url,secret,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
}
