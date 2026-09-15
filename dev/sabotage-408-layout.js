// sabotage-408-layout.js — mutation proof for the #408 room graph (slice 1: tag + ask + block + placement).
//
// The guards (six owner rulings 2026-09-14): a LAYOUT record is a room graph whose every connection names
// a listed room or 'outside' (a dangling door refuses loudly); GM filings are write-once (the design form
// is the authority); a placement pins a stash row to a room WITHOUT touching the row's name ("Cleaver"
// stays "Cleaver"); a room not on the record is refused loudly and the placement still lands; the ask
// fires once at a village house and never unasked elsewhere; LAYOUT strips from prose and stays out of
// the standing doc. Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-408-layout.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js", "#408 home"]],
  cases: [
    { label: "a dangling connection no longer refuses — a door to a room that does not exist becomes canon",
      mustFail: "dangling",
      find: 'if(t!=="outside"&&!names[t])return {ok:false,reason:',
      replace: 'if(false)return {ok:false,reason:' },
    { label: "write-once is gone — a second GM filing silently replaces the player's record",
      mustFail: "write-once",
      find: 'if(node.layout&&(by||"gm")==="gm")return {ok:false,reason:"a layout is already on record here (write-once — the design form edits it)",key:key};',
      replace: '' },
    { label: "IDENTITY: a placement writes the room text INTO the name — 'Cleaver' becomes 'main room, on the mantle' (the owner's exact fear)",
      mustFail: "IDENTITY",
      find: 'if(row.taken||row.qty===0){row.taken=false;row.qty=1;}else row.qty=(row.qty||1)+1;row.placed=turn;row.by=hero;row.min=now;if(roomTxt)row.room=roomTxt;',
      replace: 'if(row.taken||row.qty===0){row.taken=false;row.qty=1;}else row.qty=(row.qty||1)+1;row.placed=turn;row.by=hero;row.min=now;if(roomTxt){row.room=roomTxt;row.name=roomTxt;}' },
    { label: "IDENTITY on the first placement: the new row is named after its room",
      mustFail: "IDENTITY",
      find: 'else{var nr={name:name,placed:turn,taken:false,qty:1,by:hero,min:now};if(roomTxt)nr.room=roomTxt;items.push(nr);',
      replace: 'else{var nr={name:roomTxt||name,placed:turn,taken:false,qty:1,by:hero,min:now};if(roomTxt)nr.room=roomTxt;items.push(nr);' },
    { label: "a room not on the record is recorded anyway (silent misfile instead of a loud refusal)",
      mustFail: "not on the record",
      find: 'roomWhy="\'"+rn+"\' is not a room on the record ("+node.layout.rooms.map(function(r){return r.name;}).join(", ")+")";roomTxt=null;',
      replace: 'roomWhy=null;' }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "#408 home"]],
  cases: [
    { label: "the ask fires at a commons with no record (every tavern gets a floor plan nobody wanted)",
      mustFail: "commons",
      find: 'if(!armed&&!house)return"";',
      replace: '' },
    { label: "the ask fires twice at the same house (the latch is ignored)",
      mustFail: "twice",
      find: 'var la=worldState.layoutAsk;if(la&&la.node===key&&!armed)return"";',
      replace: '' },
    { label: "the LAYOUT block is served without the do-not-invent clause",
      mustFail: "inventing",
      find: 'do not invent a room or a door not listed;',
      replace: '' }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js", "#408 home"]],
  cases: [
    { label: "LAYOUT leaves the engine-only tier — the standing doc (and the stable prompt half) carries it for every campaign",
      mustFail: "engine-only",
      find: '"COMPANION_ITEM_RENAMED","WHISPER","LAYOUT"]',
      replace: '"COMPANION_ITEM_RENAMED","WHISPER"]' },
    { label: "a refused LAYOUT is dropped silently (no mutation-log line, no console line)",
      mustFail: "loud",
      find: 'if(!lr.ok){R.muts.push("⚠ [LAYOUT:] refused — "+lr.reason);if(typeof console!=="undefined")console.warn("[tags] LAYOUT refused at "+(lr.key||"the current node")+": "+lr.reason+" — nothing filed (#408)");continue;}',
      replace: 'if(!lr.ok){continue;}' }
  ]
});

process.exit(rc);
