import React, { useState } from 'react';
import { formatBytes } from '../../services/uploader/uploadUtils';
import { showToast } from '../common/ToastContainer';

export default function ResumeFileModal({
  isOpen,
  targetItem,
  onAttachFile,
  onClose
}) {
  const [error, setError] = useState(null);

  if (!isOpen || !targetItem) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Verify basic file identity (matching filename and size)
    if (file.name !== targetItem.filename) {
      setError(`Filename mismatch! Expected "${targetItem.filename}", but selected "${file.name}".`);
      e.target.value = '';
      return;
    }

    if (file.size !== targetItem.fileSize) {
      setError(`File size mismatch! Expected ${formatBytes(targetItem.fileSize)}, but selected ${formatBytes(file.size)}.`);
      e.target.value = '';
      return;
    }

    const success = onAttachFile(targetItem.id, file);
    if (success) {
      showToast(`File attached! Resuming ${targetItem.filename} from existing parts`, 'success');
      onClose();
    } else {
      setError('Could not attach file to upload session.');
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-file-circle-check" style={{ color: 'var(--admin-gold)' }}></i>
            Resume Unfinished Upload
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--admin-text-main)', fontSize: '14px', margin: 0 }}>
            After browser refresh, please select the original file to resume uploading missing chunks:
          </p>

          <div className="resume-target-info" style={{
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            padding: '14px 18px',
            borderRadius: '10px'
          }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px', marginBottom: '4px' }}>
              <i className="fa-solid fa-film" style={{ color: 'var(--admin-blue)', marginRight: '8px' }}></i>
              {targetItem.filename}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              Target Size: <strong>{formatBytes(targetItem.fileSize)}</strong> • Progress: <strong>{targetItem.completedParts?.length || 0}/{targetItem.totalParts || 1} Parts</strong>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)', marginTop: '6px' }}>
              R2 Key: <code>{targetItem.destinationKey}</code>
            </div>
          </div>

          {/* Native Label-based File Trigger — 100% reliable click in all browsers */}
          <label
            className="admin-btn primary"
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <i className="fa-solid fa-folder-open"></i>
            <span>Browse & Select Original File</span>
            <input
              type="file"
              accept=".mp4,.mkv,.webm,.mov,.m4v,.avi,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--admin-danger)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="admin-btn text" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
