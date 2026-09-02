#!/usr/bin/env node
// tests-221-rename-capability.js — the verifier battery for dev/rename-capability.js (TODO #221).
//
// EVERY case runs against a DISPOSABLE COPY of the four data files in an OS temp directory, via
// the tool's own --root option. The tracked working tree is never opened for writing by this
// suite; a case that "passes" by editing the repo would be the exact failure the tool exists to
// prevent. The happy-path subject is "Misty Step", chosen because it is the one capability that
// exercises every rewrite path at once: it is a capability_bible key, it sits in three
// class_bible spell arrays (class + two archetypes), in SPELLS.Sorcerer.2, in
// ARCH_SPELLS.eldritchknight.2, AND in an ANCS racial_caps {cap,use} object (tiefling/fey_tie).

"use strict";

var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");
var crypto = require("crypto");

var ROOT = path.join(__dirname, "..");
var TOOL = path.join(__dirname, "rename-capability.js");
var FILES = ["capability_bible.js", "class_bible.js", "data.js", "helpers.js"];
var SUBJECT = "Misty Step";
var TARGET = "Fadestep";

var passed = 0;
function pass(msg) { passed++; console.log("  ok — " + msg); }
function fail(msg) { throw new Error(msg); }

function mkScratch() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-rename-cap-"));
  FILES.forEach(function (f) { fs.copyFileSync(path.join(ROOT, f), path.join(dir, f)); });
  return dir;
}
function hashes(dir) {
  var h = {};
  FILES.forEach(function (f) {
    h[f] = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex");
  });
  return h;
}
function sameHashes(a, b) { return FILES.every(function (f) { return a[f] === b[f]; }); }
function run(dir, args) {
  var r = cp.spawnSync(process.execPath, [TOOL].concat(args).concat(["--root", dir]), { cwd: ROOT, encoding: "utf8" });
  r.out = String(r.stdout || "") + String(r.stderr || "");
  return r;
}
function read(dir, f) { return fs.readFileSync(path.join(dir, f), "utf8"); }
function load(dir) {
  var vm = require("vm");
  var ctx = vm.createContext({ console: { log: function () { }, warn: function () { }, error: function () { } } });
  ["capability_bible.js", "data.js", "class_bible.js", "helpers.js"].forEach(function (f) {
    vm.runInContext(read(dir, f), ctx, { filename: f });
  });
  return ctx;
}

var scratches = [];
function scratch() { var d = mkScratch(); scratches.push(d); return d; }

