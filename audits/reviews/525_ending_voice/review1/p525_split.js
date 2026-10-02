require("./h.js");
var NL = "\n";
var P = "You walk out of the palace and the rain feels like a joke at your expense." + NL + NL + "You learned to stay.";
var cases = [
  ["plain", P + NL + "RECORD: Ammut learned to stay."],
  ["no record", P],
  ["record mid-text, prose after", "You walk out." + NL + "RECORD: Ammut learned to stay." + NL + NL + "The rain goes on without you."],
  ["bold whole line", P + NL + "**RECORD: Ammut learned to stay.**"],
  ["bold label", P + NL + "**RECORD:** Ammut learned to stay."],
  ["italic underscore", P + NL + "_RECORD: Ammut learned to stay._"],
  ["double-quoted line", P + NL + "\"RECORD: Ammut learned to stay.\""],
  ["curly-quoted line", P + NL + "“RECORD: Ammut learned to stay.”"],
  ["quoted sentence", P + NL + "RECORD: \"Ammut learned to stay.\""],
  ["bracket tag", P + NL + "[RECORD: Ammut learned to stay.]"],
  ["list dash", P + NL + "- RECORD: Ammut learned to stay."],
  ["heading", P + NL + "## RECORD: Ammut learned to stay."],
  ["blockquote", P + NL + "> RECORD: Ammut learned to stay."],
  ["twice", P + NL + "RECORD: Ammut learned to stay." + NL + "RECORD: Ammut never looked back."],
  ["lowercase", P + NL + "record: Ammut learned to stay."],
  ["Title case", P + NL + "Record: Ammut learned to stay."],
  ["colon inside", P + NL + "RECORD: Ammut learned one thing: to stay."],
  ["only line", "RECORD: Ammut learned to stay."],
  ["only line, bold", "**RECORD:** Ammut learned to stay."],
  ["trailing blanks + CRLF", "You walk out.\r\n\r\nYou learned to stay.\r\nRECORD: Ammut learned to stay.\r\n\r\n   \r\n"],
  ["label then newline", P + NL + "RECORD:" + NL + "Ammut learned to stay."],
  ["label then blank then sentence", P + NL + NL + "RECORD:" + NL + NL + "Ammut learned to stay."],
  ["rule before record", P + NL + NL + "---" + NL + NL + "RECORD: Ammut learned to stay."],
  ["rule after record", P + NL + "RECORD: Ammut learned to stay." + NL + NL + "---"],
  ["word count after", P + NL + "RECORD: Ammut learned to stay." + NL + NL + "(412 words)"],
  ["same line as prose", "You walk out. You learned to stay. RECORD: Ammut learned to stay."],
  ["THE RECORD label", P + NL + "THE RECORD: Ammut learned to stay."],
  ["Record line label", P + NL + "RECORD LINE: Ammut learned to stay."],
  ["em dash", P + NL + "RECORD — Ammut learned to stay."],
  ["hyphen no space", P + NL + "RECORD-Ammut learned to stay."],
  ["empty record", P + NL + "RECORD:"],
  ["empty record w/ spaces", P + NL + "RECORD:   "],
  ["record of stars only", P + NL + "RECORD: **"],
  // prose that legitimately contains "record"
  ["prose: last para starts Record-breaking", "You walk out." + NL + NL + "Record-breaking rains fell that spring, and you were not there to see them."],
  ["prose: last para starts Record-keepers", "You walk out." + NL + NL + "Record-keepers in the capital wrote it down wrong, as they always do. You never corrected them."],
  ["prose: last para starts 'Record - '", "You walk out." + NL + NL + "Record - that is all they wanted from you. A line in a book."],
  ["prose: last para 'Record: one dragon'", "You walk out." + NL + NL + "Record: one dragon, slain. Regret: none."],
  ["prose: mid 'record:'", "You broke the record: nobody had crossed the fen alive." + NL + NL + "You walk out."],
  ["prose: Records plural", "You walk out." + NL + NL + "Records: none survive."],
  ["prose: Recorded", "You walk out." + NL + NL + "Recorded: nothing."],
  ["fullwidth colon", P + NL + "RECORD： Ammut learned to stay."],
  ["nbsp after colon", P + NL + "RECORD: Ammut learned to stay."],
  ["trailing period+space+stars", P + NL + "**RECORD**: *Ammut learned to stay.*  "],
  ["html-ish", P + NL + "<b>RECORD:</b> Ammut learned to stay."],
  ["tab indent", P + NL + "\tRECORD: Ammut learned to stay."],
  ["u2028 separator", P + " RECORD: Ammut learned to stay."],
  ["\\r only", P + "\rRECORD: Ammut learned to stay."],
  ["null", null], ["undefined", undefined], ["number", 42], ["empty", ""]
];
cases.forEach(function (c) {
  var r = denouementSplit(c[1]);
  console.log("== " + c[0] + "\n   prose : " + J(r.prose) + "\n   record: " + J(r.record) + (/record/i.test(r.prose) ? "   <-- 'record' still in prose" : ""));
});
