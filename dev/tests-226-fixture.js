// tests-226-fixture.js — preservation, privacy, maturity, and immutability checks.
// PRIVACY RULING (Fable, 2026-08-29): the fixture is LOCAL-ONLY. testRuns/ is gitignored by
// standing owner decree — personal campaign prose never enters the public repo (the first cut
// force-added the 4MB t2097 transcript past the ignore and pushed it; removed the same day).
// On a machine without the fixture (CI, fresh clones) the fixture-dependent tests SKIP loudly
// and the synthetic sanitizer tests still run. Rebuild locally: node dev/prepare-226-fixture.js
var fs=require("fs"),path=require("path"),core=require("./fixture-226.js");
var ROOT=path.join(__dirname,".."),REL="testRuns/fixtures/todo-226-mature-t2097.tnd";
var HAVE=fs.existsSync(path.join(ROOT,REL));
var text=HAVE?fs.readFileSync(path.join(ROOT,REL),"utf8"):null,save=HAVE?JSON.parse(text):null;
var manifest=HAVE?JSON.parse(fs.readFileSync(path.join(ROOT,REL.replace(/\.tnd$/,".manifest.json")),"utf8")):null;
var failed=0,skipped=0;
function test(name,fn){try{var r=fn();if(r===true||r===undefined)console.log("PASS "+name);else{failed++;console.error("FAIL "+name+": "+r);}}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}
function fixtureTest(name,fn){if(!HAVE){skipped++;console.log("SKIP "+name+" (the mature fixture is local-only by privacy ruling — rebuild with dev/prepare-226-fixture.js)");return;}test(name,fn);}

fixtureTest("the committed mature fixture is byte-pinned by its manifest",function(){return core.shaBytes(text)===manifest.sha256.fixture?true:"fixture bytes drifted from the manifest";});
fixtureTest("the mature arm retains late-game scale and finale state",function(){
  var ws=save.worldState,acts=(ws.skeleton&&ws.skeleton.acts)||[],last=acts[acts.length-1]||{},arcs=last.arcs||[];
  if(ws.turn!==2097||ws.transcript.length!==4190||ws.npcs.length!==63||save.memory.chapters.length!==10)return "maturity counts drifted: "+JSON.stringify(manifest.counts);
  return last.status==="active"&&arcs.some(function(a){return a.status==="active";})?true:"the active final act/arc is absent";
});
fixtureTest("transcript, session log, memory, roster, and quests retain their frozen hashes",function(){
  var got=core.protectedHashes(save),keys=["transcript","sessionLog","memory","rosterSansPortraits","quests"];
  for(var i=0;i<keys.length;i++)if(got[keys[i]]!==manifest.sha256[keys[i]])return keys[i]+" differs from the frozen preservation receipt";
  return true;
});
fixtureTest("portraits and API-key-adjacent fields are absent",function(){var l=core.leaks(save);return l.length?l.join("; "):true;});
fixtureTest("the fixture campaign identity cannot collide with the live save",function(){
  return save.worldState.campId==="fixture-226-mature-t2097"&&/fixture/i.test(save.worldState.campName)?true:"fixture kept a live campaign identity";
});
test("the sanitizer replaces a source campaign's live identity",function(){
  var source={worldState:{campId:"live-id",campName:"Live",transcript:[],npcs:[],questLog:[]},sessionLog:[],memory:{}};
  var out=core.prepare(source).save.worldState;
  return out.campId==="fixture-226-mature-t2097"&&/fixture/i.test(out.campName)?true:"sanitizer retained "+out.campId;
});
test("the sanitizer preserves protected slices while stripping a hostile synthetic source",function(){
  var source={worldState:{campId:"live",campName:"Live",transcript:[{role:"gm",text:"story"}],npcs:[{name:"N",portrait:"data:image/png;base64,abc",status:"ally"}],questLog:[{title:"Q",status:"active"}],apiKey:"sk-not-a-real-key-12345678901234567890",providerModels:{x:"y"}},sessionLog:[{role:"user",content:"go"}],memory:{chapters:[{summary:"canon"}]}};
  var before=core.protectedHashes(source),out=core.prepare(source).save,after=core.protectedHashes(out);
  if(JSON.stringify(before)!==JSON.stringify(after))return "a protected slice changed";
  if(out.worldState.npcs[0].portrait!==null||out.worldState.apiKey!==undefined||out.worldState.providerModels!==undefined)return "private fields survived";
  return out.worldState.npcs[0].status==="ally"?true:"non-portrait roster data changed";
});
fixtureTest("the manifest records why t2097, not the requested t2231, is frozen",function(){return manifest.provenance.indexOf("t2231")>=0&&manifest.provenance.indexOf("latest available")>=0?true:"source gap is undocumented";});

if(failed){console.error("TODO #226 FIXTURE TESTS FAILED — "+failed);process.exit(1);}
console.log("ALL GREEN — mature-fixture assertions ("+(8-skipped)+" run, "+skipped+" skipped as local-only)");
