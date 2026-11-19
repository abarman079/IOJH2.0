-- READ ONLY: IOJH 2.0 development project. Before applying ANY C06 migration.
select version from supabase_migrations.schema_migrations
 where version in ('202611110001','202611150001','202611180001','202611180002')
 order by version;
select to_regprocedure('public.iojh_admin_aal2()') is not null as c05c_guard_exists,
       to_regclass('private.admin_memberships') is not null as c05b_memberships_exist,
       to_regclass('private.cms_entities') is not null as c06_already_exists;
select id,public, file_size_limit,allowed_mime_types from storage.buckets where id='iojh-cms-media';
