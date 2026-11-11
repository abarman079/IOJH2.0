# C05a follow-up: password update succeeds but reset page appears to fail

Base: local C05a final stabilization ZIP applied over GitHub commit `a3fbd1f5749e1acce852a288596d71ae727a0387`. This follow-up ZIP must be merged AFTER that stabilization ZIP, never onto the old GitHub commit alone.

## Observed symptom and technical cause

Supabase accepts the new password, and signing in with that password works, but the reset page can switch from a verified password form to "Your recovery link is not active." after submission. Next.js re-renders a Server Component when Server Action cookies are changed; the reset page rightly revokes proof and removes its own form. The previous action also handled password update and post-update cleanup in the same `try/catch`, so cleanup exceptions could be inaccurately returned as password-change failures.

## Fix

- Separate provider-confirmed password mutation from proof clearing and sign-out handling.
- After confirmed password change, attempt to revoke proof and sign out globally, with local fallback.
- Redirect to the existing localized sign-in page after post-update cleanup; never show the reset page's inactive-link state as a post-success status.
- Show confirmed success **only** from a short-lived (120-second), server-signed, HttpOnly cookie scoped to that locale's sign-in route. A query string or fabricated cookie cannot claim success.
- If cleanup cannot be confirmed, show an accurate warning, not a message saying that the password change failed.
- No new dependencies, environment variables, database migrations, new routes, or admin privileges.

## Important limits

- These changes do not make the Auth proof atomic under concurrent requests. The old `user.updated_at`-bound proof is retained unchanged.
- Auth provider confirmation may remain ambiguous if the network fails after the provider applies the update; no client can prove success without provider confirmation.
- The signed success notice is **presentation only**; it grants no authentication, admin access, or recovery permission. It may persist for up to 120 seconds if the user revisits the sign-in page. It is not a one-time token and is not used for authorization.
- If both global and local sign-out fail, or proof clearance fails, the sign-in page warns that cleanup was unconfirmed. Owner should investigate Supabase/Auth and browser session.
- The login screen should never take `?success=1` as evidence of a password change.

## Windows verification

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
```

Then use a *fresh* recovery email on a dedicated test account. A successful password submission should open `/<locale>/sign-in` with a green localized confirmation, not switch to the 'link inactive' screen. Verify old-password rejection, new-password acceptance, used-link denial, no direct reset without proof, and admin 404. Check browser with EN/BN, both themes, and mobile.

**Status:** Unit tests for the pure signed-notice helper were executed in the patch preparation environment. Full Next.js build and live Supabase testing MUST be performed on the owner's environment before accepting this follow-up and committing.
