// Seeded op-sequence fuzz over the REAL engine (mulberry32). Two uses:
//   node p11_fuzz.js <before|after> diff  <mode> <seeds>   -> one JSON line per seed (final state), for a BEFORE/AFTER diff
//   node p11_fuzz.js after          model <mode> <seeds>   -> AFTER checked op by op against a reference model of the two contract lines
// modes: slots (no merges, slot fields only) | settings (no merges, + direction/speed) | merge (everything)
require("./h.js"); require("./ui.js");
var KIND = process.argv[3] || "diff", MODE = process.argv[4] || "merge", SEEDS = parseInt(process.argv[5] || "200", 10);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var SLOTS = ["speechifyVoiceId", "inworldVoiceId", "voiceId"], SETTINGS = ["voiceDirection", "voiceRate"], FIELDS = SETTINGS.concat(SLOTS);
var STARS = TTS.starsList().map(function (s) { return s.id; });
var POOL = ["Aldern Foxglove", "the hooded man", "Mira Vance", "Captain Orlo", "Brother Tam"], FRESH = ["Lord Vess", "Yselle Marr", "Dunmore Hask"];
var realRandom = Math.random;
function P(o) { var r = {}, i; if (!o) return null; for (i = 0; i < FIELDS.length; i++) if (FIELDS[i] in o) r[FIELDS[i]] = o[FIELDS[i]]; return r; }
function dump() { var o = {}; worldState.npcs.forEach(function (n) { o[n.name] = { row: P(n), sheet: n.charSheet ? P(n.charSheet) : null, sheetName: n.charSheet ? n.charSheet.name : null, party: !!n.partyMember }; }); return o; }
function speech() { var o = {}; worldState.npcs.forEach(function (n) { o[n.name] = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: n.name } }, "\"Hold there.\""); }).r; }); return o; }
function val(rnd, f) { if (f === "voiceId") return STARS[Math.floor(rnd() * STARS.length)]; if (f === "voiceRate") return [0.8, 0.9, 1.0, 1.2, 1.3][Math.floor(rnd() * 5)]; return f + "~" + Math.floor(rnd() * 1000); }
function mkSheet(name, pron) { return { name: name, gender: pron === "she/her" ? "F" : "M", cls: "Rogue", level: 1, hp: 8, maxHp: 8, inventory: [], abilities: [], spells: [], relationships: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } }; }

