// capture-prompt.js — DEV TOOL (the /thursday ladder, rung 3): render buildSysPrompt() for a REAL
// save and write both halves to files, so the week's shipped prompt changes can be diffed against
// last Thursday's engine on the owner's own campaigns — the drift decree's "prompt diff against
// real transcripts", done in batch instead of per change. Read-only on the save: it is loaded
// straight into worldState / memory / sessionLog (the probe-gemini-empty pattern), NEVER through
// importSaveData, which snapshots and repoints the active campaign.
//
// Usage: node dev/capture-prompt.js <save.tnd> <outdir>
// Writes <outdir>/stable.txt and <outdir>/volatile.txt; prints campaign, turn, sizes and a short
// sha256 of each half. Run it once in the working tree and once in a `git worktree` checked out at
// the previous receipt's anchor commit, then diff the two outdirs — every hunk must be attributable
// to a shipped TODO row, and with no prompt-changing row shipped the stable half must be byte-
// identical (the cached half is money). buildSysPrompt reads no wall clock and does not branch on
// the provider (checked 2026-09-24), so two captures of one save differ only by engine version.
var fs=require("fs"),path=require("path"),crypto=require("crypto");
var engine=require("./load-engine.js");engine.loadEngine("game.js");
var args=process.argv.slice(2),save=args[0],out=args[1];
if(!save||!out){console.error("usage: node dev/capture-prompt.js <save.tnd> <outdir>");process.exit(2);}
var raw=JSON.parse(fs.readFileSync(save,"utf8"));
if(!raw.worldState||!raw.worldState.character){console.error("not a save (no worldState.character): "+save);process.exit(2);}
worldState=inflateWorldStateSnapshot(raw.worldState);memory=raw.memory||memory;sessionLog=raw.sessionLog||[];
var sys=buildSysPrompt();
if(!sys||typeof sys.stable!=="string"||typeof sys.volatile!=="string"){console.error("buildSysPrompt did not return {stable, volatile} strings");process.exit(1);}
fs.mkdirSync(out,{recursive:true});
function put(name,text){
  var p=path.join(out,name);fs.writeFileSync(p,text,"utf8");
  var h=crypto.createHash("sha256").update(text,"utf8").digest("hex").slice(0,12);
  console.log("  "+name+"  "+text.length+" chars  sha256 "+h);
}
console.log((worldState.campName||"?")+" — "+((worldState.character&&worldState.character.name)||"?")+" — turn "+(worldState.turn||0)+" — APP_VERSION "+(typeof APP_VERSION==="undefined"?"?":APP_VERSION)+" -> "+out);
put("stable.txt",sys.stable);put("volatile.txt",sys.volatile);
