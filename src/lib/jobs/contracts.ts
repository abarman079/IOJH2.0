import { z } from 'zod';
import { validDeduplicationKey, validWorkerId } from './policy.mjs';

export const probePayloadSchema = z.object({ correlationId: z.uuid() }).strict();
export type ProbePayload = z.infer<typeof probePayloadSchema>;

/** C07b reference-only notification job payload; no email bodies or addresses. */
export const notificationReferenceSchema = z.object({
  notificationId: z.uuid(), locale: z.enum(['en','bn']),
  templateVersion: z.number().int().min(1).max(1000),
}).strict();
export type NotificationReference = z.infer<typeof notificationReferenceSchema>;

export const claimedJobBaseSchema = z.object({
  jobId: z.uuid(),
  eventId: z.uuid(),
  dedupeKey: z.string().refine(validDeduplicationKey),
  attempt: z.number().int().min(1).max(10),
  maxAttempts: z.number().int().min(1).max(10),
  retryCycle: z.number().int().nonnegative(),
  leaseGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  leaseToken: z.uuid(),
  leaseExpiresAt: z.iso.datetime({ offset: true }),
}).strict();
export const claimedJobSchema = z.discriminatedUnion('kind', [
  claimedJobBaseSchema.extend({kind:z.literal('ops.probe'),payloadVersion:z.literal(1),payload:probePayloadSchema}).strict(),
  claimedJobBaseSchema.extend({kind:z.literal('notification.email'),payloadVersion:z.literal(1),payload:notificationReferenceSchema}).strict(),
]);
export type ClaimedJob = z.infer<typeof claimedJobSchema>;

export const runnerOptionsSchema = z.object({
  workerId: z.string().refine(validWorkerId),
  limit: z.number().int().min(1).max(20).default(5),
  leaseSeconds: z.number().int().min(15).max(300).default(60),
}).strict();
export type RunnerOptions = z.input<typeof runnerOptionsSchema>;

export type LeaseIdentity = Pick<ClaimedJob, 'jobId' | 'leaseToken' | 'leaseGeneration'>;
export const failureCodes = ['provider_unavailable', 'rate_limited', 'timeout', 'invalid_reference', 'handler_missing', 'internal_error'] as const;
export type FailureCode = typeof failureCodes[number];
export type RecoverReason = 'operator_reviewed' | 'provider_recovered' | 'incident_recovery';
