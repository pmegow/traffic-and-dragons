'use strict';
const engine = require('C:/Projects/traffic-and-dragons/dev/load-engine.js'); engine.loadEngine('game.js');
const toasts = []; global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () {};
engine.makeTestWorld(); atlasForget();
function at(world) { worldState.world.location = world; worldState.world.sublocation = null; if (!memory.map.nodes[world]) memory.map.nodes[world] = newMapNode(worldState.turn, null); memory.map.nodes[world].visits++; atlasFollow(); }
worldState.turn = 1; worldState.world.location = 'Mirefen';
worldState.atlas = { v: ATLAS_VER, seed: 'k999', knowledge: 1 }; memory.map.nodes['Mirefen'] = newMapNode(0, null); memory.map.nodes['Mirefen'].visits = 1;
memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
function turn(text) { worldState.turn++; const muts = applyMuts(text, { deferSave: true }); const r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals); atlasFollow(); return r; }
console.log('t2', JSON.stringify(turn('A stone well stands to the north. [MAP_REVEAL:new|stone well|N|observed]').refusal));
at('Mire Fen');
console.log('t3', JSON.stringify(turn('Another stone well, north. [MAP_REVEAL:new|stone well|N|observed]').refusal));
// the identity layer later folds Mire Fen into Mirefen (a merge repair)
memory.map.identity = memory.map.identity || { entries: keyedDict() }; memory.map.identity.entries = memory.map.identity.entries || keyedDict();
memory.map.identity.entries['Mire Fen'] = { mergedInto: 'Mirefen' };
at('Mirefen');
console.log('features shown at Mirefen:', JSON.stringify(atlasKnowledgeProjection('Mirefen').features.map(f => [f.id, f.label])));
toasts.length = 0;
const r = turn('A broken cart lies to the east. [MAP_REVEAL:new|broken cart|E|observed]');
console.log('t5 new distinct feature ->', JSON.stringify(r.refusal)); console.log('toasts', JSON.stringify(toasts));
const r2 = turn('A leaning post to the west. [MAP_REVEAL:new|leaning post|W|observed]');
console.log('t6 another ->', JSON.stringify(r2.refusal));
