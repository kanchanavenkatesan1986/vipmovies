/**
 * VIP Movies - Frontend Data Architecture
 * ========================================
 * IndexedDB-first architecture with silent background version sync.
 * ONLY two API endpoints are ever called from the frontend:
 *   GET /api/version  — lightweight version check
 *   GET /api/app      — full data download (first install or update)
 *
 * Modules:
 *   DatabaseManager   — IndexedDB wrapper with 6 object stores
 *   ApiManager        — fetch wrapper for /api/version and /api/app
 *   VersionManager    — compares versions, triggers background updates
 *   CacheManager      — in-memory Maps for O(1) synchronous lookup
 *   MovieRepository   — read movies, slider, related
 *   SearchRepository  — local full-text search
 *   FavoriteRepository— add/remove/list user favorites
 *   HistoryRepository — record/list/clear watch history (cap 50)
 *   SettingsRepository— persist app settings in IndexedDB
 *   UIManager         — toast notifications, offline overlay, reload
 *   VirtualScroller   — chunk-based IntersectionObserver grid renderer
 */

'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const API_BASE   = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/';
const DB_NAME    = 'vip_movies_db';
const DB_VERSION = 1;

var BASE_YEAR = 2022;
function buildYearList() {
    var y = new Date().getFullYear(), years = [];
    for (; y >= BASE_YEAR; y--) years.push(String(y));
    return years;
}

// ─── DATABASE MANAGER ────────────────────────────────────────────────────────
var DatabaseManager = (function() {
    var db = null;
    var openPromise = null;

    function open() {
        if (db) return Promise.resolve(db);
        if (openPromise) return openPromise;

        openPromise = new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = function(e) {
                var database = e.target.result;

                // movies store — keyPath = id
                if (!database.objectStoreNames.contains('movies')) {
                    var ms = database.createObjectStore('movies', { keyPath: 'id' });
                    ms.createIndex('by_type',     'type',     { unique: false });
                    ms.createIndex('by_year',     'year',     { unique: false });
                    ms.createIndex('by_category', 'category', { unique: false });
                    ms.createIndex('by_status',   'status',   { unique: false });
                }

                // slider store — keyPath = id
                if (!database.objectStoreNames.contains('slider')) {
                    database.createObjectStore('slider', { keyPath: 'id' });
                }

                // metadata store — keyPath = key (e.g. "version", "updated", "count")
                if (!database.objectStoreNames.contains('metadata')) {
                    database.createObjectStore('metadata', { keyPath: 'key' });
                }

                // settings store — keyPath = key
                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }

                // favorites store — keyPath = movieId
                if (!database.objectStoreNames.contains('favorites')) {
                    var favs = database.createObjectStore('favorites', { keyPath: 'movieId' });
                    favs.createIndex('by_savedAt', 'savedAt', { unique: false });
                }

                // history store — keyPath = movieId
                if (!database.objectStoreNames.contains('history')) {
                    var hist = database.createObjectStore('history', { keyPath: 'movieId' });
                    hist.createIndex('by_watchedAt', 'watchedAt', { unique: false });
                }
            };

            req.onsuccess = function(e) {
                db = e.target.result;
                resolve(db);
            };

            req.onerror = function(e) {
                openPromise = null;
                reject(e.target.error);
            };
        });

        return openPromise;
    }

    function getStore(storeName, mode) {
        return open().then(function(database) {
            return database.transaction([storeName], mode).objectStore(storeName);
        });
    }

    function getAll(storeName) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readonly');
                var store = tx.objectStore(storeName);
                var req   = store.getAll();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror   = function() { reject(req.error); };
            });
        });
    }

    function get(storeName, key) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readonly');
                var store = tx.objectStore(storeName);
                var req   = store.get(key);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror   = function() { reject(req.error); };
            });
        });
    }

    function put(storeName, value) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readwrite');
                var store = tx.objectStore(storeName);
                var req   = store.put(value);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror   = function() { reject(req.error); };
            });
        });
    }

    function del(storeName, key) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readwrite');
                var store = tx.objectStore(storeName);
                var req   = store.delete(key);
                req.onsuccess = function() { resolve(); };
                req.onerror   = function() { reject(req.error); };
            });
        });
    }

    function clearStore(storeName) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readwrite');
                var store = tx.objectStore(storeName);
                var req   = store.clear();
                req.onsuccess = function() { resolve(); };
                req.onerror   = function() { reject(req.error); };
            });
        });
    }

    /**
     * Bulk-replaces an entire store in a single transaction (for movies + slider).
     * Much faster than individual puts for large arrays.
     */
    function replaceAll(storeName, records) {
        return open().then(function(database) {
            return new Promise(function(resolve, reject) {
                var tx    = database.transaction([storeName], 'readwrite');
                var store = tx.objectStore(storeName);

                store.clear();
                records.forEach(function(rec) { store.put(rec); });

                tx.oncomplete = function() { resolve(); };
                tx.onerror    = function() { reject(tx.error); };
            });
        });
    }

    return { open, getAll, get, put, del, clearStore, replaceAll };
}());

