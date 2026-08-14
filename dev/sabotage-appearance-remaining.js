#!/usr/bin/env node
"use strict";

// N15: each remaining APPEARANCE source clause gets its own named mutation in
// a disposable clone, including each of the six independent dirty-write paths.
const sabotage = require("./scratch-contract-sabotage.js");

function replaceNth(text, needle, replacement, nth) {
  let at = -1;
  for (let i = 0; i <= nth; i++) at = text.indexOf(needle, at + 1);
  return at < 0 ? text : text.slice(0, at) + replacement + text.slice(at + needle.length);
}

const cases = [
  { file: "ui-portrait.js", label: "Replace appearance honors a refused write", mustFail: "Replace handler no longer honours a refusal",
    find: "if(setAppear(desc)===false)return;", replace: "setAppear(desc);" },
  { file: "ui-portrait.js", label: "Append appearance honors a refused write", mustFail: "Append handler no longer honours a refusal",
    find: "if(setAppear((c.appear?c.appear+\" \":\"\")+desc)===false)return;",
    replace: "setAppear((c.appear?c.appear+\" \":\"\")+desc);" },
  { file: "ui-sheets.js", label: "NPC sheet supplies the appearance-writer seam", mustFail: "no longer supplies setAppearance",
    find: "      setAppearance:function(text){", replace: "      removedSetAppearance:function(text){" },
  { file: "ui-sheets.js", label: "NPC appearance targets durable charSheet state", mustFail: "no longer targets wsNpc.charSheet.appear",
    find: "wsNpc.charSheet.appear=text;saveAll();", replace: "wsNpc.appear=text;saveAll();" },
  { file: "ui-sheets.js", label: "sheet-less NPC refusal stays loud", mustFail: "sheet-less refusal message is gone",
    find: "No character sheet for ", replace: "Cannot store appearance for " },
  { file: "ui-portrait.js", label: "modal onClose routes through pmClose", mustFail: "onClose no longer routes through pmClose",
    find: "onClose:function(){pmClose();}", replace: "onClose:function(){modal.remove();}" }
];

const dirtyLabels = [
  "framing drag marks the sheet dirty",
  "portrait removal marks the sheet dirty",
  "data-URL portrait apply marks the sheet dirty",
  "fetched portrait apply marks the sheet dirty",
  "appearance replacement marks the sheet dirty",
  "appearance append marks the sheet dirty"
];
for (let i = 0; i < dirtyLabels.length; i++) {
  cases.push({
    file: "ui-portrait.js",
    label: dirtyLabels[i],
    mustFail: "write path in the portrait modal stopped marking the sheet stale",
    mutate: function (text) { return replaceNth(text, "_pmDirty=true", "_pmDirty=false", i); }
  });
}

process.exit(sabotage.prove("APPEARANCE REMAINING SABOTAGE", cases));
