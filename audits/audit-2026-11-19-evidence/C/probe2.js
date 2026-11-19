var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();try{L.makeTestWorld();}catch(e){}
var g=global;
function rep(s,n){return new Array(n+1).join(s);}
function time(label,fn){var t=Date.now();var r;try{r=fn();}catch(e){r="THREW "+e.message;}console.log("== "+label+": "+(Date.now()-t)+" ms"+(r!==undefined?" -> "+String(JSON.stringify(r)).slice(0,120):""));}
[2000,8000,16000].forEach(function(n){
  time("checkStakeField 'a'x"+n,function(){return g.checkStakeField(rep("a",n)+" 1",2);});
  time("checkStakeField 'aa 1'x"+(n/4),function(){return g.checkStakeField(rep("aa 1",n/4),2);});
  time("abilityCost long paren "+n,function(){return g.abilityCost({nm:"X ("+rep("1/",n/2)+")"});});
  time("coinNarrationAmounts 'one 'x"+(n/4),function(){return g.coinNarrationAmounts(rep("one ",n/4)+"thing").amounts.length;});
  time("coinNarrationAmounts '5 word 'x"+(n/8),function(){return g.coinNarrationAmounts(rep("5 bright ",n/8)).amounts.length;});
  time("detectStayBehind",function(){return g.detectStayBehind(rep("Morwen waits ",n/12),["Morwen Zethran"]);});
  time("parseCoin",function(){return g.parseCoin(rep("1 gp ",n/5));});
  time("normalizeEndpointPair",function(){return g.normalizeEndpointPair("road "+rep("( ",n/2));});
  time("escProse stars",function(){return g.escProse(rep("*a",n)).length;});
  time("denouementSplit",function(){return g.denouementSplit(rep("**[(RECORD",n/10)).record.length;});
  time("snippetAtSentence",function(){return g.snippetAtSentence(rep("a. ",n/3)).length;});
  time("registerMaskNames 200 names",function(){var names=[];for(var i=0;i<200;i++)names.push("Name"+i+" Thing");return g.registerMaskNames(rep("word Name5 Thing ",n/16),names).length;});
  time("toFirstPerson",function(){return g.toFirstPerson(rep("you ",n/4)).length;});
  time("sttCorrectNames",function(){return g.sttCorrectNames(rep("physics ",n/8),[{word:"Frizwick",full:"Frizwick"}]).length;});
});
// parseDamageExpr / parseCoin edges
["0d6","00d6","10d12+999","11d6","d8","1d8-0","1d8+-2","1d7"," 2 d 6 + 1 ","1d6+1000"].forEach(function(s){console.log("parseDamageExpr "+JSON.stringify(s)+" -> "+JSON.stringify(g.parseDamageExpr(s)));});
["1,200 gp","1.5 gp","-5 sp","1 gp per 0","20 for 1 gp","a dozen for 1 gp","1e3 gp","999999999999999999999 gp","gp"].forEach(function(s){console.log("parseCoin "+JSON.stringify(s)+" -> "+JSON.stringify(g.parseCoin(s)));});
["-2 (2 sp change)","+ 5 gp","+5gp","-0.5 sp","abc"].forEach(function(s){console.log("goldTagParse "+s+" -> "+JSON.stringify(g.goldTagParse("[GOLD:"+s+"]")));});
console.log("fmtCoin NaN",g.fmtCoin(NaN),"fmtCoin -5",g.fmtCoin(-5),"fmtCoin 1e21",g.fmtCoin(1e21));
console.log("getLvl NaN",g.getLvl(NaN),"getLvl -5",g.getLvl(-5),"getLvl 1e12",g.getLvl(1e12));
console.log("csXpMeter lvl 0",JSON.stringify(g.csXpMeter(10,0)),"lvl 25",JSON.stringify(g.csXpMeter(10,25)));
console.log("startTimeToHour 24",g.startTimeToHour("24"),"25:99",g.startTimeToHour("23:99"));
console.log("clockHourLabel NaN",g.clockHourLabel(NaN));
console.log("smod NaN",g.smod(NaN),"smod undefined",g.smod(undefined));
console.log("hpGainPerLevel NaN",g.hpGainPerLevel(undefined,2));
console.log("spellUnlocksCrossed",JSON.stringify(g.spellUnlocksCrossed("__proto__",null,0,20)));
console.log("classDef __proto__",g.classDef("__proto__"),"classDef toString",g.classDef("toString"));
console.log("skillLevel -1",g.skillLevel(-1),"NaN",g.skillLevel(NaN));
console.log("manaMax stats CON 1e9",g.manaMax({cls:"wizard",spells:[{nm:"Magic Missile",lvl:1}],stats:{INT:1e9}}));
console.log("vitalReadout cur>max",JSON.stringify(g.vitalReadout("hp",50,10)),"neg",JSON.stringify(g.vitalReadout("hp",-5,10)),"kind __proto__",JSON.stringify(g.vitalReadout("__proto__",5,10)));
console.log("diceTotalOf",g.diceTotalOf("d20 = 19 + 2 = 21 vs DC 12"),g.diceTotalOf("17 vs DC 12"));
console.log("ledgerNextMark",g.ledgerNextMark(NaN,NaN),g.ledgerNextMark(5,3));
console.log("itemBaseName __proto__",JSON.stringify(g.itemBaseName("__proto__")),"itemLookup __proto__",g.itemLookup("__proto__"),"itemLookup constructor",g.itemLookup("constructor"),"hasOwnProperty",g.itemLookup("hasOwnProperty"));
console.log("itemDefEligible constructor",g.itemDefEligible("constructor"));
console.log("itemDefOverlayReplaceable",g.itemDefOverlayReplaceable("constructor"));
console.log("campaignKind __proto__"),(function(){var w=g.worldState;var k=w.kind;w.kind="__proto__";console.log(" ->",g.campaignKind());w.kind="toString";console.log(" ->",g.campaignKind());w.kind=k;})();
console.log("CAMPAIGN_KINDS proto",Object.getPrototypeOf(g.CAMPAIGN_KINDS)===null);
console.log("questIsEmergent constructor",g.questIsEmergent("constructor"));
console.log("bestiaryRecord",g.bestiaryRecord("__proto__"));
