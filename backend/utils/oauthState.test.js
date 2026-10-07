const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { signOAuthState, verifyOAuthState } = require('./oauthState');

const TEST_SECRET = 'test-oauth-state-secret-0123456789abcdef';
const WRONG_SECRET = 'wrong-secret-0123456789abcdef-wrong!!';

describe('oauthState helper (stateless Google OAuth CSRF)', () => {
  it('valid state signs and verifies', () => {
    const state = signOAuthState(TEST_SECRET);
    assert.equal(typeof state, 'string');
    assert.equal(state.split('.').length, 3);
    assert.equal(verifyOAuthState(state, TEST_SECRET), true);
  });

  it('tampered signature is rejected', () => {
    const state = signOAuthState(TEST_SECRET);
    const parts = state.split('.');
    const last = parts[2];
    const flipped = (last[0] === 'A' ? 'B' : 'A') + last.slice(1);
    assert.equal(verifyOAuthState(`${parts[0]}.${parts[1]}.${flipped}`, TEST_SECRET), false);
  });

  it('tampered nonce is rejected', () => {
    const state = signOAuthState(TEST_SECRET);
    const parts = state.split('.');
    const tamperedNonce = Buffer.from('0'.repeat(32), 'utf8').toString('base64url');
    assert.equal(verifyOAuthState(`${tamperedNonce}.${parts[1]}.${parts[2]}`, TEST_SECRET), false);
  });

  it('wrong secret is rejected', () => {
    const state = signOAuthState(TEST_SECRET);
    assert.equal(verifyOAuthState(state, WRONG_SECRET), false);
  });

  it('expired state is rejected', () => {
    const state = signOAuthState(TEST_SECRET, -1000);
    assert.equal(verifyOAuthState(state, TEST_SECRET), false);
  });

  it('malformed states are rejected', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', '***.***.***', `${'A'.repeat(300)}.B.C`]) {
      assert.equal(verifyOAuthState(bad, TEST_SECRET), false, `should reject: ${bad.slice(0, 20)}`);
    }
  });

  it('missing state is rejected', () => {
    assert.equal(verifyOAuthState(undefined, TEST_SECRET), false);
    assert.equal(verifyOAuthState(null, TEST_SECRET), false);
    assert.equal(verifyOAuthState('', TEST_SECRET), false);
  });

  it('missing secret is rejected without throwing', () => {
    const state = signOAuthState(TEST_SECRET);
    assert.equal(verifyOAuthState(state, undefined), false);
    assert.equal(verifyOAuthState(state, ''), false);
  });

  it('state remains verifiable after process restart (stateless)', () => {
    const state = signOAuthState(TEST_SECRET);
    // Simulate a Render restart: drop the module from cache and reload.
    // A Map-based implementation would lose the entry; stateless must pass.
    const resolved = require.resolve('./oauthState');
    delete require.cache[resolved];
    const fresh = require('./oauthState');
    assert.equal(fresh.verifyOAuthState(state, TEST_SECRET), true);
  });
});

describe('googleAuthCallback invalid state', () => {
  it('returns 400 Invalid OAuth state without leaking details', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || TEST_SECRET;
    const { googleAuthCallback } = require('../controllers/googleAuthController');
    const calls = [];
    const res = {
      status(code) { calls.push(['status', code]); return res; },
      json(body) { calls.push(['json', body]); return res; },
      redirect() { calls.push(['redirect']); return res; }
    };
    await googleAuthCallback({ query: { code: 'dummy-code', state: 'bogus.state.value' } }, res);
    assert.deepEqual(calls, [['status', 400], ['json', { success: false, message: 'Invalid OAuth state' }]]);
  });

  it('missing state returns the same safe 400', async () => {
    const { googleAuthCallback } = require('../controllers/googleAuthController');
    let status; let body;
    const res = { status(c) { status = c; return res; }, json(b) { body = b; return res; }, redirect() { throw new Error('should not redirect'); } };
    await googleAuthCallback({ query: { code: 'dummy-code' } }, res);
    assert.equal(status, 400);
    assert.deepEqual(body, { success: false, message: 'Invalid OAuth state' });
  });
});

describe('deployed frontend OAuth URLs use API_BASE_URL', () => {
  const loginPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Login.jsx');
  const registerPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Register.jsx');
  const loginSrc = fs.readFileSync(loginPath, 'utf8');
  const registerSrc = fs.readFileSync(registerPath, 'utf8');

  it('Login Google exchange uses Render API_BASE_URL', () => {
    assert.match(loginSrc, /\$\{API_BASE_URL\}\/auth\/google\/exchange\?rt=/);
    assert.doesNotMatch(loginSrc, /fetch\(`\/api\/auth\/google\/exchange/);
  });

  it('Register Google/Twitter initiation uses Render API_BASE_URL', () => {
    assert.match(registerSrc, /\$\{API_BASE_URL\}\/auth\/google/);
    assert.match(registerSrc, /\$\{API_BASE_URL\}\/auth\/twitter/);
    assert.doesNotMatch(registerSrc, /window\.location\.href = '\/api\/auth\/google'/);
    assert.doesNotMatch(registerSrc, /window\.location\.href = '\/api\/auth\/twitter'/);
  });
});
