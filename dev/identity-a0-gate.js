// identity-a0-gate.js — TODO #156 Phase A0: the REPRESENTATION GATE (DOC/identity_hardening_fable.html §7.2).
//
// An EVIDENCE SPIKE, not shipping code. Nothing here is loaded by index.html, nothing here
// mutates a real save: the t1593 clone is read from testRuns/, deep-cloned in memory, and all
// output goes to console + testRuns/identity_a0_results_t1593.json.
//
// WHAT IT DOES — implements the location `merge` operation TWICE against the same cloned
// t1593 state and measures both:
//   ARM 1 "rekey"  — name-keys retained; merge rewrites EVERY structural reference to the
//                    duplicate's key (and its descendants' keys) across the whole state.
//   ARM 2 "ids"    — additive domain IDs; a ONE-TIME migration moves every structural
//                    reference to opaque ids (id → {name, aliases}); merge then touches the
//                    identity table + the node-record fold only, and references resolve
//                    through merge tombstones at read time.
// One shared assertion battery (resolution-level predicates + per-arm adapters) runs against
// both arms; it is first run against a NO-OP merge to prove every merge-outcome assertion
// CAN fail (failing-tests-first, §7.6). The same field-merge rules (§7.4: firstVisit min,
// lastVisit max, visits sum, canonical description wins, stateNotes chronological under
// LOC_STATE_CAP with eviction-archive, items concat with case-insensitive dedupe,
// size/travelMins canonical-wins-unless-null) are ONE shared function used by both arms, so
// neither arm wins by having different semantics.
//
// USAGE:  node dev/identity-a0-gate.js [path/to/save.tnd]
//   (default save: testRuns/Rise_of_the_Runelords__Ammut__Ammut_t1593.tnd)
//
// The structural-reference inventory (REFERENCE_CLASSES below) is the A0 deliverable that
// Phase B's migration-test battery derives from. Sol §4's list was the seed; every class was
// verified against the code (writer sites cited per class). The DEEP SCAN is the honesty
// check on the inventory itself: after each arm-1 merge the entire serialized state is walked
// for the dead keys as exact string values outside whitelisted prose paths — a hit means a
// reference class this inventory missed.

var fs = require("fs"), path = require("path");
var eng = require("./load-engine.js");
eng.loadEngine("globals.js"); // constants only (LOC_STATE_CAP) — no engine behavior is driven here
var CAP = (typeof LOC_STATE_CAP === "number") ? LOC_STATE_CAP : 3;

