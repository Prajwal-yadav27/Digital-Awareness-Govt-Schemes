const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const {
  signExchangeToken,
  verifyExchangeToken,
  EXCHANGE_AUDIENCE,
  EXCHANGE_TTL_MS
} = require('./oauthExchange');

const TEST_SECRET = 'test-exchange-secret-0123456789abcdef0123456789';
const WRONG_SECRET = 'wrong-exchange-secret-abcdef0123456789xxxxxx';
const USER_ID = '68f2a1b3c4d5e6f7890abc12';
const ROLE = 'user';

let savedJwtSecret;

beforeEach(() => {
  savedJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
});

afterEach(() => {
  if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedJwtSecret;
});

describe('oauthExchange helper', () => {
  it('valid exchange token verifies with expected claims', () => {
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    assert.equal(typeof rt, 'string');
    assert.equal(rt.split('.').length, 3);
    const payload = verifyExchangeToken(rt, TEST_SECRET);
    assert.ok(payload);
    assert.equal(payload.sub, USER_ID);
    assert.equal(payload.role, ROLE);
    assert.equal(payload.aud, EXCHANGE_AUDIENCE);
    assert.equal(payload.purpose, EXCHANGE_AUDIENCE);
    assert.match(payload.jti, /^[0-9a-f]{32}$/);
  });

  it('default lifetime is approximately 2 minutes', () => {
    assert.equal(EXCHANGE_TTL_MS, 2 * 60 * 1000);
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    const payload = verifyExchangeToken(rt, TEST_SECRET);
    const lifetimeSec = payload.exp - payload.iat;
    assert.ok(lifetimeSec >= 110 && lifetimeSec <= 130, `lifetime ${lifetimeSec}s`);
  });

  it('expired token is rejected', () => {
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET, -1000);
    assert.equal(verifyExchangeToken(rt, TEST_SECRET), null);
  });

  it('malformed and tampered tokens are rejected', () => {
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    assert.equal(verifyExchangeToken('', TEST_SECRET), null);
    assert.equal(verifyExchangeToken(null, TEST_SECRET), null);
    assert.equal(verifyExchangeToken('a.b', TEST_SECRET), null);
    assert.equal(verifyExchangeToken('a.b.c.d', TEST_SECRET), null);
    const parts = rt.split('.');
    const tamperedSig = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    assert.equal(verifyExchangeToken(`${parts[0]}.${parts[1]}.${tamperedSig}`, TEST_SECRET), null);
    assert.equal(verifyExchangeToken(`${parts[1]}.${parts[0]}.${parts[2]}`, TEST_SECRET), null);
  });

  it('wrong signing secret is rejected', () => {
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    assert.equal(verifyExchangeToken(rt, WRONG_SECRET), null);
  });

  it('wrong purpose/audience is rejected', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const wrongAud = jwt.sign(
      { sub: USER_ID, role: ROLE, purpose: 'other', jti: 'a'.repeat(32), iat: nowSec, exp: nowSec + 120 },
      TEST_SECRET,
      { algorithm: 'HS256', audience: 'other', noTimestamp: true }
    );
    assert.equal(verifyExchangeToken(wrongAud, TEST_SECRET), null);
  });

  it('ordinary access token (no audience) is rejected as an exchange token', () => {
    const access = jwt.sign({ id: USER_ID, role: ROLE }, TEST_SECRET, { expiresIn: '7d' });
    assert.equal(verifyExchangeToken(access, TEST_SECRET), null);
  });

  it('replay within the window still verifies (documented non-single-use limitation)', () => {
    // Stateless tokens cannot be single-use without shared storage.
    // A replay mints an equivalent session for the SAME user; role is
    // re-read from the database at exchange time. Strict single-use
    // requires a MongoDB-backed jti allowlist (see module docs).
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    assert.ok(verifyExchangeToken(rt, TEST_SECRET));
    assert.ok(verifyExchangeToken(rt, TEST_SECRET));
  });

  it('stateless across reloads (no process-local Map)', () => {
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    const resolved = require.resolve('./oauthExchange');
    delete require.cache[resolved];
    const fresh = require('./oauthExchange');
    assert.ok(fresh.verifyExchangeToken(rt, TEST_SECRET));
  });
});

