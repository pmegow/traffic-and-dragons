// dev/sabotage-760-creature-names.js — proves the #760 guards (the bestiary block tells the GM to start a listed creature
// under its own name, and only where a bestiary is shown) and the #761 guards (the wizard's Import character button).
// Each clause runs its own test through --only.
//   node dev/sabotage-760-creature-names.js
var sabotage = require("./sabotage.js");
var P = "FAIL #760 ", CMD = ["node", ["dev/tests-760-creature-names.js"]];
var T1 = P + "a campaign with a bestiary tells the GM to start a listed creature under its own name",
  T2 = P + "no bestiary, or none the story has opened, carries no naming rule",
  T3 = P + "the wizard has an Import character button left of File, wired to the character browser";
var api = [
  { label: "the header drops the naming rule", find: 'as usual. "+BESTIARY_NAME_RULE];', replace: 'as usual:"];', mustFail: T1 },
  { label: "the rule no longer says the singular", find: "EXACTLY as written below, in the singular, even when there are several", replace: "EXACTLY as written below", mustFail: T1 },
  { label: "the rule no longer asks for the headcount tag", find: " with [COMBAT_GROUP:N] for how many", replace: "", mustFail: T1 },
  { label: "the rule no longer forbids an invented collective", find: "a paraphrase or an invented collective for a listed creature", replace: "or a paraphrase of a listed creature", mustFail: T1 },
  { label: "a bestiary with every creature withheld still prints the header and the rule", find: "if(_bls.length>1)bestiaryBlock=", replace: "if(_bls.length>0)bestiaryBlock=", mustFail: T2 }
];
var boot = [
  { label: "the button opens nothing", find: 'if(_ict)_ict.addEventListener("click",showCharacterBrowser);', replace: 'if(_ict)_ict.addEventListener("click",function(){});', mustFail: T3 }
];
var page = [
  { label: "the button is gone from the wizard", find: '<button class="ib" id="cs-import-char-top" title="Bring a saved character into this campaign">Import character</button>', replace: "", mustFail: T3 },
  { label: "the button sits right of File", find: 'id="cs-file-btn" title="Load a saved campaign or import a character">File &#9660;</button>', replace: 'id="cs-file-btn" title="Load a saved campaign or import a character">File &#9660;</button><button class="ib" id="cs-import-char-top">Import character</button>', mustFail: T3 }
];
var failed = sabotage.prove({ file: "api.js", command: CMD, only: P, cases: api });
if (!failed) failed = sabotage.prove({ file: "ui-boot.js", command: CMD, only: P, cases: boot });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
process.exit(failed ? 1 : 0);
