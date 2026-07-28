import { Pencil, Eye, Trash2, RefreshCw } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import { isApprovedTemplate, normalizeMetaStatus } from '../../lib/templateStatus';

const STATUS_HELP = {
  approved: { color: 'text-green-600', msg: 'Ready for campaigns' },
  active:   { color: 'text-green-600', msg: 'Ready for campaigns' },
  pending:  { color: 'text-yellow-600', msg: 'Waiting for Meta approval (1–24 hrs)' },
  rejected: { color: 'text-red-500',   msg: 'Rejected by Meta — edit and resubmit' },
  disabled: { color: 'text-red-500',   msg: 'Disabled by Meta' },
  paused:   { color: 'text-orange-600', msg: 'Paused by Meta due to quality' },
  flagged:  { color: 'text-orange-600', msg: 'Flagged for quality review' },
  draft:    { color: 'text-gray-500',  msg: 'Not submitted to Meta yet' },
  failed:   { color: 'text-red-500',   msg: 'Submission to Meta failed — try Submit to Meta' },
};

export default function TemplateCard({ template, onEdit, onPreview, onDelete, onSync, syncing }) {
  const vars = template.variables || [];
  const bodyPreview = (template.body_text || '').slice(0, 120);
  const statusKey = normalizeMetaStatus(template.meta_status) || 'draft';
  const help = STATUS_HELP[statusKey] || { color: 'text-gray-500', msg: '' };

  return (
    <div className="ht-card bg-white rounded-xl border border-gray-100/80 shadow-sm p-5 flex flex-col ht-animate-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{template.name}</h3>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              {template.category}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs uppercase">
              {template.language}
            </span>
          </div>
        </div>
        {onSync && (
          <button
            onClick={() => onSync(template)}
            disabled={syncing === template.id}
            title="Sync status from Meta"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-accent disabled:opacity-40"
          >
            <RefreshCw size={14} className={syncing === template.id ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600 mb-3 inline-block">
        {template.whatsapp_template_name}
      </code>

      {template.meta_status && (
        <div className="mb-3">
          <StatusBadge status={statusKey} />
          {help.msg && (
            <p className={`text-xs mt-1 ${help.color}`}>{help.msg}</p>
          )}
          {template.meta_rejection_reason && (
            <p className="text-xs text-red-400 mt-1 truncate" title={template.meta_rejection_reason}>
              {template.meta_rejection_reason}
            </p>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600 line-clamp-3 mb-3 flex-1">{bodyPreview}</p>

      {vars.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {vars.map((v) => (
            <span key={v} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-mono">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 text-xs text-gray-400 mb-4">
        {template.header_type !== 'none' && (
          <span>Header: {template.header_type}</span>
        )}
        {template.footer_text && <span>Footer ✓</span>}
        {template.button_text && <span>Button ✓</span>}
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onEdit(template)}
          className="ht-btn ht-btn-outline flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-xl"
        >
          <Pencil size={14} /> Edit
        </button>
        <button
          onClick={() => onPreview(template)}
          className="ht-btn ht-btn-outline flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-xl"
        >
          <Eye size={14} /> Preview
        </button>
        <button
          onClick={() => onDelete(template)}
          className="ht-btn px-3 py-2 text-sm border border-red-200 text-red-500 rounded-xl hover:bg-red-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
