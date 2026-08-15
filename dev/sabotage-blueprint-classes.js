// sabotage-blueprint-classes.js — #192: prove the blueprint class-roster guards actually guard.
// Run: node dev/sabotage-blueprint-classes.js
// Each mutation must CHANGE BYTES and redden `node dev/run-tests.js` (the engine tests for the
// game.js pure half, the BLUEPRINT DESIGNER CONTRACT for the page half); the harness restores
// the files byte-identical or fails loudly.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "blueprint-designer.html",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "test seam removed (the owed satellite seam)",
      find: "window.__bpdTest={",
      replace: "window.__bpdSeamGone={" },
    { label: "class_bible.js script tag dropped — classDefs() would crash the class sections",
      find: "<script src=\"class_bible.js\"></script>",
      replace: "" },
    { label: "roster hand-rolled instead of the shared blueprintClassList",
      find: "blueprintClassList(bp)",
      replace: "handRolledClassList(bp)" },
    { label: "FIELD_ROOTS loses the cclass route — breakout/edit silently dead",
      find: "cclass:function(i,j){return bp.customClasses[i];}",
      replace: "cclassGone:function(i,j){return bp.customClasses[i];}" },
    { label: "identity.js dropped from the engine chain — api.js aborts before callGM (the v1.581–v0.37 dead-LLM-features rot)",
      find: "<script src=\"identity.js\"></script>\n",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "customClasses no longer defaulted at normalize",
      find: "if(!Array.isArray(bp.customClasses))bp.customClasses=[];",
      replace: "if(false&&!Array.isArray(bp.customClasses))bp.customClasses=[];" },
    { label: "absent availableClasses materializes — old files would exclude future base classes",
      find: "if(!Array.isArray(bp.availableClasses))delete bp.availableClasses; // null/junk shapes → absence (unrestricted) beats guessing",
      replace: "if(!Array.isArray(bp.availableClasses))bp.availableClasses=[]; // sabotage" },
    { label: "base-class name collision check removed — a custom \"Warrior\" would shadow the bible",
      find: "if(classDef(cc.name))return who+\" duplicates a base class — rename it.\";",
      replace: "" },
    { label: "availability membership check gutted — unknown class names pass",
      find: "if(!avKnown)return \"Available class \\\"\"+avn",
      replace: "if(false)return \"Available class \\\"\"+avn" }
  ]
});

process.exit(rc);
