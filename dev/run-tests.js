// run-tests.js — headless runner for the test.html suites (DEV TOOL, not loaded by index.html).
// Evals the REAL engine files in load order, then dev/engine-tests.js, and reports to the
// console. Exit 0 = ALL GREEN; exit 1 = failures (blocks the commit via .git/hooks/pre-commit).
//   node dev/run-tests.js
// The suites are DOM-free by design (see engine-tests.js), so no browser or jsdom is needed.
var fs=require("fs");
var path=require("path");
var root=path.join(__dirname,"..");
var files=["globals.js","compress.js","data.js","capability_bible.js","helpers.js","state.js","storage-adapter.js","memory.js","tag_table.js","api.js","campaign_generator.js","game.js"];
var geval=eval; // indirect eval → runs in global scope, so the engine's `var`s become globals
for(var i=0;i<files.length;i++){
  try{geval(fs.readFileSync(path.join(root,files[i]),"utf8"));}
  catch(e){console.error("ENGINE LOAD FAILED in "+files[i]+": "+e.message);process.exit(1);}
}
geval(fs.readFileSync(path.join(__dirname,"engine-tests.js"),"utf8"));

var pass=0,fails=[];
var curSection="";
runEngineTests({
  section:function(name){curSection=name;},
  t:function(name,fn){
    var label=curSection+" › "+name;
    try{
      var r=fn();
      if(r===true||r===undefined)pass++;
      else fails.push(label+" — "+r);
    }catch(e){fails.push(label+" — threw: "+e.message);}
  }
});
if(fails.length){
  console.error("ENGINE TESTS FAILED ("+fails.length+" of "+(pass+fails.length)+"):");
  for(var f=0;f<fails.length;f++)console.error("  ✗ "+fails[f]);
  console.error("Open test.html in a browser for the full red/green view.");
  process.exit(1);
}
console.log("ALL GREEN — "+pass+" assertions passed (engine tests)");
process.exit(0);
