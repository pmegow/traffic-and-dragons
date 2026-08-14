// sabotage-w6.js — prove the #168 W6 summary identity protections are load-bearing.
// Every mutation must turn the real focused/replay gate red and restore the file byte-identically.
var sabotage=require("./sabotage.js"),rc=0,focused=["node",["dev/run-tests.js","#168 W6"]],replay=["node",["dev/replay-w6-summary.js"]];

rc|=sabotage.prove({file:"identity.js",command:focused,cases:[
  {label:"the atomic summary preflight stops calling W6",
    mustFail:"W6 exact t1644 chapter is rejected from male Ammut's sole adjacent ant",
    find:"function validateSummaryExtract(extracted,table){if(typeof w6ValidateSummary===\"function\")w6ValidateSummary(extracted,table);",
    replace:"function validateSummaryExtract(extracted,table){if(false)w6ValidateSummary(extracted,table);"},
  {label:"the sole-adjacent-antecedent mismatch is ignored",
    mustFail:"W6 exact t1644 chapter is rejected from male Ammut's sole adjacent ant",
    find:"f=_w6SubjectFamily(sent);if((prior.family===\"M\"||prior.family===\"F\")&&f&&f!==prior.family)",
    replace:"f=\"\";if((prior.family===\"M\"||prior.family===\"F\")&&f&&f!==prior.family)"},
  {label:"competing named actors are guessed as the first actor",
    /* #182 re-anchored: the anchor computation moved into `var anchor=…` in the REACH rewrite */
    mustFail:"W6 ambiguity stays unclassified: competing actors, quotes, objects, po",
    find:"var anchor=named.length===1&&_w6StartsWithName(sent,named[0])?named[0]:null;",
    replace:"var anchor=named.length&&_w6StartsWithName(sent,named[0])?named[0]:null;"},
  {label:"synthetic they/them becomes identity authority for unknown NPCs",
    mustFail:"W6 extractor identity table is authority-limited and bounded, while th",
    find:"family=wf||mf;aliases=_w6AliasList",
    replace:"family=wf||mf||\"NB\";aliases=_w6AliasList"},
  {label:"the per-call identity row cap is removed",
    mustFail:"W6 extractor identity table is authority-limited and bounded, while th",
    find:"if(table.rows.length>=SUMMARY_IDENTITY_ROW_CAP){table.truncated=true;return;}",
    replace:"if(false){table.truncated=true;return;}"},
  {label:"alias caps removed — the identity table's alias lists grow unbounded (#183②)",
    mustFail:"W6 internals (#183②): alias lists are bounded",
    find:"if(!a||a.length>120||out.indexOf(a)>=0||out.length>=3||chars+a.length>180)continue;",
    replace:"if(!a||out.indexOf(a)>=0)continue;"},
  {label:"adjacency widens to forever — a subject anchors pronoun checks across any distance (#183②)",
    /* #182 re-anchored: prior now assigns from the shared `anchor` variable */
    mustFail:"W6 internals (#183②): a neutral sentence breaks the antecedent",
    find:"prior=anchor;}",
    replace:"prior=anchor||prior;}"},
  {label:"row-trim dropped — validation authority diverges from the bounded block the extractor saw (#183②)",
    mustFail:"W6 internals (#183②): the identity block trims table.rows",
    find:"table.rows=kept;",
    replace:";"},
  {label:"semicolon boundary reverts — post-semicolon pronouns escape checking again (#182)",
    mustFail:"W6 REACH (#182): a semicolon is a sentence boundary",
    find:"var re=/[^.!?;]+(?:[.!?;]+[\"\\u201d]*|$)/g,m,prior=null;",
    replace:"var re=/[^.!?]+(?:[.!?]+[\"\\u201d]*|$)/g,m,prior=null;"},
  {label:"clause check dies — comma-conjunction contradictions inside anchored sentences escape again (#182)",
    mustFail:"W6 REACH (#182): a comma-conjunction clause inside an anchored sentence",
    find:"if(anchor&&(anchor.family===\"M\"||anchor.family===\"F\")){var tails=low.split(",
    replace:"if(false){var tails=low.split("}
]});

