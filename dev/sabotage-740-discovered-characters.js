// dev/sabotage-740-discovered-characters.js — proves the #740 guards: the World State panel lists a character only once
// play has touched it (blank at Begin; a blueprint's seeded cast is never listed), skips the party, and carries the
// faction play filed. Each clause plants one regression in helpers.js; the named test of the #740 engine section must
// fail. The panel's own line (ui-panels.js) is proven through Chrome by the second group (skipped, said, without it).
//   node dev/sabotage-740-discovered-characters.js      (browser driver: dev/cdp-browser.js)
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js"), chrome = require("./cdp-browser.js").locateChrome();
var S = "#740 World State lists only discovered characters › #740 ";
var pure = [
  { label: "every character on the roster is discovered (the seeded cast is listed from Begin)",
    find: "  return !!(n.dead||n.introduced||n.met>0||n.status||(n.statusTurn||0)>0||mem.firstEncounter||mem.lastSeenAt||mem.lastMentioned);",
    replace: "  return true;", mustFail: S + "a seeded character the story never touched is not discovered" },
  { label: "a sighting no longer discovers a character (a seeded character met in play stays hidden)",
    find: "mem.firstEncounter||mem.lastSeenAt||mem.lastMentioned);",
    replace: "mem.firstEncounter||mem.lastMentioned);", mustFail: S + "every play signal discovers a character" },
  { label: "a status write no longer discovers a character",
    find: "n.met>0||n.status||(n.statusTurn||0)>0||",
    replace: "n.met>0||", mustFail: S + "every play signal discovers a character" },
  { label: "the rows list undiscovered characters again",
    find: "    if(!npcDiscovered(n,memNpcs?memNpcs[n.name]:null))continue;\n",
    replace: "", mustFail: S + "the rows are blank at the start, skip the party, and carry status, relation and faction" },
  { label: "the party is listed among the characters",
    find: "    if(!n||n.partyMember)continue;",
    replace: "    if(!n)continue;", mustFail: S + "the rows are blank at the start, skip the party, and carry status, relation and faction" },
  { label: "the faction's role is dropped from the row",
    find: "return e.faction+(e.role?\" [\"+e.role+\"]\":\"\");}).join(\", \")});",
    replace: "return e.faction;}).join(\", \")});", mustFail: S + "the rows are blank at the start, skip the party, and carry status, relation and faction" },
  { label: "an inherited function is read as a character's factions (a character named toString breaks the panel)",
    find: "facs=(npcFactions&&Array.isArray(npcFactions[n.name]))?npcFactions[n.name]:[];",
    replace: "facs=(npcFactions&&npcFactions[n.name])?npcFactions[n.name]:[];", mustFail: S + "a character named like an object property reads no inherited faction or memory" }
];
var panel = [
  { label: "the panel paints the whole roster again, not the discovered rows",
    find: "_sbRows=worldStateNpcRows(worldState.npcs,memory&&memory.npcs,memory&&memory.npcGraph&&memory.npcGraph.npcFactions);",
    replace: "_sbRows=worldState.npcs.filter(function(n){return !n.partyMember;}).map(function(n){return {name:n.name,text:n.rel||\"\",faction:\"\"};});",
    mustFail: "#740 the character list is blank before the story has touched anyone" },
  { label: "the panel drops the faction from the row",
    find: "var _sbText=[_sbRows[i].text,_sbRows[i].faction].filter(",
    replace: "var _sbText=[_sbRows[i].text].filter(",
    mustFail: "#740 a discovered character is listed with its relation and faction" }
];
var failed = sabotage.prove({ file: "helpers.js", command: ["node", ["dev/run-tests.js", "#740"]], cases: pure });
if (!failed) failed = sabotage.prove({ file: "ui-panels.js", skip: !chrome.path, command: ["node", ["dev/tests-611-mobile-browser.js"]], cases: panel });
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-740-discovered-characters.js", panel.length, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
