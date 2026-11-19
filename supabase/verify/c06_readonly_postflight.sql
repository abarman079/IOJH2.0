-- READ ONLY: development project only. No private user details are returned.
select to_regclass('private.cms_entities') is not null as content_entities,
       to_regclass('private.cms_revisions') is not null as revisions,
       to_regclass('private.cms_media_assets') is not null as media_assets,
       to_regprocedure('public.iojh_cms_public_page(text,text)') is not null as public_projection;
select schemaname,tablename,rowsecurity from pg_tables where schemaname='private' and tablename like 'cms_%' order by tablename;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='iojh-cms-media';
select has_table_privilege('anon','private.cms_revisions','SELECT') as anon_reads_drafts,
 has_table_privilege('authenticated','private.cms_revisions','UPDATE') as customer_edits_revisions,
 has_table_privilege('authenticated','private.cms_media_assets','INSERT') as direct_media_insert,
 has_function_privilege('anon','public.iojh_cms_publish_revision(uuid,integer)','EXECUTE') as anon_can_publish;
select indexname from pg_indexes where schemaname='private' and indexname='cms_unique_published_route';
select version from supabase_migrations.schema_migrations where version in ('202611110001','202611150001','202611180001','202611180002') order by version;
