// audio-master.js — THE master mute (#657, owner 2026-10-22, from the phone: "an overall mute button … it should
// mute ALL sounds and narration … a multiplier to the other audio sources. On: no effect. Off: multiply all
// sources by 0").
//
// ONE multiplier, read by every audio source at its output and never anywhere else:
//   AudioMaster.gain()  → 1 while sound is on, 0 while muted.
// The sources keep their own prefs and state untouched — the voice toggle, the earcon pref, the ambience checkbox
// and its slider all stay exactly as the player left them; a mute only multiplies. Who multiplies where:
//   tts.js        every decoded narration source runs through ONE master GainNode per context (live — a mute
//                 lands mid-sentence and unmute resumes where the narration is); the browser voice fixes an
//                 utterance's volume when it is spoken, so it takes the multiplier per sentence and a mute
//                 cancels the live sentence so the chain moves on silently.
//   sound.js      the per-play bus gain.
//   ui-ambient.js the snapshot's volume (the bed ramps to 0, the accents do not fire), re-synced on change.
// The door is the phone's mute button (ui-mobile.js, the right end of the Connected locations row). Persisted
// per device under tnd_mute_v1 — a reload keeps the mute; cross-device sync is not a goal (a mute is about
// where you are). Portable: names nothing outside itself and the platform; Node-safe (no localStorage → a
// page-only mute, said once on the console). A listener that throws is reported and never stops the others.
var AudioMaster = (function() {
  var KEY = "tnd_mute_v1";
  var muted = false, listeners = [], saidNoStore = false;
  function store() {
    try { if (typeof localStorage === "undefined" || localStorage === null) return null; return localStorage; }
    catch (e) { return null; }
  }
  function read() {
    var s = store();
    if (!s) return false;
    try { return s.getItem(KEY) === "1"; }
    catch (e) { console.warn("[audio-master] the saved mute could not be read (" + e.message + ") — sound starts on"); return false; }
  }
  function gain() { return muted ? 0 : 1; }
  function setMuted(v) {
    v = !!v;
    if (v === muted) return muted;
    muted = v;
    var s = store();
    if (!s) { if (!saidNoStore) { saidNoStore = true; console.warn("[audio-master] no storage — the mute holds for this page only"); } }
    else {
      try { s.setItem(KEY, muted ? "1" : "0"); }
      catch (e) { console.warn("[audio-master] the mute could not be saved (" + e.message + ") — it holds for this page only"); }
    }
    listeners.slice().forEach(function(f) {
      try { f(muted, gain()); }
      catch (e) { console.error("[audio-master] a listener threw on " + (muted ? "mute" : "unmute") + ": " + ((e && e.message) || e)); }
    });
    return muted;
  }
  function onChange(f) {
    if (typeof f !== "function") throw new Error("AudioMaster.onChange needs a function");
    listeners.push(f);
    return function off() { var i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); };
  }
  muted = read();
  return {
    KEY: KEY,
    gain: gain,
    muted: function() { return muted; },
    setMuted: setMuted,
    toggle: function() { return setMuted(!muted); },
    onChange: onChange,
    reload: function() { muted = read(); return muted; }   /* re-read the store (a test's door; the page reads once at load) */
  };
})();
