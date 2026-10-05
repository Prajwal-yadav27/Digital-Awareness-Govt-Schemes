import { authFetch } from './api';

export const getMyNotifications = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
  });
  const qs = query.toString();
  const url = qs ? `/notifications?${qs}` : '/notifications';
  return await authFetch(url);
};

export const getUnreadCount = async () => {
  return await authFetch('/notifications/unread-count');
};

export const markAsRead = async (id) => {
  return await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
};

export const markAllAsRead = async () => {
  return await authFetch('/notifications/mark-all-read', { method: 'PATCH' });
};

export const deleteNotification = async (id) => {
  return await authFetch(`/notifications/${id}`, { method: 'DELETE' });
};
