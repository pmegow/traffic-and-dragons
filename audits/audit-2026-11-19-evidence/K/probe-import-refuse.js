// Probe: a .tnd whose hero inventory the admission refuses (two rows, one key, different fields).
// What does importSaveData leave behind — the live worldState, the active campaign id, and the store?
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
var toasts = [];
global.showToast = function (m) { toasts.push(m); };
var saves = 0;
global.saveAll = function () { saves++; };
// Make the current campaign a real listed campaign first
setActiveCampId('camp_live_A'); worldState.campId = 'camp_live_A'; worldState.campName = 'Live A';
var before = { id: getActiveCampId(), name: worldState.character.name, camp: worldState.campName };
var file = JSON.parse(JSON.stringify({ worldState: worldState, sessionLog: [], memory: blankMemory() }));
file.worldState.campId = 'camp_foreign_9'; file.worldState.campName = 'Foreign';
file.worldState.character.name = 'Imported Hero';
file.worldState.character.inventory = [{ name: "Rope", qty: 1, mark: 1 }, { name: "Rope", qty: 1, mark: 2 }];
var threw = null;
try { importSaveData(file); } catch (e) { threw = e.message; }
console.log('importSaveData threw:', threw);
console.log('before:', JSON.stringify(before));
console.log('after : id=', getActiveCampId(), 'hero=', worldState && worldState.character.name, 'camp=', worldState && worldState.campName, 'ws.ver=', worldState && worldState.ver);
console.log('saveAll calls:', saves);
console.log('toasts:', JSON.stringify(toasts));
