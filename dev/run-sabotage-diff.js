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
if(diff.status!==0){console.log("run-sabotage-diff: no diff available ("+String(diff.stderr||"").trim()+") — nothing to run");process.exit(0);}
var changed=diff.stdout.split(/\r?\n/).map(function(s){return s.trim().replace(/\\/g,"/");}).filter(Boolean);
if(!changed.length){console.log("run-sabotage-diff: no changed files in "+range);process.exit(0);}
var batteries=fs.readdirSync(path.join(ROOT,"dev")).filter(function(f){return /^sabotage-.*\.js$/.test(f)&&f!=="sabotage.js";});
var due=[];
batteries.forEach(function(f){
  var src=fs.readFileSync(path.join(ROOT,"dev",f),"utf8");
  /* #472: a quoted key ("file": "x") counts too — sabotage-blueprint-catalog.js declares its target that way and was never
     scheduled; the boundary keeps a key like profile: from reading as file: */
  var targets=require("./battery-targets.js").targetsOf(src);/* #599 (d2), review 4: the prove("file", …) wrapper counts too — 78 batteries were invisible to this sweep */
  var hit=changed.indexOf("dev/"+f)>=0||targets.some(function(t){return changed.indexOf(t)>=0;});
  if(hit)due.push(f);
});
if(!due.length){console.log("run-sabotage-diff: "+changed.length+" changed file(s), no battery targets them");process.exit(0);}
console.log("run-sabotage-diff: "+due.length+" battery(ies) target changed files — "+due.join(", "));
console.log("run-sabotage-diff: "+Math.min(args.jobs,due.length)+" at a time (--jobs=N or SABOTAGE_JOBS=N to change)");
var failed=[],skipped=[],flaky=[];
pool.run(due,{cwd:ROOT,jobs:args.jobs},function(v){
  var f=v.file,out=v.out;
  console.log((v.verdict==="fail"?"FAIL ":v.verdict==="skip"?"SKIP ":"ok   ")+f+" ("+v.secs+"s"+(v.flake?", passed only when re-run alone":"")+")");
  if(v.verdict==="fail"){failed.push(f);console.log(out.split("\n").slice(-25).join("\n"));}
  if(v.verdict==="skip"){skipped.push(f);v.skipLines.forEach(function(l){console.log(l);});}   /* re-echoed: an Actions ::warning registers only from the step's own stdout */
  if(v.flake)flaky.push(f);
},function(){
  if(flaky.length)console.log("run-sabotage-diff: "+flaky.length+" battery(ies) failed beside others and passed only when re-run alone — flaky under load, look into it: "+flaky.join(", "));
  if(failed.length){console.error("run-sabotage-diff: FAILED — "+failed.join(", "));process.exitCode=1;return;}
  console.log("run-sabotage-diff: all due batteries green"+(skipped.length?" — except "+skipped.length+" SKIPPED, whose clauses were NOT proven here: "+skipped.join(", "):""));
});
