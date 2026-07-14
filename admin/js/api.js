/**
 * TVK Movies Admin - API Client
 * Centralized fetch wrapper for communicating with:
 * https://api-movies.akatsuki-pvt-ltd.workers.dev/api
 */

const API_BASE_URL = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/api';

// Global memory cache & state for MovieStore in admin context
let movieCache = null;
let loadPromise = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// Global memory cache for slider
let sliderCache = null;
let sliderLoadPromise = null;

// Map indexes for maximum lookup performance in admin
const indexById = new Map();
const indexByYear = new Map();
const indexByType = new Map();
const indexByCategory = new Map();
const indexByStatus = new Map();

/**
 * Normalizes movie link fields for frontend/admin backward compatibility
 */
function normalizeMovie(m) {
    if (!m) return m;
    if (m.p360) { m.p460 = m.p360; m['460p'] = m.p360; }
    else if (m.p460) { m.p360 = m.p460; m['460p'] = m.p460; }
    else if (m['460p']) { m.p360 = m['460p']; m.p460 = m['460p']; }

    if (m.p720) { m['720p'] = m.p720; }
    else if (m['720p']) { m.p720 = m['720p']; }

    if (m.p1080) { m['1080p'] = m.p1080; }
    else if (m['1080p']) { m.p1080 = m['1080p']; }

    return m;
}

/**
 * Re-indexes all cached movies in memory for O(1) query lookups
 */
function precomputeIndexes(movies) {
    indexById.clear();
    indexByYear.clear();
    indexByType.clear();
    indexByCategory.clear();
    indexByStatus.clear();

    movies.forEach(function(m) {
        normalizeMovie(m);

        if (m.id !== undefined && m.id !== null) {
            indexById.set(String(m.id), m);
            indexById.set(Number(m.id), m);
        }

        const year = String(m.year || "").trim();
        if (year) {
            if (!indexByYear.has(year)) indexByYear.set(year, []);
            indexByYear.get(year).push(m);
        }

        const type = String(m.type || "").toLowerCase().trim();
        if (type) {
            if (!indexByType.has(type)) indexByType.set(type, []);
            indexByType.get(type).push(m);
        }

        const category = String(m.category || "").toLowerCase().trim();
        if (category) {
            if (!indexByCategory.has(category)) indexByCategory.set(category, []);
            indexByCategory.get(category).push(m);
        }

        const status = String(m.status || "").toLowerCase().trim();
        if (status) {
            if (!indexByStatus.has(status)) indexByStatus.set(status, []);
            indexByStatus.get(status).push(m);
        }
    });
}

/**
 * Admin Singleton Movie Store
 */
const MovieStore = {
    load: function() {
        if (movieCache) {
            return Promise.resolve(movieCache);
        }
        if (loadPromise) {
            return loadPromise;
        }

        loadPromise = new Promise(function(resolve, reject) {
            function attemptFetch() {
                fetch(`${API_BASE_URL}/app`)
                    .then(function(res) {
                        if (!res.ok) throw new Error("Failed to fetch movies database, status: " + res.status);
                        return res.json();
                    })
                    .then(function(data) {
                        if (data && data.success && Array.isArray(data.movies)) {
                            movieCache = data.movies;
                            precomputeIndexes(movieCache);
                            retryCount = 0;
                            resolve(movieCache);
                        } else {
                            throw new Error("Invalid API payload format");
                        }
                    })
                    .catch(function(err) {
                        if (retryCount < MAX_RETRIES) {
                            retryCount++;
                            console.warn("MovieStore admin fetch failed. Retrying (" + retryCount + "/" + MAX_RETRIES + ") in 2s...", err);
                            setTimeout(attemptFetch, 2000);
                        } else {
                            retryCount = 0;
                            loadPromise = null;
                            reject(err);
                        }
                    });
            }
            attemptFetch();
        });

        return loadPromise;
    },

    getAll: function() {
        return movieCache || [];
    },

    getMovie: function(id) {
        if (!id) return null;
        return indexById.get(String(id)) || indexById.get(Number(id)) || null;
    },

    getByYear: function(year) {
        if (!year) return [];
        return indexByYear.get(String(year).trim()) || [];
    },

    getByType: function(type) {
        if (!type) return [];
        return indexByType.get(type.toLowerCase().trim()) || [];
    },

    getByCategory: function(category) {
        if (!category) return [];
        return indexByCategory.get(category.toLowerCase().trim()) || [];
    },

    getByStatus: function(status) {
        if (!status) return [];
        return indexByStatus.get(status.toLowerCase().trim()) || [];
    },

    search: function(keyword) {
        if (!keyword) return movieCache || [];
        const term = keyword.toLowerCase().trim();
        if (!term) return movieCache || [];

        return (movieCache || []).filter(function(m) {
            return (m.title && m.title.toLowerCase().includes(term)) ||
                   (m.language && m.language.toLowerCase().includes(term)) ||
                   (m.director && m.director.toLowerCase().includes(term)) ||
                   (m.starring && m.starring.toLowerCase().includes(term)) ||
                   (m.year && String(m.year).toLowerCase().includes(term)) ||
                   (m.category && m.category.toLowerCase().includes(term)) ||
                   (m.type && m.type.toLowerCase().includes(term)) ||
                   (m.story && m.story.toLowerCase().includes(term));
        });
    },

    refresh: function() {
        movieCache = null;
        loadPromise = null;
        sliderCache = null;
        sliderLoadPromise = null;
        indexById.clear();
        indexByYear.clear();
        indexByType.clear();
        indexByCategory.clear();
        indexByStatus.clear();
        return MovieStore.load();
    },

    destroy: function() {
        movieCache = null;
        loadPromise = null;
        sliderCache = null;
        sliderLoadPromise = null;
        indexById.clear();
        indexByYear.clear();
        indexByType.clear();
        indexByCategory.clear();
        indexByStatus.clear();
    }
};

