// measure-accumulators.js — DEV TOOL (#465, the monotonic-resources pass): the census of a save's
// per-campaign-forever accumulators — the maps and lists that only ever grow for the life of a
// campaign and carry no gauge of their own. #465 asked to cap them; the rule was MEASURE FIRST, and
// on the most mature save (Runelords t2477) the worldState latches and ledgers came to under 3 KB
// together. Every one is keyed by an entity (a name, a place, a name pair), so it grows with the
// cast and the map, not with turns. This script makes that check one command for the next pass.
//
// What it reads (a .tnd is plain JSON: {worldState, sessionLog, memory}):
//   nudge latch maps   worldState.mergeHintNudged, pendingMergeHints, provisionalNudged,
//                      recurringNameNudged, canonContraNudged, deathEvidenceNudged, locDescNudged,
//                      relAxisReviewFired
//   ledgers            worldState.plotArmor, relBondReceipts, clock.repairs, and tagLog — the
//                      provenance ring, capped at TAG_LOG_CAP: the REFERENCE row, a bounded store
//                      to compare the unbounded ones against
//   map and places     memory.locations, memory.map.nodes (world = no parent, sub = parent set;
//                      visited = visits>0, else known), memory.map.edges, every node's npcs[] and
//                      guestbook (name-keyed records {turns, resident, by, agg}: turns hold at most
//                      GB_TURN_CAP exact turns, older ones fold into agg)
//   archive            memory.archive, one row per category
//
// How to read it: count is keys for an object, rows for an array; "absent" means the field was
// never written (most latches are created on their first write). Bytes are JSON.stringify length
// (characters, approximate). A healthy accumulator's count tracks the cast or the map; one that
// tracks the turn number is the finding. The guestbook "one-turn crowd" is the most names stamped
// on a single exact turn at a single node. Check the memory owner line first: the #365 half-switch
// left saves whose memory belongs to ANOTHER campaign (the pre-repair Runelords saves carry the Iron
// Meridian's), and only a memory.campId stamp (v1.851+) proves ownership — "unstamped" means the
// memory-side rows are unverified, "MISMATCH" means they describe the other campaign.
// --all prints one table row per save, then the MAX block: the largest count and the largest byte
// size of every accumulator across all saves, with the save that holds it (+N = saves tied at it).
// Read-only and pure: no engine load, no network; the saves are never written.
//
// Usage: node dev/measure-accumulators.js <save.tnd>    one save, full detail
//        node dev/measure-accumulators.js --all         every Campaigns/*/saves/*.tnd: table, then MAX
// A save that fails to parse is skipped under --all with a line on stderr; exit 2 only on a bad argument.
var fs = require("fs"), path = require("path");
var ROOT = path.resolve(__dirname, ".."), NL = String.fromCharCode(10);
var LATCHES = ["mergeHintNudged", "pendingMergeHints", "provisionalNudged", "recurringNameNudged", "canonContraNudged", "deathEvidenceNudged", "locDescNudged", "relAxisReviewFired"];

// The two caps are read from globals.js as text (no engine load), so the printout never goes stale.
function capFromGlobals(name) {
  try {
    var src = fs.readFileSync(path.join(ROOT, "globals.js"), "utf8"), m = new RegExp("var " + name + "=([0-9]+)").exec(src);
    return m ? parseInt(m[1], 10) : null;
  } catch (e) { return null; }
}
var TAG_LOG_CAP = capFromGlobals("TAG_LOG_CAP"), GB_TURN_CAP = capFromGlobals("GB_TURN_CAP");
if (TAG_LOG_CAP === null || GB_TURN_CAP === null) console.error("measure-accumulators: could not read " + (TAG_LOG_CAP === null ? "TAG_LOG_CAP " : "") + (GB_TURN_CAP === null ? "GB_TURN_CAP " : "") + "from globals.js — the cap prints as ?");

function num(n) { var s = String(n), o = ""; while (s.length > 3) { o = "," + s.slice(-3) + o; s = s.slice(0, -3); } return s + o; }
function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
function lpad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }
function rel(f) { var r = path.relative(ROOT, f); return r.indexOf("..") === 0 ? f : r.split(path.sep).join("/"); }

