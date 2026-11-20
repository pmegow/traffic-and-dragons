// tests-777-satellites-browser.js — audit 2026-11-19 (TODO #777), section D, the satellite rows first left unbuilt:
//   D2 Story Compiler: a campaign loaded while a compile is weaving ends that compile, and the page stays usable
//   D3 Character editor: a draft that cannot be stored says so; a draft from a newer build is held, with a sheet on the page
//   D5 home.html: a failed account check is not shown as "Signed in." · map_cleanup.html revokes its export's object URL ·
//      author_voice_lab.html's model wait counts its seconds (the last two are read from the page source)
// The real pages in a system Chrome (dev/cdp-browser.js), a fresh profile, no network beyond the fixture host.
//   node dev/tests-777-satellites-browser.js             every case
//   node dev/tests-777-satellites-browser.js --only D3   the cases whose name contains the text
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2), only = argv.indexOf('--only') >= 0 ? argv[argv.indexOf('--only') + 1] : '';
const CASES = [];
function kase(name, fn) { CASES.push({ name, fn }); }
function campaign(hero, n) {
  const tr = [], ch = [];
  for (let t = 1; t <= n * 2; t++) { tr.push({ t, r: 'player', x: 'I go on.' }); tr.push({ t, r: 'gm', x: hero + ' walks on through turn ' + t + '.' }); if (t % 2 === 0) ch.push({ turn: t, summary: 'Chapter ending at turn ' + t + '.' }); }
  return { worldState: { campName: 'The Tale of ' + hero, turn: n * 2, character: { name: hero, cls: 'Rogue', level: 3 }, transcript: tr }, memory: { chapters: ch } };
}
async function open(browser, file, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 }, serviceWorkers: 'block' }), errors = [];
  if (opts.init) await ctx.addInitScript(opts.init);
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'sat.test') return route.abort();
    if (opts.api && opts.api[u.pathname]) return route.fulfill(opts.api[u.pathname]);
    const f = path.resolve(root, '.' + decodeURIComponent(u.pathname));
    if (!f.startsWith(root + path.sep)) return route.abort();
    try { return route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'application/json', body: fs.readFileSync(f) }); } catch (e) { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://sat.test/' + file);
  return { ctx, page, errors };
}

