// Stop guardrail: end-of-turn hygiene warnings (warns at most once per session).
//  1) Game .js edited this session but CLAUDE.md never touched.
//  2) ui.js version string drifted from the memory session_state.md version.
// Non-blocking: emits {systemMessage} and exits 0 so it never stalls the loop.
var fs = require("fs"), os = require("os"), path = require("path");

var ROOT = process.env.TND_STOP_ROOT || "C:\\Projects\\traffic-and-dragons";
var MEM = process.env.TND_STOP_MEM || "C:\\Users\\hannu\\.claude\\projects\\C--Projects-traffic-and-dragons\\memory\\session_state.md";

var raw = "";
process.stdin.on("data", function (d) { raw += d; });
process.stdin.on("end", function () {
  var p;
  try { p = JSON.parse(raw || "{}"); } catch (e) { process.exit(0); }
  var sid = (p.session_id || "nosession").replace(/[^\w.-]/g, "_");

  // Warn only once per session to avoid per-turn spam (Stop fires every turn).
  var warnMarker = path.join(os.tmpdir(), "claude-stopwarn-" + sid);
  if (fs.existsSync(warnMarker)) process.exit(0);

  var touched = [];
  try {
    touched = fs.readFileSync(path.join(os.tmpdir(), "claude-touched-" + sid + ".log"), "utf8")
      .split(/\r?\n/).filter(Boolean);
  } catch (e2) {}

  function isGameJs(f) {
    return /\.js$/i.test(f)
      && !/[\\/]\.claude[\\/]/i.test(f)
      && !/[\\/]traffic-and-dragons-server[\\/]/i.test(f)
      && !/server/i.test(f)
      && !/node_modules/i.test(f);
  }
  var jsChanged = touched.some(isGameJs);
  var claudeMdChanged = touched.some(function (f) { return /claude\.md$/i.test(f); });

  var warnings = [];
  if (jsChanged && !claudeMdChanged) {
    warnings.push("⚠ Game .js was edited this session but CLAUDE.md was not. Update the spec if behavior or architecture changed.");
  }

  try {
    var ui = fs.readFileSync(path.join(ROOT, "ui.js"), "utf8");
    var cm = ui.match(/\|\s*v(\d+\.\d+)"/);
    var codeVer = cm ? cm[1] : null;
    var mem = fs.readFileSync(MEM, "utf8");
    var mmm = mem.match(/Current version:\*\*\s*v(\d+\.\d+)/i) || mem.match(/v(\d+\.\d+)/);
    var memVer = mmm ? mmm[1] : null;
    if (codeVer && memVer && codeVer !== memVer) {
      warnings.push("⚠ Version drift: ui.js is v" + codeVer + " but memory session_state.md says v" + memVer + ". Run /memory to refresh.");
    }
  } catch (e3) {}

  if (warnings.length) {
    try { fs.writeFileSync(warnMarker, "1"); } catch (e4) {}
    process.stdout.write(JSON.stringify({ systemMessage: warnings.join("\n") }));
  }
  process.exit(0);
});
