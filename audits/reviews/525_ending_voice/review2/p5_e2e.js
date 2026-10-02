// Probe 5: campaignDenouement / fileDenouement / stampCampaignFates end to end through the real functions, stubbed provider.
var ROOT = process.env.ENGINE_ROOT || "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev3";
var engine = require(ROOT + "/dev/load-engine.js");
var _w = console.warn, _i = console.info, _d = console.debug;
console.warn = function () {}; console.info = function () {}; console.debug = function () {};
engine.loadEngine("game.js");
var shown = [], calls = [], toasts = [], warns = [], saves = 0, modals = 0;
addMsg = function (kind, html, opts) { shown.push({ kind: kind, html: String(html), opts: opts || {} }); return { remove: function () {} }; };
showToast = function (m) { toasts.push(String(m)); }; syncUI = function () {}; saveAll = function () { saves++; }; saveCore = function () { return true; }; saveMem = function () { return true; };
showCampaignEndedModal = function () { modals++; };
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };

function seed(opts) {
  opts = opts || {};
  worldState = engine.makeTestWorld(); memory = blankMemory(); sessionLog = []; shown = []; calls = []; toasts = []; warns = []; saves = 0; modals = 0;
  var c = worldState.character; c.name = ("hero" in opts) ? opts.hero : "Ammut"; c.coreMemories = []; worldState.turn = 89; worldState.transcript = [];
  worldState.campName = "The Long Walk";
  worldState.ended = { turn: 89, cause: "the tale is told", at: 1, spine: true }; worldState.denouementOwed = true; busy = false;
  (opts.comps || []).forEach(function (cp) { var cs = { name: cp.name, inventory: [], coreMemories: [] }; worldState.npcs.push({ name: cp.name, status: cp.dead ? "dead" : "ally", rel: "companion", partyMember: cp.party !== false, charSheet: cp.noSheet ? undefined : cs, dead: cp.dead ? 80 : undefined }); });
  if (opts.kind) worldState.kind = opts.kind;
  if (opts.pre) opts.pre();
}
function report(label) {
  var f = shown.filter(function (m) { return m.kind === "narrator"; });
  var out = { shownCount: f.length, html: f.map(function (m) { return m.html; }), replay: f.map(function (m) { return m.opts.replayText; }),
    transcript: (worldState.transcript || []).map(function (e) { return e.x || e.text || JSON.stringify(e); }),
    chapters: (memory.chapters || []).map(function (c) { return c.summary; }),
    heroMoments: (worldState.character.coreMemories || []).map(function (m) { return m.kind + "|" + m.who + "|" + m.text; }),
    heroFate: worldState.character.fate,
    comps: worldState.npcs.filter(function (n) { return n.charSheet; }).map(function (n) { return { name: n.name, moments: (n.charSheet.coreMemories || []).map(function (m) { return m.kind + "|" + m.who + "|" + m.text; }), fate: n.charSheet.fate }; }),
    owed: worldState.denouementOwed, busy: busy, toasts: toasts, warns: warns, saves: saves, modals: modals, ended: worldState.ended && worldState.ended.cause };
  console.log("\n=== " + label + "\n" + JSON.stringify(out, null, 1));
  return out;
}
async function runCase(label, reply, opts) {
  seed(opts);
  callGM = function (msg, sys) { calls.push({ msg: String(msg), sys: String(sys) }); return (reply instanceof Error) ? Promise.reject(reply) : Promise.resolve(reply); };
  await campaignDenouement();
  return report(label);
}
module.exports = { seed: seed, report: report, runCase: runCase, engine: engine };
if (require.main === module) (async function () {
  var P = "You walk out of the palace and the rain feels like a joke at your expense. Morwen walks beside you, saying nothing. Daeris laughed once, at the gate.\n\nYou learned to stay.";
  var comps = [{ name: "Morwen" }, { name: "Daeris" }, { name: "Old Tam", dead: true }, { name: "Benched Bob", party: false }];
  await runCase("A record present", P + "\nRECORD: Ammut learned to stay when leaving was easier.", { comps: comps });
  await runCase("B record absent", P, { comps: comps });
  await runCase("C only RECORD line", "RECORD: Ammut learned to stay.", { comps: comps });
  await runCase("D call rejects", new Error("Network: down"), { comps: comps });
  await runCase("E hero with no name (empty)", P + "\nRECORD: The hero learned to stay.", { comps: comps, hero: "" });
  await runCase("E2 hero name undefined, no record", P, { comps: comps, hero: undefined });
  await runCase("F no companions", P + "\nRECORD: Ammut learned to stay.", {});
  await runCase("G village kind", P + "\nRECORD: Silas learned to stay.", { comps: comps, kind: "village" });
  await runCase("H RECORD then THE END", P + "\nRECORD: Ammut learned to stay.\n\nTHE END", { comps: comps });
  await runCase("I label alone + two lines", P + "\n\nRECORD:\nAmmut learned to stay.\nHe never left again.", { comps: comps });
  await runCase("J empty reply", "", { comps: comps });
  await runCase("K whitespace reply", "  \n\n ", { comps: comps });
  await runCase("L null reply", null, { comps: comps });
  await runCase("M Arabic prose", "\u0643\u0627\u0646 \u064a\u0627 \u0645\u0627 \u0643\u0627\u0646.\n\u062e\u0631\u062c\u062a \u0645\u0646 \u0627\u0644\u0648\u0627\u062f\u064a.\n\nRECORD: Ammut learned to stay.", { comps: comps });
  await runCase("N closing paragraph 'The record \u2014' + RECORD", "You walk out.\n\nThe record \u2014 such as it is \u2014 will say you learned to stay.\n\nRECORD: Ammut learned to stay.", { comps: comps });
  await runCase("O numbered RECORD", P + "\n\n1. RECORD: Ammut learned to stay.", { comps: comps });
  await runCase("P record with closing quote", P + "\n\nRECORD: Ammut never learned to say \"enough.\"", { comps: comps });
  await runCase("Q object reply", { text: "x" }, { comps: comps });
  console.warn = _w;
})().catch(function (e) { console.warn = _w; console.error("threw: " + (e && e.stack || e)); process.exit(1); });
