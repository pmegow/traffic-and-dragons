'use strict';
const engine = require('C:/Projects/traffic-and-dragons/dev/load-engine.js'); engine.loadEngine('game.js');
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};
const A1 = 'Petrified Mire', B1 = 'The Ashen Fields', C1 = 'Gloomwood Forest';
engine.makeTestWorld(); atlasForget(); worldState.world.location = A1; worldState.world.sublocation = null; worldState.turn = 1;
worldState.atlas = { v: ATLAS_VER, seed: 'k771', knowledge: 1 }; memory.map.nodes[A1] = newMapNode(0, null); memory.map.nodes[A1].visits = 1;
memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
function go(world) { const from = worldState.world.location; worldState.turn++; worldState.world.location = world; if (!memory.map.nodes[world]) memory.map.nodes[world] = newMapNode(worldState.turn, null); memory.map.nodes[world].visits++; memory.map.edges.push({ from: from, to: world, turn: worldState.turn }); atlasFollow(); }
go(B1); go(C1);
const A = worldState.atlas;
let r = atlasRegionSpots(A); console.log('fresh with no record:', JSON.stringify(r.fresh));
// precondition: the LATER place (C1) already holds the point the EARLIER place (A1) is now set at; A1 has no record
const p1 = r.fresh[0].at;
A.spots = keyedDict(); A.spots[C1] = { at: p1.slice(), turn: 3 };
r = atlasRegionSpots(A); console.log('spots with C1 kept at A1\'s point:', JSON.stringify(r.spots));
const pts = Object.keys(r.spots).map(k => JSON.stringify(r.spots[k]));
console.log('distinct points', new Set(pts).size, 'of', pts.length);
