// sabotage-298-itemdef-grammar.js — mutation proof: the [ITEM_DEF:] handler reads BOTH the key=value
// and the positional grammar (playtest v1767: the note taught positional, the parser read only
// key=value, three EMPTY definitions were accepted as canon). Usage: node dev/sabotage-298-itemdef-grammar.js
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#298: positional parts skipped silently again",
      mustFail:"a POSITIONAL [ITEM_DEF:]",
      find:"    if(idkv.length<2){if(idPosN>=idPos.length)",
      replace:"    if(idkv.length<2){continue;if(idPosN>=idPos.length)" },
    { label:"#298: positional order scrambled (effect lands in category)",
      mustFail:"a POSITIONAL [ITEM_DEF:]",
      find:'  var idPos=["category","effect","uses","value"],idPosN=0;',
      replace:'  var idPos=["effect","category","uses","value"],idPosN=0;' }
  ]
});
rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#298: the engine note teaches the positional form again while the doc line says key=value",
      mustFail:"a POSITIONAL [ITEM_DEF:]",
      find:'|category=…|effect=…|uses=…|value=…]',
      replace:'|category|effect|uses|value]' }
  ]
});
process.exit(rc?1:0);
