import { authFetch, publicFetch, API_BASE_URL, clearAuth } from './api';

export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      (data?.errors && Object.values(data.errors)[0]) ||
      'Registration failed. Please try again.'
    );
  }

  return data.data;
};

export const login = async (credentials) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(credentials)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearAuth();
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      'Login failed. Please check your credentials.'
    );
  }

  return data.data;
};

export const getMyProfile = async () => {
  const response = await authFetch('/auth/profile');
  return response.data;
};

export const sendPhoneOtp = async (phone) => {
  const response = await authFetch('/auth/phone/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone })
  });
  return response;
};

export const verifyPhoneOtp = async (otp) => {
  const response = await authFetch('/auth/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otp })
  });
  return response.data;
};

export const updatePhone = async (phone) => {
  const response = await authFetch('/auth/phone', {
    method: 'PATCH',
    body: JSON.stringify({ phone })
  });
  return response.data;
};

export const resendPhoneOtp = async () => {
  const response = await authFetch('/auth/phone/resend-otp', {
    method: 'POST'
  });
  return response;
};

export const deletePhone = async () => {
  const response = await authFetch('/auth/phone', {
    method: 'DELETE'
  });
  return response;
};

export const updateNotificationPreferences = async (preferences) => {
  const response = await authFetch('/auth/preferences/notifications', {
    method: 'PATCH',
    body: JSON.stringify(preferences)
  });
  return response.data;
};

export const toggleBookmark = async (schemeId) => {
  const response = await authFetch(`/auth/bookmarks/${schemeId}`, {
    method: 'POST'
  });
  return response.data;
};

export const getBookmarks = async () => {
  const response = await authFetch('/auth/bookmarks');
  return response.data;
};

export const getProtected = async () => {
  return authFetch('/protected');
};
