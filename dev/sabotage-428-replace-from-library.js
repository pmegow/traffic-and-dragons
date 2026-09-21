// dev/sabotage-428-replace-from-library.js — proves the #428 guards are guarded: the adopters copy (never the library
// object), keep the local name, ensure the v10 arrays, stamp; the summary's changed flag is honest; the apply routes a
// companion to the companion adopter and refuses an unknown name with a reason; the village refresh rides the same
// adopters; both sheet hosts render the button and open the confirm; the confirm applies through libReplaceApply,
// toasts a refusal, and re-inits the hero's panels. Each mutation runs in a disposable clone (sabotage.js
// proveScratch); nothing here touches the working tree.
//   node dev/sabotage-428-replace-from-library.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#428 replace"]], cases: cases }); }
prove("game.js", [
  { label: "startGame keeps its own copy of the v10 list instead of the one helper",
    find: 'ensureV10Arrays(char);/* #428: ONE helper', replace: 'if(!char.skills)char.skills=initSkills();if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];if(!char.saveModifiers)char.saveModifiers=[];if(!char.languages)char.languages=[];if(char.portrait===undefined)char.portrait=null;if(!char.backstory)char.backstory="";if(!char.storyBeats)char.storyBeats=[];/* #428: ONE helper',
    mustFail: "ensureV10Arrays" },
  { label: "ensureV10Arrays overwrites a present field",
    find: 'if(!s.conditions)s.conditions=[];', replace: 's.conditions=[];',
    mustFail: "ensureV10Arrays" },
  { label: "the hero adopter hands over the library object itself",
    find: 'var hero=JSON.parse(JSON.stringify(c));if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(hero,null);\n  hero.name=worldState.character.name;', replace: 'var hero=c;if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(hero,null);\n  hero.name=worldState.character.name;',
    mustFail: "libReplaceApply on the hero" },
  { label: "the hero adopter takes the library's spelling of the name",
    find: '  hero.name=worldState.character.name;\n', replace: '',
    mustFail: "libReplaceApply on the hero" },
  { label: "the hero adopter drops the framing when the copy has none",
    find: 'hero.portraitOffset=hero.portraitOffset||worldState.character.portraitOffset||{x:0.5,y:0.5,zoom:1};', replace: 'hero.portraitOffset=hero.portraitOffset||{x:0.5,y:0.5,zoom:1};',
    mustFail: "libReplaceApply on the hero" },
  { label: "the companion adopter forgets the stamp",
    find: 'n.charSheet=sheet;n.libraryAt=(typeof at==="number")?at:null;n.pronouns=pronounsForGender(sheet.gender);', replace: 'n.charSheet=sheet;n.pronouns=pronounsForGender(sheet.gender);',
    mustFail: "libReplaceApply on a companion" },
  { label: "the companion adopter never mirrors the framing onto the wrapper",
    find: 'if(sheet.portraitOffset)n.portraitOffset=JSON.parse(JSON.stringify(sheet.portraitOffset));', replace: '',
    mustFail: "libReplaceApply on a companion" },
  { label: "the summary never flags a change",
    find: 'changed:String(a)!==String(b)}', replace: 'changed:false}',
    mustFail: "libReplaceSummary" },
  { label: "an unknown name is applied to the hero",
    find: 'if(!n||!n.charSheet)return {ok:false,reason:name+" has no character sheet in this campaign"};', replace: 'if(!n||!n.charSheet){adoptLibraryHero(lib,at);return {ok:true,host:"hero"};}',
    mustFail: "libReplaceApply on a companion" },
  { label: "the village refresh copies on its own again instead of the shared adopter",
    find: 'adoptLibraryCompanion(n,c,at);out.refreshed.push(nm);}', replace: 'var sheet=JSON.parse(JSON.stringify(c));n.charSheet=sheet;n.libraryAt=at;n.pronouns=pronounsForGender(sheet.gender);out.refreshed.push(nm);}',
    mustFail: "one adopter per host" }
]);
prove("ui-sheets.js", [
  { label: "the hero sheet loses the Replace button",
    find: "<button id='cs-librep-btn' title=", replace: "<button id='cs-librep-btn-gone' title=",
    mustFail: "the wiring" },
  { label: "the hero's Replace button opens the identity-only Update instead",
    find: 'getElementById("cs-librep-btn").addEventListener("click",function(){showLibraryReplaceModal(', replace: 'getElementById("cs-librep-btn").addEventListener("click",function(){showLibraryUpdateModal(',
    mustFail: "the wiring" },
  { label: "the companion sheet loses the Replace button",
    find: "<button id='npc-librep-btn' title=", replace: "<button id='npc-librep-btn-gone' title=",
    mustFail: "the wiring" }
]);
prove("ui-browsers.js", [
  { label: "the confirm is skipped — clicking the button replaces at once",
    find: "document.getElementById(\"lr-apply\").addEventListener(\"click\",function(){", replace: "(function(){",
    mustFail: "the wiring" },
  { label: "a refused apply is silent",
    find: 'if(!r.ok){showToast("&#9888; "+char.name+" was NOT replaced — "+r.reason,6000);return;}', replace: 'if(!r.ok){return;}',
    mustFail: "the wiring" },
  { label: "the stamp is invented instead of read from the library entry",
    find: 'var r=libReplaceApply(char.name,lib,(typeof entry.updatedAt==="number")?entry.updatedAt:null);', replace: 'var r=libReplaceApply(char.name,lib,Date.now());',
    mustFail: "the wiring" },
  { label: "a replaced hero keeps stale ability and spell panels",
    find: 'if(r.host==="hero"){if(typeof initAbilities==="function")initAbilities();if(typeof initSpells==="function")initSpells();}', replace: '',
    mustFail: "the wiring" }
]);
process.exit(code);
