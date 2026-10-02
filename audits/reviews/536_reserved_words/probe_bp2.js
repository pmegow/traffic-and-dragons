// #536 other entrances (read-only probe): a campaign STARTED from a blueprint whose names are reserved words. argv: <tree>
var root = process.argv[2], fs = require("fs"), engine = require(root + "/dev/load-engine.js");
var w0 = console.warn, i0 = console.info, l0 = console.log; console.warn = function () {}; console.info = function () {};
engine.loadEngine(); console.warn = w0; console.info = i0;
global.document = { getElementById: function () { return null; }, addEventListener: function () {}, removeEventListener: function () {} };
global.showToast = function () {};
var BASE = { proto: Object.getOwnPropertyNames(Object.prototype), obj: Object.getOwnPropertyNames(Object) };
function poison() {
  var out = [], n, i;
  n = Object.getOwnPropertyNames(Object.prototype); for (i = 0; i < n.length; i++) if (BASE.proto.indexOf(n[i]) < 0) { out.push("Object.prototype." + n[i]); delete Object.prototype[n[i]]; }
  n = Object.getOwnPropertyNames(Object); for (i = 0; i < n.length; i++) if (BASE.obj.indexOf(n[i]) < 0) { out.push("Object." + n[i]); delete Object[n[i]]; }
  ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"].forEach(function (k) { var fn = Object.prototype[k]; Object.getOwnPropertyNames(fn).forEach(function (x) { if (["length", "name", "prototype", "arguments", "caller"].indexOf(x) < 0) { out.push(k + "." + x); delete fn[x]; } }); });
  return out;
}
var src = fs.readFileSync(root + "/samples/modeltestcampaign.blueprint", "utf8");
var names = ["saveAll", "showGame", "syncUI", "initAbilities", "initSpells", "takeCheckpoint", "addMsg", "initCampaignFolderForGame", "generateSkeleton", "beginAdventure", "guestbookSeedStart", "relationshipMigrateWorld"];
names.forEach(function (k) { global[k] = function () {}; }); global.addMsg = function () { return { remove: function () {} }; }; global.generateSkeleton = async function () {};
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var cases = [["npc", "__proto__"], ["npc", "constructor"], ["location", "__proto__"], ["location", "constructor"], ["start", "__proto__"], ["start", "constructor"], ["hero", "__proto__"], ["hero", "constructor"]];
  for (var ci = 0; ci < cases.length; ci++) {
    var kind = cases[ci][0], w = cases[ci][1], bp = JSON.parse(src), was = "", err = "", after = "";
    if (kind === "npc") { was = bp.npcs[0].name; bp.npcs[0].name = w; }
    if (kind === "location") { was = bp.locations[0].name; bp.locations[0].name = w; }
    if (kind === "start") { was = bp.startingLocation; bp.startingLocation = w; }
    engine.makeTestWorld(); var hero = JSON.parse(JSON.stringify(worldState.character)); if (kind === "hero") { was = hero.name; hero.name = w; }
    var v = ""; try { v = validateBlueprint(bp); } catch (e) { v = "validate THREW " + e.message; }
    if (!v) {
      console.warn = function () {}; console.info = function () {};
      try { pendingBlueprint = bp; pendingCompanions = []; startGame(hero, "Fantasy", "", ""); await sleep(20); } catch (e2) { err = " | startGame THREW " + e2.message; }
      console.warn = w0; console.info = i0;
    }
    var p = poison();
    try { console.warn = function () {}; buildSysPrompt(); } catch (e3) { after = " | then buildSysPrompt THROWS: " + e3.message; } finally { console.warn = w0; }
    var p2 = poison();
    l0((p.length || p2.length || err || after ? "!! " : "   ") + kind + " '" + String(was).slice(0, 28) + "' as " + w + " -> validate: " + (v || "accepted") + (p.length ? " | start wrote on built-ins: " + p.join(", ") : "") + (p2.length ? " | prompt build wrote: " + p2.join(", ") : "") + err + after + " | memory.npcs keys " + Object.keys(memory.npcs || {}).length + ", location " + JSON.stringify(worldState.world && worldState.world.location));
  }
})();
