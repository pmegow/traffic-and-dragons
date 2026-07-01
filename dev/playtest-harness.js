// playtest-harness.js — automated multi-turn playtest driver (DEV TOOL, not loaded by index.html)
//
// Purpose: drive N real GM turns end-to-end (real Anthropic API calls) against a throwaway
// character, without a human clicking through the wizard or tapping suggested actions by hand.
// Used to (1) smoke-test invariants — combat panel clears on kill, sessionLog summarizes on
// schedule, HP/gold/XP stay sane, no console errors — and (2) collect a narration corpus you
// (Claude) can read afterward and judge for prose-voice / content-DNA drift over a long run.
//
// HOW TO USE (via preview_eval against a running `npx serve .` instance, fresh browser state):
//
// 1. Clear stale localStorage and reload so you start from a clean slate:
//      (function(){var keep=["tnd_ak_v1","tnd_provider_keys_v1","tnd_provider_models_v1","tnd_provider_v1"];
//        for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);
//        if(k.indexOf("tnd_")===0&&keep.indexOf(k)===-1)localStorage.removeItem(k);}})()
//      window.location.reload()
//    Confirm you land on #char-screen (not a stale #game-screen) before continuing.
//    If tnd_ak_v1 isn't already set, ask the user to enter their API key in the visible
//    preview themselves — never type or paste a real key into eval yourself.
//
// 2. Build a minimal valid v10 character and start the game directly (skips the 7-step wizard).
//    Inspect AUTHORS / TONES / CLSS / ANCS / ABILS live in the page to pick valid ids. Example:
//      (function(){
//        var stats={STR:16,DEX:12,CON:14,INT:10,WIS:10,CHA:13};
//        var hd=CLSS.filter(function(c){return c.id==="Warrior";})[0].hd;
//        var maxHp=hd+Math.floor((stats.CON-10)/2);
//        var char={name:"Test Name",gender:"M",age:"30",appear:"...",mark:"...",backstory:"...",
//          ancestry:"human",subrace:"northlander",subraceNm:"Northlander",heritageVariant:"",
//          cls:"Warrior",stats:stats,hp:maxHp,maxHp:maxHp,gold:40,
//          inventory:["Longsword","Chainmail"],level:1,xp:0,abilities:ABILS.Warrior.slice(),
//          spells:[],archetype:"",archetypeNm:"",statedAlignment:"True Neutral",
//          actualAlignment:"True Neutral",alignLaw:0,alignGood:0,deity:"",trait:"...",flaw:"...",
//          motivation:"...",languages:[{name:"Common",broken:false}],skills:initSkills(),
//          conditions:[],relationships:[],saveModifiers:[],portrait:null,storyBeats:[],
//          partyMember:true,_campName:"PlaytestHarness",_startLoc:"The Crossroads of Ashenveil"};
//        var tone=TONES.filter(function(t){return t.id==="gritty";})[0];
//        startGame(char, tone.nm, tone.vc, "abercrombie"); // 4th arg = author id, "" for none
//        return "started";
//      })()
//    Wait ~20-30s (Bash sleep, not preview_eval sleep) for skeleton generation + opening
//    narrative, then poll `!!worldState.skeleton` and `story-narrative` children until populated.
//
// 3. Paste the contents of this file into preview_eval ONCE to install the harness.
//
// 4. Run in small batches (5-10 turns), NOT all 50 in one eval call — preview_eval has a ~30s
//    tool-side timeout, but the page keeps running the async batch in the background regardless.
//    Just re-poll; you won't lose progress:
//      window.__ptRunBatch(5)         // first call: safe to await directly, usually finishes in time
//      window.__ptRunBatch(45)        // later calls: fire-and-forget (don't await), then poll:
//      window.__pt.log.length         // check progress
//      window.__pt.errors             // check for turn failures
//    If a call times out client-side, that's fine — just poll `window.__pt.log.length` next call.
//
// 5. When window.__pt.log.length reaches your target, pull the full corpus:
//      window.__pt.log.map(function(e){return {turn:e.turn, action:e.action, narration:e.narration};})
//    and the invariant fields (hp, maxHp, gold, xp, combat, sessionTokensApprox) for the smoke-test
//    half. Sample turns spread across the run (early/mid/late, plus any combat window) rather than
//    pulling all 50 full narrations if the log is large — keeps the analysis call's context sane.
//    Compare sampled prose against AUTHORS.filter(function(a){return a.id==="<author>";})[0].vc/.contentDNA
//    (pull those directly from the live page) and give a verdict: holding steady, or drifting
//    toward generic/flat prose, with concrete before/after quotes.
//
// Notes:
// - This file is intentionally NOT referenced by index.html — it's dev-only, pasted into the
//   console / preview_eval on demand, so it never ships to players or affects APP_VERSION/CACHE.
// - Actions are picked randomly from the live `.qa` buttons each turn (same as a real player
//   tapping a suggestion), not scripted — this is what makes it a fair drift test.
// - Re-running this on an OLD save (pre-v1.137, no skeleton dnaHints) vs. a FRESH campaign is a
//   good A/B: the fresh campaign is the best case for Remedy A (see HANDOFF.md).

(function(){
  window.__pt = { log: [], errors: [] };
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  function isBusy(){return typeof busy!=="undefined" && busy;}
  async function waitIdle(maxMs){var start=Date.now();while(isBusy() && Date.now()-start<maxMs) await sleep(300);}
  async function waitForActions(maxMs){
    var start=Date.now();
    while(Date.now()-start<maxMs){
      var btns=document.querySelectorAll("#story-narrative .qa[data-action]");
      if(btns.length>=1 && !btns[btns.length-1].disabled) return Array.prototype.map.call(btns,function(b){return b.getAttribute("data-action");}).slice(-3);
      await sleep(300);
    }
    return [];
  }
  window.__ptRunBatch = async function(n){
    for(var i=0;i<n;i++){
      try{
        await waitIdle(90000);
        var acts = await waitForActions(30000);
        var actionText;
        if(acts.length){
          var pick = acts[Math.floor(Math.random()*acts.length)];
          actionText = (typeof toFirstPerson==="function") ? toFirstPerson(pick) : pick;
        } else {
          actionText = "I take stock of my surroundings and press on.";
        }
        await sendAction(actionText);
        await waitIdle(90000);
        var narEls = document.querySelectorAll("#story-narrative .msg.narrator");
        var lastNar = narEls.length ? narEls[narEls.length-1].textContent : "";
        window.__pt.log.push({
          turn: worldState.turn,
          action: actionText,
          narration: lastNar,
          hp: worldState.character.hp,
          maxHp: worldState.character.maxHp,
          gold: worldState.character.gold,
          xp: worldState.character.xp,
          combat: worldState.combat ? {name: worldState.combat.name, hp: worldState.combat.hp} : null,
          sessionTokensApprox: (typeof sessionTokens==="function") ? sessionTokens() : null
        });
      }catch(e){
        window.__pt.errors.push({turn: worldState.turn, message: e && e.message});
      }
    }
    return {count: window.__pt.log.length, turn: worldState.turn, errors: window.__pt.errors.length};
  };
  return "harness installed";
})();
