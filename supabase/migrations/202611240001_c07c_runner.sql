-- C07c additive worker controls. No cron, sends, credentials or hosted changes here.
begin;
do $$ begin
 if to_regclass('private.notification_records') is null or to_regprocedure('public.iojh_jobs_claim(text,integer,integer)') is null then
 raise exception 'C07a/C07b prerequisite missing'; end if;
end $$;
create table private.runner_state (
 id integer primary key check(id=1), run_token uuid, run_until timestamptz,
 last_started timestamptz, last_finished timestamptz, last_success timestamptz,
 cooldown_until timestamptz not null default '-infinity', last_error text,
 last_summary jsonb not null default '{}'::jsonb,
 check ((run_token is null)=(run_until is null))
);
insert into private.runner_state(id) values(1);
alter table private.runner_state enable row level security;
revoke all on private.runner_state from public,anon,authenticated,service_role;
alter table private.notification_records add column dispatch_fingerprint text check(dispatch_fingerprint ~ '^[0-9a-f]{64}$'),
 add column dispatch_ambiguous boolean not null default false,
 add column dispatch_generation bigint;
-- Historical attempts did not pin sender/body. Do not allow an unprovable retry.
update private.notification_records set dispatch_fingerprint=repeat('0',64),dispatch_ambiguous=true
 where first_dispatched_at is not null and status in ('queued','dispatching','failed','uncertain');
create function public.iojh_runner_begin() returns uuid language plpgsql volatile security definer set search_path='' as $$
declare s private.runner_state%rowtype; t timestamptz; tok uuid;
begin
 select * into s from private.runner_state where id=1 for update;
 t:=pg_catalog.clock_timestamp();
 if s.run_until>t then return null; end if;
 tok:=pg_catalog.gen_random_uuid();
 update private.runner_state set run_token=tok,run_until=t+interval '90 seconds',last_started=t where id=1;
 return tok;
end $$;
create function public.iojh_runner_end(p_run uuid,p_ok boolean,p_summary jsonb) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare s private.runner_state%rowtype; t timestamptz;
begin
 select * into s from private.runner_state where id=1 for update;
 t:=pg_catalog.clock_timestamp();
 if p_run is null or s.run_token is distinct from p_run or s.run_until<=t then return false; end if;
 if p_ok is null or pg_catalog.jsonb_typeof(p_summary) is distinct from 'object' or
 (p_summary - array['claimed','completed','retry','dead','review','suppressed','stale','submitted','errors']) <> '{}'::jsonb
 or exists(select 1 from pg_catalog.jsonb_each(p_summary) e where e.value::text !~ '^[0-3]$') then
 raise exception 'Invalid runner summary' using errcode='22023'; end if;
 update private.runner_state set run_token=null,run_until=null,last_finished=t,
 last_success=case when p_ok then t else last_success end,
 last_error=case when p_ok then null else 'worker_error' end,last_summary=p_summary where id=1;
 return true;
end $$;
-- Durable global dispatch cooldown; cannot shorten an existing cooldown.
create function public.iojh_runner_cooldown(p_run uuid,p_seconds integer) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare s private.runner_state%rowtype; t timestamptz;
begin
 if p_seconds is null or p_seconds not between 1 and 86400 then raise exception 'Invalid cooldown' using errcode='22023'; end if;
 select * into s from private.runner_state where id=1 for update;
 t:=pg_catalog.clock_timestamp();
 if p_run is null or s.run_token is distinct from p_run or s.run_until<=t then return false; end if;
 update private.runner_state set cooldown_until=greatest(cooldown_until,t+pg_catalog.make_interval(secs=>p_seconds)) where id=1;
 return true;