var SAVE = process.argv[2] || path.join(eng.ROOT, "testRuns", "Rise_of_the_Runelords__Ammut__Ammut_t1593.tnd");
var RESULTS_PATH = path.join(eng.ROOT, "testRuns", "identity_a0_results_t1593.json");

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hash(s) { // djb2 — prose-integrity fingerprint, no crypto needed
  var h = 5381, i; s = String(s);
  for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// ── THE STRUCTURAL-REFERENCE INVENTORY ──────────────────────────────────────────────────────
// Every place a location IDENTITY is stored in the .tnd blob (writer sites cited). Display
// reads (buildGeoBlock, map_viewer, affordance gate…) consume these stores live and are not
// separate classes. scope:"derived" = rewritten wholesale from live state on every save —
// self-healing after a merge, no migration needed (asserted nowhere here, documented in the
// audit). scope:"prose" = history by ruling (Sol §4: narrative text is evidence, not a
// foreign key) — excluded from rewriting AND asserted byte-unchanged.
var REFERENCE_CLASSES = [
  { id: "F1",  cls: "memory.map.nodes keys",              shape: "world \"Name\" | sub \"Parent|Sub\" (3–4 segment keys exist in the wild via pipe-bearing [SUBLOCATION:] text)", writers: "memory.js:183 fileLocation, :198 fileSubLocation, :220 fileLocationState, tag_table.js:774 PARTY_SPLIT, game.js:38 boot-heal" },
  { id: "F2",  cls: "node.parent",                        shape: "world name (or null; real data also holds full sub keys — Sandpoint|Varisia children)", writers: "memory.js:198 (world.location), :220 (key.split(\"|\")[0])" },
  { id: "F3",  cls: "node.npcs[]",                        shape: "NPC names on the node (merge: union)", writers: "memory.js:258 mapNpcLocation, tag_table.js:776" },
  { id: "F4",  cls: "node.items[]",                       shape: "{name, placed, taken} — reads are FIRST case-insensitive name match", writers: "memory.js:236 fileLocationItem" },
  { id: "F5",  cls: "node.stateNotes[]",                  shape: "{n, t} cap LOC_STATE_CAP=" + CAP + ", evictions → memory.archive.locationStates", writers: "memory.js:214 fileLocationState" },
  { id: "F6",  cls: "node scalar fields",                 shape: "description (write-once), firstVisit, lastVisit, visits, size, travelMins", writers: "memory.js:183/199/205, tag_table.js:290 LOCATION_SIZE" },
  { id: "F7",  cls: "memory.map.edges[].from/to",         shape: "world names BY DESIGN, but full sub keys exist in the wild (Choke Gully, Sandpoint|Varisia); ghosts exist (endpoint with no node)", writers: "memory.js:191 fileLocation" },
  { id: "F8",  cls: "memory.map.lastArrivalFrom",         shape: "world name", writers: "memory.js:188" },
  { id: "F9",  cls: "memory.locations keys",              shape: "world names BY DESIGN; pipe keys exist in the wild. {visited[], notes[] cap5}", writers: "memory.js:175 fileLocation" },
  { id: "F10", cls: "worldState.world.location",          shape: "world name", writers: "tag_table.js:247 LOCATION, sync modal, game.js:1879 blueprint" },
  { id: "F11", cls: "worldState.world.sublocation",       shape: "BARE sub name (currentNodeKey composes loc+\"|\"+sub — a sub rename must rewrite the bare name here)", writers: "tag_table.js:260/261" },
  { id: "F12", cls: "charSheet.splitLoc",                 shape: "{location: world name, sublocation: BARE name|null, turn, audited?}", writers: "tag_table.js:765 PARTY_SPLIT" },
  { id: "F13", cls: "memory.npcs[*].lastSeenAt",          shape: "FULL node key (world or Parent|Sub)", writers: "memory.js:259, tag_table.js:758/777/870" },
  { id: "F14", cls: "worldState.combat.node",             shape: "full node key (where the fight started, #149)", writers: "tag_table.js:452 COMBAT_START" },
  { id: "F15", cls: "worldState.pendingLocState.node",    shape: "full node key (aftermath anchor)", writers: "tag_table.js:535/542" },
  { id: "F16", cls: "worldState.locDescNudged keys",      shape: "full node key → turn (nudge latch)", writers: "api.js:311-313 buildLocationDescNudge" },
  { id: "F17", cls: "transcript[*].e.l",                  shape: "WORLD name at log time (RAG scene stamp; pipe-key values exist in the wild — 109 × \"Sandpoint|Varisia\")", writers: "memory.js:496 logTranscript-side stamp" },
  { id: "F18", cls: "memory.archive.locationStates[].node", shape: "full node key (evicted state-note provenance)", writers: "memory.js:233" },
  { id: "F19", cls: "campaign meta entry.location",       shape: "world name snapshot in tnd_camps_v1", writers: "state.js:506 updateCampMeta", scope: "derived" },
  { id: "F20", cls: "blueprint export locations[]/startingLocation", shape: "world names at export time", writers: "game.js:1761-1782", scope: "derived" },
  { id: "F21", cls: ".tnd import whitelist",              shape: "ui-files.js importSave memory allowlist — memory.archive.identityMerges is NOT whitelisted yet; Phase A must add it or pre-images die on .tnd round-trip", writers: "ui-files.js:479", scope: "code" },
  { id: "F22", cls: "narrative prose",                    shape: "transcript x, npc knowledge/events/firstEncounter, chapters, lore, decisions, quest text, futureEvents, storyBeats, coreMemories, schedule labels, tagLog, eventHistory, node.description text, stateNotes text, memory.locations notes", writers: "(everywhere)", scope: "prose" }
];

// Deep-scan prose whitelist — path regexes where an old key string may legitimately survive
// as history. Everything else holding the dead key EXACTLY is a missed reference class.
var PROSE_PATHS = [
  /^worldState\.transcript\[\d+\]\.x$/,
  /^worldState\.eventHistory\[\d+\]$/,
  /^worldState\.questLog\[\d+\]\.(desc|title)$/,
  /^worldState\.questLog\[\d+\]\.objectives\[\d+\]\.text$/,
  /^worldState\.tagLog\[\d+\]\.m\[\d+\]$/,
  /^worldState\.lastActions\[\d+\]/,
  /^worldState\.character\.(backstory|storyBeats\[\d+\]\.text|coreMemories\[\d+\]\.text)$/,
  /^worldState\.npcs\[\d+\]\.charSheet\.(backstory|storyBeats\[\d+\]\.text|coreMemories\[\d+\]\.text)$/,
  /^worldState\.clock\.schedule\[\d+\]\.label$/,
  /^memory\.npcs\..*\.(knowledge\[\d+\]|events\[\d+\]\.note|firstEncounter)$/,
  /^memory\.(lore|chapters|keyDecisions|futureEvents|quests)\b/,
  /^memory\.locations\..*\.notes\[\d+\]$/,
  /^memory\.map\.nodes\..*\.(description|stateNotes\[\d+\]\.n)$/,
  /^memory\.archive\.(?!locationStates\b)/,           // archive prose (lore/decisions/chapters/superseded/npcKnowledge/npcEvents/coreMemories/…)
  /^memory\.archive\.locationStates\[\d+\]\.note$/,    // …but locationStates .node stays structural
  /^memory\.archive\.identityMerges\b/,                // the pre-image archive holds old keys ON PURPOSE
  /^sessionLog\[\d+\]\.content$/
];
function isProsePath(p) { var i; for (i = 0; i < PROSE_PATHS.length; i++) { if (PROSE_PATHS[i].test(p)) return true; } return false; }

// Walk the whole state for exact-string occurrences of deadKeys outside prose paths.
function deepScan(state, deadKeys) {
  var dead = {}, hits = [], i;
  for (i = 0; i < deadKeys.length; i++) dead[deadKeys[i]] = 1;
  function walk(v, p) {
    var k;
    if (typeof v === "string") { if (dead[v] && !isProsePath(p)) hits.push({ path: p, value: v }); return; }
    if (Array.isArray(v)) { for (k = 0; k < v.length; k++) walk(v[k], p + "[" + k + "]"); return; }
    if (v && typeof v === "object") {
      for (k in v) {
        if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
        if (dead[k] && !isProsePath(p + "." + k)) hits.push({ path: p + ".<key>", value: k });
        walk(v[k], p + "." + k);
      }
    }
  }
  walk(state.worldState, "worldState"); walk(state.memory, "memory"); walk(state.sessionLog || [], "sessionLog");
  return hits;
}

// Prose-integrity fingerprint (F22): narrative is history, never rewritten by a merge.
function proseHash(state) {
  var parts = [], i, k;
  var tr = state.worldState.transcript || [];
  for (i = 0; i < tr.length; i++) parts.push(tr[i].x || "");
  var np = state.memory.npcs || {};
  for (k in np) { parts.push((np[k].knowledge || []).join("")); var ev = np[k].events || []; for (i = 0; i < ev.length; i++) parts.push(ev[i].note || ""); parts.push(np[k].firstEncounter || ""); }
  return hash(parts.join(""));
}

// ── SHARED FIELD-MERGE RULES (§7.4 — one function, both arms) ───────────────────────────────
function foldNodeRecords(canonNode, dupNode, archiveList, canonLabel) {
  var t = { items: 0, notes: 0, npcs: 0, evicted: 0 };
  if (dupNode.firstVisit != null && (canonNode.firstVisit == null || dupNode.firstVisit < canonNode.firstVisit)) canonNode.firstVisit = dupNode.firstVisit;
  if (dupNode.lastVisit != null && (canonNode.lastVisit == null || dupNode.lastVisit > canonNode.lastVisit)) canonNode.lastVisit = dupNode.lastVisit;
  canonNode.visits = (canonNode.visits || 0) + (dupNode.visits || 0);
  if (!canonNode.description && dupNode.description) canonNode.description = dupNode.description; // canonical wins; null takes dup's
  if (canonNode.size == null && dupNode.size != null) canonNode.size = dupNode.size;
  if (canonNode.travelMins == null && dupNode.travelMins != null) canonNode.travelMins = dupNode.travelMins;
  var i, j, seen;
  var dn = dupNode.npcs || [];
  canonNode.npcs = canonNode.npcs || [];
  for (i = 0; i < dn.length; i++) { if (canonNode.npcs.indexOf(dn[i]) < 0) { canonNode.npcs.push(dn[i]); t.npcs++; } }
  var di = dupNode.items || [];
  canonNode.items = canonNode.items || [];
  for (i = 0; i < di.length; i++) { // concat + case-insensitive dedupe (no cap exists — Sol §4 stands corrected in §7.0)
    seen = false;
    for (j = 0; j < canonNode.items.length; j++) { if (String(canonNode.items[j].name).toLowerCase() === String(di[i].name).toLowerCase()) { seen = true; break; } }
    if (!seen) { canonNode.items.push(di[i]); t.items++; }
  }
  var ds = dupNode.stateNotes || [];
  if (ds.length) { // chronological merge under the cap; overflow evicts OLDEST to the archive (loud in the real engine)
    canonNode.stateNotes = (canonNode.stateNotes || []).concat(ds);
    canonNode.stateNotes.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    t.notes = ds.length;
    while (canonNode.stateNotes.length > CAP) { var ev2 = canonNode.stateNotes.shift(); archiveList.push({ node: canonLabel, note: ev2.n, turn: ev2.t }); t.evicted++; }
  }
  return t;
}

// unordered edge signature — parallel-edge dedupe key
function edgeSig(a, b) { return a < b ? a + "" + b : b + "" + a; }

// ═════════════════════════════════════ ARM 1 — NAME RE-KEY ═════════════════════════════════
// merge(canonKey, dupKey): every structural reference rewritten, subtree re-keyed by prefix,
// child collisions folded destructively (string keys leave no other option — the point).
var ARM_REKEY_BEGIN = true; // LOC-count marker
function rekeyMerge(state, canonKey, dupKey, report) {
  var ws = state.worldState, mem = state.memory, map = mem.map;
  var touched = {}, warns = [];
  function tch(cls, n) { touched[cls] = (touched[cls] || 0) + (n == null ? 1 : n); }
  if (!map.nodes[dupKey]) { warns.push("dup key not found: " + dupKey); return { touched: touched, warns: warns }; }
  if (!map.nodes[canonKey]) { warns.push("canonical key not found: " + canonKey); return { touched: touched, warns: warns }; }

  // pre-image archive (P12 — reversible by construction)
  if (!mem.archive) mem.archive = {};
  if (!mem.archive.identityMerges) mem.archive.identityMerges = [];
  if (!mem.archive.locationStates) mem.archive.locationStates = [];
  var preImage = { domain: "location", canonical: canonKey, duplicate: dupKey, turn: ws.turn, records: {} };
  preImage.records[dupKey] = clone(map.nodes[dupKey]);

  // 1) collect the dup subtree (prefix serialization = children embed the parent key)
  var allKeys = Object.keys(map.nodes), rekeys = [{ from: dupKey, to: canonKey }], i, j, k;
  for (i = 0; i < allKeys.length; i++) {
    if (allKeys[i].indexOf(dupKey + "|") === 0) {
      var tail = allKeys[i].slice(dupKey.length + 1);
      rekeys.push({ from: allKeys[i], to: canonKey + "|" + tail });
      preImage.records[allKeys[i]] = clone(map.nodes[allKeys[i]]);
    }
  }
  var renameOf = {}; // old key → new key, for reference rewriting
  for (i = 0; i < rekeys.length; i++) renameOf[rekeys[i].from] = rekeys[i].to;

  // 2) fold/move node records (root first, then descendants; collision → destructive fold)
  for (i = 0; i < rekeys.length; i++) {
    var from = rekeys[i].from, to = rekeys[i].to, nd = map.nodes[from];
    if (!nd) continue;
    if (map.nodes[to] && to !== from) {
      if (i > 0) { preImage.records[to] = preImage.records[to] || clone(map.nodes[to]); warns.push("child-key collision folded: " + from + " -> " + to); tch("child-collision-fold"); }
      foldNodeRecords(map.nodes[to], nd, mem.archive.locationStates, to);
    } else {
      map.nodes[to] = nd;
      // parent-field heal: descendants moved under the canonical root
      if (nd.parent === dupKey || (i > 0 && nd.parent && renameOf[nd.parent])) nd.parent = renameOf[nd.parent] || canonKey;
      else if (i > 0 && nd.parent === dupKey.split("|")[0]) nd.parent = canonKey.split("|")[0];
      tch("node-moved");
    }
    delete map.nodes[from];
    tch("F1 node key", 1);
  }
  // the canonical root's own parent stays; dup's parent discarded with its record (folded above)

  // 3) edges: rewrite endpoints, drop self-loops, collapse parallels (earliest turn wins)
  var kept = [], sigSeen = {}, dropped = 0, collapsed = 0;
  // seed signatures with edges that never touch a renamed key, in order, so parallels collapse onto the EXISTING edge
  for (i = 0; i < map.edges.length; i++) {
    var e = map.edges[i], nf = renameOf[e.from] || e.from, nt = renameOf[e.to] || e.to, rew = (nf !== e.from || nt !== e.to);
    if (rew) tch("F7 edge endpoint", (nf !== e.from ? 1 : 0) + (nt !== e.to ? 1 : 0));
    if (nf === nt) { dropped++; tch("F7 self-loop dropped"); continue; }
    var sig = edgeSig(nf, nt);
    if (sigSeen[sig]) { collapsed++; tch("F7 parallel collapsed"); if ((sigSeen[sig].turn || 0) > (e.turn || 0)) sigSeen[sig].turn = e.turn; continue; }
    e.from = nf; e.to = nt; sigSeen[sig] = e; kept.push(e);
    if (rew && (nf.indexOf("|") >= 0 ? (nt === nf.split("|")[0]) : (nf === nt.split("|")[0]))) warns.push("edge became parent-child after re-point: " + nf + " <-> " + nt + " (kept — Choke Gully precedent; Phase B policy question)");
  }
  map.edges = kept;
  if (dropped || collapsed) warns.push("edges: " + dropped + " self-loop(s) dropped, " + collapsed + " parallel(s) collapsed");

  // 4) lastArrivalFrom
  if (map.lastArrivalFrom && renameOf[map.lastArrivalFrom]) { map.lastArrivalFrom = renameOf[map.lastArrivalFrom]; tch("F8 lastArrivalFrom"); }

  // 5) memory.locations fold (union visited, concat notes under its cap-5 semantics)
  for (k in renameOf) {
    if (!mem.locations[k]) continue;
    var tgt = renameOf[k];
    preImage.records["locations:" + k] = clone(mem.locations[k]);
    if (!mem.locations[tgt]) { mem.locations[tgt] = mem.locations[k]; }
    else {
      var lv = mem.locations[k].visited || [], ln = mem.locations[k].notes || [];
      mem.locations[tgt].visited = (mem.locations[tgt].visited || []).concat(lv); mem.locations[tgt].visited.sort(function (a, b) { return a - b; });
      for (i = 0; i < ln.length; i++) { mem.locations[tgt].notes.push(ln[i]); if (mem.locations[tgt].notes.length > 5) mem.locations[tgt].notes.shift(); }
    }
    delete mem.locations[k];
    tch("F9 memory.locations key");
  }

  // 6) live world pointers — full-key semantics for location, BARE-NAME semantics for sublocation
  var effPre = ws.world.sublocation ? ws.world.location + "|" + ws.world.sublocation : ws.world.location;
  if (renameOf[effPre]) {
    var effPost = renameOf[effPre], cut = effPost.indexOf("|");
    ws.world.location = cut < 0 ? effPost : effPost.slice(0, cut);
    ws.world.sublocation = cut < 0 ? null : effPost.slice(cut + 1);
    tch("F10/F11 world pointer");
  } else if (renameOf[ws.world.location]) { // world moved but sub name kept (sub key rides along implicitly)
    ws.world.location = renameOf[ws.world.location]; tch("F10 world.location");
  }

  // 7) splitLoc — {world name, bare sub}
  var party = ws.npcs || [];
  for (i = 0; i < party.length; i++) {
    var cs = party[i].charSheet, sl = cs && cs.splitLoc;
    if (!sl || !sl.location) continue;
    var slEff = sl.sublocation ? sl.location + "|" + sl.sublocation : sl.location;
    if (renameOf[slEff]) { var sp = renameOf[slEff], c2 = sp.indexOf("|"); sl.location = c2 < 0 ? sp : sp.slice(0, c2); sl.sublocation = c2 < 0 ? null : sp.slice(c2 + 1); tch("F12 splitLoc"); }
    else if (renameOf[sl.location]) { sl.location = renameOf[sl.location]; tch("F12 splitLoc"); }
  }

  // 8) lastSeenAt — full node keys, descendants included
  for (k in mem.npcs) { var lsv = mem.npcs[k] && mem.npcs[k].lastSeenAt; if (lsv && renameOf[lsv]) { mem.npcs[k].lastSeenAt = renameOf[lsv]; tch("F13 lastSeenAt"); } }

  // 9) combat.node / pendingLocState.node
  if (ws.combat && ws.combat.node && renameOf[ws.combat.node]) { ws.combat.node = renameOf[ws.combat.node]; tch("F14 combat.node"); }
  if (ws.pendingLocState && ws.pendingLocState.node && renameOf[ws.pendingLocState.node]) { ws.pendingLocState.node = renameOf[ws.pendingLocState.node]; tch("F15 pendingLocState.node"); }

  // 10) locDescNudged latch keys
  if (ws.locDescNudged) { for (k in renameOf) { if (ws.locDescNudged[k] != null) { if (ws.locDescNudged[renameOf[k]] == null || ws.locDescNudged[k] > ws.locDescNudged[renameOf[k]]) ws.locDescNudged[renameOf[k]] = ws.locDescNudged[k]; delete ws.locDescNudged[k]; tch("F16 locDescNudged key"); } } }

  // 11) archive provenance
  var als = mem.archive.locationStates;
  for (i = 0; i < als.length; i++) { if (als[i].node && renameOf[als[i].node]) { als[i].node = renameOf[als[i].node]; tch("F18 archive.locationStates.node"); } }

  // 12) transcript e.l — GRAIN WART: e.l stores the world.location string of the scene; when a
  // world node merges into a SUB key the rewrite forces a full key into a world-name field
  // (precedent exists in the wild: 109 × "Sandpoint|Varisia"). Counted + warned, not hidden.
  var tr = ws.transcript || [], elWart = false;
  for (i = 0; i < tr.length; i++) { var el = tr[i].e && tr[i].e.l; if (el && renameOf[el]) { tr[i].e.l = renameOf[el]; tch("F17 e.l"); if (renameOf[el].indexOf("|") >= 0) elWart = true; } }
  if (elWart) warns.push("e.l rewrites forced a sub-grain key into a world-name field (grain wart — rekey has no better option)");

  mem.archive.identityMerges.push(preImage);
  report.merges.push({ arm: "rekey", canonical: canonKey, duplicate: dupKey, touched: touched, warns: warns });
  return { touched: touched, warns: warns, renameOf: renameOf };
}
var ARM_REKEY_END = true; // LOC-count marker

// ═════════════════════════════════════ ARM 2 — ADDITIVE IDS ════════════════════════════════
// One-time migration: mint loc_N ids, re-key the node store by id, move every structural
// reference to ids. merge(): tombstone in the identity table + shared node-record fold —
// references are left in place and RESOLVE through the tombstone chain at read time.
var ARM_IDS_BEGIN = true; // LOC-count marker
function idsMigrate(state, report) {
  var ws = state.worldState, mem = state.memory, map = mem.map;
  var touched = {}, ghosts = [], i, k;
  function tch(cls, n) { touched[cls] = (touched[cls] || 0) + (n == null ? 1 : n); }
  var ids = {}, byName = {}, seq = 0;
  function mint(name, ghost) {
    if (byName[name]) return byName[name];
    var id = "loc_" + (++seq);
    ids[id] = { name: name }; if (ghost) { ids[id].ghost = true; ghosts.push(name); tch("ghost-minted"); }
    byName[name] = id; return id;
  }
  var keys = Object.keys(map.nodes);
  for (i = 0; i < keys.length; i++) mint(keys[i]);
  function ref(name, cls) { // resolve a stored name → id, minting a ghost identity for unfiled names (references must never dangle)
    if (name == null || name === "") return null;
    var id = mint(name, !map.nodes[name]); tch(cls); return id;
  }
  // node store re-keyed by id; parent name → parentId (hierarchy becomes a pointer, not a key prefix)
  var newNodes = {};
  for (i = 0; i < keys.length; i++) {
    var nd = map.nodes[keys[i]];
    if (nd.parent) { nd.parentId = ref(nd.parent, "F2 parent"); delete nd.parent; }
    newNodes[byName[keys[i]]] = nd;
    tch("F1 node key");
  }
  map.nodes = newNodes;
  map.ids = ids;
  for (i = 0; i < map.edges.length; i++) { map.edges[i].from = ref(map.edges[i].from, "F7 edge endpoint"); map.edges[i].to = ref(map.edges[i].to, "F7 edge endpoint"); }
  if (map.lastArrivalFrom) map.lastArrivalFrom = ref(map.lastArrivalFrom, "F8 lastArrivalFrom");
  var newLocs = {};
  for (k in mem.locations) newLocs[ref(k, "F9 memory.locations key")] = mem.locations[k];
  mem.locations = newLocs;
  var effKey = ws.world.sublocation ? ws.world.location + "|" + ws.world.sublocation : ws.world.location;
  ws.world.locationId = ref(ws.world.location, "F10 world.location");
  ws.world.nodeId = ref(effKey, "F11 world effective node"); delete ws.world.location; delete ws.world.sublocation;
  var party = ws.npcs || [];
  for (i = 0; i < party.length; i++) {
    var cs = party[i].charSheet, sl = cs && cs.splitLoc;
    if (!sl || !sl.location) continue;
    var slEff = sl.sublocation ? sl.location + "|" + sl.sublocation : sl.location;
    cs.splitLoc = { nodeId: ref(slEff, "F12 splitLoc"), locId: ref(sl.location, "F12 splitLoc"), turn: sl.turn, audited: sl.audited };
  }
  for (k in mem.npcs) { if (mem.npcs[k] && mem.npcs[k].lastSeenAt) mem.npcs[k].lastSeenAt = ref(mem.npcs[k].lastSeenAt, "F13 lastSeenAt"); }
  if (ws.combat && ws.combat.node) ws.combat.node = ref(ws.combat.node, "F14 combat.node");
  if (ws.pendingLocState && ws.pendingLocState.node) ws.pendingLocState.node = ref(ws.pendingLocState.node, "F15 pendingLocState.node");
  if (ws.locDescNudged) { var nl = {}; for (k in ws.locDescNudged) nl[ref(k, "F16 locDescNudged key")] = ws.locDescNudged[k]; ws.locDescNudged = nl; }
  var tr = ws.transcript || [];
  for (i = 0; i < tr.length; i++) { if (tr[i].e && tr[i].e.l) tr[i].e.l = ref(tr[i].e.l, "F17 e.l"); }
  var als = (mem.archive && mem.archive.locationStates) || [];
  for (i = 0; i < als.length; i++) { if (als[i].node) als[i].node = ref(als[i].node, "F18 archive.locationStates.node"); }
  report.idsMigration = { touched: touched, ghostsMinted: ghosts };
  return byName;
}
function idsResolve(map, id) { var seen = {}; while (id && map.ids[id] && map.ids[id].mergedInto && !seen[id]) { seen[id] = 1; id = map.ids[id].mergedInto; } return id; }
function idsMerge(state, byName, canonName, dupName, report) {
  var mem = state.memory, map = mem.map, touched = {}, warns = [];
  function tch(cls, n) { touched[cls] = (touched[cls] || 0) + (n == null ? 1 : n); }
  var dupId = idsResolve(map, byName[dupName]), canonId = idsResolve(map, byName[canonName]);
  if (!dupId || !map.nodes[dupId]) { warns.push("dup not found: " + dupName); return { touched: touched, warns: warns }; }
  if (!canonId || !map.nodes[canonId]) { warns.push("canonical not found: " + canonName); return { touched: touched, warns: warns }; }
  if (!mem.archive) mem.archive = {};
  if (!mem.archive.identityMerges) mem.archive.identityMerges = [];
  if (!mem.archive.locationStates) mem.archive.locationStates = [];
  var preImage = { domain: "location", canonical: canonName, duplicate: dupName, canonicalId: canonId, duplicateId: dupId, records: {} };
  preImage.records[dupId] = clone(map.nodes[dupId]);
  // identity table: tombstone + alias — THE merge write
  map.ids[dupId].mergedInto = canonId; tch("identity tombstone");
  map.ids[canonId].aliases = map.ids[canonId].aliases || [];
  if (map.ids[canonId].aliases.indexOf(dupName) < 0) map.ids[canonId].aliases.push(dupName); tch("alias registered");
  // node-record fold (same shared rules)
  foldNodeRecords(map.nodes[canonId], map.nodes[dupId], mem.archive.locationStates, canonName); tch("node fold");
  delete map.nodes[dupId];
  // memory.locations per-node metadata folds with the record
  if (mem.locations[dupId]) {
    preImage.records["locations:" + dupId] = clone(mem.locations[dupId]);
    if (!mem.locations[canonId]) mem.locations[canonId] = mem.locations[dupId];
    else {
      var lv = mem.locations[dupId].visited || [], ln = mem.locations[dupId].notes || [], i;
      mem.locations[canonId].visited = (mem.locations[canonId].visited || []).concat(lv); mem.locations[canonId].visited.sort(function (a, b) { return a - b; });
      for (i = 0; i < ln.length; i++) { mem.locations[canonId].notes.push(ln[i]); if (mem.locations[canonId].notes.length > 5) mem.locations[canonId].notes.shift(); }
    }
    delete mem.locations[dupId]; tch("F9 metadata fold");
  }
  // children: NOTHING — parentId resolves through the tombstone. Homonym children of the two
  // roots stay DISTINCT records (no destructive fold); flag them for human adjudication.
  var k, names = {}, homonyms = [];
  for (k in map.nodes) {
    var pid = map.nodes[k].parentId ? idsResolve(map, map.nodes[k].parentId) : null;
    if (pid === canonId) { var nm = String(map.ids[k] ? map.ids[k].name : k).split("|").pop().toLowerCase(); if (names[nm]) homonyms.push(nm); names[nm] = 1; }
  }
  if (homonyms.length) warns.push("post-merge homonym children flagged for adjudication (records kept distinct): " + homonyms.join(", "));
  // every other reference class: UNTOUCHED — resolves through the tombstone at read time.
  mem.archive.identityMerges.push(preImage);
  report.merges.push({ arm: "ids", canonical: canonName, duplicate: dupName, touched: touched, warns: warns });
  return { touched: touched, warns: warns };
}
var ARM_IDS_END = true; // LOC-count marker

// ── PER-ARM ADAPTERS (the battery speaks resolution, arms answer) ───────────────────────────
function rekeyAdapter(state, renames) {
  var map = state.memory.map;
  function res(name) { var n = name, guard = 0; while (renames[n] && guard++ < 20) n = renames[n]; return n; }
  return {
    kind: "rekey",
    resolve: res,
    nodeOf: function (name) { return map.nodes[res(name)] || null; },
    displayOf: res,
    effectiveEdges: function () { return map.edges.map(function (e) { return { a: e.from, b: e.to, turn: e.turn }; }); },
    identityExists: function (name) { return !!map.nodes[res(name)]; },
    worldNode: function () { var w = state.worldState.world; return w.sublocation ? w.location + "|" + w.sublocation : w.location; },
    lastSeen: function (npc) { var v = state.memory.npcs[npc] && state.memory.npcs[npc].lastSeenAt; return v == null ? null : res(v); },
    locMeta: function (name) { return state.memory.locations[res(name)] || null; },
    refNames: { combat: function () { return state.worldState.combat && state.worldState.combat.node; }, pending: function () { return state.worldState.pendingLocState && state.worldState.pendingLocState.node; }, arrival: function () { return map.lastArrivalFrom; }, el: function (i) { var e = (state.worldState.transcript || [])[i]; return e && e.e && e.e.l; } }
  };
}
function idsAdapter(state, byName) {
  var map = state.memory.map;
  function res(nameOrId) {
    var id = (nameOrId != null && map.ids[nameOrId]) ? nameOrId : byName[nameOrId];
    if (!id) return null;
    return idsResolve(map, id);
  }
  return {
    kind: "ids",
    resolve: res,
    nodeOf: function (n) { var id = res(n); return id ? (map.nodes[id] || null) : null; },
    displayOf: function (n) { var id = res(n); return id && map.ids[id] ? map.ids[id].name : null; },
    effectiveEdges: function () { // the read seam: resolve endpoints, drop self-loops, collapse parallels
      var out = [], sig = {}, i;
      for (i = 0; i < map.edges.length; i++) {
        var a = idsResolve(map, map.edges[i].from), b = idsResolve(map, map.edges[i].to);
        if (a === b) continue;
        var s = edgeSig(a, b); if (sig[s]) { if ((map.edges[i].turn || 0) < (sig[s].turn || 0)) sig[s].turn = map.edges[i].turn; continue; }
        sig[s] = { a: a, b: b, turn: map.edges[i].turn }; out.push(sig[s]);
      }
      return out;
    },
    identityExists: function (n) { var id = res(n); return !!(id && (map.nodes[id] || (map.ids[id] && map.ids[id].ghost))); },
    worldNode: function () { return idsResolve(map, state.worldState.world.nodeId); },
    lastSeen: function (npc) { var v = state.memory.npcs[npc] && state.memory.npcs[npc].lastSeenAt; return v == null ? null : idsResolve(map, v); },
    locMeta: function (n) { var id = res(n); return id ? (state.memory.locations[id] || null) : null; },
    refNames: { combat: function () { var v = state.worldState.combat && state.worldState.combat.node; return v && idsResolve(map, v); }, pending: function () { var v = state.worldState.pendingLocState && state.worldState.pendingLocState.node; return v && idsResolve(map, v); }, arrival: function () { return map.lastArrivalFrom && idsResolve(map, map.lastArrivalFrom); }, el: function (i) { var e = (state.worldState.transcript || [])[i]; return e && e.e && e.e.l && idsResolve(map, e.e.l); } }
  };
}

// ── THE BATTERY ─────────────────────────────────────────────────────────────────────────────
// exp = expectations computed from the PRE-merge state of that fixture. Every assertion is a
// merge-OUTCOME predicate (must fail on the no-op arm) unless marked inv:true (invariant).
function runBattery(A, state, m, exp, initialGhosts) {
  var out = [], i;
  function a(id, desc, pass, detail, inv) { out.push({ id: id, desc: desc, pass: !!pass, detail: pass ? "" : String(detail || ""), inv: !!inv }); }

  var canonNode = A.nodeOf(m.canon);
  a("A1", "dup name resolves to the canonical identity", A.resolve(m.dup) != null && A.resolve(m.dup) === A.resolve(m.canon), "resolve(" + m.dup + ")=" + A.resolve(m.dup) + " vs " + A.resolve(m.canon));
  a("A2", "node fold: visits summed, firstVisit min, lastVisit max", canonNode && canonNode.visits === exp.visits && canonNode.firstVisit === exp.firstVisit && (exp.lastVisit == null || canonNode.lastVisit === exp.lastVisit), canonNode ? "visits=" + canonNode.visits + "/" + exp.visits + " fv=" + canonNode.firstVisit + "/" + exp.firstVisit + " lv=" + canonNode.lastVisit + "/" + exp.lastVisit : "canonical node missing");
  a("A3", "description: canonical wins, null takes dup's", canonNode && canonNode.description === exp.description, canonNode ? "desc=" + String(canonNode.description).slice(0, 40) : "missing");
  a("A4", "size/travelMins: canonical wins unless null", canonNode && canonNode.size === exp.size && canonNode.travelMins === exp.travelMins, canonNode ? "size=" + canonNode.size + "/" + exp.size + " tm=" + canonNode.travelMins + "/" + exp.travelMins : "missing");
  var dupN = 0, itemsLc = {}, itemsDup = 0;
  if (canonNode) { for (i = 0; i < (canonNode.items || []).length; i++) { var lc = String(canonNode.items[i].name).toLowerCase(); if (itemsLc[lc]) itemsDup++; itemsLc[lc] = 1; } }
  a("A5", "items: case-insensitive dedupe (count=" + exp.items + ", no dup names)", canonNode && (canonNode.items || []).length === exp.items && itemsDup === 0, canonNode ? "items=" + (canonNode.items || []).length + "/" + exp.items + " dups=" + itemsDup : "missing");
  var notesOk = canonNode && (canonNode.stateNotes || []).length <= CAP, chron = true;
  if (canonNode) { var sn = canonNode.stateNotes || []; for (i = 1; i < sn.length; i++) { if ((sn[i].t || 0) < (sn[i - 1].t || 0)) chron = false; } }
  a("A6", "stateNotes: chronological, cap " + CAP + ", evictions archived (" + exp.evictions + ")", notesOk && chron && exp.archiveLen === (state.memory.archive.locationStates || []).length, "notes=" + (canonNode ? (canonNode.stateNotes || []).length : "?") + " chron=" + chron + " archive=" + (state.memory.archive.locationStates || []).length + "/" + exp.archiveLen);
  a("A7", "node npcs[] union (" + exp.npcs + ")", canonNode && (canonNode.npcs || []).length === exp.npcs, canonNode ? "npcs=" + (canonNode.npcs || []).length + "/" + exp.npcs : "missing");
  var descOk = true, descBad = "";
  for (i = 0; i < exp.descendants.length; i++) { var d = exp.descendants[i]; var dn2 = A.nodeOf(d.key); if (!dn2 || dn2.visits !== d.visits) { descOk = false; descBad += d.key + "(got " + (dn2 ? dn2.visits : "missing") + " want " + d.visits + ") "; } }
  a("A8", "descendants reachable with visits preserved/summed (" + exp.descendants.length + " keys)", descOk, descBad);
  var ee = A.effectiveEdges(), sigs = {}, selfLoops = 0, parallels = 0, ghostGrown = [];
  for (i = 0; i < ee.length; i++) {
    if (ee[i].a === ee[i].b) selfLoops++;
    var s2 = edgeSig(ee[i].a, ee[i].b); if (sigs[s2]) parallels++; sigs[s2] = 1;
    if (!A.identityExists(ee[i].a) && initialGhosts.indexOf(A.displayOf ? (A.displayOf(ee[i].a) || ee[i].a) : ee[i].a) < 0) ghostGrown.push(ee[i].a);
    if (!A.identityExists(ee[i].b) && initialGhosts.indexOf(A.displayOf ? (A.displayOf(ee[i].b) || ee[i].b) : ee[i].b) < 0) ghostGrown.push(ee[i].b);
  }
  a("A9", "edges: no self-loops, no parallels, ghost set not grown (resolved view)", selfLoops === 0 && parallels === 0 && ghostGrown.length === 0, "selfLoops=" + selfLoops + " parallels=" + parallels + " ghostGrown=" + ghostGrown.join(","), !exp.edgesTouched);
  a("A10", "expected resolved edge count (" + exp.edgeCount + ")", ee.length === exp.edgeCount, "edges=" + ee.length + "/" + exp.edgeCount);
  a("A11", "lastArrivalFrom resolves to a live identity", A.refNames.arrival() == null || A.identityExists(A.refNames.arrival()), "arrival=" + A.refNames.arrival(), !exp.arrivalTouched);
  a("A12", "world pointer resolves to the canonical effective node (" + exp.worldNode + ")", A.resolve(A.worldNode()) === A.resolve(exp.worldNode), "world=" + A.worldNode(), !exp.worldTouched);
  var slBad = "", party = state.worldState.npcs || [];
  for (i = 0; i < party.length; i++) {
    var cs2 = party[i].charSheet, sl2 = cs2 && cs2.splitLoc; if (!sl2) continue;
    var slEff = sl2.nodeId != null ? sl2.nodeId : (sl2.sublocation ? sl2.location + "|" + sl2.sublocation : sl2.location);
    if (!A.identityExists(slEff)) slBad += party[i].name + " ";
    if (exp.splitTarget && party[i].name === exp.splitTarget.name && A.resolve(slEff) !== A.resolve(exp.splitTarget.node)) slBad += party[i].name + "(not re-pointed) ";
  }
  a("A13", "splitLoc resolves (and overlay re-points to canonical)", slBad === "", slBad, !exp.splitTarget);
  var lsDangling = 0, lsMoved = 0, np2 = state.memory.npcs, k2;
  for (k2 in np2) { var lsv2 = A.lastSeen(k2); if (np2[k2] && np2[k2].lastSeenAt != null) { if (!A.identityExists(lsv2)) lsDangling++; if (exp.lastSeenMoved[k2] && A.resolve(lsv2) === A.resolve(exp.lastSeenMoved[k2])) lsMoved++; } }
  a("A14", "lastSeenAt: dangling set not grown (" + exp.lsPreDangling + " pre-existing); moved stamps reach canonical (" + Object.keys(exp.lastSeenMoved).length + ")", lsDangling === exp.lsPreDangling && lsMoved === Object.keys(exp.lastSeenMoved).length, "dangling=" + lsDangling + "/" + exp.lsPreDangling + " moved=" + lsMoved + "/" + Object.keys(exp.lastSeenMoved).length, !Object.keys(exp.lastSeenMoved).length);
  a("A15", "combat.node resolves to canonical", exp.combatTarget == null || (A.refNames.combat() != null && A.resolve(A.refNames.combat()) === A.resolve(exp.combatTarget)), "combat=" + A.refNames.combat(), exp.combatTarget == null);
  a("A16", "pendingLocState.node resolves to canonical", exp.pendingTarget == null || (A.refNames.pending() != null && A.resolve(A.refNames.pending()) === A.resolve(exp.pendingTarget)), "pending=" + A.refNames.pending(), exp.pendingTarget == null);
  var ldn = state.worldState.locDescNudged || {}, ldnBad = "", ldnK;
  for (ldnK in ldn) { if (!A.identityExists(ldnK)) ldnBad += ldnK + " | "; }
  a("A17", "locDescNudged keys all resolve to live identities", ldnBad === "", ldnBad, !exp.ldnTouched);
  var alsBad = 0, als2 = (state.memory.archive.locationStates || []);
  for (i = 0; i < als2.length; i++) { if (als2[i].node && !A.identityExists(als2[i].node)) alsBad++; }
  a("A18", "archive.locationStates provenance resolves", alsBad === 0, alsBad + " dangling", !exp.alsTouched);
  var elDangling = 0, elMoved = 0, tr2 = state.worldState.transcript || [];
  for (i = 0; i < tr2.length; i++) { var elv = A.refNames.el(i); if (tr2[i].e && tr2[i].e.l != null) { if (!A.identityExists(elv)) elDangling++; if (exp.elMovedIdx[i] && A.resolve(elv) === A.resolve(m.canon)) elMoved++; } }
  a("A19", "transcript e.l: dangling set not grown (" + exp.elPreDangling + " pre-existing); " + exp.elMoved + " moved stamps reach canonical", elDangling === exp.elPreDangling && elMoved === exp.elMoved, "dangling=" + elDangling + "/" + exp.elPreDangling + " moved=" + elMoved + "/" + exp.elMoved, !exp.elMoved);
  var lm = A.locMeta(m.canon);
  a("A20", "memory.locations folded (visited " + exp.locVisited + ")", exp.locVisited == null || (lm && (lm.visited || []).length === exp.locVisited), lm ? "visited=" + (lm.visited || []).length + "/" + exp.locVisited : "meta missing", exp.locVisited == null);
  var im = (state.memory.archive.identityMerges || []), lastIm = im[im.length - 1];
  a("A21", "pre-image archived to memory.archive.identityMerges with the dup's full record", !!(lastIm && lastIm.duplicate === m.dup && lastIm.records && Object.keys(lastIm.records).length >= 1), im.length + " entries");
  a("A22", "narrative prose byte-unchanged (F22 — history, never rewritten)", proseHash(state) === exp.proseHash, "prose hash moved", false);
  return out;
}

// ── FIXTURES: the real t1593 census pairs (+ documented synthetic overlays) ─────────────────
var MERGES = [
  { id: "M1", canon: "Sandpoint", dup: "Sandpoint, Varisia", note: "world→world; census-confirmed same settlement (byte-identical descriptions); self-loop drop" },
  { id: "M2", canon: "Sandpoint", dup: "Sandpoint|Varisia", note: "pipe-bearing pseudo-node → world; 5-descendant subtree incl. 4-segment keys; TWO child-key collisions; 109 e.l stamps; 4 edges (2 parallel collapses)" },
  { id: "M3", canon: "Sandpoint|Sandpoint - Rusty Dragon", dup: "Sandpoint|Rusty Dragon", note: "sub→sub Rusty Dragon variant; live world-pointer rides the merge (bare-name semantics)" },
  { id: "M4", canon: "Sandpoint|Sandpoint Northeast Cliffs", dup: "Sandpoint Northeast Cliffs", note: "cross-level world→sub; 29 e.l; the parent-child edge wart; e.l grain wart" }
];

// Synthetic overlays ON TOP of the real clone — classes the save has empty right now.
// Documented here, applied identically to both arms BEFORE anything runs (§7.6: never
// synthetic-ONLY; this is real state plus minimal staged instances).
function stageOverlays(state) {
  var ws = state.worldState, mem = state.memory, staged = [];
  ws.combat = { round: 2, engaged: null, foes: [{ name: "Staged Footpad", hp: 4, maxHp: 6, ac: 12, atk: 2, dmg: "1d6", morale: "low" }], node: "Sandpoint, Varisia" };
  staged.push("F14 combat.node = \"Sandpoint, Varisia\" (fight staged at the M1 dup)");
  ws.pendingLocState = { node: "Sandpoint|Varisia|Sandpoint - Rusty Dragon", turn: 1592 };
  staged.push("F15 pendingLocState.node = \"Sandpoint|Varisia|Sandpoint - Rusty Dragon\" (M2 descendant)");
  ws.locDescNudged = ws.locDescNudged || {};
  ws.locDescNudged["Sandpoint|Varisia|Sandpoint - Rusty Dragon|Guest Room"] = 1580;
  staged.push("F16 locDescNudged key on an M2 4-segment descendant");
  var comp = null, i;
  for (i = 0; i < (ws.npcs || []).length; i++) { if (ws.npcs[i].partyMember && ws.npcs[i].charSheet) { comp = ws.npcs[i]; break; } }
  if (comp) { comp.charSheet.splitLoc = { location: "Sandpoint, Varisia", sublocation: null, turn: 1560 }; staged.push("F12 splitLoc on " + comp.name + " = \"Sandpoint, Varisia\" (M1 dup)"); }
  var npcK = Object.keys(mem.npcs)[0];
  mem.npcs["__A0 Staged Scout"] = { attitude: "", knowledge: [], events: [], aliases: [], lastSeenAt: "Sandpoint|Varisia|Corven's Cooper Shop" };
  staged.push("F13 lastSeenAt on staged NPC = \"Sandpoint|Varisia|Corven's Cooper Shop\" (M2 descendant)");
  if (!mem.archive) mem.archive = {};
  if (!mem.archive.locationStates) mem.archive.locationStates = [];
  mem.archive.locationStates.push({ node: "Sandpoint|Varisia", note: "staged: scorch marks by the gate", turn: 1500 });
  staged.push("F18 archive.locationStates provenance = \"Sandpoint|Varisia\" (M2 dup)");
  var sv = mem.map.nodes["Sandpoint, Varisia"], sp = mem.map.nodes["Sandpoint"];
  sv.stateNotes = [{ n: "staged: north gate scorched", t: 900 }, { n: "staged: harbor chain raised", t: 1400 }];
  sp.stateNotes = [{ n: "staged: festival banners up", t: 1000 }, { n: "staged: garrison doubled patrols", t: 1550 }];
  staged.push("F5 stateNotes 2+2 on M1 pair (forces chronological merge + 1 eviction past cap " + CAP + ")");
  sv.size = "large"; sv.travelMins = 60; sp.size = null; sp.travelMins = 45;
  staged.push("F6 size/travelMins on M1 pair (canonical null takes dup size; canonical travelMins wins)");
  var rd = mem.map.nodes["Sandpoint|Sandpoint - Rusty Dragon"], rdD = mem.map.nodes["Sandpoint|Rusty Dragon"];
  rd.items = [{ name: "Brass Key", placed: 700, taken: false }];
  rdD.items = [{ name: "brass key", placed: 900, taken: false }, { name: "Oil Lamp", placed: 910, taken: false }];
  staged.push("F4 items on M3 pair (case-collision \"Brass Key\"/\"brass key\" must dedupe)");
  mem.map.nodes["Sandpoint Northeast Cliffs"].description = "staged: wind-bitten cliffs over the breakers";
  staged.push("F6 description on M4 world dup (null canonical takes dup's — the other direction of the rule)");
  ws.world.location = "Sandpoint"; ws.world.sublocation = "Rusty Dragon";
  staged.push("F10/F11 world pointer = Sandpoint / \"Rusty Dragon\" bare sub name (rides M3)");
  return staged;
}

// Expectations computed from the LIVE pre-merge state of each fixture (arm-agnostic).
function computeExpectations(state, m, A) {
  var mem = state.memory, ws = state.worldState;
  function liveNode(name) { return A ? A.nodeOf(name) : mem.map.nodes[name]; }
  var canon = clone(liveNode(m.canon)), dup = clone(liveNode(m.dup));
  var exp = { proseHash: proseHash(state) };
  exp.visits = (canon.visits || 0) + (dup.visits || 0);
  exp.firstVisit = (canon.firstVisit == null) ? dup.firstVisit : (dup.firstVisit == null ? canon.firstVisit : Math.min(canon.firstVisit, dup.firstVisit));
  var lvs = [canon.lastVisit, dup.lastVisit].filter(function (x) { return x != null; });
  exp.lastVisit = lvs.length ? Math.max.apply(null, lvs) : null;
  exp.description = canon.description || dup.description || null;
  exp.size = canon.size != null ? canon.size : dup.size;
  exp.travelMins = canon.travelMins != null ? canon.travelMins : dup.travelMins;
  var lc = {}, n = 0, i;
  (canon.items || []).concat(dup.items || []).forEach(function (it) { var k = String(it.name).toLowerCase(); if (!lc[k]) { lc[k] = 1; n++; } });
  exp.items = n;
  var un = {}; (canon.npcs || []).concat(dup.npcs || []).forEach(function (x) { un[x] = 1; });
  exp.npcs = Object.keys(un).length;
  var totalNotes = (canon.stateNotes || []).length + (dup.stateNotes || []).length;
  exp.evictions = Math.max(0, totalNotes - CAP);
  exp.archiveLen = (mem.archive && mem.archive.locationStates ? mem.archive.locationStates.length : 0) + exp.evictions;
  // descendants: pre-merge dup subtree → post-merge expected keys and summed visits (name-grain; ids arm resolves the same names)
  exp.descendants = [];
  var keys = A ? null : Object.keys(mem.map.nodes);
  if (!A) {
    for (i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(m.dup + "|") === 0) {
        var tail = keys[i].slice(m.dup.length + 1), tgt = m.canon + "|" + tail;
        var existing = mem.map.nodes[tgt];
        exp.descendants.push({ key: tgt, visits: (existing ? existing.visits || 0 : 0) + (mem.map.nodes[keys[i]].visits || 0) });
      }
    }
  } else { // ids arm: descendants stay their own identities; expectation = same visits, reachable by old name
    var k;
    for (k in mem.map.ids) { var nm2 = mem.map.ids[k].name; if (nm2 && nm2.indexOf(m.dup + "|") === 0 && mem.map.nodes[idsResolve(mem.map, k)]) exp.descendants.push({ key: nm2, visits: mem.map.nodes[idsResolve(mem.map, k)].visits || 0 }); }
  }
  // resolved-edge expectation: rewrite endpoints through {dup→canon}+descendants, then dedupe/self-loop-drop
  var ren = {}; ren[m.dup] = m.canon;
  if (!A) { for (i = 0; i < keys.length; i++) { if (keys[i].indexOf(m.dup + "|") === 0) ren[keys[i]] = m.canon + "|" + keys[i].slice(m.dup.length + 1); } }
  var eSig = {}, cnt = 0, touched = false, edges = A ? A.effectiveEdges() : mem.map.edges.map(function (e) { return { a: e.from, b: e.to }; });
  for (i = 0; i < edges.length; i++) {
    var a2 = A ? (A.displayOf(edges[i].a) || edges[i].a) : edges[i].a, b2 = A ? (A.displayOf(edges[i].b) || edges[i].b) : edges[i].b;
    var na = ren[a2] || a2, nb = ren[b2] || b2;
    if (na !== a2 || nb !== b2) touched = true;
    if (na === nb) continue;
    var s = edgeSig(na, nb); if (eSig[s]) continue; eSig[s] = 1; cnt++;
  }
  exp.edgeCount = cnt; exp.edgesTouched = touched;
  exp.arrivalTouched = !!ren[A ? A.displayOf(mem.map.lastArrivalFrom) || "" : mem.map.lastArrivalFrom];
  // world pointer
  var wEff = A ? (A.displayOf(A.worldNode()) || "") : (ws.world.sublocation ? ws.world.location + "|" + ws.world.sublocation : ws.world.location);
  exp.worldTouched = !!ren[wEff]; exp.worldNode = ren[wEff] || wEff;
  // splitLoc overlay target
  exp.splitTarget = null;
  for (i = 0; i < (ws.npcs || []).length; i++) {
    var cs = ws.npcs[i].charSheet, sl = cs && cs.splitLoc;
    if (!sl) continue;
    var slEff = A ? (A.displayOf(sl.nodeId != null ? sl.nodeId : "") || "") : (sl.sublocation ? sl.location + "|" + sl.sublocation : sl.location);
    if (ren[slEff]) exp.splitTarget = { name: ws.npcs[i].name, node: ren[slEff] };
  }
  exp.lastSeenMoved = {};
  var k3;
  for (k3 in mem.npcs) { var lsv = mem.npcs[k3] && mem.npcs[k3].lastSeenAt; if (lsv == null) continue; var lsName = A ? (A.displayOf(lsv) || "") : lsv; if (ren[lsName]) exp.lastSeenMoved[k3] = ren[lsName]; }
  var cbt = ws.combat && ws.combat.node ? (A ? A.displayOf(ws.combat.node) : ws.combat.node) : null;
  exp.combatTarget = cbt && ren[cbt] ? ren[cbt] : null;
  var pnd = ws.pendingLocState && ws.pendingLocState.node ? (A ? A.displayOf(ws.pendingLocState.node) : ws.pendingLocState.node) : null;
  exp.pendingTarget = pnd && ren[pnd] ? ren[pnd] : null;
  exp.ldnTouched = false;
  var ldnK; for (ldnK in (ws.locDescNudged || {})) { var ldName = A ? (A.displayOf(ldnK) || ldnK) : ldnK; if (ren[ldName]) exp.ldnTouched = true; }
  exp.alsTouched = false;
  var als = (mem.archive && mem.archive.locationStates) || [];
  for (i = 0; i < als.length; i++) { var alName = A ? (A.displayOf(als[i].node) || "") : als[i].node; if (ren[alName]) exp.alsTouched = true; }
  exp.elMoved = 0; exp.elMovedIdx = {}; exp.elPreDangling = 0;
  var tr = ws.transcript || [];
  for (i = 0; i < tr.length; i++) {
    if (!tr[i].e || tr[i].e.l == null) continue;
    var elName = A ? (A.displayOf(tr[i].e.l) || "") : tr[i].e.l;
    if (ren[elName]) { exp.elMoved++; exp.elMovedIdx[i] = 1; }
    // pre-existing rot baseline: stamps naming never-filed nodes (sync-modal direct writes etc.).
    // The merge must not GROW this set; the ids arm makes it 0 by minting ghost identities.
    if (A) { if (!A.identityExists(tr[i].e.l)) exp.elPreDangling++; }
    else if (!mem.map.nodes[elName]) exp.elPreDangling++;
  }
  exp.lsPreDangling = 0;
  var kls;
  for (kls in mem.npcs) {
    var lsv0 = mem.npcs[kls] && mem.npcs[kls].lastSeenAt;
    if (lsv0 == null) continue;
    if (A) { if (!A.identityExists(lsv0)) exp.lsPreDangling++; }
    else if (!mem.map.nodes[lsv0]) exp.lsPreDangling++;
  }
  var cm = A ? A.locMeta(m.canon) : mem.locations[m.canon], dm = A ? A.locMeta(m.dup) : mem.locations[m.dup];
  exp.locVisited = (cm || dm) ? ((cm && cm.visited ? cm.visited.length : 0) + (dm && dm.visited ? dm.visited.length : 0)) : null;
  return exp;
}

