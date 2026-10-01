// dev/sabotage-334-cache-health.js — proves the #334 health guard is guarded. The server's Gemini cache was off by mistake from
// 2026-09-10 to 09-30; every turn read zero cached tokens and the health dot said "not enough Anthropic gameplay calls to
// judge". Now the ring stamps the server route (gw), and the dot judges the cache in play through one CACHE_JUDGES row each:
// Anthropic by ratio, server-route Gemini by presence. Each mutation runs in a disposable clone.
//   node dev/sabotage-334-cache-health.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#17: drift health readout"]], T = "healthIndicators (#334)";
rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the Gemini row is gone (the dot is blind to the server's cache again)",
    find: "function cacheJudgeKey(he){return !he?null:he.prov===\"anthropic\"?\"anthropic\":(he.prov===\"gemini\"&&he.gw)?\"gemini-server\":null;}",
    replace: "function cacheJudgeKey(he){return !he?null:he.prov===\"anthropic\"?\"anthropic\":null;}",
    mustFail: T },
  { label: "own-key Gemini is judged like the server route (a red dot the player cannot fix)",
    find: "(he.prov===\"gemini\"&&he.gw)?\"gemini-server\":null;}", replace: "(he.prov===\"gemini\")?\"gemini-server\":null;}",
    mustFail: T },
  { label: "Gemini is judged by ratio (a mature campaign's 30% share would warn forever)",
    find: "\"gemini-server\":{label:\"Gemini\",byRatio:false,", replace: "\"gemini-server\":{label:\"Gemini\",byRatio:true,",
    mustFail: T },
  { label: "an older provider's turns are judged instead of the cache now in play",
    find: "var _cjKey=cacheJudgeKey(hl.length?hl[hl.length-1]:null),", replace: "var _cjKey=cacheJudgeKey(hl.length?hl[0]:null),",
    mustFail: T },
  { label: "a single uncached turn already reads as a dead cache",
    find: "push(\"cache\",\"Prompt cache\",dead>=3?\"bad\":(low>cs.length/2?\"warn\":\"ok\"),", replace: "push(\"cache\",\"Prompt cache\",dead>=1?\"bad\":(low>cs.length/2?\"warn\":\"ok\"),",
    mustFail: T },
  { label: "the Anthropic ratio warning is lost in the table",
    find: "\"anthropic\":{label:\"Anthropic\",byRatio:true,", replace: "\"anthropic\":{label:\"Anthropic\",byRatio:false,",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the ring never stamps the server route",
    find: "      if(viaServer)_he.gw=1;", replace: "",
    mustFail: T },
  { label: "every turn is stamped as a server turn",
    find: "      if(viaServer)_he.gw=1;", replace: "      _he.gw=1;",
    mustFail: T },
  { label: "callGM stops passing the transport it used",
    find: "if(_u)recordUsage(_u,_kind,model,_retries,_tp.server);}", replace: "if(_u)recordUsage(_u,_kind,model,_retries);}",
    mustFail: T }
]});
process.exit(rc ? 1 : 0);
