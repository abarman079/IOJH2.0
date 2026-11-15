import 'server-only';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Never authorize from client metadata, an email allowlist or an unvalidated getSession object.
// All database RPCs here use only the user's own per-request Supabase session.
export type AdminAccess = 'signed_out' | 'denied' | 'mfa_required' | 'authorized';

export async function getAdminAccess(): Promise<AdminAccess> {
  const client = await createServerSupabaseClient();
  if (!client) return 'signed_out';
  try {
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || !identity.user || !identity.user.email_confirmed_at) return 'signed_out';
    const { data: member, error: membershipError } = await client.rpc('iojh_admin_membership_active');
    if (membershipError || member !== true) return 'denied';
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance) return 'denied';
    if (assurance.currentLevel !== 'aal2') return 'mfa_required';
    // Do not keep trusting an old AAL2 access token after the verified TOTP
    // factor has been removed or revoked. Only this app's TOTP path is supported.
    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError || !factors?.totp?.some((factor) => factor.status === 'verified')) return 'denied';
    const { data: privileged, error: privilegedError } = await client.rpc('iojh_admin_aal2');
    return !privilegedError && privileged === true ? 'authorized' : 'denied';
  } catch { return 'denied'; }
}

/** Reusable server gate for future C06+ Server Actions, Route Handlers and RSCs. */
export async function requireAdminAal2(): Promise<void> {
  const access = await getAdminAccess();
  if (access === 'signed_out') redirect('/admin/sign-in');
  if (access === 'mfa_required') redirect('/admin/mfa');
  if (access !== 'authorized') redirect('/admin/sign-in?error=denied');
}

/** Distinguish enrollment eligibility from actual admin authorization. */
export async function requireAdminMemberForMfa(): Promise<void> {
  const access = await getAdminAccess();
  if (access === 'signed_out') redirect('/admin/sign-in');
  if (access === 'denied') redirect('/admin/sign-in?error=denied');
  if (access === 'authorized') redirect('/admin');
}
