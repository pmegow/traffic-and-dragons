// dev/tests-684-atlas.js — #684: the atlas (TnD Maps in the game). Design record: DOC/DESIGN_684_atlas.md.
//   • THE PIN: tndmaps.js is the map library's dist file byte-for-byte (SHA-256), at the version this suite names
//   • it loads as a plain script, adds exactly one global, and draws the same document twice from one seed
//   • the load order, the service-worker shell and the engine manifest carry it
//   node dev/tests-684-atlas.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #684 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #684 " + name + " — " + e.stack); } }

/* A re-vendor changes all three on purpose, in one commit: the file, dev/tndmaps.sha256, and these. */
var TNDMAPS_VERSION = "0.17.0", TNDMAPS_DOC_VER = 6;
var TNDMAPS_SHA256 = fs.existsSync(path.join(ROOT, "dev", "tndmaps.sha256")) ? fs.readFileSync(path.join(ROOT, "dev", "tndmaps.sha256"), "utf8").trim() : "";

/* the library in a bare context: no self, no global, no module — the browser's plain-script case */
function library() {
  var c = vm.createContext({});
  var before = Object.keys(c);
  vm.runInContext(src("tndmaps.js"), c, { filename: "tndmaps.js" });
  return { c: c, T: c.TnDMaps, added: Object.keys(c).filter(function (k) { return before.indexOf(k) < 0; }) };
}
function bare(doc) { var d = JSON.parse(JSON.stringify(doc)); delete d.stats; return JSON.stringify(d); }

(function () {
  var L = null;
  test("tndmaps.js is the map library's file byte-for-byte (SHA-256 pin)", function () {
    var sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "tndmaps.js"))).digest("hex");
    assert(/^[0-9a-f]{64}$/.test(TNDMAPS_SHA256), "dev/tndmaps.sha256 holds the pin");
    assert.equal(sha, TNDMAPS_SHA256, "tndmaps.js drifted from the pinned copy — re-copy dist/tndmaps.js from TnD_Maps (or re-pin on purpose, with the version below)");
  });
  test("it loads as a plain script, adds exactly one global, and is the version this suite names", function () {
    L = library();
    assert.deepEqual(L.added, ["TnDMaps"], "the library must add TnDMaps and nothing else to the page");
    assert.equal(L.T.VERSION, TNDMAPS_VERSION, "the vendored library's version changed — update TNDMAPS_VERSION with the pin");
    assert.equal(L.T.DOC_VER, TNDMAPS_DOC_VER, "the document version changed — saved atlases need a migration review before this lands");
    ["generate", "digest", "validate", "migrate", "view", "sceneOf", "renderSVG"].forEach(function (f) { assert.equal(typeof L.T[f], "function", "TnDMaps." + f); });
    ["region", "town", "dungeon", "interior", "wild"].forEach(function (k) { assert(L.T.GENERATORS[k], "generator " + k); });
    assert.equal(typeof L.T.town.fromRegion, "function"); assert.equal(typeof L.T.wild.fromRegion, "function"); assert.equal(typeof L.T.interior.fromTown, "function");
    ["fromTown", "fromRegion", "fromDungeon", "fromInterior"].forEach(function (f) { assert.equal(typeof L.T.dungeon[f], "function", "dungeon." + f); });
    ["apply", "describe", "validate"].forEach(function (f) { assert.equal(typeof L.T.markers[f], "function", "markers." + f); });
  });
  test("one seed draws one region: two generations are identical (stats aside), and a different seed is a different realm", function () {
    var a = L.T.generate("region", { seed: "atlas-pin" }), b = L.T.generate("region", { seed: "atlas-pin" }), c = L.T.generate("region", { seed: "atlas-pin-2" });
    assert.equal(bare(a), bare(b), "the same seed must draw the same document");
    assert.notEqual(bare(a), bare(c), "a different seed must draw a different document");
    assert(a.places.length > 0 && a.portals.length >= a.places.length, "a region has places, each a portal");
    L.T.validate(JSON.parse(JSON.stringify(a)));
  });
  test("the load order, the shell and the engine manifest: tndmaps.js follows conversation.js and precedes helpers.js", function () {
    var idx = src("index.html"), sw = src("sw.js"), man = require("./engine-manifest.js").map(function (e) { return e.file; });
    function at(f) { var i = idx.indexOf("<script src=\"" + f + "\">"); assert(i >= 0, f + " is not loaded by index.html"); return i; }
    assert(at("conversation.js") < at("tndmaps.js") && at("tndmaps.js") < at("helpers.js"), "index.html order");
    var shell = sw.slice(sw.indexOf("var APP_SHELL = ["), sw.indexOf("];", sw.indexOf("var APP_SHELL = [")));
    assert(shell.indexOf("\"/tndmaps.js\"") >= 0, "tndmaps.js missing from APP_SHELL — the game would not start offline");
    assert(man.indexOf("tndmaps.js") > man.indexOf("conversation.js") && man.indexOf("tndmaps.js") < man.indexOf("helpers.js"), "engine manifest order");
    assert.equal(require("./engine-manifest.js")[man.indexOf("tndmaps.js")].sym, "TnDMaps");
  });
  console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " atlas groups (#684)");
})();
