import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../components/Layout/TopBar';
import LoadingButton from '../components/shared/LoadingButton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import CampaignTable from '../components/Campaigns/CampaignTable';
import CreateCampaignWizard from '../components/Campaigns/CreateCampaignWizard';
import { campaigns as campaignsApi } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { formatApiError } from '../lib/formatError';

export default function CampaignsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [deleteCampaign, setDeleteCampaign] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedIds = (searchParams.get('ids') || '')
    .split(',')
    .filter(Boolean)
    .map(Number);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await campaignsApi.list();
      setList(res.data);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    if (searchParams.get('create') === 'true') {
      setShowWizard(true);
    }
  }, [fetchCampaigns, searchParams]);

  const hasActiveCampaign = list.some((c) => c.status === 'sending');
  usePolling(fetchCampaigns, 10000, hasActiveCampaign);

  const handleSend = async (id) => {
    setSendingId(id);
    try {
      await campaignsApi.send(id);
      toast.success('Campaign started!');
      navigate(`/campaigns/${id}`);
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to send'));
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await campaignsApi.delete(deleteCampaign.id);
      toast.success('Campaign deleted');
      setDeleteCampaign(null);
      fetchCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreated = (id, sendNow) => {
    fetchCampaigns();
    if (sendNow) navigate(`/campaigns/${id}`);
  };

  return (
    <div>
      <TopBar title="Campaigns">
        <LoadingButton onClick={() => setShowWizard(true)}>
          <Plus size={16} /> Create Campaign
        </LoadingButton>
      </TopBar>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            message="Create your first WhatsApp campaign"
            action={() => setShowWizard(true)}
            actionLabel="Create Campaign"
          />
        ) : (
          <CampaignTable
            campaigns={list}
            onSend={handleSend}
            onDelete={setDeleteCampaign}
            sendingId={sendingId}
          />
        )}
      </div>

      <CreateCampaignWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleCreated}
        preselectedIds={preselectedIds}
      />

      <ConfirmDialog
        open={!!deleteCampaign}
        onClose={() => setDeleteCampaign(null)}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message="This will permanently delete the campaign and all message logs."
        confirmText="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