function initialGhostList(state) { // edge endpoints with no node record (pre-existing rot — must not grow)
  var mem = state.memory, out = [], i;
  for (i = 0; i < mem.map.edges.length; i++) {
    if (!mem.map.nodes[mem.map.edges[i].from] && out.indexOf(mem.map.edges[i].from) < 0) out.push(mem.map.edges[i].from);
    if (!mem.map.nodes[mem.map.edges[i].to] && out.indexOf(mem.map.edges[i].to) < 0) out.push(mem.map.edges[i].to);
  }
  return out;
}

function locCount(begin, end) { // executor size, non-comment non-blank lines between markers
  var src = fs.readFileSync(__filename, "utf8").split(/\r?\n/), on = false, n = 0, i;
  for (i = 0; i < src.length; i++) {
    if (src[i].indexOf(begin) >= 0) { on = true; continue; }
    if (src[i].indexOf(end) >= 0) break;
    if (on) { var t = src[i].trim(); if (t && t.indexOf("//") !== 0) n++; }
  }
  return n;
}

function sumTouched(t) { var k, n = 0; for (k in t) n += t[k]; return n; }

// ── RUN ─────────────────────────────────────────────────────────────────────────────────────
console.log("A0 representation gate — " + path.basename(SAVE));
var raw = JSON.parse(fs.readFileSync(SAVE, "utf8"));
if (!Array.isArray(raw.worldState.transcript)) { console.error("FATAL: transcript is not a plain array (compressed export?) — inflate before running"); process.exit(1); }
var base = { worldState: raw.worldState, memory: raw.memory, sessionLog: raw.sessionLog || [] };
var staged = stageOverlays(base); // overlays staged ONCE on the base; both arms clone from it
console.log("staged overlays:\n  - " + staged.join("\n  - "));
var results = { save: path.basename(SAVE), turn: base.worldState.turn, generatedBy: "dev/identity-a0-gate.js", overlays: staged, inventory: REFERENCE_CLASSES, noop: [], merges: [], arms: {} };

