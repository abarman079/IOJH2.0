-- READ ONLY; run AFTER applying and verifying only 202611230001.
select schemaname,tablename,rowsecurity from pg_catalog.pg_tables
where schemaname='private' and tablename like 'notification_%' order by tablename;
select proname,prosecdef,proconfig from pg_catalog.pg_proc
where pronamespace in ('private'::regnamespace,'public'::regnamespace)
 and proname like 'iojh_notifications_%' order by proname;
select has_table_privilege('anon','private.notification_records','SELECT') as anon_read_denied_expected_false,
 has_table_privilege('authenticated','private.notification_records','SELECT') as customer_read_denied_expected_false,
 has_function_privilege('authenticated','public.iojh_notifications_prepare(uuid,uuid,bigint)','EXECUTE') as customer_dispatch_denied_expected_false,
 has_function_privilege('authenticated','public.iojh_notifications_admin_failures(integer,timestamptz,uuid)','EXECUTE') as admin_rpc_callable_expected_true;
select count(*) as notification_records from private.notification_records;
-- A brand-new migration should not itself enqueue messages, alter auth identities, or send email.
