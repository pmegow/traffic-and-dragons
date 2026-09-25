// tests-459-register-gate.js — #459 (owner field report 2026-09-25, the Village hearth: Daeris's record read aloud word
// for word in accountant's language). The ASYNC halves the engine runner cannot drive:
//   ① generateSkeleton over a scripted callGM — the deterministic gate leads the review, a corrected skeleton is
//      re-scanned, a still-dirty one is regenerated ONCE, a second failure throws (loud toast at Begin, freeform play);
//   ③ recordRegisterGuard over a scripted rewrite call — a clean rewrite replaces the knowledge/lore line, a dirty or
//      absent one DROPS it (a record is never filed in the banned register), the census counts both;
//   ⑤ the register-scrub CLI — list mode never writes; --from + --apply writes exactly the given rewrites and keeps a .bak.
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-459-register-gate.js
var fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();
loader.makeTestWorld({ kind: "adventure" });
global.showToast = function () {}; global.saveCore = function () {}; global.saveAll = function () {};

var DIRTY = { premise: "A vault consumes Daeris's body to repay an ancient soul-tax.", acts: [
  { title: "One", goal: "Halt the spread at the threshold vault.", turningPoint: "The counter-sigil shatters.", parallel: false, arcs: [{ title: "Maw", objective: "Cross the threshold.", type: "exploration" }] },
  { title: "Two", goal: "Dismantle the three tithe-engines anchoring the vault's lien on Daeris.", turningPoint: "The third engine falls.", parallel: false, arcs: [{ title: "Foundry", objective: "Sabotage the bellows.", type: "mystery" }] },
  { title: "Three", goal: "Confront the Tomb-Architect.", turningPoint: "The master engine is shattered.", parallel: false, arcs: [{ title: "Core", objective: "Destroy the Tomb-Architect.", type: "climax" }] }] };
var CLEAN = JSON.parse(JSON.stringify(DIRTY)); CLEAN.premise = "A vault eats Daeris from the feet up; the engines below must break."; CLEAN.acts[1].goal = "Break the three engines below that hold the curse on Daeris.";

function script(responses) {
  var calls = [];
  global.callGM = async function (msg, sys) {
    calls.push({ msg: String(msg), sys: String(sys || "") });
    if (!responses.length) throw new Error("scripted callGM ran dry after " + calls.length + " calls");
    var r = responses.shift(); return typeof r === "function" ? r(msg) : r;
  };
  return calls;
}
var REVIEW_CLEAN = JSON.stringify({ findings: [] });

var failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("PASS #459 " + name); }
  catch (e) { failed++; console.error("FAIL #459 " + name + " — " + (e && e.stack || e)); }
}

