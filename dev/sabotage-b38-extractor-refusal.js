// dev/sabotage-b38-extractor-refusal.js — proves the B38 guards are guarded: the shape chooser, the framing, the
// shortened caps, the window builder's byte-identity with the old composition, the refusal flag on a strike, the
// one-retry gate (named block only, never twice, never on a transient), and the reframed-first next turn. The
// engine section covers the pure pieces; the standalone flow suite (dev/tests-b38-extractor-refusal.js) drives
// the real async summarize() and is the command for the flow clauses. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-b38-extractor-refusal.js
var sabotage = require("./sabotage.js"), code = 0;
function proveE(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "B38 extractor"]], cases: cases }); }
function proveF(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/tests-b38-extractor-refusal.js"]], cases: cases }); }
proveE("memory.js", [
  { label: "the shape chooser ignores the refusal flag (a blocked payload is replayed unchanged next turn)",
    find: 'function extractShapeForFailure(sf){return (sf&&sf.refusal===true&&typeof sf.count==="number"&&sf.count>0)?"reframed":"normal";}', replace: 'function extractShapeForFailure(sf){return "normal";}',
    mustFail: "extractShapeForFailure" },
  { label: "the framing loses its fiction/adult framing",
    find: "this is the transcript of a fictional tabletop role-playing game between consenting adult players; the narration is the game's fiction, not a real event. ", replace: "",
    mustFail: "extractRefusalFraming" },
  { label: "the reframed caps are not shorter",
    find: 'var EXTRACT_REFRAME_CAPS={assistant:1200,user:300};', replace: 'var EXTRACT_REFRAME_CAPS={assistant:4000,user:500};',
    mustFail: "extractRefusalFraming" },
  { label: "the window builder forgets to strip engine notes from the user half",
    find: 'var _ssc=_se.role==="user"?stripEngineNotes(_se.content):_se.content;\n    txt+=', replace: 'var _ssc=_se.content;\n    txt+=',
    mustFail: "buildExtractWindow" },
  { label: "the window builder lets bookkeeping entries in",
    find: 'if(!_se||_se.bk||_se.content==null)continue;\n    if(elide&&elide[i])', replace: 'if(!_se||_se.content==null)continue;\n    if(elide&&elide[i])',
    mustFail: "buildExtractWindow" },
  { label: "a strike never records the refusal",
    find: 'refusal:!!(e&&e.modelRefusal)/* B38', replace: 'refusal:false/* B38',
    mustFail: "summaryFailureBump" }
]);
proveF("memory.js", [
  { label: "the retry is gone — a named block counts a strike at once",
    find: 'if(!(e0&&e0.modelRefusal))throw e0;/* transients and JSON failures keep the old strike path */', replace: 'throw e0;',
    mustFail: "A refused normal shape" },
  { label: "the retry replays the SAME shape (no framing, no shorter window)",
    find: '_shape="reframed";_reframed=true;_ec=_extractCall("reframed");', replace: '_shape="reframed";_reframed=true;_ec=_extractCall("normal");',
    mustFail: "A refused normal shape" },
  { label: "the retry fires on a transient too (a blip now costs a second doomed call)",
    find: 'if(!(e0&&e0.modelRefusal))throw e0;/* transients and JSON failures keep the old strike path */', replace: '',
    mustFail: "D a transient empty" },
  { label: "a reframed refusal retries a third time in the same shape (the pair becomes a triple)",
    find: 'catch(e1){if(!(e1&&e1.modelRefusal))throw e1;e0=e1;resp=undefined;}', replace: 'catch(e1){if(!(e1&&e1.modelRefusal))throw e1;resp=await callGM(_ec.prompt,EXTRACT_SYS,2000,null,{kind:"summarize",noHistory:true});}',
    mustFail: "F both shapes refused" },
  { label: "the first shape ignores the standing refusal (the doomed pair again next turn)",
    find: 'var _shape=extractShapeForFailure(worldState.summaryFailure),_reframed=_shape==="reframed",_withheld=null;', replace: 'var _shape="normal",_reframed=false,_withheld=null;',
    mustFail: "C a standing refusal strike" },
  { label: "the system line hides that the extraction was reframed",
    find: '+(_withheld?" ("+_withheld.withheld+" of "+_withheld.total+" exchanges withheld by the provider\'s content filter — extracted around them; B38)":_reframed?" (extracted in the reframed, shortened shape after the provider blocked the full window — B38)":"")', replace: '',
    mustFail: "A refused normal shape" },
  // ── the elision ladder ──
  { label: "the ladder is gone — both refusals strike at once",
    find: 'var lad=null;try{lad=await summarizeElisionLadder(_extractCall);}catch(e2){if(e2)e2.ladderTried=true;throw e2;}', replace: 'var lad=null;',
    mustFail: "F both shapes refused" },
  { label: "the ladder runs every turn (ladderTried ignored)",
    find: 'if(worldState.summaryFailure&&worldState.summaryFailure.ladderTried)throw e0;', replace: '',
    mustFail: "I with ladderTried standing" },
  { label: "a blocked exchange's PLAYER half stays in the extraction",
    find: 'elide[xs[i].a]=1;if(xs[i].u>=0)elide[xs[i].u]=1;', replace: 'elide[xs[i].a]=1;',
    mustFail: "F both shapes refused" },
  { label: "the elision keeps the blocked text and only appends the marker",
    find: 'if(elide&&elide[i]){raw+=_se.role+": "+EXTRACT_WITHHELD+"\\n";txt+=_se.role+": "+EXTRACT_WITHHELD+"\\n";continue;}', replace: 'if(elide&&elide[i]){raw+=_se.role+": "+EXTRACT_WITHHELD+"\\n";txt+=_se.role+": "+EXTRACT_WITHHELD+"\\n";}',
    mustFail: "F both shapes refused" },
  { label: "any probe failure counts as blocked (guesswork elision)",
    find: 'catch(e){return !!(e&&e.modelRefusal);}/* only a NAMED block counts', replace: 'catch(e){return true;}/* only a NAMED block counts',
    mustFail: "J a probe that fails" },
  { label: "the chapter forgets the withheld share",
    find: 'if(_withheld&&extracted&&typeof extracted==="object")extracted.chapterSummary=String(extracted.chapterSummary||"")+" "+withheldChapterNote(_withheld.withheld,_withheld.total);', replace: '',
    mustFail: "F both shapes refused" },
  { label: "a ladder that found nothing does not mark the window (probes every turn)",
    find: 'if(!lad){e0.ladderTried=true;throw e0;}', replace: 'if(!lad){throw e0;}',
    mustFail: "G both shapes refused" }
]);
process.exit(code);
