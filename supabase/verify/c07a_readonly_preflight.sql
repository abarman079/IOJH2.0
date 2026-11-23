-- C07a: READ ONLY. First verify the Supabase Dashboard's project name and reference.
-- Expected project: IOJH 2.0 Web / zxltczixfwczkmxcozyu.
-- SQL current_database() does NOT prove the project identity; confirm in Dashboard UI.
select current_database() as database_name, current_user as executing_role,
       pg_catalog.current_setting('server_version') as postgres_version;
select version from supabase_migrations.schema_migrations
 where version in ('202611110001','202611150001','202611180001','202611180002','202611220001')
 order by version;
select to_regprocedure('public.iojh_admin_aal2()') is not null as c05c_authorization_present,
       to_regclass('private.cms_revisions') is not null as c06_revisions_present,
       to_regclass('private.cms_media_assets') is not null as c06_media_present,
       to_regclass('private.outbox_events') is not null as c07a_outbox_already_present,
       to_regclass('private.jobs') is not null as c07a_jobs_already_present;
-- Expect C05/C06 prerequisites TRUE; C07a objects FALSE before first application.
