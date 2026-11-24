-- IOJH C07b / 202611230001. Additive; requires C07a 202611220001.
-- Apply only to the owner-approved IOJH 2.0 Web database after preflight/backup.
-- Never replay C05/C06/C07a historical migrations. No email is sent by SQL.
begin;

do $pre$ begin
  if to_regclass('private.jobs') is null or
     to_regclass('private.outbox_events') is null or
     to_regprocedure('private.iojh_jobs_enqueue_event(text,integer,jsonb,text,timestamptz,integer)') is null or
     to_regprocedure('public.iojh_admin_aal2()') is null then
    raise exception 'C07a and C05c prerequisites missing; stop without replaying migrations';
  end if;
  if to_regclass('private.notification_records') is not null then
    raise exception 'C07b notification records already exist; inspect ledger, do not rerun migration';
  end if;
end $pre$;

-- No anonymous or customer table access; service role may only call narrow RPCs.
create function private.iojh_notification_data_valid(p_data jsonb)
returns boolean language sql immutable set search_path = '' as $fn$
 select coalesce(pg_catalog.jsonb_typeof(p_data)='object'
  and (select count(*) from pg_catalog.jsonb_object_keys(p_data))=1
  and pg_catalog.jsonb_typeof(p_data->'reference')='string'
  and (p_data->>'reference') ~ '^[A-Za-z0-9-]{8,40}$',false);
