// sabotage-w7.js — prove the #168 W7 relationship-axis protections are load-bearing.
// Every mutation must change source bytes, turn the real regression suite red, and restore the
// file byte-identically before the next case.
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"dynamic writes clobber the durable bond again",
      find:"row.dynamic=next;row.dynamicTurn=worldState.turn;delete row.axisConflict;",
      replace:"row.bond=next;row.dynamic=next;row.dynamicTurn=worldState.turn;delete row.axisConflict;"},
    {label:"an existing bond replacement bypasses staged confirmation",
      find:"if(!prev&&axis===\"bond\"){row.bond=next;row.bondTurn=worldState.turn;",
      replace:"if(axis===\"bond\"){row.bond=next;row.bondTurn=worldState.turn;"},
    {label:"same-turn duplicate tags self-confirm a destructive bond change",
      find:"if(pending.turn>=worldState.turn)return false;",
      replace:"if(false)return false;"},
    {label:"legacy descriptor migration stops preserving the original text",
      find:"if(legacy&&!row.bond&&!row.dynamic){row.bond=legacy;",
      replace:"if(legacy&&!row.bond&&!row.dynamic){row.bond=\"\";"},
    {label:"legacy axis decisions become unbounded",
      find:"if(q.length>=REL_AXIS_CHOICE_CAP){_relationshipWarn",
      replace:"if(false){_relationshipWarn"},
    {label:"portable import conflicts leak into the active campaign",
      find:"var _hq=(opts&&opts.portable)?_relationshipPortableAxis(sheet,row.entity,legacy,\"hybrid\"):_relationshipQueueAxis",
      replace:"var _hq=false?_relationshipPortableAxis(sheet,row.entity,legacy,\"hybrid\"):_relationshipQueueAxis"},
    {label:"prospective relationship values lose their length bound",
      find:"REL_NOTE_COOLDOWN=3,REL_VALUE_MAX=240;",
      replace:"REL_NOTE_COOLDOWN=3,REL_VALUE_MAX=9999;"},
    {label:"classifying one legacy candidate erases every sibling candidate on the pair",
      find:"return (x.who||null)!==(own||null)||relationshipEntityKey(x.entity)!==ent||String(x.value||\"\").trim()!==val;",
      replace:"return (x.who||null)!==(own||null)||relationshipEntityKey(x.entity)!==ent;"},
    {label:"an unrelated dynamic discards the protected W1 bond preimage",
      find:"if(guard){var corruptBond=row.bond||\"\";",
      replace:"if(false){var corruptBond=row.bond||\"\";"},
    {label:"repeating the already-clobbered bond bypasses its protected preimage",
      find:"if(guard){var guardedCurrent=prev,protectedPrev=String(guard.prev||\"\");",
      replace:"if(false){var guardedCurrent=prev,protectedPrev=String(guard.prev||\"\");"},
    {label:"whole-pair confirmation forgets to remove the current dynamic",
      find:"if(pair){row.dynamic=\"\";row.dynamicTurn=worldState.turn;}",
      replace:"if(false){row.dynamic=\"\";row.dynamicTurn=worldState.turn;}"},
    {label:"identity merge leaves queued relationship owners under the duplicate alias",
      find:"if(item.who&&merged(item.who))item.who=can;",
      replace:"if(false)item.who=can;"},
    {label:"identity merge rewrites every pending key to the merged canonical pair",
      find:"if(item.key)item.key=relationshipEdgeKey(item.who,item.entity);",
      replace:"if(item.key)item.key=relationshipEdgeKey(null,can);"},
    {label:"active player epithets stop canonicalizing to one relationship entity",
      find:"if(typeof memoryNpcIsPlayer===\"function\"&&memoryNpcIsPlayer(raw)&&worldState&&worldState.character)",
      replace:"if(false&&typeof memoryNpcIsPlayer===\"function\"&&memoryNpcIsPlayer(raw)&&worldState&&worldState.character)"},
    {label:"portable relationship proposals become unbounded",
      find:"if(q.length<REL_AXIS_CHOICE_CAP){q.push({entity:entity,value:val,kind:kind});return true;}",
      replace:"if(true){q.push({entity:entity,value:val,kind:kind});return true;}"},
    {label:"a full decision queue destroys the cap+1 legacy source descriptor",
      find:"if(!_hq)keepLegacy=true;row.axisConflict=true;",
      replace:"if(false)keepLegacy=true;row.axisConflict=true;"}
  ]
});

rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"current dynamic can mint a permanent defining bond memory",
      find:"WEIGHTY_REL_RE.test(r.bond)&&pre.rels[r.entity]!==r.bond",
      replace:"WEIGHTY_REL_RE.test(r.dynamic)&&pre.rels[r.entity]!==r.dynamic"},
    {label:"confirmed explicit bond changes re-arm the legacy downgrade guard",
      find:"_explicit=!!(_rr&&_rr.turn===worldState.turn&&_rr.prev===prev&&_rr.next===(r.bond||\"\"));",
      replace:"_explicit=false&&!!(_rr&&_rr.turn===worldState.turn&&_rr.prev===prev&&_rr.next===(r.bond||\"\"));"}
  ]
});

rc|=sabotage.prove({
  file:"state.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"campaign load migrates relationships through the previously active alias table",
      find:"  try{if(mm){memory=JSON.parse(mm);healMemory();}else memory=blankMemory();}catch(e){memory=blankMemory();}\n",
      replace:""}
  ]
});

rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"NPC alias registration strands staged relationship decisions on the old name",
      find:"relationshipRekeyEntity(alCanon,alAlias);R.muts.push(\"Alias: \"+alAlias+\" -> \"+alCanon);",
      replace:"R.muts.push(\"Alias: \"+alAlias+\" -> \"+alCanon);"},
    {label:"NPC merge discards outgoing relationships when both records already have sheets",
      find:"if(_mgDupN.charSheet&&_mgCanN.charSheet)relationshipMergeSheets(_mgCanN.charSheet,_mgDupN.charSheet,mgCanon,mgDupe);else if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;",
      replace:"if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;"}
  ]
});

rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"NPC graph authority uses current dynamic instead of durable bond",
      find:"if(rels[ri].bond)addAdj(player,rels[ri].entity,rels[ri].bond,rels[ri].bondTurn||0);",
      replace:"if(rels[ri].dynamic)addAdj(player,rels[ri].entity,rels[ri].dynamic,rels[ri].dynamicTurn||0);"}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"party roster authority uses current dynamic instead of durable bond",
      find:"if(_rbl[_rbi]&&_rbl[_rbi].entity&&_rbl[_rbi].bond)relByEntity[_rbl[_rbi].entity.toLowerCase()]=_rbl[_rbi].bond;",
      replace:"if(_rbl[_rbi]&&_rbl[_rbi].entity&&_rbl[_rbi].dynamic)relByEntity[_rbl[_rbi].entity.toLowerCase()]=_rbl[_rbi].dynamic;"},
    {label:"failed provider calls consume migrated axis-review nudges",
      find:"\"relAxisChoices\",\"relAxisReviewFired\",\"relBondChanges\"",
      replace:"\"relAxisChoices\",\"relBondChanges\""},
    {label:"the delivery budget deletes the only protected W1 bond preimage",
      find:"if(d.fired>=REL_DOWNGRADE_MAX)d.muted=true;",
      replace:"if(d.fired>=REL_DOWNGRADE_MAX)delete worldState.relDowngrades;"}
  ]
});

process.exit(rc?1:0);
