// dev/sabotage-647-click-settle.js — proves the #647 guard guards: a click through dev/cdp-browser.js waits for the
// document's stylesheets (@imports included) to apply before it measures the element. The driver's own --check carries
// two late-@import pages; the body-link shape is the one only the sheet check holds (its animation frames run before
// the sheet lands), so every clause must fail THERE, by that message. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-647-click-settle.js
var sabotage = require("./sabotage.js");
var CHECK = ["node", ["dev/cdp-browser.js", "--check"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/cdp-browser.js", command: CHECK, cases: [
  { label: "the click measures the element without waiting for the stylesheets (the #615 / #501 flake restored)",
    find: "      await this.page._eval(\"(\" + SETTLED + \")()\");\n",
    replace: "",
    mustFail: "[body shape] the click reached the button" },
  { label: "a parsed-but-unapplied link sheet counts as applied (its pending @import is invisible to the settle)",
    find: "if(Array.prototype.indexOf.call(document.styleSheets,l.sheet)<0)return false;",
    replace: "",
    mustFail: "[body shape] the click reached the button" },
  { label: "a pending @import inside an applied sheet no longer holds the settle (the inline <style> import)",
    find: "var r=rules[k];if(r.type!==3)continue;",
    replace: "var r=rules[k];if(r.type!==3||true)continue;",
    mustFail: "[style shape] the click reached the button" },
  { label: "the settle gives up at once (the 3 s patience is zero)",
    find: "Date.now()-t0>3000",
    replace: "Date.now()-t0>=0",
    mustFail: "[body shape] the click reached the button" }
] });

process.exit(rc);