// Phase 1 — FAILING FIRST: the battery against the un-merged clone (no-op arm). Every
// merge-outcome assertion (inv:false) must FAIL for at least one fixture.
(function () {
  var st = clone(base), ghosts = initialGhostList(st), mustFail = {}, sawFail = {}, i, j;
  for (i = 0; i < MERGES.length; i++) {
    var A = rekeyAdapter(st, {}); // identity renames = no-op
    var exp = computeExpectations(st, MERGES[i], null);
    var res = runBattery(A, st, MERGES[i], exp, ghosts);
    // A21 pre-image + A20 fold are outcome assertions too; on no-op nothing archived → they fail naturally
    for (j = 0; j < res.length; j++) {
      if (!res[j].inv) { mustFail[res[j].id] = 1; if (!res[j].pass) sawFail[res[j].id] = 1; }
    }
    results.noop.push({ fixture: MERGES[i].id, failed: res.filter(function (r) { return !r.pass; }).map(function (r) { return r.id; }) });
  }
  var missing = Object.keys(mustFail).filter(function (id) { return !sawFail[id]; });
  console.log("\n[failing-first] outcome assertions that failed on the no-op arm: " + Object.keys(sawFail).sort().join(" ") + (missing.length ? "\n  invariant-shaped assertions passing trivially on no-op (sabotage-proven below): " + missing.join(" ") : "\n  every outcome assertion demonstrated failable ✓"));
  results.noopNeverFailing = missing;
})();

