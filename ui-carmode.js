// ui-carmode.js — the GAME's side of the Car Mode seam (#631): the host adapter the loop (car-session.js) runs on, the
// overlay's game-owned fields (portrait, name, vitals, party dots), and the two doors (showCarMode / hideCarMode).
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17); the loop itself moved to car-session.js on 2026-10-14.
//
// CAR_HOST is ONE registry-shaped object: every row car-session.js declares in CAR_HOST_ROWS, filled from TTS, STT,
// sendAction, worldState and the helpers. Rows are functions and resolve their globals lazily (TTS and STT load AFTER this
// file). Adding a thing the loop needs = adding a row there and filling it here; dev/tests-631-car-seam.js fails when the two
// disagree, and carSessionHost() refuses an incomplete host at load, by row name.

// THE single source for what the options are, per CAR_MODE.md: the live .qa buttons on the newest
// narration. Deliberately not worldState.lastActions — the DOM copy is already punctuated (#88)
// and is exactly what the screen shows, so spoken / displayed / submitted can never disagree.
// While generateActions is still in flight its placeholder buttons carry no data-action, so this
// returns [] — which IS the "not ready yet" signal the loop's options hold waits on.
function _carActions() {
  var out = [], story = document.getElementById("story-narrative");
  if (!story) return out;
  var nars = story.querySelectorAll(".msg.narrator");
  if (!nars.length) return out;
  var btns = nars[nars.length - 1].querySelectorAll("button.qa"), i, a;
  for (i = 0; i < btns.length; i++) { a = btns[i].getAttribute("data-action"); if (a) out.push(a); }
  return out;
}

// The overlay's game-owned fields. syncUI (ui-panels.js) tail-calls this on every state change; the loop calls it
// through CAR_HOST.paint() at entry.
function _carUpdate() {
  var c = worldState && activePlayer();/* TODO #1 P2: overlay portrait/name follow the spotlight PC */
  if (!c) return;
  var nameEl = document.getElementById("car-name");
  if (nameEl) nameEl.textContent = c.name || "";
  var img = document.getElementById("car-portrait-img");
  var init = document.getElementById("car-portrait-init");
  if (img && init) {
    if (c.portrait) {
      // rank 10 — syncUI now tail-calls this every state change; only touch img.src when the
      // value actually changed, or every turn re-decodes the same base64 portrait (flicker/churn).
      if (img.getAttribute("src") !== c.portrait) img.src = c.portrait;
      img.style.display = ""; init.style.display = "none";
    } else {
      img.style.display = "none"; init.style.display = "";
    }
  }
  var vit = document.getElementById("car-vitals"); // rank 22 — glanceable HP/gold under the party dots
  if (vit) { var _cvMx = (typeof manaMax === "function") ? manaMax(c) : 0; /* #110: MP rides the glance line for casters */
    vit.textContent = "HP " + c.hp + "/" + c.maxHp + (_cvMx > 0 ? " · MP " + manaCur(c) + "/" + _cvMx : "") + " · " + fmtCoin(c.coin || 0);/* #598 */ }
  _carUpdateParty();
  if (typeof _carMediaSession === "function") _carMediaSession();
}

function _carUpdateParty() {
  var el = document.getElementById("car-party");
  if (!el || !worldState) return;
  /* TODO #1 P2: the spotlight PC owns the main portrait, so their dot leaves the row and the
     hero (when not spotlit) joins it — same swap the HUD party cards make. */
  var act = activePlayer(), hero = worldState.character;
  var members = (worldState.npcs || []).filter(function(n) { return n.partyMember && n.charSheet && !(act !== hero && n.name === act.name); });
  if (act !== hero && hero) members.unshift({ name: hero.name, charSheet: hero });
  if (!members.length) { el.innerHTML = ""; return; }
  var html = "", i, n, pv, ratio, col;
  for (i = 0; i < members.length; i++) {
    n = members[i]; pv = partyMemberVitals(n); /* UA21③ (ui-panels.js) — members are filtered to charSheet holders, so pv.ratio is never null */
    ratio = pv.ratio;
    /* #133c: a split member's dot goes neutral grey and the tooltip shows where, not vitals —
       their HP/MP are unknown to the player while they're elsewhere. */
    col = pv.split ? "var(--t2)" : hpReadout(pv.hp, pv.maxHp).color; /* audit E10: ONE HP ramp (#352 vitalReadout, helpers.js) — the UA21③ "kept separate" note predates it and this was the last third palette */
    html += "<div style='width:36px;height:36px;border-radius:50%;background:"+col+";display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-family:var(--font);font-weight:bold;border:2px solid var(--bg0);' title='"
      +escHtml(n.name)+(pv.split?" (split: "+escHtml(pv.split.location)+")":" ("+pv.hp+"/"+pv.maxHp+" HP"+(function(){var _cmMx=(typeof manaMax==="function"&&pv.sheet)?manaMax(pv.sheet):0;return _cmMx>0?", "+manaCur(pv.sheet)+"/"+_cmMx+" MP":"";})()+")")+"'>"+escHtml((n.name||"?").slice(0,2))+"</div>";
  }
  el.innerHTML = html;
}

