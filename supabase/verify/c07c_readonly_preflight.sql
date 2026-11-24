-- Verify project reference in dashboard before running. Read-only. No row content.
select current_database() as database_name, current_setting('server_version') as postgres_version,
 to_regclass('private.jobs') is not null as c07a_jobs,
 to_regclass('private.notification_records') is not null as c07b_notifications,
 to_regprocedure('public.iojh_notifications_finish(uuid,uuid,bigint,text,text,text)') is not null as settlement_present,
 to_regclass('private.runner_state') is null as c07c_not_applied,
 (select count(*) from private.jobs where state='leased') as leased_jobs,
 (select count(*) from private.jobs where state='pending') as pending_jobs;
select extname,extversion from pg_extension where extname in ('pg_cron','pg_net','supabase_vault') order by extname;
