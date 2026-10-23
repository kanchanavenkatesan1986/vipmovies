import { api } from './api';

/**
 * cacheManager — Admin panel table data manager with short-lived memory cache.
 *
 * Prevents redundant D1 reads during rapid navigation across Admin pages.
 * Defaults to 20-second in-memory cache when forceRefresh is false.
 * Any CRUD mutation passes forceRefresh = true or calls clearCache(table).
 */

const memCache = new Map();
const CACHE_TTL_MS = 20000; // 20 seconds short-lived cache

export const cacheManager = {
  // Fetch table data with short-lived memory cache
  async getTable(tableName, forceRefresh = false) {
    if (!tableName) return [];

    const now = Date.now();
    if (!forceRefresh && memCache.has(tableName)) {
      const entry = memCache.get(tableName);
      if (now - entry.timestamp < CACHE_TTL_MS && Array.isArray(entry.data)) {
        return entry.data;
      }
    }

    try {
      const response = await api.get(`/api/${tableName}`);
      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (response && Array.isArray(response.data)) {
        records = response.data;
      }

      memCache.set(tableName, { data: records, timestamp: now });
      return records;
    } catch (err) {
      throw err;
    }
  },

  // Returns cached records if available
  getCached(tableName) {
    if (memCache.has(tableName)) {
      return memCache.get(tableName).data;
    }
    return null;
  },

  // Invalidate table cache after mutation
  clearCache(tableName) {
    if (tableName) {
      memCache.delete(tableName);
    } else {
      memCache.clear();
    }
  },

  addRecord(tableName, newRecord) {
    this.clearCache(tableName);
  },

  updateRecord(tableName, updatedRecord) {
    this.clearCache(tableName);
  },

  removeRecord(tableName, recordId) {
    this.clearCache(tableName);
  }
};
