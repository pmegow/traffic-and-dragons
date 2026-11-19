var LE=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
LE.loadEngine();LE.makeTestWorld();
global.showToast=function(m){};global.addMsg=function(){return {appendChild:function(){},style:{},remove:function(){}}};
global.syncUI=function(){};global.saveAll=function(){};global.saveCore=function(){};global.saveMem=function(){};
global.showRewardClaimModal=function(){};
if(typeof GM_XP_CAP_PER_LEVEL!=="undefined")GM_XP_CAP_PER_LEVEL=1e9;
worldState.turn=50;
// One unresolved identity conflict past its stale threshold, carrying a withheld 50 XP reward.
worldState.identityConflicts=[{subject:"Bob",handle:"-",reason:"no scene evidence",withheld:["[XP:50]"],attempts:IDENTITY_CONFLICT_STALE_ATTEMPTS+1,lastFired:0,resolved:false}];
var xp0=worldState.character.xp;
// The sendAction sequence: #151 snapshot, then the notes build (this shelves the conflict and queues the claim).
var snap=snapshotNoteLatches();
buildEngineNotes();
var q1=(worldState.pendingRewardClaims||[]).slice();
console.log("claims queued after shelve:",q1.length,q1.map(function(c){return c.tokens.join("");}));
// While the turn is still waiting on the provider, the player accepts the claim the modal showed.
if(q1.length)rewardClaimAccept(q1[0].id);
console.log("xp after first accept:",worldState.character.xp-xp0);
// The provider call fails before commit: sendAction's catch restores the latches.
restoreNoteLatches(snap);
console.log("conflict after restore: stale=",worldState.identityConflicts[0].stale,"withheld=",JSON.stringify(worldState.identityConflicts[0].withheld));
// Next turn.
worldState.turn=51;var snap2=snapshotNoteLatches();buildEngineNotes();
var q2=(worldState.pendingRewardClaims||[]).slice();
console.log("claims queued on the next turn:",q2.length);
if(q2.length)rewardClaimAccept(q2[0].id);
console.log("total xp paid for the one withheld reward:",worldState.character.xp-xp0);