end $$;
create function public.iojh_runner_claim(p_run uuid, p_worker text, p_email boolean, p_recipient text, p_notification uuid)
returns setof jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_now timestamptz; v_event private.outbox_events%rowtype; v_state private.runner_state%rowtype;
begin
 select * into v_state from private.runner_state where id=1 for update;
 if p_run is null or v_state.run_token is distinct from p_run or v_state.run_until<=pg_catalog.clock_timestamp()+interval '25 seconds' then
  return;
 end if;
 if p_worker is null or p_worker !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,79}$' or p_email is null then
  raise exception 'Invalid worker configuration' using errcode='22023';
 end if;
 -- Bounded sweep: terminally abandoned leases at their retry ceiling must not
 -- remain apparently in progress forever. A later claim can sweep further rows.
 for v_job in
   select * from private.jobs
   where state='leased' and lease_expires_at <= pg_catalog.clock_timestamp()
     and attempts >= max_attempts and job_type in ('ops.probe','notification.email') and payload_version=1
   order by lease_expires_at,id limit 20 for update skip locked
 loop
   v_now := pg_catalog.clock_timestamp();
   update private.job_attempts set outcome='lease_expired',ended_at=v_now,error_code='lease_expired'
    where job_id=v_job.id and lease_generation=v_job.lease_generation and outcome is null;
   update private.jobs set state='dead',lease_token=null,lease_expires_at=null,worker_id=null,
     last_error_code='lease_exhausted',finished_at=v_now,updated_at=v_now where id=v_job.id;
 end loop;

 for v_job in
   select j.* from private.jobs j
   where payload_version=1 and (job_type='ops.probe' or (job_type='notification.email' and p_email and v_state.cooldown_until<=pg_catalog.clock_timestamp() and exists(select 1 from private.notification_records n where n.job_id=j.id and n.recipient_email=p_recipient and n.id=p_notification)))
     and ((state='pending' and due_at<=pg_catalog.clock_timestamp())
      or (state='leased' and lease_expires_at<=pg_catalog.clock_timestamp() and attempts<max_attempts))
   order by due_at,id limit 1 for update skip locked
 loop
   v_now := pg_catalog.clock_timestamp();
   if v_job.state = 'leased' then
     update private.job_attempts set outcome='lease_expired',ended_at=v_now,error_code='lease_expired'
      where job_id=v_job.id and lease_generation=v_job.lease_generation and outcome is null;
   end if;
   update private.jobs set state='leased',attempts=attempts+1,total_attempts=total_attempts+1,
     lease_generation=lease_generation+1,lease_token=pg_catalog.gen_random_uuid(),
     lease_expires_at=v_now+pg_catalog.make_interval(secs=>90),worker_id=p_worker,
     updated_at=v_now,finished_at=null
    where id=v_job.id returning * into v_job;
   insert into private.job_attempts(job_id,lease_generation,retry_cycle,attempt_no,
     worker_id,claimed_at,leased_until)
   values(v_job.id,v_job.lease_generation,v_job.retry_cycle,v_job.attempts,
     p_worker,v_now,v_job.lease_expires_at);
   select * into v_event from private.outbox_events where id=v_job.outbox_event_id;
   return next pg_catalog.jsonb_build_object(
     'jobId',v_job.id,'eventId',v_event.id,'kind',v_event.event_type,
     'payloadVersion',v_event.payload_version,'payload',v_event.payload,
     'dedupeKey',v_event.dedupe_key,'attempt',v_job.attempts,
     'maxAttempts',v_job.max_attempts,'leaseGeneration',v_job.lease_generation,
     'leaseToken',v_job.lease_token,'leaseExpiresAt',v_job.lease_expires_at,
     'retryCycle',v_job.retry_cycle);
 end loop;
 return;
end
$fn$;
-- The last abandoned attempt is terminal. Keep the notification coherent with
-- the job even when no notification-aware settlement was called (worker crash).
create function private.iojh_runner_dead_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if new.job_type='notification.email' and new.state='dead' and old.state is distinct from new.state and new.last_error_code='lease_exhausted' then
  update private.notification_records set status=case when first_dispatched_at is not null then 'uncertain' else 'failed' end,
   last_error_code='lease_exhausted',updated_at=pg_catalog.clock_timestamp()
   where job_id=new.id and status in ('queued','dispatching');
 end if;
 return new;
end $$;
update private.notification_records n set status=case when n.first_dispatched_at is null then 'failed' else 'uncertain' end,
 last_error_code='lease_exhausted',updated_at=pg_catalog.clock_timestamp()
 from private.jobs j where j.id=n.job_id and j.state='dead' and n.status in ('queued','dispatching');