$fn$;
create table private.notification_records (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  purpose text not null check (purpose in ('operational','marketing')),
  kind text not null check (kind = 'account_notice'),
  template_key text not null check (template_key = 'account_notice'),
  template_version integer not null check (template_version = 1),
  locale text not null check (locale in ('en','bn')),
  recipient_email text not null check (recipient_email = pg_catalog.lower(recipient_email) and
    recipient_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' and length(recipient_email)<=254),
  template_data jsonb not null check (pg_catalog.jsonb_typeof(template_data)='object' and length(template_data::text)<=300),
  dedupe_key text not null check(dedupe_key ~ '^[a-z0-9][a-z0-9:_-]{7,127}$'),
  job_id uuid unique references private.jobs(id) on delete restrict,
  status text not null default 'queued' check(status in ('queued','dispatching','submitted','delivered','suppressed','failed','uncertain')),
  first_dispatched_at timestamptz,
  provider_message_id text unique check(provider_message_id is null or provider_message_id ~* '^[0-9a-f-]{36}$'),
  last_error_code text check(last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,47}$'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(kind,dedupe_key),
  constraint notification_purpose_v1 check(purpose='operational'),
  constraint notification_reference_v1 check(private.iojh_notification_data_valid(template_data))
);
create index notification_failure_list_idx on private.notification_records(updated_at desc,id)
 where status in ('failed','uncertain','suppressed');
create index notification_job_idx on private.notification_records(job_id);

-- A row here is a block. Marketing-only blocks do not block legitimate operational mail.
create table private.notification_suppressions (
  recipient_email text primary key check(recipient_email=pg_catalog.lower(recipient_email) and length(recipient_email)<=254),
  scope text not null check(scope in ('all','marketing')),
  reason text not null check(reason in ('manual','unsubscribe','hard_bounce','complaint','provider_suppressed')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
-- C10 can write the consent transition through a future owner-reviewed function.
-- No C07b function grants marketing consent or enables marketing jobs.
create table private.notification_marketing_consent (
  recipient_email text primary key check(recipient_email=pg_catalog.lower(recipient_email) and length(recipient_email)<=254),
  state text not null default 'pending_confirmation' check(state in ('pending_confirmation','subscribed','unsubscribed')),
  proof_recorded_at timestamptz,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint confirmed_opt_in check(state<>'subscribed' or proof_recorded_at is not null)
);

-- Provider-specific evidence is minimal and contains no subject/body/token/recipient.
create table private.notification_delivery_attempts (
  id bigint generated always as identity primary key,
  notification_id uuid not null references private.notification_records(id) on delete restrict,
  job_id uuid not null references private.jobs(id) on delete restrict,
  lease_generation bigint not null,
  outcome text not null check(outcome in ('accepted','retry','dead','suppressed','uncertain')),
  provider_message_id text,
  sanitized_code text check(sanitized_code is null or sanitized_code ~ '^[a-z][a-z0-9_]{0,47}$'),
  occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(notification_id,lease_generation)
);
create table private.notification_review_events (
  id bigint generated always as identity primary key,
  notification_id uuid not null references private.notification_records(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  action text not null check(action in ('reviewed_requeue','suppression_added')),
  reason_code text not null check(reason_code in ('operator_reviewed','provider_recovered','incident_recovery','manual')),
  occurred_at timestamptz not null default pg_catalog.clock_timestamp()
);
-- A webhook can arrive before the REST send response is committed; preserve it for reconciliation.
create table private.notification_provider_events (
  event_id text primary key check(event_id ~ '^[a-zA-Z0-9_-]{8,128}$'),
  provider_message_id text not null check(provider_message_id ~* '^[0-9a-f-]{36}$'),
  event_type text not null check(event_type in ('email.delivered','email.bounced','email.complained','email.suppressed')),
  received_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index notification_provider_events_lookup_idx on private.notification_provider_events(provider_message_id);

alter table private.notification_records enable row level security;
alter table private.notification_suppressions enable row level security;
alter table private.notification_marketing_consent enable row level security;
alter table private.notification_delivery_attempts enable row level security;
alter table private.notification_review_events enable row level security;
alter table private.notification_provider_events enable row level security;
revoke all on private.notification_records,private.notification_suppressions,
 private.notification_marketing_consent,private.notification_delivery_attempts,
 private.notification_review_events,private.notification_provider_events
 from public,anon,authenticated,service_role;
revoke all on sequence private.notification_delivery_attempts_id_seq,
 private.notification_review_events_id_seq from public,anon,authenticated,service_role;

-- Widen only the exact versioned reference-only kind; never accept a message body in outbox.
create or replace function private.iojh_jobs_payload_valid(p_kind text,p_version integer,p_payload jsonb)
returns boolean language sql immutable set search_path = '' as $fn$
 select coalesce(
   (p_kind='ops.probe' and p_version=1 and pg_catalog.jsonb_typeof(p_payload)='object'
    and (select count(*) from pg_catalog.jsonb_object_keys(p_payload))=1
    and pg_catalog.jsonb_typeof(p_payload->'correlationId')='string'
    and (p_payload->>'correlationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
   or
   (p_kind='notification.email' and p_version=1 and pg_catalog.jsonb_typeof(p_payload)='object'
    and (select count(*) from pg_catalog.jsonb_object_keys(p_payload))=3
    and pg_catalog.jsonb_typeof(p_payload->'notificationId')='string'
    and (p_payload->>'notificationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (p_payload->>'locale') in ('en','bn') and pg_catalog.jsonb_typeof(p_payload->'locale')='string'
    and pg_catalog.jsonb_typeof(p_payload->'templateVersion')='number'
    and (p_payload->>'templateVersion')='1'),false);
$fn$;

-- Future C10 domain SQL may call this inside the SAME transaction as its domain mutation.
-- No public user/API EXECUTE permission on this private function.
create function private.iojh_notifications_enqueue(
 p_purpose text,p_kind text,p_email text,p_locale text,p_template_key text,
 p_template_version integer,p_data jsonb,p_dedupe_key text)
returns uuid language plpgsql volatile security definer set search_path = '' as $fn$
declare v_email text; v_id uuid; v_job uuid; v_old private.notification_records%rowtype;
begin
 v_email := pg_catalog.lower(pg_catalog.btrim(p_email));
 if p_purpose<>'operational' or p_kind<>'account_notice' or p_template_key<>'account_notice'
  or p_template_version<>1 or p_locale not in ('en','bn') or
  v_email is null or length(v_email)>254 or
  v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$' or
  p_dedupe_key is null or p_dedupe_key !~ '^[a-z0-9][a-z0-9:_-]{7,127}$' or
  p_data is null or pg_catalog.jsonb_typeof(p_data)<>'object' or
  not private.iojh_notification_data_valid(p_data) then
   raise exception 'Invalid or unsupported notification contract' using errcode='22023';
 end if;
 insert into private.notification_records(purpose,kind,recipient_email,locale,template_key,template_version,template_data,dedupe_key)
 values(p_purpose,p_kind,v_email,p_locale,p_template_key,p_template_version,p_data,p_dedupe_key)
 on conflict (kind,dedupe_key) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from private.notification_records where kind=p_kind and dedupe_key=p_dedupe_key;
  if not found or v_old.purpose<>p_purpose or v_old.recipient_email<>v_email or
    v_old.locale<>p_locale or v_old.template_key<>p_template_key or
    v_old.template_version<>p_template_version or v_old.template_data<>p_data then
    raise exception 'Notification idempotency conflict' using errcode='23505';
  end if;
  if v_old.job_id is null then raise exception 'Notification without committed obligation' using errcode='23514'; end if;
  return v_old.id;
 end if;
 v_job := private.iojh_jobs_enqueue_event('notification.email',1,
    pg_catalog.jsonb_build_object('notificationId',v_id::text,'locale',p_locale,'templateVersion',p_template_version),
    p_dedupe_key,null,5);
 update private.notification_records set job_id=v_job where id=v_id;
 return v_id;
end $fn$;

-- The ONLY exposed enqueue test accepts non-deliverable .invalid addresses.
-- Do not create a public 'send email' API. For actual domain notifications,
-- call the private enqueue function inside a domain mutation transaction.
create function public.iojh_notifications_enqueue_fixture(p_reference text,p_dedupe_key text,p_locale text default 'en')
returns uuid language sql volatile security definer set search_path = '' as $fn$
 select private.iojh_notifications_enqueue('operational','account_notice','fixture@example.invalid',
  p_locale,'account_notice',1,pg_catalog.jsonb_build_object('reference',p_reference),p_dedupe_key);
$fn$;

-- Read the current job/lease UNDER LOCK, then authoritative time. Prepare is
-- service-role only; it is NOT a runner and never sends to a provider.
create function public.iojh_notifications_prepare(p_job uuid,p_token uuid,p_generation bigint)
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
 if v_notice.status in ('submitted','delivered') then return pg_catalog.jsonb_build_object('action','already_submitted'); end if;
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

-- Finish job and notification result in ONE PostgreSQL transaction under the
-- SAME C07a lease fence. Never treat provider accepted as delivered.
create function public.iojh_notifications_finish(p_job uuid,p_token uuid,p_generation bigint,
 p_result text,p_provider_id text default null,p_code text default null)
returns text language plpgsql volatile security definer set search_path = '' as $fn$
declare v_job private.jobs%rowtype; v_n private.notification_records%rowtype; v_now timestamptz; v_state text;
begin
 if p_result not in ('accepted','retry','dead','suppressed','uncertain') or
    (p_provider_id is not null and p_provider_id !~* '^[0-9a-f-]{36}$') or
    (p_code is not null and p_code !~ '^[a-z][a-z0-9_]{0,47}$') then
   raise exception 'Invalid provider result contract' using errcode='22023';
 end if;
 select * into v_job from private.jobs where id=p_job for update;
 v_now:=pg_catalog.clock_timestamp();
 if not found or v_job.state<>'leased' or v_job.lease_token is distinct from p_token or
    v_job.lease_generation is distinct from p_generation or v_job.lease_expires_at<=v_now or
    v_job.job_type<>'notification.email' then return 'stale'; end if;
 select * into v_n from private.notification_records where job_id=p_job for update;
 if not found then return 'stale'; end if;
 if p_result='accepted' and p_provider_id is null then raise exception 'Missing provider ID' using errcode='22023'; end if;
 if p_result='accepted' or p_result='suppressed' then
  if not public.iojh_jobs_complete(p_job,p_token,p_generation) then return 'stale'; end if;
  v_state:=case when p_result='accepted' then 'submitted' else 'suppressed' end;
 elsif p_result='uncertain' then
  if public.iojh_jobs_fail(p_job,p_token,p_generation,'timeout',true)<>'dead' then return 'stale'; end if;
  v_state:='uncertain';
 else
  v_state:=public.iojh_jobs_fail(p_job,p_token,p_generation,coalesce(p_code,'provider_unavailable'),p_result='dead');
  if v_state='stale' then return 'stale'; end if;
  v_state:=case when v_state='dead' then 'failed' else 'queued' end;
 end if;
 update private.notification_records set status=v_state,provider_message_id=coalesce(p_provider_id,provider_message_id),
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
   end if;
 end if;
 return v_state;
end $fn$;

-- Signed Resend webhooks are verified in the server route BEFORE this service-only RPC.
-- Event ID is unique; no webhook body, subject, recipient or signature is stored.
create function public.iojh_notifications_provider_event(p_event_id text,p_provider_id text,p_type text)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_notice private.notification_records%rowtype;
begin
 if p_event_id is null or p_event_id !~ '^[a-zA-Z0-9_-]{8,128}$' or
    p_provider_id is null or p_provider_id !~* '^[0-9a-f-]{36}$' or
    p_type not in ('email.delivered','email.bounced','email.complained','email.suppressed') then
   raise exception 'Unsupported provider event' using errcode='22023';
 end if;
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

-- Administrative projection never returns recipient address, template body or private variables.
create function public.iojh_notifications_admin_failures(p_limit integer default 20,p_before timestamptz default null,p_before_id uuid default null)
returns setof jsonb language plpgsql volatile security definer set search_path = '' as $fn$
begin
 if not public.iojh_admin_aal2() then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid limit' using errcode='22023'; end if;
 return query
 select pg_catalog.jsonb_build_object(
   'notificationId',n.id,'jobId',j.id,'templateId',n.template_key,'locale',n.locale,
   'status',n.status,'jobState',j.state,'errorCode',coalesce(n.last_error_code,j.last_error_code),
   'createdAt',n.created_at,'updatedAt',n.updated_at,
   'retryEligible',(j.state='dead' and n.status='failed' and n.provider_message_id is null
     and (n.first_dispatched_at is null or n.first_dispatched_at > pg_catalog.clock_timestamp()-interval '23 hours')
     and not exists(select 1 from private.notification_suppressions s where s.recipient_email=n.recipient_email and s.scope='all')))
 from private.notification_records n join private.jobs j on j.id=n.job_id
 where (j.state='dead' or n.status in ('failed','uncertain','suppressed'))
   and (p_before is null or (p_before_id is not null and (n.updated_at,n.id)<(p_before,p_before_id)))
 order by n.updated_at desc,n.id desc limit p_limit;
end $fn$;

-- Explicitly AAL2-gated, domain-specific retry. No arbitrary job retry exposed.
create function public.iojh_notifications_admin_retry(p_notification uuid,p_reason text)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_n private.notification_records%rowtype; v_job private.jobs%rowtype; v_actor uuid;
begin
 if not public.iojh_admin_aal2() then raise exception 'Not authorized' using errcode='42501'; end if;
 -- Hold the current membership stable until this mutation commits.
 perform 1 from private.admin_memberships where user_id=auth.uid() and active for share;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_reason not in ('operator_reviewed','provider_recovered','incident_recovery') then
   raise exception 'Unsupported recovery reason' using errcode='22023'; end if;
 v_actor:=auth.uid();
 select * into v_n from private.notification_records where id=p_notification;
 if not found then return false; end if;
 select * into v_job from private.jobs where id=v_n.job_id for update;
 select * into v_n from private.notification_records where id=p_notification for update;
 if not found or v_job.state<>'dead' or v_n.status<>'failed' or v_n.provider_message_id is not null or
    (v_n.first_dispatched_at is not null and v_n.first_dispatched_at <= pg_catalog.clock_timestamp()-interval '23 hours') or
    exists(select 1 from private.notification_suppressions s where s.recipient_email=v_n.recipient_email and s.scope='all') then return false; end if;
 if not public.iojh_jobs_retry_dead(v_job.id,p_reason) then return false; end if;
 update private.notification_records set status='queued',last_error_code=null,updated_at=pg_catalog.clock_timestamp() where id=v_n.id;
 insert into private.notification_review_events(notification_id,actor_id,action,reason_code)
 values(v_n.id,v_actor,'reviewed_requeue',p_reason);
 return true;
end $fn$;

create function public.iojh_notifications_admin_suppress(p_email text,p_scope text,p_reason text)
returns boolean language plpgsql volatile security definer set search_path = '' as $fn$
declare v_actor uuid; v_email text;
begin
 if not public.iojh_admin_aal2() then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from private.admin_memberships where user_id=auth.uid() and active for share;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 v_actor:=auth.uid(); v_email:=pg_catalog.lower(pg_catalog.btrim(p_email));
 if v_email is null or length(v_email)>254 or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$'
   or p_scope not in ('all','marketing') or p_reason<>'manual' then raise exception 'Invalid suppression' using errcode='22023'; end if;
 insert into private.notification_suppressions(recipient_email,scope,reason) values(v_email,p_scope,p_reason)
 on conflict(recipient_email) do update set scope=case when private.notification_suppressions.scope='all' then 'all' else excluded.scope end,
  reason=excluded.reason,updated_at=pg_catalog.clock_timestamp();
 -- Audit action without storing address outside the already-private suppression table.
 insert into private.notification_review_events(notification_id,actor_id,action,reason_code)
 select n.id,v_actor,'suppression_added','manual' from private.notification_records n where n.recipient_email=v_email
 order by n.created_at desc limit 1;
 return true;
end $fn$;

revoke all on function private.iojh_notification_data_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.iojh_notifications_enqueue(text,text,text,text,text,integer,jsonb,text)
 from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_enqueue_fixture(text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_prepare(uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_finish(uuid,uuid,bigint,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_provider_event(text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_admin_failures(integer,timestamptz,uuid) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_admin_retry(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.iojh_notifications_admin_suppress(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.iojh_notifications_enqueue_fixture(text,text,text) to service_role;
grant execute on function public.iojh_notifications_prepare(uuid,uuid,bigint) to service_role;
grant execute on function public.iojh_notifications_finish(uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function public.iojh_notifications_provider_event(text,text,text) to service_role;
grant execute on function public.iojh_notifications_admin_failures(integer,timestamptz,uuid) to authenticated;
grant execute on function public.iojh_notifications_admin_retry(uuid,text) to authenticated;
grant execute on function public.iojh_notifications_admin_suppress(text,text,text) to authenticated;

comment on table private.notification_records is 'Operational notice identity, private recipient and bounded rendering reference; queue payload only contains a UUID/locale/version.';
comment on function private.iojh_notifications_enqueue(text,text,text,text,text,integer,jsonb,text) is 'Call INSIDE a future domain mutation SQL transaction, never by a second HTTP request.';
commit;
