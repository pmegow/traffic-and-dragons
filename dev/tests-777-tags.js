// dev/tests-777-tags.js — audit 2026-11-19 (TODO #777), sections T and P (the tag parser, the clock, the applyMuts
// boundary). Each case builds a fresh world and runs the REAL applyMuts over a reply; a case name opens with its audit row.
//   node dev/tests-777-tags.js             every case
//   node dev/tests-777-tags.js --only T2   the cases whose name contains the text
// ES5 throughout, matching the engine.
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [], errors: [], infos: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () { said.infos.push([].join.call(arguments, " ")); };
console.debug = function () {};
LE.loadEngine();
console.error = function () { said.errors.push([].join.call(arguments, " ")); };
addMsg = function () { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "" }; };
showToast = function (m) { said.toasts.push(String(m)); };
syncUI = function () {}; updateAbPanel = function () {}; updateSpPanel = function () {};
saveAll = function () {}; saveCore = function () {}; saveMem = function () {};
if (typeof storageAdapter === "undefined") storageAdapter = { syncToServer: function () {}, syncNow: function () {} };

function fresh(o) {
  var ws = LE.makeTestWorld(o || {});
  migrateWorldState(ws); worldState = ws;
  said.warns.length = 0; said.toasts.length = 0; said.errors.length = 0; said.infos.length = 0;
  return ws;
}
function run(text, opts) { said.warns.length = 0; said.toasts.length = 0; said.errors.length = 0; var R = applyMuts(text, opts || {}); return { muts: R.muts || [], errors: R.errors || [], clean: cleanTxt(text) }; }
function mutsHave(r, re) { return r.muts.some(function (m) { return re.test(m); }); }
function npc(name, extra) { var n = { name: name, status: "", rel: "ally", met: 1, aliases: [] }, k; for (k in (extra || {})) n[k] = extra[k]; worldState.npcs.push(n); memory.npcs[name] = memory.npcs[name] || { attitude: "ally", knowledge: [], events: [] }; return n; }
function companion(name) { return npc(name, { partyMember: true, charSheet: { name: name, hp: 10, maxHp: 10, cls: "Warrior", level: 1, xp: 0, inventory: [], conditions: [], abilities: [], spells: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } } }); }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }

// ── T1: [DOWNED_RESOLVED:] on a hero who is not down ───────────────────────────────────────────────────────────────
kase("T1: [DOWNED_RESOLVED:dead] on a hero who is not down kills nobody and says why", function () {
  fresh(); var hp = worldState.character.hp;
  var r = run("The bandit captain falls. [DOWNED_RESOLVED:dead|the captain bled out]");
  assert.strictEqual(worldState.deathPending, undefined, "a hale hero was marked for death: " + JSON.stringify(worldState.deathPending));
  assert.strictEqual(worldState.character.hp, hp);
  assert.ok(!mutsHave(r, /DEATH/), "the death line was printed: " + JSON.stringify(r.muts));
  assert.ok(mutsHave(r, /DOWNED_RESOLVED.*refused.*not down/), "the refusal was not said to the player: " + JSON.stringify(r.muts));
  assert.ok(said.warns.some(function (l) { return /DOWNED_RESOLVED/.test(l) && /not down/.test(l); }), "nothing on the console");
});
kase("T1: [DOWNED_RESOLVED:rescued] on a hero who is not down files no Defining Moment", function () {
  fresh(); var before = JSON.stringify(worldState.character.coreMemories || []);
  var r = run("[DOWNED_RESOLVED:rescued|the militia arrived]");
  assert.strictEqual(JSON.stringify(worldState.character.coreMemories || []), before, "a false 'left for dead … and lived' moment was filed");
  assert.ok(!mutsHave(r, /Downed resolved/), JSON.stringify(r.muts));
  assert.ok(mutsHave(r, /refused.*not down/));
});
kase("T1: a hero who IS down is resolved as before — rescued stands them up, dead arms the death, and a death in the reply that drops them counts", function () {
  fresh(); run("[HP:-999]");
  assert.ok(worldState.downed, "the fixture did not down the hero");
  var r = run("[DOWNED_RESOLVED:rescued|the militia arrived]");
  assert.strictEqual(worldState.downed, undefined); assert.strictEqual(worldState.character.hp, 1); assert.ok(mutsHave(r, /Downed resolved: rescued/));
  assert.ok((worldState.character.coreMemories || []).some(function (m) { return /left for dead/.test(JSON.stringify(m)); }), "the scar was not filed");
  fresh(); run("[HP:-999]");
  r = run("[DOWNED_RESOLVED:dead|the fall]");
  assert.ok(worldState.deathPending && worldState.deathPending.cause === "the fall", "a downed hero's death did not arm");
  fresh();
  r = run("The blade goes in. [HP:-999] [DOWNED_RESOLVED:dead|run through]");
  assert.ok(worldState.deathPending, "a death written in the same reply that downs the hero was refused: " + JSON.stringify(r.muts));
});

