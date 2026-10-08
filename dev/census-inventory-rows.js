// DEV read-only legacy-string pre-switch census. This is not the proposed #599
// row API or a migration: object rows/mixed arrays are explicitly unsupported.
// Success means the selected legacy sheets passed exact text/order, unit and
// equipped-membership preflight. It makes no claim about unselected saves or rows.
// Missing inventories are counted skips. Empty inventory arrays are usable.
// node dev/census-inventory-rows.js [folder] [--all]
// Default selects newest mtime per directory containing .tnd files, not by campId.
// Exit 1 for any invalid input or failed preflight, 2 for a missing folder.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var L = require("./load-engine.js"); L.loadEngine();
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};

var args = process.argv.slice(2), ALL = args.indexOf("--all") >= 0, dirArg = args.filter(function (a) { return a !== "--all"; })[0];
var BASE = dirArg ? path.resolve(dirArg) : path.join(ROOT, "Campaigns");

// ---- legacy-string conversion under examination ----
function parseStored(s) { var m = String(s).match(/^(.*\S)\s+x([1-9]\d*)\s*$/i); return m ? { name: m[1].trim(), qty: parseInt(m[2], 10) } : { name: String(s).trim(), qty: 1 }; }
function itemKey(n) { return _invNorm(n); } // today's pack rule, which §2.2 adopts
function legacyRows(list, worn) {
  var rows = [], idx = Object.create(null), junk = [], unmatched = [], i;
  for (i = 0; i < (list || []).length; i++) {
    var e = list[i], r = null;
    if (typeof e === "string") { if (!e.trim()) { junk.push(e); continue; } r = parseStored(e); r.equipped = false; }
    else { junk.push(e); continue; }
    var k = "k:" + itemKey(r.name);
    if (idx[k] != null) { rows[idx[k]].qty += r.qty; if (r.equipped) rows[idx[k]].equipped = true; continue; }
    idx[k] = rows.length; rows.push(r);
  }
  for (i = 0; i < (worn || []).length; i++) { var wk = "k:" + itemKey(worn[i]); if (idx[wk] != null) rows[idx[wk]].equipped = true; else unmatched.push(worn[i]); }
  return { rows: rows, junk: junk, wornUnmatched: unmatched };
}
function invText(r) { return r.name + (r.qty > 1 ? " x" + r.qty : ""); }
function unitsByKey(strings) { var o = Object.create(null), i; for (i = 0; i < strings.length; i++) { var k = itemKey(_invBase(strings[i])); o[k] = (o[k] || 0) + _invCount(strings[i]); } return o; }

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