// ─── API MANAGER ─────────────────────────────────────────────────────────────
var ApiManager = (function() {

    function fetchVersion() {
        return fetch(API_BASE + '/api/version?t=' + Date.now(), {
            cache: 'no-cache'
        })
            .then(function(res) {
                if (!res.ok) throw new Error('Version check failed: ' + res.status);
                return res.json();
            });
    }

    function fetchApp() {
        var controller = new AbortController();
        var timeoutId  = setTimeout(function() { controller.abort(); }, 30000);

        return fetch(API_BASE + '/api/app?t=' + Date.now(), {
            cache: 'no-store',
            signal: controller.signal
        }).then(function(res) {
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error('App fetch failed: ' + res.status);
            return res.json();
        }).then(function(data) {
            if (!data || !data.success || !Array.isArray(data.movies)) {
                throw new Error('Invalid API payload');
            }
            return data;
        });
    }

    return { fetchVersion, fetchApp };
}());

// ─── CACHE MANAGER ───────────────────────────────────────────────────────────
var CacheManager = (function() {
    var _movies  = [];
    var _slider  = [];
    var _byId       = new Map();
    var _byYear     = new Map();
    var _byType     = new Map();
    var _byCategory = new Map();
    var _byStatus   = new Map();
    var _ready = false;

    function normalizeMovie(m) {
        if (!m) return m;
        if (m.p360)       { m.p460 = m.p360; m['460p'] = m.p360; }
        else if (m.p460)  { m.p360 = m.p460; m['460p'] = m.p460; }
        else if (m['460p']){ m.p360 = m['460p']; m.p460 = m['460p']; }
        if (m.p720)       m['720p']  = m.p720;
        else if (m['720p']) m.p720   = m['720p'];
        if (m.p1080)      m['1080p'] = m.p1080;
        else if (m['1080p']) m.p1080 = m['1080p'];
        return m;
    }

    function populate(movies, slider) {
        _movies = movies || [];
        _slider = slider || [];

        _byId.clear();
        _byYear.clear();
        _byType.clear();
        _byCategory.clear();
        _byStatus.clear();

        _movies.forEach(function(m) {
            normalizeMovie(m);

            if (m.id !== undefined && m.id !== null) {
                _byId.set(String(m.id), m);
                _byId.set(Number(m.id), m);
            }

            var year = String(m.year || '').trim();
            if (year) { if (!_byYear.has(year)) _byYear.set(year, []); _byYear.get(year).push(m); }

            var type = String(m.type || '').toLowerCase().trim();
            if (type) { if (!_byType.has(type)) _byType.set(type, []); _byType.get(type).push(m); }

            var cat = String(m.category || '').toLowerCase().trim();
            if (cat) { if (!_byCategory.has(cat)) _byCategory.set(cat, []); _byCategory.get(cat).push(m); }

            var status = String(m.status || '').toLowerCase().trim();
            if (status) { if (!_byStatus.has(status)) _byStatus.set(status, []); _byStatus.get(status).push(m); }
        });

        _ready = true;
    }

    function clear() {
        _movies = []; _slider = [];
        _byId.clear(); _byYear.clear();
        _byType.clear(); _byCategory.clear(); _byStatus.clear();
        _ready = false;
    }

    return {
        populate, clear,
        isReady:      function() { return _ready; },
        getMovies:    function() { return _movies; },
        getSlider:    function() { return _slider; },
        byId:         function(id) { return _byId.get(String(id)) || _byId.get(Number(id)) || null; },
        byYear:       function(y)  { return _byYear.get(String(y).trim()) || []; },
        byType:       function(t)  { return _byType.get(t.toLowerCase().trim()) || []; },
        byCategory:   function(c)  { return _byCategory.get(c.toLowerCase().trim()) || []; },
        byStatus:     function(s)  { return _byStatus.get(s.toLowerCase().trim()) || []; },
    };
}());

