// Pure, versioned C07b operational-email renderer. No user-supplied HTML, CSS or URLs.
export const TEMPLATE_ID = 'account_notice';
export const TEMPLATE_VERSION = 1;
export const TEMPLATE_LOCALES = Object.freeze(['en', 'bn']);
const REFERENCE = /^[A-Za-z0-9-]{8,40}$/;
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function validateTemplateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'locale,reference,templateId,templateVersion') {
    throw new TypeError('Unsupported template payload');
  }
  if (input.templateId !== TEMPLATE_ID || input.templateVersion !== TEMPLATE_VERSION ||
      !TEMPLATE_LOCALES.includes(input.locale) || typeof input.reference !== 'string' || !REFERENCE.test(input.reference)) {
    throw new TypeError('Unsupported or invalid template');
  }
  return input;
}
function safeOrigin(origin) {
  if (typeof origin !== 'string') throw new TypeError('Invalid email URL origin');
  const u = new URL(origin);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !(u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname)))) {
    throw new TypeError('Invalid email URL origin');
  }
  return u.origin;
}
export function renderNotification(input, siteOrigin) {
  const v = validateTemplateInput(input);
  const address = safeOrigin(siteOrigin);
  const link = `${address}/${v.locale}/account`;
  const bn = v.locale === 'bn';
  const title = bn ? 'IOJH অ্যাকাউন্টের বিজ্ঞপ্তি' : 'IOJH account notice';
  const body = bn
    ? 'আপনার IOJH অ্যাকাউন্ট সম্পর্কিত একটি বিজ্ঞপ্তি প্রস্তুত হয়েছে। বিস্তারিত জানতে সরাসরি অ্যাকাউন্টে প্রবেশ করুন।'
    : 'A notice about your IOJH account is available. Sign in directly to your account for details.';
  const referenceLabel = bn ? 'রেফারেন্স' : 'Reference';
  const actionLabel = bn ? 'IOJH অ্যাকাউন্ট খুলুন' : 'Open your IOJH account';
  const footer = bn ? 'এই বার্তাটি একটি কার্যক্রম-সংক্রান্ত বিজ্ঞপ্তি; বিপণন প্রচারণা নয়।' : 'This is an operational account notice, not a marketing campaign.';
  const reference = escapeHtml(v.reference);
  const html = `<!doctype html><html lang="${v.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f5ef;color:#203b36;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:32px 22px"><p style="color:#236554;font-size:13px;font-weight:700">IOJH / INTERNATIONAL ONLINE JOURNAL HUB</p><h1 style="font-size:28px;line-height:1.25">${escapeHtml(title)}</h1><p style="font-size:17px;line-height:1.7">${escapeHtml(body)}</p><p><strong>${escapeHtml(referenceLabel)}:</strong> ${reference}</p><p><a style="display:inline-block;padding:13px 18px;background:#146753;color:#fff;border-radius:6px;text-decoration:none" href="${escapeHtml(link)}">${escapeHtml(actionLabel)}</a></p><p style="font-size:13px;line-height:1.5;color:#53665d">${escapeHtml(footer)}</p></main></body></html>`;
  const text = `${title}\n\n${body}\n\n${referenceLabel}: ${v.reference}\n${actionLabel}: ${link}\n\n${footer}`;
  return {subject: title, html, text, templateId: v.templateId, templateVersion: v.templateVersion, locale: v.locale};
}
