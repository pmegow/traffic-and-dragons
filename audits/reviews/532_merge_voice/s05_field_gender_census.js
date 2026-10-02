// READ-ONLY census (newest save per campaign): how often is a sheetless speaker pinned while its sex is unknown, and how often
// does a pinned Piper voice already disagree with the pronouns now on record? (Context for the gender finding: a pin made
// under "ANY" is permanent, and #532 now carries it across a merge.) Counts only.
//   node s05_field_gender_census.js
require("./h.js");
var fs = require("fs"), path = require("path");
var ROOTC = "C:/Projects/traffic-and-dragons/Campaigns";
var G = {}; TTS.starsList().forEach(function (s) { G[s.id] = s.g; });
function sexOf(p) { p = String(p || "").toLowerCase().replace(/\s+/g, ""); return /^she\//.test(p) ? "F" : (/^he\//.test(p) ? "M" : (/^they\//.test(p) ? "NB" : "")); }
var T = { campaigns: 0, sheetlessPinned: 0, noPronouns: 0, known: 0, match: 0, mismatch: 0, voiceNotOnDefaultBench: 0 }, ex = [];
fs.readdirSync(ROOTC).forEach(function (camp) {
  var dir = path.join(ROOTC, camp, "saves"); if (!fs.existsSync(dir)) return;
  var files = fs.readdirSync(dir).filter(function (f) { return /\.tnd$/.test(f); }).map(function (f) { return { f: f, t: fs.statSync(path.join(dir, f)).mtimeMs }; }).sort(function (a, b) { return b.t - a.t; });
  if (!files.length) return;
  var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, files[0].f), "utf8")); } catch (e) { return; }
  T.campaigns++;
  var mem = (j.memory && j.memory.npcs) || {};
  (j.worldState.npcs || []).forEach(function (n) {
    if (!n || n.charSheet || !n.voiceId) return;
    T.sheetlessPinned++;
    var s = sexOf(n.pronouns || (mem[n.name] && mem[n.name].pronouns));
    if (!s) { T.noPronouns++; return; }
    if (s !== "M" && s !== "F") return;
    var g = G[n.voiceId];
    if (!g) { T.voiceNotOnDefaultBench++; return; }
    T.known++;
    if (g === s) T.match++; else { T.mismatch++; if (ex.length < 6) ex.push(camp + ": a " + s + " character pinned to a " + g + " voice"); }
  });
});
console.log(JSON.stringify(T));
ex.forEach(function (e) { console.log("  " + e); });
