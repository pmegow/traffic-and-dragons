// sabotage-271-residue-quartet.js — mutation proof for the #271 identity/session residue quartet
// (Fable f57+f34+f48+f23, joint review 2026-08-27).
//
// The guards being proven: ① the locResolve and speech-fact memos die with the object they were
// primed against (content-identity invalidation — a campaign switch/.tnd import/reconcile must
// not serve one campaign's canon inside another); ② the #228 split re-affirm comparator is
// normalized (case/separator/leading-article variants are the SAME name — no re-mint, no phantom
// arrival evidence); ③ the RAG skip window has no +1 (the boundary turn T−P is eligible — no
// one-turn verbatim hole); ④ W2 site A logs the purged QUEST/QUEST_STEP payload verbatim.
//
// Every clause breaks exactly one obligation and names the assertion that must catch it.
//
// Usage: node dev/sabotage-271-residue-quartet.js
var sabotage = require("./sabotage.js");
var rc = 0;
var CMD = ["node", ["dev/run-tests.js"]];

rc |= sabotage.prove({
  file: "identity.js",
  command: CMD,
  cases: [
    { label: "locResolve reverts to gen-only invalidation — a campaign switch serves foreign canon again (#271①)",
      mustFail: "campaign A's merge served inside campaign B",
      find: "  if(_locResMemoGen!==_locResGen||_locResMemoObj!==entries){_locResMemo=Object.create(null);_locResMemoGen=_locResGen;_locResMemoObj=entries;}",
      replace: "  if(_locResMemoGen!==_locResGen){_locResMemo=Object.create(null);_locResMemoGen=_locResGen;}" },

    { label: "the speech-fact memo drops the transcript reference from its key — a turn+length coincidence serves stale evidence to the death gate (#271①)",
      mustFail: "stale speech evidence served across a transcript replacement",
      find: "||_spFactsMemo.tr!==tr){",
      replace: "){" },

    { label: "site A stops logging the purged quest payload — the completion dies without verbatim provenance again (#271④)",
      mustFail: "the purged completion is not on the ring verbatim",
      find: "    _w2RefuseLog(_waQTok);_w2RefuseLog(_waTok);ordinary=_w2StripRewards(ordinary);",
      replace: "    _w2RefuseLog(_waTok);ordinary=_w2StripRewards(ordinary);" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: CMD,
  cases: [
    { label: "the split comparator reverts to raw strings — a case variant re-takes the write path (#271②)",
      mustFail: "re-mint: a case variant destroyed the split record",
      find: "  var psToastWorthy=!psWas||psNameKey(psWas.location)!==psNameKey(psArg)||psNameKey(psWas.sublocation)!==psNameKey(psSub);",
      replace: "  var psToastWorthy=!psWas||psWas.location!==psArg||(psWas.sublocation||null)!==(psSub||null);" },

    { label: "the normalizer loses its leading-article strip — 'The Rusty Dragon' vs 'rusty dragon' re-mints again (#271②)",
      mustFail: "re-mint: a case variant destroyed the split record",
      find: ".trim().replace(/^(?:the|a|an)\\s+/,\"\");};",
      replace: ".trim();};" }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: CMD,
  cases: [
    { label: "the RAG skip window's +1 returns — GM turn T−P is invisible to both verbatim channels again (#271③)",
      mustFail: "the boundary turn stayed invisible",
      find: "  var skipN=Math.max(2,Math.ceil(((typeof sessionLog!==\"undefined\"&&sessionLog)?sessionLog.length:0)/2));",
      replace: "  var skipN=Math.max(2,Math.ceil(((typeof sessionLog!==\"undefined\"&&sessionLog)?sessionLog.length:0)/2)+1);" }
  ]
});

process.exit(rc ? 1 : 0);
