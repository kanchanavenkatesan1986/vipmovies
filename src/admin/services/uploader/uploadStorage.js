/**
 * IndexedDB Persistent Storage for Upload Manager
 * Manages uploads queue, settings, and completed upload history
 */

import { DEFAULT_UPLOAD_CONFIG } from './uploadConfig';

const DB_NAME = 'vipmovies_uploader_db';
const DB_VERSION = 1;

const STORES = {
  UPLOADS: 'uploads',
  SETTINGS: 'settings',
  HISTORY: 'history'
};

class UploadStorage {
  constructor() {
    this.dbPromise = this.initDB();
  }

  initDB() {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[UploadStorage] IndexedDB not available, falling back to in-memory/localStorage');
        resolve(null);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.UPLOADS)) {
          db.createObjectStore(STORES.UPLOADS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.error('[UploadStorage] Failed to open IndexedDB:', e);
        resolve(null);
      };
    });
  }

  // Generic Transaction Helper
  async withStore(storeName, mode, callback) {
    const db = await this.dbPromise;
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = callback(store);

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ==========================================
  // SETTINGS
  // ==========================================
  async getSettings() {
    try {
      const db = await this.dbPromise;
      if (!db) {
        const local = localStorage.getItem('vip_upload_settings');
        return local ? { ...DEFAULT_UPLOAD_CONFIG, ...JSON.parse(local) } : DEFAULT_UPLOAD_CONFIG;
      }

      return new Promise((resolve) => {
        const tx = db.transaction(STORES.SETTINGS, 'readonly');
        const store = tx.objectStore(STORES.SETTINGS);
        const req = store.get('current_config');

        req.onsuccess = () => {
          if (req.result && req.result.config) {
            resolve({ ...DEFAULT_UPLOAD_CONFIG, ...req.result.config });
          } else {
            resolve(DEFAULT_UPLOAD_CONFIG);
          }
        };
        req.onerror = () => resolve(DEFAULT_UPLOAD_CONFIG);
      });
    } catch {
      return DEFAULT_UPLOAD_CONFIG;
    }
  }

  async saveSettings(config) {
    try {
      const db = await this.dbPromise;
      if (!db) {
        localStorage.setItem('vip_upload_settings', JSON.stringify(config));
        return config;
      }

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SETTINGS, 'readwrite');
        const store = tx.objectStore(STORES.SETTINGS);
        store.put({ id: 'current_config', config, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(config);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error('[UploadStorage] Error saving settings:', e);
    }
  }

  // ==========================================
  // UPLOADS QUEUE
  // ==========================================
  async getAllUploads() {
    try {
      const db = await this.dbPromise;
      if (!db) return [];

      return new Promise((resolve) => {
        const tx = db.transaction(STORES.UPLOADS, 'readonly');
        const store = tx.objectStore(STORES.UPLOADS);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveUpload(uploadItem) {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      // Extract serializable data (strip non-serializable File objects from DB record)
      const serializableItem = {
        id: uploadItem.id,
        filename: uploadItem.filename,
        fileSize: uploadItem.fileSize,
        lastModified: uploadItem.lastModified,
        category: uploadItem.category,
        year: uploadItem.year,
        movieFolder: uploadItem.movieFolder,
        destinationKey: uploadItem.destinationKey,
        uploadId: uploadItem.uploadId || null,
        partSize: uploadItem.partSize,
        totalParts: uploadItem.totalParts,
        completedParts: uploadItem.completedParts || [], // [{ partNumber, etag, size }]
        uploadedBytes: uploadItem.uploadedBytes || 0,
        status: uploadItem.status,
        error: uploadItem.error || null,
        retryCount: uploadItem.retryCount || 0,
        createdAt: uploadItem.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.UPLOADS, 'readwrite');
        const store = tx.objectStore(STORES.UPLOADS);
        store.put(serializableItem);
        tx.oncomplete = () => resolve(serializableItem);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Failed to save upload record:', err);
    }
  }

  async deleteUpload(id) {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.UPLOADS, 'readwrite');
        const store = tx.objectStore(STORES.UPLOADS);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Error deleting upload:', err);
    }
  }

  async clearAllUploads() {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.UPLOADS, 'readwrite');
        const store = tx.objectStore(STORES.UPLOADS);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Error clearing uploads:', err);
    }
  }

  // ==========================================
  // COMPLETED HISTORY
  // ==========================================
  async getAllHistory() {
    try {
      const db = await this.dbPromise;
      if (!db) return [];

      return new Promise((resolve) => {
        const tx = db.transaction(STORES.HISTORY, 'readonly');
        const store = tx.objectStore(STORES.HISTORY);
        const req = store.getAll();

        req.onsuccess = () => {
          const list = req.result || [];
          // Sort descending by completion time
          list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async addHistory(item) {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      const historyRecord = {
        id: item.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filename: item.filename,
        fileSize: item.fileSize,
        category: item.category,
        year: item.year,
        movieFolder: item.movieFolder,
        destinationKey: item.destinationKey,
        uploadId: item.uploadId,
        completedAt: Date.now(),
        durationSeconds: item.durationSeconds || 0,
        etag: item.etag || null
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.HISTORY);
        store.put(historyRecord);
        tx.oncomplete = () => resolve(historyRecord);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Error adding history:', err);
    }
  }

  async deleteHistory(id) {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.HISTORY);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Error deleting history:', err);
    }
  }

  async clearHistory() {
    try {
      const db = await this.dbPromise;
      if (!db) return;

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.HISTORY);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[UploadStorage] Error clearing history:', err);
    }
  }
}

export const uploadStorage = new UploadStorage();
