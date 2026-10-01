// dev/sabotage-487-companion-archetype.js — proves the #487 guards are guarded: a companion gets an archetype the engine
// picks from the sheet's own words, every sheet gets the archetype rows it missed exactly once, old "LvN" names are
// restored, a bible ability held twice is held once, and a level-up never doubles a held name. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-487-companion-archetype.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#487"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the engine never picks a companion's archetype (the reported bug)",
    find: "if(opts&&opts.pickArchetype&&!c.archetype&&(c.level||1)>=3&&d&&(d.archetypes||[]).length){", replace: "if(false){",
    mustFail: "the repro" },
  { label: "the missed rows are never granted",
    find: "if(abilityHas(c,rows[j].nm))continue;c.abilities.push({nm:rows[j].nm,ds:rows[j].ds,gained:turn});rep.granted.push(rows[j].nm);", replace: "",
    mustFail: "granted once" },
  { label: "the catch-up grants a row the sheet already holds",
    find: "if(abilityHas(c,rows[j].nm))continue;c.abilities.push({nm:rows[j].nm,ds:rows[j].ds,gained:turn});", replace: "c.abilities.push({nm:rows[j].nm,ds:rows[j].ds,gained:turn});",
    mustFail: "granted once" },
  { label: "old 'LvN' names are left as they are",
    find: "    if(!p.old)continue;\n    var row=abilityBibleRow(c,p.nm);", replace: "    continue;\n    var row=abilityBibleRow(c,p.nm);",
    mustFail: "old-format names" },
  { label: "the dedupe merges abilities the bible does not know",
    find: "var k=capBaseName(c.abilities[i].nm),r2=abilityBibleRow(c,c.abilities[i].nm);", replace: "var k=capBaseName(c.abilities[i].nm),r2=abilityBibleRow(c,c.abilities[i].nm)||{nm:c.abilities[i].nm,ds:c.abilities[i].ds};",
    mustFail: "old-format names" },
  { label: "a spell-casting Rogue is no longer read as the casting archetype",
    find: "    if(!casterClass&&ownSpells&&a.spellTiers)score+=20;\n", replace: "",
    mustFail: "the pick reads" },
  { label: "abilities the class bible granted count as evidence (the answer drifts with level)",
    find: "if(p.old||abilityBibleRow(c,p.nm))continue;bodyTxt.push(p.nm,p.ds);", replace: "bodyTxt.push(p.nm,p.ds);",
    mustFail: "the pick reads" },
  { label: "an exact archetype name no longer decides",
    find: "if(nm&&(nm===String(archs[i].nm).toLowerCase()||nm===String(archs[i].id).toLowerCase()))return archs[i].id;", replace: "",
    mustFail: "the pick reads" }
]);
prove("game.js", [
  { label: "the heal is not wired into the boot and pre-turn seam",
    find: "  healAbilitySheets();/* #487: the sheets are whole before any level lands on them */\n", replace: "",
    mustFail: "the repro" },
  { label: "a level-up pushes a second copy of a held name",
    find: "if(abilityGrant(cs,_cFeats[_cf],worldState?worldState.turn:0))_cFeatNames.push(_cFeats[_cf].nm);", replace: "cs.abilities.push({nm:_cFeats[_cf].nm,ds:_cFeats[_cf].ds,gained:0});_cFeatNames.push(_cFeats[_cf].nm);",
    mustFail: "never adds a second copy" },
  { label: "a picked casting archetype brings no spells",
    find: "      learned=learned.concat(companionAutoPickSpells(cs,unl));", replace: "",
    mustFail: "casting archetype" },
  { label: "the heal picks an archetype without saying so",
    find: "if(rep.archetype)addMsg(\"system\",who+\" — archetype: \"+rep.archetype.nm+\".\");", replace: "",
    mustFail: "says what it did" }
]);
process.exit(code);
