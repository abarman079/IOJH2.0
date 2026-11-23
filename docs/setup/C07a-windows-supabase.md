# IOJH C07a — Windows PowerShell and Supabase integration guide

This is the **source-package handoff**, not authorization to mutate hosted Supabase. First perform local static verification and disposable Linux CI, then separately plan hosted migration.

## 1. Verify repository before extracting

```powershell
Set-Location 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected: branch `c07-durable-jobs-outbox-mail`, commit `39c2013bb190fe27713869109db6daf75671cb13`. Review any local changes first; do not overwrite work or run `git init`, `reset --hard`, `push --force` or modify the existing `.git`. An unrelated untracked `README-C05a-MFA-Recovery.txt` may already be present: **do not stage it**. Git line-ending warnings (LF/CRLF) alone do not mean tests failed.

## 2. Extract into the existing project root

Download `IOJH2_C07a_Durable_Jobs_Outbox_Integration.zip`, then extract **its contents** directly into `E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website`. The archive has no enclosing `Website` folder. It adds C07a files and replaces **only** `.github/workflows/c05c-db-tests.yml`. Do not touch `.env.local` or existing C05/C06 migration files.

Example (adjust ZIP location; do not assign to PowerShell's protected `$HOME` variable):

```powershell
$projectDir = 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
$zipFile = Join-Path $env:USERPROFILE 'Downloads\IOJH2_C07a_Durable_Jobs_Outbox_Integration.zip'
Expand-Archive -LiteralPath $zipFile -DestinationPath $projectDir -Force
Set-Location $projectDir
git status --short
git diff --check
```

## 3. Run application checks first (no new pnpm dependencies)

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
```

Run sequentially and stop `pnpm dev` before `build` on low-memory Windows hosts. Project Node version must meet `package.json` and `.nvmrc`; do not follow Node 26 reports from an unrelated broken local Supabase container. No `corepack enable` is required. No new UI route is introduced in C07a. Existing C05/C06 browser regression remains relevant; if port 3000 is blocked, follow the owner's existing temporary 3100 Playwright procedure, not a permanent config rewrite.

## 4. Disposable PostgreSQL tests through GitHub Actions (before hosted migration)

The existing `.github/workflows/c05c-db-tests.yml` is **updated in place**, retaining the C05c and C06 tests and adding C07a pgTAP plus an independent-session Python concurrency test. It runs for `c07-*` push branches and PRs into `main` when DB/job sources change. CLI is pinned to `2.122.1` and the test DB is Docker-backed **on Linux**, not the known-failing local Windows image.

After reviewing only intended sources, commit and push the **development branch** to trigger Linux CI (do not merge):

```powershell
git add '.github/workflows/c05c-db-tests.yml' 'supabase/migrations/202611220001_c07a_jobs_outbox.sql' 'supabase/tests/c07a_jobs_security.sql' 'supabase/verify/c07a_readonly_preflight.sql' 'supabase/verify/c07a_readonly_postflight.sql' 'src/lib/jobs' 'tests/unit/c07a-jobs.test.mjs' 'tests/integration/c07a_concurrency.py' 'docs/acceptance/C07a.md' 'docs/adr/C07a-queue-outbox.md' 'docs/security/C07a-threat-review.md' 'docs/setup/C07a-windows-supabase.md' 'docs/verification/C07a-execution.md' 'docs/manifest/C07a.json'
git diff --cached --name-only
git diff --cached --check
```

Confirm **no secrets, dumps, diagnostics, or the untracked recovery README** are in the staged list. Only after review:

```powershell
git commit -m "feat(jobs): add C07a durable outbox and fenced PostgreSQL leases"
git push origin c07-durable-jobs-outbox-mail
```

Open a **draft** pull request against `main`. Read the final commit's workflow run and inspect the pgTAP + concurrency steps, not only the green overall badge. Do not merge without independent owner acceptance.

## 5. Hosted Supabase project identity and read-only preflight

