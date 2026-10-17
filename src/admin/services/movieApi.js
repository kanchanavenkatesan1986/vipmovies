import { api } from './api';
import { cacheManager } from './cacheManager';

const MOVIE_COLUMNS = [
  'id',
  'title',
  'image',
  'release',
  'language',
  'year',
  'category',
  'duration',
  'director',
  'starring',
  'story',
  'p360',
  'p720',
  'p1080',
  'created_at',
  'type',
  'status'
];

export function sanitizeMoviePayload(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  for (const col of MOVIE_COLUMNS) {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  }
  return sanitized;
}

function triggerCatalogSync(table, action, detail = {}) {
  try {
    const versionTimestamp = Date.now();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vip_catalog_version', String(versionTimestamp));
    }
    if (typeof window !== 'undefined') {
      if (window.VersionManager) {
        // downloadAndStore re-pulls from D1 into IndexedDB
        if (typeof window.VersionManager.downloadAndStore === 'function') {
          window.VersionManager.downloadAndStore().catch(e => console.warn('Background IDB sync warning:', e));
        }
        // checkAndUpdate(true) force-bypasses the 10-min rate-limit so the main
        // website auto-refreshes immediately after any admin change.
        if (typeof window.VersionManager.checkAndUpdate === 'function') {
          window.VersionManager.checkAndUpdate(true).catch(e => console.warn('Force version check warning:', e));
        }
      }
      window.dispatchEvent(new CustomEvent('vip_catalog_updated', {
        detail: { table, action, version: versionTimestamp, ...detail }
      }));
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const ch = new BroadcastChannel('vip_catalog_sync');
          ch.postMessage({ type: 'UPDATE', action, table, version: versionTimestamp, ...detail });
          ch.close();
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('Catalog sync broadcast error:', err);
  }
}

