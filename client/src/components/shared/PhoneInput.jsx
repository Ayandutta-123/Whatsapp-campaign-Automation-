import { useEffect, useState } from 'react';
import {
  COUNTRY_CODES,
  getStoredCountryCode,
  setStoredCountryCode,
  getCountryMeta,
} from '../../lib/countryCodes';
import { splitPhone, combinePhone } from '../../lib/phoneUtils';

export default function PhoneInput({
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
}) {
  const [countryCode, setCountryCode] = useState(getStoredCountryCode());
  const [localNumber, setLocalNumber] = useState('');

  useEffect(() => {
    const stored = getStoredCountryCode();
    const parts = splitPhone(value, stored);
    setCountryCode(parts.countryCode);
    setLocalNumber(parts.localNumber);
  }, [value]);

  const emitChange = (code, local) => {
    const full = combinePhone(code, local);
    onChange(full);
  };

  const handleCountryChange = (e) => {
    const code = e.target.value;
    setCountryCode(code);
    setStoredCountryCode(code);
    emitChange(code, localNumber);
  };

  const handleLocalChange = (e) => {
    const max = meta?.digits || 15;
    const local = e.target.value.replace(/\D/g, '').slice(0, max);
    setLocalNumber(local);
    emitChange(countryCode, local);
  };

  const meta = getCountryMeta(countryCode);

  return (
    <div className={`flex gap-2 ${className}`}>
      <select
        value={countryCode}
        onChange={handleCountryChange}
        disabled={disabled}
        className="w-[140px] shrink-0 px-2 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-accent"
        aria-label="Country code"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={handleLocalChange}
        placeholder={meta ? `${'X'.repeat(meta.digits)}` : 'Mobile number'}
        required={required}
        disabled={disabled}
        maxLength={meta?.digits || 15}
        className="flex-1 min-w-0 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent font-mono text-sm"
      />
    </div>
  );
}
