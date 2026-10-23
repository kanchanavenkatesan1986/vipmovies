const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api-movies.akatsuki-pvt-ltd.workers.dev';

// Map for in-flight concurrent GET request deduplication
const inFlightGets = new Map();

async function executeRequest(endpoint, options, method) {
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  // For GET requests in admin: append _t timestamp for bypass if needed
  if (method === 'GET') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_t=${Date.now()}`;
  }

  const headers = {
    'Accept': 'application/json',
    ...options.headers
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    method,
    headers
  };

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

export async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // Deduplicate concurrent GET requests
  if (method === 'GET') {
    const dedupeKey = `${endpoint}`;
    if (inFlightGets.has(dedupeKey)) {
      return inFlightGets.get(dedupeKey);
    }
    const promise = executeRequest(endpoint, options, method)
      .finally(() => inFlightGets.delete(dedupeKey));
    inFlightGets.set(dedupeKey, promise);
    return promise;
  }

  return executeRequest(endpoint, options, method);
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' })
};
