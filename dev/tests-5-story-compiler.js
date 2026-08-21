// tests-5-story-compiler.js — TODO #5, the STORY COMPILER satellite (story_compiler.html).
//
// Standalone battery — run directly:  node dev/tests-5-story-compiler.js
// (registered in dev/run-standalone-suites.js, so the CI gate runs it too).
//
// WHAT IT DRIVES, AND WHY THIS WAY
// The satellite is a page, not an engine file, so the suite loads THE PAGE'S OWN inline
// script into a node vm with a minimal DOM/localStorage/Blob stub and drives
// window.__storyTest — the same seam the buttons drive. Nothing is re-implemented here:
// a copied compile routine would go green while the shipped page rotted (the #17 rot class).
// compress.js is evaluated into the same context because the LIVE localStorage path hands
// the page a {__lz} transcript, and inflating that is a real failure condition, not a benign one.
//
// The clauses below are written against FAILURE conditions, per the house rule:
//   · the machine-readable block contract (.act/.gm/.chapter + data-turn) — TODO #5 decision ③,
//     the thing every downstream pass (fold player actions, 2nd→3rd person) parses
//   · malformed transcript entries / malformed chapter records / a save with no chapters
//   · an LZ-compressed transcript, and a CORRUPT one (must refuse loudly, never compile empty)
//   · untrusted prose (model + player text) must be escaped, never injected raw
//   · READ-ONLY by construction: zero localStorage writes across load → compile → export

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var root = path.join(__dirname, "..");

// ── Reporter (mirrors run-tests.js) ──────────────────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
function t(name, fn) {
  var label = curSection + " › " + name;
  try {
    var r = fn();
    if (r === true || r === undefined) pass++;
    else fails.push(label + " — " + r);
  } catch (e) { fails.push(label + " — threw: " + e.message); }
}
function count(hay, needle) {
  var n = 0, i = 0;
  while (true) { var k = String(hay).indexOf(needle, i); if (k < 0) break; n++; i = k + needle.length; }
  return n;
}

