// sabotage-309-note-shapes.js — mutation proof for the #309 engine-behaviour audit surface: the
// shape registry contract (both directions), the shared note frames' byte-identity, the notes
// ring's discard-on-refusal, and the condition-audit latch snapshot. Usage: node dev/sabotage-309-note-shapes.js
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#309: a builder loses its NOTE_SHAPES row",
      mustFail:"every NOTE_BUILDERS entry has a NOTE_SHAPES row",
      find:'  buildMarketNote:{shape:"one-shot-ask",latch:["marketAsk"],combat:"silent",ack:["WARES","WANTED"]},\n',
      replace:'' },
    { label:"#309: a row claims an undeclared latch",
      mustFail:"every NOTE_BUILDERS entry has a NOTE_SHAPES row",
      find:'buildHpZeroNudge:{shape:"cooldown-reminder",latch:["hpZero"]',
      replace:'buildHpZeroNudge:{shape:"cooldown-reminder",latch:["hpZeroTypo"]' },
    { label:"#309: a latch nobody claims creeps back into NOTE_LATCH_FIELDS (the retconPin class)",
      mustFail:"every NOTE_LATCH_FIELDS entry is claimed by some builder",
      find:'"relBondChanges","relDowngrades","travelPricePing"',
      replace:'"relBondChanges","relDowngrades","retconPin","travelPricePing"' },
    { label:"#309: the shelf frame silently changes a shelf length",
      mustFail:"emit BYTE-IDENTICAL text to their pre-refactor bodies",
      find:'var buildStayBehindNudge=shelfPing("presencePing",2,',
      replace:'var buildStayBehindNudge=shelfPing("presencePing",3,' },
    { label:"#309: the one-shot frame consumes during combat",
      mustFail:"emit BYTE-IDENTICAL text to their pre-refactor bodies",
      find:'    if(!worldState||worldState.combat)return"";\n    var q=worldState[field];\n    if(!q)return"";\n    if(o.queue)',
      replace:'    if(!worldState)return"";\n    var q=worldState[field];\n    if(!q)return"";\n    if(o.queue)' },
    { label:"#309: the condition-audit appointment falls out of the #151 snapshot again",
      mustFail:"the condition-audit expiry appointment is a latch the #151 snapshot restores",
      find:'  if(worldState.character)_snapConds("",worldState.character.conditions);',
      replace:'  if(false)_snapConds("",worldState.character.conditions);' },
    { label:"#309: the notes ring files a build the GM never saw",
      mustFail:"noteLogDiscard drops a never-delivered build",
      find:'function noteLogDiscard(){_notesBuilt=null;}',
      replace:'function noteLogDiscard(){}' }
  ]
});
rc|=sabotage.prove({
  file:"helpers.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#309: nameContains stops refusing the possessive derivative",
      mustFail:"a possessive right after the name is a DIFFERENT thing",
      find:'    if(bOk&&aOk&&!poss)return true;',
      replace:'    if(bOk&&aOk)return true;' }
  ]
});
rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#309: the recurring-name router goes back to raw substring on the inventory",
      mustFail:"the recurring-name checker no longer treats a possessive derivative",
      find:'typeof inv[ii]==="string"&&nameContains(inv[ii],word)',
      replace:'typeof inv[ii]==="string"&&inv[ii].toLowerCase().indexOf(low)>=0' }
  ]
});
process.exit(rc?1:0);
