import { api } from './api';

const cache = {};
const inFlightRequests = {};

export const cacheManager = {
  // Fetch table data with caching & request deduplication
  async getTable(tableName, forceRefresh = false) {
    if (!tableName) return [];

    // 1. Return cached if available and not forced
    if (!forceRefresh && cache[tableName] && cache[tableName].loaded) {
      return cache[tableName].data;
    }

    // 2. Return in-flight promise if already fetching
    if (inFlightRequests[tableName]) {
      return inFlightRequests[tableName];
    }

    // 3. Initiate API request
    const promise = (async () => {
      try {
        const response = await api.get(`/api/${tableName}`);
        let records = [];

        if (Array.isArray(response)) {
          records = response;
        } else if (response && Array.isArray(response.data)) {
          records = response.data;
        }

        cache[tableName] = {
          data: records,
          loaded: true,
          lastFetched: Date.now()
        };

        delete inFlightRequests[tableName];
        return records;
      } catch (err) {
        delete inFlightRequests[tableName];
        throw err;
      }
    })();

    inFlightRequests[tableName] = promise;
    return promise;
  },

  // Get cached data synchronously if available
  getCached(tableName) {
    return cache[tableName]?.data || null;
  },

  // Mutate cache locally after CREATE
  addRecord(tableName, newRecord) {
    if (!cache[tableName]) {
      cache[tableName] = { data: [], loaded: false, lastFetched: Date.now() };
    }
    // Insert at beginning
    cache[tableName].data = [newRecord, ...cache[tableName].data.filter(r => String(r.id) !== String(newRecord.id))];
    cache[tableName].loaded = true;
  },

  // Mutate cache locally after UPDATE
  updateRecord(tableName, updatedRecord) {
    if (!cache[tableName]) return;
    cache[tableName].data = cache[tableName].data.map(r =>
      String(r.id) === String(updatedRecord.id) ? { ...r, ...updatedRecord } : r
    );
  },

  // Mutate cache locally after DELETE
  removeRecord(tableName, recordId) {
    if (!cache[tableName]) return;
    cache[tableName].data = cache[tableName].data.filter(r => String(r.id) !== String(recordId));
  },

  // Clear specific table cache or all cache
  clearCache(tableName) {
    if (tableName) {
      delete cache[tableName];
    } else {
      Object.keys(cache).forEach(k => delete cache[k]);
    }
  }
};
