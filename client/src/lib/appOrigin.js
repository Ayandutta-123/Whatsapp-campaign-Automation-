/**
 * Origin of the API, baked in at build time from `VITE_API_BASE_URL`.
 * Empty means same-origin: the default for the single-port on-prem deploy and
 * for the Vite dev proxy. Only set it when the UI is served from a different
 * host than the API — that host must then be listed in the API's `CORS_ORIGINS`.
 */
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

/** Base URL for API calls — same-origin unless VITE_API_BASE_URL was set at build time. */
export function getAppOrigin() {
  if (apiBaseUrl) return apiBaseUrl;
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
