-- IOJH C07a / 202611220001 — durable outbox and fenced job state machine.
-- Requires C05c (202611150001) + C06 (202611180001/2). Do not replay older migrations.
-- Apply ONCE to owner-selected IOJH 2.0 development database after backup and preflight.
-- No worker, scheduler, external delivery, or real business event type is enabled by this migration.
begin;

do $preflight$
begin
  if to_regprocedure('public.iojh_admin_aal2()') is null or
     to_regclass('private.cms_revisions') is null or
     to_regclass('private.cms_media_assets') is null then
    raise exception 'C07a prerequisites missing: verify C05c and both C06 migrations; do not replay migrations';
  end if;
  if to_regclass('private.jobs') is not null or to_regclass('private.outbox_events') is not null then
    raise exception 'C07a objects already exist: inspect migration history before retrying';
  end if;
end
$preflight$;

create table private.outbox_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9.]{2,63}$'),
  payload_version integer not null check (payload_version between 1 and 1000),
  payload jsonb not null check (pg_catalog.jsonb_typeof(payload) = 'object' and pg_catalog.length(payload::text) <= 2048),
  dedupe_key text not null check (dedupe_key ~ '^[a-z0-9][a-z0-9:_-]{7,127}$'),
  occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (event_type, dedupe_key)
);

create table private.jobs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  outbox_event_id uuid not null unique references private.outbox_events(id) on delete restrict,
  job_type text not null check (job_type ~ '^[a-z][a-z0-9.]{2,63}$'),
  payload_version integer not null check (payload_version between 1 and 1000),
  state text not null default 'pending' check (state in ('pending','leased','succeeded','dead')),
  due_at timestamptz not null default pg_catalog.clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  total_attempts integer not null default 0 check (total_attempts >= 0),
  max_attempts integer not null check (max_attempts between 1 and 10),
  retry_cycle integer not null default 0 check (retry_cycle >= 0),
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  worker_id text check (worker_id is null or worker_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,79}$'),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,47}$'),
  finished_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint job_lease_state_check check (
    (state = 'leased') = (lease_token is not null and lease_expires_at is not null and worker_id is not null)
  ),
  constraint job_terminal_state_check check ((state in ('succeeded','dead')) = (finished_at is not null)),
  constraint job_attempt_accounting_check check (total_attempts >= attempts)
);
create index jobs_pending_due_idx on private.jobs(due_at,id) where state = 'pending';
create index jobs_lease_expiry_idx on private.jobs(lease_expires_at,id) where state = 'leased';

create table private.job_attempts (
  id bigint generated always as identity primary key,
  job_id uuid not null references private.jobs(id) on delete restrict,
  lease_generation bigint not null,
  retry_cycle integer not null,
  attempt_no integer not null check (attempt_no > 0),
  worker_id text not null,
  claimed_at timestamptz not null,
  leased_until timestamptz not null,
  ended_at timestamptz,
  outcome text check (outcome in ('succeeded','retry','dead','lease_expired')),
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,47}$'),
  unique(job_id,lease_generation),
  constraint attempt_finished_consistency check ((outcome is null) = (ended_at is null))
);
create index job_attempts_job_history_idx on private.job_attempts(job_id, claimed_at desc);

create table private.job_recovery_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references private.jobs(id) on delete restrict,
  prior_cycle integer not null,
  reason_code text not null check (reason_code in ('operator_reviewed','provider_recovered','incident_recovery')),
  occurred_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table private.outbox_events enable row level security;
alter table private.jobs enable row level security;
alter table private.job_attempts enable row level security;
alter table private.job_recovery_events enable row level security;
revoke all on schema private from public, anon, authenticated, service_role;
revoke all on table private.outbox_events, private.jobs, private.job_attempts, private.job_recovery_events
  from public, anon, authenticated, service_role;
revoke all on sequence private.job_attempts_id_seq, private.job_recovery_events_id_seq
  from public, anon, authenticated, service_role;

-- Outbox is immutable. No row can be quietly rewritten after it is committed.
create function private.iojh_outbox_immutable()
returns trigger language plpgsql set search_path = '' as $fn$
begin
 raise exception 'Outbox events are immutable' using errcode = '23514';
end
$fn$;
create trigger iojh_outbox_immutable_before_change
before update or delete on private.outbox_events
for each row execute function private.iojh_outbox_immutable();

