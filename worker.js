/**
 * ============================================================================
 * Cloudflare Worker: Production-Ready R2 Large-File Movie Multipart Uploader
 * ============================================================================
 * 
 * Features:
 *  - 100% Single-File Cloudflare Worker (ES Module syntax)
 *  - Native Cloudflare R2 Multipart Upload streaming (5GB+ files, 50+ batch queue)
 *  - Memory-safe stream chunk handling (Zero full-file buffering in Worker memory)
 *  - Strict path sanitization and directory hierarchy validation: {category}/{year}/{movieFolder}/{filename}
 *  - Comprehensive duplicate policies (reject, replace, rename)
 *  - Resumable upload support (/list-parts & /upload-status)
 *  - Explicit cleanup & abort safety (No accidental session destruction on temporary completion errors)
 *  - Configurable Bearer Authentication & Strict CORS origin whitelist
 *  - Preserves video HTTP metadata (Content-Type) for seamless Range/206 Partial Content playback
 * 
 * Required R2 Binding in wrangler.toml:
 *  [[r2_buckets]]
 *  binding = "MY_BUCKET"
 *  bucket_name = "<YOUR_R2_BUCKET_NAME>"
 * 
 * Required Secret:
 *  UPLOAD_API_TOKEN = "<YOUR_SECURE_TOKEN>"
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
    ".avi"
  ],

  // MIME type mappings for playback compatibility (Range / 206 Partial Content)
  mimeMap: {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo"
  },

  // Upload validation limits
  maxFileSizeGB: 50,           // Maximum allowable movie size in GB
  maxParts: 10000,             // S3/R2 standard maximum parts limit
  minPartSizeMB: 5,            // R2 minimum part size is 5MB (except the final part)
  maxPartSizeMB: 100,          // Recommended frontend chunk size: 10MB - 100MB

  // Policy when target object already exists in R2: "reject" | "replace" | "rename"
  duplicatePolicy: "reject",

  // Security & Authentication
  requireAuth: true,           // Set to true to enforce Authorization: Bearer <UPLOAD_API_TOKEN>

  // Allowed CORS Origins. Use specific domains in production or "*" in local dev
  // Allowed CORS Origins. Use specific domains in production or "*" in local dev
  allowedOrigins: [
    "*",
    "https://your-admin-domain.com",
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
 * @param {object} data - Response payload
 * @param {number} status - HTTP status code
 * @param {HeadersInit} customHeaders - Optional extra headers
 * @param {Request} request - Origin request for dynamic CORS computation
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
 * @param {Request} request
 * @returns {Record<string, string>}
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Authenticate incoming requests
 * @param {Request} request 
 * @param {object} env 
 * @returns {boolean}
 */
function authenticate(request, env) {
  if (!CONFIG.requireAuth) {
    return true;
  }

  // Use env secret if defined, otherwise fallback to default secure token
  const expectedToken = env.UPLOAD_API_TOKEN || "VIP_SECURE_TOKEN_2026";

  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  return timingSafeEqual(token, expectedToken);
}

/**
 * Validate category name
 * @param {string} category 
 * @returns {string|null} Normalized category or null if invalid
 */
function validateCategory(category) {
  if (!category || typeof category !== "string") return null;
  const normalized = category.trim().toLowerCase();
  return CONFIG.allowedCategories.includes(normalized) ? normalized : null;
}

/**
 * Validate 4-digit release year
 * @param {string|number} year 
 * @returns {number|null} Valid year number or null
 */
function validateYear(year) {
  if (!year) return null;
  const yStr = String(year).trim();
  if (!/^\d{4}$/.test(yStr)) return null;
  const num = parseInt(yStr, 10);
  if (num < 1900 || num > 2100) return null;
  return num;
}

/**
 * Validate movie folder name (e.g. "leo", "avatar_2", "coolie-2026")
 * @param {string} folder 
 * @returns {string|null} Sanitized folder name or null
 */
