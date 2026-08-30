import React, { useEffect, useState } from 'react';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';
import { showToast } from '../common/ToastContainer';

export default function VideoPreviewModal({
  isOpen,
  fileItem,
  onClose
}) {
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (isOpen && fileItem) {
      setLoading(true);
      setHasError(false);
      fileManagerApi.getStreamUrl(fileItem.key)
        .then((url) => {
          setStreamUrl(url);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
          setHasError(true);
        });
    } else {
      setStreamUrl('');
      setHasError(false);
    }
  }, [isOpen, fileItem]);

  if (!isOpen || !fileItem) return null;

  const handleCopyLink = () => {
    if (streamUrl) {
      navigator.clipboard.writeText(streamUrl);
      showToast('Direct stream link copied to clipboard', 'success');
    }
  };

  const handleOpenExternal = () => {
    if (streamUrl) {
      window.open(streamUrl, '_blank');
    }
  };

  const handleDownload = async () => {
    const dUrl = await fileManagerApi.getDownloadUrl(fileItem.key);
    window.open(dUrl, '_blank');
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box lg fm-player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-play" style={{ color: 'var(--admin-blue)' }}></i>
            <span style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileItem.filename}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="admin-btn text sm"
              onClick={handleCopyLink}
              title="Copy stream link"
            >
              <i className="fa-solid fa-link"></i>
            </button>
            <button
              type="button"
              className="admin-btn text sm"
              onClick={handleOpenExternal}
              title="Open stream in new tab"
            >
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </button>
            <button type="button" className="admin-modal-close" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div className="admin-modal-body" style={{ padding: '0', background: '#000', textAlign: 'center', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <div style={{ color: '#fff', padding: '40px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--admin-blue)' }}></i>
              <p style={{ marginTop: '12px' }}>Connecting to Cloudflare R2 Stream...</p>
            </div>
          ) : streamUrl && !hasError ? (
            <video
              key={streamUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              style={{ width: '100%', maxHeight: '65vh', outline: 'none' }}
              src={streamUrl}
              onError={() => setHasError(true)}
            >
              Your browser does not support HTML5 video playback.
            </video>
          ) : (
            <div style={{ color: 'var(--admin-text-muted)', padding: '40px', maxWidth: '460px', margin: '0 auto' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '36px', color: 'var(--admin-gold)', marginBottom: '14px' }}></i>
              <h4 style={{ color: '#fff', margin: '0 0 8px 0' }}>Playback Notice</h4>
              <p style={{ fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                This file format or audio codec might not be natively supported by your web browser player. You can open it in a media player or download it directly.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button type="button" className="admin-btn primary sm" onClick={handleOpenExternal}>
                  <i className="fa-solid fa-play"></i> Open Stream
                </button>
                <button type="button" className="admin-btn secondary sm" onClick={handleDownload}>
                  <i className="fa-solid fa-download"></i> Download Video
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="admin-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--admin-text-dim)' }}>
            <code>{fileItem.key}</code>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="admin-btn secondary sm" onClick={handleDownload}>
              <i className="fa-solid fa-download"></i> Download
            </button>
            <button type="button" className="admin-btn text sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
