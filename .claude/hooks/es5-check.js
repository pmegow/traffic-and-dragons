// PostToolUse(Edit|Write) guardrail: enforce ES5-only in game client .js files.
// Reads the hook JSON payload from stdin, flags const/let/=> and exits 2 so the
// violation is surfaced back to the model. Also logs touched files for stop-check.js.
var fs = require("fs"), os = require("os"), path = require("path");
var TMP = process.env.TND_HOOK_TMP || os.tmpdir();

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
    var log = path.join(TMP, "claude-touched-" + sid + ".log");
    fs.appendFileSync(log, fp + "\n");
  } catch (e2) {}

  // Only enforce ES5 on the game client: a .js file DIRECTLY in the repo root (#481 G10, 2026-09-29). The old
  // filter was not anchored to the repo, so it fired on scratch files elsewhere, and its line regexes flagged an
  // arrow inside a string or a regex. ONE rule set for every caller: dev/check-es5.js's lexer (the pre-commit
  // hook and CI run the same file). dev/, vendor/ and the server are not client code.
  var ROOT = path.resolve(__dirname, "..", "..");
  var abs = path.resolve(fp);
  var isGameJs = /\.js$/i.test(abs) && path.dirname(abs).toLowerCase() === ROOT.toLowerCase();
  if (!isGameJs) process.exit(0);

  var src;
  try { src = fs.readFileSync(abs, "utf8"); } catch (e3) { process.exit(0); }
  var scanEs5;
  try { scanEs5 = require(path.join(ROOT, "dev", "check-es5.js")).scanEs5; }
  catch (e4) { process.stderr.write("ES5 hook: dev/check-es5.js could not be loaded (" + e4.message + ") — the ES5 rule is unchecked for " + fp + "\n"); process.exit(2); }
  var hits = scanEs5(src);
  if (hits.length) {
    process.stderr.write(
      "ES5 VIOLATION in " + fp + "\n" +
      "This project is ES5-only: var, no const/let, no arrow functions, no template literals, no class.\n" +
      hits.slice(0, 20).map(function (h) { return "  line " + h.line + " (" + h.kind + "): " + h.text; }).join("\n") + "\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
