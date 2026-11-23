# C07a execution evidence

Date: 2026-11-22. GitHub starting branch `c07-durable-jobs-outbox-mail`, verified SHA `39c2013bb190fe27713869109db6daf75671cb13`.

This report distinguishes **actual execution** from tests written for later execution. Generated code/syntax parsing alone cannot validate PostgreSQL semantics or runtime provider permissions.

| Check | Status | Evidence |
|---|---|---|
| GitHub branch SHA/source/CI inspection | Executed, passed | Exact SHA verified using connected repository; V5 read locally |
| Node unit tests | **Executed, 37/37 passed** | `node --test tests/unit/*.test.mjs` on reconstructed previous-stage ZIPs + C07a files, 2026-11-22 |
| TypeScript syntax diagnostics | **Executed, 3/3 parsed without syntax errors** | TypeScript compiler parser for C07a `.ts` / `.d.mts` files; NOT semantic typecheck |
| Python and YAML parsing | **Executed, passed** | Python AST/compile of integration test and PyYAML parse of workflow |
| ESLint/full typecheck | **Blocked/not executed** | `corepack pnpm --version` fails fetching `https://registry.npmjs.org/pnpm/latest`; no project `node_modules` |
| Next.js production build | **Blocked/not executed** | Full project dependencies unavailable and npm registry inaccessible |
| C07a pgTAP | **57 assertions authored, 0 executed** | Count verified by source audit; requires disposable Supabase/PostgreSQL, NOT hosted |
| Separate-session concurrency | **4 scenarios authored, 0 executed** | Python syntax parsed; requires disposable local PostgreSQL 17 and `psycopg` |
| C05a/b/c/C06 browser regression | Not executed in delivery environment | Must run in Windows owner integration session |
| Hosted migration | Not executed, owner-controlled | Explicit authorization and preflight required |

**Static-only checks cannot establish PostgreSQL SQL validity or race-free behavior.** No `psql`/Docker/hosted database was used here.

**Additional owner proof:** Record PR commit SHA and CI run URL, PostgreSQL test counts, final build output and any failure/fix commits. CI green on an earlier commit does not prove a later commit.
