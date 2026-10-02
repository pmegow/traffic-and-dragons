// Probe 20 (read-only): buildDenouementPrompt on the latest owner saves — VOICE line resolution, and the hero's ending moments as the prompt lists them.
require("./h.js");
var fs = require("fs"), path = require("path"), ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8"));
  [false, true].forEach(function (mig) {
    var out = quiet(function () {
      worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); sessionLog = []; if (mig) migrateWorldState();
      proseAuthor = "dinniman";
      try { var p = buildDenouementPrompt(); var v = p.match(/^VOICE: .{0,40}/m); var e = p.split("\n").filter(function (l) { return /^- t\d+: /.test(l) && /(I spent nineteen|He was never the grand|stripped Silas)/.test(l); }); return (mig ? "loaded " : "raw    ") + files[0].f + " pinned=" + JSON.stringify(worldState.proseAuthor) + " -> " + (v ? v[0] : "(no VOICE line)") + (e.length ? " | hero's ending moment in the prompt: " + JSON.stringify(e[0].slice(0, 70)) : ""); } catch (x) { return "THREW " + x.message; }
    }).r;
    console.log(out);
  });
});
