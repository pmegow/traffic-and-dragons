// sabotage-777-harden.js — retained proof for audit 2026-11-19 (TODO #777), section H and U4: what a file, a save or the
// model wrote is painted as text.
//   helpers.js   systemMsgHtml (H1) · jsArg (H7) · sheetNumbersHeal (H12) · the agenda (H8) · four pure renderers (H13)
//   admission.js, state.js   the numbers heal at every door and at the load · the shells: ui-shell, ui-sheets, ui-panels,
//   ui-modals, ui-browsers, ui-campaigns, ui-files, char-creation, map_viewer.html, character_editor.html · tag_table.js
// Each clause runs ONE named case of dev/tests-777-harden.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-harden.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "H1": "H1: a system line is text",
  "H12": "H12: a sheet's numeric fields are numbers after any admission door",
  "H2": "H2: the .char preview and the wizard's review card paint a file's fields as text",
  "H5": "H5: the read-only preview of another campaign's character paints age, deity, alignment and stats as text",
  "H6": "H6: a model-written sheet's alignment and spell level are text on every sheet and panel",
  "H7": "H7: a name inside an inline handler is a JavaScript string, whatever it holds",
  "H8": "H8: a sheet's agenda paints its turn numbers as text",
  "HS": "H9, H10, H11, H4: four shells paint a name, a usage kind, a visit count and a character file as text",
  "H13": "H13: four pure renderers print what they are handed as text",
  "U4": "U4: the read-only character preview offers no control that acts on the live hero"
};

