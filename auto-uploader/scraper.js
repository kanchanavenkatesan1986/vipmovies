const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { R2Client } = require('./r2Client');
const { D1Client } = require('./d1Client');
const { cleanMovieTitle, buildMetadata } = require('./metadataHelper');
const { inspectR2Folder, generateEpisodeId } = require('./r2Scanner');
const { downloadAndSavePoster } = require('./posterDownloader');

const HISTORY_FILE = path.join(__dirname, 'history.json');
const CATALOG_FILE = path.join(__dirname, 'movies_catalog_2026.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return { completedKeys: [] };
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {}
}

function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveCatalog(catalog) {
  try {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  } catch (e) {}
}

let isRunning = false;
let shouldStop = false;

function stopPipeline() {
  shouldStop = true;
}

function slugify(rawText) {
  return rawText
    .toLowerCase()
    .replace(/\(\d{4}\)/g, '')
    .replace(/\((original|dvd|hdrip|bdrip|tamil|telugu|dubbed|proper|web-series|season\s*\d+)\)/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function isContentLink(link) {
  if (!link || !link.text || !link.href) return false;
  const lower = link.text.toLowerCase();
  const lowerHref = link.href.toLowerCase();
  if (lower.includes('telegram') || lower.includes('home') || lower.includes('contact') || lower.includes('dmca') || lower.includes('disclaimer') || lower.includes('policy')) return false;
  if (lowerHref.includes('telegram') || lowerHref.includes('page=') || lowerHref.includes('get-page=')) return false;
  if (/^[a-z]$/i.test(link.text.trim()) || link.text.trim() === '0-9') return false;
  return true;
}

function normalizeBaseListingUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('get-page');
    u.searchParams.delete('page');
    let base = u.origin + u.pathname;
    if (!base.endsWith('/')) base += '/';
    return base;
  } catch {
    return rawUrl.split('?')[0];
  }
}

function buildPageUrl(baseUrl, pageNum) {
  const isMoviezda = baseUrl.includes('moviezda');
  const param = isMoviezda ? 'page' : 'get-page';
  const cleanBase = baseUrl.split('?')[0];
  const sep = cleanBase.endsWith('/') ? '' : '/';
  return `${cleanBase}${sep}?${param}=${pageNum}`;
}

async function safeGoto(page, url, timeout = 35000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await page.waitForTimeout(1500 * attempt);
    }
  }
}

/**
 * Auto-detects total pagination pages on both isaidub.green and moviezda.me
 */
