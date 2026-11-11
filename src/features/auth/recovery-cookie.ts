import "server-only";
import { cookies } from "next/headers";
import { createRecoveryToken, validRecoveryToken } from "@/features/auth/recovery-token.mjs";

export const RECOVERY_COOKIE = "iojh_recovery_proof";
const COOKIE_MAX_AGE = 600;
function secret() { return process.env.IOJH_AUTH_RECOVERY_SECRET ?? ""; }
export function isRecoveryReady() { return secret().length >= 32; }
/** Issue only after the provider has verified a recovery OTP and returned the fresh user. */
export function recoveryCookieForUser(userId: string, authUpdatedAt: string) {
  return { name: RECOVERY_COOKIE, value: createRecoveryToken(userId, authUpdatedAt, secret()), options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: COOKIE_MAX_AGE, path: "/" } };
}
/** Called again from password-changing Server Action; a login by itself is insufficient. */
export async function hasRecoveryProof(userId: string, authUpdatedAt: string) {
  const cookieStore = await cookies();
  return validRecoveryToken(cookieStore.get(RECOVERY_COOKIE)?.value, userId, authUpdatedAt, secret());
}
export async function clearRecoveryProof() {
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
}
