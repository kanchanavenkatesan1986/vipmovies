import React from 'react';
import { formatBytes, formatDate, getFileIcon } from '../../services/fileManager/fileManagerUtils';
import { isEditable } from './TextEditorModal';

export default function FileGridView({
  folders = [],
  objects = [],
  selectedKeys = new Set(),
  onToggleSelect,
  onFolderClick,
  onFileClick,
  onActionMenu,
  onContextMenu,
  pinnedKeys = new Set(),
  onTogglePin,
  onDeleteItem,
  onRenameItem,
  onEditFile
}) {
  const hasItems = folders.length > 0 || objects.length > 0;

  if (!hasItems) {
    return (
      <div className="fm-empty-state">
        <div className="fm-empty-icon">
          <i className="fa-solid fa-folder-open"></i>
        </div>
        <h3>This folder is empty</h3>
        <p>Upload movies, subtitles, or create subfolders to start organizing.</p>
      </div>
    );
  }

  return (
    <div className="fm-grid-wrap">
      {/* 1. Folders Section */}
      {folders.length > 0 && (
        <div className="fm-section">
          <div className="fm-section-title">
            <i className="fa-solid fa-folder" style={{ color: 'var(--admin-gold)' }}></i>
            Folders ({folders.length})
          </div>
          <div className="fm-cards-grid">
            {folders.map((folder) => {
              const isSelected = selectedKeys.has(folder.prefix);
              return (
                <div
                  key={folder.prefix}
                  className={`fm-card folder ${isSelected ? 'selected' : ''}`}
                  onClick={() => onFolderClick(folder.prefix)}
                  onContextMenu={(e) => onContextMenu(e, { type: 'folder', item: folder })}
                >
                  <div className="fm-card-top" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(folder.prefix, 'folder')}
                    />
                    <button
                      type="button"
                      className="fm-card-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onActionMenu(e, { type: 'folder', item: folder });
                      }}
                      aria-label="Folder Actions"
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>

                  <div className="fm-card-icon folder">
                    <i className="fa-solid fa-folder-closed"></i>
                  </div>

                  <div className="fm-card-body">
                    <div className="fm-card-name" title={folder.name}>
                      {folder.name}
                    </div>
                    <div className="fm-card-meta">
                      <span>Folder</span>
                    </div>
                  </div>

                  {/* Inline quick actions for folders */}
                  <div className="fm-card-quick-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="fm-quick-btn rename"
                      title="Rename Folder"
                      onClick={() => onActionMenu({ currentTarget: { getBoundingClientRect: () => ({ left: 0, bottom: 0 }) } }, { type: 'folder', item: folder })}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-quick-btn delete"
                      title="Delete Folder"
                      onClick={() => onDeleteItem({ type: 'folder', item: folder })}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Files Section */}
      {objects.length > 0 && (
        <div className="fm-section">
          <div className="fm-section-title">
            <i className="fa-solid fa-film" style={{ color: 'var(--admin-blue)' }}></i>
            Files ({objects.length})
          </div>
          <div className="fm-cards-grid">
            {objects.map((obj) => {
              const isSelected = selectedKeys.has(obj.key);
              const isPinned = pinnedKeys.has(obj.key);
              const iconClass = getFileIcon('file', obj.filename);

              return (
                <div
                  key={obj.key}
                  className={`fm-card file ${isSelected ? 'selected' : ''} ${obj.isVideo ? 'video' : ''}`}
                  onClick={() => onFileClick(obj)}
                  onContextMenu={(e) => onContextMenu(e, { type: 'file', item: obj })}
                >
                  <div className="fm-card-top" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(obj.key, 'file')}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        className={`fm-card-pin-btn ${isPinned ? 'pinned' : ''}`}
                        onClick={() => onTogglePin(obj.key)}
                        title={isPinned ? 'Unpin' : 'Pin to favorites'}
                      >
                        <i className={`fa-${isPinned ? 'solid' : 'regular'} fa-star`}></i>
                      </button>
                      <button
                        type="button"
                        className="fm-card-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onActionMenu(e, { type: 'file', item: obj });
                        }}
                        aria-label="File Actions"
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>
                    </div>
                  </div>

                  <div className={`fm-card-icon file ${obj.isVideo ? 'video' : obj.isImage ? 'image' : ''}`}>
                    <i className={`fa-solid ${iconClass}`}></i>
                    {obj.extension && (
                      <span className="fm-ext-badge">
                        {obj.extension.replace('.', '').toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="fm-card-body">
                    <div className="fm-card-name" title={obj.filename}>
                      {obj.filename}
                    </div>
                    <div className="fm-card-meta">
                      <span className="size">{formatBytes(obj.size)}</span>
                      <span className="dot">•</span>
                      <span className="date">{formatDate(obj.uploaded)}</span>
                    </div>
                  </div>

                  {/* Inline quick actions for files */}
                  <div className="fm-card-quick-actions" onClick={(e) => e.stopPropagation()}>
                    {isEditable(obj.filename) && (
                      <button
                        type="button"
                        className="fm-quick-btn edit"
                        title="Edit File Content"
                        onClick={() => onEditFile(obj)}
                      >
                        <i className="fa-solid fa-code"></i>
                      </button>
                    )}
                    <button
                      type="button"
                      className="fm-quick-btn rename"
                      title="Rename File"
                      onClick={() => onRenameItem({ type: 'file', item: obj })}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-quick-btn delete"
                      title="Delete File"
                      onClick={() => onDeleteItem({ type: 'file', item: obj })}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
