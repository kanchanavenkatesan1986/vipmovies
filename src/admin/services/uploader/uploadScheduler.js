/**
 * Upload Scheduler & Multipart Concurrency Engine
 * Handles two-level concurrency, chunk streaming, retries, pause/resume, and state transitions
 */

import { uploadApi } from './uploadApi';
import { uploadStorage } from './uploadStorage';
import { DEFAULT_UPLOAD_CONFIG } from './uploadConfig';
import {
  buildDestinationKey,
  sanitizeMovieFolder,
  sanitizeFilename,
  SpeedTracker
} from './uploadUtils';

export const UPLOAD_STATUS = {
  QUEUED: 'QUEUED',
  CREATING: 'CREATING',
  UPLOADING: 'UPLOADING',
  PAUSED: 'PAUSED',
  RETRYING: 'RETRYING',
  VERIFYING: 'VERIFYING',
  COMPLETING: 'COMPLETING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

class UploadScheduler {
  constructor() {
    this.queue = [];                   // Array of upload items
    this.filesMap = new Map();         // id -> File object reference (in-memory)
    this.activeFileIds = new Set();    // Currently active file IDs
    this.activePartCount = 0;          // Global in-flight HTTP requests count
    this.fileControllers = new Map();  // id -> AbortController
    this.partControllers = new Map();  // `${fileId}_${partNumber}` -> AbortController
    this.speedTrackers = new Map();    // id -> SpeedTracker
    this.globalSpeedTracker = new SpeedTracker(10);
    
    this.listeners = new Set();
    this.isPausedAll = false;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.config = DEFAULT_UPLOAD_CONFIG;

    this.throttleTimeout = null;
    this.isProcessing = false;

    // Load initial settings & queue from storage
    this.init();
  }

  async init() {
    this.config = await uploadStorage.getSettings();
    const storedUploads = await uploadStorage.getAllUploads();
    
    if (storedUploads && storedUploads.length > 0) {
      this.queue = storedUploads.map(item => ({
        ...item,
        status: item.status === UPLOAD_STATUS.UPLOADING || item.status === UPLOAD_STATUS.CREATING
          ? UPLOAD_STATUS.PAUSED
          : item.status,
        speed: 0,
        eta: 0
      }));
      this.notifyListeners();
    }

    // Network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  handleNetworkChange(online) {
    this.isOnline = online;
    console.log(`[Scheduler] Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);

    if (!online) {
      // Auto-pause running requests
      for (const fileId of this.activeFileIds) {
        this.pauseUpload(fileId, 'Network offline');
      }
    } else {
      if (this.config.autoResumeOnNetwork && !this.isPausedAll) {
        this.startAll();
      }
    }
    this.notifyListeners();
  }

  // ==========================================
  // SUBSCRIPTION & THROTTLED NOTIFICATIONS
  // ==========================================
  subscribe(listener) {
    this.listeners.add(listener);
    // Initial trigger
    listener(this.getStateSnapshot());
    return () => this.listeners.delete(listener);
  }

  notifyListeners(immediate = false) {
    if (immediate) {
      if (this.throttleTimeout) {
        clearTimeout(this.throttleTimeout);
        this.throttleTimeout = null;
      }
      const snapshot = this.getStateSnapshot();
      for (const fn of this.listeners) {
        fn(snapshot);
      }
      return;
    }

    if (!this.throttleTimeout) {
      this.throttleTimeout = setTimeout(() => {
        this.throttleTimeout = null;
        const snapshot = this.getStateSnapshot();
        for (const fn of this.listeners) {
          fn(snapshot);
        }
      }, 250); // 250ms throttle for UI performance
    }
  }

  getStateSnapshot() {
    let totalBytes = 0;
    let totalUploadedBytes = 0;
    let activeFilesCount = 0;
    let queuedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let pausedCount = 0;
    let cancelledCount = 0;

    for (const item of this.queue) {
      totalBytes += (item.fileSize || 0);
      totalUploadedBytes += (item.uploadedBytes || 0);

      switch (item.status) {
        case UPLOAD_STATUS.UPLOADING:
        case UPLOAD_STATUS.CREATING:
        case UPLOAD_STATUS.VERIFYING:
        case UPLOAD_STATUS.COMPLETING:
        case UPLOAD_STATUS.RETRYING:
          activeFilesCount++;
          break;
        case UPLOAD_STATUS.QUEUED:
          queuedCount++;
          break;
        case UPLOAD_STATUS.COMPLETED:
          completedCount++;
          break;
        case UPLOAD_STATUS.FAILED:
          failedCount++;
          break;
        case UPLOAD_STATUS.PAUSED:
          pausedCount++;
          break;
        case UPLOAD_STATUS.CANCELLED:
          cancelledCount++;
          break;
      }
    }

    const overallSpeed = this.globalSpeedTracker.getSpeed();
    const remainingBytes = Math.max(0, totalBytes - totalUploadedBytes);
    const overallETA = overallSpeed > 0 ? remainingBytes / overallSpeed : 0;
    const overallProgress = totalBytes > 0 ? Math.min(100, Math.round((totalUploadedBytes / totalBytes) * 100)) : 0;

    return {
      queue: [...this.queue],
      stats: {
        totalFiles: this.queue.length,
        totalBytes,
        totalUploadedBytes,
        overallProgress,
        activeFilesCount,
        queuedCount,
        completedCount,
        failedCount,
        pausedCount,
        cancelledCount,
        overallSpeed,
        overallETA,
        isOnline: this.isOnline,
        isPausedAll: this.isPausedAll
      }
    };
  }

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================
  async addFiles(files, defaultCategory = 'tamil', defaultYear = '2026') {
    const partSize = (this.config.partSizeMB || 50) * 1024 * 1024;
    const newItems = [];

    for (const file of files) {
      const id = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const filename = sanitizeFilename(file.name);
      const movieFolder = sanitizeMovieFolder(file.name.replace(/\.[^/.]+$/, ''));
      const destinationKey = buildDestinationKey(defaultCategory, defaultYear, movieFolder, filename);
      const totalParts = Math.ceil(file.size / partSize);

      const item = {
        id,
        filename,
        fileSize: file.size,
        lastModified: file.lastModified,
        category: defaultCategory,
        year: defaultYear,
        movieFolder,
        destinationKey,
        uploadId: null,
        partSize,
        totalParts,
        completedParts: [],
        uploadedBytes: 0,
        speed: 0,
        eta: 0,
        status: UPLOAD_STATUS.QUEUED,
        error: null,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Store in-memory file reference
      this.filesMap.set(id, file);
      this.queue.push(item);
      newItems.push(item);

      await uploadStorage.saveUpload(item);
    }

    this.notifyListeners(true);

    if (this.config.autoStart && !this.isPausedAll) {
      this.processQueue();
    }

    return newItems;
  }

  updateItemMetadata(id, updates) {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    // Only allow editing if not currently uploading
    if (item.status === UPLOAD_STATUS.UPLOADING || item.status === UPLOAD_STATUS.COMPLETING) {
      return;
    }

    if (updates.category !== undefined) item.category = updates.category;
    if (updates.year !== undefined) item.year = updates.year;
    if (updates.movieFolder !== undefined) item.movieFolder = sanitizeMovieFolder(updates.movieFolder);
    if (updates.filename !== undefined) item.filename = sanitizeFilename(updates.filename);

    item.destinationKey = buildDestinationKey(item.category, item.year, item.movieFolder, item.filename);
    item.updatedAt = Date.now();

    uploadStorage.saveUpload(item);
    this.notifyListeners();
  }

  async removeUpload(id) {
    this.cancelUpload(id);
    this.queue = this.queue.filter(x => x.id !== id);
    this.filesMap.delete(id);
    this.speedTrackers.delete(id);
    await uploadStorage.deleteUpload(id);
    this.notifyListeners(true);
  }

  async clearQueue() {
    this.cancelAll();
    this.queue = [];
    this.filesMap.clear();
    this.speedTrackers.clear();
    await uploadStorage.clearAllUploads();
    this.notifyListeners(true);
  }

  // Re-associate in-memory File object after page reload
  attachFileObject(id, file) {
    const item = this.queue.find(x => x.id === id);
    if (!item || !file) return false;

    // Basic integrity check
    if (file.name !== item.filename || file.size !== item.fileSize) {
      console.warn('[Scheduler] File identity mismatch for resume.');
      return false;
    }

    this.filesMap.set(id, file);
    return true;
  }

  // ==========================================
  // SCHEDULER & CONCURRENCY DISPATCHER
  // ==========================================
  processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (this.isPausedAll || !this.isOnline) {
        return;
      }

      const maxActive = this.config.maxActiveFiles || 3;

      // Find candidates in QUEUED or RETRYING status
      while (this.activeFileIds.size < maxActive) {
        const nextItem = this.queue.find(x => 
          x.status === UPLOAD_STATUS.QUEUED || x.status === UPLOAD_STATUS.RETRYING
        );

        if (!nextItem) break;

        this.startUpload(nextItem.id);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // ==========================================
  // SINGLE FILE UPLOAD PIPELINE
  // ==========================================
  async startUpload(id) {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    if (!this.filesMap.has(id)) {
      item.status = UPLOAD_STATUS.PAUSED;
      item.error = 'Original File object missing. Please re-select the file to resume.';
      this.notifyListeners(true);
      return;
    }

    const file = this.filesMap.get(id);
    this.activeFileIds.add(id);

    const fileAbortCtrl = new AbortController();
    this.fileControllers.set(id, fileAbortCtrl);

    let speedTracker = this.speedTrackers.get(id);
    if (!speedTracker) {
      speedTracker = new SpeedTracker();
      this.speedTrackers.set(id, speedTracker);
    }

    try {
      // Step 1: Create or Resume Session
      if (!item.uploadId) {
        item.status = UPLOAD_STATUS.CREATING;
        this.notifyListeners();

        const createRes = await uploadApi.createUpload({
          category: item.category,
          year: parseInt(item.year, 10),
          movieFolder: item.movieFolder,
          filename: item.filename,
          fileSize: item.fileSize,
          contentType: file.type || 'video/mp4'
        });

        if (!createRes || !createRes.uploadId) {
          throw new Error('Failed to obtain uploadId from Worker');
        }

        item.uploadId = createRes.uploadId;
        item.destinationKey = createRes.key || item.destinationKey;
        await uploadStorage.saveUpload(item);
      }

      // Step 2: Reconcile / Verify Parts with R2 if needed
      if (this.config.verifyPartsOnResume && item.uploadId) {
        item.status = UPLOAD_STATUS.VERIFYING;
        this.notifyListeners();

        try {
          const listRes = await uploadApi.listParts({
            key: item.destinationKey,
            uploadId: item.uploadId
          });

          if (listRes && Array.isArray(listRes.parts)) {
            const r2PartsMap = new Map(listRes.parts.map(p => [p.partNumber, p]));
            item.completedParts = listRes.parts.map(p => ({
              partNumber: p.partNumber,
              etag: p.etag,
              size: p.size
            }));

            // Recalculate uploaded bytes from verified R2 parts
            let verifiedBytes = 0;
            for (const p of item.completedParts) {
              verifiedBytes += (p.size || item.partSize);
            }
            item.uploadedBytes = Math.min(item.fileSize, verifiedBytes);
            await uploadStorage.saveUpload(item);
          }
        } catch (err) {
          console.warn(`[Scheduler] Could not verify parts with R2 for ${item.id}:`, err);
        }
      }

      // Step 3: Check if already complete
      const completedSet = new Set(item.completedParts.map(p => p.partNumber));
      if (completedSet.size === item.totalParts && item.totalParts > 0) {
        await this.finalizeUpload(item, fileAbortCtrl.signal);
        return;
      }

      // Step 4: Stream Missing Chunks
      item.status = UPLOAD_STATUS.UPLOADING;
      this.notifyListeners();

      await this.uploadChunksConcurrently(item, file, fileAbortCtrl.signal);

      // Step 5: Finalize
      if (!fileAbortCtrl.signal.aborted) {
        await this.finalizeUpload(item, fileAbortCtrl.signal);
      }
    } catch (err) {
      if (fileAbortCtrl.signal.aborted) {
        // Handled by pause/cancel
        return;
      }

      console.error(`[Scheduler] Upload error for file ${item.filename}:`, err);
      item.status = UPLOAD_STATUS.FAILED;
      item.error = err.message || 'Upload failed';
      item.speed = 0;
      item.eta = 0;
      await uploadStorage.saveUpload(item);
      this.notifyListeners(true);
    } finally {
      this.activeFileIds.delete(id);
      this.fileControllers.delete(id);

      if (this.config.autoStartNext && !this.isPausedAll) {
        this.processQueue();
      }
    }
  }

  // ==========================================
  // CONCURRENT CHUNKS UPLOADER
  // ==========================================
  async uploadChunksConcurrently(item, file, fileSignal) {
    const partsPerFile = this.config.partsPerFile || 4;
    const maxGlobalParts = this.config.maxConcurrentParts || 12;

    const completedMap = new Map(item.completedParts.map(p => [p.partNumber, p]));
    const pendingPartNumbers = [];

    for (let pNum = 1; pNum <= item.totalParts; pNum++) {
      if (!completedMap.has(pNum)) {
        pendingPartNumbers.push(pNum);
      }
    }

    let nextIndex = 0;
    const activePromises = new Set();
    const speedTracker = this.speedTrackers.get(item.id);

    while (nextIndex < pendingPartNumbers.length || activePromises.size > 0) {
      if (fileSignal.aborted || this.isPausedAll || !this.isOnline) {
        break;
      }

      // Concurrency check: file limit and global limit
      while (
        nextIndex < pendingPartNumbers.length &&
        activePromises.size < partsPerFile &&
        this.activePartCount < maxGlobalParts
      ) {
        const partNumber = pendingPartNumbers[nextIndex++];
        this.activePartCount++;

        const partPromise = this.uploadSinglePartWithRetry(item, file, partNumber, fileSignal)
          .then((partResult) => {
            if (partResult && partResult.etag) {
              completedMap.set(partNumber, {
                partNumber,
                etag: partResult.etag,
                size: partResult.size
              });

              item.completedParts = Array.from(completedMap.values());

              // Recalculate uploaded bytes
              let totalUploaded = 0;
              for (const p of item.completedParts) {
                totalUploaded += p.size;
              }
              item.uploadedBytes = Math.min(item.fileSize, totalUploaded);

              // Update Speed & ETA
              if (speedTracker) {
                speedTracker.record(item.uploadedBytes);
                item.speed = speedTracker.getSpeed();
                const remaining = Math.max(0, item.fileSize - item.uploadedBytes);
                item.eta = item.speed > 0 ? remaining / item.speed : 0;
              }
              this.globalSpeedTracker.record(this.getStateSnapshot().stats.totalUploadedBytes);

              uploadStorage.saveUpload(item);
              this.notifyListeners();
            }
          })
          .finally(() => {
            this.activePartCount = Math.max(0, this.activePartCount - 1);
            activePromises.delete(partPromise);
          });

        activePromises.add(partPromise);
      }

      if (activePromises.size > 0) {
        await Promise.race(activePromises);
      } else {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (fileSignal.aborted) {
      throw new Error('Upload aborted or paused');
    }

    // Check that all parts succeeded
    if (completedMap.size !== item.totalParts) {
      throw new Error(`Incomplete upload: ${completedMap.size}/${item.totalParts} parts finished`);
    }
  }

  // ==========================================
  // SINGLE PART UPLOAD WITH RETRIES
  // ==========================================
  async uploadSinglePartWithRetry(item, file, partNumber, fileSignal) {
    const maxRetries = this.config.maxRetries || 5;
    const baseDelay = (this.config.retryDelaySeconds || 2) * 1000;
    const partSize = item.partSize;

    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const chunkSize = end - start;
    
    // Slice memory-safe chunk
    const chunkBlob = file.slice(start, end);

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      if (fileSignal.aborted || this.isPausedAll || !this.isOnline) {
        throw new Error('Aborted');
      }

      const partKey = `${item.id}_${partNumber}`;
      const partCtrl = new AbortController();
      this.partControllers.set(partKey, partCtrl);

      try {
        const res = await uploadApi.uploadPart({
          key: item.destinationKey,
          uploadId: item.uploadId,
          partNumber,
          chunk: chunkBlob,
          signal: partCtrl.signal
        });

        this.partControllers.delete(partKey);

        if (res && res.etag) {
          return { partNumber, etag: res.etag, size: chunkSize };
        } else {
          throw new Error(`Part ${partNumber} upload returned invalid ETag`);
        }
      } catch (err) {
        this.partControllers.delete(partKey);
        lastError = err;

        if (fileSignal.aborted || partCtrl.signal.aborted) {
          throw new Error('Part upload cancelled');
        }

        attempt++;
        if (attempt <= maxRetries) {
          const delay = this.config.exponentialBackoff
            ? baseDelay * Math.pow(2, attempt - 1)
            : baseDelay;

          console.warn(`[Scheduler] Part ${partNumber} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, err);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Part ${partNumber} failed after ${maxRetries} retries: ${lastError?.message}`);
  }

  // ==========================================
  // FINALIZE & COMPLETE
  // ==========================================
  async finalizeUpload(item, fileSignal) {
    if (fileSignal.aborted) return;

    item.status = UPLOAD_STATUS.COMPLETING;
    this.notifyListeners(true);

    const sortedParts = [...item.completedParts]
      .map(p => ({ partNumber: p.partNumber, etag: p.etag }))
      .sort((a, b) => a.partNumber - b.partNumber);

    const completeRes = await uploadApi.completeUpload({
      key: item.destinationKey,
      uploadId: item.uploadId,
      parts: sortedParts
    });

    if (completeRes && completeRes.success) {
      item.status = UPLOAD_STATUS.COMPLETED;
      item.uploadedBytes = item.fileSize;
      item.speed = 0;
      item.eta = 0;
      item.error = null;

      // Add to completed history
      const duration = Math.round((Date.now() - (item.createdAt || Date.now())) / 1000);
      await uploadStorage.addHistory({
        id: item.id,
        filename: item.filename,
        fileSize: item.fileSize,
        category: item.category,
        year: item.year,
        movieFolder: item.movieFolder,
        destinationKey: item.destinationKey,
        uploadId: item.uploadId,
        durationSeconds: duration,
        etag: completeRes.etag
      });

      await uploadStorage.saveUpload(item);
      this.notifyListeners(true);
    } else {
      throw new Error(completeRes.error || 'Failed to complete multipart upload');
    }
  }

  // ==========================================
  // ACTIONS: PAUSE, RESUME, CANCEL, RETRY
  // ==========================================
  pauseUpload(id, reason = 'Paused by user') {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    const controller = this.fileControllers.get(id);
    if (controller) {
      controller.abort(reason);
      this.fileControllers.delete(id);
    }

    this.activeFileIds.delete(id);
    item.status = UPLOAD_STATUS.PAUSED;
    item.speed = 0;
    item.eta = 0;
    uploadStorage.saveUpload(item);
    this.notifyListeners(true);
  }

  resumeUpload(id) {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    item.status = UPLOAD_STATUS.QUEUED;
    item.error = null;
    uploadStorage.saveUpload(item);
    this.notifyListeners(true);
    this.processQueue();
  }

  async cancelUpload(id) {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    // Abort in-flight requests
    const controller = this.fileControllers.get(id);
    if (controller) {
      controller.abort('Cancelled');
      this.fileControllers.delete(id);
    }

    this.activeFileIds.delete(id);

    // Call R2 /abort-upload if session exists
    if (item.uploadId && item.status !== UPLOAD_STATUS.COMPLETED) {
      uploadApi.abortUpload({
        key: item.destinationKey,
        uploadId: item.uploadId
      }).catch(e => console.warn('[Scheduler] abortUpload API error:', e));
    }

    item.status = UPLOAD_STATUS.CANCELLED;
    item.speed = 0;
    item.eta = 0;
    await uploadStorage.saveUpload(item);
    this.notifyListeners(true);
  }

  retryUpload(id) {
    const item = this.queue.find(x => x.id === id);
    if (!item) return;

    item.status = UPLOAD_STATUS.RETRYING;
    item.error = null;
    item.retryCount = (item.retryCount || 0) + 1;
    uploadStorage.saveUpload(item);
    this.notifyListeners(true);
    this.processQueue();
  }

  startAll() {
    this.isPausedAll = false;
    for (const item of this.queue) {
      if (item.status === UPLOAD_STATUS.PAUSED || item.status === UPLOAD_STATUS.RETRYING) {
        item.status = UPLOAD_STATUS.QUEUED;
        item.error = null;
        uploadStorage.saveUpload(item);
      }
    }
    this.notifyListeners(true);
    this.processQueue();
  }

  pauseAll() {
    this.isPausedAll = true;
    for (const id of Array.from(this.activeFileIds)) {
      this.pauseUpload(id);
    }
    for (const item of this.queue) {
      if (item.status === UPLOAD_STATUS.QUEUED) {
        item.status = UPLOAD_STATUS.PAUSED;
        uploadStorage.saveUpload(item);
      }
    }
    this.notifyListeners(true);
  }

  cancelAll() {
    for (const item of [...this.queue]) {
      if (item.status !== UPLOAD_STATUS.COMPLETED) {
        this.cancelUpload(item.id);
      }
    }
  }

  retryFailed() {
    for (const item of this.queue) {
      if (item.status === UPLOAD_STATUS.FAILED || item.status === UPLOAD_STATUS.CANCELLED) {
        item.status = UPLOAD_STATUS.QUEUED;
        item.error = null;
        uploadStorage.saveUpload(item);
      }
    }
    this.notifyListeners(true);
    this.processQueue();
  }
}

export const uploadScheduler = new UploadScheduler();
