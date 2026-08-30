import React, { useState, useEffect } from 'react';
import { DEFAULT_UPLOAD_CONFIG } from '../../services/uploader/uploadConfig';
import { uploadStorage } from '../../services/uploader/uploadStorage';
import { uploadApi } from '../../services/uploader/uploadApi';
import { showToast } from '../common/ToastContainer';

export default function UploadSettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [config, setConfig] = useState(DEFAULT_UPLOAD_CONFIG);
  const [apiToken, setApiToken] = useState('');
  const [activeTab, setActiveTab] = useState('concurrency');
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      uploadStorage.getSettings().then(stored => {
        setConfig(stored);
      });
      const token = localStorage.getItem('vip_upload_api_token') || 'VIP_SECURE_TOKEN_2026';
      setApiToken(token);
      setHealthResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await uploadStorage.saveSettings(config);
      localStorage.setItem('vip_upload_api_token', apiToken);
      uploadApi.invalidateConfigCache();
      if (onSettingsUpdated) onSettingsUpdated(config);
      showToast('Uploader settings saved successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleTestHealth = async () => {
    setIsTestingHealth(true);
    setHealthResult(null);
    try {
      const res = await uploadApi.checkHealth();
      setHealthResult({ success: true, message: `Connected! ${res.service || 'Worker OK'}` });
      showToast('Worker API connected successfully', 'success');
    } catch (err) {
      setHealthResult({ success: false, message: err.message || 'Worker connection failed' });
      showToast('Worker connection error', 'error');
    } finally {
      setIsTestingHealth(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box md" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-sliders" style={{ color: 'var(--admin-blue)' }}></i>
            Upload Engine & R2 Storage Settings
          </div>
          <button className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="upload-settings-tabs">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'concurrency' ? 'active' : ''}`}
            onClick={() => setActiveTab('concurrency')}
          >
            <i className="fa-solid fa-bolt"></i> Concurrency & Parts
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'reliability' ? 'active' : ''}`}
            onClick={() => setActiveTab('reliability')}
          >
            <i className="fa-solid fa-shield-halved"></i> Reliability & Resume
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <i className="fa-solid fa-server"></i> API & Cloudflare Worker
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="admin-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {/* TAB 1: CONCURRENCY & CHUNKING */}
            {activeTab === 'concurrency' && (
              <div className="settings-section">
                <div className="settings-grid">
                  <div className="admin-form-group">
                    <label>Maximum Active Files (Parallel Movies)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.maxActiveFiles}
                      onChange={(e) => setConfig({ ...config, maxActiveFiles: parseInt(e.target.value, 10) || 1 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Recommended: 3 movies at once</span>
                  </div>

                  <div className="admin-form-group">
                    <label>Parts Per File (Parallel Chunks)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.partsPerFile}
                      onChange={(e) => setConfig({ ...config, partsPerFile: parseInt(e.target.value, 10) || 1 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Recommended: 4 parts per movie</span>
                  </div>

                  <div className="admin-form-group">
                    <label>Max Global Concurrent Parts</label>
                    <input
                      type="number"
                      min="1"
                      max="32"
                      value={config.maxConcurrentParts}
                      onChange={(e) => setConfig({ ...config, maxConcurrentParts: parseInt(e.target.value, 10) || 1 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Global network ceiling (3 × 4 = 12)</span>
                  </div>

                  <div className="admin-form-group">
                    <label>Chunk Size (MB)</label>
                    <select
                      value={config.partSizeMB}
                      onChange={(e) => setConfig({ ...config, partSizeMB: parseInt(e.target.value, 10) })}
                      className="admin-select"
                    >
                      <option value="25">25 MB (Better for slower networks)</option>
                      <option value="50">50 MB (Recommended Standard)</option>
                      <option value="100">100 MB (High Speed Fiber)</option>
                      <option value="200">200 MB (Ultra High Bandwidth)</option>
                    </select>
                    <span className="field-hint">Memory safe file.slice() chunking</span>
                  </div>
                </div>

                <div className="admin-form-group" style={{ marginTop: '16px' }}>
                  <label>Duplicate R2 Object Policy</label>
                  <select
                    value={config.duplicatePolicy}
                    onChange={(e) => setConfig({ ...config, duplicatePolicy: e.target.value })}
                    className="admin-select"
                  >
                    <option value="reject">Reject (Return error if file already exists)</option>
                    <option value="replace">Replace (Overwrite existing object)</option>
                    <option value="rename">Rename (Append timestamp automatically)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: RELIABILITY & RETRIES */}
            {activeTab === 'reliability' && (
              <div className="settings-section">
                <div className="settings-grid">
                  <div className="admin-form-group">
                    <label>Maximum Retries Per Part</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={config.maxRetries}
                      onChange={(e) => setConfig({ ...config, maxRetries: parseInt(e.target.value, 10) || 1 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Retries individual chunk without restarting movie</span>
                  </div>

                  <div className="admin-form-group">
                    <label>Base Retry Delay (Seconds)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={config.retryDelaySeconds}
                      onChange={(e) => setConfig({ ...config, retryDelaySeconds: parseInt(e.target.value, 10) || 1 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Initial backoff wait time</span>
                  </div>

                  <div className="admin-form-group">
                    <label>Request Timeout (Seconds)</label>
                    <input
                      type="number"
                      min="30"
                      max="300"
                      value={config.requestTimeoutSeconds}
                      onChange={(e) => setConfig({ ...config, requestTimeoutSeconds: parseInt(e.target.value, 10) || 60 })}
                      className="admin-input"
                    />
                    <span className="field-hint">Abort and retry chunk if no progress</span>
                  </div>
                </div>

                <div className="settings-switches" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={config.exponentialBackoff}
                      onChange={(e) => setConfig({ ...config, exponentialBackoff: e.target.checked })}
                    />
                    <div>
                      <strong>Exponential Backoff</strong>
                      <span>Double delay on consecutive failures (2s, 4s, 8s, 16s...)</span>
                    </div>
                  </label>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={config.autoResumeOnNetwork}
                      onChange={(e) => setConfig({ ...config, autoResumeOnNetwork: e.target.checked })}
                    />
                    <div>
                      <strong>Auto-Resume on Network Recovery</strong>
                      <span>Automatically resume queued items when browser comes back online</span>
                    </div>
                  </label>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={config.verifyPartsOnResume}
                      onChange={(e) => setConfig({ ...config, verifyPartsOnResume: e.target.checked })}
                    />
                    <div>
                      <strong>Verify R2 Parts via /list-parts</strong>
                      <span>Reconcile uploaded chunks directly with Cloudflare R2 before resume</span>
                    </div>
                  </label>

                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={config.autoStartNext}
                      onChange={(e) => setConfig({ ...config, autoStartNext: e.target.checked })}
                    />
                    <div>
                      <strong>Auto Start Next in Queue</strong>
                      <span>When an active movie finishes, immediately dispatch the next waiting movie</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: API & WORKER CONFIG */}
            {activeTab === 'api' && (
              <div className="settings-section">
                <div className="admin-form-group">
                  <label>Cloudflare Worker Upload API URL</label>
                  <input
                    type="url"
                    value={config.apiBase}
                    onChange={(e) => setConfig({ ...config, apiBase: e.target.value })}
                    className="admin-input"
                    placeholder="https://vipmovies-uploader-worker.yourdomain.workers.dev"
                  />
                  <span className="field-hint">Worker endpoint implementing R2 multipart upload routes</span>
                </div>

                <div className="admin-form-group" style={{ marginTop: '12px' }}>
                  <label>Worker Bearer Token (Authorization)</label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    className="admin-input"
                    placeholder="Enter UPLOAD_API_TOKEN"
                  />
                  <span className="field-hint">Must match env.UPLOAD_API_TOKEN configured in Cloudflare Worker</span>
                </div>

                <div className="admin-form-group" style={{ marginTop: '12px' }}>
                  <label>Playback / CDN Media Base Domain (Optional)</label>
                  <input
                    type="url"
                    value={config.mediaBaseUrl}
                    onChange={(e) => setConfig({ ...config, mediaBaseUrl: e.target.value })}
                    className="admin-input"
                    placeholder="https://media.vipmovies.in"
                  />
                  <span className="field-hint">Used to construct instant playback links after completion</span>
                </div>

                {/* Worker Health Connection Tester */}
                <div className="worker-health-test-box" style={{ marginTop: '18px' }}>
                  <button
                    type="button"
                    className="admin-btn secondary sm"
                    onClick={handleTestHealth}
                    disabled={isTestingHealth}
                  >
                    <i className={`fa-solid ${isTestingHealth ? 'fa-spinner fa-spin' : 'fa-network-wired'}`}></i>
                    <span>{isTestingHealth ? 'Testing Connection...' : 'Test Worker /health Endpoint'}</span>
                  </button>

                  {healthResult && (
                    <span className={`health-badge ${healthResult.success ? 'ok' : 'err'}`}>
                      <i className={`fa-solid ${healthResult.success ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                      {healthResult.message}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="admin-btn text" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn primary">
              <i className="fa-solid fa-floppy-disk"></i>
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
