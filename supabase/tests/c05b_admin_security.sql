-- Run ONLY on disposable local Supabase/Postgres test database after migration.
-- Requires Supabase auth schema functions; no real owner records are touched.
BEGIN;
DO $$ BEGIN
  IF to_regclass('private.admin_memberships') IS NULL THEN
    RAISE EXCEPTION 'C05b migration is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='private'
    AND indexname='admin_one_active_membership') THEN
    RAISE EXCEPTION 'single active admin index missing';
  END IF;
  IF has_table_privilege('authenticated','private.admin_memberships','SELECT') OR
     has_table_privilege('authenticated','private.admin_memberships','INSERT') OR
     has_table_privilege('authenticated','private.admin_memberships','UPDATE') OR
     has_table_privilege('authenticated','private.admin_memberships','DELETE') THEN
    RAISE EXCEPTION 'authenticated role can access protected membership table';
  END IF;
  IF has_function_privilege('anon','public.iojh_admin_aal2()','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous users can execute privileged check';
  END IF;
  IF NOT has_function_privilege('authenticated','public.iojh_admin_aal2()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated user cannot execute privileged check';
  END IF;
END $$;
-- Synthetic scoped JWT: membership does not exist => fail closed at AAL1 and AAL2.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000123',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000123","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.iojh_admin_membership_active() OR public.iojh_admin_aal2() THEN
    RAISE EXCEPTION 'ordinary customer incorrectly authorized';
  END IF;
END $$;
ROLLBACK;
