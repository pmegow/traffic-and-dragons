// tests-250-browser-io.js — failure-path ownership for browser files and runtime caches.
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var pass = 0, fails = [];
function tAsync(name, fn) {
  return Promise.resolve().then(fn).then(function(why) {
    if (!why) { pass++; console.log("PASS " + name); }
    else { fails.push(name + " — " + why); console.error("FAIL " + name + " — " + why); }
  }, function(e) {
    fails.push(name + " — threw: " + (e && e.message));
    console.error("FAIL " + name + " — threw: " + (e && e.stack || e));
  });
}
function deferred() {
  var resolve, reject;
  var promise = new Promise(function(res, rej) { resolve = res; reject = rej; });
  return { promise: promise, resolve: resolve, reject: reject };
}

function loadFiles(picker) {
  var warnings = [], toasts = [], revoked = [], appended = null;
  var frame = {
    querySelector: function() { return null; },
    appendChild: function(img) { appended = img; }
  };
  var ctx = {
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Blob: Blob,
    File: typeof File === "function" ? File : function() {},
    console: {
      warn: function() { warnings.push(Array.prototype.join.call(arguments, " ")); },
      info: function() {}
    },
    window: { showDirectoryPicker: picker },
    navigator: {},
    worldState: { campName: "Probe", renders: [] },
    showToast: function(s) { toasts.push(String(s)); },
    updateCampFolderUI: function() {},
    eachMenuEl: function() {},
    URL: {
      createObjectURL: function() { return "blob:restored-probe"; },
      revokeObjectURL: function(u) { revoked.push(u); }
    },
    document: {
      getElementById: function(id) { return id === "story-narrative" ? { querySelector: function() { return frame; } } : null; },
      createElement: function() { return { style: {}, setAttribute: function(k, v) { this[k] = v; } }; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), ctx, { filename: "ui-files.js" });
  return { ctx: ctx, warnings: warnings, toasts: toasts, revoked: revoked, appended: function() { return appended; } };
}

function pickerError(name, message) { var e = new Error(message); e.name = name; return e; }

function loadSw(opts) {
  var handlers = {}, warnings = [], cache = opts.cache;
  var ctx = {
    Promise: Promise,
    URL: URL,
    Response: typeof Response === "function" ? Response : function() {},
    console: { warn: function() { warnings.push(Array.prototype.join.call(arguments, " ")); } },
    fetch: opts.fetch,
    caches: {
      match: opts.match || function() { return Promise.resolve(null); },
      open: function() { return Promise.resolve(cache); },
      keys: function() { return Promise.resolve([]); },
      delete: function() { return Promise.resolve(true); }
    },
    self: {
      location: { origin: "https://game.test" },
      clients: { claim: function() {} },
      skipWaiting: function() {},
      addEventListener: function(type, fn) { handlers[type] = fn; }
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"), ctx, { filename: "sw.js" });
  return { handler: handlers.fetch, warnings: warnings };
}

function responseFor(url) {
  var clone = { ok: true, status: 200, type: "basic", redirected: false, url: url };
  return { ok: true, status: 200, type: "basic", redirected: false, url: url,
    clone: function() { return clone; } };
}

function dispatchFetch(handler, url) {
  var waits = [], responsePromise = null;
  handler({
    request: { method: "GET", url: url },
    respondWith: function(p) { responsePromise = Promise.resolve(p); },
    waitUntil: function(p) { waits.push(Promise.resolve(p)); }
  });
  return { waits: waits, response: function() { return responsePromise; } };
}

var chain = tAsync("restored render revokes its object URL when image decode fails", function() {
  var f = loadFiles(function() { return Promise.resolve(null); });
  if (!f.ctx._attachRestoredRender({}, { f: "bad.jpg", t: 7 })) return "render was not attached";
  var img = f.appended();
  if (!img || typeof img.onerror !== "function") return "restored image has no error cleanup handler";
  img.onerror();
  if (f.revoked.length !== 1 || f.revoked[0] !== "blob:restored-probe") return "error path did not revoke the exact created URL: " + JSON.stringify(f.revoked);
  if (!f.warnings.some(function(s) { return s.indexOf("bad.jpg") >= 0; })) return "decode failure was not logged with the affected file";
  return "";
}).then(function() {
  return tAsync("folder-picker cancellation is quiet and distinct from failure", function() {
    var f = loadFiles(function() { return Promise.reject(pickerError("AbortError", "user cancelled")); });
    var p = f.ctx.setCampaignFolder();
    if (!p || typeof p.then !== "function") return "setCampaignFolder does not return its picker operation";
    return p.then(function(ok) {
      if (ok !== false) return "cancellation did not resolve false";
      if (f.warnings.length || f.toasts.length) return "ordinary cancellation was reported as failure: " + JSON.stringify({ warnings: f.warnings, toasts: f.toasts });
      return "";
    });
  });
}).then(function() {
  return tAsync("real folder-picker failures warn and toast with their reason", function() {
    var f = loadFiles(function() { return Promise.reject(pickerError("SecurityError", "blocked by policy")); });
    var p = f.ctx.initCampaignFolderForGame();
    if (!p || typeof p.then !== "function") return "initCampaignFolderForGame does not return its picker operation";
    return p.then(function(ok) {
      if (ok !== false) return "real picker failure did not resolve false";
      if (!f.warnings.some(function(s) { return s.indexOf("blocked by policy") >= 0; })) return "real failure reason absent from console warning";
      if (!f.toasts.some(function(s) { return s.indexOf("blocked by policy") >= 0; })) return "real failure reason absent from player toast";
      return "";
    });
  });
}).then(function() {
  return tAsync("restored-folder permission failures are surfaced instead of becoming silent downloads", function() {
    var f = loadFiles(function() { return Promise.resolve(null); });
    f.ctx._campFolderPending = { requestPermission: function() { return Promise.reject(pickerError("SecurityError", "permission API failed")); } };
    return f.ctx._ensureFolderPerm().then(function(ok) {
      if (ok !== false) return "permission failure did not resolve false";
      if (!f.warnings.some(function(s) { return s.indexOf("permission API failed") >= 0; })) return "permission failure reason absent from warning";
      if (!f.toasts.some(function(s) { return s.indexOf("permission API failed") >= 0; })) return "permission failure reason absent from toast";
      return "";
    });
  });
}).then(function() {
  return tAsync("clear-folder persistence failure is loud and does not claim durable success", function() {
    var f = loadFiles(function() { return Promise.resolve(null); });
    f.ctx._idbSet = function() { return Promise.reject(new Error("IndexedDB write denied")); };
    var p = f.ctx.clearCampaignFolder();
    if (!p || typeof p.then !== "function") return "clearCampaignFolder does not return the persistent clear operation";
    return p.then(function(ok) {
      if (ok !== false) return "failed persistent clear did not resolve false";
      if (!f.warnings.some(function(s) { return s.indexOf("IndexedDB write denied") >= 0; })) return "clear failure reason absent from warning";
      if (!f.toasts.some(function(s) { return s.indexOf("IndexedDB write denied") >= 0; })) return "clear failure reason absent from toast";
      if (f.toasts.some(function(s) { return s === "Campaign folder cleared."; })) return "failure path falsely claimed a durable clear";
      return "";
    });
  });
}).then(function() {
  return tAsync("network-first runtime cache writes are held by FetchEvent.waitUntil", function() {
    var put = deferred(), url = "https://game.test/bug_tracker.html";
    var sw = loadSw({ cache: { put: function() { return put.promise; } }, fetch: function() { return Promise.resolve(responseFor(url)); } });
    var ev = dispatchFetch(sw.handler, url);
    return ev.response().then(function() {
      if (ev.waits.length !== 1) return "runtime write registered " + ev.waits.length + " lifetime promise(s)";
      var settled = false;
      ev.waits[0].then(function() { settled = true; });
      return Promise.resolve().then(function() { return Promise.resolve(); }).then(function() {
        if (settled) return "held lifetime settled before the pending cache.put";
        put.resolve(true);
        return ev.waits[0].then(function() { return ""; });
      });
    });
  });
}).then(function() {
  return tAsync("cache-first runtime writes stay held until cache.put settles", function() {
    var put = deferred(), url = "https://game.test/ui-files.js";
    var sw = loadSw({ cache: { put: function() { return put.promise; } }, fetch: function() { return Promise.resolve(responseFor(url)); } });
    var ev = dispatchFetch(sw.handler, url);
    return ev.response().then(function() {
      if (ev.waits.length !== 1) return "runtime write registered " + ev.waits.length + " lifetime promise(s)";
      var settled = false;
      ev.waits[0].then(function() { settled = true; });
      return Promise.resolve().then(function() { return Promise.resolve(); }).then(function() {
        if (settled) return "held lifetime settled before the pending cache.put";
        put.resolve(true);
        return ev.waits[0].then(function() { return ""; });
      });
    });
  });
}).then(function() {
  return tAsync("runtime cache failures stay loud without breaking the response", function() {
    var url = "https://game.test/ui-files.js";
    var sw = loadSw({ cache: { put: function() { return Promise.reject(new Error("quota exhausted")); } }, fetch: function() { return Promise.resolve(responseFor(url)); } });
    var ev = dispatchFetch(sw.handler, url);
    return ev.response().then(function() {
      if (ev.waits.length !== 1) return "runtime write registered " + ev.waits.length + " lifetime promise(s)";
      return ev.waits[0].then(function() {
        return sw.warnings.some(function(s) { return s.indexOf("quota exhausted") >= 0; }) ? "" : "cache failure reason was swallowed";
      });
    });
  });
}).then(function() {
  return tAsync("Piper cache write and superseded-revision GC share one held lifetime", function() {
    var deletion = deferred(), url = "https://game.test/vendor/piper/model.onnx?tnd=new";
    var cache = {
      put: function() { return Promise.resolve(true); },
      keys: function() { return Promise.resolve([{ url: "https://game.test/vendor/piper/model.onnx?tnd=old" }]); },
      delete: function() { return deletion.promise; }
    };
    var sw = loadSw({ cache: cache, fetch: function() { return Promise.resolve(responseFor(url)); } });
    var ev = dispatchFetch(sw.handler, url);
    return ev.response().then(function() {
      if (ev.waits.length !== 1) return "Piper write/GC registered " + ev.waits.length + " lifetime promise(s)";
      var settled = false;
      ev.waits[0].then(function() { settled = true; });
      return Promise.resolve().then(function() { return Promise.resolve(); }).then(function() {
        if (settled) return "held lifetime settled before superseded-revision deletion";
        deletion.resolve(true);
        return ev.waits[0].then(function() { return ""; });
      });
    });
  });
}).then(function() {
  if (fails.length) { console.error("BROWSER I/O TESTS FAILED — " + fails.length + " failure(s)"); process.exit(1); }
  console.log("ALL GREEN — " + pass + " assertions passed (browser I/O ownership)");
});
