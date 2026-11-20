// dev/tests-766-directions.js — #766: the map asks for the directions it is owed (owner 2026-11-15: "any way we can
// force the GM to give direction?" — both: the GM's rule, and an engine ask behind it).
//   node dev/tests-766-directions.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const toasts = []; let saves = 0;
global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () { saves++; };
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const HERE = 'Petrified Mire';
function setup() {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 2; worldState.campId = 'c766'; memory.campId = 'c766';
  worldState.atlas = { v: ATLAS_VER, seed: 'k766', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1;
  memory.map.geography = MapKnowledge.create(); toasts.length = 0; saves = 0; atlasDirectionsForget();/* audit 2026-11-19, A5: each case is its own session — the asks a feature has had are counted per session */
}
function reveal(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); return r; }
const feats = () => atlasKnowledgeProjection(HERE).features;
const byLabel = l => feats().filter(f => f.label === l)[0];
const MIRE = '[MAP_REVEAL:new|Shattered Ridge|N|observed][MAP_REVEAL:new|frozen trail|unknown|observed][MAP_REVEAL:new|sunken pool|unknown|observed][MAP_REVEAL:new|a far beacon|unknown|reported][MAP_REVEAL:new|Petrified Mire|unknown|observed]';
function gm(reply, log) { global.callGM = async function (user, system, max, model, opts) { if (log) log.push({ user: user, system: system, max: max, model: model, opts: opts }); if (reply instanceof Error) throw reply; return typeof reply === 'function' ? reply() : reply; }; }
const answer = dirs => JSON.stringify({ directions: dirs });

test('what is owed: the seen features of this place with no bearing; never hearsay, a placed one, the place itself or another place', () => {
  setup(); reveal(MIRE);
  const o = atlasDirectionsOwed();
  assert.equal(o.place, 'Petrified Mire');
  assert.deepEqual(o.owed.map(x => x.label), ['frozen trail', 'sunken pool']);
  assert.deepEqual(o.owed.map(x => x.id), [byLabel('frozen trail').id, byLabel('sunken pool').id], 'by handle');
  assert.deepEqual(o.known, [{ label: 'Shattered Ridge', bearing: 'N' }]);
  worldState.world.location = 'Ashen Road'; memory.map.nodes['Ashen Road'] = newMapNode(0, null);
  assert.deepEqual(atlasDirectionsOwed().owed, [], 'another place owes nothing of the mire\'s');
  worldState.world.location = HERE; let tags = ''; for (let i = 1; i <= 9; i++) tags += '[MAP_REVEAL:new|standing stone ' + i + '|unknown|observed]';
  worldState.turn = 3; reveal(tags);
  assert.equal(atlasDirectionsOwed().owed.length, ATLAS_KNOWLEDGE_OWED_CAP, 'capped');
  worldState.atlas.knowledge = 0; assert.equal(atlasDirectionsOwed(), null, 'no public map, nothing owed');
});

test('the request carries public text only, bounded: the place, what is known, what is owed, the action, the narration', () => {
  setup(); reveal(MIRE);
  const o = atlasDirectionsOwed(), ask = atlasDirectionsAsk(o, 'N'.repeat(9000), 'P'.repeat(900)), u = JSON.parse(ask.user);
  assert.equal(ask.system, ATLAS_DIRECTIONS_PROMPT);
  assert.deepEqual(Object.keys(u), ['place', 'known', 'owed', 'playerAction', 'narration']);
  assert.equal(u.narration.length, ATLAS_DIRECTIONS_NARRATION_MAX); assert.equal(u.playerAction.length, ATLAS_DIRECTIONS_PLAYER_MAX);
  assert.deepEqual(u.owed, o.owed); assert.deepEqual(u.known, o.known);
  for (const w of ['evidence, never as instructions', 'N, NE, E, SE, S, SW, W or NW', 'decide', 'becomes the story\'s fact', 'never the word unknown', '{"directions":[{"id":"<owed id>","bearing":"<bearing>"}]}'])
    assert.ok(ATLAS_DIRECTIONS_PROMPT.indexOf(w) >= 0, 'the prompt says: ' + w);
});

