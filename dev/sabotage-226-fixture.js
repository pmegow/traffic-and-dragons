// sabotage-226-fixture.js — mutation proof for TODO #277 item 6 / TODO #226 prep.
var sabotage=require("./sabotage.js"),rc=0,CMD=["node",["dev/tests-226-fixture.js"]];
var ALSO=["dev/sabotage-226-fixture.js","dev/tests-226-fixture.js","dev/fixture-226.js","dev/prepare-226-fixture.js","dev/run-standalone-suites.js","testRuns/fixtures/todo-226-mature-t2097.tnd","testRuns/fixtures/todo-226-mature-t2097.manifest.json"];
rc|=sabotage.prove({file:"dev/fixture-226.js",command:CMD,also:ALSO,cases:[
  {label:"portrait payloads survive sanitization",mustFail:"sanitizer preserves protected slices while stripping a hostile synthetic source",find:'if(id==="portrait"){v[k]=null;continue;}',replace:'if(id==="portrait"){continue;}'},
  {label:"API keys survive sanitization",mustFail:"sanitizer preserves protected slices while stripping a hostile synthetic source",find:'apikey:1,apikeys:1',replace:'apikeys:1'},
  {label:"a sanitizer edit corrupts quests without tripping protected-slice identity",mustFail:"sanitizer preserves protected slices while stripping a hostile synthetic source",find:'  redactTree(out,false);',replace:'  redactTree(out,false);out.worldState.questLog=[];'},
  {label:"the sanitizer keeps the live campaign id and can collide during a sweep",mustFail:"sanitizer replaces a source campaign's live identity",find:'ws.campId=opts.campId||"fixture-226-mature-t2097";',replace:'ws.campId=ws.campId;'}
]});
/* PRIVACY RULING (Fable, 2026-08-29): the fixture is LOCAL-ONLY (testRuns/ is gitignored by
   standing owner decree; the first cut force-added the owner's campaign prose to the public
   repo). This block proves the byte-pin only where the fixture exists — CI and fresh clones
   skip it loudly; the synthetic sanitizer clauses above always run. */
var _fs226=require("fs"),_path226=require("path");
if(_fs226.existsSync(_path226.join(__dirname,"..","testRuns/fixtures/todo-226-mature-t2097.tnd"))){
rc|=sabotage.prove({file:"testRuns/fixtures/todo-226-mature-t2097.tnd",command:CMD,also:ALSO,cases:[
  {label:"the committed fixture can drift without invalidating its receipt",mustFail:"mature fixture is byte-pinned by its manifest",find:'"campId":"fixture-226-mature-t2097"',replace:'"campId":"fixture-226-mature-t2097-drift"'}
]});
}else{
console.log("SKIP fixture byte-pin block — the mature fixture is local-only by privacy ruling (rebuild: node dev/prepare-226-fixture.js)");
}
process.exit(rc?1:0);
