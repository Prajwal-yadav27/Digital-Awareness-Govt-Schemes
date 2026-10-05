import { authFetch } from './api';

export const createPaymentOrder = async (registrationId) => {
  const response = await authFetch('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ registrationId })
  });
  return response;
};

export const verifyPayment = async (data) => {
  const response = await authFetch('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response;
};

export const refundPayment = async (paymentId, reason) => {
  const response = await authFetch(`/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {})
  });
  return response;
};

export const getPaymentByRegistration = async (registrationId) => {
  const response = await authFetch(`/payments/registration/${registrationId}`);
  return response;
};

export const getMyPayments = async (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
  });
  const qs = query.toString();
  const url = qs ? `/payments/my?${qs}` : '/payments/my';
  return await authFetch(url);
};
