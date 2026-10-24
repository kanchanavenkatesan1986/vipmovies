/**
 * Media Metadata Utility for VIP Movies
 * Probes exact video size (via HEAD / Range request Content-Length)
 * and exact video duration (via browser HTML5 video metadata probing)
 * with multi-tier caching (memory + sessionStorage).
 */

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
 * Convert any media streaming URL to a forced direct download URL
 * Automatically appends ?download=1 for Cloudflare R2 workers
 * which triggers Content-Disposition: attachment; filename="..."
 */
export function getDownloadUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('http')) return rawUrl || '#';
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('download', '1');
    return url.toString();
  } catch {
    return rawUrl.includes('?') ? `${rawUrl}&download=1` : `${rawUrl}?download=1`;
  }
}

/**
 * Fetch exact video file size using HTTP HEAD / Range request
 * Works directly with Cloudflare R2 CDN Worker which sends Access-Control-Allow-Origin: *
 * and Content-Length / Accept-Ranges.
 */
export async function fetchExactVideoSize(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return '';

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
 */
export function probeVideoDuration(url, fallbackDuration = '') {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
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
