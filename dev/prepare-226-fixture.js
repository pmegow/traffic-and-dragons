// prepare-226-fixture.js — reproduce the frozen TODO #226 mature-campaign fixture.
var fs=require("fs"),path=require("path"),core=require("./fixture-226.js");
var ROOT=path.join(__dirname,"..");
var input=process.argv[2]||"testRuns/Rise_of_the_Runelords__Ammut__Ammut_t2097.tnd";
var output=process.argv[3]||"testRuns/fixtures/todo-226-mature-t2097.tnd";
var source=JSON.parse(fs.readFileSync(path.join(ROOT,input),"utf8"));
var prepared=core.prepare(source),text=JSON.stringify(prepared.save)+"\n";
var manifest=core.manifestFor(prepared,text,{fixture:output,source:path.basename(input)});
var outPath=path.join(ROOT,output),manifestPath=outPath.replace(/\.tnd$/,".manifest.json");
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,text);fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log("TODO #226 fixture prepared: t"+manifest.counts.turn+", "+manifest.counts.transcript+" transcript entries, "+manifest.counts.npcs+" NPCs, "+manifest.counts.quests+" quest(s), "+manifest.counts.chapters+" memory chapters; portraits/credentials absent");
