# C07c execution evidence

Verified GitHub main e9077ea23a883d4f577f630392f795d4ea86af58, prior CI run 45329117675 successful on that SHA (historical C07b, not C07c). No GitHub writes. The cloud terminal could not resolve github.com (git ls-remote failed); read-only connected GitHub source inspection succeeded. Workspace reconstructed from prior C01–C07b ZIPs and current C07c overlay, not a fresh exact full checkout. Relevant modified baseline files checked by Git blob hashes where possible; unchanged baseline files in reconstructed test tree can differ from final merged source. Versions read from actual package.json, lockfile metadata inspected. Node 22.16.0.

| Command / check | Result |
|---|---|
| `node --test tests/unit/c07c-runner.test.mjs` / full reconstructed `node --test tests/unit/*.test.mjs` | PASS (8 new in full suite; 53 total passed, 0 failed/skipped; new tests exercise guard, config, body, budget, fingerprint, mocked provider). |
| TypeScript parser on changed files | PASS syntax only; not semantic typecheck. |
| Python AST and workflow YAML parser | PASS syntax only. |
| `corepack pnpm install --frozen-lockfile` | BLOCKED: Corepack could not fetch pinned pnpm, getaddrinfo EAI_AGAIN registry.npmjs.org. |
| `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build` | NOT RUN; dependencies unavailable, no complete checkout. |
| pgTAP `supabase test db supabase/tests/c07c_runner_security.sql` | NOT RUN; 31 assertions authored; no PostgreSQL, Supabase or Docker runtime available. |
| `python tests/integration/c07c_concurrency.py` | NOT RUN; no disposable DB/psycopg installed. Syntax checked. Five scenarios authored. |
| `corepack pnpm exec playwright test tests/e2e/c07c-runner.spec.ts --workers=1 --timeout=60000` and full regression | NOT RUN; no runnable Next app / Playwright deps. |
| Hosted migration, scheduler and live provider | PENDING owner authorization; no hosted changes, no external sends. |

No C07c CI run exists from this chat; review branch and final-head CI are owner tasks. Tests authored are not claimed passed. Run Q/D/B07/V and staging proof before acceptance. Prior C07b CI and owner-reported browser results are baseline evidence only.


## Owner Windows integration verification

Date: 2026-11-24

Baseline: e9077ea23a883d4f577f630392f795d4ea86af58
Branch: c07c-authenticated-worker-scheduler

The following checks were executed against the owner's actual
Windows repository checkout:

- Integration ZIP SHA256: PASS.
- Archive file checksums: 26/26 PASS.
- Frozen dependency installation: PASS.
- ESLint: PASS.
- Semantic TypeScript verification: PASS.
- Unit tests: 56/56 PASS.
- Next.js production build: PASS.
- Static page generation: 20/20.
- New /admin/operations route compiled.
- New /api/internal/jobs/run route compiled.
- Full Playwright regression: 81 passed, 5 skipped, zero failures.

Integration corrections:

1. Added c07c-* to the GitHub database CI push branch filters.
2. Moved Playwright trace configuration to file scope to avoid
   the worker-level configuration error inside test.describe().
3. Repeated lint and semantic TypeScript checks after the correction.

The browser skips are consistent with existing conditional
navigation/customer tests and the opt-in disposable-local
authenticated runner test.

Authenticated runner positive-path execution, actual PostgreSQL
migration testing, independent-session concurrency, hosted
administrator verification and scheduler proof remain pending.

No hosted database migration, scheduler activation, real email
delivery or production deployment was performed during this
local integration.

The final Git manifest is calculated from canonical staged
Git file contents rather than Windows working-copy line endings.


## Hosted integration and disposable scheduler evidence

Date: 2026-11-24

Verified source commit:
8b2e4afad6899668202088e070bd5faccbdaffa7

- Fresh post-C07b database backup: PASS.
- Backup size: 548091 bytes.
- Backup SHA256:
  E2CFEED755AB5ADF7EE1CEB67CE7277A167B4FAA0B5B679FD4CB40D436F493CE.
- Archive inventory and extraction: PASS.
- Independent database restoration: not tested.
- Owner-authorized migration 202611240001: applied.
- Hosted read-only database postflight: PASS.
- RLS and backend RPC permission checks: PASS.
- Local and remote migration ledger: 7/7 synchronized.
- Authenticated administrator operations dashboard: verified.
- Existing notification review page: verified.

### Authenticated HTTP worker

GitHub CI runs 45351725146 and 45351731483: SUCCESS.

- Actual production Next.js server: PASS.
- Unauthorized and invalid request denial: PASS.
- Authenticated operational probe completion: PASS.
- Duplicate execution prevention: PASS.
- Disabled email attempt preservation: PASS.
- Worker heartbeat and settlement: PASS.

### Disposable PostgreSQL scheduler

GitHub CI runs 45375046182 and 45375054477: SUCCESS.

- PostgreSQL Cron, pg_net and Vault initialization: PASS.
- One scheduler registered: PASS.
- Five consecutive scheduled HTTP invocations: PASS.
- One-minute cadence: PASS.
- Scheduled probe completed exactly once: PASS.
- Disabled notification retained its attempt budget: PASS.
- Scheduler heartbeat: PASS.
- Scheduler removal: PASS.

