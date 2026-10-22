// dev/sabotage-656-tt-welcome.js — proves the #656 guards (the Table Talk welcome line): the text's name and its
// no-name fallback, the markup strip, the empty pane, the :empty::before rule and syncUI's paint must each turn the
// #656 section red.
//   node dev/sabotage-656-tt-welcome.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#656"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the welcome loses the hero's name",
    find: 'return n?n+" has joined table talk":"You have joined table talk";', replace: 'return "You have joined table talk";',
    mustFail: "named:" },
  { label: "a nameless hero reads 'has joined'",
    find: ':"You have joined table talk";}', replace: ':" has joined table talk";}',
    mustFail: "no name:" },
  { label: "markup in the name survives",
    find: '.replace(/<[^>]*>/g,"").trim();return n?', replace: '.trim();return n?',
    mustFail: "markup must not survive" }
]);
prove("index.html", [
  { label: "the pane is born with whitespace, so :empty never matches",
    find: '<div id="story-tabletalk" style="display:none"></div>', replace: '<div id="story-tabletalk" style="display:none"> </div>',
    mustFail: "the pane must be an empty element" },
  { label: "the welcome rule goes",
    find: "#story-tabletalk:empty::before{content:attr(data-welcome);", replace: "#story-tabletalk:empty::after{content:attr(data-welcome);",
    mustFail: "the welcome must be the :empty::before" }
]);
prove("ui-panels.js", [
  { label: "syncUI stops painting the welcome",
    find: '_tt.setAttribute("data-welcome",tableTalkWelcome(worldState.character));', replace: "0;",
    mustFail: "syncUI must paint data-welcome" }
]);
process.exit(code);
