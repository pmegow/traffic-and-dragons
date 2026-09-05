// tests-336-campaign-root.js — the campaigns ROOT is what persists; the campaign subfolder is derived.
// Owner report 2026-09-04: Iron Meridian's folder sat one level down inside "Runelords" because the app
// treated every pick as a root and asked again at each new campaign; switching campaigns never retargeted.
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
// A fake File System Access directory: records every getDirectoryHandle/getFileHandle by path.
function fakeDir(name, log) {
  var kids = {};
  return {
    name: name, kind: "directory",
    getDirectoryHandle: function(n, o) { log.push("dir:" + name + "/" + n + (o && o.create ? "+" : "")); if (!kids[n]) { if (!(o && o.create)) return Promise.reject(new Error("NotFound " + n)); kids[n] = fakeDir(n, log); } return Promise.resolve(kids[n]); },
    getFileHandle: function(n) { log.push("file:" + name + "/" + n); return Promise.resolve({ createWritable: function() { return Promise.resolve({ write: function() { return Promise.resolve(); }, close: function() { return Promise.resolve(); } }); } }); },
    queryPermission: function() { return Promise.resolve("granted"); },
    requestPermission: function() { return Promise.resolve("granted"); },
    removeEntry: function() { return Promise.resolve(); },
    _kids: kids
  };
}
function loadFiles(opts) {
  opts = opts || {};
  var toasts = [], infos = [], warnings = [], idb = {}, idbWrites = [], pickerCalls = 0;
  var ctx = {
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, Blob: Blob,
    console: { warn: function() { warnings.push(Array.prototype.join.call(arguments, " ")); }, info: function() { infos.push(Array.prototype.join.call(arguments, " ")); }, log: function() {} },
    window: { showDirectoryPicker: function() { pickerCalls++; return opts.picker ? opts.picker() : Promise.reject(new Error("picker must not open")); } },
    navigator: {}, localStorage: { getItem: function() { return null; }, setItem: function() {} },
    worldState: { campName: opts.campName || "The Iron Meridian (Gazz Quickfuse)", character: { name: "Gazz" }, turn: 3, renders: [] },
    showToast: function(s) { toasts.push(String(s)); },
    eachMenuEl: function() {},
    saveDestination: function(f, p, h, sub) { return { kind: f ? "folder" : p ? "pending" : "downloads", text: (f || p || "downloads") + "/" + (sub || "saves") + "/" }; },
    URL: { createObjectURL: function() { return "blob:x"; }, revokeObjectURL: function() {} },
    document: { getElementById: function() { return null; }, createElement: function() { return { style: {}, click: function() {}, setAttribute: function() {} }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "helpers.js"), "utf8"), ctx, { filename: "helpers.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), ctx, { filename: "ui-files.js" });
  ctx._idbSet = function(k, v) { idbWrites.push(k); idb[k] = v; return Promise.resolve(true); };
  ctx._idbGet = function(k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(idb, k) ? idb[k] : (opts.idb && opts.idb[k]) || null); };
  return { ctx: ctx, toasts: toasts, infos: infos, warnings: warnings, idb: idb, idbWrites: idbWrites, picker: function() { return pickerCalls; } };
}

var chain = tAsync("#336 the pick is the ROOT: it is what persists, and the campaign subfolder is derived from the active campaign at write time", function() {
  var log = [], root = fakeDir("Campaigns", log), f = loadFiles({ picker: function() { return Promise.resolve(root); } });
  return f.ctx.setCampaignFolder().then(function(ok) {
    if (ok !== true) return "setCampaignFolder did not resolve true";
    if (f.ctx._campRootHandle !== root) return "the root handle is not the picked folder";
    if (f.idb.campRoot !== root) return "the ROOT must be the persisted handle, got " + (f.idb.campRoot && f.idb.campRoot.name);
    if (f.idb.campFolder) return "the old per-campaign key must not be written any more";
    return f.ctx.exportToFolder("save", new Blob(["x"]), "Gazz_t3.tnd");
  }).then(function(written) {
    if (written !== true) return "save did not write into the folder";
    if (log.indexOf("dir:Campaigns/The_Iron_Meridian__Gazz_Quickfuse_+") < 0) return "campaign subfolder not derived under the root: " + JSON.stringify(log);
    if (log.indexOf("dir:The_Iron_Meridian__Gazz_Quickfuse_/saves+") < 0) return "saves/ not created under the campaign subfolder: " + JSON.stringify(log);
    if (!f.toasts.some(function(s) { return s.indexOf("Campaigns/The_Iron_Meridian__Gazz_Quickfuse_/saves/Gazz_t3.tnd") >= 0; })) return "the toast does not name the whole path: " + JSON.stringify(f.toasts);
    return "";
  });
}).then(function() {
  return tAsync("#336 switching campaigns retargets by itself — the next write lands in the OTHER campaign's sibling folder, never the last-picked one", function() {
    var log = [], root = fakeDir("Campaigns", log), f = loadFiles({ picker: function() { return Promise.resolve(root); } });
    return f.ctx.setCampaignFolder().then(function() {
      return f.ctx.exportToFolder("save", new Blob(["x"]), "a.tnd");
    }).then(function() {
      f.ctx.worldState.campName = "Rise of the Runelords (Ammut)";
      log.length = 0;
      return f.ctx.exportToFolder("render", new Blob(["x"]), "b.jpg");
    }).then(function(written) {
      if (written !== true) return "second write failed";
      if (log.indexOf("dir:Campaigns/Rise_of_the_Runelords__Ammut_+") < 0) return "the second campaign did not get its own sibling folder: " + JSON.stringify(log);
      if (log.some(function(l) { return l.indexOf("Iron_Meridian") >= 0; })) return "the write touched the previous campaign's folder: " + JSON.stringify(log);
      if (Object.keys(root._kids).sort().join(",") !== "Rise_of_the_Runelords__Ammut_,The_Iron_Meridian__Gazz_Quickfuse_") return "the root does not hold the two campaigns side by side: " + Object.keys(root._kids);
      return "";
    });
  });
}).then(function() {
  return tAsync("#336 a new campaign never re-opens the picker once a root exists — it just names where it will save", function() {
    var log = [], root = fakeDir("Campaigns", log), f = loadFiles();
    f.ctx._campRootHandle = root;
    return f.ctx.initCampaignFolderForGame().then(function(ok) {
      if (ok !== true) return "init did not resolve true with a root present";
      if (f.picker() !== 0) return "the picker opened although a root exists";
      if (!f.toasts.some(function(s) { return /Saving to Campaigns\/The_Iron_Meridian__Gazz_Quickfuse_\//.test(s); })) return "the toast does not name root/campaign: " + JSON.stringify(f.toasts);
      return "";
    });
  });
}).then(function() {
  return tAsync("#336 a restored root re-permissions as before; a LEGACY per-campaign handle is retired loudly (its parent is unreachable) and the root must be picked once", function() {
    var log = [], root = fakeDir("Campaigns", log), f = loadFiles({ idb: { campRoot: root } });
    return f.ctx.restoreCampaignFolder().then(function(ok) {
      if (ok !== true || f.ctx._campRootHandle !== root) return "a granted root did not restore";
      var g = loadFiles({ idb: { campFolder: fakeDir("The_Iron_Meridian__Gazz_Quickfuse_", []) } });
      return g.ctx.restoreCampaignFolder().then(function(ok2) {
        if (ok2 !== false || g.ctx._campRootHandle) return "a legacy subfolder handle must not be mistaken for a root";
        if (!g.infos.concat(g.warnings).some(function(s) { return /legacy|per-campaign/i.test(s) && /pick/i.test(s); })) return "the legacy retirement is silent: " + JSON.stringify(g.infos.concat(g.warnings));
        if (g.idbWrites.indexOf("campFolder") < 0 || g.idb.campFolder !== null) return "the legacy key was not cleared";
        return "";
      });
    });
  });
}).then(function() {
  return tAsync("#336 the pure label and the two hosts: campaignFolderLabel(root, campName) → 'root/slug'; the save modal and the menu read it; the banner asks for the CAMPAIGNS folder and checks the root", function() {
    var f = loadFiles();
    if (f.ctx.campaignFolderLabel("Campaigns", "The Iron Meridian (Gazz Quickfuse)") !== "Campaigns/The_Iron_Meridian__Gazz_Quickfuse_") return "label: " + f.ctx.campaignFolderLabel("Campaigns", "The Iron Meridian (Gazz Quickfuse)");
    if (f.ctx.campaignFolderLabel(null, "x") !== "") return "no root must give no label";
    var ui = fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), game = fs.readFileSync(path.join(ROOT, "game.js"), "utf8"), boot = fs.readFileSync(path.join(ROOT, "ui-boot.js"), "utf8");
    if (ui.indexOf("saveDestination(campaignFolderLabel(") < 0) return "the save modal does not show root/campaign";
    if (!/_campRootHandle\)return;\s*\/\/ already set/.test(game)) return "_promptCampaignFolder does not check the ROOT";
    if (!/Campaigns folder/.test(game)) return "the banner does not ask for the campaigns folder";
    if (boot.indexOf("Set campaigns folder") < 0) return "the menu item still says 'campaign folder'";
    return "";
  });
}).then(function() {
  if (fails.length) { console.error("#336 CAMPAIGN ROOT TESTS FAILED — " + fails.length + " failure(s)"); process.exit(1); }
  console.log("ALL GREEN — " + pass + " assertions passed (#336 campaign root)");
});
