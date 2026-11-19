'use strict';
const engine = require('C:/Projects/traffic-and-dragons/dev/load-engine.js'); engine.loadEngine('game.js');
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};
engine.makeTestWorld();
let s = MapKnowledge.create(); const N = Number(process.argv[2] || 2000);
const q = 'Beyond the reeds, half sunk in black water, a leaning stone marker carved with a weathered serpent rises to the north of the path.';
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const label = 'marker ' + i, quote = q.replace('stone marker', 'stone marker ' + i).replace('marker ' + i, label);
  const r = MapKnowledge.prepare(s, [{ op: 'disclose', id: 'new', label: label, proposalKind: '', bearing: 'N', mode: 'observed', quote: quote }], { channel: 'gm', commit: 'discovery:' + i + ':abcdefgh:0', turn: i, container: 'Place ' + (i % 20), text: quote });
  if (!r.ok) { console.log('refused at', i, r.reason); break; }
  s = r.state;
}
const t1 = Date.now();
console.log('receipts', Object.keys(s.receipts).length, 'bytes', JSON.stringify(s).length, 'build ms', t1 - t0);
let t2 = Date.now(); for (let i = 0; i < 20; i++) MapKnowledge.project(s, 'Place 3', 'player'); console.log('one projection ms ~', (Date.now() - t2) / 20);
t2 = Date.now(); for (let i = 0; i < 20; i++) JSON.stringify(s); console.log('one stringify (atlasDiscoveryPin) ms ~', (Date.now() - t2) / 20);
