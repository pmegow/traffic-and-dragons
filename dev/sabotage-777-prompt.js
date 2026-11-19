// sabotage-777-prompt.js — retained proof for audit 2026-11-19 (TODO #777), batch 4: what the prompt carries and what a
// campaign is built from.
//   api.js        P6 the shelve survives a failed turn · P7 the elsewhere lines follow the roster rule · P8 the readers skip
//                 an unreadable condition · P9 no age · P10 the ring on the withheld path · P11 the buttons line · H3 the
//                 rules in force
//   game.js       P12 the place cue · H3 a blueprint's rules go to its campaign · C13–C15 blueprint validation
//   memory.js     K1 the talk's detail · K2 Table Talk's contents
//   campaign_generator.js   C1 the age ladder across the correction · C2 arcs are checked
//   helpers.js    P8 sheetListsHeal · H3 rulesInForce and the escaped list
//   admission.js, state.js   P8 the door and the load's count · table-talk.js, companion-talk.js, ui-modals.js   the callers
// Each clause runs ONE named case of dev/tests-777-prompt.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-prompt.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "P6": "P6: a reward shelved and accepted while a request that then FAILS was out is not queued and paid a second time",
  "P6B": "P6: a failed turn still un-delivers a conflict note that shelved nothing",
  "P7": "P7: characters last seen elsewhere long ago are counted, not listed",
  "P8L": "P8: a null entry in a sheet's conditions is removed at the load, and said",
  "P8D": "P8: a sheet admitted at any other door loses the entry too, and that door says so",
  "P8R": "P8: a null entry that reaches a live sheet does not fail the turn",
  "P9": "P9: the legacy-character block carries no age",
  "P10": "P10: a reply whose tags the public map withholds is still on the provenance ring",
  "P11": "P11: a legacy [ACTIONS:] line followed by a tag keeps the tag out of the third button",
  "P12": "P12: the place cue names a place only from capitalised words",
  "K1": "K1: a talk with a companion is given neither its GM-only authored secret nor the blueprint's note about it",
  "K2": "K2: Table Talk is not told of characters the player has not discovered, nor of the GM's pending events",
  "C1": "C1: the corrected skeleton keeps the campaign's age ladder",
  "C2": "C2: a corrected skeleton with a null arc, or an arc with no title or objective, is refused inside the review",
  "C13": "C13: a blueprint NPC with no name, a blank name, or a name the tags cannot address is refused with the reason",
  "C14": "C14: a null entry in a blueprint's acts, arcs, NPCs or locations is a reason, never a throw",
  "C15": "C15: two blueprint NPCs with one name are refused by name",
  "H3": "H3: a blueprint's rules belong to its campaign",
  "H3M": "H3: Narrative Rules shows a rule as text",
  "RP6": "review P6: through the turn's real note build, a reward shelved and taken before a failed request is not queued again",
  "RP7": "review P7: a character named in the action being sent is listed this turn, and Table Talk keeps the whole list",
  "K2R": "K2 ruling: Table Talk lists the pending events the hero knows of, and only those",
  "RK2": "review K2: Table Talk still knows a character the summariser filed from play",
  "RC13": "review C13: a blueprint that reaches the game unvalidated starts it all the same",
  "RC13D": "review C13: the designer's draft check passes over a row nobody has named yet, and nothing else",
  "RP10": "review P10: the withheld reply's ring entry claims no tag was applied",
  "RP11": "review P11: a bare tag after the buttons line is cut too",
  "RP12": "review P12: a place named type-first is still a place",
  "RP8": "review P8: the load removes an unreadable condition even when the campaign's packs are refused",
  "RC2": "review C2: a first draft with one unusable arc keeps its spine",
  "RC1": "review C1: a correction that returns the age ladder as null does not drop it"
};

