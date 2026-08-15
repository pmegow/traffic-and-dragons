#!/usr/bin/env node
"use strict";

// N14: retained proof for the FEAT MOVE and CAP EDIT families plus the
// capability serializer's dirty-entry path. All mutations use a scratch clone.
const sabotage = require("./scratch-contract-sabotage.js");

function replaceNth(text, needle, replacement, nth) {
  let at = -1;
  for (let i = 0; i <= nth; i++) at = text.indexOf(needle, at + 1);
  return at < 0 ? text : text.slice(0, at) + replacement + text.slice(at + needle.length);
}

const page = "bible_editor.html";
const cases = [
  { file: page, label: "feat move refuses an out-of-range source", mustFail: "out-of-range source index",
    find: "srcIdx < 0 || srcIdx >= srcArr.length", replace: "srcIdx < 0" },
  { file: page, label: "feat move clamps a negative destination", mustFail: "negative destination index",
    find: "if (dstIdx < 0) dstIdx = 0;", replace: "if (dstIdx < 0) dstIdx = dstArr.length;" },
  { file: page, label: "feat move clamps an over-long destination", mustFail: "over-long destination index",
    find: "if (dstIdx > dstArr.length) dstIdx = dstArr.length;", replace: "if (dstIdx > dstArr.length) dstIdx = 0;" },
  { file: page, label: "feat move adjusts a same-list downward index", mustFail: "same-list DOWNWARD move",
    find: "if (dstIdx > srcIdx) dstIdx--;", replace: "" },
  { file: page, label: "feat move reports a same-position no-op", mustFail: "own position must be a no-op",
    find: "if (dstIdx === srcIdx) return false;", replace: "" },
  { file: page, label: "feat move removes the source item", mustFail: "cross-list move broken",
    find: "var it = srcArr.splice(srcIdx, 1)[0];", replace: "var it = srcArr[srcIdx];" },
  { file: page, label: "feat move inserts at the requested destination", mustFail: "same-list DOWNWARD move",
    find: "dstArr.splice(dstIdx, 0, it);", replace: "dstArr.push(it);" },
  { file: page, label: "feat move reports a successful mutation", mustFail: "cross-list move broken",
    find: "dstArr.splice(dstIdx, 0, it);\n    return true;", replace: "dstArr.splice(dstIdx, 0, it);\n    return false;" },
  { file: page, label: "feature rows retain their data-frow address", mustFail: "feature rows no longer carry",
    find: "data-frow='", replace: "data-row='" },
  { file: page, label: "feature rows retain a visible drag grip", mustFail: "feature rows no longer carry",
    find: "class='grip'", replace: "class='handle'" },
  { file: page, label: "wireClass routes drops through moveFeat", mustFail: "wireClass never routes a drop",
    find: "        moveFeat(p, this.getAttribute(\"data-flist\"), idx);",
    replace: "        render();" },

  { file: page, label: "cap edit replaces the matched object", mustFail: "a hit must replace the entry object",
    find: "entries[i].obj = obj; entries[i].dirty = true; return true;",
    replace: "entries[i].dirty = true; return true;" },
  { file: page, label: "cap edit marks the matched entry dirty", mustFail: "a hit must replace the entry object",
    find: "entries[i].obj = obj; entries[i].dirty = true; return true;",
    replace: "entries[i].obj = obj; return true;" },
  { file: page, label: "cap edit leaves other entries untouched", mustFail: "must not touch other entries",
    find: "entries[i].dirty = true; return true;",
    replace: "entries[i].dirty = true; entries[(i + 1) % entries.length].dirty = true; return true;" },
  { file: page, label: "cap edit refuses an unknown key without inventing it", mustFail: "unknown key must be refused",
    find: "    return false;\n  }\n  // <<< CAP EDIT",
    replace: "    entries.push({ key: key, obj: obj, dirty: true }); return false;\n  }\n  // <<< CAP EDIT" },
  { file: page, label: "showCard retains the edit control", mustFail: "showCard no longer offers",
    find: "id='m-edit'", replace: "id='m-edit-removed'" },
  { file: page, label: "showCard routes edits through capForm", mustFail: "showCard no longer offers",
    find: "      capForm(key, deep(entry), function (o) {", replace: "      removedCapForm(key, deep(entry), function (o) {" },
  { file: page, label: "successful Add closes its form", mustFail: "successful Add to Bible does not close its form",
    find: "function () { closeModal(); delete ADD[ak]; render(); }",
    replace: "function () { delete ADD[ak]; render(); }" },
  { file: page, label: "capability file is detected before it is parsed", mustFail: "verifies the local project file",
    find: "if (!BIBLE_TYPES[\"capability\"].detect(g.text))", replace: "if (false)" },
  { file: page, label: "capability update reads the checkout's fresh bible", mustFail: "reads capability_bible.js fresh",
    find: 'fetch(BSRV + "/bible")', replace: 'fetch(BSRV + "/missing")' },
  { file: page, label: "validated local install refreshes the in-page capability", mustFail: "refreshes the in-page CAPABILITY_BIBLE",
    find: "          CAPABILITY_BIBLE[key] = obj;", replace: "" },
  { file: page, label: "capability update never creates a writable handle", mustFail: "Bible Editor still contains an alternate Save-as/download write path",
    find: "  function updateShippedCapability(key, obj, onDone, allowCreate) {",
    replace: "  function updateShippedCapability(key, obj, onDone, allowCreate) {\n    createWritable();" },
  { file: page, label: "capability update never opens a save picker", mustFail: "download or file-picker fallback",
    find: "  function updateShippedCapability(key, obj, onDone, allowCreate) {",
    replace: "  function updateShippedCapability(key, obj, onDone, allowCreate) {\n    showOpenFilePicker();" },
  { file: page, label: "capability update never downloads a substitute", mustFail: "Bible Editor still contains an alternate Save-as/download write path",
    find: "  function updateShippedCapability(key, obj, onDone, allowCreate) {",
    replace: "  function updateShippedCapability(key, obj, onDone, allowCreate) {\n    var a = document.createElement(\"a\"); a.download = \"capability_bible.js\";" },
  { file: page, label: "local writer failure stays explicit", mustFail: "does not loudly preserve the edit",
    find: 'm = "local project writer is unavailable — reopen this editor with Bible Editor.cmd";\n      note("✗ Update Bible failed:',
    replace: 'm = "save failed";\n      note("✗ Update Bible failed:' },
  { file: page, label: "failed async save keeps the form open", mustFail: "capForm closes unconditionally",
    find: "if (onSave(draft) !== false) closeModal();", replace: "onSave(draft); closeModal();" },
  { file: page, label: "dirty capability entries use the canonical emitter", mustFail: "dirty edit path ignored",
    find: "var body = e.dirty ? emit(e.key, e.obj) : e.line.replace(/,\\s*$/, \"\");",
    replace: "var body = e.line.replace(/,\\s*$/, \"\");" }
];

process.exit(sabotage.prove("BIBLE EDITOR REMAINING SABOTAGE", cases));
