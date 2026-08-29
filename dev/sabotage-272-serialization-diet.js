// sabotage-272-serialization-diet.js — mutation proof for #272 commit 1 (D1 + D3):
// one save / one LZ pass / one POST per turn, the wire packers, the Phase-A inflaters, and the
// unreadable-form defenses. (D4/D5 clauses land with commit 2; D2 Phase B with commit 3.)
//
// The guards being proven: ① a committed dialogue turn pays exactly ONE saveAll and ONE
// full-transcript LZ pass, with the speaker stamp landing BEFORE the save so the debounced POST
// build is a memo hit; ② the commit save still precedes every display step (UA6, now atomic
// with history); ③ generateActions' save is local-only (R4 — no second full-state POST);
// ④ packWire/unpackWire are byte-exact and length-pinned; ⑤ every shipped transcript form
// inflates, and an UNRECOGNIZED form takes the loud rescue path, never a poison passthrough;
// ⑥ the wire seam's Phase-C flip branch stays live and pre-tested.
//
// Every clause breaks exactly one obligation and names the assertion that must catch it.
//
// Usage: node dev/sabotage-272-serialization-diet.js
var sabotage = require("./sabotage.js");
var rc = 0;
var CMD = ["node", ["dev/run-tests.js"]];

rc |= sabotage.prove({
  file: "api.js",
  command: CMD,
  cases: [
    { label: "applyMuts ignores deferSave — the turn pays a second save/LZ pass again (#272 D1)",
      mustFail: "saveAll calls — the design says exactly ONE",
      find: "  syncUI();if(!(opts&&opts.deferSave))saveAll();",
      replace: "  syncUI();saveAll();" }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: CMD,
  cases: [
    { label: "commitGmTurn stops deferring applyMuts' save (#272 D1)",
      mustFail: "saveAll calls — the design says exactly ONE",
      find: "  applyMuts(resp,{deferSave:true});",
      replace: "  applyMuts(resp);" },

    { label: "the speaker stamp moves back AFTER the commit save — the debounced POST re-compresses the whole transcript (#272 D1)",
      mustFail: "MISSED the memo",
      find: "  var _spMap=_bookkeeping?null:deriveAndStampSpeakers(clean,resp,worldState.transcript[worldState.transcript.length-1],worldState.transcript);\n  saveAll();",
      replace: "  saveAll();\n  var _spMap=_bookkeeping?null:deriveAndStampSpeakers(clean,resp,worldState.transcript[worldState.transcript.length-1],worldState.transcript);" },

    { label: "the commit save disappears — display runs against unpersisted state (UA6) (#272 D1)",
      mustFail: "the turn threw BEFORE any save ran",
      find: "  var _spMap=_bookkeeping?null:deriveAndStampSpeakers(clean,resp,worldState.transcript[worldState.transcript.length-1],worldState.transcript);\n  saveAll();",
      replace: "  var _spMap=_bookkeeping?null:deriveAndStampSpeakers(clean,resp,worldState.transcript[worldState.transcript.length-1],worldState.transcript);" },

    { label: "generateActions re-arms the cloud debounce — the second full-state POST returns (R4) (#272 D1)",
      mustFail: "generateActions no longer saves local-only",
      find: "    worldState.lastActions=acts.slice(0,3);saveLocal();",
      replace: "    worldState.lastActions=acts.slice(0,3);saveAll();" }
  ]
});

rc |= sabotage.prove({
  file: "state.js",
  command: CMD,
  cases: [
    { label: "saveLocal grows the cloud arm back — every 'local' save POSTs (#272 D1)",
      mustFail: "armed the cloud debounce",
      find: "function saveLocal(){saveCore();saveMem();updateCampMeta();}",
      replace: "function saveLocal(){saveCore();saveMem();updateCampMeta();if(typeof storageAdapter!==\"undefined\")storageAdapter.syncToServer();}" },

    { label: "the unknown-form rescue reverts to {__lz}-only — a future form passes through poisoned (#272 D3)",
      mustFail: "unknown form passed through poisoned",
      find: "  if(o&&o.transcript&&!(o.transcript instanceof Array)){",
      replace: "  if(o&&o.transcript&&!(o.transcript instanceof Array)&&o.transcript.__lz){" },

    { label: "the {__lzc} inflater is dropped — Phase B/C blobs become unreadable (#272 D3)",
      mustFail: "{__lzc} did not inflate byte-identically",
      find: "    if(t.__lzc&&typeof t.__lzc===\"object\"){",
      replace: "    if(false){" },

    { label: "the wire seam's flip branch dies — Phase C would silently ship {__lz} forever (#272 D3)",
      mustFail: "the flipped flag did not emit {__lzb64}",
      find: "  if(WIRE_TRANSCRIPT_FORM===\"lzb64\"&&snap.transcript&&typeof snap.transcript.__lz===\"string\"&&typeof LZ!==\"undefined\"&&LZ.packWire){",
      replace: "  if(false){" }
  ]
});

rc |= sabotage.prove({
  file: "compress.js",
  command: CMD,
  cases: [
    { label: "packWire loses its length pin — tail padding can mint a phantom 15-bit unit (#272 D3)",
      mustFail: "unpack did not reproduce the 15-bit stream byte-identically",
      find: "      return String(lz.length)+\":\"+out.join(\"\");",
      replace: "      return String(lz.length+1)+\":\"+out.join(\"\");" },

    { label: "unpackWire's reconstruction drifts by one — corruption instead of a clean null (#272 D3)",
      mustFail: "unpack did not reproduce the 15-bit stream byte-identically",
      find: "        if(nbits>=15){nbits-=15;out.push(f(((acc>>nbits)&32767)+32));acc&=(1<<nbits)-1;}",
      replace: "        if(nbits>=15){nbits-=15;out.push(f(((acc>>nbits)&32767)+31));acc&=(1<<nbits)-1;}" }
  ]
});

rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: CMD,
  cases: [
    { label: "the sync sentinel reverts to counting chars — it under-reports the {__lz} wire ~3x again (#272 D3)",
      mustFail: "the payload sentinel no longer measures real bytes",
      find: "      var _syncPayloadBytes = _payloadBytes(payload);",
      replace: "      var _syncPayloadBytes = payload.length;" }
  ]
});

process.exit(rc ? 1 : 0);
