/**
 * File Manager Local Preferences & Pinning
 */

const STORAGE_KEYS = {
  VIEW_MODE: 'vip_fm_view_mode',
  SORT_BY: 'vip_fm_sort_by',
  SORT_ORDER: 'vip_fm_sort_order',
  ITEMS_PER_PAGE: 'vip_fm_items_per_page',
  PINNED_KEYS: 'vip_fm_pinned_keys'
};

export const fileManagerStorage = {
  getViewMode() {
    return localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'grid';
  },

  setViewMode(mode) {
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
  },

  getSort() {
    return {
      by: localStorage.getItem(STORAGE_KEYS.SORT_BY) || 'name',
      order: localStorage.getItem(STORAGE_KEYS.SORT_ORDER) || 'asc'
    };
  },

  setSort(by, order = 'asc') {
    localStorage.setItem(STORAGE_KEYS.SORT_BY, by);
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, order);
  },

  getPinnedKeys() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PINNED_KEYS);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  },

  togglePinKey(key) {
    const pinned = this.getPinnedKeys();
    if (pinned.has(key)) {
      pinned.delete(key);
    } else {
      pinned.add(key);
    }
    localStorage.setItem(STORAGE_KEYS.PINNED_KEYS, JSON.stringify(Array.from(pinned)));
    return pinned;
  }
};
