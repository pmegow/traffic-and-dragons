// register-scrub.js — DEV TOOL (#459 ⑤, owner-run): find every RECORD line a campaign carries in accountant's language
// and rewrite it into plain speech. The GM pastes records into mouths (the Village hearth, 2026-09-25: Daeris's
// "soul-tax lien and necrotic tether" read aloud word for word), so the records themselves must not be written that way.
//
// Usage:
//   node dev/register-scrub.js <save.tnd | sheet.char>                 list every record line that hits the word list
//   node dev/register-scrub.js <file> --from rewrites.json             print before/after for a prepared list
//   node dev/register-scrub.js <file> [--provider anthropic|gemini] [--model m]
//                                                                      with ANTHROPIC_API_KEY / GEMINI_API_KEY set in the
//                                                                      shell: rewrite each line ONCE through the model and
//                                                                      print before/after (a rewrite still in the register
//                                                                      is reported and never applied)
//   ... --apply                                                        write the rewrites back; <file>.bak keeps the original
//   ... --out rewrites.json                                            save the rewrites (model or prepared) for --from later
//
// Scope (the records the GM reads back): memory.npcs[*].knowledge / events[].note / attitude, memory.lore, keyDecisions,
// chapters, every sheet's coreMemories[].text, motivationHistory[].text/.how and motivation (the hero and the party in a
// save; the one sheet in a .char), the quests (title/desc/objectives) and the skeleton (premise, acts, arcs). The word
// list is the widened LABEL_RE (helpers.js): the narration register plus the paperwork nouns. Without --apply nothing is
// written; never the owner's save without a .bak. Pure pieces (list / apply / rewritePrompt) are exported for the tests.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
/* lazy: a host that already holds the engine (the standalone suite) must not load it twice */
if (typeof wordListScan !== "function" || typeof LABEL_RE === "undefined") require("./load-engine.js").loadEngine();

function pathKey(name) { return /^[A-Za-z_$][\w$]*$/.test(name) ? "." + name : "[" + JSON.stringify(name) + "]"; }

function list(data) {
  var rows = [];
  function chk(p, text) {
    if (typeof text !== "string" || !text) return;
    var h = wordListScan(text, LABEL_RE); if (h.length) rows.push({ path: p, words: h, text: text });
  }
  function sheet(prefix, s) {
    if (!s || typeof s !== "object") return;
    (s.coreMemories || []).forEach(function (c, i) { chk(prefix + ".coreMemories[" + i + "].text", c && c.text); });
    (s.motivationHistory || []).forEach(function (m, i) { chk(prefix + ".motivationHistory[" + i + "].text", m && m.text); chk(prefix + ".motivationHistory[" + i + "].how", m && m.how); });
    chk(prefix + ".motivation", s.motivation);
  }
  var ws = data && data.worldState, mem = data && data.memory;
  if (ws && typeof ws === "object") {
    sheet("worldState.character", ws.character);
    (ws.npcs || []).forEach(function (n, i) { if (n && n.charSheet) sheet("worldState.npcs[" + i + "].charSheet", n.charSheet); });
    (ws.quests || []).forEach(function (q, i) { if (!q) return; var qp = "worldState.quests[" + i + "]"; chk(qp + ".title", q.title); chk(qp + ".desc", q.desc); (q.objectives || []).forEach(function (o, j) { chk(qp + ".objectives[" + j + "].text", o && o.text); }); });
    var sk = ws.skeleton;
    if (sk && typeof sk === "object") {
      chk("worldState.skeleton.premise", sk.premise);
      (sk.acts || []).forEach(function (a, i) { if (!a) return; var ap = "worldState.skeleton.acts[" + i + "]"; chk(ap + ".title", a.title); chk(ap + ".goal", a.goal); chk(ap + ".turningPoint", a.turningPoint);
        (a.arcs || []).forEach(function (r, j) { if (!r) return; var rp = ap + ".arcs[" + j + "]"; chk(rp + ".title", r.title); chk(rp + ".objective", r.objective); chk(rp + ".dnaHint", r.dnaHint); }); });
    }
  }
  if (mem && typeof mem === "object") {
    Object.keys(mem.npcs || {}).forEach(function (nm) { var n = mem.npcs[nm]; if (!n) return; var np = "memory.npcs" + pathKey(nm);
      (n.knowledge || []).forEach(function (k, i) { chk(np + ".knowledge[" + i + "]", k); });
      (n.events || []).forEach(function (e, i) { chk(np + ".events[" + i + "].note", e && e.note); });
      chk(np + ".attitude", n.attitude); });
    (mem.lore || []).forEach(function (l, i) { chk("memory.lore[" + i + "]", l); });
    (mem.keyDecisions || []).forEach(function (d, i) { chk("memory.keyDecisions[" + i + "].desc", d && d.desc); });
    (mem.chapters || []).forEach(function (c, i) { chk("memory.chapters[" + i + "].summary", c && c.summary); });
  }
  if (data && data.type === "character" && data.character) sheet("character", data.character);
  return rows;
}

