// Census: sabotage clauses whose guarded command is the FULL engine run, where the applicability scan
// (dev/tests-252-retained-proof-wiring.js, part of that run) fails on the mutation itself.
var fs = require("fs"), path = require("path"), Module = require("module");
var root = "C:/Projects/traffic-and-dragons", dev = path.join(root, "dev");
process.chdir(root);
var rows = [], orig = Module._load, origExit = process.exit;
fs.readdirSync(dev).filter(function (n) { return /^sabotage-.*\.js$/.test(n); }).sort().forEach(function (name) {
  var file = path.join(dev, name), src = fs.readFileSync(file, "utf8");
  if (src.indexOf("./sabotage.js") < 0) { rows.push({ battery: name, other: true }); return; }
  Module._load = function (request) {
    if (request === "./sabotage.js") return { prove: function (opts) {
      (opts.cases || []).forEach(function (c) {
        var cmd = c.command || opts.command || ["node", ["dev/run-tests.js"]];
        var args = (cmd[1] || []).slice();
        if (!c.command && opts.only && c.mustFail && c.mustFail.indexOf(opts.only) === 0 && c.mustFail.length > opts.only.length) args.push("--only");
        rows.push({ battery: name, file: c.file || opts.file, label: c.label, mustFail: c.mustFail || "", cmd: cmd[0] + " " + args.join(" ") });
      });
      return 0;
    } };
    return orig.apply(Module, arguments);
  };
  process.exit = function () {};
  try { delete require.cache[require.resolve(file)]; require(file); }
  catch (e) { rows.push({ battery: name, err: String(e && e.message) }); }
  finally { Module._load = orig; process.exit = origExit; }
});
var clauses = rows.filter(function (r) { return r.label; });
var full = clauses.filter(function (r) { return r.cmd === "node dev/run-tests.js"; });
function staleLine(r) { return "FAIL " + r.battery + " :: " + r.label + " find target is stale in " + r.file; }
var noMust = full.filter(function (r) { return !r.mustFail; });
var inLine = full.filter(function (r) { return r.mustFail && staleLine(r).indexOf(r.mustFail) >= 0; });
var bat = function (list) { var s = {}; list.forEach(function (r) { s[r.battery] = (s[r.battery] || 0) + 1; }); return s; };
console.log(JSON.stringify({
  batteries: fs.readdirSync(dev).filter(function (n) { return /^sabotage-.*\.js$/.test(n); }).length,
  frameworkClauses: clauses.length, otherBatteries: rows.filter(function (r) { return r.other; }).length, loadErrors: rows.filter(function (r) { return r.err; }).length,
  fullRunClauses: full.length, fullRunBatteries: Object.keys(bat(full)).length,
  noMustFail: noMust.length, noMustFailBatteries: Object.keys(bat(noMust)).length,
  mustFailInsideStaleLine: inLine.length, mustFailInsideStaleLineBatteries: Object.keys(bat(inLine)).length
}, null, 1));
fs.writeFileSync(path.join(__dirname, "census.json"), JSON.stringify({ noMust: noMust, inLine: inLine, cmds: bat(clauses.map(function (r) { return { battery: r.cmd }; })) }, null, 1));
console.log("examples inLine:"); inLine.slice(0, 6).forEach(function (r) { console.log(" ", r.battery, "|", r.mustFail, "|", r.label.slice(0, 90)); });
console.log("examples noMust:"); noMust.slice(0, 6).forEach(function (r) { console.log(" ", r.battery, "|", r.label.slice(0, 90)); });
