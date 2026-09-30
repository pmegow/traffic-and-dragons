// dev/sabotage-481-f6-rename-stages.js — proves the #481 F6 guard: a folder rename has TWO stages with two messages. A copy
// that fails leaves the original as the complete folder; a removal that fails AFTER a complete copy leaves the NEW folder as
// the complete one, and the handle and the toast follow it. Fable: "Add a sabotage clause." The mutation runs in a
// disposable clone.
//   node dev/sabotage-481-f6-rename-stages.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "ui-files.js", command: ["node", ["dev/tests-438-folder-rename.js"]], cases: [
  { label: "a removal failure falls into the copy-failure handler again (the toast points at the incomplete original)",
    find: "        },function(e){\n          var why=(e&&e.message)||String(e);\n          _campRenameStored(newDir);\n          _campFolderHandle=newDir;_campFolderSlug=newSlug;",
    replace: "        },null&&function(e){\n          var why=(e&&e.message)||String(e);\n          _campRenameStored(newDir);\n          _campFolderHandle=newDir;_campFolderSlug=newSlug;",
    mustFail: "#481 F6 a removal that fails AFTER a complete copy" },
  { label: "the handle stays on the stale original after a complete copy",
    find: "          var why=(e&&e.message)||String(e);\n          _campRenameStored(newDir);\n          _campFolderHandle=newDir;_campFolderSlug=newSlug;",
    replace: "          var why=(e&&e.message)||String(e);",
    mustFail: "#481 F6 a removal that fails AFTER a complete copy" }
]}));
