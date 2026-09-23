// Device preferences and the committed scene are read at UI/voice boundaries, never polled.
var Ambient = (function() {
  var enabled = false, volume = 0.45, unlocked = false, held = false, capturing = false;
  var AMBIENT_DUCK_ATTACK_SECONDS = 0.08, AMBIENT_DUCK_RELEASE_SECONDS = 1.2; /* setTargetAtTime time constants: ~0.3 s down, ~4 s back up */
  var ctx = null, controller = null, initialized = false, lastError = "", status = "Off";
  var accents = null, accentSettled = Promise.resolve();   /* the accent layer (§21) and its in-flight decode */
  var offs = [], gesturePending = false, lastCacheError = "";
  function report(e) {
    var reason = (e && e.message) || String(e);
    status = "Unavailable: " + reason; paint();
    if (lastError !== reason) { lastError = reason; console.warn("[ambience] " + reason); if (typeof showToast === "function") showToast("Ambience: " + reason, 7000); }
  }
  function saved(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; }
    catch (e) { console.warn("[ambience] Cannot read settings: " + e.message); return fallback; }
  }
  function save() {
    try { localStorage.setItem("tnd_ambient_enabled_v1", enabled ? "1" : "0"); localStorage.setItem("tnd_ambient_volume_v1", String(volume)); }
    catch (e) { report(new Error("Settings could not be saved: " + e.message)); }
  }
  function snapshot() {
    var scene=audioPublishedScene||{campaignId:"",nodeKey:null};
    var screen=document.getElementById("game-screen");
    return Object.assign({},scene,{enabled:enabled,volume:volume,unlocked:unlocked,held:held,capturing:capturing,
      visible:!!screen&&screen.style.display==="flex",hidden:document.hidden,
      speaking:typeof TTS!=="undefined"&&TTS.isPlaying(),paused:typeof TTS!=="undefined"&&TTS.isPaused()});
  }
  function paint() {
    if (typeof eachMenuEl === "function") {
      eachMenuEl("ambient-cb", function(el) { el.checked = enabled; });
      eachMenuEl("ambient-volume", function(el) { el.value = Math.round(volume * 100); });
      eachMenuEl("ambient-status", function(el) { el.textContent = status; });
      eachMenuEl("ambient-unlock", function(el) { el.style.display = enabled && (!unlocked || lastError) ? "inline-block" : "none"; });
    }
  }
  function sync() {
    if (!initialized) return;
    var s = snapshot(), p = ambientPlan(s, AUDIO_SCENES);
    if (controller) controller.update(s);
    if (accents) accents.update(s);
    if (!enabled) status = "Off";
    else if (location.protocol === "file:") { report(new Error("Open the hosted game or localhost to use ambience")); return; }
    else if (!unlocked) status = "Tap anywhere to start ambience";
    else if (held || s.paused) status = "Paused";
    else if (!p.scene) status = s.common && s.open === null ? "Hours for " + s.common + " are not recorded" : "No ambience for this location";
    else if (capturing) status = "Quiet for microphone";
    else if (!lastError) status = (p.scene.label || p.scene.id) + (s.speaking ? " · quiet under narration" : "") + (controller && controller.inspect().pending ? " · loading" : "");
    paint();
  }
  /* Bed and accents share ONE loader (one decode slot, one 48 MiB budget). The bed outranks accents (§21.5): it waits for
     an in-flight accent decode instead of colliding with it, and a memory refusal sheds the accent buffers and retries once. */
  function driver(loader) {
    return {
      release:loader.release,
      inspect:loader.inspect,
      abort: function() { return new AbortController(); },
      error: report,
      load: function(scene, signal) {
        return accentSettled.then(function() { return loader.load(scene, signal); }).catch(function(e) {
          if (!accents || !/budget/.test(e && e.message)) throw e;
          accents.shed(); return loader.load(scene, signal);
        });
      },
      start: function(buffer, scene, value) {
        var source = ctx.createBufferSource(), gain = ctx.createGain(), envelope = ctx.createGain();
        try {
          source.buffer = buffer; source.loop = true; source.loopStart = scene.bed.loopStart; source.loopEnd = scene.bed.loopEnd;
          gain.gain.value = value; envelope.gain.value = 0; source.connect(gain); gain.connect(envelope); envelope.connect(ctx.destination); source.start(0, scene.bed.loopStart);
        } catch (e) { source.disconnect(); gain.disconnect(); envelope.disconnect(); throw e; }
        lastError = ""; status = scene.label || scene.id; paint();
        return { source: source, gain: gain, envelope: envelope, target: value, fade: {from:0,to:0,start:ctx.currentTime,end:ctx.currentTime} };
      },
      gain: function(voice, value) {
        if (voice.target === value) return;
        var param = voice.gain.gain; param.cancelScheduledValues(ctx.currentTime);
        if (value === 0) { param.cancelScheduledValues(0); param.value = 0; }
        /* asymmetric: duck IN fast (narration is never masked), come BACK slowly (owner 2026-09-15: the snap-back was stark) */
        else param.setTargetAtTime(value, ctx.currentTime, value < voice.target ? AMBIENT_DUCK_ATTACK_SECONDS : AMBIENT_DUCK_RELEASE_SECONDS);
        voice.target = value;
      },
      /* Envelope and mix level are independent: mic/voice events cannot cancel a scene fade. */
      fade: function(voice, target, seconds) {
        var now = ctx.currentTime, f = voice.fade;
        var progress = f.end > f.start ? Math.max(0, Math.min(1, (now - f.start) / (f.end - f.start))) : 1;
        var value = f.from + (f.to - f.from) * progress, param = voice.envelope.gain;
        param.cancelScheduledValues(now); param.setValueAtTime(value, now); param.linearRampToValueAtTime(target, now + seconds);
        voice.fade = {from:value,to:target,start:now,end:now + seconds};
      },
      later: function(fn, ms) { return setTimeout(fn, ms); },
      cancel: function(timer) { clearTimeout(timer); },
      stop: function(voice) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.envelope.disconnect(); loader.release(voice.source.buffer); voice.source.buffer = null; }
    };
  }
  /* The accent layer's playback (audio-accents.js owns the policy). A burst's steps are all scheduled on the
     AudioContext clock at once, so the walking cadence is sample-accurate; one gain node per voice lets it fade out. */
  function accentDriver(loader) {
    return {
      now: function() { return Date.now(); },
      later: function(fn, ms) { return setTimeout(fn, ms); },
      cancel: function(timer) { clearTimeout(timer); },
      abort: function() { return new AbortController(); },
      idle: function() { return loader.inspect().reservedDecodes === 0; },
      bedPending: function() { return !!(controller && controller.inspect().pending); },
      load: function(set, signal) { var job = loader.load(set, signal); accentSettled = job.then(function() {}, function() {}); return job; },
      release: loader.release,
      rng: Math.random,
      error: report,
      warn: function(message) { console.warn("[ambience] " + message); },
      play: function(buffer, set, steps, value) {
        var gain = ctx.createGain(), t0 = ctx.currentTime + 0.05, voice = { gain: gain, sources: [], done: false }, left = steps.length;
        gain.gain.value = value; gain.connect(ctx.destination);
        steps.forEach(function(step) {
          var cut = set.sprite.cuts[step.cut], source = ctx.createBufferSource();
          source.buffer = buffer; source.connect(gain);
          source.onended = function() { source.disconnect(); if (--left === 0) { voice.done = true; gain.disconnect(); } };
          source.start(t0 + step.at, cut[0], cut[1] - cut[0]); voice.sources.push(source);
        });
        return voice;
      },
      stop: function(voice, seconds) {
        if (voice.done) return;
        var now = ctx.currentTime, param = voice.gain.gain;
        param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); param.linearRampToValueAtTime(0, now + seconds);
        /* a source that already ended rejects a second stop(); that is the only failure possible here, and it is harmless */
        voice.sources.forEach(function(source) { try { source.stop(now + seconds); } catch (e) {} });
      }
    };
  }
  function unlock(fromGesture) {
    // A blocked startup resume can stay pending until another resume runs inside a gesture.
    if (!enabled || (gesturePending && !fromGesture)) return;
    if (location.protocol === "file:") { sync(); return; }
    ctx = Sound.context();
    if (!ctx) { report(new Error("This browser has no Web Audio support")); return; }
    gesturePending = true;
    Promise.resolve(ctx.resume()).then(function() {
      gesturePending = false; unlocked = ctx.state === "running";
      if (!unlocked) { report(new Error("Audio did not start; tap Enable audio again")); return; }
      lastError = "";
      if (!controller) {
        var loader = createAudioLoader(ctx, AUDIO_CATALOG);
        controller = createAmbientController(driver(loader), AUDIO_SCENES);
        accents = createAccentController(accentDriver(loader), AUDIO_CATALOG, AUDIO_SCENES);
      }
      sync(); controller.retry();
    }, function(e) { gesturePending = false; report(e); });
  }
  /* audit F5 — `offs` collected unsubscribe handles nothing ever called, so pagehide disposed the
     controller and left both voice subscriptions live: every later TTS/STT edge ran sync() against
     a disposed controller. Subscription now shares the controller's lifecycle exactly — dropped on
     dispose, restored on pageshow (a bfcache restore must not deafen ambience for the rest of the
     page's life). Ambience only ever LISTENS here; it must never call TTS.stop(). */
  function subscribe() {
    if (offs.length) return;
    offs.push(TTS.on("state", sync));
    offs.push(STT.on("capture", function(value) { capturing = value; sync(); }));
  }
  function unsubscribe() {
    while (offs.length) {
      var off = offs.pop();
      if (typeof off !== "function") continue;
      try { off(); } catch (e) { console.warn("[ambience] unsubscribe failed: " + e.message); }
    }
  }
  function dispose() {
    unsubscribe();
    capturing = false;
    if (controller) controller.dispose();
    if (accents) accents.dispose();
    controller = null; accents = null; unlocked = false;
  }
  function init() {
    if (initialized) return; initialized = true;
    enabled = saved("tnd_ambient_enabled_v1", "1") === "1"; /* owner ruling 2026-09-15: village ambience is ON by default (the checkbox still turns it off, per device) */
    volume = Math.max(0, Math.min(1, Number(saved("tnd_ambient_volume_v1", "0.45")) || 0));
    subscribe();
    /* The #410 player-intent seam. hideCarMode fires a resume here on exit (audit F1), so leaving
       the overlay after a spoken "pause" can no longer wedge the bed OFF until a page reload. */
    document.addEventListener("tnd:car-intent", function(e) {
      if (!e.detail || (e.detail.kind !== "pause" && e.detail.kind !== "resume")) return;
      held = e.detail.kind === "pause"; sync();
    });
    document.addEventListener("tnd:scene-committed", sync);
    /* B39: the earcon context (Sound) is the one ambience plays on. When its resume() is REFUSED (an iOS interruption
       after which resume() rejects forever), Sound dooms it and rebuilds on the next call — but this shell's
       controller closed over the OLD context and `unlocked` stayed latched, so no gesture ever resumed the new one.
       Re-arm: drop the controller, clear the latch; the next tap runs unlock(true) on the rebuilt context. */
    window.addEventListener("tnd:audio-refused", function() {
      if (controller) { try { controller.dispose(); } catch (e) {} }
      if (accents) { try { accents.dispose(); } catch (e) {} } accents = null;
      controller = null; unlocked = false; ctx = null;
      status = "Audio device refused — tap anywhere to restart ambience"; paint();
      console.warn("[ambience] the audio device refused to start; ambience re-armed for the next tap (B39)");
    });
    if(typeof navigator!=="undefined"&&navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",function(e){
      if(e.data&&e.data.type==="tnd:audio-cache-error"&&lastCacheError!==e.data.reason){lastCacheError=e.data.reason;console.warn("[audio cache] "+lastCacheError);if(typeof showToast==="function")showToast("Audio cache unavailable: "+lastCacheError,6000);}
    });
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", dispose);
    window.addEventListener("pageshow", function() { subscribe(); sync(); if (enabled && !unlocked) unlock(); });
    document.addEventListener("pointerdown", function() { if (enabled && !unlocked) unlock(true); }, true);
    document.addEventListener("keydown", function() { if (enabled && !unlocked) unlock(true); }, true);
    eachMenuEl("ambient-cb", function(el) { el.addEventListener("change", function() { enabled = el.checked; lastError = ""; save(); sync(); if (enabled) unlock(true); }); });
    eachMenuEl("ambient-volume", function(el) { el.addEventListener("input", function() { volume = Number(el.value) / 100; save(); sync(); }); });
    eachMenuEl("ambient-unlock", function(el) { el.addEventListener("click", function() { held = false; unlock(true); }); });
    if(!audioPublishedScene)audioScenePublish("load");
    sync(); if (enabled) unlock();
  }
  return { init: init, sync: sync, snapshot: snapshot, dispose: dispose,
    inspect: function() { return Object.assign(controller ? controller.inspect() : { sources: 0, buffers: 0, pending: 0 }, { accents: accents ? accents.inspect() : null }); } };
})();
window.addEventListener("load", function() { Ambient.init(); });
