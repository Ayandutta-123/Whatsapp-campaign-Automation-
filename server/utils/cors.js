/**
 * Browser origins allowed to call the API.
 * Same-origin deploys (UI and API on one port) need no configuration.
 * Set CORS_ORIGINS — comma-separated, or `*` for any — when the UI is hosted on
 * another domain. APP_PUBLIC_URL and BASE_URL are always allowed.
 */
function resolveCorsOrigins(env = process.env) {
  return [
    ...String(env.CORS_ORIGINS || '').split(','),
    env.APP_PUBLIC_URL,
    env.BASE_URL,
  ]
    .map((url) => String(url || '').trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function isOriginAllowed(origin, origins, env = process.env) {
  if (!origin) return true;
  if (origins.includes('*')) return true;
  if (env.NODE_ENV !== 'production') return true;
  return origins.includes(origin.replace(/\/+$/, ''));
}

module.exports = { resolveCorsOrigins, isOriginAllowed };
