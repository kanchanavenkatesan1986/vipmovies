/**
 * Cloudflare R2 File Manager API Client
 */
import { DEFAULT_UPLOAD_CONFIG } from '../uploader/uploadConfig';
import { uploadStorage } from '../uploader/uploadStorage';

class FileManagerApiClient {
  constructor() {
    this.cachedConfig = null;
  }

  async getConfig() {
    if (!this.cachedConfig) {
      this.cachedConfig = await uploadStorage.getSettings();
    }
    return this.cachedConfig || DEFAULT_UPLOAD_CONFIG;
  }

  clearConfigCache() {
    this.cachedConfig = null;
  }

  getAuthToken() {
    return (
      import.meta.env.VITE_UPLOAD_API_TOKEN ||
      localStorage.getItem('vip_upload_api_token') ||
      'VIP_SECURE_TOKEN_2026'
    );
  }

  async getBaseUrl() {
    const config = await this.getConfig();
    let base = (config.apiBase || DEFAULT_UPLOAD_CONFIG.apiBase).replace(/\/+$/, '');
    if (base.includes('api-uploud')) {
      base = DEFAULT_UPLOAD_CONFIG.apiBase;
    }
    return base;
  }

  async getHeaders(extraHeaders = {}) {
    const token = this.getAuthToken();
    const headers = {
      Accept: 'application/json',
      ...extraHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}, timeoutSeconds = 60) {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    let timeoutId = null;
    if (timeoutSeconds > 0) {
      timeoutId = setTimeout(() => controller.abort(new Error(`Request timed out (${timeoutSeconds}s)`)), timeoutSeconds * 1000);
    }

    try {
      const headers = await this.getHeaders(options.headers || {});
      const response = await fetch(url, {
        ...options,
        headers,
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
        const netErr = new Error(`Cannot connect to Storage API at ${baseUrl}.`);
        netErr.code = 'NETWORK_ERROR';
        throw netErr;
      }
      throw err;
    }
  }

  /**
   * POST /list-objects
   */
  async listObjects({ prefix = '', delimiter = '/', cursor = undefined, limit = 100 }) {
    return this.request('/list-objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, delimiter, cursor, limit })
    }, 45);
  }

  /**
   * POST /object-details
   */
  async getObjectDetails(key) {
    return this.request('/object-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    }, 30);
  }

  /**
   * POST /delete-object
   */
  async deleteObject(key) {
    return this.request('/delete-object', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    }, 30);
  }

