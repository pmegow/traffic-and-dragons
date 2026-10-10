// dev/census-tag-layout.js — DEV TOOL: how the GM actually LAYS OUT its tags in real replies, measured over saves' raw
// sessionLog entries (the GM text with its tags intact; dump-transcript.js --raw prints the same entries). Two questions
// the engine's pairing rules depend on:
//   1. tag BLOCKS vs inline tags — a block is a run of tags with nothing but whitespace between them (#511 ②'s notion); every
//      engine test writes inline tags, so this is the only measure of the shape the sequencer (#481 A4) really sees;
//   2. the item PAIRS (#481 A2 / #518) — give (ITEM_LOST + COMPANION_ITEM_GAINED), take (COMPANION_ITEM_LOST + ITEM_GAINED)
//      and stow (ITEM_LOST + LOCATION_ITEM placed) of ONE item key in ONE reply: in the SAME block, or with prose between.
// Read-only; no engine load (pure text scan). Prints a summary and, with --list, every cross-block pair with its reply.
//   node dev/census-tag-layout.js [campaignsRoot] [--list]
var fs = require("fs"), path = require("path");
var args = process.argv.slice(2), list = args.indexOf("--list") >= 0, rootArg = args.filter(function (a) { return a.indexOf("--") !== 0; })[0];
var CAMPS = rootArg ? path.resolve(rootArg) : path.join(__dirname, "..", "Campaigns");
if (!fs.existsSync(CAMPS)) { console.error("census-tag-layout: no campaigns folder at " + CAMPS); process.exit(2); }
function tnds(dir) { var out = []; (function walk(d) { fs.readdirSync(d).forEach(function (f) { var p = path.join(d, f), st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.tnd$/i.test(f)) out.push(p); }); })(dir); return out; }
/* the blocks of a reply: [{start,end,tags:[{name,body,off}]}] — a block is a run of tags separated only by whitespace */
function tagBlocks(text) {
  var re = /\[([A-Z][A-Z_]*)(?::([^\]]*))?\]/g, m, blocks = [], cur = null, lastEnd = -1;
  while ((m = re.exec(text))) {
    var gap = text.slice(lastEnd < 0 ? m.index : lastEnd, m.index);
    if (!cur || lastEnd < 0 || /\S/.test(gap)) { cur = { start: m.index, end: m.index + m[0].length, tags: [] }; blocks.push(cur); }
    cur.tags.push({ name: m[1], body: m[2] || "", off: m.index }); cur.end = m.index + m[0].length; lastEnd = cur.end;
  }
  return blocks;
}
function itemKeyOf(body) { var b = String(body || "").split("|"); var s = (b.length > 1 ? b[1] : b[0]).trim(); return s.toLowerCase().replace(/\s+x\d+$/, "").replace(/\s*[—–-]\s.*$/, "").replace(/s$/, ""); }
var PAIRS = { give: ["ITEM_LOST", "COMPANION_ITEM_GAINED"], take: ["COMPANION_ITEM_LOST", "ITEM_GAINED"], stow: ["ITEM_LOST", "LOCATION_ITEM"] };
var tot = { replies: 0, withTags: 0, tagged: 0, blocks: 0, multiBlocks: 0, singleTagBlocks: 0, replyWithMulti: 0, replyAllInline: 0 };
var pairs = { give: { same: 0, cross: 0 }, take: { same: 0, cross: 0 }, stow: { same: 0, cross: 0 } }, crossList = [], seen = {};
fs.readdirSync(CAMPS).forEach(function (slug) {
  var dir = path.join(CAMPS, slug); if (!fs.statSync(dir).isDirectory()) return;
  tnds(dir).forEach(function (file) {
    var data; try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return; }
    (data.sessionLog || []).forEach(function (e) {
      if (!e || e.role !== "assistant" && e.role !== "gm") return;
      var text = String(e.content || ""), k = slug + "\u0000" + text; if (seen[k]) return; seen[k] = 1;/* saves of one campaign repeat their log */
      tot.replies++;
      var bl = tagBlocks(text); if (!bl.length) return; tot.withTags++;
      var multi = 0; bl.forEach(function (b) { tot.blocks++; tot.tagged += b.tags.length; if (b.tags.length > 1) { tot.multiBlocks++; multi++; } else tot.singleTagBlocks++; });
      if (multi) tot.replyWithMulti++; else tot.replyAllInline++;
      Object.keys(PAIRS).forEach(function (kind) {
        var A = PAIRS[kind][0], B = PAIRS[kind][1], as = [], bs = [];
        bl.forEach(function (b, bi) { b.tags.forEach(function (t) {
          if (t.name === A) as.push({ key: itemKeyOf(t.body), blk: bi });
          if (t.name === B && (kind !== "stow" || /\|\s*placed/i.test(t.body))) bs.push({ key: itemKeyOf(t.body), blk: bi });
        }); });
        as.forEach(function (a) { bs.forEach(function (b) {
          if (a.key !== b.key || !a.key) return;
          if (a.blk === b.blk) pairs[kind].same++; else { pairs[kind].cross++; crossList.push({ camp: slug, kind: kind, key: a.key, turn: e.t, text: text.slice(0, 400).replace(/\s+/g, " ") }); }
        }); });
      });
    });
  });
});
function pct(a, b) { return b ? (100 * a / b).toFixed(1) + "%" : "-"; }
console.log("census-tag-layout over " + CAMPS);
console.log("replies " + tot.replies + ", with tags " + tot.withTags + ", tags " + tot.tagged + ", blocks " + tot.blocks + " (multi-tag " + tot.multiBlocks + ", single " + tot.singleTagBlocks + ")");
console.log("replies with at least one multi-tag block: " + tot.replyWithMulti + " (" + pct(tot.replyWithMulti, tot.withTags) + " of tagged replies); all-inline replies: " + tot.replyAllInline);
Object.keys(pairs).forEach(function (k) { var p = pairs[k]; console.log("pair " + k + ": same block " + p.same + ", cross block " + p.cross + (p.same + p.cross ? " (" + pct(p.cross, p.same + p.cross) + " cross)" : "")); });
if (list) crossList.forEach(function (c) { console.log("\n[" + c.camp + " t" + c.turn + " " + c.kind + " '" + c.key + "']\n" + c.text); });
