'use strict';
const engine = require('C:/Projects/traffic-and-dragons/dev/load-engine.js'); engine.loadEngine('game.js');
const toasts = []; global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () {};
const MIRE = 'Petrified Mire', CROSS = 'The Crossroads of Ashenveil';
engine.makeTestWorld(); atlasForget(); worldState.world.location = CROSS; worldState.world.sublocation = null; worldState.turn = 1;
worldState.atlas = { v: ATLAS_VER, seed: 'k771', knowledge: 1 }; memory.map.nodes[CROSS] = newMapNode(0, null); memory.map.nodes[CROSS].visits = 1;
memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
const cross = worldState.atlas.at;
function go(world) { const from = worldState.world.location; worldState.turn++; worldState.world.location = world; if (!memory.map.nodes[world]) memory.map.nodes[world] = newMapNode(worldState.turn, null); memory.map.nodes[world].visits++; memory.map.edges.push({ from: from, to: world, turn: worldState.turn }); atlasFollow(); return worldState.atlas.at; }
const mire = go(MIRE);
const d1 = atlasDoc(mire); console.log('mire sheet generator', d1.generator.name, 'portals', (d1.portals || []).map(p => p.id));
const d2 = atlasDoc(cross); console.log('cross sheet generator', d2.generator.name, 'portals', (d2.portals || []).map(p => p.id));
let c = atlasCard(mire, { id: 'way-1' }); console.log('way card on mire:', c && c.id, c && c.title, 'note=', c && c.note);
const r = atlasNoteSet(mire, 'way-1', 'Back to the crossroads, watch for bandits.'); console.log('noteSet on mire way-1:', JSON.stringify(r));
c = atlasCard(mire, { id: 'way-1' }); console.log('way card after save:', 'note=', JSON.stringify(c && c.note));
console.log('publicNotes store:', JSON.stringify(worldState.atlas.publicNotes));
console.log('atlasNote(cross, way-1) — the OTHER sheet:', JSON.stringify(atlasNote(cross, 'way-1')));
