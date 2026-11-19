// Census: the applicability gate's ambiguity check (n > 1 matches) skips RegExp finds and mutate() functions.
// Count retained clauses whose RegExp (non-global) matches more than once in its target, so the harness mutates the
// FIRST match only — the exact #6E3 wrong-site class the gate was written to refuse for strings.
var fs = require("fs"), path = require("path");
var R = "C:/Projects/traffic-and-dragons";
var chk = require(R + "/dev/check-sabotage-applicability.js");
var inv = chk.collect(R);
var regex = 0, mutate = 0, amb = [], comment = [];
inv.clauses.forEach(function (c) {
  var s = c.spec;
  if (typeof s.mutate === "function") { mutate++; return; }
  if (!(s.find instanceof RegExp)) return;
  regex++;
  var t; try { t = fs.readFileSync(path.resolve(R, c.file), "utf8"); } catch (e) { return; }
  var g = new RegExp(s.find.source, s.find.flags.indexOf("g") >= 0 ? s.find.flags : s.find.flags + "g");
  var n = (t.match(g) || []).length;
  if (n > 1 && s.find.flags.indexOf("g") < 0) amb.push(c.battery + " :: " + s.label + " — " + n + " matches in " + c.file + " " + String(s.find).slice(0, 70));
});
console.log("clauses " + inv.clauses.length + "; RegExp finds " + regex + "; mutate() fns " + mutate + "; non-global RegExp matching >1 site: " + amb.length);
amb.slice(0, 12).forEach(function (a) { console.log("  " + a); });
