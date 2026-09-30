// dev/sabotage-481-c7-record-names.js — proves the #481 C7 guards are guarded: canonical names are masked before the register
// scan (Fable's named clause: skip the mask), the canonical set carries a legacy skeleton's own terms, the rewrite prompt
// lists the names to keep, lines past the cap are deferred (bounded, re-guarded) instead of dropped, and the chapter guard
// scans through the same mask. Each mutation runs in a disposable clone against the async suite.
//   node dev/sabotage-481-c7-record-names.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-c7-record-names.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "skip the mask (Fable's named clause): the act-2 outcome is re-asked and dropped again",
    find: "function registerScanProse(text,names){return registerScan(registerMaskNames(text,names));}", replace: "function registerScanProse(text,names){return registerScan(text);}",
    mustFail: "FAIL #481 C7 the record guard files the act-2 outcome" },
  { label: "the canonical set forgets the skeleton's own terms",
    find: "    while((m=re.exec(skText))){var st=m.index", replace: "    while(false&&(m=re.exec(skText))){var st=m.index",
    mustFail: "FAIL #481 C7 the mask" }
]);
prove("memory.js", [
  { label: "the rewrite prompt stops listing the names to keep",
    find: "buildRecordRegisterRewritePrompt(j.text,hits,registerKeepFor(j.text,names))", replace: "buildRecordRegisterRewritePrompt(j.text,hits,[])",
    mustFail: "FAIL #481 C7 a line with a free-prose word is re-asked" },
  { label: "a line past the cap is dropped unasked again",
    find: "      j.drop();recordDeferPush(j,j.deferredFrom!=null?j.deferredFrom:turn);out.deferred++;", replace: "      j.drop();out.dropped++;",
    mustFail: "FAIL #481 C7 lines past the re-ask cap are DEFERRED" },
  { label: "the deferred lines are never re-guarded",
    find: "var prev=(worldState&&worldState.recordDeferred)?worldState.recordDeferred.splice(0):[];", replace: "var prev=[];",
    mustFail: "FAIL #481 C7 lines past the re-ask cap are DEFERRED" },
  { label: "the deferral queue grows without bound",
    find: "  while(q.length>RECORD_DEFER_CAP){var ev=q.shift();", replace: "  while(false){var ev=q.shift();",
    mustFail: "FAIL #481 C7 the deferral queue is bounded" },
  { label: "the chapter guard scans the names as the register",
    find: "hits=registerScanProse(extracted.chapterSummary,_cn);", replace: "hits=registerScan(extracted.chapterSummary);",
    mustFail: "FAIL #481 C7 the #372 chapter guard scans through the same mask" }
]);
process.exit(code);
