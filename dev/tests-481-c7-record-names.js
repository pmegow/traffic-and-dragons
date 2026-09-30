// tests-481-c7-record-names.js — #481 C7 (audit 2026-09-29, owner ruling + Fable-approved changes): the record guard threw
// away core-plot lore whose NAMES carry register words. A HEAD replay of the Necrotic t35 save's own 36 lore lines with a
// rewrite that keeps names: {hits:12, reasked:6, cleaned:0, dropped:12} — among the dropped, the act-2 outcome itself.
// Ruled: exempt exact canonical names from the drop, keep the scan on free prose, and defer lines beyond the re-ask cap to
// the next window instead of dropping them. Fable: (a) ONE pure masking helper before registerScan, used by the record guard
// and the #372 chapter guard (and C9's narration scan); (b) the rewrite prompt LISTS the names to keep and says every other
// clerical word must go, hyphenated coinages included; (c) the deferral queue is bounded (cap, loud eviction), persisted on
// the save, re-guarded next summarize, and counted as its own census outcome. The ASYNC halves live here.
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-481-c7-record-names.js
var assert = require("assert"), loader = require("./load-engine.js");
loader.loadEngine();
global.showToast = function () {}; global.saveCore = function () {}; global.saveAll = function () {};

/* a legacy (pre-#459 gate) skeleton built on the register, as the Necrotic Dungeon's is */
function necroticWorld() {
  loader.makeTestWorld({ kind: "adventure" });
  worldState.skeleton = { premise: "A vault consumes Daeris's body to repay an ancient soul-tax.", acts: [
    { title: "Act 2: Tearing the Foundations", goal: "Dismantle the three subterranean tithe-engines anchoring the vault's lien on Daeris.", turningPoint: "The third engine falls.", parallel: false, status: "active",
      arcs: [{ title: "The Ledger's End", objective: "Burn the necrotic ledger.", type: "climax", status: "active" }] }] };
  worldState.npcs.push({ name: "Daeris", status: "ally", rel: "companion", partyMember: true, pronouns: "she/her", charSheet: { name: "Daeris", inventory: [], abilities: [{ name: "Ledger Memory" }] } });
  memory.npcs["Daeris"] = { attitude: "ally", knowledge: [], events: [], aliases: [] };
  delete worldState.registerCensus; delete worldState.recordDeferred;
}
function script(responses) {
  var calls = [];
  global.callGM = async function (msg) { calls.push(String(msg)); if (!responses.length) throw new Error("scripted callGM ran dry after " + calls.length + " calls"); var r = responses.shift(); return typeof r === "function" ? r(msg) : r; };
  return calls;
}
var ACT2 = "The three subterranean tithe-engines have been destroyed, releasing the soul-tax lien that bound Daeris.";

var failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("PASS #481 C7 " + name); }
  catch (e) { failed++; console.error("FAIL #481 C7 " + name + " — " + (e && e.stack || e)); }
}

