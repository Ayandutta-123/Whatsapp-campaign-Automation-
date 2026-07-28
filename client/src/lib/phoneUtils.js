import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from './countryCodes';

export function splitPhone(fullPhone, defaultCode = DEFAULT_COUNTRY_CODE) {
  if (!fullPhone) {
    return { countryCode: defaultCode, localNumber: '' };
  }

  const cleaned = String(fullPhone).replace(/\s/g, '').replace(/-/g, '');

  if (!cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    return { countryCode: defaultCode, localNumber: local };
  }

  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const country of sorted) {
    if (cleaned.startsWith(country.code)) {
      return {
        countryCode: country.code,
        localNumber: cleaned.slice(country.code.length).replace(/\D/g, ''),
      };
    }
  }

  return {
    countryCode: defaultCode,
    localNumber: cleaned.slice(1).replace(/\D/g, ''),
  };
}

export function combinePhone(countryCode, localNumber) {
  const digits = String(localNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  return `${countryCode}${digits}`;
}

export function validatePhoneParts(countryCode, localNumber) {
  const digits = String(localNumber || '').replace(/\D/g, '');
  if (!digits) return false;

  const meta = COUNTRY_CODES.find((c) => c.code === countryCode);
  if (meta) return digits.length === meta.digits;
  return digits.length >= 8 && digits.length <= 15;
}

export function formatPhoneHint(countryCode) {
  const meta = COUNTRY_CODES.find((c) => c.code === countryCode);
  if (!meta) return 'Enter mobile number without country code';
  return `Enter ${meta.digits}-digit number (no ${meta.code} prefix)`;
}
