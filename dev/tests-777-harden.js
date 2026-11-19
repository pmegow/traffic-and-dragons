// dev/tests-777-harden.js — audit 2026-11-19 (TODO #777), section H and U4: what a file, a save or the model wrote is
// painted as TEXT. H1 system lines · H2 the .char preview · H4 the character editor · H5 the read-only sheet · H6 a
// model-written sheet · H7 names inside inline handlers · H8 the agenda · H9 the bond label · H10 the usage modal ·
// H11 the map viewer · H12 numeric sheet fields (healed at every admission door) · H13 four pure renderers · U4 the
// read-only preview acts on nobody.
// The pure renderers run for real; a DOM shell is run where a stub page can hold it, and pinned by its source where not.
//   node dev/tests-777-harden.js             every case
//   node dev/tests-777-harden.js --only H7   the cases whose name contains the text
// ES5 throughout, matching the engine.
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () {}; console.log = function () {}; console.debug = function () {};
LE.loadEngine();
var ROOT = path.join(__dirname, ".."), shown = [];
function el() { return { style: {}, className: "", innerHTML: "", textContent: "", value: "", children: [], firstChild: null, appendChild: function (c) { this.children.push(c); return c; }, remove: function () {}, addEventListener: function () {}, setAttribute: function () {}, getAttribute: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, focus: function () {}, scrollIntoView: function () {} }; }
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.document = { getElementById: function () { return el(); }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return el(); }, body: el(), addEventListener: function () {} };
global.window = global;
["ui-sheets.js", "ui-browsers.js", "ui-panels.js"].forEach(function (f) { (0, eval)(fs.readFileSync(path.join(ROOT, f), "utf8")); });
showToast = function (m) { said.toasts.push(String(m)); };
charImportDirect = function () { return false; };   // a running game: the preview is drawn
modalShell = function (id, body) { shown.push(String(body)); var m = el(); m.firstChild = el(); return m; };
saveAll = function () {}; saveCore = function () { return true; }; saveMem = function () { return true; }; syncUI = function () {};
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function fresh(o) { var ws = LE.makeTestWorld(o || {}); migrateWorldState(ws); worldState = ws; said.warns.length = 0; said.toasts.length = 0; shown.length = 0; return ws; }
var X = "<img src=x onerror=alert(1)>", RAW = /<img src=x/;
function clean(html, what) { assert.ok(!RAW.test(String(html)), what + " — markup from the data reached the page: " + String(html).slice(Math.max(0, String(html).indexOf("<img src=x") - 80), String(html).indexOf("<img src=x") + 60)); }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }

