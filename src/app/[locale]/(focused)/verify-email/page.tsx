import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAuthCopy } from "@/features/auth/copy";
import { AuthShell } from "@/features/auth/ui/auth-shell";
import styles from "@/features/auth/ui/auth.module.css";

export const metadata: Metadata = { title: "Verify email — IOJH", robots: { index: false, follow: false } };
export default async function VerifyEmail({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getAuthCopy(locale);
  return <AuthShell locale={locale} title={t.verifyTitle} intro={t.verifyIntro}>
    <div className={styles.messagePanel}><Link href="/sign-in">{t.verifyBack}</Link></div>
  </AuthShell>;
}
