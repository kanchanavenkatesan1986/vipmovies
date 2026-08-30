import React, { useRef, useState } from 'react';
import { formatBytes } from '../../services/uploader/uploadUtils';
import { showToast } from '../common/ToastContainer';

export default function ResumeFileModal({
  isOpen,
  targetItem,
  onAttachFile,
  onClose
}) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);

  if (!isOpen || !targetItem) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Verify basic file identity
    if (file.name !== targetItem.filename) {
      setError(`Filename mismatch! Expected "${targetItem.filename}", but selected "${file.name}".`);
      return;
    }

    if (file.size !== targetItem.fileSize) {
      setError(`File size mismatch! Expected ${formatBytes(targetItem.fileSize)}, but selected ${formatBytes(file.size)}.`);
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
          <button className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ color: 'var(--admin-text-main)', fontSize: '14px', margin: 0 }}>
            After browser refresh, please select the original file to resume uploading missing chunks:
          </p>

          <div className="resume-target-info" style={{
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
            padding: '12px 16px',
            borderRadius: '10px'
          }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '14.5px', marginBottom: '4px' }}>
              <i className="fa-solid fa-film" style={{ color: 'var(--admin-blue)', marginRight: '8px' }}></i>
              {targetItem.filename}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              Target Size: {formatBytes(targetItem.fileSize)} • Progress: {targetItem.completedParts?.length || 0}/{targetItem.totalParts || 1} Parts
            </div>
            <div style={{ fontSize: '12px', color: 'var(--admin-text-dim)', marginTop: '4px' }}>
              R2 Key: <code>{targetItem.destinationKey}</code>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mkv,.webm,.mov,.m4v,.avi"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="admin-btn primary"
            style={{ width: '100%', padding: '12px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="fa-solid fa-folder-open"></i>
            <span>Browse & Select Original File</span>
          </button>

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
