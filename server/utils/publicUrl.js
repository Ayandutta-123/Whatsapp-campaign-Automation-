/**
 * Public base URL for webhooks, template header images, etc.
 * Priority: Settings UI → APP_PUBLIC_URL / BASE_URL env → request host (same origin).
 */
function resolvePublicBaseUrl(settingsValue, req) {
  if (settingsValue?.trim()) {
    return settingsValue.trim().replace(/\/$/, '');
  }
  if (process.env.APP_PUBLIC_URL?.trim()) {
    return process.env.APP_PUBLIC_URL.trim().replace(/\/$/, '');
  }
  if (process.env.BASE_URL?.trim()) {
    return process.env.BASE_URL.trim().replace(/\/$/, '');
  }
  if (req?.get) {
    const host = req.get('host');
    if (host) {
      const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }
  return '';
}

module.exports = { resolvePublicBaseUrl };
