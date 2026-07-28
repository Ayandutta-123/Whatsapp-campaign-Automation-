import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export function useContacts(initialParams = {}) {
  const [data, setData] = useState({ contacts: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState(initialParams);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/contacts', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return { ...data, loading, params, setParams, refresh: fetchContacts };
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/campaigns');
      setCampaigns(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, loading, refresh: fetchCampaigns };
}
