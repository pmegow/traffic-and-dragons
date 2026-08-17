// sabotage-presence.js — prove the #194 presence-split guards actually guard.
// Each case breaks one ruled clause of the presence panel's design (layers 0-5); the suite must
// go red on every one, attributed to that clause's own test, and every mutation must change real
// bytes (a no-op mutation is a HARD FAILURE — house rule 2026-07-29). Run against a SCRATCH COPY
// of the repo, never the working tree (user instruction 2026-08-17); the harness restores files
// byte-identically either way.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the [NPC:] handler re-wired to the presence writer — mention teleports again (fixed point 1 broken)",
      mustFail: "mention REGISTERS (display association + lastMentioned) but records NO presence",
      find: "if(!_npWasDead)npcRegisterMention(npName);",
      replace: "if(!_npWasDead)npcRecordPresence(npName,\"arrive\");" },
    { label: "the derivation seam call removed — presence is never derived, the recall floor is gone (layer 1)",
      mustFail: "committed [SAY:] from a rostered living speaker derives presence",
      find: "  if(typeof derivePresenceFromResponse===\"function\")derivePresenceFromResponse(text,R);",
      replace: "" },
    { label: "NPC_DEATH_REPORTED stops stamping the dead flag — the honest exit silently writes nothing (ruling ②)",
      mustFail: "[NPC_DEATH_REPORTED:] commits an off-screen death",
      find: "    rdN.dead=R.turn;if(!npcDeadStatus(rdN.status))rdN.status=\"dead\";rdN.statusTurn=R.turn;",
      replace: "    if(!npcDeadStatus(rdN.status))rdN.status=\"dead\";rdN.statusTurn=R.turn;" }
  ]
});

rc |= sabotage.prove({
  file: "identity.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "post-epoch statusTurn limb restored — the mention channel authorizes deaths again (layer 2's core regrade undone)",
      mustFail: "post-epoch statusTurn authorizes NOTHING",
      find: "  if(n&&n.statusTurn>0&&Number(n.statusTurn)<lim&&Number(n.statusTurn)<epoch){",
      replace: "  if(n&&n.statusTurn>0&&Number(n.statusTurn)<lim){" },
    { label: "strictly-earlier dropped from the speech limb — speech AT the claim turn becomes its own authorization",
      mustFail: "not strictly earlier than the claim",
      find: "for(j=0;j<ts.length;j++){var t=ts[j];if(t<lim&&t>=lim-SPEECH_EVIDENCE_TURNS){count++;if(best==null||t>best)best=t;}}",
      replace: "for(j=0;j<ts.length;j++){var t=ts[j];if(t<=lim&&t>=lim-SPEECH_EVIDENCE_TURNS){count++;if(best==null||t>best)best=t;}}" },
    { label: "observed[] eviction replaced with the W2 overflow latch — a busy tavern freezes every irreversible identity write",
      mustFail: "can NEVER arm the W2 overflow latch",
      find: "    if(f.observed.length>=PRESENCE_OBSERVED_CAP){/* LRU evict — NEVER the overflow latch */\n      var old=0;for(i=1;i<f.observed.length;i++)if(f.observed[i].lastTurn<f.observed[old].lastTurn)old=i;\n      f.observed.splice(old,1);\n    }",
      replace: "    if(f.observed.length>=PRESENCE_OBSERVED_CAP){_sceneRefOverflow(\"observed\");return false;}" },
    { label: "cast exclusion dropped from the observed limb — a rubber-stamped cast line becomes death authority before the playtest (ruling ④)",
      mustFail: "cast-sourced presence is playtest-gated",
      find: "      if(o.channel===\"cast\")continue;",
      replace: "" },
    { label: "the valve never arms — a refused named death quarantines forever again (the t1903 loop restored)",
      mustFail: "refused named death arms the valve",
      find: "if(!_bdOv)_w2ArmDeathValve(nm);/* #194 L3 */",
      replace: "" },
    { label: "legacy passes stop receipting their grade — ruling ③'s later-reversal evidence silently vanishes",
      mustFail: "carries evidenceGrade on its receipt",
      find: "else if(_w2EvidenceGrade===\"legacy\")meta.evidenceGrade=\"legacy\";",
      replace: "else if(false)meta.evidenceGrade=\"legacy\";" }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "guestbook stamps lose their source — provenance dies and the cast gate has nothing to read",
      mustFail: "npcRecordPresence is the ONE presence writer",
      find: "  if(src){if(!rec.by)rec.by={};rec.by[turn]=String(src);}",
      replace: "" },
    { label: "the cap fold keeps folded turns' sources — rec.by grows without bound (monotonic-resources rule)",
      mustFail: "the cap fold drops a folded turn's source",
      find: "    if(rec.by)delete rec.by[old];",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the epoch migration removed — legacy grading has no anchor and every mention-fed stamp grades witnessed",
      mustFail: "migrateWorldState stamps presenceEpoch ONCE",
      find: "  if(typeof worldState.presenceEpoch!==\"number\"){\n    worldState.presenceEpoch=(typeof worldState.turn===\"number\")?worldState.turn:0;\n    worldState.presenceVer=1;_mig=true;",
      replace: "  if(false){" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the fork note stops naming the reported-death exit — the valve teaches a ceremony that cannot terminate",
      mustFail: "the fork note teaches [SAY:] and [NPC_DEATH_REPORTED:]",
      find: "emit [NPC_DEATH_REPORTED:\"+q.name+\"|how the party learned of it]",
      replace: "emit a corrected narration for \"+q.name+\"" }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "legacy-grade receipts vanish from drift health — the fail-open window becomes invisible (ruling ③'s visibility half)",
      mustFail: "legacy-grade committed receipts surface in the drift-health",
      find: "  if(legacyN)anom.push(legacyN+\" death authorization\"",
      replace: "  if(false)anom.push(legacyN+\" death authorization\"" }
  ]
});

process.exit(rc ? 1 : 0);