The scheduler tests used isolated disposable infrastructure
and temporary credentials only.

### Remaining acceptance gates

- Hosted scheduler credential security.
- Authorized isolated HTTPS staging deployment.
- Hosted scheduler reachability and execution proof.
- Controlled real transactional email and delivery-event proof.
- Final operational pause and rollback verification.
- Final owner acceptance and pull request merge.

No hosted Cron activation, real notification delivery,
WhiteCyber changes or production DNS changes were performed.

C07c remains an implementation candidate with successful
disposable scheduler proof, not full production acceptance.


## Secure local staging and independent scheduler evidence

Date: 2026-11-25

Verified source:
7f8ef417cc5c6957e69947c909e4398835467e1d

### Local infrastructure

- Docker Engine 29.9.3 with WSL 2: PASS.
- Separate source archive and staging workspace: PASS.
- Independent local Supabase configuration: PASS.
- PostgreSQL 17.11: verified.
- All seven database migrations: PASS.
- Docker IPv4 and IPv6 localhost bindings: PASS.
- Windows listener isolation for ports 54321-54324: PASS.
- Hosted credentials excluded from staging: PASS.
- Original development repository preserved.

Realtime failed an initial health check and was excluded
from the disposable staging stack. Edge Runtime and analytics
services were also excluded. These are staging-only changes.

Docker Desktop port binding behavior was changed to local only.
The first unsafe staging deployment was stopped before reuse.

### Production application smoke tests

- Frozen dependencies and Next.js production build: PASS.
- Local Supabase Auth API: PASS.
- Local homepage: PASS.
- Worker GET returned HTTP 405: PASS.
- Disabled worker POST returned HTTP 503: PASS.
- Empty queue and notification records before runner test: PASS.

### Independent scheduler verification

A temporary Node.js scheduler invoked the local production
Next.js worker five times without PostgreSQL pg_net.

- Missing and invalid credentials rejected: PASS.
- Five authenticated HTTP invocations: PASS.
- Four observed scheduling intervals: 60.0 seconds each.
- One synthetic operational probe completed exactly once.
- Total job attempts: 1.
- Duplicate processing: none.
- Real emails submitted: 0.
- Worker heartbeat: PASS.
- Application shutdown: PASS.
- Persistent disabled environment configuration preserved.

This is local integration evidence, not persistent operating
system Cron or actual hosted scheduler acceptance.

Hosted HTTPS deployment, production scheduler selection,
controlled real provider delivery, delivery-event verification
and final operational acceptance remain outstanding.

## Controlled real transactional delivery - 2026-11-25

Owner-authorized single-email integration test using an isolated
local Supabase environment and temporary restricted HTTPS ingress.

### Provider and HTTPS verification

- Dedicated updates.iojh.com.bd sending domain verified.
- Existing website A and mail MX records preserved.
- Free-plan quota reviewed before delivery.
- Domain-restricted sending-only API key verified.
- Cloudflared 2026.11.2 executable checksum verified.
- Temporary hostname resolution failure recovered through
  public DNS readiness checks before Windows DNS resolution.
- Temporary HTTPS connectivity and origin identity verified.
- Production Next.js build with temporary HTTPS origin passed.
- Public homepage, administrator and worker access blocked.
- Signature, timestamp, request-size and event filtering
  self-tests passed.
- Exact sender, recipient, subject and provider-ID filtering.
- Temporary webhook subscribed to email.delivered only.

### Real delivery evidence

- Exactly one authorized notification enqueued.
- Exactly one authenticated worker invocation.
- Worker HTTP status: 200.
- Claimed: 1; submitted: 1.
- Retry, dead, review, stale and error counters: 0.
- Resend provider acceptance ID recorded.
- Resend dashboard confirmed Delivered.
- Gmail inbox receipt confirmed by owner screenshot.
- Final notification status: delivered.
- Final job state: succeeded.
- Total job attempts: 1.
- Accepted delivery attempts: 1.
- Signed delivery events: 1.
- Unrelated provider events stored: 0.
- Active pending or leased jobs: 0.
- Last error: null.

### Verified cleanup

- Sending-enabled application stopped after one invocation.
- Webhook-only application reconciled the signed event.
- Temporary application and ingress ports closed.
- Temporary Cloudflared process stopped.
- Persistent runner, sending and webhook flags disabled.
- Persistent provider credentials absent.
- Initial terminal webhook removal confirmation was not an
  independent provider-side deletion check.
- Subsequent owner dashboard screenshots verified that the
  temporary webhook was deleted and no webhooks remained.
- Temporary restricted API key usage verified as exactly once.
- Temporary restricted API key revoked and absence verified
  through the subsequent API keys dashboard screenshot.
- Existing Supabase Auth and Book Leads Reporting credentials
  remained listed.
- No additional real email was sent.

Private recipient, individual message identifiers, temporary
hostname and credentials are omitted from public evidence.

The controlled local end-to-end integration passed.
Permanent hosted scheduler, production webhook isolation,
hosting capacity and operational rollback remain outstanding.