kase('D2: a campaign loaded while a compile is weaving ends that compile — the page says so and compiles the new one', async browser => {
  const { page, errors } = await open(browser, 'story_compiler.html');
  await page.waitForFunction(() => window.__storyTest && window.__storyTest.compileUI);
  const A = campaign('Aldric', 12), B = campaign('Brenna', 12);
  const mid = await page.evaluate(([a, b]) => {
    const T = window.__storyTest, real = window.setTimeout; let n = 0;
    T.load(a, 'first');
    window.setTimeout = function (fn, ms) { n++; if (n === 2) T.load(b, 'second'); return real(fn, ms); };   // between two slices of the weave
    T.compileUI();
    return new Promise(r => real(() => { window.setTimeout = real; r({ timers: n, busy: T.busy(), compile: document.getElementById('compile').disabled, text: document.getElementById('ptext').textContent }); }, 400));
  }, [A, B]);
  assert.ok(mid.timers >= 2, 'fixture: the compile never reached a second slice (' + mid.timers + ' timers)');
  assert.equal(mid.busy, false, 'the page still reads as compiling after another campaign was loaded — Compile is dead until a reload');
  assert.equal(mid.compile, false, 'the Compile button stayed disabled');
  assert.match(mid.text, /stopped|another campaign/i, 'nothing says the compile was stopped: ' + JSON.stringify(mid.text));
  const done = await page.evaluate(() => { const T = window.__storyTest; T.compileUI(); return new Promise(r => setTimeout(() => r({ busy: T.busy(), doc: String(T.doc() || ''), text: document.getElementById('ptext').textContent }), 600)); });
  assert.equal(done.busy, false); assert.match(done.text, /^Compiled /, 'the new campaign did not compile: ' + JSON.stringify(done.text));
  assert.ok(done.doc.includes('Brenna') && !done.doc.includes('Aldric'), 'the compiled document is not the campaign that was loaded last');
  assert.deepEqual(errors, [], 'the page threw');
});
kase('D2: a compile that throws lets go of the page and says why', async browser => {
  const { page } = await open(browser, 'story_compiler.html');
  await page.waitForFunction(() => window.__storyTest && window.__storyTest.compileUI);
  const out = await page.evaluate(a => {
    const T = window.__storyTest; T.load(a, 'first');
    T.compileUI();                                              // the button's path: its work runs in timers from here on
    const real = Math.min; let armed = true;
    Math.min = function () { if (armed) { armed = false; throw new Error('staged failure'); } return real.apply(Math, arguments); };
    return new Promise(r => setTimeout(() => { Math.min = real; r({ armed, busy: T.busy(), compile: document.getElementById('compile').disabled, text: document.getElementById('ptext').textContent }); }, 500));
  }, campaign('Aldric', 3));
  assert.equal(out.armed, false, 'fixture: the staged failure was never reached');
  assert.equal(out.busy, false, 'a compile that threw left the page busy — Compile is dead until a reload');
  assert.equal(out.compile, false, 'a compile that threw left Compile disabled');
  assert.match(out.text, /Compile failed: staged failure/, 'a compile that threw says nothing: ' + JSON.stringify(out.text));
});
kase('D3: a draft that cannot be stored says so, once', async browser => {
  const { page } = await open(browser, 'character_editor.html');
  await page.waitForFunction(() => window.__ceTest);
  const st = await page.evaluate(() => {
    Storage.prototype.setItem = function () { throw new Error('the store is full'); };
    const el = document.querySelector('[data-stat]'); el.value = '12'; el.dispatchEvent(new Event('change', { bubbles: true }));
    return new Promise(r => setTimeout(() => r(document.getElementById('status') ? document.getElementById('status').textContent : document.body.innerText), 900));
  });
  assert.match(st, /could not be kept as a draft/, 'a failed draft save shows nothing: ' + JSON.stringify(String(st).slice(0, 200)));
  assert.match(st, /the store is full/, 'the reason is not given');
});
kase('D3: a draft from a newer build is held — the page has a sheet, and neither an edit nor New removes the stored draft', async browser => {
  const draft = JSON.stringify({ ch: { name: 'From The Future', sheetVer: 999999 }, dirty: true, at: 1 });
  const { page, errors } = await open(browser, 'character_editor.html', { init: '(' + (d => { try { localStorage.setItem('tnd_ce_draft_v1', d); } catch (e) {} }).toString() + ')(' + JSON.stringify(draft) + ')' });
  await page.waitForFunction(() => window.__ceTest);
  const st = await page.evaluate(() => {
    const T = window.__ceTest, sheet = T.get(), status = document.getElementById('status') ? document.getElementById('status').textContent : '';
    const el = document.querySelector('[data-stat]'); el.value = '12'; el.dispatchEvent(new Event('change', { bubbles: true }));
    return new Promise(r => setTimeout(() => { const afterEdit = localStorage.getItem('tnd_ce_draft_v1'); window.confirm = () => true; document.getElementById('b-new').click(); r({ sheet: !!sheet && typeof sheet === 'object', name: sheet && sheet.name, status, afterEdit, afterNew: localStorage.getItem('tnd_ce_draft_v1') }); }, 900));
  });
  assert.match(st.status, /Draft not restored/, 'fixture: the newer draft was not refused: ' + JSON.stringify(st.status));
  assert.equal(st.sheet, true, 'the page has no sheet behind its working buttons');
  assert.notEqual(st.name, 'From The Future', 'a draft from a newer build was loaded into this one');
  assert.equal(st.afterEdit, draft, 'an edit on the blank sheet wrote over the newer draft');
  assert.equal(st.afterNew, draft, 'New removed the newer draft without asking');
  assert.match(st.status, /kept untouched/, 'the page does not say the draft is kept');
  assert.deepEqual(errors.filter(e => !/confirm/.test(e)), [], 'the page threw');
});

