// repair-t1788-bundle.js — the owner-ruled repair bundle for the t1788 live save (2026-08-13).
//
// Sources of authority: TODO #178/#179/#180/#184/#185/#186 rulings (owner, 2026-08-13:
// backfill · re-key per Sol's evidence set · drop the Shalelu objective · apply proposed
// allocations · strip the North Road clause), the action plan §5.2–§5.4
// (DOC/todos_completed/driftHardeningActionplan.html) and Sol's adjudication constraints
// (DOC/Research/driftHardeningActionplan_SOL.html §4: per-record allocation, complete
// preimages, no blind merges, no broad normalize sweeps).
//
// Usage:
//   node dev/repair-t1788-bundle.js <save.tnd>            — SURVEY: prints evidence + planned ops, writes NOTHING
//   node dev/repair-t1788-bundle.js <save.tnd> --apply    — executes; writes testRuns/*_REPAIRED.tnd + receipts JSON
//
// Every mutation is receipted {op, detail, preimage} and the full receipt set is archived
// into memory.archive.repairBundles as well as a sidecar JSON. NPC/location merges run
// through the SHIPPING identity executors (their own preimage archives apply on top).
var fs = require("fs"), path = require("path");
var eng = require("./load-engine.js");
eng.loadEngine();

var savePath = process.argv[2];
var APPLY = process.argv.indexOf("--apply") !== -1;
if (!savePath) { console.error("usage: node dev/repair-t1788-bundle.js <save.tnd> [--apply]"); process.exit(1); }
var save = JSON.parse(fs.readFileSync(path.resolve(savePath), "utf8"));
if (!save.worldState || save.worldState.turn !== 1788) { console.error("expected the t1788 export, got turn " + (save.worldState && save.worldState.turn)); process.exit(1); }

// headless UI stubs (the run-tests.js pattern) — checkCompanionLevelUp narrates via addMsg/showToast
global.addMsg = function () {}; global.showToast = function () {}; global.syncUI = function () {};
global.updateMemStatus = function () {}; global.saveAll = function () {}; global.carNotify = function () {};

global.worldState = save.worldState;
global.memory = save.memory;
global.sessionLog = save.sessionLog || [];
var ws = save.worldState, mem = save.memory;

var RECEIPTS = [];
function rec(op, detail, preimage) {
  var r = { op: op, detail: detail };
  if (preimage !== undefined) r.preimage = preimage;
  RECEIPTS.push(r);
  console.log((APPLY ? "  ✔ " : "  ▷ ") + op + " — " + detail);
}
function skip(op, why) { RECEIPTS.push({ op: op, skipped: why }); console.log("  ⊘ " + op + " — " + why); }
function sheetOf(name) { var i; for (i = 0; i < ws.npcs.length; i++) if (ws.npcs[i].name === name && ws.npcs[i].charSheet) return ws.npcs[i].charSheet; return null; }

console.log((APPLY ? "== APPLY ==" : "== SURVEY (dry-run) ==") + " t" + ws.turn + " " + ws.character.name + " (gender " + ws.character.gender + ")");

/* ── 1. #179: purge the four false t1666 core memories ─────────────────────────────── */
(function () {
  var sheets = [["player", ws.character]];
  ws.npcs.forEach(function (n) { if (n.partyMember && n.charSheet) sheets.push([n.name, n.charSheet]); });
  sheets.forEach(function (pair) {
    var cm = pair[1].coreMemories || [], hit = cm.filter(function (m) { return m.turn === 1666 && /Owed a favor/.test(m.text); });
    if (!hit.length) return;
    rec("coreMemoryPurge", pair[0] + ": remove " + hit.length + " false t1666 'Owed a favor' moment(s)", hit);
    if (APPLY) pair[1].coreMemories = cm.filter(function (m) { return !(m.turn === 1666 && /Owed a favor/.test(m.text)); });
  });
})();

