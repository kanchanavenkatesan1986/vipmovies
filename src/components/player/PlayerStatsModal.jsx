import React from 'react';
import { formatPlayerTime } from './playerUtils';

export default function PlayerStatsModal({
  isOpen,
  onClose,
  stats = {}
}) {
  if (!isOpen) return null;

  return (
    <div className="vip-stats-overlay" onClick={onClose}>
      <div className="vip-stats-card" onClick={(e) => e.stopPropagation()}>
        <div className="vip-stats-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--accent, #f59e0b)' }}></i>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>Player Statistics</h4>
          </div>
          <button type="button" className="vip-stats-close-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="vip-stats-grid">
          <div className="vip-stat-row">
            <span className="label">Video Resolution:</span>
            <span className="val">{stats.videoWidth && stats.videoHeight ? `${stats.videoWidth} × ${stats.videoHeight}` : 'Auto / Native'}</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Current Quality:</span>
            <span className="val">{stats.quality || 'Auto'}</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Buffer Health:</span>
            <span className="val">{stats.bufferSeconds ? `${stats.bufferSeconds.toFixed(1)}s` : '0.0s'}</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Playback Speed:</span>
            <span className="val">{stats.playbackRate || 1.0}x</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Current Position:</span>
            <span className="val">{formatPlayerTime(stats.currentTime || 0)} / {formatPlayerTime(stats.duration || 0)}</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Dropped Frames:</span>
            <span className="val">{stats.droppedFrames !== undefined ? stats.droppedFrames : 0}</span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Player State:</span>
            <span className="val" style={{ textTransform: 'uppercase', color: stats.state === 'PLAYING' ? '#10b981' : '#f59e0b' }}>
              {stats.state || 'IDLE'}
            </span>
          </div>

          <div className="vip-stat-row">
            <span className="label">Stream Source Host:</span>
            <span className="val"><code>{stats.sourceHost || 'Cloudflare R2'}</code></span>
          </div>
        </div>

        <div className="vip-stats-footer">
          <span style={{ fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>
            VIP Movies Adaptive Range Streaming Engine
          </span>
          <button type="button" className="admin-btn text sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
