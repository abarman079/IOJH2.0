# C07b security and reliability review — 2026-11-23

## Threats and implemented controls

| Threat | Control | Remaining verification |
|---|---|---|
| Customer/anonymous reads private recipient/body | Private schema tables, RLS enabled, no table grants, restricted definer RPCs | Disposable PostgreSQL role grants + live denial |
| Forged admin metadata/AAL1 access | App `getAdminAccess` and DB `iojh_admin_aal2()` on administrative RPCs | Real owner AAL2 and anonymous browser tests |
| Unauthorized generic email sending | Only one constrained fixture enqueue, private domain function, no C07b runner, feature flag default off | Inspect every new route and bundle |
| Duplicate obligation | Same-transaction notification/outbox+job and dedupe+payload matching | pgTAP and independent sessions |
| Duplicate provider submission | Stable Resend Idempotency-Key, C07a lease fencing, 23h ambiguity cap | Provider sandbox with owner approval |
| Marketing bypass | DB C07b enqueues operational only; separate protected consent and suppression tables; recheck at prepare | Future C10 opt-in/unsubscribe controls unimplemented |
| Provider webhook spoof/replay | Raw-body Svix HMAC verification, ±300s timestamp, unique event IDs, no secret in request query | Signed webhook integration tests pending |
| Admin retry of accepted/suppressed/uncertain event | Eligibility restricted in SQL, AAL2, audited, no new outbox event | Disposable DB tests + real admin testing |
| Provider error leakage | Only constrained error codes stored and displayed; no recipient, API response, subject/body in admin DTO | Manual screen and SQL projection review |
| Credential leak | Server-only Resend key, existing server-only jobs key, no client imports | CI secrets and deployment review |

## Material residual risks

1. No scheduler, worker deployment or real provider sends are enabled. C07b does not establish actual email deliverability.
2. A provider may have accepted an email when a worker times out. Resend idempotency covers a documented 24-hour window; C07b quarantines old uncertain sends. Manual reconciliation remains necessary; do not blindly requeue after that interval.
3. A suppression update may race with an in-flight HTTP provider call after the send-time database check. There is no cross-system atomic transaction. Plan a short-latency worker and documented incident response for urgent suppression.
4. Resend webhook event ingestion needs owner registration of the endpoint, signing secret, event selection and secure infrastructure; default OFF. Provider status may remain `submitted` without it.
5. PostgreSQL test cases and application build have not been executed in the hosted or disposable environment in this artifact runtime; CI and owner acceptance must establish this evidence.
6. Notification email addresses are personal data in a protected database table. Encryption-at-rest defaults, access logs, retention and actual backup/recovery policies need owner review. No C07b automatic retention deletion is permitted.
7. Only a deliberately narrow operational notice template is active. Domain-dependent acknowledgment templates, newsletter confirmation and provider reputation management remain for later accepted slices.
8. Untracked client-side statuses cannot authorize work. Every admin request and SQL mutation rechecks permissions; however authenticated infrastructure compromise still requires rotating the server-only service credential.

## Operator recovery principle

Never delete historical outbox/jobs/attempts to simplify recovery. Before retrying, verify the provider timeline for ambiguous cases. The UI only exposes safe requeue of `failed`/dead jobs with no recorded provider acceptance and within the idempotency safety window. Manual reconciliation of older ambiguous deliveries requires a future audited procedure; do not force a second send via a new dedupe key.
