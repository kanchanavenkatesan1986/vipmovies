import React, { useState } from 'react';
import { parseBreadcrumbs, formatBytes } from '../../services/fileManager/fileManagerUtils';
import { showToast } from '../common/ToastContainer';

export default function BreadcrumbPathBar({
  currentPrefix = '',
  onNavigatePrefix,
  totalFiles = 0,
  totalFolders = 0,
  totalBytes = 0
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [customPath, setCustomPath] = useState(currentPrefix);

  const crumbs = parseBreadcrumbs(currentPrefix);

  const handleCopyPath = () => {
    const fullPath = currentPrefix ? `R2 / ${currentPrefix}` : 'R2 Root';
    navigator.clipboard.writeText(currentPrefix || '/');
    showToast(`Path copied: ${fullPath}`, 'success');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    let sanitized = customPath.trim().replace(/^\/+/, '');
    if (sanitized && !sanitized.endsWith('/')) {
      sanitized += '/';
    }
    setIsEditing(false);
    onNavigatePrefix(sanitized);
  };

  return (
    <div className="fm-path-bar-wrap">
      <div className="fm-path-left">
        <button
          type="button"
          className="fm-path-up-btn"
          disabled={!currentPrefix}
          onClick={() => {
            const parts = currentPrefix.replace(/\/+$/, '').split('/');
            parts.pop();
            const parent = parts.length > 0 ? parts.join('/') + '/' : '';
            onNavigatePrefix(parent);
          }}
          title="Go Up One Level"
        >
          <i className="fa-solid fa-arrow-up"></i>
        </button>

        {isEditing ? (
          <form onSubmit={handleFormSubmit} className="fm-path-edit-form">
            <input
              type="text"
              className="admin-input sm fm-path-edit-input"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="e.g. tamil/2026/leo/"
              autoFocus
            />
            <button type="submit" className="admin-btn primary sm">Go</button>
            <button type="button" className="admin-btn text sm" onClick={() => setIsEditing(false)}>Cancel</button>
          </form>
        ) : (
          <div className="fm-breadcrumbs">
            {crumbs.map((crumb, idx) => {
              const isLast = idx === crumbs.length - 1;
              return (
                <React.Fragment key={crumb.path}>
                  <button
                    type="button"
                    className={`fm-crumb-item ${isLast ? 'current' : ''}`}
                    onClick={() => onNavigatePrefix(crumb.path)}
                  >
                    {idx === 0 && <i className="fa-solid fa-bucket" style={{ marginRight: '6px', color: 'var(--admin-blue)' }}></i>}
                    {crumb.label}
                  </button>
                  {!isLast && <i className="fa-solid fa-chevron-right fm-crumb-sep"></i>}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div className="fm-path-actions">
        {(totalFiles > 0 || totalFolders > 0) && (
          <div
            className="fm-folder-stats"
            title={`Total items in current view: ${totalFiles} file(s), ${totalFolders} folder(s), ${formatBytes(totalBytes)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              fontSize: '11px',
              color: 'var(--admin-text-muted)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginRight: '6px'
            }}
          >
            <span>
              <i className="fa-solid fa-file" style={{ color: 'var(--admin-blue)', marginRight: '4px' }}></i>
              {totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </span>
            <span style={{ opacity: 0.35 }}>•</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{formatBytes(totalBytes)}</span>
            {totalFolders > 0 && (
              <>
                <span style={{ opacity: 0.35 }}>•</span>
                <span>
                  <i className="fa-solid fa-folder" style={{ color: 'var(--admin-gold)', marginRight: '4px' }}></i>
                  {totalFolders}
                </span>
              </>
            )}
          </div>
        )}
        <button
          type="button"
          className="admin-btn text sm"
          onClick={() => {
            setCustomPath(currentPrefix);
            setIsEditing(!isEditing);
          }}
          title="Edit Path Manually"
        >
          <i className="fa-solid fa-pen-to-square"></i>
          <span>Edit</span>
        </button>

        <button
          type="button"
          className="admin-btn text sm"
          onClick={handleCopyPath}
          title="Copy Object Prefix"
        >
          <i className="fa-solid fa-copy"></i>
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
}
