import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useToast } from '../context/ToastContext';
import { logActivity } from '../api/moviesApi';
import { Settings, Globe, Zap, Image, Bell, Shield, Save, RefreshCw } from 'lucide-react';

const SETTINGS_KEY = 'vip_admin_app_settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
}

function saveSettings(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-zinc-800/60 last:border-0">
      <div>
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full border transition-all ${
        checked ? 'bg-red-600 border-red-500' : 'bg-zinc-700 border-zinc-600'
      }`}
      style={{ height: '22px', width: '40px' }}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { addToast } = useToast();
  const saved = loadSettings();

  const [siteName, setSiteName] = useState(saved.siteName || 'VIP Movies');
  const [apiUrl, setApiUrl] = useState(saved.apiUrl || 'https://api-movies.akatsuki-pvt-ltd.workers.dev');
  const [maintenanceMode, setMaintenanceMode] = useState(saved.maintenanceMode || false);
  const [firebaseKey, setFirebaseKey] = useState(saved.firebaseKey || '');
  const [firebaseProjectId, setFirebaseProjectId] = useState(saved.firebaseProjectId || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const settings = { siteName, apiUrl, maintenanceMode, firebaseKey, firebaseProjectId };
    saveSettings(settings);
    logActivity('Settings Changed', 'Admin updated application settings');
    addToast('Settings saved successfully!', 'success');
    setSaving(false);
  };

  const inputClass = "bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-red-600/70 transition-all";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Configure your VIP Movies application</p>
        </div>
        <Button variant="primary" icon={Save} loading={saving} onClick={handleSave}>
          Save Settings
        </Button>
      </div>

      {/* General Settings */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-1 flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4 text-red-400" />
          General Settings
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Core website configuration</p>
        <div>
          <SettingRow label="Website Name" description="Displayed in headers and browser tab">
            <input
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              className={`${inputClass} w-48`}
            />
          </SettingRow>
          <SettingRow label="API Base URL" description="Cloudflare Workers API endpoint">
            <input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              className={`${inputClass} w-72`}
            />
          </SettingRow>
          <SettingRow
            label="Maintenance Mode"
            description="Show maintenance banner on the website"
          >
            <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
          </SettingRow>
        </div>
      </GlassCard>

      {/* Firebase Settings */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-1 flex items-center gap-2 text-sm">
          <Bell className="w-4 h-4 text-amber-400" />
          Firebase Cloud Messaging
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Configure push notification settings</p>
        <div>
          <SettingRow label="Firebase Project ID" description="Your Firebase project identifier">
            <input
              value={firebaseProjectId}
              onChange={e => setFirebaseProjectId(e.target.value)}
              placeholder="my-firebase-project"
              className={`${inputClass} w-56`}
            />
          </SettingRow>
          <SettingRow label="Server Key / API Key" description="Firebase Cloud Messaging server key">
            <input
              type="password"
              value={firebaseKey}
              onChange={e => setFirebaseKey(e.target.value)}
              placeholder="AAAAxxxxxxx:xxxxxxxx"
              className={`${inputClass} w-56`}
            />
          </SettingRow>
        </div>
      </GlassCard>

      {/* App Info */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-sky-400" />
          System Info
        </h3>
        <div>
          {[
            { label: 'Admin Version', value: 'v2.0.0 Netflix Edition' },
            { label: 'Storage Engine', value: 'LocalStorage + IndexedDB' },
            { label: 'API Engine', value: 'Cloudflare Workers + D1 + R2' },
            { label: 'Auth Method', value: 'JWT (Simulated Local)' },
          ].map(item => (
            <SettingRow key={item.label} label={item.label}>
              <span className="text-xs font-semibold text-zinc-400 font-mono bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                {item.value}
              </span>
            </SettingRow>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