// ─── UI MANAGER ──────────────────────────────────────────────────────────────
var UIManager = (function() {

    function showToast(msg, type) {
        var existing = document.getElementById('vip-toast');
        if (existing) existing.remove();

        var iconClass = (type === 'update') ? 'fa-rotate' :
                        (type === 'error')  ? 'fa-circle-exclamation' :
                                              'fa-circle-check';
        var toast = document.createElement('div');
        toast.id = 'vip-toast';
        toast.style.cssText = [
            'position:fixed', 'bottom:90px', 'left:50%', 'transform:translateX(-50%)',
            'background:linear-gradient(135deg,#1a1a2e,#16213e)',
            'border:1px solid var(--accent)', 'color:#fff',
            'padding:10px 18px', 'border-radius:10px', 'font-size:13px',
            'font-weight:600', 'z-index:99999',
            'box-shadow:0 6px 20px rgba(0,0,0,0.5)',
            'display:flex', 'align-items:center', 'gap:8px',
            'font-family:Lexend,sans-serif',
            'transition:opacity 0.4s', 'opacity:1'
        ].join(';');
        toast.innerHTML = '<i class="fa-solid ' + iconClass + '" style="color:var(--accent)"></i> ' + msg;
        document.body.appendChild(toast);

        setTimeout(function() {
            toast.style.opacity = '0';
            setTimeout(function() { toast.remove(); }, 400);
        }, 3000);
    }

    function showOfflineOverlay(retryCallback) {
        var existing = document.getElementById('offline-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'offline-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:#0e0e13', 'z-index:100000',
            'display:flex', 'flex-direction:column',
            'align-items:center', 'justify-content:center',
            'color:#fff', 'font-family:Lexend,sans-serif',
            'padding:20px', 'box-sizing:border-box', 'text-align:center'
        ].join(';');
        overlay.innerHTML = '\
            <div style="max-width:400px;padding:30px;border-radius:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);box-shadow:0 20px 40px rgba(0,0,0,0.5);">\
                <div style="font-size:64px;color:#f5c518;margin-bottom:20px;animation:pulse 2s infinite ease-in-out;">\
                    <i class="fa-solid fa-wifi-slash"></i>\
                </div>\
                <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;">Connection Failed</h2>\
                <p style="color:#a0a0ab;font-size:14px;line-height:1.6;margin-bottom:24px;">Please check your internet connection. Internet is required on first launch to download the movie catalogue.</p>\
                <button id="retry-btn" style="background:#f5c518;color:#000;border:none;padding:12px 30px;font-size:14px;font-weight:700;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">\
                    <i class="fa-solid fa-rotate-right"></i> Try Again\
                </button>\
            </div>\
            <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:0.7}}#retry-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(245,197,24,0.3)}#retry-btn:active{transform:translateY(0)}</style>';
        document.body.appendChild(overlay);

        document.getElementById('retry-btn').addEventListener('click', function() {
            var btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Retrying...';
            retryCallback().then(function() {
                overlay.remove();
            }).catch(function() {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Try Again';
            });
        });
    }

    function removeOfflineOverlay() {
        var el = document.getElementById('offline-overlay');
        if (el) el.remove();
    }

    return { showToast, showOfflineOverlay, removeOfflineOverlay };
}());

