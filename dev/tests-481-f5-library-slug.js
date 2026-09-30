// tests-481-f5-library-slug.js — #481 F5 (audit 2026-09-29, Fable-approved with changes), the client half: the server and the
// client built library slugs differently. The server trimmed ONE edge underscore (/^_|_$/ without g) where the client trimmed
// both, so "(Ammut)" was ammut_ on the server and ammut here, and "Åsa Lindé" sa_lind_ against sa_lind: Replace / Update from
// library never found those characters, and an export overwrote the library copy without the usual confirm. Now ONE slug
// contract, library-slug.js, is loaded by the game and vendored unchanged to the server as library-slug.cjs (the
// blueprint-edition.cjs pattern); the blueprint slug reproduces the designer's slice rule. The vendoring pin: both repos pin
// the same SHA-256 of the file (this test here, test-library-slug.mjs on the server) — update both together.
//   node dev/tests-481-f5-library-slug.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const LIBRARY_SLUG_SHA256 = "4d02b9b6a528903f58771ad101a36c0b6d627f0306324c28adc78afde2afd872";   /* the vendored contract's bytes — the server's test-library-slug.mjs pins the same value */
let LS = null; try { LS = require('../library-slug.js'); } catch (e) { LS = null; }
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 F5 ' + name); } catch (e) { failed++; console.error('FAIL #481 F5 ' + name + ' — ' + (e && e.message || e)); } }

test('the repro names: one rule trims BOTH edge underscores ("(Ammut)" → ammut, "Åsa Lindé" → sa_lind)', () => {
  assert.ok(LS && typeof LS.library === 'function', 'library-slug.js (the shared contract) is missing');
  assert.equal(LS.library('(Ammut)'), 'ammut');
  assert.equal(LS.library('Åsa Lindé'), 'sa_lind');
  assert.equal(LS.library('Ammut'), 'ammut');
  assert.equal(LS.library('Sir Bram, the Bold'), 'sir_bram_the_bold');
  assert.equal(LS.library('--'), '');
  assert.equal(LS.library(null), '');
});
test('the blueprint slug reproduces the designer\'s slice rule (trim, then at most 120)', () => {
  assert.ok(LS && typeof LS.blueprint === 'function', 'LibrarySlug.blueprint is missing');
  const designer = fs.readFileSync(path.join(root, 'blueprint-designer.html'), 'utf8');
  const chain = '.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,120)';
  assert.ok(designer.indexOf(chain) >= 0, 'the designer\'s id rule changed — re-read it and keep LibrarySlug.blueprint equal to it');
  const rule = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 120);
  const long = 'The ' + 'Very '.repeat(40) + 'Long Road (draft)';
  ['(Ammut)', 'Åsa Lindé', 'The Iron Meridian', long, 'x'.repeat(119) + ' y'].forEach(n => assert.equal(LS.blueprint(n), rule(n), 'for ' + JSON.stringify(n.slice(0, 40))));
  assert.ok(LS.blueprint(long).length <= 120);
});
test('the game\'s two library slug sites go through the one contract', () => {
  const h = fs.readFileSync(path.join(root, 'helpers.js'), 'utf8'), u = fs.readFileSync(path.join(root, 'ui-browsers.js'), 'utf8');
  assert.match(h, /function partyUploadSlug\(name\)\{return LibrarySlug\.library\(name\);\}/, 'helpers.js partyUploadSlug must delegate to LibrarySlug.library');
  assert.match(u, /function _charLibSlug\(name\)\{return LibrarySlug\.library\(name\);\}/, 'ui-browsers.js _charLibSlug must delegate to LibrarySlug.library');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(idx.indexOf('<script src="library-slug.js"></script>') > 0 && idx.indexOf('<script src="library-slug.js"></script>') < idx.indexOf('<script src="helpers.js"></script>'), 'index.html must load library-slug.js before helpers.js');
  assert.ok(/"\/library-slug\.js"/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'the service worker app shell must carry library-slug.js');
});
test('the vendoring pin: the file\'s bytes match the hash both repos pin (update the server\'s library-slug.cjs with it)', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'library-slug.js'))).digest('hex');
  assert.equal(sha, LIBRARY_SLUG_SHA256, 'library-slug.js changed: copy it byte-for-byte to the server as library-slug.cjs, then update LIBRARY_SLUG_SHA256 here AND in the server\'s test-library-slug.mjs');
});
console.log('#481 F5 LIBRARY SLUG: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
