/**
 * Twilio SMS provider implementation.
 *
 * Implements the provider interface used by utils/sms.js:
 *   send({ to, from, body, timeoutMs }) -> Promise<{ provider, sid }>
 *
 * Notes:
 * - Only E.164-normalized `to` numbers and provider-approved message content
 *   should reach this layer (validation happens in utils/sms.js).
 * - Never logs message bodies (they may contain OTPs) or credentials.
 * - Twilio trial accounts restrict destinations and message templates
 *   (e.g. errors 57202/57206). Those are account-level restrictions, not
 *   application bugs; they surface as SMS_PROVIDER_ERROR.
 */

const twilio = require('twilio');

let client = null;

const getClient = () => {
  if (client) return client;
  const accountSid = process.env.SMS_ACCOUNT_SID;
  const authToken = process.env.SMS_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    const err = new Error('Twilio credentials are not configured');
    err.code = 'SMS_NOT_CONFIGURED';
    throw err;
  }
  client = twilio(accountSid, authToken);
  return client;
};

const withTimeout = (promise, timeoutMs, onTimeout) => {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('SMS provider request timed out');
      err.code = 'SMS_TIMEOUT';
      if (typeof onTimeout === 'function') {
        try { onTimeout(); } catch (_) { /* ignore */ }
      }
      reject(err);
    }, timeoutMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const send = async ({ to, from, body, timeoutMs }) => {
  if (!to || !from || !body) {
    const err = new Error('Twilio send requires to, from and body');
    err.code = 'SMS_INVALID_REQUEST';
    throw err;
  }
  const smsClient = getClient();
  const message = await withTimeout(
    smsClient.messages.create({ body, from, to }),
    timeoutMs
  );
  return { provider: 'twilio', sid: message && message.sid ? message.sid : undefined };
};

// For tests and process shutdown: drop the cached client.
const _resetClientForTests = () => {
  client = null;
};

module.exports = { name: 'twilio', send, _resetClientForTests };
