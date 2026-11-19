// Lane F probe 2: location merge of a parent INTO its own child; GM-reachable via [MERGE:location|child|parent]
var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();L.makeTestWorld();
showToast=function(m){console.log("TOAST:",String(m).slice(0,160));};saveAll=function(){};
function out(l,v){console.log(l,JSON.stringify(v));}
memory.map.nodes["Town"]=newMapNode(1,null);
memory.map.nodes["Town|Inn"]=newMapNode(2,"Town");
memory.map.nodes["Town|Inn|Cellar"]=newMapNode(3,"Town|Inn");
memory.map.nodes["Town|Market"]=newMapNode(3,"Town");
worldState.world.location="Town";worldState.world.sublocation="Market";
var R={muts:[],turn:5,errors:[]};
// GM tag path
var t0=Date.now();
_identityActionTag("MERGE","[MERGE:location|Town|Inn|Town]",R);out("pipe-bearing operand refused (expected)",R.muts);
R.muts=[];
var ok=locMerge("Town|Inn","Town",R);out("locMerge child<-parent",ok);out("muts",R.muts);
var inn=memory.map.nodes["Town|Inn"];out("inn.parent raw",inn.parent);out("inn parent resolves to",locResolve(inn.parent));
out("locIsSub(Town|Inn)",locIsSub("Town|Inn"));
out("world pointer",worldState.world);
out("market parent resolves to",locResolve(memory.map.nodes["Town|Market"].parent));
// does anything that walks parents loop?
var guard=0,k="Town|Inn|Cellar",trail=[];while(k&&guard++<6){trail.push(k);var n=memory.map.nodes[locResolve(k)];k=n&&n.parent?locResolve(n.parent):null;}
out("ancestor walk from cellar (6-step cap)",trail);
out("resolvePlaceName('Market', 'Town')",resolvePlaceName("Market","Town"));
out("locReparent would refuse self-ancestor? reparent Inn under Cellar",locReparent("Town|Inn","Town|Inn|Cellar",{muts:[],turn:6}));
out("elapsed ms",Date.now()-t0);
