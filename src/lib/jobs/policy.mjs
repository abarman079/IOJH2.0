// Pure deterministic contract helpers; no network or server credentials.
export const PROBE_KIND = 'ops.probe';
export const PROBE_VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEDUPE = /^[a-z0-9][a-z0-9:_-]{7,127}$/;
const ERROR = /^[a-z][a-z0-9_]{0,47}$/;
const WORKER = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,79}$/;

export function validProbePayload(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 1 && typeof value.correlationId === 'string' && UUID.test(value.correlationId);
}
export function validDeduplicationKey(value) { return typeof value === 'string' && DEDUPE.test(value); }
export function validErrorCode(value) { return typeof value === 'string' && ERROR.test(value); }
export function validWorkerId(value) { return typeof value === 'string' && WORKER.test(value); }
export function retryDelayBounds(attempt) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new TypeError('Invalid attempt');
  const base = Math.min(3600, 10 * 2 ** Math.min(attempt - 1, 8));
  return [Math.ceil(base * 0.8), Math.ceil(base * 1.2)];
}

// Reserved C07b contract ONLY. No SQL enqueue/worker handler is enabled yet.
export function validNotificationReference(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === 3 && typeof value.notificationId === 'string' &&
    UUID.test(value.notificationId) && (value.locale === 'en' || value.locale === 'bn') &&
    Number.isSafeInteger(value.templateVersion) && value.templateVersion >= 1 && value.templateVersion <= 1000;
}
