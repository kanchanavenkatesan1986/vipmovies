import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [movies, setMovies] = useState([]);
  const [slider, setSlider] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    quality: 'auto',
    autoplay: true,
    comingSoon: true,
    saveHistory: true
  });
  const [dbInfo, setDbInfo] = useState({
    version: null,
    updated: null,
    count: 0
  });

  // Initialize DB and load initial data
  useEffect(() => {
    let active = true;

    // We assume api.js is loaded and has initialized the repositories on window
    const initApp = async () => {
      try {
        if (!window.AppLoader) {
          throw new Error("AppLoader not found on window. Make sure api.js is loaded.");
        }

        // 1. Initialise AppLoader (this opens DB and runs silent version check in background)
        const loadedMovies = await window.AppLoader.init();
        
        if (!active) return;

        // 2. Load other repositories from IndexedDB
        const loadedSlider = window.MovieRepository.getSlider();
        const loadedFavs = await window.FavoriteRepository.getAll();
        const loadedHistory = await window.HistoryRepository.getAll();
        const loadedSettings = await window.SettingsRepository.getAll();

        // 3. Get database metadata
        const version = await window.DatabaseManager.get('metadata', 'version');
        const updated = await window.DatabaseManager.get('metadata', 'updated');

        if (active) {
          setMovies(loadedMovies || []);
          setSlider(loadedSlider || []);
          setFavorites(loadedFavs || []);
          setHistory(loadedHistory || []);
          setSettings(loadedSettings);
          setDbInfo({
            version: version ? version.value : 'N/A',
            updated: updated ? updated.value : 'N/A',
            count: loadedMovies ? loadedMovies.length : 0
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.error("DB Initialization Error: ", err);
        if (active) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    initApp();

    return () => {
      active = false;
    };
  }, []);

  // Live cross-tab & cross-page catalog synchronization with instant optimistic updates
  useEffect(() => {
    const handleOptimisticCatalog = (event) => {
      try {
        const { type, item, items, id, ids } = event.detail || {};

        // Movies Optimistic Handlers
        if (type === 'movie_add' && item) {
          setMovies(prev => [item, ...prev.filter(m => String(m.id) !== String(item.id))]);
        } else if (type === 'movie_edit' && item) {
          setMovies(prev => prev.map(m => String(m.id) === String(item.id) ? { ...m, ...item } : m));
        } else if (type === 'movie_delete' && id) {
          setMovies(prev => prev.filter(m => String(m.id) !== String(id)));
        } else if (type === 'movie_bulk_delete' && Array.isArray(ids)) {
          const idSet = new Set(ids.map(String));
          setMovies(prev => prev.filter(m => !idSet.has(String(m.id))));
        } else if ((type === 'movies' || type === 'movies_arrange') && Array.isArray(items)) {
          const itemMap = new Map(items.map(m => [String(m.id), m]));
          setMovies(prev => {
            const updated = prev.map(m => itemMap.has(String(m.id)) ? itemMap.get(String(m.id)) : m);
            return [...updated];
          });
        }

        // Slides Optimistic Handlers
        if (type === 'slide_add' && item) {
          setSlider(prev => [...prev.filter(s => Number(s.id) !== Number(item.id)), item].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)));
        } else if (type === 'slide_edit' && item) {
          setSlider(prev => prev.map(s => Number(s.id) === Number(item.id) ? { ...s, ...item } : s));
        } else if (type === 'slide_delete' && id) {
          setSlider(prev => prev.filter(s => Number(s.id) !== Number(id)));
        } else if (type === 'slide_bulk_delete' && Array.isArray(ids)) {
          const idSet = new Set(ids.map(Number));
          setSlider(prev => prev.filter(s => !idSet.has(Number(s.id))));
        } else if ((type === 'slides' || type === 'slides_arrange') && Array.isArray(items)) {
          const itemMap = new Map(items.map(s => [Number(s.id), s]));
          setSlider(prev => {
            const updated = prev.map(s => itemMap.has(Number(s.id)) ? itemMap.get(Number(s.id)) : s);
            return [...updated].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
          });
        }
      } catch (err) {
        console.warn('Optimistic sync error:', err);
      }
    };

    const handleCatalogRefresh = async (event) => {
      try {
        const detail = event?.detail || {};

        // Always fetch fresh slider data directly from API to ensure full sync with D1 database
        try {
          const sliderRes = await fetch('https://api-movies.akatsuki-pvt-ltd.workers.dev/api/slider', { cache: 'default' });
          if (sliderRes.ok) {
            const sliderData = await sliderRes.json();
            const slidesList = Array.isArray(sliderData) ? sliderData : (sliderData.value || sliderData.data || []);
            const sortedSlides = [...slidesList].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
            setSlider(sortedSlides);
            if (window.DatabaseManager) {
              window.DatabaseManager.replaceAll('slider', sortedSlides).catch(() => {});
            }
            if (window.CacheManager) {
              window.CacheManager.populate(window.CacheManager.getMovies(), sortedSlides);
            }
          }
        } catch (sliderErr) {
          console.warn('Failed to fetch fresh slider in AppContext:', sliderErr);
        }

        // Refresh movies if MovieStore or MovieRepository is available
        if (window.MovieStore && typeof window.MovieStore.refresh === 'function') {
          const freshMovies = await window.MovieStore.refresh();
          if (freshMovies) setMovies([...freshMovies]);
        } else if (window.MovieRepository) {
          const freshMovies = window.MovieRepository.getAll();
          if (freshMovies) setMovies([...freshMovies]);
        }

        // Update dbInfo metadata state
        if (window.DatabaseManager) {
          const version = await window.DatabaseManager.get('metadata', 'version');
          const updated = await window.DatabaseManager.get('metadata', 'updated');
          const count = await window.DatabaseManager.get('metadata', 'count');
          setDbInfo({
            version: version ? version.value : (detail.version || Date.now()),
            updated: updated ? updated.value : new Date().toISOString(),
            count: count ? count.value : 0
          });
        }
      } catch (e) {
        console.warn('Catalog auto-sync warning:', e);
      }
    };

    window.addEventListener('vip_catalog_optimistic_update', handleOptimisticCatalog);
    window.addEventListener('vip_catalog_updated', handleCatalogRefresh);

    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('vip_catalog_sync');
        bc.onmessage = (msg) => {
          const data = msg?.data || {};
          if (data.type === 'OPTIMISTIC_UPDATE') {
            handleOptimisticCatalog({ detail: { type: data.updateType, ...data } });
          } else if (data.type === 'CATALOG_UPDATE' || data.type === 'UPDATE') {
            handleCatalogRefresh(data);
          }
        };
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('vip_catalog_optimistic_update', handleOptimisticCatalog);
      window.removeEventListener('vip_catalog_updated', handleCatalogRefresh);
      if (bc) bc.close();
    };
  }, []);

  // Favorite operations
  const toggleFavorite = async (movie) => {
    try {
      const added = await window.FavoriteRepository.toggle(movie);
      const updatedFavs = await window.FavoriteRepository.getAll();
      setFavorites(updatedFavs);
      window.UIManager.showToast(added ? '❤️ Added to Favorites!' : 'Removed from Favorites');
      return added;
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllFavorites = async () => {
    try {
      await window.FavoriteRepository.clearAll();
      setFavorites([]);
      window.UIManager.showToast('Cleared all favorites');
    } catch (err) {
      console.error(err);
    }
  };

  const removeFromFavorites = async (movieId) => {
    try {
      await window.DatabaseManager.delete('favorites', movieId);
      const updatedFavs = await window.FavoriteRepository.getAll();
      setFavorites(updatedFavs);
      window.UIManager.showToast('Removed from favorites');
    } catch (err) {
      console.error(err);
    }
  };

  // History operations
  const recordHistory = async (movie) => {
    if (!settings.saveHistory) return;
    try {
      await window.HistoryRepository.record(movie);
      const updatedHistory = await window.HistoryRepository.getAll();
      setHistory(updatedHistory);
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllHistory = async () => {
    try {
      await window.HistoryRepository.clearAll();
      setHistory([]);
      window.UIManager.showToast('Cleared watch history');
    } catch (err) {
      console.error(err);
    }
  };

  // Settings operations
  const updateSetting = async (key, value) => {
    try {
      await window.SettingsRepository.set(key, value);
      const updatedSettings = await window.SettingsRepository.getAll();
      setSettings(updatedSettings);
    } catch (err) {
      console.error(err);
    }
  };

  // Manual DB refresh / update
  const forceRefreshDb = async () => {
    setIsLoading(true);
    try {
      const loadedMovies = await window.MovieStore.refresh();
      const loadedSlider = window.MovieRepository.getSlider();
      const version = await window.DatabaseManager.get('metadata', 'version');
      const updated = await window.DatabaseManager.get('metadata', 'updated');

      setMovies(loadedMovies || []);
      setSlider(loadedSlider || []);
      setDbInfo({
        version: version ? version.value : 'N/A',
        updated: updated ? updated.value : 'N/A',
        count: loadedMovies ? loadedMovies.length : 0
      });
      setIsLoading(false);
      window.UIManager.showToast('🎬 Database refreshed successfully!');
    } catch (err) {
      console.error("Refresh Error: ", err);
      setError(err);
      setIsLoading(false);
      window.UIManager.showToast('Error refreshing database', 'error');
    }
  };

  // Unlock & Rewarded Ad State Management
  const [unlockedMovies, setUnlockedMovies] = useState(() => {
    try {
      const saved = localStorage.getItem('vip_unlocked_movies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [previewMovie, setPreviewMovie] = useState(null);
  const [isAdLoading, setIsAdLoading] = useState(false);

  // Save unlocked movies to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('vip_unlocked_movies', JSON.stringify(unlockedMovies));
    } catch (e) {
      console.error('Failed to save unlocked state:', e);
    }
  }, [unlockedMovies]);

  // Automatically unlock movie if URL contains ?reward= (for Android WebView ad-return callback redirects)
  // NOTE: We do NOT unlock on ?id= since that param is for normal player navigation
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rewardId = params.get('reward');
      if (rewardId && !rewardId.startsWith('http') && !rewardId.startsWith('/')) {
        const idStr = String(rewardId).trim();
        if (idStr) {
          setUnlockedMovies((prev) => {
            if (prev.some(item => String(item).trim() === idStr)) return prev;
            const updated = [...prev, idStr];
            try {
              localStorage.setItem('vip_unlocked_movies', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });
        }
      }
    } catch (e) {
      console.error('URL unlock parse error:', e);
    }
  }, []);

  const openMoviePreview = (movie) => {
    if (!movie) return;
    setPreviewMovie(movie);
  };

  const closeMoviePreview = () => {
    setPreviewMovie(null);
    setIsAdLoading(false);
  };

  const isMovieUnlocked = (movieId) => {
    if (!movieId) return false;
    const norm = String(movieId).trim();
    if (unlockedMovies.some(id => String(id).trim() === norm)) return true;
    try {
      const saved = localStorage.getItem('vip_unlocked_movies');
      const currentList = saved ? JSON.parse(saved) : [];
      return currentList.some(id => String(id).trim() === norm);
    } catch {
      return false;
    }
  };

  // Persist unlock to localStorage and state (called after ad is completed/confirmed)
  const unlockMovie = (rawTarget) => {
    if (!rawTarget) return;
    const rawId = typeof rawTarget === 'object' ? (rawTarget.id || rawTarget.movieId) : rawTarget;
    const strId = String(rawId || '').trim();
    if (!strId) return;

    try {
      const saved = localStorage.getItem('vip_unlocked_movies');
      const currentList = saved ? JSON.parse(saved) : [];
      if (!currentList.some(id => String(id).trim() === strId)) {
        currentList.push(strId);
        localStorage.setItem('vip_unlocked_movies', JSON.stringify(currentList));
      }
    } catch (e) {
      console.error('LocalStorage save error:', e);
    }

    setUnlockedMovies((prev) => {
      if (prev.some(id => String(id).trim() === strId)) return prev;
      return [...prev, strId];
    });

    setPreviewMovie(null);
    setIsAdLoading(false);
  };

  // Helper to determine watch URL (series vs movie)
  const getWatchUrl = (movie) => {
    if (!movie) return '/home';
    const id = typeof movie === 'object' ? (movie.id || movie.movieId) : movie;
    const target = typeof movie === 'object' ? movie : movies.find(m => String(m.id || m.movieId).trim() === String(id).trim());
    const isSeries = target && (target.contentType === 'series' || (Array.isArray(target.episodes) && target.episodes.length > 0));
    return isSeries
      ? `/watch-series.html?id=${encodeURIComponent(id)}`
      : `/watch-movie.html?id=${encodeURIComponent(id)}`;
  };

  /**
   * triggerRewardedAd — Card-click ad unlock flow
   *
   * ANDROID WEBVIEW: Navigates to a special ad-bridge URL that Android
   * intercepts via shouldOverrideUrlLoading to show the native rewarded ad.
   * After the ad, Android calls window.onVipCardAdCompleted(id) which
   * unlocks and navigates to the watch page.
   *
   * WEB BROWSER: Simulates a brief sponsor delay (1.5s), then unlocks
   * the movie and navigates to the watch/series page directly.
   */
  const triggerRewardedAd = (movie) => {
    const targetMovie = movie || previewMovie;
    if (!targetMovie) return;
    const id = String(targetMovie.id || targetMovie.movieId || '').trim();
    if (!id) return;

    setIsAdLoading(true);

    const isSeries = targetMovie.contentType === 'series' ||
      (Array.isArray(targetMovie.episodes) && targetMovie.episodes.length > 0);
    const watchUrl = isSeries
      ? `/watch-series.html?id=${encodeURIComponent(id)}`
      : `/watch-movie.html?id=${encodeURIComponent(id)}`;

    // ── Register global callback for Android WebView to call after ad completes ──
    window.onVipCardAdCompleted = (completedId) => {
      const resolvedId = completedId || id;
      unlockMovie(resolvedId);
      if (window.UIManager?.showToast) {
        window.UIManager.showToast('🎉 Unlocked! Enjoy watching');
      }
      // Navigate to watch page
      window.location.href = isSeries
        ? `/watch-series.html?id=${encodeURIComponent(resolvedId)}`
        : `/watch-movie.html?id=${encodeURIComponent(resolvedId)}`;
      try { delete window.onVipCardAdCompleted; } catch {}
    };

    // ── Check if Android WebView bridge is available ──
    const hasBridge = (
      (window.AndroidBridge && typeof window.AndroidBridge.showRewardedAd === 'function') ||
      (window.Android && typeof window.Android.showRewardedAd === 'function') ||
      (window.Android && typeof window.Android.showCardAd === 'function')
    );

    if (hasBridge) {
      // Trigger native rewarded ad via Android bridge — Android calls window.onVipCardAdCompleted on completion
      try {
        if (window.AndroidBridge?.showCardAd) {
          window.AndroidBridge.showCardAd(id, watchUrl);
        } else if (window.Android?.showCardAd) {
          window.Android.showCardAd(id, watchUrl);
        } else if (window.AndroidBridge?.showRewardedAd) {
          window.AndroidBridge.showRewardedAd(id, watchUrl);
        } else if (window.Android?.showRewardedAd) {
          window.Android.showRewardedAd(id, watchUrl);
        }
        // Android will call window.onVipCardAdCompleted() when done — do NOT navigate here
        return;
      } catch (e) {
        console.warn('Android bridge card ad call failed, falling back to web flow:', e);
      }
    }

    // ── Web Browser Fallback: brief simulated sponsor moment then navigate ──
    setTimeout(() => {
      unlockMovie(id);
      if (window.UIManager?.showToast) {
        window.UIManager.showToast('🎉 Unlocked! Enjoy watching');
      }
      // SPA navigation
      window.history.pushState(null, '', watchUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
      try { delete window.onVipCardAdCompleted; } catch {}
    }, 800);
  };

  return (
    <AppContext.Provider value={{
      movies,
      slider,
      isLoading,
      error,
      favorites,
      history,
      settings,
      dbInfo,
      unlockedMovies,
      previewMovie,
      isAdLoading,
      openMoviePreview,
      closeMoviePreview,
      isMovieUnlocked,
      unlockMovie,
      getWatchUrl,
      triggerRewardedAd,
      toggleFavorite,
      clearAllFavorites,
      removeFromFavorites,
      recordHistory,
      clearAllHistory,
      updateSetting,
      forceRefreshDb
    }}>
      {children}
    </AppContext.Provider>
  );
};

