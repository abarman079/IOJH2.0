-- Read-only. No credentials, lease tokens or private payloads.
select to_regclass('private.runner_state') is not null as state_exists,
 (select relrowsecurity from pg_class where oid='private.runner_state'::regclass) as state_rls,
 not has_table_privilege('authenticated','private.runner_state','SELECT') as private_state,
 not has_function_privilege('authenticated','public.iojh_runner_claim(uuid,text,boolean,text,uuid)','EXECUTE') as customer_claim_denied,
 has_function_privilege('service_role','public.iojh_runner_claim(uuid,text,boolean,text,uuid)','EXECUTE') as backend_claim_allowed,
 not has_function_privilege('anon','public.iojh_runner_admin_health()','EXECUTE') as anon_health_denied,
 (select count(*) from private.runner_state)=1 as single_state,
 exists(select 1 from pg_trigger where tgname='iojh_runner_dead_notice' and tgrelid='private.jobs'::regclass) as reconcile_trigger,
 (select count(*) from private.notification_records n join private.jobs j on j.id=n.job_id where j.state='dead' and n.status in ('queued','dispatching')) as inconsistent_dead_notices;
