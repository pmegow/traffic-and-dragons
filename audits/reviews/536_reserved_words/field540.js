// read-only field check for #540: no real blueprint, saved skeleton or saved name trips the reserved-word checks. argv: <tree>
var fs = require("fs"), path = require("path"), root = process.argv[2], CAMP = "C:/Projects/traffic-and-dragons/Campaigns", MAIN = "C:/Projects/traffic-and-dragons";
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine(); console.warn = w0; console.info = i0;
function walk(dir, ext, out, depth) { if (depth > 5) return out; var es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; } es.forEach(function (e) { var p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") walk(p, ext, out, depth + 1); } else if (ext.some(function (x) { return e.name.toLowerCase().slice(-x.length) === x; })) out.push(p); }); return out; }
var bps = walk(path.join(MAIN, "samples"), [".blueprint"], [], 0).concat(walk(CAMP, [".blueprint"], [], 0)), nb = 0, bad = 0;
bps.forEach(function (f) { var bp; try { bp = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; } nb++; var r = reservedWordIn(bp, ""); var v = ""; try { v = validateBlueprint(typeof normalizeBlueprint === "function" ? normalizeBlueprint(JSON.parse(JSON.stringify(bp))) : bp); } catch (e2) { v = "THREW " + e2.message; } if (r || (v && /reserved word/.test(v))) { bad++; console.log("!! " + f + " -> " + JSON.stringify(r) + " | " + v); } });
console.log(nb + " blueprint files read; " + bad + " trip the reserved-word check");
var saves = walk(CAMP, [".tnd"], [], 0), ns = 0, hits = 0, names = 0;
saves.forEach(function (f) { var save; try { save = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; } ns++;
  var ws; try { ws = inflateWorldStateSnapshot(save.worldState); } catch (e2) { ws = save.worldState || {}; } var mem = save.memory || {}, out = [];
  function chk(kind, n) { names++; if (reservedKeyWord(n)) out.push(kind + " '" + n + "'"); }
  Object.keys(mem.npcs || {}).forEach(function (k) { chk("npc", k); (mem.npcs[k].aliases || []).forEach(function (a) { chk("alias", a); }); });
  (ws.npcs || []).forEach(function (n) { if (n) chk("row", n.name); });
  Object.keys((mem.map || {}).nodes || {}).forEach(function (k) { k.split("|").forEach(function (part) { chk("place", part); }); });
  Object.keys(mem.locations || {}).forEach(function (k) { chk("location", k); });
  ((ws.character || {}).inventory || []).forEach(function (it) { chk("item", typeof it === "string" ? it : (it && it.name)); });
  Object.keys(ws.itemDefs || {}).forEach(function (k) { chk("itemDef", k); });
  (ws.quests || []).forEach(function (q) { if (q) chk("quest", q.title || q.name); });
  chk("hero", (ws.character || {}).name); chk("here", (ws.world || {}).location);
  var sk = ws.skeleton ? reservedWordIn(ws.skeleton, "") : null; if (sk) out.push("skeleton " + JSON.stringify(sk));
  if (out.length) { hits++; console.log("!! " + path.basename(f) + ": " + out.slice(0, 6).join("; ")); } });
console.log(ns + " save files read, " + names + " names checked; " + hits + " saves hold a reserved name");
