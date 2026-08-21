// Frontend Admin Session Abstraction Layer
// Initial Development Credentials (DO NOT expose in production worker secrets)
const DEV_USERNAME = import.meta.env.VITE_ADMIN_USER || 'admin';
const DEV_PASSWORD = import.meta.env.VITE_ADMIN_PASS || 'VIPMovies@Admin2026!';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout

const SESSION_KEY = 'vip_admin_session';

export const authService = {
  // Login method
  login(username, password, remember = false) {
    const normUser = String(username || '').trim();
    const normPass = String(password || '').trim();

    if (normUser === DEV_USERNAME && normPass === DEV_PASSWORD) {
      const sessionData = {
        user: {
          username: normUser,
          role: 'Administrator',
          name: 'VIP Admin'
        },
        loginTime: Date.now(),
        lastActiveTime: Date.now(),
        remember
      };

      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      } catch (e) {
        console.error('Failed to save session:', e);
      }

      return { success: true, session: sessionData };
    }

    return { success: false, message: 'Invalid username or password.' };
  },

  // Check if current session is active and not expired
  isAuthenticated() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;

      const session = JSON.parse(raw);
      if (!session || !session.lastActiveTime) return false;

      const now = Date.now();
      const elapsed = now - session.lastActiveTime;

      // Check 30-min timeout
      if (elapsed > SESSION_TIMEOUT_MS) {
        this.logout();
        return false;
      }

      // Update activity timestamp
      session.lastActiveTime = now;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    } catch {
      return false;
    }
  },

  // Get active session data
  getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Logout method
  logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error(e);
    }
  }
};
