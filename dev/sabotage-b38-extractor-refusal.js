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
    find: 'if(!_se||_se.bk||_se.content==null)continue;\n    raw+=', replace: 'if(!_se||_se.content==null)continue;\n    raw+=',
    mustFail: "buildExtractWindow" },
  { label: "a strike never records the refusal",
    find: 'refusal:!!(e&&e.modelRefusal)/* B38', replace: 'refusal:false/* B38',
    mustFail: "summaryFailureBump" }
]);
proveF("memory.js", [
  { label: "the retry is gone — a named block counts a strike at once",
    find: 'if(!(e0&&e0.modelRefusal)||_shape==="reframed")throw e0;', replace: 'throw e0;',
    mustFail: "A refused normal shape" },
  { label: "the retry replays the SAME shape (no framing, no shorter window)",
    find: '_shape="reframed";_reframed=true;_ec=_extractCall("reframed");', replace: '_shape="reframed";_reframed=true;_ec=_extractCall("normal");',
    mustFail: "A refused normal shape" },
  { label: "the retry fires on a transient too (a blip now costs a second doomed call)",
    find: 'if(!(e0&&e0.modelRefusal)||_shape==="reframed")throw e0;', replace: 'if(_shape==="reframed")throw e0;',
    mustFail: "D a transient empty" },
  { label: "a reframed refusal retries again (the pair becomes a triple every turn)",
    find: 'if(!(e0&&e0.modelRefusal)||_shape==="reframed")throw e0;', replace: 'if(!(e0&&e0.modelRefusal))throw e0;',
    mustFail: "E strike 3 stays" },
  { label: "the first shape ignores the standing refusal (the doomed pair again next turn)",
    find: 'var _shape=extractShapeForFailure(worldState.summaryFailure),_reframed=_shape==="reframed";', replace: 'var _shape="normal",_reframed=false;',
    mustFail: "C a standing refusal strike" },
  { label: "the system line hides that the extraction was reframed",
    find: '+(_reframed?" (extracted in the reframed, shortened shape after the provider blocked the full window — B38)":"")', replace: '',
    mustFail: "A refused normal shape" }
]);
process.exit(code);
