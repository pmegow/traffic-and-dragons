#!/usr/bin/env node
"use strict";

// Synthetic refusal/write-boundary fixtures for install-bible.js. The installer
// and both targets live in a disposable project; tracked canon is never opened.
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-install-bible-"));
const dev = path.join(scratch, "dev");
fs.mkdirSync(dev);
fs.copyFileSync(path.join(__dirname, "install-bible.js"), path.join(dev, "install-bible.js"));
const installer = path.join(dev, "install-bible.js");

function classSource(options) {
  options = options || {};
  const classCount = options.classCount === undefined ? 9 : options.classCount;
  const levelCount = options.levelCount === undefined ? 14 : options.levelCount;
  const archetypeCount = options.archetypeCount === undefined ? 3 : options.archetypeCount;
  const archetypeLevels = options.archetypeLevels === undefined ? 4 : options.archetypeLevels;
  const fillCount = options.fillCount === undefined ? 100 : options.fillCount;
  const xpCount = options.xpCount === undefined ? 20 : options.xpCount;
  let slot = 0;
  const bible = {};
  for (let ci = 0; ci < classCount; ci++) {
    const entry = { marker: options.marker || "base", levels: {}, archetypes: [] };
    for (let lv = 1; lv <= levelCount; lv++) {
      entry.levels[lv] = { features: slot++ < fillCount ? ["feature"] : [] };
    }
    for (let ai = 0; ai < archetypeCount; ai++) {
      const archetype = { levels: {} };
      for (let al = 1; al <= archetypeLevels; al++) {
        archetype.levels[al] = { features: slot++ < fillCount ? ["feature"] : [] };
      }
      entry.archetypes.push(archetype);
    }
    bible["class" + ci] = entry;
  }
  const xp = Array.from({ length: xpCount }, function (_, i) { return i; });
  return "var CLASS_BIBLE = " + JSON.stringify(bible) + ";\n" +
    "var CLASS_XP_LEVELS = " + JSON.stringify(xp) + ";\n";
}

function capabilitySource(count, uppercase, marker) {
  const bible = {};
  for (let i = 0; i < count; i++) bible[(uppercase && i === 0 ? "BadKey" : "ability" + i)] = { marker: marker || "base" };
  return "var CAPABILITY_BIBLE = " + JSON.stringify(bible) + ";\n";
}

const classTarget = path.join(scratch, "class_bible.js");
const capabilityTarget = path.join(scratch, "capability_bible.js");
fs.writeFileSync(classTarget, classSource({ fillCount: 100 }));
fs.writeFileSync(capabilityTarget, capabilitySource(100, false, "current"));

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

let serial = 0;
function runSource(text, extraArgs) {
  const src = path.join(scratch, "incoming-" + (++serial) + ".js");
  fs.writeFileSync(src, text);
  return {
    src: src,
    result: cp.spawnSync(process.execPath, [installer, src].concat(extraArgs || []), {
      cwd: scratch,
      encoding: "utf8"
    })
  };
}

let passed = 0;
function output(result) { return (result.stdout || "") + (result.stderr || ""); }
function pass(label) { console.log("PASS " + label); passed++; }
function refusal(label, text, target, phrase) {
  const before = hash(target);
  const run = runSource(text);
  const after = hash(target);
  if (run.result.status === 0 || output(run.result).indexOf(phrase) < 0 || before !== after) {
    throw new Error(label + " — refusal/status/hash contract failed\n" + output(run.result));
  }
  pass(label + " (target hash unchanged)");
}

try {
  refusal("empty download", "", classTarget, "download is EMPTY");
  refusal("invalid JavaScript", "var CLASS_BIBLE = ;", classTarget, "not valid JavaScript");
  refusal("missing class global", "var SOMETHING_ELSE = {};", classTarget, "does not define CLASS_BIBLE");
  refusal("wrong class count", classSource({ classCount: 8 }), classTarget, "expected 9 classes");
  refusal("malformed archetypes", classSource({ archetypeCount: 2 }), classTarget, "malformed (levels/archetypes)");
  refusal("wrong slot count", classSource({ levelCount: 13 }), classTarget, "expected 234 level slots");
  refusal("wrong XP length", classSource({ xpCount: 19 }), classTarget, "XP curve is not 20 levels");
  refusal("stale class draft", classSource({ fillCount: 99, marker: "stale" }), classTarget,
    "FEWER filled level slots");
  refusal("truncated capability bible", capabilitySource(99), capabilityTarget, "looks truncated");
  refusal("uppercase capability key", capabilitySource(100, true), capabilityTarget, "not lowercase");

  const dryText = classSource({ fillCount: 101, marker: "dry-run" });
  const dryBefore = hash(classTarget);
  const dry = runSource(dryText, ["--dry-run"]).result;
  if (dry.status !== 0 || hash(classTarget) !== dryBefore || output(dry).indexOf("DRY RUN") < 0)
    throw new Error("dry-run boundary failed\n" + output(dry));
  pass("dry-run validates without writing");

  const identicalBefore = hash(classTarget);
  const identical = runSource(fs.readFileSync(classTarget, "utf8")).result;
  if (identical.status !== 0 || hash(classTarget) !== identicalBefore || output(identical).indexOf("identical") < 0)
    throw new Error("identical no-op failed\n" + output(identical));
  pass("identical input is a no-op");

  const installText = classSource({ fillCount: 101, marker: "installed" });
  const install = runSource(installText).result;
  if (install.status !== 0 || fs.readFileSync(classTarget, "utf8") !== installText)
    throw new Error("valid write boundary failed\n" + output(install));
  pass("validated input alone reaches the write boundary");

  console.log("ALL GREEN — " + passed + " install-bible fixtures");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
