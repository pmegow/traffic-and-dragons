// sabotage-673-menu-fit.js — mutation proof for the #673 menu-fit rule (dev/tests-673-menu-fit.js, Chrome-driven).
// Each clause removes one load-bearing piece — the sit-up itself, the drawer toggle's call — and the suite must red on it,
// attributably. A mutation that changes no bytes is a HARD failure of this harness.
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-673-menu-fit.js"]];
var rc = 0;

rc |= sabotage.prove({
  file: "ui-shell.js",
  command: CMD,
  also: ["ui-boot.js", "dev/tests-673-menu-fit.js"],
  cases: [
    {
      label: "menuFit never sits a menu up (an overflowing phone menu keeps its top and loses its tail)",
      mustFail: "was not sat up",
      find: '  if(shift>0)el.style.transform="translateY(-"+Math.round(shift)+"px)";',
      replace: '  if(false)el.style.transform="translateY(-"+Math.round(shift)+"px)";'
    },
    {
      label: "menuFit sits a menu up past the top edge (the head of the menu leaves the screen)",
      mustFail: "yet not sat up to the top edge",
      find: "  var shift=Math.min(over,Math.max(0,r.top));",
      replace: "  var shift=over;"
    }
  ]
});
rc |= sabotage.prove({
  file: "ui-boot.js",
  command: CMD,
  also: ["ui-shell.js", "dev/tests-673-menu-fit.js"],
  cases: [
    {
      label: "the drawer toggle no longer re-fits the menu (a drawer grows the phone menu past the bottom unnoticed)",
      mustFail: "was not sat up",
      find: '        if(typeof menuFit==="function"){if(!open&&getComputedStyle(sub).position==="absolute")menuFit(sub);else{var fm=document.getElementById(m.menu);if(fm)menuFit(fm);}}',
      replace: '        if(false){if(!open&&getComputedStyle(sub).position==="absolute")menuFit(sub);else{var fm=document.getElementById(m.menu);if(fm)menuFit(fm);}}'
    }
  ]
});
process.exit(rc);
