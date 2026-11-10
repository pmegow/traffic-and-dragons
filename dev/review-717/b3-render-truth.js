// b3-render-truth.js — the render is ground truth (headless Chrome, the real page):
//  S  the SEWER under the capital while the town above is fogged: which ways up does its sheet name, how far are they
//     from anything the party has seen in the town, and what of the town above (walls, river) is drawn on it?
//  P  a pixel scan of the fogged realm and the fogged town at whole-sheet fit: every dark pixel farther than 1.5 radii
//     from the shown ground that is not the sheet's frame, the HUD, a kept label or the marker — where is it?
// node dev/review-717/b3-render-truth.js [ROOT]     (TND_SHOT_DIR=<dir> keeps screenshots)
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
    await page.goto('http://atlas.test/index.html'); await page.waitForFunction(() => typeof showAtlas === 'function' && typeof atlasCreate === 'function' && typeof syncUI === 'function' && typeof TnDMaps === 'object');
    await page.evaluate(f => { worldState = f.world; memory = f.memory; sessionLog = []; document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI(); }, fx);
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const clean = () => page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); });

    console.log('\n== S the sewer sheet while the town above is fogged');
    const s = await page.evaluate(() => {
      atlasCreate('campaign-1'); worldState.atlas.adopt = false; const reg = atlasDoc('campaign-1'), p0 = reg.places[0];
      worldState.world.location = p0.name; worldState.world.sublocation = null; atlasFollow();
      const tz = worldState.atlas.at, town = atlasDoc(tz), grates = town.portals.filter(p => p.kind === 'grate');
      worldState.world.sublocation = grates[0].name; atlasFollow(); syncUI(); showAtlasFull();
      const sz = worldState.atlas.at, P = _atlasPane, sc = P.view.scene(), sd = atlasDoc(sz), unit = town.frame.kmPerUnit * 1000, tspec = atlasReveal(tz);
      const near = q => { let m = 1e9; tspec.points.forEach(p => { m = Math.min(m, Math.hypot(p[0] - q.x, p[1] - q.y)); }); return Math.round(m * unit); };
      const labels = []; sc.layers.forEach(L => { if (L.name === 'labels' || L.name === 'featureLabels') L.items.forEach(c => labels.push(c.text || (c.lines && c.lines.join(' ')))); });
      const townHits = {}; TnDMaps.scene.build(town, 'ink', { reveal: tspec }).layers.forEach(L => { if (L.name === 'hits') L.items.forEach(h => { townHits[h.id] = 1; }); });
      return { sewer: worldState.atlas.zones[sz].name, reveal: P.view.reveal(), labelsOnTheSewerSheet: labels, layers: sc.layers.map(L => L.name + ':' + L.items.length),
        townShows: tspec, grates: grates.map(g => ({ name: g.name, metresFromGroundSeenInTheTown: near(g), readableOnTheTownSheet: !!townHits[g.id], namedOnTheSewerSheet: labels.indexOf(g.name) >= 0 })) };
    });
    await settle(); await page.waitForTimeout(250);
    out('sheet', s.sewer); out('reveal (ids)', s.reveal); out('layers', s.layers); out('labels drawn on the sewer sheet', s.labelsOnTheSewerSheet);
    out('the town above shows', { points: s.townShows.points, paths: s.townShows.paths.length, radiusM: s.townShows.radiusM });
    s.grates.forEach(g => out('grate', g));
    await clean(); await page.evaluate(() => { _atlasPane.view.fit(); }); await settle(); await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'b3-sewer.png') });

    console.log('\n== P pixel scan at whole-sheet fit: dark pixels on ground the fog hides');
    const scan = async (zoneExpr, label) => {
      await page.evaluate(z => { const A = worldState.atlas; __atlasTest.show(z === 'town' ? Object.keys(A.zones).filter(k => A.zones[k].kind === 'town')[0] : A.seed, true); _atlasPane.view.fit(); }, zoneExpr); await settle(); await page.waitForTimeout(350); await clean();
      const r = await page.evaluate(() => {
        const P = _atlasPane, v = P.view, c = document.getElementById('atlas-canvas'), T = v.transform(), dpr = c.width / c.clientWidth, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, sc = v.scene(), doc = atlasDoc(P.zone), spec = atlasReveal(P.zone), r = spec.radiusM / (doc.frame.kmPerUnit * 1000);
        const seg = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
        const dist = (x, y) => { let m = 1e9; spec.points.forEach(p => { m = Math.min(m, Math.hypot(p[0] - x, p[1] - y)); }); spec.paths.forEach(pa => { for (let i = 1; i < pa.length; i++)m = Math.min(m, seg(x, y, pa[i - 1], pa[i])); }); return m; };
        const boxes = []; sc.layers.forEach(L => { if (L.name === 'labels' || L.name === 'featureLabels' || L.name === 'markers') L.items.forEach(q => { if (q.box) boxes.push(q.box); }); });
        const X0 = sc.x0 || 0, Y0 = sc.y0 || 0, W = sc.width, H = sc.height, pad = 14;
        const hud = v.hudScene().filter(q => q.box).map(q => q.box);/* CSS px */
        let dark = 0, found = [], cells = {};
        for (let py = 0; py < c.height; py += 2) for (let px = 0; px < c.width; px += 2) {
          const i = (py * c.width + px) * 4; if (d[i] + d[i + 1] + d[i + 2] >= 300) continue;
          const sx = px / dpr, sy = py / dpr, mx = (sx - T.x) / T.k, my = (sy - T.y) / T.k;
          if (mx < X0 + pad || my < Y0 + pad || mx > X0 + W - pad || my > Y0 + H - pad) continue;/* the sheet's frame and outside it */
          if (sy < 100 && sx > 480 && sx < 800) continue; if (sx > 1220 && sy < 100) continue; if (sx < 270 && sy > c.clientHeight - 60) continue;/* the HUD: plaque, compass, scale bar */
          if (boxes.some(b => mx >= b[0] - 6 && mx <= b[2] + 6 && my >= b[1] - 6 && my <= b[3] + 6)) continue;/* a kept label, the marker */
          if (dist(mx, my) <= r * 1.5) continue;
          dark++; const k = Math.round(mx / 20) * 20 + ',' + Math.round(my / 20) * 20; cells[k] = (cells[k] || 0) + 1;
        }
        Object.keys(cells).sort((a, b) => cells[b] - cells[a]).slice(0, 8).forEach(k => { const p = k.split(',').map(Number); found.push({ at: p, px: cells[k], radiiAway: +(dist(p[0], p[1]) / r).toFixed(1), screen: [Math.round(p[0] * T.k + T.x), Math.round(p[1] * T.k + T.y)] }); });
        return { zone: P.zone, k: +T.k.toFixed(3), radiusUnits: +r.toFixed(2), radiusPx: +(r * T.k).toFixed(1), darkSamplesOnHiddenGround: dark, worstCells: found };
      });
      out(label, r); return r;
    };
    await page.evaluate(() => { const A = worldState.atlas, tz = A.zones[A.at].parent, town = atlasDoc(tz), inn = town.establishments.filter(e => e.kind === 'inn')[0], market = town.landmarks.filter(l => l.kind === 'market')[0]; worldState.world.sublocation = inn.name; atlasFollow(); worldState.world.sublocation = market.name; atlasFollow(); syncUI(); });
    await scan('realm', 'the realm'); await page.screenshot({ path: path.join(SHOTS, 'b3-realm-fit.png') });
    await scan('town', 'the town'); await page.screenshot({ path: path.join(SHOTS, 'b3-town-fit.png') });
    out('page errors', errors); console.log('screenshots: ' + SHOTS);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
