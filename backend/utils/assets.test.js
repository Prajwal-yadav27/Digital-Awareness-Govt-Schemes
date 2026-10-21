const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Asset-path validation for the premium visual direction:
// every local /images/* reference must resolve to a real file, and no
// runtime code may hotlink external image services.

const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const publicDir = path.join(frontendDir, 'public');

const collectRefs = (source) => [...source.matchAll(/\/images\/[A-Za-z0-9_.-]+/g)].map((m) => m[0]);

describe('image assets resolve locally', () => {
  it('every /images/* reference in images.js, Landing and About exists on disk', () => {
    const files = [
      path.join(frontendDir, 'src', 'utils', 'images.js'),
      path.join(frontendDir, 'src', 'pages', 'Landing.jsx'),
      path.join(frontendDir, 'src', 'pages', 'About.jsx'),
    ];
    const refs = new Set();
    for (const f of files) {
      for (const r of collectRefs(fs.readFileSync(f, 'utf8'))) refs.add(r);
    }
    assert.ok(refs.size > 10, `expected many image refs, got ${refs.size}`);
    const missing = [...refs].filter((p) => !fs.existsSync(path.join(publicDir, 'images', p.replace(/^\/images\//, ''))));
    assert.deepEqual(missing, [], `missing image files: ${missing.join(', ')}`);
  });

  it('no runtime external image hotlinks (unsplash/picsum/placeholders)', () => {
    const srcFiles = [
      path.join(frontendDir, 'src', 'utils', 'images.js'),
      path.join(frontendDir, 'src', 'components', 'SchemeCard.jsx'),
      path.join(frontendDir, 'src', 'components', 'EventCard.jsx'),
      path.join(frontendDir, 'src', 'pages', 'Landing.jsx'),
      path.join(frontendDir, 'src', 'pages', 'About.jsx'),
    ];
    const offenders = [];
    for (const f of srcFiles) {
      const src = fs.readFileSync(f, 'utf8');
      // Strip comments: licence documentation may name sources.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
      if (/images\.unsplash\.com|picsum\.photos|placekitten|placehold\.co/i.test(code)) {
        offenders.push(path.basename(f));
      }
    }
    assert.deepEqual(offenders, [], `external hotlinks in: ${offenders.join(', ')}`);
  });

  it('hero farmer asset is a reasonably sized local file', () => {
    const hero = path.join(publicDir, 'images', 'hero-farmer.jpg');
    const stat = fs.statSync(hero);
    assert.ok(stat.size > 50 * 1024, 'hero photo suspiciously small');
    assert.ok(stat.size < 1024 * 1024, 'hero photo should stay under 1MB');
  });
});