// ── T2: a field that runs past its own closing bracket ─────────────────────────────────────────────────────────────
kase("T2: a tag one field short does not swallow the tag after it — nothing of the next tag lands in canon", function () {
  var before, r;
  fresh(); npc("Bram"); before = (memory.futureEvents || []).length;
  r = run("[FUTURE_EVENT:The cult returns] Bram nods. [NPC:Bram|calm|ally]");
  assert.strictEqual((memory.futureEvents || []).length, before, "a future event was filed from a one-field tag: " + JSON.stringify((memory.futureEvents || []).slice(-1)));
  fresh(); npc("Bram");
  if (!memory.map) memory.map = { nodes: {}, edges: [] };
  if (!memory.map.nodes[currentNodeKey()]) memory.map.nodes[currentNodeKey()] = { name: worldState.world.location, visits: 1 };   // the handler writes only a node that exists
  r = run("[LOCATION_SIZE:large] The hall is vast. [NPC:Bram|calm|ally]");
  assert.ok(memory.map.nodes[currentNodeKey()], "the fixture has no node for the party's place");
  assert.ok(JSON.stringify(memory.map).indexOf("The hall is vast") < 0, "the prose and the next tag became a place's size");
  fresh(); npc("Bram");
  r = run("[COMBAT_START:Goblin|7|15|+4|1d6] It snarls. [NPC:Bram|wary|ally]");
  assert.ok(JSON.stringify(worldState.combat || {}).indexOf("It snarls") < 0, "the prose became a foe's damage: " + JSON.stringify(worldState.combat));
  fresh(); npc("Bram"); memory.npcs.Bram.knowledge = ["Bram was a smith in Ashfen."];
  r = run("[NPC_SUPERSEDE:Bram|was a smith] later [QUEST:Find the smith|active]");
  assert.deepStrictEqual(memory.npcs.Bram.knowledge, ["Bram was a smith in Ashfen."], "Bram's knowledge was replaced with a swallowed tag's field: " + JSON.stringify(memory.npcs.Bram.knowledge));
  fresh(); npc("Zarith"); npc("Bob");
  r = run("[NPC_LINK:Zarith|Guard Captain] later [NPC:Bob|calm|ally]");
  assert.ok(!(memory.npcGraph.edges || []).some(function (e) { return JSON.stringify(e).indexOf("Bob") >= 0; }), "a real edge Zarith ↔ Bob was filed from a swallowed tag: " + JSON.stringify(memory.npcGraph.edges));
  fresh(); npc("Zarith"); npc("Bob");
  r = run("[NPC_FACTION:Zarith|The Black Hand] and [NPC:Bob|calm|ally]");
  assert.ok(JSON.stringify(memory.npcGraph).indexOf("] and [NPC") < 0, "a faction was named after a swallowed tag: " + JSON.stringify(memory.npcGraph.factions));
  fresh(); npc("Bob");
  r = run("[FACTION_REL:The Black Hand|The Watch] meanwhile [NPC:Bob|calm|ally]");
  assert.ok(JSON.stringify(memory.npcGraph).indexOf("meanwhile") < 0, "a faction edge swallowed the prose: " + JSON.stringify(memory.npcGraph.factionEdges));
  fresh(); companion("Bram");
  r = run("[COMPANION_ABILITY:Bram|Second Wind] then [NPC:Bram|calm|ally]");
  assert.ok(JSON.stringify(findCompanionChar("Bram").abilities).indexOf("then [NPC") < 0, "a companion ability swallowed the next tag: " + JSON.stringify(findCompanionChar("Bram").abilities));
  fresh(); npc("Bram");
  r = run("[SAVE_MOD:Fortitude|+2] and then [NPC:Bram|calm|ally]");
  assert.ok(JSON.stringify(worldState.character).indexOf("and then [NPC") < 0, "a save modifier swallowed the next tag");
});
kase("T2: the same tags written whole still apply", function () {
  fresh(); npc("Bram");
  run("[FUTURE_EVENT:The cult returns|in 3 days]");
  assert.ok((JSON.stringify(memory.futureEvents || []) + JSON.stringify(worldState.clock || {})).indexOf("The cult returns") >= 0, "a whole FUTURE_EVENT is no longer filed (as a pending event or on the clock)");
  fresh(); npc("Zarith"); npc("Bob");
  run("[NPC_LINK:Zarith|Bob|sworn rivals]");
  assert.ok((memory.npcGraph.edges || []).some(function (e) { return JSON.stringify(e).indexOf("sworn rivals") >= 0; }), "a whole NPC_LINK no longer files: " + JSON.stringify(memory.npcGraph.edges));
  fresh(); npc("Zarith");
  run("[NPC_FACTION:Zarith|The Black Hand|lieutenant]");
  assert.ok(JSON.stringify(memory.npcGraph).indexOf("The Black Hand") >= 0);
  fresh();
  run("[COMBAT_START:Goblin|7|15|+4|1d6|skittish]");
  assert.ok(worldState.combat && JSON.stringify(worldState.combat).indexOf("1d6") >= 0, "a whole COMBAT_START no longer opens the fight");
});
kase("T2: no tag handler in tag_table.js has a field that can run past its closing bracket (derived from the source)", function () {
  var src = fs.readFileSync(path.join(__dirname, "..", "tag_table.js"), "utf8"), bad = [], re = /\(\[\^\|\]\+\)|\(\[\^\|\]\*\)/g, m;
  while ((m = re.exec(src))) bad.push("line " + src.slice(0, m.index).split("\n").length + ": " + src.slice(Math.max(0, m.index - 40), m.index + 12));
  assert.deepStrictEqual(bad, [], "a capture group written ([^|]+) has no ] in its class — one field short, it swallows the prose and the next tag");
});

