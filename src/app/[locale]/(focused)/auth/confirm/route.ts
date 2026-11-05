import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/features/auth/config";
import { validLocale } from "@/features/auth/safe-return.mjs";
import { isRecoveryReady, recoveryCookieForUser } from "@/features/auth/recovery-cookie";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = validLocale(requestedLocale);
  const site = getSiteOrigin();
  if (!site) return new NextResponse("Authentication is unavailable.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const q = request.nextUrl.searchParams;
  const token = q.get("token_hash");
  const type = q.get("type");
  const destination = type === "recovery" ? `/${locale}/reset-password` : `/${locale}/account`;
  if (type === "recovery" && !isRecoveryReady()) return new NextResponse("Recovery is not configured.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (token && token.length < 500 && (type === "email" || type === "signup" || type === "recovery")) {
    const client = await createServerSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.verifyOtp({ token_hash: token, type: type as EmailOtpType });
        if (!error) {
          const response = NextResponse.redirect(new URL(destination, site), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
          if (type === "recovery") {
            const { data } = await client.auth.getUser();
            if (!data.user) return NextResponse.redirect(new URL(`/${locale}/sign-in?error=invalid-link`, site), { status: 303 });
            const proof = recoveryCookieForUser(data.user.id);
            response.cookies.set(proof.name, proof.value, proof.options);
          }
          return response;
        }
      } catch { /* Safe uniform error below. */ }
    }
  }
  return NextResponse.redirect(new URL(`/${locale}/sign-in?error=invalid-link`, site), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
