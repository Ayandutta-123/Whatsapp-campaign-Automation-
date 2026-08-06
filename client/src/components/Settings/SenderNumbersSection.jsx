import { useState } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingButton from '../shared/LoadingButton';
import { senders } from '../../lib/api';
import { COUNTRY_CODES } from '../../lib/countryCodes';
import { SENDER_PRESETS, getCountryLabel } from '../../lib/senderPresets';
import { formatApiError } from '../../lib/formatError';

const emptyForm = {
  label: '',
  country_prefix: '+91',
  phone_number_id: '',
  display_phone: '',
  is_default: false,
};

export default function SenderNumbersSection({ senderList, onRefresh, wabaId }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const metaLink = wabaId
    ? `https://business.facebook.com/latest/whatsapp_manager/phone_numbers/?waba_id=${wabaId}`
    : 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/';

  const configuredPrefixes = new Set(senderList.map((s) => s.country_prefix));

  const startPreset = (preset) => {
    if (configuredPrefixes.has(preset.code)) {
      toast('Already configured — edit in Meta or remove and re-add', { icon: 'ℹ️' });
      return;
    }
    setForm({
      label: preset.label,
      country_prefix: preset.code,
      phone_number_id: '',
      display_phone: '',
      is_default: preset.code === '+91',
    });
  };

  const handleCountryChange = (code) => {
    const meta = COUNTRY_CODES.find((c) => c.code === code);
    setForm((f) => ({
      ...f,
      country_prefix: code,
      label: meta?.label || f.label,
    }));
  };

  const handleAdd = async () => {
    if (!form.label?.trim() || !form.country_prefix || !form.phone_number_id?.trim()) {
      toast.error('Label, country, and Phone Number ID are required');
      return;
    }
    setSaving(true);
    try {
      await senders.create(form);
      toast.success(`${form.label} sender added`);
      setForm(emptyForm);
      onRefresh();
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to add sender'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await senders.delete(id);
      toast.success('Sender removed');
      onRefresh();
    } catch {
      toast.error('Failed to remove sender');
    }
  };

  const handleSetDefault = async (sender) => {
    try {
      await senders.update(sender.id, { is_default: true });
      toast.success(`${sender.label} set as default fallback`);
      onRefresh();
    } catch {
      toast.error('Failed to update default sender');
    }
  };

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Sender Numbers by Country</h2>
          <p className="text-sm text-gray-500 mt-1">
            Register each number in Meta first, then add its Phone Number ID here.
            Campaigns can auto-route by contact country or use one fixed sender.
          </p>
        </div>
        <a
          href={metaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink size={14} /> Add number in Meta
        </a>
      </div>

      {/* Routing table */}
      {senderList.length > 0 ? (
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Country</th>
                <th className="text-left px-4 py-2 font-medium">Label</th>
                <th className="text-left px-4 py-2 font-medium">Display number</th>
                <th className="text-left px-4 py-2 font-medium">Phone Number ID</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {senderList.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">{getCountryLabel(s.country_prefix)}</td>
                  <td className="px-4 py-3 font-medium">
                    {s.label}
                    {s.is_default && (
                      <span className="ml-2 text-xs text-accent">(default fallback)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.display_phone || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.phone_number_id}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {!s.is_default && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(s)}
                        className="text-xs text-accent hover:underline"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
          No country senders configured yet. Add India, UAE, Singapore, and USA below after registering them in Meta.
        </p>
      )}

      {/* Quick-add presets */}
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick add country</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {SENDER_PRESETS.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => startPreset(p)}
            disabled={configuredPrefixes.has(p.code)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              configuredPrefixes.has(p.code)
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'border-gray-200 hover:border-accent hover:bg-accent/5'
            }`}
          >
            <Plus size={14} />
            {p.flag} {p.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Add sender number</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={form.country_prefix}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.label} ({c.code})
              </option>
            ))}
          </select>
          <input
            placeholder="Label (e.g. India Office)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <input
            placeholder="Display phone (e.g. +91 87124 09271)"
            value={form.display_phone}
            onChange={(e) => setForm({ ...form, display_phone: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <input
            placeholder="Meta Phone Number ID (long digits) *"
            value={form.phone_number_id}
            onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm font-mono"
          />
        </div>
        <p className="text-xs text-gray-500">
          Phone Number ID is the long number from Meta → WhatsApp → API Setup (e.g. 1245555738635041).
          Do not paste the display phone (e.g. 81067 77004).
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />
          Use as default fallback when no country match
        </label>
        <LoadingButton onClick={handleAdd} loading={saving}>
          <Plus size={16} /> Save Sender Number
        </LoadingButton>
      </div>
    </section>
  );
}
