# C06 verification record — authored 18 November 2026

**Baseline read:** public GitHub `main` at `decb37099886dc5622cc98e4f42b0716db38c7ae`; application and migration sources were inspected. Local execution uses a reconstructed source tree from the prior stage packages plus this C06 overlay. It is not a byte-for-byte clone of every committed baseline file, so owner verification must use the actual repository.

## Executed in artifact environment

- `node --test tests/unit/*.test.mjs` in the reconstructed source tree: **31 passed, 0 failed, 0 skipped**. This includes the earlier fixture/auth structural checks and 8 C06 safety/image tests. Retest in Windows using the latest committed tests.
- Global TypeScript parser `ts.createSourceFile` against all C06 TS/TSX/MTS files: **19 files parsed with no syntax errors**. This does NOT establish semantic type correctness.
- Actual PNG/JPEG/WebP fixture bytes passed the `inspectImage()` width/height scanner (16×12); malformed signatures, JPEG metadata segments, invalid sizes and PNG CRC modifications were rejected in unit tests.
- ZIP creation/integrity and path/name manifest checks: see archive verification report generated at packaging.
- Code review checked replacement of existing theme provider, homepage, Admin MFA and C05 recovery: **none is included in the patch**.

## Attempted but blocked

- `corepack pnpm --version` attempted; Corepack could not reach `registry.npmjs.org/pnpm/-/pnpm-10.21.0.tgz` in this isolated environment. Therefore dependencies were not installed. Do **not** interpret parser/test success as a full build.

## Not executed here

- `corepack pnpm lint` — dependencies unavailable.
- `corepack pnpm typecheck` — dependencies unavailable.
- `corepack pnpm build` — dependencies unavailable.
- Playwright/browser tests — Next.js and browser runtime dependencies unavailable.
- pgTAP C05c/C06 tests — no disposable Supabase/PostgreSQL instance in this runtime.
- Real hosted Supabase/MFA/Storage tests — owner-controlled credentials and hosted mutations intentionally unavailable/unauthorized.
- GitHub Actions — workflow source prepared but **not pushed or triggered** by ZIP author.

## Owner/CI commands and expected evidence

On Windows, from the existing website folder:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright test tests/e2e/c06-cms.spec.ts --workers=1 --timeout=60000
```

In Linux GitHub Actions on a temporary `c06-*` branch: workflow `.github/workflows/c05c-db-tests.yml` runs the existing C05c pgTAP suite and the new `supabase/tests/c06_cms_security.sql` **35-assertion** suite against disposable PostgreSQL. A green workflow validates those SQL fixtures and migration application on that runner, not a remote owner's specific MFA factor or media permissions.

Manual hosted checks must additionally confirm the read-only SQL preflight/postflight, private bucket, real owner AAL2 upload, anonymous 404/401/403 cases, rights checks, and EN/BN/homepage/regression behavior. Record exact commands, statuses, screenshots without identifiers/secrets, and errors in the integration support chat.

## Important acceptance limits

C06 source is a development-stage implementation candidate, **not** a claim of a fully deployed production CMS. It intentionally does not contain the C08 content editing/publish UI, C07 job runner/outbox, external media scanner, advanced image transformation, full CMS domain reference resolvers or business catalogs. Reserved block types remain disabled until their actual domain modules exist. Use the owner C06 acceptance checklist before Git commit/merge.
