// tests-438-folder-rename.js — #438 (Astra review R1): a campaign-folder rename must never merge over or delete
// another campaign's folder. The real renameCampaignFolder runs against an in-memory File System Access fake
// (the tests-250 loader pattern): occupied destination refused with every destination byte preserved and the
// source intact; a free destination moves; a case-only rename on a case-insensitive disk (same entry) is a no-op;
// a copy that fails midway leaves the source intact and says so; "Night?" and "Night!" collide on one slug.
//   node dev/tests-438-folder-rename.js
var fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
var pass = 0, fails = [], chain = Promise.resolve();
function t(name, fn) {
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(function (why) {
      if (!why) { pass++; console.log("PASS " + name); } else { fails.push(name + " — " + why); console.error("FAIL " + name + " — " + why); }
    }, function (e) { fails.push(name + " — threw: " + (e && e.message)); console.error("FAIL " + name + " — threw: " + (e && e.stack || e)); });
  });
}
function notFound() { var e = new Error("A requested file or directory could not be found"); e.name = "NotFoundError"; return e; }
function memFile(name, text, opts) {
  var f = { kind: "file", name: name, text: text };
  f.getFile = function () { return Promise.resolve({ text: f.text, size: f.text.length }); };
  f.createWritable = function () {
    if (opts && opts.failWrite) return Promise.reject(new Error("disk full"));
    return Promise.resolve({ write: function (x) { f.text = (x && typeof x.text === "string") ? x.text : String(x); return Promise.resolve(); }, close: function () { return Promise.resolve(); } });
  };
  return f;
}
function memDir(name, entries) {
  var d = { kind: "directory", name: name, _e: entries || {} };
  d.values = function () { var arr = Object.keys(d._e).map(function (k) { return d._e[k]; }), i = 0; return { next: function () { return Promise.resolve(i < arr.length ? { value: arr[i++], done: false } : { value: undefined, done: true }); } }; };
  d.getDirectoryHandle = function (n, o) {
    if (d._e[n]) return Promise.resolve(d._e[n]);
    if (!o || !o.create) return Promise.reject(notFound());
    d._e[n] = memDir(n); return Promise.resolve(d._e[n]);
  };
  d.getFileHandle = function (n, o) {
    if (d._e[n]) return Promise.resolve(d._e[n]);
    if (!o || !o.create) return Promise.reject(notFound());
    d._e[n] = memFile(n, ""); return Promise.resolve(d._e[n]);
  };
  d.removeEntry = function (n) { delete d._e[n]; return Promise.resolve(); };
  d.isSameEntry = function (o) { return Promise.resolve(o === d); };
  return d;
}
function snapshot(dir) { var out = {}; Object.keys(dir._e).forEach(function (k) { var e = dir._e[k]; out[k] = e.kind === "file" ? e.text : snapshot(e); }); return out; }
function load(root, folder) {
  var warnings = [], toasts = [];
  var ctx = {
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, Blob: Blob, File: function () {},
    console: { warn: function () { warnings.push(Array.prototype.join.call(arguments, " ")); }, info: function () {}, error: function () {} },
    window: {}, navigator: {}, worldState: { campName: "Alpha", renders: [] },
    showToast: function (s) { toasts.push(String(s)); }, updateCampFolderUI: function () {}, eachMenuEl: function () {},
    URL: { createObjectURL: function () { return "blob:x"; }, revokeObjectURL: function () {} },
    document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function () {} }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), ctx, { filename: "ui-files.js" });
  ctx._campRootHandle = root; ctx._campFolderHandle = folder; ctx._campFolderSlug = folder.name;
  return { ctx: ctx, warnings: warnings, toasts: toasts };
}
function world() {
  var alpha = memDir("Alpha", { saves: memDir("saves", { "shared.tnd": memFile("shared.tnd", "ALPHA SAVE"), "only-alpha.txt": memFile("only-alpha.txt", "A") }) });
  var beta = memDir("Beta", { saves: memDir("saves", { "shared.tnd": memFile("shared.tnd", "BETA SAVE"), "only-beta.txt": memFile("only-beta.txt", "B") }) });
  var root = memDir("Campaigns", { Alpha: alpha, Beta: beta });
  return { root: root, alpha: alpha, beta: beta };
}

