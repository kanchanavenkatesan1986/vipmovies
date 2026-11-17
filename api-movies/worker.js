/**
 * ============================================================================
 * Cloudflare Worker: api-movies (Optimized D1 & Edge Cache Engine)
 * ============================================================================
 * Production-safe D1 read optimization for VIP Movies.
 * - Normalized Cloudflare Edge Caching (caches.default)
 * - Cache key normalization (strips cache-busting timestamp queries)
 * - HTTP 304 ETag support (bandwidth and row-read reduction)
 * - Single-table ID routing (eliminates multi-table query scans)
 * - Reliable clean-key cache invalidation on mutations (POST/PUT/DELETE)
 * - 100% backwards-compatible response payloads and endpoints
 * ============================================================================
 */

// ─── 1. ALLOWED TABLES & CONSTANTS ───────────────────────────────────────────
const ALLOWED_TABLES = new Set([
  "tamil_2024",
  "tamil_2025",
  "tamil_2026",
  "hollywood_2024",
  "hollywood_2025",
  "hollywood_2026",
  "slider"
]);

const MOVIE_TABLES = [
  "tamil_2024",
  "tamil_2025",
  "tamil_2026",
  "hollywood_2024",
  "hollywood_2025",
  "hollywood_2026"
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, If-None-Match",
  "Access-Control-Max-Age": "86400"
};

// In-memory catalog revision counter per isolate
let GLOBAL_REVISION = 1;

// ─── 2. UTILITY & VALIDATION HELPERS ─────────────────────────────────────────

function validateId(id) {
  if (id === undefined || id === null || id === "") return false;
  const idStr = String(id).trim();
  if (idStr === "") return false;
  if (/^\d+$/.test(idStr)) return true;
  return /^[a-zA-Z0-9\-_]+$/.test(idStr);
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
    ...extraHeaders
  });
  return new Response(JSON.stringify(data), { status, headers });
}

function parseTimestamp(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const time = d.getTime();
  return isNaN(time) ? 0 : time;
}

async function generateETag(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `"${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}"`;
}

function etagsMatch(tag1, tag2) {
  if (!tag1 || !tag2) return false;
  const clean1 = String(tag1).replace(/^W\//i, "").replace(/^"|"$/g, "").trim();
  const clean2 = String(tag2).replace(/^W\//i, "").replace(/^"|"$/g, "").trim();
  return clean1 === clean2;
}

// In-memory cache for table schemas to avoid repeated PRAGMA queries
const cachedSchemas = new Map();

async function getTableSchema(env, tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Unauthorized table access: ${tableName}`);
  }
  if (cachedSchemas.has(tableName)) {
    return cachedSchemas.get(tableName);
  }
  try {
    const { results } = await env.DB.prepare(`PRAGMA table_info(\`${tableName}\`)`).all();
    const columns = new Set(results.map((r) => r.name));
    cachedSchemas.set(tableName, columns);
    return columns;
  } catch (err) {
    console.error(`Failed to fetch schema details for table ${tableName}:`, err);
    throw new Error(`Schema lookup failure for table ${tableName}`);
  }
}

async function validateColumns(env, tableName, body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, message: "Body must be a JSON object" };
  }
  try {
    const validColumns = await getTableSchema(env, tableName);
    const keys = Object.keys(body).filter((k) => k !== "id");
    for (const key of keys) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        return { valid: false, message: `Invalid character in column name: ${key}` };
      }
      if (!validColumns.has(key)) {
        return { valid: false, message: `Column '${key}' does not exist in table '${tableName}'` };
      }
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

function formatRecord(row, tableName) {
  if (!row) return row;
  if (tableName === "slider") return row;
  const isTamil = tableName && tableName.startsWith("tamil");
  if (!row.type) {
    row.type = isTamil ? "tamil" : "hollywood";
  }
  // Safe episodes parsing
  if (typeof row.episodes === "string") {
    try {
      row.episodes = JSON.parse(row.episodes);
    } catch {
      row.episodes = [];
    }
  } else if (!Array.isArray(row.episodes)) {
    row.episodes = [];
  }
  // Safe contentType fallback
  if (!row.contentType) {
    row.contentType = (Array.isArray(row.episodes) && row.episodes.length > 0) ? "series" : "movie";
  }
  return row;
}

// ─── 3. CANONICAL CACHE KEY & CLOUDFLARE EDGE CACHE ──────────────────────────

