/**
 * Media Metadata & URL Resolution Utility for VIP Movies
 * Supports BOTH relative file paths (e.g. "hollywood/2026/run-away/file.mp4")
 * and full CDN URLs (e.g. "https://api-download.akatsuki-pvt-ltd.workers.dev/...").
 *
 * Probes exact video size (via HEAD / Range request Content-Length)
 * and exact video duration (via browser HTML5 video metadata probing)
 * with multi-tier caching (memory + sessionStorage).
 */

export const DEFAULT_MEDIA_BASE_URL = 'https://api-download.akatsuki-pvt-ltd.workers.dev';

/**
 * Get current configured Media Base URL (from localStorage or environment fallback)
 */
export function getMediaBaseUrl() {
  try {
    const local = localStorage.getItem('vip_upload_settings');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.mediaBaseUrl && typeof parsed.mediaBaseUrl === 'string' && parsed.mediaBaseUrl.trim()) {
        let base = parsed.mediaBaseUrl.trim();
        // Remove trailing slashes
        return base.replace(/\/+$/, '');
      }
    }
  } catch {}

  const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MEDIA_BASE_URL)
    ? import.meta.env.VITE_MEDIA_BASE_URL
    : DEFAULT_MEDIA_BASE_URL;

  return (envBase || DEFAULT_MEDIA_BASE_URL).replace(/\/+$/, '');
}

/**
 * Persist an updated Media Base URL to localStorage
 */
export function setMediaBaseUrl(newBaseUrl) {
  try {
    const local = localStorage.getItem('vip_upload_settings');
    const parsed = local ? JSON.parse(local) : {};
    const clean = (newBaseUrl || DEFAULT_MEDIA_BASE_URL).trim().replace(/\/+$/, '');
    parsed.mediaBaseUrl = clean;
    localStorage.setItem('vip_upload_settings', JSON.stringify(parsed));
    return clean;
  } catch {
    return DEFAULT_MEDIA_BASE_URL;
  }
}

/**
 * Resolve any raw video or media string into a playable/downloadable full URL.
 * Handles BOTH:
 * 1. Relative storage paths: e.g. "hollywood/2026/slug/file.mp4" -> "https://api-download.../hollywood/2026/slug/file.mp4"
 * 2. Absolute URLs: e.g. "https://api-download..." or "https://..." -> kept intact
 */
