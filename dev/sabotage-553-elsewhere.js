// dev/sabotage-553-elsewhere.js — proves the #553 guards are guarded (owner 2026-10-02, "Silas is still being creepy":
// in the Village a resident who is not in the hero's place is silent — the roster marks them ELSEWHERE, the preamble
// states the rule, and a reply that gave such a resident a line is named on the next turn). Disposable clones.
//   node dev/sabotage-553-elsewhere.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#553 the Village"]];

rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the roster stops marking an absent resident",
    find: "if(!_rosterPresent[String(npc.name).toLowerCase()]){var _ewh=", replace: "if(false){var _ewh=",
    mustFail: "the absent resident's entry must LEAD with ELSEWHERE" },
  { label: "the mark is appended instead of leading the entry",
    find: "npcBits.unshift(\"ELSEWHERE\"", replace: "npcBits.push(\"ELSEWHERE\"",
    mustFail: "the absent resident's entry must LEAD with ELSEWHERE" },
  { label: "every resident is marked, present or not (the manifest is ignored)",
    find: "if(!_rosterPresent[String(npc.name).toLowerCase()]){var _ewh=", replace: "if(true){var _ewh=",
    mustFail: "the PRESENT resident was marked elsewhere" },
  { label: "the mark fires in every kind (the flag is ignored)",
    find: "if(npc.resident&&!npc.partyMember&&typeof kindDef===\"function\"&&kindDef().residentsSilentElsewhere){", replace: "if(npc.resident&&!npc.partyMember){",
    mustFail: "an adventure roster or preamble carries the village mark" },
  { label: "the note names a resident who is local now (the GM walked him in by tag)",
    find: "var spoke=elsewhereSpeakers(last,worldState.npcs||[],local);", replace: "var spoke=elsewhereSpeakers(last,worldState.npcs||[],{});",
    mustFail: "the PRESENT resident was named" },
  { label: "the note fires in an adventure",
    find: "if(typeof kindDef!==\"function\"||!kindDef().residentsSilentElsewhere||typeof worldState===\"undefined\"||!worldState||worldState.combat)return\"\";", replace: "if(typeof worldState===\"undefined\"||!worldState||worldState.combat)return\"\";",
    mustFail: "an adventure must never fire this note" },
  { label: "the builder leaves the delivery list",
    find: "/* #553 */buildElsewhereSpeechNote,", replace: "",
    mustFail: "not in NOTE_BUILDERS" }
]});
rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "a party member with a line is named as an absent resident",
    find: "if(!n||!n.resident||n.partyMember||(typeof npcIsDead===\"function\"&&npcIsDead(n)))continue;", replace: "if(!n||!n.resident||(typeof npcIsDead===\"function\"&&npcIsDead(n)))continue;",
    mustFail: "expected Silas alone" },
  { label: "aliases stop resolving to the roster row",
    find: "(n.aliases||[]).forEach(function(a){if(a)byLow[String(a).toLowerCase()]=n;});", replace: "",
    mustFail: "a line tagged with the alias alone must resolve to the resident" }
]});
rc |= sabotage.prove({ file: "data.js", command: CMD, cases: [
  { label: "the village preamble drops the rule",
    find: " Only a resident who is in the hero's own place speaks or acts in a scene: a resident marked ELSEWHERE on the roster is silent this turn and does not come to the hero — the hero goes to them.", replace: "",
    mustFail: "the village preamble does not state the rule" },
  { label: "the village loses the flag",
    find: "    residentsSilentElsewhere:true,\n", replace: "",
    mustFail: "the village kind must carry residentsSilentElsewhere" }
]});
process.exit(rc ? 1 : 0);
