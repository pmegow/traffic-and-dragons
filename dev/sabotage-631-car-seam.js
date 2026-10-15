// dev/sabotage-631-car-seam.js — proves the #631 Car Mode SEAM guards guard. The seam is a promise that three files
// (car-commands.js, car-session.js, audio-session.js) name nothing outside themselves and the platform, that the loop's
// requirement (CAR_HOST_ROWS) and the game's adapter (CAR_HOST) agree row for row, that the vocabulary is a table the
// host hands in, and that the load order keeps each portable file ahead of its consumer. Each clause plants the exact
// leak the seam exists to refuse; dev/tests-631-car-seam.js must then FAIL. A mutation changing no bytes is a hard failure.
//   node dev/sabotage-631-car-seam.js
var sabotage = require("./sabotage.js");
var SEAM = ["node", ["dev/tests-631-car-seam.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "car-session.js", command: SEAM, cases: [
  { label: "the loop reads the game's busy flag directly instead of the host row",
    find: "function _carBusy()  { return !!(_carHost && _carHost.busy()); }",
    replace: "function _carBusy()  { return typeof busy !== \"undefined\" && !!busy; }",
    mustFail: "reaches outside the seam: busy" },
  { label: "the loop retries through the game's retryLast instead of the host row",
    find: "    _carHost.retry();\n",
    replace: "    if (typeof retryLast === \"function\") retryLast();\n",
    mustFail: "reaches outside the seam: retryLast" },
  { label: "a row the loop reads is dropped from the declared requirement",
    find: "  { name: \"retry\",         why: \"() retry the failed turn (after carNotify('error', …) armed the tap)\" },\n",
    replace: "",
    mustFail: "never declared: retry" },
  { label: "the host validator stops refusing an incomplete host",
    find: "  if (missing.length) throw new Error(\"car-session: the host lacks \"",
    replace: "  if (false) throw new Error(\"car-session: the host lacks \"",
    mustFail: "an empty host must be refused by row name" }
]});

rc |= sabotage.prove({ file: "audio-session.js", command: SEAM, cases: [
  { label: "the handoff peeks at worldState",
    find: "      var prev = navigator.audioSession.type;\n",
    replace: "      var prev = navigator.audioSession.type; if (typeof worldState !== \"undefined\" && worldState) prev = \"auto\";\n",
    mustFail: "reaches outside the seam: worldState" }
]});

rc |= sabotage.prove({ file: "car-commands.js", command: SEAM, cases: [
  { label: "the grammar toasts through the game's showToast",
    find: "  var i, j, entry;\n  for (i = 0; i < table.length; i++) {",
    replace: "  var i, j, entry; if (typeof showToast === \"function\") showToast(\"?\");\n  for (i = 0; i < table.length; i++) {",
    mustFail: "reaches outside the seam: showToast" },
  { label: "a missing table silently falls back to the base vocabulary",
    find: "  if (!table || typeof table.length !== \"number\") throw new Error(",
    replace: "  if (!table) table = CAR_COMMANDS_BASE; if (false) throw new Error(",
    mustFail: "a missing table is refused loudly" }
]});

rc |= sabotage.prove({ file: "ui-carmode.js", command: SEAM, cases: [
  { label: "the game's host drops a row the loop requires",
    find: "  retry: function() { if (typeof retryLast === \"function\") retryLast(); },\n",
    replace: "",
    mustFail: "rows vs keys" }
]});

rc |= sabotage.prove({ file: "game.js", command: SEAM, cases: [
  { label: "the game's table copies a base entry instead of reusing it (two pause grammars to keep in step)",
    find: "  CAR_CMD_PAUSE,\n  CAR_CMD_RESUME,\n",
    replace: "  { kind: \"pause\", say: [ /^(?:gm )?pause$/ ] },\n  CAR_CMD_RESUME,\n",
    mustFail: "must reuse the base ENTRY pause" }
]});

rc |= sabotage.prove({ file: "index.html", command: SEAM, cases: [
  { label: "the loop loads after the host that installs itself into it",
    find: "<script src=\"car-session.js\"></script>\n<script src=\"ui-carmode.js\"></script>",
    replace: "<script src=\"ui-carmode.js\"></script>\n<script src=\"car-session.js\"></script>",
    mustFail: "car-session.js must load before ui-carmode.js" }
]});

rc |= sabotage.prove({ file: "sw.js", command: SEAM, cases: [
  { label: "the app shell forgets a portable file (served network-only, offline Car Mode breaks)",
    find: "  \"/audio-session.js\",\n",
    replace: "",
    mustFail: "is missing from sw.js APP_SHELL" }
]});

process.exit(rc);
