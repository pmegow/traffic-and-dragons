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
//    Inspect AUTHORS / TONES / CLASS_BIBLE (via classDefs()) / ANCS live in the page to pick valid ids. Example:
//      (function(){
//        var stats={STR:16,DEX:12,CON:14,INT:10,WIS:10,CHA:13};
//        var hd=classDef("Warrior").hd;
//        var maxHp=hd+Math.floor((stats.CON-10)/2);
//        var char={name:"Test Name",gender:"M",age:"30",appear:"...",mark:"...",backstory:"...",
//          ancestry:"human",subrace:"northlander",subraceNm:"Northlander",heritageVariant:"",
//          cls:"Warrior",stats:stats,hp:maxHp,maxHp:maxHp,gold:40,
//          inventory:["Longsword","Chainmail"],level:1,xp:0,abilities:classDef("Warrior").abilities.slice().map(function(a){return {nm:a.nm,ds:a.ds,gained:0};}), // C6-③: bible sourcr.slice(),
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
//      window.__ptRunToTurn(50, 0)    // PREFERRED since 2026-08-16: counts COMMITTED turns only,
//                                     // auto-backs-off on rate limits/load shedding, stamps per-turn
//                                     // times; gapMs paces slow tiers (60000 tamed gpt-4o tier-1).
//      window.__ptRunBatch(5)         // legacy batch driver: counts log entries — can diverge from
//                                     // real turns under provider failures (the gpt-4o 429 lesson)
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
// - DURABLE BY DEFAULT: the corpus (log + raw GM responses + errors) is persisted to
//   localStorage['tnd_pt_corpus_v1'] after every turn and every GM response, and recovered on install.
//   A closed/reopened/crashed window loses at most the single in-flight turn — a run is ALWAYS
//   auditable after the fact. Recover a prior run: window.__ptLoad(). Wipe before a fresh run:
//   window.__ptClear(). Raw-tag capture is baked in (no separate monkeypatch needed).
// - This file is intentionally NOT referenced by index.html — it's dev-only, pasted into the
//   console / preview_eval on demand, so it never ships to players or affects APP_VERSION/CACHE.
// - Actions are picked randomly from the live `.qa` buttons each turn (same as a real player
//   tapping a suggestion) UNDER the #306 scripted layer (__ptChoose: the death walk, the downed
//   choice, rest under a third HP, use a carried consumable when hurt, accept the newest offer
//   every 8th turn, never repeat the previous action) — the random pick remains the drift test.
// - Re-running this on an OLD save (pre-v1.137, no skeleton dnaHints) vs. a FRESH campaign is a
//   good A/B: the fresh campaign is the best case for Remedy A (see DOC/ archived handoffs).

