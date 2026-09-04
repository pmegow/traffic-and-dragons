// Operator console: isolated DOM/transport fixtures must never inherit a live account.
var fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
var root = path.join(__dirname, ".."), failures = [], passed = 0;
function test(name, fn) {
  return Promise.resolve().then(fn).then(function () { passed++; }, function (e) { failures.push("#292 operator console > " + name + ": " + e.message); });
}
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function pageFixture() {
  var elements = {}, warns = [], sent = [], confirmed = true;
  function Node(tag) { this.tagName = tag; this.children = []; this.style = {}; this.handlers = {}; this.value = ""; this.hidden = false; }
  Object.defineProperty(Node.prototype, "textContent", {
    get: function () { return (this.text || "") + this.children.map(function (n) { return n.textContent; }).join(" "); },
    set: function (s) { this.text = String(s); this.children = []; }
  });
  Object.defineProperty(Node.prototype, "innerHTML", { set: function () { throw new Error("untrusted markup used innerHTML"); } });
  Node.prototype.appendChild = function (n) { this.children.push(n); return n; };
  Node.prototype.setAttribute = function (k, v) { this[k] = v; };
  Node.prototype.addEventListener = function (k, fn) { this.handlers[k] = fn; };
  var adapter = {
    connected: false, account: { isAdmin: true, username: "operator" }, users: [],
    stats: { tiers: { tester: { label: "Tester", turnsPer30d: 300 } }, metered24h: { calls: 2, errors: 1 } },
    hasToken: function () { return this.connected; },
    fetchAccount: function (cb) { cb(adapter.accountError, adapter.account); },
    getAdminStats: function (cb) { cb(adapter.statsError, adapter.stats); },
    listAdminUsers: function (cb) { cb(adapter.usersError, adapter.users); },
    pingServerHealth: function (cb) { if(adapter.healthQueue)adapter.healthQueue.push(cb);else cb(adapter.healthError, { status: "ok", time: "2026-09-04T11:00:00Z" }); },
    updateSubscription: function (body, cb) { sent.push(body); if (adapter.hold) adapter.held = cb; else cb(adapter.writeError, { ok: true }); }
  };
  var box = {
    document: { getElementById: function (id) { return elements[id] || (elements[id] = new Node("div")); }, createElement: function (tag) { return new Node(tag); } },
    console: { warn: function () { warns.push([].slice.call(arguments).join(" ")); } },
    storageAdapter: adapter,
    MODEL_PRICING: { "claude-sonnet-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 }, "gemini-3.7-flash": { in: 0.75, out: 3.75, cacheRead: 0, cacheWrite: 0 } },
    window: { confirm: function () { return confirmed; } }, Date: Date
  };
  vm.createContext(box);
  var html = read("admin_console.html"), scripts = [], re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g, m;
  while ((m = re.exec(html))) if (m[1].trim()) scripts.push(m[1]);
  scripts.forEach(function (s) { vm.runInContext(s, box, { filename: "admin_console.html" }); });
  return { seam: box.window.__adminTest, elements: elements, adapter: adapter, sent: sent, warns: warns, confirm: function (b) { confirmed = b; } };
}
async function main() {
  var adapterBox = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, AbortController: AbortController };
  var calls = [], response = { ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } };
  adapterBox.fetch = function (url, opts) { calls.push({ url: url, opts: opts }); return Promise.resolve(response); };
  vm.createContext(adapterBox); vm.runInContext(read("storage-adapter.js"), adapterBox);
  var adapter = adapterBox.storageAdapter;
  function invoke(name, args) { return new Promise(function (resolve) { adapter[name].apply(adapter, args.concat(function (err, data) { resolve({ err: err, data: data }); })); }); }
  await test("admin API methods share authenticated bounded transport", async function () {
    adapter.setServer("https://unit.test", "TEST_ONLY");
    for (var spec of [["listAdminUsers", [], "/api/admin/users", undefined], ["getAdminStats", [], "/api/admin/stats", undefined],
      ["pingServerHealth", [], "/health", undefined], ["updateSubscription", [{ userId: "u", action: "extend", days: 30 }], "/api/admin/subscription", "POST"]]) {
      var result = await invoke(spec[0], spec[1]), call = calls[calls.length - 1];
      assert.ifError(result.err); assert.equal(call.url, "https://unit.test" + spec[2]); assert.equal(call.opts.method, spec[3]);
      assert.equal(call.opts.headers.Authorization, "Bearer TEST_ONLY"); assert(call.opts.signal, "missing deadline signal");
      if (spec[3]) assert.deepEqual(JSON.parse(call.opts.body), spec[1][0]);
    }
  });
  await test("admin refusal retains the server reason", async function () {
    response = { ok: false, status: 409, json: function () { return Promise.resolve({ error: "No subscription to extend — grant one first" }); } };
    var r = await invoke("updateSubscription", [{ userId: "u", action: "extend", days: 30 }]);
    assert(r.err.indexOf("409") >= 0 && r.err.indexOf("No subscription to extend") >= 0, r.err);
  });
  await test("non-JSON refusal still names HTTP status", async function () {
    response = { ok: false, status: 502, json: function () { return Promise.reject(new Error("html")); } };
    assert((await invoke("listAdminUsers", [])).err.indexOf("502") >= 0);
  });
  await test("disconnected admin writes never fetch", async function () {
    adapter.setServer(null, null); calls.length = 0;
    assert.equal((await invoke("updateSubscription", [{}])).err, "Not connected"); assert.equal(calls.length, 0);
  });
  await test("satellite contracts: seam, palette, network-first, generated dev menu, no engine writes", function () {
    var html = read("admin_console.html"), sw = read("sw.js"), menus = read("ui-boot.js");
    assert(html.indexOf("window.__adminTest") >= 0, "missing seam");
    assert(html.indexOf('href="satellite.css"') >= 0, "missing shared palette");
    assert(!/\b(saveAll|saveCore|syncToServer|pushCampaignState)\s*\(/.test(html), "writes game state");
    assert(!/tnd_server_tok|localStorage/.test(html), "page handles private token storage");
    var allow = sw.match(/if\(\/([^\n]+)\/\.test\(e.request.url\)\)/);
    assert(allow && allow[1].indexOf("admin_console") >= 0, "missing network-first route");
    assert(/btn\(p\+"admin-console"[^\n]+fm-dev-only/.test(menus), "operator entry lacks dev-only flag");
    assert(menus.indexOf('location.href="admin_console.html"') >= 0, "menu entry not wired");
  });
  await test("signed-out and non-admin views cannot mutate accounts", function () {
    var c = pageFixture(); assert(c.elements.status.textContent.indexOf("Sign in") >= 0);
    c.seam.applyAction("u", "revoke", "", 30); assert.equal(c.sent.length, 0);
    c.adapter.connected = true; c.adapter.account = { isAdmin: false }; c.seam.refresh();
    assert(c.elements.status.textContent.indexOf("operator") >= 0); assert.equal(c.elements.console.hidden, true);
    c.seam.applyAction("u", "grant", "tester", 30); assert.equal(c.sent.length, 0);
  });
  await test("cached and uncached tokens are priced once; unknown models are not free", function () {
    var c = pageFixture(), total = c.seam.summarizeUsage([
      { provider: "anthropic", model: "claude-sonnet-5-20260901", tokIn: 100, tokOut: 20, cacheRead: 300, cacheWrite: 40, calls: 1, errors: 0 },
      { provider: "gemini", model: "gemini-3.7-flash", tokIn: 100, tokOut: 20, cacheRead: 90, cacheWrite: 0, calls: 2, errors: 1 },
      { provider: "fal", model: "unknown-image", calls: 1, tokIn: 0, tokOut: 0, cacheRead: 0, cacheWrite: 0 }
    ]);
    assert(Math.abs(total.usd - 0.00071) < 1e-10, "cost " + total.usd);
    assert.equal(total.tokens, 580); assert.equal(total.unpriced.length, 1); assert.equal(total.calls, 4);
  });
  await test("untrusted roster text stays inert and empty activity is explicit", function () {
    var c = pageFixture(); c.adapter.connected = true;
    c.adapter.users = [{ userId: "<script>id</script>", username: "<img src=x onerror=alert(1)>", createdAt: "2026-01-01 00:00:00", tier: null, usage30d: [], lastActive: null }];
    c.seam.refresh();
    assert(c.elements.users.textContent.indexOf("<img src=x onerror=alert(1)>") >= 0);
    assert(c.elements.users.textContent.indexOf("No metered activity") >= 0);
  });
  await test("failed refresh clears stale roster and shouts the reason", function () {
    var c = pageFixture(); c.adapter.connected = true; c.seam.refresh();
    c.adapter.usersError = "HTTP 401 — session expired"; c.seam.refresh();
    assert(c.elements.status.textContent.indexOf("401") >= 0); assert.equal(c.elements.users.children.length, 0); assert(c.warns.length > 0);
    assert.equal(c.elements.refresh.disabled, false);
  });
  await test("older health responses cannot replace a newer refresh", function () {
    var c=pageFixture();c.adapter.connected=true;c.adapter.healthQueue=[];c.seam.refresh();c.seam.refresh();
    c.adapter.healthQueue[1](null,{status:"ok",time:"2026-09-04T11:01:00Z"});
    var newest=c.elements.health.textContent;c.adapter.healthQueue[0]("old request timed out");
    assert.equal(c.elements.health.textContent,newest);
  });
  await test("cancelled, invalid and repeated subscription actions cannot submit", function () {
    var c = pageFixture(); c.adapter.connected = true; c.seam.refresh();
    c.confirm(false); c.seam.applyAction("u", "revoke", "", 30); assert.equal(c.sent.length, 0);
    c.confirm(true); c.seam.applyAction("u", "extend", "tester", 0); assert.equal(c.sent.length, 0);
    c.adapter.hold = true; c.seam.applyAction("u", "extend", "tester", 30); c.seam.applyAction("u", "extend", "tester", 30);
    assert.equal(c.sent.length, 1); assert.equal(c.sent[0].action, "extend");
    c.adapter.held("HTTP 409 — No subscription to extend");
    assert(c.elements.status.textContent.indexOf("No subscription") >= 0); assert.equal(c.elements.refresh.disabled, false);
  });
  if (failures.length) { failures.forEach(function (f) { console.error(f); }); process.exitCode = 1; }
  console.log("#292 operator console: " + passed + " passed, " + failures.length + " failed");
}
main().catch(function (e) { console.error(e); process.exitCode = 1; });