-- Only the initial safe fixture contract is enabled. Future events require explicit
-- versioned validation in a new migration; never accept arbitrary JSON jobs.
create function private.iojh_jobs_payload_valid(p_kind text, p_version integer, p_payload jsonb)
returns boolean language sql immutable set search_path = '' as $fn$
 select coalesce(
    p_kind = 'ops.probe'
    and p_version = 1
    and pg_catalog.jsonb_typeof(p_payload) = 'object'
    and (select count(*) from pg_catalog.jsonb_object_keys(p_payload)) = 1
    and pg_catalog.jsonb_typeof(p_payload->'correlationId') = 'string'
    and (p_payload->>'correlationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', false);
$fn$;

-- Call this from a future domain *database function* inside the SAME transaction
-- as its domain mutation. Separate HTTP requests are not atomic. Not exposed via API.
create function private.iojh_jobs_enqueue_event(
 p_kind text, p_version integer, p_payload jsonb, p_dedupe_key text,
 p_due_at timestamptz default null, p_max_attempts integer default 5)
returns uuid language plpgsql volatile security definer set search_path = '' as $fn$
declare v_event_id uuid; v_job_id uuid; v_due timestamptz; v_existing private.outbox_events%rowtype;
begin
 if not private.iojh_jobs_payload_valid(p_kind,p_version,p_payload) then
   raise exception 'Unsupported job kind, payload version or payload' using errcode='22023';
 end if;
 if p_dedupe_key is null or p_dedupe_key !~ '^[a-z0-9][a-z0-9:_-]{7,127}$' or
    p_max_attempts is null or p_max_attempts not between 1 and 10 then
   raise exception 'Invalid enqueue parameters' using errcode='22023';
 end if;
 v_due := coalesce(p_due_at, pg_catalog.clock_timestamp());
 if v_due > pg_catalog.clock_timestamp()+interval '365 days' or
    v_due < pg_catalog.clock_timestamp()-interval '5 minutes' then
   raise exception 'Invalid scheduling horizon' using errcode='22023';
 end if;

 insert into private.outbox_events(event_type,payload_version,payload,dedupe_key)
 values(p_kind,p_version,p_payload,p_dedupe_key)
 on conflict (event_type,dedupe_key) do nothing returning id into v_event_id;
 if v_event_id is null then
   select e.* into v_existing from private.outbox_events e
     where e.event_type=p_kind and e.dedupe_key=p_dedupe_key;
   if not found or v_existing.payload_version is distinct from p_version or
       v_existing.payload is distinct from p_payload then
     raise exception 'Idempotency-key collision with different payload' using errcode='23505';
   end if;
   select j.id into v_job_id from private.jobs j where j.outbox_event_id=v_existing.id;
   if v_job_id is null then raise exception 'Missing job for existing event' using errcode='23514'; end if;
   return v_job_id; -- Never reschedule a previously committed logical obligation.
 end if;
 insert into private.jobs(outbox_event_id,job_type,payload_version,due_at,max_attempts)
 values(v_event_id,p_kind,p_version,v_due,p_max_attempts) returning id into v_job_id;
 return v_job_id;
end
$fn$;

-- A strictly backend-only probe for smoke/integration tests; NOT a public enqueue API.
-- The service role credential must exist solely inside trusted server runtimes.
create function public.iojh_jobs_enqueue_probe(
 p_correlation_id uuid, p_dedupe_key text, p_due_at timestamptz default null,
 p_max_attempts integer default 5)
returns uuid language sql volatile security definer set search_path = '' as $fn$
 select private.iojh_jobs_enqueue_event('ops.probe',1,
   pg_catalog.jsonb_build_object('correlationId',p_correlation_id::text),
   p_dedupe_key,p_due_at,p_max_attempts);
$fn$;

-- Claim and lease: competing sessions cannot claim the same row because each
-- selected row remains locked until this function's transaction commits.
create function public.iojh_jobs_claim(p_worker text, p_limit integer default 5, p_lease_seconds integer default 60)
returns setof jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_now timestamptz; v_event private.outbox_events%rowtype;
begin
 if p_worker is null or p_worker !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,79}$'
    or p_limit is null or p_limit not between 1 and 20
    or p_lease_seconds is null or p_lease_seconds not between 15 and 300 then
   raise exception 'Invalid claim parameters' using errcode='22023';
 end if;

 -- Bounded sweep: terminally abandoned leases at their retry ceiling must not
 -- remain apparently in progress forever. A later claim can sweep further rows.
 for v_job in
   select * from private.jobs
   where state='leased' and lease_expires_at <= pg_catalog.clock_timestamp()
     and attempts >= max_attempts
   order by lease_expires_at,id limit 20 for update skip locked
 loop
   v_now := pg_catalog.clock_timestamp();
   update private.job_attempts set outcome='lease_expired',ended_at=v_now,error_code='lease_expired'
    where job_id=v_job.id and lease_generation=v_job.lease_generation and outcome is null;
   update private.jobs set state='dead',lease_token=null,lease_expires_at=null,worker_id=null,
     last_error_code='lease_exhausted',finished_at=v_now,updated_at=v_now where id=v_job.id;
 end loop;

 for v_job in
   select * from private.jobs
   where ((state='pending' and due_at<=pg_catalog.clock_timestamp())
      or (state='leased' and lease_expires_at<=pg_catalog.clock_timestamp() and attempts<max_attempts))
   order by due_at,id limit p_limit for update skip locked
 loop
   v_now := pg_catalog.clock_timestamp();
   if v_job.state = 'leased' then
     update private.job_attempts set outcome='lease_expired',ended_at=v_now,error_code='lease_expired'
      where job_id=v_job.id and lease_generation=v_job.lease_generation and outcome is null;
   end if;
   update private.jobs set state='leased',attempts=attempts+1,total_attempts=total_attempts+1,
     lease_generation=lease_generation+1,lease_token=pg_catalog.gen_random_uuid(),
     lease_expires_at=v_now+pg_catalog.make_interval(secs=>p_lease_seconds),worker_id=p_worker,
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

