// dev/sabotage-527-23-spell-overlap.js — proves #527 lead (23) is guarded (owner ruling 2026-10-10): a companion's spell the sheet
// also holds as an ability gives its slot to the next same-tier bench spell (the pure heal, its call from healAbilitySheets, the
// companion-only scope, the racial exemption) and the auto-pick skips a bench spell held as an ability.
//   node dev/sabotage-527-23-spell-overlap.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#527 (23)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var PURE = "#527 (23) the pure substitution", HEAL = "#527 (23) the heal applies it", PICK = "#527 (23) the auto-pick skips";
prove("helpers.js", [
  { label: "the substitute may be a spell the sheet already knows (Bless again)",
    find: "if(known[cand]||held[cand])continue;to=pool[j];break;", replace: "if(held[cand])continue;to=pool[j];break;",
    mustFail: PURE },
  { label: "the substitute may be another name held as an ability",
    find: "if(known[cand]||held[cand])continue;to=pool[j];break;", replace: "if(known[cand])continue;to=pool[j];break;",
    mustFail: PURE },
  { label: "a racial spell is swapped too",
    find: "var sp=cs.spells[i];if(!sp||sp.racial)continue;", replace: "var sp=cs.spells[i];if(!sp)continue;",
    mustFail: PURE },
  { label: "the swap changes the tier (the pool moves)",
    find: "if(to)cs.spells[i]={nm:to,lvl:sp.lvl,used:false};", replace: "if(to)cs.spells[i]={nm:to,lvl:(sp.lvl||1)+1,used:false};",
    mustFail: PURE }
]);
prove("game.js", [
  { label: "the heal no longer substitutes (the call is gone)",
    find: 'var swaps=(isCompanion&&typeof spellAbilityOverlapHeal==="function")?spellAbilityOverlapHeal(cs):[],', replace: 'var swaps=[],',
    mustFail: HEAL },
  { label: "the heal substitutes on the hero too",
    find: 'var swaps=(isCompanion&&typeof spellAbilityOverlapHeal==="function")?spellAbilityOverlapHeal(cs):[],', replace: 'var swaps=(typeof spellAbilityOverlapHeal==="function")?spellAbilityOverlapHeal(cs):[],',
    mustFail: HEAL },
  { label: "the swap is silent (no system line)",
    find: 'if(swapped.length)addMsg("system",who+": "+swapped.map(function(s){return s.from+" is an ability on the sheet — the spell slot becomes "+s.to;}).join("; ")+" (#527)");', replace: '',
    mustFail: HEAL },
  { label: "the auto-pick no longer skips a name held as an ability",
    find: "    for(h=0;h<(cs.abilities||[]).length;h++)have[capBaseName(abilityParts(cs.abilities[h]).nm)]=1;/* #527 (23)", replace: "    /* #527 (23)",
    mustFail: PICK }
]);
process.exit(code);
