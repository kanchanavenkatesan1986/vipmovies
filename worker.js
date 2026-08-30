/**
 * ============================================================================
 * Cloudflare Worker: Production-Ready R2 File Manager + Movie Upload Center
 * ============================================================================
 * 
 * Features:
 *  - 100% Single-File Cloudflare Worker (ES Module syntax)
 *  - Native Cloudflare R2 Multipart Upload streaming (5GB+ files, 50+ batch queue)
 *  - Full R2 Object & Folder Management API:
 *      * /list-objects (Prefix hierarchy, delimiter pagination, cursor-based)
 *      * /object-details (Head metadata, ETags, HTTP metadata)
 *      * /delete-object & /delete-objects (Single & bulk deletion)
 *      * /copy-object & /copy-objects (Server-side stream copy with zero RAM buffering)
 *      * /rename-object & /move-object (Server-side copy + delete pattern)
 *      * /create-folder, /delete-folder & /rename-folder (Prefix-based folder operations)
 *      * /stream-media & /download (HTTP Range 206 Partial Content streaming for video preview)
 *  - Memory-safe stream chunk handling (Zero full-file buffering in Worker memory)
 *  - Strict path sanitization and directory hierarchy validation: {category}/{year}/{movieFolder}/{filename}
 *  - Comprehensive duplicate policies (reject, replace, rename)
 *  - Resumable upload support (/list-parts & /upload-status)
 *  - Configurable Bearer Authentication & Dynamic CORS origin handling
 * 
 * Required R2 Binding in wrangler.toml:
 *  [[r2_buckets]]
 *  binding = "MY_BUCKET"
 *  bucket_name = "<YOUR_R2_BUCKET_NAME>"
 * 
 * Required Secret:
 *  UPLOAD_API_TOKEN = "<YOUR_SECURE_TOKEN>" (Falls back to VIP_SECURE_TOKEN_2026 if unset)
 * ============================================================================
 */

// ==========================================
// 1. CENTRAL DYNAMIC CONFIGURATION
// ==========================================
const CONFIG = {
  // Allowed category folders for movies
  allowedCategories: [
    "tamil",
    "hollywood",
    "bollywood",
    "telugu",
    "malayalam",
    "kannada"
  ],

  // Allowed movie file extensions (case-insensitive)
  allowedExtensions: [
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".m4v",
    ".avi",
    ".ts",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".srt",
    ".vtt",
    ".txt",
    ".json",
    ".keep"
  ],

  // MIME type mappings for playback & preview compatibility (Range / 206 Partial Content)
  mimeMap: {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".ts": "video/mp2t",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".srt": "text/plain",
    ".vtt": "text/vtt",
    ".json": "application/json",
    ".keep": "text/plain"
  },

  // Upload validation limits
  maxFileSizeGB: 50,           // Maximum allowable movie size in GB
  maxParts: 10000,             // S3/R2 standard maximum parts limit
  minPartSizeMB: 5,            // R2 minimum part size is 5MB (except the final part)
  maxPartSizeMB: 100,          // Recommended frontend chunk size: 10MB - 100MB

  // Policy when target object already exists in R2: "reject" | "replace" | "rename"
  duplicatePolicy: "reject",

  // Security & Authentication
  requireAuth: true,           // Enforce Authorization: Bearer <UPLOAD_API_TOKEN>

  // Allowed CORS Origins
  allowedOrigins: [
    "*",
    "https://vip-movies.pages.dev",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173"
  ]
};

// ==========================================
// 2. HELPER UTILITIES
// ==========================================

/**
 * Standard JSON response constructor
 */