(async function () {
  await test("① a dirty first draft: the gate's HIGH findings lead the correction prompt; a clean correction lands with no regeneration", async function () {
    var calls = script([JSON.stringify(DIRTY), REVIEW_CLEAN, JSON.stringify(CLEAN)]);
    await generateSkeleton(function () {});
    assert.equal(calls.length, 3, "draft, review, correction — nothing more");
    assert.ok(/\[HIGH\] premise/.test(calls[2].msg) && /soul-tax/.test(calls[2].msg), "the correction prompt must carry the gate's premise finding: " + calls[2].msg.slice(0, 400));
    assert.ok(/\[HIGH\] act 2 goal/.test(calls[2].msg) && /tithe, lien/.test(calls[2].msg), "and the act-2 finding naming both words");
    assert.equal(worldState.skeleton.acts[1].goal, CLEAN.acts[1].goal, "the clean correction is the skeleton on file");
  });
  await test("① a correction that keeps the register: ONE regeneration; a clean second draft with no findings lands without a correction call", async function () {
    var calls = script([JSON.stringify(DIRTY), REVIEW_CLEAN, JSON.stringify(DIRTY), JSON.stringify(CLEAN), REVIEW_CLEAN]);
    var seen = []; await generateSkeleton(function (t) { seen.push(t); });
    assert.equal(calls.length, 5, "draft, review, correction, REDRAFT, review");
    assert.ok(seen.some(function (t) { return /accountant/i.test(t); }), "the status line says why it is generating again: " + JSON.stringify(seen));
    assert.equal(worldState.skeleton.premise, CLEAN.premise);
  });
  await test("① two dirty rounds: the refusal throws with the words named, outside the review's catch (Begin toasts it and plays freeform), and no dirty skeleton is left on file", async function () {
    delete worldState.skeleton;
    var calls = script([JSON.stringify(DIRTY), REVIEW_CLEAN, JSON.stringify(DIRTY), JSON.stringify(DIRTY), REVIEW_CLEAN, JSON.stringify(DIRTY)]);
    var err = null; try { await generateSkeleton(function () {}); } catch (e) { err = e; }
    assert.ok(err, "must throw");
    assert.ok(/accountant/i.test(err.message) && /soul-tax/.test(err.message) && /lien/.test(err.message), "the error names the register: " + err.message);
    assert.equal(calls.length, 6);
    assert.equal(worldState.skeleton, undefined, "a refused skeleton never lands");
  });
  await test("③ recordRegisterGuard: a clean rewrite replaces the knowledge line, a still-dirty rewrite DROPS the lore line, clean lines are untouched, the census counts both, the console names each", async function () {
    delete worldState.registerCensus;
    var extracted = { chapterSummary: "Plain.", npcUpdates: [
      { name: "Daeris", knowledgeGained: { fact: "Her soul-tax lien to the Reach's engines is extinguished for good.", kind: "durable" } },
      { name: "Bram", knowledgeGained: "He keeps bees behind the mill." }],
      loreDiscovered: ["The vault runs on tithe-engines.", "The mill wheel turns at dawn."] };
    var asked = [], warns = [], _w = console.warn; console.warn = function (x) { warns.push(String(x)); };
    var r;
    try {
      r = await recordRegisterGuard(extracted, 40, async function (msg) {
        asked.push(msg);
        if (/soul-tax/.test(msg)) return "The Reach's engines have no hold on her any more; that curse is done.";
        return "The vault still runs on its tithe.";
      });
    } finally { console.warn = _w; }
    assert.equal(asked.length, 2, "one re-ask per dirty line");
    assert.equal(extracted.npcUpdates[0].knowledgeGained.fact, "The Reach's engines have no hold on her any more; that curse is done.", "the clean rewrite replaces the fact in place (the {fact,kind} shape kept)");
    assert.equal(extracted.npcUpdates[0].knowledgeGained.kind, "durable");
    assert.equal(extracted.npcUpdates[1].knowledgeGained, "He keeps bees behind the mill.", "a clean line is never touched");
    assert.deepEqual(extracted.loreDiscovered, ["The mill wheel turns at dawn."], "the dirty lore line is DROPPED, the clean one kept");
    assert.deepEqual(r, { hits: 2, reasked: 2, cleaned: 1, dropped: 1 });
    var c = worldState.registerCensus.record; assert.equal(c.length, 3, "one census entry per word: soul-tax, lien, tithe");
    assert.ok(c.some(function (e) { return e.word === "tithe" && e.dropped === true; }) && c.some(function (e) { return e.word === "lien" && e.cleaned === true; }), JSON.stringify(c));
    assert.ok(warns.some(function (w) { return /dropped/.test(w) && /tithe/.test(w); }), "the drop is loud: " + JSON.stringify(warns));
    var stats = registerCensusStats(); assert.equal(stats.record, 3); assert.equal(stats.recordDropped, 1);
  });
  await test("③ a failed rewrite call drops the line (loud) rather than filing the register; a knowledge line in the legacy string shape is handled", async function () {
    var extracted = { npcUpdates: [{ name: "Daeris", knowledgeGained: "Paid the tithe to the creditor." }], loreDiscovered: [] };
    var warns = [], _w = console.warn; console.warn = function (x) { warns.push(String(x)); };
    var r; try { r = await recordRegisterGuard(extracted, 41, async function () { throw new Error("provider down"); }); } finally { console.warn = _w; }
    assert.equal(extracted.npcUpdates[0].knowledgeGained, undefined, "the fact is gone from the update");
    assert.deepEqual(r, { hits: 1, reasked: 0, cleaned: 0, dropped: 1 });
    assert.ok(warns.some(function (w) { return /provider down/.test(w); }), JSON.stringify(warns));
  });
  await test("③ nothing to do: a clean extraction is returned untouched with zero calls", async function () {
    var extracted = { npcUpdates: [{ name: "Bram", knowledgeGained: "He keeps bees." }], loreDiscovered: ["Dawn."] };
    var r = await recordRegisterGuard(extracted, 42, async function () { throw new Error("must not be called"); });
    assert.deepEqual(r, { hits: 0, reasked: 0, cleaned: 0, dropped: 0 });
    assert.deepEqual(extracted.loreDiscovered, ["Dawn."]);
  });
  await test("⑤ list walks every record family — knowledge, events, attitude, lore, decisions, chapters, core memories (hero and party), motivationHistory, quests, skeleton — with path + words + text; clean lines are not listed; apply writes only rewrites that resolve", async function () {
    var scrub = require("./register-scrub.js");
    var SKEL = { premise: "A vault consumes Daeris to repay an ancient soul-tax.", acts: [{ title: "The Foundations", goal: "Dismantle the tithe-engines anchoring the vault's lien.", turningPoint: "The third engine falls.", arcs: [{ title: "The Ledger's End", objective: "Shatter the keystone." }] }] };
    var data = { worldState: { character: { name: "Ammut", coreMemories: [{ text: "Daeris let Ammut hold her, the ledger in her head finally going quiet.", turn: 1 }] }, npcs: [{ name: "Daeris", charSheet: { name: "Daeris", motivationHistory: [{ text: "Find the original creditor.", how: "Her soul-tax lien is extinguished", turn: 49 }], coreMemories: [{ text: "Plain.", turn: 1 }] } }], quests: [{ title: "The Ledger's End", desc: "Break the lien.", objectives: [{ text: "Find the creditor-priests", done: false }] }], skeleton: SKEL }, memory: { npcs: { Daeris: { knowledge: ["Her soul-tax lien is extinguished for good.", "She likes pears."], events: [{ turn: 3, note: "filed the invoice of her grief" }], attitude: "warm" }, "Nyla Lorrath": { knowledge: ["Paid the tithe."], events: [] } }, lore: ["The vault runs on soul-tax liens."], keyDecisions: [{ turn: 2, desc: "Paid the tithe." }], chapters: [{ turn: 9, summary: "They broke the ledger." }] } };
    var rows = scrub.list(data), paths = rows.map(function (r) { return r.path; });
    var need = ["worldState.character.coreMemories[0].text", "worldState.npcs[0].charSheet.motivationHistory[0].how", "worldState.npcs[0].charSheet.motivationHistory[0].text", "worldState.quests[0].title", "worldState.quests[0].desc", "worldState.quests[0].objectives[0].text", "worldState.skeleton.premise", "worldState.skeleton.acts[0].goal", "worldState.skeleton.acts[0].arcs[0].title", "memory.npcs.Daeris.knowledge[0]", "memory.npcs.Daeris.events[0].note", 'memory.npcs["Nyla Lorrath"].knowledge[0]', "memory.lore[0]", "memory.keyDecisions[0].desc", "memory.chapters[0].summary"];
    need.forEach(function (p) { assert.ok(paths.indexOf(p) >= 0, "not listed: " + p + " — " + JSON.stringify(paths)); });
    assert.ok(paths.indexOf("memory.npcs.Daeris.knowledge[1]") < 0 && paths.indexOf("worldState.npcs[0].charSheet.coreMemories[0].text") < 0 && paths.indexOf("memory.npcs.Daeris.attitude") < 0, "clean lines must not be listed");
    var r0 = rows.filter(function (r) { return r.path === "memory.npcs.Daeris.knowledge[0]"; })[0];
    assert.deepEqual(r0.words, ["soul-tax", "lien"]); assert.ok(r0.text.indexOf("soul-tax") >= 0);
    var n = scrub.apply(data, [{ path: "memory.npcs.Daeris.knowledge[0]", text: "That curse is over for good." }, { path: 'memory.npcs["Nyla Lorrath"].knowledge[0]', text: "Gave what the temple asked." }, { path: "nowhere[9].x", text: "ignored" }, { path: "memory.npcs.Daeris.knowledge[7]", text: "no such slot" }]);
    assert.equal(n, 2, "only rewrites that resolve to an existing string are applied");
    assert.equal(data.memory.npcs.Daeris.knowledge[0], "That curse is over for good."); assert.equal(data.memory.npcs["Nyla Lorrath"].knowledge[0], "Gave what the temple asked."); assert.equal(data.memory.lore[0], "The vault runs on soul-tax liens.");
    assert.ok(/reply with the rewritten line only/i.test(scrub.rewritePrompt(r0)) && scrub.rewritePrompt(r0).indexOf(r0.text) >= 0 && /'soul-tax'/.test(scrub.rewritePrompt(r0)), "the rewrite prompt carries the line, names the words and asks for the line alone");
    var ch = { type: "character", ver: 10, character: { name: "Daeris", coreMemories: [{ text: "The ledger went quiet.", turn: 1 }], motivationHistory: [] } };
    assert.deepEqual(scrub.list(ch).map(function (r) { return r.path; }), ["character.coreMemories[0].text"], "a .char file scans its one sheet");
  });
  await test("⑤ the CLI: list mode prints every path and never writes; --from + --apply writes exactly the rewrites, keeps a .bak, and reports the count", async function () {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-scrub-")), save = path.join(dir, "fixture_t9.tnd"), from = path.join(dir, "rewrites.json");
    var data = { worldState: { character: { name: "Ammut", coreMemories: [{ text: "The ledger in her head went quiet.", turn: 1 }] }, npcs: [], quests: [], skeleton: null }, memory: { npcs: { Daeris: { knowledge: ["Her soul-tax lien is extinguished.", "She likes pears."], events: [] } }, lore: [], keyDecisions: [], chapters: [] } };
    fs.writeFileSync(save, JSON.stringify(data));
    var before = fs.readFileSync(save, "utf8");
    var r1 = cp.spawnSync(process.execPath, ["dev/register-scrub.js", save], { cwd: ROOT, encoding: "utf8", env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "" }) });
    assert.equal(r1.status, 0, "list mode exits 0: " + r1.stderr);
    assert.ok(/memory\.npcs\.Daeris\.knowledge\[0\]/.test(r1.stdout) && /worldState\.character\.coreMemories\[0\]\.text/.test(r1.stdout), "paths listed: " + r1.stdout);
    assert.ok(/2 record line/.test(r1.stdout), "the count: " + r1.stdout);
    assert.equal(fs.readFileSync(save, "utf8"), before, "list mode never writes");
    fs.writeFileSync(from, JSON.stringify([{ path: "memory.npcs.Daeris.knowledge[0]", text: "That curse is over." }]));
    var r2 = cp.spawnSync(process.execPath, ["dev/register-scrub.js", save, "--from", from], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r2.status, 0, r2.stderr); assert.equal(fs.readFileSync(save, "utf8"), before, "--from without --apply prints the before/after and never writes");
    assert.ok(/That curse is over\./.test(r2.stdout), "the after is printed: " + r2.stdout);
    var r3 = cp.spawnSync(process.execPath, ["dev/register-scrub.js", save, "--from", from, "--apply"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r3.status, 0, r3.stderr);
    var after = JSON.parse(fs.readFileSync(save, "utf8"));
    assert.equal(after.memory.npcs.Daeris.knowledge[0], "That curse is over."); assert.equal(after.memory.npcs.Daeris.knowledge[1], "She likes pears.");
    assert.equal(after.worldState.character.coreMemories[0].text, "The ledger in her head went quiet.", "a line with no rewrite is left as it was");
    assert.equal(fs.readFileSync(save + ".bak", "utf8"), before, "the .bak is the byte-identical original");
    assert.ok(/applied 1/.test(r3.stdout), r3.stdout);
  });
  console.log((failed ? "FAILED" : "ALL GREEN") + " — " + passed + " #459 register-gate groups");
  process.exitCode = failed ? 1 : 0;
})().catch(function (e) { console.error(e); process.exitCode = 1; });
