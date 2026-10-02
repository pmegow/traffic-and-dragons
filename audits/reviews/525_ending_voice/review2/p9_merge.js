// Probe 9: #535 (merge gate spellings) and #537 (self-merge variants) through the real applyMuts.
require("./h.js");
function world(refs) {
  makeWorld(); worldState.turn = 85; worldState.npcs = []; memory.npcs = {};
  ["Isolde Marsh", "Wilhelmina Underbough", "Bram"].forEach(function (k) {
    memory.npcs[k] = { attitude: "", knowledge: ["fact about " + k], events: [{ turn: 1, note: "met " + k }], aliases: [], pronouns: "she/her" };
    worldState.npcs.push({ name: k, status: "present", rel: "neutral", pronouns: "she/her", met: 1, partyMember: false, portrait: null, aliases: [] });
  });
  if (refs) sceneRefsEnsure();
}
function fused() { return !memory.npcs["Wilhelmina Underbough"] || !wsNpcByName("Wilhelmina Underbough"); }
// ---------- #535: every spelling the PARSER merges (no scene refs) must be a PROPOSAL with scene refs
var tags = ["MERGE", "merge", "Merge", "MERGE ", " MERGE", "NPC_MERGE", "npc_merge", "MERGE_NPC"];
var doms = ["npc", "NPC", "Npc", "nPc", " npc", "npc ", " npc ", "\tnpc\t", "\nnpc\n", " npc ", "﻿npc", "npc　", "n pc", "npcs", "npc_group", "NPCS", "np​c", "ＮＰＣ", "ṅpc", "Kpc", "npc\u0000", "character", "person", "", " ", "npc|", "location", "item"];
var as = ["Isolde Marsh", " Isolde Marsh ", "Isolde Marsh\n", "isolde marsh", "Isolde", ""], bs = ["Wilhelmina Underbough", " Wilhelmina Underbough ", "Wilhelmina Underbough\t", "wilhelmina underbough", "Wilhelmina", "", "Wilhelmina Underbough|x"];
var n = 0, parserMerges = 0, leaks = [], strippedWrong = [];
tags.forEach(function (tg) { doms.forEach(function (d) { as.forEach(function (a) { bs.forEach(function (b) {
  var tag = (tg.indexOf("NPC_MERGE") >= 0 || tg === "npc_merge") ? "[" + tg + ":" + a + "|" + b + "]" : "[" + tg + ":" + d + "|" + a + "|" + b + "]";
  n++;
  world(false); var r0 = run("They are one woman. " + tag), f0 = fused();
  world(true); var r1 = run("They are one woman. " + tag), f1 = fused();
  if (f0) parserMerges++;
  if (f1) leaks.push(JSON.stringify(tag));
  // not a merge for the parser, yet a proposal was queued by the gate (the tag was swallowed instead of refused loudly)
  var prop = (worldState.pendingMergeHints || []).length;
  if (!f0 && prop) strippedWrong.push(JSON.stringify(tag) + " -> hints " + JSON.stringify(worldState.pendingMergeHints) + " | muts without refs: " + JSON.stringify(r0.muts) + " | muts with refs: " + JSON.stringify(r1.muts));
}); }); }); });
console.log("#535: " + n + " spellings; merged with no scene refs (parser accepts): " + parserMerges + "; FUSED with scene refs active (unconfirmed): " + leaks.length);
leaks.slice(0, 20).forEach(function (l) { console.log("   LEAK " + l); });
console.log("gate queued a proposal for a tag the parser would not have merged: " + strippedWrong.length);
strippedWrong.slice(0, 6).forEach(function (l) { console.log("   " + l); });

