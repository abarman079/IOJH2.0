# IOJH C06 security review (implementation candidate, not production certification)

Baseline `decb37099886dc5622cc98e4f42b0716db38c7ae`. Review date 18 November 2026.

| Area | Evidence / issue | C06 remedy | Residual verification |
|---|---|---|---|
| Draft leakage | C05 has no CMS entities; C06 needs public/private separation | Private tables have zero anon/auth table grants and RLS; published-only projection omits `private_notes` and unpublished locale | Execute C06 pgTAP in disposable Linux Supabase CI |
| Privilege escalation | C05c RPC `iojh_admin_aal2()` checks active membership, JWT AAL2 and current TOTP | All C06 privileged SQL functions call the existing DB gate; protected API routes independently call fresh `getAdminAccess()` | Real AAL2, AAL1, customer, revoked-admin tests |
| Lost updates | Parallel page drafts can overwrite if revision body updated | Immutable revision trigger and transactional locale-head optimistic version | Real DB race tests and C08 multiple-tab UI tests |
| Route takeover | Arbitrary page slugs might shadow login/system | Reserved slug validator, EN/BN separate route unique index, representative `research-notes` segment | Test collision and reserved slug on disposable DB |
| Executable editorial data | Arbitrary HTML/rich-text could become stored XSS | Bounded structural SQL validation and Zod strict tagged union, React text rendering, restricted links | Browser DOM tests with malicious strings |
| Storage exposure | A public Storage bucket would bypass draft gating | New bucket private; no client `storage.objects` policies; stream only published-referenced licensed images via server | Test direct bucket reads/writes with anon/auth roles |
| File spoofing | Filename/MIME headers alone can lie | Magic/signature/structural checks, PNG CRC, JPEG EXIF segment refusal, WebP animation/malformed envelope refusal, random immutable key | Fuzzing and image decoder parity not yet executed |
| Upload interruption | Storage upload could succeed while SQL metadata fails | Best-effort cleanup; orphan-only read-only inventory and owner runbook | Simulate failure in isolated environment |
| Media retirement | Referenced media could disappear from public content or revision rollback | Recorded usage FK, lock before retirement, deny retirement when referenced | Disposable concurrent-reference test pending |
| Secret exposure | Storage service key grants broad privileged access | `server-only` module, unprefixed environment variable; no client access, no logs | Deployment secret scan and network inspection |
| CSRF & replay | Browser mutation endpoints may receive cross-origin requests | Same-origin header check plus SameSite Auth cookie, fresh server and DB AAL2, unique media key and revision versions | Reverse-proxy origin compatibility must be tested |
| Cache disclosure | Cached draft or stale public data could survive unpublish | Forced dynamic, no-store public API and media response; no Next persistent cache | Browser/CDN cache behavior under target hosting |

**Residual risks / no false certification:** No hosted migration or DB tests were executed by the ZIP author. No virus scanner, EXIF stripping for all possible formats, or paid image transform is claimed. Direct AAL2 administrator SQL RPC access can publish reviewed content in C06 before C08's full editorial approval UI. Only authorized website owner can exercise that power; C08 must make approval/evidence checks and preview first-class. A malicious AAL2 administrator can still submit dishonest rights assertions; independent rights review is an organizational control. Free-plan upload and bandwidth limits may affect throughput.

**Audit trail:** CMS revisions preserve `created_by`; published pointer changes are inserted into `private.cms_publication_events` in the same transaction. Media retains `created_by`, sha256 and version predecessors. Operational outbox, alarms and scheduled cleanup are C07, not C06.

**Recovery:** If migration fails inside BEGIN, the transaction should roll back; investigate before re-running. If application deploy fails after successful additive migration, restore previous application code while retaining new tables and Storage objects; do not destructively reverse an active schema. Prevent new upload operations, keep DB backup, and forward-fix with a new versioned migration after owner approval. Remove leaked service key in provider dashboard if compromised and replace it privately; never place it in Git/chat.