// ─── VERSION MANAGER ─────────────────────────────────────────────────────────
var VersionManager = (function() {

    function getLocalVersion() {
        return DatabaseManager.get('metadata', 'version').then(function(rec) {
            return rec ? rec.value : null;
        });
    }

    function saveMetadata(data) {
        return Promise.all([
            DatabaseManager.put('metadata', { key: 'version', value: data.version }),
            DatabaseManager.put('metadata', { key: 'updated', value: data.updated }),
            DatabaseManager.put('metadata', { key: 'count',   value: data.count   })
        ]);
    }

    /**
     * Downloads /api/app, stores to IndexedDB, refreshes CacheManager.
     */
    function downloadAndStore() {
        return ApiManager.fetchApp().then(function(data) {
            var movies = data.movies || [];
            var slider = Array.isArray(data.slider) ? data.slider : [];

            // Assign numeric IDs to slider items if missing
            slider = slider.map(function(s, i) {
                return Object.assign({ id: s.id !== undefined ? s.id : i }, s);
            });

            return Promise.all([
                DatabaseManager.replaceAll('movies', movies),
                DatabaseManager.replaceAll('slider', slider),
                saveMetadata({ version: data.version, updated: data.updated, count: data.count })
            ]).then(function() {
                CacheManager.populate(movies, slider);
                return data;
            });
        });
    }

    /**
     * Silently check version after initial load.
     * If different — download, store, show toast, reload page.
     */
    function checkAndUpdate() {
        return ApiManager.fetchVersion().then(function(serverData) {
            return getLocalVersion().then(function(localVersion) {
                if (String(localVersion) === String(serverData.version)) {
                    // Same version — do nothing
                    return false;
                }
                // Different version — background update
                return downloadAndStore().then(function() {
                    UIManager.showToast('🎬 Movies Updated! Refreshing...', 'update');
                    setTimeout(function() { window.location.reload(); }, 2000);
                    return true;
                });
            });
        }).catch(function(err) {
            // Version check is silent — never block the user
            console.warn('VersionManager: background check failed (offline?)', err);
            return false;
        });
    }

    return { getLocalVersion, downloadAndStore, checkAndUpdate };
}());

// ─── MOVIE REPOSITORY ────────────────────────────────────────────────────────
var MovieRepository = (function() {

    /** Load from IndexedDB into CacheManager, returns Promise. */
    function loadFromDB() {
        return Promise.all([
            DatabaseManager.getAll('movies'),
            DatabaseManager.getAll('slider')
        ]).then(function(results) {
            CacheManager.populate(results[0], results[1]);
            return results[0];
        });
    }

    function getAll()              { return CacheManager.getMovies(); }
    function getSlider()           { return CacheManager.getSlider(); }
    function getById(id)           { return CacheManager.byId(id); }
    function getByYear(year)       { return CacheManager.byYear(year); }
    function getByType(type)       { return CacheManager.byType(type); }
    function getByCategory(cat)    { return CacheManager.byCategory(cat); }
    function getByStatus(status)   { return CacheManager.byStatus(status); }

    function getLatest() {
        return getAll().filter(function(m) {
            return (m.status || '').toLowerCase().trim() !== 'coming soon';
        }).sort(function(a, b) {
            var ya = parseInt(a.year || 0, 10), yb = parseInt(b.year || 0, 10);
            if (yb !== ya) return yb - ya;
            return (b.id || 0) - (a.id || 0);
        });
    }

    function getFeatured() {
        return getAll().filter(function(m) {
            return (m.status || '').toLowerCase().trim() !== 'coming soon';
        });
    }

    function getRelated(movieId, limit) {
        limit = limit || 6;
        var movie = getById(movieId);
        if (!movie) return [];
        return getByType(movie.type).filter(function(m) {
            return String(m.id) !== String(movie.id);
        }).slice(0, limit);
    }

    return {
        loadFromDB, getAll, getSlider, getById, getByYear,
        getByType, getByCategory, getByStatus, getLatest, getFeatured, getRelated
    };
}());

