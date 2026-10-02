// Probe 11 (read-only): the owner's saves — heroes, party companions and residents; identifying words shared between two sheeted people;
// every ending moment and fate line; migrateWorldState x3 idempotency on the real data.
require("./h.js");
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8"));
  var q = quiet(function () {
    worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); sessionLog = save.sessionLog || [];
    var people = [{ n: worldState.character.name, role: "HERO", cs: worldState.character }];
    (worldState.npcs || []).forEach(function (n) { if (n && n.charSheet) people.push({ n: n.name, role: n.partyMember ? "party" : n.resident ? "resident" : "sheet", cs: n.charSheet }); });
    var out = [];
    out.push("##### " + camp + " / " + files[0].f + " kind=" + (worldState.kind || "adventure") + " turn=" + worldState.turn + " proseAuthor=" + JSON.stringify(worldState.proseAuthor));
    out.push("   people: " + people.map(function (p) { return p.role + ":" + p.n + " " + JSON.stringify(personNameWords(p.n)); }).join(" | "));
    var i, j;
    for (i = 0; i < people.length; i++) for (j = i + 1; j < people.length; j++) {
      var a = personNameWords(people[i].n), b = personNameWords(people[j].n), sh = a.filter(function (w) { return b.indexOf(w) >= 0; });
      if (sh.length) out.push("   SHARED WORD " + JSON.stringify(sh) + ": " + people[i].role + " " + people[i].n + " / " + people[j].role + " " + people[j].n);
    }
    people.forEach(function (p) {
      if (p.cs.fate) out.push("   fate[" + p.role + " " + p.n + "] camp=" + JSON.stringify(p.cs.fate.campaign) + " line=" + JSON.stringify(p.cs.fate.line));
      (Array.isArray(p.cs.coreMemories) ? p.cs.coreMemories : []).forEach(function (m) { if (m && m.kind === "ending") out.push("   ending on [" + p.role + " " + p.n + "] who=" + JSON.stringify(m.who) + " camp=" + JSON.stringify(m.camp) + " t" + m.turn + ": " + JSON.stringify(String(m.text).slice(0, 110))); });
    });
    function snap() { return JSON.stringify(people.map(function (p) { return (Array.isArray(p.cs.coreMemories) ? p.cs.coreMemories : []).map(function (m) { return m && m.text; }); })); }
    var s0 = snap(); migrateWorldState(); var s1 = snap();
    worldState = inflateWorldStateSnapshot(JSON.parse(JSON.stringify(serializeForProbe())));
    return out;
  });
  console.log(q.r.join("\n"));
});
function serializeForProbe() { return JSON.parse(serializeWorldState()); }
