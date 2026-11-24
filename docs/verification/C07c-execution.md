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
