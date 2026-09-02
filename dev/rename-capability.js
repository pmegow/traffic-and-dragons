#!/usr/bin/env node
// rename-capability.js — TODO #221: the ATOMIC rename of one capability (spell/ability) across
// every data file that names it, or NOTHING.
//
//   node dev/rename-capability.js "Old Name" "New Name" [--dry-run] [--root <dir>]
//
// WHY A TOOL: a capability name is a KEY, not a label. It is the capability_bible key (lowercased
// base name), and it is repeated as a display-cased string in class_bible's spell arrays and
// authored feature names, in the SPELLS/ARCH_SPELLS creation pools, and in the ANCS racial_caps
// references. Renaming by hand hits some sites and misses others, and the miss is SILENT until a
// coverage guard reds — or worse, until a player's sheet shows a word the GM knows nothing about.
// So this tool rewrites every site, appends the save-migration entry, and then PROVES the result
// by loading the rewritten files and re-running the coverage question itself. Any failure restores
// every file from the in-memory originals: the rename lands whole or not at all.
//
// WHAT IT DELIBERATELY DOES NOT DO:
//  · It never reserializes capability_bible.js. That file is HAND-COMMENTED and the bible editor
//    re-emits untouched entries as their original source lines; a wholesale rewrite would produce
//    a diff of the entire file. Only the KEY TOKEN of the one entry line is rewritten.
//  · It never touches PROSE. class_bible feature `ds` text and ANCS `traits`/`desc` summaries are
//    human writing; a rename that edited them would be a content edit wearing a refactor's coat.
//    Only whole string tokens that normalize (capBaseName) to the old key are rewritten.
//  · It never guesses. Anything ambiguous refuses loudly and touches nothing.
//
// class_bible.js IS reserialized between its markers — that file is machine-regenerated canonical
// JSON.stringify(x,null,2) by design (the BIBLE EDITOR CONTRACT byte-pins it), so a canonical
// re-emit is the format's own writer. The tool refuses if the region was not already canonical,
// rather than silently normalizing somebody's hand edit into the rename's diff.

"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var FILES = ["capability_bible.js", "class_bible.js", "data.js"];
var CB_OPEN = "// >>> CLASS BIBLE DATA\n";
var CB_CLOSE = "// <<< CLASS BIBLE DATA";

function die(msg) {
  console.error("RENAME REFUSED: " + msg);
  process.exit(1);
}
function dieRestored(msg) {
  console.error("RENAME FAILED: " + msg);
  console.error("  → every file has been RESTORED from the in-memory originals. Nothing changed.");
  process.exit(1);
}

// The same normalization capability_bible.js uses (capBaseName) — reimplemented here rather than
// loaded, because the tool must normalize BEFORE it can trust any file it is about to rewrite.
function capBaseName(nm) {
  return String(nm || "").replace(/\s*\(.*\)/, "").toLowerCase().trim();
}

// ── argument parsing ────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  var out = { positional: [], dryRun: false, root: null };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--root") { out.root = argv[++i]; if (!out.root) die("--root needs a directory"); }
    else if (a.indexOf("--root=") === 0) out.root = a.slice(7);
    else if (a.indexOf("--") === 0) die("unknown option " + a);
    else out.positional.push(a);
  }
  return out;
}

// ── a string-literal-aware span finder ──────────────────────────────────────────────────────
// data.js is hand-written source, so brace/bracket balancing must not be fooled by a quote or a
// bracket INSIDE a string (the NAMES arrays are full of them).
function spanFrom(src, start, open, close) {
  var i = src.indexOf(open, start);
  if (i < 0) return null;
  var depth = 0, q = null, esc = false;
  for (var j = i; j < src.length; j++) {
    var c = src[j];
    if (q) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (!depth) return { start: i, end: j + 1 }; }
  }
  return null;
}

