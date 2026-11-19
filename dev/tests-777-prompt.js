// dev/tests-777-prompt.js — audit 2026-11-19 (TODO #777), batch 4: what the prompt carries and what a campaign is built
// from. Sections P6–P12 (the notes, the geography block, the conditions, the legacy block, the ring, the buttons, the place
// cue), K1–K2 (what a talk and Table Talk are told), C1–C2 (the skeleton review), C13–C15 (blueprint validation) and H3
// (a blueprint's rules). Each case builds a fresh world and runs the REAL engine; a case name opens with its audit row.
//   node dev/tests-777-prompt.js             every case
//   node dev/tests-777-prompt.js --only P7   the cases whose name contains the text
// ES5 throughout, matching the engine.
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [], errors: [], infos: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () { said.infos.push([].join.call(arguments, " ")); };
console.log = function () {}; console.debug = function () {};
LE.loadEngine();
console.error = function () { said.errors.push([].join.call(arguments, " ")); };
addMsg = function () { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "" }; };
showToast = function (m) { said.toasts.push(String(m)); };
syncUI = function () {}; updateAbPanel = function () {}; updateSpPanel = function () {};
saveAll = function () {}; saveCore = function () {}; saveMem = function () {}; saveRules = function () {};
if (typeof storageAdapter === "undefined") storageAdapter = { syncToServer: function () {}, syncNow: function () {} };
var ROOT = path.join(__dirname, "..");

function fresh(o) {
  var ws = LE.makeTestWorld(o || {});
  migrateWorldState(ws); worldState = ws; customRules = [];
  said.warns.length = 0; said.toasts.length = 0; said.errors.length = 0; said.infos.length = 0;
  return ws;
}
function npc(name, extra, mem) { var n = { name: name, status: "", rel: "ally", met: 1, aliases: [] }, k; for (k in (extra || {})) n[k] = extra[k]; worldState.npcs.push(n); memory.npcs[name] = { attitude: "", knowledge: [], events: [] }; for (k in (mem || {})) memory.npcs[name][k] = mem[k]; return n; }
function prompt() { var p = buildSysPrompt(); return typeof p === "string" ? p : (String(p.stable || "") + "\n" + String(p.volatile || "")); }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
function bp(extra) {
  var b = { format: "tnd-blueprint-v1", name: "Fixture", premise: "A masquerade goes wrong.", tone: "swords",
    acts: [{ title: "Act one", goal: "Arrive", turningPoint: "The mask slips", arcs: [{ title: "The door", objective: "Get inside", type: "main" }] }],
    npcs: [{ name: "Bram", role: "ally", notes: "A smith." }], locations: [{ name: "Ashfen", description: "A marsh town." }] }, k;
  for (k in (extra || {})) b[k] = extra[k];
  return b;
}

// ── P6: a withheld reward shelved before a request that then fails ─────────────────────────────────────────────────
kase("P6: a reward shelved and accepted while a request that then FAILS was out is not queued and paid a second time", function () {
  fresh(); worldState.turn = 20;
  worldState.identityConflicts = [{ subject: "Bram", handle: "-", reason: "death not on record", withheld: ["[XP:5]"], attempts: IDENTITY_CONFLICT_STALE_ATTEMPTS, lastFired: 0 }];
  var snap = snapshotNoteLatches();
  buildIdentityConflictNudge();
  var q = worldState.pendingRewardClaims || [];
  assert.strictEqual(q.length, 1, "fixture: the shelve queued no claim");
  var xp0 = worldState.character.xp;
  assert.ok(rewardClaimAccept(q[0].id), "fixture: the claim was not accepted");
  assert.strictEqual(worldState.character.xp, xp0 + 5, "fixture: the accepted claim paid nothing");
  restoreNoteLatches(snap);                                   // the request failed: the turn's notes are un-delivered
  assert.ok(worldState.identityConflicts[0].stale && !worldState.identityConflicts[0].withheld.length, "the failed turn handed the spent reward back to the conflict: " + JSON.stringify(worldState.identityConflicts[0]));
  worldState.turn += 3; snapshotNoteLatches(); buildIdentityConflictNudge();
  assert.strictEqual((worldState.pendingRewardClaims || []).length, 0, "the reward the player already took was queued again");
});
kase("P6: a failed turn still un-delivers a conflict note that shelved nothing", function () {
  fresh(); worldState.turn = 20;
  // an EARLIER turn shelved a conflict for Bram and committed; a fresh quarantine re-armed the same subject with the same reward
  worldState.identityConflicts = [{ subject: "Bram", handle: "-", reason: "death not on record", withheld: ["[XP:5]"], attempts: IDENTITY_CONFLICT_STALE_ATTEMPTS, lastFired: 0 }];
  snapshotNoteLatches(); buildIdentityConflictNudge();
  assert.ok(worldState.identityConflicts[0].stale, "fixture: the earlier conflict was not shelved");
  worldState.turn = 40; delete worldState.pendingRewardClaims;
  worldState.identityConflicts = [{ subject: "Bram", handle: "-", reason: "death not on record", withheld: ["[XP:5]"], attempts: 1, lastFired: 0 }];
  var snap = snapshotNoteLatches(), note = buildIdentityConflictNudge();
  assert.ok(note, "fixture: no note was built");
  restoreNoteLatches(snap);
  assert.ok(!worldState.identityConflicts[0].stale, "an earlier turn's shelve was applied to this conflict — its reward is gone with no claim");
  assert.strictEqual(worldState.identityConflicts[0].attempts, 1, "the un-delivered note still counted as an attempt");
  assert.deepStrictEqual(worldState.identityConflicts[0].withheld, ["[XP:5]"]);
  var k; for (k = 0; k < CONFLICT_SHELVE_LOG + 8; k++) { worldState.turn += 5; delete worldState.pendingRewardClaims; worldState.identityConflicts = [{ subject: "Foe " + k, handle: "-", reason: "r", withheld: ["[XP:" + (k + 1) + "]"], attempts: IDENTITY_CONFLICT_STALE_ATTEMPTS, lastFired: 0 }]; buildIdentityConflictNudge(); }
  assert.ok(_conflictShelved.length <= CONFLICT_SHELVE_LOG, "the shelve log grows without bound: " + _conflictShelved.length);
});