/* ── 2. #178: Frizwick shared-XP back-fill (+14,600 → peer parity at 68,450) ───────── */
(function () {
  var fz = sheetOf("Frizwick"), da = sheetOf("Daeris"), mo = sheetOf("Morwen Zethran");
  if (!fz || !da || !mo) return skip("frizwickBackfill", "party sheet missing");
  var gap = da.xp - fz.xp;
  console.log("  [evidence] Frizwick " + fz.xp + " vs Daeris " + da.xp + " / Morwen " + mo.xp + " — gap " + gap + " (cls " + fz.cls + " lvl " + fz.level + ")");
  if (da.xp !== mo.xp) return skip("frizwickBackfill", "peers disagree (" + da.xp + " vs " + mo.xp + ") — ledger not clean");
  if (gap !== 14600) return skip("frizwickBackfill", "gap " + gap + " ≠ the documented 14,600 — re-derive before applying");
  rec("frizwickBackfill", "+14600 XP (peer-parity ledger: both co-companions hold 68,450; the supersede skip was the sole divergence mechanism — action plan §1.8, engine fix v1.614)", { xp: fz.xp, level: fz.level, hp: fz.hp, maxHp: fz.maxHp });
  if (APPLY) { fz.xp += 14600; checkCompanionLevelUp(fz); rec("frizwickLevelUp", "post-backfill: level " + fz.level + ", maxHp " + fz.maxHp + ", xp " + fz.xp); }
})();

/* ── 3. #184: re-key the Jorgenfist infiltration window (ridge → Jorgenfist) ───────── */
(function () {
  var pre = [], tr = ws.transcript;
  tr.forEach(function (e, i) { if (e.e && e.e.l === "Fogscar Mountains - Ridge Line" && e.t >= 1612 && e.t <= 1650) pre.push({ i: i, t: e.t, l: e.e.l }); });
  rec("jorgenfistRekey", pre.length + " transcript entries t1612–1650 e.l 'Fogscar Mountains - Ridge Line' → 'Jorgenfist' (Sol's evidence-supported set; 17 approach entries before t1612 stay on the ridge)", pre);
  if (APPLY) pre.forEach(function (p) { tr[p.i].e.l = "Jorgenfist"; });
})();

/* ── 4. misgendered chapter (t≈1644) — verify healed (Ammut is M; the bad text said "she") ── */
(function () {
  var cands = [];
  var RE = /[^.]*Ammut[^.]*\b(she|herself)\b[^.]*\./gi;
  (mem.chapters || []).forEach(function (c, i) { var m = (c.summary || "").match(RE); if (m) cands.push(["chapters[" + i + "] t" + c.turn, m]); });
  (mem.eras || []).forEach(function (c, i) { var m = (c.summary || "").match(RE); if (m) cands.push(["eras[" + i + "]", m]); });
  // sentences where "she/her" legitimately refers to a female companion are common — a match
  // here is EVIDENCE TO INSPECT (printed), never auto-rewritten.
  if (!cands.length) return skip("chapterPronounFix", "no Ammut-with-feminine-pronoun sentence survives in chapters or eras — the t1644 chapter text was healed when the W6-checked era compile ran (verified no-op)");
  cands.forEach(function (p) { console.log("  [INSPECT — not auto-fixed] " + p[0] + ": " + p[1].join(" | ").slice(0, 300)); });
  skip("chapterPronounFix", cands.length + " candidate sentence(s) printed for human inspection — feminine pronouns near Ammut usually refer to the three female companions; no automated rewrite is safe here");
})();

