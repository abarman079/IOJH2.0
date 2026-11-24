-- C07b disposable pgTAP test: NEVER use against a hosted IOJH project.
-- supabase test db supabase/tests/c07b_notifications_security.sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select * from no_plan();

select ok((select relrowsecurity from pg_catalog.pg_class where oid='private.notification_records'::regclass),'notification RLS enabled');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='private.notification_suppressions'::regclass),'suppression RLS enabled');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'customer cannot use private schema');
select ok(not has_table_privilege('authenticated','private.notification_records','SELECT'),'customer cannot read recipients');
select ok(not has_table_privilege('service_role','private.notification_records','SELECT'),'service role cannot query private notification rows directly');
select ok(not has_function_privilege('authenticated','public.iojh_notifications_prepare(uuid,uuid,bigint)','EXECUTE'),'customer cannot prepare send');
select ok(not has_function_privilege('authenticated','public.iojh_notifications_finish(uuid,uuid,bigint,text,text,text)','EXECUTE'),'customer cannot finish delivery');
select ok(not has_function_privilege('anon','public.iojh_notifications_admin_failures(integer,timestamptz,uuid)','EXECUTE'),'anonymous cannot read admin failure view');
select ok(has_function_privilege('authenticated','public.iojh_notifications_admin_retry(uuid,text)','EXECUTE'),'authenticated may invoke but DB gate rejects unauthorized');
select ok(not has_function_privilege('authenticated','public.iojh_notifications_enqueue_fixture(text,text,text)','EXECUTE'),'customer cannot enqueue fixture');
select ok(not private.iojh_jobs_payload_valid('notification.email',1,'{"notificationId":"bad"}'::jsonb),'invalid notification reference is rejected');
select ok(private.iojh_jobs_payload_valid('ops.probe',1,'{"correlationId":"3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001"}'::jsonb),'C07a probe contract remains supported');

-- A fake customer role cannot forge admin rights from metadata.
insert into auth.users(id,instance_id,aud,"role",email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
values('e0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c07b-customer@example.invalid',now(),now(),now(),'{"role":"admin"}'::jsonb),
('e0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c07b-owner@example.invalid',now(),now(),now(),'{}'::jsonb);
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select public.iojh_notifications_admin_failures(10,null,null)$$,'42501',null,'forged metadata does not grant failure-list access');
select throws_ok($$select public.iojh_notifications_admin_retry('3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001','operator_reviewed')$$,'42501',null,'customer cannot retry notification');
reset role;

-- Only service-role RPC can insert non-deliverable test references (no provider sends).
set local role service_role;
select ok(public.iojh_notifications_enqueue_fixture('NOTICE-00001','c07b:reference:one','en') is not null,'service role can enqueue safe fixture');
select is(public.iojh_notifications_enqueue_fixture('NOTICE-00001','c07b:reference:one','en'),
 public.iojh_notifications_enqueue_fixture('NOTICE-00001','c07b:reference:one','en'),'same dedupe key returns same notification identity');
select throws_ok($$select public.iojh_notifications_enqueue_fixture('NOTICE-CHANGED','c07b:reference:one','en')$$,'23505',null,'conflicting duplicate payload is rejected');
select throws_ok($$select public.iojh_notifications_enqueue_fixture('NOTICE-00002','c07b:reference:two','fr')$$,'22023',null,'unsupported locale rejected');
reset role;
select is((select count(*) from private.outbox_events where event_type='notification.email'),1::bigint,'one durable outbox event persisted for duplicate fixture');
select is((select count(*) from private.notification_records),1::bigint,'one notification record persisted');
select ok((select payload from private.outbox_events where event_type='notification.email') ? 'notificationId','outbox stores a reference only');
select ok(not ((select payload from private.outbox_events where event_type='notification.email') ? 'recipient_email'),'outbox does not store recipient');

-- Verify domain mutation and notification obligation rollback together.
create temp table c07b_fixture_domain(id integer primary key);
do $do$ begin
 begin
  insert into c07b_fixture_domain values(17);
  perform private.iojh_notifications_enqueue('operational','account_notice','fixture@example.invalid','en','account_notice',1,
    '{"reference":"NOTICE-00003"}'::jsonb,'c07b:rolled:back');
  raise exception 'simulate domain transaction failure';
 exception when raise_exception then null;
 end;
end $do$;
select is((select count(*) from c07b_fixture_domain),0::bigint,'domain change rolled back');
select ok(not exists(select 1 from private.outbox_events where dedupe_key='c07b:rolled:back'),'required outbox event rolled back with domain change');

