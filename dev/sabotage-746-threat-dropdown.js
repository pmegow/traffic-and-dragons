// #746: prove the creature card uses the registered threat levels without rewriting existing choices.
// Chrome discovery and loud skips share dev/cdp-browser.js with the rendered browser proof.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome();
var cases=[
  {
    "label": "the card falls back to the old free-text threat field",
    "find": "fld(\"Threat\",creatureChoiceField(\"threat\",i,C))",
    "replace": "fld(\"Threat\",txt(\"creature\",i,0,\"threat\",C.threat||\"\",\"\"))",
    "mustFail": "#746 Threat is a dropdown on the creature card"
  },
  {
    "label": "the card drops the final registered threat level",
    "find": ".concat(f.values);if(values.indexOf(value)<0)values.push(value);",
    "replace": ".concat(f.values.slice(0,-1));if(values.indexOf(value)<0)values.push(value);",
    "mustFail": "#746 card offers the five shared threat levels"
  },
  {
    "label": "an existing custom threat disappears from the choices",
    "find": "if(values.indexOf(value)<0)values.push(value);",
    "replace": "",
    "mustFail": "#746 legacy custom threat stays selected"
  },
  {
    "label": "an unspecified threat displays the first threat level",
    "find": "value=c[key]||f.default||\"\",values=",
    "replace": "value=c[key]||f.default||f.values[0],values=",
    "mustFail": "#746 a blank threat stays unspecified"
  }
];
var failed=sabotage.prove({file:'blueprint-designer.html',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:cases});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-746-threat-dropdown.js',cases.length,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
