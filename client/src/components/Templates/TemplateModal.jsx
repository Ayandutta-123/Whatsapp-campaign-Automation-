import { useState, useEffect } from 'react';
import { Upload, RefreshCw, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../shared/Modal';
import LoadingButton from '../shared/LoadingButton';
import ConfirmDialog from '../shared/ConfirmDialog';
import StatusBadge from '../shared/StatusBadge';
import WhatsAppPreview from './WhatsAppPreview';
import { templates } from '../../lib/api';
import { isApprovedTemplate } from '../../lib/templateStatus';

const META_RESUBMIT_WARNING = `Meta cannot update an approved template in place.

Saving will submit a NEW version (e.g. your_template_v2) to Meta for re-approval.

• You cannot use your edits in campaigns until the NEW version is APPROVED (usually 1–24 hours).
• The old approved version stays on Meta — campaigns still use the old content until you switch to the new version after approval.
• If you want a clean start with a different name, Cancel and create a new template instead.

Continue to save and send this new version to Meta?`;

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', desc: 'Promotions, offers, and announcements' },
  { value: 'UTILITY', label: 'Utility', desc: 'Order updates, account alerts, and notifications' },
  { value: 'AUTHENTICATION', label: 'Authentication', desc: 'OTP codes and verification messages' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
  { value: 'hi', label: 'Hindi' },
];

function detectVariables(text) {
  const matches = text?.match(/\{\{(\d+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))].sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10)
  );
}

function toTemplateName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 512);
}

const BUTTON_TYPES = [
  { value: 'URL', label: 'Link / URL', icon: '🔗' },
  { value: 'QUICK_REPLY', label: 'Quick Reply', icon: '↩️' },
  { value: 'PHONE_NUMBER', label: 'Call Phone', icon: '📞' },
];

const emptyButton = { type: 'URL', text: '', url: '', phone: '' };

const emptyForm = {
  name: '',
  whatsapp_template_name: '',
  language: 'en',
  category: 'MARKETING',
  body_text: '',
  header_type: 'none',
  header_value: '',
  header_media_handle: '',
  header_image_preview: '',
  header_image_path: '',
  header_image_url: '',
  footer_text: '',
  button_text: '',
  buttons: [],
  submit_to_meta: true,
};

