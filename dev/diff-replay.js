// diff-replay.js — corpus SMOKE-REPLAY (DEV TOOL). Replays a harness corpus's RAW GM responses
// through applyMuts (the tag table — the only parser since v1.261) and fails on any throw or
// per-handler error (R.errors). Serializes the end state to <corpus>.endstate.json so replay
// results are byte-comparable across engine versions: an item that deliberately changes mutation
// behavior must enumerate exactly which turns' diffs it expects (HANDOFF_batch_v1260.md, shared
// verification kit); anything unexplained is a defect.
// History: this file was the UA1 dual-parser parity replayer (shadow v1.241 → cutover v1.258);
// the legacy parser it diffed against was deleted at v1.261 after the soak finished clean.
// Usage: node dev/diff-replay.js <corpus.json>
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
// Full canonical engine load (dev/load-engine.js, AUDIT_FABLE_07_16_2026 #18). The old
// hand-copied 11-file list here was a ROTTED copy, not a curation — it predated
// campaign_generator.js (v1.290) and never picked up tts.js; loading the full 13 was
// verified to leave all four corpus end states byte-identical (neither file touches
// applyMuts/worldState at load). UI stubs below are assigned AFTER the load, so they win.
var engine = require("./load-engine.js");
engine.loadEngine();

// UI stubs (same shape as the engine-test harness)
var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};/* REST handler reaches these live (found replaying the tagsoak corpus at v1.257) */
checkLegacyCharacter=function(){}; // random — stubbed for a deterministic replay
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

var corpusPath = process.argv[2] || "dev/corpus_playtest_v1238.json";
var corpus = JSON.parse(fs.readFileSync(path.join(root, corpusPath), "utf8"));

// Vex Marrowlight's exact start state (the corpus campaign's turn-0 shape), built on the
// shared fixture (#19). The `character` override REPLACES the base character WHOLESALE
// (makeTestWorld's shallow-merge contract) — Vex is a FROZEN corpus-era snapshot and must
// stay byte-exact: the committed *.endstate.json files were generated from this shape, so
// "modernizing" it (e.g. adding coreMemories:[], v1.304) would dirty all four end states
// and break the tool's cross-version byte-comparability. Do NOT update Vex to schema
// changes unless you deliberately regenerate every committed end state in the same commit.
engine.makeTestWorld({ campId:"replay", campName:"Replay", turn:0,
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
  world:{ location:"The Crossroads of Ashenveil", region:"The Blighted Reach", time:"dusk", weather:"ash-fall", threat:"low", sublocation:null } });

var raws = corpus.raw || [];
console.log("Smoke-replaying " + raws.length + " raw GM responses through the table parser…");
var errTurns = [];
for (var i = 0; i < raws.length; i++) {
  worldState.turn = raws[i].turn || (i + 1); // sendAction increments BEFORE applyMuts
  try {
    var R = applyMuts(raws[i].raw);
    if (R && R.errors && R.errors.length) errTurns.push(raws[i].turn + ": " + R.errors.join("; "));
  } catch (e) { errTurns.push(raws[i].turn + ": THREW " + e.message); }
}
console.log("── smoke-replay complete ── handler errors: " + errTurns.length);
for (var j = 0; j < errTurns.length; j++) console.log("  ✗ " + errTurns[j]);
console.log("end-state sanity: hp " + worldState.character.hp + "/" + worldState.character.maxHp
  + " | xp " + worldState.character.xp + " | quests archived " + Object.keys(memory.quests || {}).length
  + " | npcs " + worldState.npcs.length + " | spells " + worldState.character.spells.map(function(s){return s.nm.split(" (")[0]+":"+(s.used?"USED":"ok");}).join(", "));
// End-state serialization — the byte-identity evidence for cross-version comparisons (item 0 ⑥).
fs.writeFileSync(path.join(root, corpusPath + ".endstate.json"),
  JSON.stringify({ ws: worldState, mem: memory }), "utf8");
console.log("end state -> " + corpusPath + ".endstate.json");
process.exit(errTurns.length === 0 ? 0 : 1);
