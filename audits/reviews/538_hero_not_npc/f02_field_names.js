// read-only field sweep: every person name a save knows, asked of AFTER's memoryNpcNamesPlayer / npcExactOnFile.
// argv: <tree>.  Reads every .tnd under Campaigns/*/saves. Writes nothing.
var fs = require("fs"), path = require("path"), root = process.argv[2], CAMP = "C:/Projects/traffic-and-dragons/Campaigns";
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine("game.js"); console.warn = w0; console.info = i0;
var files = 0, totalNames = 0, flagged = 0, epi = 0, rawTags = 0, rawFlag = 0;
var TAGRE = /\[(NPC_NOTE|NPC_SUPERSEDE|NPC_PRONOUN|PARTY_MEMBER|NPC_MERGE|NPC_ALIAS|MERGE|ALIAS|NPC|NPC_DEATH_REPORTED|NPC_FORGET|NPC_LINK|NPC_FACTION):([^\]]*)\]/g;
fs.readdirSync(CAMP).forEach(function (c) {
  var d = path.join(CAMP, c, "saves"); if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter(function (f) { return /\.tnd$/.test(f); }).forEach(function (f) {
    var save; try { save = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (er) { console.log("unreadable " + f); return; } files++;
    worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || { npcs: {} }; if (!memory.npcs) memory.npcs = {};
    var hero = worldState.character && worldState.character.name, names = Object.create(null);
    function add(n, src) { n = String(n == null ? "" : n).trim(); if (!n) return; if (!names[n]) names[n] = src; }
    Object.keys(memory.npcs).forEach(function (k) { add(k, "memory key"); (memory.npcs[k].aliases || []).forEach(function (a) { add(a, "memory alias of " + k); }); });
    (worldState.npcs || []).forEach(function (n) { if (!n) return; add(n.name, "roster row"); (n.aliases || []).forEach(function (a) { add(a, "row alias of " + n.name); }); if (n.charSheet) { add(n.charSheet.name, "sheet name"); (n.charSheet.aliases || []).forEach(function (a) { add(a, "sheet alias of " + n.name); }); (n.charSheet.relationships || []).forEach(function (r) { if (r && r.entity) add(r.entity, "bond entity on " + n.name); }); } });
    ((worldState.character || {}).relationships || []).forEach(function (r) { if (r && r.entity) add(r.entity, "hero bond entity"); });
    var g = memory.npcGraph || {}; (g.edges || []).forEach(function (ed) { add(ed.a, "graph"); add(ed.b, "graph"); }); Object.keys(g.npcFactions || {}).forEach(function (k) { add(k, "faction member"); });
    (worldState.transcript || []).forEach(function (e) { if (!e) return; if (e.e && e.e.n) e.e.n.forEach(function (n) { add(n, "transcript e.n t" + e.t); }); if (e.p) e.p.forEach(function (n) { add(n, "transcript party t" + e.t); }); if (e.sp && e.sp.s) Object.keys(e.sp.s).forEach(function (k) { add(e.sp.s[k], "speaker t" + e.t); }); });
    var nodes = (memory.map && memory.map.nodes) || {}; Object.keys(nodes).forEach(function (k) { (nodes[k].npcs || []).forEach(function (n) { add(n, "node npcs " + k); }); if (nodes[k].keeper) add(nodes[k].keeper, "keeper"); if (nodes[k].owner) add(nodes[k].owner, "owner of " + k); });
    var out = [];
    Object.keys(names).forEach(function (n) {
      totalNames++;
      var isP = memoryNpcIsPlayer(n), namesP = (typeof memoryNpcNamesPlayer === "function") ? memoryNpcNamesPlayer(n) : (isP || memoryNpcIsPlayer(resolveNpcName(n)));
      if (namesP) { flagged++; out.push("'" + n + "' (" + names[n] + ") reads as the player" + (isP ? " [exact]" : " [via resolve -> '" + resolveNpcName(n) + "']")); }
    });
    // the hero's own names: do they resolve away, and is an epithet someone's name
    var heroNames = [hero, "player"].concat((worldState.character && worldState.character.aliases) || []);
    heroNames.forEach(function (n) { var r = resolveNpcName(n); if (r !== n) out.push("hero name '" + n + "' resolves to '" + r + "'"); });
    ((worldState.character && worldState.character.aliases) || []).forEach(function (a) { if (typeof npcExactOnFile === "function") { var o = npcExactOnFile(a); if (o) { epi++; out.push("epithet '" + a + "' is on file as " + o); } } });
    // raw tags still in the session window
    (save.sessionLog || []).forEach(function (msg) {
      if (!msg || msg.role !== "assistant") return; var m, t = String(msg.content || ""); TAGRE.lastIndex = 0;
      while ((m = TAGRE.exec(t))) { rawTags++; var ops = m[2].split("|"), which = m[1], cand = [];
        if (which === "MERGE" || which === "ALIAS") { if (String(ops[0]).trim().toLowerCase() !== "npc") continue; cand = [ops[1], ops[2]]; }
        else if (which === "NPC_MERGE" || which === "NPC_ALIAS" || which === "NPC_LINK") cand = [ops[0], ops[1]]; else cand = [ops[0]];
        cand.forEach(function (o) { o = String(o || "").trim(); if (!o) return; var np = (typeof memoryNpcNamesPlayer === "function") ? memoryNpcNamesPlayer(o) : false; if (np) { rawFlag++; out.push("raw tag in session window: " + m[0].slice(0, 100) + " -> operand '" + o + "' reads as the player"); } });
      }
    });
    if (out.length) console.log(c + " / " + f + " (hero " + hero + ", epithets " + JSON.stringify(worldState.character.aliases || []) + ", t" + worldState.turn + "):\n   " + out.join("\n   "));
  });
});
console.log(files + " saves; " + totalNames + " names asked; " + flagged + " read as the player; " + epi + " epithets on file as an NPC; " + rawTags + " raw person tags in session windows, " + rawFlag + " flagged");
