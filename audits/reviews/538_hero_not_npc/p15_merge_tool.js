// The owner's merge tool (dev/npc-merge-core.js, used by dev/npc-merge-tool.js and the studio) drives the SHIPPING NPC_MERGE handler and
// "throws on a handler no-op so hosts can abort before writing anything": if(!R.muts.length)throw. A refusal now leaves a line in R.muts.
// State: a hero swap happened; the promoted hero's record ("Bram Stoneheart") has a fork key "Bram"; the plan folds the fork into it.
require("./common.js");
var fs = require("fs"), path = require("path"), geval = eval;
geval(fs.readFileSync(path.join(TREE, "dev", "npc-merge-core.js"), "utf8"));
P("version", ver());
makeWorld(); delete worldState.kind; worldState.turn = 9;
var sheet = { name: "Bram Stoneheart", gender: "M", hp: 9, maxHp: 9, inventory: [], conditions: [], relationships: [], aliases: [], cls: "Warrior", level: 1, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, abilities: [], spells: [], skills: initSkills() };
worldState.npcs = [{ name: "Bram Stoneheart", status: "ally", rel: "companion", met: 1, partyMember: true, pronouns: "he/him", portrait: null, aliases: [], charSheet: sheet },
  { name: "Mara", status: "present", rel: "ally", met: 2, partyMember: true, pronouns: "she/her", portrait: null, aliases: [], charSheet: { name: "Mara", hp: 8, maxHp: 8, inventory: [], conditions: [], relationships: [{ entity: "Bram", bond: "Friend", bondTurn: 1, dynamic: "", dynamicTurn: null }] } }];
memory.npcs = { "Bram Stoneheart": { attitude: "ally", knowledge: ["forged the gate"], events: [{ turn: 1, note: "met at the forge" }], aliases: [], pronouns: "he/him", partyMember: true },
  "Bram": { attitude: "", knowledge: ["owes the miller"], events: [{ turn: 2, note: "sold nails" }], aliases: [] },
  "Mara": { attitude: "", knowledge: [], events: [], aliases: [], partyMember: true } };
memory.map = { nodes: { "Ashfen": { firstVisit: 1, visits: 3, description: null, parent: null, npcs: ["Bram", "Mara"], items: [], size: "small", travelMins: null } }, edges: [], lastArrivalFrom: null };
var q = quiet(function () { return swapPlayerCharacter("Bram Stoneheart"); }); P("swap", q.r && q.r.ok);
var plan = [{ canonical: "Bram Stoneheart", dupes: ["Bram"] }], lines = [], threw = null;
function log(level, text) { lines.push(level + ": " + text); }
P("plan errors", nmcValidatePlan(plan));
try { quiet(function () { nmcApplyPlan(plan, log); }); } catch (e) { threw = e.message; }
P("nmcApplyPlan threw", threw);
lines.forEach(function (l) { P("   log", l.slice(0, 220)); });
P("after the surgery: memory keys", Object.keys(memory.npcs)); P("   node npcs", memory.map.nodes["Ashfen"].npcs); P("   Mara's bonds", wsNpcByName("Mara").charSheet.relationships.map(function (r) { return r.entity + ":" + r.bond; }));
var post = [], fatal = quiet(function () { return nmcPostChecks(plan, function (lv, tx) { post.push(lv + ": " + tx); }); });
P("post-check fatal count (the write is gated on 0)", fatal.r); post.filter(function (l) { return /^fatal/.test(l); }).forEach(function (l) { P("   ", l.slice(0, 220)); });
