/**
 * Custom NoSQL injection / prototype-pollution sanitization middleware.
 *
 * Compatible with Express 5: req.query is a getter-only property, so this
 * middleware NEVER assigns or replaces req.query. It only reads the parsed
 * object and rejects the request when a dangerous key is detected.
 *
 * Dangerous keys:
 *   - MongoDB operators (any key starting with "$", e.g. "$ne", "$where", "$gt")
 *   - Dotted keys (e.g. "user.password") used for field/prototype injection
 *   - Prototype-pollution keys ("__proto__", "constructor", "prototype")
 *
 * Only KEY names are inspected. String VALUES that happen to contain "$" or "."
 * (e.g. "price is $100" or "a.b@c.com") are never flagged because the check
 * targets object keys, not their values.
 */

const OPERATOR_PREFIX = '$';

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDangerousKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith(OPERATOR_PREFIX)) return true;
  // Express 5's "simple" query parser does not build nested objects from
  // bracket notation, so an attack like "search[$ne]=x" arrives as a flat
  // key literally named "search[$ne]". Flagging any "$" inside a key name
  // catches this form as well as standard leading-operator keys.
  if (key.includes('$')) return true;
  if (key.includes('.')) return true;
  if (PROTOTYPE_KEYS.has(key)) return true;
  return false;
}

// Recursively walk a parsed object/array and return true on first dangerous key.
function containsDangerousKey(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      if (containsDangerousKey(node[i])) return true;
    }
    return false;
  }

  if (isPlainObject(node)) {
    for (const key of Object.keys(node)) {
      if (isDangerousKey(key)) return true;
      if (containsDangerousKey(node[key])) return true;
    }
    return false;
  }

  return false;
}

// Route params are single-level; only their names can be suspicious.
function hasDangerousParamKey(params) {
  if (!isPlainObject(params)) return false;
  for (const key of Object.keys(params)) {
    if (isDangerousKey(key)) return true;
  }
  return false;
}

const sanitizeRequest = (req, res, next) => {
  try {
    // req.query is getter-only in Express 5 — read-only check, never assigned.
    if (req.query && containsDangerousKey(req.query)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }

    if (req.params && hasDangerousParamKey(req.params)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters'
      });
    }

    if (req.body && (isPlainObject(req.body) || Array.isArray(req.body))) {
      if (containsDangerousKey(req.body)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request parameters'
        });
      }
    }

    return next();
  } catch (err) {
    // Never expose internal implementation details.
    return res.status(400).json({
      success: false,
      message: 'Invalid request parameters'
    });
  }
};

module.exports = sanitizeRequest;
