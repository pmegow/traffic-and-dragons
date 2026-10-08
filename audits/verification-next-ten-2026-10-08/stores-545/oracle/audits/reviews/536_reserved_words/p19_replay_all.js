// REVIEW PROBE p19: replay EVERY raw GM reply of every corpus (the tree's own dev/corpus_*.json and the main repo's) through
// the real applyMuts, in one tree, and print one fingerprint per corpus: per-turn summary lines + the end state. Run it on both
// trees and compare the two outputs: on real text the two engines must do exactly the same thing. argv: <tree>
var L = require("./lib.js"), fs = require("fs"), path = require("path"), crypto = require("crypto");
var TREE = process.argv[2], MAIN = "C:/Projects/traffic-and-dragons";
function sha(s) { return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16); }
var files = {}, add = function (dir) { try { fs.readdirSync(dir).forEach(function (f) { if (/^corpus_.*\.json$/.test(f) && !/endstate/.test(f) && !files[f]) files[f] = path.join(dir, f); }); } catch (e) { } };
add(TREE + "/dev"); add(MAIN + "/dev");
var total = 0, refusedLines = 0, errs = 0;
Object.keys(files).sort().forEach(function (name) {
  var j; try { j = JSON.parse(fs.readFileSync(files[name], "utf8")); } catch (e) { console.log(name + " unreadable"); return; }
  var raws = (j.raw || []).map(function (r) { return { turn: r.turn, raw: r.raw }; });
  if (!raws.length && Array.isArray(j.transcript)) raws = j.transcript.filter(function (e) { return e.r === "gm"; }).map(function (e) { return { turn: e.t, raw: e.x }; });
  if (!raws.length) { console.log(name + " : no raw replies"); return; }
  L.world("plain"); L.seed(42); worldState.turn = 0;
  var lines = [], i;
  for (i = 0; i < raws.length; i++) {
    worldState.turn = raws[i].turn || (i + 1);
    var r; try { r = run(String(raws[i].raw || "")); } catch (e2) { r = { muts: ["THREW " + e2.message], r: { errors: [] } }; errs++; }
    if (r.r && r.r.errors && r.r.errors.length) errs += r.r.errors.length;
    r.muts.forEach(function (m) { if (/reserved word/.test(m)) refusedLines++; });
    lines.push(worldState.turn + ": " + r.muts.join(" | ") + ((r.r && r.r.errors && r.r.errors.length) ? " !! " + r.r.errors.join("; ") : ""));
    total++;
  }
  var p = L.poison(), state = ""; try { state = JSON.stringify({ ws: worldState, mem: memory }); } catch (e3) { state = "serialise threw " + e3.message; }
  L.unseed();
  console.log(name + " : " + raws.length + " replies | summary lines " + sha(lines.join("\n")) + " | end state " + sha(state) + " (" + state.length + " chars)" + (p.length ? " | wrote on built-ins: " + p.join(", ") : ""));
});
console.log("TOTAL " + total + " replies replayed | lines saying 'reserved word': " + refusedLines + " | handler errors or throws: " + errs);
