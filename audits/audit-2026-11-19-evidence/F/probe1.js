// Lane F probes: item-kinds truncation, __proto__ keys, inventory extras, admission
var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();L.makeTestWorld();
showToast=function(m){console.log("TOAST:",String(m).slice(0,200));};saveAll=function(){};addMsg=function(){return {remove:function(){}};};
function out(label,v){console.log(label,JSON.stringify(v));}

// ---- P1: a long item name (> ITEM_KIND_NAME_MAX) ----
var longName="Ornate ceremonial dagger of the Seventh Dynasty with a jade hilt and silver filigree inlay worked by hand";
out("name length",longName.length);
worldState.character.inventory=[{name:longName,qty:1,equipped:false},{name:"Hide armor",qty:1,equipped:false}];
var owed=itemKindsOwed(worldState);out("owed",owed);
// emulate settle filing with a model reply "weapon","armor"
var read=itemKindsRead(JSON.stringify({kinds:["weapon","armor"]}),{},owed.length);out("read",read);
for(var i=0;i<owed.length;i++)out("file "+i,itemKindFile(worldState,owed[i].name,read.kinds[i],5));
out("store keys",Object.keys(worldState.itemKinds));
out("owed after filing",itemKindsOwed(worldState).map(function(o){return o.key;}));
var g=groupInventory(worldState.character.inventory,worldState.character);
out("groups",g.map(function(x){return x.id+":"+x.rows.map(function(r){return r.name.slice(0,20);}).join(",");}));

// ---- P1b: real itemKindsSettle with a stubbed callGM over 2 turns ----
L.makeTestWorld();
worldState.character.inventory=[{name:longName,qty:1,equipped:false}];
var calls=0;callGM=async function(u,s){calls++;var n=JSON.parse(u).items.length;var k=[];for(var j=0;j<n;j++)k.push("weapon");return JSON.stringify({kinds:k});};
(async function(){
  var r1=await itemKindsSettle();out("settle1",r1);
  worldState.turn++;
  var r2=await itemKindsSettle();out("settle2",r2);
  worldState.turn++;
  var r3=await itemKindsSettle();out("settle3",r3);
  out("callGM calls over 3 turns",calls);
  out("store",worldState.itemKinds);

  // ---- P2: __proto__ item name ----
  L.makeTestWorld();
  worldState.character.inventory=[{name:"__proto__",qty:1,equipped:false},{name:"constructor",qty:1,equipped:false}];
  out("owed proto",itemKindsOwed(worldState));
  // store as plain object (as if not keyed)
  worldState.itemKinds={};
  out("file proto on plain store",itemKindFile(worldState,"__proto__","tool",1));
  out("stored proto own?",Object.prototype.hasOwnProperty.call(worldState.itemKinds,"__proto__"));
  out("owed after (plain store)",itemKindsOwed(worldState).map(function(o){return o.key;}));
  worldState.itemKinds=keyedDict();
  itemKindFile(worldState,"__proto__","tool",1);
  out("owed after (keyed store)",itemKindsOwed(worldState).map(function(o){return o.key;}));
  // JSON roundtrip of the keyed store and back through keyedStores
  var ws2=JSON.parse(JSON.stringify({itemKinds:worldState.itemKinds}));
  out("roundtrip own __proto__",Object.prototype.hasOwnProperty.call(ws2.itemKinds,"__proto__"));

  // ---- P3: invAdd with extras carrying an own __proto__ field ----
  var src=JSON.parse('[{"name":"Lantern","qty":2,"equipped":false,"__proto__":{"lit":true},"note":"x"}]');
  out("src row own __proto__",Object.prototype.hasOwnProperty.call(src[0],"__proto__"));
  var prep=invRows(src);out("invRows ok",prep.ok);
  var rows=prep.rows;out("prepared row own __proto__",Object.prototype.hasOwnProperty.call(rows[0],"__proto__"));
  var rem=invRemove(rows,"Lantern",1);out("fragment own __proto__",Object.prototype.hasOwnProperty.call(rem.removed,"__proto__"));
  var dest=[];var ok=addInventoryItem(dest,"Lantern",rem.removed);out("add ok",ok);
  out("dest row JSON",JSON.stringify(dest[0]));
  out("dest row own __proto__",Object.prototype.hasOwnProperty.call(dest[0],"__proto__"));
  out("dest row proto is Object.prototype",Object.getPrototypeOf(dest[0])===Object.prototype);
  out("dest.lit via proto",dest[0].lit);
  // invCarryFields path
  var dest2=[{name:"Lantern",qty:1,equipped:false}];
  out("carry",invCarryFields(dest2,"Lantern",rem.removed,1));
  out("dest2 JSON",JSON.stringify(dest2[0]));

  // ---- P4: qty edges through invAdd/invRemove ----
  var r=[];out("add qty0",invAdd(r,"Rope",0));out("add -3",invAdd(r,"Rope",-3));out("add 2.5",invAdd(r,"Rope",2.5));out("add NaN",invAdd(r,"Rope",NaN));out("rows",r);
  out("remove 0",invRemove(r,"Rope",0));out("remove 99",invRemove(r,"Rope",99));out("rows after",r);
  out("stored parse '3 torches'",invStoredParse("3 torches"));out("parse 'Potion (x2)'",invStoredParse("Potion (x2)"));out("parse 'x'",invStoredParse("x"));out("parse 'Arrows x0'",invStoredParse("Arrows x0"));out("parse 'x5'",invStoredParse("x5"));out("parse 'Torch x10000'",invRowOf("Torch x10000"));
  // rename onto existing
  var rr=[{name:"Rope",qty:1,equipped:false},{name:"Coil of rope",qty:1,equipped:false}];
  out("rename onto existing",invRename(rr,"Coil of rope","ropes"));
  // slice sharing
  var live=[{name:"Torch",qty:2,equipped:false}];var sl=live.slice();invRemove(sl,"Torch",1);out("slice shares rows: live qty",live[0].qty);
})().catch(function(e){console.log("ERR",e&&e.stack);});
