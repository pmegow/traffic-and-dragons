// companion-talk.js — #633: talk to your character. A spoken, in-character conversation with the hero or a party member
// OUTSIDE the game, in the car: the character answers in their own voice from what they actually know, no GM turn runs,
// nothing is written to the campaign. Design record: DOC/DESIGN_633_companion_talk.md.
//
// It is the Car Mode seam's THIRD host (after the game's CAR_HOST and car-talk's): TALK_HOST is installed for the length of
// a talk and CAR_HOST is restored when it closes. The loop (car-session.js) is unchanged; plain speech reaches the host
// through the `hear` row. The conversation engine is conversation.js (car-talk's, pinned byte-identical); the model is
// callGM's utility path (a private system, noHistory — the summarizer's shape); the voice is the game's own speaker map
// (speakerVoiceMap: the Piper id, the cloud slot pins, the delivery direction and the speed ride from the sheet).
//
// READ-ONLY by construction: relationshipRows, memoryNpcDetail, carSceneBrief, speakerVoiceMap and TTS.speak are reads
// (speakResponse is NOT used — it writes worldState.lastNarration); the one write is worldState.usage through callGM's own
// accounting (bucket "talk"). dev/tests-633-companion-talk.js serializes worldState and memory before and after a talk.

var TALK_MAX_TOKENS = 220;          // runaway insurance; the persona asks for two sentences
var TALK_WINDOW = 12;               // exchanges the engine keeps
var TALK_CAP = { backstory: 600, appear: 220, memories: 10, memoryText: 220, npcDetail: 900, chapter: 420, bonds: 8, scene: 320, total: 5200 };   // total: the trim pass shrinks the knowledge sections to fit; the rules are never cut

