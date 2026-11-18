# IOJH 2.0 — C05c Windows 11 integration and acceptance guide

**Source baseline:** `0abd4c2644cff58828ddfddbdb1887e575a4141f` (`main`).  
**Scope:** C05c only. Do not begin C06, touch SSB/ERP, change live DNS, or provision/revoke real admins without separate owner authorization.

## 1. Protect current working files

Open VS Code → Terminal → PowerShell:

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git branch --show-current
git rev-parse HEAD
git status --short
```

Confirm `main` and expected baseline, or inspect any later commit/uncommitted changes before replacing files. Make a separate filesystem backup of this folder and preserve `.git`, `.env.local`, `pnpm-lock.yaml` and your current working C05a/C05b code. Do not run `git init`, reset or force-push.

Download `IOJH2_C05c_Security_Hardening_Integration.zip` and extract its **contents** into the above `Website` directory. There is **no enclosing Website folder**. Replace only the two older C05b instruction documents; all other package paths are new. **No source application files, npm dependencies or local environment variables are changed by this ZIP.**

Verify changes:

```powershell
git status --short
git diff --check
git diff -- docs/security/C05b-owner-recovery.md docs/setup/C05b-windows-and-supabase.md
```

## 2. Run source checks without changing Supabase

Stop a running dev server before the production build to avoid Windows resource exhaustion. Run each command separately:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
```

The existing `next.config.ts` limits build workers. **Do not bypass the production build** if resources are constrained. Record the terminal output and do not label a partial run as passed.

## 3. Review prerequisites BEFORE touching the database

The existing IOJH **development** Supabase project already has C05b applied and an owner-controlled TOTP administrator. The new migration is:

`supabase/migrations/202611150001_c05c_authz_hardening.sql`

**Do not reapply `202611110001_c05b_admin_identity.sql`.** The new file is additive and does not recreate membership records, alter Auth users or provide any privilege-provisioning shortcut. No new secrets, Supabase keys, migrations CLI dependency or `.env.local` variables are necessary.

Before applying:

1. Confirm the development project reference in Supabase Dashboard; never rely on a remembered project name. Confirm it is not a production/SSB/ERP project.
2. Export a secure project-owned database backup or understand the recovery capabilities of your Free plan. Preserve current migration history and `private.admin_audit_events`. Do not paste credentials or user IDs into chats.
3. Inspect current SQL Editor metadata (read only):

```sql
select schemaname,tablename,rowsecurity from pg_tables
 where schemaname='private' and tablename in ('admin_memberships','admin_audit_events');
select indexname from pg_indexes where schemaname='private'
 and indexname='admin_one_active_membership';
select column_name from information_schema.columns
 where table_schema='auth' and table_name='mfa_factors'
 and column_name in ('user_id','factor_type','status');
```

Expect two RLS-enabled tables, the unique index, and **three** required MFA columns. If any preflight check differs, **stop** rather than forcing a migration. Provider Auth database layouts can change.

## 4. Apply the new migration once to the authorized development project

Option A (recommended for the existing manually migrated environment): Supabase Dashboard → SQL Editor → New query. Open the new migration in VS Code; review every line and paste its **whole contents** into the selected development project's SQL Editor. Execute once. The file is wrapped in `BEGIN`/`COMMIT`; do not remove that boundary. It does **not** set `iojh.admin_change_reason` because it does not change administrator membership data.

Option B (CLI, only when project state has been reconciled): Use `supabase --version` and `supabase --help` to check the **installed actual** CLI. The owner previously encountered a CLI v3 config mismatch, so do not blindly upgrade/reinitialize a linked project or run `db push`. When using a CLI migration ledger, ensure previously manually applied C05b/C05c versions are recorded consistently according to the CLI's **current** `migration repair --help` syntax before attempting further tracked migrations. Do not invent migration history or rerun historic SQL.

**Never run** `supabase db reset --linked`, `supabase db reset --remote`, `supabase db push` on an unreconciled hosted project, or any reset using a remote DB URL. These could damage real Auth users or current administrator enrollment. <https://supabase.com/docs/reference/cli/supabase-db-reset>

After application, run the **read-only** contents of `supabase/verify/c05c_readonly_verification.sql` in the same development SQL Editor. Expect all returned `passed` values to be true and `active_admin_count` ≤ 1 (normally 1). It reveals no user identities. **Do not** run the fixture/pgTAP security file on the hosted project.

## 5. Owner provisioning and recovery behavior after C05c

Membership grants/revocations/replacements must now have a transaction-local audit reason of 8–500 characters:

```sql
begin;
select pg_advisory_xact_lock(5705205);
select set_config('iojh.admin_change_reason',
  'Approved incident/reference and concise nonsecret reason', true);
-- Put the owner-approved membership transaction HERE.
commit;
```

**Do not execute this empty illustration** as a grant. Review exact completed operations in `docs/security/C05c-owner-recovery.md` and the updated C05b documents. This setting is **not** an authorization mechanism; it is required evidence for already-privileged owner SQL operations. Never store passwords or TOTP secrets in reason text.