create trigger iojh_runner_dead_notice after update on private.jobs for each row execute function private.iojh_runner_dead_notice();
-- Final send authorization under locks, including a fresh suppression check.
-- Lock order: runner -> job -> notification. No external requests inside SQL.
create function public.iojh_runner_authorize_send(p_run uuid,p_job uuid,p_token uuid,p_generation bigint,p_hash text) returns text
language plpgsql volatile security definer set search_path='' as $$
declare s private.runner_state%rowtype; j private.jobs%rowtype; n private.notification_records%rowtype; t timestamptz;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid fingerprint' using errcode='22023'; end if;
 select * into s from private.runner_state where id=1 for update;
 select * into j from private.jobs where id=p_job for update;
 select * into n from private.notification_records where job_id=p_job for update;
 t:=pg_catalog.clock_timestamp();
 if p_run is null or s.run_token is distinct from p_run or s.run_until<=t+interval '15 seconds' or
 j.id is null or j.state<>'leased' or j.job_type<>'notification.email' or j.lease_token is distinct from p_token or
 j.lease_generation is distinct from p_generation or j.lease_expires_at<=t+interval '15 seconds' then return 'stale'; end if;
 if n.id is null or n.status not in ('queued','dispatching') then return 'review'; end if;
 if n.dispatch_generation=p_generation then return 'stale'; end if;
 if n.first_dispatched_at is null or t>=n.first_dispatched_at+interval '23 hours' or
 (n.dispatch_fingerprint is not null and n.dispatch_fingerprint<>p_hash) then return 'review'; end if;
 if exists(select 1 from private.notification_suppressions where recipient_email=n.recipient_email and (scope='all' or n.purpose='marketing'))
 or n.purpose<>'operational' then return 'suppressed'; end if;
 if s.cooldown_until>t then return 'stale'; end if;
 update private.notification_records set dispatch_fingerprint=p_hash,status='dispatching',updated_at=t,
 dispatch_ambiguous=dispatch_ambiguous or (dispatch_generation is not null and not exists(
 select 1 from private.notification_delivery_attempts a where a.notification_id=n.id and a.lease_generation=n.dispatch_generation)),
 dispatch_generation=p_generation where id=n.id;
 -- Pessimistic cooldown survives crash; at most one external dispatch per minute.
 update private.runner_state set cooldown_until=t+interval '60 seconds' where id=1;
 return 'send';
