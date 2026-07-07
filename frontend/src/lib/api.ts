// Axios instance with base URL /api, X-Session-ID injection, and bearer-token auth.

import axios from 'axios';

const AUTH_TOKEN_KEY = 'ai_hub_auth_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('ai_hub_session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// An expired/invalid token means every /agents request 401s — clear it and
// reload so the Login gate takes over.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isLoginCall = error?.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall && localStorage.getItem(AUTH_TOKEN_KEY)) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
