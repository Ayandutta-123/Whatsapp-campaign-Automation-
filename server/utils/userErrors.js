/**
 * Turn Meta / app errors into plain-language messages with error codes.
 * Format: [Error CODE] Short title — Why: … What to do: …
 */

const META_ERROR_GUIDES = {
  0: {
    title: 'WhatsApp rejected the request',
    why: 'Something was wrong with the request or permissions.',
    fix: 'Check Settings → WhatsApp Access Token and try again.',
  },
  3: {
    title: 'Permission denied',
    why: 'Your WhatsApp token does not have permission for this action.',
    fix: 'Create a new token in Meta with WhatsApp permissions, then paste it in Settings.',
  },
  10: {
    title: 'Permission denied',
    why: 'Your app is not allowed to do this action.',
    fix: 'Check Meta App permissions and that the phone number belongs to your WhatsApp Business Account.',
  },
  100: {
    title: 'Invalid request details',
    why: 'WhatsApp did not understand one or more fields in the request (wrong template name, language, or parameters).',
    fix: 'Sync the template from Meta, confirm language matches, and check variable mapping before resending.',
  },
  190: {
    title: 'Access token expired or invalid',
    why: 'Your WhatsApp login token no longer works.',
    fix: 'Go to Settings → WhatsApp Access Token, paste a fresh token from Meta, save, then try again.',
  },
  200: {
    title: 'Permission missing',
    why: 'The app is missing a required WhatsApp permission.',
    fix: 'In Meta Developer Console, grant WhatsApp permissions to your app / token.',
  },
  368: {
    title: 'Temporarily blocked',
    why: 'Meta temporarily blocked this action (policy or rate limits).',
    fix: 'Wait and try later. Check Meta Business Manager for any policy alerts.',
  },
  80007: {
    title: 'Rate limit reached',
    why: 'Too many messages were sent in a short time.',
    fix: 'Wait a few minutes, lower send speed in Settings, then resend failed messages.',
  },
  130429: {
    title: 'Too many messages',
    why: 'You hit WhatsApp’s sending rate limit.',
    fix: 'Slow down the send delay in Settings and resend failed messages later.',
  },
  131000: {
    title: 'Something went wrong on WhatsApp’s side',
    why: 'A temporary WhatsApp/Meta server error occurred.',
    fix: 'Wait a minute and resend the failed messages.',
  },
  131005: {
    title: 'Access denied',
    why: 'This phone number or account cannot send right now.',
    fix: 'Confirm the Phone Number ID in Settings and that the number is active in Meta.',
  },
  131008: {
    title: 'Required information missing',
    why: 'A required field was empty in the message.',
    fix: 'Check contacts have name/phone filled in, and that template variables are mapped.',
  },
  131009: {
    title: 'Invalid value in message',
    why: 'One of the values sent (like a variable or phone) was not accepted.',
    fix: 'Check contact phone format and template variable values, then resend.',
  },
  131016: {
    title: 'Service temporarily unavailable',
    why: 'WhatsApp service had a short outage.',
    fix: 'Wait a few minutes and resend failed messages.',
  },
  131021: {
    title: 'Cannot message this recipient',
    why: 'The recipient cannot receive messages from this business number right now.',
    fix: 'Confirm the phone number is correct and the person has WhatsApp.',
  },
  131026: {
    title: 'Message could not be delivered',
    why: 'The number may not be on WhatsApp, uses an old app, or has not accepted WhatsApp terms.',
    fix: 'Ask the contact to update WhatsApp and confirm they can receive business messages. Then resend.',
  },
  131031: {
    title: 'Business account locked',
    why: 'Your WhatsApp Business account is restricted.',
    fix: 'Check Meta Business Manager for account alerts and resolve them.',
  },
  131047: {
    title: 'Conversation window closed',
    why: 'More than 24 hours passed since the customer last replied, so free-form chat is blocked.',
    fix: 'Send an approved template message instead (this app already uses templates for campaigns).',
  },
  131051: {
    title: 'Unsupported message type',
    why: 'This kind of message is not supported for this send.',
    fix: 'Use an approved template with supported header/body/buttons.',
  },
  131053: {
    title: 'Media upload or download failed',
    why: 'WhatsApp could not use the image/file attached to the message.',
    fix: 'Re-upload the template image (PNG/JPG), set Public App URL in Settings, then resend.',
  },
  132000: {
    title: 'Template parameter count mismatch',
    why: 'The number of {{variables}} you sent does not match the approved template.',
    fix: 'Open the template, sync from Meta, fix variable mapping in the campaign, then resend.',
  },
  132001: {
    title: 'Template not found',
    why: 'WhatsApp does not have a template with this name and language.',
    fix: 'Sync templates from Meta. If you edited it, wait until the new version is Approved.',
  },
  132005: {
    title: 'Template text is too long',
    why: 'Part of the template content exceeds WhatsApp’s length limit.',
    fix: 'Shorten the body/header text and submit a new template version to Meta.',
  },
  132007: {
    title: 'Template format not allowed',
    why: 'The template content breaks WhatsApp policy rules.',
    fix: 'Edit the wording, remove policy issues, and resubmit a new version to Meta.',
  },
  132012: {
    title: 'Template parameter format error',
    why: 'A variable value has the wrong format (empty, line breaks, or bad characters).',
    fix: 'Fill contact fields, avoid blank variables, and resend.',
  },
  132015: {
    title: 'Template paused or disabled',
    why: 'Meta paused this template (quality or policy).',
    fix: 'Check template quality in Meta Business Manager. Create/submit a new version if needed.',
  },
  132016: {
    title: 'Template temporarily blocked',
    why: 'This template is blocked due to low quality feedback.',
    fix: 'Pause sends with this template. Improve content and use a new approved version.',
  },
  132018: {
    title: 'Template details do not match',
    why: 'The message header, image, variables, or language do not match the approved Meta template.',
    fix: 'Sync the template from Meta. Use only an Approved IMAGE template for banners. Check variable mapping, then resend.',
  },
  133000: {
    title: 'Incomplete registration',
    why: 'Phone number registration with WhatsApp Cloud API is incomplete.',
    fix: 'In Settings, use “Register Phone for Cloud API”, then try again.',
  },
  133004: {
    title: 'Server busy',
    why: 'WhatsApp’s servers were busy.',
    fix: 'Wait a minute and resend failed messages.',
  },
  133005: {
    title: 'Phone number not verified',
    why: 'This business phone number still needs verification.',
    fix: 'Complete phone verification in Meta WhatsApp Manager.',
  },
  133006: {
    title: 'Phone number needs display name approval',
    why: 'Your WhatsApp display name is not approved yet.',
    fix: 'Finish display name approval in Meta Business Manager, then retry.',
  },
  133008: {
    title: 'Phone number needs to be re-registered',
    why: 'The number must be registered again for Cloud API.',
    fix: 'In Settings, register the phone for Cloud API with a 6-digit PIN, then resend.',
  },
  133009: {
    title: 'Phone number is still being set up',
    why: 'WhatsApp is still provisioning this number.',
    fix: 'Wait a few minutes, then try again.',
  },
  133010: {
    title: 'Phone number not registered for sending',
    why: 'This number exists in Meta but is not registered for Cloud API messaging yet.',
    fix: 'Open Settings → click “Register Phone for Cloud API”, enter any 6-digit PIN, save, then Resend Failed.',
  },
  133015: {
    title: 'Phone number already registered',
    why: 'This number is already registered (often safe to ignore).',
    fix: 'If sends still fail, check Phone Number ID and token in Settings.',
  },
  135000: {
    title: 'Generic user error',
    why: 'WhatsApp rejected the request for a user-related reason.',
    fix: 'Check the contact number, template status, and Settings credentials, then retry.',
  },
};

