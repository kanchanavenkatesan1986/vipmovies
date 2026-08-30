/**
 * Upload Utility Helpers
 * Formatting, path generation, sanitization, and speed/ETA calculation
 */

import { DEFAULT_UPLOAD_CONFIG } from './uploadConfig';

/**
 * Sanitize movie folder name:
 * Allows only lowercase alphanumeric, dash (-), and underscore (_)
 */
export function sanitizeMovieFolder(name) {
  if (!name || typeof name !== 'string') return 'movie';
  let cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, '') // remove forbidden symbols
    .replace(/\s+/g, '-')           // spaces to dashes
    .replace(/-+/g, '-')            // collapse duplicate dashes
    .replace(/^[-_]+|[-_]+$/g, ''); // trim leading/trailing dashes

  return cleaned || 'movie';
}

/**
 * Auto-generate sanitized folder name from filename (e.g., "Leo (2026) 1080p.mp4" -> "leo-2026-1080p")
 */
export function autoGenerateMovieFolder(filename) {
  if (!filename) return 'movie';
  const lastDot = filename.lastIndexOf('.');
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return sanitizeMovieFolder(base);
}

/**
 * Clean and validate filename
 */
export function sanitizeFilename(filename) {
  if (!filename) return '';
  return filename.replace(/[\/\\]/g, '_').trim();
}

/**
 * Check if file has a valid allowed movie extension
 */
export function isAllowedExtension(filename, allowedExtensions = DEFAULT_UPLOAD_CONFIG.allowedExtensions) {
  if (!filename) return false;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = filename.slice(lastDot).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Build destination R2 object key
 */
export function buildDestinationKey(category, year, movieFolder, filename) {
  const cat = String(category || 'tamil').toLowerCase().trim();
  const yr = String(year || '2026').trim();
  const folder = sanitizeMovieFolder(movieFolder);
  const file = sanitizeFilename(filename);
  return `${cat}/${yr}/${folder}/${file}`;
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format speed (bytes/sec)
 */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 MB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format duration in seconds to HH:MM:SS or string format
 */
export function formatETA(seconds) {
  if (isNaN(seconds) || seconds === Infinity || seconds <= 0) {
    return 'Calculating...';
  }
  const s = Math.round(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Rolling average speed tracker for stable speed display
 */
export class SpeedTracker {
  constructor(windowSize = 8) {
    this.windowSize = windowSize;
    this.samples = []; // array of { time: number, bytes: number }
  }

  record(bytesUploaded) {
    const now = Date.now();
    this.samples.push({ time: now, bytes: bytesUploaded });
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  getSpeed() {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const timeDiff = (last.time - first.time) / 1000; // in seconds
    const bytesDiff = last.bytes - first.bytes;

    if (timeDiff <= 0 || bytesDiff <= 0) return 0;
    return bytesDiff / timeDiff; // bytes per second
  }

  reset() {
    this.samples = [];
  }
}

/**
 * Generate a fingerprint for a File object to verify identity upon resume after reload
 */
export function generateFileFingerprint(file) {
  if (!file) return '';
  return `${file.name}_${file.size}_${file.lastModified}`;
}
