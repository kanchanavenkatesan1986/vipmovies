import React from 'react';

export default function ConfirmationModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Delete Permanently',
  cancelText = 'Cancel',
  isDanger = true,
  loading = false,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className={`fa-solid ${isDanger ? 'fa-triangle-exclamation' : 'fa-circle-question'}`} style={{ fontSize: '18px', color: isDanger ? 'var(--admin-danger)' : 'var(--admin-accent)' }}></i>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff' }}>{title}</h3>
          </div>
          <button className="admin-btn" style={{ padding: '4px 8px' }} onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="admin-modal-body" style={{ padding: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--admin-text-muted)', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>

        <div className="admin-modal-footer">
          <button className="admin-btn" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button
            className={`admin-btn ${isDanger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
