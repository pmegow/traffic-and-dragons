// engine-manifest.js — THE single ordered engine-file list, consumed by BOTH hosts
// (ChatGPT review 2026-08-01, finding 5 — the #17 rot class, closed for good):
//   • node:    dev/load-engine.js derives FILES from it (require)
//   • browser: test.html loads it as a plain script and document.writes the tags from it,
//              and derives its per-file load-guard from the sym column
// Each entry: { file, sym } — sym is a symbol the file defines at global scope, used by
// test.html's load guard to name a missing/404'd file LOUDLY instead of showering dozens
// of mystery-red assertions (#17's failure mode).
//
// ORDER MATTERS: index.html's load order minus the DOM-wiring files (wasm-probe.js,
// char-creation.js, ui-*.js, stt.js), with class_bible.js slotted after capability_bible.js
// (#72: not in index.html's shell until C6-② — it loads here so the structural tests and the
// BIBLE EDITOR CONTRACT see it, in its eventual real position). That relationship is
// MECHANICALLY ENFORCED against index.html by the ENGINE MANIFEST CONTRACT in run-tests.js —
// adding an engine file to index.html without adding it here fails the build.
var ENGINE_MANIFEST = [
  { file: "globals.js",            sym: "APP_VERSION" },
  { file: "error-report.js",       sym: "reportError" },
  { file: "compress.js",           sym: "LZ" },
  { file: "data.js",               sym: "TONES" },
  { file: "capability_bible.js",   sym: "CAPABILITY_BIBLE" },
  { file: "class_bible.js",        sym: "CLASS_BIBLE" },
  { file: "helpers.js",            sym: "skillLevel" },
  { file: "state.js",              sym: "blankMemory" },
  { file: "storage-adapter.js",    sym: "storageAdapter" },
  { file: "memory.js",             sym: "resolveNpcName" },
  { file: "clock.js",              sym: "clockAdvance" },
  { file: "tag_table.js",          sym: "TAG_TABLE" },
  { file: "api.js",                sym: "buildSysPrompt" },
  { file: "table-talk.js",         sym: "ttMenuOutline" },
  { file: "campaign_generator.js", sym: "validateSkeletonStructure" },
  { file: "game.js",               sym: "checkLevelUp" },
  { file: "tts.js",                sym: "TTS" },
  { file: "sound.js",              sym: "Sound" }
];
if (typeof module !== "undefined" && module.exports) module.exports = ENGINE_MANIFEST;