(async function () {
  await test("the mask: exact canonical names, whole phrase, any case — the free prose around them is still scanned", async function () {
    necroticWorld();
    var names = recordCanonNames();
    ["tithe-engines", "soul-tax", "lien", "Daeris", "The Ledger's End", "Ledger Memory"].forEach(function (n) {
      assert.ok(names.some(function (x) { return x.toLowerCase() === n.toLowerCase(); }), "the canonical set must carry '" + n + "': " + JSON.stringify(names));
    });
    assert.deepStrictEqual(registerScanProse(ACT2, names), [], "the act-2 outcome carries only canonical names");
    assert.deepStrictEqual(registerScanProse("Daeris calls on LEDGER MEMORY, then files an invoice.", names), ["invoice"], "a name is masked in any case; the free word still counts");
    assert.deepStrictEqual(registerScanProse("the tithe-engine keepers", names), ["tithe"], "exact phrase only — a different coinage is free prose");
  });

  await test("the record guard files the act-2 outcome as written: no re-ask, no drop", async function () {
    necroticWorld(); var calls = script([]);
    var ex = { loreDiscovered: [ACT2], npcUpdates: [{ name: "Daeris", knowledgeGained: "Daeris knows the tithe-engines fed on her." }] };
    var out = await recordRegisterGuard(ex, 35);
    assert.equal(calls.length, 0, "nothing to re-ask: " + JSON.stringify(calls));
    assert.deepStrictEqual(ex.loreDiscovered, [ACT2], "the lore line files unchanged");
    assert.equal(ex.npcUpdates[0].knowledgeGained, "Daeris knows the tithe-engines fed on her.", "the knowledge line files unchanged");
    assert.equal(out.dropped, 0);
  });

  await test("a line with a free-prose word is re-asked; the prompt lists the names to keep and says every other clerical word goes", async function () {
    necroticWorld(); var calls = script(["The tithe-engines' keepers sent a demand in blood to the village."]);
    var ex = { loreDiscovered: ["The tithe-engines' keepers sent an invoice to the village."] };
    await recordRegisterGuard(ex, 35);
    assert.equal(calls.length, 1, "one re-ask");
    assert.ok(/tithe-engines/.test(calls[0]) && /keep/i.test(calls[0]), "the prompt lists the canonical name to keep: " + calls[0].slice(0, 400));
    assert.ok(/every other clerical word/i.test(calls[0]) && /hyphenated/i.test(calls[0]), "the prompt says every other clerical word must go, hyphenated coinages included");
    assert.ok(!/'lien'|'soul-tax'/.test(calls[0].split("LINE:")[0]), "a masked name is not listed as a word to remove");
    assert.deepStrictEqual(ex.loreDiscovered, ["The tithe-engines' keepers sent a demand in blood to the village."], "the clean rewrite (names kept) files");
  });

  await test("lines past the re-ask cap are DEFERRED to the next window, persisted, counted — and re-guarded at the next summarize", async function () {
    necroticWorld();
    var dirty = [], i; for (i = 0; i < 8; i++) dirty.push("Line " + i + ": the village keeps an invoice of the hunt.");
    var calls = script([function () { return "Still an invoice."; }, function () { return "Still an invoice."; }, function () { return "Still an invoice."; }, function () { return "Still an invoice."; }, function () { return "Still an invoice."; }, function () { return "Still an invoice."; }]);
    var ex = { loreDiscovered: dirty.slice() };
    var out = await recordRegisterGuard(ex, 40);
    assert.equal(calls.length, RECORD_REGISTER_REASK_MAX, "the cap holds");
    assert.equal(out.deferred, 8 - RECORD_REGISTER_REASK_MAX, "the rest are deferred, not dropped: " + JSON.stringify(out));
    assert.equal(ex.loreDiscovered.length, 0, "nothing dirty files this window");
    assert.equal((worldState.recordDeferred || []).length, 8 - RECORD_REGISTER_REASK_MAX, "the deferred lines ride the save");
    assert.ok(registerCensusStats().recordDeferred === 8 - RECORD_REGISTER_REASK_MAX, "the census counts the deferral as its own outcome: " + JSON.stringify(registerCensusStats()));
    var calls2 = script([function () { return "Line 6: the village remembers the hunt."; }, function () { return "Line 7: the village remembers the hunt."; }]);
    var ex2 = { loreDiscovered: [] };
    await recordRegisterGuard(ex2, 45);
    assert.equal(calls2.length, 2, "the deferred lines are re-asked next window");
    assert.deepStrictEqual(ex2.loreDiscovered, ["Line 6: the village remembers the hunt.", "Line 7: the village remembers the hunt."], "their clean rewrites file");
    assert.equal((worldState.recordDeferred || []).length, 0, "the queue drains");
  });

  await test("the deferral queue is bounded; the oldest is evicted out loud", async function () {
    necroticWorld(); worldState.recordDeferred = [];
    var i; for (i = 0; i < RECORD_DEFER_CAP + 5; i++) recordDeferPush({ kind: "lore", text: "Old line " + i + " with an invoice." }, 50);
    assert.equal(worldState.recordDeferred.length, RECORD_DEFER_CAP, "capped");
    assert.equal(worldState.recordDeferred[0].text, "Old line 5 with an invoice.", "the oldest leave first");
    assert.equal(registerCensusStats().recordEvicted, 5, "the evictions are counted");
  });

  await test("the #372 chapter guard scans through the same mask: a chapter whose only hits are canonical names is not re-asked", async function () {
    necroticWorld(); var calls = script([]);
    var ex = { chapterSummary: "Ammut and his wives tore down the tithe-engines and broke the soul-tax lien on Daeris." };
    await chapterRegisterGuard(ex, 35);
    assert.equal(calls.length, 0, "no re-ask for canonical names");
  });

  console.log(failed ? "FAILED — " + failed + " of " + (failed + passed) + " #481 C7 groups" : "ALL GREEN — " + passed + " #481 C7 groups");
  process.exit(failed ? 1 : 0);
})();