  /**
   * POST /delete-objects (bulk)
   */
  async deleteObjects(keys) {
    return this.request('/delete-objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys })
    }, 60);
  }

  /**
   * POST /copy-object
   */
  async copyObject(sourceKey, destKey, conflictPolicy = 'skip') {
    return this.request('/copy-object', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey, destKey, conflictPolicy })
    }, 60);
  }

  /**
   * POST /copy-objects (bulk)
   */
  async copyObjects(items, conflictPolicy = 'skip') {
    return this.request('/copy-objects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, conflictPolicy })
    }, 120);
  }

  /**
   * POST /rename-object
   */
  async renameObject(oldKey, newKey) {
    return this.request('/rename-object', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldKey, newKey })
    }, 60);
  }

  /**
   * POST /move-object
   */
  async moveObject(sourceKey, destKey, conflictPolicy = 'skip') {
    return this.request('/move-object', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey, destKey, conflictPolicy })
    }, 60);
  }

  /**
   * POST /create-folder
   */
  async createFolder(prefix) {
    return this.request('/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix })
    }, 30);
  }

  /**
   * POST /delete-folder
   */
  async deleteFolder(prefix) {
    return this.request('/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix })
    }, 120);
  }

  /**
   * POST /rename-folder
   */
  async renameFolder(oldPrefix, newPrefix) {
    return this.request('/rename-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPrefix, newPrefix })
    }, 120);
  }

  /**
   * Fetch raw text content of a small text file (srt, vtt, txt, json) from R2
   */
  async fetchTextContent(key) {
    const baseUrl = await this.getBaseUrl();
    const token = this.getAuthToken();
    const url = `${baseUrl}/stream-media?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file content: HTTP ${res.status}`);
    return res.text();
  }

  /**
   * Save edited text content back to R2 via /put-object
   */
  async putTextContent(key, textContent, contentType = 'text/plain') {
    const baseUrl = await this.getBaseUrl();
    const token = this.getAuthToken();
    const url = `${baseUrl}/put-object`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key, content: textContent, contentType })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed to save: HTTP ${res.status}`);
    return data;
  }

  /**
   * Generate streaming playback URL for video previews
   */
  async getStreamUrl(key) {
    const baseUrl = await this.getBaseUrl();
    const token = this.getAuthToken();
    return `${baseUrl}/stream-media?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
  }

  /**
   * Generate download URL
   */
  async getDownloadUrl(key) {
    const baseUrl = await this.getBaseUrl();
    const token = this.getAuthToken();
    return `${baseUrl}/download?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
  }

  /**
   * Public Media CDN URL
   */
  async getMediaUrl(key) {
    const config = await this.getConfig();
    const mediaBase = (config.mediaBaseUrl || 'https://media.vipmovies.in').replace(/\/+$/, '');
    return `${mediaBase}/${key.replace(/^\/+/, '')}`;
  }

  /**
   * POST /probe-url
   * Probes a remote URL using HEAD/GET to extract real filename, content-length, MIME type and format
   */
  async probeUrl(url) {
    return this.request('/probe-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    }, 20);
  }

  /**
   * POST /upload-from-url
   * Streams a file from a remote web URL directly into R2 at the specified prefix/folder
   */
  async uploadFromUrl({ url, prefix = '', filename = '', duplicatePolicy = 'replace' }) {
    return this.request('/upload-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, prefix, filename, duplicatePolicy })
    }, 900); // 15-minute timeout for large movie transfers
  }

  /**
   * POST /upload-from-url with real-time SSE progress streaming (loaded, total, percent %, speed).
   *
   * Handles two response shapes from the worker:
   *   1. text/event-stream  — SSE with start/progress/complete events (preferred)
   *   2. application/json   — Plain JSON success object (older worker deploy or non-streaming path)
   */
  async uploadFromUrlWithProgress({ url, prefix = '', filename = '', duplicatePolicy = 'replace', onProgress, signal }) {
    const baseUrl = await this.getBaseUrl();
    const token = this.getAuthToken();
    const endpointUrl = `${baseUrl}/upload-from-url`;

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url, prefix, filename, duplicatePolicy, stream: true }),
      signal
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}: Failed to start stream`);
    }

    // ---- Detect response type ----
    // When the worker is on an older deploy (or falls through to the non-streaming path),
    // it returns application/json instead of text/event-stream.  Handle both gracefully.
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/event-stream')) {
      const data = await response.json().catch(() => null);
      if (!data) throw new Error('Upload returned an unreadable response.');
      if (data.success === false) throw new Error(data.error || 'Upload failed (server error).');
      const result = {
        type: 'complete',
        success: true,
        key: data.key || `${prefix}${filename}`,
        filename: data.filename || filename,
        prefix: data.prefix != null ? data.prefix : prefix,
        size: data.size || 0,
        sizeFormatted: data.sizeFormatted || '',
        contentType: data.contentType || '',
        percent: 100
      };
      if (onProgress) onProgress(result);
      return result;
    }

    // ---- SSE streaming path ----
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastResult = null;
    let startInfo = null;
    let lastProgress = null;

    /**
     * Parse one SSE message block (everything between two \n\n delimiters).
     * Throws on stream errors; stores the complete event in lastResult.
     */
    const processSSEPart = (part) => {
      if (!part.trim()) return;
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.substring(6));
          if (data.type === 'start') startInfo = data;
          if (data.type === 'progress') lastProgress = data;
          if (data.type === 'error') throw new Error(data.error || 'Stream error');
          if (data.type === 'complete') lastResult = data;
          if (onProgress) onProgress(data);
        } catch (err) {
          // Only re-throw genuine stream errors; silently skip JSON parse failures
          if (err.message && !err.message.includes('JSON')) throw err;
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();

      // { stream: !done } flushes any bytes held in the TextDecoder's internal
      // multi-byte state on the very last read, so we never drop the final event.
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      // Split on SSE message delimiter (\n\n).
      // While streaming: hold back the last (possibly incomplete) fragment.
      // When done: process ALL parts — the complete event may be in the final one.
      const parts = buffer.split('\n\n');
      buffer = done ? '' : (parts.pop() || '');
      for (const part of parts) processSSEPart(part);

      if (done) break;
    }

    // Safety net: flush any trailing bytes not terminated by \n\n
    if (buffer.trim()) processSSEPart(buffer);

    // If SSE stream ended without receiving the final 'complete' event (e.g. Cloudflare stream buffer limit on large files),
    // automatically fall back to the native zero-copy direct transfer so the file is guaranteed to upload completely to R2.
    if (!lastResult) {
      if (onProgress) {
        onProgress({
          type: 'progress',
          percent: 90,
          speed: 'Completing Cloudflare direct transfer...'
        });
      }

      const directResult = await this.uploadFromUrl({ url, prefix, filename, duplicatePolicy });
      if (!directResult || directResult.success === false) {
        throw new Error(directResult?.error || 'Upload failed');
      }

      lastResult = {
        type: 'complete',
        success: true,
        key: directResult.key || `${prefix}${filename}`,
        filename: directResult.filename || filename,
        prefix: directResult.prefix != null ? directResult.prefix : prefix,
        size: directResult.size || 0,
        sizeFormatted: directResult.sizeFormatted || '',
        contentType: directResult.contentType || '',
        percent: 100
      };
      if (onProgress) onProgress(lastResult);
    }

    return lastResult;
  }
}

export const fileManagerApi = new FileManagerApiClient();
