var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();try{L.makeTestWorld();}catch(e){}
var g=global;
function rep(s,n){return new Array(Math.floor(n)+1).join(s);}
function time(label,fn){var t=Date.now();var r;try{r=fn();}catch(e){r="THREW "+e.message;}console.log("== "+label+": "+(Date.now()-t)+" ms"+(r!==undefined?" -> "+String(JSON.stringify(r)).slice(0,100):""));}
[4000,16000,64000].forEach(function(n){
  time("detectStayBehind "+n,function(){return g.detectStayBehind(rep("Morwen waits ",n/13),["Morwen Zethran","Daeris Vel"]);});
  time("detectStayBehind no-punct long "+n,function(){return g.detectStayBehind(rep("Morwen and Daeris walk the long road ",n/37),["Morwen Zethran","Daeris Vel"]);});
  time("snippetAtSentence "+n,function(){return g.snippetAtSentence(rep("a. ",n/3)).length;});
  time("detectPlayerStayBehind "+n,function(){return g.detectPlayerStayBehind(rep("Morwen and I will go ",n/21),["Morwen Zethran","Daeris Vel"]);});
  time("personNarrationOnly "+n,function(){return g.narratesSecondPerson(rep('"x ',n/3));});
  time("registerScan "+n,function(){return g.registerScan(rep("ledger ",n/7)).length;});
  time("abilityTagSubject "+n,function(){return g.abilityTagSubject(rep("frizwick ",n/9),"Ammut",["Frizwick Thorn"]);});
  time("pastRaisedByHero "+n,function(){return g.pastRaisedByHero(rep("remember the old ",n/17),[],["Daeris"],[{who:"Daeris",text:rep("something happened ",50)}]);});
  time("coinNarrationAmounts number-words "+n,function(){return g.coinNarrationAmounts(rep("twenty ",n/7)).amounts.length;});
});
// elapsedTicker leaks: el null keeps an interval
var origSet=setInterval,live=0;global.setInterval=function(f,ms){live++;var id=origSet(f,ms);return id;};
var clr=clearInterval;global.clearInterval=function(id){live--;return clr(id);};
var t1=g.elapsedTicker(null,"x");console.log("ticker(null) live intervals:",live,"(no host to self-stop on; only stop() ends it)");
var el={textContent:"",isConnected:true};var t2=g.elapsedTicker(el,"a",{text:true});var t3=g.elapsedTicker(el,"b",{text:true});
console.log("two tickers on one element live:",live);
t1.stop();t2.stop();t3.stop();console.log("after stop:",live);
global.setInterval=origSet;global.clearInterval=clr;
// console ring + toast routing
g.consoleClear();for(var i=0;i<305;i++)g.consolePush("m"+i,"notice",false);
console.log("console entries",g.consoleEntries().length,"dropped",g.consoleDroppedCount(),"new",g.consoleNewCount());
console.log("toastPops inventory doorOpen",g.toastPops("inventory",true),"notice open",g.toastPops("notice",true),"notice closed",g.toastPops("notice",false),"__proto__ open",g.toastPops("__proto__",true),"toString open",g.toastPops("toString",true),"hasOwnProperty",g.toastPops("hasOwnProperty",true));
console.log("toastKind",g.toastKind({kind:"inventory"}),g.toastKind(null),g.toastKind({kind:5}),g.toastKind("inventory"));
console.log("consolePush null msg",JSON.stringify(g.consolePush(null,null,false)));
console.log("consoleRowsHtml dropped count string",g.consoleRowsHtml([],"<img src=x>").slice(0,80));
// party upload slug collisions
console.log("partyUploadPlan",JSON.stringify(g.partyUploadPlan({name:"__proto__",level:1},[{name:"constructor",charSheet:{level:1}}],[{slug:"toString",level:3}],0).rows.map(function(r){return r.name+":"+!!r.existing;})));
// stake + damage only
console.log("parseCheckTag dmgOnly",JSON.stringify(g.parseCheckTag("Breath|2d6")));
console.log("parseCheckTag mod 1d4+2 with DC",JSON.stringify(g.parseCheckTag("Dagger|1d4+2|DC 11")));
console.log("parseCheckTag 'DC 14' only + stake 2nd",JSON.stringify(g.parseCheckTag("Climb|DC 14")));
console.log("rollModalHtml for that",g.rollModalHtml(g.parseCheckTag("Attack|+5 vs DC 15")).match(/d20[^<]*/)[0]);
// abilityRecharge with model cost strings
console.log("abilityStatus",JSON.stringify(g.abilityStatus({nm:"Breath (1/day)",ds:""})));
// ownAssign/keyedDict with __proto__ JSON
var j=JSON.parse('{"__proto__":{"polluted":1},"a":1}');var kd=g.keyedDict(j);console.log("keyedDict __proto__ own:",Object.prototype.hasOwnProperty.call(kd,"__proto__"),"polluted?",({}).polluted);
var oa=g.ownAssign({},j);console.log("ownAssign proto of result polluted?",oa.polluted,Object.getPrototypeOf(oa)===Object.prototype);
var ks=g.keyedStores({atlas:{zones:JSON.parse('{"__proto__":{"x":1}}')}},"world");console.log("keyedStores atlas.zones null-proto",Object.getPrototypeOf(ks.atlas.zones)===null,"own __proto__",Object.prototype.hasOwnProperty.call(ks.atlas.zones,"__proto__"));
setTimeout(function(){process.exit(0);},50);
