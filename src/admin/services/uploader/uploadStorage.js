/**
 * Upload Storage Service
 * Pure runtime in-memory queue management without lingering internal/local storage of files.
 * Settings (API URL / token) are saved lightly in localStorage.
 */

import { DEFAULT_UPLOAD_CONFIG } from './uploadConfig';

class UploadStorage {
  constructor() {
    this.memoryUploads = new Map();
  }

  // ==========================================
  // SETTINGS (Lightweight localStorage only)
  // ==========================================
  async getSettings() {
    try {
      const local = localStorage.getItem('vip_upload_settings');
      const cfg = local ? { ...DEFAULT_UPLOAD_CONFIG, ...JSON.parse(local) } : DEFAULT_UPLOAD_CONFIG;
      if (cfg.apiBase && cfg.apiBase.includes('api-uploud')) {
        cfg.apiBase = DEFAULT_UPLOAD_CONFIG.apiBase;
      }
      return cfg;
    } catch {
      return DEFAULT_UPLOAD_CONFIG;
    }
  }

  async saveSettings(config) {
    try {
      localStorage.setItem('vip_upload_settings', JSON.stringify(config));
      return config;
    } catch (e) {
      console.error('[UploadStorage] Error saving settings:', e);
    }
  }

  // ==========================================
  // IN-MEMORY ACTIVE UPLOADS ONLY (No local file caching)
  // ==========================================
  async getAllUploads() {
    return Array.from(this.memoryUploads.values());
  }

  async saveUpload(uploadItem) {
    if (!uploadItem || !uploadItem.id) return;
    this.memoryUploads.set(uploadItem.id, {
      ...uploadItem,
      updatedAt: Date.now()
    });
    return uploadItem;
  }

  async deleteUpload(id) {
    this.memoryUploads.delete(id);
    return true;
  }

  async clearAllUploads() {
    this.memoryUploads.clear();
    return true;
  }

  // ==========================================
  // HISTORY (Purely in-memory runtime session)
  // ==========================================
  async getAllHistory() {
    return [];
  }

  async addHistory(item) {
    return item;
  }

  async deleteHistory(id) {
    return true;
  }

  async clearHistory() {
    return true;
  }
}

export const uploadStorage = new UploadStorage();