// ── P7: the geography block's "elsewhere" lines ────────────────────────────────────────────────────────────────────
kase("P7: characters last seen elsewhere long ago are counted, not listed — the block does not grow with every NPC ever met", function () {
  fresh(); worldState.turn = 500; var i;
  for (i = 0; i < 300; i++) npc("Villager Number" + i + "x", { met: 3, statusTurn: 3 }, { lastSeenAt: "Farholt", lastSeenTurn: 3 });
  npc("Recent Rider", { met: 490, statusTurn: 490 }, { lastSeenAt: "Farholt", lastSeenTurn: 490 });
  npc("Named Stranger", { met: 3, statusTurn: 3 }, { lastSeenAt: "Farholt", lastSeenTurn: 3 });
  sessionLog = [{ role: "user", content: "I ask after Named Stranger." }, { role: "assistant", content: "Nobody has seen them." }];
  var geo = buildGeoBlock();
  assert.ok(geo.length < 4000, "the geography block is " + geo.length + " characters");
  assert.ok(/Recent Rider/.test(geo), "a character seen ten turns ago elsewhere was dropped");
  assert.ok(/Named Stranger/.test(geo), "a character named in the last messages was dropped");
  assert.ok(!/Villager Number7x/.test(geo), "a character unseen for 497 turns is still listed");
  assert.ok(/300 more/.test(geo), "the folded characters are not counted: " + geo.slice(-400));
});
kase("P7: with nobody folded the elsewhere lines are what they were", function () {
  fresh(); worldState.turn = 20;
  npc("Recent Rider", { met: 15, statusTurn: 15 }, { lastSeenAt: "Farholt", lastSeenTurn: 15 });
  var geo = buildGeoBlock();
  assert.ok(/Recent Rider/.test(geo) && !/more .*on record/.test(geo.split("Elsewhere")[1] || ""), geo);
});