// ── T3: a spell definition's tier ──────────────────────────────────────────────────────────────────────────────────
kase("T3: a spell definition with a tier outside the bible's range is refused, and the caster's mana pool does not move", function () {
  fresh(); var c = worldState.character; c.spells = [{ nm: "Doom Bolt", lvl: 1 }];
  var before = manaMax(c);
  var r = run("[SPELL_DEF:Doom Bolt|tier=999999|effect=ruin|range=60 ft]");
  assert.strictEqual(manaMax(c), before, "tier 999999 set the mana pool to " + manaMax(c));
  assert.ok(mutsHave(r, /SPELL_DEF.*Doom Bolt.*refused.*tier/i), "the refusal was not said: " + JSON.stringify(r.muts));
  fresh(); c = worldState.character; c.spells = [{ nm: "Mana Spring", lvl: 1 }]; before = manaMax(c);
  r = run("[SPELL_DEF:Mana Spring|tier=-50|effect=mana wells up|range=self]");
  assert.strictEqual(manaMax(c), before, "tier -50 moved the mana pool to " + manaMax(c));
  assert.ok(manaMax(c) >= 0);
  assert.ok(mutsHave(r, /refused.*tier/i), JSON.stringify(r.muts));
});
kase("T3: a tier inside the range is defined as before, and the pool follows it", function () {
  fresh(); var c = worldState.character; c.spells = [{ nm: "Doom Bolt", lvl: 1 }];
  var r = run("[SPELL_DEF:Doom Bolt|tier=3|effect=ruin|range=60 ft]");
  assert.ok(!mutsHave(r, /refused/), JSON.stringify(r.muts));
  assert.strictEqual(manaSpellCost(c.spells[0]), 3, "the definition was not kept");
  assert.strictEqual(manaMax(c), 3, "the pool does not follow a legal tier");
  worldState.capabilityBible["doom bolt"].tier = 999999;   // a definition filed before the range was enforced
  assert.strictEqual(manaSpellCost(c.spells[0]), capTierMax(), "a tier already on a save is read outside the range");
});

