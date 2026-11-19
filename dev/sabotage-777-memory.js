// sabotage-777-memory.js — retained proof for audit 2026-11-19 (TODO #777), section M: the memory tiers.
//   memory.js    M1 the name is not the fact (feNearDup's skip, feNameTokens, feSharedNames) · M2 an applied extraction is
//                not filed again (the marker, the commit-only retry, the trim) · M3 the superseded-fact needle · M4 a
//                deferred scene fact · M5 the failing era compile · M6 map edges compare resolved places
//   helpers.js   M5 the health readout · M7 a companion's queued wants · tag_table.js   M7 said
// Each clause runs ONE named case of dev/tests-777-memory.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-memory.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "M1L": "M1: three distinct lore lines about a place with a two-word name are all kept",
  "M1P": "M1: two distinct facts about a person with a two-word name are both kept",
  "M2A": "M2: when the save fails after an extraction was applied, the retry files nothing twice and asks the model nothing",
  "M2T": "M2: a throw after the extraction was applied and saved does not file the window again",
  "M2K": "M2: every exchange played between a failed save and its retry is kept for the next extraction",
  "M2S": "M2: a marker that does not describe the session log on hand is ignored",
  "M3A": "M3: a superseded-fact needle of a space, or a fragment of a word, retires nothing",
  "M3B": "M3: an exact fact, and a whole phrase of one, are retired as before",
  "M4": "M4: a scene-only fact deferred past the re-ask cap comes back as a scene fact",
  "M5": "M5: an era compile that keeps failing stops being asked for, and is on the health readout",
  "M5C": "M5: a compile that fails after another campaign was opened is not recorded against that campaign",
  "M6": "M6: a pointer that holds an alias of a place records no second edge for the same pair",
  "M7A": "M7: a want that is already active or waiting is not queued again",
  "M7B": "M7: an old save's duplicate of a want that completes is not promoted as the next want"
};

