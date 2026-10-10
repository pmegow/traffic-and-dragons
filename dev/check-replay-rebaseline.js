// dev/check-replay-rebaseline.js — #599 (c), gate 9 (DOC/DESIGN_599_inventory_rows.md §8.2): the ONE allowed re-baseline of the
// four frozen replay end states (dev/corpus_*.json.endstate.json) is proven, never assumed. Given the OLD committed end state
// and the NEW one, every difference must be on the whitelist and nothing else may move:
//   ws.character.inventory   — old strings, new rows; the rows must print back (invTextList) to EXACTLY the old strings
//   ws.ver                   — 10 → SAVE_VER
//   ws.character.sheetVer    — absent → SHEET_VER
//   ws.character.worn        — may be ABSENT in the new state only if it was absent or empty in the old one (the fold)
// Every other path must be byte-equivalent (deep-equal, key order ignored). Exit 1 on any other hunk, with the path named.
//   node dev/check-replay-rebaseline.js <old.endstate.json> <new.endstate.json>
var fs = require("fs"), path = require("path");
var engine = require("./load-engine.js"); engine.loadEngine();
var a = process.argv[2], b = process.argv[3];
if (!a || !b) { console.error("usage: node dev/check-replay-rebaseline.js <old.endstate.json> <new.endstate.json>"); process.exit(2); }
var OLD = JSON.parse(fs.readFileSync(a, "utf8")), NEW = JSON.parse(fs.readFileSync(b, "utf8"));
var hunks = [], okNotes = [];
function deq(x, y) { return invDeepEqual(x, y); }
function walk(p, x, y) {
  if (deq(x, y)) return;
  if (p === "ws.ver") { if (x === 10 && y === SAVE_VER) { okNotes.push("ws.ver 10 -> " + SAVE_VER); return; } hunks.push(p + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y)); return; }
  if (p === "ws.character.sheetVer") { if (x === undefined && y === SHEET_VER) { okNotes.push("ws.character.sheetVer absent -> " + SHEET_VER); return; } hunks.push(p + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y)); return; }
  if (p === "ws.character.worn") { if ((x === undefined || (Array.isArray(x) && !x.length)) && y === undefined) { okNotes.push("ws.character.worn (empty) folded away"); return; } hunks.push(p + ": " + JSON.stringify(x) + " -> " + JSON.stringify(y)); return; }
  if (p === "ws.character.inventory") {
    if (!Array.isArray(x) || !Array.isArray(y)) { hunks.push(p + ": not two lists"); return; }
    var bad = x.some(function (e) { return typeof e !== "string"; }) ? "the OLD inventory is not all strings" : "";
    if (!bad && y.some(function (r) { return !r || typeof r !== "object" || typeof r.name !== "string" || typeof r.qty !== "number" || typeof r.equipped !== "boolean"; })) bad = "the NEW inventory is not all rows";
    if (!bad && y.some(function (r) { return Object.keys(r).sort().join(",") !== "equipped,name,qty"; })) bad = "a NEW row carries fields other than exactly name, qty and equipped (review (c) 10): " + JSON.stringify(y.filter(function (r) { return Object.keys(r).sort().join(",") !== "equipped,name,qty"; })[0]);
    if (!bad && JSON.stringify(invTextList(y)) !== JSON.stringify(x)) bad = "the rows do not print back to the old strings: " + JSON.stringify(invTextList(y)) + " vs " + JSON.stringify(x);
    if (!bad && y.some(function (r) { return r.equipped; })) bad = "a row is equipped where the old state had no worn list";
    if (bad) hunks.push(p + ": " + bad); else okNotes.push("ws.character.inventory: " + x.length + " strings -> " + y.length + " rows, text identical");
    return;
  }
  if (x && y && typeof x === "object" && typeof y === "object" && Array.isArray(x) === Array.isArray(y)) {
    var keys = {}; Object.keys(x).forEach(function (k) { keys[k] = 1; }); Object.keys(y).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { walk(p + (Array.isArray(x) ? "[" + k + "]" : "." + k), x[k], y[k]); });
    return;
  }
  hunks.push(p + ": " + JSON.stringify(x).slice(0, 80) + " -> " + JSON.stringify(y).slice(0, 80));
}
walk("ws", OLD.ws, NEW.ws);
walk("mem", OLD.mem, NEW.mem);
okNotes.forEach(function (n) { console.log("  allowed: " + n); });
hunks.forEach(function (h) { console.error("  HUNK OUTSIDE THE WHITELIST: " + h); });
if (!okNotes.length && !hunks.length) console.log("  (identical)");
console.log(hunks.length ? "REBASELINE REFUSED — " + hunks.length + " hunk(s) outside gate 9's whitelist" : "REBASELINE OK — only the whitelisted paths moved (" + path.basename(a) + ")");
process.exit(hunks.length ? 1 : 0);
