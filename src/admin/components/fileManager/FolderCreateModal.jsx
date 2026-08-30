import React, { useState } from 'react';
import { sanitizeMovieFolder } from '../../services/uploader/uploadUtils';

export default function FolderCreateModal({
  isOpen,
  currentPrefix = '',
  onClose,
  onCreate
}) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const clean = sanitizeMovieFolder(folderName);
    if (!clean) {
      setError('Please enter a valid folder name (letters, numbers, hyphens).');
      return;
    }

    const fullPrefix = `${currentPrefix || ''}${clean}/`;

    setLoading(true);
    try {
      await onCreate(fullPrefix);
      setFolderName('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-folder-plus" style={{ color: 'var(--admin-blue)' }}></i>
            Create New Folder
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="admin-form-group">
              <label className="admin-label">Location Prefix</label>
              <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)', background: 'var(--admin-surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                <code>R2 / {currentPrefix || 'root'}</code>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">Folder Name</label>
              <input
                type="text"
                className="admin-input"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. leo, coolie, 2026"
                autoFocus
                required
              />
            </div>

            {folderName && (
              <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>
                Destination: <code>{currentPrefix}{sanitizeMovieFolder(folderName)}/</code>
              </div>
            )}

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
            <button type="submit" className="admin-btn primary" disabled={loading || !folderName.trim()}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
