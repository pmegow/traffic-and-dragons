// install-bible.js — take a bible the editor DOWNLOADED and put it in the project, safely.
//
// Why this exists: the editor's in-place save (File System Access API) fails on this machine with
// a persistent InvalidStateError, and worse, one attempt left class_bible.js ZERO BYTES. Its
// download path, by contrast, has never failed once. So the reliable workflow is:
//
//     edit in bible_editor.html  →  ⬇ Download copy  →  node dev/install-bible.js
//
// This does what the browser could not: validate the downloaded file, refuse it if it is broken,
// and only then replace the tracked file. Nothing here depends on a browser API.
//
// Usage:
//   node dev/install-bible.js                 # newest class_bible*.js from Downloads
//   node dev/install-bible.js capability      # newest capability_bible*.js
//   node dev/install-bible.js <path/to/file>  # an explicit file
//   node dev/install-bible.js --dry-run       # validate + report, write nothing

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads");

var TYPES = {
  "class": { target: "class_bible.js", pattern: /^class_bible.*\.js$/i, globals: ["CLASS_BIBLE", "CLASS_XP_LEVELS"] },
  "capability": { target: "capability_bible.js", pattern: /^capability_bible.*\.js$/i, globals: ["CAPABILITY_BIBLE"] }
};

function die(msg) { console.error("\n  ✗ " + msg + "\n"); process.exit(1); }
function ok(msg) { console.log("  ✓ " + msg); }

var args = process.argv.slice(2);
var dryRun = args.indexOf("--dry-run") >= 0;
args = args.filter(function (a) { return a !== "--dry-run"; });

// ── pick the source file ────────────────────────────────────────────────────
var typeKey = "class", explicit = null;
if (args[0]) {
  if (TYPES[args[0]]) typeKey = args[0];
  else explicit = args[0];
}

var src;
if (explicit) {
  src = path.resolve(explicit);
  if (!fs.existsSync(src)) die("no such file: " + src);
  // infer the type from the contents rather than the filename (downloads get " (3)" suffixes)
  var head = fs.readFileSync(src, "utf8");
  typeKey = /var\s+CAPABILITY_BIBLE/.test(head) ? "capability" : "class";
} else {
  var spec = TYPES[typeKey];
  if (!fs.existsSync(DOWNLOADS)) die("cannot find your Downloads folder at " + DOWNLOADS);
  var cands = fs.readdirSync(DOWNLOADS)
    .filter(function (f) { return spec.pattern.test(f); })
    .map(function (f) { var p = path.join(DOWNLOADS, f); return { p: p, m: fs.statSync(p).mtimeMs }; })
    .sort(function (a, b) { return b.m - a.m; });
  if (!cands.length) die("no " + spec.target + " download found in " + DOWNLOADS);
  src = cands[0].p;
  console.log("\n  newest download: " + path.basename(src) + "  (" + new Date(cands[0].m).toLocaleString() + ")");
  if (cands.length > 1) console.log("  (" + (cands.length - 1) + " older one(s) ignored — pass an explicit path to choose another)");
}

var spec = TYPES[typeKey];
var target = path.join(ROOT, spec.target);
console.log("  installing as : " + spec.target + (dryRun ? "   [DRY RUN]" : "") + "\n");

// ── validate BEFORE touching anything ───────────────────────────────────────
var text = fs.readFileSync(src, "utf8");
if (!text.trim().length) die("the download is EMPTY — refusing to install it (this is exactly how the tracked file got zeroed).");

var ctx = {};
vm.createContext(ctx);
try { vm.runInContext(text, ctx); }
catch (e) { die("the download is not valid JavaScript: " + e.message); }

spec.globals.forEach(function (g) { if (!ctx[g]) die("the download does not define " + g + " — wrong file?"); });
ok("parses, and defines " + spec.globals.join(" + "));

// structural sanity, so a truncated or mangled file cannot land
if (typeKey === "class") {
  var classes = Object.keys(ctx.CLASS_BIBLE);
  if (classes.length !== 9) die("expected 9 classes, found " + classes.length);
  var slots = 0, filled = 0;
  classes.forEach(function (c) {
    var e = ctx.CLASS_BIBLE[c];
    if (!e.levels || !e.archetypes || e.archetypes.length !== 3) die(c + " is malformed (levels/archetypes)");
    for (var lv in e.levels) { slots++; if (e.levels[lv].features.length) filled++; }
    e.archetypes.forEach(function (a) { for (var l in a.levels) { slots++; if (a.levels[l].features.length) filled++; } });
  });
  if (slots !== 234) die("expected 234 level slots, found " + slots);
  if (ctx.CLASS_XP_LEVELS.length !== 20) die("XP curve is not 20 levels");
  ok("9 classes · 234 slots · " + filled + " filled · XP 1–20");
} else {
  var keys = Object.keys(ctx.CAPABILITY_BIBLE);
  if (keys.length < 100) die("only " + keys.length + " capability entries — that looks truncated");
  var bad = keys.filter(function (k) { return k !== k.toLowerCase(); });
  if (bad.length) die("these keys are not lowercase and would never resolve: " + bad.slice(0, 5).join(", "));
  ok(keys.length + " entries, all lowercase-keyed");
}

// compare against what is already there
var current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
if (current.replace(/\r\n/g, "\n") === text.replace(/\r\n/g, "\n")) {
  console.log("\n  → identical to the file already in the project. Nothing to do.\n");
  process.exit(0);
}
console.log("  current file  : " + current.length + " chars");
console.log("  download      : " + text.length + " chars");

if (dryRun) { console.log("\n  [DRY RUN] validated only — nothing written.\n"); process.exit(0); }

// ── install ─────────────────────────────────────────────────────────────────
// No backup file is written on purpose: the target is TRACKED, so `git checkout -- <file>` is the
// undo, and a stray .bak in the repo root is the kind of litter this project sweeps out.
fs.writeFileSync(target, text);
ok("written to " + spec.target);
console.log("\n  Verify and commit:\n    node dev/run-tests.js\n    git diff --stat " + spec.target + "\n");
