import React from 'react';
import { formatBytes, formatDate, getFileIcon } from '../../services/fileManager/fileManagerUtils';
import { isEditable } from './TextEditorModal';

export default function FileListView({
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
    <div className="fm-table-wrap">
      <table className="fm-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Name</th>
            <th style={{ width: '120px' }}>Type</th>
            <th style={{ width: '130px' }}>Size</th>
            <th style={{ width: '180px' }}>Modified</th>
            <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* Folders */}
          {folders.map((folder) => {
            const isSelected = selectedKeys.has(folder.prefix);
            return (
              <tr
                key={folder.prefix}
                className={`fm-table-row folder ${isSelected ? 'selected' : ''}`}
                onClick={() => onFolderClick(folder.prefix)}
                onContextMenu={(e) => onContextMenu(e, { type: 'folder', item: folder })}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(folder.prefix, 'folder')}
                  />
                </td>
                <td>
                  <div className="fm-table-item-name">
                    <i className="fa-solid fa-folder fm-row-icon folder"></i>
                    <span className="fm-row-text" title={folder.name}>
                      {folder.name}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="fm-type-badge folder">Folder</span>
                </td>
                <td>—</td>
                <td>—</td>
                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div className="fm-table-actions-wrap">
                    <button
                      type="button"
                      className="fm-quick-btn rename"
                      title="Rename"
                      onClick={() => onRenameItem({ type: 'folder', item: folder })}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-quick-btn delete"
                      title="Delete"
                      onClick={() => onDeleteItem({ type: 'folder', item: folder })}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-table-action-btn"
                      onClick={(e) => onActionMenu(e, { type: 'folder', item: folder })}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {/* Objects */}
          {objects.map((obj) => {
            const isSelected = selectedKeys.has(obj.key);
            const isPinned = pinnedKeys.has(obj.key);
            const iconClass = getFileIcon('file', obj.filename);

            return (
              <tr
                key={obj.key}
                className={`fm-table-row file ${isSelected ? 'selected' : ''}`}
                onClick={() => onFileClick(obj)}
                onContextMenu={(e) => onContextMenu(e, { type: 'file', item: obj })}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(obj.key, 'file')}
                  />
                </td>
                <td>
                  <div className="fm-table-item-name">
                    <button
                      type="button"
                      className={`fm-row-pin-btn ${isPinned ? 'pinned' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(obj.key);
                      }}
                      title={isPinned ? 'Unpin' : 'Pin'}
                    >
                      <i className={`fa-${isPinned ? 'solid' : 'regular'} fa-star`}></i>
                    </button>
                    <i className={`fa-solid ${iconClass} fm-row-icon ${obj.isVideo ? 'video' : ''}`}></i>
                    <span className="fm-row-text" title={obj.filename}>
                      {obj.filename}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`fm-type-badge ${obj.isVideo ? 'video' : obj.isImage ? 'image' : 'file'}`}>
                    {obj.extension ? obj.extension.replace('.', '').toUpperCase() : 'FILE'}
                  </span>
                </td>
                <td>
                  <span className="fm-row-size">{formatBytes(obj.size)}</span>
                </td>
                <td>
                  <span className="fm-row-date">{formatDate(obj.uploaded)}</span>
                </td>
                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div className="fm-table-actions-wrap">
                    {isEditable(obj.filename) && (
                      <button
                        type="button"
                        className="fm-quick-btn edit"
                        title="Edit File"
                        onClick={() => onEditFile(obj)}
                      >
                        <i className="fa-solid fa-code"></i>
                      </button>
                    )}
                    <button
                      type="button"
                      className="fm-quick-btn rename"
                      title="Rename"
                      onClick={() => onRenameItem({ type: 'file', item: obj })}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-quick-btn delete"
                      title="Delete"
                      onClick={() => onDeleteItem({ type: 'file', item: obj })}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                    <button
                      type="button"
                      className="fm-table-action-btn"
                      onClick={(e) => onActionMenu(e, { type: 'file', item: obj })}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
