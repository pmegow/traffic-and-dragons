// The accent layer (Proposal_general_audio.html §21): now and then, and only while nobody is speaking, a place adds a
// short sound that belongs there — a few footsteps on a wooden floor, a chime. Pure selection and scheduling policy,
// plus a controller over an injected driver that runs BESIDE the bed controller (ambient.js), never inside it.

// Every layer kind in one table; the bed row mirrors the shipped bed constants. Weather, event and music join as rows.
var AUDIO_LAYER_KINDS = {
  bed:    {loops:true,  narration:"duck", voices:2, transitionSeconds:AMBIENT_FADE_SECONDS, optional:false},
  accent: {loops:false, narration:"gap",  voices:1, transitionSeconds:0.15, optional:true}
};
var ACCENT_ARRIVAL_QUIET_MS = 20000;   /* nothing for the first 20 s in a place: the bed fades in first */
var ACCENT_SETTLE_MS = 3000;           /* narration must have been silent this long — TTS breathes between sentences */
var ACCENT_SPACING_MS = 30000;         /* at most one accent in any 30 s across all of a place's sets */
var ACCENT_MAX_SETS = 2;
var ACCENT_BURST_MAX_SECONDS = 5;
var ACCENT_RETRY_MS = 500;             /* re-check a load deferred behind the bed's decode */

function audioValidateSprite(buffer, sprite) {
  var cuts = sprite.cuts;
  if (!buffer || buffer.numberOfChannels !== sprite.channels || buffer.duration > sprite.maxSeconds ||
      buffer.length * buffer.numberOfChannels * 4 > sprite.maxDecodedBytes || !cuts || !cuts.length ||
      cuts.some(function(c) { return !(c[0] >= 0 && c[1] > c[0] && c[1] <= buffer.duration); })) {
    throw new Error("Accent sprite exceeds its channel, duration, memory or cut-boundary limit");
  }
  return buffer;
}
function audioAccentApproved(a) {
  var ok = a.approval;
  return a.role === "accent" && a.trigger === "ambient" && !!ok && ok.recording && ok.rights && ok.contents && ok.mix;
}
/* Eligible when the place's profile allows everything the set contains, and at least one of `needsAny` — footsteps
   need someone about (owner ruling 2026-09-22: voices or crowd), so an empty house at night stays quiet. */
function audioAccentMatches(a, p, m) {
  var heard = function(c) { return p.allows.indexOf(c) >= 0 && p.forbid.indexOf(c) < 0; };
  return !a.seedOnly && a.cohort === p.cohort && a.enclosures.indexOf(p.enclosure) >= 0 && a.settings.indexOf(p.setting) >= 0 &&
    a.biomes.indexOf(p.biome) >= 0 && (a.from < a.to ? m >= a.from && m < a.to : m >= a.from || m < a.to) &&
    a.contains.every(heard) && (!(a.needsAny || []).length || a.needsAny.some(heard));
}
/* A place's accent sets: from its saved profile, or from an authored seed scene's list. Deterministic per place. */
function audioSelectAccents(s, catalog, seedScene) {
  var assets = (catalog && catalog.assets) || [], m = s && s.minuteOfDay, chosen;
  if (s && s.profile) {
    var v = audioValidateProfile(s.profile), p;
    if (!v.ok || v.profile.quiet === "silent" || typeof m !== "number" || !isFinite(m) || m < 0 || m >= 1440) return [];
    p = Object.assign({}, v.profile, {cohort: v.profile.cohort || catalog.cohort});
    var salt = p.variant || s.nodeKey || "";
    chosen = assets.filter(function(a) { return audioAccentApproved(a) && audioAccentMatches(a, p, m); })
      .sort(function(a, b) { var x = audioHash(salt + "|" + a.id), y = audioHash(salt + "|" + b.id); return x < y ? -1 : x > y ? 1 : 0; });
  } else if (s && !s.classified && seedScene && seedScene.accents) {
    chosen = seedScene.accents.map(function(id) { return assets.filter(function(a) { return a.id === id; })[0]; })
      .filter(function(a) { return a && audioAccentApproved(a); });
  } else return [];
  return chosen.slice(0, ACCENT_MAX_SETS);
}
function accentGapMs(set, rng) { return (set.gap[0] + rng() * (set.gap[1] - set.gap[0])) * 1000; }
/* One strike, or a short burst (footsteps: a count range at a walking cadence). Never the same sample twice running. */
function accentSteps(set, lastCut, rng) {
  var n = set.sprite.cuts.length, pat = set.pattern, count = 1, steps = [], at = 0, cut = lastCut, i, pick;
  if (pat.kind === "burst") count = pat.count[0] + Math.floor(rng() * (pat.count[1] - pat.count[0] + 1));
  for (i = 0; i < count; i++) {
    if (i) at += pat.cadence[0] + rng() * (pat.cadence[1] - pat.cadence[0]);
    if (at > ACCENT_BURST_MAX_SECONDS) break;
    pick = Math.floor(rng() * n);
    if (n > 1 && pick === cut) pick = (pick + 1 + Math.floor(rng() * (n - 1))) % n;
    steps.push({cut: pick, at: at}); cut = pick;
  }
  return steps;
}
function accentStart(sets, now, rng) {
  var st = {due: {}, lastCut: {}, lastSet: "", lastPlay: -Infinity};
  sets.forEach(function(set) { accentAdmit(st, set, now, rng); });
  return st;
}
function accentAdmit(st, set, now, rng) {
  if (!(set.id in st.due)) st.due[set.id] = now + ACCENT_ARRIVAL_QUIET_MS + rng() * set.gap[0] * 1000;
}
/* The scheduler's whole decision at `now`. A set that falls due during speech, inside the settle window or under rain
   it must not play in is DROPPED and re-drawn from its gap — never queued, so nothing bursts out after narration. */
