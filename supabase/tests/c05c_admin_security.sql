-- C05c pgTAP integration test — LOCAL, DISPOSABLE SUPABASE DATABASE ONLY.
-- Example: supabase test db supabase/tests/c05c_admin_security.sql
-- It inserts synthetic auth.users and auth.mfa_factors inside a rolled-back
-- transaction. Never use --linked/--remote/--db-url to test a hosted project.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;
select plan(30);

-- Schema, table, function and uniqueness controls (introspection; no mocks).
select ok((select relrowsecurity from pg_catalog.pg_class where oid='private.admin_memberships'::regclass),'membership RLS enabled');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='private.admin_audit_events'::regclass),'audit RLS enabled');
select ok(not has_schema_privilege('anon','private','USAGE'),'anon cannot use private schema');
select ok(not has_schema_privilege('authenticated','private','USAGE'),'customer cannot use private schema');
select ok(not has_table_privilege('authenticated','private.admin_memberships','SELECT'),'customer cannot select memberships');
select ok(not has_table_privilege('authenticated','private.admin_memberships','INSERT'),'customer cannot insert memberships');
select ok(not has_table_privilege('authenticated','private.admin_memberships','UPDATE'),'customer cannot update memberships');
select ok(not has_table_privilege('authenticated','private.admin_memberships','DELETE'),'customer cannot delete memberships');
select ok(not has_table_privilege('authenticated','private.admin_audit_events','INSERT'),'customer cannot write audit');
select ok(not has_function_privilege('anon','public.iojh_admin_membership_active()','EXECUTE'),'anon cannot call enrollment membership RPC');
select ok(not has_function_privilege('anon','public.iojh_admin_aal2()','EXECUTE'),'anon cannot call privilege RPC');
select ok(has_function_privilege('authenticated','public.iojh_admin_membership_active()','EXECUTE'),'authenticated can check own membership for MFA enrollment');
select ok(has_function_privilege('authenticated','public.iojh_admin_aal2()','EXECUTE'),'authenticated can check own AAL2 authorization');
select ok(not has_function_privilege('authenticated','private.audit_admin_membership_change()','EXECUTE'),'customer cannot call audit trigger');
select ok(to_regclass('private.admin_one_active_membership') is not null,'single active admin unique index remains');
select ok((select prosecdef from pg_catalog.pg_proc where oid='public.iojh_admin_aal2()'::regprocedure) and
  (select 'search_path=""'=any(proconfig) from pg_catalog.pg_proc where oid='public.iojh_admin_aal2()'::regprocedure),
  'AAL2 database function is security definer with empty search_path');

-- Synthetic auth records; never correspond to real users. All changes roll back.
insert into auth.users(id,instance_id,aud,"role",email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
values
 ('a0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c05c-customer-1@example.invalid',now(),now(),now(),' {"role":"admin","is_admin":true}'::jsonb),
 ('a0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c05c-owner-2@example.invalid',now(),now(),now(),'{}'::jsonb),
 ('a0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c05c-owner-3@example.invalid',now(),now(),now(),'{}'::jsonb);

-- An ordinary customer (with forged role metadata) is never a member.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.iojh_admin_membership_active(),false,'ordinary customer is not an admin');
select is(public.iojh_admin_aal2(),false,'forged profile/JWT user metadata cannot grant admin access');
reset role;

select set_config('iojh.admin_change_reason','C05c disposable fixture initial owner authorization',true);
insert into private.admin_memberships(user_id,active)
values ('a0000000-0000-4000-8000-000000000002',true);

-- AAL1 can enroll a factor but cannot use the privileged AAL2 RPC.
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select is(public.iojh_admin_membership_active(),true,'current member may start MFA enrollment at AAL1');
select is(public.iojh_admin_aal2(),false,'password-only AAL1 admin is denied');
reset role;

select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.iojh_admin_aal2(),false,'AAL2 claim without current verified factor is denied');
reset role;

insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
        'C05c synthetic fixture','totp','verified',now(),now());
set local role authenticated;
select is(public.iojh_admin_aal2(),true,'active membership plus AAL2 and verified TOTP is authorized');
reset role;

update auth.mfa_factors set status='unverified' where user_id='a0000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.iojh_admin_aal2(),false,'revoked/removed TOTP factor invalidates stale AAL2 JWT');
reset role;

-- Owner revocation is applied even with an old bearer token.
select set_config('iojh.admin_change_reason','C05c disposable fixture owner revocation',true);
update private.admin_memberships set active=false,revoked_at=now()
where user_id='a0000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.iojh_admin_aal2(),false,'revoked membership is immediately denied');
reset role;
select ok(exists(select 1 from private.admin_audit_events where event_type='admin_revoked'
  and subject_user_id='a0000000-0000-4000-8000-000000000002'
  and note='C05c disposable fixture owner revocation'),'revocation recorded with operator reason');

-- Count-safe negative mutation tests. Exceptions are deliberately captured;
-- unexpected mutation success raises and aborts this disposable test.
do $do$
declare rejected boolean;
begin
  -- Missing reason must stop a privileged membership change BEFORE audit/write.
  perform set_config('iojh.admin_change_reason','',true);
  rejected := false;
  begin
    insert into private.admin_memberships(user_id,active)
      values ('a0000000-0000-4000-8000-000000000003',true);
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'missing audit reason was accepted'; end if;

  perform set_config('iojh.admin_change_reason','C05c disposable fixture second grant attempt',true);
  update private.admin_memberships set active=true,revoked_at=null
    where user_id='a0000000-0000-4000-8000-000000000002';
  rejected := false;
  begin
    insert into private.admin_memberships(user_id,active)
      values ('a0000000-0000-4000-8000-000000000003',true);
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'second simultaneous active admin was accepted'; end if;

  rejected := false;
  begin
    delete from private.admin_memberships
      where user_id='a0000000-0000-4000-8000-000000000002';
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'membership row deletion was allowed'; end if;
end;
$do$;
select is((select count(*) from private.admin_memberships where active),1::bigint,'duplicate active grants remain impossible');
select ok(exists(select 1 from private.admin_audit_events where event_type='admin_granted' and note like 'C05c%'),
  'grants have transaction-local reason in audit');
select ok((select count(*) from private.admin_memberships where active)=1,'deletion/mutation tests preserved active owner');
select ok(not exists(select 1 from private.admin_memberships where user_id='a0000000-0000-4000-8000-000000000003'), 'rejected grant never created a second member');

-- Verify that actual authenticated SQL role cannot bypass direct table grants.
set local role authenticated;
do $do$ declare blocked boolean := false;
begin
  begin
    update private.admin_memberships set active=false;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'authenticated role unexpectedly changed membership table'; end if;
end $do$;
select ok(true,'direct authenticated SQL mutation was rejected');
reset role;

select * from finish();
rollback;