// ── T4: durations ──────────────────────────────────────────────────────────────────────────────────────────────────
kase("T4: a duration is read whole — decimals, weeks and unit words; months are not minutes", function () {
  assert.strictEqual(parseDuration("1.5h"), 90, "1.5h");
  assert.strictEqual(parseDuration("0.5h"), 30);
  assert.strictEqual(parseDuration("2.5d"), 3600);
  assert.strictEqual(parseDuration("2 weeks"), 20160);
  assert.strictEqual(parseDuration("3w"), 30240);
  assert.strictEqual(parseDuration("1d 6h"), 1800); assert.strictEqual(parseDuration("1d6h30m"), 1830);
  assert.strictEqual(parseDuration("3 hours"), 180); assert.strictEqual(parseDuration("45 minutes"), 45); assert.strictEqual(parseDuration("45"), 45);
  assert.strictEqual(parseDuration("10 months"), 0, "ten months were read as ten minutes");
  assert.strictEqual(parseDuration("a few hours"), 0);
  assert.strictEqual(parseDuration("3 weeks"), parseStrictFutureDuration("3 weeks"), "the two duration readers disagree on the same words");
  assert.strictEqual(durationReadable("10 months"), false); assert.strictEqual(durationReadable("2h"), true); assert.strictEqual(durationReadable("0"), true); assert.strictEqual(durationReadable(""), false);
});
kase("T4: [TIME_ADVANCE:1.5h] advances ninety minutes; an unreadable one is said, not silently charged a minute", function () {
  fresh(); var t0 = clockNow();
  run("[TIME_ADVANCE:1.5h]");
  assert.strictEqual(clockNow() - t0, 90, "1.5h advanced " + (clockNow() - t0) + " minutes");
  fresh(); t0 = clockNow();
  var r = run("[TIME_ADVANCE:a few hours]");
  assert.ok(mutsHave(r, /TIME_ADVANCE:a few hours.*not a duration/), "nothing told the player: " + JSON.stringify(r.muts));
  fresh(); t0 = clockNow();
  r = run("[TIME_ADVANCE:2 weeks]");
  assert.strictEqual(clockNow() - t0, 20160, "two weeks advanced " + (clockNow() - t0) + " minutes");
});
kase("T4: [SCHEDULE:…|3 weeks] is three weeks out; a when the clock cannot read is kept as a pending event and said, never scheduled a minute out", function () {
  fresh(); var t0 = clockNow();
  run("[SCHEDULE:Winter solstice|3 weeks]");
  var ev = worldState.clock.schedule.filter(function (e) { return /Winter solstice/.test(e.label); })[0];
  assert.ok(ev && ev.dueMin - t0 === 30240, "the solstice is due in " + (ev ? ev.dueMin - t0 : "no entry") + " minutes");
  fresh(); var n = worldState.clock.schedule.length;
  var r = run("[SCHEDULE:The king's jubilee|10 months]");
  assert.strictEqual(worldState.clock.schedule.length, n, "ten months went on the clock: " + JSON.stringify(worldState.clock.schedule.slice(-1)));
  assert.ok((memory.futureEvents || []).some(function (f) { return /jubilee/.test(f.what) && /10 months/.test(f.when); }), "the event was lost instead of kept pending: " + JSON.stringify(memory.futureEvents));
  assert.ok(mutsHave(r, /SCHEDULE:The king's jubilee.*not put on the clock/), JSON.stringify(r.muts));
});

// ── T5: which [TIME:] counts ───────────────────────────────────────────────────────────────────────────────────────
kase("T5: after a rest that names dawn, a reply that opened with [TIME:dusk] leaves the time of day at dawn and reports no clock mismatch", function () {
  fresh(); worldState.clock.min = 780 + 6 * 60;   // dusk
  var r = run("[TIME_CHECK:dusk][TIME:dusk] You make camp. [REST:long] [TIME:dawn] You wake to grey light.");
  assert.ok(!mutsHave(r, /reconcile SKIPPED/), "a false clock mismatch was reported: " + JSON.stringify(r.muts));
  assert.strictEqual(worldState.reconcileSkip, undefined, "the next turn would be told to rest again: " + JSON.stringify(worldState.reconcileSkip));
  assert.strictEqual(worldState.world.time, "dawn", "the time of day is stale: " + worldState.world.time);
});
kase("T5: a single [TIME:] is read as before", function () {
  fresh(); var r = run("[TIME:midday]");
  assert.strictEqual(worldState.world.time, "midday"); assert.ok(mutsHave(r, /Time: midday/));
});

// ── T6: malformed forms that used to vanish ────────────────────────────────────────────────────────────────────────
kase("T6: a common malformed tag is named to the player, not stripped in silence", function () {
  var forms = [["[REST]", /REST/], ["[REST:full]", /REST/], ["[QUEST:Find the cat]", /QUEST/], ["[NPC:Bram]", /NPC/], ["[NPC:Bram|calm|ally|extra]", /NPC/],
    ["[XP:-50]", /XP/], ["[GOLD:a few coppers]", /GOLD/], ["[SUBLOCATION_LEAVE:the inn]", /SUBLOCATION_LEAVE/]];
  forms.forEach(function (f) {
    fresh(); var r = run(f[0]);
    assert.ok(r.muts.some(function (m) { return /malformed — dropped/.test(m) && f[1].test(m); }), f[0] + " changed nothing and said nothing: " + JSON.stringify(r.muts));
  });
  fresh(); run("[COMBAT_START:Goblin|7|15|+4|1d6|skittish]");
  assert.ok(worldState.combat, "the fixture opened no fight");
  var r = run("[COMBAT_END]");
  assert.ok(worldState.combat, "a bare [COMBAT_END] closed the fight");
  assert.ok(mutsHave(r, /COMBAT_END.*malformed — dropped/), "a bare [COMBAT_END] with a fight open said nothing: " + JSON.stringify(r.muts));
});
kase("T6: the well-formed forms raise no malformed line", function () {
  fresh(); npc("Bram");
  var r = run("[NPC:Bram|calm|ally] [NPC:Bram|wary] [QUEST:Find the cat|active] [QUEST:Find the cat|completed|] [XP:5] [GOLD:+3] [GOLD:-2 sp] [REST:short] [SUBLOCATION_LEAVE]");
  assert.ok(!mutsHave(r, /malformed/), JSON.stringify(r.muts));
  fresh(); r = run("[REST:Long]");
  assert.ok(!mutsHave(r, /malformed/) && mutsHave(r, /Rest: healed/), JSON.stringify(r.muts));
});

// ── T7: the schedule's bounds ──────────────────────────────────────────────────────────────────────────────────────
kase("T7: the schedule refuses a 65th pending entry and an entry more than 100 years out, cuts an overlong label, and says each", function () {
  fresh(); var i, r;
  for (i = 0; i < 64; i++) scheduleAdd("Errand number " + i + " zq" + i + "x", (i + 1) + "d");
  assert.strictEqual(worldState.clock.schedule.length, 64, "the fixture's entries folded into each other: " + worldState.clock.schedule.length);
  r = run("[SCHEDULE:One errand too many|2d]");
  assert.strictEqual(worldState.clock.schedule.length, 64, "a 65th entry was added");
  assert.ok(mutsHave(r, /Not scheduled: One errand too many.*full/), JSON.stringify(r.muts));
  r = run("[SCHEDULE:Errand number 3 zq3x|9d]");
  assert.ok(!mutsHave(r, /Not scheduled/), "a refresh of an existing entry was refused at the cap: " + JSON.stringify(r.muts));
  fresh();
  r = run("[SCHEDULE:The comet returns|99999d]");
  assert.strictEqual(worldState.clock.schedule.length, 0, "an entry 274 years out was accepted");
  assert.ok(mutsHave(r, /Not scheduled: The comet returns.*100 years/), JSON.stringify(r.muts));
  fresh();
  var long = "The caravan " + new Array(700).join("x ") + "arrives";
  r = run("[SCHEDULE:" + long + "|2d]");
  assert.strictEqual(worldState.clock.schedule.length, 1);
  assert.ok(worldState.clock.schedule[0].label.length <= 200, "a " + worldState.clock.schedule[0].label.length + "-character label rides every prompt");
  assert.ok(mutsHave(r, /label cut to 200/), JSON.stringify(r.muts));
});
kase("T7: a future event the schedule refuses is kept as a pending event, not dropped", function () {
  fresh(); var i;
  for (i = 0; i < 64; i++) scheduleAdd("Errand number " + i + " zq" + i + "x", (i + 1) + "d");
  var before = (memory.futureEvents || []).length;
  fileFutureEvent("in 3 days", "", "The cult returns to Ashfen", worldState.turn);
  assert.strictEqual((memory.futureEvents || []).length, before + 1, "the event was filed nowhere");
  assert.ok(said.warns.some(function (l) { return /clock schedule refused/.test(l); }), "the refusal was silent");
});

// ── T8, T9: companions ─────────────────────────────────────────────────────────────────────────────────────────────
kase("T8: a companion's conditions and abilities compare names without case, as the hero's do", function () {
  fresh(); companion("Bram");
  run("[COMPANION_CONDITION:Bram|Poisoned|1 hour|spider bite]"); run("[COMPANION_CONDITION:Bram|poisoned|2 hours|spider bite]");
  assert.strictEqual(findCompanionChar("Bram").conditions.length, 1, "two conditions for one poisoning: " + JSON.stringify(findCompanionChar("Bram").conditions));
  var r = run("[COMPANION_CONDITION_REMOVED:Bram|POISONED]");
  assert.strictEqual(findCompanionChar("Bram").conditions.length, 0, "the cure removed nothing"); assert.ok(mutsHave(r, /Bram: cured/));
  run("[COMPANION_ABILITY:Bram|Second Wind|heal]"); run("[COMPANION_ABILITY:Bram|second wind|heal]");
  assert.strictEqual(findCompanionChar("Bram").abilities.length, 1, "the ability was added twice: " + JSON.stringify(findCompanionChar("Bram").abilities));
});
kase("T9: a companion's XP award is cut to ten times its level and the cut is said; an award inside the clamp lands whole", function () {
  fresh(); companion("Bram"); var cs = findCompanionChar("Bram"); cs.level = 2; cs.xp = 0;
  var r = run("[COMPANION_XP:Bram|5000]");
  assert.strictEqual(cs.xp, GM_XP_CAP_PER_LEVEL * 2, "Bram was paid " + cs.xp);
  assert.ok(mutsHave(r, /Bram: \+20 XP \(GM award 5000 clamped to 20\)/), JSON.stringify(r.muts));
  fresh(); companion("Bram"); cs = findCompanionChar("Bram"); cs.level = 2; cs.xp = 0;
  r = run("[COMPANION_XP:Bram|15]");
  assert.strictEqual(cs.xp, 15); assert.ok(mutsHave(r, /Bram: \+15 XP$/), JSON.stringify(r.muts));
});

// ── T10, T11 ───────────────────────────────────────────────────────────────────────────────────────────────────────
kase("T10: an absurd gold figure is refused, a foe's heal stops at its maximum, and a foe cannot be started at 0 HP", function () {
  fresh(); var coin = worldState.character.coin;
  var r = run("[GOLD:+" + new Array(320).join("9") + "]");
  assert.strictEqual(worldState.character.coin, coin, "the purse became " + worldState.character.coin);
  assert.ok(isFinite(worldState.character.coin)); assert.ok(mutsHave(r, /Gold refused/), JSON.stringify(r.muts));
  fresh(); run("[COMBAT_START:Goblin|7|15|+4|1d6|skittish]"); run("[ENEMY_HP:Goblin|-2]");
  run("[ENEMY_HP:Goblin|+50]");
  var foe = worldState.combat.enemies ? worldState.combat.enemies[0] : (worldState.combat.foes || [worldState.combat])[0];
  assert.ok(foe.hp <= 7, "a heal took the goblin to " + foe.hp + " of 7");
  fresh(); r = run("[COMBAT_START:Wisp|0|15|+4|1d6|skittish]");
  assert.ok(!worldState.combat, "a fight was opened with a foe at 0 HP");
  assert.ok(mutsHave(r, /COMBAT_START:Wisp.*refused.*1 HP/), JSON.stringify(r.muts));
});
kase("T11: a tag the tripwire calls dropped is not applied by a looser pattern beside it", function () {
  fresh(); npc("Bram");
  var r = run("[FUTURE_EVENT:The cult returns] Bram nods. [NPC:Bram|calm|ally]");
  assert.ok(mutsHave(r, /FUTURE_EVENT:\] malformed — dropped/), JSON.stringify(r.muts));
  assert.ok(JSON.stringify(memory.futureEvents || []).indexOf("cult returns") < 0 && JSON.stringify(worldState.clock || {}).indexOf("cult returns") < 0, "the tag the player was told was dropped was filed anyway");
  fresh(); r = run("[COMBAT_START:Goblin|7|15|+4|1d6] It snarls. [NPC:Bram|wary|ally]");
  assert.ok(mutsHave(r, /COMBAT_START:\] malformed — dropped/) && !worldState.combat, "said dropped, yet a fight is open");
});