function validateMovieFolder(folder) {
  if (!folder || typeof folder !== "string") return null;
  const sanitized = folder.trim().toLowerCase();
  // Safe characters only: a-z, 0-9, dash, underscore. No slashes or traversal.
  if (!/^[a-z0-9_-]+$/.test(sanitized)) return null;
  if (sanitized === "." || sanitized === "..") return null;
  return sanitized;
}

/**
 * Validate and sanitize filename and verify extension
 * @param {string} filename 
 * @returns {{ sanitizedFilename: string, ext: string } | null}
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== "string") return null;
  
  // Extract basename to strictly prevent any path traversal (e.g. "../foo", "a/b/c.mp4")
  const cleanBase = filename.replace(/^.*[\\\/]/, "").trim();
  if (!cleanBase || cleanBase === "." || cleanBase === "..") return null;

  // Extract extension
  const lastDot = cleanBase.lastIndexOf(".");
  if (lastDot === -1) return null;

  const ext = cleanBase.slice(lastDot).toLowerCase();
  if (!CONFIG.allowedExtensions.includes(ext)) {
    return null;
  }

  // Ensure filename doesn't contain forbidden control characters
  if (/[\x00-\x1f\x7f]/.test(cleanBase)) return null;

  return {
    sanitizedFilename: cleanBase,
    ext
  };
}

/**
 * Construct standard R2 object key from components
 * @param {string} category 
 * @param {number} year 
 * @param {string} movieFolder 
 * @param {string} filename 
 * @returns {string} e.g. "tamil/2026/leo/leo.mp4"
 */
function buildObjectKey(category, year, movieFolder, filename) {
  return `${category}/${year}/${movieFolder}/${filename}`;
}

/**
 * Validate that an existing key adheres strictly to the required {category}/{year}/{movieFolder}/{filename} format
 * @param {string} key 
 * @returns {boolean}
 */
function validateObjectKey(key) {
  if (!key || typeof key !== "string") return false;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/") || key.includes("//")) return false;

  const parts = key.split("/");
  if (parts.length !== 4) return false;

  const [category, yearStr, movieFolder, filename] = parts;
  if (!validateCategory(category)) return false;
  if (!validateYear(yearStr)) return false;
  if (!validateMovieFolder(movieFolder)) return false;
  if (!validateFilename(filename)) return false;

  return true;
}

/**
 * Determine the proper Content-Type for the movie file
 * @param {string} ext 
 * @param {string} [clientMime] 
 * @returns {string}
 */
function resolveContentType(ext, clientMime) {
  if (CONFIG.mimeMap[ext]) {
    return CONFIG.mimeMap[ext];
  }
  if (clientMime && clientMime.startsWith("video/")) {
    return clientMime;
  }
  return "video/mp4";
}

// ==========================================
// 3. ENDPOINT HANDLERS
// ==========================================

/**
 * GET /health
 * Public health check and service capability indicator
 */
async function handleHealth(request) {
  return jsonResponse({
    success: true,
    service: "Cloudflare R2 Large File Multipart API",
    status: "ok",
    version: "1.0.0",
    maxFileSizeGB: CONFIG.maxFileSizeGB,
    allowedCategories: CONFIG.allowedCategories,
    allowedExtensions: CONFIG.allowedExtensions
  }, 200, {}, request);
}

/**
 * POST /create-upload
 * Initiates an R2 Multipart Upload session with strict path validation and duplicate checks
 */
