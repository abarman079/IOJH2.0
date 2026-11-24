# C07b verification evidence — 2026-11-23

Baseline `c923519e26f7e196c8b43bfc4a5a0462ec71d0e2` was confirmed through GitHub. Prior GitHub Action run `45148048393` was reported completed/success on that SHA; this does **not** test new C07b changes.

This artifact-build environment has Node 22.16 and global TypeScript parser but cannot resolve github.com or the npm registry and has no PostgreSQL / Supabase database process. Historical integration ZIPs were used to reconstruct source for isolated checks; this is not an exact fresh checkout.

### Actually executed here

- `node --test tests/unit/*.test.mjs` in reconstructed checkout with C07b overlay: **45/45 passed**, including 8 new C07b tests (rendering, strict schemas, URL/HTML escaping, provider mock responses, idempotency header, timeout, signed webhook verification).
- Global TypeScript `createSourceFile` parsed **13 changed/new TS/TSX/MTS files**, **zero parse diagnostics**. This is syntax parsing only, **not** a semantic typecheck.
- `node --check` for three new `.mjs` files: passed.
- `postcss.parse` on the new admin CSS module: passed (22 top-level nodes).
- `yaml.safe_load` on the amended GitHub workflow: passed (job `database-security`).
- `corepack pnpm --version && corepack pnpm lint`: **attempted and blocked**, because registry.npmjs.org cannot resolve (`EAI_AGAIN`, pnpm@10.21.0 unavailable); no ESLint run occurred.

### Not executed in the original artifact environment (historical)

- `corepack pnpm typecheck`, `corepack pnpm build`, full Playwright (no installed pnpm project dependencies).
- C07b pgTAP, existing C05c/C06/C07a DB tests, and C07a independent-session concurrency in a disposable PostgreSQL environment (no PostgreSQL/Supabase available here).
- Real Resend send, verification webhook, bounce/complaint, sender-domain configuration (not owner-authorized).
- Hosted Supabase migration, account/data access, CLI history repair (not owner-authorized).
- GitHub source branch/PR (branch creation attempted and rejected HTTP 403).

Never treat syntax parsing or pgTAP source authoring as DB/production verification.

### Required owner commands (sequential, stop on failure)

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright test tests/e2e/c07b-notifications.spec.ts --workers=1 --timeout=60000
```

Run the existing complete browser suite separately, preferably against a clean production build. The amended `.github/workflows/c05c-db-tests.yml` on a PR should prove disposable migrations, C05c/C06/C07a/C07b pgTAP and separate-session C07a lease fencing. Verify the CI run's `head_sha` equals the final proposed commit.

### Evidence categories

- **Source-level tests:** reported in the artifact delivery once executed.
- **ESLint / semantic TS / Next.js build:** pending the configured Windows environment unless executed and recorded separately.
- **PostgreSQL pgTAP / independent-session concurrency:** source authored, not a pass until disposable Linux CI runs.
- **Resend live delivery / bounce / complaint:** *not authorized and not performed*; requires verified sender, private key, webhook registration and staging approval.
- **Hosted migration:** *not authorized and not applied*; no schema modification has been made.
- **GitHub feature branch / Draft PR:** attempted branch creation through the connector returned 403. User's local Git checkout is the safe alternative.


## Owner integration verification - 2026-11-23

The following results supersede the original artifact environment's
pending checks. These tests were run against the owner's actual Windows
repository checkout after C07b was integrated.

### Windows application checks

- Dependency installation with frozen lockfile: PASS.
- ESLint: PASS.
- TypeScript semantic typecheck: PASS.
- Node unit tests: 48/48 PASS.
- Next.js production build: PASS.
- C07b Playwright browser tests: 8/8 PASS.
- New admin notification routes compiled successfully.

Two source corrections were required during integration:

1. src/lib/notifications/server.ts:
   Narrow the prepared action to send before using send-only fields.

2. src/features/notifications/notification-review-panel.tsx:
   Correct the initial asynchronous fetch to satisfy React effect rules.

These changes were included in commit:
01f1f826544a51d1ccac608e2ef0511a25af01f2

### Disposable GitHub database CI

Repository: abarman079/IOJH2.0
Branch: c07b-notifications-email
Commit: 01f1f826544a51d1ccac608e2ef0511a25af01f2

GitHub Actions run: 45159476471
Conclusion: SUCCESS

Verified workflow steps:

- Disposable Supabase PostgreSQL startup and migrations: PASS.
- C05c database security tests: PASS.
- C06 CMS and Storage security tests: PASS.
- C07a queue/outbox security tests: PASS.
- C07b notification security tests: PASS.
- C07a independent-session concurrency tests: PASS.

Run URL:
https://github.com/abarman079/IOJH2.0/actions/runs/45159476471

## Hosted verification - 2026-11-24

- PR #3 CI run 45325870252: SUCCESS.
- Verified commit: 80996288bf740259fe17df6248ca101fcf92e75a.
- Hosted project: zxltczixfwczkmxcozyu.
- Read-only database preflight: PASS.
- Fresh database backup: 498456 bytes.
- Backup SHA256: B998E9D0DE578FEF4AEC7E59BFF111ED485C73AFC9F88919241C1DB1FD563865.
- Backup archive inventory and extraction: PASS.
- Independent database restoration: not tested.
- Migration 202611230001: applied successfully.
- Six notification tables created with RLS enabled.
- Anonymous and customer read permissions: denied.
- Customer dispatch permission: denied.
- Backend prepare permission: granted.
- Administrator failure-list RPC permission: granted.
- Notification records after migration: zero.
- Supabase migration ledger: 6/6 synchronized.
- Authenticated administrator dashboard and notification empty state: PASS.
- Full Playwright regression: 75 passed, 3 skipped, zero failures.

No live provider delivery was tested. C07c worker and scheduler
remain deferred. Final owner approval and latest-head CI are required.