// One accumulator's size: {present, count, unit, bytes}.
function size(x) {
  if (x === undefined) return { present: false, count: 0, unit: "", bytes: 0 };
  var s = JSON.stringify(x), b = s === undefined ? 0 : s.length;
  if (Array.isArray(x)) return { present: true, count: x.length, unit: x.length === 1 ? "row" : "rows", bytes: b };
  if (x && typeof x === "object") { var k = Object.keys(x).length; return { present: true, count: k, unit: k === 1 ? "key" : "keys", bytes: b }; }
  return { present: true, count: 0, unit: "(" + (x === null ? "null" : typeof x) + ")", bytes: b };
}
function sizeTxt(z) { return z.present ? num(z.count) + " " + z.unit : "absent"; }

function nodeStats(nodes) {
  var st = { count: 0, parentSet: 0, worldVisited: 0, worldKnown: 0, subVisited: 0, subKnown: 0,
    npcsTotal: 0, npcsBytes: 0, npcsMax: 0, npcsMaxAt: null, gbNodes: 0, gbRecords: 0, gbBytes: 0, gbMax: 0, gbMaxAt: null,
    gbTurnsMax: 0, gbByMax: 0, gbFolded: 0, gbCrowdMax: 0, gbCrowdAt: null, gbCrowdTurn: null };
  if (!nodes || typeof nodes !== "object") return st;
  Object.keys(nodes).forEach(function (k) {
    var n = nodes[k];
    st.count++;
    if (!n || typeof n !== "object") return;
    var visited = typeof n.visits === "number" && n.visits > 0;
    if (n.parent) { st.parentSet++; if (visited) st.subVisited++; else st.subKnown++; }
    else { if (visited) st.worldVisited++; else st.worldKnown++; }
    var npcs = Array.isArray(n.npcs) ? n.npcs.length : 0;
    st.npcsTotal += npcs;
    if (n.npcs !== undefined) st.npcsBytes += size(n.npcs).bytes;
    if (npcs > st.npcsMax) { st.npcsMax = npcs; st.npcsMaxAt = k; }
    var gb = n.guestbook;
    if (!gb || typeof gb !== "object") return;
    var names = Object.keys(gb), byTurn = {};
    st.gbNodes++;
    st.gbRecords += names.length;
    st.gbBytes += size(gb).bytes;
    if (names.length > st.gbMax) { st.gbMax = names.length; st.gbMaxAt = k; }
    names.forEach(function (nm) {
      var r = gb[nm] || {}, turns = Array.isArray(r.turns) ? r.turns : [], by = r.by && typeof r.by === "object" ? Object.keys(r.by).length : 0;
      if (turns.length > st.gbTurnsMax) st.gbTurnsMax = turns.length;
      if (by > st.gbByMax) st.gbByMax = by;
      if (r.agg) st.gbFolded++;
      turns.forEach(function (t) { byTurn[t] = (byTurn[t] || 0) + 1; });
    });
    Object.keys(byTurn).forEach(function (t) {
      if (byTurn[t] > st.gbCrowdMax) { st.gbCrowdMax = byTurn[t]; st.gbCrowdAt = k; st.gbCrowdTurn = t; }
    });
  });
  return st;
}