/**
 * Normalizes request URL by removing non-semantic cache-busting timestamp queries.
 * This transforms repeated user visits with `?t=1729...` into a stable cache hit.
 */
function getNormalizedCacheUrl(requestUrl) {
  const url = new URL(requestUrl);
  url.searchParams.delete("t");
  url.searchParams.delete("_t");
  url.searchParams.delete("_");
  url.searchParams.delete("timestamp");
  url.searchParams.delete("nocache");
  url.searchParams.sort();
  return url.toString();
}

/**
 * Matches edge cache using normalized clean key.
 */
async function matchCache(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  try {
    const cache = caches.default;
    const cleanUrl = getNormalizedCacheUrl(request.url);
    const lookupRequest = new Request(cleanUrl, {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "application/json"
      }
    });

    const cachedResponse = await cache.match(lookupRequest);
    if (!cachedResponse) return null;

    // HTTP 304 Validation
    const cachedEtag = cachedResponse.headers.get("ETag");
    const ifNoneMatch = request.headers.get("If-None-Match");
    if (cachedEtag && ifNoneMatch && etagsMatch(cachedEtag, ifNoneMatch)) {
      const respHeaders = new Headers(cachedResponse.headers);
      respHeaders.set("CF-Cache-Status", "HIT");
      respHeaders.set("X-Cache-Lookup", "HIT-304");
      return new Response(null, {
        status: 304,
        headers: respHeaders
      });
    }

    if (request.method === "HEAD") {
      const respHeaders = new Headers(cachedResponse.headers);
      respHeaders.set("CF-Cache-Status", "HIT");
      return new Response(null, {
        status: 200,
        headers: respHeaders
      });
    }

    // Return cached response with HIT diagnostic header
    const freshHeaders = new Headers(cachedResponse.headers);
    freshHeaders.set("CF-Cache-Status", "HIT");
    freshHeaders.set("X-Cache-Lookup", "HIT-EDGE");
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      if (!freshHeaders.has(k)) freshHeaders.set(k, v);
    }

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: freshHeaders
    });
  } catch (err) {
    console.warn("Edge cache match warning:", err);
    return null;
  }
}

/**
 * Saves response to Cloudflare Edge Cache under normalized clean key.
 */
async function putCache(request, response) {
  if (request.method !== "GET" || response.status !== 200) {
    return;
  }

  try {
    const cache = caches.default;
    const cleanUrl = getNormalizedCacheUrl(request.url);
    const cacheRequest = new Request(cleanUrl, {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "application/json"
      }
    });

    const cacheHeaders = new Headers(response.headers);
    cacheHeaders.set("CF-Cache-Status", "HIT");
    cacheHeaders.set("X-Cache-Key", cleanUrl);

    const cachedClone = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers: cacheHeaders
    });

    await cache.put(cacheRequest, cachedClone);
  } catch (err) {
    console.warn("Edge cache put warning:", err);
  }
}

/**
 * Purges normalized cache keys on data mutation (create, update, delete).
 */
async function purgeCache(env, urlStr, tableName, resourceId) {
  try {
    GLOBAL_REVISION++;
    const cache = caches.default;
    const url = new URL(urlStr);
    const origin = url.origin;

    const pathsToPurge = [
      "/api/app",
      "/app",
      "/api/version",
      "/version",
      "/api/movies",
      "/movies",
      "/api/slider",
      "/slider",
      "/api/stats",
      "/stats",
      "/api/dashboard-summary"
    ];

    if (tableName && ALLOWED_TABLES.has(tableName)) {
      pathsToPurge.push(`/api/${tableName}`);
      pathsToPurge.push(`/${tableName}`);
    }

    if (resourceId) {
      pathsToPurge.push(`/api/movies/${resourceId}`);
      pathsToPurge.push(`/movies/${resourceId}`);
      if (tableName && ALLOWED_TABLES.has(tableName)) {
        pathsToPurge.push(`/api/${tableName}/${resourceId}`);
        pathsToPurge.push(`/${tableName}/${resourceId}`);
      }
    }

    const deletePromises = pathsToPurge.map((path) => {
      const cleanPurgeUrl = `${origin}${path}`;
      const purgeRequest = new Request(cleanPurgeUrl, { method: "GET" });
      return cache.delete(purgeRequest).catch(() => false);
    });

    await Promise.all(deletePromises);
  } catch (err) {
    console.error("Failed to complete cache purge sequence:", err);
  }
}

