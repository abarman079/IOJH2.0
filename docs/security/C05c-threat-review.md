# IOJH 2.0 — C05c Independent Security Review

**Baseline reviewed:** `main` commit `0abd4c2644cff58828ddfddbdb1887e575a4141f` (15 November 2026).  
**Governing specification:** V5 §§7–9, 13, 17, 22.6, 24.  
**Scope:** Existing C05a customer Auth, C05b membership/MFA, one admin-only status route, SQL permissions and recovery. **Not** C06 CMS or commerce.

## Trust boundaries and reviewed evidence

The browser, URL/query, cookies not validated by Supabase, `user_metadata`, and profile fields are **untrusted**. `src/features/admin/authorization.ts` already calls Auth `getUser()` (fresh provider identity), the scoped current-member RPC, Supabase MFA assurance, `listFactors()` and the separate AAL2 RPC. Admin page authorization is executed inside the server page; `/api/admin/security-check` independently runs the gate, returning 401/403/200 with no-store headers. `src/proxy.ts` refreshes session cookies and prevents caching but is **not** itself an authorization boundary. C05a recovery uses an independently signed recovery proof; its password-disclosure hydration fix uses `useSyncExternalStore`. These protections are retained unchanged.

The C05b SQL migration creates a `private` schema, no direct browser grants, two tightly scoped `SECURITY DEFINER` boolean RPCs, a one-active-admin partial unique index, and an audit trigger. Verified against the committed SQL (not merely against earlier ZIPs). Two concrete gaps were found:

| ID | Severity and actual scope | Evidence | C05c treatment |
|---|---|---|---|
| SEC-01 | **Medium defense-in-depth:** JWT `aal2` may remain stale briefly after a factor is unenrolled. The **existing server guard already checks current verified TOTP**; the existing database RPC did not. A future DB-only privileged RPC that checks only `iojh_admin_aal2` could treat stale assurance as sufficient. | C05b `public.iojh_admin_aal2()` tested only `(auth.jwt()->>'aal') = 'aal2'` plus membership. Supabase documents stale `aal2` after unenrollment. | Replacement function now also requires a current `auth.mfa_factors` row for the same user with `factor_type='totp'`, `status='verified'`. Keep server `getUser`+MFA checks. |
| SEC-02 | **Medium auditability:** Membership grant/revocation had static notes only and no required reason, making owner incident reconciliation weak. SQL role `session_user` cannot identify the human database-console operator. | C05b AFTER trigger recorded generic `membership status changed` / `membership created active`. | A BEFORE trigger requires an 8–500-character **transaction-local** audit reason and inserts an atomic private audit event. Owner recovery/setup snippets updated. Owner must separately identify human operator in offline incident record. |
| SEC-03 | **Low privileged-operator integrity:** C05b audit trigger did not record or prevent `DELETE`, allowing a privileged SQL operator to erase membership history. `anon` and `authenticated` could **not** delete; this was not a public escalation. | Trigger covered INSERT and UPDATE OF active only. | C05c trigger rejects deletion and untracked membership field changes. This does **not** stop a compromised DB superuser from dropping triggers or tables. |

## Explicitly NOT vulnerabilities

- Anonymous and normal customer accounts were already denied by the current admin server guard and protected membership grants; no evidence of a browser-level admin bypass was found.
- C05a password disclosure hydration had already been fixed in the latest repository. A production-mode test reportedly passed; no C05c rewrite is justified.
- A normal customer changing `user_metadata.role` cannot gain `private.admin_memberships` rows; the administrator guard never reads that field.

## Design decision and trade-offs

**Additive SQL migration, no application dependency upgrades.** The server guard already uses current provider Auth state and current MFA factors. Changing that proven path would increase regression risk for no demonstrated benefit. C05c strengthens the **database** helper so a future developer cannot rely on an inadequate stale-AAL predicate. Existing function names and return types remain unchanged, preserving the C05b code and API interface. The `private` schema is still not exposed to public browser roles.

The MFA table `auth.mfa_factors` belongs to Supabase Auth. The migration depends on the documented `user_id`, `factor_type`, and `status` columns. Review that exact schema in the selected development project before applying; provider schema changes require revisiting the check. No attempt is made to implement homemade OTP, Recovery Codes, or bypass/unenroll functionality.

The new trigger intentionally changes the **owner-only SQL operating contract**: grants/revocations/replacements require `select set_config('iojh.admin_change_reason','...',true)` inside the same transaction. Existing SQL snippets without this value now fail *closed*. The companion C05b setup/recovery docs are amended. No new credentials or environment variables are needed; a transaction-local PostgreSQL setting is not an application secret or permission grant.

## Residual risks and boundaries

1. SQL superusers/project owners can bypass database triggers and can edit/delete audit rows. The database audit trail is **not tamper-proof or nonrepudiable**. Privileged console access and a private owner incident log must be controlled and reviewed.
2. A signed, unexpired JWT may retain its `aal2` claim; the DB helper now checks current TOTP and membership, while the app still checks fresh Auth user and provider factors. It is *not* an assertion that all refresh tokens are revoked instantly after an Auth-factor event. For compromise, revoke membership first and follow provider-supported session revocation.
3. The newly introduced pgTAP tests and integration browser tests require a **disposable local Supabase stack** and the owner's configured browser environment. Mock/static tests do not prove real hosted security.
4. The replacement audit trigger doesn't retroactively add human-operator reasons to historical C05b events. Owner preserves existing records; do not rewrite audit history.
5. C05c doesn't add `profiles`, customer business records or C06 content tables. Future modules must implement allowlisted ownership/RLS and must call `requireAdminAal2()` in **each privileged operation**, not merely protect a page or proxy.
6. Current admin UI uses English; V5 permits this. Existing customer EN/BN and public themes are unchanged. Browser acceptance is still required.

## Verified reference guidance (reviewed for this packet)

- Supabase Auth MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase TOTP: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Supabase RLS/security-definer: https://supabase.com/docs/guides/database/postgres/row-level-security
- Next.js data security: https://nextjs.org/docs/app/guides/data-security
- Next.js Proxy: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Supabase local database test CLI: https://supabase.com/docs/guides/local-development/cli/testing-and-linting

## Release gate

No production-security declaration is made until disposable Postgres permission tests, real owner MFA and revocation behavior, C05a/C05b/C05c browser regression, and the actual host/proxy no-store behavior have all been verified. Do not approve C06 until the owner accepts and commits C05c.
