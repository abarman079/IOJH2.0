# C07a architecture decision — durable jobs and transactional outbox

**Decision date:** 22 November 2026. **Baseline:** `39c2013bb190fe27713869109db6daf75671cb13` on `c07-durable-jobs-outbox-mail`. **Source of truth:** V5 §§7.5, 9.5, 11.3–11.4 and 22.8.

## Decision and alternatives

Use **two private PostgreSQL tables**: an immutable `private.outbox_events` with stable logical event identity and an individually leased `private.jobs` row per event. Preserve separate `job_attempts` and `job_recovery_events` histories. No Redis or continuously running server process is required. PostgreSQL is already a required dependency and provides atomic domain/outbox commits, row locking, conditional updates and a single operational ledger.

A unified queue table would be smaller, but makes immutable business-event history compete with mutable retry/lease fields. A broker or managed message bus could scale further but would add a second commit boundary and new infrastructure. The two-table model is deliberate, not a promise of high-throughput distributed scheduling.

## Atomic consistency model

When introducing a **real future domain operation**, its security-definer PostgreSQL function must write its domain changes and call `private.iojh_jobs_enqueue_event(...)` **inside that same SQL transaction**. An exception in either operation rolls back both. The included disposable SQL test demonstrates commit, pre-outbox failure and post-outbox rollback with a synthetic temporary domain table. Do not issue separate HTTP calls (`domain insert` then `enqueue`) and call that atomic. A dedupe collision with a different payload fails instead of silently accepting a second obligation.

The C07a-only registered event is `ops.probe`, schema version `1`, with precisely `{ "correlationId": "UUID" }`. Only trusted service-role RPC can issue probes. A separate **reserved, inert C07b contract** validates `{notificationId, locale: en|bn, templateVersion}` references without storing message text; no database queue type or handler for it is enabled. This event has **no worker handler and performs no external effect**. Future notification, billing, CMS and other job kinds require an additive, versioned payload validator and handler registration in their own packets before any production enqueue.

## Claim and lease contract

`public.iojh_jobs_claim(worker, batch, seconds)` uses ordered `FOR UPDATE SKIP LOCKED` selection in the database. It atomically writes a cryptographically random lease UUID, increments a monotonic lease generation and attempt counters, and records an attempt. Batches are 1–20, leases 15–300 seconds, and cumulative renewal of one attempt is limited to 15 minutes. An expired job is reclaimable if attempts remain; an expired job at its limit is dead-lettered by bounded sweeping in the claim function. An old worker may still be executing external I/O, but cannot **renew, complete or fail** after the lease expires or a new owner acquires it.

Workers must pass `{jobId, leaseToken, leaseGeneration}` to `complete`, `renew`, or `fail`. Repeated completion returns false; it never applies a second transition. The lease token is not a business-effect idempotency key. Future providers must receive **stable event/dedupe identifiers** when supported, and database business effects must have their own unique operation keys.

## Retry and recovery

Failures carry **sanitized codes only**, never raw provider messages or input text. Permanent failures and max attempts become `dead`. Temporary failures retry after exponential delay with ±20% jitter (10 × 2^(attempt-1) seconds, bounded), using PostgreSQL time. Every claim is recorded; dead jobs and immutable outbox events are retained. A privileged, enumerated-reason requeue starts a new retry cycle while preserving total attempt counts and attempt history. Operator-facing tooling is deferred to C07b.

A crashed worker before the claim transaction commits leaves the job available. A worker crashing *after* commit leaves a lease that can be reclaimed; jobs are **at-least-once**, not exactly-once delivery. Provider timeouts may result in ambiguous external effects. Never promise exactly-once email sends.

## Security boundary

All four tables reside in the existing `private` schema with RLS enabled and direct grants revoked for `anon`, `authenticated` and `service_role`. `SECURITY DEFINER` RPCs are `search_path = ''`, with `EXECUTE` granted exclusively to `service_role` for the approved backend operations. No public runner route, worker credentials in client bundles, or automatically exposed admin UI is introduced. The `private` enqueue helper is callable only inside privileged PostgreSQL code, not PostgREST.

Future C07c must gate its runner endpoint with a separately configured secret, bound work and deadlines, validate active deployment ownership, and call the same RPC state machine. The service-role key alone does not make an unauthenticated public HTTP runner safe. One scheduling owner must be verified in staging.

## Operational deployment and rollback

This migration is additive and non-destructive to C05/C06. Once any real obligations exist, **do not drop** the queue or alter published payload semantics. Roll back application deployment by disabling claims and keeping the records intact; fix via additive migration. Confirm prior migrations' ledger state and hosted-project identity before SQL Editor execution.

## Official references consulted (22 November 2026)

- PostgreSQL current SELECT / SKIP LOCKED: https://www.postgresql.org/docs/current/sql-select.html
- PostgreSQL transaction and locking: https://www.postgresql.org/docs/current/explicit-locking.html
- Supabase function-security guidance: https://supabase.com/docs/guides/database/functions
- Supabase RLS and grants: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase CLI testing/pgTAP: https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- Supabase CI integration: https://supabase.com/docs/guides/deployment/ci/testing
- Next.js server-only data security: https://nextjs.org/docs/app/guides/data-security