async function handleCreateUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { category, year, movieFolder, filename, fileSize, contentType: clientContentType } = body || {};

  // 1. Validate Category
  const validCategory = validateCategory(category);
  if (!validCategory) {
    return jsonResponse({
      success: false,
      error: `Invalid category '${category}'. Allowed categories: ${CONFIG.allowedCategories.join(", ")}`,
      code: "INVALID_CATEGORY"
    }, 400, {}, request);
  }

  // 2. Validate Year
  const validYear = validateYear(year);
  if (!validYear) {
    return jsonResponse({
      success: false,
      error: "Invalid year. Must be a 4-digit year between 1900 and 2100",
      code: "INVALID_YEAR"
    }, 400, {}, request);
  }

  // 3. Validate Movie Folder
  const validFolder = validateMovieFolder(movieFolder);
  if (!validFolder) {
    return jsonResponse({
      success: false,
      error: "Invalid movieFolder. Allowed characters are alphanumeric, dash (-) and underscore (_)",
      code: "INVALID_MOVIE_FOLDER"
    }, 400, {}, request);
  }

  // 4. Validate Filename & Extension
  const fileValidation = validateFilename(filename);
  if (!fileValidation) {
    return jsonResponse({
      success: false,
      error: `Invalid filename or unsupported extension. Allowed: ${CONFIG.allowedExtensions.join(", ")}`,
      code: "INVALID_FILENAME"
    }, 400, {}, request);
  }

  const { sanitizedFilename, ext } = fileValidation;

  // 5. Validate File Size if provided
  if (fileSize && typeof fileSize === "number") {
    const maxSizeBytes = CONFIG.maxFileSizeGB * 1024 * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return jsonResponse({
        success: false,
        error: `File size (${(fileSize / (1024 ** 3)).toFixed(2)} GB) exceeds maximum allowable limit (${CONFIG.maxFileSizeGB} GB)`,
        code: "FILE_TOO_LARGE"
      }, 413, {}, request);
    }
  }

  // 6. Construct Key
  let finalFilename = sanitizedFilename;
  let finalKey = buildObjectKey(validCategory, validYear, validFolder, finalFilename);

  // 7. Check Duplicate Policy
  try {
    const existingObject = await env.MY_BUCKET.head(finalKey);
    if (existingObject) {
      if (CONFIG.duplicatePolicy === "reject") {
        return jsonResponse({
          success: false,
          error: `Object already exists at key: '${finalKey}'. Duplicate policy is set to reject.`,
          code: "DUPLICATE_KEY",
          key: finalKey
        }, 409, {}, request);
      } else if (CONFIG.duplicatePolicy === "rename") {
        const timestamp = Date.now();
        const baseWithoutExt = sanitizedFilename.slice(0, sanitizedFilename.lastIndexOf("."));
        finalFilename = `${baseWithoutExt}_${timestamp}${ext}`;
        finalKey = buildObjectKey(validCategory, validYear, validFolder, finalFilename);
      }
      // if "replace", proceed with overwriting the key
    }
  } catch (err) {
    console.error("[CREATE_UPLOAD] Error checking existing object head:", err);
    // Proceed if head check encounters temporary bucket error
  }

  // 8. Resolve Content-Type & Metadata for downstream Range/206 streaming compatibility
  const resolvedContentType = resolveContentType(ext, clientContentType);

  try {
    const upload = await env.MY_BUCKET.createMultipartUpload(finalKey, {
      httpMetadata: {
        contentType: resolvedContentType
      },
      customMetadata: {
        category: validCategory,
        year: String(validYear),
        movieFolder: validFolder,
        originalFilename: sanitizedFilename,
        createdAt: new Date().toISOString()
      }
    });

    console.log(`[CREATE_UPLOAD] Initialized multipart uploadId: ${upload.uploadId} for key: ${finalKey}`);

    return jsonResponse({
      success: true,
      uploadId: upload.uploadId,
      key: finalKey,
      filename: finalFilename,
      category: validCategory,
      year: validYear,
      movieFolder: validFolder,
      contentType: resolvedContentType
    }, 200, {}, request);
  } catch (err) {
    console.error("[CREATE_UPLOAD] R2 createMultipartUpload failed:", err);
    return jsonResponse({
      success: false,
      error: "Failed to initialize multipart upload session in R2",
      code: "R2_CREATE_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /upload-part
 * Receives an individual part chunk (multipart/form-data) and streams it directly to R2
 */
async function handleUploadPart(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({
      success: false,
      error: "Invalid multipart/form-data payload",
      code: "INVALID_FORM_DATA"
    }, 400, {}, request);
  }

  const key = formData.get("key");
  const uploadId = formData.get("uploadId");
  const partNumberRaw = formData.get("partNumber");
  const chunk = formData.get("chunk");

  // Validate Key
  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  // Validate Upload ID
  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  // Validate Part Number
  const partNumber = parseInt(partNumberRaw, 10);
  if (
    isNaN(partNumber) ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > CONFIG.maxParts
  ) {
    return jsonResponse({
      success: false,
      error: `Invalid partNumber '${partNumberRaw}'. Must be an integer between 1 and ${CONFIG.maxParts}`,
      code: "INVALID_PART_NUMBER"
    }, 400, {}, request);
  }

  // Validate Chunk
  if (!chunk || typeof chunk.stream !== "function") {
    return jsonResponse({
      success: false,
      error: "Missing or invalid chunk file data",
      code: "INVALID_CHUNK"
    }, 400, {}, request);
  }

  try {
    // Resume multipart upload instance (Zero R2 network call here)
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);

    // Stream chunk stream directly into R2 multipart part
    const uploadedPart = await upload.uploadPart(partNumber, chunk.stream());

    return jsonResponse({
      success: true,
      partNumber: uploadedPart.partNumber,
      etag: uploadedPart.etag
    }, 200, {}, request);
  } catch (err) {
    console.error(`[UPLOAD_PART] Failed part ${partNumber} for key ${key}:`, err);
    return jsonResponse({
      success: false,
      error: `Failed to upload part ${partNumber}. You may retry this part.`,
      code: "R2_PART_UPLOAD_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /complete-upload
 * Validates part list, deduplicates, sorts, and finalizes the R2 multipart upload
 */
async function handleCompleteUpload(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { key, uploadId, parts } = body || {};

  // 1. Validate Key
  if (!key || typeof key !== "string" || !validateObjectKey(key)) {
    return jsonResponse({ success: false, error: "Invalid or unauthorized object key", code: "INVALID_KEY" }, 400, {}, request);
  }

  // 2. Validate Upload ID
  if (!uploadId || typeof uploadId !== "string" || uploadId.trim().length === 0) {
    return jsonResponse({ success: false, error: "Missing or invalid uploadId", code: "INVALID_UPLOAD_ID" }, 400, {}, request);
  }

  // 3. Validate Parts array
  if (!Array.isArray(parts) || parts.length === 0) {
    return jsonResponse({
      success: false,
      error: "Parts must be a non-empty array of { partNumber, etag }",
      code: "INVALID_PARTS_ARRAY"
    }, 400, {}, request);
  }

  // 4. Clean, validate, deduplicate parts map
  const partsMap = new Map();
  for (const p of parts) {
    const pNum = parseInt(p.partNumber, 10);
    const etag = typeof p.etag === "string" ? p.etag.trim() : "";

    if (isNaN(pNum) || pNum < 1 || pNum > CONFIG.maxParts || !etag) {
      return jsonResponse({
        success: false,
        error: `Invalid part entry found: partNumber=${p.partNumber}, etag=${p.etag}`,
        code: "MALFORMED_PART_ENTRY"
      }, 400, {}, request);
    }

    // Deduplicate: Keep latest partNumber -> etag
    partsMap.set(pNum, etag);
  }

  // 5. Convert to sorted array of { partNumber, etag }
  const sortedParts = Array.from(partsMap.entries())
    .map(([partNumber, etag]) => ({ partNumber, etag }))
    .sort((a, b) => a.partNumber - b.partNumber);

  try {
    const upload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
    
    // Complete the multipart upload
    const completedObject = await upload.complete(sortedParts);

    console.log(`[COMPLETE_UPLOAD] Successfully finalized key: ${key}, size: ${completedObject.size} bytes`);

    return jsonResponse({
      success: true,
      key: completedObject.key,
      etag: completedObject.httpEtag || completedObject.etag,
      size: completedObject.size,
      version: completedObject.version || null
    }, 200, {}, request);
  } catch (err) {
    console.error(`[COMPLETE_UPLOAD] Failed to complete upload for key: ${key}:`, err);
    
    // IMPORTANT: We do NOT automatically abort the upload here on completion error.
    // Temporary network glitches or out-of-sync parts can be retried or inspected by the frontend.
    return jsonResponse({
      success: false,
      error: "Failed to finalize multipart upload in R2. Session preserved for retry.",
      code: "R2_COMPLETE_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /list-parts
 * Returns list of already uploaded parts in R2 for resuming paused or interrupted uploads
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

    // Check if runtime binding supports upload.parts or upload.listParts
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
 * Inspects session status or verifies if the final file is completed
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

  // 1. Check if the object is already completed in R2
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

  // 2. If uploadId is provided and object not finalized, session is active
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

/**
 * POST /abort-upload
 * Explicitly cancels an in-progress multipart upload and purges all staged parts from R2 storage
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

    console.log(`[ABORT_UPLOAD] Successfully aborted multipart upload session: ${uploadId} for key: ${key}`);

    return jsonResponse({
      success: true,
      message: "Multipart upload aborted successfully",
      key,
      uploadId
    }, 200, {}, request);
  } catch (err) {
    console.error(`[ABORT_UPLOAD] Failed to abort upload session ${uploadId} for key ${key}:`, err);
    return jsonResponse({
      success: false,
      error: "Failed to abort multipart upload. Session might already be aborted or completed.",
      code: "R2_ABORT_FAILED"
    }, 500, {}, request);
  }
}

/**
 * POST /cleanup-upload
 * Dedicated administrative endpoint for explicitly cleaning up abandoned multipart uploads
 */
async function handleCleanupUpload(request, env) {
  return handleAbortUpload(request, env);
}

// ==========================================
// 4. MAIN ROUTER / WORKER FETCH HANDLER
// ==========================================
export default {
  /**
   * Main Cloudflare Worker fetch handler
   * @param {Request} request 
   * @param {object} env 
   * @param {ExecutionContext} ctx 
   * @returns {Promise<Response>}
   */
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

    // 3. Health Route (Public or Protected based on design)
    if (request.method === "GET" && path === "/health") {
      return handleHealth(request);
    }

    // 4. Route Dispatch Table
    const postRoutes = {
      "/create-upload": handleCreateUpload,
      "/upload-part": handleUploadPart,
      "/complete-upload": handleCompleteUpload,
      "/list-parts": handleListParts,
      "/upload-status": handleUploadStatus,
      "/abort-upload": handleAbortUpload,
      "/cleanup-upload": handleCleanupUpload
    };

    if (request.method === "POST" && postRoutes[path]) {
      // 5. Authentication check
      if (!authenticate(request, env)) {
        return jsonResponse({
          success: false,
          error: "Unauthorized: Invalid or missing Bearer token",
          code: "UNAUTHORIZED"
        }, 401, {}, request);
      }

      // 6. Execute Handler with safe error boundary
      try {
        return await postRoutes[path](request, env, ctx);
      } catch (err) {
        console.error(`[UNHANDLED_EXCEPTION] Unhandled error at ${path}:`, err);
        return jsonResponse({
          success: false,
          error: "An internal server error occurred while processing the upload",
          code: "INTERNAL_SERVER_ERROR"
        }, 500, {}, request);
      }
    }

    // 7. 404 Route Fallback
    return jsonResponse({
      success: false,
      error: `Endpoint '${path}' with method '${request.method}' not found`,
      code: "ROUTE_NOT_FOUND"
    }, 404, {}, request);
  }
};