-- Fenced, unexpired completion. Replays and stale worker tokens return FALSE.
create function public.iojh_jobs_complete(p_job uuid,p_token uuid,p_generation bigint)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_updated private.jobs%rowtype; v_now timestamptz;
begin
 -- Acquire the job lock BEFORE reading authoritative wall-clock time.
 perform 1 from private.jobs where id=p_job for update;
 if not found then return false; end if;
 v_now := pg_catalog.clock_timestamp();
 update private.jobs set state='succeeded',lease_token=null,lease_expires_at=null,
   worker_id=null,finished_at=v_now,last_error_code=null,updated_at=v_now
 where id=p_job and state='leased' and lease_token=p_token
   and lease_generation=p_generation and lease_expires_at>v_now
 returning * into v_updated;
 if not found then return false; end if;
 update private.job_attempts set outcome='succeeded',ended_at=v_now
 where job_id=p_job and lease_generation=p_generation and outcome is null;
 return true;
end
$fn$;

-- Optional bounded renewal for a currently owned, unexpired lease.
create function public.iojh_jobs_renew(p_job uuid,p_token uuid,p_generation bigint,p_seconds integer default 60)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $fn$
declare v_until timestamptz; v_claimed timestamptz; v_now timestamptz;
begin
 if p_seconds is null or p_seconds not between 15 and 300 then
   raise exception 'Invalid lease duration' using errcode='22023';
 end if;
 -- Serialize against takeover/completion and check expiry only after acquiring the row lock.
 perform 1 from private.jobs where id=p_job for update;
 if not found then return null; end if;
 v_now := pg_catalog.clock_timestamp();
 -- Cap cumulative ownership of one attempt to 15 minutes, even with renewals.
 select claimed_at into v_claimed from private.job_attempts
   where job_id=p_job and lease_generation=p_generation and outcome is null;
 if v_claimed is null or v_now >= v_claimed + interval '15 minutes' then return null; end if;
 update private.jobs set lease_expires_at=least(v_now+pg_catalog.make_interval(secs=>p_seconds),
     v_claimed+interval '15 minutes'),updated_at=v_now
 where id=p_job and state='leased' and lease_token=p_token and lease_generation=p_generation
   and lease_expires_at>v_now returning lease_expires_at into v_until;
 if v_until is not null then
   update private.job_attempts set leased_until=v_until
     where job_id=p_job and lease_generation=p_generation and outcome is null;
 end if;
 return v_until;
end
$fn$;

-- Fail with a redacted machine-readable code (not an exception message or PII).
create function public.iojh_jobs_fail(p_job uuid,p_token uuid,p_generation bigint,
 p_error_code text,p_permanent boolean default false)
