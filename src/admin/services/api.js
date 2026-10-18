const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-movies.akatsuki-pvt-ltd.workers.dev';

export async function request(endpoint, options = {}) {
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const method = (options.method || 'GET').toUpperCase();

  // For GET requests in admin: always bypass any server/browser cache
  if (method === 'GET') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_t=${Date.now()}`;
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // For GET: add no-cache headers so admin always gets live data
  if (method === 'GET') {
    defaultHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    defaultHeaders['Pragma'] = 'no-cache';
  }

  const config = {
    ...options,
    method,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  // For GET: bypass browser HTTP cache
  if (method === 'GET') {
    config.cache = 'no-store';
  }

  // Timeout handling (15 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  config.signal = controller.signal;

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Server error (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && (errorData.error || errorData.message)) {
          errorMessage = errorData.error || errorData.message;
        }
      } catch (e) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    }
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' })
};
