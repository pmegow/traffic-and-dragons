#!/usr/bin/env node
// run-sabotage-diff.js — the pre-merge rule (#312 ①): a battery touched by a change runs in that
// change. Reads the files changed in the commit range (default HEAD~1..HEAD; pass a range as
// argv[2]), finds every dev/sabotage-*.js whose `file:` targets include one of them (or which is
// itself changed), and runs those batteries. Nothing matched → exits 0 and says so.
// Several at a time (dev/battery-pool.js): --jobs=N or SABOTAGE_JOBS=N, default half the cores up to 8 (16 was tried on 2026-10-09 and rolled back — see battery-pool.js); 1 = one by one.
"use strict";
var fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process"),pool=require("./battery-pool.js");
var ROOT=path.join(__dirname,"..");
var args;try{args=pool.jobsFrom(process.argv.slice(2),process.env,os.cpus().length);}catch(e){console.error("run-sabotage-diff: "+e.message);process.exit(2);}
var range=args.rest[0]||"HEAD~1..HEAD";
var diff=cp.spawnSync("git",["diff","--name-only",range],{cwd:ROOT,encoding:"utf8"});
/* audit 2026-11-19, G9: an unreadable range used to exit 0 ("nothing to run") — a green over nothing, on the only sweep a push gets */
if(diff.status!==0){console.error("run-sabotage-diff: could not read the range "+range+" ("+String(diff.stderr||diff.error||"").trim().split(/\r?\n/)[0]+") — NOTHING was proven. Pass a range that exists.");process.exit(2);}
var changed=diff.stdout.split(/\r?\n/).map(function(s){return s.trim().replace(/\\/g,"/");}).filter(Boolean);
if(!changed.length){console.log("run-sabotage-diff: no changed files in "+range);process.exit(0);}
var batteries=fs.readdirSync(path.join(ROOT,"dev")).filter(function(f){return /^sabotage-.*\.js$/.test(f)&&f!=="sabotage.js";});
/* The ONE scheduling rule lives in dev/battery-targets.js (due): a battery that changed, or one that targets a changed file — by its
   text (file: "x", "file": "x", prove("x", …); #472, #599 (d2)) or by what it HANDS the harness (collected; audit 2026-11-19 G2:
   a wrapper named proveV or a target held in a variable hid 94 clauses from this sweep, 19 of them on memory.js). */
var T=require("./battery-targets.js"),more,sources={};
try{more=T.collected(ROOT);}catch(e){console.error("run-sabotage-diff: could not read what the batteries target ("+(e&&e.message||e)+") — refusing to schedule from a partial list");process.exit(2);}
batteries.forEach(function(f){sources[f]=fs.readFileSync(path.join(ROOT,"dev",f),"utf8");});
var due=T.due(changed,sources,more);
if(!due.length){console.log("run-sabotage-diff: "+changed.length+" changed file(s), no battery targets them");process.exit(0);}
console.log("run-sabotage-diff: "+due.length+" battery(ies) target changed files — "+due.join(", "));
console.log("run-sabotage-diff: "+Math.min(args.jobs,due.length)+" at a time (--jobs=N or SABOTAGE_JOBS=N to change)");
var failed=[],skipped=[],flaky=[];
pool.run(due,{cwd:ROOT,jobs:args.jobs},function(v){
  var f=v.file,out=v.out;
  console.log((v.verdict==="fail"?"FAIL ":v.verdict==="skip"?"SKIP ":"ok   ")+f+" ("+v.secs+"s"+(v.flake?", passed only when re-run alone":"")+")"+(String(out||"").indexOf("scratch-contract-sabotage:")>=0?" [contract harness]":""));/* #609: which harness ran it */
  if(v.verdict==="fail"){failed.push(f);console.log(out.split("\n").slice(-25).join("\n"));}
  if(v.verdict==="skip"){skipped.push(f);v.skipLines.forEach(function(l){console.log(l);});}   /* re-echoed: an Actions ::warning registers only from the step's own stdout */
  if(v.flake)flaky.push(f);
},function(){
  if(flaky.length)console.log("run-sabotage-diff: "+flaky.length+" battery(ies) failed beside others and passed only when re-run alone — flaky under load, look into it: "+flaky.join(", "));
  if(failed.length){console.error("run-sabotage-diff: FAILED — "+failed.join(", "));process.exitCode=1;return;}
  console.log("run-sabotage-diff: all due batteries green"+(skipped.length?" — except "+skipped.length+" SKIPPED, whose clauses were NOT proven here: "+skipped.join(", "):""));
});
