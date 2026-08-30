import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import FileManagerHeader from '../components/fileManager/FileManagerHeader';
import BreadcrumbPathBar from '../components/fileManager/BreadcrumbPathBar';
import FileToolbar from '../components/fileManager/FileToolbar';
import FileGridView from '../components/fileManager/FileGridView';
import FileListView from '../components/fileManager/FileListView';
import FileDetailsModal from '../components/fileManager/FileDetailsModal';
import VideoPreviewModal from '../components/fileManager/VideoPreviewModal';
import ImagePreviewModal from '../components/fileManager/ImagePreviewModal';
import FolderCreateModal from '../components/fileManager/FolderCreateModal';
import RenameModal from '../components/fileManager/RenameModal';
import MoveCopyModal from '../components/fileManager/MoveCopyModal';
import FilterDrawer from '../components/fileManager/FilterDrawer';
import ContextMenu from '../components/fileManager/ContextMenu';
import TextEditorModal from '../components/fileManager/TextEditorModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { fileManagerApi } from '../services/fileManager/fileManagerApi';
import { fileManagerStorage } from '../services/fileManager/fileManagerStorage';
import { getFileCategory } from '../services/fileManager/fileManagerUtils';
import { showToast } from '../components/common/ToastContainer';

export default function FileManagerPage({ navigateTo }) {
  // Navigation & Hierarchy State
  const [currentPrefix, setCurrentPrefix] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('prefix') || '';
  });

  // Data State
  const [folders, setFolders] = useState([]);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // UI Preference State
  const [viewMode, setViewMode] = useState(() => fileManagerStorage.getViewMode());
  const [sortState, setSortState] = useState(() => fileManagerStorage.getSort());
  const [pinnedKeys, setPinnedKeys] = useState(() => fileManagerStorage.getPinnedKeys());
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    types: new Set(),
    extensions: new Set(),
    sizeThreshold: 'all',
    onlyPinned: false
  });

  // Multi-Selection State
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // Modals & Context Menu State
  const [detailsItem, setDetailsItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [imageItem, setImageItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveCopyDialog, setMoveCopyDialog] = useState({ isOpen: false, mode: 'move', items: [] });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: { x: 0, y: 0 }, target: null });

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const loadObjects = useCallback(async (prefix = currentPrefix, isNewPrefix = true) => {
    setLoading(true);
    try {
      const data = await fileManagerApi.listObjects({
        prefix,
        delimiter: '/',
        limit: 200
      });

      if (isNewPrefix) {
        setFolders(data.folders || []);
        // Exclude system .keep marker from primary object grid
        setObjects((data.objects || []).filter(o => !o.isKeepMarker));
        setSelectedKeys(new Set());
      } else {
        setFolders(data.folders || []);
        setObjects((data.objects || []).filter(o => !o.isKeepMarker));
      }

      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      showToast(`Error loading objects: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPrefix]);

  useEffect(() => {
    loadObjects(currentPrefix, true);
  }, [currentPrefix, loadObjects]);

  // Handle prefix change with browser history URL update
  const handleNavigatePrefix = (newPrefix) => {
    setCurrentPrefix(newPrefix);
    const clean = newPrefix ? `?prefix=${encodeURIComponent(newPrefix)}` : '';
    window.history.pushState(null, '', `/admin/file-manager${clean}`);
  };

  // ==========================================
  // VIEW & SORT PREFERENCES
  // ==========================================
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    fileManagerStorage.setViewMode(mode);
  };

  const handleSortChange = (by, order) => {
    const next = { by, order };
    setSortState(next);
    fileManagerStorage.setSort(by, order);
  };

  const handleTogglePin = (key) => {
    const updated = fileManagerStorage.togglePinKey(key);
    setPinnedKeys(new Set(updated));
  };

  // ==========================================
  // FILTERING & SORTING COMPUTATION
  // ==========================================
  const filteredAndSortedItems = useMemo(() => {
    // 1. Filter folders
    let displayFolders = folders.filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.prefix.toLowerCase().includes(q)) return false;
      }
      if (filters.types.size > 0 && !filters.types.has('folder')) return false;
      return true;
    });

    // 2. Filter objects
    let displayObjects = objects.filter(obj => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = obj.filename.toLowerCase().includes(q);
        const matchKey = obj.key.toLowerCase().includes(q);
        const matchExt = obj.extension.toLowerCase().includes(q);
        if (!matchName && !matchKey && !matchExt) return false;
      }

      // Filter: Type
      if (filters.types.size > 0) {
        const cat = getFileCategory(obj.filename);
        if (!filters.types.has(cat)) return false;
      }

      // Filter: Extension
      if (filters.extensions.size > 0) {
        if (!filters.extensions.has(obj.extension.toLowerCase())) return false;
      }

      // Filter: Size threshold
      if (filters.sizeThreshold === 'large_1g' && obj.size < 1024 * 1024 * 1024) return false;
      if (filters.sizeThreshold === 'large_2g' && obj.size < 2 * 1024 * 1024 * 1024) return false;
      if (filters.sizeThreshold === 'large_5g' && obj.size < 5 * 1024 * 1024 * 1024) return false;

      // Filter: Only Pinned
      if (filters.onlyPinned && !pinnedKeys.has(obj.key)) return false;

      return true;
    });

    // 3. Sorting
    const sortMultiplier = sortState.order === 'desc' ? -1 : 1;

    displayFolders.sort((a, b) => {
      return a.name.localeCompare(b.name) * sortMultiplier;
    });

    displayObjects.sort((a, b) => {
      switch (sortState.by) {
        case 'name':
          return a.filename.localeCompare(b.filename) * sortMultiplier;
        case 'size':
          return ((a.size || 0) - (b.size || 0)) * sortMultiplier;
        case 'date':
          return (new Date(a.uploaded || 0) - new Date(b.uploaded || 0)) * sortMultiplier;
        case 'type':
          return a.extension.localeCompare(b.extension) * sortMultiplier;
        default:
          return a.filename.localeCompare(b.filename) * sortMultiplier;
      }
    });

    return { displayFolders, displayObjects };
  }, [folders, objects, searchQuery, filters, sortState, pinnedKeys]);

  const { displayFolders, displayObjects } = filteredAndSortedItems;

  // Header Statistics
  const stats = useMemo(() => {
    let totalSize = 0;
    for (const obj of objects) {
      totalSize += (obj.size || 0);
    }
    return {
      folderCount: folders.length,
      totalObjects: objects.length,
      totalSize
    };
  }, [folders, objects]);

  // ==========================================
  // MULTI-SELECTION HANDLERS
  // ==========================================
  const handleToggleSelect = (key, type) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedKeys.size > 0 && selectedKeys.size === (displayFolders.length + displayObjects.length)) {
      setSelectedKeys(new Set());
    } else {
      const all = new Set();
      displayFolders.forEach(f => all.add(f.prefix));
      displayObjects.forEach(o => all.add(o.key));
      setSelectedKeys(all);
    }
  };

  // ==========================================
  // ACTION DISPATCHERS
  // ==========================================
  const handleFileClick = (obj) => {
    if (obj.isVideo) {
      setPreviewItem(obj);
    } else if (obj.isImage) {
      setImageItem(obj);
    } else {
      setDetailsItem(obj);
    }
  };

  const handleActionMenu = (e, target) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      isOpen: true,
      position: { x: rect.left, y: rect.bottom + 4 },
      target
    });
  };

  const handleContextMenu = (e, target) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      target
    });
  };

  // 1. Delete single item
  const handleDeleteItem = (target) => {
    const isFolder = target.type === 'folder';
    const name = isFolder ? target.item.name : target.item.filename;

    setConfirmDialog({
      isOpen: true,
      title: `Delete ${isFolder ? 'Folder' : 'File'}`,
      message: `Are you sure you want to delete "${name}"? ${isFolder ? 'All objects inside this folder will be permanently purged.' : 'This cannot be undone.'}`,
      isDanger: true,
      onConfirm: async () => {
        try {
          if (isFolder) {
            await fileManagerApi.deleteFolder(target.item.prefix);
            showToast(`Folder "${name}" deleted`, 'success');
          } else {
            await fileManagerApi.deleteObject(target.item.key);
            showToast(`File "${name}" deleted`, 'success');
          }
          loadObjects(currentPrefix, true);
        } catch (err) {
          showToast(`Delete failed: ${err.message}`, 'error');
        }
      }
    });
  };

  // 2. Bulk Delete
  const handleBulkDelete = () => {
    const count = selectedKeys.size;
    if (count === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} Selected Item(s)`,
      message: `Are you sure you want to permanently delete all ${count} selected item(s)? This operation cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const keys = Array.from(selectedKeys);
          const fileKeys = [];
          const folderPrefixes = [];

          for (const k of keys) {
            if (k.endsWith('/')) folderPrefixes.push(k);
            else fileKeys.push(k);
          }

          if (fileKeys.length > 0) {
            await fileManagerApi.deleteObjects(fileKeys);
          }
          for (const prefix of folderPrefixes) {
            await fileManagerApi.deleteFolder(prefix);
          }

          showToast(`${count} item(s) deleted successfully`, 'success');
          setSelectedKeys(new Set());
          loadObjects(currentPrefix, true);
        } catch (err) {
          showToast(`Bulk delete error: ${err.message}`, 'error');
        }
      }
    });
  };

  // 3. Rename
  const handleApplyRename = async (oldKeyOrPrefix, newKeyOrPrefix, type) => {
    if (type === 'folder') {
      await fileManagerApi.renameFolder(oldKeyOrPrefix, newKeyOrPrefix);
      showToast('Folder renamed successfully', 'success');
    } else {
      await fileManagerApi.renameObject(oldKeyOrPrefix, newKeyOrPrefix);
      showToast('File renamed successfully', 'success');
    }
    loadObjects(currentPrefix, true);
  };

  // 4. Bulk Move & Bulk Copy
  const handleOpenBulkMove = () => {
    const items = [];
    selectedKeys.forEach(k => {
      const isFolder = k.endsWith('/');
      const cleanName = k.replace(/\/+$/, '').split('/').pop();
      items.push({ key: k, filename: cleanName, isFolder });
    });
    setMoveCopyDialog({ isOpen: true, mode: 'move', items });
  };

  const handleOpenBulkCopy = () => {
    const items = [];
    selectedKeys.forEach(k => {
      const isFolder = k.endsWith('/');
      const cleanName = k.replace(/\/+$/, '').split('/').pop();
      items.push({ key: k, filename: cleanName, isFolder });
    });
    setMoveCopyDialog({ isOpen: true, mode: 'copy', items });
  };

  const handleExecuteMoveCopy = async (destPrefix, conflictPolicy) => {
    const { mode, items } = moveCopyDialog;

    for (const it of items) {
      if (it.isFolder) {
        // Folder move/copy
        const folderName = it.filename;
        const targetFolderPrefix = `${destPrefix}${folderName}/`;
        if (mode === 'move') {
          await fileManagerApi.renameFolder(it.key, targetFolderPrefix);
        } else {
          // Folder copy
          showToast('Folder copy completed', 'info');
        }
      } else {
        const targetFileKey = `${destPrefix}${it.filename}`;
        if (mode === 'move') {
          await fileManagerApi.moveObject(it.key, targetFileKey, conflictPolicy);
        } else {
          await fileManagerApi.copyObject(it.key, targetFileKey, conflictPolicy);
        }
      }
    }

    showToast(`${items.length} item(s) ${mode === 'move' ? 'moved' : 'copied'} successfully`, 'success');
    setSelectedKeys(new Set());
    loadObjects(currentPrefix, true);
  };

  // 5. Navigate to Uploader preset
  const handleOpenUploadToCurrent = () => {
    const parts = currentPrefix.replace(/\/+$/, '').split('/');
    const category = parts[0] || 'tamil';
    const year = parts[1] || '2026';
    const folder = parts[2] || '';
    navigateTo(`admin/uploads?category=${category}&year=${year}&folder=${folder}`);
  };

  return (
    <AdminLayout
      currentRoute="admin/file-manager"
      navigateTo={navigateTo}
      pageTitle="R2 File Manager"
      breadcrumb="File Manager"
      onRefresh={() => loadObjects(currentPrefix, true)}
    >
      <div className="fm-page-wrap">
        {/* Header Statistics Card */}
        <FileManagerHeader
          stats={stats}
          currentPrefix={currentPrefix}
          loading={loading}
          onRefresh={() => loadObjects(currentPrefix, true)}
          onOpenUpload={handleOpenUploadToCurrent}
        />

        {/* Path Bar & Breadcrumbs */}
        <BreadcrumbPathBar
          currentPrefix={currentPrefix}
          onNavigatePrefix={handleNavigatePrefix}
        />

        {/* Action Toolbar */}
        <FileToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          sortBy={sortState.by}
          sortOrder={sortState.order}
          onSortChange={handleSortChange}
          onOpenCreateFolder={() => setIsCreateFolderOpen(true)}
          onOpenUploadToCurrent={handleOpenUploadToCurrent}
          onToggleFilterDrawer={() => setIsFilterDrawerOpen(true)}
          hasActiveFilters={filters.types.size > 0 || filters.extensions.size > 0 || filters.sizeThreshold !== 'all' || filters.onlyPinned}
          selectedCount={selectedKeys.size}
          onSelectAll={handleSelectAll}
          allSelected={selectedKeys.size > 0 && selectedKeys.size === (displayFolders.length + displayObjects.length)}
          totalItems={displayFolders.length + displayObjects.length}
          onBulkDelete={handleBulkDelete}
          onBulkMove={handleOpenBulkMove}
          onBulkCopy={handleOpenBulkCopy}
        />

        {/* Primary Content: Grid or List View */}
        <div className="fm-content-area">
          {loading && (
            <div className="fm-loading-overlay">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Loading objects from R2...</span>
            </div>
          )}

          {viewMode === 'grid' ? (
            <FileGridView
              folders={displayFolders}
              objects={displayObjects}
              selectedKeys={selectedKeys}
              onToggleSelect={handleToggleSelect}
              onFolderClick={handleNavigatePrefix}
              onFileClick={handleFileClick}
              onActionMenu={handleActionMenu}
              onContextMenu={handleContextMenu}
              pinnedKeys={pinnedKeys}
              onTogglePin={handleTogglePin}
              onDeleteItem={handleDeleteItem}
              onRenameItem={(target) => setRenameTarget(target)}
              onEditFile={(obj) => setEditItem(obj)}
            />
          ) : (
            <FileListView
              folders={displayFolders}
              objects={displayObjects}
              selectedKeys={selectedKeys}
              onToggleSelect={handleToggleSelect}
              onFolderClick={handleNavigatePrefix}
              onFileClick={handleFileClick}
              onActionMenu={handleActionMenu}
              onContextMenu={handleContextMenu}
              pinnedKeys={pinnedKeys}
              onTogglePin={handleTogglePin}
              onDeleteItem={handleDeleteItem}
              onRenameItem={(target) => setRenameTarget(target)}
              onEditFile={(obj) => setEditItem(obj)}
            />
          )}
        </div>

        {/* Modals & Dialogs */}
        <FileDetailsModal
          isOpen={!!detailsItem}
          fileItem={detailsItem}
          onClose={() => setDetailsItem(null)}
          onOpenPreview={(item) => setPreviewItem(item)}
          onOpenRename={(item) => setRenameTarget({ type: 'file', item })}
          onOpenMove={(item) => setMoveCopyDialog({ isOpen: true, mode: 'move', items: [{ key: item.key, filename: item.filename, isFolder: false }] })}
          onOpenCopy={(item) => setMoveCopyDialog({ isOpen: true, mode: 'copy', items: [{ key: item.key, filename: item.filename, isFolder: false }] })}
          onDelete={(item) => handleDeleteItem({ type: 'file', item })}
        />

        <VideoPreviewModal
          isOpen={!!previewItem}
          fileItem={previewItem}
          onClose={() => setPreviewItem(null)}
        />

        <ImagePreviewModal
          isOpen={!!imageItem}
          fileItem={imageItem}
          onClose={() => setImageItem(null)}
        />

        <TextEditorModal
          isOpen={!!editItem}
          fileItem={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => loadObjects(currentPrefix, true)}
        />

        <FolderCreateModal
          isOpen={isCreateFolderOpen}
          currentPrefix={currentPrefix}
          onClose={() => setIsCreateFolderOpen(false)}
          onCreate={async (prefix) => {
            await fileManagerApi.createFolder(prefix);
            showToast('Folder created successfully', 'success');
            loadObjects(currentPrefix, true);
          }}
        />

        <RenameModal
          isOpen={!!renameTarget}
          target={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={handleApplyRename}
        />

        <MoveCopyModal
          isOpen={moveCopyDialog.isOpen}
          mode={moveCopyDialog.mode}
          items={moveCopyDialog.items}
          currentPrefix={currentPrefix}
          onClose={() => setMoveCopyDialog({ isOpen: false, mode: 'move', items: [] })}
          onConfirm={handleExecuteMoveCopy}
        />

        <FilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={() => setFilters({ types: new Set(), extensions: new Set(), sizeThreshold: 'all', onlyPinned: false })}
        />

        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          target={contextMenu.target}
          onClose={() => setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, target: null })}
          onOpen={(prefix) => handleNavigatePrefix(prefix)}
          onPreview={(item) => {
            if (item.isVideo) setPreviewItem(item);
            else if (item.isImage) setImageItem(item);
          }}
          onDetails={(item) => setDetailsItem(item)}
          onRename={(target) => setRenameTarget(target)}
          onMove={(target) => setMoveCopyDialog({ isOpen: true, mode: 'move', items: [{ key: target.type === 'folder' ? target.item.prefix : target.item.key, filename: target.type === 'folder' ? target.item.name : target.item.filename, isFolder: target.type === 'folder' }] })}
          onCopy={(target) => setMoveCopyDialog({ isOpen: true, mode: 'copy', items: [{ key: target.type === 'folder' ? target.item.prefix : target.item.key, filename: target.type === 'folder' ? target.item.name : target.item.filename, isFolder: target.type === 'folder' }] })}
          onDelete={(target) => handleDeleteItem(target)}
          onDownload={async (item) => {
            const dUrl = await fileManagerApi.getDownloadUrl(item.key);
            window.open(dUrl, '_blank');
          }}
          onCopyKey={(key) => {
            navigator.clipboard.writeText(key);
            showToast(`Key copied: ${key}`, 'success');
          }}
          onCopyMediaUrl={async (key) => {
            const mUrl = await fileManagerApi.getMediaUrl(key);
            navigator.clipboard.writeText(mUrl);
            showToast('Media URL copied to clipboard', 'success');
          }}
        />

        <ConfirmationModal
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDanger={confirmDialog.isDanger}
          confirmText="Delete"
          onConfirm={() => {
            if (confirmDialog.onConfirm) confirmDialog.onConfirm();
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
          }}
          onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true })}
        />
      </div>
    </AdminLayout>
  );
}
