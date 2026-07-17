// arc_nudge_loop fixture injector + instrumentation (DEV TOOL — pasted into the browser
// console / javascript_tool; never loaded by index.html, never shipped).
// See PROTOCOL.md in this folder for the full runner protocol.

// ---- fixture injection -------------------------------------------------------------
// Rebuilds localStorage from the t343 base save with per-scenario skeleton mutations,
// under a THROWAWAY campaign id, with the sync-server token removed so a trial can never
// touch the user's real campaigns (local or cloud). Reload the page after calling.
window.__injectFixture = async function(scenario, trialId){
  localStorage.removeItem("tnd_server_tok_v1");                    // no cloud sync, ever
  var d = await fetch("/testRuns/Rise_of_the_Runelords_t343.tnd").then(function(r){return r.json();});
  var ws = d.worldState;
  ws.campId = "camp_arctest_" + trialId.toLowerCase();
  ws.campName = "ARCTEST " + trialId;
  var arcs = ws.skeleton.acts[0].arcs; // [Festival(completed), Glassworks(active), Thistletop(pending), Skinsaw(pending)]
  if (scenario !== "B") {
    arcs[1].status = "completed";      // Glassworks closed — matches its archived completed quest
    arcs[2].status = "active";         // Thistletop live — matches live quest "Assault on Thistletop"
    arcs[2].startTurn = ({A:283, C:143, D:343})[scenario]; // 60 / 200 / 0 turns on the clock
  }
  // scenario B: untouched — Glassworks stays active with NO startTurn; migrateWorldState
  // backfills it to the current turn at load, keeping the budget nudge silent (drift-only trial).
  localStorage.setItem("tnd_core_v10", JSON.stringify(ws));
  localStorage.setItem("tnd_sess_v10", JSON.stringify(d.sessionLog || []));
  localStorage.setItem("tnd_mem_v10", JSON.stringify(d.memory || {}));
  localStorage.setItem("tnd_active_v1", ws.campId);
  localStorage.setItem("tnd_camps_v1", JSON.stringify([{id: ws.campId, name: ws.campName,
    charName: ws.character.name, turn: ws.turn, ts: 0}]));
  localStorage.removeItem("tnd_pt_corpus_v1");                     // fresh harness corpus
  return "fixture " + trialId + " injected — reload now";
};

// ---- instrumentation (install AFTER the playtest harness, post-reload) --------------
window.__installInstrumentation = function(){
  // Outgoing-message capture: the drift nudge rides as an [ENGINE NOTE] prepended to the
  // player message (game.js sendAction), so capturing callGM's msg head proves it was SENT.
  if (!window.__ptSentPatched) {
    window.__ptSentPatched = true;
    window.__ptSent = [];
    var _cg = window.callGM;
    window.callGM = function(msg, sys){
      try { window.__ptSent.push({turn: worldState.turn, sysOverride: !!sys, head: String(msg).slice(0, 2000)}); } catch(e){}
      // 2000 (was 700): B1 finding — the quest+condition engine notes alone filled 700 chars, truncating
      // the ARC DRIFT CHECK note out of the capture; the latch write proved firing, but verbatim text is better evidence.
      return _cg.apply(this, arguments);
    };
  }
  // State snapshots: arc statuses (did ARC_COMPLETE land), drift-latch writes (did the
  // nudge fire), quest log, and the usage accumulator (real $ tracking per trial).
  window.__ptSnaps = [];
  window.__ptSnap = function(label){
    var s = {
      label: label, turn: worldState.turn,
      acts: worldState.skeleton.acts.map(function(a){ return {act: a.title, status: a.status,
        arcs: a.arcs.map(function(r){ return {t: r.title, s: r.status, st: r.startTurn}; })}; }),
      arcDriftNudged: JSON.parse(JSON.stringify(worldState.arcDriftNudged || {})),
      questLog: worldState.questLog.map(function(q){ return {t: q.title, s: q.status}; }),
      combat: !!worldState.combat,
      usage: worldState.usage ? JSON.parse(JSON.stringify(worldState.usage)) : null
    };
    window.__ptSnaps.push(s);
    return "snap '" + label + "' @t" + s.turn;
  };
  return "instrumentation installed";
};
