// dev/sabotage-6-village-stash.js — proves the #6 phase E/F (houses, the stash, the shops) clauses are guarded: the kind
// axes, the stash core (qty, provenance, the house operand, the loud refusals, the taken gate, the auto-take gate), the
// merge that keeps the chest, the stash in the prompt, Car Mode's undo, shop-ness by data, wares per shop with the loud
// eviction, pinned prices, the trade gate on GOLD and the items riding with it, the fourth button's village rungs and
// the suggestion rule. Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing touches the tree.
//   node dev/sabotage-6-village-stash.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
prove("data.js", [
  { label: "the village stash has no quantities (adventure toggle rows)",
    find: 'stashQuantities:true,tradeOnlyInShops:true,', replace: 'stashQuantities:false,tradeOnlyInShops:true,',
    mustFail: "#6E1 permanence" },
  { label: "the village trades anywhere",
    find: 'stashQuantities:true,tradeOnlyInShops:true,', replace: 'stashQuantities:true,tradeOnlyInShops:false,',
    mustFail: "#6F5 trade only in a shop" },
  { label: "the village keeps a settlement-wide market",
    find: 'waresPerShop:true,pinPrices:true,', replace: 'waresPerShop:false,pinPrices:true,',
    mustFail: "#6F2 wares live on the shop" },
  { label: "the village stops pinning prices",
    find: 'waresPerShop:true,pinPrices:true,', replace: 'waresPerShop:true,pinPrices:false,',
    mustFail: "#6F4 prices pinned" },
  { label: "the sell rung is off",
    find: 'pinPrices:true,sellRung:true,', replace: 'pinPrices:true,sellRung:false,',
    mustFail: "#6F6 the fourth button names both parties" },
  { label: "the village tag doc stops teaching the house operand",
    find: '[LOCATION_ITEM:name|placed|<house or place>] files an item to the place NAMED', replace: '[LOCATION_ITEM:name|placed] files an item to the place NAMED',
    mustFail: "#6E2 files to the house named" }
]);
prove("memory.js", [
  { label: "a second placement no longer counts",
    find: 'else row.qty=(row.qty||1)+1;', replace: 'else row.qty=1;',
    mustFail: "#6E1 permanence" },
  { label: "the auto-take gate opens every house",
    find: 'if(qtyMode&&node.owner&&worldState.character&&node.owner!==worldState.character.name)return {kept:true,owner:node.owner,name:it.name};', replace: 'if(false)return null;',
    mustFail: "#6E5 the auto-take path is gated" },
  { label: "wares file on any sub-location, shop or not",
    find: 'return (node&&typeof isShopNode==="function"&&isShopNode(key,node))?node:null;', replace: 'return node||null;',
    mustFail: "#6F2 wares live on the shop" },
  { label: "the per-shop cap is unbounded",
    find: '?WARES_CAP_SHOP:waresCapFor(node);', replace: '?99:waresCapFor(node);',
    mustFail: "#6F2 wares live on the shop" },
  { label: "canon no longer pins the price",
    find: 'pr=_pinTo;}', replace: 'pr=pr;}',
    mustFail: "#6F4 prices pinned" },
  { label: "a missing node is a silent drop again",
    find: 'if(!node)return {ok:false,reason:"no such place on the map",key:key};', replace: 'if(!node)return {ok:true,key:key};',
    mustFail: "#6E3 a missing node refuses LOUDLY" }
]);
prove("tag_table.js", [
  { label: "the trade gate never refuses",
    find: 'if(!_vtc.ok){R.villageTradeRefused=_vtc.reason;', replace: 'if(false){R.villageTradeRefused=_vtc.reason;',
    mustFail: "#6F5 trade only in a shop" },
  { label: "the refusal never reaches the GM (no ping armed)",
    find: 'worldState.tradeRefusedPing={turn:R.turn,reason:_vtc.reason,items:/\\[ITEM_(GAINED|LOST):/.test(text)};', replace: '',
    mustFail: "#6F9 a refused trade is TOLD" },
  { label: "an item riding a refused trade is still gained",
    find: 'if(R.villageTradeRefused&&igTags.length){', replace: 'if(false){',
    mustFail: "#6F5 trade only in a shop" },
  { label: "`taken` lands in the village",
    find: 'if(_lact==="taken"&&typeof kindDef==="function"&&kindDef().stashQuantities){', replace: 'if(false){',
    mustFail: "#6E4 `taken` carries no actor" },
  { label: "the stash refusal leaves the mutation log",
    find: 'R.muts.push("Stash refused — "+_lnm+" ("+(_lplace||"here")+"): "+_lwhy);', replace: '',
    mustFail: "#6E3 a missing node refuses LOUDLY" },
  { label: "the last item move is not recorded for the undo",
    find: 'worldState.lastItemMove={name:_lnm,action:_lact,key:_lst.key,turn:R.turn};', replace: '',
    mustFail: "#6E9 Car Mode undo" },
  { label: "a leave erases an arrival that came after it (table order again)",
    find: 'if(_arLast>_lv)return;/* the arrival came after the leave — it stands */', replace: '',
    mustFail: "#6F8 leave-then-arrive" },
  { label: "a ware outside a shop files silently",
    find: 'if(typeof kindDef==="function"&&kindDef().waresPerShop&&!waresNodeFor(R.turn)){', replace: 'if(false){',
    mustFail: "#6F2 wares live on the shop" }
]);
prove("helpers.js", [
  { label: "a house can be a shop",
    find: 'if(node.owner)return false;var k=String(key||"");', replace: 'var k=String(key||"");',
    mustFail: "#6F1 a shop is a place" },
  { label: "the Hall can be a shop",
    find: 'if(def.hallWords&&def.hallWords.test(leaf))return false;', replace: '',
    mustFail: "#6F1 a shop is a place" },
  { label: "the gate ignores the response's own arrival (table order again)",
    find: 'if(_pos>_lv)key=worldState.world.location+"|"+_last.slice(13,-1).trim();else key=worldState.world.location;', replace: 'key=key;',
    mustFail: "#6F10 the trade gate reads the response" },
  { label: "a shop with no one in it still trades",
    find: 'if(!keeper)return {ok:false,reason:"no counterparty present in "+leaf};', replace: 'if(!keeper)keeper="someone";',
    mustFail: "#6F5 trade only in a shop" },
  { label: "\"never mind\" is an action, not an undo",
    find: '/^(?:never mind|nevermind|undo(?: that| it| the last one)?|put it back|scratch that)$/', replace: '/^(?:nevermind|undo(?: that| it| the last one)?|put it back|scratch that)$/',
    mustFail: "#6E9 Car Mode undo" },
  { label: "the house group shows outside the village",
    find: 'if(!def||!def.stashQuantities||typeof worldState==="undefined"||!worldState||!worldState.character)return null;\n  var rows=villageStash(', replace: 'if(!def||typeof worldState==="undefined"||!worldState||!worldState.character)return null;\n  var rows=villageStash(',
    mustFail: "#6E8 the stash is SEEN" }
]);
prove("game.js", [
  { label: "the swap's demotion mints no house",
    find: 'if(toResident){villageHouseEnsure(oldChar.name,null);/* #6 E6: the demoted hero gets a house, same path as import */', replace: 'if(toResident){',
    mustFail: "#6E6 owner on the node on EVERY path" },
  { label: "the village buy rung drops the keeper's name",
    find: '+") from "+_vt.keeper+"."};}}', replace: '+")."};}}',
    mustFail: "#6F6 the fourth button names both parties" },
  { label: "the validator lets a trade outside a shop through",
    find: 'if(!_vts.ok)return {rule:"trade-outside-shop",detail:_vts.reason};', replace: 'if(!_vts.ok)return null;',
    mustFail: "#6F7 suggestions obey the same rule" },
  { label: "the undo undoes forever",
    find: 'delete worldState.lastItemMove;\n  return {ok:true,name:mv.name,action:mv.action,key:mv.key};', replace: 'return {ok:true,name:mv.name,action:mv.action,key:mv.key};',
    mustFail: "#6E9 Car Mode undo" }
]);
prove("identity.js", [
  { label: "a merge collapses same-named stash rows",
    find: '_ci.qty=_sum;_ci.taken=false;', replace: '_ci.taken=false;',
    mustFail: "#6E7 a node merge keeps the chest" },
  { label: "a merge forgets the owner",
    find: 'if(!canonNode.owner&&dupNode.owner)canonNode.owner=dupNode.owner;', replace: '',
    mustFail: "#6E7 a node merge keeps the chest" }
]);
prove("api.js", [
  { label: "the stash never reaches the prompt",
    find: 'if(_stHere.length)lines.push("STASH here"', replace: 'if(false)lines.push("STASH here"',
    mustFail: "#6E8 the stash is SEEN" },
  { label: "the shelf is read from the settlement, not the shop",
    find: 'var mktNode=_perShop?((subNode&&typeof isShopNode==="function"&&isShopNode(rsubKey,subNode))?subNode:null):wNode;', replace: 'var mktNode=wNode;',
    mustFail: "#6F3 restock on the clock" }
]);
process.exit(code);
