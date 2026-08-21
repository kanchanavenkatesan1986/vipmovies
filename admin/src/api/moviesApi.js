import apiClient from './client';

const STORAGE_KEY = 'vip_admin_movies_db';
const RECYCLE_BIN_KEY = 'vip_admin_recycle_bin';
const ACTIVITY_LOGS_KEY = 'vip_admin_activity_logs';

// Helper to get initial stored dataset or fallback to remote / defaults
export function getLocalMovies() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading local movies', e);
    return [];
  }
}

export function saveLocalMovies(movies) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
  } catch (e) {
    console.error('Error saving local movies', e);
  }
}

export function getRecycleBin() {
  try {
    const data = localStorage.getItem(RECYCLE_BIN_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function saveRecycleBin(movies) {
  try {
    localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(movies));
  } catch (e) {
    console.error('Error updating recycle bin', e);
  }
}

export function logActivity(action, details, user = 'Admin') {
  try {
    const logs = JSON.parse(localStorage.getItem(ACTIVITY_LOGS_KEY) || '[]');
    const newLog = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      action,
      details,
      user,
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1 (Local)'
    };
    logs.unshift(newLog);
    // Keep max 200 activity logs
    if (logs.length > 200) logs.pop();
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to log activity', e);
  }
}

export function getActivityLogs() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_LOGS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export const moviesApi = {
  // Fetch catalogue from API, fallback to local storage
  async fetchAllMovies() {
    try {
      const response = await apiClient.get('/api/app?t=' + Date.now());
      if (response.data && response.data.movies && Array.isArray(response.data.movies)) {
        const remoteMovies = response.data.movies;
        const localMovies = getLocalMovies();
        
        // Merge strategy: if local storage is empty, initialize with API movies
        if (localMovies.length === 0) {
          saveLocalMovies(remoteMovies);
          return remoteMovies;
        }
        
        // Return local state (which may contain user additions/edits)
        return localMovies;
      }
    } catch (error) {
      console.warn('API fetch failed, falling back to local cache', error);
    }
    
    return getLocalMovies();
  },

  // Check version from worker endpoint
  async fetchVersion() {
    try {
      const res = await apiClient.get('/api/version?t=' + Date.now());
      return res.data;
    } catch (e) {
      return { version: '1.0.0', updated: new Date().toISOString() };
    }
  },

  // Add a single movie with exact JSON schema
  async createMovie(movieData) {
    const movies = getLocalMovies();
    const newMovie = {
      id: movieData.id || `${movieData.type || 'hollywood'}-${movieData.year || '2026'}-${String(movies.length + 1).padStart(5, '0')}`,
      title: movieData.title || '',
      image: movieData.image || '',
      release: movieData.release || '',
      language: movieData.language || 'Tamil',
      year: String(movieData.year || '2026'),
      category: movieData.category || '',
      duration: movieData.duration || '',
      director: movieData.director || '',
      starring: movieData.starring || '',
      story: movieData.story || '',
      p360: movieData.p360 || '',
      p720: movieData.p720 || '',
      p1080: movieData.p1080 || '',
      created_at: movieData.created_at || new Date().toISOString().split('T')[0],
      type: movieData.type || 'hollywood',
      status: movieData.status || 'Active'
    };

    movies.unshift(newMovie);
    saveLocalMovies(movies);
    logActivity('Movie Added', `Added movie: ${newMovie.title} (${newMovie.id})`);
    return newMovie;
  },

  // Update an existing movie
  async updateMovie(id, updatedFields) {
    const movies = getLocalMovies();
    const index = movies.findIndex(m => String(m.id) === String(id));
    if (index === -1) throw new Error('Movie not found');

    const updatedMovie = { ...movies[index], ...updatedFields };
    movies[index] = updatedMovie;
    saveLocalMovies(movies);
    logActivity('Movie Edited', `Updated movie: ${updatedMovie.title} (${updatedMovie.id})`);
    return updatedMovie;
  },

  // Soft Delete to Recycle Bin
  async deleteMovie(id) {
    const movies = getLocalMovies();
    const movieToDelete = movies.find(m => String(m.id) === String(id));
    if (!movieToDelete) return false;

    const updatedMovies = movies.filter(m => String(m.id) !== String(id));
    saveLocalMovies(updatedMovies);

    const bin = getRecycleBin();
    bin.unshift({ ...movieToDelete, deletedAt: new Date().toISOString() });
    saveRecycleBin(bin);

    logActivity('Movie Deleted', `Moved to trash: ${movieToDelete.title} (${movieToDelete.id})`);
    return true;
  },

  // Restore movie from Recycle Bin
  async restoreMovie(id) {
    const bin = getRecycleBin();
    const itemToRestore = bin.find(m => String(m.id) === String(id));
    if (!itemToRestore) return false;

    const newBin = bin.filter(m => String(m.id) !== String(id));
    saveRecycleBin(newBin);

    const { deletedAt, ...movie } = itemToRestore;
    const movies = getLocalMovies();
    movies.unshift(movie);
    saveLocalMovies(movies);

    logActivity('Movie Restored', `Restored from trash: ${movie.title} (${movie.id})`);
    return movie;
  },

  // Permanent purge from Recycle Bin
  async purgeFromBin(id) {
    const bin = getRecycleBin();
    const newBin = bin.filter(m => String(m.id) !== String(id));
    saveRecycleBin(newBin);
    logActivity('Trash Purged', `Permanently deleted movie ID: ${id}`);
    return true;
  },

  // Bulk status update
  async bulkUpdateStatus(ids, newStatus) {
    const movies = getLocalMovies();
    const updated = movies.map(m => {
      if (ids.includes(m.id)) {
        return { ...m, status: newStatus };
      }
      return m;
    });
    saveLocalMovies(updated);
    logActivity('Bulk Status Update', `Updated ${ids.length} movies status to '${newStatus}'`);
    return true;
  },

  // Bulk Delete
  async bulkDelete(ids) {
    const movies = getLocalMovies();
    const toKeep = [];
    const toBin = [];

    movies.forEach(m => {
      if (ids.includes(m.id)) {
        toBin.push({ ...m, deletedAt: new Date().toISOString() });
      } else {
        toKeep.push(m);
      }
    });

    saveLocalMovies(toKeep);
    const currentBin = getRecycleBin();
    saveRecycleBin([...toBin, ...currentBin]);

    logActivity('Bulk Delete', `Moved ${ids.length} movies to trash`);
    return true;
  },

  // Bulk Import
  async bulkImportMovies(importedMovies) {
    if (!Array.isArray(importedMovies)) throw new Error('Invalid JSON import payload');
    const movies = getLocalMovies();
    const merged = [...importedMovies, ...movies];
    
    // De-duplicate by ID
    const uniqueMap = new Map();
    merged.forEach(m => {
      if (m && m.id) uniqueMap.set(String(m.id), m);
    });

    const finalMovies = Array.from(uniqueMap.values());
    saveLocalMovies(finalMovies);
    logActivity('Bulk Import', `Imported ${importedMovies.length} movies into catalogue`);
    return finalMovies;
  }
};
