// REVIEW PROBE p15: an UNCLOSED tag in front of a reserved tag. tagStripReserved's per-tag pattern reads from "[NAME:" to the
// first "]", so "[TIME:dusk [LOCATION:constructor]" is ONE tag to it (pieces: "dusk [LOCATION:constructor"), while each
// handler scans with its own pattern and finds the inner tag. argv: <tree>
var L = require("./lib.js");
console.log("tree: " + L.TREE + " | tagStripReserved present: " + (typeof tagStripReserved === "function"));
function strip(text) { if (typeof tagStripReserved !== "function") return "(no strip in this tree)"; var r = tagStripReserved(text); return "refused " + JSON.stringify(r.refused.map(function (x) { return x.name + ":" + x.word; })) + ", text left: " + JSON.stringify(r.text); }
function one(label, text) {
  L.world("plain");
  var r, thrown = ""; try { r = run(text); } catch (e) { thrown = e.message; r = { muts: [], r: {} }; }
  var saved = { ws: JSON.parse(JSON.stringify(worldState)), mem: JSON.parse(JSON.stringify(memory)) };
  var p = L.poison(), t1 = ""; try { quiet(function () { buildSysPrompt(); }); t1 = "builds"; } catch (e1) { t1 = "THROWS " + e1.message; }
  L.poison();
  // the reload: only the saved state survives; the built-ins are fresh
  worldState = saved.ws; memory = saved.mem;
  var t2 = ""; try { quiet(function () { buildSysPrompt(); }); t2 = "builds"; } catch (e2) { t2 = "THROWS " + e2.message; }
  var p2 = L.poison();
  console.log("--- " + label + "\n    reply: " + text + "\n    strip: " + strip(text) + "\n    summary: " + JSON.stringify(r.muts.filter(function (m) { return !/Clock reconcile|^Time: /.test(m); })).slice(0, 220) + (((r.r && r.r.errors) || []).length ? " | handler errors " + JSON.stringify(r.r.errors).slice(0, 160) : "") + (thrown ? " | THROWN " + thrown : "") + "\n    wrote on built-ins: " + (p.length ? p.join(", ").slice(0, 230) : "nothing") + "\n    next prompt: " + t1 + " | after a reload (saved state only): " + t2 + (p2.length ? " (and the reloaded prompt build wrote: " + p2.join(", ").slice(0, 120) + ")" : "") + " | every NPC reads dead: " + !!({}).dead + ", Bram dead: " + !!npcIsDead(wsNpcByName("Bram") || {}));
  L.poison();
}
one("control: the tag alone (what #536 refuses)", "You walk on. [LOCATION:constructor]");
one("an unclosed TIME tag before a place", "You walk on. [TIME:dusk [LOCATION:constructor]");
one("an unclosed SAY tag before a death", "He falls. [SAY:Bram [NPC:toString|dead|enemy]");
one("an unclosed tag before a party join", "She nods. [TIME_ADVANCE:10m [PARTY_MEMBER:constructor|true]");
one("an unclosed tag before a link", "They are kin. [WEATHER:rain [NPC_LINK:constructor|Bram|kin]");
one("the same shape with __proto__ (caught: flagged anywhere in the outer payload)", "He falls. [TIME:dusk [NPC:__proto__|dead|enemy]");