// Rewrite whole double-quoted tokens inside [start,end) whose value normalizes to oldKey.
// Returns {text, hits:[{value, index}]}. Single-quoted tokens are not used in these files.
function rewriteTokensIn(src, spans, oldKey, newDisplay) {
  var hits = [], out = "", cursor = 0;
  var re = /"((?:[^"\\]|\\.)*)"/g;
  spans.sort(function (a, b) { return a.start - b.start; });
  for (var s = 0; s < spans.length; s++) {
    var sp = spans[s];
    if (sp.start < cursor) continue;
    out += src.slice(cursor, sp.start);
    var chunk = src.slice(sp.start, sp.end), rebuilt = "", last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(chunk))) {
      var val;
      try { val = JSON.parse(m[0]); } catch (e) { continue; }
      if (capBaseName(val) !== oldKey) continue;
      rebuilt += chunk.slice(last, m.index) + JSON.stringify(newDisplay);
      last = m.index + m[0].length;
      hits.push({ value: val, index: sp.start + m.index });
    }
    rebuilt += chunk.slice(last);
    out += rebuilt;
    cursor = sp.end;
  }
  out += src.slice(cursor);
  return { text: out, hits: hits };
}

// ── capability_bible.js: the ONE entry line's key token, nothing else ────────────────────────
function rewriteCapabilityBible(src, oldKey, newKey) {
  var lines = src.split("\n"), found = [], i;
  for (i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(\s*)"((?:[^"\\]|\\.)*)"(\s*):/);
    if (!m) continue;
    var key;
    try { key = JSON.parse('"' + m[2] + '"'); } catch (e) { continue; }
    if (key === oldKey) found.push(i);
  }
  if (!found.length) return { error: 'no entry line in capability_bible.js is keyed "' + oldKey + '"' };
  if (found.length > 1) return { error: 'capability_bible.js has ' + found.length + ' entry lines keyed "' + oldKey + '" (lines ' + found.map(function (n) { return n + 1; }).join(", ") + ") — refusing to guess" };
  var ln = found[0];
  lines[ln] = lines[ln].replace(/^(\s*)"(?:[^"\\]|\\.)*"/, "$1" + JSON.stringify(newKey));
  return { text: lines.join("\n"), edits: [{ line: ln + 1, what: 'entry key "' + oldKey + '" → "' + newKey + '"' }] };
}

// ── class_bible.js: canonical re-emit of the marker region, string VALUES only ───────────────
function classBibleRegion(src) {
  var a = src.indexOf(CB_OPEN);
  var b = src.indexOf(CB_CLOSE);
  if (a < 0 || b < 0 || b < a) return null;
  return { head: src.slice(0, a + CB_OPEN.length), body: src.slice(a + CB_OPEN.length, b), tail: src.slice(b) };
}
function canonicalBody(bible, xp) {
  return "var CLASS_XP_LEVELS = " + JSON.stringify(xp) + ";\n" +
    "var CLASS_BIBLE = " + JSON.stringify(bible, null, 2) + ";\n";
}
function rewriteClassBible(src, oldKey, newDisplay) {
  var reg = classBibleRegion(src);
  if (!reg) return { error: "class_bible.js is missing its >>> / <<< CLASS BIBLE DATA markers" };
  var vals;
  try { vals = new Function(reg.body + "\nreturn {b:CLASS_BIBLE,x:CLASS_XP_LEVELS};")(); }
  catch (e) { return { error: "class_bible.js data region does not evaluate: " + (e && e.message) }; }
  if (canonicalBody(vals.b, vals.x) !== reg.body)
    return { error: "class_bible.js data region is NOT in canonical JSON.stringify(x,null,2) form — refusing, because a canonical re-emit would fold somebody's hand edit into this rename's diff. Re-export from bible_editor.html first." };

  // Deep-walk VALUES only: object KEYS are class/archetype identifiers, never capability names,
  // and rewriting one would silently retarget the whole structure.
  var hits = [];
  function walk(node) {
    if (node instanceof Array) {
      for (var i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") { if (capBaseName(node[i]) === oldKey) { hits.push(node[i]); node[i] = newDisplay; } }
        else if (node[i] && typeof node[i] === "object") walk(node[i]);
      }
      return;
    }
    for (var k in node) {
      var v = node[k];
      if (typeof v === "string") { if (capBaseName(v) === oldKey) { hits.push(v); node[k] = newDisplay; } }
      else if (v && typeof v === "object") walk(v);
    }
  }
  walk(vals.b);
  return { text: reg.head + canonicalBody(vals.b, vals.x) + reg.tail, edits: hits.map(function (h) { return { what: '"' + h + '" → "' + newDisplay + '"' }; }) };
}

