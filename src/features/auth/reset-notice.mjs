import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Short-lived, integrity-protected UI notice. Never grants access or permissions. */
const MAX_AGE_SECONDS = 120;
const FUTURE_SKEW_SECONDS = 30;
const VALID_STATES = new Set(['changed', 'cleanup_unconfirmed']);

function signature(body, secret) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createResetNotice(locale, state, secret, now = Date.now()) {
  if (!['en', 'bn'].includes(locale) || !VALID_STATES.has(state) ||
      typeof secret !== 'string' || secret.length < 32 || !Number.isFinite(now)) {
    throw new Error('Invalid reset notice configuration');
  }
  const body = `v1.${locale}.${state}.${Math.floor(now / 1000)}.${randomBytes(12).toString('base64url')}`;
  return `${body}.${signature(body, secret)}`;
}

export function readResetNotice(value, locale, secret, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 240 ||
      !['en', 'bn'].includes(locale) || typeof secret !== 'string' ||
      secret.length < 32 || !Number.isFinite(now)) return null;
  const parts = value.split('.');
  if (parts.length !== 6 || parts[0] !== 'v1' || parts[1] !== locale ||
      !VALID_STATES.has(parts[2]) || !/^\d{10,12}$/.test(parts[3]) ||
      !/^[A-Za-z0-9_-]{16}$/.test(parts[4]) ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[5])) return null;
  const age = Math.floor(now / 1000) - Number(parts[3]);
  if (!Number.isSafeInteger(age) || age < -FUTURE_SKEW_SECONDS || age > MAX_AGE_SECONDS) return null;
  const correct = Buffer.from(signature(parts.slice(0, 5).join('.'), secret));
  const given = Buffer.from(parts[5]);
  return correct.length === given.length && timingSafeEqual(correct, given) ? parts[2] : null;
}
