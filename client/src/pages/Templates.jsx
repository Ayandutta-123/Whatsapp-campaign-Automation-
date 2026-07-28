import { useState, useEffect } from 'react';
import { Plus, FileText, ExternalLink, DownloadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../components/Layout/TopBar';
import LoadingButton from '../components/shared/LoadingButton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import TemplateCard from '../components/Templates/TemplateCard';
import TemplateModal from '../components/Templates/TemplateModal';
import TemplateAIChat from '../components/Templates/TemplateAIChat';
import WhatsAppPreview from '../components/Templates/WhatsAppPreview';
import Modal from '../components/shared/Modal';
import { templates, contacts, settings } from '../lib/api';

export default function TemplatesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [deleteTemplate, setDeleteTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewContact, setPreviewContact] = useState(null);
  const [contactList, setContactList] = useState([]);
  const [previewText, setPreviewText] = useState('');
  const [businessName, setBusinessName] = useState('WhatsApp Campaign Automation');
  const [wabaId, setWabaId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [aiDraft, setAiDraft] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templates.list();
      setList(res.data);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [listRes, settingsRes] = await Promise.all([
          templates.list(),
          settings.get(),
        ]);
        if (cancelled) return;
        if (settingsRes.data.business_name) setBusinessName(settingsRes.data.business_name);
        if (settingsRes.data.waba_id) setWabaId(settingsRes.data.waba_id);

        let rows = listRes.data || [];
        // Auto-pull Meta templates when local library is empty (don't block UI forever)
        if (rows.length === 0 && settingsRes.data.waba_id) {
          try {
            const imported = await Promise.race([
              templates.importMeta(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Meta sync timeout')), 12000)
              ),
            ]);
            rows = imported.data.templates || [];
            const s = imported.data.summary || {};
            if (s.imported || s.updated) {
              toast.success(`Loaded ${s.imported + s.updated} template(s) from Meta`);
            }
          } catch {
            /* user can click Sync from Meta */
          }
        }
        setList(rows);
      } catch {
        if (!cancelled) toast.error('Failed to load templates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPreview = async (template) => {
    setPreviewTemplate(template);
    try {
      const res = await contacts.list({ limit: 100 });
      setContactList(res.data.contacts);
      if (res.data.contacts.length > 0) {
        setPreviewContact(res.data.contacts[0].id);
        loadPreview(template.id, res.data.contacts[0].id);
      }
    } catch {
      toast.error('Failed to load contacts for preview');
    }
  };

  const loadPreview = async (templateId, contactId) => {
    try {
      const res = await templates.preview(templateId, contactId);
      setPreviewText(res.data.preview);
    } catch {
      setPreviewText(previewTemplate?.body_text || '');
    }
  };

  const handleSyncFromMeta = async () => {
    setSyncingAll(true);
    try {
      const res = await templates.syncAllMeta();
      const { imported = 0, updated = 0, synced = 0, metaTotal = 0, errors = 0 } =
        res.data.summary || {};
      if (errors > 0) {
        toast.error(`Synced with ${errors} error(s). Imported ${imported}, updated ${updated}.`);
      } else if (metaTotal === 0) {
        toast('No templates found on Meta for this WABA', { icon: '⚠️' });
      } else {
        toast.success(
          `Meta sync complete: ${imported} new, ${updated} updated (${synced} status checks)`
        );
      }
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync from Meta failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncOne = async (template) => {
    setSyncingId(template.id);
    try {
      const res = await templates.syncMeta(template.id);
      if (res.data.warning) {
        toast(res.data.warning, { icon: '⚠️' });
      } else {
        toast.success(`${template.name}: ${res.data.template.meta_status}`);
      }
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await templates.delete(deleteTemplate.id);
      toast.success('Template deleted');
      setDeleteTemplate(null);
      fetchTemplates();
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const handleUseAiTemplate = (draft) => {
    setAiDraft(draft);
    setEditTemplate(null);
    setShowModal(true);
  };

  const metaManagerUrl = wabaId
    ? `https://business.facebook.com/latest/whatsapp_manager/message_templates/?waba_id=${wabaId}`
    : 'https://business.facebook.com/wa/manage/message-templates/';

  return (
    <div>
      <TopBar title="Templates">
        {wabaId && (
          <a
            href={metaManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ht-btn ht-btn-outline inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl"
          >
            <ExternalLink size={14} /> Meta Manager
          </a>
        )}
        <LoadingButton variant="outline" onClick={handleSyncFromMeta} loading={syncingAll}>
          <DownloadCloud size={16} /> Sync from Meta
        </LoadingButton>
        <LoadingButton
          onClick={() => {
            setAiDraft(null);
            setEditTemplate(null);
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add Template
        </LoadingButton>
      </TopBar>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          message="Sync approved templates from Meta, create one manually, or ask Claude to draft one"
          action={handleSyncFromMeta}
          actionLabel={syncingAll ? 'Syncing…' : 'Sync from Meta'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={(tmpl) => {
                setAiDraft(null);
                setEditTemplate(tmpl);
                setShowModal(true);
              }}
              onPreview={openPreview}
              onDelete={setDeleteTemplate}
              onSync={handleSyncOne}
              syncing={syncingId}
            />
          ))}
        </div>
      )}

      <TemplateModal
        open={showModal}
        template={editTemplate}
        initialDraft={aiDraft}
        businessName={businessName}
        onClose={() => {
          setShowModal(false);
          setEditTemplate(null);
          setAiDraft(null);
        }}
        onSaved={fetchTemplates}
      />

      <TemplateAIChat onUseTemplate={handleUseAiTemplate} />

      <Modal
        open={!!previewTemplate}
        onClose={() => {
          setPreviewTemplate(null);
          setPreviewText('');
        }}
        title="Template Preview"
      >
        {previewTemplate && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Contact</label>
              <select
                value={previewContact || ''}
                onChange={(e) => {
                  setPreviewContact(Number(e.target.value));
                  loadPreview(previewTemplate.id, Number(e.target.value));
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {contactList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone} — {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <WhatsAppPreview
              template={{
                ...previewTemplate,
                body_text: previewText || previewTemplate.body_text,
              }}
              businessName={businessName}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTemplate}
        onClose={() => setDeleteTemplate(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure? Campaigns using this template may be affected."
        confirmText="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
