const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { R2Client } = require('./r2Client');
const { D1Client } = require('./d1Client');
const { cleanMovieTitle, isValidMovieTitle, buildMetadata } = require('./metadataHelper');
const { inspectR2Folder, generateEpisodeId } = require('./r2Scanner');
const { downloadAndSavePoster, downloadAndSaveEpisodePoster } = require('./posterDownloader');

const HISTORY_FILE = path.join(__dirname, 'history.json');
const CATALOG_FILE = path.join(__dirname, 'movies_catalog_2026.json');
const CATALOGS_DIR = path.join(__dirname, 'catalogs');

if (!fs.existsSync(CATALOGS_DIR)) {
  try { fs.mkdirSync(CATALOGS_DIR, { recursive: true }); } catch {}
}

function getCatalogFile(category = 'tamil', year = '2026') {
  const cleanCat = (category || 'tamil').toLowerCase().trim();
  const cleanYr = String(year || '2026').trim();
  return path.join(CATALOGS_DIR, `${cleanCat}_${cleanYr}.json`);
}

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

function loadCatalog(category = 'tamil', year = '2026') {
  try {
    const file = getCatalogFile(category, year);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    // Fallback to legacy file filtered by category
    if (fs.existsSync(CATALOG_FILE)) {
      const full = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
      const cat = (category || 'tamil').toLowerCase().trim();
      return full.filter(i => (i.type === cat || i.id.startsWith(cat)) && isValidMovieTitle(i.title));
    }
  } catch (e) {}
  return [];
}

function saveCatalog(catalog, category = 'tamil', year = '2026') {
  try {
    const file = getCatalogFile(category, year);
    fs.writeFileSync(file, JSON.stringify(catalog, null, 2), 'utf8');
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
  const lower = link.text.toLowerCase().trim();
  const lowerHref = link.href.toLowerCase().trim();

  // Exclude unwanted navigation & legal pages
  if (lower.includes('telegram') || lower.includes('home') || lower.includes('contact') || 
      lower.includes('dmca') || lower.includes('disclaimer') || lower.includes('policy') ||
      lower.includes('moviesda home') || lower.includes('isaimini')) return false;

  if (lowerHref.includes('telegram') || lowerHref.includes('page=') || lowerHref.includes('get-page=') ||
      lowerHref.includes('/tamil-movies/') || lowerHref.endsWith('/#') || lowerHref === '#') return false;

  // Exclude single numbers, pagination, symbols, single/double letters
  if (/^\d+$/.test(lower)) return false; // purely numeric e.g. "1", "45", "418"
  if (/^[a-z]{1,2}$/i.test(lower)) return false; // "A", "B", "TN", "DC"
  if (lower === '0-9' || lower === '»' || lower === '«') return false;
  if (/^[()\[\]\s\-+]+$/.test(lower)) return false; // purely brackets or symbols e.g. "()"
  if (lower.length < 2) return false;

  // Filter out non-content navigation text containing predominantly Tamil script
  if (/[\u0B80-\u0BFF]{3,}/.test(link.text)) return false;
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

async function safeGoto(page, url, timeout = 25000, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

/**
 * Auto-detects total pagination pages on both isaidub.green and moviezda.co
 */
async function detectTotalPages(page, targetUrl, broadcast) {
  const isMoviezda = targetUrl.includes('moviezda');
  try {
    broadcast('log', `[PAGE SCAN] Detecting total pages from: ${targetUrl}...`);
    await safeGoto(page, targetUrl, 30000, 3);

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
      const detected = Math.max(...pageNums);
      broadcast('log', `[PAGE SCAN] Detected total pages from links: ${detected}`);
      return detected;
    }
  } catch (err) {
    broadcast('log', `[PAGE SCAN WARN] Error detecting pages: ${err.message}. Defaulting to ${isMoviezda ? 23 : 13} pages.`);
  }

  return isMoviezda ? 23 : 13;
}

/**
 * Universal Pagination URL Discoverer (Works for both moviezda.co and isaidub.green)
 * Finds all sub-pages e.g. ?page=1, ?page=2, ?page=3, ?page=4 or ?get-page=1, ?get-page=2...
 */
async function discoverPaginationUrls(page, baseUrl, broadcast = console.log) {
  const isMoviezda = baseUrl.includes('moviezda');
  const param = isMoviezda ? 'page' : 'get-page';
  
  let cleanBase = baseUrl.split('?')[0];
  if (!cleanBase.endsWith('/')) cleanBase += '/';

  let totalPages = 1;

  try {
    const bodyText = await page.innerText('body').catch(() => '');
    const showingMatch = bodyText.match(/Showing\s+Page\s+\d+\s+of\s+(\d+)/i) || 
                         bodyText.match(/Page\s+\d+\s+of\s+(\d+)/i) ||
                         bodyText.match(/page\s*\d+\s*of\s*(\d+)/i);
    if (showingMatch) {
      totalPages = parseInt(showingMatch[1], 10);
    }
  } catch {}

  try {
    const pageNums = await page.$$eval('a[href*="page="], a[href*="get-page="]', (els) =>
      els.map((e) => {
        const m = e.href.match(/(?:get-)?page=(\d+)/);
        return m ? parseInt(m[1], 10) : null;
      }).filter(Boolean)
    ).catch(() => []);

    if (pageNums.length > 0) {
      const maxPage = Math.max(...pageNums);
      if (maxPage > totalPages) {
        totalPages = maxPage;
      }
    }
  } catch {}

  const urls = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1) {
      urls.push(cleanBase);
    } else {
      urls.push(`${cleanBase}?${param}=${p}`);
    }
  }

  return { totalPages, urls };
}

