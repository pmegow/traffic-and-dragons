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
      try { return route.fulfill({ status: 200, contentType: f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'text/plain', body: fs.readFileSync(f) }); } catch (e) { return route.fulfill({ status: 404, body: 'Not found' }); }
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
    if (process.env.TODO_SCREENSHOT) await page.screenshot({ path: process.env.TODO_SCREENSHOT });
    try {
      const counts = () => Array.from(document.querySelectorAll('.sec-wrap')).map(g => ({
        title: g.querySelector('.sec-title').textContent,
        count: g.querySelector('.sec-count')?.textContent || '',
        rows: g.querySelectorAll('tbody tr').length,
        tables: g.querySelectorAll('table').length
      }));
      const live = await page.evaluate(counts);
      for (const g of live) assert.equal(g.count, g.tables ? '(' + g.rows + ')' : '', 'category row count: ' + g.title);
      const fixture = ['# Test', '## Tasks', '| # | Task | Status |', '|---|---|---|', '| 1 | Wrapped', 'task | ○ |', '<!-- completed -->', '| # | Task | Status |', '|---|---|---|', '| 2 | Archived | ✅ |', '<!-- /completed -->', '', '### More tasks', '| # | Task | Status |', '|---|---|---|', '| 3 | Another | ○ |', '', '## Empty', '| # | Task | Status |', '|---|---|---|', '', '## Prose', 'No rows.', '', '## Release', '| Item | Action |', '|---|---|', '| First | Remove |', '| Second | Keep |'].join('\n');
      await page.evaluate(t => __todoViewerTest.loadText(t), fixture);
      const expected = [ ['Tasks', '(3)'], ['Empty', '(0)'], ['Prose', ''], ['Release', '(2)'] ];
      assert.deepEqual((await page.evaluate(counts)).map(g => [g.title, g.count]), expected, 'category row count: wrapped, completed, multiple and ordinary tables');
      await page.evaluate(() => { document.querySelector('.sec-toggle').click(); document.querySelector('.completed-toggle').click(); document.querySelector('.task-arr').click(); });
      assert.deepEqual((await page.evaluate(counts)).map(g => [g.title, g.count]), expected, 'category row count changes on expansion');
      await page.evaluate(t => __todoViewerTest.loadText(t.replace('| 3 | Another | ○ |', '')), fixture);
      assert.equal((await page.evaluate(counts))[0].count, '(2)', 'category row count stale after reload');
      assert.deepEqual(errors, []);
      console.log('PASS category row counts: live TODO, wrapped/completed/multiple/empty/ordinary tables, expansion and reload');
    } catch (e) { failed++; console.error('FAIL category row counts — ' + e.message); }

  } finally { await browser.close(); }
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
