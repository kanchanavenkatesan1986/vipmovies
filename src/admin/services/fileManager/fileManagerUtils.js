/**
 * File Manager Utilities & Path Helpers
 */

export function parseBreadcrumbs(prefix = '') {
  const crumbs = [{ label: 'R2', path: '' }];
  if (!prefix) return crumbs;

  const clean = prefix.replace(/\/+$/, '');
  const segments = clean.split('/').filter(Boolean);

  let current = '';
  for (const seg of segments) {
    current += `${seg}/`;
    crumbs.push({
      label: seg,
      path: current
    });
  }

  return crumbs;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export function getFileCategory(key = '') {
  const extMatch = key.match(/\.[0-9a-z]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : '';

  if (['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi', '.ts'].includes(ext)) {
    return 'video';
  }
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
    return 'image';
  }
  if (['.srt', '.vtt', '.txt'].includes(ext)) {
    return 'subtitle';
  }
  if (['.json', '.xml'].includes(ext)) {
    return 'data';
  }
  return 'other';
}

export function getFileIcon(type, filename = '') {
  if (type === 'folder') {
    return 'fa-folder';
  }
  const cat = getFileCategory(filename);
  switch (cat) {
    case 'video':
      return 'fa-film';
    case 'image':
      return 'fa-image';
    case 'subtitle':
      return 'fa-closed-captioning';
    case 'data':
      return 'fa-file-code';
    default:
      return 'fa-file';
  }
}

export function sanitizePath(input) {
  if (!input) return '';
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/\/+/g, '/');
}

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
 * Clean and validate filename
 */
export function sanitizeFilename(filename) {
  if (!filename) return '';
  return filename.replace(/[\/\\]/g, '_').trim();
}

// Script and dynamic extensions that should NEVER be stored as media in R2
export const SCRIPT_EXTENSIONS = new Set([
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.ashx', '.asmx',
  '.jsp', '.jspx', '.do', '.action',
  '.cgi', '.pl', '.py', '.sh', '.bash',
  '.html', '.htm', '.cfm'
]);

export function isScriptExtension(filename) {
  if (!filename || typeof filename !== 'string') return false;
  const match = filename.match(/\.[a-zA-Z0-9]+$/i);
  if (!match) return false;
  return SCRIPT_EXTENSIONS.has(match[0].toLowerCase());
}

/**
 * Advanced filename extractor: inspects query parameters and base64 payloads (e.g. ?dl=... on uptodub/isaidub)
 * to uncover the true media file name and format (.mp4, .mkv, etc.).
 */
export function extractFilenameFromUrlAdvanced(urlStr) {
  if (!urlStr || !urlStr.trim()) return '';
  try {
    const u = new URL(urlStr.trim());

    // 1. Check known query parameters (e.g. ?file=..., ?path=..., ?filename=...)
    const paramKeys = ['filename', 'file', 'name', 'path', 'title', 'f', 'download', 'target', 'source'];
    for (const key of paramKeys) {
      const val = u.searchParams.get(key);
      if (val) {
        const decoded = decodeURIComponent(val).split('/').pop() || '';
        const clean = decoded.split('?')[0].trim();
        if (clean && /\.[a-zA-Z0-9]{2,5}$/.test(clean) && !isScriptExtension(clean)) {
          return clean;
        }
      }
    }

    // 2. Check base64 encoded parameters (e.g. ?dl=c2VydmVy... on dub/uptodub/isai sites)
    for (const [, val] of u.searchParams.entries()) {
      if (val && val.length > 16 && /^[A-Za-z0-9+/=_-]+$/.test(val)) {
        try {
          let b64 = val.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4 !== 0) b64 += '=';
          const decodedText = atob(b64);

          // Match path=... or filename=... or file=...
          const paramMatch = decodedText.match(/(?:path|filename|file|name)=([^&]+)/i);
          if (paramMatch) {
            const candidate = decodeURIComponent(paramMatch[1]).split('/').pop() || '';
            if (candidate && /\.[a-zA-Z0-9]{2,5}$/.test(candidate) && !isScriptExtension(candidate)) {
              return candidate;
            }
          }

          // Match any file with valid media/archive extension inside the payload
          const mediaMatch = decodedText.match(/([a-zA-Z0-9_\-\. ()\[\]]+\.(?:mp4|mkv|webm|mov|m4v|avi|ts|flv|wmv|3gp|mp3|m4a|aac|flac|wav|ogg|opus|zip|rar|7z|tar|gz|pdf))/i);
          if (mediaMatch) {
            return mediaMatch[1].trim();
          }
        } catch {
          // ignore base64 errors
        }
      }
    }

    // 3. Fallback to URL pathname
    const raw = decodeURIComponent(u.pathname.split('/').pop() || '');
    let clean = raw.split('?')[0].trim();

    // If pathname ends with a script extension (.php, .aspx, etc.), convert to clean movie name
    if (isScriptExtension(clean) || clean.toLowerCase() === 'download.php') {
      const base = clean.replace(/\.[a-zA-Z0-9]+$/i, '');
      const safeBase = (!base || base.toLowerCase() === 'download') ? 'download_movie' : base;
      return `${safeBase}.mp4`;
    }

    if (!clean || clean === 'http:' || clean === 'https:' || clean.includes('://')) {
      return '';
    }
    return clean;
  } catch {
    const raw = urlStr.trim().split('?')[0].split('/').pop() || '';
    if (!raw || raw === 'http:' || raw === 'https:' || isScriptExtension(raw)) {
      return '';
    }
    return raw;
  }
}


