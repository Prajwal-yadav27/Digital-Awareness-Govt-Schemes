import { authFetch, publicFetch } from './api';

export const getEvents = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        query.append(key, value.join(','));
      } else {
        query.append(key, String(value));
      }
    }
  });
  const queryString = query.toString();
  const url = queryString ? `/events?${queryString}` : '/events';
  const response = await publicFetch(url);
  return response;
};

export const getEventById = async (id) => {
  const response = await authFetch(`/events/${id}`);
  return response;
};

export const getOrganizerEvents = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        query.append(key, value.join(','));
      } else {
        query.append(key, String(value));
      }
    }
  });
  const queryString = query.toString();
  const url = queryString ? `/events/organizer?${queryString}` : '/events/organizer';
  const response = await authFetch(url);
  return response;
};

export const createEvent = async (data) => {
  const response = await authFetch('/events', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response;
};

export const updateEvent = async (id, data) => {
  const response = await authFetch(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return response;
};

export const deleteEvent = async (id) => {
  const response = await authFetch(`/events/${id}`, {
    method: 'DELETE'
  });
  return response;
};

export const updateEventStatus = async (id, status) => {
  const response = await authFetch(`/events/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return response;
};

export const getOrganizerAnalytics = async () => {
  const response = await authFetch('/events/organizer/analytics');
  return response;
};

export const getAdminEvents = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        query.append(key, value.join(','));
      } else {
        query.append(key, String(value));
      }
    }
  });
  const queryString = query.toString();
  const url = queryString ? `/events/admin?${queryString}` : '/events/admin';
  const response = await authFetch(url);
  return response;
};

export const getAdminEventStats = async () => {
  const response = await authFetch('/events/admin/stats');
  return response;
};

export const getAdminEventMeta = async () => {
  const response = await authFetch('/events/admin/meta');
  return response;
};
