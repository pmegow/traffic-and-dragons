#!/usr/bin/env node
"use strict";

// Proves that the simplified server-first toolbar cannot silently grow the retired
// download, staged-addition, or draft-discard controls back. Mutations run in a
// disposable clone and the shared harness verifies byte-identical restoration.
var sabotage = require("./sabotage.js");

var page = "bible_editor.html";
var saveButton = '  <button class="primary" id="save" disabled>💾 Save (overwrite)</button>';

process.exit(sabotage.prove({
  file: page,
  cases: [
    { label: "Download copy stays retired", mustFail: "retired Download copy control",
      find: saveButton, replace: saveButton + '\n  <button id="download">⬇ Download copy</button>' },
    { label: "Capability additions stays retired", mustFail: "retired Capability additions control",
      find: saveButton, replace: saveButton + '\n  <button id="exp-adds">⬇ Capability additions</button>' },
    { label: "Capability additions counter stays unwired", mustFail: "counter is still wired",
      find: '  $("save").onclick = saveBible;',
      replace: '  $("save").onclick = saveBible;\n  $("addn").textContent = Object.keys(ADD).length;' },
    { label: "Discard draft stays retired", mustFail: "retired Discard draft control",
      find: saveButton, replace: saveButton + '\n  <button id="discard">Discard draft</button>' }
  ]
}));
