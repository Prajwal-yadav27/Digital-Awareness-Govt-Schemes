const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Guards the production OAuth return path:
// backend redirects to FRONTEND/login?rt=..., which is a client-side route.
// Vercel must rewrite all non-file paths to /index.html or direct
// navigation to /login returns platform 404 before React ever loads.

const frontendDir = path.join(__dirname, '..', '..', 'frontend');

describe('vercel SPA rewrite (OAuth /login return path)', () => {
  it('frontend/vercel.json exists in the Vercel deployment root with an SPA rewrite', () => {
    const vercelPath = path.join(frontendDir, 'vercel.json');
    assert.ok(fs.existsSync(vercelPath), 'frontend/vercel.json must exist (Vercel Root Directory is frontend/)');
    const raw = fs.readFileSync(vercelPath, 'utf8');
    const config = JSON.parse(raw);
    assert.ok(Array.isArray(config.rewrites) && config.rewrites.length > 0, 'rewrites must be a non-empty array');
    const spa = config.rewrites.find((r) => r && r.destination === '/index.html');
    assert.ok(spa, 'a rewrite to /index.html is required');
    // Must be a catch-all so /login (and any query string) serves the SPA.
    assert.ok(/\(\.\*\)/.test(spa.source), `rewrite source must catch /login, got: ${spa.source}`);
  });

  it('no repo-root vercel.json competes with the frontend deployment root', () => {
    const rootVercel = path.join(frontendDir, '..', 'vercel.json');
    if (fs.existsSync(rootVercel)) {
      const config = JSON.parse(fs.readFileSync(rootVercel, 'utf8'));
      assert.ok(
        JSON.stringify(config).includes('/index.html'),
        'repo-root vercel.json (if any) must not shadow the frontend SPA rewrite'
      );
    }
  });

  it('/login is a valid React Router route rendering Login', () => {
    const appSrc = fs.readFileSync(path.join(frontendDir, 'src', 'App.jsx'), 'utf8');
    assert.match(appSrc, /path="\/login"/);
    assert.match(appSrc, /<Login\s*\/>/);
  });

  it('Login reads ?rt= and exchanges via the backend (logic intact)', () => {
    const loginSrc = fs.readFileSync(path.join(frontendDir, 'src', 'pages', 'Login.jsx'), 'utf8');
    assert.match(loginSrc, /searchParams\.get\('rt'\)/);
    assert.match(loginSrc, /\$\{API_BASE_URL\}\/auth\/google\/exchange\?rt=/);
  });

  it('built SPA entry point exists for the rewrite target', () => {
    const indexHtml = fs.readFileSync(path.join(frontendDir, 'dist', 'index.html'), 'utf8');
    assert.match(indexHtml, /<div id="root"><\/div>/);
  });
});
