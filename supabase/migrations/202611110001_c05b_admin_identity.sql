-- IOJH C05b: secure, single-owner administrative identity.
-- Run only on the owner-selected IOJH 2.0 DEVELOPMENT Supabase project.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  active boolean not null default false,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint admin_membership_revocation_check check
    ((active and revoked_at is null) or (not active)),
  constraint admin_membership_grant_time_check check
    (revoked_at is null or revoked_at >= granted_at)
);
-- The database, not the UI, enforces at most ONE active administrator.
create unique index if not exists admin_one_active_membership
  on private.admin_memberships ((true)) where active;

create table if not exists private.admin_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('admin_granted','admin_revoked','admin_replaced')),
  subject_user_id uuid not null,
  actor text not null,
  occurred_at timestamptz not null default now(),
  note text not null default '' check (length(note) <= 500)
);

alter table private.admin_memberships enable row level security;
alter table private.admin_audit_events enable row level security;
revoke all on private.admin_memberships from public, anon, authenticated;
revoke all on private.admin_audit_events from public, anon, authenticated;
-- No browser role has SELECT/INSERT/UPDATE/DELETE privileges on the protected tables.

-- Returns only the identity's own active-membership status, never another member's identity.
-- This deliberately does not require AAL2, so an approved member can enroll a factor.
create or replace function public.iojh_admin_membership_active()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select m.active from private.admin_memberships m
    where m.user_id = (select auth.uid())), false);
$$;

-- Authoritative DB-side gate for any future privileged RPC/mutation.
-- Must be combined with a fresh getUser() and AAL check on the server.
create or replace function public.iojh_admin_aal2()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select m.active from private.admin_memberships m
    where m.user_id = (select auth.uid())
      and (select auth.jwt()->>'aal') = 'aal2'), false);
$$;

revoke all on function public.iojh_admin_membership_active() from public, anon, authenticated;
revoke all on function public.iojh_admin_aal2() from public, anon, authenticated;
grant execute on function public.iojh_admin_membership_active() to authenticated;
grant execute on function public.iojh_admin_aal2() to authenticated;
-- Avoid widening default grants to private schema; no service-role browser client.

-- Audit writes are trigger-owned and never exposed as an authenticated RPC.
create or replace function private.audit_admin_membership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' and NEW.active then
    insert into private.admin_audit_events(event_type,subject_user_id,actor,note)
    values('admin_granted',NEW.user_id,session_user,'membership created active');
  elsif TG_OP = 'UPDATE' and OLD.active is distinct from NEW.active then
    insert into private.admin_audit_events(event_type,subject_user_id,actor,note)
    values(case when NEW.active then 'admin_granted' else 'admin_revoked' end,
      NEW.user_id,session_user,'membership status changed');
  end if;
  return NEW;
end;
$$;
revoke execute on function private.audit_admin_membership_change() from public, anon, authenticated;
drop trigger if exists admin_membership_audit on private.admin_memberships;
create trigger admin_membership_audit after insert or update of active on private.admin_memberships
for each row execute function private.audit_admin_membership_change();