// Everything measured on one save. rows[] are the accumulators the MAX block aggregates, by id.
function measure(file) {
  var text = fs.readFileSync(file, "utf8"), data = JSON.parse(text);
  if (!data || typeof data !== "object" || !data.worldState || typeof data.worldState !== "object") throw new Error("no worldState object at the top level — not a .tnd save");
  var ws = data.worldState, mem = data.memory && typeof data.memory === "object" ? data.memory : {}, map = mem.map && typeof mem.map === "object" ? mem.map : {};
  var out = { file: file, label: path.basename(file).replace(/\.tnd$/, ""), camp: ws.campName || "?", turn: ws.turn, ver: ws.ver,
    fileBytes: fs.statSync(file).size, rows: [], groups: {}, nodes: nodeStats(map.nodes), archive: [] };
  // Whose memory is this? The #365 half-switch paired one campaign's worldState with another's memory;
  // the memory-side numbers then describe the OTHER campaign. saveMem stamps memory.campId since v1.851.
  out.owner = !mem.campId ? "unstamped" : (ws.campId && mem.campId !== ws.campId ? "MISMATCH" : "ok");
  out.ownerTxt = out.owner === "ok" ? "memory.campId matches worldState.campId"
    : out.owner === "MISMATCH" ? "MISMATCH — memory.campId " + mem.campId + " is not worldState.campId " + ws.campId + "; the memory-side rows describe another campaign"
    : "memory.campId unstamped (a pre-v1.851 save): ownership unverified — #365 found saves carrying another campaign's memory";
  function add(group, id, name, x) { var z = size(x); out.rows.push({ group: group, id: id, name: name, z: z }); return z; }
  LATCHES.forEach(function (k) { add("latches", k, k, ws[k]); });
  add("ledgers", "plotArmor", "plotArmor", ws.plotArmor);
  add("ledgers", "relBondReceipts", "relBondReceipts", ws.relBondReceipts);
  add("ledgers", "clock.repairs", "clock.repairs", ws.clock && typeof ws.clock === "object" ? ws.clock.repairs : undefined);
  add("ledgers", "tagLog", "tagLog (reference ring, cap " + (TAG_LOG_CAP === null ? "?" : TAG_LOG_CAP) + ")", ws.tagLog);
  add("map", "memory.locations", "memory.locations", mem.locations);
  add("map", "memory.map.nodes", "memory.map.nodes", map.nodes);
  add("map", "memory.map.edges", "memory.map.edges", map.edges);
  var arch = mem.archive && typeof mem.archive === "object" ? mem.archive : null;
  out.archiveAll = size(arch === null ? undefined : arch);
  if (arch) Object.keys(arch).forEach(function (c) { out.archive.push({ id: "memory.archive." + c, name: c, z: size(arch[c]) }); });
  out.rows.forEach(function (r) { var g = out.groups[r.group] || (out.groups[r.group] = { bytes: 0 }); g.bytes += r.z.bytes; });
  return out;
}

function printOne(m) {
  var s = m.nodes, lines = [];
  lines.push("# " + m.camp + " — turn " + m.turn + " — save ver " + m.ver);
  lines.push("# " + rel(m.file) + " — " + num(m.fileBytes) + " bytes");
  lines.push("# " + m.ownerTxt);
  var titles = { latches: "nudge latch maps (worldState)", ledgers: "ledgers (worldState)", map: "map and places (memory)" };
  var cur = null;
  m.rows.forEach(function (r) {
    if (r.group !== cur) { cur = r.group; lines.push(""); lines.push(titles[cur] + " — " + num(m.groups[cur].bytes) + " B"); }
    lines.push("  " + pad(r.name, 36) + pad(sizeTxt(r.z), 12) + (r.z.present ? lpad(num(r.z.bytes), 9) + " B" : ""));
  });
  lines.push("  " + pad("map.nodes by kind", 36) + "world (no parent) " + s.worldVisited + " visited + " + s.worldKnown + " known · sub (parent set) " + s.subVisited + " visited + " + s.subKnown + " known");
  lines.push("  " + pad("node.npcs", 36) + s.npcsTotal + " total, " + num(s.npcsBytes) + " B · max " + s.npcsMax + (s.npcsMaxAt ? " on \"" + s.npcsMaxAt + "\"" : ""));
  lines.push("  " + pad("node.guestbook records", 36) + s.gbRecords + " on " + s.gbNodes + " nodes, " + num(s.gbBytes) + " B · max " + s.gbMax + " on one node" + (s.gbMaxAt ? " (\"" + s.gbMaxAt + "\")" : ""));
  lines.push("  " + pad("guestbook record size", 36) + "max " + s.gbTurnsMax + " exact turns, " + s.gbByMax + " sources in one record (GB_TURN_CAP " + (GB_TURN_CAP === null ? "?" : GB_TURN_CAP) + ") · " + s.gbFolded + " records folded into agg");
  lines.push("  " + pad("guestbook one-turn crowd", 36) + "max " + s.gbCrowdMax + " names" + (s.gbCrowdAt ? " on \"" + s.gbCrowdAt + "\" at t" + s.gbCrowdTurn : ""));
  lines.push("");
  lines.push("archive (memory.archive) — " + (m.archiveAll.present ? m.archive.length + " categories, " + num(m.archiveAll.bytes) + " B" : "absent"));
  m.archive.forEach(function (a) { lines.push("  " + pad(a.name, 36) + pad(sizeTxt(a.z), 12) + lpad(num(a.z.bytes), 9) + " B"); });
  lines.push("");
  lines.push("file: " + num(m.fileBytes) + " bytes");
  console.log(lines.map(function (l) { return l.replace(/ +$/, ""); }).join(NL));
}