function accentNext(st, sets, env, now, rng) {
  var quiet = !env.speaking && now - env.quietSince >= ACCENT_SETTLE_MS, ready = [], wake = Infinity, pick = null;
  sets.forEach(function(set) {
    var due = st.due[set.id];
    if (due > now) return;
    if (!quiet || (env.raining && set.rain === "stop")) { st.due[set.id] = now + accentGapMs(set, rng); return; }
    if (now - st.lastPlay < ACCENT_SPACING_MS) { st.due[set.id] = st.lastPlay + ACCENT_SPACING_MS; return; }
    ready.push(set);
  });
  ready.sort(function(a, b) { return st.due[a.id] - st.due[b.id]; });
  pick = ready.filter(function(set) { return set.id !== st.lastSet; })[0] || ready[0] || null;
  var play = null;
  if (pick) {
    var steps = accentSteps(pick, st.lastCut[pick.id], rng);
    st.lastCut[pick.id] = steps[steps.length - 1].cut; st.lastSet = pick.id; st.lastPlay = now;
    ready.forEach(function(set) { st.due[set.id] = set === pick ? now + accentGapMs(set, rng) : now + ACCENT_SPACING_MS; });
    play = {set: pick, steps: steps};
  }
  sets.forEach(function(set) { if (st.due[set.id] < wake) wake = st.due[set.id]; });
  return {play: play, wake: wake};
}
function accentGain(s, set) {
  return set.sprite.gain * Math.max(0, Math.min(1, Number(s.volume) || 0)) * (s.profile && s.profile.quiet === "hushed" ? 0.5 : 1);
}

/* driver: now, later, cancel, abort, idle, load, release, play(buffer,set,steps,gain)->voice, stop(voice,seconds),
   error, warn, rng, [bedPending()]. Buffers live while the place is current and are released when it is left. */
