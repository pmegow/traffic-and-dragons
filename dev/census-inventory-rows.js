// DEV read-only inventory census — #599 gate 7 (DOC/DESIGN_599_inventory_rows.md §8.2). Every sheet in every selected save
// goes through THE ENGINE'S OWN HEAL (inventory.js invHealSheet) on a detached copy, and the result is judged by an
// INDEPENDENT ORACLE built from the source alone, never from the converter:
//   · a LEGACY sheet (strings, a worn list): every row prints back to its old string in order (invTextList), units per item
//     key are preserved (the OLD loose readers count the source), equipped membership equals the worn list's membership,
//     a second heal changes nothing, a JSON save-reload-heal is identical; a stored count the old loose rule and the stored
//     grammar read differently is a GRAMMAR SPLIT (§5.4: an unrefreshed device would read it differently);
//   · a ROW sheet (release (c) saves): the heal is a no-op, and the rows' names, counts and flags equal the source's — erasing
//     every equipped flag (or any one) FAILS even when text and units are identical, because the oracle reads the source;
//   · a MIXED or unreadable sheet, a refused heal, a missing or non-list inventory container: FAILS COVERAGE — never skipped
//     into a CENSUS OK (§8.2 gate 7).
// node dev/census-inventory-rows.js [folder] [--all]
// Default selects the newest .tnd per directory holding .tnd files (not by campId); --all reads every save. Given a folder of
// .tnd exports it is the pre-switch check of §5.5. Exit 1 for any failed sheet, 2 for a missing folder.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var L = require("./load-engine.js"); L.loadEngine();
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};

var args = process.argv.slice(2), ALL = args.indexOf("--all") >= 0, dirArg = args.filter(function (a) { return a !== "--all"; })[0];
var BASE = dirArg ? path.resolve(dirArg) : path.join(ROOT, "Campaigns");

// ---- the independent oracle: the engine's stored grammar (never a private copy — review (b) 6) and the OLD loose readers,
// frozen: the v1.1197 legacy strip (any trailing x-digits), the rule an unrefreshed device may still run (§5.4) ----
function parseStored(s) { return invStoredParse(s); }
function key(n) { return itemKey(n); } // the one pack key (§2.2)
function looseCount(s) { var m = String(s).match(/\sx(\d+)\s*$/i); return m ? parseInt(m[1], 10) : 1; }
function looseBase(s) { return String(s).replace(/\s*x\d+\s*$/i, "").trim(); }
function legacyRows(list, worn) {
  var rows = [], idx = Object.create(null), unmatched = [], i;
  for (i = 0; i < list.length; i++) { var r = parseStored(list[i]); r.equipped = false; var k = "k:" + key(r.name); if (idx[k] != null) { rows[idx[k]].qty += r.qty; continue; } idx[k] = rows.length; rows.push(r); }
  for (i = 0; i < worn.length; i++) { var wk = "k:" + key(parseStored(worn[i]).name); if (idx[wk] != null) rows[idx[wk]].equipped = true; else unmatched.push(worn[i]); }
  return { rows: rows, wornUnmatched: unmatched };
}
function unitsByKey(strings) { var o = Object.create(null), i; for (i = 0; i < strings.length; i++) { var k = key(looseBase(strings[i])); o[k] = (o[k] || 0) + looseCount(strings[i]); } return o; }
function unitsOfRows(rows) { var o = Object.create(null), i; for (i = 0; i < rows.length; i++) { var k = key(rows[i].name); o[k] = (o[k] || 0) + rows[i].qty; } return o; }
function sameUnits(u0, u1) { var ks = Object.keys(u0).concat(Object.keys(u1)), i; for (i = 0; i < ks.length; i++) if ((u0[ks[i]] || 0) !== (u1[ks[i]] || 0)) return false; return true; }
function isRow(e) { return !!e && typeof e === "object" && !Array.isArray(e) && typeof e.name === "string" && typeof e.qty === "number" && typeof e.equipped === "boolean"; }

