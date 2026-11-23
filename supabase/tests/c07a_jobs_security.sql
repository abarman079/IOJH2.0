-- C07a database test: disposable LOCAL Supabase only. NEVER run on hosted project.
-- supabase test db supabase/tests/c07a_jobs_security.sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public,extensions;
select plan(57);

select ok(to_regclass('private.outbox_events') is not null,'append-only outbox exists');
select ok(to_regclass('private.jobs') is not null,'durable jobs exist');
select ok(to_regclass('private.job_attempts') is not null,'attempt history exists');
select ok((select relrowsecurity from pg_class where oid='private.jobs'::regclass),'job RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.outbox_events'::regclass),'outbox RLS enabled');
select ok(not has_schema_privilege('anon','private','USAGE'),'anon denied private schema');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'customer denied private schema');
select ok(not has_table_privilege('authenticated','private.jobs','SELECT'),'customer cannot read job payload');
select ok(not has_table_privilege('authenticated','private.jobs','UPDATE'),'customer cannot mutate jobs');
select ok(not has_table_privilege('service_role','private.jobs','INSERT'),'service role cannot bypass queue RPC through table insert');
select ok(not has_function_privilege('anon','public.iojh_jobs_claim(text,integer,integer)','EXECUTE'),'anon cannot claim');
select ok(not has_function_privilege('authenticated','public.iojh_jobs_claim(text,integer,integer)','EXECUTE'),'customer cannot claim');
select ok(not has_function_privilege('authenticated','public.iojh_jobs_enqueue_probe(uuid,text,timestamptz,integer)','EXECUTE'),'forged profile or AAL2 cannot enqueue');
select ok(not has_function_privilege('authenticated','public.iojh_jobs_retry_dead(uuid,text)','EXECUTE'),'AAL2 browser cannot retry dead jobs');
select ok(has_function_privilege('service_role','public.iojh_jobs_claim(text,integer,integer)','EXECUTE'),'trusted backend role can claim');
select ok(has_function_privilege('service_role','public.iojh_jobs_complete(uuid,uuid,bigint)','EXECUTE'),'trusted backend role can complete');
select ok((select prosecdef from pg_proc where oid='public.iojh_jobs_claim(text,integer,integer)'::regprocedure),'claim runs in explicit definer context');
select ok((select 'search_path=""'=any(proconfig) from pg_proc where oid='public.iojh_jobs_claim(text,integer,integer)'::regprocedure),'claim definer has empty search_path');

select throws_ok($$ select private.iojh_jobs_enqueue_event('unknown.kind',1,'{}'::jsonb,'c07_invalid_type_001') $$,
 '22023',null,'unknown job type rejected');
select throws_ok($$ select private.iojh_jobs_enqueue_event('ops.probe',2,'{"correlationId":"a1000000-0000-4000-8000-000000000001"}'::jsonb,'c07_invalid_version_001') $$,
 '22023',null,'unsupported payload version rejected');
select throws_ok($$ select private.iojh_jobs_enqueue_event('ops.probe',1,'{"privateNote":"a password"}'::jsonb,'c07_invalid_payload_001') $$,
 '22023',null,'unbounded sensitive job payload rejected');

-- Disposable test domain: outbox enqueue and mutation participate in one SQL transaction.
create temp table c07_domain_actions(id uuid primary key, note text not null);
create function private.c07_atomic_domain_fixture(p_id uuid,p_failure_point text)
returns uuid language plpgsql as $fn$
declare v_job uuid;
begin
 insert into pg_temp.c07_domain_actions values(p_id,'synthetic nonprivate fixture');
 if p_failure_point='before_event' then raise exception 'Synthetic pre-outbox failure' using errcode='P0001'; end if;
 v_job := private.iojh_jobs_enqueue_event('ops.probe',1,
   jsonb_build_object('correlationId',p_id::text),
   'c07_domain_' || replace(p_id::text,'-',''),clock_timestamp()+interval '1 hour',3);
 if p_failure_point='after_event' then raise exception 'Synthetic post-outbox failure' using errcode='P0001'; end if;
 return v_job;
