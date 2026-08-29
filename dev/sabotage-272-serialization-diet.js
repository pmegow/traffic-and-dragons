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
      replace: "  syncUI();saveAll();" },

    { label: "the envelope clone reverts to the full JSON round-trip — the tripwire itself catches it (every envelope's transcript is now a foreign array) (#272 D4)",
      mustFail: "transaction touched the story transcript",
      find: "    worldState=_w2CopyWorldStateDetached(_w2Ws);memory=_w2Copy(_w2Mem);",
      replace: "    worldState=_w2Copy(_w2Ws);memory=_w2Copy(_w2Mem);" },

    { label: "the transcript append tripwire is disarmed — a rogue handler write commits silently (#272 D4)",
      mustFail: "the rogue append did not fail the envelope",
      find: "    if(_w2TrShared&&(worldState.transcript!==_w2TrShared||_w2TrShared.length!==_w2TrLen)){",
      replace: "    if(false){" },

    { label: "the tripwire stops truncating — the rogue entry stays on the one true array (#272 D4)",
      mustFail: "the shared array kept the rogue entry",
      find: "      if(_w2TrShared.length!==_w2TrLen)_w2TrShared.length=_w2TrLen;",
      replace: "" },

    { label: "the detached PC portrait is not reattached — a commit silently drops the image (#272 D4)",
      mustFail: "the PC portrait did not survive the detached commit",
      find: "  if(pcP)clone.character.portrait=pcP;",
      replace: "  if(false)clone.character.portrait=pcP;" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: CMD,
  cases: [
    { label: "the pre-image portrait strip is dropped — image bytes embed in the archive forever again (#272 D5)",
      mustFail: "portrait bytes still embedded in the archive",
      find: "  if(typeof c.portrait===\"string\"&&c.portrait.length>256)c.portrait={portraitOmitted:true,bytes:c.portrait.length};",
      replace: "" },

    { label: "the f44b hoist reverts — a worldState-only duplicate folds with no pre-image (#272 D5)",
      mustFail: "a ws-only duplicate folded with NO pre-image",
      find: "var _imWs=wsNpcByName(mgDupe);if(memory.npcs[mgDupe]||_imWs){",
      replace: "var _imWs=wsNpcByName(mgDupe);if(memory.npcs[mgDupe]){" }
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
  file: "state.js",
  command: CMD,
  cases: [
    { label: "chunking is disabled — every save pays the whole-transcript LZ pass again (#272 D2)",
      mustFail: "the disk boundary still ships the whole-transcript form",
      find: "  if(!(ws&&ws.transcript&&ws.transcript.length>=TRANSCRIPT_SEG&&_trSegMemo&&typeof LZ!==\"undefined\"&&LZ.compressToUTF16))return compressWorldStateSnapshot(ws);",
      replace: "  if(true)return compressWorldStateSnapshot(ws);" },

    { label: "the segment cache is never consulted — the frozen past recompresses every save (#272 D2)",
      mustFail: "an unchanged save recompressed something",
      find: "    if(cache.blobs[i]==null){",
      replace: "    if(true){" },

    { label: "the tail memo dies — every save recompresses the tail even unchanged (#272 D2)",
      mustFail: "an unchanged save recompressed something",
      find: "  if(cache.tail&&cache.tail.len===len&&cache.tail.lastRef===last&&cache.tail.lastX===last.x){tailLz=cache.tail.lz;}",
      replace: "  if(false){tailLz=cache.tail.lz;}" },

    { label: "old-entry invalidation ignores the index — a stale frozen segment persists the pre-mutation bytes (the entry-4 ★ class) (#272 D2)",
      mustFail: "segment 0 was NOT rebuilt",
      find: "        if(i<c.blobs.length*TRANSCRIPT_SEG)c.blobs[Math.floor(i/TRANSCRIPT_SEG)]=null;\n        else c.tail=null;",
      replace: "        c.tail=null;" },

    { label: "mutateTranscriptEntry stops passing the index — every old-entry edit rebuilds the whole frozen past (#272 D2)",
      mustFail: "segment-precise invalidation failed",
      find: "serializeWorldState.invalidateTranscriptMemo(tr,i);/* #272 D2: the index makes the invalidation segment-precise */",
      replace: "serializeWorldState.invalidateTranscriptMemo(tr);" },

    { label: "a broken segment inflates PARTIALLY — a story with a silent hole instead of a loud rescue (#272 D2)",
      mustFail: "a broken segment inflated PARTIALLY",
      find: "      for(i=0;i<c.segs.length;i++){arr=_lzToArray(c.segs[i]);if(!arr)return null;parts=parts.concat(arr);}",
      replace: "      for(i=0;i<c.segs.length;i++){arr=_lzToArray(c.segs[i]);if(!arr)continue;parts=parts.concat(arr);}" }
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