prove("helpers.js", [
  { label: "H1: a system line is painted as handed",
    find: "(opts&&opts.html)?String(html==null?\"\":html):escHtml(html);}", replace: "(opts&&opts.html)?String(html==null?\"\":html):String(html==null?\"\":html);}", mustFail: ONLY + T.H1 },
  { label: "H7: the argument is not a JavaScript string",
    find: "function jsArg(v){return escHtml(JSON.stringify(String(v==null?\"\":v)));}", replace: "function jsArg(v){return escHtml(String(v==null?\"\":v));}", mustFail: ONLY + T.H7 },
  { label: "H7: the argument is not escaped for the attribute",
    find: "function jsArg(v){return escHtml(JSON.stringify(String(v==null?\"\":v)));}", replace: "function jsArg(v){return JSON.stringify(String(v==null?\"\":v));}", mustFail: ONLY + T.H7 },
  { label: "H12: the top-level numeric fields are left as they came",
    find: "for(i=0;i<SHEET_NUMBER_FIELDS.length;i++){var f=SHEET_NUMBER_FIELDS[i];fix(", replace: "for(i=0;i<0;i++){var f=SHEET_NUMBER_FIELDS[i];fix(", mustFail: ONLY + T.H12 },
  { label: "H12: a stat is left as it came",
    find: "fix(sheet.stats,k,10,1);", replace: ";", mustFail: ONLY + T.H12 },
  { label: "H12: a skill count is left as it came",
    find: "fix(sheet.skills,k,0,0);", replace: ";", mustFail: ONLY + T.H12 },
  { label: "H12: a spell level is left as it came",
    find: "fix(sheet.spells[i],\"lvl\",1,0);", replace: ";", mustFail: ONLY + T.H12 },
  { label: "H12: the agenda's turn numbers are left as they came",
    find: "{fix(sheet.agenda,\"since\",0,0);fix(sheet.agenda,\"born\",0,0);}", replace: "{}", mustFail: ONLY + T.H12 },
  { label: "H12: a completed want's turn is left as it came",
    find: "fix(q,\"done\",0,0);", replace: "", mustFail: ONLY + T.H12 },
  { label: "H12: a numeric string is thrown away",
    find: "var num=(typeof v===\"string\"&&/^\\s*-?\\d+(?:\\.\\d+)?\\s*$/.test(v))?Number(v):NaN;", replace: "var num=NaN;", mustFail: ONLY + T.H12 },
  { label: "H8: the active want's turn is painted raw",
    find: "\" · since t\"+escHtml(String(cs.agenda.since))+\"</span></div>\";", replace: "\" · since t\"+cs.agenda.since+\"</span></div>\";", mustFail: ONLY + T.H8 },
  { label: "H8: a finished want's turn is painted raw",
    find: ">t\"+escHtml(String(cs.agendaHistory[i].done))+\"</span></div>\";", replace: ">t\"+cs.agendaHistory[i].done+\"</span></div>\";", mustFail: ONLY + T.H8 },
  { label: "H13: the ticker's base text is markup",
    find: "\"'>\"+escHtml(s)+\"</span>\";/* audit 2026-11-19, H13", replace: "\"'>\"+s+\"</span>\";/* audit 2026-11-19, H13", mustFail: ONLY + T.H13 },
  { label: "H13: the capability card's tier is markup",
    find: "(\"Tier \"+escHtml(String(e.tier)));/* H13 */", replace: "(\"Tier \"+e.tier);/* H13 */", mustFail: ONLY + T.H13 },
  { label: "H13: a chapter's turn numbers are markup",
    find: "\"+escHtml(it.era?\"t\"+it.from+\"–\"+it.turn:\"t\"+it.turn)+\"</span> \"/* H13 */", replace: "\"+(it.era?\"t\"+it.from+\"–\"+it.turn:\"t\"+it.turn)+\"</span> \"/* H13 */", mustFail: ONLY + T.H13 },
  { label: "H13: a provider name from the server is markup",
    find: "x===\"google\"?\"Google\":escHtml(String(x));", replace: "x===\"google\"?\"Google\":String(x);", mustFail: ONLY + T.H13 }
]);
prove("admission.js", [
  { label: "H12: the admission registry does not heal numbers",
    find: "{name:\"numbers\",phase:\"prepare\",applies:function(){return true;},", replace: "{name:\"numbers\",phase:\"prepare\",applies:function(){return false;},", mustFail: ONLY + T.H12 }
]);
prove("state.js", [
  { label: "H12: the load heals numbers only when the packs pass",
    find: "  for(i=0;i<sheets.length;i++)if(sheetNumbersHeal(sheets[i].sheet))changed=true;/* audit 2026-11-19, H12: with the lists, before the pack check */\n", replace: "", mustFail: ONLY + T.H12 }
]);
prove("ui-shell.js", [
  { label: "H1: addMsg paints a system line as handed",
    find: "if(type===\"system\")html=systemMsgHtml(html,opts);", replace: "", mustFail: ONLY + T.H1 }
]);
prove("tag_table.js", [
  { label: "H1: the turn summary's links would print as text",
    find: "escHtml(lines.join(\" | \")),{html:true});/* H1", replace: "escHtml(lines.join(\" | \")));/* H1", mustFail: ONLY + T.H1 }
]);
prove("ui-files.js", [
  { label: "H1: a caller escapes before addMsg does",
    find: "addMsg(\"system\",\"Loaded: \"+worldState.character.name+\" Turn \"+worldState.turn);/* H1", replace: "addMsg(\"system\",\"Loaded: \"+escHtml(worldState.character.name)+\" Turn \"+worldState.turn);/* H1", mustFail: ONLY + T.H1 }
]);
prove("ui-sheets.js", [
  { label: "H5: a stat is markup on a sheet",
    find: "<div class='cs-sv'>\"+escHtml(String(v))+\"</div>", replace: "<div class='cs-sv'>\"+v+\"</div>", mustFail: ONLY + T.H5 },
  { label: "H5: the read-only sheet's age is markup",
    find: "(c.age?\" · \"+escHtml(c.age):\"\")", replace: "(c.age?\" · \"+c.age:\"\")", mustFail: ONLY + T.H5 },
  { label: "H5: the read-only sheet's deity is markup",
    find: "(c.deity?\" · \"+escHtml(c.deity):\"\")+\"</div>\"/* H5", replace: "(c.deity?\" · \"+c.deity:\"\")+\"</div>\"/* H5", mustFail: ONLY + T.H5 },
  { label: "H5: the read-only sheet's alignment is markup",
    find: "escHtml(c.actualAlignment||c.statedAlignment||\"Neutral\")+\"</span>\"/* H5: the read-only sheet */", replace: "(c.actualAlignment||c.statedAlignment||\"Neutral\")+\"</span>\"/* H5: the read-only sheet */", mustFail: ONLY + T.H5 },
  { label: "H6: the hero's alignment is markup",
    find: "escHtml(c.actualAlignment||c.statedAlignment||\"Neutral\")+\"</span>\"/* H6: the hero's sheet */", replace: "(c.actualAlignment||c.statedAlignment||\"Neutral\")+\"</span>\"/* H6: the hero's sheet */", mustFail: ONLY + T.H6 },
  { label: "H6: a companion's alignment is markup",
    find: "escHtml(sheet.actualAlignment||sheet.statedAlignment||\"Neutral\")", replace: "(sheet.actualAlignment||sheet.statedAlignment||\"Neutral\")", mustFail: ONLY + T.H6 },
  { label: "H6: a spell level is markup on a sheet",
    find: "stag=sp2.lvl===0?\"C\":escHtml(String(sp2.lvl));", replace: "stag=sp2.lvl===0?\"C\":String(sp2.lvl);", mustFail: ONLY + T.H6 },
  { label: "H9: the hero's name is markup in the bond label",
    find: "csKv(\"Bond from \"+escHtml(worldState.character.name),", replace: "csKv(\"Bond from \"+worldState.character.name,", mustFail: ONLY + T.HS },
  { label: "H9: the hero's name is markup in the dynamic label",
    find: "csKv(\"Current dynamic from \"+escHtml(worldState.character.name),", replace: "csKv(\"Current dynamic from \"+worldState.character.name,", mustFail: ONLY + T.HS },
  { label: "U4: the preview's items carry the live hero's controls",
    find: "_canDrop=(invOwner!=null),", replace: "_canDrop=(invOwner!==undefined),", mustFail: ONLY + T.U4 },
  { label: "U4: the preview's epithets carry the live hero's control",
    find: "_canRej=(invOwner!=null);", replace: "_canRej=(invOwner!==undefined);", mustFail: ONLY + T.U4 }
]);
prove("ui-panels.js", [
  { label: "H6: a spell level is markup on the spell panel",
    find: "tag=sp.lvl===0?\"C\":escHtml(String(sp.lvl));", replace: "tag=sp.lvl===0?\"C\":String(sp.lvl);", mustFail: ONLY + T.H6 }
]);
prove("ui-modals.js", [
  { label: "H10: a usage kind is markup",
    find: ">\"+escHtml(label)+\"</td>\"/* audit 2026-11-19, H10", replace: ">\"+label+\"</td>\"/* audit 2026-11-19, H10", mustFail: ONLY + T.HS }
]);
prove("ui-browsers.js", [
  { label: "H2: a file's stat is markup in the preview",
    find: "\"+escHtml(String(stats[s]||\"—\"))+\"</div></div>\";/* audit 2026-11-19, H2 */", replace: "\"+(stats[s]||\"—\")+\"</div></div>\";/* audit 2026-11-19, H2 */", mustFail: ONLY + T.H2 },
  { label: "H2: a file's HP is markup in the preview",
    find: "HP \"+escHtml(String(char.hp))+\"/\"+escHtml(String(char.maxHp))+\"</span>\"", replace: "HP \"+char.hp+\"/\"+char.maxHp+\"</span>\"", mustFail: ONLY + T.H2 },
  { label: "H2: a library entry's level is markup",
    find: "<div class='cbr-sub'>Lv\"+escHtml(String(entry.level))+\" \"", replace: "<div class='cbr-sub'>Lv\"+entry.level+\" \"", mustFail: ONLY + T.H2 },
  { label: "H2: a file's level is markup on the import setup",
    find: "margin-bottom:18px;'>Lv\"+escHtml(String(char.level||1))+\" \"", replace: "margin-bottom:18px;'>Lv\"+(char.level||1)+\" \"", mustFail: ONLY + T.H2 },
  { label: "H7: the library's delete handler builds its arguments by hand",
    find: "_cbDelLib(\"+jsArg(entry.slug)+\",\"+jsArg(entry.name)+\")", replace: "_cbDelLib(\\\"\"+escHtml(entry.slug)+\"\\\",\\\"\"+escHtml(entry.name)+\"\\\")", mustFail: ONLY + T.H7 }
]);
prove("ui-campaigns.js", [
  { label: "H7: a campaign id goes into the name's id attribute raw",
    find: "id='camp-name-\"+escHtml(cm.id)+\"'", replace: "id='camp-name-\"+cm.id+\"'", mustFail: ONLY + T.H7 },
  { label: "H7: a campaign id goes into the push button's id attribute raw",
    find: "id='camp-push-\"+escHtml(cm.id)+\"'", replace: "id='camp-push-\"+cm.id+\"'", mustFail: ONLY + T.H7 },
  { label: "H7: the rename handler builds its id argument by hand",
    find: "campStartRename(\"+jsArg(cm.id)+\")", replace: "campStartRename(\\\"\"+cm.id+\"\\\")", mustFail: ONLY + T.H7 }
]);
prove("char-creation.js", [
  { label: "H2: the review card's subrace and class are markup",
    find: "escHtml((ch.subraceNm||ch.subrace||ch.ancestry||\"\")+\" \"+(ch.cls||\"\"))+\" &middot; Lv\"", replace: "(ch.subraceNm||ch.subrace||ch.ancestry||\"\")+\" \"+(ch.cls||\"\")+\" &middot; Lv\"", mustFail: ONLY + T.H2 },
  { label: "H2: the review card's stats are markup",
    find: "<div class=\"rv2\">'+escHtml(String(fs2[s]||\"—\"))+'</div>", replace: "<div class=\"rv2\">'+(fs2[s]||\"—\")+'</div>", mustFail: ONLY + T.H2 },
  { label: "H2: the review card's max HP is markup",
    find: "<span class=\"rv\">'+escHtml(String(ch.maxHp||ch.hp||0))+'</span>", replace: "<span class=\"rv\">'+(ch.maxHp||ch.hp||0)+'</span>", mustFail: ONLY + T.H2 },
  { label: "H2: the review card's level is markup",
    find: "<span class=\"rk\">Level</span><span class=\"rv\">'+escHtml(String(ch.level||1))+'</span>", replace: "<span class=\"rk\">Level</span><span class=\"rv\">'+(ch.level||1)+'</span>", mustFail: ONLY + T.H2 },
  { label: "H2: the review card's XP is markup",
    find: "<span class=\"rk\">XP</span><span class=\"rv\">'+escHtml(String(ch.xp||0))+'</span>", replace: "<span class=\"rk\">XP</span><span class=\"rv\">'+(ch.xp||0)+'</span>", mustFail: ONLY + T.H2 }
]);
prove("map_viewer.html", [
  { label: "H11: a node's visit count is markup in its title",
    find: "\" — \"+esc(n.visits)+\" visit\"", replace: "\" — \"+n.visits+\" visit\"", mustFail: ONLY + T.HS },
  { label: "H11: a node's visit count is markup in its record",
    find: "'+esc(n.visits||0)+' visit'", replace: "'+(n.visits||0)+' visit'", mustFail: ONLY + T.HS },
  { label: "H11: a neighbour's visit count is markup",
    find: "×'+esc(kn.visits)+'</span>", replace: "×'+kn.visits+'</span>", mustFail: ONLY + T.HS }
]);
prove("character_editor.html", [
  { label: "H4: the editor's escape leaves an apostrophe",
    find: ".replace(/\"/g,\"&quot;\").replace(/'/g,\"&#39;\");}/* audit 2026-11-19, H4", replace: ".replace(/\"/g,\"&quot;\");}/* audit 2026-11-19, H4", mustFail: ONLY + T.HS },
  { label: "H4: a skill value goes into its attribute raw",
    find: "data-skill='\"+esc(s.id)+\"' value='\"+esc(n)+\"'/>", replace: "data-skill='\"+esc(s.id)+\"' value='\"+n+\"'/>", mustFail: ONLY + T.HS },
  { label: "H4: a stat value goes into its attribute raw",
    find: "data-stat='\"+s+\"' value='\"+esc(v)+\"' min='1' max='30'/>", replace: "data-stat='\"+s+\"' value='\"+v+\"' min='1' max='30'/>", mustFail: ONLY + T.HS }
]);

process.exit(failed ? 1 : 0);
