// set-deep-time.js — stamp a #227 deep-time age ladder onto an EXISTING campaign export.
//
// Why this tool exists: the ladder is written ONCE at campaign start (blueprint import or the
// generated skeleton), because there is deliberately no tag for it — a ceiling the GM can raise
// is not a ceiling, and the block rides the CACHED stable half where a mid-campaign write kills
// every prompt-cache hit thereafter. That is correct for play and useless for a campaign already
// 2,000 turns deep, which is exactly where the antiquity ratchet was actually observed.
//
// So: a HUMAN may set it once, out of band, as ONE deliberate cache invalidation (the same class
// as editing the narrative rules). The GM still cannot. That distinction is the whole design.
//
//   node dev/set-deep-time.js <save.tnd> --from <blueprint>     # dry run, prints the receipt
//   node dev/set-deep-time.js <save.tnd> --from <blueprint> --write
//   node dev/set-deep-time.js <save.tnd> --clear --write        # remove a ladder
//
// Writes <save>_LADDERED.tnd — never in place. The original is left untouched by construction.
var fs = require("fs"), path = require("path");
require(path.join(__dirname, "load-engine.js")).loadEngine();

function die(m) { console.error("ERROR: " + m); process.exit(1); }

var args = process.argv.slice(2);
var save = args[0];
if (!save || save.charAt(0) === "-") die("usage: node dev/set-deep-time.js <save.tnd> --from <blueprint.blueprint> [--write] | --clear --write");
var fromAt = args.indexOf("--from"), from = fromAt >= 0 ? args[fromAt + 1] : null;
var doClear = args.indexOf("--clear") >= 0, doWrite = args.indexOf("--write") >= 0;
if (!from && !doClear) die("give --from <blueprint or json with a deepTime array>, or --clear");
if (!fs.existsSync(save)) die("save not found: " + save);

var blob;
try { blob = JSON.parse(fs.readFileSync(save, "utf8")); } catch (e) { die("save is not valid JSON: " + e.message); }
var ws = blob.worldState;
if (!ws) die("no worldState in this export — is it a .tnd save?");

var ladder = [];
if (from) {
  if (!fs.existsSync(from)) die("ladder source not found: " + from);
  var src;
  try { src = JSON.parse(fs.readFileSync(from, "utf8")); } catch (e) { die("ladder source is not valid JSON: " + e.message); }
  var rawLadder = Array.isArray(src) ? src : src.deepTime;
  if (!rawLadder) die("no deepTime array in " + from + " — author one there first (the designer's World Ages section writes it).");
  // The SAME normalizer the engine uses, so what this tool writes is exactly what play accepts.
  ladder = normalizeDeepTime(rawLadder);
  if (!ladder.length) die("that deepTime normalized to nothing (every rung nameless?) — refusing to write an empty ceiling.");
}

var before = ws.deepTime ? JSON.stringify(ws.deepTime) : "(none)";
console.log("save:       " + path.basename(save));
console.log("campaign:   " + (ws.campName || "?") + "  |  turn " + ws.turn + "  |  blueprint: " + (ws.blueprintName || "(freeform)"));
console.log("ladder now: " + before);
if (doClear) {
  console.log("action:     CLEAR the ladder (campaign returns to no age ceiling)");
} else {
  console.log("action:     SET " + ladder.length + " rung(s), ceiling = " + ladder[0].name);
  ladder.forEach(function (r, i) {
    console.log("  " + (i + 1) + ". " + r.name + (r.when ? " — " + r.when : "") + (r.note ? " (" + r.note + ")" : "") + (i === 0 ? "   [CEILING]" : ""));
  });
  ws.deepTime = ladder;
  global.worldState = ws;
  console.log("\n--- the block this produces, verbatim ---\n" + buildDeepTimeBlock());
}
if (doClear) delete ws.deepTime;

console.log("NOTE: this is ONE deliberate prompt-cache invalidation. The next turn after loading");
console.log("      pays full input price once, then the new stable half caches as normal.");

if (!doWrite) { console.log("\nDRY RUN — nothing written. Re-run with --write to produce the file."); process.exit(0); }
var out = save.replace(/\.tnd$/i, "") + "_LADDERED.tnd";
fs.writeFileSync(out, JSON.stringify(blob));
console.log("\nwrote " + out + "  (import it over the campaign; the original file is untouched)");
