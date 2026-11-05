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

test('C05a recovery marker is scoped, tamper-resistant and expires', () => {
  const key='test-only-secret-1234567890-really-long';
  const user='d6b47694-3943-4591-8fe5-c92982000011';
  const now=Date.now();
  const token=createRecoveryToken(user,key,now);
  assert.equal(validRecoveryToken(token,user,key,now+5000),true);
  assert.equal(validRecoveryToken(token,user,key,now+700000),false);
  assert.equal(validRecoveryToken(token,'fa851386-3943-4591-8fe5-c92982000011',key,now),false);
  assert.equal(validRecoveryToken(token.slice(0,-5)+'aaaaa',user,key,now),false);
  assert.equal(validRecoveryToken(token,user,'wrong-key-longer-than-thirty-two-characters',now),false);
});