window.MovieStore = MovieStore;

class MovieAPI {
    constructor() {
        this.mode = 'live';
    }

    /**
     * Show/Hide global loading overlay
     */
    showLoader(show) {
        const loader = document.getElementById('global-loader');
        if (loader) {
            if (show) loader.classList.add('active');
            else loader.classList.remove('active');
        }
    }

    setMode(mode) {
        this.mode = 'live';
        console.warn('API mode is locked to live database only.');
    }

    getMode() {
        return this.mode;
    }

    sanitize(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    sanitizeMovie(movie) {
        const clean = { ...movie };
        for (let key in clean) {
            if (typeof clean[key] === 'string') {
                clean[key] = this.sanitize(clean[key]);
            }
        }
        return clean;
    }

    mapDbToFrontend(movie) {
        if (!movie) return movie;
        const mapped = { ...movie };
        if (mapped.p460 !== undefined) mapped['460p'] = mapped.p460;
        if (mapped.p720 !== undefined) mapped['720p'] = mapped.p720;
        if (mapped.p1080 !== undefined) mapped['1080p'] = mapped.p1080;
        return mapped;
    }

    mapFrontendToDb(movieData) {
        if (!movieData) return movieData;
        const mapped = { ...movieData };
        if (mapped['460p'] !== undefined) mapped.p460 = mapped['460p'];
        if (mapped['720p'] !== undefined) mapped.p720 = mapped['720p'];
        if (mapped['1080p'] !== undefined) mapped.p1080 = mapped['1080p'];
        return mapped;
    }

    /**
     * Fetches all movies (uses MovieStore cache for performance)
     */
    async getMovies() {
        this.showLoader(true);
        try {
            await MovieStore.load();
            const movies = MovieStore.getAll();
            return movies.map(m => this.mapDbToFrontend(m));
        } catch (err) {
            console.error('API Fetch failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Gets a single movie by ID (uses MovieStore cache)
     */
    async getMovie(id) {
        this.showLoader(true);
        try {
            await MovieStore.load();
            const movie = MovieStore.getMovie(id);
            if (!movie) throw new Error('Movie with ID ' + id + ' not found in cache.');
            return this.mapDbToFrontend(movie);
        } catch (err) {
            console.error(`API Single fetch for ID ${id} failed: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Creates a new movie
     */
    async addMovie(movieData) {
        this.showLoader(true);
        const cleanData = this.sanitizeMovie(movieData);
        try {
            const dbPayload = this.mapFrontendToDb(cleanData);
            const res = await fetch(`${API_BASE_URL}/movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbPayload)
            });
            if (!res.ok) throw new Error('Failed to create movie on server');
            const data = await res.json();
            
            // Refresh MovieStore Cache after POST
            await MovieStore.refresh();
            
            return this.mapDbToFrontend(data);
        } catch (err) {
            console.error('API Add failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Updates an existing movie
     */
    async updateMovie(id, movieData) {
        this.showLoader(true);
        const movieId = parseInt(id, 10);
        const cleanData = this.sanitizeMovie(movieData);
        try {
            const dbPayload = this.mapFrontendToDb(cleanData);
            const res = await fetch(`${API_BASE_URL}/movies/${movieId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbPayload)
            });
            if (!res.ok) throw new Error('Failed to update movie on server');
            const data = await res.json();
            
            // Refresh MovieStore Cache after PUT
            await MovieStore.refresh();
            
            return this.mapDbToFrontend(data);
        } catch (err) {
            console.error(`API Update failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Deletes a movie
     */
    async deleteMovie(id) {
        this.showLoader(true);
        const movieId = parseInt(id, 10);
        try {
            const res = await fetch(`${API_BASE_URL}/movies/${movieId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete movie on server');
            
            // Refresh MovieStore Cache after DELETE
            await MovieStore.refresh();
            
            return true;
        } catch (err) {
            console.error(`API Delete failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Fetches slider slides (cached in memory)
     */
    async getSlider() {
        if (sliderCache) return sliderCache;
        if (sliderLoadPromise) return sliderLoadPromise;

        this.showLoader(true);
        sliderLoadPromise = fetch(`${API_BASE_URL}/slider`)
            .then(async (res) => {
                if (!res.ok) throw new Error('Slider endpoint not found on server');
                const data = await res.json();
                sliderCache = Array.isArray(data) ? data : [];
                return sliderCache;
            })
            .catch((err) => {
                console.error('API Fetch slider failed: ', err);
                sliderLoadPromise = null;
                return [];
            })
            .finally(() => {
                this.showLoader(false);
            });

        return sliderLoadPromise;
    }

    /**
     * Creates a new slider record
     */
    async createSlider(slideData) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slideData)
            });
            if (!res.ok) throw new Error('Failed to create slider on server');
            
            // Clear Slider Cache to force re-fetch
            sliderCache = null;
            sliderLoadPromise = null;
            
            return true;
        } catch (err) {
            console.error('API Create slider failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Updates an existing slider record by ID
     */
    async updateSlider(id, slideData) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slideData)
            });
            if (!res.ok) throw new Error('Failed to update slider on server');
            
            // Clear Slider Cache to force re-fetch
            sliderCache = null;
            sliderLoadPromise = null;
            
            return true;
        } catch (err) {
            console.error(`API Update slider failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Deletes a slider record by ID
     */
    async deleteSlider(id) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete slider on server');
            
            // Clear Slider Cache to force re-fetch
            sliderCache = null;
            sliderLoadPromise = null;
            
            return true;
        } catch (err) {
            console.error(`API Delete slider failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }
}

// Global Single Instance
window.api = new MovieAPI();
