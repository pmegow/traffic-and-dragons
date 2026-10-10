// dev/census-rag-echo.js — DEV TOOL (#527 lead 5): how often the RAG echo gate (#469 ⑥, memory.js ragRetrieve) would WITHHOLD a
// transcript excerpt on the owner's real saves, and on how many shared words each withholding rests. The gate drops an excerpt
// that retells a held prior adventure (momentEchoWords over the party's prior-campaign moments) while the earlier adventures
// are held (ragEchoGate: a small-talk kind, outside the Hall, the hero not raising the past). The lead's question: does one
// shared phrase cost a whole scene, and how often? Read-only: each save is loaded into a detached engine state (the
// capture-prompt pattern), never written. Prints one line per newest save per campaign and a total.
//   node dev/census-rag-echo.js [campaignsRoot] [--list]
var fs = require("fs"), path = require("path");
var engine = require("./load-engine.js"); engine.loadEngine("game.js");
var args = process.argv.slice(2), list = args.indexOf("--list") >= 0, rootArg = args.filter(function (a) { return a.indexOf("--") !== 0; })[0];
var CAMPS = rootArg ? path.resolve(rootArg) : path.join(__dirname, "..", "Campaigns");
if (!fs.existsSync(CAMPS)) { console.error("census-rag-echo: no campaigns folder at " + CAMPS); process.exit(2); }
function newestTnd(dir) { var best = null; (function walk(d) { fs.readdirSync(d).forEach(function (f) { var p = path.join(d, f), st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.tnd$/i.test(f) && (!best || st.mtimeMs > best.m)) best = { p: p, m: st.mtimeMs }; }); })(dir); return best && best.p; }
var oc = console.warn, oi = console.info; console.warn = function () {}; console.info = function () {};
var tot = { camps: 0, gated: 0, eligible: 0, withheld: 0, byWords: {} }, rows = [];
fs.readdirSync(CAMPS).forEach(function (slug) {
  var dir = path.join(CAMPS, slug); if (!fs.statSync(dir).isDirectory()) return;
  var save = newestTnd(dir); if (!save) return;
  var raw; try { raw = JSON.parse(fs.readFileSync(save, "utf8")); } catch (e) { rows.push(slug + ": unreadable"); return; }
  if (!raw.worldState || !raw.worldState.character) return;
  worldState = inflateWorldStateSnapshot(raw.worldState); memory = raw.memory || memory; sessionLog = raw.sessionLog || [];
  tot.camps++;
  var kind = (typeof kindDef === "function") ? kindDef() : null, smallTalk = !!(kind && kind.smallTalk);
  var p = (typeof heldPastParty === "function") ? heldPastParty() : null;
  var tr = worldState.transcript || [], el = 0, wh = 0, words = {}, hits = [];
  if (p) for (var i = 0; i < tr.length; i++) {
    var en = tr[i]; if (!en || en.r !== "gm" || en.bk || en.rc || en.rf || en.db) continue; el++;
    var h = momentEchoWords(String(en.x || ""), p.prior, p.names);
    if (h) { wh++; words[h.words] = (words[h.words] || 0) + 1; tot.byWords[h.words] = (tot.byWords[h.words] || 0) + 1; if (list) hits.push({ t: en.t, who: h.who, words: h.words, text: String(en.x).slice(0, 220).replace(/\s+/g, " ") }); }
  }
  var gateCould = smallTalk && !!p;
  if (gateCould) { tot.gated++; tot.eligible += el; tot.withheld += wh; }
  rows.push(slug + ": " + (kind ? kind.id || "kind" : "no kind") + (smallTalk ? " (small talk: gate can hold)" : " (gate never holds here)") + ", prior moments " + (p ? p.prior.length : 0) + ", gm excerpts " + el + ", would withhold " + wh + (wh ? " (shared words: " + JSON.stringify(words) + ")" : ""));
  if (list) hits.forEach(function (h) { rows.push("    t" + h.t + " [" + h.who + ", " + h.words + " words] " + h.text); });
});
console.warn = oc; console.info = oi;
rows.forEach(function (r) { console.log(r); });
console.log("census-rag-echo: " + tot.camps + " campaigns, " + tot.gated + " where the gate can hold; of their " + tot.eligible + " GM excerpts the gate would withhold " + tot.withheld + (tot.eligible ? " (" + (100 * tot.withheld / tot.eligible).toFixed(2) + "%)" : "") + "; shared-word distribution " + JSON.stringify(tot.byWords) + "; the bar is " + (typeof MOTIF_MIN_WORDS === "number" ? MOTIF_MIN_WORDS : "?") + " words with one of " + (typeof MOTIF_STRONG_MIN === "number" ? MOTIF_STRONG_MIN : "?") + "+ letters");