Without a reason, an owner SQL grant/revocation now fails closed. Existing logged-in administrator access remains unchanged because the migration does not alter membership rows.

## 6. Disposable Postgres security tests — separate from the hosted project

Use a **local** Docker-compatible Supabase stack and a CLI version compatible with your existing `supabase/config.toml`. To avoid any remote action, inspect `supabase --help` and confirm your commands target local resources only. On Windows, if `supabase` is installed as a pnpm dev dependency, use `corepack pnpm exec supabase ...`; if it is installed via Scoop, use `supabase ...`. Do **not** run `corepack enable`.

If no `supabase/config.toml` exists, use `supabase init` **only after reviewing the CLI's generated file**; it creates local config in your existing `Website` folder, not a new Git repository. Check the project-specific CLI config version before starting. Docker Desktop must be running.

```powershell
supabase --version
supabase test db --help
supabase start
# Applies local migrations to a NEW disposable local Supabase database.
supabase test db supabase/tests/c05c_admin_security.sql
```

The test file creates three synthetic Auth records and one synthetic verified factor within a transaction that rolls back; it checks actual table privileges, RLS, current member, JWT AAL, factor revocation, unique index, audit reasons, and direct SQL mutations. **It is not a mock.** Do not pass `--linked`, `--remote` or a hosted `--db-url` to the local test command. The existing C05b test file is an older manual SQL assertion file, not the new pgTAP suite; run the C05c file explicitly when using `test db` to avoid mixing test harness conventions.

To cleanly stop the local Docker stack without deleting project data:

```powershell
supabase stop
```

If the CLI version is incompatible or Docker unavailable, mark the **database test pending**. Do not substitute a test against your hosted Auth users.

## 7. Browser and security regression testing

Start app locally with existing `.env.local` (do not share it):

```powershell
corepack pnpm dev
```

Manually test in browser:

- `/en` and `/bn`: complete homepage/7 acts, desktop/mobile navigation and light/dark theme.
- `/en/sign-in`, `/bn/sign-in`, `/en/forgot-password`: existing customer flows unchanged. Password disclosure must become enabled after hydration and toggle normally. Existing reset-notice/recovery-proof messaging must be unchanged.
- `/admin`: signed-out visitor redirects to `/admin/sign-in`; signed-in ordinary customer cannot enter.
- `/admin/mfa`: only current membership may enter enrollment/challenge; AAL1 cannot view `/admin`; correct TOTP upgrades to AAL2.
- `/api/admin/security-check`: anonymously 401 with `{ "authorized":false }`; ordinary customer 403; MFA-verified owner 200 with `{ "authorized":true }` and no-store response. Revoked membership must fail on next request (perform this only under owner-approved, reversible development-project test procedure).

Run Playwright with a single worker to avoid the owner's earlier resource exhaustion:

```powershell
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05b-admin.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05c-admin.spec.ts --workers=1 --timeout=60000
```

For production-mode browser testing, stop the dev process, run `corepack pnpm build`, start `corepack pnpm start` in another terminal, then run the same three Playwright commands. Playwright's config uses `reuseExistingServer:!process.env.CI`; ensure only one local Next server is running. Live TOTP enrollment, revoked factor, recovery and other-user authorization should be verified intentionally with owner-controlled test identities, **not by inserting synthetic records into the hosted Auth schema**.

## 8. Failure handling and Git review

- SQL says `permission denied for schema private`: expected for browser roles; if it appears during the privileged migration, ensure the owner selected the correct SQL Editor and sufficient privileges. Do not broaden browser grants.
- Existing owner suddenly gets 403 after migrating: inspect **read-only** function and factor metadata, ensure currently verified TOTP exists, and check Auth service health. Never disable MFA or loosen RPC logic to force login.
- Owner grant/revoke says audit reason required: check that `set_config(...,true)` is inside **the same transaction**. Do not use a session-global setting or put a reason in source code.
- Existing user passwords stopped working: do not run the disposable Auth-user tests on the hosted project; this migration never touches `auth.users`.
- CLI v3 config incompatibility: stop; inspect CLI version and `config.toml`, use the explicitly reviewed SQL Editor option rather than resetting.
- Build/Playwright resource error: close competing Node processes, run one build/test at a time; keep `--workers=1`.

After actual verification, review the complete diff:

```powershell
git status --short
git diff --check
git add supabase/migrations/202611150001_c05c_authz_hardening.sql supabase/tests/c05c_admin_security.sql supabase/verify/c05c_readonly_verification.sql tests/unit/c05c-security.test.mjs tests/e2e/c05c-admin.spec.ts docs/security/C05c-threat-review.md docs/security/C05c-owner-recovery.md docs/security/C05b-owner-recovery.md docs/setup/C05c-windows-supabase.md docs/setup/C05b-windows-and-supabase.md docs/acceptance/C05c.md docs/manifest/C05c.json

git diff --cached --name-only
git diff --cached --check
```

Only after owner acceptance:

```powershell
git commit -m "security(auth): complete C05c database and authorization hardening"
git push origin main
```

**No Git push or hosted migration has been done by this artifact creator.** C06 is not started here.
