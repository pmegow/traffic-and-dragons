// Shared setup for the reviewer's probes. Loads the REAL engine from the review worktree (read-only).
var __A = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/r504/agent";
var __T = process.env.PROBE_TREE || "head";
process.env.ENGINE_ROOT = __T === "head" ? "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rul" : __A + "/" + __T;
console.log("[tree: " + __T + "]");
require("C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/thu/vtags/harness.js");
global.person = function (n, pron, extra) {
  var row = { name: n, status: "present", rel: "ally", pronouns: pron || null, met: 1, partyMember: false, portrait: null, aliases: [] };
  if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
  worldState.npcs.push(row);
  memory.npcs[n] = { attitude: "", knowledge: ["k1", "k2"], events: [], aliases: [], pronouns: pron || undefined };
  return row;
};
// fresh(sceneRefs?) — a world with only the people the probe adds. sceneRefs defaults ON (live play).
global.fresh = function (opts) {
  opts = opts || {};
  makeWorld(); worldState.npcs = []; memory.npcs = {}; delete worldState.kind;
  if (opts.refs !== false) sceneRefsEnsure();
  worldState.turn = opts.turn || 85;
};
global.rows = function () { return worldState.npcs.map(function (n) { return n.name + " [" + (n.status || "") + "|" + (n.rel || "") + "|" + (n.pronouns || "-") + (n.dead ? " DEAD t" + n.dead : "") + (n.partyMember ? " PARTY" : "") + (n.aliases && n.aliases.length ? " aka " + n.aliases.join("/") : "") + "]"; }).join("; "); };
global.mems = function () { return Object.keys(memory.npcs).map(function (k) { var m = memory.npcs[k]; return k + "{" + (m.provisional ? "PROV of=" + m.provisional.of + (m.provisional.called ? " called=" + m.provisional.called : "") + " " : "") + "al=" + JSON.stringify(m.aliases || []) + " ev=" + (m.events || []).length + " kn=" + (m.knowledge || []).length + (m.dead ? " dead=" + m.dead : "") + (m.pronouns ? " pr=" + m.pronouns : "") + "}"; }).join("; "); };
global.hdr = function (s) { console.log("\n=== " + s); };
global.PK = function (name, turn) { return name + " \u00b0t" + turn; };
