-- C06c: private bucket and least-privilege media registration RPCs.
-- Prerequisite: 202611180001. Never upload with a service-role key in the browser.
begin;
do $$ begin
 if to_regclass('private.cms_media_assets') is null then raise exception 'C06a schema missing'; end if;
 if exists(select 1 from storage.buckets where id='iojh-cms-media') then
  raise exception 'IOJH CMS media bucket already exists. Inspect before applying; do not overwrite policies';
 end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('iojh-cms-media','iojh-cms-media',false,4194304,array['image/png','image/jpeg','image/webp']);
-- No policies for these objects are granted to anon or authenticated users.
-- All storage IO happens in a server-only module AFTER fresh getUser + DB AAL2.

create function public.iojh_cms_register_media(
 p_id uuid,p_key text,p_mime text,p_bytes integer,p_width integer,p_height integer,p_sha256 text,
 p_holder text,p_license text,p_alt_en text,p_alt_bn text,p_public_rights boolean,
 p_previous uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare prev private.cms_media_assets%rowtype; v_series uuid; v_version integer;
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_id is null or p_key !~ '^assets/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 or p_mime not in ('image/png','image/jpeg','image/webp') or p_bytes not between 64 and 4194304
 or p_width not between 1 and 6000 or p_height not between 1 and 6000 or p_width*p_height>20000000
 or (p_mime='image/png' and p_key !~ '\.png$') or (p_mime='image/jpeg' and p_key !~ '\.jpg$') or (p_mime='image/webp' and p_key !~ '\.webp$')
 or p_sha256 !~ '^[0-9a-f]{64}$' or length(p_holder) not between 3 and 180 or length(p_license) not between 3 and 120
 or length(p_alt_en) not between 5 and 240 or length(p_alt_bn)>240 then
   raise exception 'Invalid media metadata' using errcode='22023';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='iojh-cms-media' and name=p_key and metadata->>'mimetype'=p_mime) then
  raise exception 'Object not uploaded to the private CMS bucket' using errcode='23503'; end if;
 if p_previous is not null then
  select * into prev from private.cms_media_assets where id=p_previous for update;
  if not found or prev.status<>'ready' then raise exception 'Replacement source unavailable' using errcode='22023'; end if;
  v_series:=prev.series_id;
  select coalesce(max(version),0)+1 into v_version from private.cms_media_assets where series_id=v_series;
 else v_series:=p_id; v_version:=1;
 end if;
 insert into private.cms_media_assets(id,series_id,version,predecessor_id,object_key,mime,bytes,width,height,sha256,
  rights_holder,license_name,alt_en,alt_bn,public_rights,created_by)
 values(p_id,v_series,v_version,p_previous,p_key,p_mime,p_bytes,p_width,p_height,p_sha256,p_holder,p_license,p_alt_en,p_alt_bn,p_public_rights,auth.uid());
 return jsonb_build_object('id',p_id,'version',v_version,'seriesId',v_series);
end $$;

create function public.iojh_cms_admin_media_one(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select case when private.cms_actor_ok() then
 (select jsonb_build_object('key',object_key,'mime',mime,'bytes',bytes,'status',status) from private.cms_media_assets where id=p_id)
 else null end
$$;

create function public.iojh_cms_admin_media() returns jsonb
language sql stable security definer set search_path = '' as $$
 select case when private.cms_actor_ok() then
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'mime',mime,'bytes',bytes,'width',width,'height',height,
   'status',status,'altEn',alt_en,'altBn',alt_bn,'rightsHolder',rights_holder,
   'license',license_name,'publicRights',public_rights,'createdAt',created_at)
   order by created_at desc) from (select * from private.cms_media_assets order by created_at desc limit 40) a),'[]'::jsonb)
 else null end
$$;
-- Restricted retirement: only unreferenced media, old versions remain if referenced in ANY revision.
create function public.iojh_cms_retire_media(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from private.cms_media_assets where id=p_id for update;
 if exists(select 1 from private.cms_revision_media where media_id=p_id) then
  raise exception 'Referenced media cannot be retired' using errcode='23503'; end if;
 update private.cms_media_assets set status='retired' where id=p_id and status='ready';
 return found;
end $$;

revoke all on function public.iojh_cms_register_media(uuid,text,text,integer,integer,integer,text,text,text,text,text,boolean,uuid),
 public.iojh_cms_admin_media(),public.iojh_cms_admin_media_one(uuid),public.iojh_cms_retire_media(uuid) from public,anon,authenticated;
grant execute on function public.iojh_cms_register_media(uuid,text,text,integer,integer,integer,text,text,text,text,text,boolean,uuid),
 public.iojh_cms_admin_media(),public.iojh_cms_admin_media_one(uuid),public.iojh_cms_retire_media(uuid) to authenticated;
commit;
