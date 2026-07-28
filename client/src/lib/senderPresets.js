/** Quick-add presets for common business regions */
export const SENDER_PRESETS = [
  { code: '+91', label: 'India', flag: '🇮🇳' },
  { code: '+971', label: 'UAE', flag: '🇦🇪' },
  { code: '+65', label: 'Singapore', flag: '🇸🇬' },
  { code: '+1', label: 'USA', flag: '🇺🇸' },
];

export function getCountryLabel(prefix) {
  const preset = SENDER_PRESETS.find((p) => p.code === prefix);
  if (preset) return `${preset.flag} ${preset.label}`;
  return prefix;
}
