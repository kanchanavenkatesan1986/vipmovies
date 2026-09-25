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

  // Allowed movie file extensions (case-insensitive) - Supports ALL formats
  allowedExtensions: [
    // Video Formats
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".m4v",
    ".avi",
    ".ts",
    ".flv",
    ".wmv",
    ".3gp",
    ".m2ts",
    ".vob",
    ".ogv",
    ".mpg",
    ".mpeg",
    // Audio Formats
    ".mp3",
    ".m4a",
    ".aac",
    ".wav",
    ".flac",
    ".ogg",
    ".opus",
    ".wma",
    // Subtitles
    ".srt",
    ".vtt",
    ".sub",
    ".ass",
    ".ssa",
    // Images
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".bmp",
    ".ico",
    ".avif",
    // Documents & Archives
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".pdf",
    ".txt",
    ".json",
    ".nfo",
    ".keep"
  ],

  // MIME type mappings for playback & preview compatibility (Range / 206 Partial Content)
  mimeMap: {
    // Videos
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".avi": "video/x-msvideo",
    ".ts": "video/mp2t",
    ".flv": "video/x-flv",
    ".wmv": "video/x-ms-wmv",
    ".3gp": "video/3gpp",
    ".m2ts": "video/mp2t",
    ".vob": "video/x-ms-vob",
    ".ogv": "video/ogg",
    ".mpg": "video/mpeg",
    ".mpeg": "video/mpeg",
    // Audios
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".wma": "audio/x-ms-wma",
    // Subtitles
    ".srt": "text/plain",
    ".vtt": "text/vtt",
    ".sub": "text/plain",
    ".ass": "text/plain",
    ".ssa": "text/plain",
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    // Archives & Documents
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".json": "application/json",
    ".nfo": "text/plain",
    ".keep": "text/plain"
  },

  // Reverse MIME-to-Extension mapping for format resolution
  mimeToExtMap: {
    "video/mp4": ".mp4",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-m4v": ".m4v",
    "video/x-msvideo": ".avi",
    "video/mp2t": ".ts",
    "video/x-flv": ".flv",
    "video/x-ms-wmv": ".wmv",
    "video/3gpp": ".3gp",
    "video/mpeg": ".mpg",
    "video/ogg": ".ogv",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/x-wav": ".wav",
    "audio/wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/x-ms-wma": ".wma",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
    "image/x-icon": ".ico",
    "image/avif": ".avif",
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/vnd.rar": ".rar",
    "application/x-7z-compressed": ".7z",
    "application/x-tar": ".tar",
    "application/gzip": ".gz",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/vtt": ".vtt"
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
 * Script and dynamic execution extensions that should NEVER be stored as media
 */
const SCRIPT_EXTENSIONS = new Set([
  ".php", ".php3", ".php4", ".php5", ".phtml",
  ".asp", ".aspx", ".ashx", ".asmx",
  ".jsp", ".jspx", ".do", ".action",
  ".cgi", ".pl", ".py", ".sh", ".bash",
  ".html", ".htm", ".cfm"
]);

/**
 * Checks if a filename has a script / dynamic server-side extension
 */
function isScriptExtension(filename) {
  if (!filename || typeof filename !== "string") return false;
  const match = filename.match(/\.[a-zA-Z0-9]+$/i);
  if (!match) return false;
  return SCRIPT_EXTENSIONS.has(match[0].toLowerCase());
}

/**
 * Parses RFC 6266 / RFC 5987 Content-Disposition header to extract genuine filename
 */
function parseContentDispositionFilename(header) {
  if (!header || typeof header !== "string") return null;
  // RFC 5987 / RFC 6266 UTF-8 encoded filename (filename*=UTF-8''...)
  const utf8Match = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (utf8Match) {
    try {
      const decoded = decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ""));
      if (decoded) return decoded;
    } catch {
      const cleaned = utf8Match[1].trim().replace(/^["']|["']$/g, "");
      if (cleaned) return cleaned;
    }
  }
  // Standard filename="..." or filename=...
  const standardMatch = header.match(/filename=(?:(["'])(.*?)\1|([^;\s]+))/i);
  if (standardMatch) {
    const raw = standardMatch[2] || standardMatch[3] || "";
    try {
      const decoded = decodeURIComponent(raw.trim());
      if (decoded) return decoded;
    } catch {
      if (raw.trim()) return raw.trim();
    }
  }
  return null;
}

/**
 * Resolves standard file extension from MIME Content-Type
 */
function extensionFromMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== "string") return null;
  const clean = mimeType.split(";")[0].trim().toLowerCase();
  return CONFIG.mimeToExtMap[clean] || null;
}

/**
 * Inspects a URL string, its query parameters, and base64 payloads to find the authentic filename
 */
function extractFilenameFromUrlString(urlString) {
  if (!urlString || typeof urlString !== "string") return null;
  try {
    const u = new URL(urlString.trim());

    // 1. Check known query parameters (e.g., ?file=..., ?path=..., ?filename=...)
    const paramKeys = ["filename", "file", "name", "path", "title", "f", "download", "target", "source"];
    for (const key of paramKeys) {
      const val = u.searchParams.get(key);
      if (val) {
        const decoded = decodeURIComponent(val).split("/").pop() || "";
        const clean = decoded.split("?")[0].trim();
        if (clean && /\.[a-zA-Z0-9]{2,5}$/.test(clean) && !isScriptExtension(clean)) {
          return clean;
        }
      }
    }

    // 2. Check base64 parameters (e.g. ?dl=c2VydmVy... on dub/uptodub/isai sites)
    for (const [, val] of u.searchParams.entries()) {
      if (val && val.length > 16 && /^[A-Za-z0-9+/=_-]+$/.test(val)) {
        try {
          let b64 = val.replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4 !== 0) b64 += "=";
          const decodedText = atob(b64);
          
          // Match path=... or filename=... or file=...
          const paramMatch = decodedText.match(/(?:path|filename|file|name)=([^&]+)/i);
          if (paramMatch) {
            const candidate = decodeURIComponent(paramMatch[1]).split("/").pop() || "";
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
    const raw = decodeURIComponent(u.pathname.split("/").pop() || "");
    const clean = raw.split("?")[0].trim();
    return clean || null;
  } catch {
    return null;
  }
}

/**
 * Determines user-friendly format name (e.g. MP4, MKV, WEBM)
 */
function getFormatFromFilename(filename, contentType = "") {
  const ext = (filename.match(/\.[0-9a-z]+$/i)?.[0] || "").toLowerCase();
  if (ext === ".mp4") return "MP4 Video";
  if (ext === ".mkv") return "MKV Video";
  if (ext === ".webm") return "WEBM Video";
  if (ext === ".mov") return "QuickTime Video";
  if (ext === ".avi") return "AVI Video";
  if (ext === ".ts") return "MPEG-TS Video";
  if (ext === ".mp3") return "MP3 Audio";
  if (ext === ".m4a") return "M4A Audio";
  if (ext === ".aac") return "AAC Audio";
  if (ext === ".zip" || ext === ".rar" || ext === ".7z") return "Archive";
  if (contentType.includes("mp4")) return "MP4 Video";
  if (contentType.includes("matroska")) return "MKV Video";
  return ext.replace(".", "").toUpperCase() || "Media";
}

/**
 * Resolves the ultimate safe, authentic filename, ensuring no .php/.html format
 */
function resolveFinalFilename({ userFilename, urlExtracted, cdFilename, contentType }) {
  let name = (cdFilename || "").trim();

  // If no Content-Disposition filename, try userFilename (if not a script extension)
  if (!name && userFilename && !isScriptExtension(userFilename)) {
    name = userFilename.trim();
  }

  // If still no valid name, try URL extractor (if not a script extension)
  if (!name && urlExtracted && !isScriptExtension(urlExtracted)) {
    name = urlExtracted.trim();
  }

  // If name is still empty or is a script extension (e.g. download.php, index.php)
  if (!name) {
    const rawBase = (userFilename || urlExtracted || "download").replace(/\.[a-zA-Z0-9]+$/i, "");
    const safeBase = rawBase.replace(/^(download|index|file|stream|get)$/i, `download_${Date.now()}`);
    const ext = extensionFromMimeType(contentType) || ".mp4";
    name = `${safeBase || "download"}${ext}`;
  }

  // Double check and replace any script extension (.php, .aspx, .html) with genuine media format
  if (isScriptExtension(name)) {
    const ext = extensionFromMimeType(contentType) || 
      (urlExtracted && !isScriptExtension(urlExtracted) ? urlExtracted.match(/\.[a-zA-Z0-9]+$/i)?.[0] : null) || 
      ".mp4";
    name = name.replace(/\.[a-zA-Z0-9]+$/i, ext);
  }

  // If the filename has no extension at all, append extension derived from contentType
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(name)) {
    const ext = extensionFromMimeType(contentType) || ".mp4";
    name = `${name}${ext}`;
  }

  return name.replace(/[\/\\]/g, "_").trim();
}

/**
 * Resolves appropriate MIME content type based on extension
 */
function resolveContentType(filename, providedType = null) {
  if (providedType && providedType !== "application/octet-stream" && providedType !== "text/html" && providedType.trim() !== "") {
    return providedType.split(";")[0].trim();
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

/**
 * POST /probe-url & GET /probe-url
 * Probes a remote URL using HEAD/GET to extract real filename, content-length, MIME type and format
 */
async function handleProbeUrl(request, env) {
  let remoteUrl = "";
  if (request.method === "POST") {
    try {
      const body = await request.json();
      remoteUrl = body?.url?.trim() || "";
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON body", code: "INVALID_BODY" }, 400, {}, request);
    }
  } else {
    const urlObj = new URL(request.url);
    remoteUrl = urlObj.searchParams.get("url")?.trim() || "";
  }

  if (!remoteUrl) {
    return jsonResponse({ success: false, error: "Missing 'url' parameter", code: "MISSING_URL" }, 400, {}, request);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(remoteUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return jsonResponse({ success: false, error: "Only http:// and https:// URLs are supported", code: "INVALID_PROTOCOL" }, 400, {}, request);
    }
  } catch (e) {
    return jsonResponse({ success: false, error: `Invalid URL format: ${e.message}`, code: "INVALID_URL" }, 400, {}, request);
  }

  // Pre-analyze URL query params & base64 payloads
  const urlCandidate = extractFilenameFromUrlString(remoteUrl);

  try {
    // Attempt fast HEAD request first
    let remoteResponse = await fetch(parsedUrl.toString(), {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }
    });

    // Some web servers reject HEAD with 405 Method Not Allowed; fallback to Range GET
    if (!remoteResponse.ok && remoteResponse.status === 405) {
      remoteResponse = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Range": "bytes=0-0",
          "Accept": "*/*"
        }
      });
    }

    const cdHeader = remoteResponse.headers.get("Content-Disposition");
    const cdFilename = parseContentDispositionFilename(cdHeader);
    const contentType = remoteResponse.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = remoteResponse.headers.get("Content-Length");
    const parsedLength = contentLength ? parseInt(contentLength, 10) : null;

    const resolvedFilename = resolveFinalFilename({
      userFilename: null,
      urlExtracted: urlCandidate,
      cdFilename: cdFilename,
      contentType: contentType
    });

    const format = getFormatFromFilename(resolvedFilename, contentType);

    return jsonResponse({
      success: true,
      filename: resolvedFilename,
      size: parsedLength,
      sizeFormatted: parsedLength ? formatBytes(parsedLength) : null,
      contentType: contentType.split(";")[0].trim(),
      format,
      isLive: remoteResponse.ok
    }, 200, {}, request);
  } catch (err) {
    // If remote server probe times out or blocks, gracefully return URL candidate info
    const fallbackName = resolveFinalFilename({
      userFilename: null,
      urlExtracted: urlCandidate,
      cdFilename: null,
      contentType: "video/mp4"
    });
    return jsonResponse({
      success: true,
      filename: fallbackName,
      size: null,
      sizeFormatted: null,
      contentType: "video/mp4",
      format: getFormatFromFilename(fallbackName, "video/mp4"),
      probed: false,
      warning: `Probe error: ${err.message}`
    }, 200, {}, request);
  }
}

/**
 * POST /upload-from-url
 * Streams a remote file directly into Cloudflare R2 at the specified folder prefix.
 * Automatically resolves genuine media filename (.mp4, .mkv, etc.) from Content-Disposition
 * and MIME-type, completely preventing saving as .php or script formats.
 */
async function handleUploadFromUrl(request, env, ctx) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Malformed JSON payload", code: "INVALID_JSON" }, 400, {}, request);
  }

  const { url: remoteUrl, prefix = "", filename, duplicatePolicy = "replace" } = body || {};

  if (!remoteUrl || typeof remoteUrl !== "string") {
    return jsonResponse({ success: false, error: "Missing or invalid 'url' parameter", code: "MISSING_URL" }, 400, {}, request);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(remoteUrl.trim());
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return jsonResponse({ success: false, error: "Only http:// and https:// URLs are supported", code: "INVALID_PROTOCOL" }, 400, {}, request);
    }
  } catch (e) {
    return jsonResponse({ success: false, error: `Invalid URL format: ${e.message}`, code: "INVALID_URL" }, 400, {}, request);
  }

  // Pre-analyze URL query params & base64 payloads to identify candidate filename
  const urlCandidate = extractFilenameFromUrlString(remoteUrl.trim());

  // Stream fetch remote file
  let remoteResponse;
  try {
    remoteResponse = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*"
      }
    });
  } catch (fetchErr) {
    return jsonResponse({
      success: false,
      error: `Could not connect to remote URL: ${fetchErr.message}`,
      code: "REMOTE_UNREACHABLE"
    }, 502, {}, request);
  }

  if (!remoteResponse.ok) {
    return jsonResponse({
      success: false,
      error: `Remote server responded with HTTP ${remoteResponse.status}: ${remoteResponse.statusText}`,
      code: "REMOTE_FETCH_ERROR",
      statusCode: remoteResponse.status
    }, 502, {}, request);
  }

  const remoteContentType = remoteResponse.headers.get("Content-Type") || "";
  const cdHeader = remoteResponse.headers.get("Content-Disposition");
  const cdFilename = parseContentDispositionFilename(cdHeader);
  const contentLength = remoteResponse.headers.get("Content-Length");
  const parsedLength = contentLength ? parseInt(contentLength, 10) : null;

  // Protect against expired/404 links that return HTML error pages instead of media
  if (remoteContentType.includes("text/html") && parsedLength !== null && parsedLength < 50000) {
    if (!urlCandidate?.endsWith(".html")) {
      return jsonResponse({
        success: false,
        error: "Remote download link returned an HTML page (link expired or 404) instead of the media file.",
        code: "REMOTE_LINK_EXPIRED"
      }, 400, {}, request);
    }
  }

  // Determine authentic, safe filename — ensuring NO .php or script format is saved
  let cleanFilename = resolveFinalFilename({
    userFilename: filename,
    urlExtracted: urlCandidate,
    cdFilename: cdFilename,
    contentType: remoteContentType
  });

  // Remove illegal characters
  cleanFilename = cleanFilename.replace(/[\/\\]/g, "_").trim();
  if (!cleanFilename) {
    cleanFilename = `imported_${Date.now()}.mp4`;
  }

  const resolvedContentType = resolveContentType(cleanFilename, remoteContentType);

  // Check size limit if Content-Length header is present
  if (parsedLength && parsedLength > CONFIG.maxFileSizeGB * 1024 * 1024 * 1024) {
    return jsonResponse({
      success: false,
      error: `Remote file size (${formatBytes(parsedLength)}) exceeds maximum allowable limit of ${CONFIG.maxFileSizeGB}GB`,
      code: "FILE_TOO_LARGE"
    }, 413, {}, request);
  }

  // Ensure prefix format
  let cleanPrefix = (prefix || "").trim();
  if (cleanPrefix && !cleanPrefix.endsWith("/")) {
    cleanPrefix += "/";
  }
  if (cleanPrefix.startsWith("/")) {
    cleanPrefix = cleanPrefix.substring(1);
  }

  let finalKey = `${cleanPrefix}${cleanFilename}`;
  if (!validateObjectKey(finalKey)) {
    return jsonResponse({ success: false, error: `Invalid target object key '${finalKey}'`, code: "INVALID_KEY" }, 400, {}, request);
  }

  // Handle duplicate policy on the real target key
  try {
    const existing = await env.MY_BUCKET.head(finalKey);
    if (existing) {
      if (duplicatePolicy === "reject" || duplicatePolicy === "skip") {
        return jsonResponse({
          success: false,
          error: `File '${cleanFilename}' already exists in this folder`,
          code: "OBJECT_EXISTS",
          key: finalKey
        }, 409, {}, request);
      } else if (duplicatePolicy === "rename") {
        const dotIdx = cleanFilename.lastIndexOf(".");
        const namePart = dotIdx !== -1 ? cleanFilename.substring(0, dotIdx) : cleanFilename;
        const extPart = dotIdx !== -1 ? cleanFilename.substring(dotIdx) : "";
        cleanFilename = `${namePart}_${Date.now()}${extPart}`;
        finalKey = `${cleanPrefix}${cleanFilename}`;
      }
    }
  } catch (err) {
    console.warn(`[UPLOAD_FROM_URL] Head check warning for ${finalKey}:`, err);
  }

  const wantsStream = body?.stream === true || request.headers.get("Accept")?.includes("text/event-stream");

  // Real-time SSE streaming mode for live percentage (%) and transferred bytes
  if (wantsStream) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const uploadTask = (async () => {
      try {
        let loadedBytes = 0;
        let lastEmit = Date.now();
        const startTime = Date.now();

        // Emit initial start event with resolved filename and key
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: "start",
          total: parsedLength || 0,
          filename: cleanFilename,
          key: finalKey,
          contentType: resolvedContentType
        })}\n\n`)).catch(() => {});

        const counterTransform = new TransformStream({
          transform(chunk, controller) {
            loadedBytes += chunk.length;
            const now = Date.now();
            if (now - lastEmit >= 250) { // update every 250ms for ultra smooth %
              lastEmit = now;
              const elapsedSec = Math.max(0.1, (now - startTime) / 1000);
              const speedBps = Math.round(loadedBytes / elapsedSec);
              const percent = parsedLength ? Math.min(99, Math.round((loadedBytes / parsedLength) * 100)) : null;
              writer.write(encoder.encode(`data: ${JSON.stringify({
                type: "progress",
                loaded: loadedBytes,
                total: parsedLength || 0,
                percent,
                speed: formatBytes(speedBps) + "/s",
                elapsedSeconds: Math.round(elapsedSec)
              })}\n\n`)).catch(() => {});
            }
            controller.enqueue(chunk);
          }
        });

        const countingStream = remoteResponse.body.pipeThrough(counterTransform);

        let streamForR2 = countingStream;
        if (typeof FixedLengthStream !== "undefined" && parsedLength && parsedLength > 0) {
          try {
            streamForR2 = countingStream.pipeThrough(new FixedLengthStream(parsedLength));
          } catch (flErr) {
            console.warn("[FIXED_LENGTH_STREAM_WARN]", flErr);
          }
        }

        const r2Object = await env.MY_BUCKET.put(finalKey, streamForR2, {
          httpMetadata: {
            contentType: resolvedContentType,
            contentDisposition: `inline; filename="${encodeURIComponent(cleanFilename)}"`
          },
          customMetadata: {
            sourceUrl: remoteUrl.substring(0, 500),
            importedAt: new Date().toISOString()
          }
        });

        const finalSize = r2Object.size || loadedBytes || parsedLength || 0;
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: "complete",
          success: true,
          key: finalKey,
          filename: cleanFilename,
          prefix: cleanPrefix,
          size: finalSize,
          sizeFormatted: formatBytes(finalSize),
          contentType: resolvedContentType,
          percent: 100
        })}\n\n`)).catch(() => {});
      } catch (err) {
        console.error("[UPLOAD_FROM_URL SSE ERROR]", err);
        await writer.write(encoder.encode(`data: ${JSON.stringify({
          type: "error",
          error: err.message || "Upload stream failed"
        })}\n\n`)).catch(() => {});
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    if (ctx?.waitUntil) {
      ctx.waitUntil(uploadTask);
    }

    const headers = new Headers({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    const cors = getCorsHeaders(request);
    for (const [k, v] of Object.entries(cors)) {
      headers.set(k, v);
    }
    return new Response(readable, { status: 200, headers });
  }

  // Fallback: Standard non-streaming put
  try {
    const r2Object = await env.MY_BUCKET.put(finalKey, remoteResponse.body, {
      httpMetadata: {
        contentType: resolvedContentType,
        contentDisposition: `inline; filename="${encodeURIComponent(cleanFilename)}"`
      },
      customMetadata: {
        sourceUrl: remoteUrl.substring(0, 500),
        importedAt: new Date().toISOString()
      }
    });

    const finalSize = r2Object.size || parsedLength || 0;

    return jsonResponse({
      success: true,
      key: finalKey,
      filename: cleanFilename,
      prefix: cleanPrefix,
      size: finalSize,
      sizeFormatted: formatBytes(finalSize),
      contentType: resolvedContentType,
      etag: r2Object.httpEtag || r2Object.etag,
      message: `File directly imported and saved as '${cleanFilename}' successfully`
    }, 200, {}, request);
  } catch (err) {
    console.error(`[UPLOAD_FROM_URL] Error streaming from ${remoteUrl} to ${finalKey}:`, err);
    return jsonResponse({
      success: false,
      error: `Failed to upload from URL: ${err.message}`,
      code: "STREAM_FAILED"
    }, 500, {}, request);
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

    // 4b. GET /probe-url
    if (request.method === "GET" && path === "/probe-url") {
      if (!authenticate(request, env)) {
        return jsonResponse({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, 401, {}, request);
      }
      return handleProbeUrl(request, env);
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

      // Direct URL Import & Probe
      "/upload-from-url": handleUploadFromUrl,
      "/probe-url": handleProbeUrl,

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