// ── P8: a null entry in a sheet's conditions ───────────────────────────────────────────────────────────────────────
kase("P8: a null entry in a sheet's conditions is removed at the load, and said", function () {
  var ws = LE.makeTestWorld({});
  ws.character.conditions = [null, { name: "Poisoned", duration: "1 hour" }, "junk", { duration: "nameless" }];
  said.toasts.length = 0; said.warns.length = 0;
  migrateWorldState(ws); worldState = ws;
  assert.deepStrictEqual(worldState.character.conditions.map(function (c) { return c && c.name; }), ["Poisoned"], "the load left an unreadable condition on the sheet");
  assert.ok(said.toasts.some(function (t) { return /condition/i.test(t); }), "nothing was said: " + JSON.stringify(said.toasts));
  assert.ok(said.warns.some(function (t) { return /condition/i.test(t); }));
});
kase("P8: a sheet admitted at any other door loses the entry too, and that door says so", function () {
  fresh(); var sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Imported Ilse"; sheet.conditions = [null, { name: "Blessed", duration: "a day" }];
  said.toasts.length = 0;
  var a = sheetAdmit(sheet, { door: "test import", mode: "cross", stage: "preview" });
  assert.ok(a.ok, "fixture: the sheet was refused — " + a.reason);
  assert.deepStrictEqual(a.sheet.conditions.map(function (c) { return c && c.name; }), ["Blessed"]);
  assert.ok(said.toasts.some(function (t) { return /Imported Ilse/.test(t) && /condition/i.test(t); }), "the door said nothing: " + JSON.stringify(said.toasts));
});
kase("P8: a null entry that reaches a live sheet does not fail the turn", function () {
  fresh(); worldState.character.conditions = [{ name: "Poisoned", duration: "1 hour", turn: 2 }, null];
  worldState.npcs.push({ name: "Bram", status: "", rel: "ally", met: 1, aliases: [], partyMember: true, charSheet: { name: "Bram", hp: 10, maxHp: 10, cls: "Warrior", level: 1, xp: 0, inventory: [], conditions: [{ name: "Dazed", duration: "a minute", turn: 3 }, null], abilities: [], spells: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } } });
  memory.npcs.Bram = { attitude: "", knowledge: [], events: [] };
  var p;
  assert.doesNotThrow(function () { p = prompt(); }, "the prompt could not be built");
  assert.ok(/Poisoned/.test(p) && /Dazed/.test(p), "a readable condition was lost");
  assert.ok(!/Conditions: [^\n]*,\s*(?:—|\n|$)/.test(p), "the unreadable entry left a hole in a conditions line: " + (p.match(/Conditions: [^\n]*/g) || []).join(" || "));
  assert.doesNotThrow(function () { buildConditionAudit(); });
});

// ── P9: age is cosmetic ────────────────────────────────────────────────────────────────────────────────────────────
kase("P9: the legacy-character block carries no age", function () {
  fresh();
  worldState.pendingLegacy = { name: "Old Korrag", gender: "M", ancestry: "Human", cls: "Warrior", level: 4, age: "147 winters", inventory: [], relationships: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } };
  var p = prompt();
  assert.ok(/Old Korrag/.test(p), "fixture: the legacy block is not in the prompt");
  assert.ok(p.indexOf("147 winters") < 0, "the character's age is in a gameplay prompt");
});

// ── P10: the provenance ring on the public map's withhold path ─────────────────────────────────────────────────────
kase("P10: a reply whose tags the public map withholds is still on the provenance ring", function () {
  fresh(); worldState.atlas = { v: ATLAS_VER, seed: "p10", knowledge: 1 }; memory.map.geography = MapKnowledge.create();
  var n = (worldState.tagLog || []).length, coin = worldState.character.coin;
  var R = applyMuts("You go. [SUBLOCATION_LEAVE:the inn] [GOLD:+3] [NPC:Bram|calm and on [XP:5]");
  assert.ok((R.muts || []).some(function (m) { return /withheld/.test(m); }), "fixture: the reply was not withheld: " + JSON.stringify(R.muts));
  assert.strictEqual(worldState.character.coin, coin, "fixture: a withheld reply paid");
  var log = worldState.tagLog || [];
  assert.strictEqual(log.length, n + 1, "the turn left no provenance entry");
  var e = log[log.length - 1];
  assert.ok(e.carried.indexOf("GOLD") >= 0 && e.carried.indexOf("SUBLOCATION_LEAVE") >= 0, "the entry does not name the tags the reply carried: " + JSON.stringify(e));
  assert.ok(e.withheld && /malformed|truncated/.test(e.withheld), "the entry does not say why nothing was applied: " + JSON.stringify(e));
  assert.deepStrictEqual(e.unclosed, ["NPC"], "an unclosed opener on this path is not recorded");
});

// ── P11: the legacy buttons line ───────────────────────────────────────────────────────────────────────────────────
kase("P11: a legacy [ACTIONS:] line followed by a tag keeps the tag out of the third button", function () {
  fresh();
  var html = parseActions("You wait.", "You wait. [ACTIONS:Open the door|Call out|Leave quietly] [HP:-1]").btns;
  assert.ok(/Leave quietly/.test(html), "the third button is gone: " + html.slice(0, 300));
  assert.ok(html.indexOf("HP:-1") < 0 && html.indexOf("[HP") < 0, "the tag is on a button: " + html.slice(0, 400));
  var keep = parseActions("You wait.", "You wait. [ACTIONS:Open the [red] door|Call out|Leave quietly]").btns;
  assert.ok(/red/.test(keep) && /Leave quietly/.test(keep), "an action with a bracket in it no longer parses: " + keep.slice(0, 200));
});

