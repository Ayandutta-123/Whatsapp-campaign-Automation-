export const COUNTRY_CODES = [
  { code: '+91', label: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+971', label: 'UAE', flag: '🇦🇪', digits: 9 },
  { code: '+966', label: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+974', label: 'Qatar', flag: '🇶🇦', digits: 8 },
  { code: '+968', label: 'Oman', flag: '🇴🇲', digits: 8 },
  { code: '+965', label: 'Kuwait', flag: '🇰🇼', digits: 8 },
  { code: '+973', label: 'Bahrain', flag: '🇧🇭', digits: 8 },
  { code: '+962', label: 'Jordan', flag: '🇯🇴', digits: 9 },
  { code: '+972', label: 'Israel', flag: '🇮🇱', digits: 9 },
  { code: '+90', label: 'Turkey', flag: '🇹🇷', digits: 10 },
  { code: '+65', label: 'Singapore', flag: '🇸🇬', digits: 8 },
  { code: '+60', label: 'Malaysia', flag: '🇲🇾', digits: 9 },
  { code: '+62', label: 'Indonesia', flag: '🇮🇩', digits: 11 },
  { code: '+63', label: 'Philippines', flag: '🇵🇭', digits: 10 },
  { code: '+66', label: 'Thailand', flag: '🇹🇭', digits: 9 },
  { code: '+84', label: 'Vietnam', flag: '🇻🇳', digits: 9 },
  { code: '+95', label: 'Myanmar', flag: '🇲🇲', digits: 9 },
  { code: '+855', label: 'Cambodia', flag: '🇰🇭', digits: 9 },
  { code: '+856', label: 'Laos', flag: '🇱🇦', digits: 9 },
  { code: '+82', label: 'South Korea', flag: '🇰🇷', digits: 10 },
  { code: '+852', label: 'Hong Kong', flag: '🇭🇰', digits: 8 },
  { code: '+853', label: 'Macau', flag: '🇲🇴', digits: 8 },
  { code: '+886', label: 'Taiwan', flag: '🇹🇼', digits: 9 },
  { code: '+254', label: 'Kenya', flag: '🇰🇪', digits: 9 },
  { code: '+1', label: 'US / Canada', flag: '🇺🇸', digits: 10 },
  { code: '+44', label: 'United Kingdom', flag: '🇬🇧', digits: 10 },
  { code: '+61', label: 'Australia', flag: '🇦🇺', digits: 9 },
  { code: '+49', label: 'Germany', flag: '🇩🇪', digits: 10 },
  { code: '+33', label: 'France', flag: '🇫🇷', digits: 9 },
  { code: '+81', label: 'Japan', flag: '🇯🇵', digits: 10 },
  { code: '+86', label: 'China', flag: '🇨🇳', digits: 11 },
  { code: '+92', label: 'Pakistan', flag: '🇵🇰', digits: 10 },
  { code: '+880', label: 'Bangladesh', flag: '🇧🇩', digits: 10 },
  { code: '+94', label: 'Sri Lanka', flag: '🇱🇰', digits: 9 },
  { code: '+977', label: 'Nepal', flag: '🇳🇵', digits: 10 },
  { code: '+975', label: 'Bhutan', flag: '🇧🇹', digits: 8 },
  { code: '+960', label: 'Maldives', flag: '🇲🇻', digits: 7 },
  { code: '+93', label: 'Afghanistan', flag: '🇦🇫', digits: 9 },
];

export const DEFAULT_COUNTRY_CODE = '+91';
export const DEFAULT_COUNTRY_STORAGE_KEY = 'default_country_code';

export function getStoredCountryCode() {
  try {
    return localStorage.getItem(DEFAULT_COUNTRY_STORAGE_KEY) || DEFAULT_COUNTRY_CODE;
  } catch {
    return DEFAULT_COUNTRY_CODE;
  }
}

export function setStoredCountryCode(code) {
  try {
    localStorage.setItem(DEFAULT_COUNTRY_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function getCountryMeta(code) {
  return COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];
}
