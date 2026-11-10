// b1-pane-leaks.js — the fog in the REAL page (headless Chrome through dev/cdp-browser.js): what can the player still
// read about ground the fog hides, and is an unfogged frame ever painted?
//  A  every base render from the moment a pane opens / changes sheet: does any carry no fog?
//  B  the town: named things farther than the radius from every stand and way whose hit (click) or label survived
//     the fog — each is clicked for real and its card read
//  C  the realm: the same at 6 km, and which feature labels (seas, ranges, forests) are drawn
//  D  a building entered by its name (reveal []): what text is on the sheet
//  E  the pane open on the town while a turn ADDS a place to that very sheet: does the view get the new drawing?
//  F  a failure while the reveal is computed on a sheet switch: what does the canvas show?
// node dev/review-717/b1-pane-leaks.js [ROOT]     (TND_SHOT_DIR=<dir> keeps screenshots)
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
    await page.evaluate(f => { worldState = f.world; memory = f.memory; sessionLog = []; document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI(); window.__toasts = []; const _t = showToast; showToast = function (m) { __toasts.push(String(m)); return _t.apply(this, arguments); }; }, fx);
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const clickMap = (x, y) => page.evaluate(p => { const c = document.getElementById('atlas-canvas'), r = c.getBoundingClientRect(), T = _atlasPane.view.transform(), cx = r.left + p.x * T.k + T.x, cy = r.top + p.y * T.k + T.y; const o = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 }; c.dispatchEvent(new MouseEvent('mousedown', o)); window.dispatchEvent(new MouseEvent('mouseup', o)); return { inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom }; }, { x, y });

    /* the campaign: the capital, its inn, its market (the suite's own walk) — the fog ON */
    const s = await page.evaluate(() => {
      atlasCreate('campaign-1'); worldState.atlas.adopt = false; const reg = atlasDoc('campaign-1'), p0 = reg.places[0];
      worldState.world.location = p0.name; worldState.world.sublocation = null; atlasFollow();
      const zone = worldState.atlas.at, town = atlasDoc(zone), inn = town.establishments.filter(e => e.kind === 'inn')[0], market = town.landmarks.filter(l => l.kind === 'market')[0];
      worldState.world.sublocation = inn.name; atlasFollow(); worldState.world.sublocation = market.name; atlasFollow(); syncUI();
      /* every base render (a scene with a frame layer), in order: which sheet, with or without fog */
      window.__renders = []; const rc = TnDMaps.renderCanvas; TnDMaps.renderCanvas = function (g, scene) { const names = scene.layers.map(L => L.name); if (names.indexOf('frame') >= 0) __renders.push({ t: Math.round(performance.now()), fog: names.indexOf('fog') >= 0, floor: (scene.layers.filter(L => L.name === 'floor')[0] || { items: [] }).items.length, w: Math.round(scene.width) }); return rc.apply(this, arguments); };
      /* what the fog says of a sheet: per named thing, its distance in metres from the shown ground, and whether its hit and its label are in the view's scene */
      window.__audit = function () {
        const P = _atlasPane, z = P.zone, doc = atlasDoc(z), spec = atlasReveal(z), sc = P.view.scene(), unit = doc.frame.kmPerUnit * 1000;
        const seg = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.y - a[1]) * dy) / l)) : 0; return Math.hypot(q.x - a[0] - t * dx, q.y - a[1] - t * dy); };
        const dist = q => { let m = 1e9; (spec.points || []).forEach(p => { m = Math.min(m, Math.hypot(p[0] - q.x, p[1] - q.y)); }); (spec.paths || []).forEach(pa => { for (let i = 1; i < pa.length; i++)m = Math.min(m, seg(q, pa[i - 1], pa[i])); }); return m * unit; };
        const hits = {}, labels = {}, loose = [];
        sc.layers.forEach(L => { if (L.name === 'hits') L.items.forEach(h => { hits[h.id] = 1; }); if (L.name === 'labels' || L.name === 'featureLabels') L.items.forEach(c => { if (c.meta && c.meta.id != null) labels[c.meta.id] = 1; else loose.push({ layer: L.name, text: c.text || (c.lines && c.lines.join(' ')) || null, x: Math.round(c.x), y: Math.round(c.y), d: Math.round(dist({ x: c.box ? (c.box[0] + c.box[2]) / 2 : c.x, y: c.box ? (c.box[1] + c.box[3]) / 2 : c.y })) }); }); });
        const things = atlasThings(doc).map(t => ({ id: t.id, name: t.name, x: t.x, y: t.y, d: Math.round(dist(t)), hit: !!hits[t.id], label: !!labels[t.id] }));
        return { zone: z, radiusM: spec.radiusM, things: things.length, shownWithin: things.filter(t => t.d <= spec.radiusM).length, beyondWithHit: things.filter(t => t.d > spec.radiusM && t.hit), beyondWithLabel: things.filter(t => t.d > spec.radiusM && t.label), loose: loose, layers: sc.layers.map(L => L.name + ':' + L.items.length) };
      };
      return { zone, inn: inn.name, innId: inn.id, p0: p0.name };
    });

    console.log('\n== A the renders from the moment the pane opens (dock), goes full screen, and changes sheet');
    await page.evaluate(() => { __renders.length = 0; showAtlas(); }); await settle(); await page.waitForTimeout(250);
    out('dock opened on the town', await page.evaluate(() => __renders.splice(0)));
    await page.evaluate(() => { document.getElementById('atlas-full').click(); }); await settle(); await page.waitForTimeout(250);
    out('full screen', await page.evaluate(() => __renders.splice(0)));
    await page.evaluate(() => { __atlasTest.show('campaign-1', true); }); await settle(); await page.waitForTimeout(250);
    out('sheet changed to the realm', await page.evaluate(() => __renders.splice(0)));
    await page.evaluate(z => { __atlasTest.show(z, true); }, s.zone); await settle(); await page.waitForTimeout(250);
    out('sheet changed back to the town', await page.evaluate(() => __renders.splice(0)));

    console.log('\n== B the town: things beyond the 100 m the fog shows');
    const b = await page.evaluate(() => __audit());
    out('sheet', { zone: b.zone, radiusM: b.radiusM, things: b.things, within: b.shownWithin, layers: b.layers });
    out('beyond the radius yet CLICKABLE (hit kept)', b.beyondWithHit.map(t => t.name + ' ' + t.d + 'm'));
    out('beyond the radius yet LABELLED', b.beyondWithLabel.map(t => t.name + ' ' + t.d + 'm'));
    out('labels with no thing (drawn over the fog)', b.loose);
    for (const t of b.beyondWithHit.slice(0, 4)) {
      await page.evaluate(q => { const v = _atlasPane.view; v.center(q.x, q.y, v.transform().k); }, t); await settle(); await page.waitForTimeout(120);
      await clickMap(t.x, t.y); await settle();
      out('a real click on ' + t.name + ' (' + t.d + ' m off the walked ground) reads', await page.evaluate(() => { const el = document.getElementById('atlas-card'); return el.style.display === 'none' ? '(no card)' : el.textContent.replace(/\s+/g, ' ').slice(0, 120); }));
      await page.evaluate(() => __atlasTest.tap(null));
    }
    await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); __atlasTest.show(_atlasPane.zone, true); }); await settle(); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'b1-town.png') });

    console.log('\n== C the realm at 6 km');
    await page.evaluate(() => { __atlasTest.show('campaign-1', true); }); await settle(); await page.waitForTimeout(200);
    const c = await page.evaluate(() => __audit());
    out('sheet', { radiusM: c.radiusM, things: c.things, within: c.shownWithin, layers: c.layers });
    out('beyond the radius yet CLICKABLE', c.beyondWithHit.map(t => t.name + ' ' + Math.round(t.d / 1000) + 'km'));
    out('beyond the radius yet LABELLED', c.beyondWithLabel.map(t => t.name + ' ' + Math.round(t.d / 1000) + 'km'));
    out('labels with no thing', c.loose.map(l => l.layer + ' "' + l.text + '" ' + Math.round(l.d / 1000) + 'km'));
    await page.evaluate(() => { const v = _atlasPane.view; v.fit(); }); await settle(); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'b1-realm-whole.png') });

    console.log('\n== D a building entered by its name: what is on its sheet');
    const d = await page.evaluate(q => {
      worldState.world.sublocation = q.inn; atlasFollow(); syncUI(); const z = worldState.atlas.at; __atlasTest.show(z, true);
      const P = _atlasPane, sc = P.view.scene(), doc = atlasDoc(z), texts = [];
      sc.layers.forEach(L => L.items.forEach(c => { if (c.t === 'text' || c.text) texts.push(L.name + ': ' + (c.text || (c.lines && c.lines.join(' ')))); }));
      return { kind: worldState.atlas.zones[z].kind, reveal: P.view.reveal(), marker: atlasMarkers(z)[0], rooms: doc.rooms.length, floors: doc.floors.map(f => f.name), texts: texts, layers: sc.layers.map(L => L.name + ':' + L.items.length) };
    }, s); await settle(); await page.waitForTimeout(200);
    out('reveal', d.reveal); out('marker', d.marker); out('rooms / floors', [d.rooms, d.floors]); out('text drawn on the sheet', d.texts); out('layers', d.layers);
    await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); const v = _atlasPane.view; v.fit(); }); await settle(); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'b1-inn-by-name.png') });

    console.log('\n== E the pane open on the town while a turn ADDS a place to that sheet');
    const e = await page.evaluate(q => {
      const A = worldState.atlas; A.adopt = true; worldState.world.sublocation = null; atlasFollow(); __atlasTest.show(q.zone, true);
      const before = _atlasPane.view.doc().establishments.length;
      worldState.world.sublocation = 'The Gilded Spur'; atlasFollow(); syncUI();
      const P = _atlasPane, eng = atlasDoc(q.zone), m = atlasMarkers(P.zone)[0];
      return { paneZone: P.zone, at: A.zones[A.at].name, engineHas: eng.establishments.some(x => x.name === 'The Gilded Spur'), viewHas: P.view.doc().establishments.some(x => x.name === 'The Gilded Spur'), viewIsEngineDoc: P.view.doc() === eng, before: before, viewCount: P.view.doc().establishments.length, marker: m, reveal: P.view.reveal() };
    }, s); await settle(); await page.waitForTimeout(200);
    out('result', e);
    await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); }); await page.screenshot({ path: path.join(SHOTS, 'b1-added-under-open-pane.png') });

    console.log('\n== F a failure while the reveal is computed on a sheet switch (injected: TnDMaps.route is not the cause — atlasPartyIn is made to throw once)');
    const f = await page.evaluate(q => {
      const A = worldState.atlas; A.adopt = false; worldState.world.sublocation = q.inn; atlasFollow(); syncUI(); __atlasTest.show('campaign-1', true);
      const real = atlasPartyIn; let n = 0; atlasPartyIn = function (z) { if (z === q.zone && n++ < 1) throw new Error('injected: the party could not be read'); return real(z); };
      __toasts.length = 0; __renders.length = 0; let ok; try { ok = __atlasTest.show(q.zone, true); } finally { atlasPartyIn = real; }
      const P = _atlasPane; return { showReturned: ok, paneZoneField: P.zone, viewDocIsTown: P.view.doc() === atlasDoc(q.zone), viewReveal: P.view.reveal(), expected: atlasReveal(q.zone) ? 'a fog spec' : null, toasts: __toasts.slice() };
    }, s); await settle(); await page.waitForTimeout(250);
    out('result', f); out('renders after it', await page.evaluate(() => __renders.splice(0)));
    await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); const v = _atlasPane.view; v.fit(); }); await settle(); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'b1-after-failed-reveal.png') });
    out('page errors', errors); console.log('screenshots: ' + SHOTS);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
