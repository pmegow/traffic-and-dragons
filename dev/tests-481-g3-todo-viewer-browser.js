// tests-481-g3-todo-viewer-browser.js — #481 G3, the real-browser half: the live TODO.md loads into the real todo-viewer.html
// (dev/cdp-browser.js, the repo served from disk on a fake origin, a fresh profile) through window.__todoViewerTest, and the page
// renders every row with NO edit control: the only buttons are the toolbar's Select / Refresh / Reset. Rows still expand.
//   node dev/tests-481-g3-todo-viewer-browser.js
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  let failed = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' }), errors = [];
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url()); if (u.hostname !== 'todo.test') return route.abort();
      const f = path.resolve(root, '.' + decodeURIComponent(u.pathname)); if (!f.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : 'text/plain', body: fs.readFileSync(f) }); } catch (e) { return route.fulfill({ status: 404, body: 'Not found' }); }
    });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://todo.test/todo-viewer.html');
    await page.waitForFunction(() => window.__todoViewerTest);
    const todo = fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    const s = await page.evaluate(t => { __todoViewerTest.loadText(t, 'TODO.md'); const r = document.getElementById('root');
      return { buttons: Array.prototype.map.call(r.querySelectorAll('button'), b => (b.textContent || '').trim()), rows: r.querySelectorAll('tbody.tt-body tr').length, textareas: r.querySelectorAll('textarea,input').length }; }, todo);
    try {
      assert.ok(s.rows > 20, 'the live TODO.md rendered only ' + s.rows + ' rows');
      assert.deepEqual(s.buttons.map(b => b.replace(/^\W+/, '')), ['Select TODO…', 'Refresh', 'Reset'], 'edit controls survive: ' + JSON.stringify(s.buttons));
      assert.equal(s.textareas, 0, 'an input or textarea survives');
      const expanded = await page.evaluate(() => { const a = document.querySelector('.task-arr'); a.click(); return !!document.querySelector('.task-arr.open'); });
      assert.ok(expanded, 'a row no longer expands');
      assert.deepEqual(errors, []);
      console.log('PASS #481 G3 the live TODO.md renders read-only in a real browser (' + s.rows + ' rows, only Select / Refresh / Reset)');
    } catch (e) { failed++; console.error('FAIL #481 G3 the live TODO.md renders read-only in a real browser — ' + e.message); }
  } finally { await browser.close(); }
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