function createAccentController(driver, catalog, registry) {
  var key = "", sets = [], buffers = {}, failed = {}, st = null, timer = null, voice = null, loading = null, disposed = false;
  var env = {speaking: false, quietSince: -Infinity, raining: false}, snapshot = {};
  function blocked(s) { return !s.enabled || !s.unlocked || !s.visible || s.held || s.paused || s.capturing || s.hidden; }
  function clearTimer() { if (timer) { driver.cancel(timer); timer = null; } }
  function hush(seconds) { if (voice) { driver.stop(voice, seconds); voice = null; } }
  function releaseAll() {
    if (loading) { loading.abort.abort(); loading = null; }
    Object.keys(buffers).forEach(function(id) { driver.release(buffers[id]); }); buffers = {};
  }
  function loaded() { return sets.filter(function(set) { return buffers[set.id]; }); }
  /* Returns true when a set still waits for the bed's decode slot. Nothing calls update() when the bed settles, so
     plan() re-checks on a short timer while this is true (field-found in Chrome: the footsteps never loaded). */
  function load() {
    var set = sets.filter(function(x) { return !buffers[x.id] && !failed[x.id]; })[0];
    if (!set || loading || disposed) return false;
    if ((driver.bedPending && driver.bedPending()) || !driver.idle()) return true;
    var job = {key: key, set: set, abort: driver.abort()};
    loading = job;
    Promise.resolve().then(function() { return driver.load(set, job.abort.signal); }).then(function(buffer) {
      if (loading === job) loading = null;
      if (disposed || job.key !== key || job.abort.signal.aborted) { driver.release(buffer); return; }
      buffers[set.id] = buffer; plan();
    }, function(e) {
      if (loading === job) loading = null;
      if (disposed || job.key !== key) return;
      failed[set.id] = true;
      /* Optional layer: a memory refusal quiets the accents and keeps the bed; any other failure is reported loudly. */
      if (/budget/.test(e && e.message)) driver.warn("Accents paused for this place: " + e.message); else driver.error(e);
      plan();
    });
    return false;
  }
  function tick() { timer = null; plan(); }
  function plan() {
    clearTimer();
    if (disposed || !key) return;
    var waiting = load(), ready = loaded(), now = driver.now(), retry = waiting ? now + ACCENT_RETRY_MS : Infinity;
    if (!ready.length) { if (waiting) timer = driver.later(tick, ACCENT_RETRY_MS); return; }
    if (!st) st = accentStart(ready, now, driver.rng); else ready.forEach(function(set) { accentAdmit(st, set, now, driver.rng); });
    var r = accentNext(st, ready, env, now, driver.rng);
    if (r.play) { hush(AUDIO_LAYER_KINDS.accent.transitionSeconds); voice = driver.play(buffers[r.play.set.id], r.play.set, r.play.steps, accentGain(snapshot, r.play.set)); }
    var wake = Math.min(r.wake, retry);
    if (wake < Infinity) timer = driver.later(tick, Math.max(0, wake - now));
  }
  return {
    update: function(s) {
      if (disposed) return;
      snapshot = s || {};
      var now = driver.now(), speaking = !!snapshot.speaking;
      if (speaking && !env.speaking) hush(AUDIO_LAYER_KINDS.accent.transitionSeconds);   /* narration began: a burst in progress fades out */
      if (!speaking && env.speaking) env.quietSince = now;
      env.speaking = speaking; env.raining = !!snapshot.raining;
      if (blocked(snapshot)) {                     /* mic, pause, hidden, OFF: cut now; the gap timer starts over after */
        clearTimer(); hush(0); st = null; return;
      }
      var seed = snapshot.classified || snapshot.profile ? null : (ambientPlan(snapshot, registry || []).scene || null);
      var next = audioSelectAccents(snapshot, catalog, seed);
      var nextKey = next.length ? [snapshot.campaignId, snapshot.nodeKey, snapshot.generation, next.map(function(x) { return x.id; }).join(",")].join("|") : "";
      if (nextKey !== key) { clearTimer(); hush(0); releaseAll(); st = null; failed = {}; key = nextKey; sets = next; }
      plan();
    },
    /* The bed outranks accents for memory: shed every accent buffer, keep the key so they reload once there is room. */
    shed: function() { clearTimer(); hush(0); releaseAll(); st = null; },
    dispose: function() { disposed = true; clearTimer(); hush(0); releaseAll(); key = ""; sets = []; },
    inspect: function() {
      return {key: key, sets: sets.map(function(x) { return x.id; }), buffers: Object.keys(buffers).length, loading: loading ? 1 : 0,
        playing: voice && !voice.done ? 1 : 0, scheduled: timer ? 1 : 0, due: st ? Object.assign({}, st.due) : null};
    }
  };
}
