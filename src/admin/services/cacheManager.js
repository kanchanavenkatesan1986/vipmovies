import { api } from './api';

/**
 * cacheManager — Admin panel live-fetch manager.
 *
 * IMPORTANT: The admin panel must ALWAYS fetch live data from the API.
 * No in-memory or localStorage caching for table data.
 * This ensures admin changes are always reflected immediately.
 *
 * The public website uses its own IndexedDB/localStorage caching (src/api.js)
 * which is NOT affected by this file.
 */
export const cacheManager = {
  // Always live-fetch from API — no caching in admin
  async getTable(tableName, _forceRefresh = true) {
    if (!tableName) return [];

    try {
      const response = await api.get(`/api/${tableName}`);
      let records = [];

      if (Array.isArray(response)) {
        records = response;
      } else if (response && Array.isArray(response.data)) {
        records = response.data;
      }

      return records;
    } catch (err) {
      throw err;
    }
  },

  // Always returns null — admin uses live fetches only
  getCached(_tableName) {
    return null;
  },

  // No-op: admin doesn't cache table data locally
  addRecord(_tableName, _newRecord) {},

  // No-op: admin doesn't cache table data locally
  updateRecord(_tableName, _updatedRecord) {},

  // No-op: admin doesn't cache table data locally
  removeRecord(_tableName, _recordId) {},

  // No-op: admin doesn't cache table data locally
  clearCache(_tableName) {}
};
