import React, { useEffect, useRef } from 'react';

export default function ContextMenu({
  isOpen,
  position = { x: 0, y: 0 },
  target, // { type: 'file' | 'folder', item: object }
  onClose,
  onOpen,
  onPreview,
  onDetails,
  onRename,
  onMove,
  onCopy,
  onDelete,
  onDownload,
  onCopyKey,
  onCopyMediaUrl
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', onClose, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !target) return null;

  const isFolder = target.type === 'folder';
  const item = target.item;

  // Prevent menu from overflowing window bounds
  const style = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 340),
    left: Math.min(position.x, window.innerWidth - 220),
    zIndex: 10000
  };

  return (
    <div ref={menuRef} className="fm-context-menu" style={style}>
      <div className="fm-menu-header">
        <span className="fm-menu-title" title={isFolder ? item.name : item.filename}>
          {isFolder ? item.name : item.filename}
        </span>
      </div>

      {isFolder ? (
        <>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onOpen(item.prefix); }}>
            <i className="fa-solid fa-folder-open"></i> Open Folder
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onRename(target); }}>
            <i className="fa-solid fa-pen"></i> Rename
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onCopy(target); }}>
            <i className="fa-solid fa-copy"></i> Copy Folder
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onMove(target); }}>
            <i className="fa-solid fa-arrows-up-down-left-right"></i> Move Folder
          </button>
          <div className="fm-menu-divider"></div>
          <button type="button" className="fm-menu-item danger" onClick={() => { onClose(); onDelete(target); }}>
            <i className="fa-solid fa-trash"></i> Delete Folder
          </button>
        </>
      ) : (
        <>
          {item.isVideo && (
            <button type="button" className="fm-menu-item primary" onClick={() => { onClose(); onPreview(item); }}>
              <i className="fa-solid fa-play"></i> Play / Preview
            </button>
          )}
          {item.isImage && (
            <button type="button" className="fm-menu-item" onClick={() => { onClose(); onPreview(item); }}>
              <i className="fa-solid fa-image"></i> View Image
            </button>
          )}
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onDetails(item); }}>
            <i className="fa-solid fa-circle-info"></i> Details
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onDownload(item); }}>
            <i className="fa-solid fa-download"></i> Download
          </button>
          <div className="fm-menu-divider"></div>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onCopyKey(item.key); }}>
            <i className="fa-solid fa-key"></i> Copy Object Key
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onCopyMediaUrl(item.key); }}>
            <i className="fa-solid fa-link"></i> Copy Media URL
          </button>
          <div className="fm-menu-divider"></div>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onRename(target); }}>
            <i className="fa-solid fa-pen"></i> Rename
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onCopy(target); }}>
            <i className="fa-solid fa-copy"></i> Copy
          </button>
          <button type="button" className="fm-menu-item" onClick={() => { onClose(); onMove(target); }}>
            <i className="fa-solid fa-arrows-up-down-left-right"></i> Move
          </button>
          <div className="fm-menu-divider"></div>
          <button type="button" className="fm-menu-item danger" onClick={() => { onClose(); onDelete(target); }}>
            <i className="fa-solid fa-trash"></i> Delete
          </button>
        </>
      )}
    </div>
  );
}
