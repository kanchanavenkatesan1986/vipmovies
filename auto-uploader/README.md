# ⚡ VIP Movies Auto-Stream Uploader

Automated JIT (Just-In-Time) Pipeline that extracts direct video links from **isaiDub** (Movies & Series) and streams them straight into **Cloudflare R2** via the VIP Movies Upload Worker.

---

## 🚀 Quick Start

From the root project directory:
```bash
npm run uploader
```

Or directly inside `auto-uploader`:
```bash
cd auto-uploader
node server.js
```

Then open your browser at:
👉 **[http://localhost:3456](http://localhost:3456)**

---

## 🌟 Key Features

1. **Dual Content Classification**:
   * **Movies**: Detects version (`Original`, `DVD`, etc.) -> Loops all available qualities (`360p`, `720p`, `1080p`) -> Resolves Download Server 1 chain -> Direct Cloud Upload.
   * **Series**: Detects Season (`Season 1`, `Season 2`) -> Loops all episodes (`Ep 1`, `Ep 2`, etc.) -> Resolves Download Server 1 chain -> Direct Cloud Upload.

2. **Direct Cloudflare R2 Ingestion (Zero Expiry)**:
   * Instead of manual browser uploads, the direct MP4 stream URL is submitted to your Cloudflare Upload Worker (`https://api-uploder.akatsuki-pvt-ltd.workers.dev/upload-from-url`) within **milliseconds** of extraction.
   * Immune to the 5-minute URL expiration window.
   * Server-to-server download speed with live Server-Sent Events (SSE) telemetry.

3. **Resilience & Deduplication**:
   * Auto-closes annoying ad popups and redirect tabs from the source site.
   * Tracks uploaded files in `history.json` to prevent re-uploading duplicates.
   * Supports `replace` or `skip` duplicate policies.

4. **Live Dashboard Control Panel**:
   * Change source listing URL, release year (`2026`), and category (`Hollywood`).
   * Toggle between visible browser (to watch it work) or headless mode (background).
   * Real-time terminal with live speed and progress percentages.

