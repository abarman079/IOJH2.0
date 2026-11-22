# IOJH 2.0 — C06 Windows + Supabase owner integration guide

**Only IOJH 2.0 Website.** No IOJH Office ERP, SSB, production website, DNS or hosted Supabase changes were made by the ZIP author. Baseline `main` SHA: `decb37099886dc5622cc98e4f42b0716db38c7ae`. Date: 18 November 2026.

## A. Protect the known-good Windows project

Open VS Code and PowerShell:

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git branch --show-current
git rev-parse HEAD
git status --short
```

Confirm `main` and the complete baseline SHA above. If there are uncommitted changes, back them up/reconcile before overlaying. Recommended owner review branch (preserves history): `git switch -c c06-cms-integration` after confirming a clean tree. **Never** run `git init`, `git reset --hard`, `git push --force`, or delete `.git`.

Download `IOJH2_C06_CMS_Data_Revisions_Media_Integration.zip`. Extract **contents** directly to this existing `Website` folder, not an extra nesting level. Replace only matching `.env.example`, `.gitignore`, `src/app/admin/page.tsx`, and `.github/workflows/c05c-db-tests.yml`; all other files are new. The ZIP contains no `.env.local` and no lockfile change. Keep all existing C01–C05c source and configured `.env.local`.

## B. Dependencies and local quality checks

C06 uses the existing pinned Next.js/Supabase/Zod stack. **No package update.** Commands:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
```

Stop `pnpm dev` before `build`. Retain the existing Next.js `experimental.cpus: 2` for Windows resource limits. Do **not** run `corepack enable`.

For local development:

```powershell
corepack pnpm dev
```

If port 3000 reports `EACCES`, use `corepack pnpm exec next dev --port 3100`. If you need Supabase email authentication while on 3100, inspect local Auth redirect allowlists and `NEXT_PUBLIC_SITE_URL` privately rather than switching the actual production domain. Do not commit temporary port/environment changes. Avoid hardcoding an alternate port in Playwright configuration until it is tested.

## C. Add the C06 private Storage server key

The media API deliberately cannot upload without a **server-only** service-role/secret key. This is a new sensitive configuration value in addition to the existing C05 `.env.local` settings.

In the **separate IOJH 2.0 development Supabase project's dashboard**, obtain the approved privileged API key following current Dashboard instructions. Enter it **only** in local `.env.local`:

```dotenv
IOJH_CMS_STORAGE_SERVICE_KEY=YOUR_PRIVATE_IOJH_DEV_SERVICE_KEY
```

Never paste key values in chat, browser code, a Git commit, or Screenshots. Do not prefix with `NEXT_PUBLIC_`. Production credential provisioning requires a later separate owner decision. The private key grants broad Storage/DB privileges, so use it only for the explicitly authorized website development environment and keep server access restricted. Restart `pnpm dev` after editing `.env.local`.

## D. Backup and read-only migration preflight — STOP before writing

The existing C05b and C05c migration ledger is already reconciled. **Do NOT apply the C05b or C05c SQL files again. Do NOT reset the hosted database.** Your expected prior versions are `202611110001` and `202611150001`.

1. Open Supabase dashboard. Double-check the project ID/reference belongs to the separate **IOJH 2.0 Website development** project. Do not use SSB, ERP or production.
2. Download a fresh **development database backup** using the Dashboard backup facility if available. Free-plan backups may require the CLI. Using the previously working CLI version, from your project directory and after you have linked/logged in privately:

```powershell
npx supabase@2.122.1 --version
npx supabase@2.122.1 migration list --linked
New-Item -ItemType Directory -Force -Path '.local-backups' | Out-Null
npx supabase@2.122.1 db dump --linked -f '.local-backups\c06-before.sql'
```

The CLI may request interactive authentication and project linking. Confirm the **development** project before any command. `.local-backups/` is intentionally *not* part of this ZIP; **do not stage or commit backups**. If `db dump` is not supported under your CLI/project connection, stop and use an owner-approved alternative backup method before migration. Do not upgrade Supabase CLI to v3 casually.
3. Run `supabase/verify/c06_readonly_preflight.sql` using the selected development project's Dashboard SQL Editor. It should show both prior versions, zero C06 versions, the C05c gate present, and no C06 CMS table/bucket yet. If a C06 version/table/bucket already exists, **stop**; do not run the C06 migration again.

