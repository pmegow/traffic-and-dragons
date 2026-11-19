// Probe: _addImportedCompanion's memory writes with a companion named "__proto__" / "constructor".
// Replays ui-browsers.js lines 691-704 against the real engine after the real sheetAdmit.
var LE = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();
LE.makeTestWorld();
global.showToast = function (m) { console.log('TOAST', m); };
['__proto__', 'constructor', 'toString'].forEach(function (nm) {
  LE.makeTestWorld();
  var char = JSON.parse(JSON.stringify(worldState.character));
  char.name = nm;
  console.log('--- name', nm);
  console.log('memory.npcs proto is null?', Object.getPrototypeOf(memory.npcs) === null);
  console.log('wsNpcByName ->', !!wsNpcByName(char.name));
  var ad = sheetAdmit(char, { door: "companion import", mode: "cross", exclude: identityAttachOwners(char.name), rel: char.name });
  console.log('admit ok=', ad.ok, ad.reason || ad.why || '');
  if (!ad.ok) return;
  char = ad.sheet;
  try {
    if (!memory.npcs[char.name]) memory.npcs[char.name] = { attitude: "ally", knowledge: [], events: [], aliases: [] };
    if (!memory.npcs[char.name].aliases) memory.npcs[char.name].aliases = [];
    if (!memory.npcs[char.name].firstEncounter) memory.npcs[char.name].firstEncounter = char.name + " joined";
    memory.npcs[char.name].partyMember = true;
  } catch (e) { console.log('THREW', e.message); }
  console.log('own key filed?', Object.prototype.hasOwnProperty.call(memory.npcs, nm));
  console.log('Object.prototype polluted? partyMember=', ({}).partyMember, 'firstEncounter=', ({}).firstEncounter);
  delete Object.prototype.partyMember; delete Object.prototype.firstEncounter; delete Object.prototype.aliases;
});
