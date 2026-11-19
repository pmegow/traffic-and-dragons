// dev/tests-777-gates.js — audit 2026-11-19 (TODO #777), the small gate rows: the dev servers and census tools the
// workflow leans on. One suite; each case names its audit row.
//   node dev/tests-777-gates.js            every case
//   node dev/tests-777-gates.js --only G5  the cases whose name contains the text
var assert = require("assert/strict"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
var ROOT = path.join(__dirname, "..");
var only = process.argv.indexOf("--only") >= 0 ? process.argv[process.argv.indexOf("--only") + 1] : "";
var cases = [], passed = 0, failed = 0;
function test(name, fn) { if (!only || name.indexOf(only) >= 0) cases.push({ name: name, fn: fn }); }
function get(port, host, rawPath) {
  return new Promise(function (resolve, reject) {
    var req = http.request({ host: host, port: port, path: rawPath, method: "GET" }, function (res) {
      var body = ""; res.setEncoding("utf8"); res.on("data", function (d) { body += d; }); res.on("end", function () { resolve({ status: res.statusCode, body: body }); });
    });
    req.on("error", reject); req.end();
  });
}

// ── G5: dev/static-server.js ────────────────────────────────────────────────────────────────────────────────────────
var ss = require("./static-server.js");
test("G5: a path that leaves the root is refused — a sibling folder whose name starts with the root's name included", function () {
  var base = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-777-static-")), root = path.join(base, "repo"), sibling = path.join(base, "repo-server");
  try {
    fs.mkdirSync(root); fs.mkdirSync(sibling); fs.mkdirSync(path.join(root, "sub"));
    fs.writeFileSync(path.join(root, "index.html"), "INDEX"); fs.writeFileSync(path.join(root, "sub", "a.txt"), "INSIDE");
    fs.writeFileSync(path.join(sibling, "secret.txt"), "OUTSIDE THE REPO");
    assert.equal(ss.located(root, "/").file, path.join(root, "index.html"));
    assert.equal(ss.located(root, "/sub/a.txt?x=1").status, 200);
    assert.equal(ss.located(root, "/sub/../sub/a.txt").file, path.join(root, "sub", "a.txt"));
    ["/..%2frepo-server%2fsecret.txt", "/../repo-server/secret.txt", "/..%5crepo-server%5csecret.txt", "/sub/..%2f..%2frepo-server/secret.txt", "/..", "/%2e%2e/%2e%2e/x"].forEach(function (u) {
      var at = ss.located(root, u);
      assert.equal(at.status, 403, u + " resolved to " + at.file);
    });
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
test("G5: a malformed escape is answered 400 — the server process survives it", function () {
  assert.equal(ss.located(ROOT, "/%").status, 400);
  assert.equal(ss.located(ROOT, "/a%00b").status, 400);
  var base = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-777-static-live-"));
  fs.writeFileSync(path.join(base, "index.html"), "INDEX");
  fs.mkdirSync(base + "-other"); fs.writeFileSync(path.join(base + "-other", "secret.txt"), "OUTSIDE");
  var server = http.createServer(ss.handler(base));
  return new Promise(function (resolve) { server.listen(0, "127.0.0.1", resolve); }).then(function () {
    var port = server.address().port;
    return get(port, "127.0.0.1", "/%").then(function (bad) {
      assert.equal(bad.status, 400);
      return get(port, "127.0.0.1", "/..%2f" + path.basename(base) + "-other%2fsecret.txt");
    }).then(function (out) {
      assert.equal(out.status, 403, "a sibling folder was served: " + out.body);
      return get(port, "127.0.0.1", "/");
    }).then(function (ok) { assert.equal(ok.status, 200); assert.equal(ok.body, "INDEX"); });
  }).finally(function () { server.close(); fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(base + "-other", { recursive: true, force: true }); });
});
test("G5: the server listens on the loopback addresses only", function () {
  assert.deepEqual(ss.LOOPBACK, ["127.0.0.1", "::1"]);
  var src = fs.readFileSync(path.join(__dirname, "static-server.js"), "utf8");
  assert.ok(/server\.listen\(PORT, host,/.test(src), "listen() must name its host — with none it binds every interface");
  assert.ok(!/\.listen\(\s*(PORT|8123)\s*[,)]\s*(function|\))/.test(src), "a listen() with no host is back");
});

// ── G7: TODO_Atlas.md under the tracker gates ───────────────────────────────────────────────────────────────────────
var cp = require("child_process");
function node(args, cwd) { var r = cp.spawnSync(process.execPath, args, { cwd: cwd || ROOT, encoding: "utf8" }); return { status: r.status, out: String(r.stdout || "") + String(r.stderr || "") }; }
function table(rows) { return "# tracker\n\n| # | Task | Status |\n|---|---|---|\n" + rows.map(function (r) { return "| " + r[0] + " | " + r[1] + " | ○ |"; }).join("\n") + "\n"; }
test("G7: CI's id pass reads the atlas tracker — a TODO.md row that reuses an atlas row's number fails", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-777-atlas-"));
  try {
    var todo = path.join(tmp, "todo.md"), atlas = path.join(tmp, "atlas.md"), arch = path.join(tmp, "arch.md");
    fs.writeFileSync(todo, table([[900, "a row"], [775, "a second use of an atlas number"]]));
    fs.writeFileSync(atlas, table([[775, "the atlas row"]]));
    fs.writeFileSync(arch, table([[1, "closed"]]));
    var ci = ["dev/lint-todo.js", "--git-aware", "--cap-changed", "--file", todo, "--head-file", todo, "--archive-file", arch, "--head-archive", arch];
    var seen = node(ci.concat(["--atlas-file", atlas]));
    assert.notEqual(seen.status, 0, "the reused number passed: " + seen.out);
    assert.match(seen.out, /row #775 is used 2 times/);
    assert.match(seen.out, /TODO_Atlas\.md:5/);
    fs.writeFileSync(atlas, table([[776, "the atlas row"]]));
    assert.equal(node(ci.concat(["--atlas-file", atlas])).status, 0, "distinct numbers must pass");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test("G7: --tracker TODO_Atlas.md runs the shape pass over the atlas file and names it; an unknown tracker is refused", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-777-atlas-shape-"));
  try {
    var head = path.join(tmp, "head.md"), cand = path.join(tmp, "cand.md");
    fs.writeFileSync(head, table([[775, "the atlas row"]]));
    fs.writeFileSync(cand, table([[775, "the atlas row"]]).replace("| ○ |\n", "\n| ○ |\n"));   // the row wraps onto a second line
    var bad = node(["dev/lint-todo.js", "--git-aware", "--tracker", "TODO_Atlas.md", "--file", cand, "--head-file", head]);
    assert.notEqual(bad.status, 0, "a wrapped atlas row passed: " + bad.out);
    assert.match(bad.out, /TODO_Atlas\.md TABLE INTEGRITY FAILED/);
    var good = node(["dev/lint-todo.js", "--git-aware", "--tracker", "TODO_Atlas.md", "--file", head, "--head-file", head]);
    assert.equal(good.status, 0, good.out); assert.match(good.out, /TODO_Atlas\.md tables OK/);
    var unknown = node(["dev/lint-todo.js", "--tracker", "TODO_Other.md"]);
    assert.notEqual(unknown.status, 0); assert.match(unknown.out, /the tracker files are TODO\.md and TODO_Atlas\.md/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test("G7: the hook's --staged runs read the atlas file from the index (a fixture repository), and both gates name both trackers", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-777-atlas-staged-")), env = {};
  Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
  function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"].concat(args), { cwd: tmp, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + r.stderr + r.stdout); }
  function tool(args) { var r = cp.spawnSync(process.execPath, args, { cwd: tmp, env: env, encoding: "utf8" }); return { status: r.status, out: String(r.stdout || "") + String(r.stderr || "") }; }
  try {
    fs.mkdirSync(path.join(tmp, "dev")); fs.mkdirSync(path.join(tmp, "DOC"));
    ["lint-todo.js", "check-todo-columns.js"].forEach(function (f) { fs.copyFileSync(path.join(__dirname, f), path.join(tmp, "dev", f)); });
    fs.writeFileSync(path.join(tmp, "TODO.md"), table([[900, "a row"]]));
    fs.writeFileSync(path.join(tmp, "TODO_Atlas.md"), table([[775, "the atlas row"]]));
    fs.writeFileSync(path.join(tmp, "DOC", "TODO_ARCHIVE.md"), table([[1, "closed"]]));
    git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "base"]);
    assert.equal(tool(["dev/lint-todo.js", "--git-aware", "--staged", "--cap", "--tracker", "TODO_Atlas.md"]).status, 0);
    assert.equal(tool(["dev/check-todo-columns.js", "--staged", "--tracker", "TODO_Atlas.md"]).status, 0);
    // a row with a raw pipe in its prose: four columns in a three-column table
    fs.writeFileSync(path.join(tmp, "TODO_Atlas.md"), table([[775, "the atlas row | spilled"]])); git(["add", "TODO_Atlas.md"]);
    var cols = tool(["dev/check-todo-columns.js", "--staged", "--tracker", "TODO_Atlas.md"]);
    assert.notEqual(cols.status, 0, "a spilled column in the staged atlas file passed: " + cols.out);
    assert.match(cols.out, /staged TODO_Atlas\.md/);
    assert.equal(tool(["dev/check-todo-columns.js", "--staged"]).status, 0, "the TODO.md run must not read the atlas file");
    fs.writeFileSync(path.join(tmp, "TODO_Atlas.md"), table([[775, "the atlas row"]]).replace("| ○ |\n", "\n| ○ |\n")); git(["add", "TODO_Atlas.md"]);
    var shape = tool(["dev/lint-todo.js", "--git-aware", "--staged", "--cap", "--tracker", "TODO_Atlas.md"]);
    assert.notEqual(shape.status, 0, "a wrapped row in the staged atlas file passed: " + shape.out);
    assert.match(shape.out, /TODO_Atlas\.md TABLE INTEGRITY FAILED/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  var hook = fs.readFileSync(path.join(__dirname, "pre-commit"), "utf8"), wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "engine-tests.yml"), "utf8");
  assert.ok(hook.indexOf('dev/lint-todo.js" --git-aware --staged --cap --tracker TODO_Atlas.md') >= 0, "the hook does not lint TODO_Atlas.md");
  assert.ok(hook.indexOf('dev/check-todo-columns.js" --staged --tracker TODO_Atlas.md') >= 0, "the hook does not check TODO_Atlas.md's columns");
  assert.ok(/lint-todo\.js --git-aware --cap-changed --file \{file:TODO\.md\}[^\n]*--atlas-file \{file:TODO_Atlas\.md\}/.test(wf), "CI's id pass is not handed the atlas file");
  assert.ok(wf.indexOf("lint-todo.js --git-aware --cap-changed --tracker TODO_Atlas.md --file {file:TODO_Atlas.md} --head-file {parentFile:TODO_Atlas.md}") >= 0, "CI does not lint TODO_Atlas.md per commit");
  assert.ok(wf.indexOf("check-todo-columns.js --file {file:TODO_Atlas.md}") >= 0, "CI does not check TODO_Atlas.md's columns per commit");
});

// ── G12: the storage-key census reads the pages too ─────────────────────────────────────────────────────────────────
test("G12: a key that lives only in a satellite page's inline script is in the census, and the contract's table is current", function () {
  var sk = require("./storage-keys.js"), rows = sk.census(), byKey = {};
  rows.forEach(function (r) { byKey[r.key] = r.owners; });
  ["tnd_bible_editor_draft_v1", "tnd_bible_fs_v1", "tnd_bugfeed_secret_v1", "tnd_capability_names_v1", "tnd_ce_draft_v1", "tnd_grow_log_v1",
    "tnd_soak_crumb_v1", "tnd_speaker_gender_overrides_v1", "tnd_voicelab_v1", "tnd_voicepick_v1"].forEach(function (k) {
    assert.ok(byKey[k], k + " is missing from the census");
    assert.ok(byKey[k].some(function (f) { return /\.html$/.test(f); }), k + " is not attributed to its page: " + byKey[k]);
  });
  // the class: every tnd_ literal in every tracked root page is a census row owned by that page
  var pages = cp.execSync("git ls-files", { cwd: ROOT }).toString("utf8").split("\n").filter(function (f) { return /^[^/]+\.html$/.test(f); }), missing = [];
  assert.ok(pages.length > 10, "the page list is empty — git ls-files did not run");
  pages.forEach(function (f) {
    var src = fs.readFileSync(path.join(ROOT, f), "utf8"), re = /["'](tnd_[A-Za-z0-9_]*)["']/g, m;
    while ((m = re.exec(src))) if (!byKey[m[1]] || byKey[m[1]].indexOf(f) < 0) missing.push(f + ": " + m[1]);
  });
  assert.deepEqual(missing, []);
  var check = node(["dev/storage-keys.js"]);
  assert.equal(check.status, 0, check.out);
});

// ── G11: dev/bible-server.js ────────────────────────────────────────────────────────────────────────────────────────
function ask(port, rawPath, headers) {
  return new Promise(function (resolve, reject) {
    var req = http.request({ host: "127.0.0.1", port: port, path: rawPath, method: "GET", headers: headers || {} }, function (res) {
      var body = ""; res.setEncoding("utf8"); res.on("data", function (d) { body += d; });
      res.on("end", function () { var json = null; try { json = JSON.parse(body); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, json: json, body: body }); });
    });
    req.on("error", reject); req.end();
  });
}
test("G11: a foreign website cannot read the bible server's replies, /health names this machine to a local asker only, and a malformed URL does not stop it", function () {
  var env = Object.assign({}, process.env, { BIBLE_PORT: "0" }), child = cp.spawn(process.execPath, [path.join(__dirname, "bible-server.js")], { cwd: ROOT, env: env });
  var said = "";
  var ready = new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error("the bible server did not start: " + said)); }, 15000);
    function read(d) { said += d; var m = /listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(said); if (m) { clearTimeout(t); resolve(Number(m[1])); } }
    child.stdout.on("data", read); child.stderr.on("data", read);
    child.on("exit", function (c) { clearTimeout(t); reject(new Error("the bible server exited (" + c + "): " + said)); });
  });
  return ready.then(function (port) {
    var own = "http://127.0.0.1:" + port;
    return ask(port, "/health", { Origin: "https://evil.example" }).then(function (r) {
      assert.equal(r.headers["access-control-allow-origin"], undefined, "a foreign origin was allowed to read the reply");
      assert.ok(r.json && r.json.ok, "the liveness answer is gone");
      assert.equal(r.json.root, undefined, "the project folder was told to a foreign origin");
      assert.equal(r.json.pid, undefined, "the process id was told to a foreign origin");
      return ask(port, "/health", { Origin: "null" });
    }).then(function (r) {
      assert.equal(r.headers["access-control-allow-origin"], "null", "a file:// page (the legacy tools) can no longer read a reply");
      assert.equal(r.json.root, undefined, "the project folder was told to a null origin (any sandboxed frame has one)");
      return ask(port, "/health", { Origin: own });
    }).then(function (r) {
      assert.equal(r.headers["access-control-allow-origin"], own);
      assert.equal(typeof r.json.root, "string"); assert.equal(typeof r.json.pid, "number");
      return ask(port, "/health", {});
    }).then(function (r) {
      assert.equal(typeof r.json.root, "string", "a local process with no origin (curl, node) must still see the folder");
      return ask(port, "/bible", { Origin: "https://evil.example" });
    }).then(function (r) {
      assert.equal(r.headers["access-control-allow-origin"], undefined, "a foreign origin was allowed to read the bible text");
      return ask(port, "/%", {});
    }).then(function (r) {
      assert.equal(r.status, 404, "a malformed escape must be an unknown route");
      return ask(port, "/health", {});
    }).then(function (r) { assert.ok(r.json && r.json.ok, "the server did not survive a malformed URL"); });
  }).finally(function () { child.removeAllListeners("exit"); child.kill(); });
});
test("G11: each upload is staged in a folder of its own and removed after its install", function () {
  var src = fs.readFileSync(path.join(__dirname, "bible-server.js"), "utf8");
  assert.ok(/fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\), "bible-upload-"\)\)/.test(src), "uploads share one fixed temp path again");
  assert.ok(!/path\.join\(os\.tmpdir\(\), "capability_bible_upload\.js"\)/.test(src), "the fixed temp path is back");
  assert.ok(/fs\.rmSync\(stage, \{ recursive: true, force: true \}\)/.test(src), "the staged upload is never removed");
});

(function run(i) {
  if (i >= cases.length) {
    if (!cases.length) { console.error("--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
    if (failed) { console.error("#777 gates: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    console.log("ALL GREEN — " + passed + " #777 gate cases"); return;
  }
  var c = cases[i];
  Promise.resolve().then(c.fn).then(function () { passed++; console.log("PASS #777 " + c.name); }, function (e) { failed++; console.error("FAIL #777 " + c.name + " — " + (e && e.stack || e)); }).then(function () { run(i + 1); });
})(0);
