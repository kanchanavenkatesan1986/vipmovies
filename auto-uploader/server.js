const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const { startPipeline, stopPipeline } = require('./scraper');
const { D1Client } = require('./d1Client');
const { R2Client } = require('./r2Client');
const { inspectR2Folder, MEDIA_BASE } = require('./r2Scanner');
const { cleanMovieTitle, buildMetadata } = require('./metadataHelper');
const { downloadAndSavePoster } = require('./posterDownloader');

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason && reason.message ? reason.message : reason);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let config = {};
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (e) {
  config = { port: 3456 };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let activeClients = [];

wss.on('connection', (ws) => {
  activeClients.push(ws);
  ws.send(JSON.stringify({ type: 'log', data: '[SYSTEM] Connected to VIP Movies Auto-Uploader & Catalog Engine.' }));

  const catPath = path.join(__dirname, 'movies_catalog_2026.json');
  if (fs.existsSync(catPath)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      ws.send(JSON.stringify({ type: 'catalog-init', data: catalog }));
    } catch (e) {}
  }

  ws.on('close', () => {
    activeClients = activeClients.filter((c) => c !== ws);
  });
});

function broadcast(type, data) {
  if (type === 'log') {
    console.log(`[${new Date().toLocaleTimeString()}] ${data}`);
  }

  const payload = JSON.stringify({
    type,
    data,
    timestamp: new Date().toLocaleTimeString()
  });

  activeClients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch (e) {}
    }
  });
}

app.post('/api/start', (req, res) => {
  const userConfig = { ...config, ...req.body };
  broadcast('status', 'Running');
  broadcast('log', '[SYSTEM] Automation pipeline started...');

  startPipeline(userConfig, broadcast).catch((err) => {
    broadcast('log', `[ERROR] Pipeline exception: ${err.message}`);
  });

  res.json({ success: true, message: 'Automation initiated' });
});

app.post('/api/stop', (req, res) => {
  stopPipeline();
  broadcast('status', 'Stopping');
  broadcast('log', '[SYSTEM] Stop signal sent. Completing current item and halting.');
  res.json({ success: true, message: 'Stopping automation' });
});

app.get('/api/catalog', (req, res) => {
  const catPath = path.join(__dirname, 'movies_catalog_2026.json');
  try {
    if (fs.existsSync(catPath)) {
      return res.json(JSON.parse(fs.readFileSync(catPath, 'utf8')));
    }
  } catch (e) {}
  res.json([]);
});

/**
 * Scan R2 Bucket Directly & Auto-Populate Catalog
 * Reads exact .mp4 video files, builds clean title schema,
 * sets file paths only, and updates D1 database + local catalog.
 */