## E. Apply only these two NEW migrations, in order

**Migration 1:** `supabase/migrations/202611180001_c06_cms_core.sql` — private entities, EN/BN revisions, published projection, media metadata tables and content authorization functions.

**Migration 2:** `supabase/migrations/202611180002_c06_media_storage.sql` — PRIVATE Storage bucket and controlled media functions.

In the development project's SQL Editor, copy **exactly** migration 1, review and execute once; wait for success. Then copy **exactly** migration 2, review and execute once. Both are transactional (`BEGIN`/`COMMIT`). On any error, stop; do not repeatedly run SQL or replay historical migrations. **No project reset, `db push` or production operation.**

After both succeed, run `supabase/verify/c06_readonly_postflight.sql`. Check every CMS table has RLS, the Storage bucket `public = false`, direct customer writes return false, public revision RPC exists, unique published-route index is present.

### Supabase migration history reconciliation

Because earlier migrations were applied manually, inspect the current ledger before doing anything. The SQL Editor does **not** necessarily add a version to `supabase_migrations.schema_migrations`. If (and ONLY if) both C06 SQL migrations ran successfully and postflight checks passed but their version numbers are absent, record those **already-applied** versions using the owner-linked CLI:

```powershell
npx supabase@2.122.1 migration repair 202611180001 --status applied --linked
npx supabase@2.122.1 migration repair 202611180002 --status applied --linked
npx supabase@2.122.1 migration list --linked
```

Do not record a migration as applied if SQL failed, or use `migration repair` as a workaround for errors. Check migration history displays the existing C05 versions and the two C06 versions, in order. This step changes migration metadata, not application content, and must be performed only with owner authorization.

## F. Test authorized media intake in the browser

1. Sign in at `/admin/sign-in` using your existing specifically provisioned owner account. Complete real TOTP MFA; do not bypass it.
2. Open `http://localhost:3000/admin/media` (or 3100 if using the alternate port). Anonymous/customer/AAL1 attempts must fail/redirect.
3. Upload a small licensed PNG/JPEG/WebP. Fill in rights-holder, license/permission, EN alt text and optional BN alt text. Explicitly tick public-rights permission only when allowed. A success response must show a new media version.
4. Check that the thumbnail is visible to the admin, but **not** through anonymous direct Storage URLs. `/api/cms/media/<asset-id>` should return 404 unless an approved published revision currently references it in a visible block.
5. Try a bad extension, fake image, oversized file and missing rights; all must be rejected.
6. Test replacement: choose an existing version. It receives a new ID and key; old versions are retained. Retirement must reject assets referenced by revisions. Physical Storage deletion does not occur automatically.
7. Run `supabase/verify/c06_storage_orphans_readonly.sql` in the owner-controlled development SQL Editor. It reports counts only. If there are orphans after failed uploads, follow `docs/security/C06-security-review.md` and investigate before any deletion.

**Media rendering limitation:** Supabase Free plan should not be assumed to provide paid image transformations; the current implementation streams original validated images. Avoid unnecessary large images and check mobile loads. No PDF or SVG upload is enabled in C06.

## G. Test published projection with a disposable database

Public route contracts:

- `/en/research-notes/<published-slug>` and `/bn/research-notes/<published-slug>` — published content only.
- `/api/cms/pages/en/<slug>` — JSON public projection with no private notes; 404 on unpublished.
- `/api/cms/media/<uuid>` — published-and-licensed image only.
- `/api/admin/cms/entities` POST and `/api/admin/cms/revisions` POST — AAL2 server+database protected foundational commands. **They are not the C08 editorial interface.**

Run the C06 pgTAP fixture in a **disposable Linux Supabase database**, not your hosted project. The fixture inserts synthetic users, writes revisions, publishes and tests constraints inside a transaction that rolls back. This proves DB-backed projections without creating fake live records.

## H. GitHub Actions Linux disposable DB tests (Windows Docker optional)

