// Probe 18: what is FILED (the permanent defining moment) and what is SHOWN for record sentences that end in a quote, bracket or parenthesis,
// a truncated record, and the unspaced dash. Through the real fileDenouement. usage: [ER=<tree>] node p18_recordtext.js
require("./h.js");
var P = "You walk out of the palace.\n\nYou learned to stay.";
var cases = [
  ["ends in a quoted word, US punctuation (curly)", "RECORD: Ammut never learned to say “enough.”"],
  ["ends in a quoted word, US punctuation (straight)", "RECORD: Ammut never learned to say \"enough.\""],
  ["ends in a quoted word, no full stop", "RECORD: Ammut learned the word “stay”"],
  ["whole sentence in quotes after the label", "RECORD: “Ammut learned to stay when leaving was easier.”"],
  ["ends in a parenthesis", "RECORD: Ammut learned to stay (and hated it)"],
  ["ends in a bracket", "RECORD: Ammut kept the oath [as sworn]"],
  ["ends in a possessive plural", "RECORD: Ammut gave the house back to the Reeds’"],
  ["sentence in single quotes", "RECORD: 'Ammut learned to stay.'"],
  ["cut off mid-sentence (token limit)", "RECORD: Ammut learned to"],
  ["cut off after a comma", "RECORD: Ammut learned to stay, and"],
  ["unspaced em dash", "RECORD—Ammut learned to stay."],
  ["unspaced en dash", "RECORD–Ammut learned to stay."],
  ["spaced em dash", "RECORD — Ammut learned to stay."],
  ["two sentences on the line", "RECORD: Ammut learned to stay. He never said why."],
  ["italic sentence", "RECORD: *Ammut learned to stay.*"],
  ["italic name inside", "RECORD: *Ammut* learned to stay."]
];
cases.forEach(function (c) {
  makeWorld(); var ch = worldState.character; ch.name = "Ammut"; ch.coreMemories = []; worldState.turn = 89; worldState.transcript = []; memory.chapters = []; worldState.ended = { turn: 89, cause: "the tale is told" };
  var shown = quiet(function () { return fileDenouement(P + "\n" + c[1]); }).r;
  var e = ch.coreMemories.filter(function (m) { return m.kind === "ending"; }).map(function (m) { return m.text; });
  console.log(c[0] + "\n   line:  " + JSON.stringify(c[1]) + "\n   filed: " + JSON.stringify(e[0]) + "\n   shown has the line: " + /RECORD/.test(shown));
});