// ── P12: the place cue ─────────────────────────────────────────────────────────────────────────────────────────────
kase("P12: the place cue names a place only from capitalised words — a phrase fragment is no place", function () {
  fresh();
  assert.strictEqual(detectLocationFilingCue("You step through the doorway into the great hall."), null, "a fragment was offered as a place");
  assert.strictEqual(detectLocationFilingCue("You enter a long tunnel."), null);
  assert.strictEqual(detectLocationFilingCue("You pass into the lower vault of the old keep."), null);
  assert.strictEqual(detectLocationFilingCue("You step into the Sunken Hall, torch raised."), "Sunken Hall");
  assert.strictEqual(detectLocationFilingCue("Entering The Black Keep, you slow."), "Black Keep");
  assert.strictEqual(detectLocationFilingCue("you enter Vaelor's Vault at last."), "Vaelor's Vault");
});

// ── K1, K2: what a talk and Table Talk are told ────────────────────────────────────────────────────────────────────
kase("K1: a talk with a companion is given neither its GM-only authored secret nor the blueprint's note about it", function () {
  fresh();
  worldState.skeleton = { premise: "p", acts: [{ title: "Act one", goal: "g", status: "active", arcs: [{ title: "a", objective: "o", status: "active" }] }] };
  npc("Bram", { partyMember: true }, { knowledge: ["Shoes horses at dawn"], secrets: [{ source: "blueprint", text: "Bram is the heir in hiding", revealAct: 1 }], authored: [{ source: "blueprint", field: "notes", text: "Play Bram as the traitor of act three" }] });
  var gm = memoryNpcDetail("Bram", { omitAbilities: true });
  assert.ok(/heir in hiding/.test(gm) && /traitor of act three/.test(gm), "fixture: the GM's own detail no longer carries the dossier: " + gm);
  var talk = memoryNpcDetail("Bram", { omitAbilities: true, omitGmOnly: true });
  assert.ok(talk.indexOf("heir in hiding") < 0, "the talk is given the authored secret");
  assert.ok(talk.indexOf("traitor of act three") < 0, "the talk is given the blueprint's GM note");
  assert.ok(/Shoes horses at dawn/.test(talk), "what the tale knows of the character was lost with it");
  var src = fs.readFileSync(path.join(ROOT, "companion-talk.js"), "utf8");
  assert.ok(/memoryNpcDetail\(partner\.name,\s*\{[^}]*omitGmOnly:\s*true/.test(src), "talkContext does not ask for the GM-only parts to be left out");
});
kase("K2: Table Talk is not told of characters the player has not discovered, nor of the GM's pending events", function () {
  fresh();
  npc("Wyla the Smith", { met: 3, status: "busy" });
  npc("Hidden Villain", { met: 0, status: "", statusTurn: 0 });
  memory.futureEvents = [{ what: "The cult strikes at midnight", when: "soon", who: "", setTurn: 4 }];
  var gm = memoryTOC();
  assert.ok(/Hidden Villain/.test(gm) && /cult strikes/.test(gm), "fixture: the GM's own contents no longer list them");
  var tt = ttRecallBlock("who is around?");
  assert.ok(/Wyla the Smith/.test(tt), "a discovered character is missing");
  assert.ok(tt.indexOf("Hidden Villain") < 0, "Table Talk is told of a character the player has not discovered");
  assert.ok(tt.indexOf("cult strikes") < 0, "Table Talk is told of the GM's pending events");
  assert.ok(!/\+\d+ other/.test(tt), "Table Talk is told how many characters are hidden: " + tt);
  var k, nd; applyMuts("[LOCATION:Sandpoint]");
  for (k = 1; k <= TOC_SUB_CAP + 2; k++) { nd = ensureMapNode("Sandpoint|Place " + (k < 10 ? "0" : "") + k, 1, "Sandpoint"); nd.visits = 1; nd.lastVisit = k; }
  tt = ttRecallBlock("where have we been?");
  assert.strictEqual(tt.split("Sandpoint — Place ").length - 1, TOC_SUB_CAP + 2, "Table Talk no longer lists every visited place (#464)");
});

// ── C1, C2: the skeleton review ────────────────────────────────────────────────────────────────────────────────────
function skel() {
  return { premise: "A drowned city wakes.", deepTime: [{ age: "The Drowning", years: 300 }],
    acts: [1, 2, 3].map(function (n) { return { title: "Act " + n, goal: "Goal " + n, turningPoint: "Turn " + n, parallel: false, arcs: [{ title: "Arc " + n, objective: "Do " + n, type: "main" }] }; }) };
}
kase("C1: the corrected skeleton keeps the campaign's age ladder (the correction returns premise and acts only)", function () {
  fresh(); var s = skel(), sent = "";
  callGM = function (msg) { sent = msg; return Promise.resolve(JSON.stringify({ premise: "A drowned city wakes, corrected.", acts: s.acts })); };
  return correctCampaignSkeleton(s, [{ sev: "HIGH", where: "premise", issue: "thin", fix: "thicken" }], null, "skeleton").then(function (fixed) {
    assert.strictEqual(fixed.premise, "A drowned city wakes, corrected.");
    assert.deepStrictEqual(fixed.deepTime, s.deepTime, "the age ladder was dropped by the review");
  });
});
kase("C2: a corrected skeleton with a null arc, or an arc with no title or objective, is refused inside the review", function () {
  fresh(); var bad;
  bad = skel(); bad.acts[1].arcs = [null];
  assert.throws(function () { validateSkeletonStructure(bad); }, /arc/i, "a null arc passed");
  bad = skel(); bad.acts[2].arcs[0] = { title: "Arc 3" };
  assert.throws(function () { validateSkeletonStructure(bad); }, /objective/i, "an arc with no objective passed");
  bad = skel(); bad.acts[0].arcs[0] = { objective: "Do it" };
  assert.throws(function () { validateSkeletonStructure(bad); }, /title/i, "an arc with no title passed");
  bad = skel(); bad.acts[0] = null;
  assert.throws(function () { validateSkeletonStructure(bad); }, /act/i, "a null act passed");
  assert.doesNotThrow(function () { validateSkeletonStructure(skel()); });
  var s = skel();
  callGM = function () { var out = skel(); out.acts[0].arcs = [null]; return Promise.resolve(JSON.stringify(out)); };
  return correctCampaignSkeleton(s, [{ sev: "HIGH", where: "premise", issue: "thin", fix: "thicken" }], null, "skeleton").then(function () { throw new Error("a correction with a null arc was accepted"); }, function (e) { assert.ok(/arc/i.test(e.message), e.message); });
});

// ── C13–C15: blueprint validation ──────────────────────────────────────────────────────────────────────────────────
kase("C13: a blueprint NPC with no name, a blank name, or a name the tags cannot address is refused with the reason", function () {
  fresh();
  assert.ok(/NPC 2.*name/i.test(String(validateBlueprint(bp({ npcs: [{ name: "Bram" }, { role: "ally" }] })))), String(validateBlueprint(bp({ npcs: [{ name: "Bram" }, { role: "ally" }] }))));
  assert.ok(/name/i.test(String(validateBlueprint(bp({ npcs: [{ name: "   " }] })))));
  assert.ok(/Bram\|Kitchen/.test(String(validateBlueprint(bp({ npcs: [{ name: "Bram|Kitchen" }] })))), "a name with a | passed");
  assert.ok(/name/i.test(String(validateBlueprint(bp({ npcs: [{ name: "Bram [the smith]" }] })))), "a name with a bracket passed");
  assert.strictEqual(validateBlueprint(bp()), null, "a sound blueprint is refused: " + validateBlueprint(bp()));
});
kase("C14: a null entry in a blueprint's acts, arcs, NPCs or locations is a reason, never a throw", function () {
  fresh(); var r;
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ acts: [null] })); }); assert.ok(/Act 1/.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ acts: [{ title: "A", goal: "g", arcs: [null] }] })); }); assert.ok(/arc 1/i.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ npcs: [null] })); }); assert.ok(/NPC 1/.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ locations: [null] })); }); assert.ok(/Location 1/i.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ locations: [{ description: "nameless" }] })); }); assert.ok(/Location 1.*name/i.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ npcs: "Bram" })); }); assert.ok(/NPCs must be a list/.test(String(r)), String(r));
  assert.doesNotThrow(function () { r = validateBlueprint(bp({ locations: { name: "Ashfen" } })); }); assert.ok(/locations must be a list/.test(String(r)), String(r));
});
kase("C15: two blueprint NPCs with one name are refused by name", function () {
  fresh();
  var r = validateBlueprint(bp({ npcs: [{ name: "Bram", role: "ally" }, { name: "bram ", role: "rival" }] }));
  assert.ok(/Bram/i.test(String(r)) && /two|twice|same name/i.test(String(r)), String(r));
});
kase("C13-C15: every shipped sample blueprint still validates", function () {
  fresh(); var dir = path.join(ROOT, "samples"), bad = [];
  fs.readdirSync(dir).filter(function (f) { return /\.blueprint$/.test(f); }).forEach(function (f) {
    var b = normalizeBlueprint(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))), r = validateBlueprint(b);
    if (r) bad.push(f + ": " + r);
  });
  assert.deepStrictEqual(bad, [], "a shipped blueprint is refused by the stricter validator");
});

