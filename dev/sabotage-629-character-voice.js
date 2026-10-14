// sabotage-629-character-voice.js — prove the #629 clauses are not decorative.
// #629 (owner 2026-10-13): the character voice control is ONE module (ui-character-voice.js) with a host-chosen id
// prefix and an after-write hook; the sheet hosts it under cs- and saves, the wizard's Finishing Touches hosts it under
// ft- and holds the draft; confirmChar carries the control's own field list. Each mutation removes one clause; the
// named test must turn red; sabotage.js restores byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var SUITE=["node",["dev/tests-629-character-voice.js"]];

rc|=sabotage.prove({file:"ui-character-voice.js",command:SUITE,cases:[
  {label:"the host prefix is ignored (the wizard's ids would collide with the sheet's on one page)",
   mustFail:"#629 one control, two hosts",
   find:'function prefixOf(opts){return (opts&&typeof opts.prefix==="string"&&opts.prefix)?opts.prefix:DEFAULT_PREFIX;}',
   replace:'function prefixOf(opts){return DEFAULT_PREFIX;}'},
  {label:"a pin write never reaches the host hook (the sheet would stop saving)",
   mustFail:"#629 the wizard host writes the draft and never saves",
   find:"        changed(slot.field,v);\n",
   replace:""},
  {label:"the control saves on its own again (the wizard draft would be written to the campaign before it exists)",
   mustFail:"#629 the wizard host writes the draft and never saves",
   find:"        changed(slot.field,v);\n",
   replace:'        changed(slot.field,v);if(typeof saveAll==="function")saveAll();\n'},
  {label:"fields() forgets the speed (confirmChar would drop a chosen speed)",
   mustFail:"#629 fields(): the registry's slot fields plus direction and speed",
   find:'.concat(["voiceDirection","voiceRate"]);',
   replace:'.concat(["voiceDirection"]);'},
  {label:"the direction row ignores the host prefix (two hosts on one page would share a textarea)",
   mustFail:"#629 one control, two hosts",
   find:'  prefix=prefix||CharacterVoice.DEFAULT_PREFIX;\n',
   replace:'  prefix=CharacterVoice.DEFAULT_PREFIX;\n'}
]});

rc|=sabotage.prove({file:"char-creation.js",command:SUITE,cases:[
  {label:"the carry copies an empty pin (an Automatic slot would land as the empty string and never auto-cast)",
   mustFail:"#629 the carry",
   find:'if(v!=null&&v!=="")char[fields[i]]=v;',
   replace:'char[fields[i]]=v;'},
  {label:"confirmChar no longer carries the voices (the wizard's choices would be lost)",
   mustFail:"#629 the carry",
   find:"  wizardVoiceCarry(cs,char);/* #629",
   replace:"  /* #629"},
  {label:"the Finishing Touches page no longer renders the control",
   mustFail:"#629 the Finishing Touches page renders the control",
   find:"  buildWizardVoice();/* #629: the character's voices, the sheet's own control */\n",
   replace:""},
  {label:"the page renders the control under the sheet's ids",
   mustFail:"#629 the Finishing Touches page renders the control",
   find:'CharacterVoice.html(cs,{prefix:"ft-"})',
   replace:'CharacterVoice.html(cs)'},
  {label:"the page wires the control under the sheet's ids (nothing on the page would respond)",
   mustFail:"#629 the Finishing Touches page renders the control",
   find:'  if(h)CharacterVoice.wire(cs,{prefix:"ft-"});',
   replace:'  if(h)CharacterVoice.wire(cs);'},
  {label:"an absent control leaves the empty Voice box showing",
   mustFail:"#629 the Finishing Touches page renders the control",
   find:'box.innerHTML=h;if(wrap)wrap.style.display=h?"":"none";',
   replace:'box.innerHTML=h;'}
]});

rc|=sabotage.prove({file:"ui-sheets.js",command:SUITE,cases:[
  {label:"the sheet renders under the wizard's prefix (its historical ids, and every test driving them, break)",
   mustFail:"#629 one control, two hosts",
   find:'function csVoiceControlHtml(char){return CharacterVoice.html(char,{prefix:"cs-"});}',
   replace:'function csVoiceControlHtml(char){return CharacterVoice.html(char,{prefix:"ft-"});}'},
  {label:"the sheet host drops its save hook (a chosen voice would not persist)",
   mustFail:"#629 the wizard host writes the draft and never saves",
   find:'function csWireVoice(char){CharacterVoice.wire(char,{prefix:"cs-",onChange:function(){if(typeof saveAll==="function")saveAll();}});}',
   replace:'function csWireVoice(char){CharacterVoice.wire(char,{prefix:"cs-"});}'}
]});

rc|=sabotage.prove({file:"ui-shell.js",command:SUITE,cases:[
  {label:"a new wizard keeps the last character's Trait / Flaw / Motivation",
   mustFail:"#629 source: a new wizard clears Trait, Flaw and Motivation",
   find:'"char-backstory","char-trait","char-flaw","char-motivation","char-deity"',
   replace:'"char-backstory","char-deity"'}
]});

rc|=sabotage.prove({file:"tts.js",command:SUITE,cases:[
  {label:"a registry key changes (the sheet's historical ids, and the manual QA that clicks them, drift)",
   mustFail:"#629 the registry's keys reproduce the sheet's historical ids",
   find:'key: "voice",',
   replace:'key: "backup-voice",'}
]});

process.exit(rc);
