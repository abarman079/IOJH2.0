-- C06 pgTAP: ALWAYS a disposable Linux/local Supabase database. NEVER run against hosted projects.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select plan(35);

select ok(to_regclass('private.cms_entities') is not null,'CMS entities exist');
select ok(to_regclass('private.cms_revisions') is not null,'immutable revisions exist');
select ok(to_regclass('private.cms_media_assets') is not null,'private media catalog exists');
select ok((select relrowsecurity from pg_class where oid='private.cms_revisions'::regclass),'revision RLS enabled');
select ok(not has_table_privilege('anon','private.cms_revisions','SELECT'),'anonymous cannot read drafts');
select ok(not has_table_privilege('authenticated','private.cms_revisions','SELECT'),'customer cannot select drafts');
select ok(not has_table_privilege('authenticated','private.cms_media_assets','UPDATE'),'customer cannot change asset permissions');
select ok(not has_function_privilege('anon','public.iojh_cms_save_revision(uuid,text,integer,text,text,text,jsonb,text,text)','EXECUTE'),'anonymous cannot save');
select ok(has_function_privilege('anon','public.iojh_cms_public_page(text,text)','EXECUTE'),'public projection is callable');
select ok((select public from storage.buckets where id='iojh-cms-media') is false,'media bucket is private');
select ok((select relrowsecurity from pg_class where oid='storage.objects'::regclass),'Storage object RLS enabled');
select is(public.iojh_cms_public_page('en','unknown-fixture'),null::jsonb,'unpublished page is absent');

insert into auth.users(id,instance_id,aud,"role",email,email_confirmed_at,created_at,updated_at,raw_user_meta_data) values
('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c06-user@example.invalid',now(),now(),now(),'{"role":"admin"}'::jsonb),
('a1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c06-admin@example.invalid',now(),now(),now(),'{}'::jsonb);
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.iojh_cms_create_entity('article','editorial')$$, '42501','Not authorized','forged role and metadata cannot create content');
reset role;

select set_config('iojh.admin_change_reason','C06 disposable test owner grant with valid reason',true);
insert into private.admin_memberships(user_id,active) values ('a1000000-0000-4000-8000-000000000002',true);
insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','C06 test','totp','verified',now(),now());
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select public.iojh_cms_create_entity('article','editorial')$$, '42501','Not authorized','AAL1 administrator denied');
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select ok(public.iojh_admin_aal2(),'AAL2 admin with TOTP accepted');
create temp table c06_fixture_ids(id uuid,revision uuid);
insert into c06_fixture_ids(id) select public.iojh_cms_create_entity('article','editorial');
select ok((select id is not null from c06_fixture_ids),'privileged create works');
-- PGTAP fixture uses an actual database RPC and immutable revision record.
update c06_fixture_ids set revision=public.iojh_cms_save_revision(id,'en',0,'test-c06-article','Verified research title','Public short summary',
 '[{"id":"11222222-2222-4222-8222-222222222222","type":"richText","schemaVersion":1,"variant":"prose","position":0,"isVisible":true,"content":{"paragraphs":[{"text":"Approved text from the disposable database."}]}}]'::jsonb,
 'Private staff-only note','reviewed');
select ok((select revision is not null from c06_fixture_ids),'revision saved with server role');
select is(public.iojh_cms_public_page('en','test-c06-article'),null::jsonb,'draft not publicly projected');
select throws_ok($$update private.cms_revisions set title='Tampered' where title='Verified research title'$$,'42501',null,'direct table update forbidden');
reset role;
-- Database owner attempts to mutate history also hit immutable trigger.
select throws_ok($$update private.cms_revisions set title='Tampered' where title='Verified research title'$$,'23514',null,'revision trigger blocks physical mutation');
set local role authenticated;
select public.iojh_cms_publish_revision(revision,1) from c06_fixture_ids;
select is((public.iojh_cms_public_page('en','test-c06-article')->>'title'),'Verified research title','publication exposes approved title');
select ok(not (public.iojh_cms_public_page('en','test-c06-article') ? 'private_notes'),'private notes absent from projection');
select throws_ok($$select public.iojh_cms_save_revision(id,'en',0,'test-c06-article','Another title','',
 '[{"id":"11222222-2222-4222-8222-222222222222","type":"richText","schemaVersion":1,"variant":"prose","position":0,"isVisible":true,"content":{"paragraphs":[{"text":"Attempt stale write"}]}}]'::jsonb)
 from c06_fixture_ids$$,'40001',null,'stale concurrent revision rejected');
