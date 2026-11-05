"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicAuthConfig } from "@/features/auth/config";

/** Optional browser client for later account features; C05a forms use server actions. */
export function createBrowserSupabaseClient() {
  const config = getPublicAuthConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key);
}
