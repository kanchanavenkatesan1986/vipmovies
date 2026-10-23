/**
 * Background Multi-File URL Upload Manager for File Manager
 * Handles concurrent background stream uploads directly from web URLs to Cloudflare R2
 */

import { fileManagerApi } from './fileManagerApi';
import { extractFilenameFromUrlAdvanced, isScriptExtension } from './fileManagerUtils';

export const UPLOAD_STATUS = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  COMPLETE: 'complete',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

class UrlUploadManager {
  constructor() {
    this.items = [];
    this.concurrency = 2; // Default 2 simultaneous uploads
    this.listeners = new Set();
    this.completionListeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    // Immediately call with current state snapshot
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  onComplete(callback) {
    this.completionListeners.add(callback);
    return () => this.completionListeners.delete(callback);
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[UrlUploadManager] Listener error:', err);
      }
    });
  }

  getState() {
    const active = this.items.filter((i) => i.status === UPLOAD_STATUS.UPLOADING);
    const queued = this.items.filter((i) => i.status === UPLOAD_STATUS.QUEUED);
    const completed = this.items.filter((i) => i.status === UPLOAD_STATUS.COMPLETE);
    const errors = this.items.filter((i) => i.status === UPLOAD_STATUS.ERROR);

    // Calculate aggregated speed and progress across all items
    let totalSpeedBps = 0;
    active.forEach((i) => {
      if (i.speedBps) totalSpeedBps += i.speedBps;
    });

    let overallPercent = 0;
    if (this.items.length > 0) {
      const sumPercent = this.items.reduce((acc, curr) => {
        if (curr.status === UPLOAD_STATUS.COMPLETE) return acc + 100;
        if (curr.status === UPLOAD_STATUS.UPLOADING) return acc + (curr.percent || 0);
        return acc;
      }, 0);
      overallPercent = Math.round(sumPercent / this.items.length);
    }

    return {
      items: [...this.items],
      activeCount: active.length,
      queuedCount: queued.length,
      completedCount: completed.length,
      errorCount: errors.length,
      totalCount: this.items.length,
      hasActive: active.length > 0 || queued.length > 0,
      totalSpeedBps,
      overallPercent,
      concurrency: this.concurrency
    };
  }

  setConcurrency(num) {
    this.concurrency = Math.max(1, Math.min(6, num || 2));
    this.processQueue();
    this.notify();
  }

  /**
   * Add one or multiple URLs to the background queue
   * @param {Array<{ url: string, prefix?: string, filename?: string, duplicatePolicy?: string }>} entries
   */
  addUrls(entries = []) {
    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    const newItems = [];

    for (const entry of entries) {
      if (!entry || !entry.url || typeof entry.url !== 'string') continue;
      const url = entry.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) continue;

      let filename = (entry.filename || '').trim();
      if (!filename) {
        filename = extractFilenameFromUrlAdvanced(url);
      }

      // Convert dangerous script extensions (.php, .aspx, etc.) to .mp4
      if (!filename || isScriptExtension(filename)) {
        const base = (filename || 'download_movie').replace(/\.[a-zA-Z0-9]+$/i, '');
        filename = `${base || 'movie'}.mp4`;
      }

      // Ensure proper extension exists
      if (!/\.[a-zA-Z0-9]{2,5}$/.test(filename)) {
        filename = `${filename}.mp4`;
      }

      filename = filename.replace(/[\/\\]/g, '_').trim();

      const item = {
        id: `url_up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url,
        prefix: entry.prefix || '',
        filename,
        duplicatePolicy: entry.duplicatePolicy || 'replace',
        status: UPLOAD_STATUS.QUEUED,
        percent: 0,
        loadedBytes: 0,
        totalBytes: 0,
        speed: '',
        speedBps: 0,
        etaSeconds: null,
        statusMessage: 'Queued for upload...',
        errorMessage: null,
        result: null,
        abortController: null,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null
      };

      this.items.push(item);
      newItems.push(item);
    }

    this.processQueue();
    this.notify();
    return newItems;
  }

  /**
   * Process queue up to concurrency limit
   */
  async processQueue() {
    const activeItems = this.items.filter((i) => i.status === UPLOAD_STATUS.UPLOADING);
    const availableSlots = this.concurrency - activeItems.length;

    if (availableSlots <= 0) return;

    const queuedItems = this.items.filter((i) => i.status === UPLOAD_STATUS.QUEUED);
    const toStart = queuedItems.slice(0, availableSlots);

    for (const item of toStart) {
      this.startItemUpload(item);
    }
  }

  async startItemUpload(item) {
    item.status = UPLOAD_STATUS.UPLOADING;
    item.startedAt = Date.now();
    item.abortController = new AbortController();
    item.statusMessage = 'Connecting to remote origin & establishing R2 pipeline...';
    item.errorMessage = null;

    this.notify();

    try {
      const result = await fileManagerApi.uploadFromUrlWithProgress({
        url: item.url,
        prefix: item.prefix,
        filename: item.filename,
        duplicatePolicy: item.duplicatePolicy,
        signal: item.abortController.signal,
        onProgress: (event) => {
          if (item.status !== UPLOAD_STATUS.UPLOADING) return;

          if (event.type === 'start') {
            if (event.total) item.totalBytes = event.total;
            item.statusMessage = 'Remote stream connected. High-speed R2 pipeline active...';
          } else if (event.type === 'progress') {
            if (typeof event.percent === 'number') {
              item.percent = Math.min(99.5, event.percent);
            }
            if (event.loaded) item.loadedBytes = event.loaded;
            if (event.total) item.totalBytes = event.total;
            if (event.speed) item.speed = event.speed;
            if (event.speedBps) item.speedBps = event.speedBps;
            if (typeof event.etaSeconds === 'number') item.etaSeconds = event.etaSeconds;

            if (item.percent >= 98) {
              item.statusMessage = 'Finalizing chunks & indexing in R2...';
            } else {
              item.statusMessage = `Streaming at ${item.speed || 'high speed'}...`;
            }
          } else if (event.type === 'complete') {
            item.percent = 100;
            if (event.size) item.loadedBytes = event.size;
          }

          this.notify();
        }
      });

      // Complete
      item.status = UPLOAD_STATUS.COMPLETE;
      item.percent = 100;
      item.statusMessage = 'Saved to Cloudflare R2 successfully!';
      item.result = result;
      item.completedAt = Date.now();
      item.abortController = null;

      // Fire completion callbacks
      this.completionListeners.forEach((cb) => {
        try {
          cb({ item, result });
        } catch (e) {
          console.error('[UrlUploadManager] onComplete callback error:', e);
        }
      });

    } catch (err) {
      if (item.abortController?.signal?.aborted) {
        item.status = UPLOAD_STATUS.CANCELLED;
        item.statusMessage = 'Upload cancelled by user';
      } else {
        item.status = UPLOAD_STATUS.ERROR;
        item.errorMessage = err.message || 'Upload failed';
        item.statusMessage = `Failed: ${item.errorMessage}`;
      }
    } finally {
      item.abortController = null;
      this.notify();
      // Pick up the next queued item immediately
      this.processQueue();
    }
  }

  cancelItem(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    if (item.status === UPLOAD_STATUS.UPLOADING && item.abortController) {
      item.abortController.abort();
    }

    item.status = UPLOAD_STATUS.CANCELLED;
    item.statusMessage = 'Cancelled';
    this.notify();
    this.processQueue();
  }

  retryItem(id) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;

    item.status = UPLOAD_STATUS.QUEUED;
    item.percent = 0;
    item.loadedBytes = 0;
    item.speed = '';
    item.speedBps = 0;
    item.etaSeconds = null;
    item.statusMessage = 'Queued for retry...';
    item.errorMessage = null;

    this.notify();
    this.processQueue();
  }

  removeItem(id) {
    this.cancelItem(id);
    this.items = this.items.filter((i) => i.id !== id);
    this.notify();
  }

  clearCompleted() {
    this.items = this.items.filter(
      (i) => i.status !== UPLOAD_STATUS.COMPLETE && i.status !== UPLOAD_STATUS.CANCELLED
    );
    this.notify();
  }

  cancelAll() {
    this.items.forEach((item) => {
      if (item.status === UPLOAD_STATUS.UPLOADING && item.abortController) {
        item.abortController.abort();
      }
      if (item.status === UPLOAD_STATUS.QUEUED || item.status === UPLOAD_STATUS.UPLOADING) {
        item.status = UPLOAD_STATUS.CANCELLED;
        item.statusMessage = 'Cancelled';
      }
    });
    this.notify();
  }
}

export const urlUploadManager = new UrlUploadManager();
