-- C06a/b: additive IOJH CMS foundation. Depends on 202611110001 and 202611150001.
-- Apply only after selecting and backing up the IOJH 2.0 development project.
begin;
do $$ begin
 if to_regprocedure('public.iojh_admin_aal2()') is null then
  raise exception 'C05c admin gate missing; do not run historical migrations again';
 end if;
end $$;

create table private.cms_entities (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('page','article')),
 template text not null check (template in ('standard','editorial','landing')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table private.cms_translations (
 entity_id uuid not null references private.cms_entities(id) on delete restrict,
 locale text not null check (locale in ('en','bn')),
 head_version integer not null default 0 check (head_version >= 0),
 head_revision_id uuid,
 published_revision_id uuid,
 published_slug text,
 translation_status text not null default 'in_progress' check (translation_status in ('in_progress','reviewed')),
 updated_at timestamptz not null default now(),
 primary key (entity_id, locale),
 check (published_slug is null or published_revision_id is not null),
 check (published_slug is null or published_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create unique index cms_unique_published_route on private.cms_translations(locale,published_slug) where published_slug is not null;
create table private.cms_revisions (
 id uuid primary key default gen_random_uuid(),
 entity_id uuid not null,
 locale text not null,
 revision_no integer not null check (revision_no > 0),
 schema_version integer not null default 1 check (schema_version = 1),
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
 title text not null check (length(title) between 4 and 180),
 summary text not null default '' check (length(summary) <= 340),
 blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
 private_notes text not null default '' check (length(private_notes) <= 1500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key (entity_id,locale) references private.cms_translations(entity_id,locale) on delete restrict,
 unique(entity_id, locale, revision_no),
 unique(id,entity_id,locale)
);
create table private.cms_publication_events (
 id bigint generated always as identity primary key,
 entity_id uuid not null references private.cms_entities(id) on delete restrict,
 locale text not null check(locale in ('en','bn')),
 revision_id uuid references private.cms_revisions(id) on delete restrict,
 action text not null check(action in ('published','unpublished')),
 actor_id uuid not null references auth.users(id),
 occurred_at timestamptz not null default now()
);
alter table private.cms_translations
 add constraint cms_head_revision_fk foreign key (head_revision_id,entity_id,locale)
 references private.cms_revisions(id,entity_id,locale) deferrable initially immediate,
 add constraint cms_published_revision_fk foreign key (published_revision_id,entity_id,locale)
 references private.cms_revisions(id,entity_id,locale) deferrable initially immediate;

create table private.cms_block_registry (
 type text primary key,
 schema_version integer not null default 1,
 supported boolean not null default false,
 templates text[] not null,
 variants text[] not null,
 max_per_page integer not null default 1 check (max_per_page between 1 and 16)
);
insert into private.cms_block_registry(type,supported,templates,variants,max_per_page) values
 ('hero',true,array['landing','standard'],array['editorial','split'],1),
 ('intro',true,array['landing','standard','editorial'],array['prose','aside'],3),
 ('featureGrid',true,array['landing','standard'],array['two','three'],2),
 ('richText',true,array['landing','standard','editorial'],array['prose','wide'],8),
 ('faq',true,array['landing','standard','editorial'],array['stack'],2),
 ('contactInvitation',true,array['landing','standard','editorial'],array['quiet','highlight'],1),
 ('serviceLedger',false,array['landing'],array['editorial'],1),
 ('projectShowcase',false,array['landing','standard'],array['grid'],1),
 ('verifiedMetrics',false,array['landing','standard'],array['strip'],1),
 ('courseShelf',false,array['landing'],array['cards'],1),
 ('bookShelf',false,array['landing'],array['cards'],1),
 ('programPanel',false,array['landing'],array['editorial'],1),
 ('journalShowcase',false,array['landing'],array['grid'],1),
 ('journalFinderTeaser',false,array['landing'],array['quiet'],1),
 ('timeline',false,array['standard','editorial'],array['vertical'],1),
 ('teamPreview',false,array['landing','standard'],array['grid'],1);

-- Immutable object identities. Storage bucket is PRIVATE; only the server-side service client uploads.
create table private.cms_media_assets (
 id uuid primary key,
 series_id uuid not null,
 version integer not null check(version > 0),
 predecessor_id uuid references private.cms_media_assets(id) on delete restrict,
 object_key text not null unique check(object_key ~ '^assets/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
 mime text not null check(mime in ('image/png','image/jpeg','image/webp')),
 bytes integer not null check(bytes between 64 and 4194304),
 width integer not null check(width between 1 and 6000),
 height integer not null check(height between 1 and 6000),
 constraint cms_media_pixel_budget check (width * height <= 20000000),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 rights_holder text not null check(length(rights_holder) between 3 and 180),
 license_name text not null check(length(license_name) between 3 and 120),
 alt_en text not null check(length(alt_en) between 5 and 240),
 alt_bn text not null default '' check(length(alt_bn) <= 240),
 public_rights boolean not null default false,
 status text not null default 'ready' check(status in ('ready','retired')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(series_id,version)
);
create table private.cms_revision_media (
 revision_id uuid not null references private.cms_revisions(id) on delete restrict,
 media_id uuid not null references private.cms_media_assets(id) on delete restrict,
 primary key(revision_id,media_id)
);
create index cms_usage_media_id_idx on private.cms_revision_media(media_id);
alter table private.cms_media_assets enable row level security;
alter table private.cms_revision_media enable row level security;
revoke all on private.cms_media_assets,private.cms_revision_media from public,anon,authenticated;

-- Revision history is append-only (including for table owner unless trigger deliberately disabled).
create function private.cms_immutable_revision() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'CMS revisions are immutable; create a new revision' using errcode='23514'; end $$;
create trigger cms_revisions_immutable before update or delete on private.cms_revisions
for each row execute function private.cms_immutable_revision();

create function private.cms_slug_ok(s text) returns boolean language sql immutable set search_path = '' as $$
 select s ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(s) <= 90
 and s not in ('admin','api','account','auth','cart','checkout','sign-in','sign-up','forgot-password','reset-password','verify-email','en','bn','_next','favicon','robots','sitemap','search','media','preview','cms')
$$;

-- DB validation is deliberately stricter than basic JSONB: direct REST RPC cannot bypass UI validation.
create function private.cms_valid_blocks(v jsonb, tpl text) returns boolean
language plpgsql stable set search_path = '' as $$
declare b jsonb; r record; i integer := 0; used_count integer; c jsonb; k text; item jsonb; seen text[] := array[]::text[];
begin
 if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>16 or jsonb_array_length(v)<1 or length(v::text)>40000 then return false; end if;
 for b in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(b) <> 'object' then return false; end if;
  if jsonb_typeof(b->'id') is distinct from 'string' then return false; end if;
  if b->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return false; end if;
  if b->>'id' = any(seen) then return false; end if;
  seen:=array_append(seen,b->>'id');
  for k in select jsonb_object_keys(b) loop
   if k not in ('id','type','schemaVersion','variant','isVisible','position','content','entityRefs') then return false; end if;
  end loop;
  if b->>'schemaVersion' is distinct from '1' or b->>'position' is distinct from i::text or jsonb_typeof(b->'isVisible') is distinct from 'boolean' then return false; end if;
  if b ? 'entityRefs' and (jsonb_typeof(b->'entityRefs') <> 'array' or jsonb_array_length(b->'entityRefs') > 0) then return false; end if;
  select * into r from private.cms_block_registry where type=b->>'type';
  if not found or not r.supported or not (tpl=any(r.templates)) or not (b->>'variant'=any(r.variants)) then return false; end if;
  select count(*) into used_count from jsonb_array_elements(v) x where x->>'type'=r.type;
  if used_count > r.max_per_page then return false; end if;
  c:=b->'content'; if jsonb_typeof(c) is distinct from 'object' or length(c::text)>8000 then return false; end if;
  -- No raw HTML/CSS/JS, javascript: URLs, HTML event attributes, or embedded financial values.
  if c::text ~* '(</?[a-z][a-z0-9]*|javascript:|data:|onerror|onload|<script|"(price|amount|payment|stock|css|html|script)"\s*:)' then return false; end if;
  for k in select jsonb_object_keys(c) loop
   if (r.type='hero' and k not in ('title','body','href','linkLabel','mediaId'))
   or (r.type='intro' and k not in ('title','body'))
   or (r.type='contactInvitation' and k not in ('title','body','href','linkLabel'))
   or (r.type='featureGrid' and k not in ('title','items'))
   or (r.type='richText' and k not in ('paragraphs'))
   or (r.type='faq' and k not in ('items')) then return false; end if;
  end loop;
  if c ? 'mediaId' and (r.type <> 'hero' or c->>'mediaId' !~* '^[0-9a-f]{8}-[0-9a-f-]{27,36}$') then return false; end if;
  if r.type in ('faq','featureGrid') then
   for item in select value from jsonb_array_elements(c->'items') loop
    if jsonb_typeof(item)<>'object' then return false; end if;
    if r.type='faq' and (length(coalesce(item->>'question','')) not between 4 and 180 or length(coalesce(item->>'answer','')) not between 4 and 1600 or (select count(*) from jsonb_object_keys(item)) <> 2) then return false; end if;
    if r.type='featureGrid' and (length(coalesce(item->>'title','')) not between 4 and 120 or length(coalesce(item->>'body','')) not between 4 and 500 or (select count(*) from jsonb_object_keys(item)) <> 2) then return false; end if;
   end loop;
  end if;
  if r.type='richText' then
   for item in select value from jsonb_array_elements(c->'paragraphs') loop
    if jsonb_typeof(item)<>'object' or length(coalesce(item->>'text','')) not between 1 and 2000 or (select count(*) from jsonb_object_keys(item)) <> 1 then return false; end if;
   end loop;
  end if;
  if r.type in ('hero','intro','contactInvitation') and (length(coalesce(c->>'title','')) not between 4 and 180 or length(coalesce(c->>'body',''))>1000) then return false; end if;
  if r.type='richText' and (jsonb_typeof(c->'paragraphs')<>'array' or jsonb_array_length(c->'paragraphs')>20) then return false; end if;
  if r.type='faq' and (jsonb_typeof(c->'items')<>'array' or jsonb_array_length(c->'items')>12) then return false; end if;
  if r.type='featureGrid' and (jsonb_typeof(c->'items')<>'array' or jsonb_array_length(c->'items')>6) then return false; end if;
  if c ? 'href' and not ((c->>'href' ~ '^/[a-zA-Z0-9/_-]+$') or (c->>'href' ~ '^https://[a-zA-Z0-9.-]+(/[a-zA-Z0-9/?&=%#._-]*)?$')) then return false; end if;
  i:=i+1;
 end loop;
 return true;
exception when others then return false;
end $$;

create function private.cms_actor_ok() returns boolean language sql stable set search_path = '' as $$
 select coalesce((select public.iojh_admin_aal2()),false) and (select auth.uid()) is not null
$$;

-- Publicly exposed RPCs are protected inside PostgreSQL, not solely by the Next.js UI.
create function public.iojh_cms_create_entity(p_kind text,p_template text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_kind not in ('page','article') or p_template not in ('standard','landing','editorial') then raise exception 'Invalid entity kind/template' using errcode='22023'; end if;
 insert into private.cms_entities(kind,template,created_by) values(p_kind,p_template,auth.uid()) returning id into v_id;
 return v_id;
end $$;

create function public.iojh_cms_save_revision(p_entity uuid,p_locale text,p_expected integer,p_slug text,p_title text,p_summary text,p_blocks jsonb,p_notes text default '',p_translation_status text default 'in_progress') returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_version integer; v_template text; v_id uuid; v_block jsonb; v_media_id uuid;
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_locale not in ('en','bn') or not private.cms_slug_ok(p_slug) or length(p_title) not between 4 and 180 or length(p_summary)>340 or length(p_notes)>1500 or p_translation_status not in ('in_progress','reviewed') then raise exception 'Invalid content metadata' using errcode='22023'; end if;
 select template into v_template from private.cms_entities where id=p_entity;
 if v_template is null or not private.cms_valid_blocks(p_blocks,v_template) then raise exception 'Invalid content blocks or entity' using errcode='22023'; end if;
 insert into private.cms_translations(entity_id,locale) values(p_entity,p_locale) on conflict do nothing;
 select head_version into v_version from private.cms_translations where entity_id=p_entity and locale=p_locale for update;
 if v_version is distinct from p_expected then raise exception 'Stale revision: refresh before saving' using errcode='40001'; end if;
 insert into private.cms_revisions(entity_id,locale,revision_no,slug,title,summary,blocks,private_notes,created_by)
 values(p_entity,p_locale,v_version+1,p_slug,p_title,p_summary,p_blocks,p_notes,auth.uid()) returning id into v_id;
 -- Media references are materialized immutably on each new revision.
 for v_block in select value from jsonb_array_elements(p_blocks) loop
  if (v_block->'content' ? 'mediaId') then
   v_media_id:=(v_block->'content'->>'mediaId')::uuid;
   perform 1 from private.cms_media_assets where id=v_media_id and status='ready' for share;
   if not found then
    raise exception 'Unknown or unavailable media reference' using errcode='23503';
   end if;
   insert into private.cms_revision_media(revision_id,media_id) values(v_id,v_media_id) on conflict do nothing;
  end if;
 end loop;
 update private.cms_translations set head_version=v_version+1, head_revision_id=v_id, translation_status=p_translation_status, updated_at=now()
 where entity_id=p_entity and locale=p_locale;
 return v_id;
end $$;

create function public.iojh_cms_publish_revision(p_revision uuid,p_expected integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare r private.cms_revisions%rowtype; t private.cms_translations%rowtype;
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into r from private.cms_revisions where id=p_revision;
 if not found then raise exception 'Revision not found' using errcode='22023'; end if;
 select * into t from private.cms_translations where entity_id=r.entity_id and locale=r.locale for update;
 if t.head_version is distinct from p_expected or t.head_revision_id is distinct from p_revision then raise exception 'Stale publish: reload' using errcode='40001'; end if;
 if t.translation_status<>'reviewed' or not private.cms_slug_ok(r.slug) or not private.cms_valid_blocks(r.blocks,(select template from private.cms_entities where id=r.entity_id)) then raise exception 'Revision has not passed editorial validation' using errcode='22023'; end if;
 if exists(select 1 from private.cms_revision_media u join private.cms_media_assets a on a.id=u.media_id where u.revision_id=p_revision and (a.status<>'ready' or not a.public_rights)) then
  raise exception 'Media permissions not approved' using errcode='42501'; end if;
 update private.cms_translations set published_revision_id=p_revision, published_slug=r.slug, updated_at=now() where entity_id=r.entity_id and locale=r.locale;
 insert into private.cms_publication_events(entity_id,locale,revision_id,action,actor_id)
 values(r.entity_id,r.locale,p_revision,'published',auth.uid());
 -- No persistent Next cache is used in C06. C07/C08 will add durable invalidation.
end $$;

create function public.iojh_cms_unpublish(p_entity uuid,p_locale text,p_expected integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v integer;
begin
 if not private.cms_actor_ok() then raise exception 'Not authorized' using errcode='42501'; end if;
 select head_version into v from private.cms_translations where entity_id=p_entity and locale=p_locale for update;
 if v is distinct from p_expected then raise exception 'Stale unpublish' using errcode='40001'; end if;
 update private.cms_translations set published_revision_id=null,published_slug=null,head_version=head_version+1,updated_at=now() where entity_id=p_entity and locale=p_locale;
 insert into private.cms_publication_events(entity_id,locale,revision_id,action,actor_id) values(p_entity,p_locale,null,'unpublished',auth.uid());
end $$;

create function public.iojh_cms_public_page(p_locale text,p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
 select pg_catalog.jsonb_build_object(
  'entityId',r.entity_id,'locale',r.locale,'slug',t.published_slug,'template',e.template,
  'title',r.title,'summary',r.summary,'schemaVersion',r.schema_version,'blocks',r.blocks)
 from private.cms_translations t join private.cms_revisions r on r.id=t.published_revision_id
 join private.cms_entities e on e.id=t.entity_id
 where t.locale=p_locale and t.published_slug=p_slug and r.schema_version=1
 and private.cms_valid_blocks(r.blocks,e.template)
 limit 1
$$;

-- A media object is public only while referenced by an active published revision.
create function public.iojh_cms_public_media(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select pg_catalog.jsonb_build_object('key',a.object_key,'mime',a.mime,'bytes',a.bytes,'width',a.width,'height',a.height,'altEn',a.alt_en,'altBn',a.alt_bn)
 from private.cms_media_assets a where a.id=p_id and a.status='ready' and a.public_rights
 and exists(select 1 from private.cms_revision_media u join private.cms_translations t
  on t.published_revision_id=u.revision_id
  join private.cms_revisions r on r.id=u.revision_id
  where u.media_id=a.id and exists(select 1 from jsonb_array_elements(r.blocks) b where b->>'isVisible'='true' and b->'content'->>'mediaId'=p_id::text))
 limit 1
$$;

-- Privileges: private records have no direct REST table access.
alter table private.cms_publication_events enable row level security;
revoke all on private.cms_publication_events from public,anon,authenticated;
alter table private.cms_entities enable row level security;
alter table private.cms_translations enable row level security;
alter table private.cms_revisions enable row level security;
alter table private.cms_block_registry enable row level security;
revoke all on private.cms_entities,private.cms_translations,private.cms_revisions,private.cms_block_registry from public,anon,authenticated;
revoke all on function private.cms_actor_ok(),private.cms_slug_ok(text),private.cms_valid_blocks(jsonb,text),private.cms_immutable_revision() from public,anon,authenticated;
revoke all on function public.iojh_cms_create_entity(text,text),public.iojh_cms_save_revision(uuid,text,integer,text,text,text,jsonb,text,text),public.iojh_cms_publish_revision(uuid,integer),public.iojh_cms_unpublish(uuid,text,integer),public.iojh_cms_public_page(text,text),public.iojh_cms_public_media(uuid) from public,anon,authenticated;
grant execute on function public.iojh_cms_create_entity(text,text),public.iojh_cms_save_revision(uuid,text,integer,text,text,text,jsonb,text,text),public.iojh_cms_publish_revision(uuid,integer),public.iojh_cms_unpublish(uuid,text,integer) to authenticated;
grant execute on function public.iojh_cms_public_page(text,text),public.iojh_cms_public_media(uuid) to anon,authenticated;
commit;
