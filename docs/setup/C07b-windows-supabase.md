# IOJH 2.0 C07b — Windows VS Code integration and safe Supabase deployment

**Code baseline:** `main` at `c923519e26f7e196c8b43bfc4a5a0462ec71d0e2` (2026-11-23).
**Development target:** `c07b-notifications-email`. **Correct Supabase project:** IOJH 2.0 Web (`zxltczixfwczkmxcozyu`).
**Do not use:** the separate book registration project. **Do not** replay prior migrations, reset hosted databases, send real email, or enable a worker for C07b.

## A. First integration checkpoint — protect your local files

In the VS Code PowerShell terminal, from the existing Website folder:

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git status --short
git branch --show-current
git rev-parse HEAD
```

Expected: existing `main` branch on the verified C07a merge SHA. An unrelated untracked `README-C05a-MFA-Recovery.txt` may exist; leave it alone, never stage/delete it. If there are other uncommitted changes, review/back them up before proceeding. The GitHub connection **could not create the branch** (403 permission), so create it on your own local checkout after confirming your worktree:

```powershell
git fetch origin main
git switch main
git pull --ff-only origin main
git rev-parse HEAD
git switch -c c07b-notifications-email
```

If `c07b-notifications-email` already exists, **do not recreate or overwrite it**. Inspect it and use `git switch c07b-notifications-email` if it is yours. Never run `git init`, `git reset --hard`, `git push --force` or `git clean -fd`.

## B. Extract the ZIP and verify

Extract `IOJH2_C07b_Notifications_Email_Integration.zip` **contents** directly into `E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website`, with no extra enclosing Website folder. Replace only the exact modified files in `docs/manifest/C07b.json`. All other source files in the ZIP are new. Do not overwrite `.env.local` or the `.git` folder.

Review:

```powershell
git status --short
git diff --check
git diff -- .env.example src/lib/jobs/contracts.ts src/lib/jobs/server.ts src/app/admin/page.tsx .github/workflows/c05c-db-tests.yml
```

Use the manifest to review all new paths. Existing `node_modules`, `.next`, backups, SMTP configs and unrelated applications are not part of this ZIP.

## C. Local validation before any hosted migration

No package or lockfile version changes are expected. Execute **one command at a time**:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
```

Stop `pnpm dev` before a build, preserve `next.config.ts` worker limit, and do not hide TypeScript, lint or runtime errors. C07b unit tests need no database or network; the full project build still uses existing dependencies.

For browser tests, prefer an actual clean production server:

```powershell
corepack pnpm start
```

In another terminal, with the server at port 3000:

```powershell
corepack pnpm exec playwright test tests/e2e/c07b-notifications.spec.ts --workers=1 --timeout=60000
```

The current Playwright config has a localhost port 3000 default. If Windows returns `listen EACCES 127.0.0.1:3000`, launch the server on port 3100 and use a **temporary local** Playwright configuration (do not permanently change shared settings). Set `NEXT_PUBLIC_SITE_URL` to the same origin used for the test, and restart the Next.js server. Login and Supabase callback allowlists must use the selected origin.

## D. Disposable Linux database testing — REQUIRED before deployment

The changed `.github/workflows/c05c-db-tests.yml` preserves the C05c, C06 and C07a pgTAP/concurrency tests, then runs the new C07b pgTAP suite. It is triggered for pull requests to `main` and `c07b-*` branch pushes that change relevant files.

```powershell
git status --short
git diff --check
```

Only after local static/build tests succeed, stage the intended paths and push the **feature** branch for review. CI applies all versioned migrations to disposable Linux Supabase PostgreSQL with CLI `2.122.1`. It does not need your hosted database credentials. Inspect the run's **head commit SHA**: a green run on an older commit does not certify subsequent fixes.

Never run `supabase/tests/c07b_notifications_security.sql` against the hosted project. It inserts synthetic users and simulated provider status records inside a rollback transaction and must remain isolated.

## E. Hosted Supabase preflight — READ ONLY until separate owner authorization

Open Supabase Dashboard at the exact project reference: `https://supabase.com/dashboard/project/zxltczixfwczkmxcozyu`.

Use SQL Editor **Read-only** `supabase/verify/c07b_readonly_preflight.sql` and compare the existing migration ledger:

```text
202611110001
202611150001
202611180001
202611180002
202611220001
```

Expected prior C07a objects exist, `private.notification_records` does **not** exist. If preflight differs, stop and reconcile the cause without replaying historical SQL. The previous private backup (`IOJH2_PreC07a_20261123_112329.dump`) predates C07a and **must not** be treated as a current C07b backup. Create a fresh backup using your existing reviewed `pg_dump` 18.4 workflow, record SHA256 and inspect it with `pg_restore -l`. Do not print the database URL/password in chat or terminal transcripts.

On pinned Supabase CLI 2.122.1 the safe *read-only* history command, if the local project is already linked to the verified target, is:

```powershell
npx --yes supabase@2.122.1 migration list --linked
```

Check the project reference in the CLI output before trusting it. Avoid accidental CLI v3/legacy config mismatch. Do not `db reset`, blindly `db push`, or `migration repair` yet.

## F. Hosted migration — separate authorization required