// path → {parent,key}; a path the data does not hold resolves to null (never invents a slot)
function resolve(data, p) {
  var re = /\.([A-Za-z_$][\w$]*)|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]/g, m, cur = data, last = null, consumed = 0;
  var head = /^([A-Za-z_$][\w$]*)/.exec(p); if (!head) return null;
  var tokens = [head[1]]; re.lastIndex = head[1].length; consumed = head[1].length;
  while ((m = re.exec(p))) { if (m.index !== consumed) return null; consumed = re.lastIndex; tokens.push(m[1] !== undefined ? m[1] : (m[2] !== undefined ? Number(m[2]) : JSON.parse('"' + m[3] + '"'))); }
  if (consumed !== p.length) return null;
  for (var i = 0; i < tokens.length - 1; i++) { if (cur == null || typeof cur !== "object") return null; cur = cur[tokens[i]]; }
  if (cur == null || typeof cur !== "object") return null;
  last = tokens[tokens.length - 1];
  return typeof cur[last] === "string" ? { parent: cur, key: last } : null;
}
function apply(data, rewrites) {
  var n = 0, i;
  for (i = 0; i < (rewrites || []).length; i++) {
    var r = rewrites[i]; if (!r || typeof r.path !== "string" || typeof r.text !== "string" || !r.text.trim()) continue;
    var at = resolve(data, r.path); if (!at) { console.warn("register-scrub: " + r.path + " does not resolve to a record line — skipped"); continue; }
    at.parent[at.key] = r.text; n++;
  }
  return n;
}
function rewritePrompt(row) {
  var w = (row.words || []).map(function (x) { return "'" + x + "'"; }).join(", ");
  return "Rewrite this one line of a story's memory record in plain speech, the way a friend who was there would say it. Keep every name, every fact and every event, about the same length, but remove every clerical image — it used " + w + ". This world keeps no books: debts are blood, oaths, hunger and memory; say what the thing IS (a curse, a hunger, an oath, a bargain in blood) instead of the paperwork word for it. Reply with the rewritten line only: no preamble, no quotes, no markdown.\n\nLINE:\n" + row.text;
}
var REWRITE_SYS = "You rewrite one line of a story's memory record on request. Reply with the rewritten line only: no preamble, no quotes, no markdown, no JSON.";

