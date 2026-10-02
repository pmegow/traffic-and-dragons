// Probe 4: denouementSplit performance / termination.
require("./h.js");
function rep(s, n) { return new Array(n + 1).join(s); }
function time(label, text) {
  var t0 = process.hrtime.bigint();
  var r = denouementSplit(text);
  var ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(label + ": " + ms.toFixed(1) + " ms  (prose " + r.prose.length + " chars, record " + r.record.length + " chars)");
  return ms;
}
var N = 100000;
time("100k prose lines + RECORD", rep("You walked.\n", N) + "RECORD: Ammut stayed.");
time("100k RECORD lines", rep("RECORD: Ammut stayed.\n", N));
time("100k label-alone lines", rep("RECORD:\n", N));
time("100k blank lines between label and sentence", "Prose.\nRECORD:\n" + rep("\n", N) + "Ammut stayed.");
time("100k rule lines after RECORD", "Prose.\nRECORD: Ammut stayed.\n" + rep("---\n", N));
time("100k x (label + blank + BOM line)", rep("RECORD:\n\n\uFEFF\n", N));
time("100k x (label + sentence)", rep("RECORD:\nAmmut stayed.\n", N));
time("100k x (prose + label-alone)", rep("Prose.\nRECORD:\n", N) + "Ammut stayed.");
time("100k blank lines then prose line w/o label above", rep("\n", N) + "Prose only.");
time("prose, 100k blanks, prose (j-scan once)", "A.\n" + rep("\n", N) + "B.");
// single-line regex stress
[2000, 4000, 8000, 16000, 32000].forEach(function (n) {
  time("one RECORD line: 'RECORD: a' + " + n + " spaces + 'b'", "Prose.\nRECORD: a" + rep(" ", n) + "b");
});
[2000, 4000, 8000, 16000, 32000].forEach(function (n) {
  time("one RECORD line: 'RECORD: a' + " + n + " x '\" ' + 'b'", "Prose.\nRECORD: a" + rep("\" ", n) + "b");
});
[2000, 4000, 8000, 16000].forEach(function (n) {
  time("one RECORD line: sentence of " + n + " words (single spaces)", "Prose.\nRECORD: " + rep("word ", n) + "end.");
});
[2000, 8000, 32000].forEach(function (n) {
  time("last PROSE line (no label): " + n + " leading spaces + text", "Prose.\n" + rep(" ", n) + "text here");
});
[2000, 8000, 32000].forEach(function (n) {
  time("last line: 'record' + " + n + " spaces, no colon", "Prose.\nrecord" + rep(" ", n) + "x");
});