end $fn$;
select throws_ok($$select private.c07_atomic_domain_fixture('a7000000-0000-4000-8000-000000000001','after_event')$$,
 'P0001',null,'failed domain transaction aborts its outbox obligation');
select throws_ok($$select private.c07_atomic_domain_fixture('a7000000-0000-4000-8000-000000000008','before_event')$$,
 'P0001',null,'failure between domain mutation and outbox insertion rolls back domain');
select is((select count(*) from pg_temp.c07_domain_actions),0::bigint,'failed domain change rolled back');
select is((select count(*) from private.outbox_events where dedupe_key like 'c07_domain_%'),0::bigint,'failed event insertion rolled back');
select private.c07_atomic_domain_fixture('a7000000-0000-4000-8000-000000000002','none');
select is((select count(*) from pg_temp.c07_domain_actions),1::bigint,'successful domain mutation persisted');
select is((select count(*) from private.jobs),1::bigint,'domain event and linked job persisted atomically');

create temp table c07_ids (id uuid primary key);
insert into c07_ids values(public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000003','c07_enqueue_due_001',clock_timestamp(),2));
select is((select count(*) from private.jobs),2::bigint,'due job enqueued');
select is(public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000003','c07_enqueue_due_001',clock_timestamp()+interval '1 hour',2),
 (select id from c07_ids),'duplicate request reuses original job');
select throws_ok($$select public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000004','c07_enqueue_due_001')$$,
 '23505',null,'same idempotency key with different payload rejects collision');
select throws_ok($$update private.outbox_events set dedupe_key='c07_forbidden_event_change' where dedupe_key='c07_enqueue_due_001'$$,
 '23514',null,'outbox history cannot be updated');

create temp table c07_claim as select claimed as job from public.iojh_jobs_claim('c07-worker-a',1,15) as t(claimed);
select is((select count(*) from c07_claim),1::bigint,'bounded claim returns a single due job');
select is((select (job->>'attempt')::integer from c07_claim),1,'first claim accounts one attempt');
select is((select count(*) from public.iojh_jobs_claim('c07-worker-b',1,15)),0::bigint,'leased job is not double-claimed');
select is(public.iojh_jobs_complete((select (job->>'jobId')::uuid from c07_claim),
 '00000000-0000-4000-8000-000000000001',1),false,'stale token cannot complete');
select is(public.iojh_jobs_complete((select (job->>'jobId')::uuid from c07_claim),
 (select (job->>'leaseToken')::uuid from c07_claim),1),true,'current fenced worker completes');
select is(public.iojh_jobs_complete((select (job->>'jobId')::uuid from c07_claim),
 (select (job->>'leaseToken')::uuid from c07_claim),1),false,'repeated completion has no effect');

-- AAL/browser role attempts raise insufficient_privilege; use real role restrictions.
set local role authenticated;
select throws_ok($$select * from public.iojh_jobs_claim('forged-admin',1,60)$$,
 '42501',null,'forged authenticated role cannot invoke claim RPC');
reset role;


-- Retry, dead-letter, bounded manual recovery and lease expiry exercise actual state changes.
create temp table c07_retry as
select public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000005','c07_retry_case_001',clock_timestamp(),2) as id;
create temp table c07_retry_claim as select claimed as job from public.iojh_jobs_claim('c07-retry-worker',1,15) as t(claimed);
select is(public.iojh_jobs_fail((select id from c07_retry),
 (select (job->>'leaseToken')::uuid from c07_retry_claim),
 (select (job->>'leaseGeneration')::bigint from c07_retry_claim),'provider_down',false),
 'retry','temporary failure schedules retry');
select ok((select due_at>clock_timestamp() from private.jobs where id=(select id from c07_retry)),
 'scheduled retry uses database time and positive delay');
select is((select last_error_code from private.jobs where id=(select id from c07_retry)),
 'provider_down','only sanitized error code is persisted');
update private.jobs set due_at=clock_timestamp()-interval '1 second' where id=(select id from c07_retry);
create temp table c07_retry_claim2 as select claimed as job from public.iojh_jobs_claim('c07-retry-worker',1,15) as t(claimed);
select is((select (job->>'attempt')::integer from c07_retry_claim2),2,'retry attempt increments');
select is(public.iojh_jobs_fail((select id from c07_retry),
 (select (job->>'leaseToken')::uuid from c07_retry_claim2),
 (select (job->>'leaseGeneration')::bigint from c07_retry_claim2),'provider_down',false),
 'dead','maximum attempts transition to dead letter');
select ok((select finished_at is not null from private.jobs where id=(select id from c07_retry)),
 'terminal failure retains completion timestamp');
select is(public.iojh_jobs_retry_dead((select id from c07_retry),'operator_reviewed'),true,
 'privileged recovery can requeue a dead job');
select ok((select retry_cycle=1 and attempts=0 and total_attempts=2
 from private.jobs where id=(select id from c07_retry)),'recovery preserves lifetime attempt evidence');
select is((select count(*) from private.job_recovery_events where job_id=(select id from c07_retry)),
 1::bigint,'operator requeue reason auditable');
select is(public.iojh_jobs_retry_dead((select id from c07_retry),'operator_reviewed'),false,
 'non-dead jobs cannot be requeued repeatedly');

-- No stale token can finalize after a later worker acquired a newer lease.
create temp table c07_expired as
select public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000006','c07_expired_case_001',clock_timestamp(),3) as id;
-- claim might choose the requeued retry job; make it future until expiry test completes.
update private.jobs set due_at=clock_timestamp()+interval '1 hour' where id=(select id from c07_retry);
create temp table c07_old_lease as select claimed as job from public.iojh_jobs_claim('c07-old-worker',1,15) as t(claimed);
update private.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=(select id from c07_expired);
create temp table c07_new_lease as select claimed as job from public.iojh_jobs_claim('c07-new-worker',1,15) as t(claimed);
select ok((select (job->>'leaseToken') from c07_old_lease)<>(select (job->>'leaseToken') from c07_new_lease),
 'lease takeover changes random fencing token');
select is(public.iojh_jobs_complete((select id from c07_expired),
 (select (job->>'leaseToken')::uuid from c07_old_lease),
 (select (job->>'leaseGeneration')::bigint from c07_old_lease)),false,
 'stale lease cannot complete after takeover');
select is(public.iojh_jobs_fail((select id from c07_expired),
 (select (job->>'leaseToken')::uuid from c07_old_lease),
 (select (job->>'leaseGeneration')::bigint from c07_old_lease),'late_worker',true),
 'stale','stale lease cannot report permanent failure');
select is(public.iojh_jobs_renew((select id from c07_expired),
 (select (job->>'leaseToken')::uuid from c07_old_lease),
 (select (job->>'leaseGeneration')::bigint from c07_old_lease),60),null::timestamptz,
 'stale lease cannot renew');
select ok(public.iojh_jobs_renew((select id from c07_expired),
 (select (job->>'leaseToken')::uuid from c07_new_lease),
 (select (job->>'leaseGeneration')::bigint from c07_new_lease),60)>clock_timestamp(),
 'current lease can renew under cumulative ceiling');
select is(public.iojh_jobs_complete((select id from c07_expired),
 (select (job->>'leaseToken')::uuid from c07_new_lease),
 (select (job->>'leaseGeneration')::bigint from c07_new_lease)),true,
 'replacement lease successfully completes');
select ok((select count(*)=2 from private.job_attempts where job_id=(select id from c07_expired)),
 'both takeover attempts are preserved in history');

-- Lease at the retry ceiling becomes dead without handing it out again.
create temp table c07_ceiling as
select public.iojh_jobs_enqueue_probe('a7000000-0000-4000-8000-000000000007','c07_ceiling_case_001',clock_timestamp(),1) as id;
select * from public.iojh_jobs_claim('c07-crash-worker',1,15);
update private.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=(select id from c07_ceiling);
select is((select count(*) from public.iojh_jobs_claim('c07-next-worker',1,15)),0::bigint,
 'crashed worker at attempt ceiling is not reclaimed');
select is((select state from private.jobs where id=(select id from c07_ceiling)),
 'dead','exhausted crashed lease dead-lettered');

select * from finish();
rollback;