// #306 — the SCRIPTED LAYER over the random picker. The uniform picker never accepted a quest, never
// rested, never used an item and re-stabbed corpses across 20 corpora (review C10): it measured the
// floor and could not have seen #300–#303 broken. This layer is PURE and node-testable: given the
// live buttons and a small state digest it returns the action text and a kind label. Priorities:
// the death walk (once per run — always BACK, onward would end the run), the downed choice
// (struggle first, then yield — that IS how a run exercises the escort), rest under a third HP,
// use a carried canon consumable when hurt, accept the newest offered quest every 8th turn, and
// never repeat the previous action. Everything else stays the random pick — that is the drift test.
function __ptChoose(acts, st, prev){
  acts=acts||[];st=st||{};prev=prev||{};
  var prevText=prev.text||"",prevKind=prev.kind||"";
  if(st.deathStage==="choose")return {text:"Walk back to camp with Death",kind:"death-back"};
  if(st.deathStage)return {text:"Why did the bell ring twice?",kind:"death-question"};
  if(st.downed)return prevKind==="downed-struggle"?{text:"Yield — let go and trust whoever finds you",kind:"downed-yield"}:{text:"Struggle — fight for consciousness, crawl, cling to life",kind:"downed-struggle"};
  if(!st.combat&&typeof st.hp==="number"&&typeof st.maxHp==="number"&&st.hp<st.maxHp/3&&prevKind!=="rest")return {text:"I make camp and rest until I am recovered.",kind:"rest"};
  if(st.consumables&&st.consumables.length&&typeof st.hp==="number"&&st.hp<st.maxHp&&prevKind!=="use")return {text:"I use my "+st.consumables[0]+".",kind:"use"};
  if(st.offered&&st.offered.length&&st.turn>0&&st.turn%8===0&&prevKind!=="accept")return {text:"I accept the offer: "+st.offered[st.offered.length-1]+".",kind:"accept"};
  var pool=acts.filter(function(a){return a&&a!==prevText;});
  if(!pool.length)return {text:acts[0]||"I take stock of my surroundings and press on.",kind:"random"};
  return {text:pool[Math.floor(Math.random()*pool.length)],kind:"random"};
}
if(typeof module!=="undefined"&&module.exports)module.exports={choose:__ptChoose};
if(typeof window!=="undefined")(function(){
  var PT_KEY="tnd_pt_corpus_v1";
  // DURABILITY (a test run must ALWAYS be auditable — its evidence must survive the tab). The corpus
  // is persisted to localStorage after every turn AND every GM response, and recovered on install, so a
  // closed/reopened/crashed window can never cost more than the single in-flight turn. Recover a prior
  // run's corpus any time with __ptLoad(); wipe it with __ptClear().
  function load(){try{var s=localStorage.getItem(PT_KEY);if(s){var o=JSON.parse(s);if(o&&o.log)return o;}}catch(e){}return {log:[],errors:[],raw:[]};}
  window.__pt = load(); if(!window.__pt.raw)window.__pt.raw=[];
  function persist(){ // on quota, shed oldest raw first — the turn log is the audit spine, raw is the tag detail
    try{ localStorage.setItem(PT_KEY, JSON.stringify(window.__pt)); }
    catch(e){ try{ window.__pt.raw=window.__pt.raw.slice(-40); localStorage.setItem(PT_KEY, JSON.stringify(window.__pt)); }catch(e2){} }
  }
  window.__ptSave=persist; window.__ptLoad=load;
  window.__ptClear=function(){window.__pt={log:[],errors:[],raw:[]};try{localStorage.removeItem(PT_KEY);}catch(e){}return "cleared";};
  // Bake in raw-GM-response capture (the tag-level audit source: [SPELL_USED:]/[COMBAT_*:]/[QUEST:]…) so
  // EVERY run records it by default — wrap logTranscript once, idempotently, and persist on each capture.
  if(!window.__ptRawPatched && typeof logTranscript==="function"){
    window.__ptRawPatched=true; var _lt=logTranscript;
    window.logTranscript=function(role,text,raw){ try{ if(role==="gm"){ window.__pt.raw.push({turn:(typeof worldState!=="undefined"&&worldState)?worldState.turn:null, raw:String(raw||text)}); persist(); } }catch(e){} return _lt.apply(this,arguments); };
  }
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  // #306: the state digest the scripted layer reads, and the previous pick (kind + text).
  window.__ptChoose=__ptChoose;window.__ptPrev={text:"",kind:""};
  function ptState(){var w=(typeof worldState!=="undefined")?worldState:null;if(!w||!w.character)return {};var c=w.character,cons=[],i;
    if(typeof itemLookup==="function")for(i=0;i<(c.inventory||[]).length;i++){var e=itemLookup(c.inventory[i]);if(e&&e.category==="consumable"&&e.effect&&e.effect!=="N/A")cons.push((typeof _invBase==="function")?_invBase(c.inventory[i]):c.inventory[i]);}
    var off=[];for(i=0;i<(w.questLog||[]).length;i++)if(w.questLog[i]&&w.questLog[i].status==="offered")off.push(w.questLog[i].title);
    return {hp:c.hp,maxHp:c.maxHp,combat:!!w.combat,downed:!!w.downed,deathStage:(w.deathScene&&w.deathScene.stage)||null,consumables:cons,offered:off,turn:w.turn||0};}
  function ptPick(acts){var ch=__ptChoose(acts,ptState(),window.__ptPrev);window.__ptPrev=ch;var t=ch.text;if(ch.kind==="random"&&typeof toFirstPerson==="function")t=toFirstPerson(t);return {text:t,kind:ch.kind};}
  function isBusy(){return typeof busy!=="undefined" && busy;}
  async function waitIdle(maxMs){var start=Date.now();while(isBusy() && Date.now()-start<maxMs) await sleep(300);}
  async function waitForActions(maxMs){
    var start=Date.now();
    while(Date.now()-start<maxMs){
      var btns=document.querySelectorAll("#story-narrative .qa[data-action]");
      if(btns.length>=1 && !btns[btns.length-1].disabled) return Array.prototype.map.call(btns,function(b){return b.getAttribute("data-action");}).slice(-4);/* #305: the engine's fourth button rides along */
      await sleep(300);
    }
    return [];
  }
  // #22 model-sweep graduation (2026-08-16): the COMMITTED-TURN driver. __ptRunBatch counts
  // log entries, which the gpt-4o 429 storm proved can diverge from real turns (failed sendAction
  // calls logged as 'turns'; a 50-entry 'success' held 15 real turns). This driver advances on
  // worldState.turn ONLY, backs off 30s when a turn fails to land (rate limits, load shedding,
  // credit walls — it self-resumes when the cause clears), stamps per-turn wall-clock times into
  // the corpus (t), and paces with gapMs when a provider needs it (60000 tamed gpt-4o tier-1).
  window.__ptRunToTurn = async function(targetTurn, gapMs){
    while(worldState.turn < targetTurn){
      try{
        if(gapMs) await sleep(gapMs);
        await waitIdle(90000);
        var before = worldState.turn;
        var acts = await waitForActions(30000);
        var _pick = ptPick(acts); var actionText = _pick.text;/* #306: the scripted layer over the random pick */
        await sendAction(actionText);
        await waitIdle(90000);
        if(worldState.turn > before){
          var narEls = document.querySelectorAll('#story-narrative .msg.narrator');
          window.__pt.log.push({ turn: worldState.turn, action: actionText, kind: _pick.kind, narration: narEls.length?narEls[narEls.length-1].textContent:'', hp: worldState.character.hp, maxHp: worldState.character.maxHp, gold: worldState.character.gold, xp: worldState.character.xp, combat: worldState.combat?{engaged:worldState.combat.engaged||null,foes:(worldState.combat.foes||[]).map(function(f){return {name:f.name,hp:f.hp,down:f.down||null};})}:null, sessionTokensApprox:(typeof sessionTokens==='function')?sessionTokens():null, t:Date.now() });
          persist();
        } else {
          window.__pt.errors.push({turn: worldState.turn, message: 'turn did not advance — backing off'});
          persist();
          await sleep(30000);
        }
      }catch(e){ window.__pt.errors.push({turn: worldState.turn, message: e && e.message}); persist(); await sleep(15000); }
    }
    return {logEntries: window.__pt.log.length, turn: worldState.turn, errors: window.__pt.errors.length};
  };
  window.__ptRunBatch = async function(n){
    for(var i=0;i<n;i++){
      try{
        await waitIdle(90000);
        var acts = await waitForActions(30000);
        var _pick2 = ptPick(acts); var actionText = _pick2.text;/* #306: the scripted layer over the random pick */
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
          combat: worldState.combat ? {engaged: worldState.combat.engaged||null, foes: (worldState.combat.foes||[]).map(function(f){return {name:f.name, hp:f.hp, down:f.down||null};})} : null,/* UA26 foes[] shape */
          sessionTokensApprox: (typeof sessionTokens==="function") ? sessionTokens() : null
        });
        persist(); // durable after EVERY turn
      }catch(e){
        window.__pt.errors.push({turn: worldState.turn, message: e && e.message});
        persist();
      }
    }
    return {count: window.__pt.log.length, turn: worldState.turn, errors: window.__pt.errors.length};
  };
  return "harness installed (durable: corpus persists to localStorage['"+PT_KEY+"'] every turn + every GM response; recover with __ptLoad())";
})();
