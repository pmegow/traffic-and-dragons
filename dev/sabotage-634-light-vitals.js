// dev/sabotage-634-light-vitals.js — proves the light-mode vital readout is guarded (#634, owner 2026-10-16: "the 1/2 value text is
// MUCH more appealing"). The readout's colour must ride the theme's saturation/lightness variables with the dark defaults inline,
// and the light blocks of index.html and website/themes.css must halve the value; each is mutated back toward the pale-on-parchment
// failure. The battery's command is the engine section that holds the #352 readout tests.
//   node dev/sabotage-634-light-vitals.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "class bible (#72)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var LIGHT = "#634 light-mode vitals";
prove("helpers.js", [
  { label: "the live colour hard-codes S60/L58 again (light mode gets the pale readout back)",
    find: "\"hsl(\"+hue+\",var(--vital-s,60%),var(--vital-l,58%))\"", replace: "\"hsl(\"+hue+\",60%,58%)\"",
    mustFail: LIGHT },
  { label: "the still colour hard-codes S25/L45 again",
    find: "\"hsl(\"+ramp.to+\",var(--vital-still-s,25%),var(--vital-still-l,45%))\"", replace: "\"hsl(\"+ramp.to+\",25%,45%)\"",
    mustFail: LIGHT }
]);
prove("index.html", [
  { label: "the light block loses the halved lightness (the variable falls back to the dark default) — the THEME PALETTE CONTRACT is the first guard, since themes.css still themes the token",
    find: "  --vital-s:43%;--vital-l:29%;--vital-still-s:25%;--vital-still-l:22%;\n", replace: "",
    mustFail: "THEME PALETTE CONTRACT" },
  { label: "#640 the light block loses the bronze gold (the pale dark-palette gold returns on parchment) — the THEME PALETTE CONTRACT is the first guard",
    find: "  --gold:#7d4100;/* #640: the owner's bronze for the coin readouts on parchment (sampled from the reference of 2026-10-16) */\n", replace: "",
    mustFail: "THEME PALETTE CONTRACT" }
]);
process.exit(code);
