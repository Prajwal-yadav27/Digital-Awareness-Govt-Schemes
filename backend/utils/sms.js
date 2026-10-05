/**
 * SMS abstraction layer (provider-independent).
 *
 * Architecture:
 *   authController / notificationService / jobs
 *     -> sendSms({ to, body }) / sendOtpSms(...) / sendNotificationSms(...)
 *       -> provider registry (./smsProviders/*)
 *         -> configured SMS provider (Twilio by default)
 *
 * Business logic must NEVER contain provider-specific code; to add a new
 * production provider, implement ./smsProviders/<name>.js exposing
 *   send({ to, from, body, timeoutMs }) -> Promise<{ provider, sid }>
 * and register it in PROVIDERS below. No controller/service changes needed.
 *
 * Safety rules enforced here:
 * - Real provider delivery only. There is NO mock provider in this codebase,
 *   and SMS_PROVIDER=mock is rejected (fatal in production).
 * - OTP/message bodies are NEVER logged (they may contain OTPs).
 * - Credentials are NEVER logged (only a masked SID prefix + sender).
 * - Recipient numbers are masked in logs (last 4 digits visible).
 * - Provider calls are bounded by SMS_TIMEOUT_MS (default 15000ms).
 * - Provider failures are mapped to sanitized error codes; raw provider
 *   internals never reach API responses (callers already return safe
 *   user-facing messages; see authController phone OTP handlers).
 */

const PROVIDERS = {
  twilio: require('./smsProviders/twilio')
};

const DEFAULT_TIMEOUT_MS = 15000;
const MIN_TIMEOUT_MS = 3000;
const MAX_TIMEOUT_MS = 60000;

const getSmsProviderName = () => {
  return String(process.env.SMS_PROVIDER || 'twilio').trim().toLowerCase();
};

const getSmsTimeoutMs = () => {
  const raw = Number(process.env.SMS_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(raw)));
};

const isSmsConfigured = () => {
  const providerName = getSmsProviderName();
  if (!PROVIDERS[providerName]) return false;
  return Boolean(
    process.env.SMS_ACCOUNT_SID &&
    process.env.SMS_AUTH_TOKEN &&
    process.env.SMS_FROM
  );
};

/**
 * Validate SMS configuration at startup.
 * - Throws (fatal) when SMS_PROVIDER names an unsupported/mock provider in
 *   production, so a misconfigured deploy can never silently pretend SMS works.
 * - Missing credentials are NOT fatal (local dev without SMS is supported);
 *   the app then reports SMS_NOT_CONFIGURED gracefully at send time.
 * Returns { configured, provider } for logging.
 */
const validateSmsConfig = () => {
  const providerName = getSmsProviderName();
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

  if (providerName === 'mock') {
    const err = new Error('SMS_PROVIDER=mock is not allowed: production requires a real SMS provider');
    err.code = 'SMS_MOCK_NOT_ALLOWED';
    if (isProduction) throw err;
    console.error('[SMS] Configuration error:', err.message);
    return { configured: false, provider: providerName };
  }

  if (!PROVIDERS[providerName]) {
    const err = new Error(`Unsupported SMS_PROVIDER="${providerName}". Supported: ${Object.keys(PROVIDERS).join(', ')}`);
    err.code = 'SMS_UNKNOWN_PROVIDER';
    if (isProduction) throw err;
    console.error('[SMS] Configuration error:', err.message);
    return { configured: false, provider: providerName };
  }

  const configured = isSmsConfigured();
  if (!configured) {
    console.warn('[SMS] SMS is not configured (missing SID, auth token or sender). Phone OTP and SMS notifications will be unavailable until configured.');
  } else {
    const sid = String(process.env.SMS_ACCOUNT_SID || '');
    console.log('[SMS] Configured:', {
      provider: providerName,
      accountSid: sid ? `${sid.slice(0, 8)}...` : 'missing',
      from: process.env.SMS_FROM,
      timeoutMs: getSmsTimeoutMs()
    });
  }
  return { configured, provider: providerName };
};

const normalizePhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+91')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned;
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) return '+91' + cleaned;
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

const maskPhone = (phone) => {
  const value = String(phone || '');
  if (!value) return 'missing';
  // Keep only the last 4 digits visible; never log full numbers.
  return value.replace(/\d(?=\d{4})/g, '*');
};

// Map raw provider errors to sanitized, stable error codes.
// Server logs keep provider code/status for debugging; API layers must only
// surface these codes via their own safe user-facing messages.
const mapProviderError = (err) => {
  if (!err) return err;
  if (err.code === 'SMS_TIMEOUT' || err.code === 'SMS_NOT_CONFIGURED' || err.code === 'SMS_INVALID_REQUEST') {
    return err;
  }
  const providerCode = err.code;
  const status = err.status;
  const mapped = new Error('SMS provider request failed');
  if (status === 429 || providerCode === 20429) {
    mapped.code = 'SMS_RATE_LIMITED';
    mapped.message = 'SMS provider rate limit exceeded';
  } else if (providerCode === 21211 || providerCode === 21614 || providerCode === 21212) {
    mapped.code = 'SMS_INVALID_RECIPIENT';
    mapped.message = 'SMS recipient number is invalid';
  } else {
    mapped.code = 'SMS_PROVIDER_ERROR';
    mapped.message = 'SMS provider request failed';
  }
  mapped.providerCode = providerCode;
  mapped.providerStatus = status;
  return mapped;
};

const sendSms = async ({ to, body }) => {
  const providerName = getSmsProviderName();
  const provider = PROVIDERS[providerName];
  if (!provider || !isSmsConfigured()) {
    const err = new Error('SMS service is not configured');
    err.code = 'SMS_NOT_CONFIGURED';
    throw err;
  }

  const normalizedTo = normalizePhone(to);
  const from = process.env.SMS_FROM;
  if (!normalizedTo || !from || !body) {
    const err = new Error('SMS send requires to, from and body');
    err.code = 'SMS_INVALID_REQUEST';
    throw err;
  }

  console.log('[SMS] Sending via', `${providerName}:`, 'to:', maskPhone(normalizedTo));

  try {
    const result = await provider.send({
      to: normalizedTo,
      from,
      body,
      timeoutMs: getSmsTimeoutMs()
    });
    console.log('[SMS] Sent successfully via', `${providerName}:`, result && result.sid ? result.sid : 'ok');
    return { success: true, provider: providerName, sid: result && result.sid };
  } catch (err) {
    const mapped = mapProviderError(err);
    // Sanitized server-side log: provider code/status only. Never the body.
    console.error(
      '[SMS] Send failed via', `${providerName}:`,
      mapped.code,
      mapped.providerCode !== undefined ? `(provider code: ${mapped.providerCode})` : '',
      'to:', maskPhone(normalizedTo)
    );
    throw mapped;
  }
};

const sendOtpSms = async ({ to, otp, purpose = 'verification' }) => {
  const body = `Your GovSchemes Portal ${purpose} OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
  return sendSms({ to, body });
};

const sendNotificationSms = async ({ to, title, body }) => {
  // Build notification SMS: keep it concise, include title as prefix.
  // Delegates to sendSms so timeouts, masking and error mapping stay central.
  const fullBody = `${title}: ${body}`;
  return sendSms({ to, body: fullBody });
};

module.exports = {
  isSmsConfigured,
  validateSmsConfig,
  getSmsProviderName,
  getSmsTimeoutMs,
  sendSms,
  sendOtpSms,
  sendNotificationSms,
  normalizePhone
};
