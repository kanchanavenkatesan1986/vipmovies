import React, { useEffect, useState } from 'react';
import { sanitizeFilename, sanitizeMovieFolder } from '../../services/uploader/uploadUtils';

export default function RenameModal({
  isOpen,
  target, // { type: 'file' | 'folder', item: object }
  onClose,
  onRename
}) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && target) {
      if (target.type === 'folder') {
        setNewName(target.item.name || '');
      } else {
        setNewName(target.item.filename || '');
      }
      setError(null);
    } else {
      setNewName('');
    }
  }, [isOpen, target]);

  if (!isOpen || !target) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const isFolder = target.type === 'folder';

    if (isFolder) {
      const clean = sanitizeMovieFolder(newName);
      if (!clean) {
        setError('Invalid folder name');
        return;
      }
      const parentPrefix = target.item.parentPrefix || '';
      const newPrefix = `${parentPrefix}${clean}/`;

      setLoading(true);
      try {
        await onRename(target.item.prefix, newPrefix, 'folder');
        onClose();
      } catch (err) {
        setError(err.message || 'Rename failed');
      } finally {
        setLoading(false);
      }
    } else {
      const clean = sanitizeFilename(newName);
      if (!clean) {
        setError('Invalid filename. Please preserve the valid video/media extension.');
        return;
      }

      const parts = target.item.key.split('/');
      parts.pop();
      const parentDir = parts.length > 0 ? parts.join('/') + '/' : '';
      const newKey = `${parentDir}${clean}`;

      setLoading(true);
      try {
        await onRename(target.item.key, newKey, 'file');
        onClose();
      } catch (err) {
        setError(err.message || 'Rename failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-pen" style={{ color: 'var(--admin-gold)' }}></i>
            Rename {target.type === 'folder' ? 'Folder' : 'File'}
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="admin-form-group">
              <label className="admin-label">Original Name</label>
              <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', background: 'var(--admin-surface)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                <code>{target.type === 'folder' ? target.item.name : target.item.filename}</code>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">New Name</label>
              <input
                type="text"
                className="admin-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                required
              />
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
            <button type="submit" className="admin-btn primary" disabled={loading || !newName.trim()}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Apply Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
