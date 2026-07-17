// run-tests.js — headless runner for the test.html suites (DEV TOOL, not loaded by index.html).
// Evals the REAL engine files in load order (via dev/load-engine.js — the canonical list,
// AUDIT_FABLE_07_16_2026 #18), then dev/engine-tests.js, and reports to the console.
// T&D vendor-patch tripwire (v1.322): the session-cache patch in vendor/piper/vits/vits-web.js
// is what keeps iOS Safari from being killed by per-sentence InferenceSession creation. A
// re-vendor that drops it resurrects the crash SILENTLY — fail the suite instead.
try {
  var _fsV = require("fs"), _pathV = require("path");
  var _vits = _fsV.readFileSync(_pathV.join(__dirname, "..", "vendor/piper/vits/vits-web.js"), "utf8");
  if (_vits.indexOf("T&D PATCH") < 0 || _vits.indexOf("tndGetSession") < 0) {
    console.error("VENDOR PATCH MISSING: vendor/piper/vits/vits-web.js lost the T&D session-cache patch (re-vendored?) — reapply it (see the patch header it should carry).");
    process.exit(1);
  }
} catch (e) { console.error("VENDOR PATCH CHECK FAILED: " + e.message); process.exit(1); }

// Exit 0 = ALL GREEN; exit 1 = failures (blocks the commit via .git/hooks/pre-commit).
//   node dev/run-tests.js                     — full suite
//   node dev/run-tests.js <section-substring> — #20: run only sections whose name contains
//     the substring (case-insensitive), e.g. `node dev/run-tests.js quest`. Reporter-level
//     filter — engine-tests.js is untouched; t() no-ops outside matching sections.
// The suites are DOM-free by design (see engine-tests.js), so no browser or jsdom is needed.
var fs=require("fs");
var path=require("path");
var engine=require("./load-engine.js");
try{engine.loadEngine();}
catch(e){console.error(e.message);process.exit(1);}
var geval=eval; // indirect eval → global scope (same loader convention as load-engine.js)
geval(fs.readFileSync(path.join(__dirname,"engine-tests.js"),"utf8"));

var filterRaw=process.argv[2]||"";
var filter=filterRaw.toLowerCase();
var pass=0,fails=[];
var curSection="",sectionOn=!filter,matchedSections=0;
runEngineTests({
  section:function(name){
    curSection=name;
    sectionOn=!filter||name.toLowerCase().indexOf(filter)!==-1;
    if(filter&&sectionOn)matchedSections++;
  },
  t:function(name,fn){
    if(!sectionOn)return; // #20 section filter — skipped sections never execute
    var label=curSection+" › "+name;
    try{
      var r=fn();
      if(r===true||r===undefined)pass++;
      else fails.push(label+" — "+r);
    }catch(e){fails.push(label+" — threw: "+e.message);}
  }
});
if(filter&&matchedSections===0){
  console.error("FILTER \""+filterRaw+"\" matched 0 sections — NOTHING ran (typo?). Remove the argument for the full suite.");
  process.exit(1);
}
if(fails.length){
  console.error("ENGINE TESTS FAILED ("+fails.length+" of "+(pass+fails.length)+"):");
  for(var f=0;f<fails.length;f++)console.error("  ✗ "+fails[f]);
  console.error("Open test.html in a browser for the full red/green view.");
  process.exit(1);
}
if(filter){
  console.log("FILTERED GREEN — \""+filterRaw+"\": "+matchedSections+" section(s) matched, "+pass+" assertions passed — NOT the full suite");
}else{
  console.log("ALL GREEN — "+pass+" assertions passed (engine tests)");
}
process.exit(0);
