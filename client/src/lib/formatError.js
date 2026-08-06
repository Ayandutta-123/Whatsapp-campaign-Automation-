/**
 * Format API / Meta errors for toasts and tables (plain language + error code).
 * Mirrors server/utils/userErrors.js for messages already stored, and for raw API strings.
 */

const CODE_GUIDES = {
  100: {
    title: 'Invalid request details',
    why: 'WhatsApp did not understand the template name, language, or parameters.',
    fix: 'Sync the template from Meta and check variable mapping, then try again.',
  },
  190: {
    title: 'Access token expired or invalid',
    why: 'Your WhatsApp login token no longer works.',
    fix: 'Paste a fresh token in Settings → WhatsApp Access Token, then try again.',
  },
  131026: {
    title: 'Message could not be delivered',
    why: 'The number may not be on WhatsApp, or the app is outdated / terms not accepted.',
    fix: 'Ask the contact to update WhatsApp, then Resend Failed.',
  },
  131047: {
    title: 'Conversation window closed',
    why: 'More than 24 hours since the customer last replied.',
    fix: 'Use an approved template message (campaigns already do this).',
  },
  131053: {
    title: 'Media / image failed',
    why: 'WhatsApp could not use the image attached to the message.',
    fix: 'Re-upload the template image and set Public App URL in Settings.',
  },
  132000: {
    title: 'Template variable count mismatch',
    why: 'Number of variables sent does not match the approved template.',
    fix: 'Fix campaign variable mapping, sync template, then resend.',
  },
  132001: {
    title: 'Template not found',
    why: 'WhatsApp has no template with this name and language.',
    fix: 'Sync from Meta and wait until status is Approved.',
  },
  132012: {
    title: 'Template variable format error',
    why: 'A variable was empty or had line breaks.',
    fix: 'Fill contact fields and avoid blank variables, then resend.',
  },
  132015: {
    title: 'Template paused',
    why: 'Meta paused this template.',
    fix: 'Check Meta Business Manager and submit a new template version if needed.',
  },
  132018: {
    title: 'Template details do not match',
    why: 'Header, image, variables, or language do not match the approved template.',
    fix: 'Sync template from Meta, use an Approved IMAGE template for banners, then resend.',
  },
  133010: {
    title: 'Phone number not registered for sending',
    why: 'Number exists in Meta but is not registered for Cloud API messaging.',
    fix: 'Settings → Register Phone for Cloud API (any 6-digit PIN), then Resend Failed.',
  },
  130429: {
    title: 'Too many messages',
    why: 'WhatsApp rate limit was hit.',
    fix: 'Wait a few minutes, slow send delay in Settings, then resend.',
  },
};

function extractCode(text) {
  if (!text) return null;
  const s = String(text);
  const patterns = [
    /\[Error\s+(\d{2,7})\]/i,
    /\(#(\d{2,7})\)/,
    /\bcode\s+(\d{2,7})\b/i,
    /\b(\d{5,7})\b/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/** Re-format older stored technical errors into plain language when possible. */
export function formatUserFacingError(message, fallback = 'Something went wrong. Please try again.') {
  if (message == null || message === '') return fallback;
  const text = String(message);

  if (text.startsWith('[Error') && text.includes('Why:')) {
    return text;
  }

  const code = extractCode(text);
  if (code && CODE_GUIDES[code]) {
    const g = CODE_GUIDES[code];
    return `[Error ${code}] ${g.title}\nWhy: ${g.why}\nWhat to do: ${g.fix}`;
  }

  const lower = text.toLowerCase();
  if (lower.includes('phone number id') && (lower.includes('display') || lower.includes('spaces'))) {
    return (
      `[Error CONFIG] Wrong Phone Number ID\n` +
      `Why: A display phone was used instead of Meta’s long Phone Number ID.\n` +
      `What to do: Fix Phone Number ID in Settings, then Resend Failed.`
    );
  }
  if (lower.includes('public app url') || lower.includes('localhost')) {
    return (
      `[Error CONFIG] Public App URL issue\n` +
      `Why: WhatsApp cannot reach your image from a local address.\n` +
      `What to do: Set Public App URL in Settings to your live HTTPS site, re-upload image, resend.`
    );
  }

  // Soften common raw Meta phrasing
  if (/parameter|template validation/i.test(text)) {
    const g = CODE_GUIDES[132018];
    return `[Error 132018] ${g.title}\nWhy: ${g.why}\nWhat to do: ${g.fix}`;
  }

  return text;
}

/** Prefer API error body; always return a user-facing string. */
export function formatApiError(err, fallback = 'Something went wrong. Please try again.') {
  const raw =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback;
  return formatUserFacingError(raw, fallback);
}