// ── P1, P4: an opener that is never closed ─────────────────────────────────────────────────────────────────────────
kase("P1: in a review call an unclosed allowed tag does not carry a forbidden tag past the whitelist", function () {
  fresh(); var loc = worldState.world.location;
  var r = run("[QUEST:Find the cat|completed The cat is home. [LOCATION:Magnimar]", { allow: ["QUEST", "QUEST_STEP"] });
  assert.strictEqual(worldState.world.location, loc, "the party was moved to " + worldState.world.location + " from a review call");
  assert.ok(mutsHave(r, /LOCATION/) && mutsHave(r, /whitelist/), "the stripped tag was not named: " + JSON.stringify(r.muts));
});
kase("P4: an unclosed tag does not remove the prose after it from the story, files nothing, and is said; the tag after it is read on its own", function () {
  fresh(); npc("Bram"); var coin = worldState.character.coin;
  var text = "[NPC:Bram|calm You walk on through the rain. [GOLD:+3] The road bends.";
  var r = run(text);
  assert.ok(/You walk on through the rain\./.test(r.clean), "the prose after the unclosed tag is gone from the story: " + JSON.stringify(r.clean));
  assert.ok(/The road bends\./.test(r.clean) && r.clean.indexOf("[") < 0, JSON.stringify(r.clean));
  assert.ok(String(wsNpcByName("Bram").status || "").indexOf("walk on") < 0, "the prose became Bram's status: " + wsNpcByName("Bram").status);
  assert.strictEqual(worldState.character.coin - coin, 300, "the tag after the unclosed one was not applied on its own");
  assert.ok(mutsHave(r, /\[NPC:\] was never closed — ignored/), JSON.stringify(r.muts));
  assert.ok(said.warns.some(function (l) { return /never closed/.test(l); }));
  var ring = worldState.tagLog[worldState.tagLog.length - 1];
  assert.deepStrictEqual(ring.unclosed, ["NPC"], "the provenance ring does not record it: " + JSON.stringify(ring));
});
kase("P4: closed tags, bracketed prose and a tag cut off at the very end are untouched by the unclosed rule", function () {
  assert.strictEqual(tagDropUnclosed("[NPC:Bram|calm|ally] She said [sic] so. [GOLD:+3]"), "[NPC:Bram|calm|ally] She said [sic] so. [GOLD:+3]");
  assert.strictEqual(tagDropUnclosed("You listen. [SCH"), "You listen. [SCH");
  assert.strictEqual(tagDropUnclosed("You listen. [SCHEDULE:The bell|2"), "You listen. [SCHEDULE:The bell|2");
  assert.strictEqual(tagDropUnclosed("[HP:-3][GOLD:+1]"), "[HP:-3][GOLD:+1]");
  assert.strictEqual(tagDropUnclosed("[HP:-3 [GOLD:+1]"), "-3 [GOLD:+1]");
  assert.deepStrictEqual(tagDropUnclosed._last, ["HP"]);
  assert.strictEqual(tagDropUnclosed(null), null);
});

