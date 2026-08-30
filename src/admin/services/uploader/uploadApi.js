/**
 * Cloudflare Worker R2 Multipart API Client
 * Clean HTTP client for multipart lifecycle operations
 */

import { DEFAULT_UPLOAD_CONFIG } from './uploadConfig';
import { uploadStorage } from './uploadStorage';

class UploadApiClient {
  constructor() {
    this.cachedConfig = null;
  }

  async getConfig() {
    if (!this.cachedConfig) {
      this.cachedConfig = await uploadStorage.getSettings();
    }
    return this.cachedConfig || DEFAULT_UPLOAD_CONFIG;
  }

  // Invalidate config cache when user saves in settings UI
  invalidateConfigCache() {
    this.cachedConfig = null;
  }

  getAuthToken() {
    return import.meta.env.VITE_UPLOAD_API_TOKEN || localStorage.getItem('vip_upload_api_token') || 'VIP_SECURE_TOKEN_2026';
  }

  async getHeaders(extraHeaders = {}) {
    const token = this.getAuthToken();
    const headers = {
      'Accept': 'application/json',
      ...extraHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getBaseUrl() {
    const config = await this.getConfig();
    let base = (config.apiBase || DEFAULT_UPLOAD_CONFIG.apiBase).replace(/\/+$/, '');
    if (base.includes('api-uploud')) {
      base = DEFAULT_UPLOAD_CONFIG.apiBase;
    }
    return base;
  }

  /**
   * Safe fetch with timeout
   */
  async request(endpoint, options = {}, timeoutSeconds = 60) {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    const externalSignal = options.signal;

    // Combine external signal and timeout
    let timeoutId = null;
    if (timeoutSeconds > 0) {
      timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutSeconds}s`)), timeoutSeconds * 1000);
    }

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => {
        controller.abort(externalSignal.reason);
      });
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.error || `HTTP ${response.status}: Request failed`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.code = data.code || 'HTTP_ERROR';
        throw err;
      }

      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err.name === 'AbortError' || err.message?.includes('timed out')) {
        const timeoutErr = new Error(`Request timed out (${timeoutSeconds}s)`);
        timeoutErr.code = 'TIMEOUT';
        throw timeoutErr;
      }
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        const netErr = new Error(`Cannot connect to Worker at ${baseUrl}. Please check Settings or Worker URL.`);
        netErr.code = 'NETWORK_ERROR';
        throw netErr;
      }
      throw err;
    }
  }

  /**
   * GET /health
   */
  async checkHealth() {
    const config = await this.getConfig();
    return this.request(config.endpoints.health || '/health', {
      method: 'GET'
    }, 15);
  }

  /**
   * POST /create-upload
   */
  async createUpload(payload) {
    const config = await this.getConfig();
    const headers = await this.getHeaders({ 'Content-Type': 'application/json' });

    return this.request(config.endpoints.create || '/create-upload', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }, 30);
  }

  /**
   * POST /upload-part
   * Sends chunk as multipart/form-data with live byte-by-byte progress tracking via XHR
   */
  async uploadPart({ key, uploadId, partNumber, chunk, signal, onProgress }) {
    const baseUrl = await this.getBaseUrl();
    const config = await this.getConfig();
    const url = `${baseUrl}${config.endpoints.uploadPart || '/upload-part'}`;
    const token = this.getAuthToken();
    const timeoutSec = config.requestTimeoutSeconds || 120;

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('key', key);
      formData.append('uploadId', uploadId);
      formData.append('partNumber', String(partNumber));
      formData.append('chunk', chunk);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.timeout = timeoutSec * 1000;
      xhr.setRequestHeader('Accept', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Real-time byte upload progress
      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded, event.total);
          }
        };
      }

      // External Abort signal handling
      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          return reject(new Error('Part upload cancelled'));
        }
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Part upload cancelled'));
        });
      }

      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {}

        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve(data);
        } else {
          const errorMsg = data.error || `HTTP ${xhr.status}: Part upload failed`;
          const err = new Error(errorMsg);
          err.status = xhr.status;
          err.code = data.code || 'HTTP_ERROR';
          reject(err);
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during part upload'));
      };

      xhr.ontimeout = () => {
        const timeoutErr = new Error(`Request timed out (${timeoutSec}s)`);
        timeoutErr.code = 'TIMEOUT';
        reject(timeoutErr);
      };

      xhr.send(formData);
    });
  }

  /**
   * POST /complete-upload
   */
  async completeUpload({ key, uploadId, parts }) {
    const config = await this.getConfig();
    const headers = await this.getHeaders({ 'Content-Type': 'application/json' });

    return this.request(config.endpoints.complete || '/complete-upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, uploadId, parts })
    }, 60);
  }

  /**
   * POST /list-parts
   */
  async listParts({ key, uploadId }) {
    const config = await this.getConfig();
    const headers = await this.getHeaders({ 'Content-Type': 'application/json' });

    return this.request(config.endpoints.listParts || '/list-parts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, uploadId })
    }, 30);
  }

  /**
   * POST /upload-status
   */
  async uploadStatus({ key, uploadId }) {
    const config = await this.getConfig();
    const headers = await this.getHeaders({ 'Content-Type': 'application/json' });

    return this.request(config.endpoints.status || '/upload-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, uploadId })
    }, 30);
  }

  /**
   * POST /abort-upload
   */
  async abortUpload({ key, uploadId }) {
    const config = await this.getConfig();
    const headers = await this.getHeaders({ 'Content-Type': 'application/json' });

    return this.request(config.endpoints.abort || '/abort-upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ key, uploadId })
    }, 30);
  }
}

export const uploadApi = new UploadApiClient();
