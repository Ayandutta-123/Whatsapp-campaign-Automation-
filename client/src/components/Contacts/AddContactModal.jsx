import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../shared/Modal';
import TagInput from '../shared/TagInput';
import LoadingButton from '../shared/LoadingButton';
import PhoneInput from '../shared/PhoneInput';
import { contacts } from '../../lib/api';
import { validatePhoneParts, splitPhone, formatPhoneHint } from '../../lib/phoneUtils';
import { getStoredCountryCode } from '../../lib/countryCodes';

export default function AddContactModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', company: '', email: '', tags: [] });
  const [loading, setLoading] = useState(false);
  const defaultCode = getStoredCountryCode();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { countryCode, localNumber } = splitPhone(form.phone, defaultCode);
    if (!validatePhoneParts(countryCode, localNumber)) {
      toast.error(formatPhoneHint(countryCode));
      return;
    }
    setLoading(true);
    try {
      await contacts.create(form);
      toast.success('Contact added');
      setForm({ name: '', phone: '', company: '', email: '', tags: [] });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <PhoneInput
            value={form.phone}
            onChange={(phone) => setForm({ ...form, phone })}
            required
          />
          <p className="text-xs text-gray-400 mt-1">{formatPhoneHint(splitPhone(form.phone, defaultCode).countryCode)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <TagInput
            tags={form.tags}
            onChange={(tags) => setForm({ ...form, tags })}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
            Cancel
          </button>
          <LoadingButton type="submit" loading={loading}>
            Add Contact
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
}
