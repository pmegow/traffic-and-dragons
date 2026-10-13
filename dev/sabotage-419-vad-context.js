// sabotage-419-vad-context.js — prove the #419 clauses are not decorative.
// #419 (audit F4): the STT analyser rides sound.js's one AudioContext; the fallback is one lazy
// context for the page; stt.js never closes either. Each mutation removes one clause; the named
// test must turn red; sabotage.js restores byte-identical source after each.
var sabotage=require("./sabotage.js"),rc=0;
var SUITE=["node",["dev/tests-419-vad-context.js"]];

rc|=sabotage.prove({file:"stt.js",command:SUITE,cases:[
  {label:"the shared context is never asked for (the page's third context comes back)",
   mustFail:"with sound.js on the page the analyser rides Sound.context()",
   find:"      if (shared) _vadCtx = shared;\n      else {",
   replace:"      if (false) _vadCtx = shared;\n      else {"},
  {label:"the fallback is minted per take instead of once per page",
   mustFail:"without sound.js (a satellite page) ONE lazy fallback context serves every take",
   find:"        if (!_vadOwnCtx) _vadOwnCtx = new AC();",
   replace:"        _vadOwnCtx = new AC();"},
  {label:"a rebuilt shared context is ignored after the first take",
   mustFail:"sound.js rebuilt its context between takes",
   find:"      if (shared) _vadCtx = shared;",
   replace:"      if (shared && !_vadCtx) _vadCtx = shared;"},
  {label:"stop no longer disconnects the mic source (one analyser chain per take accumulates on the shared graph)",
   mustFail:"with sound.js on the page the analyser rides Sound.context()",
   find:"    if (_vadSrc) { try { _vadSrc.disconnect(); } catch(e) {} _vadSrc = null; }",
   replace:"    if (_vadSrc) { _vadSrc = null; }"}
]});

process.exit(rc);