// ── data.js: SPELLS + ARCH_SPELLS + every racial_caps span; never NAMES, never prose ─────────
function dataSpans(src) {
  var spans = [], sp, i;
  ["var SPELLS=", "var ARCH_SPELLS="].forEach(function (decl) {
    var at = src.indexOf(decl);
    if (at < 0) return;
    sp = spanFrom(src, at, "{", "}");
    if (sp) spans.push(sp);
  });
  if (spans.length !== 2) return { error: "data.js is missing SPELLS and/or ARCH_SPELLS (found " + spans.length + " of 2)" };
  var from = 0;
  while ((i = src.indexOf("racial_caps:", from)) >= 0) {
    sp = spanFrom(src, i, "[", "]");
    if (!sp) return { error: "data.js has an unterminated racial_caps array at char " + i };
    spans.push(sp);
    from = sp.end;
  }
  return { spans: spans };
}
function rewriteData(src, oldKey, newDisplay) {
  var sp = dataSpans(src);
  if (sp.error) return { error: sp.error };
  var r = rewriteTokensIn(src, sp.spans, oldKey, newDisplay);
  return { text: r.text, edits: r.hits.map(function (h) { return { what: '"' + h.value + '" → "' + newDisplay + '" (char ' + h.index + ")" }; }) };
}

// ── data.js: append the save-migration entry ────────────────────────────────────────────────
function appendRenameEntry(src, from, to) {
  var at = src.indexOf("var CAPABILITY_RENAMES=");
  if (at < 0) return { error: "data.js has no CAPABILITY_RENAMES table — a rename with no save migration would orphan every existing character's spell list" };
  var sp = spanFrom(src, at, "[", "]");
  if (!sp) return { error: "data.js CAPABILITY_RENAMES array is unterminated" };
  var inner = src.slice(sp.start + 1, sp.end - 1);
  var entry = "  {from:" + JSON.stringify(from) + ",to:" + JSON.stringify(to) + "}";
  var body = inner.replace(/^\s+|\s+$/g, "").length
    ? inner.replace(/\s+$/, "").replace(/,\s*$/, "") + ",\n" + entry + "\n"
    : "\n" + entry + "\n";
  return { text: src.slice(0, sp.start) + "[" + body + "]" + src.slice(sp.end), edits: [{ what: "CAPABILITY_RENAMES += " + entry.trim() }] };
}