function homeWith(account) {
  return { init: '(' + (() => { try { localStorage.setItem('tnd_server_url_v1', 'http://sat.test'); localStorage.setItem('tnd_server_tok_v1', 'fixture'); } catch (e) {} }).toString() + ')()',
    api: { '/api/account': account, '/api/blueprints': { status: 200, contentType: 'application/json', body: '[]' }, '/catalog/blueprints': { status: 200, contentType: 'application/json', body: '[]' } } };
}
kase('D5: home says the session expired, or that the account could not be read — never a bare "Signed in." over a failed check', async browser => {
  let h = await open(browser, 'home.html', homeWith({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Not logged in' }) }));
  await h.page.waitForFunction(() => window.__homeTest); await h.page.waitForTimeout(700);
  let who = await h.page.evaluate(() => document.getElementById('who').textContent);
  assert.doesNotMatch(who, /^Signed in\.?$/, 'an expired session reads as a healthy one: ' + JSON.stringify(who));
  assert.match(who, /expired|sign in again/i, 'an expired session is not named: ' + JSON.stringify(who));
  h = await open(browser, 'home.html', homeWith({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }));
  await h.page.waitForFunction(() => window.__homeTest); await h.page.waitForTimeout(700);
  who = await h.page.evaluate(() => document.getElementById('who').textContent);
  assert.match(who, /could not be read/, 'a failed account check still reads "Signed in.": ' + JSON.stringify(who));
  h = await open(browser, 'home.html', homeWith({ status: 200, contentType: 'application/json', body: JSON.stringify({ username: 'Adventurer', entitled: true, tierLabel: 'Tester', turnsUsed: 1, turnsCap: 300 }) }));
  await h.page.waitForFunction(() => window.__homeTest); await h.page.waitForTimeout(700);
  who = await h.page.evaluate(() => document.getElementById('who').textContent);
  assert.match(who, /Signed in as Adventurer/, 'a healthy account is no longer shown: ' + JSON.stringify(who));
});
kase('D5: the map repair page lets go of its export, and the voice lab\'s wait counts its seconds and is stopped on both outcomes', async () => {
  const mc = fs.readFileSync(path.join(root, 'map_cleanup.html'), 'utf8'), at = mc.indexOf('a.href=URL.createObjectURL(blob);'), next = mc.slice(at, at + 420);
  assert.ok(at >= 0 && /a\.click\(\);[\s\S]*URL\.revokeObjectURL\(a\.href\)/.test(next), 'the repaired save\'s object URL is never revoked (the whole save is held for the page\'s life)');
  const lab = fs.readFileSync(path.join(root, 'author_voice_lab.html'), 'utf8'), a = lab.indexOf('statEl.textContent="calling "+model+" …";'), body = lab.slice(a, lab.indexOf('function setButtons', a));
  assert.ok(a >= 0, 'fixture: the wait line moved');
  assert.match(body, /setInterval\(function\(\)\{statEl\.textContent="calling "\+model\+" … "\+Math\.round\(\(Date\.now\(\)-_t0\)\/1000\)\+"s";\},1000\)/, 'the model wait does not count its seconds');
  assert.equal((body.match(/clearInterval\(_tick\);/g) || []).length, 2, 'the counter is not stopped on both outcomes (it would write over the result)');
  assert.ok(body.indexOf('clearInterval(_tick);') < body.indexOf('txtEl.textContent=r.text;'), 'the counter is stopped after the result is written');
});

(async () => {
  const todo = CASES.filter(c => !only || c.name.includes(only));
  if (!todo.length) { console.error('--only "' + only + '" matched 0 tests — NOTHING ran'); process.exitCode = 1; return; }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  let failed = 0, passed = 0;
  try {
    for (const c of todo) {
      try { await c.fn(browser); passed++; console.log('PASS #777 ' + c.name); }
      catch (e) { failed++; console.error('FAIL #777 ' + c.name + ' — ' + String((e && e.message) || e).split('\n').slice(0, 4).join('\n    ')); }
    }
  } finally { await browser.close(); }
  if (failed) console.error('#777 satellites: ' + failed + ' FAILED, ' + passed + ' passed'); else console.log('ALL GREEN — ' + passed + ' #777 satellite cases');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