// ─── SEARCH REPOSITORY ───────────────────────────────────────────────────────
var SearchRepository = (function() {
    function search(keyword) {
        var movies = CacheManager.getMovies();
        if (!keyword) return movies;
        var term = keyword.toLowerCase().trim();
        if (!term) return movies;
        return movies.filter(function(m) {
            return (m.title    && m.title.toLowerCase().includes(term))    ||
                   (m.language && m.language.toLowerCase().includes(term)) ||
                   (m.director && m.director.toLowerCase().includes(term)) ||
                   (m.starring && m.starring.toLowerCase().includes(term)) ||
                   (m.year     && String(m.year).includes(term))           ||
                   (m.category && m.category.toLowerCase().includes(term)) ||
                   (m.type     && m.type.toLowerCase().includes(term))     ||
                   (m.story    && m.story.toLowerCase().includes(term));
        });
    }
    return { search };
}());

// ─── FAVORITE REPOSITORY ─────────────────────────────────────────────────────
var FavoriteRepository = (function() {
    function add(movie) {
        return DatabaseManager.put('favorites', {
            movieId:  String(movie.id),
            title:    movie.title,
            type:     movie.type,
            year:     movie.year,
            image:    movie.image,
            status:   movie.status,
            savedAt:  Date.now()
        });
    }

    function remove(movieId) {
        return DatabaseManager.del('favorites', String(movieId));
    }

    function isFavorite(movieId) {
        return DatabaseManager.get('favorites', String(movieId)).then(function(rec) {
            return !!rec;
        });
    }

    function getAll() {
        return DatabaseManager.getAll('favorites').then(function(favs) {
            return favs.sort(function(a, b) { return b.savedAt - a.savedAt; });
        });
    }

    function toggle(movie) {
        return isFavorite(movie.id).then(function(fav) {
            return fav ? remove(movie.id).then(function() { return false; })
                       : add(movie).then(function()    { return true;  });
        });
    }

    function clearAll() {
        return DatabaseManager.clearStore('favorites');
    }

    return { add, remove, toggle, isFavorite, getAll, clearAll };
}());

// ─── HISTORY REPOSITORY ──────────────────────────────────────────────────────
var HistoryRepository = (function() {
    var MAX_HISTORY = 50;

    function record(movie) {
        return DatabaseManager.get('settings', 'saveHistory').then(function(rec) {
            if (rec && rec.value === false) return; // User disabled history
            return DatabaseManager.put('history', {
                movieId:   String(movie.id),
                title:     movie.title,
                type:      movie.type,
                year:      movie.year,
                image:     movie.image,
                status:    movie.status,
                watchedAt: Date.now()
            }).then(function() {
                // Trim to MAX_HISTORY
                return DatabaseManager.getAll('history').then(function(all) {
                    if (all.length <= MAX_HISTORY) return;
                    var sorted = all.sort(function(a, b) { return a.watchedAt - b.watchedAt; });
                    var toDelete = sorted.slice(0, all.length - MAX_HISTORY);
                    return Promise.all(toDelete.map(function(h) {
                        return DatabaseManager.del('history', h.movieId);
                    }));
                });
            });
        });
    }

    function getAll() {
        return DatabaseManager.getAll('history').then(function(hist) {
            return hist.sort(function(a, b) { return b.watchedAt - a.watchedAt; });
        });
    }

    function clearAll() {
        return DatabaseManager.clearStore('history');
    }

    return { record, getAll, clearAll };
}());

