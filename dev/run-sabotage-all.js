#!/usr/bin/env node
// run-sabotage-all.js — run EVERY dev/sabotage-*.js battery (#312 ①). DEV TOOL, node-only.
//   node dev/run-sabotage-all.js            every battery, in name order
//   node dev/run-sabotage-all.js w2 phase   only batteries whose filename contains a given word
//   --jobs=N (or SABOTAGE_JOBS=N)           how many at a time (dev/battery-pool.js; default half the cores up to 8)
// Each battery is its own process (they restore their target files on exit, crash and Ctrl-C);
// a battery that exits non-zero, or whose output carries a FAIL / NOT on mustFail line, counts
// as a failure. Slow by design (a full-suite run per mutation) — this is the weekly job, not the
// commit gate. Exit non-zero if any battery failed; the summary names each one.
"use strict";
var fs=require("fs"),os=require("os"),path=require("path"),pool=require("./battery-pool.js");
var ROOT=path.join(__dirname,"..");
var args;try{args=pool.jobsFrom(process.argv.slice(2),process.env,os.cpus().length);}catch(e){console.error("run-sabotage-all: "+e.message);process.exit(2);}
var filters=args.rest;
var files=fs.readdirSync(path.join(ROOT,"dev")).filter(function(f){return /^sabotage-.*\.js$/.test(f);}).sort();
if(filters.length)files=files.filter(function(f){return filters.some(function(w){return f.indexOf(w)>=0;});});
if(!files.length){console.error("no batteries matched");process.exit(2);}
var t0=Date.now();
console.log("run-sabotage-all: "+files.length+" batteries, "+Math.min(args.jobs,files.length)+" at a time");
pool.run(files,{cwd:ROOT,jobs:args.jobs},function(v){
  var f=v.file,out=v.out,bad=v.verdict==="fail";
  var caught=(out.match(/✓|caught|PASS/g)||[]).length;
  console.log((bad?"FAIL ":v.verdict==="skip"?"SKIP ":"ok   ")+f+" ("+v.secs+"s, "+caught+" ✓"+(v.flake?", passed only when re-run alone":"")+")");
  v.skipLines.forEach(function(l){console.log(l);});   /* #472: a skip is announced, never folded into the green count */
  if(bad)console.log(out.split("\n").filter(function(l){return /FAIL|NOT on mustFail|no bytes|Error|MISATTRIB/i.test(l);}).slice(0,8).map(function(l){return "     "+l;}).join("\n"));
},function(results){
  var failed=results.filter(function(r){return r.verdict==="fail";}),skipped=results.filter(function(r){return r.verdict==="skip";}),flaky=results.filter(function(r){return r.flake;});
  var skipNote=skipped.length?"; "+skipped.length+" SKIPPED, clauses NOT proven here — "+skipped.map(function(r){return r.file;}).join(", "):"";
  var flakeNote=flaky.length?"; "+flaky.length+" passed only when re-run alone (flaky under load, look into it) — "+flaky.map(function(r){return r.file;}).join(", "):"";
  console.log("\n"+(failed.length?"SABOTAGE ALL: "+failed.length+" of "+results.length+" batteries FAILED — "+failed.map(function(r){return r.file;}).join(", "):"SABOTAGE ALL: "+(results.length-skipped.length)+" batteries green")+flakeNote+skipNote+" ("+Math.round((Date.now()-t0)/60000)+" min)");
  process.exitCode=failed.length?1:0;
});
