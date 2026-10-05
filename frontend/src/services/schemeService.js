import { authFetch, publicFetch } from './api';

export const getSchemes = async (params = {}) => {
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
  const url = queryString ? `/schemes?${queryString}` : '/schemes';
  const response = await publicFetch(url);
  return response;
};

export const getSchemeById = async (id) => {
  const response = await publicFetch(`/schemes/${id}`);
  return response;
};

export const createScheme = async (data) => {
  const response = await authFetch('/schemes', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response;
};

export const updateScheme = async (id, data) => {
  const response = await authFetch(`/schemes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return response;
};

export const deleteScheme = async (id) => {
  const response = await authFetch(`/schemes/${id}`, {
    method: 'DELETE'
  });
  return response;
};

export const getSchemeMetadata = async () => {
  const response = await publicFetch('/schemes/metadata');
  return response;
};

export const recordApplyNow = async (id) => {
  const response = await publicFetch(`/schemes/${id}/apply`, {
    method: 'POST'
  });
  return response;
};
