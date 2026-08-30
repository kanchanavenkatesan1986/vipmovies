import React, { useState } from 'react';
import { DEFAULT_UPLOAD_CONFIG } from '../../services/uploader/uploadConfig';
import { showToast } from '../common/ToastContainer';

export default function BulkEditModal({
  isOpen,
  selectedIds = [],
  onApply,
  onClose,
  categories,
  years
}) {
  const [targetCategory, setTargetCategory] = useState('');
  const [targetYear, setTargetYear] = useState('');

  if (!isOpen) return null;

  const handleApply = (e) => {
    e.preventDefault();
    if (!targetCategory && !targetYear) {
      showToast('Select at least a Category or Year to update', 'warning');
      return;
    }

    const updates = {};
    if (targetCategory) updates.category = targetCategory;
    if (targetYear) updates.year = targetYear;

    onApply(selectedIds, updates);
    showToast(`Updated ${selectedIds.length} movie(s) destination paths`, 'success');
    onClose();
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box sm" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">
            <i className="fa-solid fa-layer-group" style={{ color: 'var(--admin-blue)' }}></i>
            Bulk Edit ({selectedIds.length} Movies)
          </div>
          <button className="admin-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleApply}>
          <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--admin-text-muted)', fontSize: '13.5px', margin: 0 }}>
              Apply category or release year across all {selectedIds.length} selected movies in the queue.
            </p>

            <div className="admin-form-group">
              <label>Set Category (Leave blank to keep unchanged)</label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="admin-select"
              >
                <option value="">-- Keep Current Category --</option>
                {(categories || DEFAULT_UPLOAD_CONFIG.allowedCategories).map(cat => (
                  <option key={cat.id || cat} value={cat.id || cat}>
                    {cat.label || cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Set Release Year (Leave blank to keep unchanged)</label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="admin-select"
              >
                <option value="">-- Keep Current Year --</option>
                {(years || DEFAULT_UPLOAD_CONFIG.years).map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="admin-btn text" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn primary">
              <i className="fa-solid fa-check"></i>
              Apply to {selectedIds.length} Movies
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
