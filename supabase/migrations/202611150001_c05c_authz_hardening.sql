-- IOJH 2.0 C05c — additive authorization and audit hardening.
-- PREREQUISITE: C05b migration 202611110001 has ALREADY been applied.
-- Apply ONCE to the explicitly selected IOJH 2.0 development database only.
-- Does not grant admin membership, alter existing Auth users, or remove audit history.

begin;

-- Protect the existing private schema and membership/audit relations. No public
-- or customer role can obtain private membership rows through PostgREST.
revoke all on schema private from public, anon, authenticated;
revoke all on table private.admin_memberships from public, anon, authenticated;
revoke all on table private.admin_audit_events from public, anon, authenticated;
alter table private.admin_memberships enable row level security;
alter table private.admin_audit_events enable row level security;

-- C05b checked the AAL2 JWT claim and current membership, but an AAL2 JWT can
-- remain valid for a short interval AFTER a TOTP factor is unenrolled. Check the
-- factor's CURRENT database status as well as the signed claim. This function
-- is a DB-side prerequisite, not a substitute for server getUser()/MFA checks.
create or replace function public.iojh_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(exists (
    select 1
    from private.admin_memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.active is true
      and (select auth.jwt()->>'aal') = 'aal2'
      and exists (
        select 1
        from auth.mfa_factors as factor
        where factor.user_id = membership.user_id
          and factor.factor_type::text = 'totp'
          and factor.status::text = 'verified'
      )
  ), false);
$function$;

-- The AAL1 helper stays intentionally usable by an active admin during MFA
-- enrollment, but must not grant elevated read/write access on its own.
revoke all on function public.iojh_admin_membership_active() from public, anon, authenticated;
revoke all on function public.iojh_admin_aal2() from public, anon, authenticated;
grant execute on function public.iojh_admin_membership_active() to authenticated;
grant execute on function public.iojh_admin_aal2() to authenticated;

-- Require an explicit, nonsecret reason for any privileged grant or revocation.
-- The operator sets this *transaction-local* value in the owner-only SQL Editor:
--   select set_config('iojh.admin_change_reason','Ticket XYZ: ...',true);
-- It is NOT an identity check and does NOT authenticate the human operator;
-- access to the privileged database session must already be owner-controlled.
-- The trigger is SECURITY DEFINER so it can write the private audit table;
-- only the protected table's privileged operators can invoke it indirectly.
create or replace function private.audit_admin_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  change_reason text;
  event_name text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Admin membership records cannot be deleted; revoke membership instead'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Cannot reassign administrator membership identity'
        using errcode = '23514';
    end if;
    if new.active is not distinct from old.active then
      if new is distinct from old then
        raise exception 'Membership fields cannot be changed without a grant or revoke transition'
          using errcode = '23514';
      end if;
      return new;
    end if;
    if old.active and not new.active and new.revoked_at is null then
      raise exception 'Revoked administrator must have revoked_at timestamp'
        using errcode = '23514';
    end if;
    event_name := case when new.active then 'admin_granted' else 'admin_revoked' end;
  elsif tg_op = 'INSERT' then
    if not new.active then return new; end if;
    event_name := 'admin_granted';
  end if;

  change_reason := pg_catalog.btrim(pg_catalog.current_setting('iojh.admin_change_reason', true));
  if change_reason is null or pg_catalog.length(change_reason) < 8 or
      pg_catalog.length(change_reason) > 500 then
    raise exception 'Owner-authorized admin membership changes require a transaction-local 8–500 character audit reason'
      using errcode = '23514';
  end if;

  insert into private.admin_audit_events(event_type,subject_user_id,actor,note)
    values (event_name,new.user_id,session_user,change_reason);
  return new;
end;
$function$;

revoke all on function private.audit_admin_membership_change() from public, anon, authenticated;

-- One BEFORE trigger handles all meaningful transitions atomically with the
-- corresponding audit event. Replace old AFTER trigger without deleting rows.
drop trigger if exists admin_membership_audit on private.admin_memberships;
create trigger admin_membership_audit
before insert or update or delete on private.admin_memberships
for each row execute function private.audit_admin_membership_change();

-- Retain C05b's unique partial index (at most one active admin) unchanged.
-- No extra grants, frontend secrets, profile roles or RLS bypasses are created.
commit;
