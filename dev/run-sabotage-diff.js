#!/usr/bin/env node
// run-sabotage-diff.js — the pre-merge rule (#312 ①): a battery touched by a change runs in that
// change. Reads the files changed in the commit range (default HEAD~1..HEAD; pass a range as
// argv[2]), finds every dev/sabotage-*.js whose `file:` targets include one of them (or which is
// itself changed), and runs those batteries. Nothing matched → exits 0 and says so.
"use strict";
var fs=require("fs"),path=require("path"),cp=require("child_process");
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
  var targets=[],m,re=/file\s*:\s*["']([^"']+)["']/g;while((m=re.exec(src)))targets.push(m[1].replace(/\\/g,"/"));
  var hit=changed.indexOf("dev/"+f)>=0||targets.some(function(t){return changed.indexOf(t)>=0;});
  if(hit)due.push(f);
});
if(!due.length){console.log("run-sabotage-diff: "+changed.length+" changed file(s), no battery targets them");process.exit(0);}
console.log("run-sabotage-diff: "+due.length+" battery(ies) target changed files — "+due.join(", "));
var failed=[];
due.forEach(function(f){
  var r=cp.spawnSync(process.execPath,["dev/"+f],{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024});
  var out=(r.stdout||"")+(r.stderr||"");
  var bad=r.status!==0||/NOT on mustFail|no bytes changed|MISATTRIBUT/i.test(out);
  console.log((bad?"FAIL ":"ok   ")+f);
  if(bad){failed.push(f);console.log(out.split("\n").slice(-25).join("\n"));}
});
if(failed.length){console.error("run-sabotage-diff: FAILED — "+failed.join(", "));process.exit(1);}
console.log("run-sabotage-diff: all due batteries green");
