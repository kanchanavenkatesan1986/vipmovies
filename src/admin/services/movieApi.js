import { api } from './api';
import { cacheManager } from './cacheManager';
import { notifyCatalogChanged } from './syncManager';

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
  'status',
  'contentType',
  'episodes'
];

export function sanitizeMoviePayload(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  for (const col of MOVIE_COLUMNS) {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  }
  // Default contentType
  if (!sanitized.contentType) {
    sanitized.contentType = (Array.isArray(sanitized.episodes) && sanitized.episodes.length > 0) ? 'series' : 'movie';
  }
  // Default episodes array
  if (sanitized.episodes === undefined) {
    sanitized.episodes = sanitized.contentType === 'series' ? [] : [];
  } else if (typeof sanitized.episodes === 'string') {
    try {
      sanitized.episodes = JSON.parse(sanitized.episodes);
    } catch {
      sanitized.episodes = [];
    }
  }
  return sanitized;
}

/**
 * Extract the numeric suffix from a movie ID.
 * e.g. 'tamil-2026-00042' → 42
 */
function getMovieNumericOrder(id) {
  if (!id) return 0;
  const str = String(id);
  // Try dash-separated format: tamil-2026-00042
  const dashMatch = str.match(/-(\d+)$/);
  if (dashMatch) return parseInt(dashMatch[1], 10) || 0;
  // Try underscore-separated format
  const parts = str.split('_');
  return parseInt(parts[parts.length - 1], 10) || 0;
}

/**
 * Extract the ID prefix from a table name.
 * e.g. 'tamil_2026' → 'tamil-2026'
 */
function getIdPrefix(table) {
  return String(table).replace(/_/g, '-');
}

/**
 * Build a padded movie ID: prefix-00001
 */