// ─── 4. VERSION ENGINE ───────────────────────────────────────────────────────

function computeVersion(movieCount, latestMovieTime, sliderCount, latestSliderTime) {
  const movieSec = Math.floor(latestMovieTime / 1000);
  const sliderSec = Math.floor(latestSliderTime / 1000);
  const sum = movieCount * 17 + sliderCount * 31 + movieSec + sliderSec;
  return (Math.abs(sum) % 90000) + 10000;
}

async function getVersionMetadata(env) {
  const tables = [
    "tamil_2024",
    "tamil_2025",
    "tamil_2026",
    "hollywood_2024",
    "hollywood_2025",
    "hollywood_2026",
    "slider"
  ];

  const promises = tables.map(async (table) => {
    try {
      const columns = await getTableSchema(env, table);
      const selectParts = ["COUNT(*) as cnt"];
      if (columns.has("updated_at")) selectParts.push("MAX(updated_at) as max_upd");
      if (columns.has("created_at")) selectParts.push("MAX(created_at) as max_cre");
      if (columns.has("release")) selectParts.push("MAX(release) as max_rel");
      if (columns.has("updated")) selectParts.push("MAX(updated) as max_upd_legacy");

      const sql = `SELECT ${selectParts.join(", ")} FROM \`${table}\``;
      const row = await env.DB.prepare(sql).first();
      return { table, row };
    } catch (e) {
      console.error(`Metadata query failed for table ${table}:`, e);
      return { table, row: null };
    }
  });

  const results = await Promise.all(promises);

  let movieCount = 0;
  let sliderCount = 0;
  let latestMovieTime = 0;
  let latestSliderTime = 0;

  for (const item of results) {
    const { table, row } = item;
    if (!row) continue;
    const count = parseInt(row.cnt, 10) || 0;
    let maxTime = 0;
    const dateValues = [row.max_upd, row.max_cre, row.max_rel, row.max_upd_legacy].filter(Boolean);
    for (const val of dateValues) {
      const time = parseTimestamp(val);
      if (time > maxTime) maxTime = time;
    }

    if (table === "slider") {
      sliderCount = count;
      latestSliderTime = maxTime;
    } else {
      movieCount += count;
      if (maxTime > latestMovieTime) latestMovieTime = maxTime;
    }
  }

  return { movieCount, sliderCount, latestMovieTime, latestSliderTime };
}

async function handleVersionRequest(request, env, ctx) {
  const cachedResponse = await matchCache(request);
  if (cachedResponse) return cachedResponse;

  const metadata = await getVersionMetadata(env);
  const version = computeVersion(
    metadata.movieCount,
    metadata.latestMovieTime,
    metadata.sliderCount,
    metadata.latestSliderTime
  );

  const maxTime = Math.max(metadata.latestMovieTime, metadata.latestSliderTime);
  const updated = maxTime > 0 ? new Date(maxTime).toISOString() : new Date().toISOString();

  const responseBody = {
    success: true,
    version,
    updated,
    count: metadata.movieCount
  };

  const bodyText = JSON.stringify(responseBody);
  const etag = await generateETag(bodyText);

  // Conservative Edge Cache TTL: 5 minutes edge, 1 minute browser
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60",
    "ETag": etag,
    "CF-Cache-Status": "MISS",
    ...CORS_HEADERS
  });

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && etagsMatch(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers });
  }

  const response200 = new Response(bodyText, { status: 200, headers });
  ctx.waitUntil(putCache(request, response200));

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return response200;
}

// ─── 5. FULL APP CATALOG ENGINE ──────────────────────────────────────────────

