// dev/sabotage-b39-resume-observed.js — proves the B39 guards are guarded: the observer attaches a rejection reporter
// and returns the same promise; sound.js observes its resume, dooms and rebuilds a refused context, closes the doomed
// one, dispatches tnd:audio-refused and exports state(); tts keeps its doom bookkeeping; the mic context is observed;
// ambience re-arms; the diag line names the second context. The flow suite (dev/tests-b39-resume-observed.js) is the
// command for the behavioural clauses; the engine pins for the wiring. Each mutation runs in a disposable clone.
//   node dev/sabotage-b39-resume-observed.js
var sabotage = require("./sabotage.js"), code = 0;
function proveE(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "B39 resume"]], cases: cases }); }
function proveF(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/tests-b39-resume-observed.js"]], cases: cases }); }
proveF("helpers.js", [
  { label: "the observer attaches no reporter (the rejection is unhandled again)",
    find: 'if(pr&&typeof pr.then==="function")pr.then(null,function(e){', replace: 'if(false)pr.then(null,function(e){',
    mustFail: "resumeObserved handles a refused resume" },
  { label: "the observer swallows the rejection and returns a new resolved promise",
    find: '  return pr;\n}', replace: '  return pr&&pr.then?pr.then(null,function(){}):pr;\n}',
    mustFail: "resumeObserved handles a refused resume" },
  { label: "the observer never crumbs",
    find: 'if(typeof erCrumb==="function")erCrumb("ctx-refused",(tag||"?")+" "+ctx.state+" "+why.slice(0,40));', replace: '',
    mustFail: "resumeObserved handles a refused resume" },
  { label: "onRefused is never called",
    find: 'if(typeof onRefused==="function"){try{onRefused(e,why);}catch(_e){}}', replace: '',
    mustFail: "resumeObserved handles a refused resume" }
]);
proveF("sound.js", [
  { label: "a refused earcon resume no longer dooms the context",
    find: 'function _markRefused(why) {\n    _ctxDoomed = true;', replace: 'function _markRefused(why) {',
    mustFail: "Sound.play on a refused context" },
  { label: "a doomed context is reused instead of rebuilt",
    find: 'if (_ctx && _ctxDoomed) { try { if (typeof _ctx.close === "function") _ctx.close(); } catch (e) {} _ctx = null; _ctxDoomed = false; _ctxRebuilds++;', replace: 'if (false) { _ctx = null; _ctxDoomed = false; _ctxRebuilds++;',
    mustFail: "Sound.play on a refused context" },
  { label: "the doomed context is dropped without close() (a leaked context per refusal)",
    find: 'try { if (typeof _ctx.close === "function") _ctx.close(); } catch (e) {} _ctx = null;', replace: '_ctx = null;',
    mustFail: "Sound.play on a refused context" },
  { label: "ambience is never told (no tnd:audio-refused)",
    find: 'try { window.dispatchEvent(new CustomEvent("tnd:audio-refused", { detail: { context: "sound", why: String(why || "") } })); } catch (e) {}', replace: '',
    mustFail: "Sound.play on a refused context" },
  { label: "state() creates a context as a side effect",
    find: 'function state() { return _ctx ? (', replace: 'function state() { _ensureCtx(); return _ctx ? (',
    mustFail: "Sound.play on a refused context" }
]);
proveE("sound.js", [
  { label: "sound.play goes back to a bare resume()",
    find: 'if ((ctx.state === "suspended" || ctx.state === "interrupted") && typeof resumeObserved === "function") resumeObserved(ctx, "sound:" + id, function(e, why) { _markRefused(why); });', replace: 'try { if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume(); } catch (e) {}',
    mustFail: "B39" }
]);
proveE("tts.js", [
  { label: "tts stops dooming its own context on a refusal",
    find: 'return resumeObserved(ctx, "tts:" + (tag || "?"), function() { _ctxRefusals++; if (ctx === _audioCtx) _ctxDoomed = true; });', replace: 'return resumeObserved(ctx, "tts:" + (tag || "?"), function() { _ctxRefusals++; });',
    mustFail: "B39 the wiring" }
]);
proveE("stt.js", [
  { label: "the mic context goes back to a bare resume()",
    find: 'if (typeof resumeObserved === "function") resumeObserved(_vadCtx, "vad"); else { try { _vadCtx.resume(); } catch(e) {} }', replace: 'try { _vadCtx.resume(); } catch(e) {}',
    mustFail: "B39" }
]);
proveE("ui-ambient.js", [
  { label: "ambience keeps its latch and stale controller after a refusal",
    find: 'controller = null; unlocked = false; ctx = null;', replace: 'controller = null;',
    mustFail: "B39 the wiring" }
]);
proveE("error-report.js", [
  { label: "the diag line forgets the second context",
    find: 'if (typeof Sound !== "undefined" && Sound.state) { try { s += " snd=" + Sound.state(); } catch (e) {} }', replace: '',
    mustFail: "B39 the wiring" }
]);
process.exit(code);
