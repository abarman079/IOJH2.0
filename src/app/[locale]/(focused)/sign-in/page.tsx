import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getAuthCopy } from "@/features/auth/copy";
import { AuthShell } from "@/features/auth/ui/auth-shell";
import { AuthForm } from "@/features/auth/ui/auth-form";
import { safeAccountReturn } from "@/features/auth/safe-return.mjs";
import { isAuthReady } from "@/features/auth/config";
import styles from "@/features/auth/ui/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — IOJH", robots: { index: false, follow: false } };
export default async function SignIn({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  const query = await searchParams;
  const t = getAuthCopy(locale);
  return <AuthShell locale={locale} title={t.signInTitle} intro={t.signInIntro}>
    {query.error && <p role="alert" className={`${styles.feedback} ${styles.error}`}>{t.callbackError}</p>}
    {!isAuthReady() && <p className={`${styles.feedback} ${styles.error}`}>{t.notConfigured}</p>}
    <AuthForm locale={locale} mode="sign-in" next={safeAccountReturn(query.next, locale)} />
  </AuthShell>;
}
