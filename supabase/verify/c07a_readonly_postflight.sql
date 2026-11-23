-- C07a: READ ONLY. No synthetic identities, no queue claims, no mutation.
select to_regclass('private.outbox_events') is not null as outbox_created,
       to_regclass('private.jobs') is not null as jobs_created,
       to_regclass('private.job_attempts') is not null as attempts_created,
       to_regclass('private.job_recovery_events') is not null as recovery_events_created;
select c.relname as relation, c.relrowsecurity as rls_enabled
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='private' and c.relname in ('outbox_events','jobs','job_attempts','job_recovery_events')
 order by c.relname;
select pg_catalog.has_table_privilege('authenticated','private.jobs','SELECT') as customer_can_select_jobs,
       pg_catalog.has_table_privilege('anon','private.jobs','SELECT') as anon_can_select_jobs,
       pg_catalog.has_function_privilege('authenticated','public.iojh_jobs_claim(text,integer,integer)','EXECUTE') as customer_can_claim,
       pg_catalog.has_function_privilege('service_role','public.iojh_jobs_claim(text,integer,integer)','EXECUTE') as backend_can_claim,
       pg_catalog.has_function_privilege('anon','public.iojh_jobs_enqueue_probe(uuid,text,timestamptz,integer)','EXECUTE') as anon_can_enqueue;
-- Expect FALSE, FALSE, FALSE, TRUE, FALSE.
select proname,prosecdef,
       ('search_path=""'=any(proconfig)) as empty_search_path
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'iojh_jobs_%' order by proname;
select version from supabase_migrations.schema_migrations
 where version in ('202611110001','202611150001','202611180001','202611180002','202611220001')
 order by version;
-- Applying via SQL Editor DOES NOT automatically mark 202611220001 applied.
-- Reconcile ledger ONLY after verified successful migration + owner review.
