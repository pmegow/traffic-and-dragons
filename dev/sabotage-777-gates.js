// sabotage-777-gates.js — retained proof for audit 2026-11-19 (TODO #777), the small gate rows:
//   G5  dev/static-server.js: loopback only, containment by path, a malformed URL answered
//   G6  dev/install-bible.js: an item bible has its own check
//   G7  TODO_Atlas.md under the tracker gates (the lint, the column check, the hook, the workflow)
//   G8  dev/ci-status.js: a run that timed out or never started is red; the job has a timeout
//   G11 dev/bible-server.js: no reply readable by a foreign site, no crash on a malformed URL, one stage folder per upload
//   G12 dev/storage-keys.js: the census reads the pages too
// The #777 cases live in dev/tests-777-gates.js, which runs ONE named case under --only.
var sabotage = require("./sabotage.js");
var GATES = ["node", ["dev/tests-777-gates.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function gates(file, cases) { failed += sabotage.prove({ file: file, command: GATES, only: ONLY, cases: cases }); }

var G5_ROOT = "FAIL #777 G5: a path that leaves the root is refused";
gates("dev/static-server.js", [
  { label: "G5: the server listens on every interface again",
    find: "server.listen(PORT, host, function", replace: "server.listen(PORT, function",
    mustFail: "FAIL #777 G5: the server listens on the loopback addresses only" },
  { label: "G5: containment is a string prefix again (a sibling folder is served)",
    find: "if (!rel || path.isAbsolute(rel) || rel.split(/[\\\\\\/]/)[0] === \"..\") return { status: 403, why: \"forbidden\" };",
    replace: "if (file.indexOf(path.resolve(root)) !== 0) return { status: 403, why: \"forbidden\" };",
    mustFail: G5_ROOT },
  { label: "G5: a malformed escape throws out of the handler",
    find: "catch (e) { return { status: 400, why: \"malformed URL\" }; }", replace: "catch (e) { throw e; }",
    mustFail: "FAIL #777 G5: a malformed escape is answered 400" }
]);

failed += sabotage.prove({ file: "dev/install-bible.js", command: ["node", ["dev/tests-install-bible.js"]], cases: [
  { label: "G6: the item type falls into the capability check again",
    find: "} else if (typeKey === \"item\") {", replace: "} else if (false) {",
    mustFail: "truncated item bible — refusal/status/hash contract failed" },
  { label: "G6: an item entry with no category is installed",
    find: "typeof e.category !== \"string\" || !e.category; });", replace: "false; });",
    mustFail: "item entry with no category — refusal/status/hash contract failed" },
  { label: "G6: an item bible that lost most of its entries replaces the full one",
    find: "if (itemKeys.length * 2 < curCount)", replace: "if (false)",
    mustFail: "item bible that lost most of its entries — refusal/status/hash contract failed" }
] });

var G7_CI = "FAIL #777 G7: CI's id pass reads the atlas tracker";
var G7_HOOK = "FAIL #777 G7: the hook's --staged runs read the atlas file from the index";
gates("dev/lint-todo.js", [
  { label: "G7: CI's id pass is not handed the atlas file",
    find: "if (opts.atlasFile) _atlasTodoText = fs.readFileSync(opts.atlasFile, \"utf8\");", replace: "if (false) _atlasTodoText = \"\";",
    mustFail: G7_CI },
  { label: "G7: --staged reads TODO.md whatever the tracker",
    find: "candidateText = opts.staged ? readGit(\":\" + NAME)", replace: "candidateText = opts.staged ? readGit(\":TODO.md\")",
    mustFail: G7_HOOK },
  { label: "G7: any file name is taken as a tracker",
    find: "if (TRACKERS.indexOf(opts.tracker) < 0) throw", replace: "if (false) throw",
    mustFail: "FAIL #777 G7: --tracker TODO_Atlas.md runs the shape pass over the atlas file" }
]);
gates("dev/check-todo-columns.js", [
  { label: "G7: the staged column check reads TODO.md whatever the tracker",
    find: "[\"show\", \":\" + tracker]", replace: "[\"show\", \":TODO.md\"]", mustFail: G7_HOOK }
]);
gates("dev/pre-commit", [
  { label: "G7: the hook no longer lints TODO_Atlas.md",
    find: "--git-aware --staged --cap --tracker TODO_Atlas.md", replace: "--git-aware --staged --cap", mustFail: G7_HOOK },
  { label: "G7: the hook no longer checks TODO_Atlas.md's columns",
    find: "check-todo-columns.js\" --staged --tracker TODO_Atlas.md", replace: "check-todo-columns.js\" --staged", mustFail: G7_HOOK }
]);
gates(".github/workflows/engine-tests.yml", [
  { label: "G7: CI's id pass loses the atlas file",
    find: " --atlas-file {file:TODO_Atlas.md}", replace: "", mustFail: G7_HOOK },
  { label: "G7: CI no longer lints TODO_Atlas.md per commit",
    find: "--cap-changed --tracker TODO_Atlas.md --file {file:TODO_Atlas.md}", replace: "--cap-changed --file {file:TODO.md}", mustFail: G7_HOOK }
]);

failed += sabotage.prove({ file: "dev/ci-status.js", command: ["node", ["dev/tests-646-ci-status.js"]], cases: [
  { label: "G8: only a plain failure is red again (a timed-out run is passed over)",
    find: "var RED = { failure: 1, timed_out: 1, startup_failure: 1, action_required: 1 };", replace: "var RED = { failure: 1 };",
    mustFail: "FAIL #646 G8: a newest run that timed out" }
] });
failed += sabotage.prove({ file: ".github/workflows/engine-tests.yml", command: ["node", ["dev/tests-646-ci-status.js"]], cases: [
  { label: "G8: the Engine tests job has no timeout",
    find: "    timeout-minutes: 240\n", replace: "",
    mustFail: "FAIL #646 G8: the Engine tests job has a timeout" }
] });

var G11 = "FAIL #777 G11: a foreign website cannot read the bible server's replies";
gates("dev/bible-server.js", [
  { label: "G11: every origin may read a reply again",
    find: "if (origin && (origin === \"null\" || LOCAL_ORIGIN.test(origin))) {", replace: "if (origin) {", mustFail: G11 },
  { label: "G11: /health names the folder and the process to any asker",
    find: "if (!req.headers[\"origin\"] || LOCAL_ORIGIN.test(req.headers[\"origin\"])) { health.pid", replace: "if (true) { health.pid", mustFail: G11 },
  { label: "G11: a malformed escape stops the server",
    find: "catch (e) { return false; }   /* G11", replace: "catch (e) { throw e; }   /* G11", mustFail: G11 },
  { label: "G11: uploads share one fixed temp path",
    find: "stage = fs.mkdtempSync(path.join(os.tmpdir(), \"bible-upload-\")); tmp = path.join(stage, \"capability_bible_upload.js\");",
    replace: "stage = path.join(os.tmpdir(), \"bible-upload-one\"); tmp = path.join(os.tmpdir(), \"capability_bible_upload.js\");",
    mustFail: "FAIL #777 G11: each upload is staged in a folder of its own" }
]);

gates("dev/storage-keys.js", [
  { label: "G12: the census reads the .js files alone again",
    find: "[^/]+\\.(?:js|html)$/;", replace: "[^/]+\\.(?:js)$/;",
    mustFail: "FAIL #777 G12: a key that lives only in a satellite page's inline script is in the census" }
]);

process.exit(failed ? 1 : 0);
