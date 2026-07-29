import axios from 'axios';
import { apiBaseUrl } from './appOrigin';

// Relative /api paths — same origin in production; Vite dev server proxies to the backend.
// VITE_API_BASE_URL overrides this when the UI and API are on different hosts.
const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requireLogin = localStorage.getItem('require_login') !== 'false';
      if (requireLogin) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const auth = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  me: () => api.get('/api/auth/me'),
};

export const contacts = {
  list: (params) => api.get('/api/contacts', { params }),
  create: (data) => api.post('/api/contacts', data),
  update: (id, data) => api.patch(`/api/contacts/${id}`, data),
  delete: (id) => api.delete(`/api/contacts/${id}`),
  bulkDelete: (ids) => api.delete('/api/contacts/bulk', { data: { ids } }),
  import: (file, defaultCountryCode) => {
    const form = new FormData();
    form.append('file', file);
    if (defaultCountryCode) {
      form.append('default_country_code', defaultCountryCode);
    }
    return api.post('/api/contacts/import', form);
  },
  export: () =>
    api.get('/api/contacts/export', { responseType: 'blob' }),
  tags: () => api.get('/api/contacts/tags'),
};

export const templates = {
  list: () => api.get('/api/templates'),
  create: (data) => api.post('/api/templates', data),
  update: (id, data) => api.patch(`/api/templates/${id}`, data),
  delete: (id) => api.delete(`/api/templates/${id}`),
  preview: (template_id, contact_id) =>
    api.post('/api/templates/preview', { template_id, contact_id }),
  uploadHeader: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/api/templates/upload-header', form);
  },
  submitToMeta: (id) => api.post(`/api/templates/${id}/submit-meta`),
  syncMeta: (id) => api.post(`/api/templates/${id}/sync-meta`),
  syncAllMeta: () => api.post('/api/templates/sync-all-meta'),
  importMeta: () => api.post('/api/templates/import-meta'),
  metaList: () => api.get('/api/templates/meta/list'),
};

export const ai = {
  chat: (messages) => api.post('/api/ai/chat', { messages }),
};

export const campaigns = {
  list: () => api.get('/api/campaigns'),
  get: (id) => api.get(`/api/campaigns/${id}`),
  create: (data) => api.post('/api/campaigns', data),
  send: (id) => api.post(`/api/campaigns/${id}/send`),
  progress: (id) => api.get(`/api/campaigns/${id}/progress`),
  logs: (id, params) => api.get(`/api/campaigns/${id}/logs`, { params }),
  exportLogs: (id) =>
    api.get(`/api/campaigns/${id}/export`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/api/campaigns/${id}`),
  resendFailed: (id) => api.post(`/api/campaigns/${id}/resend-failed`),
};

export const settings = {
  get: () => api.get('/api/settings'),
  update: (key, value) => api.patch('/api/settings', { key, value }),
  testConnection: () => api.post('/api/settings/test-connection'),
  registerPhone: (pin) => api.post('/api/settings/register-phone', { pin }),
  changePassword: (data) => api.post('/api/settings/change-password', data),
  createBackup: () => api.post('/api/settings/backup'),
  listBackups: () => api.get('/api/settings/backups'),
  downloadBackup: (filename) =>
    api.get(`/api/settings/backups/${filename}`, { responseType: 'blob' }),
  clearOldLogs: () => api.post('/api/settings/clear-old-logs'),
  exportCampaigns: () =>
    api.get('/api/settings/export-campaigns', { responseType: 'blob' }),
};

export const senders = {
  list: () => api.get('/api/senders'),
  create: (data) => api.post('/api/senders', data),
  update: (id, data) => api.patch(`/api/senders/${id}`, data),
  delete: (id) => api.delete(`/api/senders/${id}`),
};

export const notifications = {
  list: (params) => api.get('/api/notifications', { params }),
  unreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
  clearRead: () => api.delete('/api/notifications/read'),
  clearAll: () => api.delete('/api/notifications/all'),
};

export const dashboard = {
  stats: () => api.get('/api/dashboard/stats'),
  chart: () => api.get('/api/dashboard/chart'),
  recentCampaigns: () => api.get('/api/dashboard/recent-campaigns'),
  messageLogs: (params) => api.get('/api/dashboard/message-logs', { params }),
};

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
