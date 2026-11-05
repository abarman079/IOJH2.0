# C05a · Windows VS Code installation and IOJH Supabase Auth setup

This is an **integration overlay**, not another application. Extract the ZIP contents directly into the existing directory:

`E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website`

The ZIP contains only new/modified files; it does **not** contain `.git`, `node_modules`, `.next`, real keys, generated database content or a second `Website` directory. Do not delete any existing files. **No file deletion is required.**

## 1. Confirm the Git baseline before extracting

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git status --short
git rev-parse HEAD
```

Expected inspected base SHA: `f2ffa3977e91d7f6c308b170f9c1ac02f36cf234`. If you have uncommitted changes or a different base SHA, do not blindly overwrite the changes; compare the files first. Preserve the existing `.git` directory. Extract ZIP contents here, replacing only same-path files in the overlay (a small number of foundation/auth files). Do **not** remove `@wrksz/themes`, rewrite `src/app/[locale]/layout.tsx`, touch `src/app/admin/layout.tsx`, re-add `src/app/layout.tsx` or change `devIndicators: false`.

## 2. Dependencies (existing pnpm workspace)

```powershell
node --version
corepack pnpm --version
corepack pnpm install
corepack pnpm dev
```

The included `package.json` is the **actual GitHub baseline**, with four new dependencies (`@supabase/ssr`, `@supabase/supabase-js`, `zod`, `server-only`); it retains `@wrksz/themes@2.1.1`, Next `16.4.3`, React `19.3.1` and pnpm `10.21.0`. The package lock is intentionally not included: the artifact environment couldn't contact npm. `corepack pnpm install` will update your existing `pnpm-lock.yaml`; **commit this updated lockfile**. Do not run frozen-lockfile installation until after the lockfile has been regenerated.

Before setting Supabase env variables, the homepage and auth screens should render, but forms must report that authentication is not configured. The anonymous `/en/account` route must redirect to `/en/sign-in`.

## 3. Configure an independent Supabase project

Create/use an IOJH 2.0-only Supabase project; do not reuse IOJH Office ERP or SSB databases. In Supabase dashboard:

- **Project Settings → API:** copy **Project URL** and **publishable key** (not the secret/service_role key).
- **Authentication → Providers → Email:** enable email/password and **email confirmations**. Do not disable email confirmation merely to make testing easier.
- **Authentication → URL Configuration:** set **Site URL** `http://localhost:3000` and add these authorized redirect URLs (later add the real HTTPS domain separately):

```
http://localhost:3000/en/auth/confirm
http://localhost:3000/bn/auth/confirm
http://localhost:3000/en/auth/callback
http://localhost:3000/bn/auth/callback
```

- **Authentication → Email Templates → Confirm signup:** ensure the actual confirmation anchor `href` is:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
```

- **Authentication → Email Templates → Reset Password:** set the recovery anchor `href` to:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
```

The Auth confirmation and recovery emails should retain their explanatory text, recognizable sender and subject. Template syntax is provider-specific; check the rendered email in a real inbox. Use default provider email only for owner testing within its limits; a verified transactional sender and deliverability will be required for launch. Do not add user account fields or administration flags to `user_metadata` for authorization.

## 4. Safe local `.env.local` (never commit)

Create `.env.local` by copying `.env.example` in VS Code and add these values:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
IOJH_AUTH_RECOVERY_SECRET=GENERATE_RANDOM_PRIVATE_VALUE
```

To generate a secure random string in PowerShell **without pasting it into your chat or terminal command history**:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 48
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Copy the generated value to `.env.local` as `IOJH_AUTH_RECOVERY_SECRET` (64-character base64). Keep the file private and excluded from Git by `.gitignore`. No `SUPABASE_SERVICE_ROLE_KEY` is used in this stage. If this private recovery secret is missing, recovery must fail closed rather than enable an unprotected password change.

Restart the dev server after modifying `.env.local`:

```powershell
# Stop server with Ctrl+C, then:
corepack pnpm dev
```

## 5. Test routes

| URL | Expected behavior |
|---|---|
| `http://localhost:3000/en` | Existing seven-act homepage unchanged |
| `http://localhost:3000/bn` | Existing Bangla homepage unchanged |
| `/en/sign-up`, `/bn/sign-up` | Correct localized registration form; successful request gives neutral email-verification guidance |
| `/en/verify-email`, `/bn/verify-email` | Informational verification guidance, not a fake account activation |
| `/en/sign-in`, `/bn/sign-in` | Wrong credentials give generic error; verified user signs in and reaches `/L/account` |
| `/en/account`, `/bn/account` | Anonymous redirects to sign-in; verified user sees only their own account email and a Sign out action |
| `/en/forgot-password`, `/bn/forgot-password` | Neutral password-recovery request; no account enumeration |
| `/en/reset-password`, `/bn/reset-password` | An ordinary signed-in session cannot reset; requires valid recent recovery email + proof |
| `/en/auth/confirm?...` | Server consumes a real email token once and redirects; expired/invalid token goes to error screen |
| `/admin`, `/admin/sign-in` | Still intentionally unavailable; C05b must implement verified admin MFA first |

Check both languages, both themes, 320/390/768/1024/1440px, keyboard Tab/Enter/Escape and 200% text zoom. Password fields have native autocomplete and reveal controls. Check the password reset email on the **same device** as the local Next.js server (a localhost link opened elsewhere will not reach your computer).

## 6. Run checks and Playwright

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e:c05a
corepack pnpm test:e2e
```

Playwright's C05a suite is a *configuration-free* UI/denial test, **not** proof that email was actually delivered or Supabase completed authentication. Test a real sign-up, confirmation, sign-out, recovery and reset manually with a disposable test email after configuration. Do not upload secrets, Supabase keys or private browser cookies/screenshots to a public issue.

Security checks: open an incognito window and try `/en/account` (must redirect). Try `/en/sign-in?next=https://example.com` (hidden return field must be `/en/account`). Test `/en/reset-password` while only normally signed in (must not offer a reset). Confirm the admin paths are unavailable. Inspect developer tools Network for `Cache-Control: private, no-store` on authenticated routes, and do not allow public/shared caching. Verify Supabase Auth settings and redirect allowlist before staging.

## 7. Commit only after acceptance

```powershell
git status
git diff --check
git add package.json pnpm-lock.yaml .env.example src docs/acceptance/C05a.md docs/setup/C05a-supabase-windows.md docs/adr/C05a-auth.md docs/manifest/C05a-files.json tests
git status --short
git commit -m "feat(auth): add C05a Supabase customer identity foundation"
git push origin main
```

**Do not commit `.env.local` or secrets.** If you find a problem, keep changes uncommitted, share the exact error text and affected file and fix C05a before approving C05b. A Git push is not production deployment. GitHub was reported public on review; do not push secrets or internal unpublished documents.
