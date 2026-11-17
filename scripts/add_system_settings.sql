-- Migration: Create system_settings table for dynamic configuration
-- Run with: npx wrangler d1 execute tvk-movies --file=./scripts/add_system_settings.sql --remote

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Set initial media base URL (api-download worker as default)
INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES ('media_base_url', 'https://api-download.akatsuki-pvt-ltd.workers.dev', datetime('now'));