// ---- which saves ----
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

var S = { saves: 0, sheets: 0, legacySheets: 0, rowSheets: 0, items: 0, counted: 0, maxQty: 0, equippedSheets: 0, equippedNames: 0, equippedOrderChanges: 0, wornUnmatched: 0, folds: 0, textMismatch: 0, unitMismatch: 0, equippedMismatch: 0, grammarSplit: 0, notIdempotent: 0, refused: 0, skippedInventory: 0, invalid: 0 };
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
  var sheets = worldSheetsOf(ws);
  if (ws.npcs != null && !Array.isArray(ws.npcs)) fail(sv.camp + ": npcs is not an array");
  sheets.forEach(function (sh) {
    var s = sh.sheet, where = sv.camp + " · " + sh.who, before = S.invalid;
    if (!record(s)) { fail(where + ": sheet is not an object"); return; }
    if (!Object.prototype.hasOwnProperty.call(s, "inventory")) { S.skippedInventory++; return; }
    if (!Array.isArray(s.inventory)) { fail(where + ": inventory is not a list"); return; }
    var inv = s.inventory; S.sheets++; S.items += inv.length;
    var strings = inv.every(function (e) { return typeof e === "string"; }), rows = inv.every(isRow);
    if (!strings && !rows) { fail(where + ": mixed or unreadable inventory entries (not all strings, not all rows) — unsupported, counted as a failure"); return; }
    var worn = s.worn == null ? [] : s.worn;
    if (!Array.isArray(worn)) { fail(where + ": worn is not a list"); return; }
    if (rows && worn.length) { fail(where + ": a row sheet still carries a worn list"); return; }
    worn.forEach(function (w, i) { if (typeof w !== "string" || !w.trim()) fail(where + ": unsupported worn entry at " + i); });
    if (s.inventoryJunk !== undefined && !Array.isArray(s.inventoryJunk)) fail(where + ": inventoryJunk is not a list");
    if (S.invalid !== before) return;
    /* THE ENGINE'S HEAL on a detached copy */
    var copy = JSON.parse(JSON.stringify(s)), h = invHealSheet(copy);
    if (!h.ok) { S.refused++; fail(where + ": the heal refused — " + h.reason); return; }
    var out = copy.inventory;
    if (!Array.isArray(out) || !out.every(isRow)) { fail(where + ": the heal did not produce rows"); return; }
    if (copy.worn !== undefined) fail(where + ": the heal left a worn list");
    if (copy.sheetVer !== SHEET_VER) fail(where + ": the heal did not stamp sheetVer " + SHEET_VER);
    /* idempotent, and identical through a JSON save-reload */
    var again = JSON.parse(JSON.stringify(copy)), h2 = invHealSheet(again);
    if (!h2.ok || h2.changed || !invDeepEqual(again.inventory, out)) { S.notIdempotent++; fail(where + ": a second heal (after a save-reload) changed the rows"); }
    out.forEach(function (r) { if (r.qty > 1) S.counted++; if (r.qty > S.maxQty) S.maxQty = r.qty; if (!safeUnits(r.qty)) fail(where + ": a row count is not a safe positive integer"); });
    if (strings) {
      S.legacySheets++;
      inv.forEach(function (e, i) {
        if (!e.trim()) { fail(where + ": empty inventory entry at " + i); return; }
        var q = parseStored(e).qty, c = looseCount(e);
        if (q !== c) { S.grammarSplit++; fail(where + ": count grammars disagree at " + i + " (" + JSON.stringify(e) + ")"); }
        if (!safeUnits(q) || !safeUnits(c)) fail(where + ": quantity is not a safe positive integer at " + i);
      });
      var o = legacyRows(inv, worn);
      S.wornUnmatched += o.wornUnmatched.length; o.wornUnmatched.forEach(function () { fail(where + ": worn matches no carried item"); });
      var folded = inv.length - out.length; if (folded > 0) S.folds += folded;
      if (JSON.stringify(invTextList(out)) !== JSON.stringify(inv)) { S.textMismatch++; fail(where + ": inventory text/order changed"); }
      if (!sameUnits(unitsByKey(inv), unitsOfRows(out))) { S.unitMismatch++; fail(where + ": units lost or gained"); }
      /* the EQUIPMENT ORACLE: membership from the SOURCE strings and worn, never from the converter's flags */
      var expected = Object.create(null), actual = Object.create(null);
      inv.forEach(function (e) { var k = key(looseBase(e)); expected[k] = worn.some(function (w) { return key(parseStored(w).name) === k; }); });
      out.forEach(function (r) { actual[key(r.name)] = r.equipped === true; });
      Object.keys(expected).concat(Object.keys(actual)).forEach(function (k) { if (!!expected[k] !== !!actual[k]) { S.equippedMismatch++; fail(where + ": equipped membership changed (" + k + ")"); } });
      if (JSON.stringify(o.rows.map(function (r) { return [r.name, r.qty, r.equipped]; })) !== JSON.stringify(out.map(function (r) { return [r.name, r.qty, r.equipped]; }))) { S.equippedMismatch++; fail(where + ": the engine's rows disagree with the independent legacy oracle"); }
      if (worn.length) { S.equippedSheets++; S.equippedNames += worn.length; var line = out.filter(function (r) { return r.equipped; }).map(function (r) { return r.name; }).join(", "); if (line !== worn.join(", ")) S.equippedOrderChanges++; }
    } else {
      S.rowSheets++;
      if (h.changed && !(s.sheetVer !== SHEET_VER && invDeepEqual(out, inv))) fail(where + ": the heal CHANGED a row sheet");
      if (!invDeepEqual(out, inv)) fail(where + ": a row sheet's rows changed through the heal");
      /* the EQUIPMENT ORACLE for rows: the source's own flags, name by name */
      inv.forEach(function (r, i) { if (!out[i] || out[i].name !== r.name || out[i].qty !== r.qty || out[i].equipped !== r.equipped) { S.equippedMismatch++; fail(where + ": row " + i + " (" + r.name + ") changed name, count or equipped"); } });
      var eq = inv.filter(function (r) { return r.equipped; }); if (eq.length) { S.equippedSheets++; S.equippedNames += eq.length; }
    }
  });
});
if (!S.sheets) fail("no inventory sheets found");

