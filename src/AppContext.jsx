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