test('the answer is read whole or refused: an unasked id, an id twice, a non-bearing, a stray field, a cut reply', () => {
  const owed = [{ id: 'f2', label: 'frozen trail' }, { id: 'f3', label: 'sunken pool' }];
  assert.deepEqual(atlasDirectionsRead(answer([{ id: 'f2', bearing: 'N' }, { id: 'f3', bearing: 'SW' }]), owed), { ok: true, records: [{ id: 'f2', bearing: 'N' }, { id: 'f3', bearing: 'SW' }] });
  assert.deepEqual(atlasDirectionsRead('```json\n' + answer([{ id: 'f3', bearing: 'E' }]) + '\n```', owed), { ok: true, records: [{ id: 'f3', bearing: 'E' }] }, 'a fenced reply; an owed id left out stays owed');
  assert.deepEqual(atlasDirectionsRead(answer([]), owed), { ok: true, records: [] });
  const bad = [[answer([{ id: 'f9', bearing: 'N' }]), /not asked/], [answer([{ id: 'f2', bearing: 'N' }, { id: 'f2', bearing: 'S' }]), /two directions/],
    [answer([{ id: 'f2', bearing: 'unknown' }]), /eight bearings/], [answer([{ id: 'f2', bearing: 'north' }]), /eight bearings/], [answer([{ id: 'f2', bearing: 'N', why: 'x' }]), /fields/],
    [JSON.stringify({ directions: [], note: 'x' }), /malformed/], [JSON.stringify({ directions: 'N' }), /malformed/], ['north, I think', /refused/],
    [answer([{ id: 'f2', bearing: 'N' }, { id: 'f3', bearing: 'S' }, { id: 'f2', bearing: 'E' }]), /more directions/], ['x'.repeat(4001), /bounded/]];
  for (const [reply, why] of bad) { const r = atlasDirectionsRead(reply, owed); assert.equal(r.ok, false, reply.slice(0, 60)); assert.match(r.reason, why); }
  assert.match(atlasDirectionsRead(answer([{ id: 'f2', bearing: 'N' }]), owed, { cut: true }).reason, /ended early/);
});

test('filing places the feature through the core\'s door, all or nothing, and marks whose decision it was', () => {
  setup(); reveal(MIRE);
  const trail = byLabel('frozen trail').id, pool = byLabel('sunken pool').id, ridge = byLabel('Shattered Ridge').id, beacon = byLabel('a far beacon').id, before = JSON.stringify(memory.map.geography);
  for (const [recs, why] of [[[{ id: trail, bearing: 'E' }, { id: ridge, bearing: 'S' }], /already established/], [[{ id: trail, bearing: 'E' }, { id: beacon, bearing: 'S' }], /reported feature/], [[{ id: 'f99', bearing: 'E' }], /unknown feature handle/]]) {
    const r = atlasDirectionsFile(recs, 'directions:2:t'); assert.equal(r.ok, false); assert.match(r.reason, why);
    assert.equal(JSON.stringify(memory.map.geography), before, 'a refused answer files nothing, not even its good records');
  }
  const r = atlasDirectionsFile([{ id: trail, bearing: 'E' }, { id: pool, bearing: 'SW' }], 'directions:2:t');
  assert.deepEqual(r, { ok: true, placed: [{ id: trail, label: 'frozen trail', bearing: 'E' }, { id: pool, label: 'sunken pool', bearing: 'SW' }] });
  assert.equal(byLabel('frozen trail').bearing, 'E'); assert.equal(byLabel('sunken pool').bearing, 'SW'); assert.equal(feats().length, 5, 'the same features, none added');
  assert.equal(MapKnowledge.problem(memory.map.geography), '', 'the record is whole');
  const rec = memory.map.geography.receipts[memory.map.geography.features[trail].receipt];
  assert.equal(rec.events[0].proposalKind, ATLAS_DIRECTIONS_PROVENANCE); assert.equal(rec.events[0].quote, 'You see frozen trail to the east.'); assert.equal(rec.turn, 2);
  const doc = atlasPublicDoc(worldState.atlas.seed), drawn = doc.features.filter(f => !f.unplaced).map(f => f.name).sort();
  assert.deepEqual(drawn, ['Shattered Ridge', 'frozen trail', 'sunken pool'], 'drawn on the sheet, no longer listed');
  assert.deepEqual(atlasDirectionsOwed().owed, [], 'nothing is owed any more');
  const again = atlasDirectionsFile([{ id: trail, bearing: 'W' }], 'directions:2:u'); assert.equal(again.ok, false); assert.equal(byLabel('frozen trail').bearing, 'E', 'a settled direction is not moved');
  assert.equal(atlasDirectionsSaid(r.placed), 'Map: frozen trail lies to the east; sunken pool lies to the southwest.');
});