// ─── SETTINGS REPOSITORY ─────────────────────────────────────────────────────
var SettingsRepository = (function() {
    var DEFAULTS = {
        quality:     'auto',
        autoplay:    true,
        comingSoon:  true,
        saveHistory: true
    };

    function get(key) {
        return DatabaseManager.get('settings', key).then(function(rec) {
            return rec !== undefined ? rec.value : DEFAULTS[key];
        });
    }

    function set(key, value) {
        return DatabaseManager.put('settings', { key: key, value: value });
    }

    function getAll() {
        return DatabaseManager.getAll('settings').then(function(recs) {
            var out = Object.assign({}, DEFAULTS);
            recs.forEach(function(r) { out[r.key] = r.value; });
            return out;
        });
    }

    function clearAll() {
        return DatabaseManager.clearStore('settings');
    }

    return { get, set, getAll, clearAll };
}());

// ─── VIRTUAL SCROLLER ────────────────────────────────────────────────────────
/**
 * Chunk-based lazy renderer.
 * Renders items in batches using IntersectionObserver sentinel nodes
 * so large lists (1000+ movies) never bloat the DOM at once.
 *
 * Usage:
 *   var vs = new VirtualScroller(container, items, renderFn, { chunkSize: 20 });
 *   vs.init();
 */
function VirtualScroller(container, items, renderFn, options) {
    options = options || {};
    this.container  = container;
    this.items      = items;
    this.renderFn   = renderFn;
    this.chunkSize  = options.chunkSize || 20;
    this.offset     = 0;
    this.observer   = null;
    this.sentinel   = null;
}

VirtualScroller.prototype.init = function() {
    this.container.innerHTML = '';
    this.offset = 0;
    this._renderChunk();
};

VirtualScroller.prototype._renderChunk = function() {
    var self       = this;
    var start      = this.offset;
    var end        = Math.min(start + this.chunkSize, this.items.length);
    var chunk      = this.items.slice(start, end);
    var fragment   = document.createDocumentFragment();

    chunk.forEach(function(item) {
        var el = self.renderFn(item);
        if (el) fragment.appendChild(el);
    });

    // Remove existing sentinel
    if (this.sentinel && this.sentinel.parentNode) {
        this.sentinel.parentNode.removeChild(this.sentinel);
    }
    if (this.observer) {
        this.observer.disconnect();
    }

    this.container.appendChild(fragment);
    this.offset = end;

    // Lazy-load images in newly appended nodes
    if (typeof window.lazyLoadImages === 'function') {
        window.lazyLoadImages();
    }

    if (this.offset < this.items.length) {
        // Create a sentinel div that, when visible, loads next chunk
        this.sentinel = document.createElement('div');
        this.sentinel.style.height = '10px';
        this.container.appendChild(this.sentinel);

        var sentinel = this.sentinel;
        this.observer = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                self.observer.disconnect();
                self._renderChunk();
            }
        }, { rootMargin: '200px' });
        this.observer.observe(sentinel);
    }
};

VirtualScroller.prototype.destroy = function() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    this.sentinel = null;
};

// ─── APPLICATION BOOTSTRAP ───────────────────────────────────────────────────
/**
 * AppLoader — the top-level orchestrator.
 * Call AppLoader.init() from each page.
 *
 * First visit:  downloads /api/app → stores in IndexedDB → populates cache
 * Return visit: loads from IndexedDB → populates cache → then silently checks version
 */
var AppLoader = (function() {
    var _loadPromise = null;

    function init() {
        if (_loadPromise) return _loadPromise;

        _loadPromise = DatabaseManager.open()
            .then(function() {
                return MovieRepository.loadFromDB();
            })
            .then(function(movies) {
                if (movies && movies.length > 0) {
                    // Data found — loaded instantly from IDB
                    // Now silently check for updates in background
                    setTimeout(function() {
                        VersionManager.checkAndUpdate();
                    }, 1000);
                    return CacheManager.getMovies();
                }
                // First install — must download
                return VersionManager.downloadAndStore().then(function() {
                    return CacheManager.getMovies();
                });
            });

        return _loadPromise;
    }

    /** Force a fresh download (e.g. after retry from offline overlay). */
    function forceRefresh() {
        _loadPromise = null;
        CacheManager.clear();
        return VersionManager.downloadAndStore().then(function() {
            return CacheManager.getMovies();
        });
    }

    return { init, forceRefresh };
}());

