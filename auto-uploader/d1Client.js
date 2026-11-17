/**
 * Cloudflare D1 Worker Database Client
 * Interacts with https://api-movies.akatsuki-pvt-ltd.workers.dev
 */

const API_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev';

class D1Client {
  constructor(apiBase = API_BASE) {
    this.apiBase = apiBase.replace(/\/+$/, '');
  }

  async getMovies(table) {
    try {
      const res = await fetch(`${this.apiBase}/api/${table}?_t=${Date.now()}`, {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.warn(`[D1Client] Failed to fetch table ${table}:`, err.message);
      return [];
    }
  }

  /**
   * Upsert movie record:
   * First tries PUT /api/{table}/{id}
   * If not exists, tries POST /api/{table}
   * If duplicate constraint, deletes and re-inserts
   */
  async saveMovie(table, movieData) {
    try {
      // 1. Try PUT (update existing record)
      const putUrl = `${this.apiBase}/api/${table}/${movieData.id}`;
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(movieData)
      });

      if (putRes.ok) {
        return await putRes.json();
      }

      // 2. Try POST (insert new record)
      const postUrl = `${this.apiBase}/api/${table}`;
      const postRes = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(movieData)
      });

      if (postRes.ok) {
        return await postRes.json();
      }

      // 3. Fallback: delete then insert
      await this.deleteMovie(table, movieData.id).catch(() => {});
      const retryRes = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(movieData)
      });

      if (!retryRes.ok) {
        const errText = await retryRes.text().catch(() => '');
        throw new Error(`D1 HTTP ${retryRes.status}: ${errText}`);
      }

      return await retryRes.json();
    } catch (err) {
      console.error(`[D1Client] Save error for ${movieData.id}:`, err.message);
      throw err;
    }
  }

  async deleteMovie(table, id) {
    try {
      const url = `${this.apiBase}/api/${table}/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  /**
   * Complete Table Clean & Full Replace:
   * 1. Fetches all existing rows in the table
   * 2. Deletes each row so table count is cleanly 0
   * 3. Inserts all new clean records starting from 00001
   */
  async clearAndReplaceTable(table, records, progressCb = () => {}) {
    progressCb(`Fetching existing records from table "${table}" to clean...`);
    const existing = await this.getMovies(table);

    if (Array.isArray(existing) && existing.length > 0) {
      progressCb(`Cleaning table "${table}" (deleting ${existing.length} existing records to 0)...`);
      for (let i = 0; i < existing.length; i++) {
        const row = existing[i];
        if (row && row.id) {
          await this.deleteMovie(table, row.id);
        }
      }
      progressCb(`✓ Table "${table}" is completely cleaned to 0.`);
    } else {
      progressCb(`Table "${table}" is already clean (0 records).`);
    }

    progressCb(`Inserting ${records.length} newly sequenced records into "${table}"...`);
    let inserted = 0;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        await this.saveMovie(table, record);
        inserted++;
        progressCb(`[${inserted}/${records.length}] Inserted (${record.id}) "${record.title}"`);
      } catch (err) {
        progressCb(`[WARN] Failed to insert ${record.id}: ${err.message}`);
      }
    }

    progressCb(`✓ Successfully synchronized ${inserted}/${records.length} records into "${table}".`);
    return { success: true, count: inserted };
  }
}

module.exports = { D1Client };
