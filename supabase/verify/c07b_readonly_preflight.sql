-- READ ONLY. Confirm you selected IOJH 2.0 Web project before any mutation.
select current_database() as database_name, current_user as database_role;
select version from supabase_migrations.schema_migrations order by version;
select to_regclass('private.outbox_events') as c07a_outbox,
       to_regclass('private.jobs') as c07a_jobs,
       to_regclass('private.notification_records') as c07b_already_exists;
select to_regprocedure('private.iojh_jobs_enqueue_event(text,integer,jsonb,text,timestamptz,integer)') as expected_c07a_enqueue;
-- EXPECT: five previous versions 202611110001, 202611150001, 202611180001,
-- 202611180002, 202611220001. Notification table should be NULL before C07b.
