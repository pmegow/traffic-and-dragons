var sabotage=require('./sabotage.js'),code=0;
function prove(file,cases){if(!code)code=sabotage.prove({file:file,command:["node",["dev/run-tests.js","#527(17)"]],cases:cases});}
prove('memory.js',[
  {
    "label": "remove529 arrival alias so fresh case variant loses description",
    "find": "locResolve(_composed)!==key)locAliasRegister(key,_composed,null);",
    "replace": "locResolve(_composed)!==key)void 0;",
    "mustFail": "#527(17) fresh smithy"
  },
  {
    "label": "fileSubLocation bypasses resolver and mints a twin",
    "find": "  var _rp=(typeof resolvePlaceName===\"function\")?resolvePlaceName(name,parent):null;\n",
    "replace": "  var _rp=null;\n",
    "mustFail": "#527(17) fresh smithy"
  }
]);
prove('identity.js',[
  {
    "label": "same leaf resolver ignores parent boundary",
    "find": "!n||seen[k]||!n.parent||!locSame(n.parent,parent)",
    "replace": "!n||seen[k]||!n.parent",
    "mustFail": "#527(17) same smithy leaf"
  }
]);
process.exit(code?1:0);
