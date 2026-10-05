import { authFetch } from './api';

export const createRegistration = async (data) => {
  const response = await authFetch('/registrations', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response;
};

export const getMyRegistrations = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const queryString = query.toString();
  const url = queryString ? `/registrations/my?${queryString}` : '/registrations/my';
  const response = await authFetch(url);
  return response;
};

export const getRegistrationById = async (id) => {
  const response = await authFetch(`/registrations/${id}`);
  return response;
};

export const cancelRegistration = async (id) => {
  const response = await authFetch(`/registrations/${id}/cancel`, {
    method: 'PATCH'
  });
  return response;
};

export const getEventRegistrations = async (eventId, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const queryString = query.toString();
  const url = queryString ? `/registrations/event/${eventId}?${queryString}` : `/registrations/event/${eventId}`;
  const response = await authFetch(url);
  return response;
};

export const updateRegistrationStatus = async (id, status) => {
  const response = await authFetch(`/registrations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return response;
};