// Phase 1b — SABOTAGE PROOFS for the invariant-shaped assertions (A9/A17/A18/A22 detect
// damage rather than merge outcomes, so a no-op can't fail them; the house rule is that no
// guard is trusted until sabotage proves it can fire). Each sabotage runs on a fresh clone.
(function () {
  var proofs = [];
  function prove(label, targetId, sabotage) {
    var st = clone(base), ghosts = initialGhostList(st);
    var exp = computeExpectations(st, MERGES[0], null); // clean expectations captured BEFORE the damage
    sabotage(st);
    var res = runBattery(rekeyAdapter(st, {}), st, MERGES[0], exp, ghosts), hit = null, i;
    for (i = 0; i < res.length; i++) { if (res[i].id === targetId) hit = res[i]; }
    proofs.push({ label: label, target: targetId, fired: !!(hit && !hit.pass) });
  }
  prove("self-loop edge planted", "A9", function (st) { st.memory.map.edges.push({ from: "Sandpoint", to: "Sandpoint", turn: 1 }); });
  prove("parallel edge planted", "A9", function (st) { st.memory.map.edges.push({ from: "Thistletop", to: "Sandpoint", turn: 2 }); });
  prove("edge to a brand-new ghost planted", "A9", function (st) { st.memory.map.edges.push({ from: "Sandpoint", to: "Sabotage Nowhere", turn: 3 }); });
  prove("dangling locDescNudged key planted", "A17", function (st) { st.worldState.locDescNudged["Sabotage Nowhere"] = 5; });
  prove("dangling archive provenance planted", "A18", function (st) { st.memory.archive.locationStates.push({ node: "Sabotage Nowhere", note: "x", turn: 1 }); });
  prove("transcript prose mutated", "A22", function (st) { st.worldState.transcript[0].x = String(st.worldState.transcript[0].x || "") + "!"; });
  // deep-scan proof: a dead key planted at a structural path must be found
  (function () {
    var st = clone(base);
    st.worldState.__sabotagePlant = "Sandpoint, Varisia";
    var hits = deepScan(st, ["Sandpoint, Varisia"]);
    proofs.push({ label: "dead key planted at a structural path", target: "A23 deepScan", fired: hits.length > 0 });
  })();
  var dud = proofs.filter(function (p) { return !p.fired; });
  console.log("[sabotage] " + proofs.length + " proofs: " + (dud.length ? "⚠ DID NOT FIRE: " + dud.map(function (p) { return p.target + " (" + p.label + ")"; }).join("; ") : "every invariant assertion fired on damage ✓"));
  results.sabotage = proofs;
})();

