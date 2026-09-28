#!/usr/bin/env node
// run-sabotage-diff.js — the pre-merge rule (#312 ①): a battery touched by a change runs in that
// change. Reads the files changed in the commit range (default HEAD~1..HEAD; pass a range as
// argv[2]), finds every dev/sabotage-*.js whose `file:` targets include one of them (or which is
// itself changed), and runs those batteries. Nothing matched → exits 0 and says so.
"use strict";
var fs=require("fs"),path=require("path"),cp=require("child_process"),verdict=require("./battery-verdict.js");
var ROOT=path.join(__dirname,"..");
var range=process.argv[2]||"HEAD~1..HEAD";
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
  var targets=[],m,re=/(^|[^\w$])["']?file["']?\s*:\s*["']([^"']+)["']/g;while((m=re.exec(src)))targets.push(m[2].replace(/\\/g,"/"));
  var hit=changed.indexOf("dev/"+f)>=0||targets.some(function(t){return changed.indexOf(t)>=0;});
  if(hit)due.push(f);
});
if(!due.length){console.log("run-sabotage-diff: "+changed.length+" changed file(s), no battery targets them");process.exit(0);}
console.log("run-sabotage-diff: "+due.length+" battery(ies) target changed files — "+due.join(", "));
var failed=[],skipped=[];
due.forEach(function(f){
  var r=cp.spawnSync(process.execPath,["dev/"+f],{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024});
  var out=(r.stdout||"")+(r.stderr||""),v=verdict.classify(r.status,out);
  console.log((v.verdict==="fail"?"FAIL ":v.verdict==="skip"?"SKIP ":"ok   ")+f);
  if(v.verdict==="fail"){failed.push(f);console.log(out.split("\n").slice(-25).join("\n"));}
  if(v.verdict==="skip"){skipped.push(f);v.skipLines.forEach(function(l){console.log(l);});}   /* re-echoed: an Actions ::warning registers only from the step's own stdout */
});
if(failed.length){console.error("run-sabotage-diff: FAILED — "+failed.join(", "));process.exit(1);}
console.log("run-sabotage-diff: all due batteries green"+(skipped.length?" — except "+skipped.length+" SKIPPED, whose clauses were NOT proven here: "+skipped.join(", "):""));
