// Resend REST transport; pure/injectable so tests cannot accidentally contact a provider.
export function classifyResendStatus(status, apiCode = '') {
  if (status === 429) return {outcome:'retry', code:'rate_limited'};
  if (status === 409 && apiCode === 'concurrent_idempotent_requests') return {outcome:'retry', code:'provider_unavailable'};
  if (status >= 500 && status <= 599) return {outcome:'retry', code:'provider_unavailable'};
  if (status === 409) return {outcome:'permanent', code:'provider_rejected'};
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) return {outcome:'permanent', code:'provider_rejected'};
  return {outcome:'retry', code:'provider_unavailable'};
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function sendResend({apiKey,from,to,subject,html,text,notificationId,fetchImpl=fetch,signal}) {
  if (typeof apiKey !== 'string' || !apiKey.startsWith('re_') || apiKey.length < 15 ||
      typeof from !== 'string' || !/^[^\r\n<>]*<?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}>?$/i.test(from) ||
      typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
      !UUID.test(notificationId) || !subject || !html || !text) {
    throw new TypeError('Invalid Resend configuration or message contract');
  }
  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method:'POST',redirect:'error',
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`iojh-notice-v1-${notificationId}`},
      body:JSON.stringify({from,to:[to],subject,html,text}), signal,
    });
  } catch {
    // A provider timeout may have accepted a message; the stable key is crucial.
    return {outcome:'retry',code:'timeout'};
  }
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (response.status >= 200 && response.status < 300 && typeof body?.id === 'string' && UUID.test(body.id)) {
    return {outcome:'accepted',providerId:body.id.toLowerCase()};
  }
  if (response.status >= 200 && response.status < 300) return {outcome:'retry',code:'timeout'};
  const result=classifyResendStatus(response.status, typeof body?.name === 'string' ? body.name : '');
  if (response.status===401 || response.status===403 || response.status===404) return {outcome:'retry',code:'provider_unavailable',cooldownSeconds:3600};
  if (response.status===429) {
    if (['daily_quota_exceeded','monthly_quota_exceeded'].includes(body?.name)) return {...result,cooldownSeconds:86400};
    const raw=response.headers?.get('retry-after');
    const seconds=raw && /^\d+$/.test(raw) ? Number(raw) : raw ? Math.ceil((Date.parse(raw)-Date.now())/1000) : 0;
    return {...result,cooldownSeconds:Math.min(86400,Math.max(300,Number.isFinite(seconds)?seconds:0))};
  }
  if(response.status===409 && result.outcome==='permanent') return {...result,code:'idempotency_conflict'};
  return result;
}
