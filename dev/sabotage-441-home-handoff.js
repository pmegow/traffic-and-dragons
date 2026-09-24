// sabotage-441-home-handoff.js — mutation proof for #441: the saved-world boot offers the Home handoff, Start resets
// through the picker's New before the wizard consumes a blueprint, a stale payload is never offered.
// Usage: node dev/sabotage-441-home-handoff.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/tests-441-home-handoff.js"]];
rc|=sabotage.prove({
  file:"ui-browsers.js",
  command:CMD,
  cases:[
    { label:"#441: Start with a blueprint skips the picker's reset (the current campaign is never snapshotted)",
      mustFail:"Start with a blueprint: the picker's New reset runs FIRST",
      find:'  if(typeof campNew==="function")campNew();/* the picker\'s New: snapshot the current campaign, fresh id, the wizard */\n',
      replace:'' },
    { label:"#441: a stale payload is offered again",
      mustFail:"a stale (>1h) or malformed payload is not offered",
      find:'    if(rec.at&&Date.now()-rec.at>3600*1000)continue;',
      replace:'    if(false)continue;' },
    { label:"#441: Continue leaves the payload behind (it replays on the next boot)",
      mustFail:"Continue clears both keys",
      find:'  if(choice!=="start"){homeHandoffClear();',
      replace:'  if(choice!=="start"){' }
  ]
});
rc|=sabotage.prove({
  file:"ui-boot.js",
  command:CMD,
  cases:[
    { label:"#441: the saved-world boot no longer offers the handoff",
      mustFail:"boot wiring: the saved-world branch of initState offers the handoff",
      find:'    if(typeof offerHomeHandoff==="function")offerHomeHandoff();',
      replace:'' }
  ]
});
process.exit(rc?1:0);
