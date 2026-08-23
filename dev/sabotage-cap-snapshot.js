#!/usr/bin/env node
"use strict";

// Mutation proof for capability_bible.js coherence inside the Bible Editor.
// Each mutation runs in a disposable clone and must be caught by its named contract clause.
const sabotage = require("./scratch-contract-sabotage.js");

const cases = [
  { file: "bible_editor.html", label: "snapshot replacement removes keys absent from disk", mustFail: "replacement did not remove stale keys",
    find: "for (k in target) if (Object.prototype.hasOwnProperty.call(target, k)) delete target[k];",
    replace: "for (k in target) if (Object.prototype.hasOwnProperty.call(target, k)) target[k] = target[k];" },
  { file: "bible_editor.html", label: "opening or reloading the capability file refreshes the snapshot", mustFail: "opening or reloading capability_bible.js no longer refreshes",
    find: "capSnapshotSync(CAPABILITY_BIBLE, data.entries);", replace: "void data.entries;" },
  { file: "bible_editor.html", label: "successful capability saves refresh the snapshot", mustFail: "successful capability-bible save no longer refreshes",
    find: "capSnapshotSync(CAPABILITY_BIBLE, CUR.data.entries);", replace: "void CUR.data.entries;" },
  { file: "bible_editor.html", label: "spell browser dependency refresh installs fresh parsed entries", mustFail: "spell browser no longer refreshes its dependency loudly",
    find: "capSnapshotSync(CAPABILITY_BIBLE, st.entries);", replace: "void st.entries;" },
  { file: "bible_editor.html", label: "spell candidates wait for dependency refresh", mustFail: "spell browser can build candidates before its dependency refresh completes",
    find: "refreshCapabilityDependency(function () { showBibPicker(path, tier); });", replace: "showBibPicker(path, tier);" },
  { file: "bible_editor.html", label: "dependency refresh failures stay visible", mustFail: "spell browser no longer refreshes its dependency loudly",
    find: 'console.warn("[bible] capability dependency refresh failed:", m);', replace: "void m;" }
];

process.exit(sabotage.prove("BIBLE EDITOR CAP SNAPSHOT SABOTAGE", cases));
