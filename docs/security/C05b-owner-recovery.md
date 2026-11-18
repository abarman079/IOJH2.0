# C05b administrator recovery and threat boundaries

## Policy

An active membership is not proof of a sufficiently authenticated session. Privileged access requires: a fresh Supabase `getUser()` identity, the current protected `private.admin_memberships` record, Supabase's reported `aal2`, and the database-side JWT `aal2` + membership check. Every future privileged Server Action and handler must independently call `requireAdminAal2()` or equivalent fail-closed domain authorization. Hiding menu options is insufficient.

## Membership custody

Only an IOJH-owner-authorized operator with existing privileged Supabase project SQL/owner access may grant, revoke or replace membership. No public bootstrap API, email allowlist, app role metadata or self-promotion is supported. `private.admin_memberships` and `private.admin_audit_events` are outside the exposed API schema and grant no direct operations to browser roles. Database trigger records membership state changes, without tokens or MFA secrets. Review SQL Editor/operator access logs externally as the DB audit trigger's `session_user` alone does not uniquely identify the human operator.

## Lost authenticator device (owner controlled)

1. **Do not bypass MFA via a new normal login or password-reset flow.** Freeze access to operational systems as appropriate; contact the owner via pre-established offline channel.
2. Owner verifies account ownership through an independent documented process, not email alone, an unverified phone call or a helpdesk chat screenshot.
3. Preserve audit evidence. Use a separately protected Supabase owner/administrator console to inspect the user's MFA factors and follow *current official Supabase instructions* for lost-MFA recovery or factor removal. Exact Auth Admin API privileges and supported factor removal must be verified at the time; never assume Supabase issues recovery codes.
4. For suspected compromise, revoke active sessions/refresh tokens using provider-supported administrative mechanisms. If session invalidation is uncertain, **revoke the private membership first** to ensure the application-level admin guard fails closed on subsequent requests.
5. If account recovery is unsafe/impossible, owner may replace membership in a single database transaction. Confirm new account's email verification and control, and ensure old membership is inactive first. Account replacement alone does **not** automatically enroll MFA; the new admin must enroll/verify TOTP before privileged access.
6. Document the incident/operator identity, timing, reason and follow-up verification in an owner-controlled private incident log. Rotate impacted credentials and review dependent services separately.

### Atomic owner-approved replacement sketch (development first)

**C05c amendment:** Membership grants, revocations and replacements now require an owner-authorized transaction-local audit reason, and membership records cannot be deleted. Preserve a separate private incident log naming the verified human operator; the database `session_user` field identifies the SQL role, not the human.

Run only after independent owner authorization and verification of both UUIDs in the intended database:

```sql
begin;
select pg_advisory_xact_lock(5705205);
-- C05c requires a transaction-local audit reason (8–500 characters).
select set_config('iojh.admin_change_reason',
  'Owner-approved recovery: record private incident reference here', true);
update private.admin_memberships
  set active=false, revoked_at=now()
  where active=true;
insert into private.admin_memberships(user_id,active,granted_at,revoked_at)
values ('REPLACE-WITH-NEW-VERIFIED-OWNER-UUID'::uuid,true,now(),null)
on conflict (user_id) do update
set active=true, granted_at=now(), revoked_at=null;
commit;
```

**This is a privileged owner-only manual procedure.** Confirm resulting unique active count and test revoked account denial. Transaction rollback restores the previous state if SQL fails, rather than leaving two active administrators. The old account may still possess non-admin customer data; handle Auth identity revocation/erasure independently.

## Security boundaries and remaining verification

- Public Supabase `rpc()` permission check is a boolean **for its own authenticated caller only**. AAL1 member-check is intentionally available to the provisioned member to enroll MFA. `iojh_admin_aal2` verifies JWT assurance at the database boundary.
- C05b has no CMS mutations, commerce or privileged user-data endpoint. The diagnostic `/api/admin/security-check` returns only an authorization boolean and has private/no-store headers. Future privileged endpoints must apply the same server gate.
- The unique partial index guarantees **at most one active** member, not mandatory continuous availability of one admin; zero active is permitted during incident recovery.
- Supabase TOTP MFA uses provider-issued challenges and factors. Application never implements its own OTP secret or verifier.
- Browser recovery of a password does not remove MFA enrollment or independently satisfy AAL2.
- Service-role keys must never enter an app client or `NEXT_PUBLIC_*` variable. No arbitrary user ID is accepted by an administrative RPC.
- C05c will add broader profile/customer authorization and database policy testing; it may not loosen C05b's permissions.
- Test privilege grants, factor lifecycle, stale sessions and revocation against the **actual intended development Supabase project**. Static unit tests alone cannot prove the security gates.
