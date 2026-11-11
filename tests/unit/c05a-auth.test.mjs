import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeAccountReturn, validLocale } from '../../src/features/auth/safe-return.mjs';
import { createRecoveryToken, validRecoveryToken } from '../../src/features/auth/recovery-token.mjs';

test('C05a safe account return permits only locale-owned account paths', () => {
  assert.equal(safeAccountReturn('/en/account', 'en'), '/en/account');
  assert.equal(safeAccountReturn('/bn/account/learning', 'bn'), '/bn/account/learning');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', '/en/auth/callback', '/admin', '/bn/account', '/en/account?next=https://evil.test', '/en/account/%2fadmin', '/en/account#test', '/en/account/../admin']) {
    assert.equal(safeAccountReturn(bad, 'en'), '/en/account', `Rejected: ${bad}`);
  }
});
test('C05a locale normalization never permits arbitrary locale paths', () => {
  assert.equal(validLocale('bn'), 'bn');
  assert.equal(validLocale('en'), 'en');
  assert.equal(validLocale('xx'), 'en');
});

const KEY = 'test-only-secret-1234567890-really-long';
const USER = 'd6b47694-3943-4591-8fe5-c92982000011';
const OTHER_USER = 'fa851386-3943-4591-8fe5-c92982000011';
const REVISION = '2026-11-05T04:00:00.000Z';
const CHANGED_REVISION = '2026-11-05T04:01:00.000Z';

test('C05a proof is only issued for a valid Auth revision and configuration', () => {
  assert.throws(() => createRecoveryToken(USER, '', KEY), /Invalid recovery configuration/);
  assert.throws(() => createRecoveryToken(USER, REVISION, 'short'), /Invalid recovery configuration/);
  assert.throws(() => createRecoveryToken('not-an-auth-user', REVISION, KEY), /Invalid recovery configuration/);
  assert.notEqual(createRecoveryToken(USER, REVISION, KEY), createRecoveryToken(USER, REVISION, KEY), 'random nonces differ');
});

test('C05a direct access and ordinary login without recovery proof are denied', () => {
  assert.equal(validRecoveryToken(undefined, USER, REVISION, KEY), false);
  assert.equal(validRecoveryToken('', USER, REVISION, KEY), false);
  assert.equal(validRecoveryToken('ordinary-auth-session', USER, REVISION, KEY), false);
  assert.equal(validRecoveryToken('v1.' + USER + '.0.example.sig', USER, REVISION, KEY), false);
});

test('C05a recovery proof is user-scoped, revision-bound and time-limited', () => {
  const now = Date.now();
  const token = createRecoveryToken(USER, REVISION, KEY, now);
  assert.equal(validRecoveryToken(token, USER, REVISION, KEY, now + 5000), true);
  assert.equal(validRecoveryToken(token, OTHER_USER, REVISION, KEY, now), false);
  assert.equal(validRecoveryToken(token, USER, REVISION, KEY, now + 700000), false);
  assert.equal(validRecoveryToken(token, USER, REVISION, KEY, now - 40000), false);
});

test('C05a consumed password recovery proof is rejected after Auth record changes', () => {
  const now = Date.now();
  const originalProof = createRecoveryToken(USER, REVISION, KEY, now);
  assert.equal(validRecoveryToken(originalProof, USER, REVISION, KEY, now), true);
  // Supabase Auth updates user.updated_at when a password is changed.
  // The cookie is cleared on success, and a copied old cookie fails after the revision changes.
  assert.equal(validRecoveryToken(originalProof, USER, CHANGED_REVISION, KEY, now + 1000), false);
  assert.equal(validRecoveryToken(undefined, USER, CHANGED_REVISION, KEY, now + 1000), false);
});

test('C05a tampered, malformed, wrong-key and stale proofs are denied', () => {
  const now = Date.now();
  const token = createRecoveryToken(USER, REVISION, KEY, now);
  const corrupted = token.slice(0, -5) + 'aaaaa';
  for (const value of [corrupted, token + '.', token.replace(/^v2\./, 'v3.'), token.slice(0, 45), 'x'.repeat(300)]) {
    assert.equal(validRecoveryToken(value, USER, REVISION, KEY, now), false);
  }
  assert.equal(validRecoveryToken(token, USER, REVISION, 'wrong-key-longer-than-thirty-two-characters', now), false);
  assert.equal(validRecoveryToken(token, USER, 'not-a-valid-date', KEY, now), false);
  assert.equal(validRecoveryToken(token, USER, REVISION, '', now), false);
});

// Success display must be derived from a server-signed, short-lived notice,
// never from a visitor-controlled query string or cookie value.
import { createResetNotice, readResetNotice } from '../../src/features/auth/reset-notice.mjs';

test('C05a post-reset success notice is signed, locale-scoped and short-lived', () => {
  const now = Date.now();
  const notice = createResetNotice('en', 'changed', KEY, now);
  assert.equal(readResetNotice(notice, 'en', KEY, now + 1000), 'changed');
  assert.equal(readResetNotice(notice, 'bn', KEY, now), null);
  assert.equal(readResetNotice(notice, 'en', KEY, now + 121000), null);
  assert.equal(readResetNotice(notice, 'en', KEY, now - 40000), null);
});

test('C05a cleanup warning is distinguishable from a successful sign-out', () => {
  const notice = createResetNotice('bn', 'cleanup_unconfirmed', KEY);
  assert.equal(readResetNotice(notice, 'bn', KEY), 'cleanup_unconfirmed');
});

test('C05a forged reset success messages are not accepted', () => {
  const now = Date.now();
  const token = createResetNotice('en', 'changed', KEY, now);
  assert.equal(readResetNotice(undefined, 'en', KEY, now), null);
  assert.equal(readResetNotice('changed', 'en', KEY, now), null);
  assert.equal(readResetNotice(token, 'en', 'some-different-secret-of-sufficient-length', now), null);
  assert.equal(readResetNotice(token.replace('.changed.', '.cleanup_unconfirmed.'), 'en', KEY, now), null);
  assert.equal(readResetNotice(token + '.extra', 'en', KEY, now), null);
  assert.throws(() => createResetNotice('en', 'changed', 'short'), /Invalid reset notice configuration/);
});