async function modelRewrite(rows, providerId, model) {
  var prov = PROVIDERS[providerId]; if (!prov) throw new Error("unknown provider " + providerId);
  var key = providerId === "gemini" ? (process.env.GEMINI_API_KEY || "") : (process.env.ANTHROPIC_API_KEY || "");
  if (!key) throw new Error((providerId === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY") + " is not set in this shell");
  if (/[^\x21-\x7e]/.test(key)) throw new Error("the API key holds a character that cannot go in an HTTP header — a pasted placeholder?");
  model = model || prov.defaultModel;
  var out = [], i;
  for (i = 0; i < rows.length; i++) {
    var body = prov.buildBody([{ role: "user", content: rewritePrompt(rows[i]) }], REWRITE_SYS, Math.round(300 * (prov.tokScale || 1)), model);
    var url = typeof prov.endpoint === "function" ? prov.endpoint(model) : prov.endpoint;
    var res = await fetch(url, { method: "POST", headers: prov.headers(key), body: JSON.stringify(body) });
    var txt = await res.text(), got = "";
    try { got = String(prov.parseResponse(JSON.parse(txt)) || ""); } catch (e) { console.warn("register-scrub: " + rows[i].path + ": HTTP " + res.status + " — " + (e && e.message)); }
    var clean = String(chapterRewriteText(got) || "");
    out.push({ path: rows[i].path, text: clean, still: clean ? wordListScan(clean, LABEL_RE) : ["(no rewrite)"] });
  }
  return out;
}

function main() {
  var args = process.argv.slice(2), file = null, from = null, outFile = null, doApply = false, providerId = process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY ? "gemini" : "anthropic", model = null, i;
  for (i = 0; i < args.length; i++) {
    if (args[i] === "--apply") doApply = true;
    else if (args[i] === "--from") from = args[++i];
    else if (args[i] === "--out") outFile = args[++i];
    else if (args[i] === "--provider") providerId = args[++i];
    else if (args[i] === "--model") model = args[++i];
    else if (!file) file = args[i];
    else { console.error("unexpected argument " + args[i]); process.exit(2); }
  }
  if (!file) { console.error("usage: node dev/register-scrub.js <save.tnd|sheet.char> [--from rewrites.json] [--provider anthropic|gemini] [--model m] [--out rewrites.json] [--apply]"); process.exit(2); }
  var original = fs.readFileSync(file, "utf8"), data = JSON.parse(original);
  var rows = list(data);
  console.log("# " + path.basename(file) + " — " + rows.length + " record line" + (rows.length === 1 ? "" : "s") + " in the register");
  rows.forEach(function (r) { console.log("- " + r.path + "  [" + r.words.join(", ") + "]\n    " + r.text); });
  if (!rows.length) return Promise.resolve(0);
  var haveKey = !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  var rewritesP = from ? Promise.resolve(JSON.parse(fs.readFileSync(from, "utf8"))) : (haveKey ? modelRewrite(rows, providerId, model) : Promise.resolve(null));
  return rewritesP.then(function (rewrites) {
    if (!rewrites) { console.log("\n(no rewrites: pass --from rewrites.json, or set ANTHROPIC_API_KEY / GEMINI_API_KEY in this shell to rewrite through the model)"); return 0; }
    var byPath = {}; rows.forEach(function (r) { byPath[r.path] = r; });
    var good = [];
    console.log("\n# rewrites");
    rewrites.forEach(function (rw) {
      var r = byPath[rw.path]; if (!r) { console.log("- " + rw.path + ": not a listed record line — skipped"); return; }
      var still = rw.still || (rw.text ? wordListScan(rw.text, LABEL_RE) : ["(no rewrite)"]);
      console.log("- " + rw.path + "\n    before: " + r.text + "\n    after:  " + (rw.text || "(none)") + (still.length ? "\n    STILL IN THE REGISTER [" + still.join(", ") + "] — not applied" : ""));
      if (!still.length && rw.text) good.push({ path: rw.path, text: rw.text });
    });
    if (outFile) { fs.writeFileSync(outFile, JSON.stringify(good, null, 2)); console.log("\nsaved " + good.length + " rewrite(s) to " + outFile); }
    if (!doApply) { console.log("\n" + good.length + " rewrite(s) ready — nothing written (pass --apply to write; a .bak keeps the original)"); return 0; }
    fs.writeFileSync(file + ".bak", original);
    var n = apply(data, good);
    var pretty = /^\s*\{\s*\n\s+"/.test(original) ? 2 : 0;
    fs.writeFileSync(file, JSON.stringify(data, null, pretty));
    console.log("\napplied " + n + " rewrite(s) to " + file + " (original kept at " + file + ".bak)");
    return 0;
  });
}

module.exports = { list: list, apply: apply, rewritePrompt: rewritePrompt, resolve: resolve };
if (require.main === module) { main().then(function (c) { process.exitCode = c; }, function (e) { console.error("register-scrub: " + (e && e.message || e)); process.exitCode = 1; }); }
