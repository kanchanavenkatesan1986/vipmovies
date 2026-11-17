import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { getMediaBaseUrl, setMediaBaseUrl, resolveMediaUrl, DEFAULT_MEDIA_BASE_URL } from '../../utils/mediaUtils';

const DEFAULT_API_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev';

function getSettings() {
  try {
    const raw = localStorage.getItem('vip_upload_settings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettings(partial) {
  try {
    const current = getSettings();
    const updated = { ...current, ...partial };
    localStorage.setItem('vip_upload_settings', JSON.stringify(updated));
    return updated;
  } catch {
    return {};
  }
}

function isValidMovieTitle(title) {
  if (!title || typeof title !== 'string') return false;
  const s = title.trim();
  if (s.length < 2) return false;
  if (/^\d+$/.test(s)) return false;
  if (/^[()\[\]\s\-+»«.,/]+$/.test(s)) return false;
  if (/^page\s*\d+$/i.test(s)) return false;
  if (/^(home|telegram|contact|about|disclaimer|policy|dmca|tn|dc)$/i.test(s)) return false;
  return true;
}

export default function SettingsPage({ currentRoute, navigateTo }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('storage'); // 'storage' | 'cdn' | 'cache'

  // Settings state
  const [mediaBase, setMediaBase] = useState(() => getMediaBaseUrl());
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [urlMode, setUrlMode] = useState('path');
  const [savedMsg, setSavedMsg] = useState('');

  // Storage Explorer state
  const [selectedTable, setSelectedTable] = useState('tamil_2026');
  const [tableRecords, setTableRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'movie' | 'series'
  const [actionStatus, setActionStatus] = useState('');

  // Selected item modal
  const [inspectModalItem, setInspectModalItem] = useState(null);

  // Health check state
  const [healthStatus, setHealthStatus] = useState({ api: null, cdn: null, checking: false });

  // Initial load
  useEffect(() => {
    const s = getSettings();
    setMediaBase(s.mediaBaseUrl || getMediaBaseUrl() || DEFAULT_MEDIA_BASE_URL);
    setApiBase(s.apiBaseUrl || DEFAULT_API_BASE);
    setUrlMode(s.urlMode || 'path');
    loadTableData(selectedTable);
  }, []);

  const handleSaveConfig = () => {
    setMediaBaseUrl(mediaBase);
    saveSettings({ mediaBaseUrl: mediaBase, apiBaseUrl: apiBase, urlMode });
    setSavedMsg('✓ Settings saved successfully!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleResetConfig = () => {
    setMediaBase(DEFAULT_MEDIA_BASE_URL);
    setApiBase(DEFAULT_API_BASE);
    setUrlMode('path');
    setMediaBaseUrl(DEFAULT_MEDIA_BASE_URL);
    saveSettings({ mediaBaseUrl: DEFAULT_MEDIA_BASE_URL, apiBaseUrl: DEFAULT_API_BASE, urlMode: 'path' });
    setSavedMsg('✓ Defaults restored!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const loadTableData = async (table) => {
    setIsLoadingRecords(true);
    setActionStatus('');
    const base = (apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/${table}?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTableRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionStatus(`Error loading table "${table}": ${err.message}`);
      setTableRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleTableChange = (newTable) => {
    setSelectedTable(newTable);
    loadTableData(newTable);
  };

  const handlePurgeDirtyRecords = async () => {
    const category = selectedTable.split('_')[0].toLowerCase().trim();
    const dirty = tableRecords.filter(i => 
      !i.id.toLowerCase().startsWith(category) || 
      !isValidMovieTitle(i.title)
    );

    if (dirty.length === 0) {
      alert(`✓ Table "${selectedTable}" is already completely clean! No cross-category or invalid records found.`);
      return;
    }

    if (!window.confirm(`Found ${dirty.length} foreign or invalid records in "${selectedTable}" (e.g. cross-category data or bad titles). Purge them now?`)) {
      return;
    }

    setActionStatus(`Purging ${dirty.length} dirty records from ${selectedTable}...`);
    const base = (apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    let deletedCount = 0;

    for (const item of dirty) {
      try {
        const res = await fetch(`${base}/api/${selectedTable}/${item.id}`, { method: 'DELETE' });
        if (res.ok) deletedCount++;
      } catch {}
    }

    setActionStatus(`✓ Successfully purged ${deletedCount} foreign/dirty records from "${selectedTable}"!`);
    loadTableData(selectedTable);
  };

  const handleWipeTableToZero = async () => {
    if (tableRecords.length === 0) {
      alert(`Table "${selectedTable}" is already empty (0 records).`);
      return;
    }

    const confirm1 = window.prompt(`⚠️ DANGER: You are about to wipe ALL ${tableRecords.length} records in table "${selectedTable}".\n\nType "${selectedTable}" to confirm:`);
    if (confirm1 !== selectedTable) {
      return;
    }

    setActionStatus(`Wiping table "${selectedTable}" to 0...`);
    const base = (apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    let deletedCount = 0;

    for (const item of tableRecords) {
      try {
        const res = await fetch(`${base}/api/${selectedTable}/${item.id}`, { method: 'DELETE' });
        if (res.ok) deletedCount++;
      } catch {}
    }

    setActionStatus(`✓ Table "${selectedTable}" completely wiped to 0 (${deletedCount} records deleted).`);
    loadTableData(selectedTable);
  };

  const handleDeleteSingleRecord = async (item) => {
    if (!window.confirm(`Delete record (${item.id}) "${item.title}" from "${selectedTable}"?`)) return;
    const base = (apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
    try {
      const res = await fetch(`${base}/api/${selectedTable}/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTableRecords(prev => prev.filter(r => r.id !== item.id));
        setActionStatus(`✓ Deleted (${item.id}) "${item.title}"`);
      } else {
        alert('Delete failed.');
      }
    } catch (err) {
      alert(`Error deleting record: ${err.message}`);
    }
  };

  const handlePurgeClientCache = () => {
    if (!window.confirm('Purge all browser IndexedDB and LocalStorage movie caches and reload?')) return;
    try {
      if (window.indexedDB) {
        window.indexedDB.deleteDatabase('VIPMoviesCache');
      }
    } catch {}
    localStorage.removeItem('vip_movies_cache');
    localStorage.removeItem('vip_cache_version');
    localStorage.removeItem('vip_cache_ts');
    window.location.reload();
  };

  const handleCheckHealth = async () => {
    setHealthStatus({ api: 'checking', cdn: 'checking', checking: true });
    const apiEndpoint = `${(apiBase || DEFAULT_API_BASE).replace(/\/+$/, '')}/api/tamil_2026?_t=${Date.now()}`;
    const cdnEndpoint = `${(mediaBase || DEFAULT_MEDIA_BASE_URL).replace(/\/+$/, '')}/health`;

    let apiRes = 'Error';
    let cdnRes = 'Error';

    try {
      const t0 = performance.now();
      const r = await fetch(apiEndpoint);
      if (r.ok) apiRes = `Online (${Math.round(performance.now() - t0)}ms)`;
    } catch {
      apiRes = 'Offline / Blocked';
    }

    try {
      const t0 = performance.now();
      const r = await fetch(cdnEndpoint, { method: 'HEAD' }).catch(() => fetch(mediaBase, { method: 'HEAD' }));
      cdnRes = `Online (${Math.round(performance.now() - t0)}ms)`;
    } catch {
      cdnRes = 'Reachable via Player';
    }

    setHealthStatus({ api: apiRes, cdn: cdnRes, checking: false });
  };

  // Metrics calculation
  const totalCount = tableRecords.length;
  let moviesCount = 0;
  let seriesCount = 0;
  let totalEpisodes = 0;
  let relativePathsCount = 0;
  let fullUrlsCount = 0;

  tableRecords.forEach(item => {
    let eps = [];
    if (Array.isArray(item.episodes)) eps = item.episodes;
    else if (typeof item.episodes === 'string') {
      try { eps = JSON.parse(item.episodes); } catch {}
    }

    if (item.contentType === 'series' || eps.length > 0) {
      seriesCount++;
      totalEpisodes += eps.length;
    } else {
      moviesCount++;
    }

    const testUrl = item.p720 || item.p1080 || item.p360 || (eps[0] && eps[0].clickurl) || '';
    if (testUrl.startsWith('http')) fullUrlsCount++;
    else if (testUrl) relativePathsCount++;
  });

  // Filtered records
  const filteredRecords = tableRecords.filter(item => {
    const isSeries = item.contentType === 'series' || (Array.isArray(item.episodes) && item.episodes.length > 0);
    if (filterType === 'movie' && isSeries) return false;
    if (filterType === 'series' && !isSeries) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.id && item.id.toLowerCase().includes(q)) ||
      (item.director && item.director.toLowerCase().includes(q)) ||
      (item.starring && item.starring.toLowerCase().includes(q))
    );
  });

  // Styles
  const cardStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: '16px',
    padding: '22px',
    marginBottom: '20px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--admin-text-muted)',
    marginBottom: '6px'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: '10px',
    color: 'var(--admin-text)',
    fontSize: '13px',
    fontFamily: 'monospace',
    boxSizing: 'border-box'
  };

  return (
    <AdminLayout
      currentRoute={currentRoute}
      navigateTo={navigateTo}
      pageTitle="Advanced Settings & Storage"
      breadcrumb="System / Advanced Settings & Storage"
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px 0 60px' }}>

        {/* Top Header & Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: 0 }}>
              Advanced System & Storage Control
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-dim)', margin: '4px 0 0' }}>
              Full database information preview, cross-category cleanup, and CDN API configuration
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'var(--admin-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
            {[
              { id: 'storage', label: 'Storage & DB Explorer', icon: 'fa-database' },
              { id: 'cdn', label: 'CDN & API Setup', icon: 'fa-server' },
              { id: 'cache', label: 'Cache & Diagnostics', icon: 'fa-broom' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`admin-btn ${activeTab === tab.id ? 'primary' : ''}`}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  background: activeTab === tab.id ? 'var(--admin-purple)' : 'transparent',
                  border: 'none',
                  color: activeTab === tab.id ? '#fff' : 'var(--admin-text-muted)'
                }}
              >
                <i className={`fa-solid ${tab.icon}`} style={{ marginRight: '6px' }}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Status Message */}
        {actionStatus && (
          <div style={{
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: '10px',
            background: actionStatus.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionStatus.startsWith('✓') ? '#10b981' : '#ef4444'}`,
            color: actionStatus.startsWith('✓') ? '#10b981' : '#f87171',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{actionStatus}</span>
            <button
              onClick={() => setActionStatus('')}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: STORAGE & DATABASE EXPLORER (DEFAULT) */}
        {/* ============================================================== */}
        {activeTab === 'storage' && (
          <div>
            {/* Table Selector & Top Action Bar */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                    <i className="fa-solid fa-table-list" style={{ color: 'var(--admin-gold)', marginRight: '8px' }}></i>
                    Active Table:
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => handleTableChange(e.target.value)}
                    className="admin-input"
                    style={{ fontSize: '13.5px', fontWeight: 700, padding: '8px 14px', minWidth: '180px', borderRadius: '10px' }}
                  >
                    <option value="tamil_2026">🎭 tamil_2026</option>
                    <option value="hollywood_2026">🎬 hollywood_2026</option>
                    <option value="tamil_2025">tamil_2025</option>
                    <option value="hollywood_2025">hollywood_2025</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => loadTableData(selectedTable)}
                    disabled={isLoadingRecords}
                    className="admin-btn secondary"
                    style={{ padding: '8px 14px', fontSize: '12px' }}
                    title="Reload data from D1"
                  >
                    <i className={`fa-solid fa-rotate ${isLoadingRecords ? 'fa-spin' : ''}`}></i>
                  </button>
                </div>

                {/* Cleaning & Maintenance Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handlePurgeDirtyRecords}
                    className="admin-btn"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 700
                    }}
                    title="Removes foreign records (e.g. Hollywood records from Tamil table) or invalid titles"
                  >
                    <i className="fa-solid fa-broom" style={{ marginRight: '6px' }}></i>
                    Purge Dirty/Foreign Records
                  </button>

                  <button
                    type="button"
                    onClick={handleWipeTableToZero}
                    className="admin-btn danger"
                    style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: 700 }}
                    title="Deletes all records from this table so count is 0"
                  >
                    <i className="fa-solid fa-trash-can" style={{ marginRight: '6px' }}></i>
                    Wipe Table to 0
                  </button>
                </div>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              {[
                { label: 'Total Titles in DB', value: totalCount, icon: 'fa-film', color: 'var(--admin-gold)' },
                { label: 'Standalone Movies', value: moviesCount, icon: 'fa-clapperboard', color: 'var(--admin-blue)' },
                { label: 'Web Series', value: seriesCount, icon: 'fa-tv', color: 'var(--admin-purple)' },
                { label: 'Total Episodes', value: totalEpisodes, icon: 'fa-list-ol', color: '#10b981' },
                { label: 'Relative Paths', value: relativePathsCount, icon: 'fa-folder-closed', color: '#38bdf8' },
                { label: 'Full CDN URLs', value: fullUrlsCount, icon: 'fa-globe', color: '#a855f7' }
              ].map(m => (
                <div key={m.label} style={{
                  background: 'var(--admin-card)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    background: `${m.color}15`, border: `1px solid ${m.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: m.color, fontSize: '18px', flexShrink: 0
                  }}>
                    <i className={`fa-solid ${m.icon}`}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                      {isLoadingRecords ? '...' : m.value}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '3px' }}>
                      {m.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Information Preview */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-table" style={{ color: 'var(--admin-blue)' }}></i>
                    Database Records Preview
                    <span style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '12px', background: 'var(--admin-bg)', color: 'var(--admin-text-dim)', border: '1px solid var(--admin-border)' }}>
                      {filteredRecords.length} / {totalCount}
                    </span>
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--admin-text-dim)', margin: '2px 0 0' }}>
                    Inspect image paths, video routes, duration, cast, and metadata
                  </p>
                </div>

                {/* Filter and Search */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--admin-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    {['all', 'movie', 'series'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterType(t)}
                        style={{
                          padding: '4px 10px', fontSize: '11px', fontWeight: 700,
                          borderRadius: '6px', border: 'none', cursor: 'pointer',
                          background: filterType === t ? 'var(--admin-purple)' : 'transparent',
                          color: filterType === t ? '#fff' : 'var(--admin-text-muted)'
                        }}
                      >
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search by title, ID, star..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="admin-input"
                    style={{ fontSize: '12px', padding: '6px 12px', width: '220px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Records Table */}
              <div style={{ overflowX: 'auto', maxHeight: '520px', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--admin-bg)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--admin-border)' }}>
                    <tr style={{ color: 'var(--admin-text-dim)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '10px 12px' }}>Poster</th>
                      <th style={{ padding: '10px 12px' }}>ID</th>
                      <th style={{ padding: '10px 12px' }}>Clean Title</th>
                      <th style={{ padding: '10px 12px' }}>Type</th>
                      <th style={{ padding: '10px 12px' }}>Duration / Ep</th>
                      <th style={{ padding: '10px 12px' }}>Video Source Route</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody style={{ divideY: '1px solid var(--admin-border)' }}>
                    {isLoadingRecords ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Loading table records...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--admin-text-dim)' }}>
                          {tableRecords.length === 0 ? 'Table is empty (0 records).' : 'No records match search filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map(item => {
                        const isSeries = item.contentType === 'series' || (Array.isArray(item.episodes) && item.episodes.length > 0);
                        const cat = (item.type || selectedTable.split('_')[0]).toLowerCase();
                        const posterUrl = item.image ? `/${cat}/2026/${encodeURIComponent(item.image)}` : '';
                        
                        let videoSourcePreview = '';
                        if (isSeries) {
                          const epCount = Array.isArray(item.episodes) ? item.episodes.length : 0;
                          videoSourcePreview = `${epCount} Episodes in R2`;
                        } else {
                          const p = item.p720 || item.p1080 || item.p360 || '';
                          videoSourcePreview = p ? p.split('/').pop() : 'No Video Assigned';
                        }

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'var(--admin-text)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{
                                width: '34px', height: '48px', borderRadius: '6px', overflow: 'hidden',
                                background: 'rgba(0,0,0,0.4)', border: '1px solid var(--admin-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                              }}>
                                {posterUrl ? (
                                  <img
                                    src={posterUrl}
                                    alt={item.title}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentNode.innerHTML = '<span style="font-size:9px;color:#888;">No Art</span>';
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '9px', color: '#888' }}>No Art</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--admin-blue)' }}>
                              {item.id}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                              <div style={{ color: '#fff', fontSize: '13px' }}>{item.title}</div>
                              {item.director && (
                                <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '2px' }}>
                                  Dir: {item.director}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700,
                                background: isSeries ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: isSeries ? '#c084fc' : '#38bdf8',
                                border: `1px solid ${isSeries ? '#a855f7' : '#0284c7'}40`
                              }}>
                                {isSeries ? 'Series' : 'Movie'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--admin-text-muted)' }}>
                              {item.duration || (isSeries ? `${(item.episodes || []).length} Episodes` : '-')}
                            </td>
                            <td style={{ padding: '8px 12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <code style={{ fontSize: '11px', color: videoSourcePreview.startsWith('http') ? '#38bdf8' : '#10b981' }}>
                                {videoSourcePreview}
                              </code>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => setInspectModalItem(item)}
                                className="admin-btn"
                                style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}
                                title="View full JSON"
                              >
                                <i className="fa-solid fa-code"></i> JSON
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingleRecord(item)}
                                className="admin-btn danger"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                title="Delete record"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CDN & API SETUP */}
        {/* ============================================================== */}
        {activeTab === 'cdn' && (
          <div>
            <div style={cardStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-server" style={{ color: 'var(--admin-blue)' }}></i>
                Worker & Database Endpoints
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>CDN Media Base URL (Cloudflare Worker R2 Download)</label>
                <input
                  style={inputStyle}
                  value={mediaBase}
                  onChange={e => setMediaBase(e.target.value)}
                  placeholder={DEFAULT_MEDIA_BASE_URL}
                />
                <p style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '6px' }}>
                  Base URL prepended to all relative storage paths for video playback and downloads.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Movies API Base URL (Cloudflare D1 Worker)</label>
                <input
                  style={inputStyle}
                  value={apiBase}
                  onChange={e => setApiBase(e.target.value)}
                  placeholder={DEFAULT_API_BASE}
                />
                <p style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '6px' }}>
                  Endpoint providing database CRUD operations for movie and series catalog tables.
                </p>
              </div>

              {/* URL Mode */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Default Storage Path Mode</label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { value: 'path', label: 'Relative Storage Path (Default)', desc: 'e.g. "hollywood/2026/run-away/movie.mp4"', color: '#10b981' },
                    { value: 'cdn', label: 'Full CDN URL Mode', desc: 'e.g. "https://api-download.../movie.mp4"', color: '#38bdf8' }
                  ].map(opt => (
                    <label
                      key={opt.value}
                      style={{
                        flex: 1, minWidth: '240px', padding: '14px', borderRadius: '12px', cursor: 'pointer',
                        background: urlMode === opt.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--admin-bg)',
                        border: `1px solid ${urlMode === opt.value ? 'var(--admin-purple)' : 'var(--admin-border)'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <input
                          type="radio"
                          name="urlMode"
                          value={opt.value}
                          checked={urlMode === opt.value}
                          onChange={() => setUrlMode(opt.value)}
                          style={{ accentColor: 'var(--admin-purple)' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: opt.color }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginLeft: '24px' }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="admin-btn primary"
                  style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-floppy-disk" style={{ marginRight: '6px' }}></i> Save Endpoints
                </button>
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="admin-btn secondary"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ marginRight: '6px' }}></i> Reset Defaults
                </button>
                {savedMsg && (
                  <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 700 }}>{savedMsg}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CACHE & DIAGNOSTICS */}
        {/* ============================================================== */}
        {activeTab === 'cache' && (
          <div>
            {/* Health Diagnostics */}
            <div style={cardStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-stethoscope" style={{ color: 'var(--admin-purple)' }}></i>
                Live Worker Health Check
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--admin-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>D1 Movies API</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
                    {healthStatus.api || 'Not tested'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                    {apiBase}
                  </div>
                </div>

                <div style={{ background: 'var(--admin-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>R2 CDN Worker</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                    {healthStatus.cdn || 'Not tested'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                    {mediaBase}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckHealth}
                disabled={healthStatus.checking}
                className="admin-btn secondary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                <i className={`fa-solid fa-bolt ${healthStatus.checking ? 'fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
                {healthStatus.checking ? 'Testing...' : 'Test Connection Health'}
              </button>
            </div>

            {/* Cache Management */}
            <div style={cardStyle}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-broom" style={{ color: '#ef4444' }}></i>
                Client Cache Control
              </div>
              <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '16px' }}>
                Wipes the local IndexedDB and localStorage caches. Use this after synchronizing new movie titles to ensure your browser fetches fresh records.
              </p>
              <button
                type="button"
                onClick={handlePurgeClientCache}
                className="admin-btn danger"
                style={{ padding: '10px 22px', fontSize: '13px', fontWeight: 700 }}
              >
                <i className="fa-solid fa-trash-can" style={{ marginRight: '8px' }}></i>
                Purge All Local Cache & Reload
              </button>
            </div>
          </div>
        )}

        {/* JSON Inspector Modal */}
        {inspectModalItem && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 9999
          }}>
            <div style={{
              background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
              borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--admin-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '15px' }}>
                  Record Inspector: <span style={{ color: 'var(--admin-blue)' }}>{inspectModalItem.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectModalItem(null)}
                  style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                <pre style={{
                  background: 'var(--admin-bg)', padding: '14px', borderRadius: '10px',
                  border: '1px solid var(--admin-border)', color: '#38bdf8', fontSize: '12px',
                  fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                }}>
                  {JSON.stringify(inspectModalItem, null, 2)}
                </pre>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectModalItem, null, 2));
                    alert('Copied JSON to clipboard!');
                  }}
                  className="admin-btn secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  <i className="fa-regular fa-copy" style={{ marginRight: '6px' }}></i> Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => setInspectModalItem(null)}
                  className="admin-btn"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
