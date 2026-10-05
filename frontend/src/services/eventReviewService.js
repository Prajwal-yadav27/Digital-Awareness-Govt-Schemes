import { authFetch, publicFetch } from './api';

export const createReview = async (data) => {
  const response = await authFetch('/event-reviews', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response;
};

export const getEventReviews = async (eventId, params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
  });
  const qs = query.toString();
  const url = qs ? `/event-reviews/event/${eventId}?${qs}` : `/event-reviews/event/${eventId}`;
  const response = await publicFetch(url);
  return response;
};

export const getMyEventReview = async (eventId) => {
  const response = await authFetch(`/event-reviews/my/${eventId}`);
  return response;
};

export const updateReview = async (id, data) => {
  const response = await authFetch(`/event-reviews/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return response;
};

export const deleteReview = async (id) => {
  const response = await authFetch(`/event-reviews/${id}`, { method: 'DELETE' });
  return response;
};
