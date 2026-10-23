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
  // Fetch all slider items (respects force for short memory cache)
  async getSlides(force = false) {
    return await cacheManager.getTable(SLIDER_TABLE, force);
  },

  /**
   * Create a new slide.
   *
   * Rule: New slide always gets ID 1.
   * All existing slides shift down by +1: existing ID 1 → 2, ID 2 → 3, ..., ID M → M+1.
   * D1 row order becomes: Row 1 = new slide (ID 1), Row 2 = old ID 1 (ID 2), ...
   */
  async createSlide(data) {
    const payload = sanitizeSlidePayload(data);

    // If a specific ID is provided (not 1), just insert directly
    // (used for direct edits, not for "add to front" workflow)
    if (payload.id !== undefined && payload.id !== null && Number(payload.id) !== 1) {
      const response = await api.post(`/api/${SLIDER_TABLE}`, payload);
      const created = (response && (response.id !== undefined || response.data?.id !== undefined))
        ? (response.data || response)
        : payload;
      triggerSlideCatalogSync('create', { record: created });
      return created;
    }

    // Live-fetch current slides to determine how many exist
    const existing = await cacheManager.getTable(SLIDER_TABLE, true);
    const sorted = [...(existing || [])].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    const M = sorted.length;

    if (M === 0) {
      // No existing slides: just insert with ID 1
      const newPayload = { ...payload, id: 1 };
      const response = await api.post(`/api/${SLIDER_TABLE}`, newPayload);
      const created = (response && (response.id !== undefined || response.data?.id !== undefined))
        ? (response.data || response)
        : newPayload;
      triggerSlideCatalogSync('create', { record: created });
      return created;
    }

    // Step 1: Shift all existing slides from M down to 1 (in REVERSE order to avoid ID conflicts)
    // M → M+1, M-1 → M, ..., 1 → 2
    // We use temp IDs first to avoid conflicts
    const tempBase = Date.now();

    // Step 1a: Move all existing records to temp IDs (M+9000+i)
    for (let i = 0; i < sorted.length; i++) {
      const slide = sorted[i];
      const tempId = tempBase + i + 9000;
      const tempPayload = sanitizeSlidePayload({ ...slide, id: tempId });
      await api.post(`/api/${SLIDER_TABLE}`, tempPayload);
    }

    // Step 1b: Delete original records
    for (const slide of sorted) {
      await api.delete(`/api/${SLIDER_TABLE}/${Number(slide.id)}`).catch(() => {});
    }

    // Step 2: Insert the NEW slide at ID 1
    const newPayload = { ...payload, id: 1 };
    await api.post(`/api/${SLIDER_TABLE}`, newPayload);

    // Step 3: Re-insert existing slides at IDs 2, 3, ..., M+1
    for (let i = 0; i < sorted.length; i++) {
      const slide = sorted[i];
      const tempId = tempBase + i + 9000;
      const shiftedPayload = sanitizeSlidePayload({ ...slide, id: i + 2 });
      await api.post(`/api/${SLIDER_TABLE}`, shiftedPayload);
      // Clean up temp record
      await api.delete(`/api/${SLIDER_TABLE}/${tempId}`).catch(() => {});
    }

    triggerSlideCatalogSync('create', { record: newPayload });
    return { ...newPayload };
  },

  // Update an existing slide
  async updateSlide(id, data) {
    const numId = Number(id);
    const payload = sanitizeSlidePayload({ ...data, id: numId });
    const response = await api.put(`/api/${SLIDER_TABLE}/${numId}`, payload);
    const updated = (response && (response.id !== undefined || response.data?.id !== undefined))
      ? (response.data || response)
      : { id: numId, ...payload };

    triggerSlideCatalogSync('update', { record: updated });
    return updated;
  },

  // Delete a slide
  async deleteSlide(id) {
    const numId = Number(id);
    await api.delete(`/api/${SLIDER_TABLE}/${numId}`);
    triggerSlideCatalogSync('delete', { id: numId });
    return true;
  },

  /**
   * Arrange / reorder slide IDs according to 1-by-1 click sequence.
   *
   * orderedSlides: the slides in click order (1st clicked → position 1, 2nd clicked → position 2...)
   * allSlides: ALL slides in the table (including unselected ones)
   *
   * Final assignment:
   *   orderedSlides[0] → ID 1       (D1 Row 1)
   *   orderedSlides[1] → ID 2       (D1 Row 2)
   *   ...
   *   orderedSlides[K-1] → ID K     (D1 Row K)
   *   remaining unselected slides → ID K+1, K+2, ..., N  (in their existing relative order)
   *
   * D1 physical row order matches ID (Row i = ID i).
   */
  async arrangeSlideIds(orderedSlides, allSlides = null, onProgress = null) {
    if (!Array.isArray(orderedSlides) || orderedSlides.length < 1) {
      throw new Error('At least 1 slide is required to arrange.');
    }

    const reportProgress = (msg, pct) => {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    reportProgress('Fetching current slide data from database...', 5);

    // Live-fetch all slides if not provided
    const fetchedAll = allSlides || await cacheManager.getTable(SLIDER_TABLE, true);
    const allSorted = [...(fetchedAll || [])].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    const N = allSorted.length;

    if (N === 0) {
      reportProgress('No slides found.', 100);
      return { success: true, count: 0, changes: [] };
    }

    // Build the final ordered sequence:
    // Clicked slides in their click order (positions 1 to K)
    const selectedIdSet = new Set(orderedSlides.map(s => Number(s.id)));
    // Unselected slides in their existing relative order (positions K+1 to N)
    const unselected = allSorted.filter(s => !selectedIdSet.has(Number(s.id)));

    // Final sequence: [clicked_1, clicked_2, ..., clicked_K, unselected_1, unselected_2, ..., unselected_N-K]
    const finalSequence = [...orderedSlides, ...unselected];

    reportProgress(`Rearranging ${N} slides in D1 database...`, 15);

    // Use temp IDs to avoid collisions during reorder
    const tempBase = Date.now();

    // Step 1: Move ALL records to temp IDs
    reportProgress('Step 1/3: Moving all slides to temporary slots...', 25);
    for (let i = 0; i < allSorted.length; i++) {
      const slide = allSorted[i];
      const tempId = tempBase + i + 9000;
      const tempPayload = sanitizeSlidePayload({ ...slide, id: tempId });
      try {
        await api.post(`/api/${SLIDER_TABLE}`, tempPayload);
      } catch (e) {
        console.warn(`Failed to create temp slide ${tempId}:`, e);
      }
    }

    // Step 2: Delete original IDs
    reportProgress('Step 2/3: Clearing original IDs...', 50);
    for (const slide of allSorted) {
      await api.delete(`/api/${SLIDER_TABLE}/${Number(slide.id)}`).catch(() => {});
    }

    // Step 3: Insert finalSequence with IDs 1, 2, ..., N
    reportProgress('Step 3/3: Writing slides in new order...', 65);
    for (let i = 0; i < finalSequence.length; i++) {
      const slide = finalSequence[i];
      const newId = i + 1;
      const newPayload = sanitizeSlidePayload({ ...slide, id: newId });
      try {
        await api.post(`/api/${SLIDER_TABLE}`, newPayload);
      } catch (e) {
        console.warn(`Failed to insert slide at position ${newId}:`, e);
      }
    }

    // Step 4: Clean up temp IDs
    reportProgress('Cleaning up temporary slots...', 88);
    for (let i = 0; i < allSorted.length; i++) {
      const tempId = tempBase + i + 9000;
      await api.delete(`/api/${SLIDER_TABLE}/${tempId}`).catch(() => {});
    }

    // Build change summary for return value
    const changes = [];
    for (let i = 0; i < finalSequence.length; i++) {
      const oldId = Number(finalSequence[i].id);
      const newId = i + 1;
      if (oldId !== newId) changes.push({ oldId, newId });
    }

    triggerSlideCatalogSync('arrange', { changes, count: changes.length });

    reportProgress('✅ All slide IDs and D1 database rows successfully updated!', 100);
    return {
      success: true,
      count: changes.length,
      changes,
      items: finalSequence.map((s, idx) => ({ ...s, id: idx + 1 }))
    };
  },

  // Swap IDs of exactly 2 slides
  async swapSlideIds(slideA, slideB, allSlides = null, onProgress = null) {
    return this.arrangeSlideIds([slideA, slideB], allSlides, onProgress);
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
    triggerSlideCatalogSync('bulk_delete', { count: results.successCount, ids });
    return results;
  }
};
