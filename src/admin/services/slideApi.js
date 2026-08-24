import { api } from './api';
import { cacheManager } from './cacheManager';

const SLIDER_TABLE = 'slider';

const SLIDE_COLUMNS = [
  'id',
  'title',
  'image',
  'url',
  'status',
  'created_at'
];

export function sanitizeSlidePayload(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  for (const col of SLIDE_COLUMNS) {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  }
  return sanitized;
}

export const slideApi = {
  // Fetch all slider items
  async getSlides(forceRefresh = false) {
    return await cacheManager.getTable(SLIDER_TABLE, forceRefresh);
  },

  // Create a new slide
  async createSlide(data) {
    const payload = sanitizeSlidePayload(data);
    const response = await api.post(`/api/${SLIDER_TABLE}`, payload);
    const created = response.data || payload;
    cacheManager.addRecord(SLIDER_TABLE, created);
    return created;
  },

  // Update an existing slide
  async updateSlide(id, data) {
    const payload = sanitizeSlidePayload(data);
    const response = await api.put(`/api/${SLIDER_TABLE}/${id}`, payload);
    const updated = response.data || { id, ...payload };
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