prove("api.js", [
  { label: "P6: the failed turn's restore hands the spent reward back to the conflict",
    find: "  conflictShelveKeep(typeof snap.shelveSeq===\"number\"?snap.shelveSeq:_conflictShelveSeq);/* P6: after identityConflicts is back */\n", replace: "", mustFail: ONLY + T.P6 },
  { label: "P6: the shelve is not remembered for the restore",
    find: "_conflictShelved.push({seq:++_conflictShelveSeq,subject:c.subject,key:c.withheld.join(\"\"),attempts:c.attempts,lastFired:c.lastFired});", replace: "", mustFail: ONLY + T.P6 },
  { label: "P6: an earlier turn's shelve is applied to a later conflict",
    find: "if(!(s.seq>since))continue;", replace: "", mustFail: ONLY + T.P6B },
  { label: "P6: the shelve log grows without bound",
    find: "if(_conflictShelved.length>CONFLICT_SHELVE_LOG)_conflictShelved.shift();", replace: "", mustFail: ONLY + T.P6B },
  { label: "review P6: a snapshot does not know what was shelved after it (the builders after the shelve wipe it)",
    find: "  snap.shelveSeq=_conflictShelveSeq;/* P6:", replace: "  /* P6:", mustFail: ONLY + T.RP6 },
  { label: "review P7: Table Talk's last-seen lines are folded",
    find: "_gbKeep=audience===\"player\"?function(){return true;}", replace: "_gbKeep=false?function(){return true;}", mustFail: ONLY + T.RP7 },
  { label: "review P7: the action being sent is not heard by the geography judge",
    find: "+\" \"+String((typeof lastAction===\"string\"&&lastAction)||\"\").toLowerCase()", replace: "", mustFail: ONLY + T.RP7 },
  { label: "review P10: the withheld entry lists its tags as applied",
    find: "tags:[],carried:_whNames,", replace: "tags:_whNames,carried:_whNames,", mustFail: ONLY + T.RP10 },
  { label: "review P11: a bare tag after the buttons line rides into a button",
    find: "(?:[:\\]][\\s\\S]*)?$/,\"\");/* review: cut only", replace: "[:\\]][\\s\\S]*$/,\"\");/* review: cut only", mustFail: ONLY + T.RP11 },
  { label: "review P11: a bracketed word in an earlier action cuts the buttons after it",
    find: "_acB=_acB.slice(0,_acP+1)+_acB.slice(_acP+1).replace(", replace: "_acB=_acB.replace(", mustFail: ONLY + T.RP11 },
  { label: "P7: every character ever sighted elsewhere is listed",
    find: "{_gbFold++;continue;}/* P7 */", replace: "{}/* P7 */", mustFail: ONLY + T.P7 },
  { label: "P7: the folded characters are not counted",
    find: "if(_gbFold)lines.push(\"Elsewhere, not listed: \"", replace: "if(false)lines.push(\"Elsewhere, not listed: \"", mustFail: ONLY + T.P7 },
  { label: "P8: a null condition fails the prompt",
    find: "  if(!x||typeof x!==\"object\")return \"\";/* audit 2026-11-19, P8:", replace: "  /* audit 2026-11-19, P8:", mustFail: ONLY + T.P8R },
  { label: "P8: a null condition leaves a hole in the hero's conditions line",
    find: "c.conditions.map(condInjectFmt).filter(Boolean).join(\", \")", replace: "c.conditions.map(condInjectFmt).join(\", \")", mustFail: ONLY + T.P8R },
  { label: "P8: a null condition leaves a hole in a companion's conditions line",
    find: "pcs.conditions.map(condInjectFmt).filter(Boolean).join(\", \")", replace: "pcs.conditions.map(condInjectFmt).join(\", \")", mustFail: ONLY + T.P8R },
  { label: "P8: a null condition fails the condition audit",
    find: "if(!cd||typeof cd!==\"object\")continue;/* P8 */", replace: "/* P8 */", mustFail: ONLY + T.P8R },
  { label: "P9: the legacy block states the age again",
    find: "+\" (Level \"+_lc.level+\")\"+\".\\n\"/* audit 2026-11-19, P9", replace: "+\" (Level \"+_lc.level+\")\"+(_lc.age?\", \"+_lc.age:\"\")+\".\\n\"/* audit 2026-11-19, P9", mustFail: ONLY + T.P9 },
  { label: "P10: a withheld reply writes no ring entry",
    find: "      worldState.tagLog.push(_whEntry);\n", replace: "", mustFail: ONLY + T.P10 },
  { label: "P10: the ring entry does not say why nothing was applied",
    find: ",withheld:String(_mapMovementProblem).slice(0,200)};", replace: "};", mustFail: ONLY + T.P10 },
  { label: "P10: an unclosed opener on the withheld path is not recorded",
    find: "      if(_unclosed.length)_whEntry.unclosed=_unclosed.slice(0,6);\n", replace: "", mustFail: ONLY + T.P10 },
  { label: "P11: a tag after the buttons line rides into the third button",
    find: "_acB=_acB.slice(0,_acP+1)+_acB.slice(_acP+1).replace(/\\]\\s*\\[[A-Z][A-Z_]{1,}(?:[:\\]][\\s\\S]*)?$/,\"\");", replace: "", mustFail: ONLY + T.P11 },
  { label: "H3: the rules block reads the device's rules only",
    find: "DEFAULT_RULES.concat(rulesInForce().map(", replace: "DEFAULT_RULES.concat(customRules.map(", mustFail: ONLY + T.H3 }
]);
prove("game.js", [
  { label: "P12: a type noun alone is a place",
    find: "){1,3}(?:[Cc]hamber|", replace: "){0,3}(?:[Cc]hamber|", mustFail: ONLY + T.P12 },
  { label: "P12: the name half matches any letter again",
    find: "[Cc]itadel|[Kk]eep))\\b/);", replace: "[Cc]itadel|[Kk]eep))\\b/i);", mustFail: ONLY + T.P12 },
  { label: "H3: a blueprint's rule is copied to the device-wide store",
    find: "worldState.campaignRules.indexOf(wrapped)===-1)worldState.campaignRules.push(wrapped);", replace: "worldState.campaignRules.indexOf(wrapped)===-1)customRules.push(wrapped);", mustFail: ONLY + T.H3 },
  { label: "H3: a blueprint made from the campaign loses the campaign's rules",
    find: "    rules:      rulesInForce(),", replace: "    rules:      (customRules||[]).slice(),", mustFail: ONLY + T.H3 },
  { label: "C13: a nameless NPC passes",
    find: "if(typeof _vbe.name!==\"string\"||!_vbe.name.trim())return\"NPC \"", replace: "if(false)return\"NPC \"", mustFail: ONLY + T.C13 },
  { label: "C13: a name the tags cannot address passes",
    find: "if(/[|\\[\\]]/.test(_vbe.name))return\"NPC ", replace: "if(false)return\"NPC ", mustFail: ONLY + T.C13 },
  { label: "C14: a null NPC throws",
    find: "    if(!_vbe||typeof _vbe!==\"object\")return\"NPC \"+(_vbn+1)+\" is not an entry.\";\n", replace: "", mustFail: ONLY + T.C14 },
  { label: "C14: a null act throws",
    find: "if(!a||typeof a!==\"object\")return\"Act \"+(i+1)+\" is not an act entry.\";", replace: "", mustFail: ONLY + T.C14 },
  { label: "C14: a null arc throws",
    find: "if(!a.arcs[j]||typeof a.arcs[j]!==\"object\")return\"Act \"+(i+1)+\", arc \"+(j+1)+\" is not an arc entry.\";", replace: "", mustFail: ONLY + T.C14 },
  { label: "C14: a null location passes into the game's start",
    find: "    if(!_vbl||typeof _vbl!==\"object\")return\"Location \"+(_vbn+1)+\" is not an entry.\";\n", replace: "", mustFail: ONLY + T.C14 },
  { label: "C14: a nameless location passes",
    find: "if(typeof _vbl.name!==\"string\"||!_vbl.name.trim())return\"Location \"", replace: "if(false)return\"Location \"", mustFail: ONLY + T.C14 },
  { label: "C14: NPCs that are not a list pass",
    find: "  if(!Array.isArray(_vbNpcs))return\"Blueprint NPCs must be a list.\";\n", replace: "", mustFail: ONLY + T.C14 },
  { label: "C14: locations that are not a list pass",
    find: "  if(!Array.isArray(_vbLocs))return\"Blueprint locations must be a list.\";\n", replace: "", mustFail: ONLY + T.C14 },
  { label: "C15: two NPCs under one name pass",
    find: "if(_vbSeen[_vbk])return\"Two NPCs share", replace: "if(false)return\"Two NPCs share", mustFail: ONLY + T.C15 },
  { label: "review P12: a place named type-first is no place",
    find: "    if(g)return g[1].replace(/[.\\s]+$/,\"\");", replace: "", mustFail: ONLY + T.RP12 },
  { label: "review C13: a nameless or unaddressable NPC of an unvalidated blueprint is seated",
    find: "if(!n||typeof n!==\"object\"||typeof n.name!==\"string\"||!n.name.trim()||/[|\\[\\]]/.test(n.name)){_bpSkipped++;continue;}", replace: "if(!n){_bpSkipped++;continue;}", mustFail: ONLY + T.RC13 },
  { label: "review C13: a null NPC of an unvalidated blueprint throws at the start",
    find: "if(!n||typeof n!==\"object\"||typeof n.name", replace: "if(typeof n!==\"object\"||typeof n.name", mustFail: ONLY + T.RC13 },
  { label: "review C13: a null or nameless location of an unvalidated blueprint is filed",
    find: "      if(!loc||typeof loc!==\"object\"||typeof loc.name!==\"string\"||!loc.name.trim()){_bpSkipped++;continue;}\n", replace: "", mustFail: ONLY + T.RC13 },
  { label: "review C13: the skipped entries are not said",
    find: "if(typeof showToast===\"function\")showToast(\"⚠ \"+_bpSkipped+\" entr\"", replace: "if(false)showToast(\"⚠ \"+_bpSkipped+\" entr\"", mustFail: ONLY + T.RC13 },
  { label: "review C13: a null beside an entry throws in the portrait match",
    find: "if(sources[i]&&identityNameFold(sources[i].name)===fold)count++;", replace: "if(identityNameFold(sources[i].name)===fold)count++;", mustFail: ONLY + T.RC13 },
  { label: "review C13: the draft check refuses an unnamed NPC row",
    find: "  if(Array.isArray(bp.npcs))view.npcs=bp.npcs.filter(named);\n", replace: "", mustFail: ONLY + T.RC13D },
  { label: "review C13: the draft check refuses an unnamed location row",
    find: "  if(Array.isArray(bp.locations))view.locations=bp.locations.filter(named);\n", replace: "", mustFail: ONLY + T.RC13D },
  { label: "review C13: the draft check leaves every row out",
    find: "&&typeof e.name===\"string\"&&!e.name.trim());}", replace: ");}", mustFail: ONLY + T.RC13D },
  { label: "review C2: the game checks a first draft without dropping its unusable arcs",
    find: "  skeletonPruneArcs(skel);validateSkeletonStructure(skel);/* review", replace: "  validateSkeletonStructure(skel);/* review", mustFail: ONLY + T.RC2 }
]);
prove("memory.js", [
  { label: "K1: the talk is given the authored secret",
    find: "if(_gmOnly)_secret=\"\";", replace: "", mustFail: ONLY + T.K1 },
  { label: "K1: the talk is given the blueprint's GM note",
    find: "if(_gmOnly)_auth=\"\";", replace: "", mustFail: ONLY + T.K1 },
  { label: "K2: Table Talk lists undiscovered characters",
    find: "_nkF=_player?function(nm){", replace: "_nkF=false?function(nm){", mustFail: ONLY + T.K2 },
  { label: "K2: Table Talk is told how many characters are hidden",
    find: "if(_player)_nkFold=0;", replace: "", mustFail: ONLY + T.K2 },
  { label: "K2: Table Talk is told the GM's pending events",
    find: "  if(fe.length&&!_player){var fs=[];", replace: "  if(fe.length){var fs=[];", mustFail: ONLY + T.K2 },
  { label: "K2: Table Talk loses the full list of visited places",
    find: "if(_player)_subCap=Infinity;", replace: "", mustFail: ONLY + T.K2 },
  { label: "review K2: a character filed from play with no roster row is hidden",
    find: "if(!_w)return !!(_m.dead||(_m.knowledge&&_m.knowledge.length)||(_m.events&&_m.events.length)||", replace: "if(!_w)return !!(_m.dead||", mustFail: ONLY + T.RK2 },
  { label: "review K2: a roster row with a play-filed event is hidden",
    find: "return npcDiscovered(_w,_m)||!!(_m.events&&_m.events.length);}", replace: "return npcDiscovered(_w,_m);}", mustFail: ONLY + T.RK2 }
]);
prove("table-talk.js", [
  { label: "K2: Table Talk asks for the GM's contents",
    find: "memoryTOC({audience:\"player\"})", replace: "memoryTOC()", mustFail: ONLY + T.K2 }
]);
prove("companion-talk.js", [
  { label: "K1: the talk asks for the whole dossier",
    find: "{omitAbilities:true,omitGmOnly:true}", replace: "{omitAbilities:true}", mustFail: ONLY + T.K1 }
]);
prove("campaign_generator.js", [
  { label: "C1: the correction drops what the draft carried beside premise and acts",
    find: "&&fixed[k]==null)fixed[k]=skel[k];}", replace: "&&fixed[k]==null){}}", mustFail: ONLY + T.C1 },
  { label: "review C1: a ladder answered as null is dropped",
    find: "&&fixed[k]==null)fixed[k]=skel[k];}", replace: "&&fixed[k]===undefined)fixed[k]=skel[k];}", mustFail: ONLY + T.RC1 },
  { label: "review C2: the unusable arcs of a first draft are kept",
    find: "console.warn(\"[skeleton] \"+(a.arcs.length-kept.length)+\" unusable arc(s) dropped from act \"+(i+1)+\" of the draft (no title or objective)\");a.arcs=kept;}}", replace: "console.warn(\"[skeleton] \"+(a.arcs.length-kept.length)+\" unusable arc(s) dropped from act \"+(i+1)+\" of the draft (no title or objective)\");}}", mustFail: ONLY + T.RC2 },
  { label: "review C2: the designer's draft is checked without dropping its unusable arcs",
    find: "  skeletonPruneArcs(draft);validateSkeletonStructure(draft);", replace: "  validateSkeletonStructure(draft);", mustFail: ONLY + T.RC2 },
  { label: "C2: a null arc passes the structure check",
    find: "      if(!r||typeof r!==\"object\")throw new Error(\"Act \"+(i+1)+\", arc \"+(j+1)+\" is not an arc\");\n", replace: "", mustFail: ONLY + T.C2 },
  { label: "C2: an arc with no title passes",
    find: "if(typeof r.title!==\"string\"||!r.title.trim())throw", replace: "if(false)throw", mustFail: ONLY + T.C2 },
  { label: "C2: an arc with no objective passes",
    find: "if(typeof r.objective!==\"string\"||!r.objective.trim())throw", replace: "if(false)throw", mustFail: ONLY + T.C2 },
  { label: "C2: a null act passes",
    find: "    if(!a||typeof a!==\"object\")throw new Error(\"Act \"+(i+1)+\" is not an act\");\n", replace: "", mustFail: ONLY + T.C2 }
]);
prove("helpers.js", [
  { label: "P8: nothing is removed from a sheet's conditions",
    find: "if(rule.ok(list[j]))kept.push(list[j]);else{n++;", replace: "if(true)kept.push(list[j]);else{n++;", mustFail: ONLY + T.P8L },
  { label: "P8: a nameless condition is kept",
    find: "&&typeof x.name===\"string\"&&!!x.name.trim();}}", replace: ";}}", mustFail: ONLY + T.P8L },
  { label: "H3: a rule on the device and on the campaign is stated twice",
    find: "if(typeof c[i]===\"string\"&&out.indexOf(c[i])<0)out.push(c[i]);", replace: "if(typeof c[i]===\"string\")out.push(c[i]);", mustFail: ONLY + T.H3 },
  { label: "H3: a device rule is painted as markup",
    find: "<span>\"+escHtml(customRules[i])+\"</span>", replace: "<span>\"+customRules[i]+\"</span>", mustFail: ONLY + T.H3M },
  { label: "H3: a campaign rule is painted as markup",
    find: "<span style='flex:1;'>\"+escHtml(c[i])+\"</span>", replace: "<span style='flex:1;'>\"+c[i]+\"</span>", mustFail: ONLY + T.H3M }
]);
prove("admission.js", [
  { label: "P8: the admission registry does not heal a sheet's lists",
    find: "{name:\"lists\",phase:\"prepare\",applies:function(){return true;},", replace: "{name:\"lists\",phase:\"prepare\",applies:function(){return false;},", mustFail: ONLY + T.P8D },
  { label: "P8: a door other than the load says nothing",
    find: "if(ctx.toast!==false&&typeof showToast===\"function\")showToast(\"⚠ \"+_ld+\" unreadable entr\"", replace: "if(false)showToast(\"⚠ \"+_ld+\" unreadable entr\"", mustFail: ONLY + T.P8D }
]);
prove("state.js", [
  { label: "P8: the load says nothing",
    find: "if(_entries){changed=true;if(typeof showToast===\"function\")showToast(", replace: "if(_entries){changed=true;if(false)showToast(", mustFail: ONLY + T.P8L },
  { label: "review P8: the load heals lists only when the packs pass",
    find: "  for(i=0;i<sheets.length;i++)_entries+=sheetListsHeal(sheets[i].sheet);\n", replace: "", mustFail: ONLY + T.RP8 }
]);
prove("blueprint-designer.html", [
  { label: "review C13: applying a review fix judges a draft with the save's check",
    find: "    var err=validateBlueprintDraft(bp);/* #777 review", replace: "    var err=validateBlueprint(bp);/* #777 review", mustFail: ONLY + T.RC13D }
]);
prove("designer-assistant-ui.js", [
  { label: "review C13: an assistant proposal judges a draft with the save's check",
    find: "validate:validateBlueprintDraft/*", replace: "validate:validateBlueprint/*", mustFail: ONLY + T.RC13D }
]);
prove("ui-modals.js", [
  { label: "H3: the modal does not paint the escaped list",
    find: "    h+=rulesListHtml();/* audit 2026-11-19, H3:", replace: "    /* audit 2026-11-19, H3:", mustFail: ONLY + T.H3M }
]);
// K2, second ruling (owner 2026-11-19): the `known` marker on a pending event
prove("memory.js", [
  { label: "K2 ruling: every event is filed as known",
    find: "  if(known===true)memory.futureEvents[memory.futureEvents.length-1].known=true;", replace: "  memory.futureEvents[memory.futureEvents.length-1].known=true;", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: a marked event is not filed as known",
    find: "  if(known===true)memory.futureEvents[memory.futureEvents.length-1].known=true;", replace: "  ", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the same event filed again as known stays the GM's own",
    find: "{if(known===true)memory.futureEvents[i].known=true;return;}}// dedupe", replace: "{return;}}// dedupe", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: a known restatement does not mark the thread it folds into",
    find: "      if(known===true)ex.known=true;", replace: "      ", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: Table Talk is told every pending event",
    find: "return !e.resolved&&e.known===true;}).slice(-8)", replace: "return !e.resolved;}).slice(-8)", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: anything truthy counts as known",
    find: "&&e.known===true;}).slice(-8)", replace: "&&e.known;}).slice(-8)", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: a bare heading says events are withheld",
    find: "    if(fk.length)lines.push(\"PENDING EVENTS: \"+fk.join(\"; \"));", replace: "    lines.push(\"PENDING EVENTS: \"+fk.join(\"; \"));", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the summariser's marker is read loosely",
    find: "worldState.turn,fe.known===true);}}", replace: "worldState.turn,!!fe.known);}}", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the summariser's schema has no marker",
    find: ",\\\"known\\\":false}]", replace: "}]", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the summariser is not told what known means",
    find: "  p+=\"\\nKNOWN EVENTS: in futureEvents", replace: "  if(false)p+=\"\\nKNOWN EVENTS: in futureEvents", mustFail: ONLY + T.K2R }
]);
prove("tag_table.js", [
  { label: "K2 ruling: the GM's marker is not read",
    find: "else if(/\\|\\s*known\\s*$/i.test(_fw)){_fk=true;", replace: "else if(false){_fk=true;", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the marker stays in the when",
    find: "_fw=_fw.replace(/\\|\\s*known\\s*$/i,\"\");}", replace: "}", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: a bare marker becomes the when",
    find: "if(/^\\s*known\\s*$/i.test(_fw)){_fk=true;_fw=\"soon\";}else ", replace: "", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: every tagged event is known",
    find: "fileFutureEvent(_fw,\"\",fp[1],R.turn,_fk);", replace: "fileFutureEvent(_fw,\"\",fp[1],R.turn,true);", mustFail: ONLY + T.K2R },
  { label: "K2 ruling: the GM is not taught the marker",
    find: "[FUTURE_EVENT:what|when|known]. Leave it off", replace: "[FUTURE_EVENT:what|when]. Leave it off", mustFail: ONLY + T.K2R }
]);

process.exit(failed ? 1 : 0);
