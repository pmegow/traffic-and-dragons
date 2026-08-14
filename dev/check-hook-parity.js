// check-hook-parity.js — blocking local guard that the installed pre-commit hook is the
// tracked dev/pre-commit byte-for-byte. A stale installed copy cannot honestly claim to run
// today's gates. session-check.js consumes inspect() as a warn-only session-start signal.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var crypto = require("crypto");

function parseArgs(argv) {
  var root = path.join(__dirname, "..");
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) root = path.resolve(argv[++i]);
    else throw new Error("unknown or incomplete argument: " + argv[i]);
  }
  return root;
}
function slash(file) { return file.replace(/\\/g, "/"); }
function digest(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12); }
function gitPath(root) {
  var run = cp.spawnSync("git", ["-C", root, "rev-parse", "--git-path", "hooks/pre-commit"], { encoding: "utf8" });
  if (run.status !== 0) throw new Error("cannot resolve the installed hook path: " + String(run.stderr || run.stdout || "").trim());
  var found = String(run.stdout || "").trim();
  return path.isAbsolute(found) ? found : path.resolve(root, found);
}
function display(root, file) {
  var rel = path.relative(root, file);
  return rel && rel.indexOf("..") !== 0 ? slash(rel) : slash(file);
}
function inspect(root) {
  root = path.resolve(root);
  var tracked = path.join(root, "dev", "pre-commit");
  var installed;
  try { installed = gitPath(root); }
  catch (e) { return { ok: false, message: e.message, tracked: tracked, installed: null }; }
  if (!fs.existsSync(tracked)) return { ok: false, message: "tracked hook is missing: " + display(root, tracked), tracked: tracked, installed: installed };
  if (!fs.existsSync(installed)) return { ok: false, message: "installed hook is missing: " + display(root, installed) + " (copy " + display(root, tracked) + " into it)", tracked: tracked, installed: installed };
  var wanted = fs.readFileSync(tracked), got = fs.readFileSync(installed);
  if (!wanted.equals(got)) return {
    ok: false,
    message: "installed hook differs from " + display(root, tracked) + ": " + display(root, installed) +
      " is " + digest(got) + ", tracked is " + digest(wanted) + " (reinstall the tracked copy)",
    tracked: tracked,
    installed: installed
  };
  return { ok: true, message: "installed hook matches " + display(root, tracked) + " byte-for-byte (" + digest(wanted) + ")", tracked: tracked, installed: installed };
}
function main() {
  var root;
  try { root = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error("HOOK PARITY FAILED — " + e.message); process.exit(1); }
  var result = inspect(root);
  if (!result.ok) { console.error("HOOK PARITY FAILED — " + result.message); process.exit(1); }
  console.log("HOOK PARITY OK — " + result.message);
}

if (require.main === module) main();
module.exports = { inspect: inspect };
