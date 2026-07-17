// run-tests.js — headless runner for the test.html suites (DEV TOOL, not loaded by index.html).
// Evals the REAL engine files in load order (via dev/load-engine.js — the canonical list,
// AUDIT_FABLE_07_16_2026 #18), then dev/engine-tests.js, and reports to the console.
// T&D vendor-patch tripwire (v1.322): the session-cache patch in vendor/piper/vits/vits-web.js
// is what keeps iOS Safari from being killed by per-sentence InferenceSession creation. A
// re-vendor that drops it resurrects the crash SILENTLY — fail the suite instead.
try {
  var _fsV = require("fs"), _pathV = require("path");
  var _vits = _fsV.readFileSync(_pathV.join(__dirname, "..", "vendor/piper/vits/vits-web.js"), "utf8");
  if (_vits.indexOf("T&D PATCH") < 0 || _vits.indexOf("tndGetSession") < 0 || _vits.indexOf("tndPhonemize") < 0) {
    console.error("VENDOR PATCH MISSING: vendor/piper/vits/vits-web.js lost the T&D session-cache patch (re-vendored?) — reapply it (see the patch header it should carry).");
    process.exit(1);
  }
  // v1.335 additions (piper-audit): the r3 patch set must survive a re-vendor too.
  // ① download integrity — S() must reject non-OK responses (an HF error page cached to OPFS as
  //    the model is permanent, silent breakage);
  // ② same-origin phonemizer — tndLocate must resolve to the vendored TND_PHON_BASE, and the two
  //    phonemize assets must exist on disk (the CDN path silently breaks offline).
  if (_vits.indexOf("voice download failed: HTTP") < 0) {
    console.error("VENDOR PATCH MISSING: vits-web.js S() lost the non-OK download guard (T&D r3) — an HF error page would be cached to OPFS as a voice model, permanently.");
    process.exit(1);
  }
  if (_vits.indexOf("TND_PHON_BASE") < 0 || !_fsV.existsSync(_pathV.join(__dirname, "..", "vendor/piper/phonemize/piper_phonemize.wasm")) || !_fsV.existsSync(_pathV.join(__dirname, "..", "vendor/piper/phonemize/piper_phonemize.data"))) {
    console.error("VENDOR PATCH MISSING: same-origin phonemizer (T&D r3) — tndLocate must use TND_PHON_BASE and vendor/piper/phonemize/piper_phonemize.{wasm,data} must exist, or Piper silently depends on a CDN again.");
    process.exit(1);
  }
  // ③ rev parity — the ?tnd= query in tts.js is the ONLY delivery mechanism for a vits-web patch
  //    (permanent SW cache + immutable header, the v1.322/323 wasted-tries trap). A patched file
  //    whose TND_VITS_PATCH ran ahead of PIPER_RUNTIME_REV would never reach installed phones.
  // ④ dependency delivery (v1.336): the relative piper-DeOu3H9E import and the phonemize assets
  //    must carry the TND_DEP_REV query, and the import map must carry the ort ?tnd= rev — those
  //    URLs are the ONLY way a patch to a permanently-cached dependency reaches installed phones.
  if (_vits.indexOf("piper-DeOu3H9E.js?tnd=") < 0 || _vits.indexOf("TND_DEP_REV") < 0) {
    console.error("VENDOR PATCH MISSING: vits-web.js lost the TND_DEP_REV query on its dependency URLs (T&D r4) — a patched piper-DeOu3H9E.js/phonemize asset would never reach installed phones.");
    process.exit(1);
  }
  var _idx = _fsV.readFileSync(_pathV.join(__dirname, "..", "index.html"), "utf8");
  if (_idx.indexOf("ort.wasm.min.js?tnd=") < 0) {
    console.error("VENDOR PATCH MISSING: index.html import map lost the ?tnd= rev on ort.wasm.min.js — a patched ORT loader would never reach installed phones.");
    process.exit(1);
  }
  var _tts = _fsV.readFileSync(_pathV.join(__dirname, "..", "tts.js"), "utf8");
  var _revT = (_tts.match(/PIPER_RUNTIME_REV\s*=\s*"(r\d+)"/) || [])[1];
  var _revV = (_vits.match(/TND_VITS_PATCH\s*=\s*"(r\d+)"/) || [])[1];
  if (!_revT || !_revV || _revT !== _revV) {
    console.error("VENDOR REV MISMATCH: tts.js PIPER_RUNTIME_REV=" + _revT + " vs vits-web.js TND_VITS_PATCH=" + _revV + " — bump PIPER_RUNTIME_REV with every vendored vits-web change or the patch never reaches installed phones.");
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
