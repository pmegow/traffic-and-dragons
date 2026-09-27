// dev/sabotage-470-party-upload.js — proves the one-click party upload is guarded: the plan takes only members with
// sheets, the run sends portable copies and survives a failure, the shell confirms before an overwrite and toasts
// every failure, and the menu item is wired. Each clause must fail one "#470" assertion of the "class bible" section.
//   node dev/sabotage-470-party-upload.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "class bible"]];
/* the scratch clone carries only the engine manifest + the suites; the shell pin reads these two UI files by path, so
   every prove must ship them or the pin fails on ENOENT and misattributes the mutation */
var UI = ["ui-boot.js", "ui-browsers.js"];
var rc = 0;

rc |= sabotage.prove({
  file: "helpers.js",
  command: CMD,
  also: UI,
  cases: [
    { label: "#470 — a sheetless companion is planned with an empty sheet",
      mustFail: "a sheetless companion must be skipped by the plan itself",
      find: "for(i=0;i<(companions||[]).length;i++){var c=companions[i];if(c&&c.charSheet)add(c.name,c.charSheet);}",
      replace: "for(i=0;i<(companions||[]).length;i++){var c=companions[i];if(c)add(c.name,c.charSheet||{});}" },
    { label: "#470 — the run sends the live sheet instead of a portable copy",
      mustFail: "the live sheet must not be sent",
      find: "    saveFn(portableSheet(row.sheet),function(err){",
      replace: "    saveFn(row.sheet,function(err){" },
    { label: "#470 — the run stops at the first failure",
      mustFail: "one save per row",
      find: "      if(err)report.failed.push({name:row.name,err:String(err)});else if(row.existing)report.updated.push(row.name);else report.saved.push(row.name);",
      replace: "      if(err){report.failed.push({name:row.name,err:String(err)});done(report);return;}else if(row.existing)report.updated.push(row.name);else report.saved.push(row.name);" }
  ]
});

rc |= sabotage.prove({
  file: "ui-browsers.js",
  command: CMD,
  also: ["ui-boot.js"],
  cases: [
    { label: "#470 — overwrites go through without a confirm",
      mustFail: "the shell must confirm when entries would be overwritten",
      find: "    if(!plan.overwrites.length){run();return;}",
      replace: "    run();return;" },
    { label: "#470 — a failed upload is logged but never shown",
      mustFail: "failures must reach a toast",
      find: "showToast(\"&#10007; \"+escHtml(r.failed[i].name)+\" was not uploaded: \"+escHtml(r.failed[i].err),9000);",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "ui-boot.js",
  command: CMD,
  also: ["ui-browsers.js"],
  cases: [
    { label: "#470 — the menu item is rendered but never wired",
      mustFail: "not wired",
      find: "  document.getElementById(\"fm-export-party\").addEventListener(\"click\",uploadPartyToLibrary);/* #470 */\n",
      replace: "" }
  ]
});

process.exit(rc);
