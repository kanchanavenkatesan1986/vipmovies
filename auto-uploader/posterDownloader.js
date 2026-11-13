const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

/**
 * Downloads main movie/series poster and saves locally to:
 * 1. public/src/images/{category}/{year}/{safeFilename} (Vite frontend serving)
 * 2. auto-uploader/posters/{category}/{year}/{safeFilename} (Dashboard serving)
 * 3. {category}/{year}/{safeFilename} (Workspace root backup)
 */
async function downloadAndSavePoster(posterUrl, category, year, cleanTitle, sourceOrigin = '') {
  const safeFilename = `${cleanTitle.replace(/[\\/:*?"<>|]/g, '')}.jpg`;

  const cat = (category || 'tamil').toLowerCase().trim();
  const yr = String(year || '2026').trim();

  const publicDir = path.join(WORKSPACE_ROOT, 'public', 'src', 'images', cat, yr);
  const uploaderDir = path.join(__dirname, 'posters', cat, yr);
  const rootDir = path.join(WORKSPACE_ROOT, cat, yr);

  [publicDir, uploaderDir, rootDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    }
  });

  const filePublic = path.join(publicDir, safeFilename);
  const fileUploader = path.join(uploaderDir, safeFilename);
  const fileRoot = path.join(rootDir, safeFilename);

  // If already exists with valid size, ensure mirrored across all locations
  if (fs.existsSync(filePublic) && fs.statSync(filePublic).size > 1000) {
    try {
      if (!fs.existsSync(fileUploader)) fs.copyFileSync(filePublic, fileUploader);
      if (!fs.existsSync(fileRoot)) fs.copyFileSync(filePublic, fileRoot);
    } catch {}
    return safeFilename;
  }

  if (fs.existsSync(fileUploader) && fs.statSync(fileUploader).size > 1000) {
    try {
      if (!fs.existsSync(filePublic)) fs.copyFileSync(fileUploader, filePublic);
      if (!fs.existsSync(fileRoot)) fs.copyFileSync(fileUploader, fileRoot);
    } catch {}
    return safeFilename;
  }

  if (!posterUrl) return safeFilename;

  // Resolve relative URLs
  let resolvedUrl = posterUrl.trim();
  if (resolvedUrl.startsWith('//')) {
    resolvedUrl = `https:${resolvedUrl}`;
  } else if (resolvedUrl.startsWith('/')) {
    const base = sourceOrigin || (cat.includes('hollywood') ? 'https://isaidub.green' : 'https://moviezda.co');
    resolvedUrl = `${base.replace(/\/+$/, '')}${resolvedUrl}`;
  }

  if (!resolvedUrl.startsWith('http')) return safeFilename;

  let origin = 'https://moviezda.co';
  try {
    const u = new URL(resolvedUrl);
    origin = u.origin;
  } catch {}

  try {
    const res = await fetch(resolvedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${origin}/`,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[POSTER FETCH FAIL] HTTP ${res.status} for ${resolvedUrl}`);
      return safeFilename;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 500) {
      try { fs.writeFileSync(filePublic, buffer); } catch {}
      try { fs.writeFileSync(fileUploader, buffer); } catch {}
      try { fs.writeFileSync(fileRoot, buffer); } catch {}
      console.log(`[POSTER SAVED] ${cat}/${yr}/${safeFilename} (${buffer.length} bytes)`);
    }

    return safeFilename;
  } catch (err) {
    console.warn(`[POSTER WARN] Failed to save poster for ${cleanTitle}:`, err.message);
    return safeFilename;
  }
}

/**
 * Downloads series episode shot / poster and saves locally:
 * 1. public/src/images/{category}/{year}/{folderSlug}/{epNum}.jpg
 * 2. auto-uploader/posters/{category}/{year}/{folderSlug}/{epNum}.jpg
 * 3. {category}/{year}/{folderSlug}/{epNum}.jpg
 * 
 * Returns relative path: "{folderSlug}/{epNum}.jpg"
 */
async function downloadAndSaveEpisodePoster(shotUrl, category, year, folderSlug, epNum, sourceOrigin = '') {
  const safeFilename = `${epNum}.jpg`;
  const relativePath = `${folderSlug}/${safeFilename}`;

  const cat = (category || 'tamil').toLowerCase().trim();
  const yr = String(year || '2026').trim();

  const publicDir = path.join(WORKSPACE_ROOT, 'public', 'src', 'images', cat, yr, folderSlug);
  const uploaderDir = path.join(__dirname, 'posters', cat, yr, folderSlug);
  const rootDir = path.join(WORKSPACE_ROOT, cat, yr, folderSlug);

  [publicDir, uploaderDir, rootDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    }
  });

  const filePublic = path.join(publicDir, safeFilename);
  const fileUploader = path.join(uploaderDir, safeFilename);
  const fileRoot = path.join(rootDir, safeFilename);

  if (fs.existsSync(filePublic) && fs.statSync(filePublic).size > 1000) {
    try {
      if (!fs.existsSync(fileUploader)) fs.copyFileSync(filePublic, fileUploader);
      if (!fs.existsSync(fileRoot)) fs.copyFileSync(filePublic, fileRoot);
    } catch {}
    return relativePath;
  }

  if (fs.existsSync(fileUploader) && fs.statSync(fileUploader).size > 1000) {
    try {
      if (!fs.existsSync(filePublic)) fs.copyFileSync(fileUploader, filePublic);
      if (!fs.existsSync(fileRoot)) fs.copyFileSync(fileUploader, fileRoot);
    } catch {}
    return relativePath;
  }

  if (!shotUrl) return relativePath;

  // Resolve relative URLs
  let resolvedUrl = shotUrl.trim();
  if (resolvedUrl.startsWith('//')) {
    resolvedUrl = `https:${resolvedUrl}`;
  } else if (resolvedUrl.startsWith('/')) {
    const base = sourceOrigin || (cat.includes('hollywood') ? 'https://isaidub.green' : 'https://moviezda.co');
    resolvedUrl = `${base.replace(/\/+$/, '')}${resolvedUrl}`;
  }

  if (!resolvedUrl.startsWith('http')) return relativePath;

  let origin = 'https://moviezda.co';
  try {
    const u = new URL(resolvedUrl);
    origin = u.origin;
  } catch {}

  try {
    const res = await fetch(resolvedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': `${origin}/`,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      return relativePath;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 500) {
      try { fs.writeFileSync(filePublic, buffer); } catch {}
      try { fs.writeFileSync(fileUploader, buffer); } catch {}
      try { fs.writeFileSync(fileRoot, buffer); } catch {}
      console.log(`[EPISODE POSTER SAVED] ${cat}/${yr}/${relativePath} (${buffer.length} bytes)`);
    }

    return relativePath;
  } catch (err) {
    console.warn(`[EPISODE POSTER WARN] Failed to save shot for ${relativePath}:`, err.message);
    return relativePath;
  }
}

module.exports = { downloadAndSavePoster, downloadAndSaveEpisodePoster };
