// #536 other entrances (read-only probe): a blueprint whose names are reserved words. argv: <tree>
process.env.ENGINE_ROOT = process.argv[2];
require("../thu/vtags/harness.js");
var fs = require("fs");
var BASE = { proto: Object.getOwnPropertyNames(Object.prototype), obj: Object.getOwnPropertyNames(Object) };
function poison() {
  var out = [], n, i;
  n = Object.getOwnPropertyNames(Object.prototype); for (i = 0; i < n.length; i++) if (BASE.proto.indexOf(n[i]) < 0) { out.push("Object.prototype." + n[i]); delete Object.prototype[n[i]]; }
  n = Object.getOwnPropertyNames(Object); for (i = 0; i < n.length; i++) if (BASE.obj.indexOf(n[i]) < 0) { out.push("Object." + n[i]); delete Object[n[i]]; }
  ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"].forEach(function (k) { var fn = Object.prototype[k]; Object.getOwnPropertyNames(fn).forEach(function (x) { if (["length", "name", "prototype", "arguments", "caller"].indexOf(x) < 0) { out.push(k + "." + x); delete fn[x]; } }); });
  return out;
}
var src = fs.readFileSync(process.argv[2] + "/samples/modeltestcampaign.blueprint", "utf8");
var bp0 = JSON.parse(src);
console.log("blueprint top-level keys: " + Object.keys(bp0).join(", "));
var sk = bp0.skeleton || bp0;
console.log("skeleton keys: " + Object.keys(sk).join(", "));
function names(o, path, out) { if (Array.isArray(o)) o.forEach(function (x, i) { names(x, path + "[" + i + "]", out); }); else if (o && typeof o === "object") Object.keys(o).forEach(function (k) { if (typeof o[k] === "string" && /^(name|title|location|startLocation|nm|faction|id)$/.test(k)) out.push(path + "." + k + "=" + o[k].slice(0, 30)); else names(o[k], path + "." + k, out); }); return out; }
var all = names(bp0, "bp", []);
console.log(all.length + " name-like fields, e.g. " + all.slice(0, 12).join(" | "));
["__proto__", "constructor"].forEach(function (w) {
  ["npc", "location", "faction", "quest"].forEach(function (kind) {
    var bp = JSON.parse(src), s = bp.skeleton || bp, hit = "";
    function first(arr, key) { if (Array.isArray(arr) && arr[0] && typeof arr[0][key] === "string") { hit = arr[0][key]; arr[0][key] = w; return true; } return false; }
    if (kind === "npc") first(s.npcs || s.keyNpcs || s.characters, "name");
    if (kind === "location") first(s.locations || s.places, "name");
    if (kind === "faction") first(s.factions, "name");
    if (kind === "quest") first(s.quests || s.arcs || s.acts, "title") || first(s.quests || s.arcs || s.acts, "name");
    if (!hit) { console.log("   (no " + kind + " list found in this blueprint)"); return; }
    var v = "", err = "", after = "";
    try { v = validateBlueprint(bp); } catch (e) { v = "validate THREW " + e.message; }
    makeWorld(); delete worldState.kind;
    if (!v) { try { quiet(function () { applyBlueprint(bp); }); } catch (e2) { err = " | apply THREW " + e2.message; } }
    var p = poison();
    try { quiet(function () { buildSysPrompt(); }); } catch (e3) { after = " | then buildSysPrompt THROWS: " + e3.message; }
    poison();
    console.log((p.length || err || after ? "!! " : "   ") + kind + " '" + hit + "' renamed " + w + " -> validate: " + (v || "accepted") + (p.length ? " | wrote on built-ins: " + p.join(", ") : "") + err + after);
  });
});
