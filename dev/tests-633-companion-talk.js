// dev/tests-633-companion-talk.js — #633: talk to your character. The real loop (car-session.js), the game's host
// (ui-carmode.js), the talk host (companion-talk.js) and the pinned engine (conversation.js) in one vm context over stub
// TTS / STT / callGM / DOM, driven the way a drive drives it. Design record: DOC/DESIGN_633_companion_talk.md.
//   • the persona builder: sources, caps, the trim pass that never cuts the rules, hero vs companion
//   • the partners: the hero first, then party members with a sheet
//   • the flow: open → the greeting in the character's own voice map → the mic → speech → ONE callGM with a private system
//     and noHistory → the reply spoken in the character's map → the mic reopens; the Table Talk pane holds the record
//   • speech is never a GM turn (sendAction is never called); a number word is speech; a spoken pause holds a pending reply
//   • a failed call: the narrator's voice, the tap armed, retry re-asks the same line
//   • close restores CAR_HOST; worldState and memory are byte-identical before and after
//   • the engine pin (SHA-256) and the seam scan; the door and the load order
//   node dev/tests-633-companion-talk.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
var seam = require("./seam-scan.js");
var loose = require("assert");   /* vm objects carry another realm's prototypes — compare by structure */
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #633 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #633 " + name + " — " + e.stack); } }
async function atest(name, fn) { try { await fn(); passed++; console.log("PASS #633 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #633 " + name + " — " + e.stack); } }
var flush = function() { return new Promise(function(r) { setImmediate(r); }); };
var wait = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
/* a final result ends the listen (the recognizer's onend) before stt.js delivers it to the loop */
function hear(f, text) { f.stt._listening = false; if (f.stt._onState) f.stt._onState(false); f.els["action-input"].value = text;   /* stt.js parks the transcript in the field BEFORE the loop hears it (the bench, 2026-10-15) */ return f.c.carVoiceCommand(text); }

/* THE PIN — conversation.js is car-talk's file, copied byte-identical; car-talk pins the same hash (dev/run-tests.js there). */
var CONVERSATION_SHA256 = fs.existsSync(path.join(ROOT, "dev", "conversation.sha256")) ? fs.readFileSync(path.join(ROOT, "dev", "conversation.sha256"), "utf8").trim() : "";

