// Pure policy plus an injected playback driver: no story parsing or state writes.
var AMBIENT_FADE_SECONDS = 3;
// Duck depth under narration. Shipped at 0.316 (−10 dB); owner field report 2026-09-15: the bed came back so much
// louder after each narration that the contrast was stark. Now 0.5 (−6 dB); the RELEASE is also slowed in the
// driver (ui-ambient.js) so the bed swells back instead of snapping. The duck-in stays fast — narration is never masked.
var AMBIENT_DUCK = 0.5;
function ambientGain(snapshot, scene) {
  var s = snapshot || {};
  return s.capturing ? 0 : scene.bed.gain * Math.max(0, Math.min(1, Number(s.volume) || 0)) * (s.speaking ? AMBIENT_DUCK : 1);
}
function ambientExteriorNode(kind, worldKey, nodeKey, nodes, resolve, registry) {
  var commons = registry[kind];
  if (!commons || !worldKey || !nodeKey || !nodes) return false;
  var world = resolve(worldKey), key = resolve(nodeKey), node = nodes[key];
  if (!node) return false;
  if (key === world) return !node.parent;
  if (!node.parent || resolve(node.parent) !== world) return false;
  for (var i = 0; i < commons.length; i++) {
    if (resolve(worldKey + "|" + commons[i]) === key) return true;
  }
  return false;
}
function ambientSceneMatches(s, scene) {
  var bind = scene.bind;
  if (bind.kind !== s.campaignKind || !s.nodeKey) return false;
  if (!bind.exterior) return s.open === true && bind.common === s.common;
  var m = s.minuteOfDay;
  if (s.exterior !== true || typeof m !== "number" || !isFinite(m) || m < 0 || m >= 1440) return false;
  return bind.from < bind.to ? m >= bind.from && m < bind.to : m >= bind.from || m < bind.to;
}
function ambientPlan(snapshot, registry) {
  var s = snapshot || {}, silent = { scene: null, key: "", gain: 0, hardStop: false }, i, scene;
  if (!s.enabled || !s.unlocked || !s.visible || s.held || s.paused || (s.hidden && !s.speaking)) { silent.hardStop = true; return silent; }
  for (i = 0; i < registry.length; i++) {
    scene = registry[i];
    if (ambientSceneMatches(s, scene)) {
      return { scene: scene, key: String(s.campaignId) + "|" + s.nodeKey + "|" + scene.id, gain: ambientGain(s, scene), hardStop: false };
    }
  }
  return silent;
}

function createAmbientController(driver, registry) {
  var desired = { scene: null, key: "", gain: 0 }, snapshot = {}, source = null, outgoing = null;
  var key = "", pending = null, epoch = 0, failedKey = "", disposed = false, campaignId;
  function cancelRetirement(record) { if (record && record.timer) { driver.cancel(record.timer); record.timer = null; } }
  function stop(record) { if (record) { cancelRetirement(record); driver.stop(record.voice); } }
  function stopAll() { stop(source); stop(outgoing); source = null; outgoing = null; }
  function invalidate() { epoch++; if (pending) { pending.cancelled = true; pending.abort.abort(); } }
  function levels() {
    if (source) driver.gain(source.voice, ambientGain(snapshot, source.scene));
    if (outgoing) driver.gain(outgoing.voice, ambientGain(snapshot, outgoing.scene));
  }
  function retire(record) {
    if (!record) return;
    stop(outgoing); outgoing = record;
    driver.fade(record.voice, 0, AMBIENT_FADE_SECONDS);
    record.timer = driver.later(function() {
      record.timer = null;
      if (outgoing === record) { outgoing = null; driver.stop(record.voice); }
    }, AMBIENT_FADE_SECONDS * 1000);
  }
  function apply() {
    if (disposed) return;
    if (key !== desired.key) {
      invalidate(); key = desired.key; failedKey = "";
      if (outgoing && outgoing.key === key) {
        var returning = outgoing; outgoing = null; cancelRetirement(returning);
        retire(source); source = returning; driver.fade(source.voice, 1, AMBIENT_FADE_SECONDS);
      } else if (source) { var previous = source; source = null; retire(previous); }
    }
    levels();
    if (!desired.scene || source || pending || failedKey === key) return;
    var job = { epoch: epoch, key: key, scene: desired.scene, abort: driver.abort(), cancelled: false };
    pending = job;
    Promise.resolve().then(function() { return driver.load(job.scene, job.abort.signal); }).then(function(decoded) {
      pending = null;
      if (!disposed && !job.cancelled && job.epoch === epoch) {
        try {
          var voice = driver.start(decoded, job.scene, ambientGain(snapshot, job.scene));
          source = { voice: voice, scene: job.scene, key: job.key, timer: null };
          driver.fade(voice, 1, AMBIENT_FADE_SECONDS);
        } catch (e) { failedKey = key; stop(source); source = null; driver.error(e); }
      }
      apply();
    }, function(e) {
      pending = null;
      if (!disposed && !job.cancelled && job.epoch === epoch) { failedKey = key; driver.error(e); }
      apply();
    });
  }
  return {
    update: function(s) {
      snapshot = s || {}; desired = ambientPlan(snapshot, registry);
      if (desired.hardStop || (campaignId !== undefined && campaignId !== snapshot.campaignId)) {
        invalidate(); stopAll(); key = ""; failedKey = "";
      }
      campaignId = snapshot.campaignId; apply();
    },
    retry: function() { failedKey = ""; apply(); },
    dispose: function() { disposed = true; invalidate(); stopAll(); },
    inspect: function() { var count = (source ? 1 : 0) + (outgoing ? 1 : 0); return { key: key, sources: count, buffers: count, pending: pending ? 1 : 0, failed: !!failedKey, transitioning: !!outgoing }; }
  };
}

function ambientValidateBuffer(buffer, bed) {
  if (!buffer || buffer.numberOfChannels !== bed.channels || buffer.duration > bed.maxSeconds ||
      buffer.length * buffer.numberOfChannels * 4 > bed.maxDecodedBytes ||
      !(bed.loopStart >= 0 && bed.loopEnd > bed.loopStart && bed.loopEnd <= buffer.duration)) {
    throw new Error("Ambience asset exceeds its channel, duration, memory or loop-boundary limit");
  }
  return buffer;
}
