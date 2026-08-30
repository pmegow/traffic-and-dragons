// sabotage-284-levelup-owed.js — mutation proof for the #284 durable level-up queues (Sol brief
// 36). The guard: owed archetype/stat/spell choices are SAVE STATE (worldState.levelUpOwed, keyed
// by character) — a reload or device handoff can no longer strand earned picks after the level
// itself committed; a PC swap cannot offer one character's picks to another; the deterministic
// archetype reconstruction (levelUpArchetypeDue) self-heals stranded and legacy saves; and
// resurfaceLevelUpOwed re-opens milestones in the creation-flow order (archetype → bumps → picks).
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-284-levelup-owed.js
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#284: the bump queue goes page-lifetime again — a reload strands the earned stat pick",
      mustFail:"#284 (brief 36): owed level-up choices are SAVE STATE",
      find:"  _luOwed().bumps+=bumpsOwed;/* #284: durable */",
      replace:"  var _pageBumpsOwed=bumpsOwed;/* page-lifetime again */" },

    { label:"#284: the character keying dies — every character shares ONE owed record and a PC swap inherits the picks",
      mustFail:"#284: owed records are keyed by CHARACTER",
      find:"  var nm=(worldState.character&&worldState.character.name)||\"?\";",
      replace:"  var nm=\"?\";" },

    { label:"#284: the archetype-less-class guard dies — a custom class with no archetypes soft-locks on an empty forced modal (#192)",
      mustFail:"#284: levelUpArchetypeDue",
      find:"  return !!(c&&c.level>=3&&!c.archetype&&((classDef(c.cls)||{}).archetypes||[]).length);",
      replace:"  return !!(c&&c.level>=3&&!c.archetype);" },

    { label:"#284: the resurface order flips — a stranded archetype is asked AFTER the bumps it should precede (creation-flow order)",
      mustFail:"#284: resurfaceLevelUpOwed re-opens the owed milestone in creation-flow order",
      find:"  if(levelUpArchetypeDue()){if(!document.getElementById(\"arch-modal\"))showArchetypeModal();return true;}\n  var lo=_luOwed();\n  if(lo.bumps>0){if(!document.getElementById(\"sb-modal\"))showStatBumpModal();return true;}",
      replace:"  var lo=_luOwed();\n  if(lo.bumps>0){if(!document.getElementById(\"sb-modal\"))showStatBumpModal();return true;}\n  if(levelUpArchetypeDue()){if(!document.getElementById(\"arch-modal\"))showArchetypeModal();return true;}" }
  ]
});

process.exit(rc?1:0);