export const movieApi = {
  // Fetch all movies for a given table (using cache)
  async getMovies(table, forceRefresh = false) {
    return await cacheManager.getTable(table, forceRefresh);
  },

  // Fetch a single movie
  async getMovie(table, id) {
    // Check cache first
    const cached = cacheManager.getCached(table);
    if (cached) {
      const found = cached.find(m => String(m.id) === String(id));
      if (found) return found;
    }
    const response = await api.get(`/api/${table}/${id}`);
    return response.data || response;
  },

  // Create a new movie
  async createMovie(table, data) {
    const payload = sanitizeMoviePayload(data);
    const response = await api.post(`/api/${table}`, payload);
    const createdRecord = response.data || payload;
    // Update local cache and clear table cache
    cacheManager.clearCache(table);
    triggerCatalogSync(table, 'create', { record: createdRecord });
    return createdRecord;
  },

  // Update an existing movie
  async updateMovie(table, id, data) {
    const payload = sanitizeMoviePayload(data);
    const response = await api.put(`/api/${table}/${id}`, payload);
    const updatedRecord = response.data || { id, ...payload };
    // Invalidate local cache and trigger sync
    cacheManager.clearCache(table);
    triggerCatalogSync(table, 'update', { record: updatedRecord });
    return updatedRecord;
  },

  // Delete a single movie
  async deleteMovie(table, id) {
    await api.delete(`/api/${table}/${id}`);
    cacheManager.clearCache(table);
    triggerCatalogSync(table, 'delete', { id });
    return true;
  },

  // Bulk delete movies grouped by table
  async bulkDeleteMovies(items) {
    // items: [{ table, id }]
    const results = { successCount: 0, failCount: 0 };
    const tablesAffected = new Set();

    for (const item of items) {
      try {
        await api.delete(`/api/${item.table}/${item.id}`);
        tablesAffected.add(item.table);
        results.successCount++;
      } catch (err) {
        console.error(`Failed to delete ${item.id} from ${item.table}:`, err);
        results.failCount++;
      }
    }

    tablesAffected.forEach(t => cacheManager.clearCache(t));
    triggerCatalogSync('multiple', 'bulk_delete', { count: results.successCount });
    return results;
  },

  // Arrange / reorder movie IDs according to chosen sequence (1, 2, 3...)
  async arrangeMovieIds(table, orderedMovies, onProgress = null) {
    if (!Array.isArray(orderedMovies) || orderedMovies.length < 2) {
      throw new Error('At least 2 movies are required to arrange or swap IDs.');
    }

    const reportProgress = (msg, pct) => {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    reportProgress('Analyzing selected movie order...', 5);

    const getMovieNumericOrder = (id) => {
      if (!id) return 0;
      if (typeof window !== 'undefined' && typeof window.getMovieNumber === 'function') {
        return window.getMovieNumber(id);
      }
      const parts = String(id).split('-');
      const numStr = parts[parts.length - 1];
      return parseInt(numStr, 10) || 0;
    };

    // Current IDs in their given order
    const currentIds = orderedMovies.map(m => m.id);

    // Sorted slot IDs (ascending by numeric id suffix)
    const targetIds = [...currentIds].sort((a, b) => getMovieNumericOrder(a) - getMovieNumericOrder(b));

    // Identify which movies actually have an ID change
    const changes = [];
    for (let i = 0; i < orderedMovies.length; i++) {
      const movie = orderedMovies[i];
      const targetId = targetIds[i];
      if (String(movie.id) !== String(targetId)) {
        changes.push({
          movie,
          oldId: movie.id,
          newId: targetId,
          tempId: `${movie.id}__tmp_${Date.now()}_${i}`
        });
      }
    }

    if (changes.length === 0) {
      reportProgress('Selected movies already match this order.', 100);
      return { success: true, count: 0, changes: [] };
    }

    // Step 1: Backup records to temporary slots in parallel
    reportProgress(`Step 1/4: Backing up ${changes.length} movies to temporary slots...`, 25);
    await Promise.all(changes.map(item => {
      const tempPayload = sanitizeMoviePayload({ ...item.movie, id: item.tempId });
      return api.post(`/api/${table}`, tempPayload);
    }));

    // Step 2: Delete original records to release the IDs in parallel
    reportProgress(`Step 2/4: Freeing ID slots in database...`, 50);
    await Promise.all(changes.map(item => {
      return api.delete(`/api/${table}/${item.oldId}`);
    }));

    // Step 3: Insert records with new target IDs in parallel
    reportProgress(`Step 3/4: Writing movies with updated IDs...`, 75);
    await Promise.all(changes.map(item => {
      const newPayload = sanitizeMoviePayload({ ...item.movie, id: item.newId });
      return api.post(`/api/${table}`, newPayload);
    }));

    // Step 4: Clean up temporary backup records in parallel
    reportProgress(`Step 4/4: Finalizing & cleaning up temporary slots...`, 92);
    await Promise.all(changes.map(item => {
      return api.delete(`/api/${table}/${item.tempId}`).catch(err => {
        console.warn(`Could not delete temporary slot ${item.tempId}:`, err);
      });
    }));

    // Clear local cache for this table so fresh data is loaded
    cacheManager.clearCache(table);

    // Sync IndexedDB & broadcast update event across all pages and tabs in milliseconds
    try {
      if (typeof window !== 'undefined') {
        if (window.VersionManager) {
          window.VersionManager.downloadAndStore().catch(e => console.warn('Sync IndexedDB warning:', e));
        }
        window.dispatchEvent(new CustomEvent('vip_catalog_updated', {
          detail: { table, changes }
        }));
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('vip_catalog_sync');
          ch.postMessage({ type: 'UPDATE', detail: { table, changes } });
          ch.close();
        }
      }
    } catch (e) {}

    reportProgress('✅ All movie IDs successfully updated across database and pages!', 100);
    return { success: true, count: changes.length, changes };
  },

  // Swap IDs of exactly 2 movies
  async swapMovieIds(table, movieA, movieB, onProgress = null) {
    return this.arrangeMovieIds(table, [movieA, movieB], onProgress);
  }
};

