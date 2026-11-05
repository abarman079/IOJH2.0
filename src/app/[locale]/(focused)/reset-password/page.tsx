import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAuthCopy } from "@/features/auth/copy";
import { isAuthReady } from "@/features/auth/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRecoveryProof } from "@/features/auth/recovery-cookie";
import { AuthShell } from "@/features/auth/ui/auth-shell";
import { AuthForm } from "@/features/auth/ui/auth-form";
import styles from "@/features/auth/ui/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set a new password — IOJH", robots: { index: false, follow: false } };
export default async function ResetPassword({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getAuthCopy(locale);
  const client = await createServerSupabaseClient();
  const { data } = client ? await client.auth.getUser().catch(() => ({ data: { user: null } })) : { data: { user: null } };
  const validProof = data.user ? await hasRecoveryProof(data.user.id) : false;
  return <AuthShell locale={locale} title={t.resetTitle} intro={t.resetIntro}>
    {!isAuthReady() || !data.user || !validProof ? <div className={styles.messagePanel}><p>{!isAuthReady() ? t.notConfigured : t.recoveryNeeded}</p><Link href="/forgot-password">{t.forgotLink}</Link></div> : <AuthForm locale={locale} mode="reset" />}
  </AuthShell>;
}
