import React, { useState, useEffect } from 'react';
import { urlUploadManager, UPLOAD_STATUS } from '../../services/fileManager/urlUploadManager';
import { formatBytes, getFileIcon } from '../../services/fileManager/fileManagerUtils';

export default function BackgroundUploadDrawer({ onOpenUploadModal }) {
  const [state, setState] = useState(() => urlUploadManager.getState());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = urlUploadManager.subscribe((newState) => {
      setState(newState);
      if (newState.hasActive && isDismissed) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, [isDismissed]);

  // Format seconds to compact ETA
  const formatCompactEta = (sec) => {
    if (sec === null || sec === undefined) return '';
    if (sec <= 0) return 'Finalizing';
    if (sec < 60) return `~${sec}s left`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `~${m}m ${s}s left`;
  };

  if (state.totalCount === 0 || (isDismissed && !state.hasActive)) {
    return null;
  }

  const { items, activeCount, queuedCount, completedCount, errorCount, hasActive, totalSpeedBps, overallPercent, concurrency } = state;

  return (
    <div className={`fm-bg-upload-container ${isExpanded ? 'expanded' : 'minimized'}`}>
      {/* 1. MINIMIZED PILL (Floating in bottom-right) */}
      {!isExpanded && (
        <div
          className={`fm-bg-upload-pill ${hasActive ? 'active' : 'idle'}`}
          onClick={() => setIsExpanded(true)}
          title="Click to view background URL upload progress"
        >
          <div className="fm-bg-pill-icon">
            {hasActive ? (
              <i className="fa-solid fa-cloud-arrow-up fa-fade"></i>
            ) : errorCount > 0 ? (
              <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--admin-danger)' }}></i>
            ) : (
              <i className="fa-solid fa-circle-check" style={{ color: 'var(--admin-success)' }}></i>
            )}
          </div>

          <div className="fm-bg-pill-info">
            <div className="fm-bg-pill-title">
              {hasActive ? (
                <>
                  <span>Uploading {activeCount} of {items.length}</span>
                  {totalSpeedBps > 0 && <span className="fm-bg-pill-speed">• {formatBytes(totalSpeedBps)}/s</span>}
                </>
              ) : (
                <span>{completedCount} Upload{completedCount !== 1 ? 's' : ''} Completed</span>
              )}
            </div>
            {hasActive && (
              <div className="fm-bg-pill-progress-track">
                <div
                  className="fm-bg-pill-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(3, overallPercent))}%` }}
                ></div>
              </div>
            )}
          </div>

          <div className="fm-bg-pill-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="fm-bg-pill-btn expand"
              onClick={() => setIsExpanded(true)}
              title="Expand transfers"
            >
              <i className="fa-solid fa-chevron-up"></i>
            </button>
            {!hasActive && (
              <button
                type="button"
                className="fm-bg-pill-btn close"
                onClick={() => {
                  urlUploadManager.clearCompleted();
                  setIsDismissed(true);
                }}
                title="Dismiss"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. EXPANDED DRAWER CARD */}
      {isExpanded && (
        <div className="fm-bg-upload-card">
          {/* Card Header */}
          <div className="fm-bg-card-header">
            <div className="fm-bg-card-title-group">
              <div className="fm-bg-card-badge">
                <i className={`fa-solid fa-cloud-arrow-up ${hasActive ? 'fa-fade' : ''}`}></i>
              </div>
              <div>
                <h4 className="fm-bg-card-title">Background URL Uploads</h4>
                <div className="fm-bg-card-subtitle">
                  {hasActive ? (
                    <span>{activeCount} Active • {queuedCount} Waiting • {completedCount} Done</span>
                  ) : (
                    <span style={{ color: 'var(--admin-success)' }}>All transfers finished ({completedCount} files)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="fm-bg-card-header-actions">
              {onOpenUploadModal && (
                <button
                  type="button"
                  className="admin-btn text sm"
                  onClick={onOpenUploadModal}
                  title="Add more URLs to upload"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  <i className="fa-solid fa-plus"></i> Add
                </button>
              )}
              {completedCount > 0 && !hasActive && (
                <button
                  type="button"
                  className="admin-btn text sm"
                  onClick={() => urlUploadManager.clearCompleted()}
                  title="Clear finished items"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="fm-bg-close-btn"
                onClick={() => setIsExpanded(false)}
                title="Minimize to background pill"
              >
                <i className="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          </div>

          {/* Overall Progress & Speed Bar */}
          {hasActive && (
            <div className="fm-bg-overall-section">
              <div className="fm-bg-overall-labels">
                <span>Batch Progress ({overallPercent}%)</span>
                <span>{totalSpeedBps > 0 ? `${formatBytes(totalSpeedBps)}/s` : 'Connecting...'}</span>
              </div>
              <div className="fm-bg-overall-track">
                <div
                  className="fm-bg-overall-fill"
                  style={{ width: `${Math.min(100, Math.max(2, overallPercent))}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Concurrency Switcher */}
          <div className="fm-bg-concurrency-row">
            <span className="fm-bg-concurrency-label">Simultaneous Uploads:</span>
            <div className="fm-bg-concurrency-options">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`fm-bg-concurrency-btn ${concurrency === num ? 'active' : ''}`}
                  onClick={() => urlUploadManager.setConcurrency(num)}
                  title={`Upload ${num} file${num > 1 ? 's' : ''} at the same time`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Items List */}
          <div className="fm-bg-items-list">
            {items.map((item) => {
              const fileIcon = getFileIcon('file', item.filename);
              const isUploading = item.status === UPLOAD_STATUS.UPLOADING;
              const isQueued = item.status === UPLOAD_STATUS.QUEUED;
              const isComplete = item.status === UPLOAD_STATUS.COMPLETE;
              const isError = item.status === UPLOAD_STATUS.ERROR;
              const isCancelled = item.status === UPLOAD_STATUS.CANCELLED;

              return (
                <div key={item.id} className={`fm-bg-item-row status-${item.status}`}>
                  <div className="fm-bg-item-icon">
                    <i className={`fa-solid ${fileIcon}`}></i>
                  </div>

                  <div className="fm-bg-item-content">
                    <div className="fm-bg-item-top">
                      <span className="fm-bg-item-name" title={item.filename}>
                        {item.filename}
                      </span>
                      <span className={`fm-bg-status-tag ${item.status}`}>
                        {isUploading && `${item.percent.toFixed(item.percent % 1 === 0 ? 0 : 1)}%`}
                        {isQueued && 'Waiting'}
                        {isComplete && 'Done'}
                        {isError && 'Error'}
                        {isCancelled && 'Cancelled'}
                      </span>
                    </div>

                    {/* Destination Folder Tag */}
                    <div className="fm-bg-item-meta">
                      <span className="fm-bg-prefix-tag" title={`Destination: /${item.prefix || ''}`}>
                        <i className="fa-regular fa-folder"></i> /{item.prefix || 'root'}
                      </span>
                      {isUploading && item.speed && (
                        <span className="fm-bg-speed-tag">{item.speed}</span>
                      )}
                      {isUploading && item.etaSeconds !== null && (
                        <span className="fm-bg-eta-tag">{formatCompactEta(item.etaSeconds)}</span>
                      )}
                      {isComplete && item.result?.sizeFormatted && (
                        <span className="fm-bg-size-tag">{item.result.sizeFormatted}</span>
                      )}
                    </div>

                    {/* Item Progress Bar */}
                    {isUploading && (
                      <div className="fm-bg-item-progress-track">
                        <div
                          className="fm-bg-item-progress-fill"
                          style={{ width: `${Math.min(100, Math.max(3, item.percent))}%` }}
                        ></div>
                      </div>
                    )}

                    {/* Error message */}
                    {isError && item.errorMessage && (
                      <div className="fm-bg-item-error-msg" title={item.errorMessage}>
                        {item.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Item Actions */}
                  <div className="fm-bg-item-actions">
                    {isUploading && (
                      <button
                        type="button"
                        className="fm-bg-action-btn cancel"
                        onClick={() => urlUploadManager.cancelItem(item.id)}
                        title="Cancel this upload"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                    {isQueued && (
                      <button
                        type="button"
                        className="fm-bg-action-btn cancel"
                        onClick={() => urlUploadManager.removeItem(item.id)}
                        title="Remove from queue"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                    {(isError || isCancelled) && (
                      <button
                        type="button"
                        className="fm-bg-action-btn retry"
                        onClick={() => urlUploadManager.retryItem(item.id)}
                        title="Retry upload"
                      >
                        <i className="fa-solid fa-rotate-right"></i>
                      </button>
                    )}
                    {(isComplete || isError || isCancelled) && (
                      <button
                        type="button"
                        className="fm-bg-action-btn remove"
                        onClick={() => urlUploadManager.removeItem(item.id)}
                        title="Remove from list"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="fm-bg-card-footer">
            {hasActive ? (
              <button
                type="button"
                className="admin-btn text sm danger"
                onClick={() => urlUploadManager.cancelAll()}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                Cancel All
              </button>
            ) : (
              <button
                type="button"
                className="admin-btn text sm"
                onClick={() => {
                  urlUploadManager.clearCompleted();
                  setIsExpanded(false);
                }}
                style={{ fontSize: '11.5px', padding: '4px 8px' }}
              >
                Clear All Finished
              </button>
            )}

            <button
              type="button"
              className="admin-btn secondary sm"
              onClick={() => setIsExpanded(false)}
              style={{ fontSize: '12px', padding: '4px 12px' }}
            >
              Minimize
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