// ── P2, P3, P5 ─────────────────────────────────────────────────────────────────────────────────────────────────────
kase("P2: a model-written companion spell definition cannot open another tag — the party is not moved by an effect text", function () {
  fresh(); companion("Bram"); var loc = worldState.world.location;
  var resp = JSON.stringify({ spells: [{ nm: "Gloomshard Lance", lvl: 1, def: { tier: 1, effect: "A shard flies. [LOCATION:Magnimar] [GOLD:+500", range: "60 ft" } }] });
  var coin = worldState.character.coin, n = canonizeCompanionSpellDefs(resp, "Warrior", "Bram");
  assert.strictEqual(n, 1);
  assert.strictEqual(worldState.world.location, loc, "an effect text moved the party to " + worldState.world.location);
  assert.strictEqual(worldState.character.coin, coin, "an effect text paid the hero");
  assert.ok(worldState.capabilityBible["gloomshard lance"], "the definition itself was not filed");
  // the second lock: whatever the builder returns, this model-written text runs under the review whitelist — SPELL_DEF only
  var realTag = spellDefTag, resp2 = JSON.stringify({ spells: [{ nm: "Umbral Dart", lvl: 1, def: { tier: 1, effect: "a dart", range: "60 ft" } }] });
  spellDefTag = function () { return "[LOCATION:Magnimar][SPELL_DEF:Umbral Dart|tier=1|effect=a dart|range=60 ft]"; };
  try { canonizeCompanionSpellDefs(resp2, "Warrior", "Bram"); } finally { spellDefTag = realTag; }
  assert.strictEqual(worldState.world.location, loc, "a tag beside the definition moved the party to " + worldState.world.location);
  assert.ok(worldState.capabilityBible["umbral dart"], "the definition beside it was not filed");
  var tag = spellDefTag({ nm: "Lance [x]", lvl: 1, def: { tier: 1, effect: "a [b] c" } }, "Warrior");
  assert.strictEqual(tag.replace(/^\[/, "").replace(/\]$/, "").replace(/[^\[\]]/g, ""), "", "a bracket survives inside the tag: " + tag);
});
kase("P3: a tag written in lower case is not applied — one rule for case; an operand may be in any case", function () {
  fresh(); var t0 = clockNow(), hp = (worldState.character.hp = 1);
  var r = run("[rest:long] [alignment:good+2]", { allow: ["QUEST"] });
  assert.strictEqual(clockNow(), t0, "a lower-case [rest:long] rested the party through a whitelisted review call");
  assert.strictEqual(worldState.character.hp, hp);
  assert.ok(!worldState.character.alignGood, "a lower-case alignment tag moved the alignment");
  fresh(); companion("Bram");
  run("[companion_alignment:Bram|law+2]");
  assert.ok(!findCompanionChar("Bram").alignLaw, "a lower-case companion alignment tag was applied");
  fresh(); r = run("[ALIGNMENT:Good+1]");
  assert.strictEqual(worldState.character.alignGood, 1, "an upper-case tag with a mixed-case operand no longer applies");
  var src = fs.readFileSync(path.join(__dirname, "..", "tag_table.js"), "utf8"), bad = [], re = /\.(?:match|test|replace|exec)\(\s*\/\\\[[A-Z_]+[^\n\/]*\/[gm]*i[gm]*/g, m;
  while ((m = re.exec(src))) bad.push("line " + src.slice(0, m.index).split("\n").length + ": " + m[0].slice(0, 70));
  bad = bad.filter(function (b) { return !/DOWNED_RESOLVED:|LOCATION_STATE:/.test(b); });   // two read-only presence checks, mutating nothing
  assert.deepStrictEqual(bad, [], "a handler reads a tag NAME without regard to case");
});
kase("P5: a tag handler that throws is said to the player, reported and recorded on the provenance ring", function () {
  fresh(); var reports = [];
  reportError = function (ctx, msg) { reports.push(ctx + ": " + msg); };
  var entry = TAG_TABLE.filter(function (e) { return e.t === "WEATHER"; })[0] || TAG_TABLE.filter(function (e) { return e.t === "TIME"; })[0], orig = entry.apply;
  entry.apply = function () { throw new Error("boom in the handler"); };
  var r;
  try { r = run("[HP:-1] [" + entry.t + ":rain]"); } finally { entry.apply = orig; }
  assert.ok(mutsHave(r, /state change failed part-way.*boom in the handler/), "the player was told nothing: " + JSON.stringify(r.muts));
  assert.ok(reports.some(function (x) { return /tag-handler/.test(x) && /boom/.test(x); }), "no error report: " + JSON.stringify(reports));
  var ring = worldState.tagLog[worldState.tagLog.length - 1];
  assert.ok(ring.errors && /boom/.test(ring.errors[0]), "the ring has no record: " + JSON.stringify(ring));
});

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
todo.forEach(function (c) {
  try { c.fn(); passed++; realLog.call(console, "PASS #777 " + c.name); }
  catch (e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); }
});
if (failed) { realErr.call(console, "#777 tags: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
realLog.call(console, "ALL GREEN — " + passed + " #777 tag cases");
