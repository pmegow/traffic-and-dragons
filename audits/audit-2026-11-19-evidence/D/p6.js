var H=require('./h.js'),log=H.log;
var bodies=[""," ","|","||","a|","|a","a||b","x".repeat(5000),"\u{1F409}|\u{1F409}|\u{1F409}","a\nb|c\nd","-1|-1|-1|-1|-1|-1","NaN|NaN|NaN","Bram|+99999999999|x","Bram|1.5|x","0|0|0|0|0|0","Bram","Bram|Bram|Bram|Bram|Bram"];
function withBram(){H.fresh();worldState.npcs.push({name:"Bram",status:"",rel:"ally",met:1,partyMember:true,portrait:null,aliases:[],charSheet:{name:"Bram",hp:10,maxHp:10,cls:"Warrior",level:1,xp:0,inventory:[],conditions:[],abilities:[],spells:[],skills:initSkills(),stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10}}});memory.npcs.Bram={attitude:"",knowledge:[],events:[],aliases:[]};H.run("[COMBAT_START:Goblin|7|15|+4|1d6|low]");}
var errs=[],threw=[],nan=[];
TAG_TABLE.forEach(function(e){bodies.forEach(function(b){withBram();var R;try{R=H.run("["+e.t+":"+b+"]");}catch(x){threw.push(e.t+" <"+b.slice(0,20)+"> "+x.message);return;}
  if(R.errors&&R.errors.length)errs.push(e.t+" <"+b.slice(0,20)+"> "+R.errors.join(";"));
  var c=worldState.character,bs=findCompanionChar("Bram");
  [["hp",c.hp],["coin",c.coin],["xp",c.xp],["mana",c.mana],["bhp",bs&&bs.hp],["bxp",bs&&bs.xp],["clock",worldState.clock.min]].forEach(function(p){if(typeof p[1]==="number"&&!isFinite(p[1]))nan.push(e.t+" <"+b.slice(0,20)+"> "+p[0]+"="+p[1]);});
  (worldState.combat&&worldState.combat.foes||[]).forEach(function(f){if(!isFinite(f.hp)||!isFinite(f.maxHp))nan.push(e.t+" foe "+f.name+" hp="+f.hp);});
});});
log("THREW",JSON.stringify(threw,null,1));log("ERRORS",JSON.stringify(errs,null,1));log("NONFINITE",JSON.stringify(nan,null,1));