reset role;
select ok(not private.cms_valid_blocks('[{"type":"script"}]'::jsonb,'editorial'),'unknown block rejected');
select ok(not private.cms_valid_blocks('[{"id":"11222222-2222-4222-8222-222222222222","type":"richText","schemaVersion":1,"variant":"prose","position":0,"isVisible":true,"content":{"paragraphs":[{"text":"<script>alert(1)</script>"}]}}]'::jsonb,'editorial'),'executable markup rejected');

-- Additional protected invariants: independent locales, route ownership, and media lifetimes.
select is(public.iojh_cms_public_page('bn','test-c06-article'),null::jsonb,'EN publication never auto-publishes BN');
reset role;
select ok(not private.cms_slug_ok('admin'),'reserved admin slug is invalid');
select ok(not private.cms_slug_ok('api'),'reserved API slug is invalid');
select ok(not private.cms_valid_blocks('[{"id":"11222222-2222-4222-8222-222222222222","type":"hero","schemaVersion":1,"variant":"split","position":0,"isVisible":true,"content":{"title":"Bad template"}}]'::jsonb,'editorial'),'hero cannot occupy editorial template');

-- Competing locale routes: same EN slug cannot have two published owners.
set local role authenticated;
create temp table c06_collision(id uuid,revision uuid);
insert into c06_collision(id) select public.iojh_cms_create_entity('article','editorial');
update c06_collision set revision=public.iojh_cms_save_revision(id,'en',0,'test-c06-article','Other published title','Private revision',
 '[{"id":"21222222-2222-4222-8222-222222222222","type":"richText","schemaVersion":1,"variant":"prose","position":0,"isVisible":true,"content":{"paragraphs":[{"text":"Another article claims the same route."}]}}]'::jsonb,'','reviewed');
select throws_ok($$select public.iojh_cms_publish_revision(revision,1) from c06_collision$$,'23505',null,'duplicate published locale route is rejected');
reset role;

-- A read-only media fixture verifies reference retention and public-rights gating at SQL level.
-- Not a real binary Storage upload. Upload/signature tested separately in app integration.
insert into private.cms_media_assets(id,series_id,version,object_key,mime,bytes,width,height,sha256,rights_holder,license_name,alt_en,alt_bn,public_rights,created_by)
values('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',1,
 'assets/c1000000-0000-4000-8000-000000000002/c1000000-0000-4000-8000-000000000001.png',
 'image/png',800,16,12,repeat('a',64),'IOJH test','Owner test rights','An abstract teal research diagram','গবেষণার চিত্র',true,'a1000000-0000-4000-8000-000000000002');
set local role authenticated;
create temp table c06_media_fixture(id uuid,revision uuid);
insert into c06_media_fixture(id) select public.iojh_cms_create_entity('page','landing');
update c06_media_fixture set revision=public.iojh_cms_save_revision(id,'en',0,'c06-media-test','Asset publishing example','Test media reference',
 '[{"id":"31222222-2222-4222-8222-222222222222","type":"hero","schemaVersion":1,"variant":"editorial","position":0,"isVisible":true,"content":{"title":"Licensed media example","body":"Approved test asset","mediaId":"c1000000-0000-4000-8000-000000000001"}}]'::jsonb,'','reviewed');
reset role;
select ok((select exists(select 1 from private.cms_revision_media where revision_id=(select revision from c06_media_fixture))),'every revision records media usage');
set local role authenticated;
select is(public.iojh_cms_public_media('c1000000-0000-4000-8000-000000000001'),null::jsonb,'draft media remains private');
select public.iojh_cms_publish_revision(revision,1) from c06_media_fixture;
select is((public.iojh_cms_public_media('c1000000-0000-4000-8000-000000000001')->>'mime'),'image/png','published licensed media is projected');
select throws_ok($$select public.iojh_cms_retire_media('c1000000-0000-4000-8000-000000000001')$$,'23503',null,'referenced media cannot be retired');
reset role;

select set_config('iojh.admin_change_reason','C06 disposable fixture revoked administrator',true);
update private.admin_memberships set active=false,revoked_at=now() where user_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.iojh_cms_create_entity('page','standard')$$,'42501','Not authorized','revoked AAL2 owner cannot create content');
reset role;
select * from finish();
rollback;
