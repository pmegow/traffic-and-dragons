// sabotage-436-item-def-fields.js — mutation proof for #436: the definition tags' ONE field reader
// (a known key with a colon is KEYED, bare parts fill only unclaimed slots), the clobber heal at
// every boundary (proposal, load, sheet adoption), and its never-overwrite guard. The Necrotic
// Dungeon t11: "uses:at-will|value:800 gp" were read by position and the price overwrote the
// drain effect the GM wrote for the daggers. Usage: node dev/sabotage-436-item-def-fields.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#81 item bible"]];
rc|=sabotage.prove({
  file:"helpers.js",
  command:CMD,
  also:["tag_table.js","state.js"],
  cases:[
    { label:"#436: a known key with a colon is bare again (the t11 clobber returns)",
      mustFail:"#436: the verbatim t11 daggers tag",
      find:'    if(m[2]==="="||(known&&known[k]))return{key:k,val:m[3].replace(/\\s+$/,""),keyed:true,known:!!(known&&known[k])};}',
      replace:'    if(m[2]==="=")return{key:k,val:m[3].replace(/\\s+$/,""),keyed:true,known:!!(known&&known[k])};}' },
    { label:"#436: the heal predicate never matches — clobbered canon stays sealed and injecting",
      mustFail:"#436: the heal — an accepted overlay",
      find:'  var m=e.effect.match(/^\\s*(value|uses)\\s*:\\s*([\\s\\S]*?)\\s*$/i);',
      replace:'  var m=null;' },
    { label:"#436: the heal overwrites a filled target field",
      mustFail:"#436: the heal — an accepted overlay",
      find:'  if(e[k]&&e[k]!=="N/A"&&e[k]!==v)return null;\n',
      replace:'' },
    { label:"#436: a sheet's travelling canon arrives unhealed",
      mustFail:"#436: the heal runs at load",
      find:'  if(n&&typeof itemBibleHeal==="function")itemBibleHeal(adopted);',
      replace:'' }
  ]
});
rc|=sabotage.prove({
  file:"tag_table.js",
  command:CMD,
  also:["helpers.js","state.js"],
  cases:[
    { label:"#436: bare parts fill claimed slots too (a keyed field is overwritten by position)",
      mustFail:"#436: bare parts fill only the slots no keyed part claimed",
      find:'  for(idb=0;idb<idBare.length;idb++){while(idSlot<idPos.length&&idSet[idPos[idSlot]])idSlot++;',
      replace:'  for(idb=0;idb<idBare.length;idb++){' },
    { label:"#436: the proposal boundary skips the heal",
      mustFail:"#436: the verbatim t11 daggers tag",
      find:'  var idHeal=(typeof itemDefHeal==="function")?itemDefHeal(idEntry):"";',
      replace:'  var idHeal="";' },
    { label:"#436: SPELL_DEF stops recognising colon keys",
      mustFail:"#436: [SPELL_DEF:] reads the same colon-keyed form",
      find:'var sdf=defFieldRead(sdParts[sdp],SD_KEYS);',
      replace:'var sdf=defFieldRead(sdParts[sdp],null);' }
  ]
});
rc|=sabotage.prove({
  file:"state.js",
  command:CMD,
  also:["helpers.js","tag_table.js"],
  cases:[
    { label:"#436: the overlay is not healed at load",
      mustFail:"#436: the heal runs at load",
      find:'    if(worldState.itemBible&&itemBibleHeal(worldState.itemBible).length)_mig=true;\n',
      replace:'' },
    { label:"#436: the pending queue is not healed at load",
      mustFail:"#436: the heal runs at load",
      find:'      if(itemBibleHeal(_ihP).length)_mig=true;}',
      replace:'      }' }
  ]
});
process.exit(rc?1:0);