rc|=sabotage.prove({file:"memory.js",command:focused,cases:[
  {label:"applySummaryExtract writes before the shared validator",
    mustFail:"W6 exact t1644 chapter is rejected from male Ammut's sole adjacent ant",
    find:"if(typeof validateSummaryExtract===\"function\")validateSummaryExtract(extracted,identityTable);",
    replace:"if(false)validateSummaryExtract(extracted,identityTable);"},
  {label:"the extractor prompt loses its canonical identity table",
    mustFail:"W6 extractor identity table is authority-limited and bounded, while th",
    find:"  if(typeof buildSummaryIdentityBlock===\"function\")p+=\"\\n\"+buildSummaryIdentityBlock(identityTable&&identityTable.rows?identityTable:summaryIdentityTable(sessRaw));\n",
    replace:""},
  {label:"era compaction bypasses identity validation",
    mustFail:"W6 era compaction validates before its rebuildable canon write",
    find:"  if(typeof w6ValidateSummary===\"function\"){var raw=[],_eci,_ect;for(_eci=0;_eci<due.sources.length;_eci++)raw.push(String(due.sources[_eci].summary||\"\"));_ect=summaryIdentityTable(raw.join(\"\\n\"));buildSummaryIdentityBlock(_ect);w6ValidateSummary({chapterSummary:String(got.summary)},_ect);}\n",
    replace:""},
  {label:"identity quarantine receipts become unbounded",
    mustFail:"W6 identity quarantine receipts are initialized and remain bounded",
    /* #183: STALED by the v1.609 P3 loud-eviction rewrite — the old find matched nothing, so
       this clause proved NOTHING while reading as coverage. Re-anchored to the current code. */
    find:"while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){var _ev=a.shift();",
    replace:"while(false){var _ev=a.shift();"},
  {label:"the 900-char raw-excerpt slice is dropped — quarantine receipts carry unbounded source text (#183②)",
    mustFail:"W6 internals (#183②): quarantine receipts bound their raw excerpt",
    find:"raw:(rawBits||[]).join(\" ... \").slice(0,900)",
    replace:"raw:(rawBits||[]).join(\" ... \")"}
]});

rc|=sabotage.prove({file:"memory.js",command:replay,cases:[
  {label:"exhausted identity validation is routed through the raw chapter fallback",
    mustFail:"W6 REPLAY FAILED: validation receipt missing or malformed: []",
    find:"if(_sumFails>=3&&((e&&(e.w2Identity||e.summaryIdentity))||(worldState.summaryFailure&&worldState.summaryFailure.identityValidation)))",
    replace:"if(false)"},
  {label:"retry strikes stop reading persisted campaign state",
    mustFail:"W6 REPLAY FAILED: reload evaded the second strike",
    find:"var old=worldState&&worldState.summaryFailure,prior=old&&typeof old.count===\"number\"?old.count:0,",
    replace:"var old=null,prior=0,"},
  {label:"a failed attempt is not saved immediately",
    mustFail:"W6 REPLAY FAILED: failure lifecycle did not persist each strike and th",
    find:"_sumFails=summaryFailureBump(e);saveCore();",
    replace:"_sumFails=summaryFailureBump(e);"},
  {label:"safe exhaustion leaves the old failure strike armed",
    mustFail:"W6 REPLAY FAILED: safe exhaustion left a stale strike",
    find:"retainSessionTail();summaryFailureClear();saveMem();saveCore();addMsg(\"system\",\"Memory identity conflict quarantined; no chapter or canon consequence was filed.\");",
    replace:"retainSessionTail();saveMem();saveCore();addMsg(\"system\",\"Memory identity conflict quarantined; no chapter or canon consequence was filed.\");"}
]});

rc|=sabotage.prove({file:"state.js",command:focused,cases:[
  {label:"campaign load resets the persisted retry ceiling",
    mustFail:"W6 campaign load restores the persisted summary strike instead of rese",
    find:"_sumFails=worldState.summaryFailure&&typeof worldState.summaryFailure.count===\"number\"?worldState.summaryFailure.count:0;",
    replace:"_sumFails=0;"}
]});

rc|=sabotage.prove({file:"ui-files.js",command:focused,cases:[
  {label:"save import drops rejected-summary forensic receipts",
    find:",identityQuarantines:mm.archive.identityQuarantines||[]",
    replace:""}
]});

process.exit(rc);
