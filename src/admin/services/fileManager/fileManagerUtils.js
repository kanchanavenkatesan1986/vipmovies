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
