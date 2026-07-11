// diff-replay.js — UA1 corpus replay (DEV TOOL). Replays a harness corpus's RAW GM responses
// through applyMuts with TAG_SHADOW on: every response runs the old parser (authoritative) AND
// the tag table (on cloned state), diffing end states. Zero diffs across a real-model corpus is
// the evidence the shadow-mode commit stands on.  Usage: node dev/diff-replay.js <corpus.json>
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var geval = eval;
["globals.js","compress.js","data.js","capability_bible.js","helpers.js","state.js","storage-adapter.js","memory.js","tag_table.js","api.js","game.js"].forEach(function(f){geval(fs.readFileSync(path.join(root,f),"utf8"));});

// UI stubs (same shape as the engine-test harness)
var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};/* REST handler reaches these live (found replaying the tagsoak corpus at v1.257) */
checkLegacyCharacter=function(){}; // random — stubbed on BOTH sides for a deterministic replay
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

var corpusPath = process.argv[2] || "dev/corpus_playtest_v1238.json";
var corpus = JSON.parse(fs.readFileSync(path.join(root, corpusPath), "utf8"));

// Vex Marrowlight's exact start state (the corpus campaign's turn-0 shape).
memory = blankMemory(); sessionLog = [];
worldState = { ver:10, campId:"replay", campName:"Replay", legacyCharsUsed:[], pendingLegacy:null,
  character:{ name:"Vex Marrowlight", gender:"F", age:"late twenties",
    appear:"Wiry, quick-eyed, ink-stained fingers; a grey hood over dark braids.", mark:"",
    backstory:"A copyist's apprentice who learned that the right whisper opens more doors than any key.",
    ancestry:"human", subrace:"northlander", subraceNm:"Northlander", heritageVariant:"",
    cls:"Rogue", stats:{STR:10,DEX:16,CON:14,INT:14,WIS:10,CHA:12}, hp:24, maxHp:24, gold:40,
    inventory:["Short blade","Short blade (backup)","Leather armor","Lockpicks","Smoke powder","Travel rations (3 days)","First aid kit"],
    level:3, xp:900,
    abilities:[{nm:"Sneak Attack",ds:"Double damage dice when unseen or flanking."},{nm:"Evasion",ds:"On a failed DEX save, take half damage instead of full."},{nm:"Lockpick",ds:"Open locks and bypass traps with a DEX check."},{nm:"Arcane Trickster",ds:"Illusion and enchantment spells. Mage Hand for theft. Distract and confuse."}],
    spells:[{nm:"Mage Hand (invisible, 30ft)",lvl:0,used:false},{nm:"Message (whisper 120ft, target replies)",lvl:0,used:false},{nm:"Charm Person (charmed 1 hour)",lvl:1,used:false},{nm:"Silent Image (visual illusion)",lvl:1,used:false}],
    archetype:"arcanetrickster", archetypeNm:"Arcane Trickster",
    statedAlignment:"Chaotic Neutral", actualAlignment:"Chaotic Neutral", alignLaw:-1, alignGood:0, deity:"",
    trait:"", flaw:"", motivation:"", languages:[{name:"Common",broken:false}], skills:initSkills(),
    conditions:[], relationships:[], saveModifiers:[], portrait:null, storyBeats:[], partyMember:true },
  world:{ location:"The Crossroads of Ashenveil", region:"The Blighted Reach", time:"dusk", weather:"ash-fall", threat:"low", sublocation:null },
  npcs:[], questLog:[], eventHistory:[], combat:null, turn:0, transcript:[], ragMemory:false };

var raws = corpus.raw || [];
console.log("Replaying " + raws.length + " raw GM responses with shadow parity active…");
var perTurn = [];
for (var i = 0; i < raws.length; i++) {
  var before = __tagDiffCount;
  worldState.turn = raws[i].turn || (i + 1); // sendAction increments BEFORE applyMuts
  try { applyMuts(raws[i].raw); }
  catch (e) { console.error("  turn " + raws[i].turn + ": applyMuts THREW: " + e.message); }
  if (__tagDiffCount !== before) perTurn.push(raws[i].turn);
}
console.log("── replay complete ──");
console.log("parity runs: " + __tagParityRuns + " | diffs: " + __tagDiffCount + (perTurn.length ? " (turns: " + perTurn.join(", ") + ")" : ""));
console.log("end-state sanity: hp " + worldState.character.hp + "/" + worldState.character.maxHp
  + " | xp " + worldState.character.xp + " | quests archived " + Object.keys(memory.quests || {}).length
  + " | npcs " + worldState.npcs.length + " | spells " + worldState.character.spells.map(function(s){return s.nm.split(" (")[0]+":"+(s.used?"USED":"ok");}).join(", "));
process.exit(__tagDiffCount === 0 ? 0 : 1);
