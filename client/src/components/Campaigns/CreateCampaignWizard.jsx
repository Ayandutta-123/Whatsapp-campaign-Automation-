import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../shared/Modal';
import LoadingButton from '../shared/LoadingButton';
import StatusBadge from '../shared/StatusBadge';
import WhatsAppPreview from '../Templates/WhatsAppPreview';
import { campaigns, templates, contacts, senders } from '../../lib/api';
import { getCountryLabel } from '../../lib/senderPresets';

const FIELD_OPTIONS = [
  { value: 'name', label: 'Contact Name' },
  { value: 'company', label: 'Company' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'custom', label: 'Custom Text' },
];

const SAMPLE = { name: 'John Doe', company: 'Acme Inc', phone: '+1234567890', email: 'john@acme.com' };

export default function CreateCampaignWizard({ open, onClose, onCreated, preselectedIds = [] }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [templateList, setTemplateList] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableMapping, setVariableMapping] = useState({});
  const [customValues, setCustomValues] = useState({});
  const [selectionType, setSelectionType] = useState(preselectedIds.length ? 'manual' : 'all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [manualIds, setManualIds] = useState(preselectedIds);
  const [contactList, setContactList] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [totalContacts, setTotalContacts] = useState(0);
  const [tagCount, setTagCount] = useState(0);
  const [scheduleType, setScheduleType] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [senderMode, setSenderMode] = useState('auto');
  const [senderNumberId, setSenderNumberId] = useState('');
  const [senderList, setSenderList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      templates.list().then((r) => setTemplateList(r.data));
      contacts.list({ limit: 1000 }).then((r) => {
        setContactList(r.data.contacts);
        setTotalContacts(r.data.total);
      });
      contacts.tags().then((r) => setAllTags(r.data));
      senders.list().then((r) => setSenderList(r.data)).catch(() => {});
      if (preselectedIds.length) {
        setSelectionType('manual');
        setManualIds(preselectedIds);
      }
    } else {
      setStep(1);
      setName('');
      setSelectedTemplate(null);
      setVariableMapping({});
      setScheduleType('now');
      setSenderMode('auto');
      setSenderNumberId('');
    }
  }, [open, preselectedIds]);

  useEffect(() => {
    if (selectionType === 'tags' && selectedTags.length > 0) {
      contacts.list({ tags: selectedTags[0], limit: 1 }).then((r) => setTagCount(r.data.total));
    } else {
      setTagCount(0);
    }
  }, [selectionType, selectedTags]);

  useEffect(() => {
    if (selectedTemplate?.variables?.length) {
      const mapping = {};
      selectedTemplate.variables.forEach((v, i) => {
        mapping[v] = ['name', 'company', 'phone', 'email'][i] || 'name';
      });
      setVariableMapping(mapping);
    }
  }, [selectedTemplate]);

  const getRecipientCount = () => {
    if (selectionType === 'all') return totalContacts;
    if (selectionType === 'tags') return tagCount;
    return manualIds.length;
  };

  const buildPreviewText = () => {
    let text = selectedTemplate?.body_text || '';
    Object.entries(variableMapping).forEach(([key, field]) => {
      const val =
        field === 'custom'
          ? customValues[key] || '[Custom]'
          : SAMPLE[field] || `[${field}]`;
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    });
    return text;
  };

  const handleLaunch = async () => {
    setLoading(true);
    try {
      let contact_selection;
      if (selectionType === 'all') contact_selection = { type: 'all' };
      else if (selectionType === 'tags') contact_selection = { type: 'tags', tags: selectedTags };
      else contact_selection = { type: 'manual', ids: manualIds };

      const fullMapping = { ...variableMapping };
      Object.entries(customValues).forEach(([k, v]) => {
        if (variableMapping[k] === 'custom') fullMapping[`${k}_custom`] = v;
      });

      const payload = {
        name,
        template_id: selectedTemplate.id,
        contact_selection,
        variable_mapping: fullMapping,
        scheduled_at: scheduleType === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        sender_mode: senderMode,
        sender_number_id: senderMode === 'fixed' && senderNumberId ? Number(senderNumberId) : null,
      };

      const res = await campaigns.create(payload);

      if (scheduleType === 'now') {
        await campaigns.send(res.data.id);
        toast.success('Campaign launched!');
        onCreated(res.data.id, true);
      } else {
        toast.success('Campaign scheduled!');
        onCreated(res.data.id, false);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contactList.filter(
    (c) =>
      !contactSearch ||
      c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch)
  );

  const canNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return !!selectedTemplate;
    if (step === 3) return true;
    if (step === 4) return getRecipientCount() > 0;
    if (step === 5) {
      if (senderMode === 'fixed' && !senderNumberId) return false;
      return scheduleType === 'now' || !!scheduledAt;
    }
    return false;
  };

  const selectTemplate = (t) => {
    setSelectedTemplate(t);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Campaign" wide>
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s <= step ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s < step ? <Check size={14} /> : s}
            </div>
            {s < 5 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-accent' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <label className="block text-sm font-medium mb-2">Campaign Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. March Newsletter"
            className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {templateList.length === 0 && (
              <p className="text-gray-500 text-sm">No templates yet — create one in Templates first.</p>
            )}
            {templateList.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t)}
                className={`w-full text-left p-4 border rounded-xl transition-colors hover:border-gray-300 ${
                  selectedTemplate?.id === t.id ? 'border-accent bg-accent/5' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t.name}</p>
                  {t.meta_status && <StatusBadge status={(t.meta_status || 'draft').toLowerCase()} />}
                </div>
                <p className="text-xs text-gray-500 font-mono mt-1">{t.whatsapp_template_name}</p>
                {t.whatsapp_template_name === 'hello_world' && (
                  <p className="text-xs text-orange-500 mt-1">⚠ Test-only — fails with real numbers</p>
                )}
                {(t.meta_status || '').toLowerCase() === 'pending' && (
                  <p className="text-xs text-yellow-600 mt-1">Pending Meta approval — may fail until approved</p>
                )}
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <WhatsAppPreview template={selectedTemplate} />
          )}
        </div>
      )}

      {step === 3 && selectedTemplate?.variables?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {selectedTemplate.variables.map((v) => (
              <div key={v}>
                <label className="block text-sm font-medium mb-1">{`{{${v}}}`} maps to</label>
                <select
                  value={variableMapping[v] || 'name'}
                  onChange={(e) =>
                    setVariableMapping({ ...variableMapping, [v]: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {variableMapping[v] === 'custom' && (
                  <input
                    value={customValues[v] || ''}
                    onChange={(e) =>
                      setCustomValues({ ...customValues, [v]: e.target.value })
                    }
                    placeholder="Custom value"
                    className="w-full px-3 py-2 border rounded-lg mt-2"
                  />
                )}
              </div>
            ))}
          </div>
          <WhatsAppPreview
            template={{ ...selectedTemplate, body_text: buildPreviewText() }}
          />
        </div>
      )}

      {step === 3 && (!selectedTemplate?.variables?.length) && (
        <p className="text-gray-500 text-center py-8">This template has no variables. Click Next to continue.</p>
      )}

      {step === 4 && (
        <div>
          <div className="flex gap-2 mb-4">
            {[
              { id: 'all', label: `All Contacts (${totalContacts})` },
              { id: 'tags', label: 'By Tags' },
              { id: 'manual', label: 'Select Manually' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectionType(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectionType === tab.id
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectionType === 'tags' && (
            <div className="flex flex-wrap gap-2 mb-4">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTags([tag])}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    selectedTags.includes(tag)
                      ? 'bg-accent text-white border-accent'
                      : 'border-gray-200'
                  }`}
                >
                  {tag} {selectedTags.includes(tag) && `(${tagCount})`}
                </button>
              ))}
            </div>
          )}

          {selectionType === 'manual' && (
            <div>
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full px-3 py-2 border rounded-lg mb-3"
              />
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {filteredContacts.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualIds.includes(c.id)}
                      onChange={() =>
                        setManualIds((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((i) => i !== c.id)
                            : [...prev, c.id]
                        )
                      }
                    />
                    <span className="font-medium">{c.name || 'Unnamed'}</span>
                    <span className="text-gray-400 text-sm">{c.phone}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">{manualIds.length} selected</p>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Send from</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSenderMode('auto')}
                className={`p-4 border rounded-xl text-left ${
                  senderMode === 'auto' ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">Auto by country</p>
                <p className="text-xs text-gray-500 mt-1">
                  +91 → India, +971 → UAE, +65 → Singapore, +1 → USA (from Settings)
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSenderMode('fixed')}
                className={`p-4 border rounded-xl text-left ${
                  senderMode === 'fixed' ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">One fixed number</p>
                <p className="text-xs text-gray-500 mt-1">
                  All recipients get the message from the same business number
                </p>
              </button>
            </div>
            {senderMode === 'fixed' && (
              <div className="mt-3">
                {senderList.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    Add sender numbers in Settings first, then pick one here.
                  </p>
                ) : (
                  <select
                    value={senderNumberId}
                    onChange={(e) => setSenderNumberId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select sender number...</option>
                    {senderList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {getCountryLabel(s.country_prefix)} — {s.label}
                        {s.display_phone ? ` (${s.display_phone})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {senderMode === 'auto' && senderList.length > 0 && (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-gray-600">Configured routes:</p>
                {senderList.map((s) => (
                  <p key={s.id}>
                    {getCountryLabel(s.country_prefix)} → {s.label}
                    {s.is_default ? ' (fallback)' : ''}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setScheduleType('now')}
              className={`p-6 border rounded-xl text-center ${
                scheduleType === 'now' ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'
              }`}
            >
              <Send size={32} className="mx-auto mb-2 text-accent" />
              <p className="font-medium">Send Now</p>
            </button>
            <button
              type="button"
              onClick={() => setScheduleType('later')}
              className={`p-6 border rounded-xl text-center ${
                scheduleType === 'later' ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'
              }`}
            >
              <Clock size={32} className="mx-auto mb-2 text-accent" />
              <p className="font-medium">Schedule Later</p>
            </button>
          </div>
          {scheduleType === 'later' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          )}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <p><strong>Campaign:</strong> {name}</p>
            <p><strong>Template:</strong> {selectedTemplate?.name}</p>
            <p><strong>Recipients:</strong> {getRecipientCount()}</p>
            <p>
              <strong>Send from:</strong>{' '}
              {senderMode === 'auto'
                ? 'Auto by contact country'
                : senderList.find((s) => String(s.id) === String(senderNumberId))?.label || 'Not selected'}
            </p>
            <p><strong>Timing:</strong> {scheduleType === 'now' ? 'Immediately' : scheduledAt || 'Not set'}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8 pt-4 border-t">
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
        >
          <ChevronLeft size={16} /> Back
        </button>
        {step < 5 ? (
          <LoadingButton onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next <ChevronRight size={16} />
          </LoadingButton>
        ) : (
          <LoadingButton onClick={handleLaunch} loading={loading} disabled={!canNext()}>
            Launch Campaign
          </LoadingButton>
        )}
      </div>
    </Modal>
  );
}