console.log("#599 inventory-rows census (gate 7) — " + BASE + (ALL ? " (every save)" : " (latest save per campaign)"));
console.log("  saves " + S.saves + " · sheets " + S.sheets + " (legacy " + S.legacySheets + ", rows " + S.rowSheets + ") · items " + S.items + " · counted (x2+) " + S.counted + " · largest count " + S.maxQty);
console.log("  equipped sheets " + S.equippedSheets + " (" + S.equippedNames + " names) · Wearing-line order changes " + S.equippedOrderChanges + " · worn with no carried item " + S.wornUnmatched);
console.log("  folds " + S.folds + " · grammar splits " + S.grammarSplit + " · rows printing back differently " + S.textMismatch + " · units lost or gained " + S.unitMismatch);
console.log("  equipped mismatches " + S.equippedMismatch + " · not idempotent " + S.notIdempotent + " · heals refused " + S.refused + " · skipped (no inventory field) " + S.skippedInventory);
notes.forEach(function (n) { console.log("  - " + n); });
console.log("  invalid diagnostics " + S.invalid);
console.log(S.invalid ? "CENSUS FAILED — a sheet failed the heal or the oracle (details above)" : "CENSUS OK — every selected sheet heals to rows that print back exactly, keep every unit and every equipped flag, and heal again to the same rows");
process.exit(S.invalid ? 1 : 0);