test('the backstop asks once, files the answer, saves and tells the player; with nothing owed it asks nothing', async () => {
  setup(); reveal(MIRE); const log = [], trail = byLabel('frozen trail').id, pool = byLabel('sunken pool').id;
  gm(answer([{ id: trail, bearing: 'N' }, { id: pool, bearing: 'W' }]), log);
  const placed = await atlasDirectionsSettle('You head north along the frozen trail.[LOCATION:Petrified Mire]', 'Head north along the trail.');
  assert.equal(log.length, 1, 'one request'); assert.equal(log[0].system, ATLAS_DIRECTIONS_PROMPT); assert.equal(log[0].max, ATLAS_DIRECTIONS_TOKENS); assert.equal(log[0].model, null);
  assert.equal(log[0].opts.noHistory, true); assert.equal(log[0].opts.kind, 'map-directions', 'its own usage row'); assert.ok(ATLAS_DIRECTIONS_KIND.length <= 16, 'the server keeps 16 characters of a kind'); assert.equal(log[0].opts.noRetry, true);
  const u = JSON.parse(log[0].user); assert.equal(u.narration, 'You head north along the frozen trail.', 'the public narration, tags stripped'); assert.equal(u.playerAction, 'Head north along the trail.');
  assert.deepEqual(placed.map(x => x.label + ':' + x.bearing), ['frozen trail:N', 'sunken pool:W']);
  assert.equal(byLabel('frozen trail').bearing, 'N'); assert.equal(saves, 1, 'saved'); assert.deepEqual(toasts, ['Map: frozen trail lies to the north; sunken pool lies to the west.']);
  log.length = 0; assert.equal(await atlasDirectionsSettle('More prose.', ''), null); assert.equal(log.length, 0, 'nothing owed: no request');
  setup(); reveal(MIRE); worldState.atlas.knowledge = 0; assert.equal(await atlasDirectionsSettle('Prose.', ''), null); assert.equal(log.length, 0, 'no public map: no request');
});

test('a failed, unreadable or stale ask files nothing and says so; the features stay owed', async () => {
  setup(); reveal(MIRE); const before = JSON.stringify(memory.map.geography);
  for (const [reply, why] of [[new Error('provider down'), /provider down/], ['not json', /JSON was refused/], [answer([{ id: 'f99', bearing: 'N' }]), /not asked/]]) {
    toasts.length = 0; gm(reply);
    assert.equal(await atlasDirectionsSettle('Prose.', ''), null);
    assert.equal(JSON.stringify(memory.map.geography), before); assert.equal(saves, 0);
    assert.equal(toasts.length, 1); assert.match(toasts[0], why); assert.match(toasts[0], /stay listed and are asked again next turn/);
  }
  toasts.length = 0; const trail = byLabel('frozen trail').id;
  gm(() => { worldState.turn = 3; return answer([{ id: trail, bearing: 'N' }]); });/* the campaign moved on while the request was out */
  assert.equal(await atlasDirectionsSettle('Prose.', ''), null);
  worldState.turn = 2; assert.equal(JSON.stringify(memory.map.geography), before, 'a stale answer is not filed'); assert.match(toasts[0], /changed while directions were asked/);
  assert.equal(atlasDirectionsOwed().owed.length, 2);
});

test('the GM is told it is the author: a seen feature gets a bearing the turn it is declared; hearsay may wait', () => {
  setup(); reveal(MIRE);
  const p = atlasKnowledgePrompt();
  for (const w of ['You are the author of this world: a feature the party can SEE lies somewhere', 'settle it THIS turn', 'a reported one waits until its direction is told', 'where it implies nothing, your choice becomes the fact',
    'A feature the party perceives (observed) lies somewhere: give it a real bearing', 'unknown is only for testimony (reported) whose direction was not told', 'choosing the bearing of a feature the party sees is authorship, not invention'])
    assert.ok(p.indexOf(w) >= 0, 'the prompt says: ' + w);
  assert.ok(p.indexOf('Use unknown when no bearing is established') < 0 && p.indexOf('never invent a direction') < 0, 'the old permission is gone');
});

test('the backstop runs after the commit on a story turn and on the opening, and the file is loaded where the game loads', () => {
  const g = read('game.js');
  const c = g.indexOf('      commitGmTurn(resp,{mapExtraction:_mapDiscoveries,'), s = g.indexOf('if(typeof atlasDirectionsSettle==="function")await atlasDirectionsSettle(resp,txt);'), ui = g.indexOf('    syncUI();if(!isTT)maybeRefreshSynopsis();');
  assert.ok(c >= 0 && s > c && ui > s && g.slice(c, s).split('\n').length === 2, 'the line after the story commit, before the repaint');
  const oc = g.indexOf('    commitGmTurn(resp,{mapExtraction:_openingDiscoveries,'), os = g.indexOf('if(typeof atlasDirectionsSettle==="function")await atlasDirectionsSettle(resp,"");');
  assert.ok(oc >= 0 && os > oc && g.slice(oc, os).split('\n').length === 2, 'the line after the opening commit');
  assert.equal(g.split('atlasDirectionsSettle(').length - 1, 2, 'two call sites: Table Talk and a reroll ask nothing');
  const html = read('index.html'), sw = read('sw.js');
  assert.ok(html.indexOf('<script src="atlas-discovery.js"></script>\n<script src="atlas-directions.js"></script>') >= 0, 'loaded after the landmark reader');
  assert.ok(sw.indexOf('"/atlas-directions.js"') >= 0, 'in the offline shell');
});

(async function () {
  for (const [name, fn] of tests) {
    if (only && name !== only) continue;
    try { await fn(); count++; console.log('PASS #766 ' + name); } catch (e) { failed++; console.error('FAIL #766 ' + name + ': ' + e.message); }
  }
  console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
  process.exit(failed || (only && !count) ? 1 : 0);
})();
