// PostToolUse(Edit|Write) guardrail: enforce ES5-only in game client .js files.
// Reads the hook JSON payload from stdin, flags const/let/=> and exits 2 so the
// violation is surfaced back to the model. Also logs touched files for stop-check.js.
var fs = require("fs"), os = require("os"), path = require("path");

var raw = "";
process.stdin.on("data", function (d) { raw += d; });
process.stdin.on("end", function () {
  var p;
  try { p = JSON.parse(raw || "{}"); } catch (e) { process.exit(0); }
  var fp = (p.tool_input && p.tool_input.file_path) || "";
  var sid = (p.session_id || "nosession").replace(/[^\w.-]/g, "_");
  if (!fp) process.exit(0);

  // Record every touched file so the Stop hook can reason about the session.
  try {
    var log = path.join(os.tmpdir(), "claude-touched-" + sid + ".log");
    fs.appendFileSync(log, fp + "\n");
  } catch (e2) {}

  // Only enforce ES5 on game-client .js. Skip the server (modern Node),
  // node_modules, our own .claude/hooks scripts, and vendored third-party files
  // (vendor/piper/* are ES modules — import/export/const are their native shape;
  // T&D patches there match the file's own style, per the tts.js header note).
  var isGameJs = /\.js$/i.test(fp)
    && !/[\\/]\.claude[\\/]/i.test(fp)
    && !/[\\/]vendor[\\/]/i.test(fp)
    && !/[\\/]traffic-and-dragons-server[\\/]/i.test(fp)
    && !/server/i.test(fp)
    && !/node_modules/i.test(fp);
  if (!isGameJs) process.exit(0);

  var src;
  try { src = fs.readFileSync(fp, "utf8"); } catch (e3) { process.exit(0); }

  var lines = src.split(/\r?\n/), hits = [], i;
  for (i = 0; i < lines.length; i++) {
    var ln = lines[i];
    // const/let only when they begin a statement (start of line) — avoids
    // false positives from these words appearing inside prose string literals.
    if (/^\s*(?:const|let)\b/.test(ln)) hits.push("  line " + (i + 1) + " (declaration): " + ln.trim().slice(0, 120));
    if (/=>/.test(ln)) hits.push("  line " + (i + 1) + " (arrow fn): " + ln.trim().slice(0, 120));
  }
  if (hits.length) {
    process.stderr.write(
      "ES5 VIOLATION in " + fp + "\n" +
      "This project is ES5-only: use var, no const/let, no arrow functions.\n" +
      hits.slice(0, 20).join("\n") + "\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
