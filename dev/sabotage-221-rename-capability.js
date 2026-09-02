// sabotage-221-rename-capability.js — mutation proof for TODO #221's rename tool.
//
// The battery in dev/tests-221-rename-capability.js is only worth what it CATCHES. Each clause
// below removes one load-bearing piece of dev/rename-capability.js — a rewrite site, the save
// migration, the roll-back, a refusal, the dry-run boundary — and the battery must red on it,
// attributably. A mutation that changes no bytes is a HARD failure of this harness, so a clause
// whose `find` rots is loud rather than quietly green.
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-221-rename-capability.js"]];

process.exit(sabotage.prove({
  file: "dev/rename-capability.js",
  command: CMD,
  also: ["dev/tests-221-rename-capability.js"],
  cases: [
    {
      label: "the class_bible rewrite is skipped (spell arrays keep the retired name)",
      mustFail: "happy path exited",
      find: '  planned["class_bible.js"] = rb.text;',
      replace: '  planned["class_bible.js"] = originals["class_bible.js"];'
    },
    {
      label: "the CAPABILITY_RENAMES append is skipped (every saved character silently orphans)",
      mustFail: "did not receive the migration entry",
      find: '  planned["data.js"] = ra.text;',
      replace: '  planned["data.js"] = rd.text;'
    },
    {
      label: "the racial_caps spans are not scanned (ANCS references keep the retired name)",
      mustFail: "happy path exited",
      find: '  while ((i = src.indexOf("racial_caps:", from)) >= 0) {',
      replace: '  while (false && (i = src.indexOf("racial_caps:", from)) >= 0) {'
    },
    {
      label: "restore-on-failure is dropped (a failed rename leaves the tree half-renamed)",
      mustFail: "restore did not hold",
      find: "  if (problem) { restore(); dieRestored(problem); }",
      replace: "  if (problem) { dieRestored(problem); }"
    },
    {
      label: "the already-exists refusal is dropped (a rename fuses two capabilities)",
      mustFail: "already a bible key' exited",
      find: "  if (Object.prototype.hasOwnProperty.call(bibleData, newKey))",
      replace: "  if (false && Object.prototype.hasOwnProperty.call(bibleData, newKey))"
    },
    {
      label: "the pipe refusal is dropped (a tag-operand separator enters a capability name)",
      mustFail: "may not contain",
      find: '  if (String(oldName).indexOf("|") >= 0 || String(newName).indexOf("|") >= 0)',
      replace: '  if (false)'
    },
    {
      label: "--dry-run stops short-circuiting (a preview writes the files)",
      mustFail: "dry run wrote to a file",
      find: "  if (args.dryRun) {",
      replace: "  if (false) {"
    }
  ]
}));
