import React from 'react';
import { useApp } from '../AppContext';

export default function SettingsView() {
  const { settings, dbInfo, updateSetting, forceRefreshDb } = useApp();

  const handleToggle = (key, value) => {
    updateSetting(key, value);
  };

  const handleClearCache = async () => {
    if (window.confirm("Are you sure you want to clear the local movie database? The app will need an internet connection on next launch to re-download the catalog.")) {
      try {
        await window.DatabaseManager.clearStore('movies');
        await window.DatabaseManager.clearStore('slider');
        await window.DatabaseManager.clearStore('metadata');
        window.UIManager.showToast('🧹 Cache Cleared! Restarting...', 'update');
        setTimeout(() => {
          history.pushState(null, '', '/home');
          window.location.reload();
        }, 2000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <>
      {/* Settings Hero */}
      <div className="setting-hero">
        <h1>App Settings</h1>
        <p>Manage database storage and customize your viewing experience.</p>
      </div>

      {/* Preferences Group */}
      <div className="setting-group">
        <div className="setting-group-title">
          <i className="fa-solid fa-sliders" /> Preferences
        </div>

        {/* Quality Preference */}
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Quality Preference</span>
            <span className="setting-desc">Preferred streaming/download quality</span>
          </div>
          <div className="custom-select-wrapper">
            <select
              id="qualitySelect"
              className="setting-select"
              value={settings.quality}
              onChange={(e) => updateSetting('quality', e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="480p">480p (SD)</option>
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (FHD)</option>
            </select>
          </div>
        </div>

        {/* Autoplay Toggle */}
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Autoplay Next Video</span>
            <span className="setting-desc">Automatically play the next video in sequence</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!settings.autoplay}
              onChange={(e) => handleToggle('autoplay', e.target.checked)}
            />
            <span className="slider round" />
          </label>
        </div>

        {/* Coming Soon Toggle */}
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Coming Soon Movies</span>
            <span className="setting-desc">Show locked movies that are coming soon</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!settings.comingSoon}
              onChange={(e) => handleToggle('comingSoon', e.target.checked)}
            />
            <span className="slider round" />
          </label>
        </div>

        {/* Save History Toggle */}
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Record Watch History</span>
            <span className="setting-desc">Save recently played movies on this device</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!settings.saveHistory}
              onChange={(e) => handleToggle('saveHistory', e.target.checked)}
            />
            <span className="slider round" />
          </label>
        </div>
      </div>

      {/* Database Storage Group */}
      <div className="setting-group">
        <div className="setting-group-title">
          <i className="fa-solid fa-database" /> Storage &amp; Sync
        </div>

        {/* DB Info Items */}
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Database Version</span>
            <span className="setting-desc">Current local movie catalog version</span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
            v{dbInfo.version}
          </span>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Last Updated</span>
            <span className="setting-desc">When local copy was synchronized</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {formatDate(dbInfo.updated)}
          </span>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">Cached Movies</span>
            <span className="setting-desc">Total movies available offline</span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {dbInfo.count} movies
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          <button className="setting-btn accent" onClick={forceRefreshDb}>
            <i className="fa-solid fa-rotate-right" /> Check &amp; Update Database
          </button>

          <button className="setting-btn danger" onClick={handleClearCache}>
            <i className="fa-solid fa-trash-can" /> Clear All Cache &amp; Reset
          </button>
        </div>
      </div>

      {/* General Info Group */}
      <div className="setting-group" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <img src="/m-image/VIP Movies.jpg" alt="VIP Movies" style={{ width: '60px', borderRadius: '12px', marginBottom: '10px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>VIP Movies</h3>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '16px' }}>Version 1.0.0 (React SPA)</span>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Enjoy the ultimate catalog of Tamil &amp; Hollywood movies with high-speed direct downloads and streaming. Built with offline support for instant loads.
        </p>
      </div>
    </>
  );
}
