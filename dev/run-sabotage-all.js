#!/usr/bin/env node
// run-sabotage-all.js — run EVERY dev/sabotage-*.js battery (#312 ①). DEV TOOL, node-only.
//   node dev/run-sabotage-all.js            every battery, in name order
//   node dev/run-sabotage-all.js w2 phase   only batteries whose filename contains a given word
// Each battery is its own process (they restore their target files on exit, crash and Ctrl-C);
// a battery that exits non-zero, or whose output carries a FAIL / NOT on mustFail line, counts
// as a failure. Slow by design (a full-suite run per mutation) — this is the weekly job, not the
// commit gate. Exit non-zero if any battery failed; the summary names each one.
"use strict";
var fs=require("fs"),path=require("path"),cp=require("child_process");
var ROOT=path.join(__dirname,"..");
var filters=process.argv.slice(2);
var files=fs.readdirSync(path.join(ROOT,"dev")).filter(function(f){return /^sabotage-.*\.js$/.test(f);}).sort();
if(filters.length)files=files.filter(function(f){return filters.some(function(w){return f.indexOf(w)>=0;});});
if(!files.length){console.error("no batteries matched");process.exit(2);}
var results=[],t0=Date.now();
files.forEach(function(f){
  var start=Date.now();
  var r=cp.spawnSync(process.execPath,["dev/"+f],{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024});
  var out=(r.stdout||"")+(r.stderr||"");
  var bad=r.status!==0||/NOT on mustFail|no bytes changed|MISATTRIBUT/i.test(out);
  var caught=(out.match(/✓|caught|PASS/g)||[]).length;
  results.push({file:f,ok:!bad,secs:Math.round((Date.now()-start)/1000),caught:caught,status:r.status});
  console.log((bad?"FAIL ":"ok   ")+f+" ("+results[results.length-1].secs+"s, "+caught+" ✓)");
  if(bad)console.log(out.split("\n").filter(function(l){return /FAIL|NOT on mustFail|no bytes|Error|MISATTRIB/i.test(l);}).slice(0,8).map(function(l){return "     "+l;}).join("\n"));
});
var failed=results.filter(function(r){return !r.ok;});
console.log("\n"+(failed.length?"SABOTAGE ALL: "+failed.length+" of "+results.length+" batteries FAILED — "+failed.map(function(r){return r.file;}).join(", "):"SABOTAGE ALL: "+results.length+" batteries green")+" ("+Math.round((Date.now()-t0)/60000)+" min)");
process.exit(failed.length?1:0);
