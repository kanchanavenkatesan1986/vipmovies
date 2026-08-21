import { api } from './api';
import { cacheManager } from './cacheManager';

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
    const response = await api.post(`/api/${table}`, data);
    const createdRecord = response.data || data;
    // Update local cache synchronously
    cacheManager.addRecord(table, createdRecord);
    return createdRecord;
  },

  // Update an existing movie
  async updateMovie(table, id, data) {
    const response = await api.put(`/api/${table}/${id}`, data);
    const updatedRecord = response.data || { id, ...data };
    // Update local cache synchronously
    cacheManager.updateRecord(table, updatedRecord);
    return updatedRecord;
  },

  // Delete a single movie
  async deleteMovie(table, id) {
    await api.delete(`/api/${table}/${id}`);
    // Update local cache synchronously
    cacheManager.removeRecord(table, id);
    return true;
  },

  // Bulk delete movies grouped by table
  async bulkDeleteMovies(items) {
    // items: [{ table, id }]
    const results = { successCount: 0, failCount: 0 };

    for (const item of items) {
      try {
        await api.delete(`/api/${item.table}/${item.id}`);
        cacheManager.removeRecord(item.table, item.id);
        results.successCount++;
      } catch (err) {
        console.error(`Failed to delete ${item.id} from ${item.table}:`, err);
        results.failCount++;
      }
    }

    return results;
  }
};
