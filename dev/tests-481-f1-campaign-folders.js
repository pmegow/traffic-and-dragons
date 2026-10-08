// tests-481-f1-campaign-folders.js — #481 F1 (audit 2026-09-29, Fable-approved): a campaign's folder is keyed by its campaign
// ID, not its name. The real ui-files.js runs against an in-memory File System Access fake (the tests-438 pattern) with an
// in-memory campaign list: two same-named campaigns get two folders; a legacy folder with no marker is ADOPTED (files never
// move); a folder whose marker names another live campaign is skipped (_2, _3…); a refused rename leaves the next export in
// the original folder; a successful rename moves the stored slug; the #424 copy of a NON-active campaign lands in ITS folder;
// the slug survives mergeCampaignLists; a rehome re-stamps the marker it owns.
//   node dev/tests-481-f1-campaign-folders.js
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
function memFile(name, text) {
  var f = { kind: "file", name: name, text: text };
  f.getFile = function () { return Promise.resolve({ text: function () { return Promise.resolve(f.text); }, size: f.text.length }); };
  f.createWritable = function () { return Promise.resolve({ write: function (x) { if (x && typeof x.text === "function") return x.text().then(function (t) { f.text = t; }); f.text = (x && typeof x.text === "string") ? x.text : String(x); return Promise.resolve(); }, close: function () { return Promise.resolve(); } }); };
  return f;
}
function memDir(name, entries) {
  var d = { kind: "directory", name: name, _e: entries || {} };
  d.values = function () { var arr = Object.keys(d._e).map(function (k) { return d._e[k]; }), i = 0; return { next: function () { return Promise.resolve(i < arr.length ? { value: arr[i++], done: false } : { value: undefined, done: true }); } }; };
  d.getDirectoryHandle = function (n, o) { if (d._e[n]) return Promise.resolve(d._e[n]); if (!o || !o.create) return Promise.reject(notFound()); d._e[n] = memDir(n); return Promise.resolve(d._e[n]); };
  d.getFileHandle = function (n, o) { if (d._e[n]) return Promise.resolve(d._e[n]); if (!o || !o.create) return Promise.reject(notFound()); d._e[n] = memFile(n, ""); return Promise.resolve(d._e[n]); };
  d.removeEntry = function (n) { delete d._e[n]; return Promise.resolve(); };
  d.isSameEntry = function (o) { return Promise.resolve(o === d); };
  return d;
}
function marker(dir) { var m = dir && dir._e["tnd-campaign.json"]; if (!m) return null; try { return JSON.parse(m.text); } catch (e) { return "unreadable"; } }
function load(root, meta, activeId, ws) {
  var warnings = [], toasts = [], store = { meta: JSON.stringify(meta), active: activeId };
  var ctx = {
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, Blob: Blob, File: function () {},
    console: { warn: function () { warnings.push(Array.prototype.join.call(arguments, " ")); }, info: function () {}, error: function () {}, log: function () {} },
    window: {}, navigator: {}, worldState: ws,
    getCampMeta: function () { return JSON.parse(store.meta); }, setCampMeta: function (a) { store.meta = JSON.stringify(a); },
    getActiveCampId: function () { return store.active; },
    campDisplayName: function (id) { return id; },
    showToast: function (s) { toasts.push(String(s)); }, updateCampFolderUI: function () {}, eachMenuEl: function () {},
    saveDestination: function () { return { kind: "folder", text: "" }; },
    URL: { createObjectURL: function () { return "blob:x"; }, revokeObjectURL: function () {} },
    document: { getElementById: function () { return null; }, createElement: function () { return { style: {}, setAttribute: function () {}, click: function () {} }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "helpers.js"), "utf8"), ctx, { filename: "helpers.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "ui-files.js"), "utf8"), ctx, { filename: "ui-files.js" });
  ctx._campRootHandle = root;
  return { ctx: ctx, warnings: warnings, toasts: toasts, meta: function () { return JSON.parse(store.meta); }, setActive: function (id) { store.active = id; } };
}
function wsFor(name) { return { campName: name, character: { name: "Ammut" }, turn: 5, renders: [] }; }
function rowOf(h, id) { return h.meta().filter(function (r) { return r.id === id; })[0] || null; }
var NAME = "The Village (Ammut)", SLUG = "The_Village__Ammut_";

t("two campaigns with ONE name get TWO folders — the second one's marker is its own, never the first's", function () {
  var root = memDir("Campaigns"), meta = [{ id: "camp_A", campName: NAME }, { id: "camp_B", campName: NAME }];
  var h = load(root, meta, "camp_A", wsFor(NAME));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a_t5.tnd").then(function () {
    h.setActive("camp_B"); h.ctx.worldState = wsFor(NAME);
    return h.ctx.exportToFolder("save", new Blob(["B"]), "b_t5.tnd");
  }).then(function () {
    var a = root._e[SLUG], b = root._e[SLUG + "_2"];
    if (!a || !b) return "two folders expected: " + Object.keys(root._e).join(", ");
    if ((marker(a) || {}).campId !== "camp_A" || (marker(b) || {}).campId !== "camp_B") return "each folder carries its own campaign id: " + JSON.stringify([marker(a), marker(b)]);
    if (!a._e.saves._e["a_t5.tnd"] || a._e.saves._e["b_t5.tnd"] || !b._e.saves._e["b_t5.tnd"]) return "each save lands in its own campaign's folder";
    if ((rowOf(h, "camp_A") || {}).folderSlug !== SLUG || (rowOf(h, "camp_B") || {}).folderSlug !== SLUG + "_2") return "the slugs are stored on the meta rows: " + JSON.stringify(h.meta());
    return null;
  });
});
t("a legacy folder with no marker is ADOPTED by the first campaign that writes — files never move", function () {
  var old = memDir(SLUG, { saves: memDir("saves", { "old_t77.tnd": memFile("old_t77.tnd", "OLD") }) }), root = memDir("Campaigns", {});
  root._e[SLUG] = old;
  var h = load(root, [{ id: "camp_A", campName: NAME }], "camp_A", wsFor(NAME));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a_t78.tnd").then(function () {
    if (Object.keys(root._e).join(",") !== SLUG) return "no second folder for the adopting campaign: " + Object.keys(root._e).join(", ");
    if ((marker(old) || {}).campId !== "camp_A") return "the adopter writes its marker";
    if (old._e.saves._e["old_t77.tnd"].text !== "OLD" || !old._e.saves._e["a_t78.tnd"]) return "the old files stay, the new one joins them";
    return null;
  });
});
t("a folder whose marker names ANOTHER live campaign is never written: the candidate steps to _2", function () {
  var root = memDir("Campaigns", {}), taken = memDir(SLUG, { saves: memDir("saves", {}) });
  taken._e["tnd-campaign.json"] = memFile("tnd-campaign.json", JSON.stringify({ campId: "camp_OTHER" }));root._e[SLUG] = taken;
  var h = load(root, [{ id: "camp_A", campName: NAME }, { id: "camp_OTHER", campName: NAME }], "camp_A", wsFor(NAME));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a.tnd").then(function () {
    if (Object.keys(taken._e.saves._e).length) return "the other campaign's folder was written";
    return (root._e[SLUG + "_2"] && (marker(root._e[SLUG + "_2"]) || {}).campId === "camp_A") ? null : "the campaign gets " + SLUG + "_2: " + Object.keys(root._e).join(", ");
  });
});
t("a refused rename keeps the stored slug — the next export lands in the ORIGINAL folder, never the occupied one", function () {
  var root = memDir("Campaigns", {}), beta = memDir("Beta", { saves: memDir("saves", { "b.tnd": memFile("b.tnd", "BETA") }) });
  beta._e["tnd-campaign.json"] = memFile("tnd-campaign.json", JSON.stringify({ campId: "camp_B" }));root._e.Beta = beta;
  var h = load(root, [{ id: "camp_A", campName: "Alpha" }, { id: "camp_B", campName: "Beta" }], "camp_A", wsFor("Alpha"));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a1.tnd").then(function () {
    h.ctx.worldState.campName = "Beta";/* the picker renames the campaign BEFORE the folder rename runs */
    return h.ctx.renameCampaignFolder("Beta");
  }).then(function (r) {
    if (!r || !r.refused) return "the occupied destination is refused: " + JSON.stringify(r);
    /* a RELOAD before the next export — the in-session cache is gone, so only the stored slug can find Alpha/ */
    var h2 = load(root, h.meta(), "camp_A", wsFor("Beta"));
    return h2.ctx.exportToFolder("save", new Blob(["A2"]), "a2.tnd").then(function () {
      if (beta._e.saves._e["a2.tnd"]) return "the next export went into the OTHER campaign's folder";
      return root._e.Alpha && root._e.Alpha._e.saves._e["a2.tnd"] ? ((rowOf(h, "camp_A") || {}).folderSlug === "Alpha" ? null : "the stored slug stays: " + JSON.stringify(rowOf(h, "camp_A"))) : "the next export lands in Alpha/: " + Object.keys(root._e).join(", ");
    });
  });
});
t("a successful rename moves the stored slug with the folder, marker included", function () {
  var root = memDir("Campaigns", {});
  var h = load(root, [{ id: "camp_A", campName: "Alpha" }], "camp_A", wsFor("Alpha"));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a1.tnd").then(function () {
    h.ctx.worldState.campName = "Gamma";
    return h.ctx.renameCampaignFolder("Gamma");
  }).then(function (r) {
    if (!r || !r.renamed) return "renamed: " + JSON.stringify(r);
    if ((rowOf(h, "camp_A") || {}).folderSlug !== "Gamma") return "the stored slug follows the rename: " + JSON.stringify(rowOf(h, "camp_A"));
    return (marker(root._e.Gamma) || {}).campId === "camp_A" ? null : "the marker travels with the copy";
  });
});
t("the #424 copy of a NON-active campaign lands in ITS folder, never the active one's", function () {
  var root = memDir("Campaigns", {});
  var h = load(root, [{ id: "camp_A", campName: "Alpha" }, { id: "camp_B", campName: "Beta" }], "camp_A", wsFor("Alpha"));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a.tnd").then(function () {
    return h.ctx.exportToFolder("save", new Blob(["B"]), "b_copy.tnd", "camp_B", "Beta");
  }).then(function () {
    if (root._e.Alpha && root._e.Alpha._e.saves._e["b_copy.tnd"]) return "the non-active copy landed in the active campaign's folder";
    return (root._e.Beta && root._e.Beta._e.saves._e["b_copy.tnd"] && (marker(root._e.Beta) || {}).campId === "camp_B") ? null : "it lands in Beta/ with Beta's marker: " + Object.keys(root._e).join(", ");
  });
});
t("the stored slug survives mergeCampaignLists (the folder is this device's, the server never overrides it)", function () {
  var ctx = { console: { warn: function () {}, info: function () {}, error: function () {}, log: function () {} }, Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout, fetch: function () {}, window: { addEventListener: function () {} }, document: { addEventListener: function () {}, visibilityState: "visible" }, navigator: {}, localStorage: { getItem: function () { return null; }, setItem: function () {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "helpers.js"), "utf8"), ctx, { filename: "helpers.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "storage-adapter.js"), "utf8"), ctx, { filename: "storage-adapter.js" });
  var sa = ctx.storageAdapter || vm.runInContext("storageAdapter", ctx);
  var merged = sa.mergeCampaignLists([{ id: "camp_A", campName: "Alpha", folderSlug: "Alpha_2" }], [{ id: "camp_A", campName: "Alpha", folderSlug: "Elsewhere" }, { id: "camp_C", campName: "C", folderSlug: "C_from_another_device" }]);
  var a = merged.filter(function (r) { return r.id === "camp_A"; })[0], c = merged.filter(function (r) { return r.id === "camp_C"; })[0];
  if (!a || a.folderSlug !== "Alpha_2") return "the local slug survives: " + JSON.stringify(a);
  return (c && c.folderSlug === undefined) ? null : "a server-sent slug is another device's disk, never adopted: " + JSON.stringify(c);
});
t("a rehome re-stamps the marker it owns, so the campaign keeps its folder under the new id", function () {
  var root = memDir("Campaigns", {});
  var h = load(root, [{ id: "camp_A", campName: "Alpha" }], "camp_A", wsFor("Alpha"));
  return h.ctx.exportToFolder("save", new Blob(["A"]), "a.tnd").then(function () {
    var meta = h.meta();meta[0].id = "camp_NEW";h.ctx.setCampMeta(meta);h.setActive("camp_NEW");
    return h.ctx.campaignFolderRestamp("camp_A", "camp_NEW");
  }).then(function () {
    if ((marker(root._e.Alpha) || {}).campId !== "camp_NEW") return "the marker names the new id: " + JSON.stringify(marker(root._e.Alpha));
    return h.ctx.exportToFolder("save", new Blob(["A2"]), "a2.tnd").then(function () {
      return (Object.keys(root._e).join(",") === "Alpha" && root._e.Alpha._e.saves._e["a2.tnd"]) ? null : "the rehomed campaign keeps its folder: " + Object.keys(root._e).join(", ");
    });
  });
});

t("rehomeCampaign (state.js) calls the re-stamp with the old and the new id — the hook the rehome test drives", function () {
  var src = fs.readFileSync(path.join(ROOT, "state.js"), "utf8"), i = src.indexOf("function rehomeCampaign("), body = i < 0 ? "" : src.slice(i, src.indexOf("\n}", i));
  return body.indexOf("campaignFolderRestamp(old,nid)") >= 0 ? null : "rehomeCampaign no longer re-stamps the folder marker";
});

chain.then(function () {
  console.log("#481 F1 CAMPAIGN FOLDERS: " + fails.length + " failed, " + pass + " passed");
  process.exit(fails.length ? 1 : 0);
});
