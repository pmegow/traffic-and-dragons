// dev/npc-merge-core.js drives the SHIPPING NPC_MERGE handler and treats "no mutation line" as the only failure signal.
require("./b.js");
var fs = require("fs"), root = process.env.ENGINE_ROOT, geval = eval;
geval(fs.readFileSync(root + "/dev/npc-merge-core.js", "utf8"));
function log(level, text) { console.log("    [" + level + "] " + text); }
hdr("plan: fold the stray record 'Tess the Bold' into the hero's leftover record 'Tess' (both live memory keys)");
fresh({ refs: false }); memory.npcs["Tess"] = { attitude: "", knowledge: ["k"], events: [], aliases: [] };
person("Tess the Bold", "she/her"); person("Bram", "he/him");
if (!memory.map) memory.map = { nodes: {}, edges: [] }; memory.map.nodes["Ashfen"] = { npcs: ["Tess the Bold"], firstVisit: 1, visits: 1 };
worldState.coreMemories = [{ who: "Tess the Bold", text: "swore an oath", turn: 3 }];
var plan = [{ canonical: "Tess", dupes: ["Tess the Bold"] }];
console.log("  validate: " + JSON.stringify(nmcValidatePlan(plan)));
try { nmcApplyPlan(plan, log); console.log("  nmcApplyPlan returned normally (the tool believes the merge was applied)"); } catch (e) { console.log("  nmcApplyPlan THREW: " + e.message); }
console.log("  dupe still a live record: " + !!memory.npcs["Tess the Bold"] + " | map node npcs: " + JSON.stringify(memory.map.nodes["Ashfen"].npcs) + " | coreMemories.who: " + worldState.coreMemories[0].who);
try { console.log("  post-checks fatal count: " + nmcPostChecks(plan, log)); } catch (e2) { console.log("  nmcPostChecks threw: " + e2.message); }