Select the exact **IOJH 2.0 Web** Supabase dashboard project, ref `zxltczixfwczkmxcozyu`. The independent book-registration project is NOT an acceptable target. The SQL Editor database name `postgres` alone does NOT identify which project you selected.

Before any mutation, run `supabase/verify/c07a_readonly_preflight.sql` in the verified project. Expect four earlier migration versions (`202611110001`, `202611150001`, `202611180001`, `202611180002`), the C05/C06 objects present, and C07a objects absent. If any condition differs, STOP and investigate. Confirm that the hosted migration ledger is consistent with previously applied C06 migrations.

Protect existing development data with an authorized backup. Supabase CLI v2.122.1 was previously used; ensure you are linked to the correct project **before** using CLI commands. A schema-only dump is not a full backup of Auth, CMS, or Storage. Use your established verified recovery/backup procedure, including appropriate database data and object-storage backup. Never commit backup files.

## 6. Optional hosted migration — ONLY after CI, backup and owner authorization

The **only new migration** is `supabase/migrations/202611220001_c07a_jobs_outbox.sql`. It depends on C05c and both C06 files; DO NOT replay older SQL, run remote `db reset`, or blindly run `db push`. In the chosen development project's SQL Editor, review and execute that **one** file only. The migration runs in a transaction and aborts if prerequisites are absent or C07a tables already exist.

Run `supabase/verify/c07a_readonly_postflight.sql` in SQL Editor. Expect table presence/RLS true, no customer grants, backend execute grants true and definer `search_path` empty. Do not run pgTAP/synthetic workers on hosted DB.

**Ledger caution:** Manual SQL Editor execution does not automatically mark `202611220001` as applied in `supabase_migrations.schema_migrations`. Verify objects and ledger FIRST. Only then reconcile ledger using the tested Supabase CLI **v2.122.1** `migration repair --status applied` procedure against the explicitly verified linked development project, with a reviewed command matching that version's help output. Never mark a failed/partial migration as applied; never repair speculative versions. Confirm history using the pinned CLI's `migration list` and the read-only SQL query. The normal owner-support chat should carry out this separately.

## 7. Failure, rollback and safe recovery

- **Existing objects/prerequisites missing:** migration aborts. Do not re-run C05/C06 migrations. Recheck target project and migration ledger.
- **Incorrect permissions:** stop and compare actual function grants/read-only postflight. Never add anonymous/customer EXECUTE to work around an error.
- **CI pgTAP failure:** do not apply hosted migration; fix in branch and rerun CI for the newest commit.
- **CI concurrency failure:** preserve logs (redact credentials), inspect claim/transaction ordering; do not reduce assertions or force green.
- **Windows install issue:** stop build, check versions and lockfile; no new npm package is required.
- **Migration already applied:** do not reapply. Check definitions and ledger; forward-fix via a new migration if needed.
- **Staging rollback:** disable any future runner claims, retain outbox/jobs/attempt rows, and revert application callers if necessary. Never truncate real obligations or drop queue tables as a routine rollback.
- **No scheduler/email:** C07a only establishes durable records. Until C07b/C07c, no real external messaging runs and no automatic job drain exists.

## 8. Future service configuration, not required for C07a installation

`src/lib/jobs/server.ts` requires **optional** `IOJH_JOBS_SERVICE_KEY` when invoked by a trusted backend in a later stage. It must be a server-only service-role key, never a publishable key, `NEXT_PUBLIC_*` variable, client bundle, or shared chat message. There is no C07a scheduler or runner route, so no new hosted secret needs to be configured now. Maintain existing Supabase Auth/MFA, SMTP, CMS media Storage and homepage configuration unchanged.

## 9. CI and sources

Official guidance reviewed on 2026-11-22: PostgreSQL SKIP LOCKED, Supabase SQL function grants, RLS, pgTAP/CLI CI, Next.js server data access. Details and links: `docs/adr/C07a-queue-outbox.md`.
