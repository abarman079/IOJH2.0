import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../../supabase/migrations/202611110001_c05b_admin_identity.sql',import.meta.url),'utf8');
const guard=readFileSync(new URL('../../src/features/admin/authorization.ts',import.meta.url),'utf8');
test('single active membership constraint is database enforced',()=>assert.match(migration,/unique index[\s\S]*admin_one_active_membership[\s\S]*where active/i));
test('protected membership tables have revoked direct access and RLS',()=>{
 for(const name of ['admin_memberships','admin_audit_events']){
  assert.match(migration,new RegExp(`alter table private\\.${name} enable row level security`));
  assert.match(migration,new RegExp(`revoke all on private\\.${name} from public, anon, authenticated`));
 }
});
test('admin RPCs require authentication and do not take a user-id argument',()=>{
 assert.match(migration,/revoke all on function public\.iojh_admin_aal2\(\) from public, anon, authenticated/);
 assert.match(migration,/grant execute on function public\.iojh_admin_aal2\(\) to authenticated/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/auth\.jwt\(\)->>'aal'\) = 'aal2'/);
});
test('protected route guard checks fresh user, membership and AAL2',()=>{
 for(const check of ['auth.getUser()','iojh_admin_membership_active','getAuthenticatorAssuranceLevel','currentLevel','listFactors','iojh_admin_aal2']) assert.ok(guard.includes(check),check);
});