const MESSAGE_HINTS = [
  {
    test: /parameter|132018|template validation/i,
    code: 132018,
  },
  {
    test: /undeliverable|not a whatsapp|131026/i,
    code: 131026,
  },
  {
    test: /expired|access token|190/i,
    code: 190,
  },
  {
    test: /not registered|133010|account not registered/i,
    code: 133010,
  },
  {
    test: /does not exist|unsupported post request|missing permissions/i,
    code: 100,
  },
  {
    test: /rate limit|too many/i,
    code: 130429,
  },
  {
    test: /media|header image|download.*media|upload.*media/i,
    code: 131053,
  },
  {
    test: /template.*not found|132001/i,
    code: 132001,
  },
];

function extractErrorCode(input) {
  if (input == null) return null;
  if (typeof input === 'number' && Number.isFinite(input)) return input;

  if (typeof input === 'object') {
    const direct =
      input.code ??
      input.error_code ??
      input.error?.code ??
      input.error?.error_subcode;
    if (direct != null && String(direct).match(/^\d+$/)) return parseInt(direct, 10);

    const fromMsg = extractErrorCode(input.message || input.error_user_msg || input.error?.message);
    if (fromMsg) return fromMsg;
  }

  const text = String(input);
  const patterns = [
    /\[(?:Error\s*)?(\d{2,7})\]/i,
    /\(#(\d{2,7})\)/,
    /\bcode\s+(\d{2,7})\b/i,
    /\berror\s+(\d{2,7})\b/i,
    /\b(\d{5,7})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1], 10);
  }

  for (const hint of MESSAGE_HINTS) {
    if (hint.test.test(text) && META_ERROR_GUIDES[hint.code]) return hint.code;
  }
  return null;
}

