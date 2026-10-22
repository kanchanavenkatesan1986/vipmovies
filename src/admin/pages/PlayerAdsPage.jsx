import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { adsConfigService, DEFAULT_ADS_CONFIG, ADS_PRESETS } from '../services/adsConfigService';
import { showToast } from '../components/common/ToastContainer';
import './PlayerAdsPage.css';

export default function PlayerAdsPage({ navigateTo }) {
  const [config, setConfig] = useState(DEFAULT_ADS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePreset, setActivePreset] = useState('balanced');
  const [storageSource, setStorageSource] = useState('r2'); // 'd1', 'r2', 'default'
  const [hasChanges, setHasChanges] = useState(false);
  const [previewTab, setPreviewTab] = useState('modal'); // 'pill' | 'modal'

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await adsConfigService.getAdsConfig(true);
      setConfig(data);
      if (data._source) setStorageSource(data._source);
      detectPreset(data);
    } catch (err) {
      showToast('Failed to load ads config from server. Using local defaults.', 'warning');
      const local = adsConfigService.getStoredConfigSync();
      setConfig(local);
    } finally {
      setLoading(false);
    }
  };

  const detectPreset = (cfg) => {
    if (!cfg.adsEnabled) {
      setActivePreset('disabled');
      return;
    }
    if (cfg.firstAdDelayMinutes === 20 && cfg.adIntervalMinutes === 30) {
      setActivePreset('userFriendly');
    } else if (cfg.firstAdDelayMinutes === 15 && cfg.adIntervalMinutes === 25) {
      setActivePreset('balanced');
    } else if (cfg.firstAdDelayMinutes === 10 && cfg.adIntervalMinutes === 20) {
      setActivePreset('highMonetization');
    } else {
      setActivePreset('custom');
    }
  };

  const applyPreset = (presetKey) => {
    const preset = ADS_PRESETS[presetKey];
    if (!preset) return;
    setConfig((prev) => ({
      ...prev,
      ...preset.config
    }));
    setActivePreset(presetKey);
    setHasChanges(true);
    showToast(`Applied preset: ${preset.label}`, 'info');
  };

  const handleFieldChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value
    }));
    setActivePreset('custom');
    setHasChanges(true);
  };

  const handleUiCopyChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      uiCopy: {
        ...(prev.uiCopy || DEFAULT_ADS_CONFIG.uiCopy),
        [field]: value
      }
    }));
    setActivePreset('custom');
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adsConfigService.saveAdsConfig(config);
      setHasChanges(false);
      const isD1 = res?.storage === 'd1';
      if (isD1) setStorageSource('d1');
      showToast(
        isD1
          ? '🎉 Player Ads settings saved & synced to Cloudflare D1 Database & R2!'
          : '🎉 Player Ads settings saved & published to Cloudflare R2!',
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all player ads settings to recommended defaults?')) {
      setConfig({ ...DEFAULT_ADS_CONFIG });
      setActivePreset('balanced');
      setHasChanges(true);
      showToast('Reset to default values', 'info');
    }
  };

  if (loading) {
    return (
      <AdminLayout currentRoute="admin/ads" navigateTo={navigateTo} pageTitle="In-Player Ads Control" breadcrumb="Monetization / Player Ads" onRefresh={loadConfig}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: '#10b981' }}></i>
          <span style={{ fontSize: '15px' }}>Loading Ads Configuration...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      currentRoute="admin/ads"
      navigateTo={navigateTo}
      pageTitle="In-Player Ads Control"
      breadcrumb="Monetization / Player Ads"
      onRefresh={loadConfig}
    >
      <div className="ads-admin-container">
        
        {/* Header */}
        <div className="ads-admin-header">
          <div className="ads-admin-title">
            <h1>
              <i className="fa-solid fa-sliders" style={{ color: '#10b981' }}></i>
              Player Ads Control
            </h1>
            <p>
              Manage in-player sponsor break frequency, countdown alerts, and playback rules for movies streaming on Web & Android.
            </p>
          </div>

          <div className="ads-admin-badges">
            <span className="policy-badge">
              <i className="fa-solid fa-sparkles"></i> High-Retention Policy
            </span>
            <span className="r2-badge" style={{ background: storageSource === 'd1' ? 'rgba(16, 185, 129, 0.15)' : undefined, color: storageSource === 'd1' ? '#10b981' : undefined, borderColor: storageSource === 'd1' ? 'rgba(16, 185, 129, 0.3)' : undefined }}>
              <i className={`fa-solid ${storageSource === 'd1' ? 'fa-database' : 'fa-cloud'}`}></i> {storageSource === 'd1' ? 'Cloudflare D1 Table Active' : 'Synced to Cloudflare R2'}
            </span>
          </div>
        </div>

        {/* Master Switch */}
        <div className="master-switch-card">
          <div className="master-switch-info">
            <h3>
              <i className={`fa-solid ${config.adsEnabled ? 'fa-circle-play' : 'fa-circle-pause'}`} style={{ color: config.adsEnabled ? '#10b981' : '#94a3b8' }}></i>
              Global In-Player Ads Master Switch
            </h3>
            <p>
              When enabled, users will encounter compliant rewarded ad breaks during movie playback based on your chosen timing intervals.
            </p>
          </div>

          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.adsEnabled}
              onChange={(e) => handleFieldChange('adsEnabled', e.target.checked)}
            />
            <span className="slider-round"></span>
          </label>
        </div>

        {/* Presets Grid */}
        <div className="presets-section">
          <div className="section-heading">
            <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#f59e0b' }}></i>
            Quick Optimization Presets
          </div>

          <div className="presets-grid">
            {Object.entries(ADS_PRESETS).map(([key, p]) => (
              <div
                key={key}
                className={`preset-card ${activePreset === key ? 'active' : ''}`}
                onClick={() => applyPreset(key)}
              >
                <div className="preset-title">
                  <span>{p.label}</span>
                  {activePreset === key && (
                    <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                  )}
                </div>
                <p className="preset-desc">{p.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Main 2-Column Config Layout */}
        <div className="ads-config-layout">
          
          {/* Left Column: Settings Form */}
          <div className="config-form-col">

            {/* Timing & Intervals Panel */}
            <div className="card-panel">
              <div className="card-panel-title">
                <i className="fa-solid fa-clock" style={{ color: '#60a5fa' }}></i>
                Playback Timing & Ad Intervals
              </div>

              {/* Trigger Enforcement Mode Selector */}
              <div style={{ marginBottom: '18px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', display: 'block', marginBottom: '8px' }}>
                  <i className="fa-solid fa-crosshairs" style={{ color: '#10b981', marginRight: '6px' }}></i>
                  Ad Break Trigger Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => handleFieldChange('adTriggerMode', 'timeline')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: (config.adTriggerMode || 'timeline') === 'timeline' ? '2px solid #10b981' : '1px solid var(--admin-border)',
                      background: (config.adTriggerMode || 'timeline') === 'timeline' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: (config.adTriggerMode || 'timeline') === 'timeline' ? '#10b981' : '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-timeline"></i>
                      Timeline Position Mode
                      {(config.adTriggerMode || 'timeline') === 'timeline' && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', fontSize: '12px' }}></i>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      Ads trigger at exact movie timestamps (e.g. 15m, 40m). Fast-forwarding past an ad milestone triggers the ad break.
                    </div>
                  </div>

                  <div
                    onClick={() => handleFieldChange('adTriggerMode', 'watchTime')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: config.adTriggerMode === 'watchTime' ? '2px solid #3b82f6' : '1px solid var(--admin-border)',
                      background: config.adTriggerMode === 'watchTime' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: config.adTriggerMode === 'watchTime' ? '#3b82f6' : '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-stopwatch"></i>
                      Active Watch Time
                      {config.adTriggerMode === 'watchTime' && <i className="fa-solid fa-check" style={{ marginLeft: 'auto', fontSize: '12px' }}></i>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                      Ads trigger only after user has actively streamed for 15 minutes, regardless of scrubbing or skipping forward.
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group-grid">
                <div className="form-field">
                  <label>
                    First Ad Delay
                    <span className="field-hint">Before 1st ad break</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={config.firstAdDelayMinutes}
                      onChange={(e) => handleFieldChange('firstAdDelayMinutes', Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <span className="unit">Minutes</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>
                    Subsequent Ad Interval
                    <span className="field-hint">Between ad breaks</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={config.adIntervalMinutes}
                      onChange={(e) => handleFieldChange('adIntervalMinutes', Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="unit">Minutes</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>
                    Countdown Warning
                    <span className="field-hint">Advance notice pill</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={config.warningCountdownSeconds}
                      onChange={(e) => handleFieldChange('warningCountdownSeconds', Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="unit">Seconds</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>
                    Reward Watch Duration
                    <span className="field-hint">Unlocked time per ad</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={config.rewardDurationMinutes}
                      onChange={(e) => handleFieldChange('rewardDurationMinutes', Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="unit">Minutes</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>
                    Session Ad Cap
                    <span className="field-hint">Max ads per movie</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.maxAdsPerMovie}
                      onChange={(e) => handleFieldChange('maxAdsPerMovie', Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <span className="unit">Ads</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>
                    Grace Pass Fallback
                    <span className="field-hint">If ad offline / no-fill</span>
                  </label>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={config.gracePeriodMinutes}
                      onChange={(e) => handleFieldChange('gracePeriodMinutes', Math.max(5, parseInt(e.target.value) || 5))}
                    />
                    <span className="unit">Minutes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Features Panel */}
            <div className="card-panel">
              <div className="card-panel-title">
                <i className="fa-solid fa-sliders" style={{ color: '#a855f7' }}></i>
                Smart UX & Monetization Features
              </div>

              <div className="feature-toggle-row">
                <div className="feature-label">
                  <h4>"Watch Ahead" Ad Banking Button</h4>
                  <p>Shows a button in player controls so users can voluntarily watch an ad during opening credits to bank uninterrupted time.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={config.enableWatchAhead}
                    onChange={(e) => handleFieldChange('enableWatchAhead', e.target.checked)}
                  />
                  <span className="slider-round"></span>
                </label>
              </div>

              <div className="feature-toggle-row">
                <div className="feature-label">
                  <h4>Smart Natural Pause Trigger</h4>
                  <p>When user pauses the video after 15+ minutes of continuous watching, offer them to take their ad break now instead of interrupting action later.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={config.pauseTriggerEnabled}
                    onChange={(e) => handleFieldChange('pauseTriggerEnabled', e.target.checked)}
                  />
                  <span className="slider-round"></span>
                </label>
              </div>
            </div>

            {/* UI Copy Customizer */}
            <div className="card-panel">
              <div className="card-panel-title">
                <i className="fa-solid fa-font" style={{ color: '#ec4899' }}></i>
                Customizable In-Player UI Text & Copy
              </div>

              <div className="form-group-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-field">
                  <label>Warning Pill Text (Use {'{sec}'} for countdown seconds)</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.uiCopy?.warningText || ''}
                    onChange={(e) => handleUiCopyChange('warningText', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Break Modal Title</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.uiCopy?.modalTitle || ''}
                    onChange={(e) => handleUiCopyChange('modalTitle', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Break Modal Description (Use {'{min}'} for unlocked minutes)</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.uiCopy?.modalDescription || ''}
                    onChange={(e) => handleUiCopyChange('modalDescription', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Watch Ad Button Label</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.uiCopy?.buttonText || ''}
                    onChange={(e) => handleUiCopyChange('buttonText', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Watch Ahead Button Label</label>
                  <input
                    type="text"
                    className="text-input"
                    value={config.uiCopy?.watchAheadText || ''}
                    onChange={(e) => handleUiCopyChange('watchAheadText', e.target.value)}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Live Mobile Interactive Simulator */}
          <div className="preview-sticky">
            <div className="card-panel" style={{ padding: '16px' }}>
              <div className="card-panel-title" style={{ marginBottom: '12px', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-mobile-screen" style={{ color: '#10b981' }}></i>
                  Live Player Preview
                </span>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`pill-btn ${previewTab === 'pill' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('pill')}
                    style={{
                      background: previewTab === 'pill' ? '#10b981' : 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    15s Pill
                  </button>
                  <button
                    type="button"
                    className={`pill-btn ${previewTab === 'modal' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('modal')}
                    style={{
                      background: previewTab === 'modal' ? '#10b981' : 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Break Modal
                  </button>
                </div>
              </div>

              {/* Mobile Mockup */}
              <div className="phone-mockup">
                <div className="phone-screen">
                  
                  {/* Dummy Player Elements */}
                  <div className="dummy-player-bg">
                    <div className="dummy-top-bar">
                      <span>Leo (2023) • 1080p</span>
                      <span>{config.enableWatchAhead ? (config.uiCopy?.watchAheadText || '⚡ +30m Ad-Free') : ''}</span>
                    </div>
                    <div className="dummy-center-play">
                      <i className="fa-solid fa-play"></i>
                    </div>
                    <div className="dummy-bottom-bar">
                      <div className="dummy-progress"></div>
                    </div>
                  </div>

                  {/* Tab 1: Simulated 15s Countdown Pill */}
                  {previewTab === 'pill' && (
                    <div className="preview-countdown-pill">
                      <span className="pill-badge">{config.warningCountdownSeconds}</span>
                      <span>
                        {(config.uiCopy?.warningText || 'Ad break in {sec}s...').replace('{sec}', config.warningCountdownSeconds)}
                      </span>
                      <button type="button" className="pill-btn">
                        Watch Now
                      </button>
                    </div>
                  )}

                  {/* Tab 2: Simulated Break Modal */}
                  {previewTab === 'modal' && (
                    <div className="preview-modal-card">
                      <div className="preview-modal-badge">
                        <i className="fa-solid fa-sparkles"></i> Sponsor Break
                      </div>
                      <h4 className="preview-modal-title">
                        {config.uiCopy?.modalTitle || 'Break Time'}
                      </h4>
                      <p className="preview-modal-desc">
                        {(config.uiCopy?.modalDescription || 'Watch a short message to unlock next {min} mins.')
                          .replace('{min}', config.rewardDurationMinutes)}
                      </p>
                      <button type="button" className="preview-modal-action-btn">
                        <i className="fa-solid fa-play"></i>
                        {config.uiCopy?.buttonText || '▶ Watch Ad to Continue'}
                      </button>
                    </div>
                  )}

                </div>
              </div>

              <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                <i className="fa-solid fa-circle-info"></i> Real-time preview of player appearance on Android WebView.
              </div>

            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="ads-action-bar">
          <button
            type="button"
            className="reset-btn"
            onClick={handleReset}
            disabled={saving}
          >
            <i className="fa-solid fa-rotate-left"></i> Reset Defaults
          </button>

          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> Publishing to Cloudflare...
              </>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-up"></i> Save & Publish Ads Config
              </>
            )}
          </button>
        </div>

      </div>
    </AdminLayout>
  );
}
