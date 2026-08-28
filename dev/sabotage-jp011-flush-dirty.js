// sabotage-jp011-flush-dirty.js — mutation proof for JP0-11 (Fable f68): the size-bounded
// page-hide flush and the unsynced-turn marker it hands to the next launch.
//
// The defect: the unload / page-hide flush rides fetch(keepalive:true); the Fetch spec caps total
// in-flight keepalive request BODIES at 64 KiB, browsers reject anything larger, and the rejection
// landed in a swallowing .catch. The PC's base64 portrait rides INLINE by design, so a
// portrait-bearing character clears the cap from roughly turn 1 — the documented
// "closing/backgrounding can't drop the final turn" guarantee was silently dead for most saves,
// and the loss surfaced later as a stale server copy a second device could overwrite.
//
// The guard has two halves and both must stay proven: the flush SKIPS the doomed request and marks
// the campaign, and the next load() PUSHES the marked turns BEFORE it will consider adopting any
// server copy — clearing the marker only on a confirmed 2xx of our own payload.
//
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-jp011-flush-dirty.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: ["node", ["dev/run-tests.js"]],
  // The boot-push half is proven by a STANDALONE suite (load() rewrites the live globals, so it
  // cannot share engine-tests.js's fixture) — neither it nor the runner list is a manifest file,
  // so both must ride the working tree into the scratch clone or every boot clause reads MISSED.
  also: ["dev/tests-jp011-flush-dirty.js", "dev/run-standalone-suites.js"],
  cases: [
    { label: "the size gate is gone — the flush attempts the request the browser will reject, and swallows it again",
      mustFail: "doomed keepalive request",
      find: "      if (flushTooBigForKeepalive(payload)) {",
      replace: "      if (false) {" },

    { label: "the gate counts CHARACTERS, not bytes — a multi-byte payload passes as small (the original proxy defect)",
      mustFail: "multi-byte",
      find: "    try { if (typeof TextEncoder !== \"undefined\") return new TextEncoder().encode(s).length; } catch (e) {}",
      replace: "" },

    { label: "the skipped flush marks nothing — the final turns are dropped exactly as before, just quietly",
      mustFail: "unsynced-turn marker",
      find: "        markFlushDirty(campId, turnAt);",
      replace: "" },

    { label: "the skip goes silent again — no console line, the no-silent-failures policy violated",
      mustFail: "LOUD",
      find: "        console.warn(\"[storage] page-hide flush SKIPPED — payload is \" + Math.round(_payloadBytes(payload) / 1024) +",
      replace: "        String(\"[storage] page-hide flush skipped \" + Math.round(_payloadBytes(payload) / 1024) +" },

    { label: "the marker map is unbounded — a device accumulating campaigns grows the key forever",
      mustFail: "BOUNDED",
      find: "    if (!(id in map) && keys.length >= SYNC_DIRTY_CAP) {",
      replace: "    if (false) {" },

    { label: "the read key diverges from the write key — a marked campaign can never be found again",
      mustFail: "unsynced-turn marker",
      find: "    var map = _dirtyRead(), v = map[_dirtyKey(campId)];",
      replace: "    var map = _dirtyRead(), v = map[\"default\"];" },

    { label: "any ack clears the marker, even one for an OLDER turn — the newest turns become unrecoverable",
      mustFail: "turn-500 marker",
      find: "    if (typeof turnAt === \"number\" && turnAt >= t) clearFlushDirty();",
      replace: "    clearFlushDirty();" },

    { label: "the boot push never fires — the reconcile adopts over turns the server never saw (the silent-loss path)",
      mustFail: "PUSHES before the reconcile",
      find: "    if (_dirtyAt == null) { _reconcileFromServer(localOk); return; }",
      replace: "    _reconcileFromServer(localOk); if (_dirtyAt == null) return;" },

    { label: "the push no longer completes on success — the reconcile is stranded and the campaign never syncs again",
      mustFail: "reconcile never ran",
      find: "        _fin(null);",
      replace: "" },

    { label: "the boot push says nothing — the player is never told the last session's turns landed",
      mustFail: "final turns",
      find: "        if (typeof showToast === \"function\") showToast(\"&#9729; Last session's final turns synced now\");",
      replace: "" }
  ]
});

process.exit(rc ? 1 : 0);
