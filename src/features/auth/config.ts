/** Public configuration only. A missing project deliberately disables authentication. */
export function getPublicAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!url || !key || key.startsWith("sb_secret_")) return null;
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") return null;
    if (endpoint.username || endpoint.password) return null;
  } catch { return null; }
  return { url, key };
}

/** Never derive email link destinations from untrusted Host headers. */
export function getSiteOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function isAuthReady() {
  return Boolean(getPublicAuthConfig() && getSiteOrigin());
}
