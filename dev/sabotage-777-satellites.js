// sabotage-777-satellites.js — retained proof for audit 2026-11-19 (TODO #777), section D, the satellite rows:
//   story_compiler.html   D2 a load ends the compile in flight; a compile that throws lets go
//   character_editor.html   D3 a failed draft save is said; a draft from a newer build is held
//   home.html, map_cleanup.html, author_voice_lab.html   D5
// Each clause runs ONE named case of dev/tests-777-satellites-browser.js in headless Chrome (skipped out loud without it).
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var CMD = ["node", ["dev/tests-777-satellites-browser.js"]], ONLY = "FAIL #777 ";
var failed = 0, clauses = 0;
function prove(file, cases) { clauses += cases.length; failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases, skip: !chrome.path }); }
var T = {
  LOAD: "D2: a campaign loaded while a compile is weaving ends that compile",
  THROW: "D2: a compile that throws lets go of the page and says why",
  SAVE: "D3: a draft that cannot be stored says so, once",
  HELD: "D3: a draft from a newer build is held",
  HOME: "D5: home says the session expired, or that the account could not be read",
  SRC: "D5: the map repair page lets go of its export"
};
prove("story_compiler.html", [
  { label: "D2: a load leaves the compile in flight running (and the page busy)",
    find: "    RUN++;if(BUSY){BUSY=false;progress(\"Compile stopped: another campaign was loaded. Press Compile for this one.\",0);}", replace: "", mustFail: ONLY + T.LOAD },
  { label: "D2: a stopped compile says nothing",
    find: "if(BUSY){BUSY=false;progress(\"Compile stopped: another campaign was loaded. Press Compile for this one.\",0);}", replace: "if(BUSY){BUSY=false;}", mustFail: ONLY + T.LOAD },
  { label: "D2: a slice of an ended compile keeps weaving",
    find: "        if(run!==RUN)return;/* D2: a load ended this compile */\n", replace: "", mustFail: ONLY + T.LOAD },
  { label: "D2: a compile that throws leaves the page busy",
    find: "function failed(e){if(run!==RUN)return;BUSY=false;enable(\"compile\",true);", replace: "function failed(e){if(run!==RUN)return;enable(\"compile\",true);", mustFail: ONLY + T.THROW },
  { label: "D2: a compile that throws leaves Compile disabled",
    find: "function failed(e){if(run!==RUN)return;BUSY=false;enable(\"compile\",true);", replace: "function failed(e){if(run!==RUN)return;BUSY=false;", mustFail: ONLY + T.THROW },
  { label: "D2: a compile that throws says nothing",
    find: "progress(\"Compile failed: \"+((e&&e.message)||e),0);", replace: "", mustFail: ONLY + T.THROW }
]);
prove("character_editor.html", [
  { label: "D3: a failed draft save is silent",
    find: "catch(e){if(!_draftFailSaid){_draftFailSaid=true;setStatus(", replace: "catch(e){if(false){_draftFailSaid=true;setStatus(", mustFail: ONLY + T.SAVE },
  { label: "D3: a newer draft leaves the page with no sheet",
    find: "    if(_dv){_draftHeld=true;ch=blankChar();render();setStatus(", replace: "    if(_dv){_draftHeld=true;setStatus(", mustFail: ONLY + T.HELD },
  { label: "D3: an edit writes over the newer draft",
    find: "  function saveDraft(){if(_draftHeld)return;", replace: "  function saveDraft(){", mustFail: ONLY + T.HELD },
  { label: "D3: New removes the newer draft",
    find: "if(!_draftHeld){try{localStorage.removeItem(CE_DRAFT_K);}catch(e){}}render();", replace: "try{localStorage.removeItem(CE_DRAFT_K);}catch(e){}render();", mustFail: ONLY + T.HELD },
  { label: "D3: the page does not say the newer draft is kept",
    find: " It is kept untouched; this blank sheet is not saved as a draft.\",\"err\");}", replace: "\",\"err\");}", mustFail: ONLY + T.HELD }
]);
prove("home.html", [
  { label: "D5: a failed account check leaves \"Signed in.\" standing",
    find: "storageAdapter.fetchAccount(function(err,a){if(err||!a){w.innerHTML=String(err||\"\").indexOf(\"401\")>=0?", replace: "storageAdapter.fetchAccount(function(err,a){if(err||!a)return;if(false){w.innerHTML=String(err||\"\").indexOf(\"401\")>=0?", mustFail: ONLY + T.HOME },
  { label: "D5: an expired session is not named",
    find: "w.innerHTML=String(err||\"\").indexOf(\"401\")>=0?", replace: "w.innerHTML=false?", mustFail: ONLY + T.HOME }
]);
prove("map_cleanup.html", [
  { label: "D5: the export's object URL is never revoked",
    find: "      setTimeout(function(){try{URL.revokeObjectURL(a.href);}catch(e){}},1000);", replace: "      ", mustFail: ONLY + T.SRC }
]);
prove("author_voice_lab.html", [
  { label: "D5: the model wait does not count",
    find: "    var _t0=Date.now(),_tick=setInterval(function(){statEl.textContent=\"calling \"+model+\" … \"+Math.round((Date.now()-_t0)/1000)+\"s\";},1000);", replace: "    var _t0=Date.now(),_tick=0;", mustFail: ONLY + T.SRC },
  { label: "D5: the counter keeps writing over a failure",
    find: "    }).catch(function(e){\n      clearInterval(_tick);\n", replace: "    }).catch(function(e){\n", mustFail: ONLY + T.SRC }
]);

if (!chrome.path && !failed) { verdict.reportSkip("sabotage-777-satellites.js", clauses, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
