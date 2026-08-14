// replay-t1728-guestbook.js — the #173 acceptance replay on the REAL field save.
// The t1728 failure: Frizwick said "Last time we saw it, it looked like a wound in the mountain"
// about Jorgenfist — a visit she was not on (t1590 sent her alone to Sandpoint; t1594 names only
// Ammut, Morwen and Daeris continuing into the mountains). The engine had no representation that
// could answer "who was here on the previous visit", so the model collectivized the subgroup's
// past. This replay drives the ratified failure-first sequence against the exported save:
//   split Frizwick to Sandpoint → three-person Jorgenfist visit → rejoin → four-person return.
// PASS = Ammut/Morwen/Daeris carry BOTH Jorgenfist turns, Frizwick only the return, and
// resident-only Ameiko has NO fabricated visit turn. Read-only: mutations stay in process memory.
// Usage: node dev/replay-t1728-guestbook.js [path-to-t1728.tnd]
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
showArchetypeModal=function(){};showStatBumpModal=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};
checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){console.error("✗ t1728 GUESTBOOK REPLAY FAILED: "+msg);process.exit(1);}
function ok(msg){console.log("✓ "+msg);}

var savePath=process.argv[2]||path.join(__dirname,"..","testRuns","Rise_of_the_Runelords__Ammut__Ammut_t1728.tnd");
savePath=path.resolve(savePath);
if(!fs.existsSync(savePath))fail("save not found: "+savePath+" (pass the t1728 .tnd path)");
var raw=JSON.parse(fs.readFileSync(savePath,"utf8"));
if(!raw.worldState||!raw.memory)fail("export lacks worldState or memory");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog||[];
migrateWorldState();healMemory();

if(worldState.character.name!=="Ammut")fail("hero is not Ammut: "+worldState.character.name);
var party=["Frizwick","Daeris","Morwen Zethran"],i;
for(i=0;i<party.length;i++){var n=wsNpcByName(party[i]);if(!n||!n.partyMember||npcIsDead(n))fail(party[i]+" is not a living party member in the export");}

// ── the ratified sequence ─────────────────────────────────────────────────────────────────────
worldState.turn++;var tSplit=worldState.turn;
applyMuts("Frizwick rides ahead to warn Hemlock. [PARTY_SPLIT:Frizwick|Sandpoint]");
var fz=wsNpcByName("Frizwick");
if(!fz.charSheet.splitLoc||fz.charSheet.splitLoc.location!=="Sandpoint")fail("split did not record Frizwick at Sandpoint");
var spBook=(memory.map.nodes["Sandpoint"]||{}).guestbook||{};
if(!spBook["Frizwick"]||spBook["Frizwick"].turns.indexOf(tSplit)<0)fail("Frizwick's own Sandpoint arrival unrecorded");
ok("split filed — Frizwick recorded at Sandpoint t"+tSplit);

worldState.turn++;var tVisit=worldState.turn;
applyMuts("The three of you climb toward the fortress gate. [LOCATION:Jorgenfist]");
var jb=(memory.map.nodes["Jorgenfist"]||{}).guestbook;
if(!jb)fail("Jorgenfist has no guestbook after the three-person arrival");
var three=["Ammut","Morwen Zethran","Daeris"];
for(i=0;i<three.length;i++){if(!jb[three[i]]||jb[three[i]].turns.indexOf(tVisit)<0)fail(three[i]+" not recorded at the t"+tVisit+" Jorgenfist visit");}
if(jb["Frizwick"]&&jb["Frizwick"].turns.length)fail("SPLIT Frizwick was stamped at Jorgenfist — the t1728 class survives");
ok("three-person visit recorded t"+tVisit+" — Frizwick excluded while split");

worldState.turn++;
applyMuts("You return to town. [LOCATION:Sandpoint]");
if(!fz.charSheet.splitLoc)fail("co-location at a 23-interior town should be a granularity gap, not an auto-fold (#164)");
worldState.turn++;var tRejoin=worldState.turn;
applyMuts("Frizwick meets you at the gate and embraces all three of you. [PARTY_SPLIT:Frizwick|rejoin]");
if(fz.charSheet.splitLoc)fail("rejoin did not clear the split");
ok("rejoin at Sandpoint t"+tRejoin);

applyMuts("Ameiko waves from behind the Rusty Dragon's bar. [NPC:Ameiko Kaijitsu|cheerful|ally] [LOCATION_RESIDENT:Ameiko Kaijitsu]");
worldState.turn++;var tReturn=worldState.turn;
applyMuts("All four of you ride back into the mountains. [LOCATION:Jorgenfist]");

// ── the acceptance assertions ─────────────────────────────────────────────────────────────────
jb=(memory.map.nodes["Jorgenfist"]||{}).guestbook||{};
for(i=0;i<three.length;i++){
  var tr=jb[three[i]]?jb[three[i]].turns:[];
  if(tr.indexOf(tVisit)<0||tr.indexOf(tReturn)<0)fail(three[i]+" must carry BOTH Jorgenfist turns, got "+JSON.stringify(tr));
}
var frTurns=jb["Frizwick"]?jb["Frizwick"].turns:[];
if(frTurns.indexOf(tVisit)>=0)fail("Frizwick inherited the visit she was not on — the t1728 failure verbatim");
if(frTurns.indexOf(tReturn)<0)fail("Frizwick's actual return visit unrecorded: "+JSON.stringify(frTurns));
ok("Ammut/Morwen/Daeris carry t"+tVisit+"+t"+tReturn+"; Frizwick carries only t"+tReturn);

var am=((memory.map.nodes["Sandpoint"]||{}).guestbook||{})["Ameiko Kaijitsu"];
if(!am)fail("Ameiko has no Sandpoint guestbook record");
if(am.resident!==true)fail("Ameiko not marked resident");
// The [NPC:] write at Sandpoint IS contemporaneous recorded evidence (she was seen at the bar),
// so a visit turn for that moment is legitimate; the ratified constraint is that RESIDENCY alone
// fabricates nothing. Prove it on a resident-only mark at the world node for a character with no
// contemporaneous write:
applyMuts("[LOCATION:Sandpoint]");
applyMuts("[LOCATION_RESIDENT:Sheriff Hemlock]");
var hb=((memory.map.nodes["Sandpoint"]||{}).guestbook||{})["Sheriff Hemlock"]||((memory.map.nodes["Sandpoint"]||{}).guestbook||{})[resolveNpcName("Sheriff Hemlock")];
if(!hb)fail("resident-only mark did not file");
if(hb.resident!==true)fail("resident-only flag missing");
if(hb.turns.length)fail("resident-only record fabricated a visit turn: "+JSON.stringify(hb.turns));
ok("residency records the usual base with NO fabricated visit turn");

// ── projection sanity on the real save ────────────────────────────────────────────────────────
worldState.world.location="Jorgenfist";worldState.world.sublocation=null;
var g=buildGeoBlock();
if(g.toLowerCase().indexOf("no recorded visit")<0)fail("GEO attendance lacks the record-based negative");
if(!/second-hand/i.test(g))fail("GEO attendance lacks the same-turn eyewitness clause");
if(g.indexOf("Frizwick")<0)fail("GEO attendance omits Frizwick's actual record");
ok("GEO projection serves attendance with the record-based negative + eyewitness clause");

console.log("\nALL GREEN — the t1728 field replay passes: visit provenance is per-character.");