// Phase 2 — ARM 1 (name re-key): the four merges sequentially on one clone.
(function () {
  var st = clone(base), ghosts = initialGhostList(st), report = { merges: [] }, all = [], renames = {}, i, j;
  for (i = 0; i < MERGES.length; i++) {
    var exp = computeExpectations(st, MERGES[i], null);
    var r = rekeyMerge(st, MERGES[i].canon, MERGES[i].dup, report);
    var k; for (k in r.renameOf) renames[k] = r.renameOf[k];
    var A = rekeyAdapter(st, renames);
    var bat = runBattery(A, st, MERGES[i], exp, ghosts);
    var deadKeys = Object.keys(r.renameOf), scan = deepScan(st, deadKeys);
    bat.push({ id: "A23", desc: "deep scan: no dead key survives outside prose (" + deadKeys.length + " keys)", pass: scan.length === 0, detail: scan.map(function (h) { return h.path; }).join(" | ").slice(0, 400), inv: false });
    all.push({ fixture: MERGES[i].id, touched: r.touched, instances: sumTouched(r.touched), warns: r.warns, battery: bat });
    console.log("\n[rekey " + MERGES[i].id + "] " + MERGES[i].canon + "  ⇐  " + MERGES[i].dup + "\n  instances rewritten: " + sumTouched(r.touched) + "  " + JSON.stringify(r.touched) + (r.warns.length ? "\n  warns: " + r.warns.join(" · ") : ""));
    for (j = 0; j < bat.length; j++) { if (!bat[j].pass) console.log("  ✗ " + bat[j].id + " " + bat[j].desc + " — " + bat[j].detail); }
    console.log("  battery: " + bat.filter(function (b) { return b.pass; }).length + "/" + bat.length + " pass");
  }
  results.arms.rekey = { merges: all, executorLoc: locCount("ARM_REKEY_BEGIN", "ARM_REKEY_END"), totalInstances: all.reduce(function (s, m) { return s + m.instances; }, 0) };
})();

