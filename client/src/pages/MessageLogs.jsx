import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ScrollText } from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../components/Layout/TopBar';
import LoadingButton from '../components/shared/LoadingButton';
import Pagination from '../components/shared/Pagination';
import EmptyState from '../components/shared/EmptyState';
import ErrorCell from '../components/shared/ErrorCell';
import { dashboard, campaigns, downloadBlob } from '../lib/api';

function StatusIcon({ status }) {
  const colors = {
    pending: 'text-yellow-500',
    sent: 'text-gray-500',
    delivered: 'text-blue-500',
    read: 'text-purple-500',
    failed: 'text-red-500',
  };
  return (
    <span className={`capitalize text-xs font-medium ${colors[status] || 'text-gray-500'}`}>
      {status}
    </span>
  );
}

export default function MessageLogsPage() {
  const [logs, setLogs] = useState([]);
  const [todayStats, setTodayStats] = useState({});
  const [campaignList, setCampaignList] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboard.messageLogs({
        page,
        limit: 50,
        status: statusFilter,
        campaign_id: campaignFilter,
        date_from: dateFrom,
        date_to: dateTo,
        search,
      });
      setLogs(res.data.logs);
      setPages(res.data.pages);
      setTodayStats(res.data.todayStats || {});
    } catch {
      toast.error('Failed to load message logs');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, campaignFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    campaigns.list().then((r) => setCampaignList(r.data));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatTime = (d) =>
    d
      ? new Date(d).toLocaleString('en', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  const handleExport = async () => {
    if (campaignFilter) {
      try {
        const res = await campaigns.exportLogs(campaignFilter);
        downloadBlob(res.data, `logs_campaign_${campaignFilter}.xlsx`);
      } catch {
        toast.error('Export failed');
      }
    } else {
      toast.error('Select a campaign to export filtered logs');
    }
  };

  return (
    <div>
      <TopBar title="Message Logs">
        <LoadingButton variant="outline" onClick={handleExport}>
          <Download size={16} /> Export
        </LoadingButton>
      </TopBar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sent Today', key: 'sent' },
          { label: 'Delivered Today', key: 'delivered' },
          { label: 'Read Today', key: 'read' },
          { label: 'Failed Today', key: 'failed' },
        ].map((s) => (
          <div key={s.key} className="bg-white rounded-xl p-4 border shadow-sm">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{todayStats[s.key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={campaignFilter}
              onChange={(e) => {
                setCampaignFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto min-w-0 sm:min-w-[160px]"
            >
              <option value="">All Campaigns</option>
              {campaignList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1">
              {['', 'sent', 'delivered', 'read', 'failed'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${
                    statusFilter === s
                      ? 'bg-accent text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[140px]"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[140px]"
            />

            <div className="relative flex-1 min-w-[180px] w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No message logs"
            message="Logs will appear here when you send campaigns"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Campaign</th>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Sent</th>
                    <th className="text-left px-4 py-3 font-medium">Delivered</th>
                    <th className="text-left px-4 py-3 font-medium">Read</th>
                    <th className="text-left px-4 py-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{log.campaign_name || `#${log.campaign_id}`}</td>
                      <td className="px-4 py-3 font-medium">{log.contact_name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.contact_phone}</td>
                      <td className="px-4 py-3">
                        <StatusIcon status={log.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatTime(log.sent_at)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatTime(log.delivered_at)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatTime(log.read_at)}</td>
                      <td className="px-4 py-3 align-top">
                        <ErrorCell message={log.error_message} maxWidthClass="max-w-[320px]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
