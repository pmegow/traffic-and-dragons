// The real save funnel retains campaign ownership across permission, folder and sharing awaits.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "ui-files.js",
  "command": [
    "node",
    [
      "dev/tests-440-render-job.js"
    ]
  ],
  "cases": [
    {
      "label": "permission completion ignores ownership",
      "find": "  return _ensureFolderPerm().then(function(haveFolder){\n    if(!liveSave())return false;",
      "replace": "  return _ensureFolderPerm().then(function(haveFolder){",
      "mustFail": "real Save permission await"
    },
    {
      "label": "folder completion records current campaign",
      "find": "      return exportToFolder(\"render\",blob,filename,job.campId,job.campName).then(function(toFolder){\n        if(!liveSave())return false;",
      "replace": "      return exportToFolder(\"render\",blob,filename,job.campId,job.campName).then(function(toFolder){",
      "mustFail": "real Save folder await"
    },
    {
      "label": "share completion records current campaign",
      "find": "    return shareImageFile(blob,filename).then(function(shared){\n      if(!liveSave())return false;",
      "replace": "    return shareImageFile(blob,filename).then(function(shared){",
      "mustFail": "real Save share await"
    },
    {
      "label": "folder destination falls back to active campaign",
      "find": "exportToFolder(\"render\",blob,filename,job.campId,job.campName)",
      "replace": "exportToFolder(\"render\",blob,filename)",
      "mustFail": "real Save folder await"
    },
    {
      "label": "receipt names active campaign after write await",
      "find": "var _fn=destinationLabel;",
      "replace": "var _fn=campaignFolderLabel(_campRootHandle&&_campRootHandle.name,activeCampFolderName());",
      "mustFail": "real folder write finishes"
    }
  ]
}));
