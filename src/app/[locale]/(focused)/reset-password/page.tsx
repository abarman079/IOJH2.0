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
export const metadata: Metadata = {
  title: "Password recovery — IOJH",
  robots: { index: false, follow: false },
};

export default async function ResetPassword({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getAuthCopy(locale);
  const ready = isAuthReady();
  const client = ready ? await createServerSupabaseClient() : null;
  const { data } = client
    ? await client.auth.getUser().catch(() => ({ data: { user: null } }))
    : { data: { user: null } };
  const user = data.user;
  // A normal signed-in user is NOT automatically authorized to reset a password.
  const authorized = Boolean(ready && user?.updated_at &&
    await hasRecoveryProof(user.id, user.updated_at));
  const title = !ready ? t.resetDisabledTitle : authorized ? t.resetTitle : t.resetDeniedTitle;
  const intro = !ready ? t.resetDisabledIntro : authorized ? t.resetIntro : t.resetDeniedIntro;

  return <AuthShell locale={locale} title={title} intro={intro}>
    {authorized ? <AuthForm locale={locale} mode="reset" /> :
      <div className={styles.messagePanel} role="status">
        <p>{!ready ? t.notConfigured : t.recoveryNeeded}</p>
        <Link href="/forgot-password">{t.requestNewRecovery}</Link>
      </div>}
  </AuthShell>;
}
