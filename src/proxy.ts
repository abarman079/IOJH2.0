import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { getPublicAuthConfig } from "./features/auth/config";

const intl = createMiddleware(routing);
const authPaths = /^\/(?:en|bn)\/(?:account(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$)|verify-email(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|auth(?:\/|$))/;

/** Single Next.js 16 proxy: preserve next-intl behavior, refresh only auth routes. */
export default async function proxy(request: NextRequest) {
  const config = getPublicAuthConfig();
  const writes: Array<(response: NextResponse) => void> = [];
  if (config && authPaths.test(request.nextUrl.pathname)) {
    const client = createServerClient(config.url, config.key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            writes.push((response) => response.cookies.set(name, value, options));
          });
        },
      },
    });
    try {
      // Refresh session cookies. Authorization is independently checked server-side.
      await client.auth.getClaims();
    } catch {
      // Supabase outage must fail closed in protected page/server action, not in i18n.
    }
  }
  const response = intl(request);
  writes.forEach((apply) => apply(response));
  if (authPaths.test(request.nextUrl.pathname)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: "/((?!api|admin|_next|_vercel|.*\\..*).*)" };
