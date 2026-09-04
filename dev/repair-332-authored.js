// Dry run by default; --write creates a separate export and refuses to overwrite any file.
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();
var input=process.argv[2],bpPath=process.argv[3],write=process.argv.indexOf("--write")>=0;
if(!input||!bpPath)throw new Error("Usage: node dev/repair-332-authored.js SAVE.tnd SOURCE.blueprint [--write]");
var raw=JSON.parse(fs.readFileSync(input,"utf8")),bp=JSON.parse(fs.readFileSync(bpPath,"utf8"));
if(!raw.worldState||!raw.memory||!Array.isArray(raw.sessionLog))throw new Error("Expected a complete campaign export");
if(raw.worldState.blueprintName!==bp.name||bp.name!=="The Iron Meridian")throw new Error("Save and source must both identify The Iron Meridian");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog;
var before=JSON.stringify(worldState),log=JSON.stringify(sessionLog),archive=JSON.stringify(memory.archive);
var result=restoreAuthoredDossiers(bp,["Overseer Kolm","Ambassador Ferrin Lyle"]);
if(result.missing.length)throw new Error("Authored-source evidence missing: "+result.missing.join(", "));
if(JSON.stringify(worldState)!==before||JSON.stringify(sessionLog)!==log||JSON.stringify(memory.archive)!==archive)throw new Error("Repair changed world, transcript, session or archive");
console.log(JSON.stringify(result));
if(write){
  var output=path.join(path.dirname(path.resolve(input)),path.basename(input,path.extname(input))+"_AUTHORED_REPAIRED.tnd");
  fs.writeFileSync(output,JSON.stringify(raw),{flag:"wx"});console.log("Repaired export: "+output);
}else console.log("Dry run: source export unchanged. Add --write to create a separate repaired export.");
