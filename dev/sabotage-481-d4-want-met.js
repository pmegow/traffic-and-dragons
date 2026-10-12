// dev/sabotage-481-d4-want-met.js — proves the #481 D4 guards are guarded: a want lives on the clock and every reader sees
// only live wants; a met want retires (the counter's sale through ledgerApply, the GM's through ITEM_LOST); the counter pays the
// keeper's stated offer for one unit — one allowance per want across the whole trade (#577) — and an offer in words is
// refused with its text. #577 (verification 2026-10-08): the want's IDENTITY rides the sale line from the catalog through the
// plan into ledgerApply, and only the paid want retires. #591: on the GM's path a want retires only when a payment in the loss's
// own tag block equals the offer; anything else keeps the want and a ⚠ line says why. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d4-want-met.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D4"]];
var PAID = "#577 the paid offer is the retired offer", COIN = "#591 unrelated coin is no sale";
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "a want never expires",
    find: "return typeof w.min!==\"number\"||now-w.min<win;});\n}\n/* The node whose wants", replace: "return true;});\n}\n/* The node whose wants",
    mustFail: "a want expires on the clock" },
  { label: "#577 an exact-key retire removes the first same-base want again (the paid silver offer stays, the plain one goes)",
    find: "if(key!=null){for(i=0;i<live.length;i++){if(wantedKey(live[i])===key){w=live[i];break;}}}",
    replace: "if(key!=null){for(i=0;i<live.length;i++){if(itemPairKey(live[i].item)===itemPairKey(key)){w=live[i];break;}}}",
    mustFail: PAID }
]);
prove("tag_table.js", [
  { label: "a met want is never retired",/* #591 re-anchor: the retirement moved into wantedSaleSettle */
    find: "var met=retireWantedAt(L.at,L.name,wantedKey(L.w));", replace: "var met=null;",
    mustFail: "a GM-narrated sale in the shop retires the want" },
  { label: "#591 a discarded wanted item retires the want again (no coin needed)",/* #591 re-anchor: the proof is the payment test */
    find: "if(!words[L.blk]&&paid>0&&paid===due){", replace: "if(true){",
    mustFail: "#591 a discarded or consumed wanted item" },
  { label: "#591 any coin in the reply meets the want again (the R.goldIn>0 test that read 1 cp change as the ring's price)",
    find: "if(!words[L.blk]&&paid>0&&paid===due){", replace: "if(R.goldIn>0){",
    mustFail: COIN },
  { label: "#591 the payment's amount is not checked (any coin beside the loss is its price)",
    find: "&&paid>0&&paid===due)", replace: "&&paid>0)",
    mustFail: COIN },
  { label: "#591 a payment in another tag block pays for the loss",
    find: "var paid=(R.goldInAt&&R.goldInAt[L.blk])||0,", replace: "var paid=R.goldIn||0,",
    mustFail: COIN },
  { label: "#591 a kept want is silent (no line says why the sale was not read)",
    find: 'out.push({pos:L.pos,line:"⚠ Want kept — "+who+": "+', replace: 'void({pos:L.pos,line:"⚠ Want kept — "+who+": "+',
    mustFail: COIN },
  { label: "#591 the GOLD handler stops noting what each block was paid",
    find: "R.goldInAt[_gIBlk]=(R.goldInAt[_gIBlk]||0)+_gm;}", replace: "}",
    mustFail: "a GM-narrated sale in the shop retires the want" }
]);
prove("api.js", [
  { label: "the GM is served every stored want",
    find: "var _wLive=(mktNode&&typeof nodeWantedLive===\"function\")?nodeWantedLive(mktNode):[];", replace: "var _wLive=(mktNode&&mktNode.wanted)||[];",
    mustFail: "a want expires on the clock" }
]);
prove("helpers.js", [
  { label: "the counter pays a stored (expired) want",
    find: "wl=(typeof nodeWantedLive===\"function\")?nodeWantedLive(vtc.node):(vtc.node.wanted||[]);", replace: "wl=vtc.node.wanted||[];",
    mustFail: "a want expires on the clock" },
  { label: "a want buys the whole stack at the offer",
    find: "max:r.wanted?Math.min(WANT_BUYS*((r.want&&r.want.per)||1),r.qty):r.qty,", replace: "max:r.qty,",/* #517 (c) re-anchor: one BUNDLE */
    mustFail: "the counter pays the keeper's offer for ONE ring" },
  { label: "#577 every row that meets a want gets its own allowance again",
    find: "if(q>wl&&!overWant)overWant=r.want;", replace: "",
    mustFail: "#577 one wanted offer pays once" },
  { label: "an offer in words says nothing of itself",
    find: "if(w.cp!=null)r.sellCp=w.cp;else r.offerWords=true;}", replace: "if(w.cp!=null)r.sellCp=w.cp;}",
    mustFail: "an offer in words is unsellable at the counter" },
  { label: "#577 the sale line drops the want's identity (the ledger cannot tell which offer it paid)",
    find: "if(r.want)sl.wantKey=r.want.key;", replace: "",
    mustFail: PAID },
  { label: "#577 the counter matches on the base name (the silver ring is paid the plain offer, and both share one allowance)",
    find: "    var w=wantedFor(wl,r.name);", replace: "    var w=wantedFor(wl,itemBaseKey(r.name));",
    mustFail: PAID }
]);
prove("game.js", [
  { label: "#577 a sale line priced at no offer retires a want by name again (a stale plan retires an offer it never paid)",
    find: "var w=(ln.wantKey!=null&&typeof retireWantedAt===\"function\")?", replace: "var w=(typeof retireWantedAt===\"function\")?",
    mustFail: PAID }
]);
process.exit(code);