export function resolveMediaUrl(rawPathOrUrl) {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== 'string') return '';
  const trimmed = rawPathOrUrl.trim();
  if (trimmed === '' || trimmed === '#' || trimmed === 'null' || trimmed === 'undefined') return '';

  // Already a complete absolute URL (HTTP/HTTPS) or data/blob URI
  if (/^(?:https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  // Relative storage path: prefix with current Media Base URL
  const base = getMediaBaseUrl();
  const cleanPath = trimmed.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}

// In-memory cache to prevent redundant network requests across component re-renders
const memoryCache = new Map();

/**
 * Format bytes into readable MB / GB
 */
export function formatBytes(bytes) {
  const num = Number(bytes);
  if (!num || isNaN(num) || num <= 0) return '';
  const mb = num / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Format seconds into readable duration string (e.g. 45m or 1h 12m)
 */
export function formatDurationSeconds(totalSeconds) {
  const sec = Math.round(Number(totalSeconds) || 0);
  if (sec <= 0) return '';

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Parse file size directly embedded in URL or filename (fallback)
 */
export function parseSizeFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const regex = /(?:__|_|\(|\b)(\d+(?:\.\d+)?)\s*[_]?(GB|MB|KB)(?:__|_|\)|\b)/i;
  const match = rawUrl.match(regex);
  if (match) {
    return `${match[1]} ${match[2].toUpperCase()}`;
  }
  return '';
}

/**
 * Convert any media streaming URL or relative path to a forced direct download URL
 * Automatically resolves relative paths and appends ?download=1 for Cloudflare R2 workers
 * which triggers Content-Disposition: attachment; filename="..."
 */
export function getDownloadUrl(rawPathOrUrl) {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== 'string') return '#';
  const resolved = resolveMediaUrl(rawPathOrUrl);
  if (!resolved || !resolved.startsWith('http')) return resolved || '#';
  try {
    const url = new URL(resolved);
    url.searchParams.set('download', '1');
    return url.toString();
  } catch {
    return resolved.includes('?') ? `${resolved}&download=1` : `${resolved}?download=1`;
  }
}

/**
 * Fetch exact video file size using HTTP HEAD / Range request
 * Works directly with Cloudflare R2 CDN Worker which sends Access-Control-Allow-Origin: *
 * and Content-Length / Accept-Ranges.
 * Accepts either relative path or full URL.
 */
export async function fetchExactVideoSize(rawPathOrUrl) {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== 'string') return '';
  const url = resolveMediaUrl(rawPathOrUrl);
  if (!url || !url.startsWith('http')) return '';

  // 1. Check memory cache
  const cached = memoryCache.get(url);
  if (cached?.size) return cached.size;

  // 2. Check sessionStorage
  try {
    const sessionVal = sessionStorage.getItem(`vip_size_${url}`);
    if (sessionVal) {
      if (!cached) memoryCache.set(url, { size: sessionVal });
      else cached.size = sessionVal;
      return sessionVal;
    }
  } catch {}

  // 3. Perform HEAD request
  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'cors' });
    const cl = res.headers.get('content-length');
    if (cl && parseInt(cl, 10) > 0) {
      const formatted = formatBytes(cl);
      if (formatted) {
        memoryCache.set(url, { ...(memoryCache.get(url) || {}), size: formatted });
        try { sessionStorage.setItem(`vip_size_${url}`, formatted); } catch {}
        return formatted;
      }
    }
  } catch (err) {
    // HEAD failed, fallback to Range request
  }

  // 4. Try Range: bytes=0-0 (useful if HEAD is blocked by certain CDNs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      mode: 'cors'
    });
    const cr = res.headers.get('content-range'); // e.g. "bytes 0-0/444850707"
    if (cr) {
      const match = cr.match(/\/(\d+)/);
      if (match && match[1]) {
        const formatted = formatBytes(match[1]);
        if (formatted) {
          memoryCache.set(url, { ...(memoryCache.get(url) || {}), size: formatted });
          try { sessionStorage.setItem(`vip_size_${url}`, formatted); } catch {}
          return formatted;
        }
      }
    }
  } catch {}

  // 5. Fallback to URL regex pattern
  const fallback = parseSizeFromUrl(url);
  return fallback;
}

/**
 * Probe exact video duration using browser HTML5 video metadata
 * Preloads moov atom only without downloading the entire video.
 * Accepts either relative path or full URL.
 */
export function probeVideoDuration(rawPathOrUrl, fallbackDuration = '') {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== 'string') {
    return Promise.resolve(fallbackDuration || '');
  }
  const url = resolveMediaUrl(rawPathOrUrl);
  if (!url || !url.startsWith('http')) {
    return Promise.resolve(fallbackDuration || '');
  }

  // Check cache
  const cached = memoryCache.get(url);
  if (cached?.duration) return Promise.resolve(cached.duration);

  try {
    const sessionVal = sessionStorage.getItem(`vip_dur_${url}`);
    if (sessionVal) {
      if (!cached) memoryCache.set(url, { duration: sessionVal });
      else cached.duration = sessionVal;
      return Promise.resolve(sessionVal);
    }
  } catch {}

  return new Promise((resolve) => {
    let resolved = false;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    const cleanUp = () => {
      video.removeAttribute('src');
      video.load();
      video.onloadedmetadata = null;
      video.onerror = null;
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanUp();
        resolve(fallbackDuration || '');
      }
    }, 4500);

    video.onloadedmetadata = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const durationSec = video.duration;
        let formatted = formatDurationSeconds(durationSec);
        if (!formatted && fallbackDuration) formatted = fallbackDuration;

        cleanUp();

        if (formatted) {
          memoryCache.set(url, { ...(memoryCache.get(url) || {}), duration: formatted });
          try { sessionStorage.setItem(`vip_dur_${url}`, formatted); } catch {}
        }
        resolve(formatted || fallbackDuration || '');
      }
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        cleanUp();
        resolve(fallbackDuration || '');
      }
    };

    try {
      video.src = url;
    } catch {
      resolve(fallbackDuration || '');
    }
  });
}
