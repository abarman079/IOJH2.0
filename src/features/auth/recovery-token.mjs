import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const LIFE_SECONDS = 600;
function sign(payload, key) { return createHmac('sha256', key).update(payload).digest('base64url'); }
export function createRecoveryToken(userId, key, now = Date.now()) {
  if (!key || key.length < 32 || !/^[a-zA-Z0-9-]{30,60}$/.test(userId)) throw new Error('Invalid recovery configuration');
  const payload = `${userId}.${Math.floor(now/1000)}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload, key)}`;
}
export function validRecoveryToken(token, userId, key, now = Date.now()) {
  if (typeof token !== 'string' || typeof key !== 'string' || key.length < 32 || token.length > 256) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== userId || !/^\d{10,12}$/.test(parts[1])) return false;
  const age = Math.floor(now / 1000) - Number(parts[1]);
  if (!Number.isSafeInteger(age) || age < -30 || age > LIFE_SECONDS) return false;
  const expected = Buffer.from(sign(parts.slice(0,3).join('.'), key));
  const actual = Buffer.from(parts[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
