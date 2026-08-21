import { api } from './api';
import { cacheManager } from './cacheManager';

const SLIDER_TABLE = 'slider';

export const slideApi = {
  // Fetch all slider items
  async getSlides(forceRefresh = false) {
    return await cacheManager.getTable(SLIDER_TABLE, forceRefresh);
  },

  // Create a new slide
  async createSlide(data) {
    const response = await api.post(`/api/${SLIDER_TABLE}`, data);
    const created = response.data || data;
    cacheManager.addRecord(SLIDER_TABLE, created);
    return created;
  },

  // Update an existing slide
  async updateSlide(id, data) {
    const response = await api.put(`/api/${SLIDER_TABLE}/${id}`, data);
    const updated = response.data || { id, ...data };
    cacheManager.updateRecord(SLIDER_TABLE, updated);
    return updated;
  },

  // Delete a slide
  async deleteSlide(id) {
    await api.delete(`/api/${SLIDER_TABLE}/${id}`);
    cacheManager.removeRecord(SLIDER_TABLE, id);
    return true;
  }
};
