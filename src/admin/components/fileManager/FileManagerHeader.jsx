import React from 'react';
import { formatBytes } from '../../services/fileManager/fileManagerUtils';

export default function FileManagerHeader({
  stats = { totalObjects: 0, totalSize: 0, folderCount: 0 },
  currentPrefix = '',
  loading = false,
  onRefresh,
  onOpenUpload
}) {
  return (
    <div className="fm-header-card">
      <div className="fm-header-main">
        <div className="fm-header-info">
          <div className="fm-header-badge">
            <i className="fa-solid fa-server"></i> Cloudflare R2 Storage
          </div>
          <h2 className="fm-header-title">
            Movie File Manager
          </h2>
          <p className="fm-header-subtitle">
            Browse, manage, stream, and organize movie assets directly in Cloudflare R2
          </p>
        </div>

        <div className="fm-header-actions">
          <button
            type="button"
            className="admin-btn text"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh current folder"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="admin-btn primary"
            onClick={onOpenUpload}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span>Upload Movies</span>
          </button>
        </div>
      </div>

      <div className="fm-header-stats-row">
        <div className="fm-stat-item">
          <div className="fm-stat-icon blue">
            <i className="fa-solid fa-folder-tree"></i>
          </div>
          <div className="fm-stat-text">
            <div className="fm-stat-val">{stats.folderCount || 0}</div>
            <div className="fm-stat-label">Folders in View</div>
          </div>
        </div>

        <div className="fm-stat-item">
          <div className="fm-stat-icon green">
            <i className="fa-solid fa-film"></i>
          </div>
          <div className="fm-stat-text">
            <div className="fm-stat-val">{stats.totalObjects || 0}</div>
            <div className="fm-stat-label">Objects in View</div>
          </div>
        </div>

        <div className="fm-stat-item">
          <div className="fm-stat-icon gold">
            <i className="fa-solid fa-hard-drive"></i>
          </div>
          <div className="fm-stat-text">
            <div className="fm-stat-val">{formatBytes(stats.totalSize || 0)}</div>
            <div className="fm-stat-label">Loaded Volume</div>
          </div>
        </div>

        <div className="fm-stat-item">
          <div className="fm-stat-icon purple">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div className="fm-stat-text">
            <div className="fm-stat-val" style={{ fontSize: '13px', wordBreak: 'break-all' }}>
              /{currentPrefix || 'root'}
            </div>
            <div className="fm-stat-label">Current Location</div>
          </div>
        </div>
      </div>
    </div>
  );
}