prove("memory.js", [
  { label: "M1: lore facts are matched on the name they share",
    find: "if(feNearDup(fact,memory.lore[i],feSharedNames(fact,memory.lore[i]))){/* M1 */", replace: "if(feNearDup(fact,memory.lore[i])){/* M1 */", mustFail: ONLY + T.M1L },
  { label: "M1: a character's facts are matched on the character's own name",
    find: "if(feNearDup(f,ex,feSharedNames(f,ex,[name].concat(n.aliases||[])))){/* M1 */", replace: "if(feNearDup(f,ex)){/* M1 */", mustFail: ONLY + T.M1P },
  { label: "M1: a character's facts are matched on an alias written in lower case",
    find: "feSharedNames(f,ex,[name].concat(n.aliases||[]))", replace: "feSharedNames(f,ex)", mustFail: ONLY + T.M1P },
  { label: "M1: the first word of a sentence is read as a name",
    find: "    if(first&&!/^\\s+[A-Z]/.test(after))continue;\n", replace: "", mustFail: ONLY + T.M1L },
  { label: "M1: the skip list is ignored by the fingerprint",
    find: "  if(skip){at=at.filter(function(t){return !skip[t];});bt=bt.filter(function(t){return !skip[t];});}\n", replace: "", mustFail: ONLY + T.M1L },
  { label: "M2: the applied extraction leaves no marker",
    find: "    memory.summaryApplied={upTo:sessionLog.length,kept:sessKeptStart(),sig:summarySig(sessionLog[sessionLog.length-1]),turn:worldState.turn};/* M2 */\n", replace: "", mustFail: ONLY + T.M2A },
  { label: "M2: a marked window is extracted again",
    find: "  if(memory.summaryApplied){\n    try{if(_sumCommit(", replace: "  if(false){\n    try{if(_sumCommit(", mustFail: ONLY + T.M2A },
  { label: "M2: the commit trims as if the whole log had been read",
    find: "retainSessionTail(_ap&&typeof _ap.upTo===\"number\"?_ap.upTo:undefined);", replace: "retainSessionTail();", mustFail: ONLY + T.M2A },
  { label: "M2: the marker outlives its commit",
    find: "delete memory.summaryApplied;/* M2 */", replace: "/* M2 */", mustFail: ONLY + T.M2A },
  { label: "M2: the marker's removal is not saved",
    find: "summaryFailureClear();saveCore();if(_ap)saveMem();", replace: "summaryFailureClear();saveCore();", mustFail: ONLY + T.M2A },
  { label: "M2: the trim marks unread exchanges as filed",
    find: "worldState.sessKept=filed-i;", replace: "worldState.sessKept=keep.length;", mustFail: ONLY + T.M2A },
  { label: "M2: exchanges the extraction never read are trimmed away",
    find: "  if(filed<i){i=filed;keep=sessionLog.slice(i);}", replace: "  ", mustFail: ONLY + T.M2K },
  { label: "M2: a throw after the apply is counted as a failed extraction",
    find: "    if(summaryAppliedValid()){console.error(\"[memory] summarize failed after its extraction was applied", replace: "    if(false){console.error(\"[memory] summarize failed after its extraction was applied", mustFail: ONLY + T.M2T },
  { label: "M2: a marker for another session log is honoured",
    find: "  if(memory.summaryApplied&&!summaryAppliedValid()){", replace: "  if(false){", mustFail: ONLY + T.M2S },
  { label: "M2: the marker is not checked against the last message read",
    find: "&&summarySig(sessionLog[m.upTo-1])===m.sig;", replace: ";", mustFail: ONLY + T.M2S },
  { label: "M2: the marker is not checked against where the window began",
    find: "  return m.kept===sessKeptStart()&&", replace: "  return ", mustFail: ONLY + T.M2S },
  { label: "M3: the needle is not trimmed",
    find: "    var oldS=String(sf.old).trim();\n", replace: "    var oldS=String(sf.old);\n", mustFail: ONLY + T.M3B },
  { label: "M3: a needle of any length may match inside a fact",
    find: "    if(sfIdx<0&&oldS.length>=SUPERSEDE_NEEDLE_MIN){var _sfRe=", replace: "    if(sfIdx<0){var _sfRe=", mustFail: ONLY + T.M3A },
  { label: "M3: a needle may end in the middle of a word",
    find: "+\"($|[^A-Za-z0-9])\");for(ki=0", replace: "+\"()\");for(ki=0", mustFail: ONLY + T.M3A },
  { label: "M3: a blank needle matches an authored dossier",
    find: "    if(oldS.length>=SUPERSEDE_NEEDLE_MIN&&authoredSupersede(sfNpc,oldS)){", replace: "    if(authoredSupersede(sfNpc,oldS)){", mustFail: ONLY + T.M3A },
  { label: "M4: the deferred row drops the scene mark",
    find: "if(job.scene)_row.scene=true;", replace: "", mustFail: ONLY + T.M4 },
  { label: "M4: a line read as a scene fact is queued as a plain one",
    find: "scene:(typeof v===\"object\"&&!!v&&String(v.kind||\"\").toLowerCase()===\"scene\"),set:", replace: "set:", mustFail: ONLY + T.M4 },
  { label: "M4: a deferred scene fact comes back as standing knowledge",
    find: "knowledgeGained:dq.scene?{fact:t,kind:\"scene\"}:t});/* M4 */", replace: "knowledgeGained:t});/* M4 */", mustFail: ONLY + T.M4 },
  { label: "M4: a line deferred twice loses its scene mark",
    find: "text:dq.text,scene:!!dq.scene,deferredFrom:dq.turn,", replace: "text:dq.text,deferredFrom:dq.turn,", mustFail: ONLY + T.M4 },
  { label: "M5: a failing compile is billed at every summarize",
    find: "  if(_ef&&_ef.count>=ERA_FAIL_PAUSE&&worldState.turn-(_ef.lastTurn||0)<=ERA_FAIL_COOLDOWN_TURNS)return;\n", replace: "", mustFail: ONLY + T.M5 },
  { label: "M5: a paused compile is never tried again",
    find: "&&worldState.turn-(_ef.lastTurn||0)<=ERA_FAIL_COOLDOWN_TURNS)return;", replace: ")return;", mustFail: ONLY + T.M5 },
  { label: "M5: the failures are not counted",
    find: "worldState.eraFailure={count:_efp+1,lastTurn:", replace: "worldState.eraFailure={count:1,lastTurn:", mustFail: ONLY + T.M5 },
  { label: "M5: a compile that lands leaves its failure on record",
    find: "    if(worldState.eraFailure){delete worldState.eraFailure;saveCore();}/* M5: a compile or a merge landed */\n", replace: "", mustFail: ONLY + T.M5 },
  { label: "M5: a failure is recorded against whatever campaign is open",
    find: "    if(campaignStill(_eraMark,null)){var _efp=", replace: "    if(true){var _efp=", mustFail: ONLY + T.M5C },
  { label: "M6: the place left is compared under its alias",
    find: "if(prev)prev=_lr(prev);", replace: "", mustFail: ONLY + T.M6 },
  { label: "M6: an edge stored under an alias is not recognised",
    find: "_ef2=_lr(e.from),_et2=_lr(e.to);", replace: "_ef2=e.from,_et2=e.to;", mustFail: ONLY + T.M6 }
]);
prove("helpers.js", [
  { label: "M5: the failing compile is not on the health readout",
    find: "  if(ws.eraFailure&&(ws.eraFailure.count||0)>=1)anom.push(", replace: "  if(false)anom.push(", mustFail: ONLY + T.M5 },
  { label: "M7: the active want is queued behind itself",
    find: "  if(cs.agenda&&String(cs.agenda.want||\"\").trim().toLowerCase()===_wk)return \"known\";\n", replace: "", mustFail: ONLY + T.M7A },
  { label: "M7: a waiting want is queued twice",
    find: "if(String(cs.agendaQueue[_wi].want||\"\").trim().toLowerCase()===_wk)return \"known\";", replace: "if(false)return \"known\";", mustFail: ONLY + T.M7A },
  { label: "M7: the queue is unbounded",
    find: "  if(cs.agendaQueue.length>=AGENDA_QUEUE_MAX)return \"full\";\n", replace: "", mustFail: ONLY + T.M7A },
  { label: "M7: a blank want is filed",
    find: "  if(!rec.want)return null;\n", replace: "", mustFail: ONLY + T.M7A },
  { label: "M7: a completed want's duplicate is promoted",
    find: "  if(cs.agendaQueue)cs.agendaQueue=cs.agendaQueue.filter(function(q){return String((q&&q.want)||\"\").trim().toLowerCase()!==String(a.want||\"\").trim().toLowerCase();});\n", replace: "", mustFail: ONLY + T.M7B }
]);
prove("tag_table.js", [
  { label: "M7: a repeated want is not said",
    find: "else if(placed===\"known\")R.muts.push(", replace: "else if(false)R.muts.push(", mustFail: ONLY + T.M7A },
  { label: "M7: a want refused at the bound is not said",
    find: "else if(placed===\"full\")R.muts.push(", replace: "else if(false)R.muts.push(", mustFail: ONLY + T.M7A }
]);

process.exit(failed ? 1 : 0);