t("an occupied destination is REFUSED: every destination byte preserved, the source intact, nothing moved, a loud toast and warn, the folder handle unchanged", function () {
  var w = world(), betaBefore = JSON.stringify(snapshot(w.beta)), alphaBefore = JSON.stringify(snapshot(w.alpha));
  var h = load(w.root, w.alpha);
  return h.ctx.renameCampaignFolder("Beta").then(function (r) {
    if (!r || !r.refused) return "expected {refused:true}, got " + JSON.stringify(r);
    if (JSON.stringify(snapshot(w.beta)) !== betaBefore) return "Beta's files changed: " + JSON.stringify(snapshot(w.beta));
    if (JSON.stringify(snapshot(w.alpha)) !== alphaBefore || !w.root._e.Alpha) return "Alpha was moved or deleted";
    if (h.ctx._campFolderHandle !== w.alpha) return "the folder handle moved to the occupied destination";
    if (!h.toasts.some(function (s) { return /already exists/.test(s) && /NOT renamed/.test(s); })) return "no loud toast: " + JSON.stringify(h.toasts);
    if (!h.warnings.some(function (s) { return /#438/.test(s); })) return "no console warn";
    return null;
  });
});
t("a free destination moves: files arrive, the source is removed, the handle follows, the toast says renamed", function () {
  var w = world(), h = load(w.root, w.alpha);
  return h.ctx.renameCampaignFolder("Gamma").then(function (r) {
    if (!r || !r.renamed) return "expected {renamed:true}, got " + JSON.stringify(r);
    var g = w.root._e.Gamma; if (!g || !g._e.saves || g._e.saves._e["shared.tnd"].text !== "ALPHA SAVE" || g._e.saves._e["only-alpha.txt"].text !== "A") return "files did not arrive: " + JSON.stringify(snapshot(w.root));
    if (w.root._e.Alpha) return "the source folder survived a successful move";
    if (h.ctx._campFolderHandle !== g || h.ctx._campFolderSlug !== "Gamma") return "the handle did not follow";
    if (!h.toasts.some(function (s) { return /Renamed to Gamma\//.test(s); })) return "toast: " + JSON.stringify(h.toasts);
    if (JSON.stringify(snapshot(w.beta)) !== JSON.stringify({ saves: { "shared.tnd": "BETA SAVE", "only-beta.txt": "B" } })) return "Beta was touched";
    return null;
  });
});
t("a case-only rename on a case-insensitive disk resolves to the SAME directory: no copy, no delete, no refusal", function () {
  var w = world(); w.root._e.ALPHA = w.alpha;/* the disk answers the other spelling with the same entry */
  var h = load(w.root, w.alpha);
  return h.ctx.renameCampaignFolder("ALPHA").then(function (r) {
    if (!r || !r.same) return "expected {same:true}, got " + JSON.stringify(r);
    if (!w.root._e.Alpha || w.alpha._e.saves._e["shared.tnd"].text !== "ALPHA SAVE") return "the folder was moved";
    if (h.toasts.some(function (s) { return /already exists/.test(s); })) return "a same-entry rename was refused as a collision";
    return null;
  });
});
/* the DESTINATION's second file refuses its write (disk full) — the copy is what fails, midway */
function poisonedDir(name) {
  var d = memDir(name), gf = d.getFileHandle, gd = d.getDirectoryHandle;
  d.getFileHandle = function (n, o) { if (n === "only-alpha.txt") { d._e[n] = memFile(n, "", { failWrite: true }); return Promise.resolve(d._e[n]); } return gf(n, o); };
  d.getDirectoryHandle = function (n, o) { if (o && o.create && !d._e[n]) { d._e[n] = poisonedDir(n); return Promise.resolve(d._e[n]); } return gd(n, o); };
  return d;
}
t("a copy that fails midway leaves the source intact, keeps the handle on the original, and says which half failed", function () {
  var w = world(), origGD = w.root.getDirectoryHandle;
  w.root.getDirectoryHandle = function (n, o) { if (n === "Delta" && o && o.create) { w.root._e.Delta = poisonedDir("Delta"); return Promise.resolve(w.root._e.Delta); } return origGD(n, o); };
  var alphaBefore = JSON.stringify(snapshot(w.alpha)), h = load(w.root, w.alpha);
  return h.ctx.renameCampaignFolder("Delta").then(function (r) {
    if (!r || !r.failed) return "expected {failed:true}, got " + JSON.stringify(r);
    if (JSON.stringify(snapshot(w.alpha)) !== alphaBefore || !w.root._e.Alpha) return "the source was damaged or removed after a partial copy";
    if (h.ctx._campFolderHandle !== w.alpha) return "the handle left the intact original";
    if (!h.toasts.some(function (s) { return /still in Alpha\//.test(s) && /disk full/.test(s); })) return "the failure toast must name the intact original and the reason: " + JSON.stringify(h.toasts);
    return null;
  });
});
t("punctuation collides on one slug — 'Night?' and 'Night!' — so the second campaign's rename is refused, never merged", function () {
  var w = world(); var night = memDir("Night_", { saves: memDir("saves", { "shared.tnd": memFile("shared.tnd", "NIGHT? SAVE") }) }); w.root._e["Night_"] = night;
  var h = load(w.root, w.alpha);
  if (h.ctx._slugFolderName("Night?") !== h.ctx._slugFolderName("Night!")) return "fixture: the two names must share a slug";
  return h.ctx.renameCampaignFolder("Night!").then(function (r) {
    if (!r || !r.refused) return "expected a refusal, got " + JSON.stringify(r);
    if (night._e.saves._e["shared.tnd"].text !== "NIGHT? SAVE") return "the other campaign's save was overwritten";
    if (!w.root._e.Alpha) return "the source was deleted";
    return null;
  });
});

chain.then(function () {
  console.log("#438 FOLDER RENAME: " + fails.length + " failed, " + pass + " passed");
  process.exit(fails.length ? 1 : 0);
});