// ── H3: a blueprint's rules ────────────────────────────────────────────────────────────────────────────────────────
kase("H3: a blueprint's rules belong to its campaign — they are in force there and nowhere else, and never copied to the device", function () {
  fresh(); customRules = ["My own rule."];
  applyBlueprint(bp({ rules: ["No firearms exist."] }));
  assert.deepStrictEqual(customRules, ["My own rule."], "the blueprint's rule was copied into the device-wide rules");
  assert.ok(/No firearms exist\./.test(getRulesBlock()), "the rule is not in force in its own campaign");
  assert.ok(/My own rule\./.test(getRulesBlock()));
  assert.ok(buildBlueprintFromGame().rules.some(function (r) { return /No firearms exist\./.test(r); }), "a blueprint made from this campaign lost the campaign's rule");
  var kept = JSON.parse(JSON.stringify(worldState.campaignRules));
  fresh(); customRules = ["My own rule."];
  assert.ok(!/No firearms/.test(getRulesBlock()), "the rule is in force in another campaign");
  worldState.campaignRules = kept; customRules = kept.slice();
  assert.strictEqual(getRulesBlock().split("No firearms exist.").length - 1, 1, "a rule already on the device is stated twice");
});
kase("H3: Narrative Rules shows a rule as text — markup in a rule is not run", function () {
  fresh(); customRules = ["<img src=x onerror=alert(1)>"]; worldState.campaignRules = ["<b>bold</b> rule"];
  var html = rulesListHtml();
  assert.ok(html.indexOf("<img") < 0 && html.indexOf("<b>bold") < 0, "a rule's markup reaches the page: " + html.slice(0, 300));
  assert.ok(/&lt;img/.test(html) && /&lt;b&gt;bold/.test(html), "the rules are not shown");
  assert.ok(/removeRule\(0\)/.test(html) && /removeCampaignRule\(0\)/.test(html), "a rule cannot be removed");
  var src = fs.readFileSync(path.join(ROOT, "ui-modals.js"), "utf8"), modal = src.slice(src.indexOf("function showRulesModal"), src.indexOf("function removeRule"));
  assert.ok(/h\+=rulesListHtml\(\);/.test(modal), "the modal does not paint the escaped list");
  assert.ok(!/\+customRules\[i\]\+/.test(modal) && !/campaignRules\[i\]/.test(modal), "the modal paints a rule itself, unescaped");
});

