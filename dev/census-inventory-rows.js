// dev/census-inventory-rows.js — the #599 field census (DEV TOOL, read-only, node).
//
// Dry-runs the #599 migration — every inventory from an array of strings to rows {name, qty, equipped}, the separate `worn`
// list folded into `equipped` — over saved campaigns, and checks what must hold before the one-way switch:
//   no unit lost or gained per item key; every row prints back (name + " xN") as exactly the string it came from; every
//   worn name lands on a carried row; nothing is junk; the count grammars agree. It also measures the one expected change,
//   the order of the `Equipped:` prompt line (rows give pack order where `worn` gave donning order).
// The migration here is the REFERENCE semantics of DOC/DESIGN_599_inventory_rows.md §5.2; the #599 build's invRows must
// agree with it on every save this tool reads (the build re-points this tool at the real function).
//
//   node dev/census-inventory-rows.js                 latest save per campaign under Campaigns/*/saves
//   node dev/census-inventory-rows.js --all           every .tnd under Campaigns/*/saves
//   node dev/census-inventory-rows.js <dir> [--all]   another folder laid out the same way, or a folder of .tnd exports
// Exit 1 when a unit is lost or gained, or a row prints back differently; 0 otherwise. Never writes.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var L = require("./load-engine.js"); L.loadEngine();
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};

var args = process.argv.slice(2), ALL = args.indexOf("--all") >= 0, dirArg = args.filter(function (a) { return a !== "--all"; })[0];
var BASE = dirArg ? path.resolve(dirArg) : path.join(ROOT, "Campaigns");

// ---- reference semantics (§5.2) ----
function parseStored(s) { var m = String(s).match(/^(.*\S)\s+x([1-9]\d*)\s*$/i); return m ? { name: m[1].trim(), qty: parseInt(m[2], 10) } : { name: String(s).trim(), qty: 1 }; }
function itemKey(n) { return _invNorm(n); } // today's pack rule, which §2.2 adopts
function invRows(list, worn) {
  var rows = [], idx = {}, junk = [], unmatched = [], i;
  for (i = 0; i < (list || []).length; i++) {
    var e = list[i], r = null;
    if (typeof e === "string") { if (!e.trim()) { junk.push(e); continue; } r = parseStored(e); r.equipped = false; }
    else if (e && typeof e === "object" && typeof e.name === "string" && e.name.trim()) { r = { name: e.name.trim(), qty: Math.max(1, Math.floor(Number(e.qty) || 1)), equipped: !!e.equipped }; }
    else { junk.push(e); continue; }
    var k = "k:" + itemKey(r.name);
    if (idx[k] != null) { rows[idx[k]].qty += r.qty; if (r.equipped) rows[idx[k]].equipped = true; continue; }
    idx[k] = rows.length; rows.push(r);
  }
  for (i = 0; i < (worn || []).length; i++) { var wk = "k:" + itemKey(worn[i]); if (idx[wk] != null) rows[idx[wk]].equipped = true; else unmatched.push(worn[i]); }
  return { rows: rows, junk: junk, wornUnmatched: unmatched };
}
function invText(r) { return r.name + (r.qty > 1 ? " x" + r.qty : ""); }
function unitsByKey(strings) { var o = {}, i; for (i = 0; i < strings.length; i++) { var k = itemKey(_invBase(strings[i])); o[k] = (o[k] || 0) + _invCount(strings[i]); } return o; }

// ---- which saves ----
// Every folder holding .tnd files, at any depth (Campaigns/<slug>/saves, Campaigns/Runelords/<slug>/saves, a folder of exports).
// One folder is one campaign; without --all, only its newest save is read.
function savesIn(base) {
  var out = [];
  if (!fs.existsSync(base)) { console.error("census: no such folder " + base); process.exit(2); }
  (function walk(dir) {
    var ents = fs.readdirSync(dir, { withFileTypes: true }), files = [];
    ents.forEach(function (e) { if (e.isDirectory()) walk(path.join(dir, e.name)); else if (/\.tnd$/.test(e.name)) files.push({ f: e.name, t: fs.statSync(path.join(dir, e.name)).mtimeMs }); });
    if (!files.length) return;
    files.sort(function (a, b) { return b.t - a.t; });
    if (!ALL) files = files.slice(0, 1);
    var camp = path.basename(dir) === "saves" ? path.basename(path.dirname(dir)) : path.basename(dir);
    files.forEach(function (fo) { out.push({ camp: camp, file: path.join(dir, fo.f) }); });
  })(base);
  return out;
}