kase("H1: a system line is text — a hero's name or a place from a save cannot run as markup; the one HTML caller says so", function () {
  assert.strictEqual(systemMsgHtml("Welcome back, " + X + "."), "Welcome back, &lt;img src=x onerror=alert(1)&gt;.");
  assert.strictEqual(systemMsgHtml("<a class='n'>Bram</a>", { html: true }), "<a class='n'>Bram</a>");
  assert.strictEqual(systemMsgHtml(null), "");
  var shell = src("ui-shell.js"), at = shell.indexOf("function addMsg(");
  assert.ok(/if\(type==="system"\)html=systemMsgHtml\(html,opts\);/.test(shell.slice(at, at + 3000)), "addMsg paints a system line as it was handed");
  assert.ok(/addMsg\("system",\(typeof summaryLineHTML==="function"\)\?summaryLineHTML\(lines\):escHtml\(lines\.join\(" \| "\)\),\{html:true\}\)/.test(src("tag_table.js")), "the turn's summary line (links to sheets) is not marked as HTML — its links would print as text");
  assert.ok(!/addMsg\("system","Loaded: "\+escHtml\(/.test(src("ui-files.js")), "a caller still escapes before addMsg does — the name would be escaped twice");
});

kase("H12: a sheet's numeric fields are numbers after any admission door — a string in one cannot reach a page", function () {
  fresh();
  var s = JSON.parse(JSON.stringify(worldState.character));
  s.level = X; s.hp = "9" + X; s.maxHp = X; s.xp = X; s.coin = X; s.stats.STR = X; s.stats.DEX = "14"; s.alignLaw = X; s.alignGood = "2";
  s.spells = [{ nm: "Bolt", lvl: X }, { nm: "Ward", lvl: "2" }]; s.skills.Stealth = X;
  s.agenda = { want: "w", kind: "personal", since: X, born: X }; s.agendaHistory = [{ want: "old", kind: "personal", done: X }];
  var n = sheetNumbersHeal(s);
  assert.ok(n >= 10, "few fields were healed: " + n);
  clean(JSON.stringify(s), "the healed sheet");
  assert.strictEqual(s.stats.DEX, 14, "a numeric string was not read as its number"); assert.strictEqual(s.alignGood, 2); assert.strictEqual(s.spells[1].lvl, 2);
  assert.ok(s.level >= 1 && s.maxHp >= 1 && s.hp >= 0 && s.hp <= s.maxHp && s.xp === 0 && s.coin === 0 && s.stats.STR === 10 && s.spells[0].lvl === 1 && s.skills.Stealth === 0, JSON.stringify([s.level, s.hp, s.maxHp, s.xp, s.coin, s.stats.STR, s.spells[0].lvl, s.skills.Stealth]));
  assert.strictEqual(sheetNumbersHeal(JSON.parse(JSON.stringify(LE.makeTestWorld({}).character))), 0, "a clean sheet was changed");
  fresh(); var imp = JSON.parse(JSON.stringify(worldState.character)); imp.name = "Imported Ilse"; imp.level = X; imp.stats.CON = X;
  var a = sheetAdmit(imp, { door: "test import", mode: "cross", stage: "preview" });
  assert.ok(a.ok, a.reason); assert.strictEqual(typeof a.sheet.level, "number"); assert.strictEqual(a.sheet.stats.CON, 10);
  var ws = LE.makeTestWorld({}); ws.character.stats.CON = X; ws.character.spells = [{ nm: "Bolt", lvl: X }]; ws.character.inventoryJunk = "not a list";   // packs refused: the heal still runs
  migrateWorldState(ws);
  assert.ok(ws.character.stats.CON === 10 && ws.character.spells[0].lvl === 1, "the load left a string in a numeric field when the packs were refused: " + JSON.stringify([ws.character.stats.CON, ws.character.spells[0].lvl]).slice(0, 80));
});

kase("H2: the .char preview and the wizard's review card paint a file's fields as text", function () {
  fresh(); var c = JSON.parse(JSON.stringify(worldState.character));
  c.subraceNm = X; c.archetypeNm = X; c.level = X; c.hp = X; c.maxHp = X; c.stats.STR = X;
  shown.length = 0; showCharImportPreview(c, function () {}, function () {});
  assert.ok(shown.length >= 1, "fixture: the preview drew nothing");
  clean(shown.join("\n"), "the import preview");
  var br = src("ui-browsers.js");
  assert.ok(/<div class='cbr-sub'>Lv"\+escHtml\(String\(entry\.level\)\)/.test(br) && /margin-bottom:18px;'>Lv"\+escHtml\(String\(char\.level\|\|1\)\)/.test(br), "a level from a file or the library list is painted raw");
  assert.ok(/font-weight:bold;'>"\+escHtml\(String\(stats\[s\]\|\|"—"\)\)\+"<\/div><\/div>"/.test(br) && /HP "\+escHtml\(String\(char\.hp\)\)\+"\/"\+escHtml\(String\(char\.maxHp\)\)/.test(br), "the preview paints a stat or the HP raw (the admission before it is its only guard)");
  var wiz = src("char-creation.js");
  assert.ok(/'<div class="rv-sub">'\+escHtml\(\(ch\.subraceNm\|\|ch\.subrace\|\|ch\.ancestry\|\|""\)\+" "\+\(ch\.cls\|\|""\)\)/.test(wiz), "the review card paints the file's subrace and class raw");
  assert.ok(!/<div class="rv2">'\+\(fs2\[s\]\|\|"—"\)\+/.test(wiz) && !/<span class="rv">'\+\(ch\.level\|\|1\)\+/.test(wiz) && !/<span class="rv">'\+\(ch\.xp\|\|0\)\+/.test(wiz) && !/<span class="rv">'\+\(ch\.maxHp\|\|ch\.hp\|\|0\)\+/.test(wiz), "the review card paints a file's numbers raw");
});

kase("H5: the read-only preview of another campaign's character paints age, deity, alignment and stats as text", function () {
  fresh(); var c = JSON.parse(JSON.stringify(worldState.character));
  c.age = X; c.deity = X; c.actualAlignment = X; c.statedAlignment = X; c.stats.WIS = X;
  shown.length = 0; showReadOnlyCharSheet(c, {});
  assert.ok(shown.length >= 1, "fixture: the sheet drew nothing");
  clean(shown.join("\n"), "the read-only sheet");
  clean(csSheetSections(c, undefined, true), "the sheet sections");
});

kase("H6: a model-written sheet's alignment and spell level are text on every sheet and panel", function () {
  fresh(); var c = worldState.character;
  c.actualAlignment = X; c.spells = [{ nm: "Bolt", lvl: X, used: false }];
  clean(csSheetSections(c, ""), "the hero's sheet sections");
  var sh = src("ui-sheets.js"), pn = src("ui-panels.js");
  assert.ok(!/<span style='color:var\(--t2\)'>"\+\((?:c|sheet)\.actualAlignment\|\|(?:c|sheet)\.statedAlignment\|\|"Neutral"\)\+"<\/span>/.test(sh), "an alignment is painted raw on a sheet");
  assert.strictEqual((sh.match(/escHtml\((?:c|sheet)\.actualAlignment\|\|(?:c|sheet)\.statedAlignment\|\|"Neutral"\)/g) || []).length, 3, "not every sheet escapes its alignment (hero, companion, read-only)");
  assert.ok(/tag=sp\.lvl===0\?"C":escHtml\(String\(sp\.lvl\)\);/.test(pn), "the spell panel paints a spell level raw");
});

kase("H7: a name inside an inline handler is a JavaScript string, whatever it holds", function () {
  var hostile = ['");alert(1);//', "O'Brien", "a\\b", "</button><img src=x>", "line\nbreak", " sep"], got;
  hostile.forEach(function (h) {
    var attr = "f(" + jsArg(h) + ")";
    assert.ok(attr.indexOf("'") < 0 && attr.indexOf('"') < 0 && attr.indexOf("<") < 0, "a quote or bracket survives in the attribute: " + attr);
    var decoded = attr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");   // what the HTML parser hands the compiler
    got = undefined; new Function("f", decoded)(function (v) { got = v; });
    assert.strictEqual(got, h, "the handler received another value");
  });
  var br = src("ui-browsers.js"), cp = src("ui-campaigns.js");
  assert.ok(/_cbDelLib\("\+jsArg\(entry\.slug\)\+","\+jsArg\(entry\.name\)\+"\)/.test(br), "the library's delete handler builds its arguments by hand");
  assert.ok(!/onclick='camp[A-Za-z]+\(\\""\+/.test(cp), "a campaign handler builds its id argument by hand: " + (cp.match(/onclick='camp[A-Za-z]+\(\\""\+[^)]{0,40}/) || [""])[0]);
  assert.strictEqual((cp.match(/jsArg\(cm\.id\)/g) || []).length, 6, "not every campaign handler passes the id through jsArg");
  assert.ok(/id='camp-name-"\+escHtml\(cm\.id\)\+"'/.test(cp) && /id='camp-push-"\+escHtml\(cm\.id\)\+"'/.test(cp), "a campaign id goes into an id attribute raw");
});

kase("H8: a sheet's agenda paints its turn numbers as text", function () {
  clean(agendaSheetHtml({ agenda: { want: "w", kind: "personal", since: X }, agendaQueue: [], agendaHistory: [{ want: "old", kind: "personal", done: X }] }), "the agenda");
});

kase("H9, H10, H11, H4: four shells paint a name, a usage kind, a visit count and a character file as text", function () {
  var sh = src("ui-sheets.js"), um = src("ui-modals.js"), mv = src("map_viewer.html"), ce = src("character_editor.html");
  assert.ok(/csKv\("Bond from "\+escHtml\(worldState\.character\.name\)/.test(sh) && /csKv\("Current dynamic from "\+escHtml\(worldState\.character\.name\)/.test(sh), "H9: the hero's name is raw in the bond label");
  var at = um.indexOf("function showUsageModal");
  assert.ok(/text-align:left;font-family:var\(--font\);'>"\+escHtml\(label\)\+"<\/td>"/.test(um.slice(at, at + 2500)), "H10: a usage kind from the save is painted raw");
  assert.ok(!/\+n\.visits\+" visit"/.test(mv) && !/'\+\(n\.visits\|\|0\)\+' visit'/.test(mv) && !/×'\+kn\.visits\+'/.test(mv), "H11: the map viewer paints a save's visit count raw");
  assert.ok(/esc\(n\.visits\)\+" visit"/.test(mv) && /esc\(n\.visits\|\|0\)\+' visit'/.test(mv) && /×'\+esc\(kn\.visits\)\+'/.test(mv), "H11: the three visit counts are not escaped");
  var esc = (ce.match(/function esc\(s\)\{[^}]*\}/) || [""])[0];
  assert.ok(/&#39;/.test(esc) && /&quot;/.test(esc), "H4: the editor's escape leaves an apostrophe — it ends a single-quoted attribute: " + esc);
  var f = new Function("return " + esc.replace("function esc", "function"))();
  assert.strictEqual(f("O'Brien <b> \"x\" &"), "O&#39;Brien &lt;b&gt; &quot;x&quot; &amp;");
  assert.ok(!/value='"\+v\+"'/.test(ce) && !/value='"\+n\+"'/.test(ce) && !/value='"\+\(c\.skills\[[^\]]+\]\|\|0\)\+"'/.test(ce), "H4: a skill value from the file goes into an attribute raw");
});

kase("H13: four pure renderers print what they are handed as text", function () {
  var host = { innerHTML: "", textContent: "" }, t = elapsedTicker(host, X, {});
  t.stop(); clean(host.innerHTML, "the elapsed ticker");
  clean(bibleCardHTML("Bolt", { kind: "spell", tier: X, effect: "e", cost: 1 }), "the capability card");
  clean(synopsisBlockHtml({ about: "a", now: "n", turn: X }, [{ label: "g", arcs: [{ title: "a", items: [{ turn: X, text: "t2" }] }], items: [{ turn: X, text: "t" }, { era: true, from: X, turn: X, text: "e" }] }], [], 9), "the story so far");
  clean(accountDoorsHtml({ providers: [X, "github"] }), "the account doors");
});

kase("U4: the read-only character preview offers no control that acts on the live hero", function () {
  fresh(); var c = JSON.parse(JSON.stringify(worldState.character)); c.aliases = ["The Grey"]; c.inventory = [{ name: "Longsword", qty: 1 }];
  var asPreview = csSheetSections(c, null, true), asNone = csSheetSections(c, undefined, true), live = csSheetSections(c, "", false);
  assert.strictEqual(asPreview, asNone, "a preview opened with null differs from one opened with nothing — it carries live controls");
  assert.notStrictEqual(live, asNone, "fixture: the live sheet has no controls to compare with");
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
todo.forEach(function (c) {
  try { c.fn(); passed++; realLog.call(console, "PASS #777 " + c.name); }
  catch (e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 3).join("\n    ")); }
});
if (failed) { realErr.call(console, "#777 harden: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
realLog.call(console, "ALL GREEN — " + passed + " #777 hardening cases");
