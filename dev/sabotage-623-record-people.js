// dev/sabotage-623-record-people.js — proves the #623 guards are guarded (owner field report 2026-10-12: Daeris, a dark-skinned
// Vashari cleric on her library sheet, narrated "pale" before she joined; a GM-side join never looked in the library). The
// rules mutated back: the candidates ignore the roster (a seated person is seated twice); the seat forgets the record mark (the
// block goes silent); the block reads party members too; the block leaves the stable half; the join stops asking the library.
//   node dev/sabotage-623-record-people.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#623 people of the record"]];
var code = 0;
code |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the candidates ignore the roster: a seated or partied person is a candidate again",
    find: "  for(i=0;i<(roster||[]).length;i++){if(roster[i]&&roster[i].name)seen[String(roster[i].name).toLowerCase()]=1;}\n", replace: "",
    mustFail: "#623 recordPeopleCandidates" },
  { label: "the library lookup is case-sensitive again",
    find: "if(c&&c.name&&String(c.name).toLowerCase().trim()===k)return e;", replace: "if(c&&c.name&&String(c.name).trim()===String(name||\"\").trim())return e;",
    mustFail: "#623 recordPeopleCandidates" }
] });
code |= sabotage.prove({ file: "game.js", command: CMD, cases: [
  { label: "the seat forgets the record mark: nothing is ever described from the record",
    find: "partyMember:false,portrait:null,aliases:[],recordPerson:true};", replace: "partyMember:false,portrait:null,aliases:[]};",
    mustFail: "#623 seatRecordPeople" },
  { label: "a refused sheet leaves its wrapper on the roster",
    find: "worldState.npcs.pop();out.refused.push(cd.name);", replace: "out.refused.push(cd.name);",
    mustFail: "#623 seatRecordPeople" },
  { label: "the join stops asking the library: every joiner is invented again",
    find: "    var e=(typeof libraryEntryFor===\"function\"&&recordPersonBond(worldState.character,n.name))?libraryEntryFor(legacyLibCache,n.name):null;\n", replace: "    var e=null;\n",
    mustFail: "#623 a joiner with a library sheet takes it" },
  { label: "#637 the join adopts for ANY library namesake again (a same-named stranger fuses with the library character)",
    find: "&&recordPersonBond(worldState.character,n.name))?libraryEntryFor(legacyLibCache,n.name):null;", replace: ")?libraryEntryFor(legacyLibCache,n.name):null;",
    mustFail: "#637 a same-named stranger is generated" },
  { label: "#637 the adoption goes quiet again (console only, no toast)",
    find: "if(typeof showToast===\"function\")showToast(n.name+\" joins with their library sheet \\u2014 one of your own people, on record\",5000);", replace: "",
    mustFail: "#637 a same-named stranger is generated" },
  { label: "#637 every seated person is 'ally' again, a nemesis included",
    find: "rel:bondRelWord(cd.bond),met:0", replace: "rel:\"ally\",met:0",
    mustFail: "#637 a seated person's roster relation" },
  { label: "startGame no longer seats the people of the record",
    find: "  seatRecordPeopleFromLibrary();/* #623: the hero's own people, from their library sheets, before the opening is written */\n", replace: "",
    mustFail: "#623 a joiner with a library sheet takes it" }
] });
code |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the block reads party members too (a companion is described twice, once stale)",
    find: "if(!n||!n.recordPerson||n.partyMember||!n.charSheet||", replace: "if(!n||!n.recordPerson||!n.charSheet||",
    mustFail: "#623 PEOPLE OF THE RECORD" },
  { label: "the block leaves the stable half",
    find: "    +buildRecordPeopleBlock();/* #623:", replace: "    ;/* #623:",
    mustFail: "#623 PEOPLE OF THE RECORD" },
  { label: "the look is dropped from the block: the GM is left to invent it",
    find: "+(cs.appear?\". Look: \"+String(cs.appear).slice(0,140):\"\"));}", replace: ");}",
    mustFail: "#623 PEOPLE OF THE RECORD" }
] });
process.exit(code);
