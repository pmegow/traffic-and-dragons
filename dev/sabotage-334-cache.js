var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({file:"globals.js",command:["node",["dev/run-tests.js","#334 — Gemini cache transport metadata"]],cases:[
  {label:"UTF-16 split shifted",find:'"v1:"+sys.stable.length',replace:'"v1:"+(sys.stable.length+1)',mustFail:"#334 Gemini advertises the exact Unicode stable prefix"},
  {label:"suggestion calls request cache",find:'return kind==="turn"&&sys&&typeof sys==="object"',replace:'return sys&&typeof sys==="object"',mustFail:"#334 overrides and non-turn calls cannot request stable caching"}
]});
rc|=sabotage.prove({file:"api.js",also:["dev/tests-29-callgm-transport.js"],command:["node",["dev/tests-29-callgm-transport.js"]],cases:[
  {label:"primary call omits split",find:'gmTransport(prov,model,key,_kind,sys);var url',replace:'gmTransport(prov,model,key,_kind);var url',mustFail:"#334 primary and fallback carry the stable split"},
  {label:"fallback call omits split",find:'gmTransport(prov,model,key,_kind,sys);url=',replace:'gmTransport(prov,model,key,_kind);url=',mustFail:"#334 primary and fallback carry the stable split"},
  {label:"ambiguous gateway loss retried at client",find:'if(_tp.server&&_td&&_td.retryable===false)',replace:'if(false)',mustFail:"#334 ambiguous gateway generation failure forbids client retries"},
  {label:"header sent to undeployed legacy server",find:'&&serverAccount&&serverAccount.transportCapabilities&&serverAccount.transportCapabilities[prov.gatewayCapability]===1',replace:'',mustFail:"#334 older gateways get no unsupported CORS header"}
]});
process.exit(rc?1:0);
