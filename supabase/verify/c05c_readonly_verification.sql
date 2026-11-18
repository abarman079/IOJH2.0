-- IOJH C05c: READ-ONLY checks for the explicitly selected development project.
-- Safe to run in the owner-controlled development SQL Editor after migration.
-- Does not enumerate UUIDs, emails, MFA details or secret material.
select 'admin_memberships' as relation, relrowsecurity as rls_enabled
from pg_catalog.pg_class where oid='private.admin_memberships'::regclass
union all
select 'admin_audit_events',relrowsecurity
from pg_catalog.pg_class where oid='private.admin_audit_events'::regclass;

select 'one-active-admin index' as check_name,
       to_regclass('private.admin_one_active_membership') is not null as passed
union all
select 'AAL2 verifier checks MFA factor',
  pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.iojh_admin_aal2()'::regprocedure),'auth.mfa_factors')>0
union all
select 'AAL2 verifier security definer and safe search_path',
  p.prosecdef and 'search_path=""'=any(p.proconfig)
  from pg_catalog.pg_proc p where p.oid='public.iojh_admin_aal2()'::regprocedure
union all
select 'membership audit trigger exists and is BEFORE',
  exists(select 1 from pg_catalog.pg_trigger where tgrelid='private.admin_memberships'::regclass
    and tgname='admin_membership_audit' and not tgisinternal and (tgtype & 2) = 2);

select 'anonymous private schema access denied' as check_name,
 not has_schema_privilege('anon','private','USAGE') as passed
union all select 'customer private schema access denied',
 not has_schema_privilege('authenticated','private','USAGE')
union all select 'customer membership insert denied',
 not has_table_privilege('authenticated','private.admin_memberships','INSERT')
union all select 'anonymous privileged RPC denied',
 not has_function_privilege('anon','public.iojh_admin_aal2()','EXECUTE');

-- Count only; do not copy identifiers from Supabase Auth into chat or tickets.
select count(*) as active_admin_count from private.admin_memberships where active;