function sheetFrizwick() {
  return { name: "Frizwick", gender: "F", age: "31", ancestry: "Human", cls: "Rogue", archetypeNm: "Infiltrator", level: 18, appear: "An oval face with sharp cheekbones and copper-red hair.",
    trait: "Reads a room before she reads a face.", flaw: "Like a magpie, drawn to shiny baubles.", motivation: "To find a place where leaving does not cost her something vital.",
    backstory: "Came up through Perdrath Holding as a contracted courier after a prior employer left her with a debt and a scar.", actualAlignment: "Chaotic Good", deity: "",
    relationships: [{ entity: "Ammut", bond: "Wife — beloved family", dynamic: "" }, { entity: "Morwen Zethran", bond: "Wife — leaned on, not alone", dynamic: "" }, { entity: "Shalelu", bond: "", dynamic: "" }],
    coreMemories: [{ text: "Frizwick embraced Ammut, Morwen and Daeris at the Rusty Dragon.", turn: 3, kind: "bond", who: "Frizwick", camp: "Rise of the Runelords (Ammut)" }, { text: "Ammut's ending: he spent nineteen levels proving he belonged.", turn: 9, who: "Ammut", camp: "The Princess" }],
    voiceId: "en_GB-alba-medium", speechifyVoiceId: "catriona", voiceDirection: "dry, quick", portrait: null, partyMember: true, hp: 40, maxHp: 44, coin: 1200 };
}
function sheetDaeris() { return { name: "Daeris", gender: "F", cls: "Cleric", level: 12, trait: "Keeps a ledger in her head.", coreMemories: ["Daeris let Ammut hold her through the night in Magnimar."], relationships: [{ entity: "Frizwick", bond: "Wife — chosen family" }], voiceId: "en_US-libritts_r-medium#12" }; }
function world() {
  return { ver: 11, campId: "c1", campName: "Frizwick", character: sheetFrizwick(), turn: 11, lastTurnAt: 0,
    world: { location: "Oakhaven", region: "The Blighted Reach", time: "dawn", weather: "cold wind carrying ash", sublocation: null },
    npcs: [{ name: "Daeris", partyMember: true, charSheet: sheetDaeris() }, { name: "Fen Marauder", partyMember: false }],
    transcript: [{ t: 1, r: "player", x: "I go south." }, { t: 1, r: "gm", x: "The road bends south. The ash thins at Oakhaven's gate." }], questLog: [] };
}
function fixture(opts) {
  opts = opts || {};
  var els = {}, calls = [], crumbs = [], tt = [], gm = [], sent = [];
  var el = function(id) { return { id: id, classList: { add: function() {}, remove: function() {} }, style: {}, textContent: "", innerHTML: "", disabled: false, value: "", offsetWidth: 0,
    getAttribute: function() { return null; }, setAttribute: function() {}, querySelectorAll: function() { return []; }, focus: function() {}, blur: function() {} }; };
  var tts = { _playing: false, _paused: false, _onDone: null, spoken: [],
    isPlaying: function() { return this._playing && !this._paused; }, isPaused: function() { return this._paused; }, isOn: function() { return false; },
    speak: function(text, voiceId, voices) { this.spoken.push({ text: text, voices: voices || null }); calls.push("speak:" + text); this._playing = true; this._paused = false; },
    done: function() { this._playing = false; this._paused = false; if (this._onDone) this._onDone(); },
    pause: function() { calls.push("pause"); if (this._playing) this._paused = !this._paused; }, skip: function() { calls.push("skip"); this.done(); }, stop: function() { calls.push("stop"); this._playing = false; this._paused = false; },
    replayLast: function() { calls.push("replay"); return true; }, getLastText: function() { return ""; }, earcon: function(k) { calls.push("earcon:" + k); }, setOnDone: function(fn) { this._onDone = fn; },
    primeAudioSession: function() {}, stopAudioSessionPrimer: function() {},
    _textPrep: { splitSentences: function(text) { return String(text).split(/(?<=[.!?])\s+/).filter(Boolean); } } };
  var stt = { _listening: false, isListening: function() { return this._listening; }, start: function() { calls.push("stt-start"); this._listening = true; if (this._onState) this._onState(true); },
    stop: function() { calls.push("stt-stop"); this._listening = false; }, cancel: function() { calls.push("stt-cancel"); this._listening = false; }, isCloudActive: function() { return false; }, isSupported: function() { return true; },
    setOnState: function(fn) { this._onState = fn; }, clearConfirm: function() {}, isConfirmPending: function() { return false; }, isAutoListen: function() { return true; }, warmMic: function() { calls.push("warm"); return Promise.resolve(true); } };
  var c = {
    console: { warn: function() {}, info: function() {}, debug: function() {}, log: function() {}, error: function() {} },
    document: { addEventListener: function() {}, removeEventListener: function() {}, dispatchEvent: function() { return true; }, getElementById: function(id) { return els[id] || (els[id] = el(id)); }, visibilityState: "visible", hidden: false },
    navigator: { mediaSession: { playbackState: "none", metadata: null, setActionHandler: function() {} } },
    CustomEvent: function(type, init) { this.type = type; this.detail = init && init.detail; }, MediaMetadata: function(m) { this.title = m.title; this.album = m.album; this.artist = m.artist; this.artwork = m.artwork; },
    Date: Date, Math: Math, JSON: JSON, String: String, Object: Object, Array: Array, Promise: Promise, Error: Error, setTimeout: setTimeout, clearTimeout: clearTimeout, setImmediate: setImmediate,
    TTS: tts, STT: stt, busy: false, worldState: world(), memory: { chapters: [{ turn: 3, summary: "Frizwick found the courier satchel at the Crossroads." }, { turn: 7, summary: "She dispatched the marauders and bound the captive." }], npcs: { Daeris: { attitude: "warm" } } },
    store: { get: function() { return ""; }, set: function() {}, del: function() {} }, showToast: function(m) { calls.push("toast:" + m); }, closeAllMenus: function() {},
    erCrumb: function(e, d) { crumbs.push(e + " " + d); }, escHtml: function(s) { return String(s); }, activePlayer: function() { return c.worldState.character; }, fmtCoin: function(x) { return x + " cp"; },
    partyMemberVitals: function(n) { return { hp: 1, maxHp: 1, ratio: 1, sheet: n.charSheet }; }, hpReadout: function() { return { color: "#fff" }; }, manaMax: function() { return 0; }, manaCur: function() { return 0; },
    PREVIOUSLY_AFTER_MS: 7200000, carRecapText: function() { return "recap"; }, carSceneBrief: function() { return "You are at Oakhaven. The ash thins at Oakhaven's gate."; },
    sendAction: function(t) { sent.push(t); }, retryLast: function() { sent.push("retry"); },
    relationshipRows: function(sheet) { return (sheet.relationships || []).filter(function(r) { return r.bond || r.dynamic; }); },
    memoryNpcDetail: function(name) { return name === "Daeris" ? "Daeris — toward you: warm\n  Knows: the ledger is quiet now." : ""; },
    speakerVoiceMap: function(sp, text) { var out = {}; Object.keys(sp.s).forEach(function(k) { out[k] = "voice:" + sp.s[k]; }); return out; },
    addMsg: function(type, html) { if (type === "tabletalk") tt.push(html); return {}; },
    modalShell: function(id, html) { var btns = null; var m = { id: id, html: html, removed: false, remove: function() { m.removed = true; }, querySelectorAll: function() {
      if (btns) return btns; btns = []; var re = /data-name='([^']+)'/g, mm; while ((mm = re.exec(html))) btns.push({ name: mm[1], _h: null, addEventListener: function(ev, fn) { this._h = fn; }, click: function() { var self = this; this._h({ currentTarget: { getAttribute: function() { return self.name; } } }); } }); return btns; } }; c._lastModal = m; return m; },
    callGM: function(msg, sys, maxTok, model, o) { gm.push({ msg: msg, sys: sys, maxTok: maxTok, model: model, opts: o }); if (opts.fail) return Promise.reject(new Error(opts.fail)); return Promise.resolve(opts.reply || "Then I will say so. Ask me again at the gate?"); },
    elapsedTicker: null
  };
  vm.createContext(c);
  vm.runInContext(src("car-commands.js"), c, { filename: "car-commands.js" });
  var gp = src("game.js"), ga = gp.indexOf("var CAR_COMMANDS = [");
  vm.runInContext(gp.slice(ga, gp.indexOf("\n];", ga) + 3), c, { filename: "game.js#CAR_COMMANDS" });
  vm.runInContext(src("conversation.js"), c, { filename: "conversation.js" });
  vm.runInContext(src("car-session.js"), c, { filename: "car-session.js" });
  vm.runInContext(src("ui-carmode.js"), c, { filename: "ui-carmode.js" });
  vm.runInContext(src("companion-talk.js"), c, { filename: "companion-talk.js" });
  return { c: c, tts: tts, stt: stt, calls: calls, crumbs: crumbs, tt: tt, gm: gm, sent: sent, els: els };
}

/* ── the persona ── */
test("the hero's persona carries who, people, memories, the moment and the rules; a companion's adds the tale's record", function() {
  var f = fixture(), p = f.c.talkPersona(sheetFrizwick(), f.c.talkContext(f.c.talkPartner("Frizwick")));
  ["You are Frizwick", "the player who plays you", "WHO YOU ARE", "Rogue (Infiltrator), level 18", "she/her", "Trait: Reads a room", "Flaw: Like a magpie", "Manner: dry, quick",
   "YOUR PEOPLE", "- Ammut: Wife — beloved family", "WHAT YOU REMEMBER", "embraced Ammut", "(from Rise of the Runelords (Ammut))", "About Ammut: Ammut's ending",
   "WHERE THINGS STAND", "- Now: dawn, cold wind carrying ash, at Oakhaven in The Blighted Reach.", "- Recently: She dispatched the marauders", "- The last scene ended: You are at Oakhaven",
   "HOW YOU SPEAK", "Two sentences at most", "WHAT YOU MUST NOT DO", "Advance the story", "Invent events, people, places", "being an AI"].forEach(function(s) { assert(p.indexOf(s) >= 0, "missing: " + s + "\n" + p); });
  assert(p.indexOf("Shalelu") < 0, "an empty bond is not a person");
  assert(p.indexOf("WHAT THE TALE KNOWS OF YOU") < 0, "the hero has no NPC record");
  assert(p.indexOf("I go south") < 0, "the transcript is never dumped");
  var d = f.c.talkPersona(sheetDaeris(), f.c.talkContext(f.c.talkPartner("Daeris")));
  ["You are Daeris", "Frizwick's player, who travels with you as Frizwick", "WHAT THE TALE KNOWS OF YOU", "the ledger is quiet now", "- Frizwick: Wife — chosen family", "Daeris let Ammut hold her"].forEach(function(s) { assert(d.indexOf(s) >= 0, "missing: " + s + "\n" + d); });
});
test("the trim pass never cuts the rules: a huge record gives way, the oldest memory first", function() {
  var f = fixture(), big = sheetDaeris(), i;
  /* real words, so the word-boundary cut keeps each item near its cap instead of collapsing a single giant token */
  var words = function(k, w) { var o = []; for (var q = 0; q < k; q++) o.push(w + q); return o.join(" "); };
  big.coreMemories = []; for (i = 0; i < 60; i++) big.coreMemories.push({ text: "Memory number " + i + " " + words(60, "recall"), camp: "Frizwick" });
  big.backstory = words(500, "past"); big.appear = words(100, "look");
  var ctx = f.c.talkContext(f.c.talkPartner("Daeris")); ctx.coreMemories = big.coreMemories; ctx.npcDetail = words(300, "known"); ctx.chapters = [words(300, "then"), words(300, "later")]; ctx.lastScene = words(120, "scene");
  ctx.bonds = []; for (i = 0; i < 12; i++) ctx.bonds.push({ entity: "Person " + i, bond: words(30, "bond"), dynamic: "" });
  /* the input must EXCEED the cap after the per-item caps, or the trim never runs and this test proves nothing */
  var untrimmed = (function() { var cap = f.c.TALK_CAP.total; f.c.TALK_CAP.total = 1e9; var u = f.c.talkPersona(big, ctx); f.c.TALK_CAP.total = cap; return u; })();
  assert(untrimmed.length > f.c.TALK_CAP.total + 1500, "the fixture must overflow the cap by a margin: " + untrimmed.length);
  var p = f.c.talkPersona(big, ctx);
  assert(p.length <= f.c.TALK_CAP.total, "over the cap: " + p.length);
  assert(/WHAT YOU MUST NOT DO[\s\S]*being an AI — decline in character instead\.$/.test(p), "the rules must close the block intact");
  assert(p.indexOf("Memory number 59") >= 0 && p.indexOf("Memory number 0 ") < 0, "the newest memory stays, the oldest goes");
  assert(p.indexOf("later0") >= 0 && p.indexOf("then0") < 0, "the older chapter goes before the newer");
  assert(p.indexOf("known0") >= 0, "the tale's record is shortened before it is dropped");
  assert((p.match(/^- (?:About [^:]+: )?Memory number/gm) || []).length >= 4, "at least four memories survive while anything else can give");
});
test("the partners: the hero first, then party members with a sheet, never a sheetless NPC", function() {
  var f = fixture(), list = f.c.talkPartners().map(function(p) { return p.name + (p.isHero ? "*" : ""); });
  loose.deepEqual(list, ["Frizwick*", "Daeris"]);
  assert.equal(f.c.talkPartner("Fen Marauder"), null);
});

/* ── the hosts ── */
test("both hosts fill every CAR_HOST_ROWS row (22, with hear) and the game's host leaves plain speech to stt.js", function() {
  var f = fixture();
  assert.equal(f.c.CAR_HOST_ROWS.length, 22);
  f.c.carSessionHost(f.c.TALK_HOST); f.c.carSessionHost(f.c.CAR_HOST);
  assert.equal(f.c.CAR_HOST.hear("walk north"), false);
});

/* ── the flow ── */
(async function() {
  await atest("open: the greeting is spoken in the character's own voice map, then the mic opens; speech asks the model ONCE with a private system and noHistory; the reply is spoken in the map and the mic reopens; the record lands in the Table Talk pane", async function() {
    var f = fixture(), before = JSON.stringify([f.c.worldState, f.c.memory]);
    f.c.showTalk("Frizwick"); await flush();
    assert.equal(f.c.carMode, true); assert.equal(f.c._carHost, f.c.TALK_HOST);
    assert.equal(f.tts.spoken.length, 1, "the greeting: " + JSON.stringify(f.tts.spoken));
    assert.match(f.tts.spoken[0].text, /Frizwick/);
    loose.deepEqual(f.tts.spoken[0].voices, { "0": "voice:Frizwick", "1": "voice:Frizwick" }, "every unit of the greeting is Frizwick's voice");
    assert(f.crumbs.some(function(x) { return /^talk-open Frizwick \(hero\)/.test(x); }));
    assert.equal(f.c.navigator.mediaSession.playbackState, "playing", "the head unit reads PLAYING while the character speaks (the greeting)");
    f.tts.done(); await wait(900);   // onDone → the auto-mic gap (800 ms) → the mic opens
    assert(f.stt.isListening(), "the mic opens after the greeting: " + JSON.stringify(f.calls));
    assert.equal(hear(f, "how do you feel about Ammut"), true, "speech is consumed by the talk host");
    assert.equal(f.c.TALK_HOST.busy(), true, "busy across the call");
    await flush();   /* the engine asks its adapter on a microtask */
    assert.equal(f.gm.length, 1); var g = f.gm[0];
    assert.equal(g.opts.noHistory, true); assert.equal(g.opts.kind, "talk"); assert.equal(g.model, null);
    assert(typeof g.sys === "string" && g.sys.indexOf("WHO YOU ARE") >= 0 && g.sys.indexOf("Ammut: Wife") >= 0, "the persona is the system");
    assert(g.msg.indexOf("how do you feel about Ammut") >= 0 && g.msg.indexOf("Earlier in this conversation") < 0, "the first exchange has no earlier lines: " + g.msg);
    assert(f.calls.indexOf("earcon:ack") >= 0, "the ack earcon at once");
    await flush(); await flush();
    assert.equal(f.c.TALK_HOST.busy(), false);
    assert.equal(f.tts.spoken.length, 2, "the reply spoken: " + JSON.stringify(f.tts.spoken));
    assert.match(f.tts.spoken[1].text, /Then I will say so/); assert.equal(f.tts.spoken[1].voices["0"], "voice:Frizwick");
    assert.equal(f.c.navigator.mediaSession.playbackState, "playing", "the head unit reads PLAYING while the character speaks (the reply)");
    assert.equal(f.els["action-input"].value, "", "the transcript stt.js parked is cleared by the talk — the auto-mic must not wait on it");
    assert(f.calls.indexOf("earcon:ready") >= 0);
    assert.deepEqual(f.sent, [], "a talk never sends a GM turn");
    assert(f.tt.some(function(h) { return /You:/.test(h) && /Ammut/.test(h); }) && f.tt.some(function(h) { return /Frizwick:/.test(h); }), "the Table Talk pane holds the record: " + JSON.stringify(f.tt));
    f.tts.done(); await wait(900);
    assert(f.stt.isListening(), "the mic reopens after the reply");
    assert.equal(hear(f, "two"), true, "a number word is speech for a host with no menu");
    await flush();
    assert.equal(f.gm.length, 2); assert(f.gm[1].msg.indexOf("Earlier in this conversation") >= 0 && f.gm[1].msg.indexOf("Player: how do you feel about Ammut") >= 0, "the kept exchange rides the next ask: " + f.gm[1].msg);
    await flush(); await flush();
    f.c.carSessionStop(); await flush();
    assert.equal(f.c._carHost, f.c.CAR_HOST, "close restores the game's host"); assert.equal(f.c._talk, null); assert.equal(f.c.carMode, false);
    assert.equal(JSON.stringify([f.c.worldState, f.c.memory]), before, "worldState and memory are byte-identical after a talk");
    assert.equal(f.c.carVoiceCommand("walk north"), false, "after the talk, Car Mode speech is a GM turn again (carMode off → false)");
  });
  await atest("a spoken pause holds a pending reply: it is spoken when it lands, the mic stays closed, the tap releases", async function() {
    var f = fixture({ reply: "Hold that thought." });
    f.c.showTalk("Frizwick"); await flush(); f.tts.done(); await wait(900);
    hear(f, "are we safe here"); await flush();
    assert.equal(hear(f, "gm pause"), true); assert.equal(f.c._carHeld, true);
    await flush(); await flush();
    assert.match(f.tts.spoken[f.tts.spoken.length - 1].text, /Hold that thought/);
    f.tts.done(); await wait(900);
    assert.equal(f.stt.isListening(), false, "held: the mic stays closed"); assert.match(f.els["car-status"].textContent, /Paused — say resume, or tap/);
    f.c._carTap(); await wait(50);
    assert.equal(f.c._carHeld, false); assert(f.stt.isListening(), "the tap releases and the mic opens");
    f.c.carSessionStop();
  });
  await atest("a failed call: the narrator's voice says the line dropped (no character map), the tap is armed, and retry asks the same line again", async function() {
    var f = fixture({ fail: "HTTP 503 from the gateway" });
    f.c.showTalk("Frizwick"); await flush(); f.tts.done(); await wait(900);
    hear(f, "what do you make of the marauders"); await flush(); await flush(); await flush();
    var last = f.tts.spoken[f.tts.spoken.length - 1];
    assert.match(last.text, /The line dropped/); assert.equal(last.voices, null, "the notice is the NARRATOR's voice, never the character's");
    assert(f.crumbs.some(function(x) { return /^talk-error HTTP 503/.test(x); }));
    assert(f.calls.indexOf("earcon:fail") >= 0); assert.equal(f.c._carRetryArmed, true);
    assert.match(f.els["car-status"].textContent, /say it again, or tap/);
    f.tts.done(); await wait(900);
    assert(f.stt.isListening(), "on the native path the mic reopens after the notice so the player can simply say it again");
    f.stt.isCloudActive = function() { return true; };   /* push-to-talk: the mic never opens by itself — the armed tap is the way back */
    f.stt._listening = false;
    f.c._carTap(); await wait(20);
    assert.equal(f.gm.length, 2, "retry re-asks the same line (one more model call)"); assert(f.gm[1].msg.indexOf("what do you make of the marauders") >= 0, "retry re-asks the same line");
    assert.deepEqual(f.sent, [], "retry never retries a GM turn");
    f.c.carSessionStop();
  });
  await atest("the picker lists the partners and opens the talk; a talk never stacks on Car Mode", async function() {
    var f = fixture();
    f.c.showCarMode(); await flush(); assert.equal(f.c._carHost, f.c.CAR_HOST);
    f.c.showTalkPicker();
    var m = f.c._lastModal, btns = m.querySelectorAll();
    loose.deepEqual(btns.map(function(b) { return b.name; }), ["Frizwick", "Daeris"]);
    btns[1].click(); await flush();
    assert.equal(m.removed, true); assert.equal(f.c._carHost, f.c.TALK_HOST); assert.equal(f.c._talk.name, "Daeris"); assert.equal(f.c.carMode, true);
    assert.match(f.tts.spoken[f.tts.spoken.length - 1].text, /Daeris/);
    f.c.carSessionStop();
  });

  /* ── the pin, the seam, the door, the order ── */
  test("conversation.js is car-talk's engine byte-for-byte (SHA-256 pin) and names nothing outside itself", function() {
    var s = src("conversation.js"), sha = crypto.createHash("sha256").update(s).digest("hex");
    assert(CONVERSATION_SHA256, "dev/conversation.sha256 holds the pin");
    assert.equal(sha, CONVERSATION_SHA256, "conversation.js drifted from the pinned copy — re-copy from car-talk (or re-pin on purpose, in both repos)");
    var PLATFORM = ("document navigator window console setTimeout clearTimeout setInterval clearInterval Date Math String Number Boolean Object Array JSON RegExp Promise Error TypeError CustomEvent MediaMetadata AudioContext Float32Array isFinite isNaN parseInt parseFloat encodeURIComponent decodeURIComponent arguments").split(" ");
    var out = seam.outsideNames(s, PLATFORM);
    assert.deepEqual(out, [], "the engine reaches outside itself: " + out.map(function(u) { return u.name + " (line " + u.line + ")"; }).join(", "));
  });
  test("the door and the load order: the File menu row is wired; conversation.js precedes companion-talk.js, which follows ui-carmode.js; the shell carries both", function() {
    var boot = src("ui-boot.js"), idx = src("index.html"), sw = src("sw.js");
    assert(/btn\(p\+"talk","&#128483; Talk to&hellip;",0\)/.test(boot), "the Talk to… row");
    assert(/getElementById\("fm-talk"\)\.addEventListener\("click",function\(\)\{closeAllMenus\(\);if\(typeof showTalkPicker==="function"\)showTalkPicker\(\);\}\)/.test(boot), "the click opens the picker");
    function at(f) { var i = idx.indexOf("<script src=\"" + f + "\">"); assert(i >= 0, f + " is not loaded by index.html"); return i; }
    assert(at("conversation.js") < at("companion-talk.js")); assert(at("ui-carmode.js") < at("companion-talk.js")); assert(at("car-session.js") < at("companion-talk.js"));
    var shell = sw.slice(sw.indexOf("var APP_SHELL = ["), sw.indexOf("];", sw.indexOf("var APP_SHELL = [")));
    ["conversation.js", "companion-talk.js"].forEach(function(f) { assert(shell.indexOf("\"/" + f + "\"") >= 0, f + " missing from APP_SHELL"); });
  });
  console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " companion-talk groups (#633)");
})();
