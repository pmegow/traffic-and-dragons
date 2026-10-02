// Probe 8: #533 on the owner's saves — retrieval, name suggestions, variant scan, button filter, prompt. Per tree; diff the outputs.
// usage: ER=<tree> node p8_533saves.js > out.txt
require("./h.js");
var fs = require("fs"), path = require("path"), crypto = require("crypto");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
function sha(s) { return crypto.createHash("sha256").update(String(s), "utf8").digest("hex").slice(0, 12); }
function safe(fn) { try { return fn(); } catch (e) { return "THROW " + e.message; } }
var seedv = 1; Math.random = function () { seedv = (seedv * 1103515245 + 12345) & 0x7fffffff; return seedv / 0x7fffffff; };
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; }).slice(0, 2);
  files.forEach(function (ff) {
    var save = JSON.parse(fs.readFileSync(path.join(sd, ff.f), "utf8")); if (!save.worldState || !save.worldState.character) return;
    seedv = 1;
    var q = quiet(function () {
      worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); sessionLog = save.sessionLog || [];
      var names = Object.keys(memory.npcs || {}), acts = ["I look around.", "What happened to the stolen letters and the bridge crossing?"];
      names.slice(0, 6).forEach(function (n) { acts.push("I ask " + n + " about the debts we paid and the storm before the crossing."); });
      var o = { names: names.length };
      o.core = sha(JSON.stringify(names.map(function (n) { return npcCoreTokens(n); })));
      o.says = sha(JSON.stringify(names.map(function (n) { return npcNameSays(n); })));
      o.pairs = sha(JSON.stringify(npcVariantPairs(names)));
      o.sug = sha(JSON.stringify(getNameSuggestions(10, true)));
      o.alt = sha(JSON.stringify(names.map(function (n) { return suggestionNameAlt(n); })));
      o.w2 = sha(JSON.stringify(names.map(function (n) { return w2SelfNamingCanon(n.split(" ")[0]); })));
      o.fe = sha(JSON.stringify((memory.futureEvents || []).map(function (e) { return feTokens(e && e.what); })));
      o.acts = acts.map(function (a) {
        return [sha(JSON.stringify(ragQueryTerms(a))), sha(JSON.stringify(ragQueryBigrams(a))), sha(JSON.stringify(ragQueryEntities(a))),
          safe(function () { return sha(typeof ragRetrieve === "function" ? ragRetrieve(a) : ""); }), safe(function () { return sha(typeof ragCarriedRetrieve === "function" ? ragCarriedRetrieve(a) : ""); }),
          safe(function () { return sha(typeof ragChapterRetrieve === "function" ? ragChapterRetrieve(a) : ""); })].join(",");
      });
      o.tr = sha(JSON.stringify((worldState.transcript || []).slice(-40).map(function (e) { return e && e.r === "gm" ? ragEntitiesFromRaw(e.x) : null; })));
      lastAction = acts[acts.length - 1];
      var sys = safe(function () { return buildSysPrompt(); });
      o.sys = typeof sys === "string" ? sys : sha(sys.stable) + "/" + sha(sys.volatile);
      return o;
    });
    console.log(ff.f + " " + JSON.stringify(q.r));
  });
});
