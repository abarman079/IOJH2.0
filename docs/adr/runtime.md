# ADR-001 — Homepage runtime and interaction baseline

Date: 2026-11-03. Status: implementation candidate, **pending Windows build/browser acceptance**.

- Preserve the pre-existing `main` Git repository. The ZIP contains no `.git`.
- Next.js App Router **16.4.3**, React **19.3.1**, strict TypeScript, Tailwind **4.3.3**, next-intl **4.14.9**, next-themes **0.4.6**. Dependencies are exact-pinned in `package.json`. Node 22 LTS selected for local development.
- ESLint 9 flat configuration; CSS/SVG for the first homepage scene. Do not add GSAP/Motion/Lenis until the browser-reviewed static layout meets C04 requirements and motion has a measured purpose.
- Fonts are served by local Fontsource packages (not fetched from Google during rendering). Font license review is in `docs/assets.md`.
- `next-intl` locale routes `/en` and `/bn` and explicit language switching; root defaults to `/en`, not IP-based geo-detection.
- A user-controlled theme follows the OS on first visit and persists in browser storage through next-themes.
- `src/content/fixtures` holds local design data only; it is not production CMS data. Published metrics, real projects, courses, prices, testimonials, applications, or live journal results are deliberately absent.
- Public non-home routes are honest development stubs; accounts/cart are disabled and `/admin` is not exposed without C05 Auth. No Supabase keys, payment code, or live integrations in this packet.
- Preview is `noindex` and `robots.txt` disallows crawling. Replace that deployment posture only after owner-approved content and production readiness.
- Real production hosting/cPanel/Passenger feasibility, policies and provider approvals remain outside C01–C04.

**Lockfile limitation:** The current build environment cannot reach the npm registry, so a genuine `pnpm-lock.yaml` cannot be resolved here. Run `pnpm install` once on Windows; then commit the generated lockfile. Thereafter use `pnpm install --frozen-lockfile`. Do not fabricate or hand-author a lockfile.
