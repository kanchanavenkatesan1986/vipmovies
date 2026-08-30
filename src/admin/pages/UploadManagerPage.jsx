import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import UploadDashboard from '../components/uploader/UploadDashboard';
import UploadDropzone from '../components/uploader/UploadDropzone';
import UploadQueue from '../components/uploader/UploadQueue';
import BulkEditModal from '../components/uploader/BulkEditModal';
import UploadSettingsModal from '../components/uploader/UploadSettingsModal';
import UploadHistory from '../components/uploader/UploadHistory';
import ResumeFileModal from '../components/uploader/ResumeFileModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { uploadScheduler } from '../services/uploader/uploadScheduler';
import { DEFAULT_UPLOAD_CONFIG } from '../services/uploader/uploadConfig';
import { showToast } from '../components/common/ToastContainer';

export default function UploadManagerPage({ navigateTo }) {
  const [schedulerState, setSchedulerState] = useState(() => uploadScheduler.getStateSnapshot());
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'history'
  
  // Modals state
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resumeTargetItem, setResumeTargetItem] = useState(null);
  
  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const dropzoneRef = useRef(null);

  // Subscribe to reactive upload scheduler updates
  useEffect(() => {
    const unsubscribe = uploadScheduler.subscribe((newState) => {
      setSchedulerState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleFilesSelected = (files, defaultCategory, defaultYear) => {
    uploadScheduler.addFiles(files, defaultCategory, defaultYear);
  };

  const handleStartAll = () => {
    uploadScheduler.startAll();
    showToast('Started uploading active queue', 'success');
  };

  const handlePauseAll = () => {
    uploadScheduler.pauseAll();
    showToast('Paused all active uploads', 'warning');
  };

  const handleRetryFailed = () => {
    uploadScheduler.retryFailed();
    showToast('Retrying failed uploads', 'success');
  };

  const handleClearQueue = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Upload Queue',
      message: 'Are you sure you want to clear the entire upload queue? In-flight uploads will be stopped.',
      onConfirm: () => {
        uploadScheduler.clearQueue();
        showToast('Upload queue cleared', 'success');
      }
    });
  };

  const handleCancelItem = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Upload',
      message: 'Cancel this upload? Incomplete multipart staging will be aborted on R2.',
      onConfirm: () => {
        uploadScheduler.cancelUpload(id);
        showToast('Upload cancelled', 'warning');
      }
    });
  };

  const handleBulkEditOpen = (ids) => {
    setBulkSelectedIds(ids);
    setIsBulkEditOpen(true);
  };

  const handleBulkEditApply = (ids, updates) => {
    for (const id of ids) {
      uploadScheduler.updateItemMetadata(id, updates);
    }
  };

  const handleAttachFile = (id, file) => {
    const attached = uploadScheduler.attachFileObject(id, file);
    if (attached) {
      uploadScheduler.resumeUpload(id);
      return true;
    }
    return false;
  };

  return (
    <AdminLayout
      currentRoute="admin/uploads"
      navigateTo={navigateTo}
      pageTitle="R2 Upload Manager"
      breadcrumb="Upload Manager"
      onRefresh={() => setSchedulerState(uploadScheduler.getStateSnapshot())}
    >
      <div className="upload-manager-page-wrap">
        {/* Top Header Dashboard */}
        <UploadDashboard
          stats={schedulerState.stats}
          onAddFilesClick={() => {
            setActiveTab('queue');
            window.scrollTo({ top: 320, behavior: 'smooth' });
          }}
          onStartAll={handleStartAll}
          onPauseAll={handlePauseAll}
          onRetryFailed={handleRetryFailed}
          onCancelAll={() => uploadScheduler.cancelAll()}
          onClearQueue={handleClearQueue}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* View Tabs: Queue vs Completed History */}
        <div className="upload-view-tabs">
          <button
            className={`view-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <i className="fa-solid fa-list-check"></i>
            <span>Active Queue ({schedulerState.queue.length})</span>
          </button>
          <button
            className={`view-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Completed History</span>
          </button>
        </div>

        {/* TAB 1: ACTIVE QUEUE */}
        {activeTab === 'queue' && (
          <div className="upload-queue-tab-content">
            {/* Drag & Drop Area */}
            <div ref={dropzoneRef} style={{ marginBottom: '24px' }}>
              <UploadDropzone
                onFilesSelected={handleFilesSelected}
                categories={DEFAULT_UPLOAD_CONFIG.allowedCategories}
                years={DEFAULT_UPLOAD_CONFIG.years}
              />
            </div>

            {/* Queue List with Filters and Multi-select */}
            <UploadQueue
              queue={schedulerState.queue}
              onUpdateMetadata={(id, updates) => uploadScheduler.updateItemMetadata(id, updates)}
              onStart={(id) => uploadScheduler.startUpload(id)}
              onPause={(id) => uploadScheduler.pauseUpload(id)}
              onResume={(id) => uploadScheduler.resumeUpload(id)}
              onRetry={(id) => uploadScheduler.retryUpload(id)}
              onCancel={handleCancelItem}
              onDelete={(id) => uploadScheduler.removeUpload(id)}
              onBulkEdit={handleBulkEditOpen}
              onRequestFileReattach={(item) => {
                if (item.preselectedFile) {
                  handleAttachFile(item.id, item.preselectedFile);
                } else {
                  setResumeTargetItem(item);
                }
              }}
              categories={DEFAULT_UPLOAD_CONFIG.allowedCategories}
              years={DEFAULT_UPLOAD_CONFIG.years}
              mediaBaseUrl={DEFAULT_UPLOAD_CONFIG.mediaBaseUrl}
            />
          </div>
        )}

        {/* TAB 2: COMPLETED HISTORY */}
        {activeTab === 'history' && (
          <UploadHistory
            mediaBaseUrl={DEFAULT_UPLOAD_CONFIG.mediaBaseUrl}
            navigateTo={navigateTo}
          />
        )}
      </div>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        selectedIds={bulkSelectedIds}
        onApply={handleBulkEditApply}
        onClose={() => setIsBulkEditOpen(false)}
        categories={DEFAULT_UPLOAD_CONFIG.allowedCategories}
        years={DEFAULT_UPLOAD_CONFIG.years}
      />

      {/* Upload Settings Modal */}
      <UploadSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={(newConfig) => {
          uploadScheduler.config = newConfig;
        }}
      />

      {/* Resume File Re-attachment Modal */}
      <ResumeFileModal
        isOpen={!!resumeTargetItem}
        targetItem={resumeTargetItem}
        onAttachFile={handleAttachFile}
        onClose={() => setResumeTargetItem(null)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </AdminLayout>
  );
}