// ── the page under test ──────────────────────────────────────────────────────
var PAGE = path.join(root, "story_compiler.html");
var pageSrc = fs.readFileSync(PAGE, "utf8");
// Inline <script> blocks only (the <script src="compress.js"> tag is loaded separately below).
function inlineScripts(html) {
  var out = [], re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function makeCtx(storage) {
  var els = {};
  var writes = [];       // every localStorage WRITE attempt — must stay empty
  var reads = [];
  var warns = [];
  var blobs = [];        // every Blob handed to the download path
  var downloads = [];
  var previewWritten = "";
  function mkEl(id) {
    var e = {
      id: id, textContent: "", innerHTML: "", className: "", disabled: false,
      value: (id === "opt-preview" ? "3" : ""), checked: true, style: {}, files: null,
      _h: {},
      addEventListener: function (type, fn) { this._h[type] = fn; },
      appendChild: function () { }, removeChild: function () { }, setAttribute: function () { },
      click: function () { downloads.push({ href: this.href, download: this.download }); }
    };
    if (id === "preview") {
      e.contentDocument = {
        open: function () { previewWritten = ""; },
        write: function (s) { previewWritten += s; },
        close: function () { }
      };
    }
    return e;
  }
  var doc = {
    getElementById: function (id) { if (!els[id]) els[id] = mkEl(id); return els[id]; },
    createElement: function () { return mkEl("_created"); },
    body: { appendChild: function () { }, removeChild: function () { } }
  };
  var sandbox = {
    console: {
      warn: function (m) { warns.push(String(m)); },
      log: function () { }, error: function () { }
    },
    document: doc,
    localStorage: {
      getItem: function (k) { reads.push(k); return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      setItem: function (k, v) { writes.push(["set", k]); },
      removeItem: function (k) { writes.push(["remove", k]); },
      clear: function () { writes.push(["clear"]); }
    },
    setTimeout: function (fn) { return 0; },   // the UI's chunked driver is not under test here
    clearTimeout: function () { },
    FileReader: function () { this.readAsText = function () { }; },
    Blob: function (parts) { blobs.push(String(parts && parts[0] || "")); this.size = String(parts && parts[0] || "").length; },
    URL: { createObjectURL: function () { return "blob:stub"; }, revokeObjectURL: function () { } }
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox;
  // compress.js first — the page's <script src> order.
  vm.runInContext(fs.readFileSync(path.join(root, "compress.js"), "utf8"), sandbox, { filename: "compress.js" });
  var blocks = inlineScripts(pageSrc);
  if (!blocks.length) throw new Error("story_compiler.html has no inline script block");
  for (var i = 0; i < blocks.length; i++) vm.runInContext(blocks[i], sandbox, { filename: "story_compiler.html#" + i });
  return {
    sb: sandbox, seam: sandbox.__storyTest, els: els, writes: writes, reads: reads,
    warns: warns, blobs: blobs, downloads: downloads,
    preview: function () { return previewWritten; },
    src: function () { return (els.src && els.src.textContent) || ""; }
  };
}

// ── the fixture ──────────────────────────────────────────────────────────────
// Small on purpose, but shaped like the real thing: two filed chapters, an unsummarized
// tail, a retconned passage, untrusted characters in player prose, a beat and a decision.
function fixture() {
  return {
    worldState: {
      campName: "The Ashfen Compact",
      turn: 8,
      character: {
        name: "Vyrindra", cls: "Rogue", level: 4, ancestry: "Elf", subraceNm: "Wood",
        portrait: "data:image/jpeg;base64,AAAA",
        storyBeats: [{ text: "Swore the compact aloud", turn: 2 }]
      },
      transcript: [
        { t: 1, r: "player", x: "I open the door." },
        { t: 1, r: "gm", x: "The door gives.\n\nDust falls through the lamplight." },
        { t: 2, r: "player", x: "I ask <Morwen> about the & pact." },
        { t: 2, r: "gm", x: "She answers, carefully." },
        { t: 6, r: "player", x: "I follow her north." },
        { t: 6, r: "gm", x: "Night closes over the road." },
        { t: 7, r: "gm", x: "A passage a later turn took back.", rc: 1 },
        { t: 8, r: "player", x: "I sleep." }
      ]
    },
    memory: {
      chapters: [
        { turn: 2, summary: "The door gave at last. Dust everywhere, and a name spoken that should not have been." },
        { turn: 6, summary: "A night walk north with Morwen." }
      ],
      keyDecisions: [{ turn: 6, desc: "Trusted Morwen with the compact" }]
    }
  };
}

// ═════════════════════════════════════════════════════════════════════════════
section("#5 seam + model");
var C = makeCtx({});
t("the page exposes the __storyTest seam", function () {
  if (!C.seam) return "window.__storyTest missing";
  var need = ["load", "compile", "model", "doc", "buildModel", "chapterTitle"];
  for (var i = 0; i < need.length; i++) if (typeof C.seam[need[i]] !== "function") return "seam." + need[i] + " missing";
  return true;
});
t("load() accepts a .tnd-shaped payload", function () { return eq(C.seam.load(fixture(), "fixture"), true, "load"); });

var R = null;
t("compile() returns model + chapter html + document", function () {
  R = C.seam.compile();
  if (!R || !R.model || !R.chapterHtml || !R.doc) return "compile returned " + JSON.stringify(R && Object.keys(R));
  return true;
});
t("chapters segment on the memory tier's own boundaries (2 filed + 1 tail)", function () {
  return eq(R.model.chapters.length, 3, "chapters");
});
t("chapter 1 covers turns 1–2, chapter 2 turn 6, tail turn 8", function () {
  var c = R.model.chapters;
  return eq(c[0].turnStart + "-" + c[0].turnEnd + "/" + c[1].turnStart + "-" + c[1].turnEnd + "/" + c[2].turnStart + "-" + c[2].turnEnd,
    "1-2/6-6/8-8", "windows");
});
t("heading text is the summary's FIRST sentence, epigraph keeps the whole summary", function () {
  if (R.model.chapters[0].title !== "The door gave at last") return "title was " + JSON.stringify(R.model.chapters[0].title);
  if (R.doc.indexOf("Dust everywhere, and a name spoken") < 0) return "full summary missing from the epigraph";
  return true;
});
t("the unsummarized tail is a real chapter, titled without inventing a summary", function () {
  var tail = R.model.chapters[2];
  if (!tail.tail) return "tail flag missing";
  if (tail.summary) return "tail invented a summary";
  return eq(R.doc.indexOf("The story so far") > 0, true, "tail heading");
});
t("stats count what was used AND what was left out", function () {
  var s = R.model.stats;
  return eq([s.entries, s.used, s.players, s.gms, s.skipTotal, s.skipped.retconned].join(","), "8,7,4,3,1,1", "stats");
});

// ── decision ③: the machine-readable block contract ─────────────────────────
section("#5 block structure (decision ③ — downstream passes parse this)");
t(".act blocks = every player action, .gm blocks = every GM passage", function () {
  return eq(count(R.doc, "class=\"act\"") + "/" + count(R.doc, "class=\"gm\""), "4/3", "act/gm");
});
t("each chapter is a <section class=\"chapter\"> with data-chapter + turn range", function () {
  if (count(R.doc, "<section class=\"chapter\"") !== 3) return "sections=" + count(R.doc, "<section class=\"chapter\"");
  if (R.doc.indexOf("data-chapter=\"1\"") < 0 || R.doc.indexOf("data-chapter=\"3\"") < 0) return "data-chapter missing";
  if (R.doc.indexOf("data-turn-start=\"1\" data-turn-end=\"2\"") < 0) return "chapter turn range attrs missing";
  return true;
});
t("every act/gm block carries its own data-turn", function () {
  var re = /<div class="(act|gm)"(?: data-turn="\d+")?>/g, m, bad = 0;
  while ((m = re.exec(R.doc))) if (m[0].indexOf("data-turn=") < 0) bad++;
  return eq(bad, 0, "blocks without data-turn");
});
t("the document self-identifies as a compiled chronicle", function () {
  if (R.doc.indexOf("data-tnd-story=\"1\"") < 0) return "data-tnd-story marker missing";
  if (R.doc.indexOf("<meta name=\"generator\" content=\"story-compiler") < 0) return "generator meta missing";
  return true;
});
t("prose is never flattened — GM paragraphs stay separate <p> inside .gm", function () {
  return eq(R.doc.indexOf("<div class=\"gm\" data-turn=\"1\"><p>The door gives.</p><p>Dust falls through the lamplight.</p></div>") > 0, true, "paragraph split");
});

// ── verbatim + escaping ─────────────────────────────────────────────────────
section("#5 verbatim prose + untrusted text");
t("the told prose is carried VERBATIM (decision ①), not summarized", function () {
  return eq(R.doc.indexOf("Night closes over the road.") > 0 && R.doc.indexOf("I follow her north.") > 0, true, "verbatim prose");
});
t("player/model text is escaped — never injected as markup", function () {
  if (R.doc.indexOf("<Morwen>") >= 0) return "raw < > leaked into the document";
  if (R.doc.indexOf("&lt;Morwen&gt;") < 0) return "escaped form missing";
  if (R.doc.indexOf("the &amp; pact") < 0) return "ampersand not escaped";
  return true;
});
t("a script-shaped passage cannot execute in the exported book", function () {
  var c2 = makeCtx({}), fx = fixture();
  fx.worldState.transcript.push({ t: 8, r: "gm", x: "<script>alert(1)<\/script> he said" });
  c2.seam.load(fx, "xss");
  var doc = c2.seam.compile().doc;
  if (doc.indexOf("<script>alert(1)") >= 0) return "unescaped <script> reached the document";
  return eq(doc.indexOf("&lt;script&gt;alert(1)") > 0, true, "escaped script text");
});

// ── skeleton decoration ─────────────────────────────────────────────────────
section("#5 skeleton decoration (beats + decisions)");
t("a beat and a decision land in the chapter whose turn window contains them", function () {
  if (R.doc.indexOf("class=\"mark beat\" data-turn=\"2\"") < 0) return "beat not filed";
  if (R.doc.indexOf("class=\"mark decision\" data-turn=\"6\"") < 0) return "decision not filed";
  return true;
});
t("options actually change the document (epigraph + beats + turn markers off)", function () {
  var lean = C.seam.compile({ epigraph: false, beats: false, portrait: false, turns: false, previewChapters: 3 }).doc;
  if (lean.indexOf("class=\"epigraph\"") >= 0) return "epigraph survived its option";
  if (lean.indexOf("class=\"mark ") >= 0) return "marks survived their option";
  if (lean.indexOf("class=\"turn\"") >= 0) return "turn markers survived their option";
  if (lean.indexOf("data:image/jpeg") >= 0) return "portrait survived its option";
  if (count(lean, "class=\"act\"") !== 4) return "prose blocks were lost with the decorations";
  return true;
});

// ── the title page ──────────────────────────────────────────────────────────
section("#5 title page");
t("cover carries campaign, character, class/level and the turn range", function () {
  var again = C.seam.compile();   // restore full options
  var d = again.doc;
  if (d.indexOf("The Ashfen Compact") < 0) return "campaign name missing";
  if (d.indexOf("Vyrindra") < 0) return "character name missing";
  if (d.indexOf("Wood Elf Rogue, Level 4") < 0) return "class line missing";
  if (d.indexOf("Turns 1&ndash;8") < 0) return "turn range missing";
  if (d.indexOf("<img alt=\"Vyrindra\" src=\"data:image/jpeg;base64,AAAA\">") < 0) return "portrait not embedded";
  R = again;
  return true;
});
t("the colophon reports the passages left out rather than hiding them", function () {
  return eq(/1 passage left out \(1 retconned\)/.test(R.doc), true, "colophon honesty");
});

// ── self-contained + print ──────────────────────────────────────────────────
section("#5 self-contained export + print stylesheet");
t("no external references — the file stands alone", function () {
  if (/<link\b/i.test(R.doc)) return "a <link> reached the document";
  if (/(src|href)="https?:/i.test(R.doc)) return "an absolute http(s) reference reached the document";
  if (/<script/i.test(R.doc.replace(/&lt;script/gi, ""))) return "a live <script> reached the document";
  return true;
});
t("a print stylesheet ships inside it (the v1 PDF story)", function () {
  if (R.doc.indexOf("@media print") < 0) return "no print block";
  if (R.doc.indexOf("page-break-before:always") < 0) return "chapters do not start a page";
  if (R.doc.indexOf("@page{margin") < 0) return "no page margins";
  return true;
});
t("light and dark readers both get a defined palette", function () {
  return eq(R.doc.indexOf("@media (prefers-color-scheme:dark)") > 0, true, "dark palette");
});

// ── the download path (the button, headlessly) ──────────────────────────────
section("#5 export button");
t("the ⬇ Export click produces a named .html download of the compiled doc", function () {
  var ex = C.els["export"];
  if (!ex || !ex._h.click) return "export button was never wired";
  ex._h.click();
  if (!C.blobs.length) return "no Blob was built";
  if (C.blobs[C.blobs.length - 1].indexOf("<section class=\"chapter\"") < 0) return "the blob is not the compiled book";
  var dl = C.downloads[C.downloads.length - 1];
  if (!dl) return "no download was triggered";
  return eq(dl.download, "The_Ashfen_Compact__Vyrindra_t8_story.html", "filename");
});

// ── READ-ONLY by construction ───────────────────────────────────────────────
section("#5 read-only discipline");
t("zero localStorage writes across boot → load → compile → export", function () {
  return eq(JSON.stringify(C.writes), "[]", "localStorage writes");
});
t("the live path READS the same keys state.js writes", function () {
  var live = makeCtx({
    "tnd_core_v10": JSON.stringify(fixture().worldState),
    "tnd_mem_v10": JSON.stringify(fixture().memory)
  });
  if (live.reads.indexOf("tnd_core_v10") < 0) return "never read tnd_core_v10 at boot";
  if (!live.seam.compile()) return "the live campaign did not compile at boot";
  if (live.writes.length) return "live path wrote localStorage: " + JSON.stringify(live.writes);
  return eq(count(live.seam.doc(), "class=\"act\""), 4, "live compile block count");
});

// ── FAILURE CONDITIONS ──────────────────────────────────────────────────────
section("#5 compressed transcript (the real live-storage shape)");
t("an {__lz} transcript inflates and compiles identically", function () {
  var fx = fixture();
  var lzSrc = fs.readFileSync(path.join(root, "compress.js"), "utf8");
  var box = {}; vm.createContext(box); vm.runInContext(lzSrc, box, { filename: "compress.js" });
  var packed = box.LZ.compressToUTF16(JSON.stringify(fx.worldState.transcript));
  fx.worldState.transcript = { __lz: packed };
  var c = makeCtx({});
  if (c.seam.load(fx, "lz") !== true) return "compressed save refused: " + c.src();
  var d = c.seam.compile().doc;
  if (count(d, "class=\"act\"") !== 4 || count(d, "class=\"gm\"") !== 3) return "inflated compile lost blocks";
  return eq(/inflated from the compressed store/.test(c.src()), true, "inflate is reported");
});
t("a CORRUPT {__lz} transcript refuses loudly — never an empty book", function () {
  var fx = fixture();
  fx.worldState.transcript = { __lz: " not really compressed" };
  var c = makeCtx({});
  var ok = c.seam.load(fx, "corrupt");
  if (ok !== false) return "corrupt payload was accepted";
  if (!/decompress|not an array|unknown shape/i.test(c.src())) return "refusal was not explained: " + c.src();
  return eq(c.seam.doc(), null, "nothing compiled");
});
t("a transcript of an unknown shape is named, not guessed at", function () {
  var fx = fixture(); fx.worldState.transcript = "a string";
  var c = makeCtx({});
  if (c.seam.load(fx, "weird") !== false) return "string transcript accepted";
  return eq(/unknown shape/.test(c.src()), true, "shape named");
});

section("#5 malformed input degrades, never throws");
t("null / non-object / role-less / blank entries are skipped and counted", function () {
  var fx = fixture();
  fx.worldState.transcript = [
    null, "a string", { t: 1, r: "gm" }, { t: 1, r: "gm", x: "   " },
    { t: 1, r: "alien", x: "not a role" },
    { t: 1, r: "player", x: "I stand." }, { t: 1, r: "gm", x: "You stand." }
  ];
  var c = makeCtx({});
  if (c.seam.load(fx, "malformed") !== true) return "a mostly-malformed transcript was refused";
  var r = c.seam.compile(), s = r.model.stats;
  if (s.used !== 2) return "used=" + s.used;
  if (s.skipped.malformed !== 4 || s.skipped.empty !== 1) return "skip tally " + JSON.stringify(s.skipped);
  if (count(r.doc, "class=\"act\"") !== 1 || count(r.doc, "class=\"gm\"") !== 1) return "surviving prose was lost";
  return eq(c.warns.length > 0, true, "malformed entries warned about");
});
t("malformed chapter records are skipped; a stringy turn still files", function () {
  var fx = fixture();
  fx.memory.chapters = [null, { summary: "no turn at all" }, { turn: "2", summary: "Stringy turn." }, { turn: 6, summary: "" }];
  var c = makeCtx({});
  c.seam.load(fx, "bad-chapters");
  var r = c.seam.compile();
  if (r.model.stats.chapterRecords !== 2) return "chapterRecords=" + r.model.stats.chapterRecords;
  if (r.model.chapters[0].turnEnd !== 2) return "stringy-turn chapter did not bound turns 1–2";
  return eq(r.model.chapters.length, 3, "chapters");
});
t("a save with NO chapters still compiles — one chapter, all the prose", function () {
  var fx = fixture(); fx.memory = {};
  var c = makeCtx({});
  c.seam.load(fx, "no-chapters");
  var r = c.seam.compile();
  if (r.model.chapters.length !== 1) return "chapters=" + r.model.chapters.length;
  return eq(count(r.doc, "class=\"act\"") + "/" + count(r.doc, "class=\"gm\""), "4/3", "blocks");
});
t("out-of-order chapter records are ordered by turn, not by filing accident", function () {
  var fx = fixture();
  fx.memory.chapters = [{ turn: 6, summary: "Later." }, { turn: 2, summary: "Earlier." }];
  var c = makeCtx({});
  c.seam.load(fx, "unordered");
  var r = c.seam.compile();
  return eq(r.model.chapters[0].title + "/" + r.model.chapters[1].title, "Earlier/Later", "chapter order");
});
t("an entry with no turn inherits the last one instead of falling out of the book", function () {
  var fx = fixture();
  fx.worldState.transcript = [{ t: 3, r: "player", x: "I wait." }, { r: "gm", x: "Nothing comes." }];
  fx.memory.chapters = [];
  var c = makeCtx({});
  c.seam.load(fx, "no-turn");
  var r = c.seam.compile();
  return eq(r.model.stats.used + "/" + count(r.doc, "data-turn=\"3\""), "2/2", "inherited turn");
});
t("an empty transcript is refused with an explanation, not compiled into a hollow book", function () {
  var fx = fixture(); fx.worldState.transcript = [];
  var c = makeCtx({});
  if (c.seam.load(fx, "empty") !== false) return "empty transcript accepted";
  return eq(/no recorded story/.test(c.src()), true, "explained: " + c.src());
});
t("a payload with no worldState at all is refused", function () {
  var c = makeCtx({});
  if (c.seam.load({ memory: { chapters: [] } }, "headless") !== false) return "accepted a worldState-less payload";
  return eq(/no worldState/.test(c.src()), true, "explained");
});

section("#5 chapter titles");
t("a long summary is trimmed at a word boundary, punctuation dropped", function () {
  var s = C.seam.chapterTitle("A very long opening sentence that runs on well past any reasonable title length for a chapter heading. Second sentence.");
  if (s.length > 66) return "title too long: " + s.length;
  if (s.indexOf("Second sentence") >= 0) return "spilled into the second sentence";
  return eq(/…$/.test(s), true, "ellipsis: " + s);
});
t("an empty summary yields no invented title", function () { return eq(C.seam.chapterTitle(""), "", "empty title"); });

// ── report ───────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log("\n" + fails.length + " FAILED:");
  for (var i = 0; i < fails.length; i++) console.log("  ✗ " + fails[i]);
  console.log("\n" + pass + " passed, " + fails.length + " failed");
  process.exit(1);
}
console.log("story compiler (#5): " + pass + " passed, 0 failed");
