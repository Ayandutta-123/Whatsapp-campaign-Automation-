import { Eye, Send, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import LoadingButton from '../shared/LoadingButton';

export default function CampaignTable({ campaigns, onSend, onDelete, sendingId }) {
  const navigate = useNavigate();

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  const progress = (c) => {
    if (!c.total_contacts) return 0;
    return Math.round(((c.sent_count || 0) / c.total_contacts) * 100);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium">Template</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Scheduled</th>
            <th className="text-left px-4 py-3 font-medium">Progress</th>
            <th className="text-left px-4 py-3 font-medium">Delivery</th>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-gray-500">{c.template_name || '-'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} pulse />
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDate(c.scheduled_at)}</td>
              <td className="px-4 py-3 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${progress(c)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {c.sent_count}/{c.total_contacts}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">{c.delivery_rate || 0}%</td>
              <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                    title="View"
                  >
                    <Eye size={14} />
                  </button>
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <LoadingButton
                      variant="outline"
                      onClick={() => onSend(c.id)}
                      loading={sendingId === c.id}
                      className="!px-2 !py-1"
                    >
                      <Send size={14} />
                    </LoadingButton>
                  )}
                  <button
                    onClick={() => onDelete(c)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
