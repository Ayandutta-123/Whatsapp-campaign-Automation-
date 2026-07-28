const styles = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-50 text-blue-600',
  delivered: 'bg-green-50 text-green-600',
  read: 'bg-purple-50 text-purple-600',
  approved: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  disabled: 'bg-red-100 text-red-700',
  not_found: 'bg-gray-100 text-gray-600',
  paused: 'bg-orange-100 text-orange-700',
  flagged: 'bg-orange-100 text-orange-700',
};

const labels = {
  approved: 'Approved',
  active: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  disabled: 'Disabled',
  paused: 'Paused',
  not_found: 'Not Found',
  flagged: 'Flagged',
};

export default function StatusBadge({ status, pulse }) {
  const key = (status || '').toLowerCase();
  const cls = styles[key] || 'bg-gray-100 text-gray-700';
  const label = labels[key] || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {pulse && key === 'sending' && (
        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse-dot" />
      )}
      {label}
    </span>
  );
}
