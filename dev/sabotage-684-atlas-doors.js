// dev/sabotage-684-atlas-doors.js — proves the opt-in's guards guard, in a real browser (dev/tests-684-atlas-browser.js ⑩): the Begin
// switch is off by default at both doors, each door hands startGame its OWN switch, the switch is consumed, a kind without a drawn map
// begins without one, a realm that fails to draw is said and leaves no half atlas. Each clause plants one regression in game.js, index.html,
// char-creation.js or ui-browsers.js; the named check must then FAIL. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas-doors.js
// One of the five atlas batteries (dev/sabotage-684-atlas*.js — the core, -rooms, -adopt, -pane, -doors): each a subject, so a change
// to any of their targets schedules them through run-sabotage-diff and battery-pool runs them side by side. Every ENGINE group carries
// `only: "FAIL #684 "` — a clause runs its own named test through the suite's --only filter (sabotage.js), not the 13 s file.
var sabotage = require("./sabotage.js");
var BROWSER = ["node", ["dev/tests-684-atlas-browser.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "the Begin switch is not consumed: it maps the next campaign too",
    find: "  var _wantAtlas=!!pendingAtlas;pendingAtlas=false;",
    replace: "  var _wantAtlas=!!pendingAtlas;",
    mustFail: "FAIL ⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "index.html", command: BROWSER, cases: [
  { label: "the Begin switch is on by default: every new campaign is mapped",
    find: "<input type=\"checkbox\" id=\"rv-atlas\"/>",
    replace: "<input type=\"checkbox\" id=\"rv-atlas\" checked/>",
    mustFail: "FAIL ⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "char-creation.js", command: BROWSER, cases: [
  { label: "the Review step's switch never reaches startGame",
    find: "var _atlasEl=document.getElementById(\"rv-atlas\");pendingAtlas=!!(_atlasEl&&_atlasEl.checked);",
    replace: "var _atlasEl=null;",
    mustFail: "FAIL ⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "ui-browsers.js", command: BROWSER, cases: [
  { label: "the setup modal's switch never reaches startGame",
    find: "    pendingAtlas=!!document.getElementById(\"is-atlas\").checked;",
    replace: "    ",
    mustFail: "FAIL ⑩ the opt-in" },
  { label: "the quick start keeps a switch an abandoned Review step left on",
    find: "  pendingAtlas=false;/* #684: the quick start has no",
    replace: "  /* #684: the quick start has no",
    mustFail: "FAIL ⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "a village is begun with a drawn map (the kind's flag ignored)",
    find: "    if(!kindDef().atlas)showToast(",
    replace: "    if(false)showToast(",
    mustFail: "FAIL ⑩ the opt-in" },
  { label: "a realm that fails to draw is swallowed: no toast, a half atlas left behind",
    find: "}catch(_ae){delete worldState.atlas;atlasProblem(\"drawing the realm\",_ae);}",
    replace: "}catch(_ae){}",
    mustFail: "FAIL ⑩ the opt-in" }
] });

process.exit(rc);
