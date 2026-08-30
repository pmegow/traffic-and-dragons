// tests-226-fixture.js — preservation, privacy, maturity, and immutability checks.
var fs=require("fs"),path=require("path"),core=require("./fixture-226.js");
var ROOT=path.join(__dirname,".."),REL="testRuns/fixtures/todo-226-mature-t2097.tnd";
var text=fs.readFileSync(path.join(ROOT,REL),"utf8"),save=JSON.parse(text);
var manifest=JSON.parse(fs.readFileSync(path.join(ROOT,REL.replace(/\.tnd$/,".manifest.json")),"utf8"));
var failed=0;
function test(name,fn){try{var r=fn();if(r===true||r===undefined)console.log("PASS "+name);else{failed++;console.error("FAIL "+name+": "+r);}}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}

test("the committed mature fixture is byte-pinned by its manifest",function(){return core.shaBytes(text)===manifest.sha256.fixture?true:"fixture bytes drifted from the manifest";});
test("the mature arm retains late-game scale and finale state",function(){
  var ws=save.worldState,acts=(ws.skeleton&&ws.skeleton.acts)||[],last=acts[acts.length-1]||{},arcs=last.arcs||[];
  if(ws.turn!==2097||ws.transcript.length!==4190||ws.npcs.length!==63||save.memory.chapters.length!==10)return "maturity counts drifted: "+JSON.stringify(manifest.counts);
  return last.status==="active"&&arcs.some(function(a){return a.status==="active";})?true:"the active final act/arc is absent";
});
test("transcript, session log, memory, roster, and quests retain their frozen hashes",function(){
  var got=core.protectedHashes(save),keys=["transcript","sessionLog","memory","rosterSansPortraits","quests"];
  for(var i=0;i<keys.length;i++)if(got[keys[i]]!==manifest.sha256[keys[i]])return keys[i]+" differs from the frozen preservation receipt";
  return true;
});
test("portraits and API-key-adjacent fields are absent",function(){var l=core.leaks(save);return l.length?l.join("; "):true;});
test("the fixture campaign identity cannot collide with the live save",function(){
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
test("the manifest records why t2097, not the requested t2231, is frozen",function(){return manifest.provenance.indexOf("t2231")>=0&&manifest.provenance.indexOf("latest available")>=0?true:"source gap is undocumented";});

if(failed){console.error("TODO #226 FIXTURE TESTS FAILED — "+failed);process.exit(1);}
console.log("ALL GREEN — 8 mature-fixture assertions");