app.post('/api/scan-r2-catalog', async (req, res) => {
  const { category = 'hollywood', year = '2026', urlMode = 'path', autoSyncD1 = true } = req.body;
  const prefix = `${category.toLowerCase()}/${year}/`;
  const table = `${category.toLowerCase()}_${year}`;

  broadcast('log', `[R2 BULK SCAN] Scanning all folders in Cloudflare R2 under "${prefix}"...`);
  broadcast('status', 'Running');

  try {
    const r2 = new R2Client();
    const d1 = new D1Client();
    const rootRes = await r2.listObjects(prefix);
    const folders = rootRes.folders || [];

    broadcast('log', `[R2 BULK SCAN] Discovered ${folders.length} folders in R2! Mapping titles...`);

    const dbMovies = await d1.getMovies(table);
    const catPath = path.join(__dirname, 'movies_catalog_2026.json');
    let catalog = [];
    if (fs.existsSync(catPath)) {
      try { catalog = JSON.parse(fs.readFileSync(catPath, 'utf8')); } catch (e) {}
    }
    const catalogMap = new Map(catalog.map(m => [m.id, m]));

    let processedCount = 0;
    let syncedCount = 0;

    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      const folderSlug = f.name.replace(/\/$/, '');
      const folderPrefix = f.prefix;

      const r2Data = await inspectR2Folder(r2, folderPrefix, urlMode, false, folderSlug);
      if (!r2Data || r2Data.count === 0) continue;

      processedCount++;

      const matchingDb = dbMovies.find(m => {
        const titleSlug = (m.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return titleSlug.includes(folderSlug) || folderSlug.includes(titleSlug);
      });

      const rawName = matchingDb?.title || f.name.replace(/-/g, ' ');
      const cleanTitle = cleanMovieTitle(rawName); // ONLY CLEAN TITLE! NO YEAR!
      const id = matchingDb?.id || `${category.toLowerCase()}-${year}-${String(processedCount).padStart(5, '0')}`;

      const savedPosterName = await downloadAndSavePoster(null, category, year, cleanTitle);

      const enriched = await buildMetadata({
        title: cleanTitle,
        year,
        category,
        language: 'Tamil',
        isSeries: r2Data.isSeries,
        downloadPageInfo: { duration: r2Data.isSeries ? `${r2Data.episodes.length} Episodes` : '02:00:00 min' }
      });

      const record = {
        id,
        title: cleanTitle, // ONLY MOVIE NAME! NO YEARS OR EXTRA TEXT!
        image: savedPosterName || enriched.image,
        release: matchingDb?.release || enriched.release,
        language: 'Tamil',
        year,
        category: matchingDb?.category || enriched.category,
        duration: r2Data.isSeries ? `${r2Data.episodes.length} Episodes` : (matchingDb?.duration || enriched.duration),
        director: matchingDb?.director || enriched.director,
        starring: matchingDb?.starring || enriched.starring,
        story: matchingDb?.story || enriched.story,
        p360: r2Data.sources.p360 || '',
        p720: r2Data.sources.p720 || '',
        p1080: r2Data.sources.p1080 || '',
        created_at: matchingDb?.created_at || enriched.created_at,
        status: 'active',
        type: category.toLowerCase(),
        contentType: r2Data.isSeries ? 'series' : 'movie',
        episodes: r2Data.episodes || []
      };

      catalogMap.set(id, record);
      broadcast('movie-update', { id, status: 'Stored R2', data: record });

      broadcast('log', `  [MAPPED ${processedCount}] ${id} -> "${record.title}" (${r2Data.isSeries ? `${r2Data.episodes.length} Ep` : 'Movie Sources'})`);

      if (autoSyncD1) {
        try {
          await d1.saveMovie(table, record);
          syncedCount++;
          broadcast('movie-update', { id, status: 'Synced D1', data: record });
        } catch (err) {
          broadcast('log', `  [D1 WARN] Failed to sync ${id}: ${err.message}`);
        }
      }
    }

    const updatedCatalog = Array.from(catalogMap.values());
    fs.writeFileSync(catPath, JSON.stringify(updatedCatalog, null, 2), 'utf8');

    broadcast('status', 'Idle');
    broadcast('log', `\n[R2 BULK SCAN COMPLETE] Successfully mapped ${processedCount} titles from R2! Synced: ${syncedCount}`);
    res.json({ success: true, processed: processedCount, synced: syncedCount });
  } catch (err) {
    broadcast('status', 'Idle');
    broadcast('log', `[R2 BULK SCAN ERROR] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * CLEAN 0 & FULL REPLACE SYNC:
 * Wipes table to 0, then pastes freshly ordered 00001..N records
 */
app.post('/api/sync-d1-replace', async (req, res) => {
  const { table = 'hollywood_2026' } = req.body;
  const catPath = path.join(__dirname, 'movies_catalog_2026.json');
  if (!fs.existsSync(catPath)) {
    return res.status(400).json({ error: 'No catalog file found. Run pipeline or R2 scan first.' });
  }

  try {
    const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));
    const d1 = new D1Client();
    broadcast('log', `\n======================================================`);
    broadcast('log', `[D1 REPLACE ALL] Initiating Clean 0 & Full Table Replace for "${table}"...`);
    broadcast('log', `======================================================`);

    const result = await d1.clearAndReplaceTable(table, catalog, (msg) => {
      broadcast('log', `[D1 REPLACE] ${msg}`);
    });

    broadcast('log', `[D1 REPLACE COMPLETE] ✓ Table "${table}" cleanly re-populated with ${result.count} records!`);
    res.json({ success: true, count: result.count, table });
  } catch (err) {
    broadcast('log', `[D1 REPLACE ERROR] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', (req, res) => {
  const histPath = path.join(__dirname, 'history.json');
  try {
    if (fs.existsSync(histPath)) {
      return res.json(JSON.parse(fs.readFileSync(histPath, 'utf8')));
    }
  } catch (e) {}
  res.json({ completedKeys: [] });
});

app.post('/api/history/clear', (req, res) => {
  const histPath = path.join(__dirname, 'history.json');
  try {
    fs.writeFileSync(histPath, JSON.stringify({ completedKeys: [] }, null, 2), 'utf8');
    broadcast('log', '[SYSTEM] Upload history reset.');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = config.port || 3456;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 VIP Movies Auto-Uploader & Catalog Engine is running!`);
  console.log(`👉 Open Dashboard: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
