// READ-ONLY census: every GM reply in the playtest corpora and the owner's saves that carries [SCENE_CAST:none] (case-insensitive,
// none-only), with where the cast sits relative to the reply's [SAY:] tags and other presence tags.
var fs = require("fs"), path = require("path");
var WT = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev3";
var files = [];
fs.readdirSync(WT + "/dev").forEach(function (f) { if (/^corpus_playtest.*\.json$/.test(f) && !/endstate/.test(f)) files.push(path.join(WT, "dev", f)); });
var CR = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(CR).forEach(function (c) { var sd = path.join(CR, c, "saves"); if (!fs.existsSync(sd)) return; fs.readdirSync(sd).forEach(function (f) { if (/\.tnd$/.test(f)) files.push(path.join(sd, f)); }); });
var seen = {}, rows = [], casts = 0, noneCasts = 0, variants = {};
function walk(v, file) {
  if (typeof v === "string") {
    if (v.indexOf("[SCENE_CAST:") < 0) return;
    var key = v.length + "|" + v.slice(0, 80); if (seen[key]) return; seen[key] = 1;
    var re = /\[SCENE_CAST:([^\]]*)\]/g, m, named = false, none = [], all = [];
    while ((m = re.exec(v))) { casts++; var p = m[1].trim(); all.push(p); if (/^none$/i.test(p)) { noneCasts++; none.push(m.index); } else if (p) { named = true; if (/none|nobody|no one|empty|alone/i.test(p)) variants[p] = (variants[p] || 0) + 1; } }
    if (!none.length || named) return;
    var says = [], sre = /\[SAY:([^\]|]+)/g; while ((m = sre.exec(v))) says.push({ at: m.index, who: m[1].trim() });
    var combat = /\[(?:COMBAT_START|ENEMY_HP|ENEMY_SLAIN|ENEMY_SURRENDERS):/.test(v);
    var loc = /\[(?:LOCATION|SUBLOCATION|SUBLOCATION_LEAVE):/.test(v);
    rows.push({ file: path.basename(file).slice(0, 46), len: v.length, castAt: none[0], castPct: Math.round(100 * none[0] / v.length), says: says, combat: combat, loc: loc, text: v });
  } else if (v && typeof v === "object") { if (Array.isArray(v)) v.forEach(function (x) { walk(x, file); }); else Object.keys(v).forEach(function (k) { walk(v[k], file); }); }
}
files.forEach(function (f) { try { walk(JSON.parse(fs.readFileSync(f, "utf8")), f); } catch (e) { console.log("skip " + f + ": " + e.message); } });
console.log("files " + files.length + " | distinct strings with a cast: " + Object.keys(seen).length + " | casts " + casts + " | none casts " + noneCasts + " | none-only replies " + rows.length);
console.log("named casts that look like a none written another way: " + JSON.stringify(variants));
var withSay = rows.filter(function (r) { return r.says.length; });
console.log("none-only replies with speech: " + withSay.length + " | with combat tags: " + rows.filter(function (r) { return r.combat; }).length + " | with a place change: " + rows.filter(function (r) { return r.loc; }).length);
withSay.forEach(function (r) {
  var after = r.says.filter(function (s) { return s.at > r.castAt; }).length, before = r.says.length - after;
  console.log("  " + r.file + " len " + r.len + " cast at " + r.castPct + "% | speakers before the cast: " + before + ", after: " + after + " | " + r.says.map(function (s) { return s.who; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", "));
  if (before) console.log("     >>> speech BEFORE the none cast: ..." + JSON.stringify(r.text.slice(Math.max(0, r.castAt - 260), r.castAt + 40)));
});
console.log("where the none cast sits (percent of reply length), all none-only replies: " + rows.map(function (r) { return r.castPct; }).sort(function (a, b) { return a - b; }).join(","));
