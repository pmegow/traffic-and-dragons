// tests-frozen-golden.js — f78 golden-text visibility and wiring checks.
var fs=require("fs"),os=require("os"),path=require("path"),golden=require("./frozen-golden.js");
var ROOT=path.join(__dirname,".."),failed=0;
function test(name,fn){try{var r=fn();if(r===true||r===undefined)console.log("PASS "+name);else{failed++;console.error("FAIL "+name+": "+r);}}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}

test("a mismatch prints a named committed-vs-generated line diff",function(){
  var tmp=fs.mkdtempSync(path.join(os.tmpdir(),"tnd-golden-"));
  try{fs.writeFileSync(path.join(tmp,"sample.golden"),"alpha\nbeta\ngamma\n");
    var d=golden.failureDiff(tmp,"sample.golden","alpha\nBETA\ngamma");
    return d.indexOf("--- committed sample.golden")>=0&&d.indexOf("+++ generated tag_table text")>=0&&d.indexOf("@@ line 2, char 1 @@")>=0&&d.indexOf("- beta")>=0&&d.indexOf("+ BETA")>=0?true:d;
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test("a missing golden fails loudly with its committed path",function(){
  var d=golden.failureDiff(os.tmpdir(),"missing-tag-text.golden","actual");
  return d.indexOf("FROZEN GOLDEN DIFF UNAVAILABLE")>=0&&d.indexOf("missing-tag-text.golden")>=0?true:d;
});
test("the strip golden matches the text behind the unchanged frozen hash",function(){
  require("./load-engine.js").loadEngine("api.js");
  var expected=golden.readGolden(ROOT,"dev/golden/tag-table-strip.golden");
  return expected===global._CT_TAGS.source?true:"strip golden drifted at committed byte "+Math.min(expected.length,global._CT_TAGS.source.length);
});
test("the STATE TAGS golden matches the text behind the unchanged frozen hash",function(){
  var expected=golden.readGolden(ROOT,"dev/golden/tag-table-doc.golden"),actual=global.buildStateTagsDoc();
  return expected===actual?true:"STATE TAGS golden drifted (expected "+expected.length+", generated "+actual.length+")";
});
test("run-tests attaches each frozen failure to its committed golden",function(){
  var src=fs.readFileSync(path.join(__dirname,"run-tests.js"),"utf8");
  if(src.indexOf('require("./frozen-golden.js")')<0)return "run-tests does not load the golden diff helper";
  if(src.indexOf('dev/golden/tag-table-strip.golden')<0)return "strip hash failure has no golden path";
  if(src.indexOf('dev/golden/tag-table-doc.golden')<0)return "doc hash failure has no golden path";
  return src.indexOf('else fails.push(label+" — "+r+_frozenFailureDetail(name));')>=0?true:"failed assertions never invoke the golden diagnostic";
});

if(failed){console.error("FROZEN GOLDEN TESTS FAILED — "+failed);process.exit(1);}
console.log("ALL GREEN — 5 frozen-golden assertions");