// Phase 3 — ARM 2 (additive ids): one migration, then the same four merges on one clone.
(function () {
  var st = clone(base), ghosts = initialGhostList(st), report = { merges: [] }, all = [], i, j;
  var byName = idsMigrate(st, report);
  var migInstances = sumTouched(report.idsMigration.touched);
  console.log("\n[ids migration] instances moved to ids: " + migInstances + "  " + JSON.stringify(report.idsMigration.touched) + "\n  ghosts minted (pre-existing rot made explicit): " + (report.idsMigration.ghostsMinted.join(", ") || "none"));
  for (i = 0; i < MERGES.length; i++) {
    var A0 = idsAdapter(st, byName);
    var exp = computeExpectations(st, MERGES[i], A0);
    var r = idsMerge(st, byName, MERGES[i].canon, MERGES[i].dup, report);
    var A = idsAdapter(st, byName);
    var bat = runBattery(A, st, MERGES[i], exp, ghosts);
    // arm-2 deep scan: no dangling ids (every referenced id exists in the identity table), no name-form refs left
    var dangling = 0, k;
    (function chk(v) { if (typeof v === "string") { if (/^loc_\d+$/.test(v) && !st.memory.map.ids[v]) dangling++; return; } if (Array.isArray(v)) { for (var x = 0; x < v.length; x++) chk(v[x]); return; } if (v && typeof v === "object") { for (var y in v) { if (Object.prototype.hasOwnProperty.call(v, y)) chk(v[y]); } } })(st.worldState);
    bat.push({ id: "A23", desc: "deep scan: zero dangling ids", pass: dangling === 0, detail: dangling + " dangling", inv: false });
    all.push({ fixture: MERGES[i].id, touched: r.touched, instances: sumTouched(r.touched), warns: r.warns, battery: bat });
    console.log("\n[ids " + MERGES[i].id + "] " + MERGES[i].canon + "  ⇐  " + MERGES[i].dup + "\n  instances written: " + sumTouched(r.touched) + "  " + JSON.stringify(r.touched) + (r.warns.length ? "\n  warns: " + r.warns.join(" · ") : ""));
    for (j = 0; j < bat.length; j++) { if (!bat[j].pass) console.log("  ✗ " + bat[j].id + " " + bat[j].desc + " — " + bat[j].detail); }
    console.log("  battery: " + bat.filter(function (b) { return b.pass; }).length + "/" + bat.length + " pass");
  }
  results.arms.ids = { migration: report.idsMigration, migrationInstances: migInstances, merges: all, executorLoc: locCount("ARM_IDS_BEGIN", "ARM_IDS_END"), totalMergeInstances: all.reduce(function (s, m) { return s + m.instances; }, 0) };
})();