async function handleAppRequest(request, env, ctx) {
  const cachedResponse = await matchCache(request);
  if (cachedResponse) return cachedResponse;

  const tables = [
    "tamil_2024",
    "tamil_2025",
    "tamil_2026",
    "hollywood_2024",
    "hollywood_2025",
    "hollywood_2026",
    "slider"
  ];

  const promises = tables.map(async (table) => {
    try {
      const { results } = await env.DB.prepare(`SELECT * FROM \`${table}\``).all();
      return { table, results: results || [] };
    } catch (e) {
      console.error(`Error querying table ${table} for app aggregation:`, e);
      return { table, results: [] };
    }
  });

  const resultsArray = await Promise.all(promises);

  let allMovies = [];
  let allSliders = [];
  let latestMovieTime = 0;
  let latestSliderTime = 0;

  for (const item of resultsArray) {
    const { table, results } = item;
    if (table === "slider") {
      allSliders = results;
      for (const row of results) {
        const time = parseTimestamp(row.updated_at || row.created_at || row.updated);
        if (time > latestSliderTime) latestSliderTime = time;
      }
    } else {
      const isTamil = table.startsWith("tamil");
      const processedMovies = results.map((row) => {
        formatRecord(row, table);
        const time = parseTimestamp(row.updated_at || row.created_at || row.release || row.updated);
        if (time > latestMovieTime) latestMovieTime = time;
        return row;
      });
      allMovies.push(...processedMovies);
    }
  }

  allMovies.sort((a, b) => {
    const yearA = parseInt(a.year, 10) || 0;
    const yearB = parseInt(b.year, 10) || 0;
    if (yearB !== yearA) return yearB - yearA;
    const titleA = String(a.title || "").toLowerCase();
    const titleB = String(b.title || "").toLowerCase();
    return titleA.localeCompare(titleB);
  });

  const version = computeVersion(
    allMovies.length,
    latestMovieTime,
    allSliders.length,
    latestSliderTime
  );

  const maxTime = Math.max(latestMovieTime, latestSliderTime);
  const updated = maxTime > 0 ? new Date(maxTime).toISOString() : new Date().toISOString();

  const appResponse = {
    success: true,
    version,
    updated,
    count: allMovies.length,
    slider: allSliders,
    movies: allMovies
  };

  const bodyText = JSON.stringify(appResponse);
  const etag = await generateETag(bodyText);

  // Edge cache: 10 mins, browser: 5 mins
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=120",
    "ETag": etag,
    "Version": String(version),
    "Count": String(allMovies.length),
    "Updated": updated,
    "CF-Cache-Status": "MISS",
    ...CORS_HEADERS
  });

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && etagsMatch(ifNoneMatch, etag)) {
    return new Response(null, { status: 304, headers });
  }

  const response200 = new Response(bodyText, { status: 200, headers });
  ctx.waitUntil(putCache(request, response200));

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return response200;
}

// ─── 6. LIGHTWEIGHT STATS / DASHBOARD SUMMARY ────────────────────────────────

async function handleStatsRequest(request, env, ctx) {
  const cachedResponse = await matchCache(request);
  if (cachedResponse) return cachedResponse;

  const tables = [
    "tamil_2024",
    "tamil_2025",
    "tamil_2026",
    "hollywood_2024",
    "hollywood_2025",
    "hollywood_2026",
    "slider"
  ];

  const promises = tables.map(async (table) => {
    try {
      const row = await env.DB.prepare(`SELECT count(*) as count FROM \`${table}\``).first();
      return { table, count: row ? Number(row.count) || 0 : 0 };
    } catch (e) {
      return { table, count: 0 };
    }
  });

  const counts = await Promise.all(promises);
  const tableCounts = {};
  let totalTamil = 0;
  let totalHollywood = 0;
  let totalSlides = 0;

  for (const item of counts) {
    tableCounts[item.table] = item.count;
    if (item.table.startsWith("tamil_")) totalTamil += item.count;
    else if (item.table.startsWith("hollywood_")) totalHollywood += item.count;
    else if (item.table === "slider") totalSlides = item.count;
  }

  const payload = {
    success: true,
    totalMovies: totalTamil + totalHollywood,
    tamilMovies: totalTamil,
    hollywoodMovies: totalHollywood,
    totalSlides,
    tables: tableCounts
  };

  const bodyText = JSON.stringify(payload);
  const etag = await generateETag(bodyText);

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=60",
    "ETag": etag,
    "CF-Cache-Status": "MISS",
    ...CORS_HEADERS
  });

  const response200 = new Response(bodyText, { status: 200, headers });
  ctx.waitUntil(putCache(request, response200));
  return response200;
}

// ─── 7. SINGLE-TABLE ROUTING FOR ID LOOKUPS ──────────────────────────────────

/**
 * Parses target table directly from structured movie ID.
 * e.g. 'tamil-2026-00001' -> 'tamil_2026'
 * Eliminates querying 6 separate tables!
 */
