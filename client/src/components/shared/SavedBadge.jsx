import { CheckCircle2, XCircle } from 'lucide-react';

/** Prominent inline badge showing whether a secret/config value is saved on the server. */
export default function SavedBadge({ saved, savedLabel = 'Saved', missingLabel = 'Not added' }) {
  if (saved) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        <CheckCircle2 size={12} strokeWidth={2.5} />
        {savedLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
      <XCircle size={12} strokeWidth={2.5} />
      {missingLabel}
    </span>
  );
}