// ── SUMMARY TABLE ───────────────────────────────────────────────────────────────────────────
(function () {
  var rk = results.arms.rekey, id2 = results.arms.ids, i;
  console.log("\n══ MEASUREMENT ══════════════════════════════════════════════");
  console.log("                         rekey (per merge)   ids (per merge)");
  for (i = 0; i < MERGES.length; i++) console.log("  " + MERGES[i].id + " instances touched:   " + String(rk.merges[i].instances) + new Array(Math.max(1, 20 - String(rk.merges[i].instances).length)).join(" ") + String(id2.merges[i].instances));
  console.log("  4-merge total:         " + rk.totalInstances + new Array(Math.max(1, 20 - String(rk.totalInstances).length)).join(" ") + id2.totalMergeInstances);
  console.log("  one-time migration:    –                   " + id2.migrationInstances);
  console.log("  executor size (LOC):   " + rk.executorLoc + new Array(Math.max(1, 20 - String(rk.executorLoc).length)).join(" ") + id2.executorLoc);
  var rkPass = 0, rkTot = 0, idPass = 0, idTot = 0;
  for (i = 0; i < 4; i++) {
    rk.merges[i].battery.forEach(function (b) { rkTot++; if (b.pass) rkPass++; });
    id2.merges[i].battery.forEach(function (b) { idTot++; if (b.pass) idPass++; });
  }
  console.log("  battery:               " + rkPass + "/" + rkTot + new Array(Math.max(1, 20 - String(rkPass + "/" + rkTot).length)).join(" ") + idPass + "/" + idTot);
  results.summary = { rekeyBattery: rkPass + "/" + rkTot, idsBattery: idPass + "/" + idTot };
})();

fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
console.log("\nresults → " + path.relative(eng.ROOT, RESULTS_PATH));
