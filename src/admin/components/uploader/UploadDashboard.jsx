import React from 'react';
import { formatBytes, formatSpeed, formatETA } from '../../services/uploader/uploadUtils';

export default function UploadDashboard({
  stats,
  onAddFilesClick,
  onStartAll,
  onPauseAll,
  onRetryFailed,
  onCancelAll,
  onClearQueue,
  onOpenSettings
}) {
  const {
    totalFiles = 0,
    totalBytes = 0,
    totalUploadedBytes = 0,
    overallProgress = 0,
    activeFilesCount = 0,
    queuedCount = 0,
    completedCount = 0,
    failedCount = 0,
    pausedCount = 0,
    overallSpeed = 0,
    overallETA = 0,
    isOnline = true,
    isPausedAll = false
  } = stats || {};

  return (
    <div className="upload-dashboard-card">
      {/* Top Banner & Online Status */}
      <div className="upload-dashboard-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="upload-dashboard-title">
              <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--admin-blue)' }}></i>
              Large Movie Upload Manager
            </h2>
            <span className={`upload-status-pill ${isOnline ? 'online' : 'offline'}`}>
              <i className={`fa-solid fa-circle`} style={{ fontSize: '8px' }}></i>
              {isOnline ? 'Worker Connected' : 'Offline'}
            </span>
          </div>
          <p className="upload-dashboard-subtitle">
            Resumable Cloudflare R2 Multipart Pipeline • 5GB+ Movie Support • 50+ Queue Scheduler
          </p>
        </div>

        {/* Action Buttons */}
        <div className="upload-dashboard-actions">
          <button className="admin-btn primary" onClick={onAddFilesClick}>
            <i className="fa-solid fa-plus"></i>
            <span>Add Movies</span>
          </button>

          {isPausedAll || activeFilesCount === 0 ? (
            <button
              className="admin-btn success"
              onClick={onStartAll}
              disabled={totalFiles === 0 || queuedCount + pausedCount === 0}
            >
              <i className="fa-solid fa-play"></i>
              <span>Start All</span>
            </button>
          ) : (
            <button className="admin-btn warning" onClick={onPauseAll}>
              <i className="fa-solid fa-pause"></i>
              <span>Pause All</span>
            </button>
          )}

          {failedCount > 0 && (
            <button className="admin-btn danger" onClick={onRetryFailed}>
              <i className="fa-solid fa-rotate-right"></i>
              <span>Retry Failed ({failedCount})</span>
            </button>
          )}

          <button className="admin-btn secondary" onClick={onOpenSettings} title="Upload Settings">
            <i className="fa-solid fa-gear"></i>
            <span>Settings</span>
          </button>

          {totalFiles > 0 && (
            <button className="admin-btn text" onClick={onClearQueue} title="Clear Queue">
              <i className="fa-solid fa-trash-can"></i>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="upload-kpi-grid">
        <div className="upload-kpi-item">
          <div className="kpi-label">Total Queue</div>
          <div className="kpi-value">{totalFiles} <span className="kpi-unit">Files</span></div>
          <div className="kpi-sub">{formatBytes(totalBytes)} total</div>
        </div>

        <div className="upload-kpi-item">
          <div className="kpi-label">Active / Waiting</div>
          <div className="kpi-value">
            <span style={{ color: 'var(--admin-blue)' }}>{activeFilesCount}</span>
            <span style={{ color: 'var(--admin-text-muted)', fontSize: '18px', margin: '0 4px' }}>/</span>
            <span style={{ color: 'var(--admin-gold)' }}>{queuedCount}</span>
          </div>
          <div className="kpi-sub">{pausedCount} paused</div>
        </div>

        <div className="upload-kpi-item">
          <div className="kpi-label">Upload Speed</div>
          <div className="kpi-value" style={{ color: overallSpeed > 0 ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
            {formatSpeed(overallSpeed)}
          </div>
          <div className="kpi-sub">{overallETA > 0 ? `ETA: ${formatETA(overallETA)}` : 'Idle / Ready'}</div>
        </div>

        <div className="upload-kpi-item">
          <div className="kpi-label">Uploaded Volume</div>
          <div className="kpi-value">
            {formatBytes(totalUploadedBytes)}
          </div>
          <div className="kpi-sub">{completedCount} of {totalFiles} movies done</div>
        </div>
      </div>

      {/* Global Weighted Progress Bar */}
      <div className="upload-overall-progress-wrap">
        <div className="upload-progress-info">
          <span>Overall Queue Progress ({formatBytes(totalUploadedBytes)} / {formatBytes(totalBytes)})</span>
          <span className="upload-progress-pct">{overallProgress}%</span>
        </div>
        <div className="upload-progress-bar-bg">
          <div
            className="upload-progress-bar-fill"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