// --all: ONE table, one row per save. "-" = absent. The per-latch and per-category detail is in the
// MAX block below it and in the single-save mode.
function printTable(all) {
  var COLS = [
    ["turn", function (m) { return m.turn; }],
    ["latch keys", function (m) { return sum(m, "latches", "count"); }],
    ["latch B", function (m) { return num(m.groups.latches.bytes); }],
    ["relBond", function (m) { return cnt(m, "relBondReceipts"); }],
    ["repairs", function (m) { return cnt(m, "clock.repairs"); }],
    ["tagLog B", function (m) { return byt(m, "tagLog"); }],
    ["locs", function (m) { return cnt(m, "memory.locations"); }],
    ["nodes", function (m) { return cnt(m, "memory.map.nodes"); }],
    ["edges", function (m) { return cnt(m, "memory.map.edges"); }],
    ["npcs", function (m) { return m.nodes.npcsTotal; }],
    ["npc max", function (m) { return m.nodes.npcsMax; }],
    ["gb recs", function (m) { return m.nodes.gbRecords; }],
    ["gb max", function (m) { return m.nodes.gbMax; }],
    ["gb B", function (m) { return num(m.nodes.gbBytes); }],
    ["arch rows", function (m) { var n = 0; m.archive.forEach(function (a) { n += a.z.count; }); return m.archiveAll.present ? num(n) : "-"; }],
    ["arch B", function (m) { return m.archiveAll.present ? num(m.archiveAll.bytes) : "-"; }],
    ["file B", function (m) { return num(m.fileBytes); }],
    ["memory", function (m) { return m.owner; }]
  ];
  function row(m, id) { for (var i = 0; i < m.rows.length; i++) if (m.rows[i].id === id) return m.rows[i]; return null; }
  function cnt(m, id) { var r = row(m, id); return r && r.z.present ? r.z.count : "-"; }
  function byt(m, id) { var r = row(m, id); return r && r.z.present ? num(r.z.bytes) : "-"; }
  function sum(m, g, f) { var n = 0, any = false; m.rows.forEach(function (r) { if (r.group === g && r.z.present) { n += r.z[f]; any = true; } }); return any ? n : "-"; }
  var w0 = 4, cells = all.map(function (m) { if (m.label.length > w0) w0 = m.label.length; return COLS.map(function (c) { return String(c[1](m)); }); });
  var widths = COLS.map(function (c, i) { var w = c[0].length; cells.forEach(function (r) { if (r[i].length > w) w = r[i].length; }); return w; });
  console.log(pad("save", w0) + COLS.map(function (c, i) { return "  " + lpad(c[0], widths[i]); }).join(""));
  all.forEach(function (m, j) { console.log(pad(m.label, w0) + cells[j].map(function (v, i) { return "  " + lpad(v, widths[i]); }).join("")); });
}

