// sabotage-guestbook.js — prove the #173 guestbook contract clauses actually guard.
// Each case breaks one ratified clause (the seven pinned amendments) or a wiring seam; the
// suite must go red on every one, attributed to the clause's own test, and every mutation must
// change real bytes (a no-op mutation is a HARD FAILURE — house rule 2026-07-29).
//
// HONEST LIMIT: the startGame → guestbookSeedStart() wiring is NOT proven here — startGame is
// DOM-bound and the suite exercises the seeder function directly, so deleting the one-line call
// would not turn the suite red. The seeder itself and every other writer/repair/projection seam
// are proven below.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "split-exclusion removed from the party snapshot — split members stamped at the camera node",
      mustFail: "same-response split member is excluded",
      find: "    if(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location)continue;/* #137: membership ≠ presence */\n",
      replace: "" },
    { label: "defer seam removed — arrivals stamp MID-parse, before same-response splits settle (amendment ③)",
      mustFail: "same-response split member is excluded",
      find: "  if(_gbDeferArrivals){_gbPendingArrivals.push({key:nodeKey,turn:turn});return;}\n",
      replace: "" },
    { label: "same-turn dedupe removed — one arrival books twice",
      mustFail: "same-turn stamps dedupe",
      find: "  if(rec.turns.indexOf(turn)>=0)return false;      /* same-turn dedupe */\n",
      replace: "" },
    { label: "cap fold gutted — turns grow without bound, no aggregate (amendment ①)",
      mustFail: "per-character cap folds oldest turns",
      find: "  while(rec.turns.length>GB_TURN_CAP){",
      replace: "  while(false){" },
    { label: "mapNpcLocation split guard removed — a split member's remote [NPC:] mention becomes false attendance",
      mustFail: "SPLIT party member's remote mention is NOT stamped",
      find: "  var _gbWs=(typeof wsNpcByName===\"function\")?wsNpcByName(name):null;\n  if(!(_gbWs&&_gbWs.partyMember&&_gbWs.charSheet&&_gbWs.charSheet.splitLoc&&_gbWs.charSheet.splitLoc.location))\n    guestbookStamp(key,name,(typeof worldState.turn===\"number\")?worldState.turn:0);",
      replace: "  guestbookStamp(key,name,(typeof worldState.turn===\"number\")?worldState.turn:0);" },
    { label: "residency fabricates a visit turn — the rejected turn-sentinel encoding sneaks back",
      mustFail: "NO fabricated visit turn",
      find: "  if(on){guestbookRecordEnsure(node,name).resident=true;return true;}",
      replace: "  if(on){var _r=guestbookRecordEnsure(node,name);_r.resident=true;_r.turns.push((worldState&&worldState.turn)||0);return true;}" },
    { label: "guestbookRekeyName gutted — NPC merge orphans dup-keyed records (amendment ④)",
      mustFail: "NPC_MERGE re-keys guestbook",
      find: "  if(!memory||!memory.map||!memory.map.nodes||canonical===duplicate)return 0;",
      replace: "  if(1)return 0;" },
    { label: "fold drops the resident OR — a proprietor flag dies in a merge (amendment ④)",
      mustFail: "locMerge folds guestbooks",
      find: "  dst.resident=!!(dst.resident||(src&&src.resident));",
      replace: "  dst.resident=!!dst.resident;" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "post-handler commit removed — queued arrivals never stamp (amendment ③'s seam)",
      mustFail: "arrival snapshot",
      find: "  if(typeof guestbookCommitArrivals===\"function\")guestbookCommitArrivals();",
      replace: "" },
    { label: "PARTY_SPLIT own-arrival stamp removed — the split member's journey goes unrecorded",
      mustFail: "split member's own arrival",
      find: "  if(typeof guestbookStamp===\"function\"){\n    guestbookStamp(psArg,psName,R.turn);\n    if(psSub){var _gbSk=psArg+\"|\"+psSub;if(memory.map.nodes[typeof locResolve===\"function\"?locResolve(_gbSk):_gbSk])guestbookStamp(_gbSk,psName,R.turn);}\n  }",
      replace: "" },
    { label: "LOCATION_RESIDENT handler no-ops — the residency vocabulary exists with no teeth",
      mustFail: "[LOCATION_RESIDENT:] marks resident-only",
      find: "  if(typeof guestbookSetResident===\"function\"&&guestbookSetResident(lrKey,lrName,lrOn))R.muts.push(",
      replace: "  if(false)R.muts.push(" }
  ]
});

rc |= sabotage.prove({
  file: "identity.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "locMerge guestbook fold removed — the duplicate's provenance dies with its node (brief B's finding restored)",
      mustFail: "locMerge folds guestbooks",
      find: "  if(dupNode.guestbook&&typeof guestbookFoldBooks===\"function\")guestbookFoldBooks(canonNode,dupNode);",
      replace: "" },
    { label: "locSplit explicit allocation removed — take.guestbook silently ignored (amendment ④)",
      mustFail: "locSplit allocates guestbook",
      find: "    for(j=0;j<(take.guestbook||[]).length;j++){var gk=take.guestbook[j];if(gbook[gk]&&!claimedG[gk]){fresh.guestbook=fresh.guestbook||{};fresh.guestbook[gk]=gbook[gk];claimedG[gk]=1;}}",
      replace: "" },
    { label: "locSplit primary fallback removed — unclaimed records vanish instead of staying with the primary",
      mustFail: "locSplit allocates guestbook",
      find: "  for(i=0;i<gbNames.length;i++){if(!claimedG[gbNames[i]]){prim.guestbook=prim.guestbook||{};prim.guestbook[gbNames[i]]=gbook[gbNames[i]];}}",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "heal keeps malformed records — junk survives import silently",
      mustFail: "healMemory: malformed guestbook",
      find: "        if(!_gbR||typeof _gbR!==\"object\"){console.warn(\"[guestbook] heal: malformed record for '\"+_gbNm+\"' at \"+_gbk[_gbi]+\" dropped\");delete _gbn.guestbook[_gbNm];continue;}",
      replace: "        if(!_gbR||typeof _gbR!==\"object\"){continue;}" },
    { label: "heal cap enforcement removed — an over-cap import stays over-cap forever",
      mustFail: "healMemory: malformed guestbook",
      find: "        if(typeof _gbCapFold===\"function\")_gbCapFold(_gbR);",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "record-based negative removed — unrecorded silently reads as never-visited (amendment ②)",
      mustFail: "GEO projection: attendance reads as MEMORY",
      find: "Anyone unlisted simply has NO recorded visit here: treat their history with this place as UNKNOWN - never assert they were, or were never, here before.",
      replace: "" },
    { label: "same-turn eyewitness clause removed — the t1728 collectivization fix retired",
      mustFail: "shared eyewitness clause",
      find: "Only characters recorded at the SAME turn shared that visit - anyone else knows of it second-hand at best, and must not speak as an eyewitness. ",
      replace: "" }
  ]
});

process.exit(rc ? 1 : 0);
