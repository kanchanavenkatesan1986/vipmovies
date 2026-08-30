import React, { useState, useEffect } from 'react';
import { uploadStorage } from '../../services/uploader/uploadStorage';
import { formatBytes } from '../../services/uploader/uploadUtils';
import { showToast } from '../common/ToastContainer';

export default function UploadHistory({ mediaBaseUrl, navigateTo }) {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    const records = await uploadStorage.getAllHistory();
    setHistory(records);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = async (id) => {
    await uploadStorage.deleteHistory(id);
    setHistory(prev => prev.filter(x => x.id !== id));
    showToast('Record removed from history', 'success');
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all completed upload history? (This will NOT delete any files from R2)')) {
      await uploadStorage.clearHistory();
      setHistory([]);
      showToast('History cleared', 'success');
    }
  };

  const copyText = (text, msg) => {
    navigator.clipboard.writeText(text);
    showToast(msg || 'Copied to clipboard', 'success');
  };

  const filtered = history.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.filename?.toLowerCase().includes(q) ||
      item.destinationKey?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      String(item.year).includes(q)
    );
  });

  return (
    <div className="upload-history-container">
      {/* Top Controls */}
      <div className="upload-history-controls">
        <div className="upload-search-wrap">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Search completed uploads by title or R2 path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input sm"
          />
        </div>

        {history.length > 0 && (
          <button className="admin-btn text sm" onClick={handleClearAll}>
            <i className="fa-solid fa-trash-can"></i>
            <span>Clear History</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
          <div>Loading upload history...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="upload-empty-queue">
          <div className="empty-icon"><i className="fa-solid fa-check-double"></i></div>
          <h3>No completed uploads found</h3>
          <p>When files finish uploading to Cloudflare R2, their details and playback URLs will appear here.</p>
        </div>
      ) : (
        <div className="upload-history-list">
          {filtered.map(item => {
            const playbackUrl = mediaBaseUrl ? `${mediaBaseUrl.replace(/\/+$/, '')}/${item.destinationKey}` : '';

            return (
              <div key={item.id} className="upload-history-card">
                <div className="history-info-left">
                  <div className="history-icon">
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div>
                    <div className="history-title-row">
                      <strong className="history-filename">{item.filename}</strong>
                      <span className="history-size">{formatBytes(item.fileSize)}</span>
                      <span className="history-category-badge">{item.category} • {item.year}</span>
                    </div>
                    <div className="history-key">
                      <i className="fa-solid fa-cloud"></i>
                      <code>{item.destinationKey}</code>
                    </div>
                    <div className="history-meta">
                      <span>Completed: {new Date(item.completedAt).toLocaleString()}</span>
                      {item.durationSeconds > 0 && (
                        <span> • Duration: {item.durationSeconds}s</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="history-actions">
                  <button
                    className="admin-btn secondary sm"
                    onClick={() => copyText(item.destinationKey, 'R2 Key copied')}
                    title="Copy R2 Destination Key"
                  >
                    <i className="fa-solid fa-copy"></i>
                    <span>Copy Key</span>
                  </button>

                  {playbackUrl && (
                    <button
                      className="admin-btn secondary sm"
                      onClick={() => copyText(playbackUrl, 'Playback URL copied')}
                      title="Copy Public / CDN Playback URL"
                    >
                      <i className="fa-solid fa-link"></i>
                      <span>Copy URL</span>
                    </button>
                  )}

                  {navigateTo && (
                    <button
                      className="admin-btn primary sm"
                      onClick={() => navigateTo(`admin/movies/${item.category}/${item.year}`)}
                      title="Open in Movie Catalog"
                    >
                      <i className="fa-solid fa-film"></i>
                      <span>Catalog</span>
                    </button>
                  )}

                  <button
                    className="admin-btn text sm"
                    onClick={() => handleDelete(item.id)}
                    title="Remove from history"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