-- Claim/prepare/finish are service-only, and sent means provider accepted, not delivered.
create temp table c07b_leased as select null::uuid job_id,null::uuid lease_token,null::bigint lease_generation with no data;
grant select,insert on c07b_leased to service_role;
set local role service_role;
insert into c07b_leased select (claimed->>'jobId')::uuid,(claimed->>'leaseToken')::uuid,(claimed->>'leaseGeneration')::bigint
 from public.iojh_jobs_claim('c07b-test-worker',1,60) as t(claimed);
select is((select public.iojh_notifications_prepare(job_id,lease_token,lease_generation)->>'action' from c07b_leased),'send','current valid lease can prepare send');
select is((select public.iojh_notifications_finish(job_id,lease_token,lease_generation,'accepted',
 'f0000000-0000-4000-8000-000000000001',null) from c07b_leased),'submitted','provider acceptance completes fenced lease');
select is((select public.iojh_notifications_finish(job_id,lease_token,lease_generation,'accepted',
 'f0000000-0000-4000-8000-000000000001',null) from c07b_leased),'stale','replayed completion denied');
reset role;
select is((select status from private.notification_records limit 1),'submitted','accepted != delivered');

-- Signed provider events are ingested by service-role RPC, idempotently.
set local role service_role;
select ok(public.iojh_notifications_provider_event('event-c07b-test-00001','f0000000-0000-4000-8000-000000000001','email.delivered'),'valid delivery event recorded');
select ok(public.iojh_notifications_provider_event('event-c07b-test-00001','f0000000-0000-4000-8000-000000000001','email.delivered'),'duplicate webhook safe');
reset role;
select is((select status from private.notification_records limit 1),'delivered','delivered status requires provider evidence');
select is((select count(*) from private.notification_provider_events),1::bigint,'duplicate provider event is deduplicated');
set local role service_role;
select ok(public.iojh_notifications_provider_event('event-c07b-test-00002','f0000000-0000-4000-8000-000000000001','email.bounced'),'bounce recorded');
reset role;
select is((select scope from private.notification_suppressions where recipient_email='fixture@example.invalid'),'all','bounce suppresses all subsequent notices');

-- AAL1 cannot inspect or review. Verified active admin AAL2 can list, not see PII.
select set_config('iojh.admin_change_reason','C07b disposable membership grant for verification',true);
insert into private.admin_memberships(user_id,active) values('e0000000-0000-4000-8000-000000000002',true);
insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values('e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000002','C07b fixture','totp','verified',now(),now());
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select public.iojh_notifications_admin_failures(25,null,null)$$,'42501',null,'AAL1 admin cannot see failure view');
reset role;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('iojh.fixture.first_notification',(select id::text from private.notification_records where dedupe_key='c07b:reference:one'),true);
set local role authenticated;
select ok((select count(*) from public.iojh_notifications_admin_failures(25,null,null))>=1,'AAL2 admin can see bounded failure list');
select ok(not exists(select 1 from public.iojh_notifications_admin_failures(25,null,null) f where f::text like '%fixture@example.invalid%'),'failure DTO never leaks email');
select is(public.iojh_notifications_admin_retry(current_setting('iojh.fixture.first_notification')::uuid,'operator_reviewed'),false,'delivered/bounced notice cannot be requeued');
reset role;

-- A different failed, *unaccepted* notification can be safely reviewed and
-- requeued while its original outbox event/attempt records remain unchanged.
delete from private.notification_suppressions where recipient_email='fixture@example.invalid';
create temp table c07b_failed_job(job_id uuid,lease_token uuid,lease_generation bigint);
grant select,insert on c07b_failed_job to service_role;
set local role service_role;
select public.iojh_notifications_enqueue_fixture('NOTICE-00004','c07b:review:one','en');
insert into c07b_failed_job select (claimed->>'jobId')::uuid,(claimed->>'leaseToken')::uuid,(claimed->>'leaseGeneration')::bigint
 from public.iojh_jobs_claim('c07b-review-worker',1,60) as t(claimed);
select is((select public.iojh_notifications_finish(job_id,lease_token,lease_generation,'dead',null,'invalid_reference') from c07b_failed_job),
 'failed','pre-send failure becomes dead without a provider call');
reset role;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select set_config('iojh.fixture.review_notification',(select id::text from private.notification_records where dedupe_key='c07b:review:one'),true);
set local role authenticated;
select is(public.iojh_notifications_admin_retry(current_setting('iojh.fixture.review_notification')::uuid,'operator_reviewed'),true,
 'AAL2 admin can requeue eligible dead notification');
reset role;
select is((select state from private.jobs where id=(select job_id from private.notification_records where dedupe_key='c07b:review:one')),'pending',
 'reviewed job returns to pending without new outbox event');
select ok(exists(select 1 from private.notification_review_events where action='reviewed_requeue'),'review action is auditable');
select is((select count(*) from private.outbox_events where event_type='notification.email'),2::bigint,
 'review requeue preserved original immutable outbox rather than duplicating it');

select * from finish();
rollback;
