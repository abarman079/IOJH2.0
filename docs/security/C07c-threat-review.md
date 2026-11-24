# C07c threat review

| Finding / threat | Control | Residual / verification |
|---|---|---|
| High: unfiltered C07a claim consumes attempts for disabled notifications | Separate filtered service-only claim, recipient and UUID staging allowlist, no post-claim filter as primary control | Legacy trusted-service RPC retained; never use in worker. Disposable DB test pending. |
| High: terminal abandoned leases leave notice queued/dispatching | Job transition trigger and additive reconciliation, review uncertain when prepared | Crash cases authored, SQL execution pending. |
| High: timeout/2xx without ID or conflicting key risks resend | Ambiguous result, stable key, 23h limit, fingerprint, quarantine and terminal uncertainty | Actual provider idempotency account scope and outage behavior require authorized proof. |
| High: concurrent early webhook may be lost while REST ID not committed | Same provider-ID advisory xact lock in event and settlement | Separate-session test authored. |
| High: unauthorized runner or admin | Dedicated random bearer and bounded POST; private RLS, explicit function grants, current AAL2 health gate | Replay with stolen valid secret is possible; TLS, secret rotation, endpoint rate limits and host log redaction required. |
| High: configuration drift | Exact staging origin + one recipient and notification ID, sender and credential fingerprint, defaults off | Configuration review mandatory; service key remains powerful. |
| Medium: excessive provider activity / quotas | Database admission and cooldown, one sequential request, no claims during cooldown | Other services may share account quotas; do not exceed allowance. 24h cap on Retry-After. |
| Medium: suppressed recipient changes midflight | Suppression rechecked in final DB authorization, existing local provider suppression | Cannot revoke in-flight provider side effects. Prior ambiguous reservation goes to review. |
| Medium: cancellation / lease stale | Bounded RPC and provider waits, DB authoritative post-lock clock, C07a fencing, run token and expiry | An aborted HTTP/DB operation may still commit; verify observed state, never blindly resend. |
| Medium: disclosure | Redacted fixed response counters, private DB aggregate, no raw exceptions/headers | Host logs, Vault and pg_net queue permissions require review. |
| Medium: operational growth | Singleton monitoring; retained durable attempts/provider events | Existing event/attempt retention requires separate approved retention policy later. |

No irreversible remote changes. Migration updates only new metadata and inconsistent dead notices; no data deletion. Old provider IDs normally canonical UUID; new inputs normalized lowercase. No webhook activation by migration. Existing provider-event replay protection retained. Existing auth/MFA/CMS unchanged.

Stop scheduler first in an incident; disable runner and send flags, leave valid webhook processing enabled if safe. Allow active leases to settle or expire; preserve all evidence. If credentials leaked rotate runner and provider credentials separately, then keep unresolved fingerprint-bound messages quarantined pending human reconciliation. Do not edit notification identifiers or purge queue. Never restore stale backup over newer obligations. Investigate uncertain sends using authorized provider dashboard before any new logical obligation. A compatible older code release can run with claims disabled; keep additive schema and all data. Forward-fix only after disposable CI.


## Scheduler verification boundary

The disposable GitHub CI scheduler test uses temporary credentials,
local PostgreSQL extensions and a temporary Next.js application.

It does not use hosted development or production credentials.

Vault protects secrets at rest, but pg_net temporarily writes
decrypted authorization headers into its request queue.
Local extension privilege observations do not establish hosted
Supabase security guarantees.

Hosted activation requires a separate credential-access review,
authorized isolated staging, rotation and shutdown verification.

No WhiteCyber, DNS, business email or existing website changes
are authorized by this test.


## Verified pg_net privilege observation

Disposable CI runs 45375046182 and 45375054477 observed
SELECT table privileges on net.http_request_queue for anon,
authenticated and service_role.

This is a database privilege observation, not evidence of
public Data API exposure.

Do not activate hosted scheduling with a long-lived bearer
credential until the credential boundary has been reviewed.

Prefer short-lived signed requests with replay protection
or another independently verified secure scheduler approach.

Never queue Supabase service-role keys or Resend API keys
as scheduler HTTP credentials.
