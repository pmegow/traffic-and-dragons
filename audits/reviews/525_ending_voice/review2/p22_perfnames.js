// Probe 22: endingMomentText / textHasWord timing on long names and adversarial texts.
require("./h.js");
function rep(s, n) { return new Array(n + 1).join(s); }
function time(label, fn) { var t0 = process.hrtime.bigint(); var r = fn(); console.log(label + ": " + (Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1) + " ms -> " + String(r).length + " chars"); return r; }
var a = time("100k-char one-word name, short text", function () { return endingMomentText(rep("Q", 100000), "You learned to stay."); });
time("  second pass identical", function () { return endingMomentText(rep("Q", 100000), a) === a ? "same" : "DIFFERENT"; });
var nm = rep("Ab ", 20000);
var b = time("20,000-word name", function () { return endingMomentText(nm, "You learned to stay."); });
time("  second pass identical", function () { return endingMomentText(nm, b) === b ? "same" : "DIFFERENT"; });
time("name 'aa', text of 1,000,000 'a' (every index is a partial match)", function () { return endingMomentText("aa", rep("a", 1000000)); });
time("name 'ab ab ab…' x2000 words vs text 'abab…' 200k", function () { return endingMomentText(rep("ab ", 2000), rep("ab", 100000)); });
time("stampCampaignFates-style: 5,000 sentences x 6 names", function () { var t = rep("You walk on and the mill turns. ", 5000), n = 0, i, s = t.match(/[^.!?]+[.!?]+/g); ["Morwen Zethran", "Daeris", "Frizwick", "Nyla Lorrath", "Silas Morne", "Ammut"].forEach(function (x) { for (i = 0; i < s.length; i++) if (textNamesPerson(s[i], x)) n++; }); return n; });
