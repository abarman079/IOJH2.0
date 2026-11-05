import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getAuthCopy } from "@/features/auth/copy";
import { isAuthReady } from "@/features/auth/config";
import { AuthShell } from "@/features/auth/ui/auth-shell";
import { AuthForm } from "@/features/auth/ui/auth-form";
import styles from "@/features/auth/ui/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create an account — IOJH", robots: { index: false, follow: false } };
export default async function SignUp({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getAuthCopy(locale);
  return <AuthShell locale={locale} title={t.signUpTitle} intro={t.signUpIntro}>
    {!isAuthReady() && <p className={`${styles.feedback} ${styles.error}`}>{t.notConfigured}</p>}
    <AuthForm locale={locale} mode="sign-up" />
  </AuthShell>;
}
