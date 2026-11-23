// tests-778-campaign-root-guard.js — #778: a campaign's OWN folder is never taken as the campaigns root.
// Owner report 2026-11-22: a render for the campaign Frizwick was saved to
// "The_Silence_Between_Leaves_--_Kaelon/Frizwick/renders/…". The persisted root was itself a campaign's folder
// (it held tnd-campaign.json, the #481 F1 marker), so every campaign nested inside it. The picker accepted any
// folder; nothing checked for the marker.
//   node dev/tests-778-campaign-root-guard.js
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
function notFound(n) { var e = new Error("NotFound " + n); e.name = "NotFoundError"; return e; }
function fakeDir(name, log, perm) {
  var kids = {}, files = {};
  return {
    name: name, kind: "directory",
    getDirectoryHandle: function(n, o) { log.push("dir:" + name + "/" + n + (o && o.create ? "+" : "")); if (!kids[n]) { if (!(o && o.create)) return Promise.reject(notFound(n)); kids[n] = fakeDir(n, log); } return Promise.resolve(kids[n]); },
    getFileHandle: function(n, o) { log.push("file:" + name + "/" + n); if (!files[n]) { if (!(o && o.create)) return Promise.reject(notFound(n)); files[n] = { text: "" }; } var fr = files[n]; return Promise.resolve({ getFile: function() { return Promise.resolve({ text: function() { return Promise.resolve(fr.text); } }); }, createWritable: function() { return Promise.resolve({ write: function(x) { fr.text = (typeof x === "string") ? x : fr.text; return Promise.resolve(); }, close: function() { return Promise.resolve(); } }); } }); },
    _files: files, _kids: kids,
    queryPermission: function() { return Promise.resolve(perm || "granted"); },
    requestPermission: function() { return Promise.resolve("granted"); },
    removeEntry: function() { return Promise.resolve(); }
  };
}
/* the owner's disk: a campaign's own folder, marked by #481 F1 */
function campaignDir(log, perm) {
  var d = fakeDir("The_Silence_Between_Leaves_--_Kaelon", log, perm);
  d._files["tnd-campaign.json"] = { text: JSON.stringify({ campId: "camp_SBL", campName: "The Silence Between Leaves -- Kaelon", at: 1 }) };
  return d;
}
function loadFiles(opts) {
  opts = opts || {};
  var toasts = [], infos = [], warnings = [], idb = {}, idbWrites = [];
  var ctx = {
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, Blob: Blob,
    console: { warn: function() { warnings.push(Array.prototype.join.call(arguments, " ")); }, info: function() { infos.push(Array.prototype.join.call(arguments, " ")); }, log: function() {} },
    window: { showDirectoryPicker: function() { return opts.picker ? opts.picker() : Promise.reject(new Error("picker must not open")); } },
    navigator: {}, localStorage: { getItem: function() { return null; }, setItem: function() {} },
    worldState: { campName: "Frizwick", character: { name: "Frizwick" }, turn: 174, renders: [] },
    __meta: [{ id: "camp_FZ", campName: "Frizwick" }], __active: "camp_FZ",
    getCampMeta: function() { return JSON.parse(JSON.stringify(ctx.__meta)); }, setCampMeta: function(a) { ctx.__meta = JSON.parse(JSON.stringify(a)); }, getActiveCampId: function() { return ctx.__active; },
    showToast: function(s) { toasts.push(String(s)); },
    eachMenuEl: function() {},
    URL: { createObjectURL: function() { return "blob:x"; }, revokeObjectURL: function() {} },
    document: { getElementById: function() { return null; }, createElement: function() { return { style: {}, click: function() {}, setAttribute: function() {} }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "helpers.js"), "utf8"), ctx, { filename: "helpers.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), ctx, { filename: "ui-files.js" });
  ctx._idbSet = function(k, v) { idbWrites.push(k); idb[k] = v; return Promise.resolve(true); };
  ctx._idbGet = function(k) { return Promise.resolve(Object.prototype.hasOwnProperty.call(idb, k) ? idb[k] : (opts.idb && opts.idb[k]) || null); };
  return { ctx: ctx, toasts: toasts, infos: infos, warnings: warnings, idb: idb, idbWrites: idbWrites };
}
function said(list, re) { return list.some(function(s) { return re.test(s); }); }
var NAMES = /The_Silence_Between_Leaves_--_Kaelon/, ABOVE = /folder above/i;

var chain = tAsync("#778 File ▸ Set campaigns folder REFUSES a campaign's own folder: no root, nothing persisted, nothing created inside it, and the reason is said", function() {
  var log = [], camp = campaignDir(log), f = loadFiles({ picker: function() { return Promise.resolve(camp); } });
  return f.ctx.setCampaignFolder().then(function(ok) {
    if (ok !== false) return "setCampaignFolder resolved " + ok + " for a campaign's own folder";
    if (f.ctx._campRootHandle) return "the campaign's folder became the root";
    if (f.idbWrites.length) return "the refused pick was persisted: " + JSON.stringify(f.idbWrites);
    if (Object.keys(camp._kids).length) return "a folder was created inside the campaign's folder: " + Object.keys(camp._kids);
    if (!said(f.toasts, NAMES) || !said(f.toasts, ABOVE)) return "the refusal does not name the folder and say to pick the folder above it: " + JSON.stringify(f.toasts);
    if (said(f.toasts, /Folder ready/)) return "the success toast was shown for a refused pick";
    return "";
  });
}).then(function() {
  return tAsync("#778 the Begin-time picker refuses it the same way (one boundary, both doors)", function() {
    var log = [], camp = campaignDir(log), f = loadFiles({ picker: function() { return Promise.resolve(camp); } });
    return f.ctx.initCampaignFolderForGame().then(function(ok) {
      if (ok !== false) return "initCampaignFolderForGame resolved " + ok;
      if (f.ctx._campRootHandle || f.idbWrites.length) return "the campaign's folder was taken as the root";
      if (!said(f.toasts, NAMES) || !said(f.toasts, ABOVE)) return "the refusal is not said: " + JSON.stringify(f.toasts);
      return "";
    });
  });
}).then(function() {
  return tAsync("#778 a marker that cannot be parsed still marks a campaign's folder — refused", function() {
    var log = [], camp = fakeDir("Old_Campaign", log), f;
    camp._files["tnd-campaign.json"] = { text: "{not json" };
    f = loadFiles({ picker: function() { return Promise.resolve(camp); } });
    return f.ctx.setCampaignFolder().then(function(ok) {
      if (ok !== false || f.ctx._campRootHandle) return "a folder holding an unreadable marker was taken as the root";
      return "";
    });
  });
}).then(function() {
  return tAsync("#778 a true campaigns folder (campaign folders beneath it, no marker of its own) is accepted as before", function() {
    var log = [], root = fakeDir("Campaigns", log), f;
    root._kids["Frizwick"] = fakeDir("Frizwick", log);
    root._kids["Frizwick"]._files["tnd-campaign.json"] = { text: JSON.stringify({ campId: "camp_FZ", campName: "Frizwick" }) };
    f = loadFiles({ picker: function() { return Promise.resolve(root); } });
    return f.ctx.setCampaignFolder().then(function(ok) {
      if (ok !== true || f.ctx._campRootHandle !== root) return "a real campaigns folder was refused: " + JSON.stringify(f.toasts);
      if (f.idb.campRoot !== root) return "the accepted root was not persisted";
      if (said(f.toasts.concat(f.warnings), ABOVE)) return "a real campaigns folder was warned about: " + JSON.stringify(f.toasts.concat(f.warnings));
      return "";
    });
  });
}).then(function() {
  return tAsync("#778 a root ALREADY stored that is a campaign's folder (the owner's device) is said loudly at boot — once — and keeps saving", function() {
    var log = [], camp = campaignDir(log), f = loadFiles({ idb: { campRoot: camp } });
    return f.ctx.restoreCampaignFolder().then(function(ok) {
      if (ok !== true || f.ctx._campRootHandle !== camp) return "the stored root was dropped — the next save would fall to Downloads";
      if (!said(f.toasts, NAMES) || !said(f.toasts, ABOVE)) return "no toast names the folder and the fix: " + JSON.stringify(f.toasts);
      if (!said(f.warnings, /#778/)) return "nothing on the console: " + JSON.stringify(f.warnings);
      var n = f.toasts.length;
      return f.ctx._ensureFolderPerm().then(function() {
        if (f.toasts.length !== n) return "the warning repeats on every save";
        return f.ctx.exportToFolder("render", new Blob(["x"]), "Frizwick_Frizwick_t174.png");
      }).then(function(written) {
        if (written !== true) return "the render was not written (a warned root must still save)";
        return "";
      });
    });
  });
}).then(function() {
  return tAsync("#778 a stored root whose permission lapsed is checked when a save re-arms it", function() {
    var log = [], camp = campaignDir(log, "prompt"), f = loadFiles({ idb: { campRoot: camp } });
    return f.ctx.restoreCampaignFolder().then(function(ok) {
      if (ok !== false) return "a root awaiting permission restored as live";
      if (f.toasts.length) return "warned before the folder could be read: " + JSON.stringify(f.toasts);
      return f.ctx._ensureFolderPerm();
    }).then(function(ok) {
      if (typeof ok === "string") return ok;
      if (ok !== true) return "the re-permissioned root is not live";
      if (!said(f.toasts, NAMES) || !said(f.toasts, ABOVE)) return "the re-armed campaign-folder root is silent: " + JSON.stringify(f.toasts);
      return "";
    });
  });
}).then(function() {
  return tAsync("#778 a healthy stored root says nothing", function() {
    var log = [], root = fakeDir("Campaigns", log), f = loadFiles({ idb: { campRoot: root } });
    return f.ctx.restoreCampaignFolder().then(function(ok) {
      if (ok !== true) return "a healthy root did not restore";
      if (f.toasts.length || said(f.warnings, /#778/)) return "a healthy root was warned about: " + JSON.stringify(f.toasts.concat(f.warnings));
      return "";
    });
  });
}).then(function() {
  if (fails.length) { console.error("#778 CAMPAIGN ROOT GUARD TESTS FAILED — " + fails.length + " failure(s)"); process.exit(1); }
  console.log("ALL GREEN — " + pass + " assertions passed (#778 campaign root guard)");
});
