import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/features/auth/config";
import { safeAccountReturn, validLocale } from "@/features/auth/safe-return.mjs";

export const dynamic = "force-dynamic";
/** Supports code exchange if a provider uses PKCE callback instead of token hash. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: requestedLocale } = await params;
  const locale = validLocale(requestedLocale);
  const site = getSiteOrigin();
  if (!site) return new NextResponse("Authentication is unavailable.", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const code = request.nextUrl.searchParams.get("code");
  const next = safeAccountReturn(request.nextUrl.searchParams.get("next"), locale);
  if (code && code.length < 1500) {
    const client = await createServerSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(new URL(next, site), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
      } catch { /* Uniform failure. */ }
    }
  }
  return NextResponse.redirect(new URL(`/${locale}/sign-in?error=invalid-link`, site), { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
