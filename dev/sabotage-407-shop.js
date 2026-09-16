// dev/sabotage-407-shop.js — proves the #407 shop-interface clauses are guarded: the sell fraction, the WANTED full price,
// worn rows, the affordability lock, the shelf moving on a purchase, the one-shot ping, the orchestrator row and the
// thin-shell rule. Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-407-shop.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#407 the shop interface"]], cases: cases }); }
prove("helpers.js", [
  { label: "the keeper pays full canon for everything (the sell fraction is 1)",
    find: "var SHOP_SELL_FRACTION=0.5;", replace: "var SHOP_SELL_FRACTION=1;",
    mustFail: "#407 ① the catalog" },
  { label: "the WANTED list no longer pays full price",
    find: "if(gp)r.sellGp=w?gp:gp*SHOP_SELL_FRACTION;", replace: "if(gp)r.sellGp=gp*SHOP_SELL_FRACTION;",
    mustFail: "#407 ① the catalog" },
  { label: "worn items can be sold off the hero's back",
    find: "if(q<=0||r.worn||r.sellGp==null)continue;", replace: "if(q<=0||r.sellGp==null)continue;",
    mustFail: "#407 ② the plan" },
  { label: "the affordability lock is gone",
    find: "var goldAfter=cat.gold-rounded,ok=lines.length>0&&goldAfter>=0;", replace: "var goldAfter=cat.gold-rounded,ok=lines.length>0;",
    mustFail: "#407 ② the plan" },
  { label: "a half-gp sale rounds to nothing",
    find: "rounded=net>=0?Math.round(net):-Math.round(-net);", replace: "rounded=Math.round(net);",
    mustFail: "#407 ② the plan" }
]);
prove("game.js", [
  { label: "a bought ware stays on the shelf",
    find: "if(String(node.wares[wi].item).toLowerCase()===l.name.toLowerCase()){node.wares.splice(wi,1);break;}", replace: "if(false){node.wares.splice(wi,1);break;}",
    mustFail: "#407 ③ Complete lands" },
  { label: "the GM is never told (tradePing not armed)",
    find: "worldState.tradePing={turn:worldState.turn,keeper:cat.keeper,", replace: "worldState.tradePingX={turn:worldState.turn,keeper:cat.keeper,",
    mustFail: "#407 ③ Complete lands" },
  { label: "the system line stops naming the keeper and the shop (owner ruling: every transaction names both parties)",
    find: "+\" gp, with \"+cat.keeper+\" at \"+cat.shop+\".\";", replace: "+\" gp.\";",
    mustFail: "#407 ③ Complete lands" }
]);
prove("api.js", [
  { label: "the trade note is dropped from the orchestrator",
    find: "buildTradeRefusedNudge,/* #6 F9 */buildTradeNote,/* #407 */", replace: "buildTradeRefusedNudge,/* #6 F9 */",
    mustFail: "#407 ③ Complete lands" }
]);
prove("ui-modals.js", [
  { label: "the modal applies tags itself instead of the engine pair",
    find: "var res=shopTradeApply(marks);", replace: "var res=applyMuts(shopTradeTagText(shopTradePlan(cat,marks)))&&{ok:true,line:''};",
    mustFail: "#407 ④ registry and identity" }
]);
process.exit(code);
