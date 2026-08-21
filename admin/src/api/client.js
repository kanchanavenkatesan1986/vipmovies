import axios from 'axios';

const API_BASE_URL = 'https://api-movies.akatsuki-pvt-ltd.workers.dev';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 25000,
});

// Interceptor for Auth token & caching strategy
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vip_admin_jwt');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Optional JWT expiry handling
      console.warn('Unauthorized request - Token may be invalid or expired');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