function buildMessage(code, guide, { extra = '', phoneNumberId = null } = {}) {
  const idHint = phoneNumberId ? ` (Phone Number ID used: ${phoneNumberId})` : '';
  const extraBit = extra ? ` Details: ${extra}` : '';
  return (
    `[Error ${code}] ${guide.title}${idHint}\n` +
    `Why: ${guide.why}\n` +
    `What to do: ${guide.fix}${extraBit}`
  );
}

function simplifyTechnicalSnippet(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/^\(#\d+\)\s*/i, '')
    .trim()
    .slice(0, 180);
}

/**
 * @param {string|object|Error|null} err
 * @param {{ fallback?: string, phoneNumberId?: string|null }} [options]
 */
function formatUserFacingError(err, options = {}) {
  const fallback = options.fallback || 'Something went wrong. Please try again.';
  const phoneNumberId = options.phoneNumberId || null;

  if (err == null || err === '') {
    return fallback;
  }

  // Already formatted by us
  if (typeof err === 'string' && err.startsWith('[Error ') && err.includes('Why:')) {
    return err;
  }

  const meta =
    err?.response?.data?.error ||
    (err?.code != null && (err.message || err.error_user_msg) ? err : null) ||
    err?.error ||
    null;

  const rawMessage =
    meta?.error_user_msg ||
    meta?.message ||
    err?.error_user_msg ||
    (typeof err === 'string' ? err : err?.message) ||
    '';

  const code =
    extractErrorCode(meta) ||
    extractErrorCode(err) ||
    extractErrorCode(rawMessage);

  const details = simplifyTechnicalSnippet(
    meta?.error_data?.details ||
      (meta?.error_user_title && meta.error_user_title !== rawMessage
        ? meta.error_user_title
        : '') ||
      ''
  );

  if (code && META_ERROR_GUIDES[code]) {
    return buildMessage(code, META_ERROR_GUIDES[code], {
      extra: details || (rawMessage && !String(rawMessage).includes(String(code))
        ? simplifyTechnicalSnippet(rawMessage)
        : ''),
      phoneNumberId,
    });
  }

  // Known non-Meta app messages
  const lower = String(rawMessage || err).toLowerCase();
  if (lower.includes('phone number id') || lower.includes('display phone')) {
    return (
      `[Error CONFIG] Wrong Phone Number ID\n` +
      `Why: Settings has a display phone number instead of Meta’s long Phone Number ID.\n` +
      `What to do: Settings → WhatsApp API / Sender Numbers — paste the long numeric Phone Number ID from Meta → WhatsApp → API Setup, then Resend Failed.`
    );
  }
  if (lower.includes('public app url') || lower.includes('localhost')) {
    return (
      `[Error CONFIG] Public App URL missing or not reachable\n` +
      `Why: WhatsApp cannot download your image from a local or private address.\n` +
      `What to do: Set Public App URL in Settings to your live HTTPS URL, re-upload the image, then resend.`
    );
  }
  if (lower.includes('daily send limit')) {
    return (
      `[Error LIMIT] Daily send limit reached\n` +
      `Why: You hit the maximum messages allowed per day in Settings.\n` +
      `What to do: Wait until tomorrow, or raise the daily limit if your Meta tier allows it.`
    );
  }
  if (lower.includes('header image') || lower.includes('upload a header')) {
    return (
      `[Error IMAGE] Header image missing\n` +
      `Why: This template needs a logo/image but none is available on the server.\n` +
      `What to do: Edit the template, upload a PNG/JPG header, save & resubmit to Meta, then resend after approval.`
    );
  }

  if (code) {
    return (
      `[Error ${code}] Message could not be completed${phoneNumberId ? ` (Phone Number ID: ${phoneNumberId})` : ''}\n` +
      `Why: ${simplifyTechnicalSnippet(rawMessage) || 'WhatsApp returned an error.'}\n` +
      `What to do: Check Settings (token, Phone Number ID, template Approved status) and try again.`
    );
  }

  const plain = simplifyTechnicalSnippet(rawMessage) || fallback;
  return (
    `[Error] ${plain}\n` +
    `What to do: Check Settings and try again. If this keeps happening, copy this message and contact support.`
  );
}

/**
 * Format Meta axios / Graph error for API JSON responses.
 */
function formatMetaApiError(err, fallback = 'WhatsApp request failed') {
  const meta = err?.response?.data?.error;
  if (meta) return formatUserFacingError(meta, { fallback });
  return formatUserFacingError(err, { fallback });
}

module.exports = {
  META_ERROR_GUIDES,
  extractErrorCode,
  formatUserFacingError,
  formatMetaApiError,
};