/**
 * Universal 3-Hop Download Chain Resolver (Works for both isaidub.green and moviezda.co)
 */
async function resolveDirectDownloadUrl(page, filePageUrl, broadcast) {
  try {
    await safeGoto(page, filePageUrl, 20000);

    const step1 = await page.$$eval('a', (els) =>
      els.find((e) => e.innerText && e.innerText.includes('Download Server 1'))?.href
    );
    if (!step1) throw new Error('Download Server 1 link not found on file page');

    await safeGoto(page, step1, 20000);

    const step2 = await page.$$eval('a', (els) =>
      els.find((e) => e.innerText && e.innerText.includes('Download Server 1'))?.href
    );
    if (!step2) throw new Error('Download Server 1 mirror not found');

    await safeGoto(page, step2, 20000);

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
 * Main Pipeline Supporting Both isaidub.green and moviezda.co
 */
async function startPipeline(userConfig = {}, broadcast = console.log) {
  if (isRunning) {
    broadcast('log', '[WARN] Pipeline is already running.');
    return;
  }

  isRunning = true;
  shouldStop = false;

  const history = loadHistory();
  const r2 = new R2Client(userConfig);
  const d1 = new D1Client();

  const {
    sourceUrl = 'https://moviezda.co/tamil-2026-movies/',
    year = '2026',
    category = 'tamil',
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
  const catalog = loadCatalog(cleanCategory, cleanYear);

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
  broadcast('log', `Target: ${cleanCategory.toUpperCase()} ${cleanYear} | Source: ${isMoviezda ? 'moviezda.co (Tamil Original)' : 'isaidub.green (Hollywood Dubbed)'}`);
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
        }, 800);
      }
    });

    // 1. Detect Total Pages
    let detectedTotalPages = isMoviezda ? 23 : 13;
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
      await safeGoto(page, pUrl, 25000);
      await page.waitForTimeout(200);

      const rawLinks = await page.$$eval('a', (els) =>
        els.map((e) => ({
          text: e.innerText.trim(),
          href: e.href
        }))
      );

      const validItems = rawLinks.filter((l) => {
        if (!isContentLink(l)) return false;
        if (isMoviezda) {
          const isMovieUrl = /-tamil-movie\/?$/i.test(l.href) || 
                             /-tamil-web-series\/?$/i.test(l.href) || 
                             /-movie\/?$/i.test(l.href) ||
                             /-web-series\/?$/i.test(l.href);
          return isMovieUrl;
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

    // Filter and sanitize items to ONLY include genuine movies/series with non-junk titles
    const sanitizedItems = flatAllItems
      .map((item) => {
        const cleanTitle = cleanMovieTitle(item.text);
        if (!isValidMovieTitle(cleanTitle)) return null;

        const folderSlug = slugify(cleanTitle);
        const isSeries =
          item.href.includes('web-series') ||
          /season\s*\d+|s0\d+|episode/i.test(item.text);

        return {
          ...item,
          folderSlug,
          isSeries,
          cleanTitle
        };
      })
      .filter(Boolean);

    const totalItems = sanitizedItems.length;
    stats.totalMoviesEstimated = totalItems;
    broadcast('stats', stats);
    broadcast('log', `\n✓ Discovered total ${totalItems} genuine titles across ${lastPageNum} pages.`);

    // ASSIGN REVERSE ORDER IDs:
    const plannedItems = sanitizedItems.map((item, index) => {
      const reverseIndex = totalItems - 1 - index;
      const seqNum = idStartOffset + reverseIndex;
      const id = `${cleanCategory}-${cleanYear}-${String(seqNum).padStart(5, '0')}`;
      return {
        ...item,
        id
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

      // Navigate to movie entry page to grab poster and real metadata
      await safeGoto(page, item.href, 20000);
      await page.waitForTimeout(200);

      // Extract poster image on page (multi-selector approach)
      posterUrl = await page.evaluate(() => {
        const candidates = [
          document.querySelector('img[src*="/uploads/posters/"]'),
          document.querySelector('img.wp-post-image'),
          document.querySelector('img[class*="poster"]'),
          document.querySelector('.post-thumbnail img'),
          document.querySelector('.entry-thumbnail img'),
          document.querySelector('article img:first-of-type'),
          document.querySelector('.entry-content img'),
          ...Array.from(document.querySelectorAll('img')).filter(i =>
            i.src && (i.src.includes('posters') || i.src.includes('uploads') || i.src.includes('wp-content'))
          )
        ];
        const found = candidates.find(el => el && el.src && !el.src.includes('logo') && !el.src.includes('icon') && !el.src.includes('folder'));
        return found ? found.src : null;
      }).catch(() => null);

      // Extract real metadata from page content
      const pageMetadata = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const dirMatch = text.match(/Directors?[:\s]+([^\n\r]+)/i);
        const starMatch = text.match(/Starring[:\s]+([^\n\r]+)/i) || text.match(/Stars?[:\s]+([^\n\r]+)/i) || text.match(/Cast[:\s]+([^\n\r]+)/i);
        const genreMatch = text.match(/Genres?[:\s]+([^\n\r]+)/i) || text.match(/Category[:\s]+([^\n\r]+)/i);
        const durMatch = text.match(/Duration[:\s]+([^\n\r]+)/i);
        const synMatch = text.match(/Synopsis[:\s]+([^\n\r]+)/i) || text.match(/Story[:\s]+([^\n\r]+)/i);
        const storyEls = Array.from(document.querySelectorAll('.entry-content p, .description p, .synopsis p, .plot p, article p'));
        const storyEl = storyEls.find(p => p.innerText && p.innerText.trim().length > 50);

        return {
          director: dirMatch ? dirMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 100) : '',
          starring: starMatch ? starMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 250) : '',
          category: genreMatch ? genreMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 100) : '',
          duration: durMatch ? durMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 50) : '',
          story: synMatch ? synMatch[1].trim() : (storyEl ? storyEl.innerText.trim().slice(0, 500) : '')
        };
      }).catch(() => ({ director: '', starring: '', category: '', duration: '', story: '' }));

      // Download and save poster locally
      const savedPosterName = await downloadAndSavePoster(posterUrl, cleanCategory, cleanYear, item.cleanTitle, isMoviezda ? 'https://moviezda.co' : 'https://isaidub.green');

      if (item.isSeries) {
        // FOR SERIES: NEVER blindly skip just because R2 has some files!
        // A series may have 67+ episodes while R2 only has 20.
        // processSeriesItem visits all season pages, checks each episode against R2,
        // skips already stored episodes, and uploads any missing ones!
        broadcast('log', `  [SERIES INSPECTION] Checking all season pages & R2 files for "${item.cleanTitle}"...`);
        broadcast('movie-update', { id: item.id, status: 'Scanning Links' });
        movieRecord = await processSeriesItem(page, r2, item, cleanYear, cleanCategory, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, pageMetadata, r2Inspection, broadcast);
      } else {
        // FOR MOVIES:
        if (r2Inspection && r2Inspection.count >= 2 && duplicatePolicy === 'skip') {
          // If R2 already has at least 2 qualities and duplicatePolicy is skip:
          broadcast('log', `  [R2 DIRECT HIT] Found ${r2Inspection.count} video file(s) in R2 under ${targetPrefix}`);
          
          const enriched = await buildMetadata({
            title: item.cleanTitle,
            year: cleanYear,
            category: cleanCategory,
            language: 'Tamil',
            isSeries: false,
            downloadPageInfo: { duration: pageMetadata.duration || '02:00:00 min' }
          });

          movieRecord = {
            id: item.id,
            title: item.cleanTitle,
            image: savedPosterName || enriched.image,
            release: enriched.release,
            language: 'Tamil',
            year: cleanYear,
            category: pageMetadata.category || enriched.category,
            duration: pageMetadata.duration || enriched.duration,
            director: pageMetadata.director || enriched.director,
            starring: pageMetadata.starring || enriched.starring,
            story: pageMetadata.story || enriched.story,
            p360: r2Inspection.sources.p360 || '',
            p720: r2Inspection.sources.p720 || '',
            p1080: r2Inspection.sources.p1080 || '',
            created_at: enriched.created_at,
            status: 'active',
            type: cleanCategory,
            contentType: 'movie',
            episodes: []
          };

          stats.uploadedFilesCount += r2Inspection.count;
          broadcast('stats', stats);
        } else {
          // Check available qualities and upload missing ones
          broadcast('log', `  [MOVIE CHECK] Checking qualities in R2 vs website for "${item.cleanTitle}"...`);
          broadcast('movie-update', { id: item.id, status: 'Scanning Links' });
          movieRecord = await processMovieItem(page, r2, item, cleanYear, cleanCategory, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, pageMetadata, r2Inspection, broadcast);
        }
      }

      if (movieRecord) {
        catalogMap.set(movieRecord.id, movieRecord);
        saveCatalog(Array.from(catalogMap.values()), cleanCategory, cleanYear);

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
async function processMovieItem(page, r2, item, year, category, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, pageMetadata = {}, existingR2 = null, broadcast = console.log) {
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
    await safeGoto(page, versionLink.href, 20000);
    await page.waitForTimeout(200);
    innerLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);
  }

  const qualityLinks = innerLinks.filter((l) => /(360p|720p|1080p|480p)/i.test(l.text));
  const uniqueQualities = Array.from(new Map(qualityLinks.map((q) => [q.href, q])).values());

  const currentR2 = existingR2 || await inspectR2Folder(r2, targetPrefix, urlMode, false, item.folderSlug);
  let downloadPageInfo = {};

  for (const q of uniqueQualities) {
    if (shouldStop) break;

    const qMatch = q.text.match(/(360p|720p|1080p|480p)/i);
    const qLabel = qMatch ? qMatch[1].toUpperCase() : 'HD';

    const qKey = qLabel === '360P' ? 'p360' : (qLabel === '1080P' ? 'p1080' : 'p720');
    if (currentR2 && currentR2.sources && currentR2.sources[qKey] && duplicatePolicy !== 'replace') {
      broadcast('log', `  [R2 HIT] ${qLabel} quality already exists in R2 under ${targetPrefix}`);
      continue;
    }

    await safeGoto(page, q.href, 20000);
    await page.waitForTimeout(200);

    const filePageLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);

    const filePage = filePageLinks.find(
      (l) => l.href.includes('/download/') || l.text.toLowerCase().includes('.mp4') || l.text.toLowerCase().includes('hd')
    );

    if (!filePage) continue;

    await safeGoto(page, filePage.href, 20000);
    const metaDetails = await parseDownloadPageDetails(page);
    if (!downloadPageInfo.duration && metaDetails.duration) downloadPageInfo.duration = metaDetails.duration;
    if (!downloadPageInfo.addedDate && metaDetails.addedDate) downloadPageInfo.addedDate = metaDetails.addedDate;

    const directUrl = await resolveDirectDownloadUrl(page, filePage.href, broadcast);
    if (!directUrl) continue;

    const targetFilename = `${item.cleanTitle} ${qLabel}.mp4`;
    const fullKey = `${targetPrefix}${targetFilename}`;

    if (history.completedKeys.includes(fullKey) && duplicatePolicy !== 'replace') {
      broadcast('log', `  [R2 HIT] ${targetFilename} already recorded in history -> Skipping upload`);
      continue;
    }

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
      broadcast('log', `  [SUCCESS] ✓ Stored in R2: ${uploadResult.key || targetFilename}`);
      history.completedKeys.push(fullKey);
      saveHistory(history);
    } catch (uploadErr) {
      broadcast('log', `  [UPLOAD ERROR] ${uploadErr.message}`);
    }
  }

  const finalR2Data = await inspectR2Folder(r2, targetPrefix, urlMode, false, item.folderSlug);

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
    title: item.cleanTitle,
    image: savedPosterName || enriched.image,
    release: enriched.release,
    language: 'Tamil',
    year,
    category: pageMetadata.category || enriched.category,
    duration: pageMetadata.duration || downloadPageInfo.duration || enriched.duration,
    director: pageMetadata.director || enriched.director,
    starring: pageMetadata.starring || enriched.starring,
    story: pageMetadata.story || enriched.story,
    p360: finalR2Data?.sources?.p360 || '',
    p720: finalR2Data?.sources?.p720 || '',
    p1080: finalR2Data?.sources?.p1080 || '',
    created_at: enriched.created_at,
    status: 'active',
    type: category,
    contentType: 'movie',
    episodes: []
  };
}

