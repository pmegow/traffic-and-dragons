// Probe 14: denouementSplit fuzz — termination, no throw, invariants.
require("./h.js");
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rnd = mulberry32(0xBADC0DE);
function ri(n) { return Math.floor(rnd() * n); }
function pick(a) { return a[ri(a.length)]; }
var FR = ["RECORD", "Record", "record", "THE RECORD", "The record", ":", " : ", " — ", " - ", "—", "-", " ", "  ", "\t", "\r", "*", "**", "_", "`", "```", ">", "#", "[", "]", "(", ")", "\"", "'", "“", "”", "‘", "’", "•", "---", "***", "…", "Ammut learned to stay.", "You walked out.", "keepers", "-keepers in the capital", "x", "7", "﻿", "　", " ", "🔥", "דוד", "太郎", "."];
if (process.env.NOWS) FR = FR.filter(function (f) { return f !== "﻿" && f !== "　"; });
var N = 200000, i, worst = 0, bad = 0, shown = 0;
for (i = 0; i < N; i++) {
  var lines = [], nl = ri(8), k;
  for (k = 0; k < nl; k++) { var parts = [], np = ri(6), p; for (p = 0; p < np; p++) parts.push(pick(FR)); lines.push(parts.join("")); }
  var text = lines.join(rnd() < 0.15 ? "\r\n" : "\n");
  var t0 = Date.now(), r;
  try { r = denouementSplit(text); } catch (e) { bad++; if (shown++ < 10) console.log("THREW " + e.message + " on " + JSON.stringify(text)); continue; }
  var ms = Date.now() - t0; if (ms > worst) worst = ms;
  if (typeof r.prose !== "string" || typeof r.record !== "string") { bad++; if (shown++ < 10) console.log("NON-STRING " + JSON.stringify(text)); continue; }
  // I1: the prose's last line is never a RECORD line
  var pl = r.prose.split("\n"), last = pl[pl.length - 1];
  if (r.prose && DENOUEMENT_RECORD_RE.test(last)) { bad++; if (shown++ < 10) console.log("I1 last prose line is a RECORD line: " + JSON.stringify(text) + " -> " + JSON.stringify(r)); }
  // I2: every prose line is a line of the input, in order (nothing invented)
  var src = text.split("\n"), si = 0, ok = true;
  r.prose.split("\n").forEach(function (l, li) { if (!r.prose) return; var f = -1, x; for (x = si; x < src.length; x++) { if (src[x] === l || src[x].trim() === l.trim()) { f = x; break; } } if (f < 0) ok = false; else si = f + 1; });
  if (!ok) { bad++; if (shown++ < 10) console.log("I2 prose line not in input: " + JSON.stringify(text) + " -> " + JSON.stringify(r)); }
  // I3: a record is never non-empty while the reply holds no line matching the RE
  if (r.record && !src.some(function (l) { return DENOUEMENT_RECORD_RE.test(l); })) { bad++; if (shown++ < 10) console.log("I3 record without a label line: " + JSON.stringify(text) + " -> " + JSON.stringify(r)); }
}
console.log("denouementSplit fuzz: " + N + " inputs, violations: " + bad + ", slowest single call: " + worst + " ms");