export default function TemplateModal({
  open,
  onClose,
  template,
  initialDraft,
  onSaved,
  businessName,
}) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null);
  /** null | 'save' | 'resubmit' — shows version-warning before sending edits to Meta */
  const [confirmResubmit, setConfirmResubmit] = useState(null);
  const isEdit = !!template?.id;

  const needsMetaVersionWarning = () => {
    const status = String(metaStatus || template?.meta_status || '').toLowerCase();
    return (
      Boolean(template?.meta_template_id) ||
      ['pending', 'approved', 'rejected', 'paused'].includes(status) ||
      isApprovedTemplate({ meta_status: metaStatus || template?.meta_status })
    );
  };

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name || '',
        whatsapp_template_name: template.whatsapp_template_name || '',
        language: template.language || 'en',
        category: template.category || 'MARKETING',
        body_text: template.body_text || '',
        header_type: template.header_type || 'none',
        header_value: template.header_value || '',
        header_media_handle: template.header_media_handle || '',
        header_image_preview: template.header_image_preview || '',
        header_image_path: template.header_image_path || '',
        header_image_url: template.header_image_url || '',
        footer_text: template.footer_text || '',
        button_text: template.button_text || '',
        buttons: Array.isArray(template.buttons) && template.buttons.length > 0
          ? template.buttons
          : template.button_text
            ? [{ type: 'QUICK_REPLY', text: template.button_text, url: '', phone: '' }]
            : [],
        submit_to_meta: false,
      });
      setMetaStatus(template.meta_status);
      setConfirmResubmit(null);
    } else if (initialDraft) {
      setForm({
        ...emptyForm,
        name: initialDraft.name || '',
        whatsapp_template_name:
          initialDraft.whatsapp_template_name || toTemplateName(initialDraft.name || ''),
        language: initialDraft.language || 'en',
        category: initialDraft.category || 'MARKETING',
        body_text: initialDraft.body_text || '',
        header_type: initialDraft.header_type || 'none',
        header_value: initialDraft.header_value || '',
        footer_text: initialDraft.footer_text || '',
        buttons: Array.isArray(initialDraft.buttons) ? initialDraft.buttons : [],
        submit_to_meta: true,
      });
      setMetaStatus(null);
      setConfirmResubmit(null);
    } else {
      setForm(emptyForm);
      setMetaStatus(null);
      setConfirmResubmit(null);
    }
  }, [template, initialDraft, open]);

  const insertVariable = (num) => {
    setForm((f) => ({ ...f, body_text: f.body_text + `{{${num}}}` }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      toast.error('WhatsApp headers accept PNG or JPG only');
      return;
    }
    setUploading(true);
    try {
      const res = await templates.uploadHeader(file);
      setForm((f) => ({
        ...f,
        header_type: 'image',
        header_media_handle: res.data.header_media_handle || '',
        header_image_preview: res.data.header_image_preview,
        header_image_path: res.data.header_image_path,
        header_image_url: res.data.header_image_url,
      }));
      if (res.data.meta_warning) {
        toast.error(res.data.meta_warning, { duration: 8000 });
      } else if (!res.data.header_image_url) {
        toast('Set Public App URL in Settings for image headers in live sends', { icon: '⚠️' });
      } else {
        toast.success('Image uploaded successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSyncMeta = async () => {
    setSyncing(true);
    try {
      const res = await templates.syncMeta(template.id);
      setMetaStatus(res.data.template.meta_status);
      if (res.data.warning) {
        toast(res.data.warning, { icon: '⚠️' });
      } else {
        toast.success(`Meta status: ${res.data.template.meta_status}`);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitToMeta = async () => {
    if (form.header_type === 'image' && !form.header_image_path) {
      toast.error('Upload a logo/image for the header first');
      return;
    }
    if (needsMetaVersionWarning()) {
      setConfirmResubmit('resubmit');
      return;
    }
    await performSubmitToMeta();
  };

  const performSubmitToMeta = async () => {
    setConfirmResubmit(null);
    setLoading(true);
    try {
      const cleanedButtons = (form.buttons || []).filter((btn) => {
        if (!btn?.text?.trim()) return false;
        if (btn.type === 'URL') return Boolean(btn.url?.trim());
        if (btn.type === 'PHONE_NUMBER') return Boolean(btn.phone?.trim());
        return true;
      });
      await templates.update(template.id, {
        ...form,
        buttons: cleanedButtons,
        whatsapp_template_name: form.whatsapp_template_name || toTemplateName(form.name),
        variables: detectVariables(form.body_text),
      });
      const res = await templates.submitToMeta(template.id);
      setMetaStatus(res.data.template.meta_status);
      if (res.data.template.whatsapp_template_name) {
        setForm((f) => ({
          ...f,
          whatsapp_template_name: res.data.template.whatsapp_template_name,
          header_media_handle:
            res.data.template.header_media_handle || f.header_media_handle,
        }));
      }
      if (res.data.renamed) {
        toast.success(`Resubmitted to Meta as "${res.data.renamed}" (new version)`);
      } else {
        toast.success('Submitted to Meta for approval');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Meta submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.body_text.trim()) {
      toast.error('Body text is required');
      return;
    }
    if (form.header_type === 'image' && !form.header_image_path) {
      toast.error('Upload a logo/image for the header first');
      return;
    }

    if (isEdit && needsMetaVersionWarning()) {
      setConfirmResubmit('save');
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setConfirmResubmit(null);
    setLoading(true);
    try {
      const cleanedButtons = (form.buttons || []).filter((btn) => {
        if (!btn?.text?.trim()) return false;
        if (btn.type === 'URL') return Boolean(btn.url?.trim());
        if (btn.type === 'PHONE_NUMBER') return Boolean(btn.phone?.trim());
        return true;
      });
      const data = {
        ...form,
        buttons: cleanedButtons,
        whatsapp_template_name: form.whatsapp_template_name || toTemplateName(form.name),
        variables: detectVariables(form.body_text),
      };

      if (isEdit) {
        await templates.update(template.id, data);
        try {
          const res = await templates.submitToMeta(template.id);
          setMetaStatus(res.data.template.meta_status);
          if (res.data.renamed) {
            toast.success(`Saved and resubmitted to Meta as "${res.data.renamed}"`);
          } else {
            toast.success('Template saved and submitted to Meta for approval');
          }
        } catch (metaErr) {
          toast.error(
            metaErr.response?.data?.error ||
              'Saved locally, but Meta resubmit failed. Use Submit to Meta to retry.'
          );
        }
      } else {
        const res = await templates.create(data);
        if (res.data.metaError) {
          toast.error(`Saved locally but Meta error: ${res.data.metaError}`);
        } else if (form.submit_to_meta) {
          toast.success('Template saved and submitted to Meta for approval');
        } else {
          toast.success('Template saved locally');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const vars = detectVariables(form.body_text);

  return (
    <>
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Template' : 'Create Template'} wide>
      <form onSubmit={handleSubmit}>
        {isEdit && metaStatus && (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-sm text-gray-600">Meta status:</span>
              <StatusBadge status={metaStatus.toLowerCase()} />
              {template?.meta_rejection_reason && (
                <span className="text-xs text-red-500 break-words">{template.meta_rejection_reason}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <LoadingButton variant="outline" onClick={handleSyncMeta} loading={syncing} type="button">
                <RefreshCw size={14} /> Sync Status
              </LoadingButton>
              <LoadingButton onClick={handleSubmitToMeta} loading={loading} type="button">
                {isApprovedTemplate({ meta_status: metaStatus })
                  ? 'Resubmit to Meta'
                  : 'Submit to Meta'}
              </LoadingButton>
            </div>
          </div>
        )}

        {isEdit && needsMetaVersionWarning() && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            <strong>Editing a Meta template:</strong> Meta will receive a <strong>new version</strong> for
            re-approval. Your edits are not usable in campaigns until that new version is approved.
            To keep the old approved content as-is, cancel and create a separate new template instead.
          </div>
        )}

        {!isEdit && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            Templates are saved to your database <strong>and submitted to Meta</strong> for approval.
            You can send campaigns only after Meta status is <strong>APPROVED</strong> (usually 1–24 hours).
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name</label>
              <input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    whatsapp_template_name: f.whatsapp_template_name || toTemplateName(name),
                  }));
                }}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Template Name (Meta)</label>
              <input
                value={form.whatsapp_template_name}
                onChange={(e) =>
                  setForm({ ...form, whatsapp_template_name: toTemplateName(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm outline-none focus:ring-2 focus:ring-accent"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Lowercase, underscores only — sent to Meta</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <div className="space-y-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                      form.category === cat.value ? 'border-accent bg-accent/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={form.category === cat.value}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-sm">{cat.label}</p>
                      <p className="text-xs text-gray-500">{cat.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Message Body</label>
                <span className="text-xs text-gray-400">{form.body_text.length}/1024</span>
              </div>
              <textarea
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value.slice(0, 1024) })}
                rows={5}
                placeholder="Hello {{1}}, thank you for choosing us!"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-accent"
                required
              />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => insertVariable(1)} className="px-2 py-1 text-xs border rounded font-mono hover:bg-gray-50">
                  Insert {'{{1}}'}
                </button>
                <button type="button" onClick={() => insertVariable(2)} className="px-2 py-1 text-xs border rounded font-mono hover:bg-gray-50">
                  Insert {'{{2}}'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Header (Logo / Text)</label>
              <div className="flex gap-2 mb-2">
                {['none', 'text', 'image'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, header_type: t })}
                    className={`px-3 py-1 text-xs rounded-lg border capitalize ${
                      form.header_type === t ? 'bg-accent text-white border-accent' : 'hover:bg-gray-50'
                    }`}
                  >
                    {t === 'image' ? 'Logo / Image' : t}
                  </button>
                ))}
              </div>
              {form.header_type === 'text' && (
                <input
                  value={form.header_value}
                  onChange={(e) => setForm({ ...form, header_value: e.target.value })}
                  placeholder="Header text"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              )}
              {form.header_type === 'image' && (
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {form.header_image_preview ? (
                    <img src={form.header_image_preview} alt="Header" className="mx-auto h-24 object-contain mb-2" />
                  ) : null}
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Upload Logo / Image'}
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">PNG or JPG, max 5MB</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Footer (60 chars)</label>
              <input
                value={form.footer_text}
                onChange={(e) => setForm({ ...form, footer_text: e.target.value.slice(0, 60) })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Buttons (optional, max 3)</label>
                {form.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, buttons: [...f.buttons, { ...emptyButton }] }))}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium"
                  >
                    <Plus size={13} /> Add Button
                  </button>
                )}
              </div>
              {form.buttons.length === 0 && (
                <p className="text-xs text-gray-400">No buttons. Click "Add Button" to add a URL link, quick reply, or call button.</p>
              )}
              <div className="space-y-3">
                {form.buttons.map((btn, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={btn.type}
                        onChange={(e) => {
                          const type = e.target.value;
                          setForm((f) => ({
                            ...f,
                            buttons: f.buttons.map((b, i) =>
                              i === idx ? { ...b, type } : b
                            ),
                          }));
                        }}
                        className="text-xs border rounded px-2 py-1 bg-white"
                      >
                        {BUTTON_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            buttons: f.buttons.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="ml-auto text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      placeholder="Button label (e.g. Claim Now, Stop, Call Us)"
                      value={btn.text}
                      maxLength={25}
                      onChange={(e) => {
                        const text = e.target.value;
                        setForm((f) => ({
                          ...f,
                          buttons: f.buttons.map((b, i) =>
                            i === idx ? { ...b, text } : b
                          ),
                        }));
                      }}
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                    {btn.type === 'URL' && (
                      <input
                        placeholder="URL (e.g. https://yourbrand.com/offer)"
                        value={btn.url}
                        onChange={(e) => {
                          const url = e.target.value;
                          setForm((f) => ({
                            ...f,
                            buttons: f.buttons.map((b, i) =>
                              i === idx ? { ...b, url } : b
                            ),
                          }));
                        }}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    )}
                    {btn.type === 'PHONE_NUMBER' && (
                      <input
                        placeholder="Phone with country code (e.g. +919876543210)"
                        value={btn.phone}
                        onChange={(e) => {
                          const phone = e.target.value;
                          setForm((f) => ({
                            ...f,
                            buttons: f.buttons.map((b, i) =>
                              i === idx ? { ...b, phone } : b
                            ),
                          }));
                        }}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                URL = clickable link · Quick Reply = one-tap reply · Call = dial number
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500 mb-4">Live Preview</p>
            <WhatsAppPreview template={form} businessName={businessName} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-6 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Cancel</button>
          <LoadingButton type="submit" loading={loading} className="w-full sm:w-auto justify-center">
            {isEdit ? 'Save & Resubmit to Meta' : 'Save & Submit to Meta'}
          </LoadingButton>
        </div>
      </form>
    </Modal>

      <ConfirmDialog
        open={!!confirmResubmit}
        onClose={() => setConfirmResubmit(null)}
        onConfirm={() =>
          confirmResubmit === 'resubmit' ? performSubmitToMeta() : performSave()
        }
        title="New Meta version required"
        message={META_RESUBMIT_WARNING}
        confirmText="Save & send new version to Meta"
        loading={loading}
      />
    </>
  );
}