/* ── 5. #186: drop the stranded Shalelu objective (owner: "Drop it") ───────────────── */
(function () {
  var found = 0;
  (ws.questLog || []).forEach(function (q) {
    (q.objectives || []).forEach(function (o, i) {
      if (/Shalelu/i.test(o.text) && !o.done) {
        found++; rec("shaleluObjectiveDrop", "LIVE quest '" + q.title + "' objective removed: \"" + o.text + "\" (owner ruling: missed prerequisite, waived)", { quest: q.title, objective: o });
        if (APPLY) q.objectives.splice(i, 1);
      }
    });
  });
  Object.keys(mem.quests || {}).forEach(function (k) {
    var q = mem.quests[k];
    (q.objectives || []).forEach(function (o) {
      if (/Shalelu/i.test(o.text) && !o.done && !/\(waived/.test(o.text)) {
        found++; rec("shaleluObjectiveWaive", "archived quest '" + k + "' objective annotated waived: \"" + o.text + "\"", { quest: k, objective: JSON.parse(JSON.stringify(o)) });
        if (APPLY) o.text += " (waived — owner ruling 2026-08-13, missed prerequisite is not a completed one)";
      }
    });
  });
  if (!found) skip("shaleluObjective", "no un-done Shalelu objective found in live or archived quests");
})();

/* ── 6. map repairs through the shipping executors ─────────────────────────────────── */
function tryLocMerge(canonical, duplicate, why) {
  if (!mem.map.nodes[duplicate]) return skip("locMerge", duplicate + " absent — " + why);
  if (!mem.map.nodes[canonical]) return skip("locMerge", canonical + " (canonical) absent — " + why);
  rec("locMerge", duplicate + " → " + canonical + " (" + why + ")", JSON.parse(JSON.stringify(mem.map.nodes[duplicate])));
  if (APPLY) { var R = { muts: [], turn: ws.turn }; var ok = locMerge(canonical, duplicate, R); if (ok === false) rec("locMergeREFUSED", duplicate + ": " + R.muts.join("; ")); }
}
(function () {
  tryLocMerge("Sandpoint", "Sandpoint|Varisia", "inverted world twin — it IS Sandpoint; children + South Road edge come along");
  tryLocMerge("Varisia - North Road|Fogscar Mountains Tunnel", "Fogscar Mountains Tunnel", "world-node twin of the real sublocation record (plan §5.3)");
  tryLocMerge("Fogscar Mountains - Ridge Line|Fogscar Mountains - Sealed Forge Passage", "Fogscar Mountains - Sealed Forge Passage", "world-node twin of the real sublocation record (plan §5.3)");
  tryLocMerge("Magnimar|Justice Court — Ironbriar's Chambers", "Fogscar Mountains - Ridge Line|Justice Court — Ironbriar's Chambers", "post-plan discovery: t1760 revisit misfiled under the ridge — same room, shadow class");

  // reparents
  [["Varisia - North Road|Charred Barrel - Common Room", "Sandpoint|Charred Barrel"],
   ["Varisia - North Road|Charred Barrel - Hidden Passage", "Sandpoint|Charred Barrel"],
   ["Jorgenfist - Runeforge", "Jorgenfist"]].forEach(function (p) {
    var k = p[0], parent = p[1];
    if (!mem.map.nodes[k]) return skip("locReparent", k + " absent");
    if (!mem.map.nodes[parent]) return skip("locReparent", "parent " + parent + " absent");
    rec("locReparent", k + " → parent " + parent + " (plan §5.3: the Charred Barrel is in Sandpoint; the Runeforge is inside Jorgenfist)", { parent: mem.map.nodes[k].parent });
    if (APPLY) { var R = { muts: [], turn: ws.turn }; var ok = locReparent(k, parent, R); if (ok === false) rec("locReparentREFUSED", k + ": " + R.muts.join("; ")); }
  });

  // North Road frozen-hour description re-scope (owner: strip the clause)
  var nr = mem.map.nodes["Varisia - North Road"];
  var CLAUSE = ", shuttered and dark this hour, iron grate pulled across the door";
  if (nr && nr.description && nr.description.indexOf(CLAUSE) !== -1) {
    rec("locDescRescope", "Varisia - North Road: strip the frozen hour-specific clause from the write-once description", { description: nr.description });
    if (APPLY) nr.description = nr.description.split(CLAUSE).join("");
  } else skip("locDescRescope", "clause not present verbatim");

  // ghost-cottage edge + any parent↔own-descendant edges
  function isAncestor(a, b) { var seen = {}, k = b; while (k && !seen[k]) { seen[k] = 1; var n = mem.map.nodes[k]; if (!n) return false; if (n.parent === a) return true; k = n.parent; } return false; }
  var kept = [], removed = [];
  (mem.map.edges || []).forEach(function (e) {
    var ghost = !mem.map.nodes[e.from] || !mem.map.nodes[e.to];
    var pc = !ghost && (isAncestor(e.from, e.to) || isAncestor(e.to, e.from));
    if (ghost || pc) removed.push({ edge: e, why: ghost ? "ghost endpoint" : "parent↔own-descendant" }); else kept.push(e);
  });
  if (removed.length) {
    rec("edgeCleanup", removed.length + " edge(s) removed: " + removed.map(function (r) { return r.edge.from + "<->" + r.edge.to + " (" + r.why + ")"; }).join("; "), removed);
    if (APPLY) mem.map.edges = kept;
  } else skip("edgeCleanup", "no ghost or parent-child edges found");

  // Jorgenfist filing: firstVisit + the two stateNotes (edges already exist: t1737/t1745)
  var jf = mem.map.nodes["Jorgenfist"];
  if (jf) {
    if (jf.firstVisit == null) { rec("jorgenfistFirstVisit", "firstVisit null → 1612 (the infiltration's first in-fortress turn)", { firstVisit: jf.firstVisit, visits: jf.visits }); if (APPLY) jf.firstVisit = 1612; }
    var notes = jf.stateNotes || [];
    // the death note was already filed IN PLAY at t1743 ("Mokmurian's body lies dead before the
    // shattered lectern…") — only append what no existing note covers.
    if (notes.some(function (x) { return /Mokmurian/.test(x.n) && /dead|body/.test(x.n); }))
      skip("jorgenfistStateNote", "death note already filed in play (t1743) — richer than the plan's line, kept as is");
    else { rec("jorgenfistStateNote", "append: Mokmurian is dead; the fortress stands leaderless"); if (APPLY) notes.push({ n: "Mokmurian is dead; the fortress stands leaderless and the giant alliance is broken", t: 1788 }); }
    if (!notes.some(function (x) { return /library/i.test(x.n) && /burn/i.test(x.n); })) {
      rec("jorgenfistStateNote", "append: The Thassilonian library burned during the confrontation");
      if (APPLY) notes.push({ n: "The Thassilonian library burned during the confrontation", t: 1788 });
    } else skip("jorgenfistStateNote", "library-fire note already present");
    if (APPLY) jf.stateNotes = notes.slice(-3);
  }
})();

/* ── 7. Collector three-way split (Sol: HUMAN SPLIT — individual / mantle / operative) ─ */
(function () {
  var KEY = "Marta / The Scarred Woman / The Collector", STR = "The Scarred Stranger (Black-Eyed Man)";
  var m = mem.npcs[KEY], s = mem.npcs[STR];
  if (!m) return skip("collectorSplit", KEY + " absent");
  if (!s) return skip("collectorSplit", STR + " absent — successor fold target missing");
  var K = m.knowledge || [];
  if (K.length !== 12) return skip("collectorSplit", "expected the 12 surveyed rows, found " + K.length + " — re-survey before applying");
  var MARTA = [0, 2, 4, 10, 11], MANTLE = [1, 3], SUCC = [5, 6, 7, 8, 9];
  rec("collectorSplit", "12 rows allocated — Marta keeps [" + MARTA + "] (person: appearance, Chask identification, Whisperwood walk, warehouse role, Marasova alias); mantle gets [" + MANTLE + "] (seventh-cycle lore, vessel/binding nature); successor '" + STR + "' gets [" + SUCC + "] (post-t1422: Daeris's-agents ID, warehouse watch, Hemlock flank, extraction watch, knows-Ammut). Content-based allocation — rows carry no turn stamps; noted honestly.", JSON.parse(JSON.stringify(m)));
  if (!APPLY) return;
  var pick = function (ix) { return ix.map(function (i) { return K[i]; }); };
  var mantle = { attitude: "an office, not a person", knowledge: pick(MANTLE).concat(["The Collector is a mantle passed between operatives of the closed-eye circuit; Marta held it until her death (t414); a successor now wears it."]), events: [] };
  if (!mem.npcs["The Collector (mantle)"]) { mem.npcs["The Collector (mantle)"] = mantle; rec("collectorMantleRecord", "created 'The Collector (mantle)' with rows [" + MANTLE + "] + succession note"); }
  s.knowledge = (s.knowledge || []).concat(pick(SUCC));
  s.events = (s.events || []).concat(["Succeeded Marta as the Collector after her death (t414)."]);
  m.knowledge = pick(MARTA);
  m.dead = 414;
  var wsRec = null; ws.npcs.forEach(function (n) { if (n.name === KEY) wsRec = n; });
  if (wsRec) { wsRec.dead = 414; wsRec.status = "dead"; }
  rec("collectorDeathBackdate", "Marta record stamped dead:414 in both stores (the t414 Whisperwood death; the live successor is '" + STR + "')");
})();

/* ── 8. Ilvane/Grafter merge (one person, evidence: 'Revealed her name is Ilvane Threcker') ─ */
(function () {
  if (!mem.npcs["Ilvane"] || !mem.npcs["Grafter"]) return skip("ilvaneGrafterMerge", "one of the pair is absent");
  rec("ilvaneGrafterMerge", "[MERGE:npc|Ilvane|Grafter] through the shipping executor (armed pair) — Grafter's own row names her 'Ilvane Threcker'; alias, interrogation intel and the t1499 death stamp all survive on the canonical record", { grafter: JSON.parse(JSON.stringify(mem.npcs["Grafter"])) });
  if (!APPLY) return;
  ws.mergeConfirmArmed = { canonical: "Ilvane", duplicate: "Grafter", turn: ws.turn };
  var R = applyMuts("[NPC_MERGE:Ilvane|Grafter]");
  rec("ilvaneGrafterMergeResult", (R && R.muts ? R.muts.join("; ") : "no muts line") + (mem.npcs["Grafter"] ? " — ⚠ Grafter STILL PRESENT" : " — Grafter folded"));
})();

/* ── 9. Savah split: the Magnimar apothecary's rows move to her own record ─────────── */
(function () {
  var sv = mem.npcs["Savah"]; if (!sv) return skip("savahSplit", "Savah absent");
  var K = sv.knowledge || [];
  if (K.length !== 8) return skip("savahSplit", "expected the 8 surveyed rows, found " + K.length + " — re-survey");
  var MOVE = [5, 6, 7]; // poison-vs-giants, erase-a-person, ten paralytic vials
  var NEW = "Magnimar Apothecary (Wormwood's)";
  rec("savahSplit", "rows [" + MOVE + "] (giant poison inquiry, 'erase' inquiry, ten paralytic vials) move to '" + NEW + "' — corroboration: the Wormwood's Apothecary node exists under Magnimar and the party carries 10 contact-paralytic vials + 3 giant's bane; Savah keeps the armorer/smith rows (charges, wedding ring)", JSON.parse(JSON.stringify(sv)));
  if (!APPLY) return;
  if (!mem.npcs[NEW]) mem.npcs[NEW] = { attitude: "transactional, unbothered", knowledge: [], events: [], lastSeenAt: "Magnimar|Wormwood's Apothecary" };
  MOVE.forEach(function (i) { mem.npcs[NEW].knowledge.push(K[i]); });
  sv.knowledge = K.filter(function (_, i) { return MOVE.indexOf(i) < 0; });
  mem.npcs[NEW].knowledge.push("These dealings were previously misfiled on Savah (Sandpoint's armorer) — reallocated by the 2026-08-13 repair bundle.");
})();

/* ── 10. Sable: minimal memory-only identity with evidence turns ───────────────────── */
(function () {
  if (mem.npcs["Sable"]) return skip("sableRegister", "record already exists");
  var hits = [];
  ws.transcript.forEach(function (e) { if (/\bSable\b/.test(e.x || "")) hits.push(e.t); });
  var turns = hits.filter(function (t, i) { return hits.indexOf(t) === i; });
  console.log("  [evidence] Sable transcript mentions at turns: " + (turns.join(", ") || "(none)"));
  if (!turns.length) return skip("sableRegister", "no transcript mentions found — nothing to key");
  rec("sableRegister", "memory-only record created citing turns " + turns.join(", ") + " (no current-location stamp, no roster entry — Sol's constraint for offstage figures)");
  if (APPLY) mem.npcs["Sable"] = { attitude: "unknown — never met on-screen", knowledge: ["Named in play at turns " + turns.join(", ") + "; an offstage figure of the closed-eye circuit thread. Registered by the 2026-08-13 repair bundle so retrieval can key her; facts should accrue only from actual scenes."], events: [] };
})();

/* ── 11. memory.npcs["Ammut"] — the player is not an NPC record ────────────────────── */
(function () {
  var a = mem.npcs["Ammut"]; if (!a) return skip("ammutRecordDelete", "already absent");
  rec("ammutRecordDelete", "player self-record removed from memory.npcs (attitude '" + a.attitude + "', " + (a.knowledge || []).length + " knowledge rows) — full preimage archived; deed rows carry no turn stamps so nothing is synthesized into storyBeats (Sol: provenance cannot be reconstructed)", JSON.parse(JSON.stringify(a)));
  if (!APPLY) return;
  delete mem.npcs["Ammut"];
  if (mem.nameIdx) Object.keys(mem.nameIdx).forEach(function (k) { if (mem.nameIdx[k] === "Ammut") delete mem.nameIdx[k]; });
})();

/* ── 12. inventory ledger (item-by-item, per Sol) ──────────────────────────────────── */
(function () {
  var inv = ws.character.inventory;
  function dropRow(row, why) {
    var i = inv.indexOf(row);
    if (i < 0) return skip("invDrop", JSON.stringify(row) + " not found");
    rec("invDrop", "\"" + row + "\" — " + why);
    if (APPLY) inv.splice(inv.indexOf(row), 1);
  }
  // duplicate satchel (richer row survives)
  dropRow("Closed-eye satchel (Jorgenfist)", "duplicate of the richer 'Closed-eye satchel — stolen from Jorgenfist's ritual chamber' row (plan §5.2)");
  // blade rows: verify the t1782 three-for-two state resolved itself
  var blades = inv.filter(function (r) { return /runeforged|runeblade|Cleaver/i.test(r); });
  if (blades.length === 2) skip("invBladeDedup", "already resolved in play — exactly 2 rows for 2 blades: " + blades.join(" · "));
  else rec("invBladeCHECK", "⚠ " + blades.length + " blade rows — inspect: " + blades.join(" · "));
  // flasks 0 (plan §5.2: the phantom-consumable finding — all narrated as used)
  dropRow("Alchemist's fire x5", "count set to 0 per canon (plan §5.2 'flasks 0' — the phantom-consumable class: uses narrated, count never decremented)");
  // blasting charges per canon: sole acquisition = Savah's four (rows S1/S2); survey prints usage evidence
  var chg = [];
  ws.transcript.forEach(function (e) { if (/blasting charge|blasting-charge/i.test(e.x || "")) chg.push({ t: e.t, s: String(e.x).match(/[^.]*blasting[- ]charge[^.]*\./i) && String(e.x).match(/[^.]*blasting[- ]charge[^.]*\./i)[0].trim().slice(0, 160) }); });
  console.log("  [evidence] blasting-charge transcript mentions (" + chg.length + "):");
  chg.forEach(function (c) { console.log("    t" + c.t + ": " + (c.s || "")); });
  skip("invChargeCount", "LEFT AS-IS at x12 — the transcript shows MULTIPLE acquisition batches (four from Thistletop by t389, Savah's four, four more from Hemlock at t1288, a count of eleven-between-you at t767) and uncounted uses (six packed into the mechanism at t657); no single canon number is derivable, and replacing observed drift with a guess is exactly what Sol's constraint forbids");
  // wedding ring → Daeris
  var RING = "Wedding ring — rushed silver filigree, matching set, for Daeris";
  if (inv.indexOf(RING) >= 0) {
    var daer = sheetOf("Daeris");
    rec("invRingToDaeris", "\"" + RING + "\" moves Ammut → Daeris (the row names its owner; plan §5.2)");
    if (APPLY && daer) { inv.splice(inv.indexOf(RING), 1); daer.inventory.push("Wedding ring — rushed silver filigree, matching set"); }
  } else skip("invRingToDaeris", "row not found");
  // silvered arrow → Morwen
  if (inv.indexOf("Silvered arrow") >= 0) {
    var mor = sheetOf("Morwen Zethran");
    rec("invArrowToMorwen", "\"Silvered arrow\" moves Ammut → Morwen (plan §5.2)");
    if (APPLY && mor) { inv.splice(inv.indexOf("Silvered arrow"), 1); mor.inventory.push("Silvered arrow"); }
  } else skip("invArrowToMorwen", "row not found");
  // Frizwick rows: fact-as-item + the settled iron key
  var fz = sheetOf("Frizwick");
  if (fz) {
    var LOFT = "confirmed loft position clear";
    if (fz.inventory.indexOf(LOFT) >= 0) { rec("invFactRowDrop", "Frizwick: \"" + LOFT + "\" removed — a fact, not an item (plan §5.2)"); if (APPLY) fz.inventory.splice(fz.inventory.indexOf(LOFT), 1); }
    var KEYROW = "Iron key — Tharwick's office lockbox key, currently held by Ammut";
    if (fz.inventory.indexOf(KEYROW) >= 0) {
      rec("invIronKeySettle", "the Tharwick lockbox key row moves Frizwick → Ammut (the row itself records Ammut as holder — that IS the one-row evidence ledger)");
      if (APPLY) { fz.inventory.splice(fz.inventory.indexOf(KEYROW), 1); inv.push("Iron key — Tharwick's office lockbox key"); }
    }
  }
})();

/* ── 13. storyBeats: camp backfill + the 45/47 duplicate + the Tharwick claim note ──── */
(function () {
  var sb = ws.character.storyBeats || [], noCamp = sb.filter(function (b) { return !b.camp; });
  rec("storyBeatsCampBackfill", noCamp.length + " beats stamped camp='" + ws.campId + "' — Ammut is this campaign's native PC (every beat turn 1–1788 falls inside this campaign's transcript; no import history), so provenance is by construction, not a guess");
  if (APPLY) noCamp.forEach(function (b) { b.camp = ws.campId; });
  var b45 = sb[45], b47 = sb[47];
  if (b45 && b47 && /consummate their connection the night the Tally Court/.test(b45.text) && /consummate their connection the night the Tally Court/.test(b47.text)) {
    rec("storyBeatDedup", "beats[47] t" + b47.turn + " removed — duplicate of beats[45] t" + b45.turn + " (plan §5.4 names this exact pair)", b47);
    if (APPLY) sb.splice(47, 1);
  } else skip("storyBeatDedup", "the 45/47 pair no longer matches the plan's description — indexes moved?");
  var th = [];
  sb.forEach(function (b, i) { if (/Tharwick/i.test(b.text)) th.push([i, b]); });
  th.forEach(function (p) { console.log("  [evidence] Tharwick beat [" + p[0] + "] t" + p[1].turn + ": " + String(p[1].text).slice(0, 140)); });
  th.forEach(function (p) {
    if (/circuit ledger|counter-claim|claim/i.test(p[1].text) && !/\[superseded/.test(p[1].text)) {
      rec("tharwickBeatNote", "beats[" + p[0] + "] annotated superseded (plan §5.4: leave the beat, note it)", { text: p[1].text });
      if (APPLY) p[1].text += " [superseded — the Zethran counter-claim was later crossed out; see Tharwick's NPC record]";
    }
  });
})();

/* ── 14. futureEvents + world.time ─────────────────────────────────────────────────── */
(function () {
  var blob = JSON.stringify(mem.futureEvents || []);
  if (!/black.?water|bathhouse/i.test(blob)) skip("futureEventsConsumed", "the plan's two consumed entries (black-water, bathhouse) are already gone from futureEvents — resolved in play before t1788");
  // TIME_PHASES semantics: elapsed-of-day is DAWN-ANCHORED (minute 0 ≡ 6 AM). world.time agrees
  // with the clock when its phrase's band contains the current elapsed-of-day minute.
  var clock = ws.clock && ws.clock.min;
  if (typeof clock === "number") {
    var eod = clock % 1440, cur = String(ws.world.time || ""), inBand = false, holder = null;
    TIME_PHASES.forEach(function (p) { if (!holder && p.re.test(cur)) { holder = p; inBand = eod >= p.b0 && eod < p.b1; } });
    if (holder && inBand) skip("worldTimeSync", "world.time '" + cur + "' is IN BAND for elapsed-of-day minute " + eod + " (dawn-anchored) — already agrees with the clock");
    else if (!holder) skip("worldTimeSync", "world.time '" + cur + "' maps to no TIME_PHASES entry (flavor text) — left alone per the #131 ruling");
    else {
      var tgt = null;
      TIME_PHASES.forEach(function (p) { if (!tgt && eod >= p.b0 && eod < p.b1) tgt = p; });
      var label = tgt ? String(tgt.re).replace(/^\/|\/i$/g, "").split("|")[0].replace(/\\s\*?/g, " ") : cur;
      rec("worldTimeSync", "world.time '" + cur + "' out of band (elapsed-of-day " + eod + ") → '" + label + "' — plan §5.2, until W5 derivation ships", { time: cur });
      if (APPLY) ws.world.time = label;
    }
  }
})();

/* ── receipts out ──────────────────────────────────────────────────────────────────── */
console.log("\n" + RECEIPTS.length + " receipt rows (" + RECEIPTS.filter(function (r) { return r.skipped; }).length + " skips).");
if (APPLY) {
  if (!mem.archive) mem.archive = {};
  if (!mem.archive.repairBundles) mem.archive.repairBundles = [];
  mem.archive.repairBundles.push({ id: "t1788-bundle", date: "2026-08-13", rulings: "TODO #178/#179/#180/#184/#185/#186 (owner, 2026-08-13)", receipts: RECEIPTS });
  var out = path.join(__dirname, "..", "testRuns", "Rise_of_the_Runelords_fixme_t1788_REPAIRED.tnd");
  fs.writeFileSync(out, JSON.stringify(save));
  fs.writeFileSync(path.join(__dirname, "..", "testRuns", "repair_t1788_receipts.json"), JSON.stringify(RECEIPTS, null, 2));
  console.log("written: " + out + "\nwritten: testRuns/repair_t1788_receipts.json");
} else {
  console.log("DRY RUN — nothing written. Re-run with --apply.");
}
