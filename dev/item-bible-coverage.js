// item-bible-coverage.js — #157: READ-ONLY item-bible coverage audit over a .tnd save.
// Reports, per Sol's spec §7.3: total rows and unique normalized names; direct key matches,
// explicit alias matches, invalid definitions, and misses; the chosen display section and all
// applicable categories; misses grouped by character with the exact raw inventory string; and
// a coverage percentage. Modifies NOTHING — no save write, no bible write.
//
// Usage:  node dev/item-bible-coverage.js <save.tnd> [--misses]
//   --misses  print ONLY the unique missed names (curation worklist)

addMsg=function(){};escHtml=function(s){return s;};showToast=function(){};updateCombat=function(){};syncUI=function(){};
var eng=require("./load-engine.js");
eng.loadEngine("game.js");
var fs=require("fs");
var save=process.argv[2];
if(!save){console.log("usage: node dev/item-bible-coverage.js <save.tnd> [--misses]");process.exit(2);}
var missesOnly=process.argv.indexOf("--misses")>=0;
var d=JSON.parse(fs.readFileSync(save,"utf8"));
worldState=d.worldState;memory=d.memory;sessionLog=[];

var owners=[{name:worldState.character.name+" (PC)",inv:worldState.character.inventory||[]}];
(worldState.npcs||[]).forEach(function(n){if(n.partyMember&&n.charSheet&&(n.charSheet.inventory||[]).length)owners.push({name:n.name,inv:n.charSheet.inventory});});

var total=0,uniq={},stats={direct:0,alias:0,invalid:0,miss:0},bySec={},missRows=[];
owners.forEach(function(o){
  o.inv.forEach(function(raw){
    total++;
    var key=itemBaseName(raw);uniq[key]=1;
    var direct=(worldState.itemBible&&worldState.itemBible[key])||(typeof ITEM_BIBLE!=="undefined"&&ITEM_BIBLE[key])||null;
    var e=itemLookup(raw);
    var cats=e?itemInvCategories(e):null;
    if(!e){stats.miss++;missRows.push({owner:o.name,raw:raw,key:key});bySec.unclassified=(bySec.unclassified||0)+1;return;}
    if(!cats){stats.invalid++;missRows.push({owner:o.name,raw:raw,key:key,invalid:true});bySec.unclassified=(bySec.unclassified||0)+1;return;}
    stats[direct?"direct":"alias"]++;
    var sec="unclassified",i;
    for(i=0;i<INVENTORY_CATEGORY_REGISTRY.length;i++){if(cats.indexOf(INVENTORY_CATEGORY_REGISTRY[i].id)>=0){sec=INVENTORY_CATEGORY_REGISTRY[i].id;break;}}
    bySec[sec]=(bySec[sec]||0)+1;
  });
});

if(missesOnly){
  var mu={},names=[];
  missRows.forEach(function(m){if(!mu[m.key]){mu[m.key]=1;names.push(m.key);}});
  names.sort().forEach(function(n){console.log(n);});
  console.log("// "+names.length+" unique missed names");
  process.exit(0);
}
console.log("ITEM-BIBLE COVERAGE — "+save);
console.log("owners: "+owners.map(function(o){return o.name+" ("+o.inv.length+")";}).join(", "));
console.log("rows: "+total+" | unique normalized names: "+Object.keys(uniq).length);
console.log("resolved direct: "+stats.direct+" | via alias: "+stats.alias+" | invalid metadata: "+stats.invalid+" | missed: "+stats.miss);
console.log("coverage: "+Math.round(100*(stats.direct+stats.alias)/Math.max(1,total))+"% of rows");
console.log("by display section: "+JSON.stringify(bySec));
if(missRows.length){
  console.log("\nMISSES (owner · raw · normalized):");
  missRows.forEach(function(m){console.log("  "+m.owner+" · "+JSON.stringify(m.raw)+" · '"+m.key+"'"+(m.invalid?" [INVALID METADATA]":""));});
}
