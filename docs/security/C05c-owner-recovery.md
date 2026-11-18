# IOJH C05c — Owner-only administrator custody and recovery

**Never send** user UUIDs, TOTP secrets/QR, access/refresh tokens, recovery URLs, passwords, or SQL Editor connection information to a chat, ticket or repository. Database operations below are for a separately authorized operator in the confirmed **IOJH 2.0 development project**, not production.

## Owner-authorized first grant (only when no active admin exists)

1. Independently verify the intended account's ownership and confirmed email in Supabase Auth. Confirm the Supabase project reference, the recovery custodian and the private incident/ticket number. Keep the human approval outside the public website.
2. Open the project's privileged SQL Editor, review each statement, substitute the exact UUID **locally**, and run a **single transaction**:

```sql
begin;
select pg_advisory_xact_lock(5705205);
select set_config('iojh.admin_change_reason',
  'Owner authorization REFERENCE: initial IOJH website admin grant', true);
do $$ begin
  if exists (select 1 from private.admin_memberships where active) then
    raise exception 'Active administrator exists; use replacement instead';
  end if;
end $$;
insert into private.admin_memberships(user_id,active,granted_at,revoked_at)
values ('INSERT-OWNER-VERIFIED-UUID'::uuid,true,now(),null);
commit;
```

3. Authenticate with the verified owner account and perform Supabase TOTP enrollment and challenge/verification. Mere membership and password verification remain insufficient for `/admin`.

## Revocation for suspected compromise

First use an independent offline owner identity check. **Revoke the membership immediately** in the correct project to ensure every new admin request fails closed, even if the old token claims AAL2. Preserve evidence rather than removing the membership row.

```sql
begin;
select pg_advisory_xact_lock(5705205);
select set_config('iojh.admin_change_reason',
  'Security incident REFERENCE: owner-authorized compromised admin revocation', true);
update private.admin_memberships
set active=false, revoked_at=now()
where active=true;
commit;
```

Then, via owner-only Supabase Auth administration, use supported session invalidation and credential remediation; do not assume every already-issued JWT instantly becomes unusable. Review Auth and API access logs in the provider, and rotate any affected external credentials. Log exact operator identity and decisions **privately**. C05c stores the SQL session role and change reason, not a verified person name.

## Lost authenticator / owner replacement

1. Verify the owner through a preagreed independent channel, not just mailbox access, screenshots or caller-provided profile text.
2. Check whether the current Supabase project/provider actually supports an approved MFA recovery/factor-management method. Do **not** assume recovery codes, a magic reset URL, or a bypass administrator API. Reusing customer password recovery never meets AAL2.
3. If safe account recovery cannot be established, create/verify a replacement Auth identity **without** automatically granting privileges. Revoke the former membership and grant the replacement in **one transaction**, under the same incident reason and existing unique index:

```sql
begin;
select pg_advisory_xact_lock(5705205);
select set_config('iojh.admin_change_reason',
  'Security incident REFERENCE: owner-authorized administrator replacement', true);
update private.admin_memberships
  set active=false, revoked_at=now()
  where active=true;
insert into private.admin_memberships(user_id,active,granted_at,revoked_at)
values ('INSERT-VERIFIED-REPLACEMENT-UUID'::uuid,true,now(),null)
on conflict (user_id) do update
set active=true,granted_at=now(),revoked_at=null;
commit;
```

4. The replacement must enroll and verify their own TOTP factor. Verify old account gets 403 on a new admin check, new account AAL1 is denied, new account AAL2 is authorized. Do not test replacement in a live production database without separate explicit permission and a planned window.
5. Check only **aggregate** active membership count; preserve older audit events. Reconcile time, private ticket reference and operator custody record. Require existing administrative obligations to remain visible when later modules exist.

## Backout and safety

- Rejected statements roll back the entire transaction; they do not remove or transfer membership.
- Never use `delete from private.admin_memberships`, disable the trigger, turn off MFA, or grant browser roles access to `private` as a recovery shortcut.
- Do not `supabase db reset --linked/--remote`, restore an old database over newer user/payment records, or run disposable security fixtures against the hosted project.
- The trigger's required reason and read-only verification are documented in `docs/setup/C05c-windows-supabase.md`. Review this document after every provider MFA recovery capability change.