end $$;
create or replace function public.iojh_notifications_prepare(p_job uuid,p_token uuid,p_generation bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_notice private.notification_records%rowtype; v_now timestamptz; v_blocked boolean;
begin
 select * into v_job from private.jobs where id=p_job for update;
 v_now := pg_catalog.clock_timestamp();
 if not found or v_job.state<>'leased' or v_job.lease_token is distinct from p_token or
   v_job.lease_generation is distinct from p_generation or v_job.lease_expires_at<=v_now or
   v_job.job_type<>'notification.email' then return pg_catalog.jsonb_build_object('action','stale'); end if;
 select * into v_notice from private.notification_records where job_id=p_job for update;
 if not found then return pg_catalog.jsonb_build_object('action','invalid'); end if;
 -- A provider ID proves acceptance even after a bounce/complaint. Preserve existing evidence.
 if v_notice.provider_message_id is not null or v_notice.status in ('submitted','delivered') then
  if public.iojh_jobs_complete(p_job,p_token,p_generation) then
   return pg_catalog.jsonb_build_object('action','already_submitted');
  end if;
  return pg_catalog.jsonb_build_object('action','stale');
 end if;
 if v_notice.status='suppressed' then return pg_catalog.jsonb_build_object('action','suppressed'); end if;
 if v_notice.status in ('failed','uncertain') then return pg_catalog.jsonb_build_object('action','review'); end if;
 select exists(select 1 from private.notification_suppressions s
  where s.recipient_email=v_notice.recipient_email and (s.scope='all' or v_notice.purpose='marketing'))
  into v_blocked;
 if v_notice.purpose='marketing' and not exists(select 1 from private.notification_marketing_consent c
  where c.recipient_email=v_notice.recipient_email and c.state='subscribed' and c.proof_recorded_at is not null)
  then v_blocked:=true; end if;
 if v_blocked then return pg_catalog.jsonb_build_object('action','suppressed'); end if;
 -- Provider idempotency is documented to expire at 24h. Quarantine unresolved
 -- attempts BEFORE that boundary; never blindly resend an ambiguous old send.
 if v_notice.first_dispatched_at is not null and v_now>=v_notice.first_dispatched_at+interval '23 hours' then
  return pg_catalog.jsonb_build_object('action','review');
 end if;
 if v_notice.first_dispatched_at is null then
  update private.notification_records set first_dispatched_at=v_now,status='dispatching',updated_at=v_now where id=v_notice.id;
 end if;
 return pg_catalog.jsonb_build_object('action','send','notificationId',v_notice.id,'recipient',v_notice.recipient_email,
  'locale',v_notice.locale,'templateId',v_notice.template_key,'templateVersion',v_notice.template_version,
  'variables',v_notice.template_data);
end $fn$;
create or replace function public.iojh_notifications_finish(p_job uuid,p_token uuid,p_generation bigint,
 p_result text,p_provider_id text default null,p_code text default null)
returns text language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_n private.notification_records%rowtype; v_now timestamptz; v_state text;
begin
 if p_result is null or p_result not in ('accepted','retry','dead','suppressed','uncertain') or
    (p_provider_id is not null and p_provider_id !~* '^[0-9a-f-]{36}$') or
    (p_code is not null and p_code !~ '^[a-z][a-z0-9_]{0,47}$') then
   raise exception 'Invalid provider result contract' using errcode='22023';
 end if;
 if p_provider_id is not null then p_provider_id:=pg_catalog.lower(p_provider_id); end if;
 if p_result='accepted' and p_provider_id is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider_id, 701));
 end if;
 select * into v_job from private.jobs where id=p_job for update;
 v_now:=pg_catalog.clock_timestamp();
 if not found or v_job.state<>'leased' or v_job.lease_token is distinct from p_token or
    v_job.lease_generation is distinct from p_generation or v_job.lease_expires_at<=v_now or
    v_job.job_type<>'notification.email' then return 'stale'; end if;
 select * into v_n from private.notification_records where job_id=p_job for update;
 if not found then return 'stale'; end if;
 if p_result='accepted' and p_provider_id is null then raise exception 'Missing provider ID' using errcode='22023'; end if;
 -- A prior generation reserved a send but never settled it (crash/timeout).
 if v_n.dispatch_generation is not null and v_n.dispatch_generation<>p_generation and not exists(
  select 1 from private.notification_delivery_attempts a where a.notification_id=v_n.id and a.lease_generation=v_n.dispatch_generation) then
  v_n.dispatch_ambiguous:=true;
 end if;
 if p_result='suppressed' and v_n.dispatch_ambiguous then p_result:='uncertain'; end if;
 if p_result='dead' and v_n.dispatch_ambiguous then p_result:='uncertain'; end if;
 if p_result='accepted' or p_result='suppressed' then
  if not public.iojh_jobs_complete(p_job,p_token,p_generation) then return 'stale'; end if;
  v_state:=case when p_result='accepted' then 'submitted' else 'suppressed' end;
 elsif p_result='uncertain' then
  if public.iojh_jobs_fail(p_job,p_token,p_generation,'timeout',true)<>'dead' then return 'stale'; end if;
  v_state:='uncertain';
 else
  v_state:=public.iojh_jobs_fail(p_job,p_token,p_generation,coalesce(p_code,'provider_unavailable'),p_result='dead');
  if v_state='stale' then return 'stale'; end if;
  v_state:=case when v_state='dead' then
    case when v_n.dispatch_fingerprint is not null and (p_result='retry' or v_n.dispatch_ambiguous) then 'uncertain' else 'failed' end
    else 'queued' end;
 end if;
 update private.notification_records set status=v_state,provider_message_id=coalesce(p_provider_id,provider_message_id),
  dispatch_ambiguous=case when p_result='accepted' then false when p_result='retry' and p_code in ('timeout','provider_unavailable') and v_n.dispatch_fingerprint is not null then true else v_n.dispatch_ambiguous end,
  last_error_code=case when p_result='accepted' then null else coalesce(p_code,case when p_result='uncertain' then 'timeout' else null end) end,
  updated_at=v_now where id=v_n.id;
 insert into private.notification_delivery_attempts(notification_id,job_id,lease_generation,outcome,provider_message_id,sanitized_code)
 values(v_n.id,p_job,p_generation,p_result,p_provider_id,p_code);
 -- Apply a webhook that arrived before the REST result was recorded.
 if p_result='accepted' then
   if exists(select 1 from private.notification_provider_events where provider_message_id=p_provider_id
      and event_type in ('email.bounced','email.complained','email.suppressed')) then
     update private.notification_records set status='failed',last_error_code='provider_rejected' where id=v_n.id;
     v_state:='failed'; -- The provider accepted first but has since reported a terminal suppression.
     insert into private.notification_suppressions(recipient_email,scope,reason)
     values(v_n.recipient_email,'all','provider_suppressed')
     on conflict(recipient_email) do update set scope='all',reason=excluded.reason,updated_at=pg_catalog.clock_timestamp();
   elsif exists(select 1 from private.notification_provider_events where provider_message_id=p_provider_id
      and event_type='email.delivered') then
     update private.notification_records set status='delivered' where id=v_n.id;
     v_state:='delivered';
   end if;
 end if;
 return v_state;
