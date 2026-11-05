import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicAuthConfig } from "@/features/auth/config";

/** Per-request client; never use a privileged/service-role key here. */
export async function createServerSupabaseClient() {
  const config = getPublicAuthConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The Next.js proxy refreshes
          // sessions before rendering; Server Actions/Route Handlers can write them.
        }
      },
    },
  });
}