function inferTableFromId(id) {
  if (!id) return null;
  const str = String(id).toLowerCase().trim();
  for (const t of MOVIE_TABLES) {
    const prefix = t.replace("_", "-");
    if (str.startsWith(prefix)) {
      return t;
    }
  }
  return null;
}

async function findMovieAndTableById(env, id) {
  const parsedId = /^\d+$/.test(id) ? parseInt(id, 10) : id;

  // Optimized single-table route:
  const directTable = inferTableFromId(id);
  if (directTable) {
    try {
      const movie = await env.DB.prepare(`SELECT * FROM \`${directTable}\` WHERE \`id\` = ?`)
        .bind(parsedId)
        .first();
      if (movie) {
        return { movie, table: directTable };
      }
    } catch (e) {
      console.warn(`Direct table query for ${directTable} failed:`, e);
    }
  }

  // Fallback to searching all tables only if direct lookup didn't match
  const promises = MOVIE_TABLES.map(async (table) => {
    if (table === directTable) return null; // already checked
    try {
      const movie = await env.DB.prepare(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`)
        .bind(parsedId)
        .first();
      if (movie) return { movie, table };
    } catch (e) {
      console.error(`Error querying table ${table} for ID ${id}:`, e);
    }
    return null;
  });

  const resolved = await Promise.all(promises);
  return resolved.find((r) => r !== null) || null;
}

function getTableNameFromMovie(movie) {
  const category = String(movie.category || movie.type || "").toLowerCase().trim();
  const year = String(movie.year || "").trim();
  if (category === "tamil" && ["2024", "2025", "2026"].includes(year)) {
    return `tamil_${year}`;
  }
  if (category === "hollywood" && ["2024", "2025", "2026"].includes(year)) {
    return `hollywood_${year}`;
  }
  return null;
}

// ─── 8. CRUD TABLE ROUTE HANDLER ─────────────────────────────────────────────

async function handleTableRoute(request, env, ctx, tableName, id, preParsedBody = null) {
  const method = request.method;

  if (!ALLOWED_TABLES.has(tableName)) {
    return jsonResponse({ success: false, message: "Unauthorized table access" }, 403);
  }

  if (id !== null && !validateId(id)) {
    return jsonResponse({ success: false, message: "Invalid ID format" }, 400);
  }

  const parsedId = id !== null && /^\d+$/.test(id) ? parseInt(id, 10) : id;

  // ── GET & HEAD ──
  if (method === "GET" || method === "HEAD") {
    const cachedResponse = await matchCache(request);
    if (cachedResponse) return cachedResponse;

    let data;
    if (id !== null) {
      data = await env.DB.prepare(`SELECT * FROM \`${tableName}\` WHERE \`id\` = ?`)
        .bind(parsedId)
        .first();
      if (!data) {
        return jsonResponse({ success: false, message: "Record not found" }, 404);
      }
      data = formatRecord(data, tableName);
    } else {
      const { results } = await env.DB.prepare(`SELECT * FROM \`${tableName}\``).all();
      data = (results || []).map((r) => formatRecord(r, tableName));
    }

    const bodyText = JSON.stringify(data);
    const etag = await generateETag(bodyText);

    // Edge cache: 5 mins, browser: 2 mins
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=60",
      "ETag": etag,
      "CF-Cache-Status": "MISS",
      ...CORS_HEADERS
    });

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch && etagsMatch(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers });
    }

    const response200 = new Response(bodyText, { status: 200, headers });
    ctx.waitUntil(putCache(request, response200));

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return response200;
  }

  // ── POST ──
  if (method === "POST") {
    let body = preParsedBody;
    if (!body) {
      try {
        body = await request.json();
      } catch (e) {
        return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
      }
    }

    if (tableName === "slider") {
      if (!body || !body.image || !body.url) {
        return jsonResponse({ success: false, message: "slider requires 'image' and 'url' fields" }, 400);
      }
    } else {
      if (!body || !body.title) {
        return jsonResponse({ success: false, message: "movie requires a 'title' field" }, 400);
      }
    }

    const validation = await validateColumns(env, tableName, body);
    if (!validation.valid) {
      return jsonResponse({ success: false, message: validation.message }, 400);
    }

    const sanitizedBody = { ...body };
    if (tableName !== "slider") {
      if (sanitizedBody.contentType === undefined) {
        sanitizedBody.contentType = (Array.isArray(sanitizedBody.episodes) && sanitizedBody.episodes.length > 0) ? "series" : "movie";
      }
      if (sanitizedBody.episodes !== undefined) {
        if (typeof sanitizedBody.episodes === "object" && sanitizedBody.episodes !== null) {
          sanitizedBody.episodes = JSON.stringify(sanitizedBody.episodes);
        } else if (typeof sanitizedBody.episodes !== "string") {
          sanitizedBody.episodes = "[]";
        }
      }
    }

    const keys = Object.keys(sanitizedBody);
    const columns = keys.map((k) => `\`${k}\``).join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => sanitizedBody[k]);
    const sql = `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`;

    await env.DB.prepare(sql).bind(...values).run();

    // Invalidate edge caches immediately
    ctx.waitUntil(purgeCache(env, request.url, tableName, body.id || null));

    return jsonResponse(formatRecord({ ...body }, tableName) || { success: true, message: "Record inserted successfully" }, 201);
  }

  // ── PUT ──
  if (method === "PUT") {
    if (id === null) {
      return jsonResponse({ success: false, message: "Missing ID in path" }, 400);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

    const validation = await validateColumns(env, tableName, body);
    if (!validation.valid) {
      return jsonResponse({ success: false, message: validation.message }, 400);
    }

    const sanitizedBody = { ...body };
    if (tableName !== "slider") {
      if (sanitizedBody.episodes !== undefined) {
        if (typeof sanitizedBody.episodes === "object" && sanitizedBody.episodes !== null) {
          sanitizedBody.episodes = JSON.stringify(sanitizedBody.episodes);
        } else if (typeof sanitizedBody.episodes !== "string") {
          sanitizedBody.episodes = "[]";
        }
      }
    }

    const keys = Object.keys(sanitizedBody).filter((k) => k !== "id");
    if (keys.length === 0) {
      return jsonResponse({ success: false, message: "No fields to update" }, 400);
    }

    const setClause = keys.map((k) => `\`${k}\` = ?`).join(", ");
    const values = keys.map((k) => sanitizedBody[k]);
    values.push(parsedId);

    const updateSql = `UPDATE \`${tableName}\` SET ${setClause} WHERE \`id\` = ?`;
    const res = await env.DB.prepare(updateSql).bind(...values).run();

    if (res.meta && res.meta.changes === 0) {
      return jsonResponse({ success: false, message: "Record not found" }, 404);
    }

    // Invalidate edge caches immediately
    ctx.waitUntil(purgeCache(env, request.url, tableName, parsedId));

    const updatedData = formatRecord({ id: parsedId, ...body }, tableName);
    return jsonResponse({ success: true, message: "Record updated successfully", ...updatedData });
  }

  // ── DELETE ──
  if (method === "DELETE") {
    if (id === null) {
      return jsonResponse({ success: false, message: "Missing ID in path" }, 400);
    }

    const deleteSql = `DELETE FROM \`${tableName}\` WHERE \`id\` = ?`;
    const res = await env.DB.prepare(deleteSql).bind(parsedId).run();

    if (res.meta && res.meta.changes === 0) {
      return jsonResponse({ success: false, message: "Record not found" }, 404);
    }

    // Invalidate edge caches immediately
    ctx.waitUntil(purgeCache(env, request.url, tableName, parsedId));

    return jsonResponse({ success: true, message: "Record deleted successfully" });
  }

  return jsonResponse({ success: false, message: "Method not allowed" }, 405);
}

