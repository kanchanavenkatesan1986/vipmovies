import React, { useEffect, useState } from 'react';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';
import { formatBytes, formatDate } from '../../services/fileManager/fileManagerUtils';
import { showToast } from '../common/ToastContainer';

export default function FileDetailsModal({
  isOpen,
  fileItem,
  onClose,
  onOpenPreview,
  onOpenRename,
  onOpenMove,
  onOpenCopy,
  onDelete
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');

  useEffect(() => {
    if (isOpen && fileItem) {
      // 1. Instantly use existing metadata from listing (0ms latency, zero Class B calls)
      setDetails(fileItem);
      const cleanKey = (fileItem.key || '').replace(/^\/+/, '');
      fileManagerApi.getMediaUrl(cleanKey).then(setMediaUrl).catch(() => {});

      // 2. Only fetch over the wire if vital metadata is absent
      const hasCompleteMeta = fileItem.size !== undefined && fileItem.etag !== undefined;
      if (!hasCompleteMeta) {
        setLoading(true);
        fileManagerApi.getObjectDetails(fileItem.key)
          .then((data) => {
            setDetails(data);
          })
          .catch(() => {
            setDetails(fileItem);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setDetails(null);
      setMediaUrl('');
    }
  }, [isOpen, fileItem]);

  if (!isOpen || !fileItem) return null;

  const item = details || fileItem;
  const cleanKey = (fileItem.key || '').replace(/^\/+/, '');
  const defaultDownloadUrl = `https://api-download.akatsuki-pvt-ltd.workers.dev/${cleanKey}`;
  const displayUrl = mediaUrl || defaultDownloadUrl;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(item.key);
    showToast(`R2 Key copied: ${item.key}`, 'success');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(displayUrl);
    showToast('Direct Stream & Download URL copied to clipboard!', 'success');
  };

  const handleDownload = async () => {
    const dUrl = await fileManagerApi.getDownloadUrl(item.key);
    window.open(dUrl || displayUrl, '_blank');
  };

  const handleRefreshDetails = async () => {
    if (!fileItem?.key) return;
    setLoading(true);
    try {
      const freshData = await fileManagerApi.getObjectDetails(fileItem.key, true);
      setDetails(freshData);
      showToast('Fresh metadata loaded from R2', 'success');
    } catch (err) {
      showToast('Failed to refresh metadata', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box md" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--admin-blue)' }}></i>
            Object Details
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="admin-btn text sm"
              onClick={handleRefreshDetails}
              title="Refresh fresh metadata from R2"
              disabled={loading}
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            </button>
            <button type="button" className="admin-modal-close" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div className="admin-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--admin-blue)' }}></i>
              <p style={{ marginTop: '10px', color: 'var(--admin-text-muted)' }}>Loading object metadata...</p>
            </div>
          ) : (
            <div className="fm-details-grid">
              <div className="fm-details-header">
                <div className="fm-details-icon">
                  <i className={`fa-solid ${item.isVideo ? 'fa-film' : item.isImage ? 'fa-image' : 'fa-file'}`}></i>
                </div>
                <div className="fm-details-main-info">
                  <h4 title={item.filename}>{item.filename}</h4>
                  <span className="badge">{item.contentType || 'application/octet-stream'}</span>
                </div>
              </div>

              <div className="fm-details-fields">
                <div className="fm-detail-row">
                  <span className="label">Full Key</span>
                  <div className="val-box">
                    <code>{item.key}</code>
                    <button type="button" className="admin-btn text sm" onClick={handleCopyKey} title="Copy Key">
                      <i className="fa-solid fa-copy"></i>
                    </button>
                  </div>
                </div>

                <div className="fm-detail-row">
                  <span className="label">File Size</span>
                  <span className="val">{formatBytes(item.size)} ({item.size?.toLocaleString()} bytes)</span>
                </div>

                <div className="fm-detail-row">
                  <span className="label">ETag</span>
                  <span className="val"><code>{item.etag || '—'}</code></span>
                </div>

                <div className="fm-detail-row">
                  <span className="label">Uploaded / Modified</span>
                  <span className="val">{formatDate(item.uploaded)}</span>
                </div>

                <div className="fm-detail-row" style={{ background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(59, 130, 246, 0.2)', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className="label" style={{ color: 'var(--admin-blue)', fontWeight: 600 }}>
                      <i className="fa-solid fa-link" style={{ marginRight: '6px' }}></i>
                      Direct URL (Stream & Download)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>Public CDN Link</span>
                  </div>
                  <div className="val-box">
                    <code style={{ wordBreak: 'break-all', fontSize: '12px', userSelect: 'all' }}>{displayUrl}</code>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button type="button" className="admin-btn text sm" onClick={handleCopyUrl} title="Copy Direct URL">
                        <i className="fa-solid fa-copy"></i>
                      </button>
                      <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="admin-btn text sm" title="Open / Test Link" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
            {item.isVideo && (
              <button type="button" className="admin-btn primary sm" onClick={() => { onClose(); onOpenPreview(item); }}>
                <i className="fa-solid fa-play"></i> Preview
              </button>
            )}
            <button type="button" className="admin-btn secondary sm" onClick={handleDownload}>
              <i className="fa-solid fa-download"></i> Download
            </button>
          </div>

          <button type="button" className="admin-btn text sm" onClick={() => { onClose(); onOpenRename(item); }}>
            <i className="fa-solid fa-pen"></i> Rename
          </button>
          <button type="button" className="admin-btn text sm" onClick={() => { onClose(); onOpenMove(item); }}>
            <i className="fa-solid fa-arrows-up-down-left-right"></i> Move
          </button>
          <button type="button" className="admin-btn danger sm" onClick={() => { onClose(); onDelete(item); }}>
            <i className="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
