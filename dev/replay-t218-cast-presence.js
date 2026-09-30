// replay-t218-cast-presence.js — the #481 B1 + B2 acceptance replay against the owner's real Village saves. MANUAL (the saves are
// gitignored; this never runs in CI). Read-only: loads the t213 save into process memory, applies the five raw GM replies of
// t214–t218 carried in the t218 save's sessionLog, and writes nothing back. Proves, on the chain the incident happened in:
//   ① t218: Thessa Saltborn and The Entity spoke while the cast named only the hero — they are NOT placed in the Village
//     Hall (lastSeenAt stays where t217's cast put them, the tavern), and the Hall's guestbook carries no t218 stamp for them;
//   ② the one-shot CAST CHECK note is armed naming them;
//   ③ t217: the cast named them and they are placed in the tavern (a cast speaker is placed — the rule withholds nothing else).
// Usage: node dev/replay-t218-cast-presence.js [Campaigns/The_Village__Ammut_/saves]
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();
var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};
function fail(msg){console.error("#481 B1/B2 ACCEPTANCE REPLAY FAILED: "+msg);process.exit(1);}
var dir=process.argv[2]||"Campaigns/The_Village__Ammut_/saves";
function load(f){var p=path.resolve(dir,f);if(!fs.existsSync(p))fail("missing save "+p+" (this replay needs the owner's Village saves)");return JSON.parse(fs.readFileSync(p,"utf8"));}
var base=load("The_Village__Ammut__Ammut_t213.tnd"),tail=load("The_Village__Ammut__Ammut_t218.tnd");
worldState=base.worldState;memory=base.memory;sessionLog=base.sessionLog||[];
migrateWorldState();healMemory();
var replies=(tail.sessionLog||[]).filter(function(e){return e.role==="assistant";}).map(function(e){return e.content;});
if(replies.length<5)fail("the t218 sessionLog holds "+replies.length+" replies; t214–t218 need five");
replies=replies.slice(-5);
var turn=worldState.turn,results=[],i;
for(i=0;i<replies.length;i++){worldState.turn=++turn;var R=applyMuts(replies[i],{deferSave:true});results.push({turn:turn,muts:(R&&R.muts)||[]});}
if(turn!==218)fail("the chain should end at t218, ended at t"+turn);
function seen(n){var m=memory.npcs[resolveNpcName(n)];return m?{at:m.lastSeenAt,turn:m.lastSeenTurn}:null;}
var hall=null,k;for(k in memory.map.nodes)if(/\|the village hall$/i.test(k)&&!/\|.*\|/.test(k))hall=k;
var th=seen("Thessa Saltborn"),en=seen("The Entity");
console.log("t218 Present:",(results[4].muts.filter(function(m){return /^Present:/.test(m);})[0]||"(none)"));
console.log("Thessa Saltborn last seen:",JSON.stringify(th),"| The Entity last seen:",JSON.stringify(en),"| Hall:",hall);
if(!th||!en)fail("both residents must be on the roster");
if(th.at===hall||en.at===hall)fail("① a speaker the t218 cast left out was placed in the Hall");
if(!/tavern/i.test(th.at)||!/tavern/i.test(en.at))fail("③ t217's cast placed them in the tavern; the record lost it");
var gb=hall&&memory.map.nodes[hall].guestbook||{},stamped=["Thessa Saltborn","The Entity"].filter(function(n){var r=gb[resolveNpcName(n)];return r&&(r.turns||[]).indexOf(218)>=0;});
if(stamped.length)fail("① the Hall guestbook stamped "+stamped.join(", ")+" at t218");
var p=worldState.castSpeakerPing;if(!p||p.names.indexOf("Thessa Saltborn")<0||p.names.indexOf("The Entity")<0)fail("② the CAST CHECK note is not armed for both: "+JSON.stringify(p));
console.log("#481 B1 ACCEPTANCE REPLAY PASSED — t218's out-of-cast speakers stay in the tavern; the Hall has no stamp for them; the cast check is armed for "+p.names.join(", ")+".");
// #481 B2 on the same chain: the hero walked out alone at t213 and every cast since named only the hero (or the hero and the
// tavern's people), so the companions who stayed home get no arrival stamps — none at the tavern at t217, none in the Hall at
// t218 — and ONE ask for [PARTY_SPLIT:] names them (the cooldown keeps it from re-arming every turn).
var wives=(worldState.npcs||[]).filter(function(n){return n&&n.partyMember&&!(typeof npcIsDead==="function"&&npcIsDead(n))&&!(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location);}).map(function(n){return n.name;});
if(!wives.length)fail("④ the save should carry the hero's companions as unsplit party members");
var tav=null;for(k in memory.map.nodes)if(/\|the tavern$/i.test(k))tav=k;
function stampedAt(key,name,t){var r=key&&memory.map.nodes[key].guestbook&&memory.map.nodes[key].guestbook[resolveNpcName(name)];return !!(r&&(r.turns||[]).indexOf(t)>=0);}
var falseVisits=[];wives.forEach(function(w){if(stampedAt(hall,w,218))falseVisits.push(w+"@Hall t218");if(stampedAt(tav,w,217))falseVisits.push(w+"@tavern t217");});
if(falseVisits.length)fail("④ companions the casts left out were stamped: "+falseVisits.join(", "));
var q=worldState.castOmitPing;if(!q||wives.some(function(w){return q.names.indexOf(w)<0;}))fail("⑤ the [PARTY_SPLIT:] ask does not name every companion left home: "+JSON.stringify(q)+" vs "+JSON.stringify(wives));
console.log("#481 B2 ACCEPTANCE REPLAY PASSED — "+wives.join(", ")+" have no t217 tavern or t218 Hall stamps; the split ask names them.");
