-- Migration: Add contentType and episodes columns to movie tables in Cloudflare D1
-- Run this in Cloudflare D1 Console or via Wrangler:
-- npx wrangler d1 execute tvk-movies --file=./scripts/add_series_columns.sql --remote

ALTER TABLE tamil_2024 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE tamil_2024 ADD COLUMN episodes TEXT DEFAULT '[]';

ALTER TABLE tamil_2025 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE tamil_2025 ADD COLUMN episodes TEXT DEFAULT '[]';

ALTER TABLE tamil_2026 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE tamil_2026 ADD COLUMN episodes TEXT DEFAULT '[]';

ALTER TABLE hollywood_2024 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE hollywood_2024 ADD COLUMN episodes TEXT DEFAULT '[]';

ALTER TABLE hollywood_2025 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE hollywood_2025 ADD COLUMN episodes TEXT DEFAULT '[]';

ALTER TABLE hollywood_2026 ADD COLUMN contentType TEXT DEFAULT 'movie';
ALTER TABLE hollywood_2026 ADD COLUMN episodes TEXT DEFAULT '[]';
