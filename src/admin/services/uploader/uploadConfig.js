/**
 * Upload Manager Configuration
 * Centralized settings and endpoint definitions for Cloudflare R2 Multipart Worker API
 */

export const DEFAULT_UPLOAD_CONFIG = {
  // Worker Base URL (Can be overridden via .env VITE_UPLOAD_API_BASE or in Settings UI)
  apiBase: import.meta.env.VITE_UPLOAD_API_BASE || 'https://api-uploud.akatsuki-pvt-ltd.workers.dev',

  // Media / Playback Domain for previewing completed uploads
  mediaBaseUrl: import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.vipmovies.in',

  // Endpoints matching worker.js
  endpoints: {
    create: '/create-upload',
    uploadPart: '/upload-part',
    complete: '/complete-upload',
    abort: '/abort-upload',
    listParts: '/list-parts',
    status: '/upload-status',
    cleanup: '/cleanup-upload',
    health: '/health'
  },

  // Allowed Categories
  allowedCategories: [
    { id: 'tamil', label: 'Tamil' },
    { id: 'hollywood', label: 'Hollywood' },
    { id: 'bollywood', label: 'Bollywood' },
    { id: 'telugu', label: 'Telugu' },
    { id: 'malayalam', label: 'Malayalam' },
    { id: 'kannada', label: 'Kannada' }
  ],

  // Allowed File Extensions
  allowedExtensions: ['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi'],

  // Year options generator
  years: ['2026', '2025', '2024', '2023', '2022', '2021', '2020'],

  // Schedular & Concurrency Defaults
  maxActiveFiles: 3,                 // Maximum active files uploading in parallel
  partsPerFile: 4,                   // Number of concurrent chunk uploads per file
  maxConcurrentParts: 12,            // Global maximum simultaneous network requests (3 x 4 = 12)
  
  // Chunking
  partSizeMB: 50,                    // 50 MB default chunk size (Options: 25, 50, 100, 200)
  
  // Reliability & Retry
  maxRetries: 5,                     // Max retry attempts per failed part
  retryDelaySeconds: 2,              // Base retry delay in seconds
  exponentialBackoff: true,          // Use exponential backoff (2s, 4s, 8s...)
  requestTimeoutSeconds: 120,        // Per-part request timeout (seconds)
  
  // Automation Flags
  autoStart: false,                  // Auto-start uploads upon adding to queue
  autoStartNext: true,               // Auto-start next queued file when active finishes
  autoResumeOnNetwork: true,         // Automatically resume on online event
  verifyPartsOnResume: true,         // Query /list-parts on R2 before uploading missing chunks

  // Duplicate policy: "reject" | "replace" | "rename"
  duplicatePolicy: 'reject',

  // Maximum file size limit in GB
  maxFileSizeGB: 50,

  // Destination key template
  keyTemplate: '{category}/{year}/{movieFolder}/{filename}'
};