Existing workflow `.github/workflows/c05c-db-tests.yml` has been extended, not duplicated. It installs pinned Supabase CLI `2.122.1`, starts disposable Postgres and runs C05c then C06 pgTAP tests. There are no hosted Supabase project secrets in the workflow.

After local lint/typecheck/unit/build pass, you can push an explicitly named **temporary review branch** to trigger Linux CI without merging or deploying:

```powershell
git diff --check
git status --short
git add .env.example .github/workflows/c05c-db-tests.yml src/app/admin/page.tsx src/app/admin/media src/app/api/admin/cms src/app/api/cms src/app/'[locale]'/'(public)'/research-notes src/features/content supabase/migrations/202611180001_c06_cms_core.sql supabase/migrations/202611180002_c06_media_storage.sql supabase/tests/c06_cms_security.sql supabase/verify/c06_readonly_preflight.sql supabase/verify/c06_readonly_postflight.sql supabase/verify/c06_storage_orphans_readonly.sql tests/unit/c06-content-safety.test.mjs tests/e2e/c06-cms.spec.ts tests/fixtures/c06 docs/acceptance/C06.md docs/adr/C06-cms-and-storage.md docs/security/C06-security-review.md docs/setup/C06-windows-supabase.md docs/verification/C06-execution.md docs/manifest/C06.json
git diff --cached --name-only
```

Inspect every staged filename and ensure **no secrets, private data, `.local-backups`, diagnostic logs, `node_modules`, `.next`, temp files or screenshots** appear. Because PowerShell may interpret bracketed paths unusually, an alternative is `git add -A` followed by `git diff --cached --name-only` and **unstaging any unintended paths** before commit. LF/CRLF warnings are not themselves build failures.

If you are on `c06-cms-integration`, rename to a `c06-...` prefix before pushing or use a new `c06-db-security-review` branch. CI is triggered for `c06-*` pushes and PRs to `main` when Supabase files/workflow change. A green workflow proves those disposable SQL tests only, not a real hosted MFA or media upload.

## I. Browser regression and alternate port

With `pnpm dev` running on the matching local port and a matching Playwright baseURL, run:

```powershell
corepack pnpm exec playwright test tests/e2e/c04-home.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05b-admin.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c05c-admin.spec.ts --workers=1 --timeout=60000
corepack pnpm exec playwright test tests/e2e/c06-cms.spec.ts --workers=1 --timeout=60000
```

For port 3100, use a **temporary** local Playwright configuration copy after editing both `baseURL` and `webServer.url`/command to 3100. Do not commit the temporary file or assume Next picks up a port automatically. Prefer production-mode verification (`pnpm build` then `pnpm start -p 3100`) to rule out dev hydration timing. Previous C05a password disclosure is already hydration-hardened; C06 does not modify it.

## J. Commit/merge only after owner acceptance

Run the full checklist `docs/acceptance/C06.md`. No hosted or GitHub deployment is authorized by the ZIP generation itself. After all tests pass and the owner approves, review the changes and commit with message:

```powershell
git diff --check
git status
git diff --cached --name-only
git commit -m "feat(cms): implement C06 bilingual revisions and secure media foundation"
```

Pushing a source branch is not database deployment. Use a reviewed fast-forward or PR merge to main according to your established process. Do not force-push. Do not move into C07/C08 without approval.

## K. Safe failure and rollback

- If either migration fails: stop, read the exact error, confirm the current version ledger and do not rerun historical migrations. Both new SQL migrations are transactional.
- If the app fails to compile: restore only C06 code on your review branch after preserving diffs. Leave existing C05 users, MFA and C05 migrations intact.
- If C06 migrations have succeeded: **do not drop tables/buckets blindly**. Disable new media intake by rolling back the C06 application code and forward-fix with a new versioned migration after backup/review. This preserves versioned content and media history.
- If a Storage key is exposed: rotate/revoke the key in Supabase privately, replace it in `.env.local`, invalidate active deployments and scan Git history; never post the key in chat.
- If tests fail: return redacted error messages and filename/line number to your normal ChatGPT integration-support conversation; do not share auth cookies, JWTs, user UUIDs or secrets.
