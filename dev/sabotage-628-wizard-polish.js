// sabotage-628-wizard-polish.js — prove the #628 clauses are not decorative.
// #628 (owner 2026-10-13): the subrace/lineage cards list their grants through one naming rule; the
// owner's grants are in the data; the name ✦ rolls anew; the plume editor writes back through one
// function. Each mutation removes one clause; the named test must turn red; sabotage.js restores
// byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var ENGINE=["node",["dev/run-tests.js","#628"]];
var CAMBION=["node",["dev/run-tests.js","Cambion ancestry rename"]];

rc|=sabotage.prove({file:"helpers.js",command:ENGINE,cases:[
  {label:"the naming rule drops the recharge (every card and sheet would read 'Misty Step' for a once-a-day grant)",
   mustFail:"#628 ONE naming rule for a racial grant",
   find:'return String(o.cap||"")+((use&&use!=="passive"&&use!=="at-will")?" ("+use+")":"");',
   replace:'return String(o.cap||"");'}
]});

rc|=sabotage.prove({file:"char-creation.js",command:ENGINE,cases:[
  {label:"confirmChar names a grant with its own inline rule again (two rules, one drift)",
   mustFail:"#628 ONE naming rule for a racial grant",
   find:'      var _nm=racialCapName(_it);/* #628: the one naming rule — the cards list grants with it too */',
   replace:'      var _nm=_it.cap+((_it.use&&_it.use!=="passive"&&_it.use!=="at-will")?" ("+_it.use+")":"");'},
  {label:"the subrace card stops listing its grants (the Cambion cards go blank again)",
   mustFail:"#628 ONE naming rule for a racial grant",
   find:"var srGrants=racialCapsLabel(sr.racial_caps);",
   replace:'var srGrants="";'},
  {label:"the name field is no longer fresh (the model improves the surname again)",
   mustFail:"#628 the name ✦ rolls a NEW name",
   find:'{id:"char-name",      label:"character name", fresh:true},',
   replace:'{id:"char-name",      label:"character name"},'},
  {label:"the current name stays in the context on a fresh roll",
   mustFail:"#628 the name ✦ rolls a NEW name",
   find:'if(!fresh&&cs.name&&omit!=="name")ctx+="Name: "+cs.name+"\\n";',
   replace:'if(!fresh&&cs.name)ctx+="Name: "+cs.name+"\\n";'},
  {label:"the plume's Save writes to the box only (cs keeps the old line — the sheet would carry the stale text)",
   mustFail:"#628 the plume",
   find:"function fieldEditorApply(f,text){var v=String(text||\"\").replace(/\\s+/g,\" \").trim(),el=document.getElementById(f.id);if(el)el.value=v;cs[f.key]=v;return v;}",
   replace:"function fieldEditorApply(f,text){var v=String(text||\"\").replace(/\\s+/g,\" \").trim(),el=document.getElementById(f.id);if(el)el.value=v;return v;}"},
  {label:"Esc saves instead of keeping the old text",
   mustFail:"#628 the plume",
   find:'if(ev.key==="Escape"){ev.preventDefault();modal.remove();}',
   replace:'if(ev.key==="Escape"){ev.preventDefault();fieldEditorApply(f,ta.value);modal.remove();}'}
]});

rc|=sabotage.prove({file:"data.js",command:CAMBION,cases:[
  {label:"the Abyssal cambion loses Intimidate",
   mustFail:"Cambion replaces the ancestry name and id",
   find:'racial_caps:["Abyssal Fury",{cap:"Intimidate",use:"1/day"}]',
   replace:'racial_caps:["Abyssal Fury"]'}
]});

rc|=sabotage.prove({file:"data.js",command:ENGINE,cases:[
  {label:"the half-blood Drow lineage loses Darkness (the 'innate magic' goes undefined again)",
   mustFail:"#628 the grants the owner asked for",
   find:'{cap:"Faerie Fire",use:"1/day"},{cap:"Darkness",use:"1/day"}]}/* #628',
   replace:'{cap:"Faerie Fire",use:"1/day"}]}/* #628'},
  {label:"Haunted points at the stub again",
   mustFail:"#628 the grants the owner asked for",
   find:'racial_caps:[{cap:"Speak with Dead",use:"1/day"}]',
   replace:'racial_caps:[{cap:"Commune with Dead",use:"1/day"}]'}
]});

process.exit(rc);
