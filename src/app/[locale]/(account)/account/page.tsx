import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";
import { getAuthCopy } from "@/features/auth/copy";
import { AuthShell } from "@/features/auth/ui/auth-shell";
import styles from "@/features/auth/ui/auth.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account — IOJH", robots: { index: false, follow: false } };
export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getAuthCopy(locale);
  // The parent layout has already denied non-verified users; re-read independently.
  const client = await createServerSupabaseClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  if (!data.user?.email_confirmed_at) redirect(`/${locale}/sign-in`);
  return <AuthShell locale={locale} title={t.accountTitle} intro={t.accountBody}>
    <div className={styles.accountCard}>
      <span className={styles.accountVerified}>{t.verified}</span>
      <h2>{t.accountLabel}</h2>
      <p>{data.user?.email ?? "—"}</p>
      <p>{t.inactive}: Academy, book orders, mentorship.</p>
      <form action={signOutAction}><input type="hidden" name="locale" value={locale}/><button className={styles.signOut} type="submit">{t.signOut}</button></form>
    </div>
    <Link href="/" className="text-link">{t.back}</Link>
  </AuthShell>;
}
