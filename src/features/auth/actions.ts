"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin, isAuthReady } from "@/features/auth/config";
import { newPasswordSchema, recoverSchema, signInSchema, signUpSchema } from "@/features/auth/validation";
import { safeAccountReturn, validLocale } from "@/features/auth/safe-return.mjs";
import { clearRecoveryProof, hasRecoveryProof, isRecoveryReady } from "@/features/auth/recovery-cookie";
import { setResetNotice } from "@/features/auth/reset-notice-cookie";

export type AuthErrorCode = "not_configured" | "validation" | "password_mismatch" |
  "credentials" | "verify_required" | "unavailable" | "rate_limit" | "reset_required";
export type AuthSuccessCode = "check_email" | "reset_sent" | "password_changed";
export type AuthState = { status: "idle" | "error" | "success"; code?: AuthErrorCode | AuthSuccessCode };


function emailOf(formData: FormData) {
  const raw = formData.get("email");
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}
function secretOf(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw : "";
}
function localeOf(formData: FormData) { return validLocale(formData.get("locale")); }
function invalidResult(error: { issues: { message: string }[] }): AuthState {
  return { status: "error", code: error.issues.some((issue) => issue.message === "password_mismatch") ? "password_mismatch" : "validation" };
}
function providerError(error: { status?: number } | null, fallback: AuthErrorCode = "unavailable"): AuthState {
  return { status: "error", code: error?.status === 429 ? "rate_limit" : fallback };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData);
  const parsed = signInSchema.safeParse({ email: emailOf(formData), password: secretOf(formData, "password") });
  if (!parsed.success) return invalidResult(parsed.error);
  if (!isAuthReady()) return { status: "error", code: "not_configured" };
  const client = await createServerSupabaseClient();
  if (!client) return { status: "error", code: "not_configured" };
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return providerError(error, "credentials");
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user) return { status: "error", code: "credentials" };
    if (!data.user.email_confirmed_at) {
      await client.auth.signOut();
      return { status: "error", code: "verify_required" };
    }
  } catch { return { status: "error", code: "unavailable" }; }
  redirect(safeAccountReturn(formData.get("next"), locale));
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData);
  const parsed = signUpSchema.safeParse({ email: emailOf(formData), password: secretOf(formData, "password"), confirmPassword: secretOf(formData, "confirmPassword") });
  if (!parsed.success) return invalidResult(parsed.error);
  const site = getSiteOrigin();
  if (!isAuthReady() || !site) return { status: "error", code: "not_configured" };
  const client = await createServerSupabaseClient();
  if (!client) return { status: "error", code: "not_configured" };
  try {
    const { error } = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: `${site}/${locale}/auth/confirm` } });
    if (error) return providerError(error);
    // We deliberately do not claim that an email was delivered or an account exists.
    return { status: "success", code: "check_email" };
  } catch { return { status: "error", code: "unavailable" }; }
}

export async function requestRecoveryAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData);
  const parsed = recoverSchema.safeParse({ email: emailOf(formData) });
  if (!parsed.success) return invalidResult(parsed.error);
  const site = getSiteOrigin();
  if (!isAuthReady() || !site || !isRecoveryReady()) return { status: "error", code: "not_configured" };
  const client = await createServerSupabaseClient();
  if (!client) return { status: "error", code: "not_configured" };
  try {
    const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${site}/${locale}/auth/confirm` });
    if (error?.status === 429) return providerError(error);
    // Neutral whether the address exists (except explicit rate-limit).
    return { status: "success", code: "reset_sent" };
  } catch { return { status: "error", code: "unavailable" }; }
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData);
  const parsed = newPasswordSchema.safeParse({ password: secretOf(formData, "password"), confirmPassword: secretOf(formData, "confirmPassword") });
  if (!parsed.success) return invalidResult(parsed.error);
  const client = await createServerSupabaseClient();
  if (!client || !isAuthReady()) return { status: "error", code: "not_configured" };

  // Keep mutation errors separate from cleanup errors. Once Supabase accepts the
  // password change, never tell the user that the password change failed.
  try {
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user?.updated_at ||
        !(await hasRecoveryProof(data.user.id, data.user.updated_at))) {
      return { status: "error", code: "reset_required" };
    }
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) return providerError(error);
  } catch {
    // The caller cannot determine whether the provider applied an ambiguous
    // network failure. Do not claim success without a provider confirmation.
    return { status: "error", code: "unavailable" };
  }

  let proofCleared = false;
  try {
    await clearRecoveryProof();
    proofCleared = true;
  } catch {
    // The Auth revision still guards future uses of the old proof. Preserve
    // an accurate cleanup warning rather than misreporting password failure.
  }

  let signedOut = false;
  try {
    const { error } = await client.auth.signOut({ scope: "global" });
    if (!error) signedOut = true;
  } catch {
    // Attempt a local sign-out if the provider-wide sign-out failed.
  }
  if (!signedOut) {
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      signedOut = !error;
    } catch {
      // Affected sessions must not be represented as safely signed out.
    }
  }

  // Redirect to a separate sign-in screen. Deleting the recovery cookie causes
  // Next.js to re-render /reset-password as "link not active" otherwise, even
  // after a successful password change. A short-lived signed notice avoids
  // allowing an arbitrary ?success=1 URL to fabricate success.
  try {
    await setResetNotice(locale, proofCleared && signedOut ? "changed" : "cleanup_unconfirmed");
  } catch {
    // Password is already changed; missing notice must not be reported as a
    // password-update error. Sign-in remains the safe destination.
  }
  redirect(`/${locale}/sign-in`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const client = await createServerSupabaseClient();
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("Could not sign out safely");
  }
  redirect(`/${locale}/sign-in`);
}
