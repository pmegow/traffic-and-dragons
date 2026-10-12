// dev/sabotage-481-d4-want-met.js — proves the #481 D4 guards are guarded: a want lives on the clock and every reader sees
// only live wants; a met want retires (the counter's sale through ledgerApply, the GM's through ITEM_LOST); the counter pays the
// keeper's stated offer for one unit — one allowance per want across the whole trade (#577) — and an offer in words is
// refused with its text. #577 (verification 2026-10-08): the want's IDENTITY rides the sale line from the catalog through the
// plan into ledgerApply, and only the paid want retires. #591: on the GM's path a want retires only when a payment in the loss's
// own tag block equals the offer; anything else keeps the want and a ⚠ line says why. Acceptance 2026-10-12: a voided loss (the
// unit put back by a later handler) is no sale, the blocks settle in text order, a loss is the sheet's item, one payment rule
// (wantedPayCp) prices the counter and the settle, and the want match reads an item without its provenance clause and applies
// the pack rule inside a qualifier — those clauses run the acceptance section. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d4-want-met.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D4"]];
var PAID = "#577 the paid offer is the retired offer", COIN = "#591 unrelated coin is no sale";
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
/* acceptance 2026-10-12 (#577 #591): its section is not selected by "#481 D4", so its clauses run their own filter */
var ACC = ["node", ["dev/run-tests.js", "acceptance 2026-10-12"]];
function proveAcc(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ACC, cases: cases }); }
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
  { label: "a met want is never retired",/* #591 re-anchor: the retirement moved into wantedSaleSettle; acceptance 2026-10-12 re-anchor: it retires the exact row the loss saw (retireWantedRow) */
    find: "ix:retireWantedRow(L.node,L.w)}", replace: "ix:-1}",
    mustFail: "a GM-narrated sale in the shop retires the want" },
  { label: "#591 a discarded wanted item retires the want again (no coin needed)",/* #591 re-anchor: the proof is the payment test */
    find: "if(L.left&&!words&&paid>0&&paid===due){", replace: "if(true){",/* acceptance 2026-10-12 re-anchor: the verdict is per block */
    mustFail: "#591 a discarded or consumed wanted item" },
  { label: "#591 any coin in the reply meets the want again (the R.goldIn>0 test that read 1 cp change as the ring's price)",
    find: "if(L.left&&!words&&paid>0&&paid===due){", replace: "if(R.goldIn>0){",
    mustFail: COIN },
  { label: "#591 the payment's amount is not checked (any coin beside the loss is its price)",
    find: "&&paid>0&&paid===due)", replace: "&&paid>0)",
    mustFail: COIN },
  { label: "#591 a payment in another tag block pays for the loss",
    find: "var paid=(R.goldInAt&&R.goldInAt[blks[j]])||0;", replace: "var paid=R.goldIn||0;",/* acceptance 2026-10-12 re-anchor */
    mustFail: COIN },
  { label: "#591 a kept want is silent (no line says why the sale was not read)",
    find: 'S.out.push({pos:L.pos,line:"⚠ Want kept — "+who+": "+', replace: 'void({pos:L.pos,line:"⚠ Want kept — "+who+": "+',/* acceptance 2026-10-12 re-anchor: the lines ride the settle record */
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
prove("memory.js", [
  { label: "#577 a plain item meets a qualified want again (the same-base third rank returns; the plain ring is paid the silver offer)",
    find: "wm===cm?3:wk===b?2:0;", replace: "wm===cm?3:wk===b?2:itemPairKey(live[i].item)===b?1:0;",/* acceptance 2026-10-12 re-anchor: the ranks are 4/3/2 (exact, clause-free, plain) */
    mustFail: "#577 ONE-WAY" }
]);
/* acceptance 2026-10-12 (#577 #591): one clause per closed mechanism, each caught by the acceptance probe that named it */
proveAcc("tag_table.js", [
  { label: "#591 a voided loss is settled as a sale again (the land never resettles; the ring back in the pack still retires the want)",
    find: "if(S.voided){", replace: "if(false){",
    mustFail: "#591 acceptance a voided loss is no sale" },
  { label: "#591 the blocks are matched in one pass again (a later block meets the want an earlier block just retired)",
    find: "L.w=wantedFor(wantedSaleAvail(L.live,gone),L.name);", replace: "L.w=wantedFor(L.live,L.name);",
    mustFail: "#591 acceptance two sales in two blocks of ONE reply" },
  { label: "#591 the loss is recorded under the tag's words again (the silver ring the tag took never meets the silver want)",
    find: "_ilSheet.push(removeInventoryItem.last);", replace: "_ilSheet.push(ilq.base);",
    mustFail: "#591 acceptance the GM names the base" },
  { label: "#591 each loss tag is priced alone again (three [ITEM_LOST:Arrow] round to 3 x 33 cp)",
    find: "wi=ws.indexOf(L.w);if(wi<0){", replace: "wi=-1;if(wi<0){",
    mustFail: "#591 acceptance a bundle sold in separate loss tags" }
]);
proveAcc("helpers.js", [
  { label: "#577 the counter prices a wanted line by the stored unit again (three of 1 gp per 3 pay 9 sp 9 cp)",
    find: "cp:r.want?wantedPayCp(r.want,q):r.sellCp*q};", replace: "cp:r.sellCp*q};",
    mustFail: "#577 acceptance a bundle that does not divide evenly" }
]);
proveAcc("memory.js", [
  { label: "#577 the clause-free rank is gone (the silver crypt ring meets no want)",
    find: "wm===cm?3:", replace: "false?3:",
    mustFail: "#577 acceptance a qualified item with a provenance clause" },
  { label: "#577 the pack rule stops at the qualifier again (Wolf pelts (prime) never meets Wolf pelt (prime))",
    find: 'function wantedMatchKey(name){var k=itemKey(name),p=k.indexOf("(");', replace: "function wantedMatchKey(name){var k=itemKey(name),p=-1;",
    mustFail: "#577 acceptance plural with a qualifier" }
]);
/* the D4 section's own pins of the same mechanisms (the row amount, the partial bundle, the void line and the restored place) */
prove("tag_table.js", [
  { label: "#591 a resettle restores no want (the voided block's retirement sticks)",
    find: "for(i=S.retired.length-1;i>=0;i--)restoreWantedRow(", replace: "for(i=S.retired.length-1;i>=0&&false;i--)restoreWantedRow(",
    mustFail: "#591 a voided loss says why" },
  { label: "#591 a voided loss's ⚠ line no longer says the unit went back (it reads as a coin miss)",
    find: "(!L.left?\"the loss was voided (it went back in the pack)\":", replace: "(!L.left?\"no coin was paid in the same tag block as the item\":",
    mustFail: "#591 a voided loss says why" }
]);
prove("memory.js", [
  { label: "#591 a restored want goes to the end of the list (the keeper's wants reorder)",
    find: "node.wanted.splice(Math.min(ix,node.wanted.length),0,w);return true;", replace: "node.wanted.push(w);return true;",
    mustFail: "#591 a voided loss says why" }
]);
prove("helpers.js", [
  { label: "#577 a wanted row's amount is the stored unit times the count again (the row says 9 sp 9 cp, the plan pays 1 gp)",
    find: "cp:r.want?wantedPayCp(r.want,r.want.per):r.sellCp,per:r.want?r.want.per:1,", replace: "cp:r.sellCp,per:1,",
    mustFail: "#577 one payment rule" }
]);
process.exit(code);
