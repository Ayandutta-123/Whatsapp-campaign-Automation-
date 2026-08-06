import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Users, Megaphone, Send, TrendingUp } from 'lucide-react';
import TopBar from '../components/Layout/TopBar';
import StatusBadge from '../components/shared/StatusBadge';
import { dashboard } from '../lib/api';
import { usePolling } from '../hooks/usePolling';

function StatCard({ icon: Icon, label, value, suffix, delayClass = '' }) {
  return (
    <div className={`ht-card p-4 sm:p-6 ht-animate-in ${delayClass}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
          <Icon size={22} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
          <p className="font-display text-xl sm:text-2xl font-bold text-gray-900">
            {value}
            {suffix && <span className="text-base sm:text-lg font-medium text-gray-500">{suffix}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, chartRes, recentRes] = await Promise.all([
        dashboard.stats(),
        dashboard.chart(),
        dashboard.recentCampaigns(),
      ]);
      setStats(statsRes.data);
      setChart(
        chartRes.data.map((d) => ({
          ...d,
          label: new Date(d.date).toLocaleDateString('en', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        }))
      );
      setRecent(recentRes.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  usePolling(fetchAll, 30000, true);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

  return (
    <div>
      {stats?.activeCampaigns > 0 && (
        <button
          onClick={() => navigate('/campaigns')}
          className="w-full mb-6 px-4 py-3 bg-orange-100 border border-orange-300 rounded-xl text-orange-800 text-sm font-medium flex items-center justify-center gap-2 animate-pulse"
        >
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse-dot" />
          Sending in progress — click to view
        </button>
      )}

      <TopBar title="Dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard icon={Users} label="Total Contacts" value={stats?.totalContacts ?? '-'} delayClass="ht-animate-in-delay-1" />
        <StatCard
          icon={Megaphone}
          label="Campaigns This Month"
          value={stats?.campaignsThisMonth ?? '-'}
          delayClass="ht-animate-in-delay-2"
        />
        <StatCard
          icon={Send}
          label="Messages Sent"
          value={stats?.messagesSentThisMonth ?? '-'}
          delayClass="ht-animate-in-delay-3"
        />
        <StatCard
          icon={TrendingUp}
          label="Delivery Rate"
          value={stats?.deliveryRate ?? '-'}
          suffix="%"
          delayClass="ht-animate-in-delay-4"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold mb-4">Messages Sent (Last 7 Days)</h3>
          <div className="h-[220px] sm:h-[250px] xl:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#ff6002" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">Recent Campaigns</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Template</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Sent</th>
                  <th className="text-left px-4 py-3 font-medium">Rate</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">{c.template_name || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} pulse />
                    </td>
                    <td className="px-4 py-3">{c.sent_count}/{c.total_contacts}</td>
                    <td className="px-4 py-3">{c.delivery_rate}%</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/campaigns/${c.id}`)}
                        className="text-accent hover:underline text-xs font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No campaigns yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
