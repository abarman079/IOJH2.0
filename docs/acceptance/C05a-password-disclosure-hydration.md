# C05a — Password disclosure hydration hardening

## Symptom

Playwright's accessibility/password-disclosure test reports that clicking **Show password** did not change the input `type` from `password` to `text` on desktop and mobile. In development this is consistent with a click reaching server-rendered HTML before the client event handler was hydrated. The error itself does not conclusively prove that this is the only cause.

## Change

- `AuthForm` uses React `useSyncExternalStore` with stable server/client Boolean snapshots to keep the disclosure button disabled during SSR and initial hydration and to enable it once interactive.
- Existing `showPassword` state and validation are unchanged.
- Playwright waits for an enabled disclosure control and verifies **both** show and hide behavior, rather than using a fixed delay or weakening an assertion.
- No Supabase, recovery, session, admin, dependencies, migrations, or environment-variable changes.

## Verification

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm exec playwright test tests/e2e/c05a-auth.spec.ts --workers=1 --timeout=60000
corepack pnpm build
```

When a production build is available, rerun Playwright with `corepack pnpm start --hostname 127.0.0.1` in a separate terminal. Test EN/BN desktop and mobile manually. Do not consider this verified until executed in the owner's actual project.

## Acceptance

- Show and hide each toggle password input type and label correctly.
- Keyboard activation works, with no hydration warning.
- Test suite has no unexpected failures; optional live credentials test may remain skipped and must be reported separately.
- C05a recovery protection remains unchanged.