function buildMovieId(table, num) {
  const prefix = getIdPrefix(table);
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

// Use centralized syncManager for all catalog notifications
const triggerCatalogSync = (table, action, detail = {}) =>
  notifyCatalogChanged(table, action, detail);

export const movieApi = {
  // Fetch all movies for a given table (respects forceRefresh for memory caching)
  async getMovies(table, force = false) {
    return await cacheManager.getTable(table, force);
  },

  // Fetch a single movie
  async getMovie(table, id) {
    const response = await api.get(`/api/${table}/${id}`);
    return response.data || response;
  },

  /**
   * Create a new movie.
   *
   * Rule: New movie always gets ID 1 (prefix-00001).
   * All existing movies shift down by +1: existing 00001 → 00002, 00002 → 00003, ..., 00M → 00(M+1).
   * D1 row order: Row 1 = new movie (ID 00001), Row 2 = old ID 00001 (ID 00002), ...
   */
  async createMovie(table, data) {
    const payload = sanitizeMoviePayload(data);

    // Live-fetch current movies to determine existing sequence
    const existing = await cacheManager.getTable(table, true);
    const sorted = [...(existing || [])].sort((a, b) => getMovieNumericOrder(a.id) - getMovieNumericOrder(b.id));
    const M = sorted.length;

    if (M === 0) {
      // No existing movies: just insert with ID 1
      const newId = buildMovieId(table, 1);
      const newPayload = { ...payload, id: newId };
      await api.post(`/api/${table}`, newPayload);
      triggerCatalogSync(table, 'create', { record: newPayload });
      return newPayload;
    }

    // Use temp IDs to avoid conflicts during shift
    const tempBase = `tmp-${Date.now()}`;

    // Step 1: Move all existing records to temp IDs
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const tempId = `${tempBase}-${i}`;
      const tempPayload = sanitizeMoviePayload({ ...m, id: tempId });
      await api.post(`/api/${table}`, tempPayload);
    }

    // Step 2: Delete original records
    for (const m of sorted) {
      await api.delete(`/api/${table}/${m.id}`).catch(() => {});
    }

    // Step 3: Insert new movie at ID 1
    const newId = buildMovieId(table, 1);
    const newPayload = { ...payload, id: newId };
    await api.post(`/api/${table}`, newPayload);

    // Step 4: Re-insert existing movies at IDs 2, 3, ..., M+1
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const tempId = `${tempBase}-${i}`;
      const shiftedId = buildMovieId(table, i + 2);
      const shiftedPayload = sanitizeMoviePayload({ ...m, id: shiftedId });
      await api.post(`/api/${table}`, shiftedPayload);
      // Clean up temp record
      await api.delete(`/api/${table}/${tempId}`).catch(() => {});
    }

    triggerCatalogSync(table, 'create', { record: newPayload });
    return newPayload;
  },

  // Update an existing movie
  async updateMovie(table, id, data) {
    const payload = sanitizeMoviePayload(data);
    const response = await api.put(`/api/${table}/${id}`, payload);
    const updatedRecord = response.data || { id, ...payload };
    triggerCatalogSync(table, 'update', { record: updatedRecord });
    return updatedRecord;
  },

  // Delete a single movie
  async deleteMovie(table, id) {
    await api.delete(`/api/${table}/${id}`);
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

    tablesAffected.forEach(t => triggerCatalogSync(t, 'bulk_delete', { count: results.successCount }));
    return results;
  },

  /**
   * Arrange / reorder movie IDs according to 1-by-1 click sequence.
   *
   * orderedMovies: movies in click order (1st clicked → position 1, 2nd clicked → position 2...)
   * allMoviesInTable: ALL movies in the same table (including unselected ones)
   *
   * Final assignment:
   *   orderedMovies[0] → prefix-00001   (D1 Row 1)
   *   orderedMovies[1] → prefix-00002   (D1 Row 2)
   *   ...
   *   orderedMovies[K-1] → prefix-000K  (D1 Row K)
   *   remaining unselected movies → prefix-000(K+1)...prefix-000N  (in their existing relative order)
   *
   * D1 physical row order matches ID (Row i = ID i).
   */
  async arrangeMovieIds(table, orderedMovies, allMoviesInTable = null, onProgress = null) {
    if (!Array.isArray(orderedMovies) || orderedMovies.length < 1) {
      throw new Error('At least 1 movie is required to arrange.');
    }

    const reportProgress = (msg, pct) => {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    reportProgress('Fetching current movie data from database...', 5);

    // Live-fetch all movies in the table if not provided
    const fetchedAll = allMoviesInTable || await cacheManager.getTable(table, true);
    const allSorted = [...(fetchedAll || [])].sort((a, b) => getMovieNumericOrder(a.id) - getMovieNumericOrder(b.id));
    const N = allSorted.length;

    if (N === 0) {
      reportProgress('No movies found in table.', 100);
      return { success: true, count: 0, changes: [] };
    }

    // Build final ordered sequence:
    // Clicked movies in click order (positions 1 to K)
    const selectedIdSet = new Set(orderedMovies.map(m => String(m.id)));
    // Unselected movies in their existing relative order (positions K+1 to N)
    const unselected = allSorted.filter(m => !selectedIdSet.has(String(m.id)));

    // Final sequence: [clicked_1, ..., clicked_K, unselected_1, ..., unselected_N-K]
    const finalSequence = [...orderedMovies, ...unselected];

    reportProgress(`Rearranging ${N} movies in D1 table ${table}...`, 15);

    // Step 1: Move ALL records to temp IDs to avoid constraint conflicts
    const tempBase = `tmp-${Date.now()}`;
    reportProgress('Step 1/3: Moving all movies to temporary slots...', 25);
    for (let i = 0; i < allSorted.length; i++) {
      const m = allSorted[i];
      const tempId = `${tempBase}-${i}`;
      const tempPayload = sanitizeMoviePayload({ ...m, id: tempId });
      try {
        await api.post(`/api/${table}`, tempPayload);
      } catch (e) {
        console.warn(`Failed to create temp movie ${tempId}:`, e);
      }
    }

    // Step 2: Delete original records
    reportProgress('Step 2/3: Clearing original IDs...', 50);
    for (const m of allSorted) {
      await api.delete(`/api/${table}/${m.id}`).catch(() => {});
    }

    // Step 3: Insert finalSequence with IDs prefix-00001, prefix-00002, ..., prefix-000N
    reportProgress('Step 3/3: Writing movies in new order...', 65);
    for (let i = 0; i < finalSequence.length; i++) {
      const m = finalSequence[i];
      const newId = buildMovieId(table, i + 1);
      const newPayload = sanitizeMoviePayload({ ...m, id: newId });
      try {
        await api.post(`/api/${table}`, newPayload);
      } catch (e) {
        console.warn(`Failed to insert movie at position ${i + 1}:`, e);
      }
    }

    // Step 4: Clean up temp IDs
    reportProgress('Cleaning up temporary slots...', 88);
    for (let i = 0; i < allSorted.length; i++) {
      const tempId = `${tempBase}-${i}`;
      await api.delete(`/api/${table}/${tempId}`).catch(() => {});
    }

    // Build change summary
    const changes = [];
    for (let i = 0; i < finalSequence.length; i++) {
      const oldId = finalSequence[i].id;
      const newId = buildMovieId(table, i + 1);
      if (String(oldId) !== String(newId)) changes.push({ oldId, newId });
    }

    triggerCatalogSync(table, 'arrange', { changes, count: changes.length });

    reportProgress('✅ All movie IDs successfully updated across database and pages!', 100);
    return {
      success: true,
      count: changes.length,
      changes,
      items: finalSequence.map((m, idx) => ({ ...m, id: buildMovieId(table, idx + 1) }))
    };
  },

  // Swap IDs of exactly 2 movies
  async swapMovieIds(table, movieA, movieB, allMoviesInTable = null, onProgress = null) {
    return this.arrangeMovieIds(table, [movieA, movieB], allMoviesInTable, onProgress);
  }
};
