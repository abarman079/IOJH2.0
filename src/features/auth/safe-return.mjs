/** Accept only local, locale-matching account paths; no absolute/scheme-relative URLs. */
export function safeAccountReturn(raw, locale) {
  const fallback = `/${locale === 'bn' ? 'bn' : 'en'}/account`;
  if (typeof raw !== 'string' || raw.length > 180 || raw.includes('\\') || raw.includes('%') || raw.includes('?') || raw.includes('#')) return fallback;
  if (!new RegExp(`^/${locale === 'bn' ? 'bn' : 'en'}/account(?:/[a-z0-9-]+)*$`).test(raw)) return fallback;
  return raw;
}

export function validLocale(value) {
  return value === 'bn' ? 'bn' : 'en';
}
