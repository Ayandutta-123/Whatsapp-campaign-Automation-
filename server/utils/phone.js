const COUNTRY_CODES = [
  { code: '+91', digits: 10 },
  { code: '+971', digits: 9 },
  { code: '+966', digits: 9 },
  { code: '+974', digits: 8 },
  { code: '+968', digits: 8 },
  { code: '+65', digits: 8 },
  { code: '+254', digits: 9 },
  { code: '+1', digits: 10 },
  { code: '+44', digits: 10 },
  { code: '+61', digits: 9 },
  { code: '+49', digits: 10 },
  { code: '+33', digits: 9 },
  { code: '+81', digits: 10 },
  { code: '+86', digits: 11 },
  { code: '+92', digits: 10 },
  { code: '+880', digits: 10 },
  { code: '+94', digits: 9 },
  { code: '+977', digits: 10 },
];

function getCountryForPhone(phone) {
  if (!phone?.startsWith('+')) return null;
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  return sorted.find((c) => phone.startsWith(c.code)) || null;
}

function validatePhone(phone) {
  if (!phone || !phone.startsWith('+')) return false;

  const country = getCountryForPhone(phone);
  const localDigits = country
    ? phone.slice(country.code.length).replace(/\D/g, '')
    : phone.slice(1).replace(/\D/g, '');

  if (!localDigits) return false;

  if (country) {
    return localDigits.length === country.digits;
  }

  // Unknown country: require 8–15 local digits
  return localDigits.length >= 8 && localDigits.length <= 15;
}

function phoneValidationError(phone) {
  if (!phone) return 'Phone number is required';
  if (!phone.startsWith('+')) return 'Phone must include country code (e.g. +91...)';

  const country = getCountryForPhone(phone);
  const localDigits = country
    ? phone.slice(country.code.length).replace(/\D/g, '')
    : phone.slice(1).replace(/\D/g, '');

  if (country && localDigits.length !== country.digits) {
    return `Invalid phone for ${country.code}: expected ${country.digits} digits, got ${localDigits.length}`;
  }

  if (!validatePhone(phone)) return 'Invalid phone number format';
  return null;
}

module.exports = {
  COUNTRY_CODES,
  getCountryForPhone,
  validatePhone,
  phoneValidationError,
};