end $fn$;
create or replace function public.iojh_notifications_provider_event(p_event_id text,p_provider_id text,p_type text)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_notice private.notification_records%rowtype;
begin
 if p_event_id is null or p_event_id !~ '^[a-zA-Z0-9_-]{8,128}$' or
    p_provider_id is null or p_provider_id !~* '^[0-9a-f-]{36}$' or
    p_type not in ('email.delivered','email.bounced','email.complained','email.suppressed') then
   raise exception 'Unsupported provider event' using errcode='22023';
 end if;
 p_provider_id:=pg_catalog.lower(p_provider_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider_id,701));
 insert into private.notification_provider_events(event_id,provider_message_id,event_type)
 values(p_event_id,p_provider_id,p_type) on conflict(event_id) do nothing;
 if not found then
  if exists(select 1 from private.notification_provider_events where event_id=p_event_id
    and (provider_message_id<>p_provider_id or event_type<>p_type)) then
    raise exception 'Provider event identifier collision' using errcode='23505';
  end if;
  return true;
 end if;
 select * into v_notice from private.notification_records where provider_message_id=p_provider_id for update;
 if not found then return true; end if; -- kept for later REST result reconciliation
 if p_type in ('email.bounced','email.complained','email.suppressed') then
  update private.notification_records set status='failed',last_error_code='provider_rejected',updated_at=pg_catalog.clock_timestamp()
   where id=v_notice.id;
  insert into private.notification_suppressions(recipient_email,scope,reason)
  values(v_notice.recipient_email,'all',case when p_type='email.bounced' then 'hard_bounce'
    when p_type='email.complained' then 'complaint' else 'provider_suppressed' end)
  on conflict(recipient_email) do update set scope='all',reason=excluded.reason,updated_at=pg_catalog.clock_timestamp();
 elsif p_type='email.delivered' and v_notice.status='submitted' then
  update private.notification_records set status='delivered',updated_at=pg_catalog.clock_timestamp() where id=v_notice.id;
 end if;
 return true;
end $fn$;
-- Redacted aggregate only, no tokens or payloads. Existing AAL2 DB gate.
create function public.iojh_runner_admin_health() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare out_json jsonb;
begin
 if not public.iojh_admin_aal2() then raise exception 'Not authorized' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('lastStarted',last_started,'stale',coalesce(last_started<now()-interval '3 minutes',true),'lastFinished',last_finished,'lastSuccess',last_success,
 'cooldownUntil',case when isfinite(cooldown_until) then cooldown_until else null end,'lastError',last_error,'lastSummary',last_summary,
 'due',(select count(*) from private.jobs where state='pending' and due_at<=now()),
 'leased',(select count(*) from private.jobs where state='leased'),
 'dead',(select count(*) from private.jobs where state='dead'),
 'oldestDueSeconds',(select greatest(0,extract(epoch from now()-min(due_at))::bigint) from private.jobs where state='pending' and due_at<=now()),
 'recentNotifications',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from private.notification_records where updated_at>=now()-interval '24 hours' group by status) q))
 into out_json from private.runner_state where id=1;
 return out_json;
end $$;
revoke all on function public.iojh_runner_begin() from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_begin() to service_role;
revoke all on function public.iojh_runner_end(uuid,boolean,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_end(uuid,boolean,jsonb) to service_role;
revoke all on function public.iojh_runner_cooldown(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_cooldown(uuid,integer) to service_role;
revoke all on function public.iojh_runner_claim(uuid,text,boolean,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_claim(uuid,text,boolean,text,uuid) to service_role;
revoke all on function public.iojh_runner_authorize_send(uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_authorize_send(uuid,uuid,uuid,bigint,text) to service_role;
revoke all on function public.iojh_runner_admin_health() from public,anon,authenticated,service_role;
grant execute on function public.iojh_runner_admin_health() to authenticated;
revoke all on function private.iojh_runner_dead_notice() from public,anon,authenticated,service_role;
commit;