var S = { saves: 0, sheets: 0, items: 0, counted: 0, maxQty: 0, equippedSheets: 0, equippedNames: 0, equippedOrderChanges: 0, wornUnmatched: 0, folds: 0, textMismatch: 0, unitMismatch: 0, junk: 0, grammarSplit: 0 };
var notes = [], seen = {};
function note(s) { if (!seen[s]) { seen[s] = 1; notes.push(s); } }

savesIn(BASE).forEach(function (sv) {
  var tnd; try { tnd = JSON.parse(fs.readFileSync(sv.file, "utf8")); } catch (e) { note("unreadable: " + sv.file + " (" + e.message + ")"); return; }
  var ws = tnd && tnd.worldState; if (!ws) { note("no worldState: " + sv.file); return; }
  S.saves++;
  var sheets = [{ who: "hero " + (ws.character && ws.character.name), s: ws.character }];
  (ws.npcs || []).forEach(function (n) { if (n && n.charSheet) sheets.push({ who: n.name, s: n.charSheet }); });
  if (ws.pendingLegacy) sheets.push({ who: "legacy " + (ws.pendingLegacy.name || ""), s: ws.pendingLegacy });
  sheets.forEach(function (sh) {
    var s = sh.s, where = sv.camp + " · " + sh.who; if (!s) return;
    if (s.inventory == null) return; if (!Array.isArray(s.inventory)) { note(where + ": inventory is not an array"); return; }
    var inv = s.inventory; S.sheets++; S.items += inv.length;
    var strings = inv.filter(function (e) { return typeof e === "string" && e.trim(); });
    strings.forEach(function (e) {
      var q = parseStored(e).qty, c = _invCount(e); if (q > 1) S.counted++; if (q > S.maxQty) S.maxQty = q;
      if (q !== c) { S.grammarSplit++; note(where + ": count grammars disagree on '" + e + "' (" + c + " today, " + q + " in rows)"); }
    });
    var m = invRows(inv, s.worn);
    S.junk += m.junk.length; m.junk.forEach(function (j) { note(where + ": junk entry " + JSON.stringify(j).slice(0, 60) + " would move to inventoryJunk"); });
    S.wornUnmatched += m.wornUnmatched.length; m.wornUnmatched.forEach(function (w) { note(where + ": worn '" + w + "' matches no carried item (dropped, loudly)"); });
    var folded = strings.length - m.rows.length; if (folded > 0) { S.folds += folded; note(where + ": " + folded + " entr" + (folded === 1 ? "y folds" : "ies fold") + " into an existing row"); }
    if (!folded) { var back = m.rows.map(invText), i; for (i = 0; i < back.length; i++) if (back[i] !== strings[i]) { S.textMismatch++; note(where + ": '" + strings[i] + "' prints back as '" + back[i] + "'"); } }
    var u0 = unitsByKey(strings), u1 = {}; m.rows.forEach(function (r) { var k = itemKey(r.name); u1[k] = (u1[k] || 0) + r.qty; });
    Object.keys(u0).concat(Object.keys(u1)).forEach(function (k) { if ((u0[k] || 0) !== (u1[k] || 0)) { S.unitMismatch++; note(where + ": units for '" + k + "' " + (u0[k] || 0) + " -> " + (u1[k] || 0)); } });
    var worn = (s.worn || []).filter(function (x) { return !!x; });
    if (worn.length) {
      S.equippedSheets++; S.equippedNames += worn.length;
      var rowsLine = m.rows.filter(function (r) { return r.equipped; }).map(function (r) { return r.name; }).join(", ");
      if (rowsLine !== worn.join(", ")) S.equippedOrderChanges++;
    }
  });
});

console.log("#599 inventory-rows census — " + BASE + (ALL ? " (every save)" : " (latest save per campaign)"));
console.log("  saves " + S.saves + " · sheets " + S.sheets + " · items " + S.items + " · counted (x2+) " + S.counted + " · largest count " + S.maxQty);
console.log("  equipped lines " + S.equippedSheets + " (" + S.equippedNames + " names) · order changes " + S.equippedOrderChanges + " · worn with no carried item " + S.wornUnmatched);
console.log("  folds " + S.folds + " · junk " + S.junk + " · grammar splits " + S.grammarSplit);
console.log("  rows printing back differently " + S.textMismatch + " · units lost or gained " + S.unitMismatch);
notes.forEach(function (n) { console.log("  - " + n); });
var bad = S.textMismatch + S.unitMismatch;
console.log(bad ? "CENSUS FAILED — the migration would change what the GM reads or lose units" : "CENSUS OK — lossless, and every row prints back as its old string");
process.exit(bad ? 1 : 0);
