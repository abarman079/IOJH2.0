> **C05c follow-up:** After applying the C05c hardening migration, owner membership grants/revocations must include a transaction-local `iojh.admin_change_reason` (see updated SQL below and `docs/security/C05c-owner-recovery.md`). Do not rerun C05b migration.

# C05b owner installation — IOJH 2.0

**Scope:** Existing `main` SHA `182b94683700e8746d8132f4a1866ad9c45052c6`. This ZIP is a patch, not a new repository. Do not use a second project directory.

## 1. Before extraction

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git status --short
git rev-parse HEAD
```

If commit SHA differs, or there are uncommitted changes, compare changes before overwriting. Make a working copy or temporary branch if necessary. Existing `.git`, `.env.local`, lockfile, homepage and customer authentication must remain intact. Extract ZIP contents (not a nested folder) into this folder, replacing the **four existing files** listed in the manifest. There are no deletions or dependency changes.

## 2. Run source checks (before database changes)

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright test tests/e2e/c05b-admin.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
```

In memory-constrained Windows installations, run commands one at a time, stop the development server before a production build, and use one Playwright worker. Existing Next configuration includes `experimental.cpus: 2`; do not disable build verification.

## 3. Apply migration (explicitly authorized development project only)

1. Open Supabase Dashboard and select **the separate IOJH 2.0 development project**. Check the project reference in the browser UI. **Do not use a production project.**
2. In SQL Editor paste the exact contents of `supabase/migrations/202611110001_c05b_admin_identity.sql`; review and execute once. Save its migration file in Git and maintain a versioned migration log; if moving later to Supabase CLI, mark the already applied version appropriately rather than blindly rerunning reset operations.
3. Verify in SQL Editor:

```sql
select schemaname, tablename, rowsecurity from pg_tables
where schemaname='private' and tablename in ('admin_memberships','admin_audit_events');
select indexname,indexdef from pg_indexes
where schemaname='private' and indexname='admin_one_active_membership';
select proname,prosecdef from pg_proc
where proname in ('iojh_admin_membership_active','iojh_admin_aal2');
```

4. Make sure Supabase Auth **TOTP MFA** is enabled and challenge/verification APIs are permitted for your project. Test with a dedicated authenticator app and test email/password identity. No custom email/SMTP configuration changes are needed.

**DO NOT** send keys, SQL output containing emails/user IDs, TOTP QR/secrets or passwords into chat. There is no `.env` addition and no service-role browser key.

## 4. Provision the first active administrator

Before provisioning, create one normal customer identity using your existing sign-up and email confirmation journey. An account created this way has **no admin privilege** until the owner grants it. To locate its UUID privately, visit Supabase Dashboard → Authentication → Users. Confirm that the verified owner-controlled account is the correct identity.

**In the IOJH 2.0 development project's authenticated SQL Editor**, replace the placeholder UUID below with the intended user UUID. This is an **owner-only privileged database operation**, not an app endpoint:

```sql
begin;
select pg_advisory_xact_lock(5705205);
-- After the C05c migration, privileged membership edits require an audit reason.
select set_config('iojh.admin_change_reason',
  'Owner-approved initial administrator grant: private incident reference', true);
-- Confirm there is currently no active administrator before first grant.
do $$ begin
 if exists (select 1 from private.admin_memberships where active) then
  raise exception 'An active IOJH website administrator already exists; use recovery/replacement runbook';
 end if;
end $$;
insert into private.admin_memberships(user_id,active,granted_at,revoked_at)
values ('REPLACE-WITH-OWNER-USER-UUID'::uuid,true,now(),null);
commit;
```

**Important:** SQL Editor runs with privileged project permissions. Never run this in an unverified project. The unique partial index prevents a second active account even if a different privileged transaction races.

### After provisioning

1. Start app with `corepack pnpm dev`.
2. Open `http://localhost:3000/admin/sign-in` and sign in with the verified owner account.
3. Open `/admin/mfa`; enroll an authenticator via Supabase TOTP and verify its first six-digit code. Keep QR/manual secret PRIVATE.
4. Redirect to `/admin` must show the restricted landing desk only after membership + AAL2 checks pass.
5. Sign out and repeat with the same identity: the next new password-only session must require MFA.
6. Sign in with an unrelated verified customer: `/admin` and `/admin/mfa` must fail closed, and `/api/admin/security-check` must return 403. An anonymous request returns 401.
7. Revoke the administrator in SQL Editor (test account only) and verify privileged access is denied on the **next request** even when the browser still has an AAL2 session. Restore intentionally using owner-approved runbook.

## 5. Test protected SQL permissions and index

Run `supabase/tests/c05b_admin_security.sql` **only in a disposable local database** (SQL file uses `BEGIN`/`ROLLBACK`; it still assumes dedicated test privileges and must not be executed in live production). This test checks function grants, private table access and unknown-user denial. Confirm the database UNIQUE index by attempting a second active grant only within a separate **ROLLBACK-protected disposable** transaction with two known test user IDs; the second insert must fail with SQLSTATE 23505. Don't attempt this on a production project.

## 6. Common failure cases

- **403 or repeated admin redirect:** migration not applied, account not explicitly provisioned, or MFA session not at AAL2. Check server logs without revealing private session information.
- **Unable to enroll:** verify Supabase project's TOTP MFA setting and Auth rate limits. Abandoned unverified factors may need owner-reviewed cleanup via documented Supabase mechanisms. Do not disable MFA for convenience.
- **Session seems signed out immediately:** verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remain correct in `.env.local`, and use one consistent localhost host/port for signup, login and MFA. Do not paste values into chat.
- **Build ENOMEM / ERR_INSUFFICIENT_RESOURCES:** close other Node processes, stop `pnpm dev` before build, use the pinned Next.js worker limit and `--workers=1` for Playwright.
- **Invalid MFA code:** verify authenticator device time synchronization and use a fresh code; never request codes or screenshots of QR secrets in support chat.

## 7. Git only after tests and owner approval

```powershell
git diff --check
git status
git add src/app/admin src/app/api/admin src/features/admin src/proxy.ts supabase docs/setup/C05b-windows-and-supabase.md docs/security/C05b-owner-recovery.md docs/acceptance/C05b.md docs/manifest/C05b.json tests/e2e/c05b-admin.spec.ts tests/unit/c05b-security.test.mjs
git diff --cached --name-only
git commit -m "feat(admin): add C05b single-owner MFA protected administration"
git push origin main
```

Never commit `.env.local`, private keys, QR images, passwords or real account identifiers. **Pushing source does not apply SQL migrations to another environment**.