// ─── 9. MOVIES ROUTE HANDLER ─────────────────────────────────────────────────

async function handleMoviesRoute(request, env, ctx, id) {
  const method = request.method;

  if (id !== null && !validateId(id)) {
    return jsonResponse({ success: false, message: "Invalid ID format" }, 400);
  }

  if (method === "GET" || method === "HEAD") {
    const cachedResponse = await matchCache(request);
    if (cachedResponse) return cachedResponse;

    let responseData;
    if (id !== null) {
      const found = await findMovieAndTableById(env, id);
      if (!found) {
        return jsonResponse({ success: false, message: "Movie not found" }, 404);
      }
      responseData = found.movie ? formatRecord(found.movie, found.table) : null;
    } else {
      const promises = MOVIE_TABLES.map(async (table) => {
        try {
          const { results } = await env.DB.prepare(`SELECT * FROM \`${table}\``).all();
          return (results || []).map((row) => formatRecord(row, table));
        } catch (e) {
          console.error(`Error loading table ${table} for movies endpoint:`, e);
          return [];
        }
      });

      const resultsArray = await Promise.all(promises);
      const allMovies = resultsArray.flat();

      allMovies.sort((a, b) => {
        const yearA = parseInt(a.year, 10) || 0;
        const yearB = parseInt(b.year, 10) || 0;
        if (yearB !== yearA) return yearB - yearA;
        const titleA = String(a.title || "").toLowerCase();
        const titleB = String(b.title || "").toLowerCase();
        return titleA.localeCompare(titleB);
      });

      responseData = allMovies;
    }

    const bodyText = JSON.stringify(responseData);
    const etag = await generateETag(bodyText);

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=180, s-maxage=300, stale-while-revalidate=60",
      "ETag": etag,
      "CF-Cache-Status": "MISS",
      ...CORS_HEADERS
    });

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch && etagsMatch(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers });
    }

    const response200 = new Response(bodyText, { status: 200, headers });
    ctx.waitUntil(putCache(request, response200));

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return response200;
  }

  if (method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return jsonResponse({ success: false, message: "Body must be a JSON object" }, 400);
    }
    if (!body.title) {
      return jsonResponse({ success: false, message: "movie requires a 'title' field" }, 400);
    }

    const targetTable = getTableNameFromMovie(body);
    if (!targetTable) {
      return jsonResponse(
        {
          success: false,
          message: "Could not determine target movie table from category/type and year"
        },
        400
      );
    }
    return await handleTableRoute(request, env, ctx, targetTable, null, body);
  }

  if (method === "PUT") {
    if (id === null) {
      return jsonResponse({ success: false, message: "Missing ID in path" }, 400);
    }
    const found = await findMovieAndTableById(env, id);
    if (!found) {
      return jsonResponse({ success: false, message: "Movie not found" }, 404);
    }
    return await handleTableRoute(request, env, ctx, found.table, id);
  }

  if (method === "DELETE") {
    if (id === null) {
      return jsonResponse({ success: false, message: "Missing ID in path" }, 400);
    }
    const found = await findMovieAndTableById(env, id);
    if (!found) {
      return jsonResponse({ success: false, message: "Movie not found" }, 404);
    }
    return await handleTableRoute(request, env, ctx, found.table, id);
  }

  return jsonResponse({ success: false, message: "Method not allowed" }, 405);
}

