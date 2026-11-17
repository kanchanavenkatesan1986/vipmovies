const fs = require('fs');
const path = require('path');

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  config = {
    r2WorkerBase: 'https://api-uploder.akatsuki-pvt-ltd.workers.dev',
    r2MediaBase: 'https://api-download.akatsuki-pvt-ltd.workers.dev',
    r2Token: 'VIP_SECURE_TOKEN_2026'
  };
}

class R2Client {
  constructor(customConfig = {}) {
    this.apiBase = (customConfig.r2WorkerBase || config.r2WorkerBase || 'https://api-uploder.akatsuki-pvt-ltd.workers.dev').replace(/\/+$/, '');
    this.mediaBase = (customConfig.r2MediaBase || config.r2MediaBase || 'https://api-download.akatsuki-pvt-ltd.workers.dev').replace(/\/+$/, '');
    this.token = customConfig.r2Token || config.r2Token || 'VIP_SECURE_TOKEN_2026';
  }

  getHeaders(extra = {}) {
    const headers = {
      Accept: 'application/json',
      ...extra
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async createFolder(prefix) {
    const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const res = await fetch(`${this.apiBase}/create-folder`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: cleanPrefix })
    });
    return res.json().catch(() => ({ success: true }));
  }

  async listObjects(prefix = '', delimiter = '/') {
    const res = await fetch(`${this.apiBase}/list-objects`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, delimiter, limit: 1000 })
    });
    if (!res.ok) {
      throw new Error(`Failed to list objects: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getObjectDetails(key) {
    const res = await fetch(`${this.apiBase}/object-details`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ key })
    });
    return res.json().catch(() => ({ success: false }));
  }

  /**
   * Upload from URL directly via Cloudflare Worker into R2.
   * Uses standard streaming put which completes in 10-30s.
   */
  async uploadFromUrl({ url, prefix = '', filename = '', duplicatePolicy = 'replace', signal }) {
    const endpoint = `${this.apiBase}/upload-from-url`;
    const cleanPrefix = prefix ? (prefix.endsWith('/') ? prefix : `${prefix}/`) : '';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900000); // 15 min timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          url: url.trim(),
          prefix: cleanPrefix,
          filename: filename.trim(),
          duplicatePolicy
        }),
        signal: signal || controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${response.status}: Upload failed`);
      }

      return data;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

module.exports = { R2Client };
