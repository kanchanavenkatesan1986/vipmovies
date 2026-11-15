const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

/**
 * Resolves official high-resolution vertical movie/series poster:
 * 1. OMDB API (IMDb official vertical artwork)
 * 2. OMDB without year constraint (for series / franchise matches)
 * 3. DuckDuckGo Image Search (aspect-filtered vertical images)
 */
async function resolveVerticalPosterUrl(cleanTitle, year = '2026') {
  if (!cleanTitle) return null;
  const clean = cleanTitle.replace(/\b(2026|2025)\b/gi, '').trim();

  // Tier 1: OMDB API with year
  try {
    const url1 = `http://www.omdbapi.com/?t=${encodeURIComponent(clean)}&y=${year}&apikey=trilogy`;
    const res1 = await fetch(url1);
    if (res1.ok) {
      const d1 = await res1.json();
      if (d1.Response === 'True' && d1.Poster && d1.Poster !== 'N/A') {
        return d1.Poster.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX1000_.jpg');
      }
    }
  } catch {}

  // Tier 2: OMDB API without year constraint
  try {
    const url2 = `http://www.omdbapi.com/?t=${encodeURIComponent(clean)}&apikey=trilogy`;
    const res2 = await fetch(url2);
    if (res2.ok) {
      const d2 = await res2.json();
      if (d2.Response === 'True' && d2.Poster && d2.Poster !== 'N/A') {
        return d2.Poster.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX1000_.jpg');
      }
    }
  } catch {}

  // Tier 3: DuckDuckGo vertical image search
  try {
    const mainUrl = `https://duckduckgo.com/?q=${encodeURIComponent(clean + ' ' + year + ' movie poster')}&t=h_&iar=images&iax=images&ia=images`;
    const resDDG = await fetch(mainUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    const html = await resDDG.text();
    const vqdMatch = html.match(/vqd=([a-zA-Z0-9_\-]+)/);
    if (vqdMatch) {
      const apiUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(clean + ' ' + year + ' movie poster')}&vqd=${vqdMatch[1]}&f=,,,&p=1`;
      const resApi = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://duckduckgo.com/'
        }
      });
      if (resApi.ok) {
        const data = await resApi.json();
        const vertical = (data.results || []).find(r => r.image && r.height > r.width * 1.15 && r.height >= 400);
        if (vertical) return vertical.image;
      }
    }
  } catch {}

  return null;
}

/**
 * Downloads main movie/series poster and saves locally to:
 * 1. public/src/images/{category}/{year}/{safeFilename} (Vite frontend serving)
 * 2. auto-uploader/posters/{category}/{year}/{safeFilename} (Dashboard serving)
 * 3. {category}/{year}/{safeFilename} (Workspace root backup)
 */
async function downloadAndSavePoster(posterUrl, category, year, cleanTitle, sourceOrigin = '', forceReplace = false) {
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

  // If already exists with valid size and not forceReplace, ensure mirrored across all locations
  if (!forceReplace) {
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
  }

  // If no poster provided or source site provided only a horizontal video screenshot (/uploads/shots/):
  // Resolve official vertical movie/series poster automatically
  let resolvedUrl = (posterUrl || '').trim();
  if (!resolvedUrl || resolvedUrl.includes('/uploads/shots/')) {
    const verticalUrl = await resolveVerticalPosterUrl(cleanTitle, yr);
    if (verticalUrl) {
      resolvedUrl = verticalUrl;
    }
  }

  if (!resolvedUrl) return safeFilename;

  // Resolve relative URLs
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

module.exports = { downloadAndSavePoster, downloadAndSaveEpisodePoster, resolveVerticalPosterUrl };
