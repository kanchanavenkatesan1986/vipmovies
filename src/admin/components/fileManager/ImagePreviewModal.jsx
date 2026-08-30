import React, { useEffect, useState } from 'react';
import { fileManagerApi } from '../../services/fileManager/fileManagerApi';
import { showToast } from '../common/ToastContainer';

export default function ImagePreviewModal({
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
      showToast('Image URL copied to clipboard', 'success');
    }
  };

  const handleDownload = async () => {
    const dUrl = await fileManagerApi.getDownloadUrl(fileItem.key);
    window.open(dUrl, '_blank');
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box md" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-image" style={{ color: 'var(--admin-gold)' }}></i>
            <span style={{ maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileItem.filename}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="admin-btn text sm"
              onClick={handleCopyLink}
              title="Copy image link"
            >
              <i className="fa-solid fa-link"></i>
            </button>
            <button type="button" className="admin-modal-close" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div className="admin-modal-body" style={{ padding: '0', background: '#000', textAlign: 'center', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <div style={{ color: '#fff', padding: '40px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: 'var(--admin-blue)' }}></i>
              <p style={{ marginTop: '10px', color: 'var(--admin-text-muted)' }}>Loading image from R2...</p>
            </div>
          ) : streamUrl && !hasError ? (
            <img
              src={streamUrl}
              alt={fileItem.filename}
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block', margin: '0 auto' }}
              onError={() => setHasError(true)}
            />
          ) : (
            <div style={{ color: 'var(--admin-text-muted)', padding: '30px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '32px', color: 'var(--admin-danger)', marginBottom: '10px' }}></i>
              <p>Unable to display image directly.</p>
              <button type="button" className="admin-btn secondary sm" onClick={handleDownload} style={{ marginTop: '10px' }}>
                <i className="fa-solid fa-download"></i> Download Image
              </button>
            </div>
          )}
        </div>

        <div className="admin-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>
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
