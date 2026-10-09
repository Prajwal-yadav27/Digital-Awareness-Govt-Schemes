const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Stateless, short-lived OAuth exchange token ("rt").
// Replaces the former process-local Map so callback -> exchange works
// across Render restarts and multiple instances sharing JWT_SECRET.
//
// Design:
// - Signed HS256 JWT with explicit audience/purpose `oauth-exchange`.
// - Claims: sub (user id string), role (string), jti (32 hex chars),
//   purpose === 'oauth-exchange', aud === 'oauth-exchange', iat/exp.
// - Default lifetime ~2 minutes, capped at 5 minutes. Signature
//   verification (constant-time HMAC compare inside jsonwebtoken) plus
//   strict claim checks.
// - The exchange handler mints a FRESH application access token at
//   exchange time (same 7d {id,role} format) from the DB user record,
//   so the `rt` value in the URL never contains a usable access token,
//   ordinary access tokens (no audience) are rejected as `rt`, and
//   `rt` values are rejected by `protect` (see authMiddleware).
//
// Single-use limitation (documented, not falsely claimed):
// stateless verification cannot guarantee one-time consumption without
// shared storage — an `rt` remains verifiable until it expires and a
// replay within the ~2 minute window would mint an equivalent session
// for the SAME user (idempotent, no privilege escalation; role is
// re-read from the database). For strict single-use, persist `jti` in
// MongoDB with a TTL index and atomically consume it
// (e.g. unique index on jti + findOneAndDelete/insert-if-absent);
// see the report accompanying this change.

const EXCHANGE_AUDIENCE = 'oauth-exchange';
const EXCHANGE_TTL_MS = 2 * 60 * 1000; // ~2 minutes
const EXCHANGE_MAX_TTL_MS = 5 * 60 * 1000; // hard cap

const signExchangeToken = (userId, role, secret, ttlMs = EXCHANGE_TTL_MS) => {
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('OAuth exchange signing secret is not configured');
  }
  const sub = String(userId || '');
  if (!sub) throw new Error('OAuth exchange subject is required');
  if (!role || typeof role !== 'string') throw new Error('OAuth exchange role is required');
  const ttl = Number(ttlMs);
  const nowSec = Math.floor(Date.now() / 1000);
  let expSec;
  if (Number.isFinite(ttl) && ttl <= 0) {
    // Test-only path: craft an already-expired token.
    expSec = nowSec - 1;
  } else {
    const capped = Number.isFinite(ttl)
      ? Math.min(Math.max(Math.floor(ttl), 1000), EXCHANGE_MAX_TTL_MS)
      : EXCHANGE_TTL_MS;
    expSec = nowSec + Math.max(1, Math.floor(capped / 1000));
  }
  // Note: production callers use the 2-minute default; the <=0 branch
  // exists so tests can deterministically cover expiry.
  const jti = crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    { sub, role, purpose: EXCHANGE_AUDIENCE, jti, iat: nowSec, exp: expSec },
    secret,
    { algorithm: 'HS256', audience: EXCHANGE_AUDIENCE }
  );
};

// Returns the verified payload ({sub, role, jti, iat, exp, ...}) or null.
// Never throws for malformed/tampered/expired input; never logs secrets.
const verifyExchangeToken = (token, secret) => {
  if (!token || typeof token !== 'string' || !secret || typeof secret !== 'string' || secret.length === 0) {
    return null;
  }
  if (token.length === 0 || token.length > 4096) return null;
  if (token.split('.').length !== 3) return null;
  let payload;
  try {
    payload = jwt.verify(token, secret, { audience: EXCHANGE_AUDIENCE, algorithms: ['HS256'] });
  } catch (_) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.aud !== EXCHANGE_AUDIENCE) return null;
  if (payload.purpose !== EXCHANGE_AUDIENCE) return null;
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) return null;
  if (!payload.role || typeof payload.role !== 'string' || payload.role.length > 64) return null;
  if (!payload.jti || !/^[0-9a-f]{32}$/.test(payload.jti)) return null;
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;
  if (payload.exp <= payload.iat) return null;
  if ((payload.exp - payload.iat) * 1000 > EXCHANGE_MAX_TTL_MS) return null;
  return payload;
};

module.exports = { signExchangeToken, verifyExchangeToken, EXCHANGE_AUDIENCE, EXCHANGE_TTL_MS, EXCHANGE_MAX_TTL_MS };
