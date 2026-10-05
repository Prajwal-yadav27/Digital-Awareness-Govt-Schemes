export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const getToken = () => localStorage.getItem('token');

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('authTimestamp');
};

const handleAuthError = (status, data) => {
  if (status === 401) {
    clearAuth();
    if (data?.errorCode === 'TOKEN_EXPIRED' || data?.errorCode === 'TOKEN_INVALID') {
      const event = new CustomEvent('auth:expired', {
        detail: {
          message: data.message || 'Your session has expired. Please login again.'
        }
      });
      window.dispatchEvent(event);
    }
  }
};

export const authFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });
  } catch (networkErr) {
    throw new Error(
      networkErr.message === 'Failed to fetch'
        ? 'Network error. Please check your connection and try again.'
        : 'Request failed. Please try again.'
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  handleAuthError(response.status, data);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      (data?.errors && Object.values(data.errors)[0]) ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
};

export const publicFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options.headers
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers
    });
  } catch (networkErr) {
    throw new Error(
      networkErr.message === 'Failed to fetch'
        ? 'Network error. Please check your connection.'
        : 'Request failed. Please try again.'
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
};
