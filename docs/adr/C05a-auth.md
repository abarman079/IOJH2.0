# ADR C05a · Separate customer Auth with verified server trust

**Date:** 2026-11-04. **Context:** V5 §§7, 13, 22.6; C01–C04 main baseline was already committed and owner-tested. This is the first C05 acceptance slice, not a replacement roadmap.

**Decision:** Add `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.118.0`, `zod@4.6.7`, `server-only@0.0.1` to the existing `@wrksz/themes`/Next.js 16 project. Keep the public routes inside `/[locale]`, four-shell separation and existing `src/proxy.ts` next-intl integration. A single proxy handles locale and narrowly scoped Auth cookie refresh; route layout uses a fresh `getUser()` call to establish verified customer access, not `getSession` user metadata. This does not authorize administration. No service-role key is imported into client or runtime code.

**Password recovery:** After Supabase verifies a token hash, the callback adds a 10-minute HttpOnly, same-site, server-HMAC signed marker bound to the authenticated user ID. Only the reset action with both verified user and valid marker may update password. Secret comes from `IOJH_AUTH_RECOVERY_SECRET` and is kept outside version control. Attempts from an ordinary session cannot set a new password. Logout invalidates local session; global sign-out is attempted first.

**Protected response safety:** Account pages are force-dynamic, proxy sets no-store on auth routes, callback consumes the token on the server and redirects to a clean URL. Testing the production CDN/cache behavior remains part of C22 and cannot be certified from a local build.

**Out of scope / risks:** Admin membership, AAL2/MFA, RLS, the actual DB and SMTP configuration, persistent rate limiting and recovery of lost administrator MFA device remain C05b/C05c/C07; don't imply completion. Email confirmation must remain enabled at provider level. Default Supabase email sending may be limited; real mail sender readiness is blocked until owner supplies one. The C05a overlay intentionally does not add global app layout, change the theme library, alter home assets, or create an Office ERP / SSB integration.

**Rollback:** Reverse only the C05a commit and update the pnpm lockfile together. No SQL schema changes in this slice. Already registered Supabase Auth identities are not removed by a code rollback.
