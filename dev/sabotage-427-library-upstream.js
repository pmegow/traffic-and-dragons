// dev/sabotage-427-library-upstream.js — proves the #427 guards are guarded: no automatic write-back anywhere (a write
// smuggled back into the campaign switch or the swap shell is caught), the Hall line lives in village state and reads
// from it, the played hero refreshes from a newer library copy and is stamped, the stamps travel with a swap and are
// set at move-in, and the refresh shell re-inits the hero's panels. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-427-library-upstream.js
var sabotage = require("./sabotage.js"), code = 0;
function proveV(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
function proveU(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#427 library upstream"]], cases: cases }); }
proveV("state.js", [
  { label: "a library write is smuggled back into the campaign switch",
    find: '  var name=campDisplayName(id);\n  /* #427 (owner ruling 2026-09-21): leaving a village writes NOTHING to the library.',
    replace: '  var name=campDisplayName(id);\n  if(typeof campaignKind==="function"&&campaignKind()==="village"&&typeof storageAdapter!=="undefined"&&storageAdapter&&worldState&&worldState.character)storageAdapter.saveCharacterToLibrary(worldState.character,function(){});\n  /* #427 (owner ruling 2026-09-21): leaving a village writes NOTHING to the library.',
    mustFail: "#6A the library is UPSTREAM" }
]);
proveV("game.js", [
  { label: "the Hall line goes back onto the sheet",
    find: 'if(!worldState.hallLines)worldState.hallLines={};worldState.hallLines[name]=t;', replace: 'if(!worldState.hallLines)worldState.hallLines={};worldState.hallLines[name]=t;n.charSheet.hallLine=t;',
    mustFail: "#6G5 one player-authored line" },
  { label: "the Hall-line reader ignores village state",
    find: 'var v=(ws.hallLines&&ws.hallLines[name])||"";if(v)return String(v);', replace: '',
    mustFail: "#6G5 one player-authored line" },
  { label: "the memento reads the sheet instead of village state",
    find: 'line:villageHallLineOf(n.name)||(prior[n.name]&&prior[n.name].line)||null', replace: 'line:s.hallLine||(prior[n.name]&&prior[n.name].line)||null',
    mustFail: "#6G5 one player-authored line" },
  { label: "the hero is skipped again on refresh",
    find: 'if(at===null||(typeof worldState.heroLibraryAt==="number"&&at<=worldState.heroLibraryAt)){out.kept.push(nm);continue;}', replace: 'if(true){out.kept.push(nm);continue;}',
    mustFail: "#6E13 REFRESH ON ENTRY" }
]);
proveU("game.js", [
  { label: "the refreshed hero is not re-stamped (the adopter forgets the stamp — #428 moved it there)",
    find: 'worldState.character=hero;worldState.heroLibraryAt=(typeof at==="number")?at:null;', replace: 'worldState.character=hero;',
    mustFail: "the played hero refreshes" },
  { label: "an equal copy refreshes (the stamp comparison is off by one)",
    find: '(typeof worldState.heroLibraryAt==="number"&&at<=worldState.heroLibraryAt)', replace: '(typeof worldState.heroLibraryAt==="number"&&at<worldState.heroLibraryAt)',
    mustFail: "the played hero refreshes" },
  { label: "the hero is handed the library object itself",
    find: 'var hero=JSON.parse(JSON.stringify(c));if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(hero,null);', replace: 'var hero=c;if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(hero,null);',
    mustFail: "the played hero refreshes" },
  { label: "move-in stops stamping the hero",
    find: 'if(typeof _libAt==="number")worldState.heroLibraryAt=_libAt;', replace: '',
    mustFail: "the stamps travel" },
  { label: "a swap drops the demoted hero's stamp",
    find: 'libraryAt:(typeof worldState.heroLibraryAt==="number")?worldState.heroLibraryAt:null}', replace: 'libraryAt:null}',
    mustFail: "the stamps travel" },
  { label: "a swap keeps the old hero's stamp on the new hero",
    find: 'worldState.heroLibraryAt=(typeof npc.libraryAt==="number")?npc.libraryAt:null;', replace: '',
    mustFail: "the stamps travel" }
]);
proveU("ui-browsers.js", [
  { label: "the refresh shell never re-inits a refreshed hero's panels",
    find: 'if(r.hero){if(typeof initAbilities==="function")initAbilities();if(typeof initSpells==="function")initSpells();', replace: 'if(false){if(typeof initAbilities==="function")initAbilities();if(typeof initSpells==="function")initSpells();',
    mustFail: "the wiring" }
]);
proveU("ui-modals.js", [
  { label: "the Hall-line modal reads the sheet",
    find: 'var cur=(typeof villageHallLineOf==="function")?villageHallLineOf(name):"";', replace: 'var n=(typeof wsNpcByName==="function")?wsNpcByName(name):null,cur=(n&&n.charSheet&&n.charSheet.hallLine)||"";',
    mustFail: "the wiring" }
]);
proveU("ui-sheets.js", [
  { label: "a library write is smuggled back into the swap shell",
    find: '  /* #427 (owner ruling 2026-09-21): a demoted hero is NOT written back to the library', replace: '  if(r.demotedTo==="resident"&&typeof storageAdapter!=="undefined"&&storageAdapter){var _old=wsNpcByName(r.from);if(_old&&_old.charSheet)storageAdapter.saveCharacterToLibrary(_old.charSheet,function(){});}\n  /* #427 (owner ruling 2026-09-21): a demoted hero is NOT written back to the library',
    mustFail: "the wiring" }
]);
process.exit(code);
