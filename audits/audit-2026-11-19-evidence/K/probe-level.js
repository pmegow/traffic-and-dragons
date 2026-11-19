// Probe: does a hostile character.level in a .tnd survive importSaveData into the campaign meta row
// (rendered raw as "Lv"+cm.level in ui-campaigns.js _renderCampList and ui-browsers.js)?
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
var ws0 = LE.makeTestWorld();
global.showToast = function (m) { console.log('TOAST', m); };
var origSaveAll = global.saveAll;
var payload = '<img src=x onerror=alert(1)>';
var file = JSON.parse(JSON.stringify({ worldState: worldState, sessionLog: [], memory: blankMemory() }));
file.worldState.character.level = payload;
file.worldState.character.cls = '<b>cls</b>';
file.worldState.campId = 'camp_foreign_1';
try {
  var plan = importSaveData(file);
  console.log('plan', JSON.stringify(plan));
} catch (e) { console.log('IMPORT THREW', e.message); }
console.log('live level after import:', JSON.stringify(worldState.character.level));
var meta = getCampMeta();
meta.forEach(function (m) { console.log('meta row', m.id, 'level=', JSON.stringify(m.level), 'cls=', JSON.stringify(m.charClass)); });
