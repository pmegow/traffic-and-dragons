// tag-census.js — the never-emitted tag census (#311). DEV TOOL, node-only, read-only.
//   node dev/tag-census.js [corpus.json …] [save.tnd]
// Counts, for every tag the STATE TAGS doc teaches (plus the engine-only tier), how many recorded
// GM responses emitted it across the given corpora (default: every dev/corpus_*.json) and the
// last-40-response working set of an optional .tnd save's tag log. Prints WORKING (≥20 responses),
// RARE (1–19) and NEVER, and flags an engine-only tag no note teaches. Exit 0 always — this is a
// census, not a gate; the verdict belongs in the audit that reads it.
var fs=require("fs"),path=require("path");
var ROOT=path.join(__dirname,"..");
var engine=require("./load-engine.js");engine.loadEngine("api.js");
var args=process.argv.slice(2),corpora=[],save=null;
args.forEach(function(a){if(/\.tnd$/i.test(a))save=a;else corpora.push(a);});
if(!corpora.length)corpora=fs.readdirSync(path.join(ROOT,"dev")).filter(function(f){return /^corpus_.*\.json$/.test(f)&&!/endstate/.test(f);}).map(function(f){return path.join(ROOT,"dev",f);});
var perTag={},nResp=0;
corpora.forEach(function(f){var d;try{d=JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){console.warn("skip "+f+": "+e.message);return;}
  var raws=(d.raw||[]).map(function(r){return typeof r==="string"?r:(r&&(r.raw||r.text))||"";}).filter(Boolean);
  raws.forEach(function(r){nResp++;var seen={},m,re=/\[([A-Z][A-Z_]+)(?=[:\]|])/g;while((m=re.exec(r))){if(!seen[m[1]]){seen[m[1]]=1;perTag[m[1]]=(perTag[m[1]]||0)+1;}}});
});
var logTags={};
if(save){try{var sv=JSON.parse(fs.readFileSync(save,"utf8"));(sv.worldState&&sv.worldState.tagLog||[]).forEach(function(e){(e.tags||[]).forEach(function(t){logTags[t]=(logTags[t]||0)+1;});});}catch(e){console.warn("save unreadable: "+e.message);}}
var docTags={};TAG_DOC_LINES.forEach(function(l){var m,re=/\[([A-Z][A-Z_]+)(?=[:\]|])/g;while((m=re.exec(l)))docTags[m[1]]=1;});
(typeof TAG_DOC_ENGINE_ONLY!=="undefined"?TAG_DOC_ENGINE_ONLY:[]).forEach(function(t){docTags[t]=1;});
var names=Object.keys(docTags).sort(function(a,b){return (perTag[b]||0)-(perTag[a]||0);});
function line(t){return t+"("+(perTag[t]||0)+(logTags[t]?"/L"+logTags[t]:"")+")";}
var working=names.filter(function(t){return (perTag[t]||0)>=20;}),rare=names.filter(function(t){var n=perTag[t]||0;return n>0&&n<20;}),never=names.filter(function(t){return !(perTag[t]||0);});
console.log("corpora: "+corpora.length+" file(s), "+nResp+" recorded GM responses"+(save?"; save tag log: "+Object.keys(logTags).length+" names":""));
console.log("WORKING ("+working.length+"): "+working.map(line).join(" "));
console.log("RARE ("+rare.length+"): "+rare.map(line).join(" "));
console.log("NEVER ("+never.length+"): "+never.map(line).join(" "));
if(typeof TAG_DOC_ENGINE_ONLY!=="undefined"){var src=["api.js","identity.js","memory.js","clock.js"].map(function(f){return fs.readFileSync(path.join(ROOT,f),"utf8");}).join("\n");
  TAG_DOC_ENGINE_ONLY.forEach(function(t){if(src.indexOf(t+":")<0)console.log("⚠ engine-only tag "+t+" is taught by no engine note");});
  console.log("engine-only tier: "+TAG_DOC_ENGINE_ONLY.join(", "));}