async function runSeed(seed) {
  var rnd = mulberry32(seed), erand = mulberry32(seed ^ 0x5bd1e995);
  Math.random = erand;
  makeWorld(); worldState.npcs = []; memory.npcs = {}; resetEls(); global.busy = false;
  var model = {}, log = [], bad = [], fresh = 0, f;
  var n = 2 + Math.floor(rnd() * 3), names = POOL.slice(0, n);
  var fields = MODE === "slots" ? SLOTS : FIELDS;
  names.forEach(function (nm) {
    var pron = rnd() < 0.5 ? "he/him" : "she/her";
    memory.npcs[nm] = { attitude: "", knowledge: [], events: [], aliases: [], pronouns: pron };
    var r = { name: nm, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] };
    fields.forEach(function (f1) { if (rnd() < 0.3) r[f1] = val(rnd, f1); });
    if (rnd() < 0.35) { r.charSheet = mkSheet(nm, pron); fields.forEach(function (f1) { if (rnd() < 0.4) r.charSheet[f1] = val(rnd, f1); }); if ((MODE === "merge" || MODE === "merge1") && rnd() < 0.3) r.partyMember = true; }
    worldState.npcs.push(r);
  });
  function M() { var o = {}; worldState.npcs.forEach(function (x) { o[x.name] = { row: P(x), sheet: x.charSheet ? P(x.charSheet) : null, sheetName: x.charSheet ? x.charSheet.name : null }; }); return o; }
  model = M();
  function check(op) {
    if (KIND !== "model") return;
    var eng = M();
    var names2 = Object.keys(eng).concat(Object.keys(model)).filter(function (v, ix, arr) { return arr.indexOf(v) === ix; });
    names2.forEach(function (nm) {
      var e = eng[nm], m = model[nm];
      if (!e || !m) { bad.push(op + ": roster differs for " + nm + " (engine " + !!e + ", model " + !!m + ")"); return; }
      ["row", "sheet"].forEach(function (side) {
        if (!e[side] !== !m[side]) { bad.push(op + ": " + nm + " " + side + " presence differs"); return; }
        if (!e[side]) return;
        FIELDS.forEach(function (f2) {
          if (m[side][f2] === "*") { if (e[side][f2]) m[side][f2] = e[side][f2]; else delete m[side][f2]; return; }   // "*" = accept the engine's own auto pick
          if (e[side][f2] !== m[side][f2]) bad.push(op + ": " + nm + "." + side + "." + f2 + " engine=" + JSON.stringify(e[side][f2]) + " model=" + JSON.stringify(m[side][f2]));
        });
      });
    });
  }
  var steps = 4 + Math.floor(rnd() * 8), s;
  for (s = 0; s < steps; s++) {
    var live = worldState.npcs.map(function (x) { return x.name; }); if (!live.length) break;
    var nm = live[Math.floor(rnd() * live.length)], row = wsNpcByName(nm), owner = row.charSheet || row, mo = model[nm], mowner = mo.sheet || mo.row, roll = rnd(), op;
    if (roll < 0.2) {
      op = "speak " + nm;
      var sub = quiet(function () { return _speakerVoiceSubject(nm); }).r;
      quiet(function () { pinAutoCastVoices({ n: 1, s: { 0: nm } }); });
      if (sub && !mowner.voiceId) mowner.voiceId = "*";            // the auto-cast pick lands on the pin OWNER only
    } else if (roll < 0.4) {
      f = fields[Math.floor(rnd() * fields.length)]; var v = val(rnd, f); op = "card set " + nm + "." + f;
      owner[f] = v; mowner[f] = v;
    } else if (roll < 0.5) {
      f = fields[Math.floor(rnd() * fields.length)]; op = "card clear " + nm + "." + f;
      delete owner[f]; delete mowner[f];
    } else if (roll < 0.6) {
      op = "attach " + nm;
      if (!row.charSheet) {
        var st = buildCompanionSheetStub(nm);
        if (MODE !== "slots") { st.voiceDirection = "MODEL"; st.voiceRate = 1.25; }
        st.speechifyVoiceId = "MODEL";
        var before = JSON.parse(JSON.stringify(mo.row));
        quiet(function () { attachCompanionSheet(nm, st); });
        mo.sheet = {}; mo.sheetName = nm;
        FIELDS.forEach(function (f2) { if (before[f2]) mo.sheet[f2] = before[f2]; });
        mo.row = {};
      }
    } else if (roll < 0.72) {
      op = "regenerate " + nm;
      var model_json = { gender: row.pronouns === "she/her" ? "F" : "M", stats: {}, inworldVoiceId: "MODEL" };
      if (MODE !== "slots") { model_json.voiceDirection = "MODEL"; model_json.voiceRate = 1.25; }
      global.callGM = function () { return Promise.resolve(JSON.stringify(model_json)); };
      var prior = mo.sheet || {}, rw = mo.row, ns = {};
      await generateNpcSheet(nm);
      FIELDS.forEach(function (f2) { var pv = prior[f2] || rw[f2]; if (pv) ns[f2] = pv; else if (SLOTS.indexOf(f2) >= 0) ns[f2] = "*"; });
      mo.sheet = ns; mo.row = {}; mo.sheetName = nm;
    } else if (roll < 0.8) {
      op = "save/load";
      worldState = parseWorldState(serializeWorldState());
    } else if (MODE === "merge") {
      var useFresh = rnd() < 0.25 && fresh < FRESH.length, can = useFresh ? FRESH[fresh++] : live[Math.floor(rnd() * live.length)], dup = nm;
      var tag = rnd() < 0.5 ? "[NPC_MERGE:" + can + "|" + dup + "]" : "[MERGE:npc|" + can + "|" + dup + "]";
      op = "merge " + tag;
      run("It is the same person. " + tag);
      if (can !== dup) {
        var mc = model[can], md = model[dup];
        if (!mc) { mc = model[can] = { row: {}, sheet: null, sheetName: null }; }
        var transfer = !mc.sheet && !!md.sheet;
        if (transfer) { mc.sheet = md.sheet; mc.sheetName = md.sheetName; }
        var own = mc.sheet || mc.row, srcs = [transfer ? mc.row : null, md.sheet, md.row];
        FIELDS.forEach(function (f2) { if (own[f2]) return; var j; for (j = 0; j < srcs.length; j++) if (srcs[j] && srcs[j][f2]) { own[f2] = srcs[j][f2]; break; } });
        delete model[dup];
      }
    } else { op = "noop"; }
    log.push(op);
    check(op);
  }
  if (MODE === "merge1") {
    // exactly ONE merge, as the last op: both trees reach it from the same history, so the speech record right after it
    // compares what the merge itself did (no later auto-cast or random assignment can blur it)
    var live1 = worldState.npcs.map(function (x) { return x.name; });
    var dup1 = live1[Math.floor(rnd() * live1.length)], rest = live1.filter(function (x) { return x !== dup1; });
    var can1 = (rnd() < 0.25 || !rest.length) ? FRESH[0] : rest[Math.floor(rnd() * rest.length)];
    var tag1 = rnd() < 0.5 ? "[NPC_MERGE:" + can1 + "|" + dup1 + "]" : "[MERGE:npc|" + can1 + "|" + dup1 + "]";
    var pre = dump();
    run("It is the same person. " + tag1);
    log.push("FINAL merge " + tag1 + " | pre-merge canonical " + JSON.stringify(pre[can1] || null) + " duplicate " + JSON.stringify(pre[dup1]));
  }
  Math.random = realRandom;
  return { seed: seed, log: log, bad: bad, final: dump(), speech: speech() };
}
(async function () {
  var s, fails = 0;
  for (s = 1; s <= SEEDS; s++) {
    var r;
    try { r = await runSeed(s); } catch (e) { console.log(JSON.stringify({ seed: s, threw: String(e && e.stack || e).slice(0, 400) })); fails++; continue; }
    if (KIND === "diff") console.log(JSON.stringify({ seed: s, ops: r.log, final: r.final, speech: r.speech }));
    else if (r.bad.length) { fails++; console.log("[" + WHICH.toUpperCase() + "] seed " + s + " DIVERGED from the model:\n   ops: " + r.log.join(" ; ") + "\n   " + r.bad.slice(0, 6).join("\n   ")); }
  }
  if (KIND === "model") console.log("[" + WHICH.toUpperCase() + "] model check, mode=" + MODE + ": " + SEEDS + " seeds, " + fails + " diverged");
})();
