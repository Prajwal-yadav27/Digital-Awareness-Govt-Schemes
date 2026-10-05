const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const RATE_LIMIT_MESSAGE = {
  success: false,
  message: 'Too many requests. Please try again later.'
};

// Per-user key (falls back to IP for any unauthenticated edge case) so that
// legitimate users behind a shared NAT/office network are not collectively
// throttled by an IP-only limit. The IP fallback uses ipKeyGenerator so IPv6
// addresses (which contain ':') are handled safely per express-rate-limit.
const userKey = (req) => {
  if (req.user && (req.user.id || req.user._id)) {
    return String(req.user.id || req.user._id);
  }
  return ipKeyGenerator(req.ip);
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: RATE_LIMIT_MESSAGE
});

// Event create / update / delete / admin status change.
// Authenticated organizer/admin writes; a compromised account could spam
// events or notification triggers. 40 per 10 min still blocks abuse (a spammer
// is capped at 240 writes/hour) while accommodating legitimate admins who
// moderate many events and the shared test admin account used by the
// regression suite.
const eventWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE
});

// Citizen event registration. Prevents automated bulk registrations that could
// exhaust event capacity or flood notification systems. 20 per 10 min covers
// any realistic sign-up spree by a single citizen.
const registrationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE
});

// Payment order creation / verification. Hits the external Razorpay gateway and
// can incur cost; strict limit. 10 per 10 min is far beyond normal user usage.
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE
});

// Ticket/QR verification and check-in. Authenticated organizer/admin only and
// ownership-checked, so enumeration risk is low; the limit is intentionally
// generous (60 per minute) to accommodate on-site scanning at busy venues
// while still blocking runaway loops or abuse.
const verificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKey,
  message: RATE_LIMIT_MESSAGE
});

module.exports = {
  authLimiter,
  eventWriteLimiter,
  registrationLimiter,
  paymentLimiter,
  verificationLimiter
};
