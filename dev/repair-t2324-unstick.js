// repair-t2324-unstick.js — un-spiral the live t2324 save (the #228 field incident, owner-ruled 2026-08-24).
//
// Three repairs, each fixing a measured driver of the "unfun nonsense" stretch:
//
// ① THE MISSING SUBLOCATION (the #228 loop's trigger). Ammut walked throne room → void archway →
//    crooked stair → bone-ring chamber (t2318-t2323) with nothing filed, so the engine still has
//    him at "Eastern Ruins" — the very node his three companions are split to. Files the real
//    place as a sublocation node with a write-once description assembled from the committed
//    fiction (pinning the scene canon the GM has been re-inventing), moves the camera there, and
//    stamps Ammut's guestbook arrival. The companions' split records become TRUTHFUL by this one
//    move: they are at Eastern Ruins, the scene is not.
// ② THE UNCOMPLETABLE QUEST (owner ruling: complete it — objective met). "The Bell Beneath the
//    Crown" has ONE objective and it is optional; by the #205b required-only completion rule the
//    ⚑ finish line can never fire, so it sat in "steer toward these" forever — 50 of the last
//    120 GM turns mention the bell vs 1 for the Pinnacle. Ammut is physically standing at the
//    source: the objective as written IS met. Marked done, quest completed and archived through
//    the archiveQuest shape. The unanswered half (Karzoug or something older?) remains lore.
// ③ INVENTORY (owner ruling: moderate — fold closed cases). 153 lines ≈ 1817 tokens EVERY turn.
//    The closed-eye conspiracy evidence (Acts 1-2, case closed at The Third's death) folds into
//    one archive line; horses/cart/tack (left before the northern march — the party is on foot
//    above the snowline) fold into one; three spiral stone discs merge to one line; pure junk
//    (bells, room keys) drops. NOTHING spiral/disc/pre-Thassilonian is dropped — the bone-ring
//    chamber is pre-Thassilonian and the spiral-disc motif is live. Every removed line rides the
//    receipt verbatim (reversible by construction).
//
// Deliberately NOT touched: the split records themselves (truthful after ①; the next SPLIT AUDIT
// fires once and the GM decides with fresh context — #228 stops the loop from re-arming), the
// stale t2232-2242 identity conflicts (inert — no nudges fire at t2324), The Bound Captive and
// The Pinnacle of Avarice quests (legitimately live).
//
// Usage: node dev/repair-t2324-unstick.js <save.tnd>   → writes <save>_REPAIRED.tnd beside it
var fs = require("fs");
var savePath = process.argv[2];
if (!savePath) { console.error("usage: node dev/repair-t2324-unstick.js <save.tnd>"); process.exit(1); }
var raw = JSON.parse(fs.readFileSync(savePath, "utf8"));
var ws = raw.worldState, mem = raw.memory;
if (!ws || !mem) { console.error("REFUSE: export lacks worldState or memory"); process.exit(1); }

// ── refuse guards ─────────────────────────────────────────────────────────────────────────────
if (!ws.character || ws.character.name !== "Ammut") { console.error("REFUSE: hero is not Ammut (wrong save?)"); process.exit(1); }
if (ws.turn < 2324) { console.error("REFUSE: turn " + ws.turn + " < 2324 — this repair targets the t2324 export or later"); process.exit(1); }
if (ws.world.location !== "Xin-Shalast") { console.error("REFUSE: party is at " + ws.world.location + ", expected Xin-Shalast"); process.exit(1); }
var SUB = "Bone-Ring Chamber";
if (ws.world.sublocation === SUB) { console.error("REFUSE: sublocation already " + SUB + " (repair already applied?)"); process.exit(1); }
if (ws.world.sublocation !== "Eastern Ruins") { console.error("REFUSE: sublocation is \"" + ws.world.sublocation + "\", expected Eastern Ruins — the save has moved on; re-derive the repair"); process.exit(1); }
var BELL = "The Bell Beneath the Crown";
var bellQ = null, bi;
for (bi = 0; bi < (ws.questLog || []).length; bi++) if (ws.questLog[bi].title === BELL) { bellQ = ws.questLog[bi]; break; }
if (!bellQ) { console.error("REFUSE: quest \"" + BELL + "\" not in the live log (repair already applied?)"); process.exit(1); }
if (bellQ.status !== "active") { console.error("REFUSE: bell quest status is \"" + bellQ.status + "\", expected active"); process.exit(1); }

var changes = [];