async function detectTotalPages(page, targetUrl, broadcast) {
  try {
    broadcast('log', `[PAGE SCAN] Detecting total pages from: ${targetUrl}...`);
    await safeGoto(page, targetUrl, 35000, 4);

    const pageText = await page.innerText('body').catch(() => '');
    const showingMatch = pageText.match(/Showing\s+Page\s+\d+\s+of\s+(\d+)/i) || pageText.match(/page\s*\d+\s*of\s*(\d+)/i);
    if (showingMatch) {
      const detected = parseInt(showingMatch[1], 10);
      broadcast('log', `[PAGE SCAN] Detected total pages: ${detected}`);
      return detected;
    }

    const pageNums = await page.$$eval('a[href*="page="], a[href*="get-page="]', (els) =>
      els
        .map((e) => {
          const m = e.href.match(/(?:get-)?page=(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter(Boolean)
    );

    if (pageNums.length > 0) {
      return Math.max(...pageNums);
    }
  } catch (err) {
    broadcast('log', `[PAGE SCAN WARN] Error detecting pages: ${err.message}. Defaulting to 13 pages.`);
  }

  return 13;
}

/**
 * Universal 3-Hop Download Chain Resolver (Works for both isaidub.green and moviezda.me)
 */
async function resolveDirectDownloadUrl(page, filePageUrl, broadcast) {
  try {
    await safeGoto(page, filePageUrl, 25000);

    const step1 = await page.$$eval('a', (els) =>
      els.find((e) => e.innerText && e.innerText.includes('Download Server 1'))?.href
    );
    if (!step1) throw new Error('Download Server 1 link not found on file page');

    await safeGoto(page, step1, 25000);

    const step2 = await page.$$eval('a', (els) =>
      els.find((e) => e.innerText && e.innerText.includes('Download Server 1'))?.href
    );
    if (!step2) throw new Error('Download Server 1 mirror not found');

    await safeGoto(page, step2, 25000);

    const finalLink = await page.$$eval('a', (els) =>
      els.find((e) => e.innerText && e.innerText.includes('Download Server 1'))?.href
    );
    if (!finalLink) throw new Error('Final download link not found');

    return finalLink;
  } catch (err) {
    broadcast('log', `    [FAIL] Download chain error: ${err.message}`);
    return null;
  }
}

async function parseDownloadPageDetails(page) {
  try {
    const text = await page.innerText('body').catch(() => '');
    const durMatch = text.match(/Duration:\s*([\d:]+\s*(?:min|hrs|m)?)/i);
    const addedMatch = text.match(/Added On:\s*([\d/]+)/i);

    return {
      duration: durMatch ? durMatch[1].trim() : '',
      addedDate: addedMatch ? addedMatch[1].trim() : ''
    };
  } catch {
    return { duration: '', addedDate: '' };
  }
}

/**
 * Main Pipeline Supporting Both isaidub.green and moviezda.me
 */
async function startPipeline(userConfig = {}, broadcast = console.log) {
  if (isRunning) {
    broadcast('log', '[WARN] Pipeline is already running.');
    return;
  }

  isRunning = true;
  shouldStop = false;

  const history = loadHistory();
  const catalog = loadCatalog();
  const r2 = new R2Client(userConfig);
  const d1 = new D1Client();

  const {
    sourceUrl = 'https://isaidub.green/tamil-2026-dubbed-movies/',
    year = '2026',
    category = 'hollywood',
    headless = true,
    duplicatePolicy = 'skip',
    startPage = 1,
    customEndPage = null,
    autoAllPages = true,
    autoSyncD1 = true,
    idStartOffset = 1,
    urlMode = 'path' // 'path' (relative file path only) as requested by user
  } = userConfig;

  const cleanCategory = category.toLowerCase().trim();
  const cleanYear = String(year).trim();
  const baseListingUrl = normalizeBaseListingUrl(sourceUrl);
  const d1Table = `${cleanCategory}_${cleanYear}`;
  const isMoviezda = sourceUrl.includes('moviezda');

  const stats = {
    currentPage: 1,
    totalPages: 1,
    totalMoviesProcessed: 0,
    totalMoviesEstimated: 0,
    uploadedFilesCount: 0,
    skippedFilesCount: 0,
    failedFilesCount: 0,
    currentMovieTitle: '',
    activeQuality: '',
    status: 'Running'
  };

  broadcast('stats', stats);
  broadcast('log', '==================================================');
  broadcast('log', `⚡ VIP Stream & Catalog Pipeline Initialized`);
  broadcast('log', `Target: ${cleanCategory.toUpperCase()} ${cleanYear} | Source: ${isMoviezda ? 'moviezda.me (Tamil Original)' : 'isaidub.green (Hollywood Dubbed)'}`);
  broadcast('log', `URL Mode: ${urlMode.toUpperCase()} (Path only) | Table: ${d1Table}`);
  broadcast('log', '==================================================');

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: Boolean(headless),
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-infobars',
        '--ignore-certificate-errors',
        '--window-size=1366,768'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'Asia/Kolkata'
    });

    await context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
      } catch (e) {}
    });

    const page = await context.newPage();

    context.on('page', (popup) => {
      if (popup !== page) {
        setTimeout(async () => {
          try {
            if (!popup.isClosed()) await popup.close();
          } catch (e) {}
        }, 1200);
      }
    });

    // 1. Detect Total Pages
    let detectedTotalPages = isMoviezda ? 22 : 13;
    if (autoAllPages) {
      detectedTotalPages = await detectTotalPages(page, buildPageUrl(baseListingUrl, 1), broadcast);
    } else if (customEndPage && parseInt(customEndPage, 10) > 0) {
      detectedTotalPages = parseInt(customEndPage, 10);
    }

    const firstPageNum = Math.max(1, parseInt(startPage, 10) || 1);
    const lastPageNum = Math.max(firstPageNum, detectedTotalPages);

    stats.totalPages = lastPageNum;
    broadcast('stats', stats);

    // =========================================================================
    // PHASE 1: DISCOVER ALL MOVIES ACROSS ALL PAGES
    // =========================================================================
    broadcast('log', `\n[PHASE 1] Scanning Pages ${firstPageNum} to ${lastPageNum}...`);
    
    const allDiscoveredPages = [];

    for (let p = firstPageNum; p <= lastPageNum; p++) {
      if (shouldStop) break;
      const pUrl = buildPageUrl(baseListingUrl, p);
      broadcast('log', `  -> Scanning Page ${p}/${lastPageNum}: ${pUrl}`);
      await safeGoto(page, pUrl, 30000);
      await page.waitForTimeout(400);

      const rawLinks = await page.$$eval('a', (els) =>
        els.map((e) => ({
          text: e.innerText.trim(),
          href: e.href
        }))
      );

      const validItems = rawLinks.filter((l) => {
        if (!isContentLink(l)) return false;
        if (isMoviezda) {
          return l.href.includes('-tamil-movie/') || l.href.includes('-tamil-web-series/') || l.href.includes('-movie/') || l.text.includes('(2026)');
        } else {
          return l.href.includes('/movie/');
        }
      });

      const uniqueOnPage = Array.from(new Map(validItems.map((i) => [i.href, i])).values());
      allDiscoveredPages.push({ pageNum: p, items: uniqueOnPage });
    }

    const flatAllItems = [];
    allDiscoveredPages.forEach((p) => {
      p.items.forEach((item) => {
        flatAllItems.push({ ...item, pageNum: p.pageNum });
      });
    });

    const totalItems = flatAllItems.length;
    stats.totalMoviesEstimated = totalItems;
    broadcast('stats', stats);
    broadcast('log', `\n✓ Discovered total ${totalItems} titles across ${lastPageNum} pages.`);

    // ASSIGN REVERSE ORDER IDs:
    const plannedItems = flatAllItems.map((item, index) => {
      const reverseIndex = totalItems - 1 - index;
      const seqNum = idStartOffset + reverseIndex;
      const id = `${cleanCategory}-${cleanYear}-${String(seqNum).padStart(5, '0')}`;
      const folderSlug = slugify(item.text);
      const isSeries =
        item.href.includes('web-series') ||
        /season\s*\d+|s0\d+|episode/i.test(item.text);

      const cleanTitle = cleanMovieTitle(item.text);

      return {
        ...item,
        id,
        folderSlug,
        isSeries,
        cleanTitle
      };
    });

    broadcast('log', `[ID MAPPING] Reverse IDs assigned:`);
    broadcast('log', `   Oldest (Page ${lastPageNum} bottom): ${plannedItems[plannedItems.length - 1]?.id} -> "${plannedItems[plannedItems.length - 1]?.cleanTitle}"`);
    broadcast('log', `   Newest (Page 1 top):                ${plannedItems[0]?.id} -> "${plannedItems[0]?.cleanTitle}"`);

    broadcast('catalog-init', plannedItems.map(p => ({
      id: p.id,
      title: p.cleanTitle,
      type: cleanCategory,
      contentType: p.isSeries ? 'series' : 'movie',
      status: 'Queued',
      pageNum: p.pageNum
    })));

    // =========================================================================
    // PHASE 2: DIRECT R2 INSPECTION, POSTER DOWNLOAD & STREAMING
    // =========================================================================
    broadcast('log', `\n[PHASE 2] Starting Direct R2 Mapping, Poster Downloads & JIT Streams...`);

    const itemsToProcess = [...plannedItems].reverse();
    const catalogMap = new Map(catalog.map((m) => [m.id, m]));

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (shouldStop) {
        broadcast('log', '[SYSTEM] Pipeline stopped by user.');
        break;
      }

      const item = itemsToProcess[i];
      stats.totalMoviesProcessed = i + 1;
      stats.currentMovieTitle = item.cleanTitle;
      stats.currentPage = item.pageNum;
      broadcast('stats', stats);

      broadcast('log', `\n--------------------------------------------------`);
      broadcast('log', `[ITEM ${i + 1}/${itemsToProcess.length}] (${item.id}) "${item.cleanTitle}" [${item.isSeries ? 'SERIES' : 'MOVIE'}]`);

      broadcast('movie-update', { id: item.id, status: 'Checking R2' });

      const targetPrefix = `${cleanCategory}/${cleanYear}/${item.folderSlug}/`;

      // 1. Direct R2 Inspection: Check if video files already exist in user's R2 bucket
      const r2Inspection = await inspectR2Folder(r2, targetPrefix, urlMode, item.isSeries, item.folderSlug);

      let movieRecord = null;
      let posterUrl = null;

      // Navigate to movie entry page to grab poster if needed
      await safeGoto(page, item.href, 25000);
      await page.waitForTimeout(400);

      // Extract poster image on page
      posterUrl = await page.$$eval('img', (imgs) => {
        const found = imgs.find((i) => i.src && (i.src.includes('posters') || i.alt.includes('Poster') || i.src.includes('uploads')));
        return found ? found.src : null;
      }).catch(() => null);

      // Download and save poster locally
      const savedPosterName = await downloadAndSavePoster(posterUrl, cleanCategory, cleanYear, item.cleanTitle);

      if (r2Inspection && r2Inspection.count > 0) {
        broadcast('log', `  [R2 DIRECT HIT] Found ${r2Inspection.count} video file(s) in R2 under ${targetPrefix}`);
        
        const enriched = await buildMetadata({
          title: item.cleanTitle,
          year: cleanYear,
          category: cleanCategory,
          language: 'Tamil',
          isSeries: r2Inspection.isSeries,
          downloadPageInfo: { duration: r2Inspection.isSeries ? `${r2Inspection.episodes.length} Episodes` : '02:00:00 min' }
        });

        movieRecord = {
          id: item.id,
          title: item.cleanTitle, // ONLY CLEAN TITLE! NO YEAR, NO TAMIL MOVIE!
          image: savedPosterName || enriched.image,
          release: enriched.release,
          language: 'Tamil',
          year: cleanYear,
          category: enriched.category,
          duration: r2Inspection.isSeries ? `${r2Inspection.episodes.length} Episodes` : enriched.duration,
          director: enriched.director,
          starring: enriched.starring,
          story: enriched.story,
          p360: r2Inspection.sources.p360 || '',
          p720: r2Inspection.sources.p720 || '',
          p1080: r2Inspection.sources.p1080 || '',
          created_at: enriched.created_at,
          status: 'active',
          type: cleanCategory,
          contentType: r2Inspection.isSeries ? 'series' : 'movie',
          episodes: r2Inspection.episodes || []
        };

        stats.uploadedFilesCount += r2Inspection.count;
        broadcast('stats', stats);
      } else {
        // Fallback to JIT Download
        broadcast('log', `  [R2 MISS] No video files found in R2. Processing JIT transfer...`);
        broadcast('movie-update', { id: item.id, status: 'Scanning Links' });

        if (item.isSeries) {
          movieRecord = await processSeriesItem(page, r2, item, cleanYear, cleanCategory, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, broadcast);
        } else {
          movieRecord = await processMovieItem(page, r2, item, cleanYear, cleanCategory, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, broadcast);
        }
      }

      if (movieRecord) {
        catalogMap.set(movieRecord.id, movieRecord);
        saveCatalog(Array.from(catalogMap.values()));

        broadcast('movie-update', { id: item.id, status: 'Stored R2', data: movieRecord });

        if (autoSyncD1) {
          try {
            await d1.saveMovie(d1Table, movieRecord);
            broadcast('log', `  [D1 SUCCESS] ✓ Synced ${movieRecord.id} to D1!`);
            broadcast('movie-update', { id: item.id, status: 'Synced D1', data: movieRecord });
          } catch (syncErr) {
            broadcast('log', `  [D1 WARN] Sync error for ${movieRecord.id}: ${syncErr.message}`);
          }
        }
      }
    }

    broadcast('log', `\n🎉 [ALL COMPLETED] Successfully processed all items!`);
    broadcast('log', `Stored/Verified in R2: ${stats.uploadedFilesCount} | Skipped: ${stats.skippedFilesCount} | Failed: ${stats.failedFilesCount}`);
  } catch (err) {
    broadcast('log', `[FATAL] Pipeline error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
    isRunning = false;
    shouldStop = false;
    stats.status = 'Idle';
    broadcast('stats', stats);
    broadcast('status', 'Idle');
  }
}

/**
 * Process Single Movie: Qualities -> JIT Stream -> DB Record
 */
async function processMovieItem(page, r2, item, year, category, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, broadcast) {
  await r2.createFolder(targetPrefix).catch(() => {});

  let innerLinks = (await page.$$eval('a', (els) =>
    els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
  )).filter(isContentLink);

  const versionLink = innerLinks.find(
    (l) =>
      /(Original|DVD|HDRip|BDRip|Proper|Tamil)/i.test(l.text) ||
      l.href.includes('-original') ||
      l.href.includes('-movie-original')
  );

  if (versionLink) {
    await safeGoto(page, versionLink.href, 25000);
    await page.waitForTimeout(500);
    innerLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);
  }

  const qualityLinks = innerLinks.filter((l) => /(360p|720p|1080p|480p)/i.test(l.text));
  const uniqueQualities = Array.from(new Map(qualityLinks.map((q) => [q.href, q])).values());

  let downloadPageInfo = {};

  for (const q of uniqueQualities) {
    if (shouldStop) break;

    const qMatch = q.text.match(/(360p|720p|1080p|480p)/i);
    const qLabel = qMatch ? qMatch[1].toUpperCase() : 'HD';

    await safeGoto(page, q.href, 25000);
    await page.waitForTimeout(500);

    const filePageLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);

    const filePage = filePageLinks.find(
      (l) => l.href.includes('/download/') || l.text.toLowerCase().includes('.mp4') || l.text.toLowerCase().includes('hd')
    );

    if (!filePage) continue;

    await safeGoto(page, filePage.href, 25000);
    const metaDetails = await parseDownloadPageDetails(page);
    if (!downloadPageInfo.duration && metaDetails.duration) downloadPageInfo.duration = metaDetails.duration;
    if (!downloadPageInfo.addedDate && metaDetails.addedDate) downloadPageInfo.addedDate = metaDetails.addedDate;

    const directUrl = await resolveDirectDownloadUrl(page, filePage.href, broadcast);
    if (!directUrl) continue;

    const targetFilename = `${item.cleanTitle} ${qLabel}.mp4`;
    const fullKey = `${targetPrefix}${targetFilename}`;

    broadcast('log', `  [JIT UPLOAD] Streaming ${targetFilename} into R2...`);
    try {
      const uploadResult = await r2.uploadFromUrl({
        url: directUrl,
        prefix: targetPrefix,
        filename: targetFilename,
        duplicatePolicy
      });
      stats.uploadedFilesCount++;
      broadcast('stats', stats);
      broadcast('log', `  [SUCCESS] ✓ Stored in R2: ${uploadResult.key}`);
      history.completedKeys.push(fullKey);
      saveHistory(history);
    } catch (uploadErr) {
      broadcast('log', `  [UPLOAD ERROR] ${uploadErr.message}`);
    }
  }

  const r2Data = await inspectR2Folder(r2, targetPrefix, urlMode, false, item.folderSlug);

  const enriched = await buildMetadata({
    title: item.cleanTitle,
    year,
    category,
    language: 'Tamil',
    isSeries: false,
    downloadPageInfo
  });

  return {
    id: item.id,
    title: item.cleanTitle, // ONLY CLEAN TITLE! NO YEAR!
    image: savedPosterName || enriched.image,
    release: enriched.release,
    language: 'Tamil',
    year,
    category: enriched.category,
    duration: enriched.duration,
    director: enriched.director,
    starring: enriched.starring,
    story: enriched.story,
    p360: r2Data?.sources?.p360 || '',
    p720: r2Data?.sources?.p720 || '',
    p1080: r2Data?.sources?.p1080 || '',
    created_at: enriched.created_at,
    status: 'active',
    type: category,
    contentType: 'movie',
    episodes: []
  };
}

/**
 * Process Single Series: Seasons -> Episodes -> JIT Stream -> DB Record
 */
async function processSeriesItem(page, r2, item, year, category, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, broadcast) {
  await r2.createFolder(targetPrefix).catch(() => {});

  let innerLinks = (await page.$$eval('a', (els) =>
    els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
  )).filter(isContentLink);

  const seasonLinks = innerLinks.filter((l) => /season\s*\d+/i.test(l.text));
  const seasonsToProcess = seasonLinks.length > 0 ? seasonLinks : [{ text: 'Season 01', href: item.href }];

  for (const season of seasonsToProcess) {
    if (shouldStop) break;

    const seasonMatch = season.text.match(/season\s*(\d+)/i);
    const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
    const sStr = String(seasonNum).padStart(2, '0');

    await safeGoto(page, season.href, 25000);
    await page.waitForTimeout(500);

    let epListingLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);

    const qualFolder = epListingLinks.find((l) => /(720p|1080p|480p|360p)/i.test(l.text));
    if (qualFolder) {
      await safeGoto(page, qualFolder.href, 25000);
      await page.waitForTimeout(500);
      epListingLinks = (await page.$$eval('a', (els) =>
        els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
      )).filter(isContentLink);
    }

    const episodeLinks = epListingLinks.filter((l) => l.href.includes('/download/') || /epi?\s*\d+/i.test(l.text));
    const sortedEpisodes = [...episodeLinks].reverse();

    for (let epIndex = 0; epIndex < sortedEpisodes.length; epIndex++) {
      if (shouldStop) break;
      const ep = sortedEpisodes[epIndex];

      const epNumMatch = ep.text.match(/epi?\s*(\d+)/i) || ep.text.match(/\d+/);
      const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : epIndex + 1;
      const eStr = String(epNum).padStart(2, '0');

      const targetFilename = `${item.cleanTitle} S${sStr} E${eStr}.mp4`;
      const fullKey = `${targetPrefix}${targetFilename}`;

      if (history.completedKeys.includes(fullKey)) continue;

      const directUrl = await resolveDirectDownloadUrl(page, ep.href, broadcast);
      if (directUrl) {
        broadcast('log', `  [JIT UPLOAD] Streaming Ep ${epNum} to Cloudflare R2...`);
        try {
          const uploadResult = await r2.uploadFromUrl({
            url: directUrl,
            prefix: targetPrefix,
            filename: targetFilename,
            duplicatePolicy
          });
          stats.uploadedFilesCount++;
          broadcast('stats', stats);
          history.completedKeys.push(fullKey);
          saveHistory(history);
        } catch (uploadErr) {
          broadcast('log', `  [UPLOAD ERROR] ${uploadErr.message}`);
        }
      }
    }
  }

  const r2Data = await inspectR2Folder(r2, targetPrefix, urlMode, true, item.folderSlug);

  const enriched = await buildMetadata({
    title: item.cleanTitle,
    year,
    category,
    language: 'Tamil',
    isSeries: true,
    downloadPageInfo: { duration: `${r2Data?.episodes?.length || 0} Episodes` }
  });

  return {
    id: item.id,
    title: item.cleanTitle, // ONLY CLEAN TITLE! NO YEAR!
    image: savedPosterName || enriched.image,
    release: enriched.release,
    language: 'Tamil',
    year,
    category: enriched.category,
    duration: `${r2Data?.episodes?.length || 0} Episodes`,
    director: enriched.director,
    starring: enriched.starring,
    story: enriched.story,
    p360: '',
    p720: '',
    p1080: '',
    created_at: enriched.created_at,
    status: 'active',
    type: category,
    contentType: 'series',
    episodes: r2Data?.episodes || []
  };
}

module.exports = { startPipeline, stopPipeline };
