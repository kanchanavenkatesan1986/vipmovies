import React from 'react';

export default function FileToolbar({
  searchQuery = '',
  onSearchChange,
  viewMode = 'grid',
  onViewModeChange,
  sortBy = 'name',
  sortOrder = 'asc',
  onSortChange,
  onOpenCreateFolder,
  onOpenUploadToCurrent,
  onToggleFilterDrawer,
  hasActiveFilters = false,
  selectedCount = 0,
  onSelectAll,
  allSelected = false,
  totalItems = 0,
  onBulkDelete,
  onBulkMove,
  onBulkCopy
}) {
  return (
    <div className="fm-toolbar">
      <div className="fm-toolbar-row top">
        {/* Search */}
        <div className="fm-search-wrap">
          <i className="fa-solid fa-magnifying-glass fm-search-icon"></i>
          <input
            type="text"
            className="admin-input fm-search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files and folders by name, type, path..."
          />
          {searchQuery && (
            <button
              type="button"
              className="fm-search-clear"
              onClick={() => onSearchChange('')}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="fm-toolbar-actions">
          <button
            type="button"
            className={`admin-btn ${hasActiveFilters ? 'primary' : 'text'}`}
            onClick={onToggleFilterDrawer}
          >
            <i className="fa-solid fa-sliders"></i>
            <span>Filter</span>
            {hasActiveFilters && <span className="fm-active-dot"></span>}
          </button>

          {/* Sort Dropdown */}
          <div className="fm-sort-wrap">
            <select
              className="admin-select"
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('_');
                onSortChange(by, order);
              }}
            >
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="size_asc">Size (Small → Large)</option>
              <option value="size_desc">Size (Large → Small)</option>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="type_asc">Type</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="fm-view-toggle">
            <button
              type="button"
              className={`fm-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => onViewModeChange('grid')}
              title="Grid View"
            >
              <i className="fa-solid fa-grip"></i>
            </button>
            <button
              type="button"
              className={`fm-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => onViewModeChange('list')}
              title="List View"
            >
              <i className="fa-solid fa-list"></i>
            </button>
          </div>

          <button
            type="button"
            className="admin-btn secondary"
            onClick={onOpenCreateFolder}
          >
            <i className="fa-solid fa-folder-plus"></i>
            <span>New Folder</span>
          </button>

          <button
            type="button"
            className="admin-btn primary"
            onClick={onOpenUploadToCurrent}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <span>Upload Here</span>
          </button>
        </div>
      </div>

      {/* Multi-Select Action Bar (shown when items are selected) */}
      {selectedCount > 0 && (
        <div className="fm-selection-bar">
          <div className="fm-selection-info">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              id="fm-select-all-check"
            />
            <label htmlFor="fm-select-all-check" style={{ cursor: 'pointer', fontWeight: 700, color: '#fff' }}>
              {selectedCount} item{selectedCount > 1 ? 's' : ''} selected of {totalItems}
            </label>
          </div>

          <div className="fm-selection-actions">
            <button type="button" className="admin-btn sm secondary" onClick={onBulkCopy}>
              <i className="fa-solid fa-copy"></i>
              <span>Copy</span>
            </button>

            <button type="button" className="admin-btn sm secondary" onClick={onBulkMove}>
              <i className="fa-solid fa-arrows-up-down-left-right"></i>
              <span>Move</span>
            </button>

            <button type="button" className="admin-btn sm danger" onClick={onBulkDelete}>
              <i className="fa-solid fa-trash"></i>
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