describe('exchange vs access token separation', () => {
  it('exchange token is rejected by ordinary protected API authorization', async () => {
    const { protect } = require('../middleware/authMiddleware');
    const User = require('../models/User');
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    let findCalled = false;
    const origFind = User.findById;
    User.findById = () => { findCalled = true; return Promise.resolve(null); };
    try {
      let status; let body;
      const req = { headers: { authorization: `Bearer ${rt}` } };
      const res = {
        status(c) { status = c; return res; },
        json(b) { body = b; return res; }
      };
      let nextCalled = false;
      await protect(req, res, () => { nextCalled = true; });
      assert.equal(status, 401);
      assert.equal(body.errorCode, 'TOKEN_INVALID');
      assert.equal(nextCalled, false);
      assert.equal(findCalled, false);
    } finally {
      User.findById = origFind;
    }
  });

  it('ordinary access token still passes the audience gate to user lookup', async () => {
    const { protect } = require('../middleware/authMiddleware');
    const User = require('../models/User');
    const access = jwt.sign({ id: USER_ID, role: ROLE }, TEST_SECRET, { expiresIn: '7d' });
    const fakeUser = { _id: USER_ID, role: ROLE };
    const origFind = User.findById;
    User.findById = () => ({ select: () => Promise.resolve(fakeUser) });
    try {
      const req = { headers: { authorization: `Bearer ${access}` } };
      let status; const res = { status(c) { status = c; return res; }, json() { return res; } };
      let nextCalled = false;
      await protect(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
      assert.equal(req.user, fakeUser);
    } finally {
      User.findById = origFind;
    }
  });
});

describe('google exchange handler compatibility', () => {
  it('missing rt keeps the safe distinct error', async () => {
    const { exchangeGoogleOAuthToken } = require('../controllers/googleAuthController');
    let status; let body;
    const res = { status(c) { status = c; return res; }, json(b) { body = b; return res; } };
    await exchangeGoogleOAuthToken({ query: {} }, res);
    assert.equal(status, 400);
    assert.deepEqual(body, { success: false, message: 'Redirect token not provided' });
  });

  it('invalid rt keeps the safe distinct error (never password text)', async () => {
    const { exchangeGoogleOAuthToken } = require('../controllers/googleAuthController');
    let status; let body;
    const res = { status(c) { status = c; return res; }, json(b) { body = b; return res; } };
    await exchangeGoogleOAuthToken({ query: { rt: 'bogus.token.value' } }, res);
    assert.equal(status, 400);
    assert.deepEqual(body, { success: false, message: 'Invalid or expired redirect token' });
  });

  it('missing/invalid user returns User not found (stubbed lookup)', async () => {
    const { exchangeGoogleOAuthToken } = require('../controllers/googleAuthController');
    const User = require('../models/User');
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    const origFind = User.findById;
    User.findById = () => ({ select: () => Promise.resolve(null) });
    try {
      let status; let body;
      const res = { status(c) { status = c; return res; }, json(b) { body = b; return res; } };
      await exchangeGoogleOAuthToken({ query: { rt } }, res);
      assert.equal(status, 400);
      assert.deepEqual(body, { success: false, message: 'User not found in database' });
    } finally {
      User.findById = origFind;
    }
  });

  it('valid exchange mints a fresh access token (never the rt itself)', async () => {
    const { exchangeGoogleOAuthToken } = require('../controllers/googleAuthController');
    const User = require('../models/User');
    const rt = signExchangeToken(USER_ID, ROLE, TEST_SECRET);
    const fakeUser = {
      _id: USER_ID, name: 'OAuth User', email: 'oauth@example.com', role: ROLE,
      bookmarks: [], phone: null, phoneVerified: false, isOrganizerVerified: false,
      notificationPreferences: { inApp: true, email: true, sms: false },
      createdAt: new Date()
    };
    const origFind = User.findById;
    User.findById = (id) => {
      assert.equal(String(id), USER_ID);
      return { select: () => Promise.resolve(fakeUser) };
    };
    try {
      let body;
      const res = { status() { return res; }, json(b) { body = b; return res; } };
      await exchangeGoogleOAuthToken({ query: { rt } }, res);
      assert.equal(body.success, true);
      assert.ok(body.data.token);
      assert.notEqual(body.data.token, rt);
      // Fresh token is an ordinary access token: no exchange audience.
      const decoded = jwt.decode(body.data.token);
      assert.equal(decoded.id, USER_ID);
      assert.equal(decoded.aud, undefined);
      assert.equal(body.data.user.email, 'oauth@example.com');
    } finally {
      User.findById = origFind;
    }
  });
});
