# C06 architecture record — controlled bilingual CMS and private object delivery

Decision date: 18 November 2026. Baseline: `decb37099886dc5622cc98e4f42b0716db38c7ae`.
Blueprint: IOJH_Website_Master_Development_Plan_v5.md §§8–9, 13, 22.7.

## Decisions

1. **Stable identity; immutable localized revision.** Entities have stable UUIDs. Locale heads track independent EN/BN drafts and published pointers. A save is append-only and requires `expectedVersion`; a publish atomically advances only one locale's pointer. Published route collisions are prevented by a partial unique index. Reserved slugs cannot publish. A separate publication-events table records changes to public pointers.
2. **Typed, bounded blocks.** Six useful blocks ship in C06: hero, introduction, feature grid, rich text as plain paragraph nodes, FAQ, contact invitation. Ten additional V5 block families are registered as **reserved/unavailable** until Projects, books, courses, metrics, journals, Academy or other domain models exist. Unsupported blocks cannot save or render. Zod validates the application path; PostgreSQL independently rejects unsafe JSON through directly called RPCs. No HTML, JavaScript, CSS, editable financial values, or arbitrary entity IDs in editorial content.
3. **Server-authoritative public projection.** Private tables have RLS and no public/customer grants. An explicit `SECURITY DEFINER` function returns only approved fields of a published locale. Next server code parses the returned shape again and fails closed for unknown schema versions. `/[locale]/research-notes/[slug]` demonstrates real rendering without replacing the accepted homepage. Public reads do not cache; C07/C08 will add durable invalidation/outbox and editorial UI.
4. **Private Storage with server-only privileged adapter.** Only one private bucket (`iojh-cms-media`) is created. No `storage.objects` policies permit direct browser upload/download. A protected Next route validates a small image before uploading via a **server-only service-role/secret key**; a separate user-session RPC (not the service role) registers verified AAL2 media metadata. Private access rechecks admin authorization; public access checks current published usage and public rights before streaming from the private bucket. The secret must be inserted only into private `.env.local` and never logged or bundled.
5. **Immutable media objects and version series.** Storage keys are random and never overwritten. Each media version has its own UUID plus a shared `series_id`. Revision-to-media links are retained forever, including older revisions; retirement is blocked while any retained revision references an asset. Storage objects are not automatically deleted after retirement; owner-reviewed reconciliation is safer than destructive cleanup under concurrency.
6. **Free-plan compatible image serving.** Originals up to 4 MiB (PNG/JPEG/WebP) are served through no-store authenticated/public proxy routes, without depending on paid Supabase image transformations. SVG, animated WebP, EXIF-bearing JPEG segments, custom styles and arbitrary files are refused. CSS constrains rendering sizes; actual width and height come from validated metadata. The pipeline does not claim full virus scanning or a content-disarm/re-encoding guarantee.
7. **Minimal admin UI, not premature C08.** `/admin/media` is a small focused AAL2 asset desk with rights/alt text, version replacement and safe retirement. C06 exposes narrowly validated API primitives for content entity/revision creation. Full editing, side-by-side review, preview and rollback stay in C08.

## Trade-offs and boundaries

- A server-only storage service key increases the impact of a server compromise. It is never sent to browsers; no browser Storage write policies are granted. Deploy only on an environment with secure server-side secrets and isolate the key to this project.
- Every published page read is dynamic and uncached, prioritizing immediate unpublish safety over maximum scale. Outbox-based invalidation is a later C07/C08 contract.
- An interrupted upload can produce an orphan. The route attempts immediate cleanup on registration failure; read-only orphan-inventory SQL is provided. No unattended destructive job exists until C07.
- Images are signature-, structure-, MIME-, dimension- and size-checked, but no full malware/CDR pipeline is claimed. Keep permissions documented and use trusted artwork.

## Current references consulted (18 November 2026)

- Next.js Data Security: https://nextjs.org/docs/app/guides/data-security
- Next.js Authentication: https://nextjs.org/docs/app/guides/authentication
- Next.js dynamic connection: https://nextjs.org/docs/app/api-reference/functions/connection
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database functions: https://supabase.com/docs/guides/database/functions
- Supabase Storage access: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage bucket limits: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Storage schema: https://supabase.com/docs/guides/storage/schema/design
- Supabase Auth SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase CI tests: https://supabase.com/docs/guides/deployment/ci/testing
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

These sources informed implementation. They do not constitute a successful local TypeScript build, hosted database verification, or browser test.
