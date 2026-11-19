import 'server-only';
import { z } from 'zod';
import { getAdminAccess } from '@/features/admin/authorization';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createRevisionSchema } from '../schemas';
const entitySchema=z.object({kind:z.enum(['page','article']),template:z.enum(['standard','editorial','landing'])}).strict();
export type CommandResult={ok:true;value:unknown}|{ok:false;status:number;error:string};
export async function createContentEntity(input:unknown):Promise<CommandResult>{
 if((await getAdminAccess())!=='authorized')return{ok:false,status:403,error:'Access denied'};
 const parsed=entitySchema.safeParse(input);if(!parsed.success)return{ok:false,status:400,error:'Invalid entity configuration'};
 const client=await createServerSupabaseClient();if(!client)return{ok:false,status:503,error:'Authentication unavailable'};
 const {data,error}=await client.rpc('iojh_cms_create_entity',{p_kind:parsed.data.kind,p_template:parsed.data.template});
 return error||!data?{ok:false,status:503,error:'Entity creation rejected'}:{ok:true,value:{id:data}};
}
export async function saveContentRevision(input:unknown):Promise<CommandResult>{
 if((await getAdminAccess())!=='authorized')return{ok:false,status:403,error:'Access denied'};
 const parsed=createRevisionSchema.safeParse(input);if(!parsed.success)return{ok:false,status:400,error:'Revision rejected by the block registry'};
 const p=parsed.data;
 const client=await createServerSupabaseClient();if(!client)return{ok:false,status:503,error:'Authentication unavailable'};
 const {data,error}=await client.rpc('iojh_cms_save_revision',{p_entity:p.entityId,p_locale:p.locale,p_expected:p.expectedVersion,
  p_slug:p.slug,p_title:p.title,p_summary:p.summary,p_blocks:p.blocks,p_notes:p.privateNotes,p_translation_status:p.translationStatus});
 if(error)return{ok:false,status:error.code==='40001'?409:422,error:error.code==='40001'?'Stale revision. Reload before saving.':'Revision failed database validation'};
 return{ok:true,value:{revisionId:data}};
}