// ─── PERFORMANCE UTILITIES ────────────────────────────────────────────────────
window.debounce = function(func, delay) {
    var timeout;
    return function() {
        var ctx  = this;
        var args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() { func.apply(ctx, args); }, delay);
    };
};

window.lazyLoadImages = function() {
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries, obs) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    obs.unobserve(img);
                }
            });
        });
        document.querySelectorAll('img[data-src]').forEach(function(img) {
            observer.observe(img);
        });
    } else {
        document.querySelectorAll('img[data-src]').forEach(function(img) {
            if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
        });
    }
};

window.getMovieImageUrl = function(movie) {
    if (!movie) return '';
    var img = movie.image || '';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    var type = (movie.type || '').toLowerCase();
    var year = movie.year || '';
    if (img && type && year) return './src/images/' + type + '/' + year + '/' + img;
    return img;
};

window.showOfflineOverlay = UIManager.showOfflineOverlay.bind(UIManager);

// ─── BACKWARD-COMPATIBLE ADAPTERS ────────────────────────────────────────────
/**
 * window.MovieStore — existing pages call MovieStore.load(), MovieStore.getAll(), etc.
 * All calls now delegate to the new repositories.
 */
window.MovieStore = {
    load: function() {
        return AppLoader.init();
    },
    getAll: function()            { return MovieRepository.getAll(); },
    getMovie: function(id)        { return MovieRepository.getById(id); },
    getByYear: function(y)        { return MovieRepository.getByYear(y); },
    getByType: function(t)        { return MovieRepository.getByType(t); },
    getByCategory: function(c)    { return MovieRepository.getByCategory(c); },
    getByStatus: function(s)      { return MovieRepository.getByStatus(s); },
    search: function(kw)          { return SearchRepository.search(kw); },
    featured: function()          { return MovieRepository.getFeatured(); },
    comingSoon: function()        { return MovieRepository.getByStatus('coming soon'); },
    latest: function()            { return MovieRepository.getLatest(); },
    getRelatedMovies: function(id, lim) { return MovieRepository.getRelated(id, lim); },
    refresh: function() {
        return AppLoader.forceRefresh();
    },
    destroy: function() { CacheManager.clear(); }
};

/**
 * window.api — backward compat for existing code + slider fetch now reads from IDB.
 */
var api = {
    getMoviesByTable: function(type, year) {
        return AppLoader.init().then(function() {
            return MovieRepository.getByType(type).filter(function(m) {
                return String(m.year) === String(year);
            });
        });
    },
    getAllMovies: function() {
        return AppLoader.init().then(function() { return MovieRepository.getAll(); });
    },
    findMovieById: function(id) {
        return AppLoader.init().then(function() { return MovieRepository.getById(id); });
    },
    /** Slider now reads from IndexedDB — no network request. */
    getSlider: function() {
        return AppLoader.init().then(function() {
            return MovieRepository.getSlider();
        });
    },
    TYPES: ['tamil', 'hollywood'],
    YEARS: buildYearList()
};
window.api = api;

// ─── GLOBAL EXPORTS ───────────────────────────────────────────────────────────
window.AppLoader          = AppLoader;
window.DatabaseManager    = DatabaseManager;
window.VersionManager     = VersionManager;
window.MovieRepository    = MovieRepository;
window.SearchRepository   = SearchRepository;
window.FavoriteRepository = FavoriteRepository;
window.HistoryRepository  = HistoryRepository;
window.SettingsRepository = SettingsRepository;
window.UIManager          = UIManager;
window.VirtualScroller    = VirtualScroller;
window.CacheManager       = CacheManager;
