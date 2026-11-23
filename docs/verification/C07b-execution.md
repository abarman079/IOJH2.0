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

### Not executed / pending

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
