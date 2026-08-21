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

  // Automatically unlock movie if URL contains ?reward= or ?id= (for Android WebView & direct links)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rewardId = params.get('reward') || params.get('id');
      if (rewardId) {
        const idStr = String(rewardId).trim();
        setUnlockedMovies((prev) => {
          if (prev.some(item => String(item).trim() === idStr)) return prev;
          const updated = [...prev, idStr];
          try {
            localStorage.setItem('vip_unlocked_movies', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
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

  const unlockMovie = (target) => {
    if (!target) return;
    const rawId = typeof target === 'object' ? (target.id || target.movieId) : target;
    const strId = String(rawId || '').trim();
    if (!strId) return;

    // Synchronously persist unlock in localStorage
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

    if (window.UIManager?.showToast) {
      window.UIManager.showToast('🎉 Movie Unlocked! Enjoy watching');
    }

    // Full window location navigation so Android WebView shouldOverrideUrlLoading triggers native AdMob Rewarded Ad
    window.location.href = `/watch?reward=${encodeURIComponent(strId)}`;
  };

  // Trigger AdMob Rewarded Ad (Clean user choice flow for Android WebView & Web)
  const triggerRewardedAd = (movie) => {
    const targetMovie = movie || previewMovie;
    if (!targetMovie) return;
    const id = String(targetMovie.id || targetMovie.movieId || '').trim();
    if (!id) return;

    unlockMovie(id);
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