returns text language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_now timestamptz;
        v_dead boolean; v_next timestamptz; v_delay integer;
begin
 if p_error_code is null or p_error_code !~ '^[a-z][a-z0-9_]{0,47}$' or p_permanent is null then
   raise exception 'Invalid sanitized error code' using errcode='22023';
 end if;
 select * into v_job from private.jobs
 where id=p_job and state='leased' and lease_token=p_token
   and lease_generation=p_generation
 for update;
 if not found then return 'stale'; end if;
 -- A lease that expires while waiting for the lock is stale, even without takeover.
 v_now := pg_catalog.clock_timestamp();
 if v_job.lease_expires_at <= v_now then return 'stale'; end if;
 v_dead := p_permanent or v_job.attempts>=v_job.max_attempts;
 if v_dead then
   update private.jobs set state='dead',lease_token=null,lease_expires_at=null,
     worker_id=null,finished_at=v_now,last_error_code=p_error_code,updated_at=v_now
   where id=p_job;
 else
   v_delay := pg_catalog.ceil(
      least(3600.0,10.0*pg_catalog.power(2.0,least(v_job.attempts-1,8)))
       * (0.8+pg_catalog.random()*0.4))::integer;
   v_next := v_now+pg_catalog.make_interval(secs=>v_delay);
   update private.jobs set state='pending',due_at=v_next,lease_token=null,
      lease_expires_at=null,worker_id=null,last_error_code=p_error_code,
      updated_at=v_now where id=p_job;
 end if;
 update private.job_attempts set outcome=case when v_dead then 'dead' else 'retry' end,
   ended_at=v_now,error_code=p_error_code
   where job_id=p_job and lease_generation=p_generation and outcome is null;
 return case when v_dead then 'dead' else 'retry' end;
end
$fn$;

-- Future C07b audited operator review path. Never clear event/attempt history.
create function public.iojh_jobs_retry_dead(p_job uuid,p_reason_code text)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_now timestamptz;
begin
 if p_reason_code is null or p_reason_code not in
   ('operator_reviewed','provider_recovered','incident_recovery') then
   raise exception 'Invalid operator recovery reason' using errcode='22023';
 end if;
 select * into v_job from private.jobs where id=p_job and state='dead' for update;
 if not found then return false; end if;
 v_now := pg_catalog.clock_timestamp();
 insert into private.job_recovery_events(job_id,prior_cycle,reason_code)
 values(v_job.id,v_job.retry_cycle,p_reason_code);
 update private.jobs set state='pending',due_at=v_now,attempts=0,
   retry_cycle=retry_cycle+1,lease_token=null,lease_expires_at=null,worker_id=null,
   finished_at=null,last_error_code=null,updated_at=v_now where id=v_job.id;
 return true;
end
$fn$;

-- Definer execution is granted ONLY to the database backend service role.
-- No customer/admin browser session can enqueue/claim/complete/retry directly.
revoke all on function private.iojh_outbox_immutable() from public,anon,authenticated,service_role;
revoke all on function private.iojh_jobs_payload_valid(text,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.iojh_jobs_enqueue_event(text,integer,jsonb,text,timestamptz,integer) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_enqueue_probe(uuid,text,timestamptz,integer) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_claim(text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_complete(uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_renew(uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_fail(uuid,uuid,bigint,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.iojh_jobs_retry_dead(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.iojh_jobs_enqueue_probe(uuid,text,timestamptz,integer) to service_role;
grant execute on function public.iojh_jobs_claim(text,integer,integer) to service_role;
grant execute on function public.iojh_jobs_complete(uuid,uuid,bigint) to service_role;
grant execute on function public.iojh_jobs_renew(uuid,uuid,bigint,integer) to service_role;
grant execute on function public.iojh_jobs_fail(uuid,uuid,bigint,text,boolean) to service_role;
grant execute on function public.iojh_jobs_retry_dead(uuid,text) to service_role;

comment on function private.iojh_jobs_enqueue_event(text,integer,jsonb,text,timestamptz,integer)
 is 'Invoke only inside the same SQL transaction as a durable domain mutation; never in a later separate HTTP request.';
comment on table private.outbox_events is 'Append-only, versioned and deduplicated logical event; contains only bounded reference payloads.';
comment on table private.jobs is 'At-least-once delivery obligation with random lease token and monotonic generation fencing.';
commit;
