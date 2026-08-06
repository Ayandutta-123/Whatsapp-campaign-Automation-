const { formatUserFacingError } = require('./userErrors');

/**
 * Meta Cloud API Phone Number IDs are numeric Graph object IDs (no spaces).
 * Display phone numbers like "81067 77004" must never be used as phone_number_id.
 */
function sanitizePhoneNumberId(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;

  // Display phones are typically ≤12 digits; Meta phone number IDs are longer.
  if (cleaned.length < 14 || cleaned.length > 20) return null;

  return cleaned;
}

function assertValidPhoneNumberId(value, { fieldLabel = 'Phone Number ID' } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error(`${fieldLabel} is required`);
  }
  if (/\s/.test(raw)) {
    throw new Error(
      `${fieldLabel} cannot contain spaces. Use the Meta Phone Number ID from WhatsApp → API Setup (not the display phone like "81067 77004").`
    );
  }
  const cleaned = sanitizePhoneNumberId(raw);
  if (!cleaned) {
    throw new Error(
      `${fieldLabel} looks invalid ("${raw}"). Paste the long numeric Phone Number ID from Meta Developer Console / WhatsApp Manager → API Setup — not the human-readable phone number.`
    );
  }
  return cleaned;
}

function enrichMetaSendError(message, phoneNumberId) {
  return formatUserFacingError(message, {
    phoneNumberId,
    fallback: 'Message could not be sent. Check Settings and try again.',
  });
}

module.exports = {
  sanitizePhoneNumberId,
  assertValidPhoneNumberId,
  enrichMetaSendError,
};