/**
 * Process Single Series: Seasons -> All Pagination Pages -> Episodes -> JIT Stream -> DB Record
 */
async function processSeriesItem(page, r2, item, year, category, targetPrefix, urlMode, duplicatePolicy, history, stats, savedPosterName, pageMetadata = {}, existingR2 = null, broadcast = console.log) {
  await r2.createFolder(targetPrefix).catch(() => {});

  let innerLinks = (await page.$$eval('a', (els) =>
    els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
  )).filter(isContentLink);

  const seasonLinks = innerLinks.filter((l) => /season\s*\d+/i.test(l.text));
  const seasonsToProcess = seasonLinks.length > 0 ? seasonLinks : [{ text: 'Season 01', href: item.href }];

  const currentR2 = existingR2 || await inspectR2Folder(r2, targetPrefix, urlMode, true, item.folderSlug);

  for (const season of seasonsToProcess) {
    if (shouldStop) break;

    const seasonMatch = season.text.match(/season\s*(\d+)/i);
    const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
    const sStr = String(seasonNum).padStart(2, '0');

    await safeGoto(page, season.href, 20000);
    await page.waitForTimeout(200);

    let epListingLinks = (await page.$$eval('a', (els) =>
      els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
    )).filter(isContentLink);

    // If there is a quality folder (720p/1080p etc.), enter it
    const qualFolder = epListingLinks.find((l) => /(720p|1080p|480p|360p)/i.test(l.text));
    if (qualFolder) {
      await safeGoto(page, qualFolder.href, 20000);
      await page.waitForTimeout(200);
    }

    // DISCOVER ALL PAGINATION PAGES FOR THIS SEASON
    const { totalPages, urls } = await discoverPaginationUrls(page, page.url(), broadcast);
    broadcast('log', `  [SERIES PAGINATION] Season ${seasonNum}: Discovered ${totalPages} page(s) on source`);

    const allSeasonEpisodes = [];

    // Scan all pages of this season
    for (const seasonPageUrl of urls) {
      if (shouldStop) break;
      if (seasonPageUrl !== page.url()) {
        await safeGoto(page, seasonPageUrl, 20000);
        await page.waitForTimeout(200);
      }

      const rawLinks = await page.$$eval('a', (els) =>
        els.map((e) => ({ text: e.innerText.trim(), href: e.href }))
      );

      const pageEpisodes = rawLinks.filter((l) =>
        l.href.includes('/download/') || 
        /[_\s\(\[]Epi?(?:sode)?[_\s\(\[]*\d+/i.test(l.text) || 
        /epi?\s*\d+/i.test(l.text)
      );

      pageEpisodes.forEach((ep) => {
        if (!allSeasonEpisodes.some((e) => e.href === ep.href)) {
          allSeasonEpisodes.push(ep);
        }
      });
    }

    // Reverse episodes so they are in ascending order (Epi 1 to Epi N)
    const sortedEpisodes = [...allSeasonEpisodes].reverse();
    broadcast('log', `  [SERIES] Season ${seasonNum}: Found total ${sortedEpisodes.length} episodes across ${totalPages} pages.`);

    for (let epIndex = 0; epIndex < sortedEpisodes.length; epIndex++) {
      if (shouldStop) break;
      const ep = sortedEpisodes[epIndex];

      const epNumMatch = ep.text.match(/[_\s\(\[]Epi?(?:sode)?[_\s\(\[]*(\d+)/i)
        || ep.text.match(/epi?\s*(\d+)/i) 
        || ep.text.match(/\d+/);
      const epNum = epNumMatch ? parseInt(epNumMatch[1], 10) : epIndex + 1;
      const eStr = String(epNum).padStart(2, '0');

      const targetFilename = `${item.cleanTitle} S${sStr} E${eStr}.mp4`;
      const fullKey = `${targetPrefix}${targetFilename}`;

      // Check if episode already exists in R2
      const alreadyInR2 = (currentR2 && currentR2.episodes && currentR2.episodes.some(e => 
        (e.episodeNumber === epNum && e.seasonNumber === seasonNum) ||
        (e.rawKey && (
          e.rawKey.toLowerCase().includes(`epi_${String(epNum).padStart(2, '0')}`) ||
          e.rawKey.toLowerCase().includes(`epi_${epNum}`) ||
          e.rawKey.toLowerCase().includes(`e${eStr}.mp4`) ||
          e.rawKey.toLowerCase().includes(`e${epNum}.mp4`)
        ))
      )) || history.completedKeys.includes(fullKey);

      // Check if episode poster image already exists locally on disk
      const epImageLocal = path.join(__dirname, '..', 'public', 'src', 'images', category, year, item.folderSlug, `${epNum}.jpg`);
      const hasLocalEpImage = fs.existsSync(epImageLocal) && fs.statSync(epImageLocal).size > 1000;

      // If both video is in R2 and episode poster is saved, we can fully skip
      if (alreadyInR2 && hasLocalEpImage && duplicatePolicy !== 'replace') {
        broadcast('log', `  [R2 HIT] S${sStr} E${eStr} (Ep ${epNum}) already stored in R2 & poster cached -> Skipping upload`);
        continue;
      }

      // Navigate to episode download page
      await safeGoto(page, ep.href, 20000);
      await page.waitForTimeout(150);

      // Download episode shot / thumbnail if missing
      if (!hasLocalEpImage) {
        const shotUrl = await page.evaluate(() => {
          const img = document.querySelector('img[src*="/uploads/shots/"]') ||
                      document.querySelector('article img') ||
                      document.querySelector('.post-thumbnail img') ||
                      document.querySelector('.entry-thumbnail img');
          return img ? img.src : null;
        }).catch(() => null);

        if (shotUrl) {
          await downloadAndSaveEpisodePoster(shotUrl, category, year, item.folderSlug, epNum, isMoviezda ? 'https://moviezda.co' : 'https://isaidub.green');
          broadcast('log', `  [EPISODE POSTER] Saved shot for S${sStr} E${eStr} -> ${item.folderSlug}/${epNum}.jpg`);
        }
      }

      if (alreadyInR2 && duplicatePolicy !== 'replace') {
        broadcast('log', `  [R2 HIT] S${sStr} E${eStr} (Ep ${epNum}) video already in R2 -> Video skipped, poster synced`);
        continue;
      }

      broadcast('log', `  [R2 MISS] S${sStr} E${eStr} (Ep ${epNum}) missing from R2 -> Resolving download link...`);
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
          broadcast('log', `  [SUCCESS] ✓ Stored Ep ${epNum} in R2: ${uploadResult.key || targetFilename}`);
          history.completedKeys.push(fullKey);
          saveHistory(history);
        } catch (uploadErr) {
          broadcast('log', `  [UPLOAD ERROR] Ep ${epNum}: ${uploadErr.message}`);
        }
      }
    }
  }

  const finalR2Data = await inspectR2Folder(r2, targetPrefix, urlMode, true, item.folderSlug);

  const enriched = await buildMetadata({
    title: item.cleanTitle,
    year,
    category,
    language: 'Tamil',
    isSeries: true,
    downloadPageInfo: { duration: `${finalR2Data?.episodes?.length || 0} Episodes` }
  });

  return {
    id: item.id,
    title: item.cleanTitle,
    image: savedPosterName || enriched.image,
    release: enriched.release,
    language: 'Tamil',
    year,
    category: pageMetadata.category || enriched.category,
    duration: `${finalR2Data?.episodes?.length || 0} Episodes`,
    director: pageMetadata.director || enriched.director,
    starring: pageMetadata.starring || enriched.starring,
    story: pageMetadata.story || enriched.story,
    p360: '',
    p720: '',
    p1080: '',
    created_at: enriched.created_at,
    status: 'active',
    type: category,
    contentType: 'series',
    episodes: finalR2Data?.episodes || []
  };
}

module.exports = { startPipeline, stopPipeline };