function jsonResponse(data, status = 200, customHeaders = {}, request = null) {
  const headers = new Headers(customHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");

  if (request) {
    const cors = getCorsHeaders(request);
    for (const [k, v] of Object.entries(cors)) {
      headers.set(k, v);
    }
  }

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * Generate CORS headers dynamically based on configured whitelist
 */
function getCorsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  let allowOrigin = "*";

  if (CONFIG.allowedOrigins.includes("*")) {
    allowOrigin = origin || "*";
  } else if (CONFIG.allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  } else if (CONFIG.allowedOrigins.length > 0) {
    allowOrigin = CONFIG.allowedOrigins[0];
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates request Bearer Authorization against env.UPLOAD_API_TOKEN
 */
function authenticate(request, env) {
  if (!CONFIG.requireAuth) return true;

  // Support query param token for media streaming / download links
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");

  const authHeader = request.headers.get("Authorization") || "";
  let providedToken = "";

  if (authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.substring(7).trim();
  } else if (queryToken) {
    providedToken = queryToken.trim();
  }

  if (!providedToken) {
    return false;
  }

  const expectedToken = (env && env.UPLOAD_API_TOKEN) ? env.UPLOAD_API_TOKEN.trim() : "VIP_SECURE_TOKEN_2026";
  return timingSafeEqual(providedToken, expectedToken);
}

/**
 * Resolves appropriate MIME content type based on extension
 */
function resolveContentType(filename, providedType = null) {
  if (providedType && providedType !== "application/octet-stream" && providedType.trim() !== "") {
    return providedType;
  }
  const extMatch = filename.match(/\.[0-9a-z]+$/i);
  if (extMatch) {
    const ext = extMatch[0].toLowerCase();
    if (CONFIG.mimeMap[ext]) {
      return CONFIG.mimeMap[ext];
    }
  }
  return "video/mp4";
}

/**
 * Sanitizes category name
 */
function sanitizeCategory(category) {
  if (!category || typeof category !== "string") return null;
  const clean = category.trim().toLowerCase();
  return CONFIG.allowedCategories.includes(clean) ? clean : null;
}

/**
 * Sanitizes year string/number
 */
function sanitizeYear(year) {
  const y = parseInt(year, 10);
  if (isNaN(y) || y < 1900 || y > 2100) return null;
  return String(y);
}

/**
 * Sanitizes movieFolder segment
 */
function sanitizeMovieFolder(folder) {
  if (!folder || typeof folder !== "string") return null;
  if (folder.includes("..") || folder.includes("/") || folder.includes("\\")) return null;
  const clean = folder
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean.length > 0 ? clean : null;
}

/**
 * Sanitizes filename and verifies allowed extension
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") return null;
  const trimmed = filename.trim();
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  const extMatch = trimmed.match(/\.[0-9a-z]+$/i);
  if (!extMatch) return null;
  const ext = extMatch[0].toLowerCase();
  if (!CONFIG.allowedExtensions.includes(ext)) {
    return null;
  }
  return trimmed;
}

/**
 * Validates arbitrary R2 object key to prevent directory traversal
 */
function validateObjectKey(key) {
  if (!key || typeof key !== "string") return false;
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) return false;
  const parts = key.split("/");
  if (parts.length < 1 || parts.some(p => p.trim().length === 0)) return false;
  return true;
}

/**
 * Validates R2 prefix
 */
function validatePrefix(prefix) {
  if (prefix === "" || prefix === null || prefix === undefined) return true;
  if (typeof prefix !== "string") return false;
  if (prefix.includes("..") || prefix.startsWith("/") || prefix.includes("\\")) return false;
  return true;
}

/**
 * Formats bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ==========================================
// 3. API ROUTE HANDLERS
// ==========================================

/**
 * GET /health
 */
async function handleHealth(request) {
  return jsonResponse({
    status: "ok",
    service: "vipmovies-r2-file-manager",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    allowedCategories: CONFIG.allowedCategories,
    allowedExtensions: CONFIG.allowedExtensions,
    maxFileSizeGB: CONFIG.maxFileSizeGB
  }, 200, {}, request);
}

/**
 * POST /list-objects
 * Lists objects and folders (delimitedPrefixes) with cursor pagination
 */
async function handleListObjects(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let { prefix = "", delimiter = "/", cursor = undefined, limit = 100 } = body || {};

  if (!validatePrefix(prefix)) {
    return jsonResponse({ success: false, error: "Invalid prefix path", code: "INVALID_PREFIX" }, 400, {}, request);
  }

  // Ensure prefix ends with '/' if not empty
  if (prefix && !prefix.endsWith("/")) {
    prefix = prefix + "/";
  }

  const listLimit = Math.min(Math.max(1, parseInt(limit, 10) || 100), 500);

  try {
    const listOptions = {
      prefix: prefix || undefined,
      cursor: cursor || undefined,
      limit: listLimit
    };

    if (delimiter) {
      listOptions.delimiter = delimiter;
    }

    const listed = await env.MY_BUCKET.list(listOptions);

    const objects = (listed.objects || []).map(obj => {
      const filename = obj.key.split("/").pop() || obj.key;
      const extMatch = filename.match(/\.[0-9a-z]+$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : "";

      return {
        key: obj.key,
        filename,
        size: obj.size,
        sizeFormatted: formatBytes(obj.size),
        etag: obj.httpEtag || obj.etag,
        uploaded: obj.uploaded,
        httpMetadata: obj.httpMetadata || {},
        customMetadata: obj.customMetadata || {},
        contentType: obj.httpMetadata?.contentType || resolveContentType(filename),
        extension: ext,
        isVideo: [".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi", ".ts"].includes(ext),
        isImage: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext),
        isKeepMarker: filename === ".keep"
      };
    });

    const folders = (listed.delimitedPrefixes || []).map(p => {
      const cleanPrefix = p.replace(/\/+$/, "");
      const folderName = cleanPrefix.split("/").pop() || cleanPrefix;
      return {
        prefix: p,
        name: folderName,
        parentPrefix: prefix
      };
    });

    return jsonResponse({
      success: true,
      prefix: prefix || "",
      delimiter: delimiter || "/",
      objects,
      folders,
      cursor: listed.cursor || null,
      hasMore: listed.truncated || false,
      count: objects.length + folders.length
    }, 200, {}, request);
  } catch (err) {
    console.error("[LIST_OBJECTS] Error listing R2 objects:", err);
    return jsonResponse({
      success: false,
      error: `Failed to list objects: ${err.message}`,
      code: "LIST_OBJECTS_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /object-details
 * Returns detailed metadata for a single R2 object
 */
async function handleObjectDetails(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key } = body || {};
  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  try {
    const head = await env.MY_BUCKET.head(key);
    if (!head) {
      return jsonResponse({ success: false, error: `Object '${key}' not found`, code: "NOT_FOUND" }, 404, {}, request);
    }

    const filename = key.split("/").pop() || key;
    const extMatch = filename.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";

    return jsonResponse({
      success: true,
      key: head.key,
      filename,
      size: head.size,
      sizeFormatted: formatBytes(head.size),
      etag: head.httpEtag || head.etag,
      uploaded: head.uploaded,
      httpMetadata: head.httpMetadata || {},
      customMetadata: head.customMetadata || {},
      contentType: head.httpMetadata?.contentType || resolveContentType(filename),
      extension: ext,
      isVideo: [".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi", ".ts"].includes(ext),
      isImage: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)
    }, 200, {}, request);
  } catch (err) {
    console.error(`[OBJECT_DETAILS] Error getting head for ${key}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "OBJECT_DETAILS_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /delete-object
 * Deletes a single object from R2
 */
async function handleDeleteObject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key } = body || {};
  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  try {
    await env.MY_BUCKET.delete(key);
    return jsonResponse({ success: true, key, message: "Object deleted successfully" }, 200, {}, request);
  } catch (err) {
    console.error(`[DELETE_OBJECT] Error deleting ${key}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "DELETE_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /delete-objects
 * Bulk deletes multiple object keys from R2
 */
async function handleDeleteObjects(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { keys } = body || {};
  if (!Array.isArray(keys) || keys.length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid keys array", code: "INVALID_KEYS" }, 400, {}, request);
  }

  const validKeys = keys.filter(k => typeof k === "string" && validateObjectKey(k));
  if (validKeys.length === 0) {
    return jsonResponse({ success: false, error: "No valid object keys provided", code: "NO_VALID_KEYS" }, 400, {}, request);
  }

  try {
    await env.MY_BUCKET.delete(validKeys);
    return jsonResponse({ success: true, deletedCount: validKeys.length, keys: validKeys }, 200, {}, request);
  } catch (err) {
    console.error("[DELETE_OBJECTS] Error bulk deleting objects:", err);
    return jsonResponse({ success: false, error: err.message, code: "BULK_DELETE_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /copy-object
 * Server-side stream copy from sourceKey to destKey without RAM buffering
 */
async function handleCopyObject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  let { sourceKey, destKey, conflictPolicy = "skip" } = body || {};

  if (!sourceKey || !validateObjectKey(sourceKey)) {
    return jsonResponse({ success: false, error: "Invalid source key", code: "INVALID_SOURCE_KEY" }, 400, {}, request);
  }
  if (!destKey || !validateObjectKey(destKey)) {
    return jsonResponse({ success: false, error: "Invalid destination key", code: "INVALID_DEST_KEY" }, 400, {}, request);
  }

  try {
    const sourceObj = await env.MY_BUCKET.get(sourceKey);
    if (!sourceObj) {
      return jsonResponse({ success: false, error: `Source object '${sourceKey}' not found`, code: "SOURCE_NOT_FOUND" }, 404, {}, request);
    }

    // Check destination existence for conflict policy
    const existingDest = await env.MY_BUCKET.head(destKey);
    if (existingDest) {
      if (conflictPolicy === "skip") {
        return jsonResponse({ success: true, skipped: true, sourceKey, destKey, message: "Destination already exists, skipped" }, 200, {}, request);
      } else if (conflictPolicy === "rename") {
        const parts = destKey.split("/");
        const filename = parts.pop();
        const baseDir = parts.length > 0 ? parts.join("/") + "/" : "";
        const dotIdx = filename.lastIndexOf(".");
        const namePart = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
        const extPart = dotIdx !== -1 ? filename.substring(dotIdx) : "";
        destKey = `${baseDir}${namePart}_copy_${Date.now()}${extPart}`;
      }
    }

    // Server-side streaming copy via R2Object.body ReadableStream
    await env.MY_BUCKET.put(destKey, sourceObj.body, {
      httpMetadata: sourceObj.httpMetadata,
      customMetadata: sourceObj.customMetadata
    });

    return jsonResponse({
      success: true,
      sourceKey,
      destKey,
      size: sourceObj.size,
      message: "Object copied successfully"
    }, 200, {}, request);
  } catch (err) {
    console.error(`[COPY_OBJECT] Error copying ${sourceKey} to ${destKey}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "COPY_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /copy-objects
 * Bulk server-side copy
 */
async function handleCopyObjects(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { items, conflictPolicy = "skip" } = body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid items array", code: "INVALID_ITEMS" }, 400, {}, request);
  }

  const results = [];
  for (const item of items) {
    const { sourceKey, destKey } = item;
    if (!sourceKey || !destKey || !validateObjectKey(sourceKey) || !validateObjectKey(destKey)) {
      results.push({ sourceKey, destKey, success: false, error: "Invalid keys" });
      continue;
    }

    try {
      const sourceObj = await env.MY_BUCKET.get(sourceKey);
      if (!sourceObj) {
        results.push({ sourceKey, destKey, success: false, error: "Source not found" });
        continue;
      }

      let finalDestKey = destKey;
      const existing = await env.MY_BUCKET.head(finalDestKey);
      if (existing) {
        if (conflictPolicy === "skip") {
          results.push({ sourceKey, destKey: finalDestKey, success: true, skipped: true });
          continue;
        } else if (conflictPolicy === "rename") {
          const parts = finalDestKey.split("/");
          const filename = parts.pop();
          const baseDir = parts.length > 0 ? parts.join("/") + "/" : "";
          const dotIdx = filename.lastIndexOf(".");
          const namePart = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
          const extPart = dotIdx !== -1 ? filename.substring(dotIdx) : "";
          finalDestKey = `${baseDir}${namePart}_copy_${Date.now()}${extPart}`;
        }
      }

      await env.MY_BUCKET.put(finalDestKey, sourceObj.body, {
        httpMetadata: sourceObj.httpMetadata,
        customMetadata: sourceObj.customMetadata
      });

      results.push({ sourceKey, destKey: finalDestKey, success: true });
    } catch (err) {
      results.push({ sourceKey, destKey, success: false, error: err.message });
    }
  }

  return jsonResponse({ success: true, total: items.length, results }, 200, {}, request);
}

/**
 * POST /rename-object
 * Server-side copy to new key followed by deletion of old key
 */
async function handleRenameObject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { oldKey, newKey } = body || {};
  if (!oldKey || !validateObjectKey(oldKey)) {
    return jsonResponse({ success: false, error: "Invalid oldKey", code: "INVALID_OLD_KEY" }, 400, {}, request);
  }
  if (!newKey || !validateObjectKey(newKey)) {
    return jsonResponse({ success: false, error: "Invalid newKey", code: "INVALID_NEW_KEY" }, 400, {}, request);
  }
  if (oldKey === newKey) {
    return jsonResponse({ success: true, oldKey, newKey, message: "Keys are identical" }, 200, {}, request);
  }

  try {
    const sourceObj = await env.MY_BUCKET.get(oldKey);
    if (!sourceObj) {
      return jsonResponse({ success: false, error: `Object '${oldKey}' not found`, code: "NOT_FOUND" }, 404, {}, request);
    }

    // Stream to new key
    await env.MY_BUCKET.put(newKey, sourceObj.body, {
      httpMetadata: sourceObj.httpMetadata,
      customMetadata: sourceObj.customMetadata
    });

    // Delete old key
    await env.MY_BUCKET.delete(oldKey);

    return jsonResponse({ success: true, oldKey, newKey, message: "Object renamed successfully" }, 200, {}, request);
  } catch (err) {
    console.error(`[RENAME_OBJECT] Error renaming ${oldKey} to ${newKey}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "RENAME_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /move-object
 * Server-side copy to destination key followed by deletion of source key
 */
async function handleMoveObject(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  let { sourceKey, destKey, conflictPolicy = "skip" } = body || {};

  if (!sourceKey || !validateObjectKey(sourceKey)) {
    return jsonResponse({ success: false, error: "Invalid source key", code: "INVALID_SOURCE_KEY" }, 400, {}, request);
  }
  if (!destKey || !validateObjectKey(destKey)) {
    return jsonResponse({ success: false, error: "Invalid destination key", code: "INVALID_DEST_KEY" }, 400, {}, request);
  }
  if (sourceKey === destKey) {
    return jsonResponse({ success: true, sourceKey, destKey, message: "Source and destination are identical" }, 200, {}, request);
  }

  try {
    const sourceObj = await env.MY_BUCKET.get(sourceKey);
    if (!sourceObj) {
      return jsonResponse({ success: false, error: `Source object '${sourceKey}' not found`, code: "NOT_FOUND" }, 404, {}, request);
    }

    const existingDest = await env.MY_BUCKET.head(destKey);
    if (existingDest) {
      if (conflictPolicy === "skip") {
        return jsonResponse({ success: true, skipped: true, sourceKey, destKey, message: "Destination already exists, skipped" }, 200, {}, request);
      } else if (conflictPolicy === "rename") {
        const parts = destKey.split("/");
        const filename = parts.pop();
        const baseDir = parts.length > 0 ? parts.join("/") + "/" : "";
        const dotIdx = filename.lastIndexOf(".");
        const namePart = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
        const extPart = dotIdx !== -1 ? filename.substring(dotIdx) : "";
        destKey = `${baseDir}${namePart}_moved_${Date.now()}${extPart}`;
      }
    }

    await env.MY_BUCKET.put(destKey, sourceObj.body, {
      httpMetadata: sourceObj.httpMetadata,
      customMetadata: sourceObj.customMetadata
    });

    await env.MY_BUCKET.delete(sourceKey);

    return jsonResponse({ success: true, sourceKey, destKey, message: "Object moved successfully" }, 200, {}, request);
  } catch (err) {
    console.error(`[MOVE_OBJECT] Error moving ${sourceKey} to ${destKey}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "MOVE_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /create-folder
 * Creates an empty prefix placeholder ({prefix}/.keep)
 */
async function handleCreateFolder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  let { prefix } = body || {};
  if (!prefix || typeof prefix !== "string" || !validatePrefix(prefix)) {
    return jsonResponse({ success: false, error: "Invalid folder prefix", code: "INVALID_PREFIX" }, 400, {}, request);
  }

  // Ensure trailing slash
  prefix = prefix.replace(/\/+$/, "") + "/";
  const keepKey = `${prefix}.keep`;

  try {
    await env.MY_BUCKET.put(keepKey, "", {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { isFolderMarker: "true" }
    });

    return jsonResponse({ success: true, prefix, markerKey: keepKey, message: "Folder created successfully" }, 201, {}, request);
  } catch (err) {
    console.error(`[CREATE_FOLDER] Error creating folder ${prefix}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "CREATE_FOLDER_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /delete-folder
 * Deletes all objects matching prefix
 */
async function handleDeleteFolder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  let { prefix } = body || {};
  if (!prefix || typeof prefix !== "string" || !validatePrefix(prefix)) {
    return jsonResponse({ success: false, error: "Invalid folder prefix", code: "INVALID_PREFIX" }, 400, {}, request);
  }

  prefix = prefix.replace(/\/+$/, "") + "/";

  try {
    let deletedCount = 0;
    let isTruncated = true;
    let cursor = undefined;

    while (isTruncated) {
      const listed = await env.MY_BUCKET.list({ prefix, cursor, limit: 500 });
      if (listed.objects && listed.objects.length > 0) {
        const keysToDelete = listed.objects.map(o => o.key);
        await env.MY_BUCKET.delete(keysToDelete);
        deletedCount += keysToDelete.length;
      }
      isTruncated = listed.truncated;
      cursor = listed.cursor;
    }

    return jsonResponse({ success: true, prefix, deletedCount, message: `Folder and ${deletedCount} object(s) deleted` }, 200, {}, request);
  } catch (err) {
    console.error(`[DELETE_FOLDER] Error deleting folder ${prefix}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "DELETE_FOLDER_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /rename-folder
 * Copies all objects under oldPrefix to newPrefix and deletes old objects
 */
async function handleRenameFolder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON", code: "INVALID_JSON" }, 400, {}, request);
  }

  let { oldPrefix, newPrefix } = body || {};
  if (!oldPrefix || !validatePrefix(oldPrefix)) {
    return jsonResponse({ success: false, error: "Invalid oldPrefix", code: "INVALID_OLD_PREFIX" }, 400, {}, request);
  }
  if (!newPrefix || !validatePrefix(newPrefix)) {
    return jsonResponse({ success: false, error: "Invalid newPrefix", code: "INVALID_NEW_PREFIX" }, 400, {}, request);
  }

  oldPrefix = oldPrefix.replace(/\/+$/, "") + "/";
  newPrefix = newPrefix.replace(/\/+$/, "") + "/";

  try {
    let movedCount = 0;
    let isTruncated = true;
    let cursor = undefined;

    while (isTruncated) {
      const listed = await env.MY_BUCKET.list({ prefix: oldPrefix, cursor, limit: 500 });
      if (listed.objects && listed.objects.length > 0) {
        for (const obj of listed.objects) {
          const relativePath = obj.key.substring(oldPrefix.length);
          const targetKey = `${newPrefix}${relativePath}`;

          const srcObj = await env.MY_BUCKET.get(obj.key);
          if (srcObj) {
            await env.MY_BUCKET.put(targetKey, srcObj.body, {
              httpMetadata: srcObj.httpMetadata,
              customMetadata: srcObj.customMetadata
            });
            await env.MY_BUCKET.delete(obj.key);
            movedCount++;
          }
        }
      }
      isTruncated = listed.truncated;
      cursor = listed.cursor;
    }

    return jsonResponse({ success: true, oldPrefix, newPrefix, movedCount, message: `Folder renamed and ${movedCount} objects moved` }, 200, {}, request);
  } catch (err) {
    console.error(`[RENAME_FOLDER] Error renaming folder ${oldPrefix} to ${newPrefix}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "RENAME_FOLDER_FAILED" }, 500, {}, request);
  }
}

/**
 * GET /stream-media & GET /download
 * HTTP Range streaming with 206 Partial Content
 */
async function handleStreamMedia(request, env) {
  const url = new URL(request.url);
  let key = url.searchParams.get("key");
  const isDownload = url.pathname.includes("/download");

  if (!key) {
    return jsonResponse({ success: false, error: "Invalid or missing key query parameter", code: "INVALID_KEY" }, 400, {}, request);
  }

  // Clean leading slashes
  key = key.replace(/^\/+/, "");

  if (!validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  try {
    const rangeHeader = request.headers.get("Range");
    const getOptions = {};

    if (rangeHeader) {
      getOptions.range = request.headers;
    }

    const object = await env.MY_BUCKET.get(key, getOptions);
    if (!object) {
      return jsonResponse({ success: false, error: `Object '${key}' not found`, code: "NOT_FOUND" }, 404, {}, request);
    }

    const filename = key.split("/").pop() || key;
    let contentType = object.httpMetadata?.contentType;
    if (!contentType || contentType === "application/octet-stream" || contentType.trim() === "") {
      contentType = resolveContentType(filename);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", object.httpEtag || object.etag);

    // Range & Content-Length specification required for HTML5 video player buffer seeking
    if (object.range) {
      const start = object.range.offset;
      const end = object.range.offset + object.range.length - 1;
      const total = object.size;
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", object.range.length.toString());
    } else {
      headers.set("Content-Length", object.size.toString());
    }

    const cors = getCorsHeaders(request);
    for (const [k, v] of Object.entries(cors)) {
      headers.set(k, v);
    }

    if (isDownload) {
      headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    const status = object.range ? 206 : 200;
    return new Response(object.body, {
      status,
      headers
    });
  } catch (err) {
    console.error(`[STREAM_MEDIA] Error streaming ${key}:`, err);
    return jsonResponse({ success: false, error: err.message, code: "STREAM_ERROR" }, 500, {}, request);
  }
}

// ==========================================
// 4. MULTIPART UPLOAD ROUTE HANDLERS
// ==========================================

/**
 * POST /create-upload
 */
async function handleCreateUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { category, year, movieFolder, filename, fileSize, contentType: userContentType } = body || {};

  const cleanCategory = sanitizeCategory(category);
  if (!cleanCategory) {
    return jsonResponse({ success: false, error: `Invalid category '${category}'. Allowed: ${CONFIG.allowedCategories.join(", ")}`, code: "INVALID_CATEGORY" }, 400, {}, request);
  }

  const cleanYear = sanitizeYear(year);
  if (!cleanYear) {
    return jsonResponse({ success: false, error: `Invalid year '${year}'. Must be between 1900 and 2100`, code: "INVALID_YEAR" }, 400, {}, request);
  }

  const cleanMovieFolder = sanitizeMovieFolder(movieFolder);
  if (!cleanMovieFolder) {
    return jsonResponse({ success: false, error: `Invalid movieFolder '${movieFolder}'. Use letters, numbers, hyphens or underscores`, code: "INVALID_MOVIE_FOLDER" }, 400, {}, request);
  }

  const cleanFilename = sanitizeFilename(filename);
  if (!cleanFilename) {
    return jsonResponse({ success: false, error: `Invalid filename '${filename}'. Allowed extensions: ${CONFIG.allowedExtensions.join(", ")}`, code: "INVALID_FILENAME" }, 400, {}, request);
  }

  if (fileSize && typeof fileSize === "number") {
    const maxSizeBytes = CONFIG.maxFileSizeGB * 1024 * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return jsonResponse({ success: false, error: `File size exceeds maximum limit of ${CONFIG.maxFileSizeGB} GB`, code: "FILE_TOO_LARGE" }, 413, {}, request);
    }
  }

  let finalKey = `${cleanCategory}/${cleanYear}/${cleanMovieFolder}/${cleanFilename}`;
  const duplicatePolicy = body?.duplicatePolicy || CONFIG.duplicatePolicy;

  try {
    const existingObject = await env.MY_BUCKET.head(finalKey);
    if (existingObject) {
      if (duplicatePolicy === "reject") {
        return jsonResponse({ success: false, error: `Object '${finalKey}' already exists in R2`, code: "DUPLICATE_KEY", existingKey: finalKey }, 409, {}, request);
      } else if (duplicatePolicy === "rename") {
        const dotIdx = cleanFilename.lastIndexOf(".");
        const namePart = dotIdx !== -1 ? cleanFilename.substring(0, dotIdx) : cleanFilename;
        const extPart = dotIdx !== -1 ? cleanFilename.substring(dotIdx) : "";
        finalKey = `${cleanCategory}/${cleanYear}/${cleanMovieFolder}/${namePart}_${Date.now()}${extPart}`;
      }
    }
  } catch (err) {
    console.warn(`[CREATE_UPLOAD] Head check warning for ${finalKey}:`, err);
  }

  const finalContentType = resolveContentType(cleanFilename, userContentType);

  try {
    const upload = await env.MY_BUCKET.createMultipartUpload(finalKey, {
      httpMetadata: {
        contentType: finalContentType
      },
      customMetadata: {
        uploadedCategory: cleanCategory,
        uploadedYear: cleanYear,
        uploadedMovieFolder: cleanMovieFolder,
        originalFilename: cleanFilename,
        createdAt: new Date().toISOString()
      }
    });

    return jsonResponse({
      success: true,
      uploadId: upload.uploadId,
      key: finalKey,
      filename: cleanFilename,
      category: cleanCategory,
      year: parseInt(cleanYear, 10),
      movieFolder: cleanMovieFolder,
      contentType: finalContentType
    }, 200, {}, request);
  } catch (err) {
    console.error(`[CREATE_UPLOAD] Failed to initialize multipart upload for key ${finalKey}:`, err);
    return jsonResponse({ success: false, error: "Failed to initialize R2 multipart upload", code: "R2_CREATE_FAILED" }, 500, {}, request);
  }
}

/**
 * POST /upload-part
 */
async function handleUploadPart(request, env) {
  const contentTypeHeader = request.headers.get("Content-Type") || "";

  let key, uploadId, partNumberStr, chunkStream;

  if (contentTypeHeader.includes("multipart/form-data")) {
    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return jsonResponse({ success: false, error: "Malformed multipart form-data payload", code: "INVALID_FORM_DATA" }, 400, {}, request);
    }

    key = formData.get("key");
    uploadId = formData.get("uploadId");
    partNumberStr = formData.get("partNumber");
    const fileOrBlob = formData.get("chunk") || formData.get("file");

    if (!fileOrBlob || typeof fileOrBlob.stream !== "function") {
      return jsonResponse({ success: false, error: "Missing chunk blob in form-data", code: "MISSING_CHUNK" }, 400, {}, request);
    }
    chunkStream = fileOrBlob.stream();
  } else {
    const url = new URL(request.url);
    key = url.searchParams.get("key") || request.headers.get("X-Upload-Key");
    uploadId = url.searchParams.get("uploadId") || request.headers.get("X-Upload-Id");
    partNumberStr = url.searchParams.get("partNumber") || request.headers.get("X-Part-Number");
    chunkStream = request.body;
  }

  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  const partNumber = parseInt(partNumberStr, 10);
  if (isNaN(partNumber) || partNumber < 1 || partNumber > CONFIG.maxParts) {
    return jsonResponse({ success: false, error: `Invalid partNumber '${partNumberStr}'. Must be 1 to ${CONFIG.maxParts}`, code: "INVALID_PART_NUMBER" }, 400, {}, request);
  }

  if (!chunkStream) {
    return jsonResponse({ success: false, error: "Empty request stream", code: "EMPTY_STREAM" }, 400, {}, request);
  }

  try {
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
    const uploadedPart = await upload.uploadPart(partNumber, chunkStream);

    return jsonResponse({
      success: true,
      partNumber: uploadedPart.partNumber,
      etag: uploadedPart.etag
    }, 200, {}, request);
  } catch (err) {
    console.error(`[UPLOAD_PART] Failed part ${partNumber} for key: ${key}, uploadId: ${uploadId}:`, err);
    return jsonResponse({
      success: false,
      error: `Failed to upload part ${partNumber}: ${err.message}`,
      code: "R2_PART_UPLOAD_FAILED",
      partNumber
    }, 500, {}, request);
  }
}

/**
 * POST /complete-upload
 */
async function handleCompleteUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key, uploadId, parts } = body || {};

  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    return jsonResponse({ success: false, error: "Missing or empty parts array for completion", code: "EMPTY_PARTS_ARRAY" }, 400, {}, request);
  }

  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  for (let i = 0; i < sortedParts.length; i++) {
    const p = sortedParts[i];
    if (!p.partNumber || typeof p.partNumber !== "number" || !p.etag || typeof p.etag !== "string") {
      return jsonResponse({ success: false, error: `Invalid part descriptor at index ${i}`, code: "INVALID_PART_DESCRIPTOR" }, 400, {}, request);
    }
  }

  try {
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
    const completedObject = await upload.complete(sortedParts);

    return jsonResponse({
      success: true,
      key: completedObject.key,
      size: completedObject.size,
      etag: completedObject.httpEtag || completedObject.etag,
      uploadedAt: completedObject.uploaded
    }, 200, {}, request);
  } catch (err) {
    console.error(`[COMPLETE_UPLOAD] Failed to complete upload for key: ${key}, uploadId: ${uploadId}:`, err);
    return jsonResponse({
      success: false,
      error: `Failed to complete multipart upload: ${err.message}`,
      code: "R2_COMPLETE_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /abort-upload & /cleanup-upload
 */
async function handleAbortUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key, uploadId } = body || {};

  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  try {
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
    await upload.abort();

    return jsonResponse({
      success: true,
      message: `Multipart upload session aborted and staged parts cleaned for ${key}`,
      key,
      uploadId
    }, 200, {}, request);
  } catch (err) {
    console.error(`[ABORT_UPLOAD] Failed to abort upload for key: ${key}, uploadId: ${uploadId}:`, err);
    return jsonResponse({
      success: false,
      error: `Failed to abort multipart upload: ${err.message}`,
      code: "R2_ABORT_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /list-parts
 */
async function handleListParts(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key, uploadId } = body || {};

  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  try {
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
    const uploadedParts = [];

    const listFn = typeof upload.parts === "function" ? upload.parts.bind(upload) : (typeof upload.listParts === "function" ? upload.listParts.bind(upload) : null);

    if (listFn) {
      let isTruncated = true;
      let partNumberMarker = undefined;

      while (isTruncated) {
        const result = await listFn({
          cursor: partNumberMarker,
          limit: 1000
        });

        if (Array.isArray(result?.parts)) {
          for (const p of result.parts) {
            uploadedParts.push({
              partNumber: p.partNumber,
              etag: p.etag,
              size: p.size
            });
          }
        }

        isTruncated = result?.isTruncated || false;
        partNumberMarker = result?.nextPartNumberMarker;
        if (!isTruncated || !partNumberMarker) {
          break;
        }
      }
    }

    return jsonResponse({
      success: true,
      key,
      uploadId,
      partsCount: uploadedParts.length,
      parts: uploadedParts,
      note: listFn ? "Retrieved from R2" : "R2 JS binding does not expose listParts; parts tracked client-side via IndexedDB"
    }, 200, {}, request);
  } catch (err) {
    console.error(`[LIST_PARTS] Failed to list parts for key: ${key}, uploadId: ${uploadId}:`, err);
    return jsonResponse({
      success: false,
      error: "Failed to list parts. The upload session may not exist or has expired.",
      code: "R2_LIST_PARTS_FAILED"
    }, 404, {}, request);
  }
}

/**
 * POST /upload-status
 */
async function handleUploadStatus(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key, uploadId } = body || {};

  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  try {
    const completedObject = await env.MY_BUCKET.head(key);
    if (completedObject) {
      return jsonResponse({
        success: true,
        key,
        status: "completed",
        size: completedObject.size,
        etag: completedObject.httpEtag || completedObject.etag,
        uploadedAt: completedObject.uploaded
      }, 200, {}, request);
    }
  } catch (err) {
    console.warn(`[UPLOAD_STATUS] Object head check error for key ${key}:`, err);
  }

  if (uploadId) {
    return jsonResponse({
      success: true,
      key,
      uploadId,
      status: "active"
    }, 200, {}, request);
  }

  return jsonResponse({
    success: true,
    key,
    status: "pending_or_unknown"
  }, 200, {}, request);
}

// ==========================================
// 4b. PUT OBJECT (Inline Text Editor Save)
// ==========================================

/**
 * POST /put-object
 * Saves text content (srt, vtt, txt, json) directly back to R2.
 * Only allows editable text file extensions (no binary overwrite).
 */
async function handlePutObject(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body", code: "INVALID_BODY" }, 400, {}, request);
  }

  const { key, content, contentType } = body || {};

  if (!key || typeof key !== "string") {
    return jsonResponse({ success: false, error: "Missing or invalid 'key'", code: "MISSING_KEY" }, 400, {}, request);
  }

  if (!validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid object key (path traversal or illegal characters)", code: "INVALID_KEY" }, 400, {}, request);
  }

  if (typeof content !== "string") {
    return jsonResponse({ success: false, error: "Missing 'content' string", code: "MISSING_CONTENT" }, 400, {}, request);
  }

  // Only allow editing text-based file types (never allow video/image overwrite via this endpoint)
  const extMatch = key.match(/\.[0-9a-z]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  const editableExtensions = [".srt", ".vtt", ".txt", ".json", ".csv", ".xml", ".html", ".css", ".js", ".md"];
  if (!editableExtensions.includes(ext)) {
    return jsonResponse({
      success: false,
      error: `Editing '${ext}' files is not permitted. Only text files can be edited inline.`,
      code: "NOT_EDITABLE"
    }, 400, {}, request);
  }

  const resolvedContentType = contentType || resolveContentType(key, null) || "text/plain";

  try {
    await env.MY_BUCKET.put(key, content, {
      httpMetadata: { contentType: resolvedContentType }
    });

    return jsonResponse({
      success: true,
      key,
      size: new TextEncoder().encode(content).length,
      contentType: resolvedContentType,
      savedAt: new Date().toISOString()
    }, 200, {}, request);
  } catch (err) {
    console.error("[PUT_OBJECT] Error saving text content:", err);
    return jsonResponse({ success: false, error: err.message, code: "PUT_FAILED" }, 500, {}, request);
  }
}

// ==========================================
// 5. MAIN ROUTER / WORKER FETCH HANDLER
// ==========================================
export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
      });
    }

    // 2. Verify R2 Binding exists
    if (!env || !env.MY_BUCKET) {
      console.error("[CRITICAL] R2 Bucket binding 'MY_BUCKET' is missing!");
      return jsonResponse({
        success: false,
        error: "R2 Bucket binding 'MY_BUCKET' is not configured on this Worker",
        code: "MISSING_R2_BINDING"
      }, 500, {}, request);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // 3. Public Health Route
    if (request.method === "GET" && path === "/health") {
      return handleHealth(request);
    }

    // 4. Media Streaming / Download Routes (GET)
    if (request.method === "GET" && (path === "/stream-media" || path === "/download")) {
      if (!authenticate(request, env)) {
        return jsonResponse({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, 401, {}, request);
      }
      return handleStreamMedia(request, env);
    }

    // 5. POST Dispatch Routes Table
    const postRoutes = {
      // Multipart Uploader
      "/create-upload": handleCreateUpload,
      "/upload-part": handleUploadPart,
      "/complete-upload": handleCompleteUpload,
      "/list-parts": handleListParts,
      "/upload-status": handleUploadStatus,
      "/abort-upload": handleAbortUpload,
      "/cleanup-upload": handleAbortUpload,

      // File & Folder Management
      "/list-objects": handleListObjects,
      "/object-details": handleObjectDetails,
      "/delete-object": handleDeleteObject,
      "/delete-objects": handleDeleteObjects,
      "/copy-object": handleCopyObject,
      "/copy-objects": handleCopyObjects,
      "/rename-object": handleRenameObject,
      "/move-object": handleMoveObject,
      "/create-folder": handleCreateFolder,
      "/delete-folder": handleDeleteFolder,
      "/rename-folder": handleRenameFolder,
      "/put-object": handlePutObject
    };

    if (request.method === "POST" && postRoutes[path]) {
      // Authentication check
      if (!authenticate(request, env)) {
        return jsonResponse({
          success: false,
          error: "Unauthorized: Invalid or missing Bearer token",
          code: "UNAUTHORIZED"
        }, 401, {}, request);
      }

      try {
        return await postRoutes[path](request, env, ctx);
      } catch (err) {
        console.error(`[UNHANDLED_EXCEPTION] Unhandled error at ${path}:`, err);
        return jsonResponse({
          success: false,
          error: `Internal server error: ${err.message}`,
          code: "INTERNAL_SERVER_ERROR"
        }, 500, {}, request);
      }
    }

    // Fallback 404 Route
    return jsonResponse({
      success: false,
      error: `Endpoint '${path}' with method '${request.method}' not found`,
      code: "ROUTE_NOT_FOUND"
    }, 404, {}, request);
  }
};
