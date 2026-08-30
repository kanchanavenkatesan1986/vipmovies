import React, { useState, useMemo } from 'react';
import UploadItem from './UploadItem';
import { UPLOAD_STATUS } from '../../services/uploader/uploadScheduler';

export default function UploadQueue({
  queue,
  onUpdateMetadata,
  onStart,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onDelete,
  onBulkEdit,
  onRequestFileReattach,
  categories,
  years,
  mediaBaseUrl
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('CREATED_DESC');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      ALL: queue.length,
      UPLOADING: 0,
      QUEUED: 0,
      PAUSED: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0
    };

    for (const item of queue) {
      if (item.status === UPLOAD_STATUS.UPLOADING || item.status === UPLOAD_STATUS.CREATING || item.status === UPLOAD_STATUS.VERIFYING || item.status === UPLOAD_STATUS.COMPLETING) {
        counts.UPLOADING++;
      } else if (item.status === UPLOAD_STATUS.QUEUED || item.status === UPLOAD_STATUS.RETRYING) {
        counts.QUEUED++;
      } else if (item.status === UPLOAD_STATUS.PAUSED) {
        counts.PAUSED++;
      } else if (item.status === UPLOAD_STATUS.COMPLETED) {
        counts.COMPLETED++;
      } else if (item.status === UPLOAD_STATUS.FAILED) {
        counts.FAILED++;
      } else if (item.status === UPLOAD_STATUS.CANCELLED) {
        counts.CANCELLED++;
      }
    }
    return counts;
  }, [queue]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...queue];

    // Status Filter
    if (activeFilter === 'UPLOADING') {
      result = result.filter(x => [UPLOAD_STATUS.UPLOADING, UPLOAD_STATUS.CREATING, UPLOAD_STATUS.VERIFYING, UPLOAD_STATUS.COMPLETING].includes(x.status));
    } else if (activeFilter === 'QUEUED') {
      result = result.filter(x => [UPLOAD_STATUS.QUEUED, UPLOAD_STATUS.RETRYING].includes(x.status));
    } else if (activeFilter === 'PAUSED') {
      result = result.filter(x => x.status === UPLOAD_STATUS.PAUSED);
    } else if (activeFilter === 'COMPLETED') {
      result = result.filter(x => x.status === UPLOAD_STATUS.COMPLETED);
    } else if (activeFilter === 'FAILED') {
      result = result.filter(x => x.status === UPLOAD_STATUS.FAILED);
    } else if (activeFilter === 'CANCELLED') {
      result = result.filter(x => x.status === UPLOAD_STATUS.CANCELLED);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(x =>
        x.filename.toLowerCase().includes(q) ||
        x.movieFolder.toLowerCase().includes(q) ||
        x.destinationKey.toLowerCase().includes(q) ||
        x.category.toLowerCase().includes(q) ||
        String(x.year).includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'FILENAME_ASC':
          return a.filename.localeCompare(b.filename);
        case 'SIZE_DESC':
          return (b.fileSize || 0) - (a.fileSize || 0);
        case 'PROGRESS_DESC': {
          const pctA = a.fileSize > 0 ? (a.uploadedBytes / a.fileSize) : 0;
          const pctB = b.fileSize > 0 ? (b.uploadedBytes / b.fileSize) : 0;
          return pctB - pctA;
        }
        case 'CREATED_ASC':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'CREATED_DESC':
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    return result;
  }, [queue, activeFilter, searchQuery, sortBy]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(x => x.id)));
    }
  };

  return (
    <div className="upload-queue-container">
      {/* Control Bar: Filter Tabs, Search & Sort */}
      <div className="upload-queue-controls">
        {/* Filter Pills */}
        <div className="upload-filter-pills">
          <button
            className={`filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            All <span className="badge">{filterCounts.ALL}</span>
          </button>
          <button
            className={`filter-pill ${activeFilter === 'UPLOADING' ? 'active' : ''}`}
            onClick={() => setActiveFilter('UPLOADING')}
          >
            Uploading <span className="badge">{filterCounts.UPLOADING}</span>
          </button>
          <button
            className={`filter-pill ${activeFilter === 'QUEUED' ? 'active' : ''}`}
            onClick={() => setActiveFilter('QUEUED')}
          >
            Waiting <span className="badge">{filterCounts.QUEUED}</span>
          </button>
          <button
            className={`filter-pill ${activeFilter === 'PAUSED' ? 'active' : ''}`}
            onClick={() => setActiveFilter('PAUSED')}
          >
            Paused <span className="badge">{filterCounts.PAUSED}</span>
          </button>
          <button
            className={`filter-pill ${activeFilter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setActiveFilter('COMPLETED')}
          >
            Completed <span className="badge">{filterCounts.COMPLETED}</span>
          </button>
          <button
            className={`filter-pill ${activeFilter === 'FAILED' ? 'active' : ''}`}
            onClick={() => setActiveFilter('FAILED')}
          >
            Failed <span className="badge">{filterCounts.FAILED}</span>
          </button>
        </div>

        {/* Search & Sort Tools */}
        <div className="upload-tools-row">
          <div className="upload-search-wrap">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search movie title, folder, path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input sm"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          <div className="upload-sort-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="admin-select sm"
            >
              <option value="CREATED_DESC">Sort: Newest Added</option>
              <option value="CREATED_ASC">Sort: Oldest Added</option>
              <option value="FILENAME_ASC">Sort: Movie Name (A-Z)</option>
              <option value="SIZE_DESC">Sort: Largest Size</option>
              <option value="PROGRESS_DESC">Sort: Highest Progress</option>
            </select>
          </div>

          {/* Bulk Selection Actions */}
          {filteredItems.length > 0 && (
            <div className="bulk-selection-bar">
              <button
                type="button"
                className="admin-btn text sm"
                onClick={handleSelectAll}
              >
                {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : `Select All (${filteredItems.length})`}
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="admin-btn primary sm"
                  onClick={() => onBulkEdit(Array.from(selectedIds))}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                  <span>Bulk Edit ({selectedIds.size})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Queue Item List */}
      <div className="upload-items-list">
        {filteredItems.length === 0 ? (
          <div className="upload-empty-queue">
            <div className="empty-icon"><i className="fa-solid fa-clapperboard"></i></div>
            <h3>No movies in this queue view</h3>
            <p>
              {searchQuery
                ? `No movie matches "${searchQuery}". Try a different search term.`
                : 'Drag and drop movie files above or click Browse to queue movies for upload.'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => (
            <UploadItem
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={toggleSelect}
              onUpdateMetadata={onUpdateMetadata}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onRetry={onRetry}
              onCancel={onCancel}
              onDelete={onDelete}
              onRequestFileReattach={onRequestFileReattach}
              categories={categories}
              years={years}
              mediaBaseUrl={mediaBaseUrl}
            />
          ))
        )}
      </div>
    </div>
  );
}
