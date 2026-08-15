#!/usr/bin/env node
"use strict";

// Proves the class-view Add to Bible action is a real upsert: it creates a missing
// capability, replaces an existing one without duplication, and cannot lose its
// create permission through a fragile call-site change. Mutations run in a clone.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "bible_editor.html",
  cases: [
    { label: "missing spell is appended",
      mustFail: "a missing spell must append one dirty capability entry",
      find: "if (allowCreate) { entries.push({ key: key, obj: obj, dirty: true }); return true; }",
      replace: "if (false) { entries.push({ key: key, obj: obj, dirty: true }); return true; }" },
    { label: "existing spell is replaced without duplication",
      mustFail: "an existing spell must be replaced in place, never duplicated",
      find: "if (entries[i].key === key) { entries[i].obj = obj; entries[i].dirty = true; return true; }",
      replace: "if (entries[i].key === key) { if (allowCreate) { entries.push({ key: key, obj: obj, dirty: true }); return true; } entries[i].obj = obj; entries[i].dirty = true; return true; }" },
    { label: "button stays on the named upsert path",
      mustFail: "button is not wired to the named capability upsert path",
      find: "upsertShippedCapability(ak, o",
      replace: "updateShippedCapability(ak, o" },
    { label: "upsert path keeps create permission",
      mustFail: "upsert path no longer enables creation",
      find: "updateShippedCapability(key, obj, onDone, true);",
      replace: "updateShippedCapability(key, obj, onDone, false);" }
  ]
}));
