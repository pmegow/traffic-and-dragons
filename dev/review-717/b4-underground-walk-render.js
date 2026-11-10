// b4-underground-walk-render.js — the render of p14 (headless Chrome, the real page, REAL turns through commitGmTurn):
// the party arrives in Crasin, goes down one grate, follows the sewer to the foot of the far ladder and stays below.
// Screenshots the TOWN's sheet as the pane shows it and counts what the false street leg reveals: named places the
// player can now read and click that lie more than 100 m from either grate.
// node dev/review-717/b4-underground-walk-render.js [ROOT]     (TND_SHOT_DIR=<dir> keeps screenshots)
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const { chromium } = require(path.join(ROOT, 'dev', 'cdp-browser.js'));
const SHOTS = process.env.TND_SHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-717-'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function fixture() { const e = require(path.join(ROOT, 'dev', 'load-engine.js')); e.loadEngine(); e.makeTestWorld(); worldState.world.location = 'The Crossroads of Ashenveil'; worldState.transcript = [{ r: 'gm', x: 'The road forks under a grey sky.', t: 1 }]; return JSON.parse(JSON.stringify({ world: worldState, memory })); }
const out = (l, v) => console.log('  ' + l + ': ' + (typeof v === 'string' ? v : JSON.stringify(v)));
(async () => {
  const fx = fixture(), browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await ctx.route('**/*', async r => { const u = new URL(r.request().url()); if (u.hostname !== 'atlas.test') return r.abort(); const f = path.resolve(ROOT, '.' + decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT + path.sep)) return r.abort(); try { return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch (e) { return r.fulfill({ status: 404, body: '' }); } });
    await ctx.addInitScript(() => localStorage.setItem('tnd_ambient_enabled_v1', '0'));
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://atlas.test/index.html'); await page.waitForFunction(() => typeof showAtlas === 'function' && typeof atlasCreate === 'function' && typeof syncUI === 'function' && typeof TnDMaps === 'object' && typeof commitGmTurn === 'function');
    await page.evaluate(f => { worldState = f.world; memory = f.memory; sessionLog = []; document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI(); }, fx);
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const r = await page.evaluate(() => {
      const turn = t => commitGmTurn(t, { userMsg: 'x', playerTxt: 'x' });
      atlasCreate('campaign-1'); worldState.atlas.adopt = false; const A = worldState.atlas, reg = atlasDoc('campaign-1'), place = reg.places[1];
      turn('The gates of ' + place.name + '. [LOCATION:' + place.name + ']'); const tz = A.at, town = atlasDoc(tz), ways = town.portals.filter(q => q.kind === 'grate' || q.kind === 'outfall'), unit = town.frame.kmPerUnit * 1000;
      turn('You lift the grate and climb down. [SUBLOCATION:' + ways[0].name + ']');
      const one = atlasReveal(tz), hitsOf = spec => { const h = {}; TnDMaps.scene.build(town, 'ink', { reveal: spec }).layers.forEach(L => { if (L.name === 'hits') L.items.forEach(x => { h[x.id] = 1; }); }); return h; }, h1 = hitsOf(one);
      turn('You follow the main channel to the foot of the far ladder. [SUBLOCATION:' + ways[ways.length - 1].name + ']');
      const two = atlasReveal(tz), h2 = hitsOf(two), g = [ways[0], ways[ways.length - 1]];
      const far = atlasThings(town).filter(t => h2[t.id] && !h1[t.id] && Math.min(Math.hypot(t.x - g[0].x, t.y - g[0].y), Math.hypot(t.x - g[1].x, t.y - g[1].y)) * unit > 100);
      syncUI(); showAtlasFull(tz);
      return { town: place.name, tz, below: A.zones[A.at].name, sub: worldState.world.sublocation, seenTown: JSON.parse(JSON.stringify(A.seen[tz])), waysShown: two.paths.length, readableBefore: Object.keys(h1).length, readableAfter: Object.keys(h2).length, namedPlacesShownByTheStreetLegAlone: far.map(t => t.name) };
    });
    await settle(); await page.waitForTimeout(300);
    out('the story', 'arrived in ' + r.town + '; down one grate; along the sewer to another; the party is in ' + r.below + ' (' + r.sub + ') and never walked a street');
    out('the town\'s record', r.seenTown); out('ways drawn on the town\'s sheet', r.waysShown); out('things the player can read on the town\'s sheet: after the first grate / after the second', [r.readableBefore, r.readableAfter]);
    out('named places shown only because of the street leg (more than 100 m from both grates)', r.namedPlacesShownByTheStreetLegAlone);
    await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); _atlasPane.view.fit(); }); await settle(); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'b4-town-after-underground-walk.png') });
    out('page errors', errors); console.log('screenshot: ' + path.join(SHOTS, 'b4-town-after-underground-walk.png'));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
