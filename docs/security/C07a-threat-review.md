# C07a security and reliability review

Baseline verified at `39c2013bb190fe27713869109db6daf75671cb13`. No changes were made to existing C05/C06 auth, MFA recovery, CMS, route groups or Storage.

| Risk | Mitigation in implementation | Residual uncertainty |
|---|---|---|
| Customer reads queue or inserts forged job | Private schema and RLS; explicit revocation; only service-role public RPCs | Must verify real grants in disposable PostgreSQL, including role defaults |
| Wrong service key in browser | `server-only` adapter; explicit server-only variable, no HTTP runner | Deployment secret-management rules remain owner responsibility |
| Corrupt or sensitive queue payload | Hard allowlist of `ops.probe` v1 UUID reference and 2KB SQL bound | New business kinds require separate validator migrations |
| Domain write commits without event | Domain mutation must call private enqueue in same SQL transaction; synthetic commit/rollback tests | No real C08/C10 domain workflow is wired yet |
| Duplicate enqueue / key reuse | Unique `(event_type,dedupe_key)` plus payload-fingerprint comparison | Producers must supply stable meaningful keys |
| Concurrent claim | `FOR UPDATE SKIP LOCKED`; separate-session Linux CI test | Linux CI not equivalent to live scheduler workload |
| Stale worker commits outcome | Random lease token + generation + expiry checked on every completion/renew/failure | External provider may already have accepted a side effect |
| Crash or timeout | Lease takeover, bounded retries, dead-letter; attempt history | No C07c runner is deployed; pending jobs will remain pending |
| Leaking provider error/private text | Error codes strictly limited; only references in permitted payload | Reserved C07b EN/BN template-version references are validated in pure contract tests but are not enqueueable. Future handlers must sanitize logs as rigorously |
| Dangerous operator retry | Service-role-only reviewed-retry RPC with allowlisted reason; recorded attempts and prior cycles | C07b must add human approval / narrow UI with MFA and fresh DB checks |
| Duplicate external delivery | Stable event ID/dedupe ref for future provider idempotency | Exactly-once email delivery cannot be promised |
| Compromised service-role key | Stored only in trusted backend runtime; RPC granted only to service_role | Supabase service-role credentials still grant broad project authority; rotate/revoke if compromised |

**Independent review decisions:** No dependency upgrade; no public API endpoint; no frontend form; no worker timer; no unbounded job JSON. The C07a server adapter is intentionally unusable without an explicitly supplied backend-only service key. Private mutation plus outbox atomically executes only in SQL, never in separate Supabase REST requests.

**Test hierarchy:** Pure Node contract tests are not SQL security proof. pgTAP tests assert actual schema grants and transitions in disposable local Supabase. Separate PostgreSQL sessions in the Python test are required to exercise real racing claims. Hosted Supabase and real SMTP are not touched.
