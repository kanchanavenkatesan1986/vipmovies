/**
 * Player Ads Configuration Service
 * Manages AdMob rewarded ad rules, timers, and UI settings
 * Compatible with Cloudflare Worker R2 backend and LocalStorage caching
 */

export const DEFAULT_ADS_CONFIG = {
  adsEnabled: true,
  firstAdDelayMinutes: 15,
  adIntervalMinutes: 25,
  warningCountdownSeconds: 15,
  rewardDurationMinutes: 25,
  maxAdsPerMovie: 3,
  enableWatchAhead: true,
  gracePeriodMinutes: 15,
  pauseTriggerEnabled: true,
  uiCopy: {
    warningText: "Ad break coming in {sec}s...",
    modalTitle: "Break Time",
    modalDescription: "Watch a short sponsor message to unlock the next {min} minutes of uninterrupted playback.",
    buttonText: "▶ Watch Ad to Continue",
    watchAheadText: "⚡ +30m Ad-Free"
  },
  updatedAt: new Date().toISOString()
};

export const ADS_PRESETS = {
  userFriendly: {
    label: "User Friendly (Recommended)",
    description: "Maximum retention: first ad at 20m, repeats every 30m, capped at 3 ads per movie.",
    config: {
      adsEnabled: true,
      firstAdDelayMinutes: 20,
      adIntervalMinutes: 30,
      warningCountdownSeconds: 15,
      rewardDurationMinutes: 30,
      maxAdsPerMovie: 3,
      enableWatchAhead: true,
      gracePeriodMinutes: 15,
      pauseTriggerEnabled: true
    }
  },
  balanced: {
    label: "Balanced",
    description: "Great balance of revenue and user comfort: first ad at 15m, repeats every 25m, capped at 4 ads.",
    config: {
      adsEnabled: true,
      firstAdDelayMinutes: 15,
      adIntervalMinutes: 25,
      warningCountdownSeconds: 15,
      rewardDurationMinutes: 25,
      maxAdsPerMovie: 4,
      enableWatchAhead: true,
      gracePeriodMinutes: 15,
      pauseTriggerEnabled: true
    }
  },
  highMonetization: {
    label: "High Revenue",
    description: "High ad frequency: first ad at 10m, repeats every 20m, capped at 6 ads.",
    config: {
      adsEnabled: true,
      firstAdDelayMinutes: 10,
      adIntervalMinutes: 20,
      warningCountdownSeconds: 15,
      rewardDurationMinutes: 20,
      maxAdsPerMovie: 6,
      enableWatchAhead: true,
      gracePeriodMinutes: 10,
      pauseTriggerEnabled: true
    }
  },
  disabled: {
    label: "Ads Disabled",
    description: "Turn off all midroll ads globally for all movies.",
    config: {
      adsEnabled: false
    }
  }
};

const STORAGE_KEY = 'vip_player_ads_config';
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

let cachedConfig = null;
let lastFetchTime = 0;

function getApiBase() {
  return (
    import.meta.env.VITE_UPLOAD_API_BASE ||
    'https://api-uploder.akatsuki-pvt-ltd.workers.dev'
  ).replace(/\/+$/, '');
}

function getAuthToken() {
  return (
    import.meta.env.VITE_UPLOAD_API_TOKEN ||
    localStorage.getItem('vip_upload_api_token') ||
    'VIP_SECURE_TOKEN_2026'
  );
}

export const adsConfigService = {
  /**
   * Get the current ads configuration.
   * Priority: Memory cache -> Live Worker API -> LocalStorage -> Built-in Defaults
   */
  async getAdsConfig(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && cachedConfig && (now - lastFetchTime) < CACHE_TTL_MS) {
      return cachedConfig;
    }

    // Try reading local storage first as instant baseline
    let localSaved = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) localSaved = JSON.parse(stored);
    } catch (e) {}

    try {
      const base = getApiBase();
      const res = await fetch(`${base}/ads-config?_t=${now}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          cachedConfig = { ...DEFAULT_ADS_CONFIG, ...json.data };
          lastFetchTime = now;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedConfig));
          } catch (e) {}
          return cachedConfig;
        }
      }
    } catch (err) {
      console.warn('[AdsConfigService] API fetch failed, falling back to local storage:', err);
    }

    if (localSaved) {
      cachedConfig = { ...DEFAULT_ADS_CONFIG, ...localSaved };
      return cachedConfig;
    }

    cachedConfig = { ...DEFAULT_ADS_CONFIG };
    return cachedConfig;
  },

  /**
   * Synchronously read the cached config (instant for player render).
   */
  getStoredConfigSync() {
    if (cachedConfig) return cachedConfig;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        cachedConfig = { ...DEFAULT_ADS_CONFIG, ...JSON.parse(stored) };
        return cachedConfig;
      }
    } catch (e) {}
    return DEFAULT_ADS_CONFIG;
  },

  /**
   * Save and publish updated configuration to Cloudflare Worker R2 and LocalStorage.
   */
  async saveAdsConfig(newConfig) {
    const base = getApiBase();
    const token = getAuthToken();

    const payload = {
      ...DEFAULT_ADS_CONFIG,
      ...newConfig,
      updatedAt: new Date().toISOString()
    };

    const res = await fetch(`${base}/update-ads-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = `Failed to save configuration (Status ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    cachedConfig = payload;
    lastFetchTime = Date.now();

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}

    // Dispatch global event for live player update
    try {
      window.dispatchEvent(new CustomEvent('vip_ads_config_updated', { detail: payload }));
    } catch (e) {}

    return data;
  }
};