// ── the persona (pure) ───────────────────────────────────────────────────────
// ctx: { heroName, isHero, campName, place:{location,region,time,weather}, chapters:[string], lastScene, bonds:[{entity,bond,dynamic}],
//        coreMemories:[{text,camp}], npcDetail } — gathered by talkContext() below, or hand-built by a test.
function _talkCut(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
function talkPersona(sheet, ctx) {
  sheet = sheet || {}; ctx = ctx || {};
  var name = sheet.name || "the character", hero = ctx.heroName || "the hero", camp = ctx.campName || "this campaign";
  var who = ctx.isHero ? "the player who plays you" : hero + "'s player, who travels with you as " + hero;
  var head = ["You are " + name + ", a character in the tabletop campaign \"" + camp + "\". You are talking out loud with " + who + " — between sessions, away from the table. The story is paused; this is a conversation, not a scene."];
  var self = ["WHO YOU ARE"], id = [], i;
  if (sheet.ancestry) id.push(sheet.ancestry);
  if (sheet.cls) id.push(sheet.cls + (sheet.archetypeNm ? " (" + sheet.archetypeNm + ")" : "") + (sheet.level ? ", level " + sheet.level : ""));
  if (sheet.age) id.push(sheet.age + " years old");
  if (sheet.gender) id.push(sheet.gender === "F" ? "she/her" : sheet.gender === "M" ? "he/him" : String(sheet.gender));
  if (id.length) self.push("- " + id.join("; "));
  if (sheet.appear) self.push("- Looks: " + _talkCut(sheet.appear, TALK_CAP.appear));
  if (sheet.trait) self.push("- Trait: " + _talkCut(sheet.trait, 240));
  if (sheet.flaw) self.push("- Flaw: " + _talkCut(sheet.flaw, 240));
  if (sheet.motivation) self.push("- What drives you: " + _talkCut(sheet.motivation, 240));
  if (sheet.deity) self.push("- Faith: " + _talkCut(sheet.deity, 80));
  if (sheet.actualAlignment) self.push("- Bent: " + sheet.actualAlignment);
  if (sheet.backstory) self.push("- Your past: " + _talkCut(sheet.backstory, TALK_CAP.backstory));
  var manner = sheet.manner || sheet.voiceDirection;
  if (manner) self.push("- Manner: " + _talkCut(manner, 160));
  var bonds = (ctx.bonds || []).filter(function(r) { return r && r.entity && (r.bond || r.dynamic); }).slice(0, TALK_CAP.bonds), people = [];
  if (bonds.length) {
    people.push("YOUR PEOPLE");
    for (i = 0; i < bonds.length; i++) people.push("- " + bonds[i].entity + ": " + _talkCut(bonds[i].bond || "", 120) + (bonds[i].dynamic ? " — " + _talkCut(bonds[i].dynamic, 120) : ""));
  }
  var mem = (ctx.coreMemories || []).filter(function(m) { return m && m.text; }).slice(-TALK_CAP.memories);
  function memLine(m) { return "- " + (m.who && m.who !== name ? "About " + m.who + ": " : "") + _talkCut(m.text, TALK_CAP.memoryText) + (m.camp && m.camp !== camp ? " (from " + m.camp + ")" : ""); }
  var record = (!ctx.isHero && ctx.npcDetail) ? _talkCut(ctx.npcDetail, TALK_CAP.npcDetail) : "";
  var p = ctx.place || {}, now = [];
  if (p.time) now.push(p.time); if (p.weather) now.push(p.weather);
  if (p.location) now.push("at " + p.location + (p.sublocation ? " (" + p.sublocation + ")" : "") + (p.region ? " in " + p.region : ""));
  var chapters = (ctx.chapters || []).slice(-2).map(function(c) { return _talkCut(c, TALK_CAP.chapter); });
  var scene = ctx.lastScene ? _talkCut(ctx.lastScene, TALK_CAP.scene) : "";
  var speak = ["HOW YOU SPEAK",
    "- In character, aloud, as " + name + " — never as a narrator. The player is \"you\".",
    "- Two sentences at most, one question at most. No lists, no headings, no stage directions, no markdown, no emoji.",
    "- Stay with what the player said; remember the last few exchanges of this talk.",
    "- End cleanly so the player can answer."];
  var mustNot = ["WHAT YOU MUST NOT DO",
    "- Advance the story, decide what happens next, or claim this talk changes anything in the tale.",
    "- Invent events, people, places or facts beyond what you were given here; if you do not know, say so as " + name + " would.",
    "- Speak for the Game Master or for other characters.",
    "- Break character to discuss rules, the app or being an AI — decline in character instead."];
  function assemble() {
    var L = head.concat([""], self), j;
    if (people.length) L = L.concat([""], people);
    if (mem.length) { L = L.concat(["", "WHAT YOU REMEMBER (your own memories; speak of them as yours)"]); for (j = 0; j < mem.length; j++) L.push(memLine(mem[j])); }
    if (record) L = L.concat(["", "WHAT THE TALE KNOWS OF YOU", record]);
    L = L.concat(["", "WHERE THINGS STAND"]);
    if (now.length) L.push("- Now: " + now.join(", ") + ".");
    for (j = 0; j < chapters.length; j++) L.push("- Recently: " + chapters[j]);
    if (scene) L.push("- The last scene ended: " + scene);
    return L.concat([""], speak, [""], mustNot).join("\n");
  }
  // The trim pass: the rules are never cut; the knowledge gives way in a fixed order, one step per round, the first step that
  // can act — the older chapter, the tale's record shortened, the oldest memories down to four, the scene, the record, the last memories.
  var steps = [
    function() { if (chapters.length > 1) { chapters.shift(); return true; } return false; },
    function() { if (record.length > 450) { record = _talkCut(record, 450); return true; } return false; },
    function() { if (mem.length > 4) { mem.shift(); return true; } return false; },
    function() { if (scene) { scene = ""; return true; } return false; },
    function() { if (record) { record = ""; return true; } return false; },
    function() { if (mem.length) { mem.shift(); return true; } return false; }
  ];
  var out = assemble(), guard = 0, did, k;
  while (out.length > TALK_CAP.total && guard++ < 80) {
    did = false;
    for (k = 0; k < steps.length && !did; k++) did = steps[k]();
    if (!did) break;
    out = assemble();
  }
  return out;
}

// ── the partners and the context (reads only) ───────────────────────────────
// The hero first, then every party member with a sheet. Each: { name, sheet, isHero }.
function talkPartners() {
  var out = [], ws = (typeof worldState !== "undefined") ? worldState : null, i, n;
  if (!ws || !ws.character) return out;
  out.push({ name: ws.character.name, sheet: ws.character, isHero: true });
  var npcs = ws.npcs || [];
  for (i = 0; i < npcs.length; i++) { n = npcs[i]; if (n && n.partyMember && n.charSheet && n.name) out.push({ name: n.name, sheet: n.charSheet, isHero: false }); }
  return out;
}
function talkPartner(name) { var list = talkPartners(), i; for (i = 0; i < list.length; i++) if (list[i].name === name) return list[i]; return null; }
function talkContext(partner) {
  var ws = worldState, ctx = { heroName: ws.character.name, isHero: !!partner.isHero, campName: ws.campName || "", place: ws.world || {}, chapters: [], lastScene: "", bonds: [], coreMemories: [], npcDetail: "" };
  var mem = (typeof memory !== "undefined" && memory) ? memory : null, ch = (mem && mem.chapters) || [], i;
  for (i = Math.max(0, ch.length - 2); i < ch.length; i++) if (ch[i] && ch[i].summary) ctx.chapters.push(String(ch[i].summary));
  try { ctx.lastScene = (typeof carSceneBrief === "function") ? carSceneBrief(ws) : ""; } catch (e) { ctx.lastScene = ""; }
  try { ctx.bonds = (typeof relationshipRows === "function") ? (relationshipRows(partner.sheet, null) || []).map(function(r) { return { entity: r.entity, bond: r.bond || "", dynamic: r.dynamic || "" }; }) : []; } catch (e2) { ctx.bonds = []; }
  ctx.coreMemories = (partner.sheet.coreMemories || []).map(function(m) { return (typeof m === "string") ? { text: m, camp: "", who: "" } : { text: m.text || "", camp: m.camp || "", who: m.who || "" }; });
  if (!partner.isHero && typeof memoryNpcDetail === "function") { try { ctx.npcDetail = memoryNpcDetail(partner.name) || ""; } catch (e3) { ctx.npcDetail = ""; } }
  return ctx;
}

// ── the voice: the character's own, through the game's speaker map ──────────
function talkVoiceMap(name, text) {
  if (typeof speakerVoiceMap !== "function" || typeof TTS === "undefined" || !TTS._textPrep) return null;
  var units = TTS._textPrep.splitSentences(text, null, true), s = {}, i;
  for (i = 0; i < units.length; i++) s[i] = name;
  try { return speakerVoiceMap({ s: s, n: units.length }, text); } catch (e) { console.warn("[talk] voice map failed — the narrator voice reads this line:", e && e.message); return null; }
}
function talkVoice(name) {
  var last = "";
  return {
    isOn: function() { return false; },   // a talk's read never outlives the overlay
    isPlaying: function() { return TTS.isPlaying(); },
    isPaused: function() { return TTS.isPaused(); },
    pause: function() { TTS.pause(); },
    skip: function() { TTS.skip(); },
    stop: function() { TTS.stop(); },
    speak: function(text) { last = String(text || ""); TTS.speak(last, null, talkVoiceMap(name, last)); },
    replayLast: function() { if (!last) return false; TTS.stop(); TTS.speak(last, null, talkVoiceMap(name, last)); return true; },
    getLastText: function() { return last; },
    earcon: function(kind) { if (typeof TTS.earcon === "function") TTS.earcon(kind); },
    setOnDone: function(fn) { TTS.setOnDone(fn); },
    primeAudioSession: function() { TTS.primeAudioSession(); },
    stopAudioSessionPrimer: function() { TTS.stopAudioSessionPrimer(); }
  };
}

// ── the model: callGM's utility path, the exchanges rendered into ONE message ──
function talkRenderMessages(messages) {
  var lines = [], i, m, now = messages[messages.length - 1];
  for (i = 0; i < messages.length - 1; i++) { m = messages[i]; lines.push((m.role === "user" ? "Player: " : "You: ") + m.text); }
  return (lines.length ? "Earlier in this conversation:\n" + lines.join("\n") + "\n\n" : "") + "The player says: " + (now ? now.text : "") + "\n\nAnswer as yourself, aloud, in two sentences at most.";
}
function talkAdapter() {
  return { ask: function(system, messages) {
    if (typeof callGM !== "function") return Promise.reject(new Error("no model path (callGM) on this page"));
    return callGM(talkRenderMessages(messages), system, TALK_MAX_TOKENS, null, { noHistory: true, kind: "talk" }).then(function(r) {
      var t = (typeof r === "string") ? r : (r && (r.text || r.content)) || "";
      t = String(t).replace(/^\s*(?:\*\*)?[A-Z][\w' -]{0,40}:\s*/, "").replace(/\s+/g, " ").trim();   // a stray "Frizwick:" prefix, folded whitespace
      if (!t) throw new Error("empty reply");
      return t;
    });
  } };
}

// ── the host ────────────────────────────────────────────────────────────────
var _talk = null;   // { name, sheet, isHero, engine, voice, busy, lastHeard, turns }
function _talkField() { return document.getElementById("action-input"); }
function _talkLine(who, text) {   // the record: the Table Talk pane, this session only — never saved
  if (typeof addMsg !== "function") return;
  try { addMsg("tabletalk", "<b>" + escHtml(who) + ":</b> " + escHtml(text)); } catch (e) {}
}
function _talkAsk(text) {
  var t = _talk; if (!t) return false;
  text = String(text || "").trim(); if (!text) return false;
  /* the bench (2026-10-15): stt.js parks every final transcript in the field BEFORE the loop hears it; a line this host takes
     must leave the field, or the auto-mic sees a parked utterance after the reply and never reopens the mic (a tap then re-asks) */
  if (TALK_HOST.parked().trim() === text) TALK_HOST.clearParked();
  if (t.busy) { TALK_HOST.park(text); carNotify("info", CAR_STR.heardTapToSend); return true; }
  t.lastHeard = text; t.busy = true; t.turns++;
  carNotify("sent");                       // the ack earcon + "Heard you…"
  carNotify("info", CAR_STR.thinking);     // ticks (CAR_WAIT_STR)
  if (typeof _carSyncBtn === "function") _carSyncBtn();
  _talkLine("You", text);
  var n = t.turns, t0 = Date.now();
  t.engine.reply(text).then(function(answer) {
    if (_talk !== t) return;   // the talk closed while thinking
    t.busy = false;
    if (typeof erCrumb === "function") erCrumb("talk", "#" + n + " " + (Date.now() - t0) + "ms");
    _talkLine(t.name, answer);
    t.voice.earcon("ready");
    carNotify("info", CAR_STR.narratorSpeaking);
    t.voice.speak(answer);
    if (typeof _carSyncBtn === "function") _carSyncBtn();   // AFTER the read starts: the head unit reads PLAYING (the bench, 2026-10-15)
  }, function(e) {
    if (_talk !== t) return;
    t.busy = false;
    var why = (e && e.message) || String(e);
    if (typeof erCrumb === "function") erCrumb("talk-error", why.slice(0, 80));
    _talkLine("—", "No answer (" + why + ")");
    carNotify("error", "The line dropped — say it again, or tap");   // the fail earcon, the status, the tap armed (retry → the same line where the mic does not reopen by itself)
    if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak("The line dropped. Say it again, or tap.");   // the NARRATOR's voice: never the character's words
    if (typeof _carSyncBtn === "function") _carSyncBtn();
  });
  return true;
}
var TALK_HOST = {
  voice: function() { return _talk ? _talk.voice : null; },
  mic: function() { return (typeof STT !== "undefined") ? STT : null; },
  busy: function() { return !!(_talk && _talk.busy); },
  opened: function() { closeAllMenus(); if (_talk) _talkLine("—", "Talking with " + _talk.name + " (not saved)"); },   // never the Car Mode reload flag: a reload must not boot into a talk
  closed: function() { var t = _talk; _talk = null; if (t && t.engine) t.engine.reset(); carSessionHost(CAR_HOST); },
  paint: function() {
    var t = _talk; if (!t) return;
    var nameEl = document.getElementById("car-name"); if (nameEl) nameEl.textContent = t.name;
    var img = document.getElementById("car-portrait-img"), init = document.getElementById("car-portrait-init");
    if (img && init) {
      if (t.sheet.portrait) { if (img.getAttribute("src") !== t.sheet.portrait) img.src = t.sheet.portrait; img.style.display = ""; init.style.display = "none"; }
      else { img.style.display = "none"; init.style.display = ""; }
    }
    var vit = document.getElementById("car-vitals"); if (vit) vit.textContent = "Talking with you" + (worldState && worldState.world && worldState.world.location ? " · " + worldState.world.location : "");
    var party = document.getElementById("car-party"); if (party) party.innerHTML = "";
    if (typeof _carMediaSession === "function") _carMediaSession();
  },
  nowPlaying: function() { var t = _talk; return { title: t ? t.name : "Traffic and Dragons", artist: "Traffic and Dragons", album: (worldState && worldState.campName) || "", artwork: (t && t.sheet.portrait) || "" }; },
  parked: function() { var f = _talkField(); return f ? f.value : ""; },
  park: function(text) { var f = _talkField(); if (f) f.value = text; },
  clearParked: function() { var f = _talkField(); if (f) f.value = ""; },
  act: function(text) { _talkAsk(text); },
  sendParked: function() { var text = TALK_HOST.parked().trim(); TALK_HOST.clearParked(); if (text) _talkAsk(text); },
  retry: function() { if (_talk && _talk.lastHeard) _talkAsk(_talk.lastHeard); else carNotify("info", "Nothing to ask again"); },
  options: function() { return null; },
  optionsSpeech: function() { return ""; },
  entryBrief: function() { return _talk ? ("It's " + _talk.name + ". I'm listening.") : ""; },
  recap: function() { return ""; },
  commands: function() { return CAR_COMMANDS_BASE; },
  onCommand: function() { return false; },
  hear: function(text) { return _talkAsk(text); },
  crumb: function(evt, data) { if (typeof erCrumb === "function") erCrumb(evt, data); },
  ticker: function(el, base, opts) { return (typeof elapsedTicker === "function") ? elapsedTicker(el, base, opts) : null; }
};

// ── the doors ───────────────────────────────────────────────────────────────
function showTalk(name) {
  if (!worldState || !worldState.character) { showToast("Start a game first."); return; }
  var partner = talkPartner(name);
  if (!partner) { showToast("No one by that name travels with you."); return; }
  if (typeof Conversation === "undefined" || !Conversation.create) { showToast("The conversation engine did not load."); return; }
  if (typeof carMode !== "undefined" && carMode) carSessionStop();   // a talk never stacks on Car Mode
  _talk = { name: partner.name, sheet: partner.sheet, isHero: partner.isHero, voice: talkVoice(partner.name), busy: false, lastHeard: "", turns: 0, engine: null };
  _talk.engine = Conversation.create({ persona: talkPersona(partner.sheet, talkContext(partner)), adapter: talkAdapter(), window: TALK_WINDOW });
  if (typeof erCrumb === "function") erCrumb("talk-open", partner.name + (partner.isHero ? " (hero)" : ""));
  carSessionHost(TALK_HOST);
  carSessionStart();
}
function showTalkPicker() {
  var list = talkPartners();
  if (!list.length) { showToast("Start a game first."); return; }
  var h = "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>Talk to…</div>"
    + "<div style='font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:10px;'>A conversation outside the story, in their own voice. Nothing here changes the tale, and it is not saved.</div>", i, p;
  for (i = 0; i < list.length; i++) {
    p = list[i];
    h += "<button class='qa talk-pick' data-name='" + escHtml(p.name) + "' style='display:block;width:100%;text-align:left;margin:4px 0;'>" + escHtml(p.name) + " <span style='color:var(--t2);font-size:12px;'>" + escHtml(p.isHero ? "your " + (p.sheet.cls || "hero") : (p.sheet.cls || "companion")) + "</span></button>";
  }
  var modal = modalShell("talk-modal", h), btns = modal.querySelectorAll("button.talk-pick"), j;
  for (j = 0; j < btns.length; j++) btns[j].addEventListener("click", function(ev) { var nm = ev.currentTarget.getAttribute("data-name"); modal.remove(); showTalk(nm); });
}
