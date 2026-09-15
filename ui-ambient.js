// Device preferences and the committed scene are read at UI/voice boundaries, never polled.
var Ambient = (function() {
  var enabled = false, volume = 0.45, unlocked = false, held = false, capturing = false;
  var ctx = null, controller = null, initialized = false, lastError = "", status = "Off";
  var offs = [], gesturePending = false;
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
    var nodeKey = typeof currentNodeKey === "function" ? locResolve(currentNodeKey()) : null;
    var node = nodeKey && typeof memory !== "undefined" && memory && memory.map && memory.map.nodes[nodeKey];
    var kind = typeof campaignKind === "function" ? campaignKind() : "";
    var common = null, w = typeof worldState !== "undefined" && worldState && worldState.world;
    if (kind === "village" && w && node) {
      AUDIO_SCENES.forEach(function(scene) {
        if (!scene.bind.exterior && scene.bind.kind === kind && locResolve(w.location + "|" + scene.bind.common) === nodeKey) common = scene.bind.common;
      });
    }
    var hours = node && node.hours, open = null;
    if (hours && typeof hours.open === "number" && typeof hours.close === "number" &&
        hours.open >= 0 && hours.open <= 24 && hours.close >= 0 && hours.close <= 24) {
      var hr = clockMinuteOfDay() / 60;
      open = hours.open <= hours.close ? hr >= hours.open && hr < hours.close : hr >= hours.open || hr < hours.close;
    }
    var screen = document.getElementById("game-screen");
    return { enabled: enabled, volume: volume, unlocked: unlocked, held: held, capturing: capturing,
      visible: !!screen && screen.style.display === "flex", hidden: document.hidden,
      campaignKind: kind, campaignId: typeof getActiveCampId === "function" ? getActiveCampId() : "",
      nodeKey: nodeKey, common: common, open: open,
      exterior: !!(w && ambientExteriorNode(kind, w.location, nodeKey, memory && memory.map && memory.map.nodes, locResolve, AUDIO_EXTERIORS)), minuteOfDay: clockMinuteOfDay(),
      speaking: typeof TTS !== "undefined" && TTS.isPlaying(), paused: typeof TTS !== "undefined" && TTS.isPaused() };
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
    if (!enabled) status = "Off";
    else if (location.protocol === "file:") { report(new Error("Open the hosted game or localhost to use ambience")); return; }
    else if (!unlocked) status = "Tap anywhere to start ambience";
    else if (held || s.paused) status = "Paused";
    else if (!p.scene) status = s.common && s.open === null ? "Smithy hours are not recorded" : "No ambience for this location";
    else if (capturing) status = "Quiet for microphone";
    else if (!lastError) status = (p.scene.label || p.scene.id) + (s.speaking ? " · quiet under narration" : "") + (controller && controller.inspect().pending ? " · loading" : "");
    paint();
  }
  function driver() {
    return {
      abort: function() { return new AbortController(); },
      error: report,
      load: function(scene, signal) {
        if (!scene || signal.aborted) return Promise.reject(new Error("Scene cancelled"));
        var abort = new AbortController(), timer = null;
        function cancel() { abort.abort(); }
        signal.addEventListener("abort", cancel);
        timer = setTimeout(cancel, 15000);
        return fetch(scene.bed.url, { signal: abort.signal }).then(function(r) {
          if (!r.ok) throw new Error("Ambience download failed (HTTP " + r.status + ")");
          if (Number(r.headers.get("Content-Length")) > scene.bed.maxBytes) throw new Error("Ambience download exceeds its size limit");
          return r.arrayBuffer();
        }).then(function(bytes) {
          if (bytes.byteLength > scene.bed.maxBytes) throw new Error("Ambience download exceeds its size limit");
          if (signal.aborted) throw new Error("Scene cancelled");
          return new Promise(function(resolve, reject) { ctx.decodeAudioData(bytes, resolve, reject); });
        }).then(function(buffer) {
          clearTimeout(timer); signal.removeEventListener("abort", cancel);
          return ambientValidateBuffer(buffer, scene.bed);
        }, function(e) {
          clearTimeout(timer); signal.removeEventListener("abort", cancel);
          throw new Error(e.name === "AbortError" ? "Ambience download cancelled or timed out; use Enable audio to retry" : e.message || "Ambience decoding failed");
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
        else param.setTargetAtTime(value, ctx.currentTime, 0.08);
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
      stop: function(voice) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); voice.envelope.disconnect(); voice.source.buffer = null; }
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
      if (!controller) controller = createAmbientController(driver(), AUDIO_SCENES);
      sync(); controller.retry();
    }, function(e) { gesturePending = false; report(e); });
  }
  function init() {
    if (initialized) return; initialized = true;
    enabled = saved("tnd_ambient_enabled_v1", "0") === "1";
    volume = Math.max(0, Math.min(1, Number(saved("tnd_ambient_volume_v1", "0.45")) || 0));
    offs.push(TTS.on("state", sync));
    offs.push(STT.on("capture", function(value) { capturing = value; sync(); }));
    document.addEventListener("tnd:car-intent", function(e) {
      if (!e.detail || (e.detail.kind !== "pause" && e.detail.kind !== "resume")) return;
      held = e.detail.kind === "pause"; sync();
    });
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", function() { if (controller) controller.dispose(); controller = null; unlocked = false; });
    window.addEventListener("pageshow", function() { sync(); if (enabled && !unlocked) unlock(); });
    document.addEventListener("pointerdown", function() { if (enabled && !unlocked) unlock(true); }, true);
    document.addEventListener("keydown", function() { if (enabled && !unlocked) unlock(true); }, true);
    eachMenuEl("ambient-cb", function(el) { el.addEventListener("change", function() { enabled = el.checked; lastError = ""; save(); sync(); if (enabled) unlock(true); }); });
    eachMenuEl("ambient-volume", function(el) { el.addEventListener("input", function() { volume = Number(el.value) / 100; save(); sync(); }); });
    eachMenuEl("ambient-unlock", function(el) { el.addEventListener("click", function() { held = false; unlock(true); }); });
    sync(); if (enabled) unlock();
  }
  return { init: init, sync: sync, snapshot: snapshot, inspect: function() { return controller ? controller.inspect() : { sources: 0, buffers: 0, pending: 0 }; } };
})();
window.addEventListener("load", function() { Ambient.init(); });
