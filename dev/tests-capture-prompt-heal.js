// dev/tests-capture-prompt-heal.js — the prompt capture mirrors the game's LOAD (Thursday review 2026-10-15, rung 3).
//   dev/capture-prompt.js renders buildSysPrompt() for a real save so a week's prompt changes can be diffed on the owner's own
//   campaigns. The game's loadState heals memory the moment it is read (state.js healMemory — the #618 start-world stamp among
//   its repairs) and only then prepares the packs; the capture ran the pack door but skipped the heal, so a save the game would
//   repair at load captured as the game never serves it: the Village t291 printed "KNOWN OF (not yet visited): The Village"
//   beside "Location: The Village" at HEAD. This suite builds a save whose current world node is stored unvisited, runs the real
//   tool as a child process, and reads the volatile half it wrote: the world must be VISITED, never KNOWN OF.
//   node dev/tests-capture-prompt-heal.js
var assert = require("assert/strict"), fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
var L = require("./load-engine.js"); L.loadEngine();
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};
var ws = L.makeTestWorld({});
ws.world.location = "Ashfen"; ws.world.sublocation = null; ws.turn = 3;
memory.locations = {};                                  /* nothing ever filed through fileLocation (the #464 union is the only route to the TOC) */
memory.map = memory.map || { nodes: {} }; memory.map.nodes = memory.map.nodes || {};
memory.map.nodes["Ashfen"] = { firstVisit: null, visits: 0, description: null, parent: null, npcs: [], items: [], size: null, travelMins: null };   /* the minted node shape (memory.js) at the pre-#481-C11 visit count #618 heals at load */
var dir = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-capture-heal-")), save = path.join(dir, "fixture.tnd"), out = path.join(dir, "out");
fs.writeFileSync(save, JSON.stringify({ worldState: ws, memory: memory, sessionLog: [] }), "utf8");
var root = path.join(__dirname, "..");
var r = cp.spawnSync(process.execPath, [path.join(__dirname, "capture-prompt.js"), save, out], { cwd: root, encoding: "utf8" });
assert.equal(r.status, 0, "capture-prompt exits 0 — stdout: " + r.stdout + " stderr: " + r.stderr);
var vol = fs.readFileSync(path.join(out, "volatile.txt"), "utf8");
assert.ok(/^Location: Ashfen/m.test(vol), "the fixture stands in Ashfen: " + (vol.match(/^Location:.*$/m) || ["(no Location line)"])[0]);
assert.ok(!/^KNOWN OF \(not yet visited\):.*\bAshfen\b/m.test(vol), "the capture serves the world the game would serve: Ashfen is not KNOWN OF beside Location: Ashfen (the load heal did not run)");
assert.ok(/^VISITED:.*\bAshfen\b/m.test(vol), "Ashfen is VISITED after the load heal: " + (vol.match(/^VISITED:.*$/m) || ["(no VISITED line)"])[0]);
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
console.log("ALL GREEN — 3 assertions (capture-prompt runs the game's load heal before it renders)");
