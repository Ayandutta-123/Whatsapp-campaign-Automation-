import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
  X,
  Search,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingButton from '../components/shared/LoadingButton';
import Pagination from '../components/shared/Pagination';
import ErrorCell from '../components/shared/ErrorCell';
import { campaigns, downloadBlob } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { useNotifications } from '../context/NotificationContext';

function StatusIcon({ status }) {
  switch (status) {
    case 'pending':
      return <Clock size={16} className="text-yellow-500" />;
    case 'sent':
      return <Check size={16} className="text-gray-500" />;
    case 'delivered':
      return <CheckCheck size={16} className="text-blue-500" />;
    case 'read':
      return <CheckCheck size={16} className="text-purple-500" />;
    case 'failed':
      return <X size={16} className="text-red-500" />;
    default:
      return <Clock size={16} className="text-gray-400" />;
  }
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [sending, setSending] = useState(false);
  const prevStatusRef = useRef(null);
  // Track when campaign completed so we keep polling for webhook deliveries
  const completedAtRef = useRef(null);
  const { notify } = useNotifications();

  // Reset stale refs when navigating between different campaigns (React Router reuses component)
  useEffect(() => {
    prevStatusRef.current = null;
    completedAtRef.current = null;
    setCampaign(null);
    setProgress(null);
    setLogs([]);
  }, [id]);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await campaigns.get(id);
      setCampaign(res.data);
      return res.data;
    } catch {
      toast.error('Failed to load campaign');
      return null;
    }
  }, [id]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await campaigns.logs(id, {
        page: logPage,
        limit: 50,
        status: statusFilter,
        search,
      });
      setLogs(res.data.logs);
      setLogPages(res.data.pages);
    } catch {
      toast.error('Failed to load logs');
    }
  }, [id, logPage, statusFilter, search]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await campaigns.progress(id);
      setProgress(res.data);
      // Always refresh logs during send so rows update pending→sent/failed in real-time (fix H-A)
      if (res.data.status === 'sending') {
        fetchLogs();
      }

      if (
        prevStatusRef.current === 'sending' &&
        (res.data.status === 'completed' || res.data.status === 'failed')
      ) {
        completedAtRef.current = Date.now(); // start post-completion webhook window (fix H-B)
        const failed = Number(res.data.failed_count) || 0;
        const sent = Number(res.data.sent_count) || 0;
        if (failed > 0 && sent === 0) {
          notify.error(
            'Campaign send failed',
            `0 sent, ${failed} failed. Open the Error column for the full Meta reason.`
          );
        } else if (failed > 0) {
          notify.warning('Campaign finished with failures', `${sent} sent, ${failed} failed`);
        } else {
          notify.success('Campaign sent', `${sent} messages accepted by Meta`);
        }
        fetchCampaign();
        fetchLogs();
      }
      prevStatusRef.current = res.data.status;
    } catch {
      /* ignore */
    }
  }, [id, fetchCampaign, fetchLogs]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCampaign(), fetchProgress()]);
      setLoading(false);
    };
    load();
  }, [id, fetchCampaign, fetchProgress]);

  useEffect(() => {
    if (!loading) fetchLogs();
  }, [logPage, statusFilter, search, fetchLogs, loading]);

  // Sending: poll every 3s (fast — refreshes both progress and logs each tick)
  usePolling(fetchProgress, 3000, campaign?.status === 'sending');

  // Post-completion: poll every 8s for 3 minutes to receive webhook delivered/read updates (fix H-B)
  useEffect(() => {
    const WATCH_MS = 3 * 60 * 1000;
    if (campaign?.status !== 'completed' && campaign?.status !== 'failed') return;
    completedAtRef.current = completedAtRef.current || Date.now();
    const elapsed = Date.now() - completedAtRef.current;
    if (elapsed >= WATCH_MS) return;
    const remaining = WATCH_MS - elapsed;
    const id = setInterval(() => {
      const now = Date.now();
      if (now - completedAtRef.current >= WATCH_MS) {
        clearInterval(id);
        return;
      }
      fetchProgress();
      fetchLogs();
    }, 8000);
    const stopTimeout = setTimeout(() => clearInterval(id), remaining);
    return () => { clearInterval(id); clearTimeout(stopTimeout); };
  }, [campaign?.status, fetchProgress, fetchLogs]);

  const pct = (count, total) => (total ? Math.round((count / total) * 100) : 0);

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
    try {
      const res = await campaigns.exportLogs(id);
      downloadBlob(res.data, `campaign_${id}_logs.xlsx`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleResendFailed = async () => {
    setResending(true);
    try {
      const res = await campaigns.resendFailed(id);
      notify.success('Retry started', 'Failed messages are being resent now');
      navigate(`/campaigns/${res.data.id}`);
    } catch (err) {
      notify.error('Resend failed', err.response?.data?.error || 'No failed messages to resend');
    } finally {
      setResending(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      await campaigns.send(id);
      notify.success('Sending started', 'Pending messages are going out now');
      prevStatusRef.current = 'sending';
      await fetchCampaign();
      await fetchProgress();
      await fetchLogs();
    } catch (err) {
      notify.error('Send failed', err.response?.data?.error || 'Could not start send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Campaign not found</p>
        <button
          onClick={() => navigate('/campaigns')}
          className="text-accent hover:underline"
        >
          Back to Campaigns
        </button>
      </div>
    );
  }

  const p = progress || campaign;
  const total = p?.total_contacts || 0;
  const sentProgress = total ? Math.round(((p?.sent_count || 0) / total) * 100) : 0;
  const deliveryRate = p?.sent_count
    ? Math.round(((p?.delivered_count || 0) / p.sent_count) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/campaigns')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{campaign?.name}</h1>
            <StatusBadge status={campaign?.status} pulse />
            {campaign?.sender_mode === 'fixed' && campaign?.sender_label && (
              <p className="text-xs text-gray-500 mt-1">
                Sending from: {campaign.sender_label}
                {campaign.sender_display_phone ? ` (${campaign.sender_display_phone})` : ''}
              </p>
            )}
            {campaign?.sender_mode !== 'fixed' && (
              <p className="text-xs text-gray-500 mt-1">Sending: auto by contact country</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <LoadingButton variant="outline" onClick={handleExport}>
            <Download size={16} /> Export Logs
          </LoadingButton>
          {(campaign?.status === 'draft' || campaign?.status === 'scheduled') && (
            <LoadingButton onClick={handleSendNow} loading={sending}>
              <Send size={16} /> Send Now
            </LoadingButton>
          )}
          {(campaign?.failed_count > 0 || p?.failed_count > 0) && (
            <LoadingButton onClick={handleResendFailed} loading={resending}>
              <RefreshCw size={16} /> Resend Failed
            </LoadingButton>
          )}
        </div>
      </div>

      {campaign?.status === 'sending' && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-medium text-orange-800 mb-2">
            Sending {p?.sent_count || 0} of {total} messages
          </p>
          <div className="h-4 bg-orange-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent progress-striped rounded-full transition-all duration-500"
              style={{ width: `${sentProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sent', count: p?.sent_count, color: 'blue' },
          { label: 'Delivered', count: p?.delivered_count, color: 'green' },
          { label: 'Read', count: p?.read_count, color: 'purple' },
          { label: 'Failed', count: p?.failed_count, color: 'red' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 border shadow-sm">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{s.count || 0}</p>
            <p className="text-xs text-gray-400">{pct(s.count, total)}% of total</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-5 border shadow-sm mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Delivery Rate: {deliveryRate}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${deliveryRate}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {['', 'sent', 'delivered', 'read', 'failed'].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => {
                  setStatusFilter(s);
                  setLogPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${
                  statusFilter === s
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLogPage(1);
              }}
              placeholder="Search by name or phone..."
              className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Sent At</th>
                <th className="text-left px-4 py-3 font-medium">Delivered At</th>
                <th className="text-left px-4 py-3 font-medium">Read At</th>
                <th className="text-left px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{log.contact_name || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.contact_phone}</td>
                  <td className="px-4 py-3">{log.company || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5" title={log.error_message || ''}>
                      <StatusIcon status={log.status} />
                      <span className="capitalize">{log.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatTime(log.sent_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatTime(log.delivered_at)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatTime(log.read_at)}</td>
                  <td className="px-4 py-3 align-top">
                    <ErrorCell message={log.error_message} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={logPage} pages={logPages} onPageChange={setLogPage} />
      </div>
    </div>
  );
}