// ── THE HOST — one row per line, in CAR_HOST_ROWS order (dev/tests-631-car-seam.js reads the keys from here) ────────────
var CAR_HOST = {
  voice: function() { return (typeof TTS !== "undefined") ? TTS : null; },
  mic: function() { return (typeof STT !== "undefined") ? STT : null; },
  busy: function() { return typeof busy !== "undefined" && !!busy; },
  opened: function() {
    closeAllMenus();
    try { store.set("tnd_carmode_v1", JSON.stringify({on:1,t:Date.now()})); } catch (e) {} // rank 13 — reload survival, expired by ui-boot.js's restore check
  },
  closed: function() { try { store.del("tnd_carmode_v1"); } catch (e) {} },
  paint: function() { _carUpdate(); },
  nowPlaying: function() {
    var c = worldState && activePlayer();/* TODO #1 P2: lockscreen metadata follows the spotlight PC */
    return { title: (c && c.name) || "Traffic and Dragons", artist: "Traffic and Dragons", album: (worldState && worldState.campName) || "", artwork: (c && c.portrait) || "" };
  },
  parked: function() { var inp = document.getElementById("action-input"); return inp ? inp.value : ""; },
  park: function(text) { var inp = document.getElementById("action-input"); if (inp) inp.value = text; },
  clearParked: function() { var inp = document.getElementById("action-input"); if (inp) inp.value = ""; },
  act: function(text) { if (typeof sendAction === "function") sendAction(typeof toFirstPerson === "function" ? toFirstPerson(text) : text); },
  sendParked: function() { if (typeof sendAction === "function") sendAction(null); },
  retry: function() { if (typeof retryLast === "function") retryLast(); },
  options: function() { return _carActions(); },
  optionsSpeech: function(acts) { return buildOptionsSpeech(acts); },
  entryBrief: function() {
    /* #19 fourth pass: the scene brief, unless the driver just heard that scene (an entry within PREVIOUSLY_AFTER_MS of the last turn) */
    var stale = !worldState || !worldState.lastTurnAt || (Date.now() - worldState.lastTurnAt) >= PREVIOUSLY_AFTER_MS;
    return (stale && typeof carSceneBrief === "function") ? carSceneBrief() : "";
  },
  recap: function() { return (worldState && typeof carRecapText === "function") ? carRecapText() : ""; },
  commands: function() { return CAR_COMMANDS; },
  onCommand: function(cmd) {
    /* #308 bookends */
    if (cmd.kind === "wrapUp") { if (worldState) worldState.wrapUpPing = { turn: worldState.turn }; carNotify("info", "Wrapping up — the story will find a stopping point."); if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak("Wrapping up. Say your next action and the story will find a stopping point."); return true; }
    /* #6 E9: "never mind" — undo the last item move, say what happened either way */
    if (cmd.kind === "undoItem") { var _u = (typeof undoLastItemMove === "function") ? undoLastItemMove() : { ok: false, reason: "not available" }; if (_u.ok) { if (typeof saveAll === "function") saveAll(); if (typeof syncUI === "function") syncUI(); } carNotify(_u.ok ? "info" : "warn", _u.ok ? "Never mind — " + _u.said : "Nothing to undo — " + _u.reason + "."); if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak(_u.ok ? "Never mind. " + _u.said : "Nothing to undo.");/* #597: the engine says what happened */ return true; }
    if (cmd.kind === "roll") { if (worldState && worldState.pendingCheck && typeof rollPendingCheck === "function") { rollPendingCheck(); } else { carNotify("info", "Nothing to roll right now."); } return true; }/* #329 */
    return false;
  },
  hear: function() { return false; },   /* #633: in Car Mode plain speech is a GM turn — stt.js sends it when the loop declines */
  crumb: function(evt, data) { if (typeof erCrumb === "function") erCrumb(evt, data); },
  ticker: function(el, base, opts) { return (typeof elapsedTicker === "function") ? elapsedTicker(el, base, opts) : null; }
};

// The doors. ui-boot.js wires the File ▸ Car Mode row and the × button here, and restores a mid-drive reload through showCarMode.
function showCarMode() {
  if (!worldState || !worldState.character) { showToast("Start a game first."); return; }
  carSessionStart();
}
function hideCarMode() { carSessionStop(); }

carSessionHost(CAR_HOST);   // at load, loudly: an incomplete host names its missing rows and this file stops here
