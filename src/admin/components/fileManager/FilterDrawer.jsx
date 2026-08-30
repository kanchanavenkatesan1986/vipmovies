import React from 'react';

export default function FilterDrawer({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onResetFilters
}) {
  if (!isOpen) return null;

  const handleTypeToggle = (type) => {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onFilterChange({ ...filters, types: next });
  };

  const handleExtToggle = (ext) => {
    const next = new Set(filters.extensions);
    if (next.has(ext)) next.delete(ext);
    else next.add(ext);
    onFilterChange({ ...filters, extensions: next });
  };

  return (
    <div className="fm-drawer-overlay" onClick={onClose}>
      <div className="fm-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="fm-drawer-header">
          <div className="fm-drawer-title">
            <i className="fa-solid fa-sliders" style={{ color: 'var(--admin-blue)' }}></i>
            Advanced File Filters
          </div>
          <button type="button" className="fm-drawer-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="fm-drawer-body">
          {/* 1. Item Type */}
          <div className="fm-filter-group">
            <label className="admin-label">Object Type</label>
            <div className="fm-filter-chips">
              {[
                { id: 'video', label: '🎬 Videos' },
                { id: 'folder', label: '📁 Folders' },
                { id: 'image', label: '🖼️ Images' },
                { id: 'subtitle', label: '💬 Subtitles' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`fm-chip ${filters.types.has(t.id) ? 'active' : ''}`}
                  onClick={() => handleTypeToggle(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Extensions */}
          <div className="fm-filter-group">
            <label className="admin-label">Extensions</label>
            <div className="fm-filter-chips">
              {['.mp4', '.mkv', '.webm', '.mov', '.jpg', '.png', '.srt'].map((ext) => (
                <button
                  key={ext}
                  type="button"
                  className={`fm-chip ${filters.extensions.has(ext) ? 'active' : ''}`}
                  onClick={() => handleExtToggle(ext)}
                >
                  {ext.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Size Filter */}
          <div className="fm-filter-group">
            <label className="admin-label">Size Threshold</label>
            <div className="fm-filter-chips">
              {[
                { id: 'all', label: 'All Sizes' },
                { id: 'large_1g', label: '> 1 GB' },
                { id: 'large_2g', label: '> 2 GB' },
                { id: 'large_5g', label: '> 5 GB' }
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`fm-chip ${filters.sizeThreshold === s.id ? 'active' : ''}`}
                  onClick={() => onFilterChange({ ...filters, sizeThreshold: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Only Pinned */}
          <div className="fm-filter-group">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={filters.onlyPinned}
                onChange={(e) => onFilterChange({ ...filters, onlyPinned: e.target.checked })}
              />
              <div>
                <strong>⭐ Starred / Pinned Only</strong>
                <span>Show only your pinned favorite files</span>
              </div>
            </label>
          </div>
        </div>

        <div className="fm-drawer-footer">
          <button type="button" className="admin-btn text sm" onClick={onResetFilters}>
            Reset Filters
          </button>
          <button type="button" className="admin-btn primary sm" onClick={onClose}>
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
