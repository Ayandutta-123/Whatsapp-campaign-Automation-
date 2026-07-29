import { useState, useEffect } from 'react';
import { Copy, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import TopBar from '../components/Layout/TopBar';
import LoadingButton from '../components/shared/LoadingButton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SavedBadge from '../components/shared/SavedBadge';
import SenderNumbersSection from '../components/Settings/SenderNumbersSection';
import { settings, contacts, senders, downloadBlob } from '../lib/api';
import { getWebhookUrl } from '../lib/appOrigin';

export default function SettingsPage() {
  const [data, setData] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [senderList, setSenderList] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [webhookToken, setWebhookToken] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [requireLogin, setRequireLogin] = useState(false);
  const [sendDelay, setSendDelay] = useState(1000);
  const [dailyLimit, setDailyLimit] = useState(1000);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerPin, setRegisterPin] = useState('');
  const [saving, setSaving] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });

  const loadSettings = async ({ silent = false } = {}) => {
    if (!silent) setLoadingSettings(true);
    try {
      const res = await settings.get();
      setData(res.data);
      setPhoneNumberId(res.data.phone_number_id || '');
      setWabaId(res.data.waba_id || '');
      setMetaAppId(res.data.meta_app_id || '');
      setMetaAppSecret('');
      setPublicBaseUrl(res.data.public_base_url || '');
      setWebhookToken('');
      setBusinessName(res.data.business_name || '');
      setAnthropicKey('');
      setRequireLogin(res.data.require_login === 'true');
      setSendDelay(parseInt(res.data.send_delay_ms, 10) || 1000);
      setDailyLimit(parseInt(res.data.daily_send_limit, 10) || 1000);
      setTokenValue('');
      setLoadError(null);
    } catch (err) {
      const status = err.response?.status;
      const apiMsg = err.response?.data?.error;
      let msg = apiMsg || err.message || 'Failed to load settings';
      if (status === 429) {
        msg =
          'Too many requests — wait a few seconds and tap Retry. (This is temporary rate limiting, not missing data.)';
      } else if (status === 401) {
        msg = 'Session expired — please sign in again.';
      } else if (!err.response) {
        msg = 'Cannot reach the API server. Check that the backend is running.';
      }
      setLoadError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoadingSettings(false);
    }
  };

  const refreshSenders = () => {
    senders.list().then((r) => setSenderList(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadSettings();
    refreshSenders();
    settings.listBackups().then((r) => setBackups(r.data)).catch(() => {});
  }, []);

  const saveSetting = async (key, value, label) => {
    setSaving(key);
    try {
      await settings.update(key, String(value));
      toast.success(`${label || key} saved`);
      await loadSettings({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving('');
    }
  };

  const handleTokenFocus = () => {
    setShowToken(true);
  };

  const handleSaveWhatsApp = async () => {
    setSaving('whatsapp_token');
    try {
      const updates = [
        settings.update('phone_number_id', phoneNumberId),
        settings.update('waba_id', wabaId),
        settings.update('meta_app_id', metaAppId),
        settings.update('public_base_url', publicBaseUrl),
      ];
      if (tokenValue.trim() && !tokenValue.includes('•')) {
        updates.unshift(settings.update('whatsapp_token', tokenValue.trim()));
      }
      if (metaAppSecret.trim() && !metaAppSecret.includes('•')) {
        updates.push(settings.update('meta_app_secret', metaAppSecret.trim()));
      }
      await Promise.all(updates);
      toast.success('WhatsApp API settings saved');
      await loadSettings({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving('');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (tokenValue.trim() && !tokenValue.includes('•')) {
        await settings.update('whatsapp_token', tokenValue.trim());
      }
      if (phoneNumberId) await settings.update('phone_number_id', phoneNumberId);
      if (wabaId) await settings.update('waba_id', wabaId);
      if (metaAppId) await settings.update('meta_app_id', metaAppId);
      const res = await settings.testConnection();
      setTestResult(res.data);
    } catch {
      setTestResult({ success: false, error: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleRegisterPhone = async () => {
    if (!/^\d{6}$/.test(registerPin.trim())) {
      toast.error('Enter a 6-digit PIN');
      return;
    }
    setRegistering(true);
    try {
      const res = await settings.registerPhone(registerPin.trim());
      toast.success(res.data.message || 'Phone registered');
      setRegisterPin('');
      const test = await settings.testConnection();
      setTestResult(test.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl(publicBaseUrl));
    toast.success('Webhook URL copied');
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const res = await settings.clearOldLogs();
      toast.success(`Deleted ${res.data.deleted} old logs`);
      setShowClearConfirm(false);
    } catch {
      toast.error('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  const handleExportContacts = async () => {
    try {
      const res = await contacts.export();
      downloadBlob(res.data, 'contacts_export.xlsx');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleExportCampaigns = async () => {
    try {
      const res = await settings.exportCampaigns();
      downloadBlob(res.data, 'campaigns_summary.xlsx');
    } catch {
      toast.error('Export failed');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPass !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await settings.changePassword({
        current_password: passwords.current,
        new_password: passwords.newPass,
        confirm_password: passwords.confirm,
      });
      toast.success('Password updated — please sign in again');
      setPasswords({ current: '', newPass: '', confirm: '' });
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
      return;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };


  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const res = await settings.createBackup();
      toast.success(`Backup created: ${res.data.filename}`);
      const list = await settings.listBackups();
      setBackups(list.data);
    } catch {
      toast.error('Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const res = await settings.downloadBackup(filename);
      downloadBlob(res.data, filename);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div>
      <TopBar title="Settings" />

      <div className="space-y-6 max-w-3xl">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-800">{loadError}</p>
            <LoadingButton
              variant="outline"
              loading={loadingSettings}
              onClick={() => {
                loadSettings();
                refreshSenders();
              }}
            >
              Retry
            </LoadingButton>
          </div>
        )}
        {loadingSettings && !loadError && Object.keys(data).length === 0 && (
          <p className="text-sm text-gray-500">Loading settings…</p>
        )}
        <section className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">WhatsApp API</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium">Access Token</label>
                <SavedBadge
                  saved={data.whatsapp_token_set === 'true' || data.whatsapp_token?.startsWith('••••')}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenValue}
                  onFocus={handleTokenFocus}
                  onChange={(e) => setTokenValue(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm"
                  placeholder={
                    data.whatsapp_token_set === 'true' || data.whatsapp_token?.startsWith('••••')
                      ? `Saved (${data.whatsapp_token || '••••'}) — paste a new token to replace`
                      : 'Paste WhatsApp access token'
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-2 border rounded-lg hover:bg-gray-50"
                >
                  {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number ID</label>
              <input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                WhatsApp Business Account ID (WABA ID)
              </label>
              <input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="e.g. 1382566270406239"
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">From Meta → WhatsApp → API Setup</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meta App ID</label>
              <input
                value={metaAppId}
                onChange={(e) => setMetaAppId(e.target.value)}
                placeholder="Auto-detected from token if left blank"
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Facebook App ID from developers.facebook.com → App Settings → Basic (not WABA or Phone Number ID). Leave blank to auto-detect from your token.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium">Meta App Secret (optional)</label>
                <SavedBadge saved={data.meta_app_secret_set === 'true'} />
              </div>
              <input
                type="password"
                value={metaAppSecret}
                onChange={(e) => setMetaAppSecret(e.target.value)}
                placeholder={
                  data.meta_app_secret_set === 'true'
                    ? `Saved (${data.meta_app_secret || '••••'}) — enter to replace`
                    : 'Optional — helps auto-detect App ID'
                }
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1">
                Same app as your token. Also used for webhook HMAC. Can set via META_APP_SECRET env on-prem.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium">Public App URL</label>
                <SavedBadge saved={!!publicBaseUrl.trim()} savedLabel="Configured" missingLabel="Using browser address" />
              </div>
              <input
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://whatsapp.yourcompany.com or https://your-app.vercel.app"
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                The address Meta and your team should use to reach this app — whether it's hosted
                on-prem behind your own domain, on Vercel, or anywhere else. Drives the Webhook URL
                further down and image header links in campaigns. Click Save to apply. Leave blank
                to fall back to the address in your browser's URL bar.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <LoadingButton
                onClick={handleSaveWhatsApp}
                loading={!!saving}
              >
                Save
              </LoadingButton>
              <LoadingButton variant="outline" onClick={handleTestConnection} loading={testing}>
                Test Connection
              </LoadingButton>
            </div>
            {testResult && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  testResult.success
                    ? testResult.needs_registration
                      ? 'bg-amber-50 text-amber-900'
                      : 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {testResult.success && !testResult.needs_registration ? (
                  <CheckCircle size={20} />
                ) : (
                  <XCircle size={20} />
                )}
                <div>
                  {testResult.success ? (
                    <>
                      <p className="font-medium">{testResult.name}</p>
                      <p className="text-sm">{testResult.phone}</p>
                      {testResult.metaApp && (
                        <p className={`text-sm mt-2 ${testResult.metaApp.valid ? '' : 'text-red-700'}`}>
                          {testResult.metaApp.valid
                            ? `Meta App ID OK${testResult.metaApp.appName ? `: ${testResult.metaApp.appName}` : ''} (${testResult.metaApp.appId})${testResult.metaApp.autoDetected ? ' — auto-detected & saved' : ''}`
                            : `Meta App ID: ${testResult.metaApp.error}`}
                        </p>
                      )}
                      {testResult.warning && (
                        <p className="text-sm mt-2 font-medium">{testResult.warning}</p>
                      )}
                    </>
                  ) : (
                    <p>{testResult.error}</p>
                  )}
                </div>
              </div>
            )}
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Register Phone for Cloud API</p>
                <p className="text-xs text-gray-500 mt-1">
                  Required once if sends fail with error 133010 (Account not registered). Choose any
                  6-digit PIN — Meta stores it as two-step verification for this number.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={registerPin}
                  onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  className="px-3 py-2 border rounded-lg font-mono text-sm w-36 bg-white"
                  inputMode="numeric"
                  autoComplete="off"
                />
                <LoadingButton onClick={handleRegisterPhone} loading={registering}>
                  Register Phone
                </LoadingButton>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={getWebhookUrl(publicBaseUrl)}
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="p-2 border rounded-lg hover:bg-gray-50"
                >
                  <Copy size={18} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {publicBaseUrl.trim()
                  ? 'Built from your Public App URL above — safe to use whether this app runs on-prem, on Vercel, or anywhere else.'
                  : 'No Public App URL set, so this uses your current browser address. Set the Public App URL above (your on-prem domain, Vercel URL, etc.) so this stays correct in production.'}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium">Webhook Verify Token</label>
                <SavedBadge
                  saved={
                    data.webhook_verify_token_set === 'true' ||
                    data.webhook_verify_token?.startsWith('••••')
                  }
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  className="ht-input flex-1 px-3 py-2 border rounded-xl font-mono text-sm"
                  placeholder={
                    data.webhook_verify_token_set === 'true' ||
                    data.webhook_verify_token?.startsWith('••••')
                      ? `Saved (${data.webhook_verify_token || '••••'}) — paste new to replace`
                      : 'Paste verify token for Meta webhook'
                  }
                />
                <LoadingButton
                  onClick={() => {
                    if (!webhookToken.trim() || webhookToken.includes('•')) {
                      toast.error('Paste a new verify token to replace');
                      return;
                    }
                    saveSetting('webhook_verify_token', webhookToken.trim(), 'Webhook token');
                  }}
                  loading={saving === 'webhook_verify_token'}
                >
                  Save
                </LoadingButton>
              </div>
            </div>
          </div>
        </section>

        <SenderNumbersSection
          senderList={senderList}
          onRefresh={refreshSenders}
          wabaId={wabaId}
        />

        <section className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Business Profile</h2>
          <div className="flex gap-2">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="WhatsApp Campaign Automation"
            />
            <LoadingButton
              onClick={() => saveSetting('business_name', businessName, 'Business name')}
              loading={saving === 'business_name'}
            >
              Save
            </LoadingButton>
          </div>
        </section>

        <section className="ht-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg font-semibold">AI Assistant (Claude)</h2>
            <SavedBadge
              saved={data.anthropic_api_key_set === 'true' || data.anthropic_api_key?.startsWith('••••')}
            />
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Used by the floating “AI Templates” chat to draft WhatsApp templates with Anthropic Claude.
            You can also set <code className="text-xs bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</code> in{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">.env</code>.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="ht-input flex-1 px-3 py-2 border rounded-xl font-mono text-sm"
              placeholder={
                data.anthropic_api_key_set === 'true' || data.anthropic_api_key?.startsWith('••••')
                  ? `Saved (${data.anthropic_api_key || '••••'}) — paste new key to replace`
                  : 'sk-ant-… Anthropic API key'
              }
            />
            <LoadingButton
              onClick={() => {
                if (!anthropicKey.trim() || anthropicKey.includes('•')) {
                  toast.error('Paste a new Anthropic API key to save');
                  return;
                }
                saveSetting('anthropic_api_key', anthropicKey.trim(), 'Anthropic API key');
              }}
              loading={saving === 'anthropic_api_key'}
            >
              Save
            </LoadingButton>
          </div>
        </section>

        <section className="ht-card p-4 sm:p-6 ht-animate-in">
          <h2 className="font-display text-lg font-semibold mb-4">Team Access</h2>
          <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <div>
              <p className="font-medium text-emerald-900">Login required</p>
              <p className="text-sm text-emerald-700/80">
                Auth is locked on for security. Password changes invalidate all sessions.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">
              ON
            </span>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <p className="font-medium text-sm">Change Password</p>
            <input
              type="password"
              placeholder="Current password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="ht-input w-full px-3 py-2 border rounded-xl text-sm"
            />
            <input
              type="password"
              placeholder="New password (min 10 characters)"
              value={passwords.newPass}
              onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
              className="ht-input w-full px-3 py-2 border rounded-xl text-sm"
              minLength={10}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="ht-input w-full px-3 py-2 border rounded-xl text-sm"
              minLength={10}
            />
            <LoadingButton type="submit" loading={passwordSaving}>Save Password</LoadingButton>
          </form>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Sending Config</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium">Delay between messages</label>
                <span className="text-sm text-accent font-medium">{sendDelay}ms</span>
              </div>
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={sendDelay}
                onChange={(e) => setSendDelay(Number(e.target.value))}
                className="w-full accent-accent"
              />
              {sendDelay < 800 && (
                <p className="text-xs text-orange-600 mt-1">
                  Warning: delays below 800ms may trigger rate limits
                </p>
              )}
              <LoadingButton
                className="mt-2"
                onClick={() => saveSetting('send_delay_ms', sendDelay, 'Send delay')}
                loading={saving === 'send_delay_ms'}
              >
                Save Delay
              </LoadingButton>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Daily Send Limit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-32 px-3 py-2 border rounded-lg"
                />
                <LoadingButton
                  onClick={() => saveSetting('daily_send_limit', dailyLimit, 'Daily limit')}
                  loading={saving === 'daily_send_limit'}
                >
                  Save
                </LoadingButton>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Today: {data.daily_sent_today || 0} sent · {data.daily_send_remaining || dailyLimit} remaining
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Database Backups</h2>
          <p className="text-sm text-gray-500 mb-4">
            Export all contacts, templates, campaigns, and settings to JSON files on the server.
          </p>
          <LoadingButton onClick={handleCreateBackup} loading={backingUp} className="mb-4">
            Create Backup Now
          </LoadingButton>
          {backups.length > 0 && (
            <div className="space-y-2">
              {backups.slice(0, 5).map((b) => (
                <div key={b.filename} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <span className="font-mono text-xs">{b.filename}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(b.filename)}
                    className="text-accent hover:underline"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-4">Data</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            <LoadingButton variant="outline" onClick={handleExportContacts}>
              Export All Contacts
            </LoadingButton>
            <LoadingButton variant="outline" onClick={handleExportCampaigns}>
              Export Campaigns Summary
            </LoadingButton>
          </div>
          <div className="border border-red-200 rounded-xl p-4 bg-red-50">
            <p className="font-medium text-red-800 mb-2">Danger Zone</p>
            <p className="text-sm text-red-600 mb-3">
              Clear message logs older than 30 days. This cannot be undone.
            </p>
            <LoadingButton variant="danger" onClick={() => setShowClearConfirm(true)}>
              Clear logs older than 30 days
            </LoadingButton>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearLogs}
        title="Clear Old Logs"
        message="This will permanently delete all message logs older than 30 days."
        confirmText="Clear Logs"
        danger
        loading={clearing}
      />
    </div>
  );
}
