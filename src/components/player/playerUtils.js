/**
 * VIP Movies Advanced Player Utilities
 * Helper functions for formatting, storage, gestures, media session, fullscreen, and orientation.
 */

// ==========================================
// 1. TIME FORMATTERS
// ==========================================
export function formatPlayerTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined || seconds < 0) {
    return '00:00';
  }
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

// ==========================================
// 2. STORAGE MANAGERS
// ==========================================
const SETTINGS_KEY = 'vipmovies_player_settings';
const PROGRESS_PREFIX = 'vipmovies_progress_';

const DEFAULT_SETTINGS = {
  volume: 1.0,
  muted: false,
  playbackRate: 1.0,
  quality: 'auto',
  aspectRatio: 'fit', // fit | fill | 16:9 | 4:3 | zoom | original
  autoplay: true,
  theatreMode: false,
  rememberPosition: true,
  subtitleTrack: 'off',
  subtitleSize: 'medium', // small | medium | large | xlarge
  subtitleBackground: 'semi', // none | semi | solid
  subtitlePosition: 'bottom', // bottom | middle | top
  controlsTimeoutSeconds: 3.5,
  reduceMotion: false
};

export const playerStorage = {
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('[PlayerStorage] Save settings error:', e);
      return settings;
    }
  },

  getProgress(movieId) {
    if (!movieId) return null;
    try {
      const raw = localStorage.getItem(`${PROGRESS_PREFIX}${String(movieId).trim()}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  saveProgress(movieId, progressData) {
    if (!movieId || !progressData) return;
    try {
      const payload = {
        movieId: String(movieId).trim(),
        currentTime: progressData.currentTime || 0,
        duration: progressData.duration || 0,
        percentage: progressData.duration > 0 ? (progressData.currentTime / progressData.duration) * 100 : 0,
        quality: progressData.quality || 'auto',
        playbackRate: progressData.playbackRate || 1.0,
        timestamp: Date.now()
      };
      localStorage.setItem(`${PROGRESS_PREFIX}${String(movieId).trim()}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('[PlayerStorage] Save progress error:', e);
    }
  },

  clearProgress(movieId) {
    if (!movieId) return;
    try {
      localStorage.removeItem(`${PROGRESS_PREFIX}${String(movieId).trim()}`);
    } catch {}
  }
};

// ==========================================
// 3. FULLSCREEN HELPERS (DOM Fullscreen API only - No device orientation lock)
// ==========================================
export const screenEngine = {
  isFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  },

  async requestFullscreen(element) {
    if (!element) return false;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      return true;
    } catch (err) {
      console.warn('[ScreenEngine] Fullscreen request failed:', err);
      return false;
    }
  },

  async exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      return true;
    } catch (err) {
      console.warn('[ScreenEngine] Exit fullscreen failed:', err);
      return false;
    }
  },

  async toggleFullscreen(element) {
    if (this.isFullscreen()) {
      return this.exitFullscreen();
    }
    return this.requestFullscreen(element);
  }
};

// ==========================================
// 4. PICTURE-IN-PICTURE (PIP) HELPER
// ==========================================
export const pipEngine = {
  isSupported() {
    return Boolean(document.pictureInPictureEnabled);
  },

  isPipActive(videoElement) {
    return document.pictureInPictureElement === videoElement;
  },

  async togglePip(videoElement) {
    if (!videoElement || !this.isSupported()) return false;
    try {
      if (this.isPipActive(videoElement)) {
        await document.exitPictureInPicture();
        return false;
      } else {
        await videoElement.requestPictureInPicture();
        return true;
      }
    } catch (err) {
      console.warn('[PipEngine] PiP toggle error:', err);
      return false;
    }
  }
};

// ==========================================
// 5. MEDIA SESSION API BINDER
// ==========================================
export const mediaSessionEngine = {
  bindMovie(movie, handlers = {}) {
    if (!('mediaSession' in navigator) || !movie) return;

    try {
      const img = movie.image || '';
      let posterUrl = img;
      if (img && !img.startsWith('http')) {
        posterUrl = `${window.location.origin}/src/images/${(movie.type || 'tamil').toLowerCase()}/${movie.year || '2026'}/${img}`;
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: movie.title || 'VIP Movie',
        artist: movie.director ? `Directed by ${movie.director}` : 'VIP Movies',
        album: `${movie.language || 'Tamil'} Movies (${movie.year || '2026'})`,
        artwork: [
          { src: posterUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: posterUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: posterUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: posterUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: posterUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: posterUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      // Actions
      const actions = [
        ['play', handlers.onPlay],
        ['pause', handlers.onPause],
        ['seekbackward', handlers.onSeekBackward || (() => handlers.onSeekRel && handlers.onSeekRel(-10))],
        ['seekforward', handlers.onSeekForward || (() => handlers.onSeekRel && handlers.onSeekRel(10))],
        ['previoustrack', handlers.onPrev],
        ['nexttrack', handlers.onNext],
        ['stop', handlers.onPause]
      ];

      for (const [action, handler] of actions) {
        try {
          if (handler) {
            navigator.mediaSession.setActionHandler(action, handler);
          } else {
            navigator.mediaSession.setActionHandler(action, null);
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[MediaSession] Error setting metadata:', e);
    }
  },

  updatePositionState(videoElement) {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !videoElement) return;
    try {
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, videoElement.duration),
          playbackRate: videoElement.playbackRate || 1,
          position: Math.max(0, videoElement.currentTime)
        });
      }
    } catch {}
  }
};

// ==========================================
// 6. ASPECT RATIO STYLING MAP
// ==========================================
export function getAspectRatioStyle(mode) {
  switch (mode) {
    case 'fill':
      return { objectFit: 'fill', transform: 'none' };
    case '16:9':
      return { objectFit: 'cover', aspectRatio: '16 / 9', transform: 'none' };
    case '4:3':
      return { objectFit: 'contain', aspectRatio: '4 / 3', transform: 'none' };
    case 'zoom':
      return { objectFit: 'cover', transform: 'scale(1.15)' };
    case 'original':
      return { objectFit: 'none', transform: 'none' };
    case 'fit':
    default:
      return { objectFit: 'contain', transform: 'none' };
  }
}
