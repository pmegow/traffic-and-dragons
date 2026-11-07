// dev/sabotage-684-atlas-adopt.js — proves the #702 guards guard: You are here. A place the GM names that the map lacks is ADDED to the map
// (atlasAdopt — a village, an establishment or feature by its name's kind, a room, a chamber; [MAP_PLACE:] says where; the tap removes
// an addition) — and the fingerprint scheme (2: the drawing without its params echo; an old record read under its own). Each clause
// plants one regression in atlas.js or tag_table.js; the named test must then FAIL. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas-adopt.js
// One of the five atlas batteries (dev/sabotage-684-atlas*.js — the core, -rooms, -adopt, -pane, -doors): each a subject, so a change
// to any of their targets schedules them through run-sabotage-diff and battery-pool runs them side by side. Every ENGINE group carries
// `only: "FAIL #684 "` — a clause runs its own named test through the suite's --only filter (sabotage.js), not the 13 s file.
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/tests-684-atlas-engine.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, only: "FAIL #684 ", cases: [
  /* the fingerprint scheme */
  { label: "the fingerprint hashes the params echo again: a library's new default reads as a redraw of every realm",
    find: "    if(this===doc&&(k===\"stats\"||k.charAt(0)===\"_\"||(sch>=2&&k===\"params\")))return undefined;",
    replace: "    if(this===doc&&(k===\"stats\"||k.charAt(0)===\"_\"))return undefined;",
    mustFail: "FAIL #684 a newer library that draws the SAME sheet is not a redraw" },
  { label: "an old record is read under the new scheme, never its own",
    find: "  sch=rec.fpv||1;",
    replace: "  sch=ATLAS_FP_SCHEME;",
    mustFail: "FAIL #684 a newer library that draws the SAME sheet is not a redraw" },
  { label: "an old record's hash is reproduced with today's params echo, not the recipe's: the realm reads as redrawn",
    find: "(sch===1&&rec.params)?rec.params:undefined",
    replace: "undefined",
    mustFail: "FAIL #684 a newer library that draws the SAME sheet is not a redraw" },
  /* You are here */
  { label: "a place the map lacks stays off it: nothing is ever added",
    find: "    while(A.off&&A.off.absent&&A.adopt!==false&&guard++<3&&atlasAdopt(A,p,entered))atlasResolvePointer(A,p,prev,entered);",
    replace: "    ",
    mustFail: "FAIL #684 You are here: a world place" },
  { label: "a twice-borne name is added as a new place (a sheet with two zones of one title gains a third place of that name)",
    find: "absent:!!(s.absent&&!(child&&child.many)),zone:home,segment:p.sub};",
    replace: "absent:true,zone:home,segment:p.sub};",
    mustFail: "FAIL #684 #693 a failure while asking the map is reported once" },
  { label: "the same story place is added again every time it is not found",
    find: "  if(A.adds[storyKey]){A.off.why+=\" (it was added to the map once already and has not been found since)\";return false;}",
    replace: "  ",
    mustFail: "FAIL #684 You are here: a world place" },
  { label: "the GM's declaration is ignored: every addition lands beside the party",
    find: "    doc=atlasDoc(zone);decl=atlasDeclFor(A,name,told);",
    replace: "    doc=atlasDoc(zone);decl=null;",
    mustFail: "FAIL #684 You are here: the GM says where" },
  { label: "the player's tie yields to the GM's 'at' (a declaration on a placed place is never answered)",
    find: "    if(tie){thing=tie.id!=null?atlasThingById(atlasDoc(tie.zone),tie.id):null;atlasTell(A,\"The player placed \"",
    replace: "    if(false){thing=tie.id!=null?atlasThingById(atlasDoc(tie.zone),tie.id):null;atlasTell(A,\"The player placed \"",
    mustFail: "FAIL #684 You are here: the GM says where" },
  { label: "an addition is not re-stamped: the game's own edit reads as a redraw",
    find: "      rec.params.edits=before.concat([JSON.parse(JSON.stringify(e))]);rec.fp=null;",
    replace: "      rec.params.edits=before.concat([JSON.parse(JSON.stringify(e))]);",
    mustFail: "FAIL #684 You are here: a world place" },
  { label: "the player's tap keeps the engine's addition on the map",
    find: "  atlasAddRemove(A,pv.level===\"sub\"?atlasSubKey(p):atlasWorldKey(p));",
    replace: "  ",
    mustFail: "FAIL #684 You are here: a chamber the story names" },
  { label: "the kind table is skipped: every town-level addition is a feature of the story's own",
    find: "  if(hit&&Object.prototype.hasOwnProperty.call(cat,hit)&&hit!==\"sewer\")return {kind:hit};",
    replace: "  ",
    mustFail: "FAIL #684 You are here: a town-level place" }
] });

rc |= sabotage.prove({ file: "tag_table.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "the GM's declaration of where a place belongs is not recorded",
    find: "worldState.placeDecls.push({name:mpm[1].trim(),where:mpm[2].trim(),turn:R.turn});",
    replace: "",
    mustFail: "FAIL #684 You are here: the GM says where" }
] });

process.exit(rc);
