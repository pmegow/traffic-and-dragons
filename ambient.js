// Pure policy plus an injected playback driver: no story parsing or state writes.
function ambientPlan(snapshot, registry) {
  var s = snapshot || {}, silent = { scene: null, key: "", gain: 0 }, i, scene;
  if (!s.enabled || !s.unlocked || !s.visible || s.held || s.paused || (s.hidden && !s.speaking)) return silent;
  if (s.open !== true) return silent;
  for (i = 0; i < registry.length; i++) {
    scene = registry[i];
    if (scene.bind.kind === s.campaignKind && scene.bind.common === s.common && s.nodeKey) {
      return { scene: scene, key: String(s.campaignId) + "|" + s.nodeKey + "|" + scene.id,
        gain: s.capturing ? 0 : scene.bed.gain * Math.max(0, Math.min(1, Number(s.volume) || 0)) * (s.speaking ? 0.316 : 1) };
    }
  }
  return silent;
}

function createAmbientController(driver, registry) {
  var desired = { scene: null, key: "", gain: 0 }, source = null, buffer = null;
  var key = "", pending = null, epoch = 0, failedKey = "", disposed = false;
  function stop() { if (source) { driver.stop(source); source = null; } buffer = null; }
  function apply() {
    if (disposed) return;
    if (key !== desired.key) {
      epoch++; key = desired.key; failedKey = ""; stop();
      if (pending) { pending.cancelled = true; pending.abort.abort(); }
    }
    if (!desired.scene) return;
    if (source) { driver.gain(source, desired.gain); return; }
    if (pending || failedKey === key) return;
    if (buffer) {
      try { source = driver.start(buffer, desired.scene, desired.gain); }
      catch (e) { failedKey = key; stop(); driver.error(e); }
      return;
    }
    var job = { epoch: epoch, scene: desired.scene, abort: driver.abort(), cancelled: false };
    pending = job;
    Promise.resolve().then(function() { return driver.load(job.scene, job.abort.signal); }).then(function(decoded) {
      pending = null;
      if (!disposed && !job.cancelled && job.epoch === epoch) buffer = decoded;
      apply();
    }, function(e) {
      pending = null;
      if (!disposed && !job.cancelled && job.epoch === epoch) { failedKey = key; driver.error(e); }
      apply();
    });
  }
  return {
    update: function(snapshot) { desired = ambientPlan(snapshot, registry); apply(); },
    retry: function() { failedKey = ""; apply(); },
    dispose: function() { disposed = true; epoch++; if (pending) { pending.cancelled = true; pending.abort.abort(); } stop(); },
    inspect: function() { return { key: key, sources: source ? 1 : 0, buffers: buffer ? 1 : 0, pending: pending ? 1 : 0, failed: !!failedKey }; }
  };
}

function ambientValidateBuffer(buffer, bed) {
  if (!buffer || buffer.numberOfChannels !== bed.channels || buffer.duration > bed.maxSeconds ||
      buffer.length * buffer.numberOfChannels * 4 > bed.maxDecodedBytes ||
      !(bed.loopStart >= 0 && bed.loopEnd > bed.loopStart && bed.loopEnd <= buffer.duration)) {
    throw new Error("Fire asset exceeds its channel, duration, memory or loop-boundary limit");
  }
  return buffer;
}
