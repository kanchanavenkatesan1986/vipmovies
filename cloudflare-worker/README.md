# VIP API — Unified Cloudflare Worker

Single Worker that replaces 3 separate workers: **api-movies**, **api-uploder**, **api-download**.

## Route Map

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/version` | App version + mediaBaseUrl |
| GET | `/api/app` | Full app config (movies, slider, mediaBaseUrl) |
| GET | `/api/stats` | DB stats |
| GET | `/api/settings` | Active media base URL (public) |
| POST | `/api/settings/media-base` | Update media base URL in D1 (authenticated) |
| GET | `/api/ads-config` | Ads config |
| POST | `/api/ads-config` | Update ads config (authenticated) |
| GET | `/api/probe-url` | Probe external URL |
| GET | `/stream/*` | HTTP 206 video streaming (or 302 redirect if R2 not bound) |
| POST | `/upload/create-multipart` | Create R2 multipart upload |
| POST | `/upload/upload-part` | Upload part |
| POST | `/upload/complete-multipart` | Complete multipart upload |
| GET | `/upload/list` | List R2 objects |
| GET/POST/PUT/DELETE | `/api/movies/*` | Movie CRUD via D1 |
| GET/POST/PUT/DELETE | `/api/series/*` | Series CRUD via D1 |

## Bindings Required (`wrangler.toml`)

```toml
name = "vip-api"   # or api-movies / api-uploder / api-download

[vars]
DEFAULT_MEDIA_BASE_URL = "https://api-download.akatsuki-pvt-ltd.workers.dev"

[[d1_databases]]
binding = "DB"
database_name = "tvk-movies"
database_id = "9acf968f-c714-4ca0-ad86-975c889cb58e"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "tvk-movies"
```

## Deploy

```powershell
# Deploy as new vip-api worker
cd cloudflare-worker
npx wrangler deploy

# OR overwrite existing workers with unified code (backwards compat)
cd d:\Akatsuki Pvt Ltd\vipmovies
npx wrangler deploy                 # api-uploder (root wrangler.toml)
cd api-movies && npx wrangler deploy  # api-movies
```

## Run D1 Migration (first time only)

```powershell
cd "d:\Akatsuki Pvt Ltd\vipmovies"
npx wrangler d1 execute tvk-movies --file=./scripts/add_system_settings.sql --remote
```

## Dynamic R2 Switcher — How to Change R2 Account

When your R2 bucket moves to a new Cloudflare account:

1. Upload your R2 object files to the new account with the **same folder structure**
2. Get the new public base URL (e.g. `https://new-r2-account.workers.dev`)
3. Open **Admin Dashboard → Settings**
4. Paste the new URL in **"Active Media / R2 Base URL"**
5. Click **Save** — changes live globally in under 1 minute (D1 TTL cache)

No code changes, no database row updates, no redeployment needed.

## Priority Order for mediaBaseUrl

```
D1 system_settings.media_base_url
  → env.MEDIA_BASE_URL (wrangler secret)
    → env.DEFAULT_MEDIA_BASE_URL (wrangler var)
      → hardcoded fallback
```

## Auth Token

Bearer token for protected endpoints: `VIP_SECURE_TOKEN_2026`  
(also stored in `localStorage('vip_upload_api_token')`)
