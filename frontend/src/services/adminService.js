import { authFetch } from './api';

export const getAdminOverview = async () => {
  return await authFetch('/admin/overview');
};

export const getUsers = async () => {
  return await authFetch('/auth/users');
};

export const deleteUser = async (userId) => {
  return await authFetch(`/auth/users/${userId}`, {
    method: 'DELETE',
  });
};

export const updateUserRole = async (userId, role) => {
  const response = await authFetch(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
  return response;
};