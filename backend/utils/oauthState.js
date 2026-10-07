const crypto = require('crypto');

// Stateless, signed OAuth CSRF state.
// Format: base64url(nonce).base64url(expiresAtMs).base64url(signature)
// where signature = HMAC-SHA256(nonce + "." + expiresAtMs, secret).
// No process-memory storage, so verification survives restarts and
// works across multiple backend instances sharing the same secret.
// CSRF protection is preserved: state is unpredictable (16 random bytes),
// short-lived, and unforgeable without the secret.

const DEFAULT_TTL_MS = 10 * 60 * 1000; // ~10 minutes

const toB64Url = (value) => Buffer.from(String(value), 'utf8').toString('base64url');

const fromB64Url = (part) => {
  if (typeof part !== 'string' || part.length === 0 || part.length > 256) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(part)) return null;
  try {
    return Buffer.from(part, 'base64url').toString('utf8');
  } catch (_) {
    return null;
  }
};

const signOAuthState = (secret, ttlMs = DEFAULT_TTL_MS) => {
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('OAuth state signing secret is not configured');
  }
  const ttl = Number(ttlMs);
  const effectiveTtl = Number.isFinite(ttl) ? Math.floor(ttl) : DEFAULT_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = String(Date.now() + effectiveTtl);
  const data = `${nonce}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${toB64Url(nonce)}.${toB64Url(expiresAt)}.${toB64Url(signature)}`;
};

const verifyOAuthState = (state, secret) => {
  if (!state || typeof state !== 'string' || !secret || typeof secret !== 'string' || secret.length === 0) {
    return false;
  }
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonceB64, expB64, sigB64] = parts;
  const nonce = fromB64Url(nonceB64);
  const expiresAtStr = fromB64Url(expB64);
  const signature = fromB64Url(sigB64);
  if (nonce === null || expiresAtStr === null || signature === null) return false;
  // Nonce must be 32 lowercase hex chars (16 random bytes); expiry must be digits;
  // signature must be 64 lowercase hex chars (SHA-256 hex).
  if (!/^[0-9a-f]{32}$/.test(nonce)) return false;
  if (!/^\d{1,20}$/.test(expiresAtStr)) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const data = `${nonce}.${expiresAtStr}`;
  let expected;
  try {
    expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
  } catch (_) {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
};

module.exports = { signOAuthState, verifyOAuthState, DEFAULT_TTL_MS };