// ─── 10. MAIN ROUTER ─────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const startTime = performance.now();

    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    let response;
    try {
      const url = new URL(request.url);
      let path = url.pathname;
      if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
      }

      // 2. Primary Routes
      if ((path === "/api/version" || path === "/version") && (request.method === "GET" || request.method === "HEAD")) {
        response = await handleVersionRequest(request, env, ctx);
      } else if ((path === "/api/app" || path === "/app") && (request.method === "GET" || request.method === "HEAD")) {
        response = await handleAppRequest(request, env, ctx);
      } else if ((path === "/api/stats" || path === "/stats" || path === "/api/dashboard-summary") && (request.method === "GET" || request.method === "HEAD")) {
        response = await handleStatsRequest(request, env, ctx);
      } else {
        const parts = path.split("/").filter(Boolean);
        let tableName = null;
        let resourceId = null;
        let isMoviesRoute = false;

        if (parts[0] === "api") {
          tableName = parts[1];
          resourceId = parts[2] || null;
        } else {
          tableName = parts[0];
          resourceId = parts[1] || null;
        }

        if (tableName === "movies") {
          isMoviesRoute = true;
        }

        if (isMoviesRoute) {
          response = await handleMoviesRoute(request, env, ctx, resourceId);
        } else if (tableName && ALLOWED_TABLES.has(tableName)) {
          response = await handleTableRoute(request, env, ctx, tableName, resourceId);
        } else {
          response = jsonResponse({ success: false, message: "Route not found" }, 404);
        }
      }
    } catch (error) {
      console.error("Worker process error:", error);
      response = jsonResponse({ success: false, message: error.message || "Internal Server Error" }, 500);
    }

    const duration = performance.now() - startTime;
    const finalHeaders = new Headers(response.headers);
    finalHeaders.set("x-response-time", `${duration.toFixed(2)}ms`);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders
    });
  }
};
