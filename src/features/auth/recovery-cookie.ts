import "server-only";
import { cookies } from "next/headers";
import { createRecoveryToken, validRecoveryToken } from "@/features/auth/recovery-token.mjs";

export const RECOVERY_COOKIE = "iojh_recovery_proof";
const COOKIE_MAX_AGE = 600;
function secret() { return process.env.IOJH_AUTH_RECOVERY_SECRET ?? ""; }
export function isRecoveryReady() { return secret().length >= 32; }
export function recoveryCookieForUser(userId: string) {
  return { name: RECOVERY_COOKIE, value: createRecoveryToken(userId, secret()), options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: COOKIE_MAX_AGE, path: "/" } };
}
export async function hasRecoveryProof(userId: string) {
  const cookieStore = await cookies();
  return validRecoveryToken(cookieStore.get(RECOVERY_COOKIE)?.value, userId, secret());
}
export async function clearRecoveryProof() {
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
}
