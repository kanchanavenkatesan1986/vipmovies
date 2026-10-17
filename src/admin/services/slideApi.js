import { api } from './api';
import { cacheManager } from './cacheManager';
import { notifyCatalogChanged } from './syncManager';

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

  // Ensure title and image are strings
  sanitized.title = String(data.title || '').trim();
  sanitized.image = String(data.image || '').trim();
  sanitized.status = (data.status || 'active').toLowerCase();

  // Cloudflare D1 strictly requires non-empty url field. Fallback to '#' if none provided.
  sanitized.url = (data.url && String(data.url).trim()) ? String(data.url).trim() : '#';

  return sanitized;
}

// Use centralized syncManager for all slide catalog notifications
const triggerSlideCatalogSync = (action, detail = {}) =>
  notifyCatalogChanged(SLIDER_TABLE, action, detail);

export const slideApi = {
  // Fetch all slider items
  async getSlides(forceRefresh = true) {
    return await cacheManager.getTable(SLIDER_TABLE, forceRefresh);
  },

  // Create a new slide
  async createSlide(data) {
    const payload = sanitizeSlidePayload(data);

    // Auto-generate next integer ID if not specified
    if (payload.id === undefined || payload.id === null) {
      try {
        const existing = await cacheManager.getTable(SLIDER_TABLE);
        if (Array.isArray(existing) && existing.length > 0) {
          const maxId = Math.max(...existing.map(s => Number(s.id) || 0));
          payload.id = maxId + 1;
        } else {
          payload.id = 1;
        }
      } catch (e) {
        payload.id = Math.floor(Date.now() / 1000);
      }
    }

    const response = await api.post(`/api/${SLIDER_TABLE}`, payload);
    const created = (response && (response.id !== undefined || response.data?.id !== undefined))
      ? (response.data || response)
      : payload;

    // Invalidate local cache and sync client
    cacheManager.clearCache(SLIDER_TABLE);
    triggerSlideCatalogSync('create', { record: created });
    return created;
  },

  // Update an existing slide
  async updateSlide(id, data) {
    const numId = Number(id);
    const payload = sanitizeSlidePayload({ ...data, id: numId });
    const response = await api.put(`/api/${SLIDER_TABLE}/${numId}`, payload);
    const updated = (response && (response.id !== undefined || response.data?.id !== undefined))
      ? (response.data || response)
      : { id: numId, ...payload };

    cacheManager.clearCache(SLIDER_TABLE);
    triggerSlideCatalogSync('update', { record: updated });
    return updated;
  },

  // Delete a slide
  async deleteSlide(id) {
    const numId = Number(id);
    await api.delete(`/api/${SLIDER_TABLE}/${numId}`);
    cacheManager.clearCache(SLIDER_TABLE);
    triggerSlideCatalogSync('delete', { id: numId });
    return true;
  },

  // Arrange / reorder slide IDs according to chosen sequence (1, 2, 3...)
  async arrangeSlideIds(orderedSlides, onProgress = null) {
    if (!Array.isArray(orderedSlides) || orderedSlides.length < 2) {
      throw new Error('At least 2 slides are required to arrange or swap IDs.');
    }

    const reportProgress = (msg, pct) => {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    reportProgress('Analyzing selected banner sequence...', 5);

    // Current IDs in their given order
    const currentIds = orderedSlides.map(s => Number(s.id));

    // Target slot IDs sorted in ascending order
    const targetIds = [...currentIds].sort((a, b) => a - b);

    // Identify which slides actually need an ID change
    const changes = [];
    for (let i = 0; i < orderedSlides.length; i++) {
      const slide = orderedSlides[i];
      const targetId = targetIds[i];
      if (Number(slide.id) !== Number(targetId)) {
        changes.push({
          slide,
          oldId: Number(slide.id),
          newId: targetId,
          // Use safe negative temporary IDs so autoincrement sequence is not affected
          tempId: -100 - i
        });
      }
    }

    if (changes.length === 0) {
      reportProgress('Selected slides already match this order.', 100);
      return { success: true, count: 0, changes: [] };
    }

    // Step 1: Backup records to negative temporary slots in parallel
    reportProgress(`Step 1/4: Backing up ${changes.length} slides to temporary slots...`, 25);
    await Promise.all(changes.map(item => {
      const tempPayload = sanitizeSlidePayload({ ...item.slide, id: item.tempId });
      return api.post(`/api/${SLIDER_TABLE}`, tempPayload);
    }));

    // Step 2: Delete original records to release the IDs in parallel
    reportProgress(`Step 2/4: Freeing slide ID slots in database...`, 50);
    await Promise.all(changes.map(item => {
      return api.delete(`/api/${SLIDER_TABLE}/${item.oldId}`);
    }));

    // Step 3: Insert records with new target IDs in parallel
    reportProgress(`Step 3/4: Writing slides with updated IDs...`, 75);
    await Promise.all(changes.map(item => {
      const newPayload = sanitizeSlidePayload({ ...item.slide, id: item.newId });
      return api.post(`/api/${SLIDER_TABLE}`, newPayload);
    }));

    // Step 4: Clean up temporary backup records in parallel
    reportProgress(`Step 4/4: Finalizing & cleaning up temporary slots...`, 92);
    await Promise.all(changes.map(item => {
      return api.delete(`/api/${SLIDER_TABLE}/${item.tempId}`).catch(err => {
        console.warn(`Could not delete temporary slot ${item.tempId}:`, err);
      });
    }));

    // Clear local cache for slider table so fresh data is loaded
    cacheManager.clearCache(SLIDER_TABLE);
    triggerSlideCatalogSync('arrange', { changes });

    reportProgress('✅ All slide IDs successfully updated across homepage and database!', 100);
    return { success: true, count: changes.length, changes };
  },

  // Swap IDs of exactly 2 slides
  async swapSlideIds(slideA, slideB, onProgress = null) {
    return this.arrangeSlideIds([slideA, slideB], onProgress);
  },

  // Bulk delete slides
  async bulkDeleteSlides(ids) {
    const results = { successCount: 0, failCount: 0 };
    for (const id of ids) {
      try {
        const numId = Number(id);
        await api.delete(`/api/${SLIDER_TABLE}/${numId}`);
        results.successCount++;
      } catch (err) {
        console.error(`Failed to delete slide ${id}:`, err);
        results.failCount++;
      }
    }
    cacheManager.clearCache(SLIDER_TABLE);
    triggerSlideCatalogSync('bulk_delete', { count: results.successCount, ids });
    return results;
  }
};
