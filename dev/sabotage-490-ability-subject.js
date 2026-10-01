// dev/sabotage-490-ability-subject.js — proves the #490 guards are guarded: a hero-form [ABILITY_GAINED:] whose description
// opens with a party member's name lands on that companion (or nowhere, when they hold it), the summary says so, every
// doubtful shape stays the hero's, and a second copy under another spelling is refused. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-490-ability-subject.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#490"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "the hero tag writes to the hero whatever it describes (the reported bug)",
    find: "abCs=abWho?findCompanionChar(abWho):null;", replace: "abCs=null;",
    mustFail: "the repro" },
  { label: "a companion's ability already held is dropped without a word",
    find: "if(abilityHeldAs(abCs,abNm))R.muts.push(abNm+\" is \"+abWho+\"'s — already on their sheet\");", replace: "if(abilityHeldAs(abCs,abNm)){}",
    mustFail: "the repro" },
  { label: "a companion who lacks the ability is not given it",
    find: "else{if(!abCs.abilities)abCs.abilities=[];abCs.abilities.push({nm:abNm,ds:abp[2].trim(),gained:R.turn});", replace: "else{",
    mustFail: "a companion who lacks" },
  { label: "the hero's duplicate check goes back to the exact name",
    find: "if(!abilityHeldAs(worldState.character,abp[1])){", replace: "if(!worldState.character.abilities.some(function(a){return a.nm===abp[1];})){",
    mustFail: "another spelling" }
]);
prove("helpers.js", [
  { label: "a description that addresses the hero is still read as the companion's",
    find: "if(!low||/(^|[^a-z])(you|your|yours|yourself)([^a-z]|$)/.test(low))return null;", replace: "if(!low)return null;",
    mustFail: "the hero keeps" },
  { label: "a description that names the hero is still read as the companion's",
    find: "([^a-z0-9]|$)\").test(low))return null;\n  for(i=0;i<(names||[]).length;i++){", replace: "([^a-z0-9]|$)\").test(low)&&false)return null;\n  for(i=0;i<(names||[]).length;i++){",
    mustFail: "the hero keeps" },
  { label: "a possessive opening counts as the subject",
    find: "if(low.indexOf(forms[j])===0&&/^\\s+[a-z]/.test(low.slice(forms[j].length)))return names[i];", replace: "if(low.indexOf(forms[j])===0)return names[i];",
    mustFail: "the hero keeps" },
  { label: "a parenthetical variant is swallowed as a duplicate",
    find: "var k=String(nm||\"\").trim().toLowerCase(),L=(c&&c.abilities)||[],i;\n  for(i=0;i<L.length;i++){if(String(abilityParts(L[i]).nm).trim().toLowerCase()===k)return true;}", replace: "var k=capBaseName(nm),L=(c&&c.abilities)||[],i;\n  for(i=0;i<L.length;i++){if(capBaseName(abilityParts(L[i]).nm)===k)return true;}",
    mustFail: "another spelling" },
  { label: "an old 'LvN' entry no longer counts as holding its ability",
    find: "  for(i=0;i<L.length;i++){if(String(abilityParts(L[i]).nm).trim().toLowerCase()===k)return true;}", replace: "  for(i=0;i<L.length;i++){if(String(L[i].nm).trim().toLowerCase()===k)return true;}",
    mustFail: "another spelling" }
]);
process.exit(code);
