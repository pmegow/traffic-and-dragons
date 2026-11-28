// sabotage-786-name-given.js - prove the #786 guards are not decorative.
// #786 (owner 2026-11-25): a character is called by a description until the story gives the name. Each mutation removes
// one load-bearing clause; the named engine test must turn red, and sabotage.js restores byte-identical source after
// every case.
//   node dev/sabotage-786-name-given.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#786 a name is written only after the story gives it"]];
var WORDS="#786 nameWords keeps the words that identify a person";
var SPLIT="#786 nameProseSplit separates what is said from what is told";
var KNOWN="#786 npcNameKnown: nothing is held back without the gate";
var FIELD="#786 the FIELD case: the registration turn is clean";
var BUTTON="#786 a button that uses the name is a slip too";
var TAGS="#786 [NPC_NAMED:] gives the name and [NPC_SEEN_AS:] files the description";
var NOTE="#786 buildNameSlipNote fires once";
var BLOCK="#786 buildNamesBlock: nothing without the gate";
var LOAD="#786 the load door: a world saved before the gate";
var PANEL="#786 the panels print the description until the name is given";
var WIRED="#786 wiring: every committed reply is read";

rc|=sabotage.prove({file:"npc-names.js",command:CMD,cases:[
  {label:"#786 a title counts as the name - 'the Princess' in narration reads as a slip",find:"    if(NAME_TITLE_WORDS.indexOf(w.toLowerCase())>=0)continue;",replace:"    ",mustFail:WORDS},
  {label:"#786 a description name ('The Forest King') is held back",find:"if(!s||/^the\\s/i.test(s))return out;",replace:"if(!s)return out;",mustFail:WORDS},
  {label:"#786 a longer word matches the name (Farrenton)",find:"+\"(?![\"+NAME_LETTER+\"])\");",replace:");",mustFail:WORDS},
  {label:"#786 quoted speech is read as narration - a name said aloud is a slip and is never given",find:"    if(open)said+=c;else told+=c;",replace:"    told+=c;",mustFail:SPLIT},
  {label:"#786 the gate no longer switches the feature off - every old fixture and save holds names back",find:"||!worldState||!worldState.nameGate)return true;",replace:"||!worldState)return true;",mustFail:KNOWN},
  {label:"#786 a party member's name is held back",find:"  if(!n||n.partyMember||n.resident||n.nameGiven)return true;",replace:"  if(!n||n.resident||n.nameGiven)return true;",mustFail:KNOWN},
  {label:"#786 a relationship filed in play makes the name known (the field save's guard)",find:"  return !!(typeof memoryNpcIsPlayer===\"function\"&&memoryNpcIsPlayer(n.name));",replace:"  return _nameHeroKnows(n.name);",mustFail:KNOWN},
  {label:"#786 a name said aloud is not given - the GM is corrected for a name the hero heard",find:"    if(nameHit(parts.said,n.name)){n.nameGiven=turn||1;out.given.push(n.name);continue;}",replace:"    ",mustFail:FIELD},
  {label:"#786 a slip arms no note",find:"    worldState.namePing={turn:turn||0,slips:out.slips.slice(0,4)};",replace:"    ",mustFail:FIELD},
  {label:"#786 the buttons are not read",find:"    w=nameHit(parts.told,n.name)||nameHit(btn,n.name);",replace:"    w=nameHit(parts.told,n.name);",mustFail:BUTTON},
  {label:"#786 the engine never stops asking",find:"    if(n.nameSlips>NAME_SLIP_MAX){",replace:"    if(false){",mustFail:BUTTON},
  {label:"#786 the block lists nobody",find:"  if(show.length)s+=\"NOT YET GIVEN",replace:"  if(false)s+=\"NOT YET GIVEN",mustFail:BLOCK},
  {label:"#786 the load door never sets the gate - it would run at every load",find:"  ws.nameGate=1;",replace:"  ",mustFail:LOAD},
  {label:"#786 the load door names a seeded character nobody has met",find:"    if(typeof npcDiscovered===\"function\"&&npcDiscovered(n,m)){n.nameGiven=",replace:"    if(true){n.nameGiven=",mustFail:LOAD},
  {label:"#786 the panels print the name",find:"  return d||NAME_UNNAMED_LABEL;",replace:"  return String(name||\"\");",mustFail:PANEL}
]});
rc|=sabotage.prove({file:"tag_table.js",command:CMD,cases:[
  {label:"#786 [NPC_NAMED:] gives nothing",find:"if(!n.nameGiven){n.nameGiven=R.turn||1;R.muts.push(\"Name given: \"+nm);}",replace:"",mustFail:TAGS},
  {label:"#786 a description that carries the name is filed",find:"if(!d||(typeof nameHit===\"function\"&&nameHit(d,n.name))){",replace:"if(!d){",mustFail:TAGS},
  {label:"#786 the two tags enter the standing doc - the cached half changes",find:"\"NPC_NAMED\",\"NPC_SEEN_AS\",\"ABILITY_USED\",",replace:"\"ABILITY_USED\",",mustFail:TAGS}
]});
rc|=sabotage.prove({file:"api.js",command:CMD,cases:[
  {label:"#786 the note fires every turn",find:"  delete worldState.namePing;\n  var parts=[],i,s,n;",replace:"  var parts=[],i,s,n;",mustFail:NOTE},
  {label:"#786 a name given since the slip is still corrected",find:"    if(!n||(typeof npcNameKnown===\"function\"&&npcNameKnown(n)))continue;\n    parts.push(",replace:"    if(!n)continue;\n    parts.push(",mustFail:NOTE},
  {label:"#786 the latch is not restored when a provider call dies",find:"\"namePing\",/* #786 */",replace:"",mustFail:NOTE},
  {label:"#786 the GM is never told whose names are held back",find:"((typeof buildNamesBlock===\"function\")?buildNamesBlock():\"\")/* #786",replace:"\"\"/* #786",mustFail:BLOCK}
]});
rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#786 no reply is read for names",find:"  if(!_refusal&&typeof namesObserve===\"function\")namesObserve(resp,clean,worldState.turn);",replace:"  ",mustFail:WIRED},
  {label:"#786 a new campaign is not gated",find:"actStartTurn:0,nameGate:1,clock:",replace:"actStartTurn:0,clock:",mustFail:WIRED},
  {label:"#786 a backstory bond is a stranger at Begin",find:"  if(typeof namesBegin===\"function\")namesBegin();",replace:"  ",mustFail:WIRED}
]});
rc|=sabotage.prove({file:"state.js",command:CMD,cases:[
  {label:"#786 a save from before the gate is never healed",find:"  if(typeof namesHeal===\"function\"&&!worldState.nameGate){namesHeal(worldState,memory);_mig=true;}",replace:"  ",mustFail:WIRED}
]});
rc|=sabotage.prove({file:"helpers.js",command:CMD,cases:[
  {label:"#786 a foe's on-screen name is the registered name",find:"  if(!pub)return (typeof npcShownName===\"function\")?npcShownName(own):own;",replace:"  if(!pub)return own;",mustFail:PANEL}
]});
rc|=sabotage.prove({file:"ui-panels.js",command:CMD,cases:[
  {label:"#786 the World State panel prints the name",find:"<span class=\"sb-k\">'+escHtml(_sbRows[i].shown)+'</span>",replace:"<span class=\"sb-k\">'+escHtml(_sbRows[i].name)+'</span>",mustFail:WIRED},
  {label:"#786 the row's key is the description - the sheet no longer opens",find:"data-npc=\"'+escHtml(_sbRows[i].name)+'\"",replace:"data-npc=\"'+escHtml(_sbRows[i].shown)+'\"",mustFail:WIRED}
]});
// The changes line and the buttons (owner 2026-11-27: the prose kept to descriptions, the line and a button did not).
var MASK="#786 the changes line and the buttons never print a name the story has not given";
var ASKS="#786 the block asks for a description where a met character has none";
rc|=sabotage.prove({file:"npc-names.js",command:CMD,cases:[
  {label:"#786 the mask hides a given name too",find:"      if(!n||npcNameKnown(n)||!nameHit(s,n.name))return;",replace:"      if(!n||!nameHit(s,n.name))return;",mustFail:MASK},
  {label:"#786 a title alone is replaced",find:"        if(!nameHit(run,n.name))return m;",replace:"        ",mustFail:MASK},
  {label:"#786 the description is ignored - every name reads 'the stranger'",find:"label=String(n.seenAs||\"\").trim()||NAME_MASK_LABEL;",replace:"label=NAME_MASK_LABEL;",mustFail:MASK},
  {label:"#786 a met character with no description is never asked for one",find:"(typeof npcDiscovered===\"function\"&&npcDiscovered(n,null)?",replace:"(false?",mustFail:ASKS}
]});
rc|=sabotage.prove({file:"game.js",command:CMD,cases:[
  {label:"#786 a button prints the name",find:"    if(typeof nameMaskText===\"function\")acts=acts.map(function(a){return nameMaskText(a);});",replace:"    ",mustFail:MASK}
]});
rc|=sabotage.prove({file:"tag_table.js",command:CMD,cases:[
  {label:"#786 the changes line prints the name",find:"  if(typeof nameMaskText===\"function\")lines=lines.map(function(l){return nameMaskText(l);});",replace:"  ",mustFail:MASK}
]});
process.exit(rc);
