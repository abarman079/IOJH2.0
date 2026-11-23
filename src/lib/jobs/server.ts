import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAuthConfig } from '@/features/auth/config';
import { claimedJobSchema, claimedJobBaseSchema, probePayloadSchema, runnerOptionsSchema } from './contracts';
import type { ClaimedJob, RunnerOptions, LeaseIdentity, FailureCode, RecoverReason } from './contracts';
import { validDeduplicationKey } from './policy.mjs';

/**
 * Backend-only operations for future C07b/C07c. Do NOT invoke them from a
 * browser, ordinary Server Action, or customer/admin API endpoint.
 * Domain mutation + outbox must occur inside one database function/transaction;
 * invoking enqueueProbe *after* a separate domain write is NOT atomic.
 */
class JobInfrastructureError extends Error {
  constructor() { super('Job infrastructure unavailable or rejected the operation'); this.name = 'JobInfrastructureError'; }
}

function serviceClient() {
  const config = getPublicAuthConfig();
  const key = process.env.IOJH_JOBS_SERVICE_KEY?.trim();
  if (!config || !key || key.length < 40 || key === config.key) throw new JobInfrastructureError();
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A harmless versioned test event only; no email, payments, or external effects. */
export async function enqueueOperationalProbe(input: {
  correlationId: string; dedupeKey: string; dueAt?: string; maxAttempts?: number;
}): Promise<string> {
  const payload = probePayloadSchema.parse({ correlationId: input.correlationId });
  if (!validDeduplicationKey(input.dedupeKey)) throw new TypeError('Invalid deduplication key');
  if (input.maxAttempts !== undefined && (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 10)) throw new TypeError('Invalid retry limit');
  if (input.dueAt !== undefined && !z.iso.datetime({ offset: true }).safeParse(input.dueAt).success) throw new TypeError('Invalid ISO due time');
  const { data, error } = await serviceClient().rpc('iojh_jobs_enqueue_probe', {
    p_correlation_id: payload.correlationId, p_dedupe_key: input.dedupeKey,
    p_due_at: input.dueAt ?? null, p_max_attempts: input.maxAttempts ?? 5,
  });
  if (error || typeof data !== 'string') throw new JobInfrastructureError();
  return data;
}

export async function claimDueJobs(options: RunnerOptions): Promise<ClaimedJob[]> {
  const input = runnerOptionsSchema.parse(options);
  const { data, error } = await serviceClient().rpc('iojh_jobs_claim', {
    p_worker: input.workerId, p_limit: input.limit, p_lease_seconds: input.leaseSeconds,
  });
  if (error || !Array.isArray(data)) throw new JobInfrastructureError();
  // Fail closed if the database contains a job type/version with no supported handler.
  // C07c must introduce a versioned handler BEFORE enabling new kinds.
  return data.map((row: unknown) => claimedJobSchema.parse(row));
}

export async function completeLease(lease: LeaseIdentity): Promise<boolean> {
  const identity = claimedJobBaseSchema.pick({ jobId: true, leaseToken: true, leaseGeneration: true }).parse(lease);
  const { data, error } = await serviceClient().rpc('iojh_jobs_complete', {
    p_job: identity.jobId, p_token: identity.leaseToken, p_generation: identity.leaseGeneration,
  });
  if (error || typeof data !== 'boolean') throw new JobInfrastructureError();
  return data;
}

export async function renewLease(lease: LeaseIdentity, seconds = 60): Promise<string | null> {
  const identity = claimedJobBaseSchema.pick({ jobId: true, leaseToken: true, leaseGeneration: true }).parse(lease);
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 300) throw new TypeError('Invalid lease duration');
  const { data, error } = await serviceClient().rpc('iojh_jobs_renew', {
    p_job: identity.jobId, p_token: identity.leaseToken, p_generation: identity.leaseGeneration, p_seconds: seconds,
  });
  if (error || (data !== null && typeof data !== 'string')) throw new JobInfrastructureError();
  return data;
}

export async function failLease(lease: LeaseIdentity, code: FailureCode, permanent = false): Promise<'stale' | 'retry' | 'dead'> {
  const identity = claimedJobBaseSchema.pick({ jobId: true, leaseToken: true, leaseGeneration: true }).parse(lease);
  if (!(['provider_unavailable', 'rate_limited', 'timeout', 'invalid_reference', 'handler_missing', 'internal_error'] as string[]).includes(code)) throw new TypeError('Unsupported error code');
  const { data, error } = await serviceClient().rpc('iojh_jobs_fail', {
    p_job: identity.jobId, p_token: identity.leaseToken, p_generation: identity.leaseGeneration,
    p_error_code: code, p_permanent: permanent,
  });
  if (error || !['stale', 'retry', 'dead'].includes(data as string)) throw new JobInfrastructureError();
  return data as 'stale' | 'retry' | 'dead';
}

/** Backend-only audited recovery contract; an operator UI belongs in C07b. */
export async function requeueReviewedDeadJob(jobId: string, reason: RecoverReason): Promise<boolean> {
  const id = probePayloadSchema.shape.correlationId.parse(jobId);
  if (!['operator_reviewed', 'provider_recovered', 'incident_recovery'].includes(reason)) throw new TypeError('Invalid recovery reason');
  const { data, error } = await serviceClient().rpc('iojh_jobs_retry_dead', { p_job: id, p_reason_code: reason });
  if (error || typeof data !== 'boolean') throw new JobInfrastructureError();
  return data;
}