// ── the coverage proof, run against what is actually on disk ─────────────────────────────────
function coverageCheck(root, oldKey, newDisplay) {
  var ctx = vm.createContext({ console: { log: function () { }, warn: function () { }, error: function () { } } });
  var order = ["capability_bible.js", "data.js", "class_bible.js", "helpers.js"];
  for (var i = 0; i < order.length; i++) {
    var f = path.join(root, order[i]);
    if (!fs.existsSync(f)) { if (order[i] === "helpers.js") continue; return "missing " + order[i]; }
    try { vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: order[i] }); }
    catch (e) { return order[i] + " does not evaluate after the rewrite: " + (e && e.message); }
  }
  var lookup = ctx.capabilityLookup;
  if (typeof lookup !== "function") return "capabilityLookup is not defined after the rewrite";

  var bad = [];
  function chk(owner, nm) { if (typeof nm === "string" && nm && !lookup(nm)) bad.push(owner + ": " + nm); }
  function scanPool(owner, pool) { if (!pool) return; for (var t in pool) for (var i2 = 0; i2 < pool[t].length; i2++) chk(owner + " T" + t, pool[t][i2]); }

  var CB = ctx.CLASS_BIBLE || {}, k, a;
  for (k in CB) {
    scanPool("CLASS_BIBLE." + k, CB[k].spells);
    var arcs = CB[k].archetypes || [];
    for (a = 0; a < arcs.length; a++) scanPool("CLASS_BIBLE." + k + "/" + arcs[a].id, arcs[a].spells);
  }
  var SP = ctx.SPELLS || {}, AS = ctx.ARCH_SPELLS || {};
  for (k in SP) scanPool("SPELLS." + k, SP[k]);
  for (k in AS) scanPool("ARCH_SPELLS." + k, AS[k]);

  // racial_caps: bare strings and {cap,use} objects, at ancestry / subrace / lineage depth.
  function scanCaps(owner, node) {
    if (!node) return;
    var caps = node.racial_caps || [], i3;
    for (i3 = 0; i3 < caps.length; i3++) chk(owner + " racial_caps", typeof caps[i3] === "string" ? caps[i3] : caps[i3] && caps[i3].cap);
    var kids = (node.subraces || []).concat(node.lineages || []);
    for (i3 = 0; i3 < kids.length; i3++) scanCaps(owner + "/" + (kids[i3].id || "?"), kids[i3]);
  }
  var ANCS = ctx.ANCS || [];
  for (a = 0; a < ANCS.length; a++) scanCaps("ANCS." + (ANCS[a].id || a), ANCS[a]);

  if (bad.length) return bad.length + " reference(s) no longer resolve: " + bad.slice(0, 6).join(" | ");
  if (!lookup(newDisplay)) return 'the NEW name "' + newDisplay + '" does not resolve in the capability bible';
  if (lookup(oldKey)) return 'the OLD name "' + oldKey + '" still resolves — the bible key was not rewritten';

  // The residue sweep: any surviving quoted token that normalizes to the old key is a site the
  // rewrite missed. Prose is exempt by construction (a sentence never normalizes to a bare key).
  // A stale doc COMMENT quoting the old name trips this too, deliberately — the sweep cannot tell
  // a forgotten reference from a forgotten sentence, and the rename is atomic, so it says where
  // the token is and restores. Fix the line and re-run.
  for (i = 0; i < FILES.length; i++) {
    var src = fs.readFileSync(path.join(root, FILES[i]), "utf8"), m, re = /"((?:[^"\\]|\\.)*)"/g;
    var tbl = src.indexOf("var CAPABILITY_RENAMES=");
    var tsp = tbl >= 0 ? spanFrom(src, tbl, "[", "]") : null;
    while ((m = re.exec(src))) {
      var v;
      try { v = JSON.parse(m[0]); } catch (e2) { continue; }
      if (capBaseName(v) !== oldKey) continue;
      // data.js legitimately retains the old name inside CAPABILITY_RENAMES — that is the point.
      if (FILES[i] === "data.js" && tsp && m.index >= tsp.start && m.index <= tsp.end) continue;
      var line = src.slice(0, m.index).split("\n").length;
      return FILES[i] + ":" + line + " still carries the old name " + m[0] +
        " — an uncovered reference or a stale comment. Fix that line and re-run.";
    }
  }
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────
function main() {
  var args = parseArgs(process.argv.slice(2));
  if (args.positional.length !== 2)
    die('usage: node dev/rename-capability.js "Old Name" "New Name" [--dry-run] [--root <dir>]');

  var oldName = args.positional[0], newName = args.positional[1];
  if (!String(oldName).trim()) die("the old name is empty");
  if (!String(newName).trim()) die("the new name is empty");
  if (String(oldName).indexOf("|") >= 0 || String(newName).indexOf("|") >= 0)
    die("a capability name may not contain '|' — the pipe is the tag-operand separator and would split the name inside [SPELL_USED:]/[ALIAS:] operands");

  var oldKey = capBaseName(oldName), newKey = capBaseName(newName);
  if (!oldKey) die('"' + oldName + '" normalizes to an empty base name');
  if (!newKey) die('"' + newName + '" normalizes to an empty base name');

  var root = args.root ? path.resolve(args.root) : path.join(__dirname, "..");
  var originals = {}, i;
  for (i = 0; i < FILES.length; i++) {
    var p = path.join(root, FILES[i]);
    if (!fs.existsSync(p)) die("missing " + FILES[i] + " under " + root);
    originals[FILES[i]] = fs.readFileSync(p, "utf8");
  }

  // Refusals read the bible BEFORE any rewrite: the key must exist, and the target must not.
  var bibleData;
  try { bibleData = new Function(originals["capability_bible.js"] + "\nreturn CAPABILITY_BIBLE;")(); }
  catch (e) { die("capability_bible.js does not evaluate: " + (e && e.message)); }
  if (!Object.prototype.hasOwnProperty.call(bibleData, oldKey))
    die('"' + oldName + '" (key "' + oldKey + '") is not a capability_bible key — nothing to rename');
  if (newKey === oldKey)
    die('"' + newName + '" normalizes to the SAME bible key "' + oldKey + '" — a display-case-only change is not a rename this tool performs');
  if (Object.prototype.hasOwnProperty.call(bibleData, newKey))
    die('"' + newName + '" (key "' + newKey + '") is ALREADY a capability_bible key — renaming onto it would fuse two capabilities and destroy one');

  // Plan every edit before writing anything.
  var planned = {}, report = [];
  var rc = rewriteCapabilityBible(originals["capability_bible.js"], oldKey, newKey);
  if (rc.error) die(rc.error);
  planned["capability_bible.js"] = rc.text;
  report.push({ file: "capability_bible.js", edits: rc.edits });

  var rb = rewriteClassBible(originals["class_bible.js"], oldKey, newName);
  if (rb.error) die(rb.error);
  planned["class_bible.js"] = rb.text;
  report.push({ file: "class_bible.js", edits: rb.edits });

  var rd = rewriteData(originals["data.js"], oldKey, newName);
  if (rd.error) die(rd.error);
  var ra = appendRenameEntry(rd.text, oldName, newName);
  if (ra.error) die(ra.error);
  planned["data.js"] = ra.text;
  report.push({ file: "data.js", edits: rd.edits.concat(ra.edits) });

  console.log('rename-capability: "' + oldName + '" → "' + newName + '"  (bible key "' + oldKey + '" → "' + newKey + '")');
  for (i = 0; i < report.length; i++) {
    console.log("  " + report[i].file + " — " + report[i].edits.length + " edit(s)");
    for (var j = 0; j < report[i].edits.length; j++) console.log("      · " + report[i].edits[j].what);
  }

  if (args.dryRun) {
    console.log("DRY RUN — no file was written.");
    process.exit(0);
  }

  function restore() {
    for (var r = 0; r < FILES.length; r++) fs.writeFileSync(path.join(root, FILES[r]), originals[FILES[r]]);
  }
  try {
    for (i = 0; i < FILES.length; i++) fs.writeFileSync(path.join(root, FILES[i]), planned[FILES[i]]);
  } catch (e) {
    restore();
    dieRestored("write failed: " + (e && e.message));
  }

  var problem;
  try { problem = coverageCheck(root, oldKey, newName); }
  catch (e) { problem = "the coverage check itself threw: " + (e && e.message); }
  if (problem) { restore(); dieRestored(problem); }

  console.log("coverage OK — every class_bible / SPELLS / ARCH_SPELLS / racial_caps reference resolves, and the old name resolves nowhere.");
  console.log("RENAMED. Remember to bump APP_VERSION + sw.js CACHE, and to wire migrateWorldState to CAPABILITY_RENAMES if it is not wired yet.");
}

if (require.main === module) main();

module.exports = {
  capBaseName: capBaseName,
  spanFrom: spanFrom,
  rewriteCapabilityBible: rewriteCapabilityBible,
  rewriteClassBible: rewriteClassBible,
  rewriteData: rewriteData,
  appendRenameEntry: appendRenameEntry,
  coverageCheck: coverageCheck
};
