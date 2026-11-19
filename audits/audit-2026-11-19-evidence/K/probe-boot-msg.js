// Probe: a .tnd whose hero name and world.location carry markup — after the real importSaveData (which migrates and
// heals), what reaches the two boot/load system lines that addMsg renders as innerHTML?
//   ui-boot.js 451-452 initState: "Welcome back, "+worldState.character.name / worldState.world.location+" | Turn "...
//   ui-campaigns.js 245-246 _applyLoadedCampaign: "Campaign loaded: "+worldState.character.name+"." / same location line
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function () {};
global.saveAll = function () {};
var X = '<img src=x onerror=alert(1)>';
var file = JSON.parse(JSON.stringify({ worldState: worldState, sessionLog: [], memory: blankMemory() }));
file.worldState.character.name = 'Kit ' + X;
file.worldState.world.location = 'Harbor ' + X;
file.worldState.campId = 'camp_foreign_77';
try { importSaveData(file); } catch (e) { console.log('IMPORT THREW', e.message); }
console.log('name after import    :', JSON.stringify(worldState.character.name));
console.log('location after import:', JSON.stringify(worldState.world.location));
console.log('initState line 1 html:', "Welcome back, " + worldState.character.name + ".");
console.log('initState line 2 html:', worldState.world.location + " | Turn " + worldState.turn);