// ---------- #535: confirmed merge still lands
world(true); run("[MERGE: Npc |Isolde Marsh|Wilhelmina Underbough]"); worldState.turn++; var nud = buildMergeConfirmNudge(); worldState.turn++;
var rc = run("[MERGE:NPC|Isolde Marsh|Wilhelmina Underbough]");
console.log("confirmed merge lands: " + fused() + " | nudge: " + nud.slice(0, 160) + " | muts " + JSON.stringify(rc.muts));
// ---------- other domains are not swallowed by the npc gate
world(true); memory.map = memory.map || { nodes: {}, edges: [] }; memory.map.nodes["Old Mill"] = { firstVisit: 1, visits: 1, parent: null, npcs: [], items: [] }; memory.map.nodes["The Old Mill"] = { firstVisit: 2, visits: 1, parent: null, npcs: [], items: [] };
["[MERGE:location|Old Mill|The Old Mill]", "[MERGE:LOCATION|Old Mill|The Old Mill]", "[MERGE:item|Rope|Hemp Rope]", "[MERGE:npcs|Isolde Marsh|Wilhelmina Underbough]", "[MERGE:npc_group|Isolde Marsh|Wilhelmina Underbough]", "[MERGE:capability|Fireball|Fire Ball]", "[ALIAS:NPC|Isolde Marsh|Izzy]", "[ALIAS: npc |Isolde Marsh|Izzy2]"].forEach(function (t) {
  world(true); memory.map = memory.map || { nodes: {}, edges: [] }; memory.map.nodes["Old Mill"] = { firstVisit: 1, visits: 1, parent: null, npcs: [], items: [] }; memory.map.nodes["The Old Mill"] = { firstVisit: 2, visits: 1, parent: null, npcs: [], items: [] };
  var r = run(t); console.log(t + " -> muts " + JSON.stringify(r.muts) + " hints " + JSON.stringify(worldState.pendingMergeHints || []) + " aliases " + JSON.stringify(memory.npcs["Isolde Marsh"].aliases) + " nodes " + Object.keys(memory.map.nodes).length + " warns " + r.warns.filter(function (w) { return /REFUSED|refused|proposed|merged/i.test(w); }).length);
});

// ---------- #537: self-merge variants, no scene refs and with
function bramState() { return JSON.stringify([memory.npcs["Bram"], wsNpcByName("Bram"), Object.keys(memory.npcs).sort(), worldState.npcs.map(function (x) { return x.name; }), (memory.archive && memory.archive.identityMerges || []).length]); }
["[NPC_MERGE:Bram|Bram]", "[NPC_MERGE:Bram| Bram ]", "[NPC_MERGE: Bram |Bram]", "[NPC_MERGE:Bram|bram]", "[NPC_MERGE:bram|Bram]", "[NPC_MERGE:BRAM|Bram]", "[NPC_MERGE:Bram|Bram\n]", "[NPC_MERGE:Bram|Bram ]", "[NPC_MERGE:Bram|Bram​]", "[NPC_MERGE:Bram|Bram|Bram]", "[MERGE:npc|Bram|Bram]", "[MERGE:NPC| Bram |Bram ]", "[MERGE:npc|Bram|bram]", "[NPC_MERGE:Bram|Bram][NPC_MERGE:Bram|Bram]", "[NPC_MERGE:Bram|Braḿ]"].forEach(function (t) {
  [false, true].forEach(function (refs) {
    world(refs); var pre = bramState(), t0 = Date.now(), r, err = "";
    try { r = run(t); } catch (e) { err = "THREW " + e.message; r = { muts: [], warns: [] }; }
    var post = bramState();
    console.log((refs ? "refs " : "norefs ") + JSON.stringify(t) + " -> " + (err || "") + " changed=" + (pre !== post) + " bramAlive=" + !!(memory.npcs["Bram"] && wsNpcByName("Bram")) + " events=" + ((memory.npcs["Bram"] || {}).events || []).length + " keys=" + Object.keys(memory.npcs).join("/") + " muts=" + JSON.stringify(r.muts) + " errors=" + JSON.stringify((r.r && r.r.errors) || []) + " hints=" + JSON.stringify(worldState.pendingMergeHints || []) + " ms=" + (Date.now() - t0));
  });
});
// a record whose alias is the other operand; an on-file lowercase twin
world(false); memory.npcs["bram"] = { attitude: "", knowledge: ["lowercase twin"], events: [{ turn: 2, note: "twin" }], aliases: [] }; worldState.npcs.push({ name: "bram", status: "present", rel: "neutral", met: 2, aliases: [] });
var r2 = run("[NPC_MERGE:Bram|bram]"); console.log("twin on file: muts=" + JSON.stringify(r2.muts) + " keys=" + Object.keys(memory.npcs).join("/") + " Bram.knowledge=" + JSON.stringify(memory.npcs["Bram"].knowledge) + " aliases=" + JSON.stringify(memory.npcs["Bram"].aliases));
