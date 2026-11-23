import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBE_KIND, PROBE_VERSION, validProbePayload, validDeduplicationKey, validErrorCode, validWorkerId, retryDelayBounds, validNotificationReference } from '../../src/lib/jobs/policy.mjs';

test('C07a accepts only the versioned reference-only probe contract', () => {
  assert.equal(PROBE_KIND,'ops.probe'); assert.equal(PROBE_VERSION,1);
  assert.equal(validProbePayload({correlationId:'a7000000-0000-4000-8000-000000000001'}),true);
  for (const bad of [{}, {correlationId:'not-uuid'}, {correlationId:'a7000000-0000-4000-8000-000000000001',personalEmail:'private@example.test'}, null, []]) assert.equal(validProbePayload(bad),false);
});
test('C07a keys are stable, bounded, and safe', () => {
  assert.equal(validDeduplicationKey('c07_probe_0001'),true);
  for(const bad of ['a', 'A_PROBE_000001','../../../secret','client@example.com','has space here','x'.repeat(129)]) assert.equal(validDeduplicationKey(bad),false);
});
test('C07a error codes cannot become raw provider errors or secrets', () => {
  assert.equal(validErrorCode('provider_unavailable'),true);
  for (const bad of ['SMTP 401: password=secret','a'.repeat(49),'Token X','invalid-code','']) assert.equal(validErrorCode(bad),false);
});
test('C07a worker identifiers are bounded and allow safe deployment labels', () => {
  assert.equal(validWorkerId('c07-worker-01'),true);
  for (const bad of ['w',' spaces','a'.repeat(81),'../runner']) assert.equal(validWorkerId(bad),false);
});
test('C07a retry backoff is bounded and never unbounded exponential', () => {
  assert.deepEqual(retryDelayBounds(1),[8,12]);
  assert.deepEqual(retryDelayBounds(2),[16,24]);
  const [low,high]=retryDelayBounds(200); assert.ok(low>=1&&high<=3600);
  assert.throws(()=>retryDelayBounds(0));assert.throws(()=>retryDelayBounds(1.4));
});

test('C07a future notification references are localized, versioned and contain no message body', () => {
  const id = 'a7000000-0000-4000-8000-000000000009';
  assert.equal(validNotificationReference({notificationId:id,locale:'en',templateVersion:1}),true);
  assert.equal(validNotificationReference({notificationId:id,locale:'bn',templateVersion:2}),true);
  for (const bad of [
    {notificationId:id,locale:'fr',templateVersion:1},
    {notificationId:id,locale:'en',templateVersion:0},
    {notificationId:id,locale:'bn',templateVersion:1001},
    {notificationId:id,locale:'en',templateVersion:1,html:'<script/>'},
    {notificationId:'invalid',locale:'en',templateVersion:1},
  ]) assert.equal(validNotificationReference(bad),false);
});
