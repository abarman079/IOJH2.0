# ADR C07b — Notification records, transactional outbox, Resend and bounded delivery

**Date:** 2026-11-23. **Status:** implementation candidate; pending disposable DB CI and owner acceptance.
**Baseline:** `c923519e26f7e196c8b43bfc4a5a0462ec71d0e2` / main. **Blueprint:** V5 §§11.2–11.4, 22.8.

## Choices and invariants

- Keep C07a's `private.outbox_events`, `private.jobs`, its atomic enqueue and lease fencing. Do **not** introduce another queue.
- Add private `notification_records` keyed by logical template/purpose/dedupe identity. The same database function creates the notification and its C07a outbox+job. Domain operations must invoke `private.iojh_notifications_enqueue` within the **same SQL transaction** as their domain write. A later HTTP request is not atomic.
- C07b ships only template `account_notice` version 1 as an **operational template**. No public intake route, customer notice, marketing campaign, or live worker is enabled. `public.iojh_notifications_enqueue_fixture` is service-role-only and always uses `fixture@example.invalid`; do not run against hosted environment.
- The C07a job payload remains strictly `{notificationId, locale, templateVersion}`. The protected notification row holds recipient email and bounded approved rendering variables. Template selection and version are checked in SQL and again in TypeScript.
- Keep operational and marketing distinct. Marketing consent storage is provisioned for a future verified C10 confirmation flow, but the C07b database disallows marketing notification enqueues. Suppression is re-checked at the worker's send-preparation boundary. A marketing-only block does not block permitted operational mail; hard bounces/complaints block all.
- Resend REST adapter uses standard Fetch instead of a new SDK dependency. It sends a stable `Idempotency-Key: iojh-notice-v1-{notificationUUID}` and parses an acceptance ID. A 2xx acceptance is `submitted`, **not** `delivered`. Verified delivery/bounce/complaint webhooks may update state, behind a separate owner-controlled configuration checkpoint.
- `iojh_notifications_prepare` and `iojh_notifications_finish` are **service-role-only** PostgreSQL RPCs using the C07a job lease token+generation. `finish` updates the notification and C07a job status in the same transaction, recording provider outcomes without raw errors. The provider call itself is outside SQL; no false exactly-once guarantee.
- Resend's documented idempotency window is 24 hours. C07b quarantines unconfirmed first sends after 23 hours rather than blindly retrying past that boundary. Accepted-but-unconfirmed requests may need provider dashboard reconciliation; C07c must provide an authorized operational workflow for unresolved ambiguity.
- `getAdminAccess` (fresh Supabase identity, current member, AAL2, verified factor, DB RPC) remains the application guard; administrative SQL RPCs also check `public.iojh_admin_aal2()` independently. No direct table access for `authenticated`, `anon`, or `service_role`.
- The admin review UI contains only notification ID prefix, template, locale, state, sanitized error and timestamps. AAL2 recovery is a domain-specific SQL transaction and preserves C07a's job attempts and outbox. An already provider-accepted/suppressed/ambiguous message cannot be requeued automatically.

## C07c contract

1. An owner-approved authenticated runner may call C07a's `claimDueJobs` (now discriminates `ops.probe` and `notification.email`).
2. For `notification.email`, call the **server-only** `dispatchNotificationClaim` with the C07a lease. It will refuse to send unless `IOJH_NOTIFICATIONS_SEND_ENABLED=true`, a valid provider key, verified sender and site origin are configured.
3. Dispatch calls `iojh_notifications_prepare`, validates its bounded response, renders the pinned localized template, calls the Resend adapter and calls `iojh_notifications_finish` under the **same lease**.
4. A future runner must bound concurrency, duration and provider quota, renew a lease only while valid, and surface provider-ambiguous notices for reconciliation. It must not call the provider after a `stale`, `already_submitted`, `suppressed`, `invalid` or `review` preparation result.
5. Do not enable an automated scheduler or public `/api/jobs/run` in C07b. C07c needs a staging proof and owner authorization.

## Alternatives considered

- In-memory background sends or Next.js in-process timers: rejected (not durable across restarts/serverless).
- Another queue service/second notification retry table: rejected (duplicates C07a ownership and fencing).
- Put bodies/recipient emails in outbox jobs: rejected (privacy, stale template, broader service-role exposure).
- Use Supabase Auth SMTP for arbitrary transactional communications: not a supported application-email API. The existing SMTP configuration remains unchanged; use a separate, owner-verified operational sending identity.
- Exactly-once email: impossible to guarantee over a network boundary. Provider idempotency plus database fencing reduce duplicates but cannot remove all ambiguity.

## Official references consulted 2026-11-23

- V5 §§11.2–11.4 and §22.8 (attached blueprint)
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://resend.com/changelog/idempotency-keys
- https://resend.com/pricing
- https://resend.com/changelog/managing-webhooks-via-api
- https://resend.com/migrate/mailgun (webhook event mapping)
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://www.postgresql.org/docs/current/sql-select.html
