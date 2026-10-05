import { authFetch } from './api';

export const getTicket = async (registrationId) => {
  const response = await authFetch(`/registrations/${registrationId}/ticket`);
  return response;
};

export const verifyTicket = async (ticketId) => {
  const response = await authFetch(`/registrations/verify/${ticketId}`);
  return response;
};

export const checkInTicket = async (ticketId) => {
  const response = await authFetch(`/registrations/verify/${ticketId}/check-in`, {
    method: 'PATCH'
  });
  return response;
};
