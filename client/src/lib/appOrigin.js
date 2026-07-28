/** Same-origin base URL — works in dev (Vite proxy) and on-prem production (single port). */
export function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

/**
 * Webhook URL Meta should call. Prefers the configured "Public App URL" setting
 * (needed when the browser is on localhost/LAN but the server is reachable
 * publicly via a different domain — on-prem reverse proxy, Vercel, ngrok, etc).
 * Falls back to the current browser origin when no public URL is configured.
 */
export function getWebhookUrl(publicBaseUrl) {
  const base = publicBaseUrl?.trim()?.replace(/\/$/, '') || getAppOrigin();
  return base ? `${base}/webhook` : '/webhook';
}
