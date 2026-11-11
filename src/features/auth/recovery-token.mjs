import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A short-lived recovery proof is bound to an Auth user's ID AND revision. */
const LIFE_SECONDS = 600;
const MAX_SKEW_SECONDS = 30;
const USER_ID_PATTERN = /^[a-zA-Z0-9-]{30,60}$/;
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]+$/;

function authRevisionTag(updatedAt) {
  if (typeof updatedAt !== 'string' || updatedAt.length < 15 || updatedAt.length > 80 ||
      !Number.isFinite(Date.parse(updatedAt))) return null;
  // Store no Auth user metadata in the browser cookie. A changed Auth updated_at
  // invalidates even a copied proof after a completed password reset.
  return createHash('sha256').update(updatedAt).digest('base64url').slice(0, 24);
}

function sign(payload, key) {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

export function createRecoveryToken(userId, authUpdatedAt, key, now = Date.now()) {
  const revision = authRevisionTag(authUpdatedAt);
  if (typeof key !== 'string' || key.length < 32 ||
      !USER_ID_PATTERN.test(userId) || !revision || !Number.isFinite(now)) {
    throw new Error('Invalid recovery configuration');
  }
  const seconds = Math.floor(now / 1000);
  const payload = `v2.${userId}.${seconds}.${revision}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload, key)}`;
}

export function validRecoveryToken(token, userId, authUpdatedAt, key, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 256 ||
      typeof key !== 'string' || key.length < 32 || !Number.isFinite(now)) return false;
  const revision = authRevisionTag(authUpdatedAt);
  if (!revision || !USER_ID_PATTERN.test(userId)) return false;
  const parts = token.split('.');
  if (parts.length !== 6 || parts[0] !== 'v2' || parts[1] !== userId ||
      !/^\d{10,12}$/.test(parts[2]) || parts[3] !== revision ||
      parts[4].length !== 22 || !TOKEN_PART_PATTERN.test(parts[4]) ||
      parts[5].length !== 43 || !TOKEN_PART_PATTERN.test(parts[5])) return false;
  const age = Math.floor(now / 1000) - Number(parts[2]);
  if (!Number.isSafeInteger(age) || age < -MAX_SKEW_SECONDS || age > LIFE_SECONDS) return false;
  const expected = Buffer.from(sign(parts.slice(0, 5).join('.'), key));
  const actual = Buffer.from(parts[5]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
