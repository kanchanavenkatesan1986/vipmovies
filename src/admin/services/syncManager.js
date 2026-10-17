/**
 * syncManager.js — Admin-side catalog sync manager.
 *
 * After any admin CRUD operation (add/edit/delete on movies or slides):
 *  1. Bumps localStorage 'vip_catalog_version' with Date.now()
 *  2. Broadcasts 'vip_catalog_updated' CustomEvent on this window
 *  3. Posts to BroadcastChannel('vip_catalog_sync') → other tabs / main website
 *  4. Calls window.VersionManager.downloadAndStore() if available (updates main-site IndexedDB)
 *  5. Calls window.VersionManager.checkAndUpdate(true) if available (force version check)
 */

const CHANNEL_NAME = 'vip_catalog_sync';
const LS_VERSION_KEY = 'vip_catalog_version';

/**
 * Bump the catalog version and notify all tabs/pages.
 * @param {string} table  - DB table affected (e.g. 'tamil_2026', 'slider')
 * @param {string} action - Operation type: 'create' | 'update' | 'delete' | 'bulk_delete' | 'arrange'
 * @param {object} [detail] - Extra payload to include in the event
 */
export function notifyCatalogChanged(table, action, detail = {}) {
  try {
    const version = Date.now();

    // 1. Persist new version in localStorage so VersionManager picks it up
    try {
      localStorage.setItem(LS_VERSION_KEY, String(version));
    } catch (e) {}

    const payload = { table, action, version, ...detail };

    // 2. Broadcast to all tabs via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage({ type: 'CATALOG_UPDATE', ...payload });
        ch.close();
      }
    } catch (e) {}

    // 3. Fire CustomEvent on this window (for AppContext on main site if co-located)
    try {
      window.dispatchEvent(new CustomEvent('vip_catalog_updated', { detail: payload }));
    } catch (e) {}

    // 4. Trigger VersionManager re-sync if main-site api.js is loaded in this context
    try {
      if (window.VersionManager) {
        if (typeof window.VersionManager.downloadAndStore === 'function') {
          window.VersionManager.downloadAndStore()
            .catch(e => console.warn('[syncManager] downloadAndStore warning:', e));
        }
        if (typeof window.VersionManager.checkAndUpdate === 'function') {
          window.VersionManager.checkAndUpdate(true)
            .catch(e => console.warn('[syncManager] checkAndUpdate warning:', e));
        }
      }
    } catch (e) {}

  } catch (err) {
    console.warn('[syncManager] notifyCatalogChanged error:', err);
  }
}

/**
 * Dispatch an optimistic (instant, pre-DB) update event.
 * Used by admin CRUD handlers to update state in AppContext immediately.
 * @param {string} type - e.g. 'movie_add', 'movie_edit', 'movie_delete', 'slide_add', etc.
 * @param {object} [detail] - Extra payload (item, id, ids, table, etc.)
 */
export function dispatchOptimisticUpdate(type, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent('vip_catalog_optimistic_update', {
      detail: { type, ...detail }
    }));

    // Also broadcast to other tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel(CHANNEL_NAME);
        ch.postMessage({ type: 'OPTIMISTIC_UPDATE', updateType: type, ...detail });
        ch.close();
      }
    } catch (e) {}
  } catch (err) {
    console.warn('[syncManager] dispatchOptimisticUpdate error:', err);
  }
}
