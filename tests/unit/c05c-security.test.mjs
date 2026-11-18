import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202611150001_c05c_authz_hardening.sql');
const previousMigration = read('supabase/migrations/202611110001_c05b_admin_identity.sql');
const guard = read('src/features/admin/authorization.ts');
const proxy = read('src/proxy.ts');
const endpoint = read('src/app/api/admin/security-check/route.ts');
const localDb = read('supabase/tests/c05c_admin_security.sql');

test('C05b single-active membership database guarantee is preserved', () => {
  assert.match(previousMigration, /unique index[^;]*admin_one_active_membership[\s\S]*?where active/i);
  assert.doesNotMatch(migration, /drop\s+index[^;]*admin_one_active_membership/i);
  assert.doesNotMatch(migration, /drop\s+table[^;]*admin_memberships/i);
});

test('C05c DB helper checks JWT AAL2 AND current verified TOTP', () => {
  assert.match(migration, /create or replace function public\.iojh_admin_aal2\(\)/i);
  assert.match(migration, /auth\.jwt\(\)->>'aal'\)\s*=\s*'aal2'/i);
  assert.match(migration, /from auth\.mfa_factors/i);
  assert.match(migration, /factor\.factor_type::text\s*=\s*'totp'/i);
  assert.match(migration, /factor\.status::text\s*=\s*'verified'/i);
  assert.match(migration, /membership\.active is true/i);
});

test('C05c SECURITY DEFINER functions constrain search_path and execute grants', () => {
  assert.match(migration, /security definer\s+set search_path\s*=\s*''/i);
  assert.match(migration, /revoke all on function public\.iojh_admin_aal2\(\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.iojh_admin_aal2\(\) to authenticated/i);
  assert.match(migration, /revoke all on function private\.audit_admin_membership_change\(\) from public, anon, authenticated/i);
  assert.match(migration, /revoke all on schema private from public, anon, authenticated/i);
});

test('Audit records require reasons for all privileged membership transitions', () => {
  assert.match(migration, /current_setting\('iojh\.admin_change_reason',\s*true\)/i);
  assert.match(migration, /before insert or update or delete on private\.admin_memberships/i);
  assert.match(migration, /if tg_op = 'DELETE' then[\s\S]*raise exception/i);
  assert.match(migration, /private\.admin_audit_events\(event_type,subject_user_id,actor,note\)/i);
  assert.match(migration, /if change_reason is null or/i);
});

test('Server remains fail-closed with current identity, member, factor and privileged RPC', () => {
  for (const check of [
    'server-only', 'auth.getUser()', 'email_confirmed_at',
    'iojh_admin_membership_active', 'getAuthenticatorAssuranceLevel',
    "currentLevel !== 'aal2'", 'listFactors',
    "factor.status === 'verified'", 'iojh_admin_aal2'
  ]) assert.ok(guard.includes(check), `missing server guard: ${check}`);
  assert.match(guard, /catch\s*\{\s*return 'denied';\s*\}/);
});

test('Admin pages are protected independently from next-intl proxy and no-store caching', () => {
  assert.match(proxy, /adminAuth/);
  assert.match(proxy, /Cache-Control','private, no-store'/);
  assert.match(endpoint, /getAdminAccess/);
  assert.match(endpoint, /authorized\?200:state==='signed_out'\?401:403/);
  assert.match(endpoint, /'Cache-Control':'private, no-store'/);
});

test('Disposable pgTAP exercises actual grant and authorization states', () => {
  for (const caseLabel of [
    'ordinary customer is not an admin', 'password-only AAL1 admin is denied',
    'AAL2 claim without current verified factor is denied',
    'active membership plus AAL2 and verified TOTP is authorized',
    'revoked/removed TOTP factor invalidates stale AAL2 JWT',
    'revoked membership is immediately denied',
    'duplicate active grants remain impossible',
    'direct authenticated SQL mutation was rejected'
  ]) assert.ok(localDb.includes(caseLabel), `missing DB scenario: ${caseLabel}`);
  assert.match(localDb, /select plan\(30\)/i);
  assert.match(localDb, /rollback;/i);
});

test('C05c does not modify customer auth/theme/homepage or introduce secret configuration', () => {
  assert.doesNotMatch(migration, /alter\s+table\s+auth\.users/i);
  assert.doesNotMatch(migration, /service_role|NEXT_PUBLIC_|\benv\.local\b/i);
});
