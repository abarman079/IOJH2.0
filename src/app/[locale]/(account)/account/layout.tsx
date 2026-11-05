import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validLocale } from "@/features/auth/safe-return.mjs";

export const dynamic = "force-dynamic";
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = validLocale(requestedLocale);
  const client = await createServerSupabaseClient();
  if (!client) redirect(`/${locale}/sign-in`);
  const { data, error } = await client.auth.getUser().catch(() => ({ data: { user: null }, error: new Error("auth_unavailable") }));
  if (error || !data.user?.email_confirmed_at) redirect(`/${locale}/sign-in?next=/${locale}/account`);
  return <main id="main-content" className="focused-shell">{children}</main>;
}
