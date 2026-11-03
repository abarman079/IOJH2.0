# IOJH 2.0 — C01–C04 Homepage Development Preview

Official website rebuild following `IOJH_Website_Master_Development_Plan_v5.md` (3 November 2026).

This package is **actual Next.js source code**, but does not implement real commerce, authentication, CMS, newsletter, course enrollment, journal search or applications. Incomplete destinations display honest development-preview screens. The seven-act homepage is designed for browser evaluation in English/Bangla and light/dark modes.

## Your existing Windows folder

`E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website`

Extract the ZIP's **contents** directly into this folder (not into an extra nested project folder). Keep the existing hidden `.git` folder. The only previously tracked file reported from GitHub was an empty `README.md`, which this package supplies with full instructions. No `git init`, no repository replacement.

## First local installation (PowerShell, in the existing VS Code folder)

```powershell
cd 'E:\IOJH\NEW PROJECT\IOJH2.0 Web\Website'
git status --short
node --version
corepack enable
corepack pnpm --version
corepack pnpm install
corepack pnpm dev
```

Open **http://localhost:3000/en** or **http://localhost:3000/bn**. Root `/` redirects to `/en`. If `corepack enable` fails due to permissions, run `npm install -g pnpm@10.21.0` in a permitted terminal and then use `pnpm install` / `pnpm dev`. If your Node.js version is below **22.12**, install Node.js 22 LTS before proceeding. No `.env.local` is required for the homepage.

**Important:** A genuine `pnpm-lock.yaml` could not be resolved in the artifact-building environment because the npm registry was inaccessible. Your **first** `pnpm install` will generate the lockfile. Commit that lockfile alongside source files. Subsequent installations should use `pnpm install --frozen-lockfile`.

## Quality verification

Stop the development server with Ctrl+C, then:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm build
corepack pnpm start
```

The production preview is also at **http://localhost:3000/en**. Stop it with Ctrl+C. For optional browser automation:

```powershell
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

If `@playwright/test` cannot launch its iPhone-emulation project, its Chromium installation is missing—install the browser as above. The tests check locale headings, all homepage acts, responsive width, service selection, theme change and the mobile menu. A manual browser review is still mandatory.

## Commit and push only after the checks pass

```powershell
git remote -v
git status
git add .
git commit -m "feat: build IOJH 2.0 homepage foundation and seven-act atlas"
git push origin main
```

The existing remote should be **https://github.com/abarman079/IOJH2.0.git**. Do not run `git init`, `git reset --hard`, or `git push --force`. GitHub currently reports the repository as **public**; make it private through GitHub Settings first if that is your intended confidentiality policy, before pushing unpublished drafts.

## Source map

- `src/app/[locale]/(public)/page.tsx` — homepage entry and metadata.
- `src/components/home/home-page.tsx` & `home.module.css` — seven homepage sections and art direction.
- `src/components/home/service-ledger.tsx` — interactive selected-service panel.
- `src/components/layout/` — wide/compact masthead and institutional footer.
- `src/content/fixtures/home.en.json`, `home.bn.json` — replaceable **local content fixtures**; no invented performance claims.
- `src/messages/en.json`, `bn.json` — navigation/utility translations.
- `src/styles/globals.css` — colors, fonts, utility styling and accessible focus.
- `public/illustrations/atlas-map.svg` — original vector artwork.
- `docs/` — assets, design decisions, acceptance evidence and browser checklist.

Next packet **C05 (Auth)** follows only after C01–C04 code and visual acceptance. See `docs/QA-CHECKLIST.md` and `docs/acceptance/C01-C04.md` for what is tested and what is not.
