import React, { useState } from 'react';
import { sanitizePath } from '../../services/fileManager/fileManagerUtils';

export default function MoveCopyModal({
  isOpen,
  mode = 'move', // 'move' | 'copy'
  items = [], // array of { key: string, filename: string, isFolder: boolean }
  currentPrefix = '',
  onClose,
  onConfirm
}) {
  const [destPrefix, setDestPrefix] = useState(currentPrefix);
  const [conflictPolicy, setConflictPolicy] = useState('skip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || items.length === 0) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    let cleanDest = sanitizePath(destPrefix);
    if (cleanDest && !cleanDest.endsWith('/')) {
      cleanDest += '/';
    }

    setLoading(true);
    try {
      await onConfirm(cleanDest, conflictPolicy);
      onClose();
    } catch (err) {
      setError(err.message || `${mode === 'move' ? 'Move' : 'Copy'} failed`);
    } finally {
      setLoading(false);
    }
  };

  const actionVerb = mode === 'move' ? 'Move' : 'Copy';

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box md" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className={`fa-solid ${mode === 'move' ? 'fa-arrows-up-down-left-right' : 'fa-copy'}`} style={{ color: 'var(--admin-blue)' }}></i>
            {actionVerb} {items.length} Item{items.length > 1 ? 's' : ''}
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="fm-move-selected-list">
              <label className="admin-label">Selected Item{items.length > 1 ? 's' : ''}:</label>
              <div className="fm-move-pills">
                {items.slice(0, 5).map((it) => (
                  <span key={it.key} className="fm-move-pill">
                    <i className={`fa-solid ${it.isFolder ? 'fa-folder' : 'fa-film'}`}></i>
                    {it.filename || it.key}
                  </span>
                ))}
                {items.length > 5 && (
                  <span className="fm-move-pill extra">+{items.length - 5} more</span>
                )}
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Target Destination Prefix</label>
              <input
                type="text"
                className="admin-input"
                value={destPrefix}
                onChange={(e) => setDestPrefix(e.target.value)}
                placeholder="e.g. tamil/2026/backup/ (leave empty for root)"
                autoFocus
              />
              <div style={{ fontSize: '11.5px', color: 'var(--admin-text-dim)', marginTop: '4px' }}>
                Quick presets: 
                <button type="button" className="fm-preset-btn" onClick={() => setDestPrefix('tamil/2026/')}>tamil/2026/</button>
                <button type="button" className="fm-preset-btn" onClick={() => setDestPrefix('hollywood/2025/')}>hollywood/2025/</button>
                <button type="button" className="fm-preset-btn" onClick={() => setDestPrefix('')}>Root /</button>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Conflict Resolution (If target already exists)</label>
              <div className="fm-conflict-options">
                <label className="fm-conflict-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="skip"
                    checked={conflictPolicy === 'skip'}
                    onChange={() => setConflictPolicy('skip')}
                  />
                  <div>
                    <strong>Skip</strong>
                    <span>Do not overwrite existing destination files</span>
                  </div>
                </label>

                <label className="fm-conflict-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="replace"
                    checked={conflictPolicy === 'replace'}
                    onChange={() => setConflictPolicy('replace')}
                  />
                  <div>
                    <strong>Replace</strong>
                    <span>Overwrite existing target objects in R2</span>
                  </div>
                </label>

                <label className="fm-conflict-label">
                  <input
                    type="radio"
                    name="conflict"
                    value="rename"
                    checked={conflictPolicy === 'rename'}
                    onChange={() => setConflictPolicy('rename')}
                  />
                  <div>
                    <strong>Auto-Rename</strong>
                    <span>Append timestamp suffix (e.g. _copy_12345.mp4)</span>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--admin-danger)', color: '#fca5a5', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
                {error}
              </div>
            )}
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="admin-btn text" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="admin-btn primary" disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : `${actionVerb} Now`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