// ── ① file the real scene ─────────────────────────────────────────────────────────────────────
var nodeKey = "Xin-Shalast|" + SUB;
if (!mem.map) mem.map = { nodes: {}, edges: [], lastArrivalFrom: null };
if (mem.map.nodes[nodeKey]) { console.error("REFUSE: node " + nodeKey + " already exists"); process.exit(1); }
mem.map.nodes[nodeKey] = {
  firstVisit: ws.turn, visits: 1, lastVisit: ws.turn,
  description: "A wide chamber at the foot of a crooked pre-Thassilonian stair descending from the throne room's void archway — older than the city above, built to hold something, not to impress. A raised ring of hundreds of small bones packed and mortared in a spiral surrounds a corroded bronze bell-shaped object, half-buried, weeping black at the seams: no clapper, no rope, yet it tolls on its own in a slow uneven rhythm. Six evenly spaced alcoves hold upright person-sized bundles wrapped in age-stiffened cloth. Past the far side of the ring a shaft drops away black, no bottom found. Two carvings on the bone ring: 'Awake' — fresh, unfaded — and, older and worn, 'she remembers her name now.'",
  parent: "Xin-Shalast", npcs: [], items: [], size: null, travelMins: null
};
ws.world.sublocation = SUB;
// Ammut's arrival is recorded evidence — he is physically there (guestbook shape per memory.js).
function stamp(key, name, turn) {
  var node = mem.map.nodes[key]; if (!node) return;
  if (!node.guestbook) node.guestbook = {};
  if (!node.guestbook[name]) node.guestbook[name] = { turns: [] };
  if (node.guestbook[name].turns.indexOf(turn) < 0) node.guestbook[name].turns.push(turn);
}
stamp(nodeKey, "Ammut", ws.turn);
stamp("Xin-Shalast", "Ammut", ws.turn);
changes.push("sublocation filed: " + nodeKey + " (write-once description from the committed t2318-t2324 fiction); camera moved there; Ammut guestbook-stamped t" + ws.turn);

// ── ② complete the bell quest ─────────────────────────────────────────────────────────────────
var obj = (bellQ.objectives || [])[0];
if (obj && !obj.done) { obj.done = true; changes.push("bell quest objective \"" + obj.text + "\" marked done — Ammut is standing at the source"); }
if (!mem.quests) mem.quests = {};
mem.quests[bellQ.title] = { title: bellQ.title, desc: bellQ.desc || "", objectives: bellQ.objectives || [], status: "completed", turn: ws.turn };
ws.questLog.splice(ws.questLog.indexOf(bellQ), 1);
changes.push("quest \"" + BELL + "\" completed and archived (owner ruling: objective met; whether it serves Karzoug or something older stays an open mystery, not a steering objective)");