try {
  // ── ① happy path: every site rewritten, coverage proven, migration entry appended ──────────
  (function () {
    var dir = scratch();
    var before = read(dir, "capability_bible.js");
    var r = run(dir, [SUBJECT, TARGET]);
    if (r.status !== 0) fail("happy path exited " + r.status + "\n" + r.out);
    pass("happy path exits 0");

    var ctx = load(dir);
    if (!ctx.capabilityLookup(TARGET)) fail("the new name does not resolve after the rename");
    if (ctx.capabilityLookup(SUBJECT)) fail("the old name still resolves after the rename");
    pass("the bible key moved: the new name resolves, the old one does not");

    // Every reference site, checked independently of the tool's own coverage pass.
    var sites = 0;
    function seen(where, list) {
      for (var i = 0; i < (list || []).length; i++) {
        if (list[i] === SUBJECT) fail(where + " still names the old capability");
        if (list[i] === TARGET) sites++;
      }
    }
    seen("SPELLS.Sorcerer.2", ctx.SPELLS.Sorcerer[2]);
    seen("ARCH_SPELLS.eldritchknight.2", ctx.ARCH_SPELLS.eldritchknight[2]);
    var cbHits = 0;
    (function walkCB(n) {
      if (n instanceof Array) { n.forEach(function (v) { if (typeof v === "string") { if (v === SUBJECT) fail("class_bible still names the old capability"); if (v === TARGET) cbHits++; } else if (v && typeof v === "object") walkCB(v); }); return; }
      for (var k in n) { var v = n[k]; if (typeof v === "string") { if (v === SUBJECT) fail("class_bible still names the old capability"); if (v === TARGET) cbHits++; } else if (v && typeof v === "object") walkCB(v); }
    })(ctx.CLASS_BIBLE);
    if (cbHits !== 3) fail("expected 3 class_bible sites rewritten, saw " + cbHits);
    if (sites !== 2) fail("expected 2 creation-pool sites rewritten, saw " + sites);
    pass("all 3 class_bible sites and both creation-pool sites carry the new name");

    var tief = ctx.ANCS.filter(function (a) { return a.id === "tiefling"; })[0];
    var fey = tief.subraces.filter(function (s) { return s.id === "fey_tie"; })[0];
    if (fey.racial_caps[0].cap !== TARGET) fail("the racial_caps {cap,use} reference was not rewritten: " + JSON.stringify(fey.racial_caps));
    if (fey.racial_caps[0].use !== "1/day") fail("the racial_caps `use` field was collaterally edited");
    pass("the ANCS racial_caps {cap,use} reference was rewritten, `use` untouched");

    var renames = ctx.CAPABILITY_RENAMES;
    if (!renames || renames.length !== 1 || renames[0].from !== SUBJECT || renames[0].to !== TARGET)
      fail("CAPABILITY_RENAMES did not receive the migration entry: " + JSON.stringify(renames));
    pass("CAPABILITY_RENAMES received {from,to} display-cased");

    // The hand-comment contract: exactly ONE line of capability_bible.js changed.
    var a = before.split("\n"), b = read(dir, "capability_bible.js").split("\n"), diff = 0;
    if (a.length !== b.length) fail("capability_bible.js changed line COUNT — it was reserialized");
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    if (diff !== 1) fail("capability_bible.js has " + diff + " changed lines — only the one entry line's key may move");
    pass("capability_bible.js: exactly one changed line, no reserialization");

    // Prose is untouched: the entry's own effect text still reads as authored.
    if (ctx.capabilityLookup(TARGET).effect.indexOf("teleport up to 30ft") < 0)
      fail("the entry's effect prose was damaged by the rename");
    pass("entry prose survives the key rewrite verbatim");
  })();

  // ── ② class_bible.js stays canonical JSON.stringify(x,null,2) ──────────────────────────────
  (function () {
    var dir = scratch();
    if (run(dir, [SUBJECT, TARGET]).status !== 0) fail("setup rename failed");
    var src = read(dir, "class_bible.js");
    var a = src.indexOf("// >>> CLASS BIBLE DATA\n"), b = src.indexOf("// <<< CLASS BIBLE DATA");
    if (a < 0 || b < 0) fail("the CLASS BIBLE DATA markers did not survive the rewrite");
    var body = src.slice(a + "// >>> CLASS BIBLE DATA\n".length, b);
    var v = new Function(body + "\nreturn {b:CLASS_BIBLE,x:CLASS_XP_LEVELS};")();
    var canon = "var CLASS_XP_LEVELS = " + JSON.stringify(v.x) + ";\n" +
      "var CLASS_BIBLE = " + JSON.stringify(v.b, null, 2) + ";\n";
    if (canon !== body) fail("class_bible.js data region is no longer canonical — the BIBLE EDITOR CONTRACT would red");
    pass("class_bible.js data region re-parses and re-stringifies byte-identically (canonical form held)");
    if (src.slice(0, a).indexOf("FORMAT RULES") < 0) fail("the class_bible header comments were lost");
    pass("class_bible.js header comments outside the markers are preserved verbatim");
  })();

  // ── ③ refusals leave every file byte-identical ─────────────────────────────────────────────
  [
    { label: "the new name is already a bible key", args: [SUBJECT, "Mirror Image"], want: "ALREADY a capability_bible key" },
    { label: "the old name is not a bible key", args: ["Nonexistent Cantrip", TARGET], want: "not a capability_bible key" },
    { label: "the old name is empty", args: ["", TARGET], want: "old name is empty" },
    { label: "the new name is empty", args: [SUBJECT, "   "], want: "new name is empty" },
    { label: "the old name carries a pipe", args: ["Misty|Step", TARGET], want: "may not contain" },
    { label: "the new name carries a pipe", args: [SUBJECT, "Fade|step"], want: "may not contain" },
    { label: "a display-case-only change is not a rename", args: [SUBJECT, "misty step"], want: "SAME bible key" }
  ].forEach(function (c) {
    var dir = scratch();
    var before = hashes(dir);
    var r = run(dir, c.args);
    if (r.status !== 1) fail("refusal '" + c.label + "' exited " + r.status + " (expected 1)\n" + r.out);
    if (r.out.indexOf("RENAME REFUSED") < 0) fail("refusal '" + c.label + "' was not LOUD\n" + r.out);
    if (r.out.indexOf(c.want) < 0) fail("refusal '" + c.label + "' did not say why (" + c.want + ")\n" + r.out);
    if (!sameHashes(before, hashes(dir))) fail("refusal '" + c.label + "' touched a file");
    pass("refuses (byte-identical): " + c.label);
  });

  // ── ④ --dry-run reports the plan and writes nothing ────────────────────────────────────────
  (function () {
    var dir = scratch();
    var before = hashes(dir);
    var r = run(dir, [SUBJECT, TARGET, "--dry-run"]);
    if (r.status !== 0) fail("dry run exited " + r.status + "\n" + r.out);
    // Hashes FIRST: the write boundary is the clause that matters, and checking the banner
    // before it would misattribute a mutation that writes anyway to "no banner".
    if (!sameHashes(before, hashes(dir))) fail("dry run wrote to a file");
    if (r.out.indexOf("DRY RUN") < 0) fail("dry run did not announce itself\n" + r.out);
    pass("--dry-run announces itself and leaves all four files byte-identical");

    ["capability_bible.js", "class_bible.js", "data.js"].forEach(function (f) {
      if (r.out.indexOf(f) < 0) fail("dry run did not report planned edits for " + f + "\n" + r.out);
    });
    if (r.out.indexOf("CAPABILITY_RENAMES +=") < 0) fail("dry run did not report the migration append\n" + r.out);
    pass("--dry-run prints the planned edits per file, migration entry included");
  })();

  // ── ⑤ a rename that would ORPHAN a reference restores everything and fails ──────────────────
  (function () {
    var dir = scratch();
    // An uncovered site: the old name as a bare token in an ANCS `traits` array. traits are
    // human-readable wizard prose, deliberately OUTSIDE the rewriter's spans — so it survives
    // the rewrite, the residue sweep catches it, and the whole rename must roll back.
    var d = read(dir, "data.js").replace('traits:["Darkvision 60ft","Fire Resistance -- half damage from fire"',
      'traits:["Darkvision 60ft","Misty Step","Fire Resistance -- half damage from fire"');
    if (d === read(dir, "data.js")) fail("the orphan fixture did not apply — the tiefling traits line moved");
    fs.writeFileSync(path.join(dir, "data.js"), d);
    var before = hashes(dir);

    var r = run(dir, [SUBJECT, TARGET]);
    if (r.status !== 1) fail("the orphaning rename exited " + r.status + " (expected 1)\n" + r.out);
    if (r.out.indexOf("RENAME FAILED") < 0) fail("the orphaning rename was not LOUD\n" + r.out);
    if (r.out.indexOf("RESTORED") < 0) fail("the failure did not report the restore\n" + r.out);
    if (r.out.indexOf("still carries the old name") < 0) fail("the failure did not name the orphan\n" + r.out);
    pass("an orphaning rename fails loudly and says which file still names the capability");

    if (!sameHashes(before, hashes(dir))) fail("the failed rename left files modified — the restore did not hold");
    pass("all files restored byte-identical after the failed rename");

    var ctx = load(dir);
    if (!ctx.capabilityLookup(SUBJECT)) fail("the restore did not bring the bible key back");
    if (ctx.CAPABILITY_RENAMES.length !== 0) fail("a failed rename left a migration entry behind");
    pass("the restore is semantic too: the old key resolves again and no migration entry was left");
  })();

  // ── ⑥ a second rename appends rather than replacing ────────────────────────────────────────
  (function () {
    var dir = scratch();
    if (run(dir, [SUBJECT, TARGET]).status !== 0) fail("first rename failed");
    var r = run(dir, ["Mirror Image", "Split Semblance"]);
    if (r.status !== 0) fail("second rename exited " + r.status + "\n" + r.out);
    var ctx = load(dir);
    if (ctx.CAPABILITY_RENAMES.length !== 2) fail("CAPABILITY_RENAMES is not append-only: " + JSON.stringify(ctx.CAPABILITY_RENAMES));
    if (ctx.CAPABILITY_RENAMES[0].from !== SUBJECT || ctx.CAPABILITY_RENAMES[1].from !== "Mirror Image")
      fail("CAPABILITY_RENAMES lost its order: " + JSON.stringify(ctx.CAPABILITY_RENAMES));
    pass("a second rename APPENDS to CAPABILITY_RENAMES, preserving the first entry and its order");
    if (!ctx.capabilityLookup("Split Semblance") || !ctx.capabilityLookup(TARGET))
      fail("one of the two renames did not survive the other");
    pass("both renamed capabilities resolve after two sequential renames");
  })();

  console.log("ALL GREEN — " + passed + " assertions passed (#221 rename-capability)");
} catch (e) {
  console.error("FAILED — " + (e && e.message));
  process.exitCode = 1;
} finally {
  scratches.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e2) { } });
}
