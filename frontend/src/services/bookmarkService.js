import { authFetch } from './api';

export const addBookmark = async (schemeId) => {
  const response = await authFetch(`/bookmarks/${schemeId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  return response.data;
};

export const getBookmarks = async () => {
  const response = await authFetch('/bookmarks', {
    method: 'GET',
  });

  return response.data;
};

export const deleteBookmark = async (schemeId) => {
  const response = await authFetch(`/bookmarks/${schemeId}`, {
    method: 'DELETE',
  });

  return response.data;
};