// ── The independent review of this batch (commit 2438cfd7) ─────────────────────────────────────────────────────────
kase("review P6: through the turn's real note build, a reward shelved and taken before a failed request is not queued again", function () {
  fresh(); worldState.turn = 20;
  worldState.identityConflicts = [{ subject: "Bram", handle: "-", reason: "death not on record", withheld: ["[XP:5]"], attempts: IDENTITY_CONFLICT_STALE_ATTEMPTS, lastFired: 0 }];
  var snap = snapshotNoteLatches();                           // sendAction's order: the snapshot, then every builder
  buildEngineNotes();
  var q = worldState.pendingRewardClaims || [];
  assert.strictEqual(q.length, 1, "fixture: the shelve queued no claim");
  var xp0 = worldState.character.xp;
  assert.ok(rewardClaimAccept(q[0].id)); assert.strictEqual(worldState.character.xp, xp0 + 5);
  restoreNoteLatches(snap);                                   // the request failed
  assert.ok(worldState.identityConflicts[0].stale && !worldState.identityConflicts[0].withheld.length, "the builders that ran after the shelve wiped its record — the reward went back to the conflict: " + JSON.stringify(worldState.identityConflicts[0]));
  worldState.turn += 3; snapshotNoteLatches(); buildEngineNotes();
  assert.strictEqual((worldState.pendingRewardClaims || []).length, 0, "the reward the player already took was queued again");
});
kase("review P7: a character named in the action being sent is listed this turn, and Table Talk keeps the whole list", function () {
  fresh(); worldState.turn = 300;
  npc("Sheriff Hemlock", { met: 10, statusTurn: 10 }, { lastSeenAt: "Farholt", lastSeenTurn: 10 });
  npc("Old Grik", { met: 10, statusTurn: 10 }, { lastSeenAt: "Farholt", lastSeenTurn: 10 });
  sessionLog = []; lastAction = "I ask the innkeeper where Sheriff Hemlock is these days.";
  var geo = buildGeoBlock();
  assert.ok(/Sheriff Hemlock was last seen at Farholt/.test(geo), "the one line recording a character was folded on the turn the player asked after them");
  assert.ok(!/Old Grik/.test(geo) && /1 more character/.test(geo), geo.slice(-300));
  lastAction = null;
  var tt = buildGeoBlock("player");
  assert.ok(/Sheriff Hemlock/.test(tt) && /Old Grik/.test(tt) && !/not listed/.test(tt), "Table Talk lost the last-seen lines it answers from: " + tt.slice(-300));
});
kase("review K2: Table Talk still knows a character the summariser filed from play, and hides only a seeded cast member play has not touched", function () {
  fresh();
  memory.npcs["Rat-Kabob Vendor"] = { attitude: "", knowledge: ["Sells rat kabobs by the gate"], events: [], aliases: [] };   // memory only: filed from play
  npc("Seeded Schemer", { met: 0, status: "", statusTurn: 0 }, { knowledge: ["He plots against the crown."] });               // the blueprint's own note
  npc("Quiet Witness", { met: 0, status: "", statusTurn: 0 }); fileNpcEvent("Quiet Witness", "Saw the fire from the quay", 3);
  var tt = ttRecallBlock("who is around?");
  assert.ok(/Rat-Kabob Vendor/.test(tt), "a character filed from play with no roster row is hidden from Table Talk");
  assert.ok(/Quiet Witness/.test(tt), "a character with a play-filed event is hidden from Table Talk");
  assert.ok(tt.indexOf("Seeded Schemer") < 0, "a seeded cast member play has not touched is shown");
});
kase("review C13: a blueprint that reaches the game unvalidated starts it all the same — unusable entries are skipped and counted", function () {
  fresh(); var b = bp({ npcs: [null, { role: "ally" }, { name: "Bram|Kitchen" }, { name: "Ilse" }], locations: [null, { description: "nameless" }, { name: "Ashfen Quay", description: "A quay." }] });
  said.toasts.length = 0;
  assert.doesNotThrow(function () { applyBlueprint(b); }, "a null entry threw in the middle of starting the game");
  assert.deepStrictEqual(worldState.npcs.map(function (n) { return n.name; }).filter(function (n) { return n !== "Tess"; }), ["Ilse"], "an unusable NPC entry was seated: " + JSON.stringify(worldState.npcs.map(function (n) { return n.name; })));
  assert.ok(memory.map.nodes["Ashfen Quay"] && !memory.map.nodes["undefined"] && !memory.locations["undefined"], "a nameless location was filed");
  assert.ok(said.toasts.some(function (t) { return /5 entr/.test(t) && /blueprint/i.test(t); }), "the skipped entries were not said: " + JSON.stringify(said.toasts));
});
kase("review P10: the withheld reply's ring entry claims no tag was applied — the names it carried are kept apart", function () {
  fresh(); worldState.atlas = { v: ATLAS_VER, seed: "p10", knowledge: 1 }; memory.map.geography = MapKnowledge.create();
  applyMuts("You go. [SUBLOCATION_LEAVE:the inn] [CONDITION:Poisoned|1 day] [HP:-3]");
  var e = worldState.tagLog[worldState.tagLog.length - 1];
  assert.deepStrictEqual(e.tags, [], "the ring says tags were applied that were not: " + JSON.stringify(e.tags));
  assert.ok(e.carried.indexOf("CONDITION") >= 0 && e.carried.indexOf("HP") >= 0, JSON.stringify(e));
});
kase("review P11: a bare tag after the buttons line is cut too, and a bracketed word inside an earlier action cuts nothing", function () {
  fresh();
  var a = parseActions("x", "x [ACTIONS: Go north | Wait | Rest][NO_CHANGE]").btns;
  assert.ok(/Rest/.test(a) && a.indexOf("NO_CHANGE") < 0, "a bare tag rode into the third button: " + a.slice(0, 300));
  var b = parseActions("x", "x [ACTIONS: Go north | Pull the lever [A] [DANGER] | Wait]").btns;
  assert.strictEqual(b.split("<button").length - 1, 3, "an action with bracketed words lost a button: " + b.slice(0, 400));
  assert.ok(/Wait/.test(b));
});
kase("review P12: a place named type-first is still a place", function () {
  fresh();
  assert.strictEqual(detectLocationFilingCue("You enter the Hall of Kings at dusk."), "Hall of Kings");
  assert.strictEqual(detectLocationFilingCue("You step into the Vault of the Seven Whispers."), "Vault of the Seven Whispers");
  assert.strictEqual(detectLocationFilingCue("You enter Keep Dunmoor by the postern."), "Keep Dunmoor");
  assert.strictEqual(detectLocationFilingCue("You enter the hall of mirrors."), null);
  assert.strictEqual(detectLocationFilingCue("You pass through the keep and out again."), null);
});
kase("review P8: the load removes an unreadable condition even when the campaign's packs are refused", function () {
  var ws = LE.makeTestWorld({});
  ws.character.inventoryJunk = "not a list";                    // the pack check refuses the world whole
  ws.character.conditions = [null, { name: "Poisoned", duration: "1 hour" }];
  said.toasts.length = 0;
  migrateWorldState(ws); worldState = ws;
  assert.deepStrictEqual(worldState.character.conditions.map(function (c) { return c && c.name; }), ["Poisoned"], "with the packs refused the null stayed — every turn would fail on it");
  assert.ok(said.toasts.some(function (t) { return /condition/i.test(t); }));
  assert.doesNotThrow(function () { conditionSnapshot(); });
});
kase("review C2: a first draft with one unusable arc keeps its spine — the arc is dropped, said, and an act left with none is still refused", function () {
  fresh(); var s = skel();
  s.acts[1].arcs.push({ title: "No objective here" }); s.acts[2].arcs.unshift(null);
  assert.strictEqual(skeletonPruneArcs(s), 2);
  assert.doesNotThrow(function () { validateSkeletonStructure(s); });
  assert.deepStrictEqual(s.acts.map(function (a) { return a.arcs.length; }), [1, 1, 1]);
  assert.ok(said.warns.some(function (w) { return /arc/i.test(w) && /dropped/i.test(w); }), "the dropped arcs were not said");
  var t = skel(); t.acts[0].arcs = [{ title: "Only a title" }];
  skeletonPruneArcs(t);
  assert.throws(function () { validateSkeletonStructure(t); }, /no arcs/i);
  var game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8"), at = game.indexOf("async function generateSkeleton");
  assert.ok(/skeletonPruneArcs\(skel\);\s*validateSkeletonStructure\(skel\);/.test(game.slice(at, at + 9000)), "the game validates a first draft without first dropping its unusable arcs");
  callGM = function () { var d = skel(); d.name = "Drowned"; d.acts[0].arcs.push(null); return Promise.resolve(JSON.stringify(d)); };
  return generateBlueprintDraft({ concept: "a drowned city" }, null).then(function (d) { assert.strictEqual(d.acts[0].arcs.length, 1, "the designer's draft was refused or kept the null arc"); });
});
kase("review C13: the designer's draft check passes over a row nobody has named yet, and nothing else", function () {
  fresh();
  var draft = bp({ npcs: [{ name: "Bram" }, { name: "" }], locations: [{ name: "Ashfen" }, { name: "  " }] });
  assert.ok(/NPC 2 has no name/.test(String(validateBlueprint(draft))), "save and publish no longer refuse an unnamed row");
  assert.strictEqual(validateBlueprintDraft(draft), null, "an unnamed row in progress refuses every fix and proposal: " + validateBlueprintDraft(draft));
  assert.ok(/Bram\|Kitchen/.test(String(validateBlueprintDraft(bp({ npcs: [{ name: "" }, { name: "Bram|Kitchen" }] })))), "a real problem hid behind the unnamed row");
  assert.ok(/NPC 1 is not an entry/.test(String(validateBlueprintDraft(bp({ npcs: [null] })))));
  assert.ok(/share the same name/.test(String(validateBlueprintDraft(bp({ npcs: [{ name: "Bram" }, { name: "bram " }] })))));
  var html = fs.readFileSync(path.join(ROOT, "blueprint-designer.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "designer-assistant-ui.js"), "utf8"), at = html.indexOf("async function applyFinding(");
  assert.ok(/var err=validateBlueprintDraft\(bp\);/.test(html.slice(at, at + 6000)), "applying a review fix judges the draft with the save's check");
  assert.ok(/validate:validateBlueprintDraft/.test(ui), "an assistant proposal judges the draft with the save's check");
});
kase("review C1: a correction that returns the age ladder as null does not drop it", function () {
  fresh(); var s = skel();
  callGM = function () { return Promise.resolve(JSON.stringify({ premise: "p2", acts: s.acts, deepTime: null })); };
  return correctCampaignSkeleton(s, [{ sev: "HIGH", where: "premise", issue: "thin", fix: "thicken" }], null, "skeleton").then(function (fixed) { assert.deepStrictEqual(fixed.deepTime, s.deepTime); });
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
var realCallGM = (typeof callGM === "function") ? callGM : null;
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 prompt: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 prompt cases"); return;
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); if (realCallGM) callGM = realCallGM; next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); if (realCallGM) callGM = realCallGM; next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