Only after disposable CI, backup, source review, and explicit owner approval: apply **exactly one new version** through SQL Editor, once:

`supabase/migrations/202611230001_c07b_notifications.sql`

It is additive, uses an explicit transaction, checks C07a dependencies, creates only C07b objects and replaces the C07a payload validator with a backward-compatible two-kind validator. It does **not** alter MFA/admin membership, CMS, private media, existing pending jobs or SMTP settings.

After successful SQL execution, run the READ ONLY `supabase/verify/c07b_readonly_postflight.sql`. All table RLS should be on, no anonymous/customer table reads; authenticated execute access to the limited administrator RPC exists but its **internal AAL2 gate** denies customers/AAL1. No emails should have been sent and no synthetic fixtures should exist. Record the confirmed migration version in the ledger only after checking objects. For manual SQL Editor deployment, conditional command (with separately approved DB access) on CLI 2.122.1:

```powershell
npx --yes supabase@2.122.1 migration repair 202611230001 --status applied --linked
npx --yes supabase@2.122.1 migration list --linked
```

**Do not run these now** or if the migration was already applied/tracked. `migration repair` changes the ledger but does not execute SQL. Follow owner review of backup, state and ledger before any mutation.

## G. Provider and webhook configuration — leave DISABLED for C07b acceptance

The application already has a separate Supabase Auth SMTP integration with Resend. C07b's general notification adapter does NOT modify that configuration. Owner must review a suitable **separately authorized verified sending identity** before actual sends; don't assume that book-registration domains or SMTP credentials are transferable.

New *server-only* `.env.local` placeholders (do not send values into ChatGPT):

```dotenv
IOJH_NOTIFICATIONS_SEND_ENABLED=false
IOJH_NOTIFICATIONS_RESEND_API_KEY=
IOJH_NOTIFICATIONS_FROM=
IOJH_NOTIFICATIONS_WEBHOOK_ENABLED=false
IOJH_NOTIFICATIONS_WEBHOOK_SECRET=
```

`IOJH_JOBS_SERVICE_KEY` already belongs to C07a, is reused for backend-only RPC calls, and must never be public. **Keep SEND_ENABLED and WEBHOOK_ENABLED false** until C07c/service approval. No public worker or scheduler is deployed in this package.

Resend's free transactional tier was documented at 3,000 messages/month and 100/day on 2026-11-23; quotas and sending privileges should be rechecked before future operations. Provider idempotency is documented for 24 hours, hence the ambiguity safety cap. These are not delivery SLAs.

## H. Functional inspection

- Anonymous `/admin/notifications`: redirected to `/admin/sign-in`.
- Anonymous `/api/admin/notifications`: 401, no-store; ordinary customer/AAL1: 403.
- Unauthorized POST `/api/admin/notifications/retry` with foreign Origin: 403.
- Owner AAL2 admin `/admin/notifications`: private, bilingual *message templates* but admin UI is currently English per V5.
- Empty database: clear "No failed notification obligations" state; never "all emails delivered".
- Database failure: accessible error state, no sensitive IDs/subjects/addresses.
- A verified dead **pre-send** notification: only if SQL marks `retryEligible`, admin can confirm and select an audited reason. Requeue means **queued only**, not email sent.
- Accepted, suppressed, bounced or ambiguous older sends: cannot automatically resend.
- Existing C05a/C05b/C05c/C06 and C07a routes remain functional. The homepage is untouched.

## I. Final review branch and PR (only after successful checks)

Do not include the unrelated recovery README or any backup/secret. Stage only the exact manifest paths; example:

```powershell
git add .env.example .github/workflows/c05c-db-tests.yml src/app/admin/page.tsx src/app/admin/notifications src/app/api/admin/notifications src/app/api/notifications/resend-webhook src/features/notifications src/lib/jobs/contracts.ts src/lib/jobs/server.ts src/lib/notifications supabase/migrations/202611230001_c07b_notifications.sql supabase/tests/c07b_notifications_security.sql supabase/verify/c07b_readonly_preflight.sql supabase/verify/c07b_readonly_postflight.sql tests/unit/c07b-notifications.test.mjs tests/e2e/c07b-notifications.spec.ts docs/acceptance/C07b.md docs/adr/C07b-transactional-notifications.md docs/security/C07b-threat-review.md docs/setup/C07b-windows-supabase.md docs/verification/C07b-execution.md docs/manifest/C07b.json

git diff --cached --name-only
git diff --cached --check
```

Only after verifying the staged list and owner acceptance:

```powershell
git commit -m "feat(notifications): add C07b transactional email foundation"
git push -u origin c07b-notifications-email
```

Open a **Draft** PR targeting `main` through GitHub UI and await final-commit CI and owner review. Do not auto-merge. The GitHub connector used during artifact creation could read but returned HTTP 403 on branch creation; the local approach is required unless repository permissions change.

## J. Rollback and recovery

A frontend issue can be reverted by returning to the previous deploy while leaving compatible additive schema and queued obligations intact. **Never drop notification/outbox/job tables or clear rows as rollback**. Leave all send and webhook flags disabled, stop future claims, diagnose CI/runtime, and forward-fix schema/contracts under new migration versions. Previously queued obligations must retain their handler compatibility; do not discard jobs because C07c is not yet live.
