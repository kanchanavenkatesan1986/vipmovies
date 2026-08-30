import React, { useState } from 'react';
import { formatBytes, formatSpeed, formatETA, sanitizeMovieFolder, sanitizeFilename } from '../../services/uploader/uploadUtils';
import { UPLOAD_STATUS } from '../../services/uploader/uploadScheduler';
import { DEFAULT_UPLOAD_CONFIG } from '../../services/uploader/uploadConfig';
import { showToast } from '../common/ToastContainer';

export default function UploadItem({
  item,
  isSelected,
  onToggleSelect,
  onUpdateMetadata,
  onStart,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onDelete,
  onRequestFileReattach,
  categories,
  years,
  mediaBaseUrl
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState(item.category);
  const [editYear, setEditYear] = useState(item.year);
  const [editFolder, setEditFolder] = useState(item.movieFolder);
  const [editFilename, setEditFilename] = useState(item.filename);

  const percent = item.fileSize > 0 ? Math.min(100, Math.round((item.uploadedBytes / item.fileSize) * 100)) : 0;
  const completedPartsCount = item.completedParts ? item.completedParts.length : 0;

  const isEditable = item.status === UPLOAD_STATUS.QUEUED || item.status === UPLOAD_STATUS.PAUSED || item.status === UPLOAD_STATUS.FAILED;

  const handleSaveEdit = () => {
    onUpdateMetadata(item.id, {
      category: editCategory,
      year: editYear,
      movieFolder: sanitizeMovieFolder(editFolder),
      filename: sanitizeFilename(editFilename)
    });
    setIsEditing(false);
    showToast('Destination path updated', 'success');
  };

  const copyToClipboard = (text, msg = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text);
    showToast(msg, 'success');
  };

  // Status Badge Class & Icon
  const getStatusBadge = () => {
    switch (item.status) {
      case UPLOAD_STATUS.UPLOADING:
        return <span className="item-badge uploading"><i className="fa-solid fa-spinner fa-spin"></i> Uploading</span>;
      case UPLOAD_STATUS.CREATING:
        return <span className="item-badge creating"><i className="fa-solid fa-gear fa-spin"></i> Initializing R2</span>;
      case UPLOAD_STATUS.VERIFYING:
        return <span className="item-badge verifying"><i className="fa-solid fa-list-check"></i> Verifying Parts</span>;
      case UPLOAD_STATUS.COMPLETING:
        return <span className="item-badge completing"><i className="fa-solid fa-circle-notch fa-spin"></i> Finalizing</span>;
      case UPLOAD_STATUS.COMPLETED:
        return <span className="item-badge completed"><i className="fa-solid fa-circle-check"></i> Completed</span>;
      case UPLOAD_STATUS.PAUSED:
        return <span className="item-badge paused"><i className="fa-solid fa-circle-pause"></i> Paused</span>;
      case UPLOAD_STATUS.FAILED:
        return <span className="item-badge failed"><i className="fa-solid fa-circle-exclamation"></i> Failed</span>;
      case UPLOAD_STATUS.CANCELLED:
        return <span className="item-badge cancelled"><i className="fa-solid fa-ban"></i> Cancelled</span>;
      default:
        return <span className="item-badge queued"><i className="fa-solid fa-clock"></i> Queued</span>;
    }
  };

  return (
    <div className={`upload-item-card status-${item.status.toLowerCase()} ${isSelected ? 'selected' : ''}`}>
      {/* Top Header Row */}
      <div className="upload-item-top">
        <div className="upload-item-info-left">
          {isEditable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              className="admin-checkbox"
            />
          )}

          <div className="upload-item-icon">
            <i className="fa-solid fa-file-video"></i>
          </div>

          <div className="upload-item-titles">
            <div className="upload-item-title-row">
              <span className="upload-item-filename" title={item.filename}>{item.filename}</span>
              <span className="upload-item-size">{formatBytes(item.fileSize)}</span>
              {getStatusBadge()}
            </div>

            {/* Visual Destination Breadcrumbs */}
            <div className="upload-destination-breadcrumbs">
              <span className="crumb-segment cat"><i className="fa-solid fa-folder"></i> {item.category}</span>
              <span className="crumb-slash">/</span>
              <span className="crumb-segment yr">{item.year}</span>
              <span className="crumb-slash">/</span>
              <span className="crumb-segment folder">{item.movieFolder}</span>
              <span className="crumb-slash">/</span>
              <span className="crumb-segment file">{item.filename}</span>

              {isEditable && (
                <button
                  type="button"
                  className="crumb-edit-btn"
                  onClick={() => setIsEditing(!isEditing)}
                  title="Edit Category / Year / Folder / Filename"
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>{isEditing ? 'Close' : 'Edit Path'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="upload-item-actions">
          {item.status === UPLOAD_STATUS.QUEUED && (
            <button className="admin-btn primary sm" onClick={() => onStart(item.id)} title="Start Upload">
              <i className="fa-solid fa-play"></i> Start
            </button>
          )}

          {item.status === UPLOAD_STATUS.UPLOADING && (
            <button className="admin-btn warning sm" onClick={() => onPause(item.id)} title="Pause Upload">
              <i className="fa-solid fa-pause"></i> Pause
            </button>
          )}

          {item.status === UPLOAD_STATUS.PAUSED && (
            <button className="admin-btn success sm" onClick={() => onResume(item.id)} title="Resume Upload">
              <i className="fa-solid fa-play"></i> Resume
            </button>
          )}

          {item.status === UPLOAD_STATUS.FAILED && (
            <button className="admin-btn danger sm" onClick={() => onRetry(item.id)} title="Retry Upload">
              <i className="fa-solid fa-rotate-right"></i> Retry
            </button>
          )}

          {(item.status === UPLOAD_STATUS.UPLOADING || item.status === UPLOAD_STATUS.PAUSED || item.status === UPLOAD_STATUS.QUEUED) && (
            <button className="admin-btn secondary sm" onClick={() => onCancel(item.id)} title="Cancel Upload">
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          )}

          {(item.status === UPLOAD_STATUS.COMPLETED || item.status === UPLOAD_STATUS.CANCELLED || item.status === UPLOAD_STATUS.FAILED) && (
            <button className="admin-btn text sm" onClick={() => onDelete(item.id)} title="Remove from Queue">
              <i className="fa-solid fa-trash-can"></i>
            </button>
          )}
        </div>
      </div>

      {/* Editable Metadata Form Drawer */}
      {isEditing && isEditable && (
        <div className="upload-item-edit-drawer">
          <div className="edit-drawer-grid">
            <div className="edit-field">
              <label>Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="admin-select"
              >
                {(categories || DEFAULT_UPLOAD_CONFIG.allowedCategories).map(cat => (
                  <option key={cat.id || cat} value={cat.id || cat}>{cat.label || cat}</option>
                ))}
              </select>
            </div>

            <div className="edit-field">
              <label>Release Year</label>
              <select
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                className="admin-select"
              >
                {(years || DEFAULT_UPLOAD_CONFIG.years).map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <div className="edit-field">
              <label>Movie Folder (Safe)</label>
              <input
                type="text"
                value={editFolder}
                onChange={(e) => setEditFolder(e.target.value)}
                className="admin-input"
                placeholder="e.g. leo"
              />
            </div>

            <div className="edit-field">
              <label>Filename</label>
              <input
                type="text"
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
                className="admin-input"
                placeholder="e.g. leo.mp4"
              />
            </div>
          </div>

          <div className="edit-drawer-actions">
            <button className="admin-btn primary sm" onClick={handleSaveEdit}>
              <i className="fa-solid fa-check"></i> Apply Changes
            </button>
            <button className="admin-btn text sm" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar & Realtime Stats */}
      <div className="upload-item-progress-section">
        <div className="upload-item-progress-bar-bg">
          <div
            className={`upload-item-progress-bar-fill ${item.status.toLowerCase()}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="upload-item-progress-stats">
          <div className="stat-left">
            <span className="pct">{percent}%</span>
            <span className="vol">{formatBytes(item.uploadedBytes)} of {formatBytes(item.fileSize)}</span>
            <span className="parts">
              <i className="fa-solid fa-cubes"></i> Part {completedPartsCount}/{item.totalParts || 1}
            </span>
          </div>

          <div className="stat-right">
            {item.status === UPLOAD_STATUS.UPLOADING && (
              <>
                <span className="speed"><i className="fa-solid fa-gauge-high"></i> {formatSpeed(item.speed)}</span>
                <span className="eta"><i className="fa-solid fa-hourglass-half"></i> {formatETA(item.eta)}</span>
              </>
            )}
            {item.retryCount > 0 && (
              <span className="retries"><i className="fa-solid fa-arrows-rotate"></i> Retries: {item.retryCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Error Message Alert */}
      {item.error && (
        <div className="upload-item-error-banner">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{item.error}</span>
          {item.error.includes('File object missing') && (
            <button className="admin-btn text sm" onClick={() => onRequestFileReattach(item)}>
              <i className="fa-solid fa-folder-open"></i> Select File
            </button>
          )}
        </div>
      )}

      {/* Completion Details & Quick Links */}
      {item.status === UPLOAD_STATUS.COMPLETED && (
        <div className="upload-item-completed-banner">
          <div className="completed-info">
            <i className="fa-solid fa-circle-check" style={{ color: 'var(--admin-success)' }}></i>
            <span>R2 Destination: <code>{item.destinationKey}</code></span>
          </div>
          <div className="completed-actions">
            <button
              className="admin-btn secondary sm"
              onClick={() => copyToClipboard(item.destinationKey, 'R2 Key copied')}
            >
              <i className="fa-solid fa-copy"></i> Copy Key
            </button>
            {mediaBaseUrl && (
              <button
                className="admin-btn secondary sm"
                onClick={() => copyToClipboard(`${mediaBaseUrl.replace(/\/+$/, '')}/${item.destinationKey}`, 'Playback URL copied')}
              >
                <i className="fa-solid fa-link"></i> Copy Playback URL
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