// ── ③ inventory — moderate fold ───────────────────────────────────────────────────────────────
var inv = ws.character.inventory;
var before = inv.length;
// The closed-eye conspiracy case (Acts 1-2; closed with The Third's death t1911 / Thessaly's
// conviction). Patterns + explicit lines. NEVER matches: anything spiral/disc/pre-Thassilonian
// (live motif), Soot Brackstone / Golvak items (recent Karzoug agents), Thassilonian research
// (live for Act 3), heads (trophies — kept per ruling), wedding rings / wildflower (sentiment).
var CASE_PATTERNS = [/closed-eye/i, /Edric/i, /Pale Choir/i, /Face-Stealer/i, /Vess's/i, /Thessaly/i];
var CASE_EXACT = [
  "Iron clasp pin shaped like an open hand",
  "Note — three words, cramped hand, 'Watch the Spire', slipped under Hemlock's door six weeks prior",
  "Intake list — four names, Spire delivery order x2",
  "Operative's map — Sandpoint coastline, northeast cave marked in red, Thassilonian annotation",
  "Operative's letter — sealed, recommends circuit collapse, names Ammut for elimination",
  "Vellum strip — plain Common, four words: 'The third slot is open' x2",
  "Brass token — Thassilonian character for 'Seventh' x4",
  "Folded letter — 'Caul' written twice, underlined, damp ink, taken from lookout",
  "Folded list — four names, three crossed out, fourth unidentified x2",
  "Brass token x2",
  "Brass token — unfamiliar sigil, taken from ritual corpse",
  "Brass token — unfamiliar sigil, taken from drowned prisoner",
  "Ledger - Goblin patrol routes and notes",
  "Short blade — Rinn Toldrath's, plain grip, no markings",
  "Corked vial — unmarked rune seal, taken from Korunn, contents unknown",
  "Corked vial — unmarked rune seal, taken from acolyte",
  "Corked vial — unmarked rune seal, taken from Korunn's crate cache",
  "Black wax candle x6",
  "Short chain — no lock, purpose unclear x2",
  "Folded papers - workshop worker's pocket",
  "Route scrap — charcoal sketch, north fork to marked stone, blank beyond",
  "Route scrap — charcoal sketch, second copy, warehouse cache",
  "Recovered goods (trafficker wagon cache)",
  "Iron key - unusual teeth, origin unknown x11",
  "Skinsaw knife (wrapped, ritual implement)",
  "Folded letter — blue-grey paper stock, unsealed, from iron box, Hemwick's name on exterior",
  "Folded letter — blue-grey paper stock, unsealed, from iron box x2",
  "Burned scrap — 'fits the shape. Third confirmed her before...', found under strongbox false bottom",
  "Oilcloth strip — faded ink list, sewn into dead Third's robe lining",
  "Ledger (older Thassilonian header, Durnah's)"
];
var STABLE_LINES = ["Dark bay mare", "Road horse", "Cart horse (from the Spire dead-drop)", "Cart (from the Spire dead-drop)", "Saddles x3", "Bridles x3", "Saddlebags x3", "Feed bags — one week supply"];
var DROP_LINES = ["Bell x2", "Room key (Rusty Dragon) x2", "Room key"];
var DISC_LINES = ["Stone disc — carved spiral rune, unknown Thassilonian script", "Stone disc — spiral rune, taken from crowned skeleton's ribs, humming faintly", "Stone disc — spiral rune, taken from merchant lord's strongbox"];
var KEEP_ALWAYS = [/spiral/i, /pre-Thassilonian/i, /Soot Brackstone/i, /Golvak/i, /severed head/i, /Wedding rings/i, /wildflower/i, /warden/i];
// (DISC_LINES contain "spiral" and are handled by their own merge before KEEP_ALWAYS applies.)

var caseFolded = [], stabled = [], dropped = [], discs = [], kept = [];
inv.forEach(function (line) {
  if (DISC_LINES.indexOf(line) >= 0) { discs.push(line); return; }
  var protectedLine = KEEP_ALWAYS.some(function (re) { return re.test(line); });
  if (!protectedLine) {
    if (STABLE_LINES.indexOf(line) >= 0) { stabled.push(line); return; }
    if (DROP_LINES.indexOf(line) >= 0) { dropped.push(line); return; }
    if (CASE_EXACT.indexOf(line) >= 0 || CASE_PATTERNS.some(function (re) { return re.test(line); })) { caseFolded.push(line); return; }
  }
  kept.push(line);
});
if (caseFolded.length < 20) { console.error("REFUSE: only " + caseFolded.length + " conspiracy-case lines matched (expected 40+) — wrong save or inventory already pruned"); process.exit(1); }
kept.push("Closed-eye conspiracy case archive — the complete Acts 1-2 evidence (ledgers, ciphers, tokens, letters, robes, seized effects; " + caseFolded.length + " items), boxed since The Third's fall");
if (stabled.length) kept.push("Horses, cart & tack — stabled south before the northern march (" + stabled.length + " entries)");
if (discs.length) kept.push("Stone discs x3 — carved spiral rune: crowned skeleton's ribs (humming faintly), merchant lord's strongbox, and the first found");
ws.character.inventory = kept;
changes.push("inventory " + before + " → " + kept.length + " lines (moderate fold): " + caseFolded.length + " conspiracy-case lines → 1 archive line; " + stabled.length + " horse/cart/tack lines → 1; " + discs.length + " spiral stone discs → 1; dropped junk: " + dropped.join(", "));

// ── receipt ───────────────────────────────────────────────────────────────────────────────────
if (!ws.repairLog) ws.repairLog = [];
ws.repairLog.push({
  at: "t" + ws.turn,
  via: "repair-t2324-unstick (#228 field — the split-loop / bell-quest / inventory spiral)",
  changes: changes,
  preImage: { sublocation: "Eastern Ruins", bellQuest: JSON.parse(JSON.stringify(bellQ)), inventoryRemoved: { caseFolded: caseFolded, stabled: stabled, dropped: dropped, discsMerged: discs } }
});

var out = savePath.replace(/\.tnd$/, "") + "_REPAIRED.tnd";
fs.writeFileSync(out, JSON.stringify(raw));
console.log("REPAIRED → " + out);
changes.forEach(function (c) { console.log("  • " + c); });
