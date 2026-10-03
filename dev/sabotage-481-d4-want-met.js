// dev/sabotage-481-d4-want-met.js — proves the #481 D4 guards are guarded: a want lives on the clock and every reader sees
// only live wants; a met want retires (the counter's sale and the GM's both, through ITEM_LOST); the counter pays the
// keeper's stated offer for one unit, and an offer in words is refused with its text. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d4-want-met.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D4"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "a want never expires",
    find: "return typeof w.min!==\"number\"||now-w.min<win;});\n}\n/* The node whose wants", replace: "return true;});\n}\n/* The node whose wants",
    mustFail: "a want expires on the clock" }
]);
prove("tag_table.js", [
  { label: "a met want is never retired",
    find: "var _wmet=(typeof retireWantedAt===\"function\")?retireWantedAt(rPlaceAt(R,ilOff[ili]),ilq.base):null;", replace: "var _wmet=null;",
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
    find: "max:r.wanted?Math.min(1,r.qty):r.qty,", replace: "max:r.qty,",
    mustFail: "the counter pays the keeper's offer for ONE ring" },
  { label: "an offer in words says nothing of itself",
    find: "if(w.cp!=null)r.sellCp=w.cp;else r.offerWords=true;}", replace: "if(w.cp!=null)r.sellCp=w.cp;}",
    mustFail: "an offer in words is unsellable at the counter" }
]);
process.exit(code);
