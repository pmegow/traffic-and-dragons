// p13 — READ-ONLY: the transcript's speaker maps (entry.sp.s — the names the GM wrote in [SAY:]) are the one large field
// sample of how the GM NAMES people in tags. How often is a rostered person named by a short form that only the token
// consolidation resolves (surname-only / given-name-only)? Those are the forms that fork while a title question is open.
require("./base.js");
var fs = require("fs"), path = require("path"), CAMP = "C:/Projects/traffic-and-dragons/Campaigns";
function newest(dir) { var d = path.join(dir, "saves"); if (!fs.existsSync(d)) return null; var a = fs.readdirSync(d).filter(function (f) { return /\.tnd$/.test(f); }).map(function (f) { return { f: path.join(d, f), t: fs.statSync(path.join(d, f)).mtimeMs }; }).sort(function (x, y) { return y.t - x.t; }); return a.length ? a[0].f : null; }
var T = { lines: 0, exact: 0, alias: 0, sur: 0, giv: 0, other: 0, unres: 0 };
fs.readdirSync(CAMP).forEach(function (c) {
  var f = newest(path.join(CAMP, c)); if (!f) return; var save; try { save = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; }
  worldState = save.worldState; memory = save.memory; if (!memory || !memory.npcs || !Array.isArray(worldState.transcript)) { console.log(c + ": transcript not an array in this save (compressed?) — skipped"); return; }
  var hero = (worldState.character && worldState.character.name) || "", n = { lines: 0, exact: 0, alias: 0, sur: {}, giv: {}, other: {}, unres: 0 };
  worldState.transcript.forEach(function (e) {
    if (!e || !e.sp || !e.sp.s) return; var k;
    for (k in e.sp.s) { var nm = String(e.sp.s[k]).trim(); if (!nm || nm === hero) continue; n.lines++;
      if (memory.npcs[nm]) { n.exact++; continue; } if (npcAliasOwner(nm)) { n.alias++; continue; }
      var cn = quiet(function () { return npcConsolidation(nm); }).r; if (!cn.key) { n.unres++; continue; }
      var ic = npcCoreTokens(nm), kc = npcCoreTokens(cn.key), lab = nm + " -> " + cn.key;
      if (ic.length === 1 && kc.length >= 2 && kc[kc.length - 1] === ic[0]) n.sur[lab] = (n.sur[lab] || 0) + 1;
      else if (ic.length === 1 && kc.length >= 2 && kc[0] === ic[0]) n.giv[lab] = (n.giv[lab] || 0) + 1;
      else n.other[lab] = (n.other[lab] || 0) + 1; }
  });
  function sum(o) { return Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0); }
  T.lines += n.lines; T.exact += n.exact; T.alias += n.alias; T.sur += sum(n.sur); T.giv += sum(n.giv); T.other += sum(n.other); T.unres += n.unres;
  console.log("\n" + c + ": " + n.lines + " attributed lines — exact key " + n.exact + ", registered alias " + n.alias + ", not on file today " + n.unres);
  console.log("   SURNAME-only form (" + sum(n.sur) + "): " + JSON.stringify(n.sur).slice(0, 500));
  console.log("   GIVEN-name-only form (" + sum(n.giv) + "): " + JSON.stringify(n.giv).slice(0, 500));
  console.log("   other consolidated form (" + sum(n.other) + "): " + JSON.stringify(n.other).slice(0, 500));
});
console.log("\nTOTAL " + JSON.stringify(T));
