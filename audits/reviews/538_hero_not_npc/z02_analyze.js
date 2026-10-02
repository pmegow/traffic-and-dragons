// Analyze the fuzz outputs. argv: <left.jsonl> <right.jsonl> [show N]
var fs = require("fs");
function load(f) { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); }); }
var L = load(process.argv[2]), R = load(process.argv[3]), SHOW = parseInt(process.argv[4] || "12", 10);
var same = 0, diff = 0, inputMismatch = 0, i, errL = 0, errR = 0, violL = 0, violR = 0, viaR = 0, startViol = 0;
var classes = {}, shown = {};
function cls(l, r) {
  // which kind of difference
  var out = [];
  var refusedR = [].concat.apply([], r.muts).filter(function (m) { return /refused|Epithet refused/.test(m); });
  var refusedL = [].concat.apply([], l.muts).filter(function (m) { return /refused|Epithet refused/.test(m); });
  if (l.viol.length && !r.viol.length) out.push("left filed the hero, right did not");
  if (!l.viol.length && r.viol.length) out.push("RIGHT filed the hero, left did not");
  if (l.viol.length && r.viol.length) out.push("both hold a hero-named record");
  if (!l.viol.length && !r.viol.length) out.push("neither holds a hero-named record but states differ");
  if (r.viaResolve.length) out.push("right refused by resolution only");
  return out.join(" + ");
}
for (i = 0; i < L.length; i++) {
  var l = L[i], r = R[i];
  if (JSON.stringify(l.replies) !== JSON.stringify(r.replies) || l.hero !== r.hero) { inputMismatch++; continue; }
  if (l.err) errL++; if (r.err) errR++; if (l.viol.length) violL++; if (r.viol.length) violR++; if (r.viaResolve.length) viaR++; if (r.start.length) startViol++;
  if (JSON.stringify(l.state) === JSON.stringify(r.state)) { same++; continue; }
  diff++; var c = cls(l, r); classes[c] = (classes[c] || 0) + 1;
  if ((shown[c] || 0) < SHOW && /RIGHT filed|neither|resolution only/.test(c)) { shown[c] = (shown[c] || 0) + 1; console.log("\n#" + l.i + " [" + c + "] hero=" + l.hero + " eps=" + JSON.stringify(l.eps) + " swap=" + l.swap + " refs=" + l.refs + " seed=" + JSON.stringify(l.seed)); l.replies.forEach(function (rep, k) { console.log("   reply " + k + ": " + rep + "\n      L " + JSON.stringify(l.muts[k]) + "\n      R " + JSON.stringify(r.muts[k])); }); console.log("   L viol " + JSON.stringify(l.viol) + " | R viol " + JSON.stringify(r.viol) + " | R start " + JSON.stringify(r.start)); }
}
console.log("\nscenarios " + L.length + "; input mismatch " + inputMismatch + "; same end state " + same + "; different " + diff);
console.log("errors L/R " + errL + "/" + errR + "; scenarios ending with a hero-named record L/R " + violL + "/" + violR + "; start-state violations (after a swap) R " + startViol + "; right refusals by resolution only " + viaR);
console.log("classes " + JSON.stringify(classes, null, 1));
