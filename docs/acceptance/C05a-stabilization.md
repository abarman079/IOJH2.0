# C05a final stabilization — recovery UI and authorization

**Base:** `abarman079/IOJH2.0` / `main` at commit `a3fbd1f5749e1acce852a288596d71ae727a0387` (5 November 2026).  
**Scope:** C05a stabilization only; **not** C05b/C05c.  
**Source control:** This integration ZIP contains only new/modified paths. No Git or live Supabase writes were performed.

## Change summary

- Reset page now chooses one of three complete **server-rendered** states: configured + verified recovery, configured + no valid recovery proof, or auth not configured. Only the verified state renders the password form or says verification succeeded.
- English and Bangla titles/intros/actions are distinct for the unavailable state. Generic metadata remains noindex.
- Signed 10-minute recovery proof now also binds to Supabase Auth `user.updated_at`, which must be present from the **fresh `getUser()` response** after `verifyOtp`. The cookie remains HttpOnly, SameSite=Lax and Secure in production. A password update advances this Auth revision; replaying an older proof afterward fails in both the page and the Server Action.
- `changePasswordAction` continues checking the freshly verified user and recovery proof on the server, clearing its cookie and signing out after success. An ordinary signed-in session still cannot change a password through this action.
- Unit regression checks cover absent proof, ordinary login without proof, tampering, wrong user/secret, expiration, future-issued proofs, invalid Auth revisions, and post-reset proof reuse. Browser tests cover both locales, missing proof and forged cookies, plus **optional** real-user denial with a dedicated test account.

## Limits and security follow-up

- This is a **revision-bound, fail-closed proof**, not a durable one-time database claim. It prevents **sequential** replay once Supabase Auth `updated_at` advances on a successful password change, but cannot serialize two requests already running concurrently. An atomic, server-authorized nonce-consumption RPC plus corresponding database tests would be needed for an absolute concurrent single-use guarantee. Do **not** assert that is implemented here.
- The password-change action is the sole allowed mutation, and the existing provider recovery OTP is single-use when verified. No first-user/admin shortcuts or service-role clients are added.
- Before approval, verify on the configured Supabase project that a successful `updateUser({ password })` changes the freshly fetched `user.updated_at`, then try replaying the old link and refreshing `/reset-password`. If the provider does not advance this field, the final authorization guarantee is **not** accepted; do not proceed to C05b until a durable fix is implemented.
- Old **unconsumed browser recovery cookies** (v1 format) are deliberately rejected after deploying this patch. Request a new email reset link. Already used OTP email links remain unusable.
- Do not test password resets using a production user's account. Use an isolated test account and the existing safe Supabase configuration.

## Verification commands (PowerShell)

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git status --short
corepack pnpm install
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
```

For an optional **live signed-in session denial** test, provide `IOJH_E2E_AUTH_EMAIL` and `IOJH_E2E_AUTH_PASSWORD` only in the process environment (not tracked files), then unset them afterward. That test skips when credentials are absent.

## Manual acceptance

1. Visit `/en/reset-password` and `/bn/reset-password` directly or while normally signed in: no verified heading/form; localized recovery guidance.
2. Open a new *real* reset email in an isolated test account: verified heading and reset form only after email OTP verification.
3. Change the password once: inline success, sign-out, old reset email link rejected; refresh reset page and verify no form; old password fails sign-in, new password works.
4. Test expired/invalid link, navigation from email, EN/BN, light/dark, 390px/1440px, and keyboard.
5. Check `/en`, `/bn`, `/admin`, `/admin/sign-in` unchanged. Auth/admin isolation must remain intact.

**Acceptance status:** pending Windows lint/types/build, local Playwright, manual Supabase flow and owner approval. The user-reported prior 16/16 tests are historical and do not validate these code changes.
