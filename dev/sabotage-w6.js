// sabotage-w6.js — prove the #168 W6 summary identity protections are load-bearing.
// Every mutation must turn the real focused/replay gate red and restore the file byte-identically.
var sabotage=require("./sabotage.js"),rc=0,focused=["node",["dev/run-tests.js","#168 W6"]],replay=["node",["dev/replay-w6-summary.js"]];

rc|=sabotage.prove({file:"identity.js",command:focused,cases:[
  {label:"the atomic summary preflight stops calling W6",
    find:"function validateSummaryExtract(extracted,table){if(typeof w6ValidateSummary===\"function\")w6ValidateSummary(extracted,table);",
    replace:"function validateSummaryExtract(extracted,table){if(false)w6ValidateSummary(extracted,table);"},
  {label:"the sole-adjacent-antecedent mismatch is ignored",
    find:"f=_w6SubjectFamily(sent);if((prior.family===\"M\"||prior.family===\"F\")&&f&&f!==prior.family)",
    replace:"f=\"\";if((prior.family===\"M\"||prior.family===\"F\")&&f&&f!==prior.family)"},
  {label:"competing named actors are guessed as the first actor",
    find:"prior=named.length===1&&_w6StartsWithName(sent,named[0])?named[0]:null;",
    replace:"prior=named.length&&_w6StartsWithName(sent,named[0])?named[0]:null;"},
  {label:"synthetic they/them becomes identity authority for unknown NPCs",
    find:"family=wf||mf;aliases=_w6AliasList",
    replace:"family=wf||mf||\"NB\";aliases=_w6AliasList"},
  {label:"the per-call identity row cap is removed",
    find:"if(table.rows.length>=SUMMARY_IDENTITY_ROW_CAP){table.truncated=true;return;}",
    replace:"if(false){table.truncated=true;return;}"}
]});

rc|=sabotage.prove({file:"memory.js",command:focused,cases:[
  {label:"applySummaryExtract writes before the shared validator",
    find:"if(typeof validateSummaryExtract===\"function\")validateSummaryExtract(extracted,identityTable);",
    replace:"if(false)validateSummaryExtract(extracted,identityTable);"},
  {label:"the extractor prompt loses its canonical identity table",
    find:"  if(typeof buildSummaryIdentityBlock===\"function\")p+=\"\\n\"+buildSummaryIdentityBlock(identityTable&&identityTable.rows?identityTable:summaryIdentityTable(sessRaw));\n",
    replace:""},
  {label:"era compaction bypasses identity validation",
    find:"  if(typeof w6ValidateSummary===\"function\"){var raw=[],_eci,_ect;for(_eci=0;_eci<due.sources.length;_eci++)raw.push(String(due.sources[_eci].summary||\"\"));_ect=summaryIdentityTable(raw.join(\"\\n\"));buildSummaryIdentityBlock(_ect);w6ValidateSummary({chapterSummary:String(got.summary)},_ect);}\n",
    replace:""},
  {label:"identity quarantine receipts become unbounded",
    find:"while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP)a.shift();",
    replace:"while(false)a.shift();"}
]});

rc|=sabotage.prove({file:"memory.js",command:replay,cases:[
  {label:"exhausted identity validation is routed through the raw chapter fallback",
    find:"if(_sumFails>=3&&((e&&(e.w2Identity||e.summaryIdentity))||(worldState.summaryFailure&&worldState.summaryFailure.identityValidation)))",
    replace:"if(false)"},
  {label:"retry strikes stop reading persisted campaign state",
    find:"var old=worldState&&worldState.summaryFailure,prior=old&&typeof old.count===\"number\"?old.count:0,",
    replace:"var old=null,prior=0,"},
  {label:"a failed attempt is not saved immediately",
    find:"_sumFails=summaryFailureBump(e);saveCore();",
    replace:"_sumFails=summaryFailureBump(e);"},
  {label:"safe exhaustion leaves the old failure strike armed",
    find:"retainSessionTail();summaryFailureClear();saveMem();saveCore();addMsg(\"system\",\"Memory identity conflict quarantined; no chapter or canon consequence was filed.\");",
    replace:"retainSessionTail();saveMem();saveCore();addMsg(\"system\",\"Memory identity conflict quarantined; no chapter or canon consequence was filed.\");"}
]});

rc|=sabotage.prove({file:"state.js",command:focused,cases:[
  {label:"campaign load resets the persisted retry ceiling",
    find:"_sumFails=worldState.summaryFailure&&typeof worldState.summaryFailure.count===\"number\"?worldState.summaryFailure.count:0;",
    replace:"_sumFails=0;"}
]});

rc|=sabotage.prove({file:"ui-files.js",command:focused,cases:[
  {label:"save import drops rejected-summary forensic receipts",
    find:",identityQuarantines:mm.archive.identityQuarantines||[]",
    replace:""}
]});

process.exit(rc);