var S = { saves: 0, sheets: 0, items: 0, counted: 0, maxQty: 0, equippedSheets: 0, equippedNames: 0, equippedOrderChanges: 0, wornUnmatched: 0, folds: 0, textMismatch: 0, unitMismatch: 0, junk: 0, grammarSplit: 0, skippedInventory: 0, usable: 0, invalid: 0, equippedMismatch: 0 };
var notes = [], seen = Object.create(null);
function note(s) { if (!seen[s]) { seen[s] = 1; notes.push(s); } }
function fail(s) { S.invalid++; note(s); }
function record(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
function safeUnits(q) { return Number.isSafeInteger(q) && q > 0; }

savesIn(BASE).forEach(function (sv) {
  var tnd; try { tnd = JSON.parse(fs.readFileSync(sv.file, "utf8")); } catch (e) { fail("unreadable: " + sv.file + " (" + e.message + ")"); return; }
  var ws = tnd && tnd.worldState;
  if (ws == null) { fail("no worldState: " + sv.file); return; }
  if (!record(ws)) { fail("worldState is not an object: " + sv.file); return; }
  S.saves++;
  var sheets = [{ who: "hero", s: ws.character }];
  if (ws.npcs != null && !Array.isArray(ws.npcs)) fail(sv.camp + ": npcs is not an array");
  else (ws.npcs || []).forEach(function (n, i) {
    if (!record(n)) { fail(sv.camp + ": invalid npc at " + i); return; }
    if (n.charSheet != null) sheets.push({ who: "npc " + i, s: n.charSheet });
  });
  if (ws.pendingLegacy != null) sheets.push({ who: "legacy", s: ws.pendingLegacy });
  sheets.forEach(function (sh) {
    var s = sh.s, where = sv.camp + " · " + sh.who;
    if (s == null) { S.skippedInventory++; return; }
    if (!record(s)) { fail(where + ": sheet is not an object"); return; }
    if (!Object.prototype.hasOwnProperty.call(s, "inventory")) { S.skippedInventory++; return; }
    if (!Array.isArray(s.inventory)) { fail(where + ": inventory is not an array"); return; }
    var inv = s.inventory, before = S.invalid; S.sheets++; S.items += inv.length;
    inv.forEach(function (e, i) {
      if (typeof e !== "string") { S.junk++; fail(where + ": unsupported non-string inventory entry at " + i); return; }
      if (!e.trim()) { S.junk++; fail(where + ": empty inventory entry at " + i); return; }
      var q = parseStored(e).qty, c = _invCount(e);
      if (q > 1) S.counted++; if (q > S.maxQty) S.maxQty = q;
      if (q !== c) { S.grammarSplit++; fail(where + ": count grammars disagree at " + i); }
      if (!safeUnits(q) || !safeUnits(c)) fail(where + ": quantity is not a safe positive integer at " + i);
    });
    var worn = s.worn == null ? [] : s.worn;
    if (!Array.isArray(worn)) { fail(where + ": worn is not an array"); return; }
    worn.forEach(function (w, i) { if (typeof w !== "string" || !w.trim()) fail(where + ": unsupported worn entry at " + i); });
    if (S.invalid !== before) return;
    S.usable++;
    var m = legacyRows(inv, worn);
    S.junk += m.junk.length;
    if (m.junk.length) fail(where + ": converter produced junk");
    S.wornUnmatched += m.wornUnmatched.length;
    m.wornUnmatched.forEach(function () { fail(where + ": worn matches no carried item"); });
    var folded = inv.length - m.rows.length; if (folded > 0) S.folds += folded;
    if (JSON.stringify(m.rows.map(invText)) !== JSON.stringify(inv)) { S.textMismatch++; fail(where + ": inventory text/order changed"); }
    var u0 = unitsByKey(inv), u1 = Object.create(null);
    m.rows.forEach(function (r) { var k = itemKey(r.name); u1[k] = (u1[k] || 0) + r.qty; });
    Array.from(new Set(Object.keys(u0).concat(Object.keys(u1)))).forEach(function (k) {
      if (!safeUnits(u0[k]) || !safeUnits(u1[k])) fail(where + ": aggregate quantity is not a safe positive integer");
      if ((u0[k] || 0) !== (u1[k] || 0)) { S.unitMismatch++; fail(where + ": units lost or gained"); }
    });
    // Expected membership comes from original strings and worn, not converter flags.
    var expected = Object.create(null), actual = Object.create(null);
    inv.forEach(function (e) { var k = itemKey(_invBase(e)); expected[k] = worn.some(function (w) { return itemKey(w) === k; }); });
    m.rows.forEach(function (r) { actual[itemKey(r.name)] = r.equipped === true; });
    Array.from(new Set(Object.keys(expected).concat(Object.keys(actual)))).forEach(function (k) {
      if (expected[k] !== actual[k]) { S.equippedMismatch++; fail(where + ": equipped membership changed"); }
    });
    if (worn.length) {
      S.equippedSheets++; S.equippedNames += worn.length;
      var rowsLine = m.rows.filter(function (r) { return r.equipped; }).map(function (r) { return r.name; }).join(", ");
      if (rowsLine !== worn.join(", ")) S.equippedOrderChanges++;
    }
  });
});
if (!S.usable) fail("no usable legacy inventory sheets");

console.log("#599 inventory-rows census — " + BASE + (ALL ? " (every save)" : " (latest save per campaign)"));
console.log("  saves " + S.saves + " · sheets " + S.sheets + " · items " + S.items + " · counted (x2+) " + S.counted + " · largest count " + S.maxQty);
console.log("  equipped lines " + S.equippedSheets + " (" + S.equippedNames + " names) · order changes " + S.equippedOrderChanges + " · worn with no carried item " + S.wornUnmatched);
console.log("  folds " + S.folds + " · junk " + S.junk + " · grammar splits " + S.grammarSplit);
console.log("  rows printing back differently " + S.textMismatch + " · units lost or gained " + S.unitMismatch);
notes.forEach(function (n) { console.log("  - " + n); });
console.log("  skipped missing inventory " + S.skippedInventory + " · usable legacy sheets " + S.usable + " · equipped mismatches " + S.equippedMismatch + " · invalid diagnostics " + S.invalid);
console.log(S.invalid ? "CENSUS FAILED — legacy preflight rejected input or conversion" : "CENSUS OK — selected legacy strings preserve exact text/order, units and equipped membership; row inputs are unsupported");
process.exit(S.invalid ? 1 : 0);
