# C07a — final integration evidence (updated 2026-11-23)

**Scope:** V5 §22.8 C07a only: transactional outbox, private durable job state, fenced leases, retries, recovery audit and server-side contracts. No actual email, notification dispatch, scheduler or HTTP worker has been enabled.

## Repository and executed tests

- Repository: `abarman079/IOJH2.0`; development branch `c07-durable-jobs-outbox-mail`; baseline `main` commit `39c2013bb190fe27713869109db6daf75671cb13`.
- Source/test commit `57ddf07a15238045f175491d931d09c115cf365b`: 17 intended C07a files in the PR diff (16 added, one CI workflow modified); no `.env.local`, secrets, backup archives or unrelated recovery README in that diff.
- Owner-run Windows checks: `corepack pnpm lint`, `typecheck`, `test:unit` (**40/40 tests passed**) and `build` passed. This supersedes the preliminary package's 2026-11-22 “not executed” statements.
- Disposable Linux PostgreSQL: [push CI 45109339699](https://github.com/abarman079/IOJH2.0/actions/runs/45109339699) and [PR CI 45123066512](https://github.com/abarman079/IOJH2.0/actions/runs/45123066512) passed C05c, C06 and C07a pgTAP tests plus separate-session concurrency checks.
- Separate-session integration tests: **7/7 scenarios passed** — concurrent enqueue deduplication, competing claims, stale lease takeover, transaction rollback recovery, and lease expiry while awaiting a row lock in `complete`, `renew` and `fail`.
- Earlier failure: CI 45108911559 on `5fd8ebe` exposed a leaked expired-test fixture; commit `57ddf07` cleaned up that fixture. Its final push and PR tests passed.
- [Draft PR #2](https://github.com/abarman079/IOJH2.0/pull/2) opened 2026-11-23. Recheck latest PR head SHA and CI before merge; subsequent documentation updates create later commits.

## Hosted IOJH 2.0 Web database

- The owner confirmed the correct Supabase Dashboard project, ref `zxltczixfwczkmxcozyu`; `current_database() = postgres` alone cannot prove project identity.
- Read-only preflight verified all four C05c/C06 migration versions, required authorization/CMS/media objects and absence of C07a outbox/jobs objects.
- On 2026-11-23 the owner executed **only** migration `202611220001_c07a_jobs_outbox.sql` once in the correct hosted SQL Editor; it returned `Success. No rows returned`.
- Read-only postflight confirmed all four tables: `private.outbox_events`, `private.jobs`, `private.job_attempts`, `private.job_recovery_events` — present and RLS-enabled. Anonymous/customer job access was denied and intended backend claim permission was present.
- Additional catalog audit verified all **six** public job RPCs are `SECURITY DEFINER`, have `search_path = ''`, deny `anon` and `authenticated` execution, and allow `service_role`.
- Manual SQL Editor execution did not add a migration-history row. After verifying the objects, the owner ran Supabase CLI **2.122.1** `migration repair 202611220001 --status applied --linked`. The CLI confirmed success, and `migration list --linked` showed all five local and remote versions matched (`202611110001`, `202611150001`, `202611180001`, `202611180002`, `202611220001`).
- No synthetic pgTAP, job-claim, destructive test fixture, external mail or real business event was executed on the hosted database.

## Backup, scope boundaries and remaining limitations

- Owner created a custom-format `pg_dump -Fc` backup via PostgreSQL **18.4** and the Supabase Session pooler, reported size **460,947 bytes**. `pg_restore -l` confirmed inventory entries for Auth users, admin memberships, CMS, media/Storage metadata and migration history; `pg_restore --file=NUL` extracted the whole archive successfully.
- **This archive has not been restored into an independent database**; a complete recovery drill and encryption-at-rest were not independently verified. Protect the local archive and never commit it.
- Two images in the private Storage bucket were declared disposable by the owner and deliberately **not** backed up as file bytes. A PostgreSQL backup contains Storage database metadata, **not** the actual Storage object bytes. This is an acknowledged exception, not a complete Storage backup.
- Existing C05a password recovery/MFA, admin web flow, C06 private media, EN/BN views, themes, homepage and 404 behavior were **not re-tested in a browser** during this integration. The PR changes no existing frontend areas; Vercel preview showed Ready, which is not a substitute for regression tests.
- No C07b email delivery, failed-job administration or C07c runner/scheduler is activated. `ops.probe` has no production handler.

**Owner acceptance pending:** Review latest PR diff and CI, assess the outstanding browser-regression and backup-protection limitations, mark Ready for Review and explicitly approve merge to `main`. No further hosted migration should be run for C07a.
