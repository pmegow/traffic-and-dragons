// rc-mark-repair.js — #187④c: the receipted owner-side de-index repair (owner go 2026-08-14).
// Marks (or unmarks) the rc flag on GM transcript entries of the named turns in a .tnd export,
// so historical un-tagged retractions can be repaired without touching entry text (the
// transcript is sacred — rc is additive metadata; ragRetrieve simply stops serving the scene).
//
// Usage:
//   node dev/rc-mark-repair.js <save.tnd> <turn | from-to> "<reason>"            mark
//   node dev/rc-mark-repair.js <save.tnd> <turn | from-to> "<reason>" --unmark   reverse a mistake
//
// Receipts: every touched entry's {turn, index, hadRc} preimage + the reason archive to
// memory.archive.retconRepairs; output written beside the input as *_RCMARKED.tnd. The live
// [RETCON:what|turn] tag (#187④a) is the GM-side twin of this operation.
var fs = require("fs"), path = require("path");
var savePath = process.argv[2], range = process.argv[3], reason = process.argv[4], UNMARK = process.argv.indexOf("--unmark") !== -1;
if (!savePath || !range || !reason) { console.error("usage: node dev/rc-mark-repair.js <save.tnd> <turn|from-to> \"<reason>\" [--unmark]"); process.exit(1); }
var m = String(range).match(/^(\d+)(?:-(\d+))?$/);
if (!m) { console.error("range must be a turn number or from-to"); process.exit(1); }
var from = parseInt(m[1], 10), to = m[2] ? parseInt(m[2], 10) : from;
if (to < from) { console.error("range end before start"); process.exit(1); }

var save = JSON.parse(fs.readFileSync(path.resolve(savePath), "utf8"));
var ws = save.worldState, mem = save.memory;
if (!ws || !Array.isArray(ws.transcript)) { console.error("no plain transcript array in this export"); process.exit(1); }

var receipts = [], touched = 0;
ws.transcript.forEach(function (e, i) {
  if (e.r !== "gm" || e.t < from || e.t > to) return;
  var had = !!e.rc;
  if (UNMARK ? !had : had) { receipts.push({ turn: e.t, index: i, hadRc: had, op: "no-op (already in target state)" }); return; }
  receipts.push({ turn: e.t, index: i, hadRc: had, op: UNMARK ? "unmarked" : "marked" });
  if (UNMARK) delete e.rc; else e.rc = 1;
  touched++;
});
if (!receipts.length) { console.error("REFUSED: no GM entries in turns " + from + "-" + to + " — nothing marked (no adjacency guessing, ever)"); process.exit(1); }

if (!mem.archive) mem.archive = {};
if (!mem.archive.retconRepairs) mem.archive.retconRepairs = [];
mem.archive.retconRepairs.push({ date: new Date().toISOString().slice(0, 10), range: from + "-" + to, reason: reason, unmark: UNMARK, receipts: receipts });

var out = path.resolve(savePath).replace(/\.tnd$/i, "") + "_RCMARKED.tnd";
fs.writeFileSync(out, JSON.stringify(save));
receipts.forEach(function (r) { console.log("  " + r.op + "  t" + r.turn + " [" + r.index + "]" + (r.hadRc ? " (had rc)" : "")); });
console.log(touched + " entr" + (touched === 1 ? "y" : "ies") + " " + (UNMARK ? "unmarked" : "marked") + ", " + (receipts.length - touched) + " no-op; receipts archived under memory.archive.retconRepairs");
console.log("written: " + out);