// The MAX block: for every accumulator id, the largest count and the largest bytes across all saves.
function printMax(all, skipped) {
  var order = [], archOrder = [], best = {};
  function seen(id, name) { if (!best[id]) { best[id] = { name: name, present: 0, cMax: -1, cAt: null, cTies: 0, bMax: -1, bAt: null, bTies: 0, unit: "" }; (/^memory\.archive\./.test(id) ? archOrder : order).push(id); } return best[id]; }
  function offer(id, name, z, label, extra) {
    var b = seen(id, name);
    if (!z.present) return;
    b.present++;
    if (z.count > b.cMax) { b.cMax = z.count; b.cAt = label + (extra || ""); b.cTies = 0; b.unit = z.unit; } else if (z.count === b.cMax) b.cTies++;
    if (z.bytes > b.bMax) { b.bMax = z.bytes; b.bAt = label; b.bTies = 0; } else if (z.bytes === b.bMax) b.bTies++;
  }
  function stat(id, name, v, label, extra) { offer(id, name, { present: true, count: v, unit: "", bytes: -1 }, label, extra); }
  all.forEach(function (m) {
    m.rows.forEach(function (r) { offer(r.id, r.name, r.z, m.label); });
    var s = m.nodes;
    stat("nodes.parentSet", "map.nodes with parent set", s.parentSet, m.label);
    offer("node.npcs.total", "node.npcs total", { present: true, count: s.npcsTotal, unit: "", bytes: s.npcsBytes }, m.label);
    stat("node.npcs.max", "node.npcs max on one node", s.npcsMax, m.label, s.npcsMaxAt ? " @ \"" + s.npcsMaxAt + "\"" : "");
    offer("gb.records", "guestbook records total", { present: true, count: s.gbRecords, unit: "", bytes: s.gbBytes }, m.label);
    stat("gb.maxNode", "guestbook records max on one node", s.gbMax, m.label, s.gbMaxAt ? " @ \"" + s.gbMaxAt + "\"" : "");
    stat("gb.turns", "guestbook exact turns max in one record", s.gbTurnsMax, m.label);
    stat("gb.folded", "guestbook records folded into agg", s.gbFolded, m.label);
    stat("gb.crowd", "guestbook one-turn crowd max", s.gbCrowdMax, m.label, s.gbCrowdAt ? " @ \"" + s.gbCrowdAt + "\" t" + s.gbCrowdTurn : "");
    offer("memory.archive", "memory.archive (all categories)", m.archiveAll, m.label);
    m.archive.forEach(function (a) { offer(a.id, "archive." + a.name, a.z, m.label); });
    offer("file", "file bytes", { present: true, count: m.fileBytes, unit: "bytes", bytes: -1 }, m.label);
  });
  order = order.slice(0, order.indexOf("file")).concat(archOrder, ["file"]);
  var unowned = all.filter(function (m) { return m.owner !== "ok"; }).length;
  console.log("");
  console.log("== MAX across " + all.length + " saves" + (skipped ? " (" + skipped + " skipped — see stderr)" : "") + " — count = keys/rows; bytes = JSON length; (+N) = other saves tied at the max");
  console.log("  " + pad("accumulator", 42) + pad("max count", 14) + "held by");
  order.forEach(function (id) {
    var b = best[id];
    if (!b.present) { console.log("  " + pad(b.name, 42) + "absent in every save"); return; }
    var c = num(b.cMax) + (b.unit && b.unit !== "bytes" ? " " + b.unit : "");
    var line = "  " + pad(b.name, 42) + pad(c, 14) + b.cAt + (b.cTies ? " (+" + b.cTies + ")" : "") + (b.present < all.length ? " — present in " + b.present + "/" + all.length : "");
    if (b.bMax >= 0) line += NL + "  " + pad("", 42) + pad(num(b.bMax) + " B", 14) + b.bAt + (b.bTies ? " (+" + b.bTies + ")" : "");
    console.log(line);
  });
  if (unowned) console.log("  note: " + unowned + "/" + all.length + " saves have no verified memory owner (column \"memory\": unstamped or MISMATCH) — a memory-side max held by one of them may describe another campaign (#365)");
}

function allSaves() {
  var base = path.join(ROOT, "Campaigns"), out = [];
  if (!fs.existsSync(base)) return out;
  fs.readdirSync(base).sort().forEach(function (camp) {
    var dir = path.join(base, camp, "saves");
    try { if (!fs.statSync(dir).isDirectory()) return; } catch (e) { return; }
    fs.readdirSync(dir).sort().forEach(function (f) { if (/\.tnd$/.test(f)) out.push(path.join(dir, f)); });
  });
  return out;
}

var args = process.argv.slice(2);
var USAGE = "usage: node dev/measure-accumulators.js <save.tnd> | --all";
if (args.length !== 1) { console.error(USAGE); process.exit(2); }
if (args[0] === "--all") {
  var files = allSaves(), done = [], skipped = 0;
  if (!files.length) console.error("measure-accumulators: no saves found under Campaigns/*/saves/*.tnd");
  files.forEach(function (f) {
    var m;
    try { m = measure(f); } catch (e) { skipped++; console.error("SKIPPED " + rel(f) + " — " + e.message); return; }
    done.push(m);
  });
  if (done.length) { printTable(done); printMax(done, skipped); }
} else if (/^--/.test(args[0])) {
  console.error("unknown flag " + args[0] + NL + USAGE); process.exit(2);
} else {
  var one;
  if (!fs.existsSync(args[0])) { console.error("no such file: " + args[0] + NL + USAGE); process.exit(2); }
  try { one = measure(path.resolve(args[0])); } catch (e) { console.error("cannot read " + args[0] + " as a save — " + e.message); process.exit(2); }
  printOne(one);
}
