// dev/sabotage-464-toc-locations.js — proves #464 is guarded: the MEMORY DIRECTORY's VISITED / KNOWN OF lines read the node
// store as well as the legacy memory.locations store. Each rule is mutated back: the union collapses to the legacy store (a
// visited sub-location and a world node minted without fileLocation vanish again), the unvisited-sub omission is dropped
// (pre-minted houses and commons flood KNOWN OF), the resolved-key dedupe is dropped (a merged duplicate lists twice), and
// the P9 legacy rule is broken (a no-node legacy key leaves VISITED). The sub-location cap (the audit 2026-09-18 B2 shape
// for places) is mutated too: removed, flipped to keep the oldest, applied to the bare Table Talk call, and its singular lost.
//   node dev/sabotage-464-toc-locations.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "blueprint import hygiene"]];
var UNION = "  if(memory.map&&memory.map.nodes)lk=lk.concat(Object.keys(memory.map.nodes));";
var code = 0;
code |= sabotage.prove({ file: "memory.js", command: CMD, cases: [
  { label: "the key set collapses to the legacy store: a visited sub-location names no place again (#464)",
    mustFail: "#464 a visited sub-location is missing from VISITED",
    find: UNION, replace: "" },
  { label: "the key set collapses to the legacy store: a world node minted without fileLocation names no place again (#464)",
    mustFail: "#464 a visited world node outside the legacy store names no place",
    find: UNION, replace: "" },
  { label: "the unvisited sub-location omission is dropped: every pre-minted house and commons lists under KNOWN OF (#464)",
    mustFail: "#464 an unvisited sub-location was listed in the global TOC",
    find: "      if(_vn&&!(_vn.visits>0)&&_vn.parent)continue;", replace: "" },
  { label: "the resolved-key dedupe is dropped: a merged duplicate present in both stores lists its canonical twice (#464)",
    mustFail: "#464 the merged canonical is listed",
    find: "      if(_locSeen[_lkR])continue;_locSeen[_lkR]=1;", replace: "      _locSeen[_lkR]=1;" },
  { label: "the P9 legacy rule is broken: a key with no map node (a pre-map save) leaves VISITED for KNOWN OF (#464 keeps P9)",
    mustFail: "legacy no-node location dropped from VISITED",
    find: "      if(_vn&&!(_vn.visits>0))_known.push(_lkD);else _vis.push(_lkD);", replace: "      if(!(_vn&&_vn.visits>0))_known.push(_lkD);else _vis.push(_lkD);" },
  { label: "the sub-location cap is removed: every visited sub-location rides every GM turn again (#464 cap)",
    mustFail: "#464 the sub cap did not fold to 30 on the GM turn",
    find: "    if(_subs.length>_subCap){", replace: "    if(false){" },
  { label: "the cap keeps the OLDEST visited sub-locations instead of the most recent (#464 cap)",
    mustFail: "#464 the cap kept an older place over a newer one",
    find: "return (b.r-a.r)||(a.i-b.i);", replace: "return (a.r-b.r)||(a.i-b.i);" },
  { label: "the cap also applies to the bare memoryTOC() call: Table Talk loses the full list (#464 cap)",
    mustFail: "#464 the bare memoryTOC() (Table Talk) was capped",
    find: "_subCap=opts?TOC_SUB_CAP:Infinity", replace: "_subCap=TOC_SUB_CAP" },
  { label: "the folded count is always plural: one folded place reads '+1 more visited places' (#464 cap)",
    mustFail: "#464 a single folded place is not counted in the singular",
    find: "\" more visited place\"+(_subFold===1?\"\":\"s\")", replace: "\" more visited places\"" },
  { label: "a sub-location's place reads its KEY prefix again, not its parent pointer — a re-pointed room lists under the road it was first named from, a merged world's dead name is served (#464 parent chain, 2026-10-13)",
    mustFail: "#464 a sub-location's place derives from its PARENT pointer, not its key",
    find: "      var _lkD=tocPlacePath(_lkR);", replace: "      var _lkP=_lkR.lastIndexOf(\"|\"),_lkLeaf=(typeof locDisplayLeaf===\"function\")?locDisplayLeaf(_lkR):(_lkP<0?_lkR:_lkR.slice(_lkP+1));var _lkD=_lkP<0?_lkLeaf:_lkR.slice(0,_lkP).split(\"|\").join(\" — \")+\" — \"+_lkLeaf;" },
  { label: "the parent chain stops resolving its hops — a tombstoned parent pointer names the place under the dead world again (#464 parent chain; the #269③ dead-name guard lives here now)",
    mustFail: "#464 a tombstoned parent pointer must resolve before it names the place",
    find: "    var r=String((typeof locResolve===\"function\")?locResolve(cur):cur);", replace: "    var r=String(cur);" }
]});
process.exit(code ? 1 : 0);
