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
//    SIGNED IN (server mode, the app's default now): SKIP the wipe above. The sign-in and the owner's other campaigns live
//    in the same storage, and every save syncs to the owner's cloud. Instead:
//      a. paste this file to install, then `await __ptPreflight()` → {ok, route, ask, provider, model}. Not ok → relay
//         `ask` to the owner (they sign in in the visible preview; never type credentials) and stop.
//      b. `__ptLoad().log.length` > 0 → a previous run's corpus is unsaved: write it to dev/ first, then `__ptClear()`.
//      c. `__ptUseModel("gemini","gemini-3.8-flash")` — the playtest default, in memory only (the owner's choice is kept).
//      d. `__ptStart(char, "gritty", "abercrombie")` in place of step 2's startGame — char._campName must start with
//         "PlaytestHarness" (or "modelTestCampaign_", after setting pendingBlueprint). It records the campaign's id and
//         refuses while a previous signed-in run's campaign is undeleted.
//      e. drive turns (step 4); persist the corpus and write the audit; then `await __ptDeleteRun()` deletes exactly the
//         run's campaign — this device's copy, then the cloud copy, checked gone. Its result goes in the audit.
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
  /* #363: one use per item per run, and a [NO_CHANGE:] answer to a use retires that item too — the #226 mature
     arm burned 10 of 20 turns on "I use my travel rations" because rations never heal and the engine kept the
     entry, so hp<maxHp stayed true forever. The suppressed branch is reported as `skipped` so the audit sees it. */
  var used=st.used||{};if(prevKind==="use"&&st.lastNoChange&&prev.item)used[prev.item]=true;
  var cons=(st.consumables||[]).filter(function(c){return !used[c];});
  var wantUse=(st.consumables&&st.consumables.length&&typeof st.hp==="number"&&st.hp<st.maxHp&&prevKind!=="use");
  if(wantUse&&cons.length)return {text:"I use my "+cons[0]+".",kind:"use",item:cons[0]};
  var skipped=(wantUse&&!cons.length)?"use":null;
  if(st.offered&&st.offered.length&&st.turn>0&&st.turn%8===0&&prevKind!=="accept")return {text:"I accept the offer: "+st.offered[st.offered.length-1]+".",kind:"accept"};
  var pool=acts.filter(function(a){return a&&a!==prevText;});
  if(!pool.length)return {text:acts[0]||"I take stock of my surroundings and press on.",kind:"random",skipped:skipped};
  return {text:pool[Math.floor(Math.random()*pool.length)],kind:"random",skipped:skipped};
}
// SIGNED-IN RUNS (server mode, owner 2026-09-30). The app now starts in server mode: a signed-in, entitled account's GM
// calls ride the server gateway (gmViaServer, api.js) with the page's own provider and model, so a run needs no key. But
// the sign-in and the owner's other campaigns live in the same browser storage, and every save syncs to the owner's
// cloud. So a signed-in run never wipes storage, starts only a campaign whose name marks it as the harness's own, records
// that campaign's id, and deletes exactly that campaign afterwards. The decisions are PURE and node-tested
// (dev/tests-playtest-server-mode.js); the page wrappers below only gather facts and call the app's own functions.
var __PT_CAMP_PREFIXES=["PlaytestHarness","modelTestCampaign_"];
function __ptIsHarnessName(name){name=String(name||"");for(var i=0;i<__PT_CAMP_PREFIXES.length;i++)if(name.indexOf(__PT_CAMP_PREFIXES[i])===0)return true;return false;}
// May a run start? env: {busy, viaServer (the app's own gmViaServer()), token, entitled, hasKey, serverMode}. The route is
// the app's decision; this only refuses the routes that would fail every turn, and says what the OWNER must do — the
// harness never handles credentials.
function __ptPreflightVerdict(env){
  env=env||{};
  if(env.busy)return {ok:false,ask:"A GM turn is in flight in the preview — wait for it to finish."};
  if(env.viaServer){
    if(!env.token)return {ok:false,ask:"Sign in in the preview (File ▸ Account) — the harness never handles credentials."};
    if(!env.entitled)return {ok:false,ask:"The signed-in account has no subscription, so the server would refuse every turn. Sign in with the owner account."};
    return {ok:true,route:"server"};
  }
  if(env.hasKey)return {ok:true,route:"byok"};
  return {ok:false,ask:env.serverMode?"Sign in in the preview (File ▸ Account), or paste a provider key via File ▸ 🧠 Language Model — the harness never handles credentials.":"Paste a provider key in the preview via File ▸ 🧠 Language Model — the harness never handles credentials."};
}
// What the run records about its campaign, or null when the new campaign cannot be confirmed (startGame refused, or the
// active campaign is someone else's). A null record means the cleanup can never target anything.
function __ptRunRecord(activeId,ws,campName){
  if(!activeId||!ws||ws.campId!==activeId||ws.campName!==campName||!__ptIsHarnessName(campName))return null;
  return {campId:activeId,campName:campName};
}
// Which campaign may the cleanup delete? Only the recorded run's own: on this device's list exactly once, under the
// recorded harness name, with no turn in flight. Once the harness has removed this device's copy (localGone), a retry may
// delete the cloud copy alone.
function __ptCleanupPlan(meta,run,busy){
  if(!run||!run.campId)return {ok:false,why:"no harness run is recorded, so nothing here is the harness's to delete"};
  if(busy)return {ok:false,why:"a GM turn is in flight — wait for it"};
  if(!__ptIsHarnessName(run.campName))return {ok:false,why:"the recorded campaign \""+run.campName+"\" is not a harness campaign"};
  var hits=(meta||[]).filter(function(c){return c&&c.id===run.campId;});
  if(hits.length>1)return {ok:false,why:"more than one campaign carries the run's id"};
  if(hits.length===1){
    if(hits[0].campName!==run.campName)return {ok:false,why:"the campaign with the run's id is named \""+hits[0].campName+"\", not \""+run.campName+"\" — refusing"};
    return {ok:true,id:run.campId,local:true};
  }
  if(run.localGone)return {ok:true,id:run.campId,local:false};
  return {ok:false,why:"the run's campaign is not on this device's list, and the harness never removed it — refusing to delete by id alone"};
}
if(typeof module!=="undefined"&&module.exports)module.exports={choose:__ptChoose,isHarnessName:__ptIsHarnessName,preflightVerdict:__ptPreflightVerdict,runRecord:__ptRunRecord,cleanupPlan:__ptCleanupPlan};
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
  /* a signed-in run's record survives a clear until its campaign is deleted: it is the only pointer the cleanup trusts */
  window.__ptClear=function(){var keep=window.__pt&&window.__pt.run&&window.__pt.run.route==="server"&&!window.__pt.run.deleted?window.__pt.run:null;window.__pt={log:[],errors:[],raw:[]};if(keep)window.__pt.run=keep;try{localStorage.removeItem(PT_KEY);if(keep)persist();}catch(e){}return keep?"cleared — the undeleted signed-in run's record is kept (campaign "+keep.campId+"): run __ptDeleteRun() before the next start":"cleared";};
  // Bake in raw-GM-response capture (the tag-level audit source: [SPELL_USED:]/[COMBAT_*:]/[QUEST:]…) so
  // EVERY run records it by default — wrap logTranscript once, idempotently, and persist on each capture.
  if(!window.__ptRawPatched && typeof logTranscript==="function"){
    window.__ptRawPatched=true; var _lt=logTranscript;
    window.logTranscript=function(role,text,raw){ try{ if(role==="gm"){ window.__pt.raw.push({turn:(typeof worldState!=="undefined"&&worldState)?worldState.turn:null, raw:String(raw||text)}); persist(); } }catch(e){} return _lt.apply(this,arguments); };
  }
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  // #306: the state digest the scripted layer reads, and the previous pick (kind + text).
  window.__ptChoose=__ptChoose;window.__ptPrev={text:"",kind:""};window.__ptUsed={};/* #363: items used this run */
  function ptState(){var w=(typeof worldState!=="undefined")?worldState:null;if(!w||!w.character)return {};var c=w.character,cons=[],i;
    if(typeof itemLookup==="function"&&typeof invEntries==="function"){var _es=invEntries(c.inventory||[]);for(i=0;i<_es.length;i++){var e=itemLookup(_es[i].name);if(e&&e.category==="consumable"&&e.effect&&e.effect!=="N/A")cons.push(_es[i].name);}}/* #599 (c2), review 1: the pack is rows — read through the module, never by index */
    var off=[];for(i=0;i<(w.questLog||[]).length;i++)if(w.questLog[i]&&w.questLog[i].status==="offered")off.push(w.questLog[i].title);
    var lastRaw=window.__pt.raw.length?String(window.__pt.raw[window.__pt.raw.length-1].raw||""):"";
    return {hp:c.hp,maxHp:c.maxHp,combat:!!w.combat,downed:!!w.downed,deathStage:(w.deathScene&&w.deathScene.stage)||null,consumables:cons,offered:off,turn:w.turn||0,used:window.__ptUsed,lastNoChange:lastRaw.indexOf("[NO_CHANGE")>=0};}/* #363 */
  function ptPick(acts){var ch=__ptChoose(acts,ptState(),window.__ptPrev);window.__ptPrev=ch;if(ch.kind==="use"&&ch.item)window.__ptUsed[ch.item]=true;/* #363 */var t=ch.text;if(ch.kind==="random"&&typeof toFirstPerson==="function")t=toFirstPerson(t);return {text:t,kind:ch.kind,skipped:ch.skipped||null};}
  function isBusy(){return typeof busy!=="undefined" && busy;}
  async function waitIdle(maxMs){var start=Date.now();while(isBusy() && Date.now()-start<maxMs) await sleep(300);}
  // The live options: the NEWEST narration's buttons only, as Car Mode's _carActions reads them (#305: the engine's fourth
  // button rides inside it). The old read took the last four .qa buttons in the WHOLE story, so a three-button turn let the
  // previous turn's last button into the pool — the v1.1078 run sent a t3 option at t5, after its target died at t4.
  // null = not ready: no buttons on the newest narration yet, or its last one still disabled.
  window.__ptLiveActions=function(){
    var nars=document.querySelectorAll("#story-narrative .msg.narrator");if(!nars.length)return null;
    var btns=nars[nars.length-1].querySelectorAll(".qa[data-action]");
    if(!btns.length||btns[btns.length-1].disabled)return null;
    return Array.prototype.map.call(btns,function(b){return b.getAttribute("data-action");});
  };
  async function waitForActions(maxMs){
    var start=Date.now();
    while(Date.now()-start<maxMs){var a=window.__ptLiveActions();if(a)return a;await sleep(300);}
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
          window.__pt.log.push({ turn: worldState.turn, action: actionText, kind: _pick.kind, skipped: _pick.skipped||null,/* #363 */ narration: narEls.length?narEls[narEls.length-1].textContent:'', hp: worldState.character.hp, maxHp: worldState.character.maxHp, gold: worldState.character.gold, xp: worldState.character.xp, combat: worldState.combat?{engaged:worldState.combat.engaged||null,foes:(worldState.combat.foes||[]).map(function(f){return {name:f.name,hp:f.hp,down:f.down||null};})}:null, sessionTokensApprox:(typeof sessionTokens==='function')?sessionTokens():null, t:Date.now() });
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
  // ── signed-in runs (see the block above __ptIsHarnessName) ──
  function currentModel(){return (providerModels&&providerModels[activeProvider])||(PROVIDERS[activeProvider]&&PROVIDERS[activeProvider].defaultModel)||null;}
  // Facts → the pure verdict. Refreshes the account readout first (a read); changes nothing else.
  window.__ptPreflight=async function(){
    var sa=(typeof storageAdapter!=="undefined")?storageAdapter:null;
    var env={serverMode:!!(sa&&sa.isServerMode()),token:!!(sa&&sa.hasToken()),busy:isBusy()};
    if(env.serverMode&&env.token&&typeof sa.fetchAccount==="function")await new Promise(function(r){sa.fetchAccount(function(){r();});});
    env.entitled=!!(typeof serverAccount!=="undefined"&&serverAccount&&serverAccount.entitled);
    env.viaServer=(typeof gmViaServer==="function")&&gmViaServer();
    env.hasKey=!!((typeof providerKeys!=="undefined"&&providerKeys[activeProvider])||(typeof apiKey!=="undefined"&&apiKey));
    env.provider=activeProvider;env.model=currentModel();
    var v=__ptPreflightVerdict(env);for(var k in v)env[k]=v[k];
    return env;
  };
  // The run's model, IN MEMORY ONLY: the owner's saved choice is never written, and a reload restores it.
  window.__ptUseModel=function(provider,model){
    if(typeof PROVIDERS==="undefined"||!PROVIDERS[provider])return "refused: unknown provider "+provider;
    var was={provider:activeProvider,model:providerModels[provider]||null};
    activeProvider=provider;providerModels[provider]=model;
    return {now:{provider:provider,model:model},was:was};
  };
  // Start the run's campaign and record it. The name must mark it as the harness's own: the cleanup deletes nothing else.
  window.__ptStart=function(char,toneId,authorId){
    var prev=window.__pt.run;
    if(prev&&prev.route==="server"&&!prev.deleted)return "refused: the previous signed-in run's campaign ("+prev.campName+", "+prev.campId+") is still in the cloud — run __ptDeleteRun() first";
    if(isBusy())return "refused: a GM turn is in flight";
    if(!char||!__ptIsHarnessName(char._campName))return "refused: char._campName must start with "+__PT_CAMP_PREFIXES.join(" or ")+" (the cleanup deletes only harness campaigns)";
    var tone=TONES.filter(function(t){return t.id===toneId;})[0];if(!tone)return "refused: unknown tone "+toneId;
    var campName=char._campName;/* read BEFORE startGame: it deletes the transient field from the character (game.js) */
    startGame(char,tone.nm,tone.vc,authorId||"");
    var rec=__ptRunRecord(getActiveCampId(),(typeof worldState!=="undefined")?worldState:null,campName);
    if(!rec)return "refused: the new campaign could not be confirmed — nothing recorded, so the cleanup can never target anything";
    rec.startedAt=Date.now();rec.ver=APP_VERSION;rec.route=((typeof gmViaServer==="function")&&gmViaServer())?"server":"byok";
    rec.provider=activeProvider;rec.model=currentModel();
    window.__pt.run=rec;persist();
    return rec;
  };
  // Delete the run's own campaign. This device's copy goes FIRST, through the app's own teardown: with the campaign out of
  // memory and storage, nothing can push it again. Then the cloud copy — verified gone, because the server keeps no
  // tombstone and a push already in flight could re-create it. opts.waitMs: the settle before each check (tests use 1).
  window.__ptDeleteRun=async function(opts){
    var waitMs=(opts&&opts.waitMs)||5000,run=window.__pt.run;
    var plan=__ptCleanupPlan(getCampMeta(),run,isBusy());
    if(!plan.ok)return {deleted:false,why:plan.why};
    var id=plan.id,sa=(typeof storageAdapter!=="undefined")?storageAdapter:null;
    if(plan.local){
      if(getActiveCampId()===id){removeActiveCampaignLocally(id);var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");if(sn)sn.innerHTML="";if(st)st.innerHTML="";if(typeof showChar==="function")showChar();}
      else deleteCampaign(id);
    }
    run.localGone=true;persist();
    if(!sa||!sa.isServerMode()||!sa.hasToken()){run.deleted={at:Date.now(),cloud:"not signed in — this device only"};persist();return {deleted:true,id:id,cloud:run.deleted.cloud};}
    async function cloudHas(){var r=await fetch(sa.getServerUrl()+"/api/campaigns",{headers:sa.authHeader()});if(!r.ok)throw new Error("HTTP "+r.status);var l=await r.json();return Array.isArray(l)&&l.some(function(c){return c&&c.id===id;});}
    for(var attempt=1;attempt<=3;attempt++){
      var err=await new Promise(function(res){sa.deleteCampaignFromServer(id,function(e){res(e||null);});});
      if(err&&campDeleteRemoteOutcome(err)==="failed")return {deleted:false,id:id,why:"the cloud delete failed ("+err+"); this device's copy is already gone — run __ptDeleteRun() again"};
      await sleep(waitMs*attempt);
      var still;try{still=await cloudHas();}catch(e){return {deleted:false,id:id,why:"could not check the cloud list ("+(e&&e.message)+") — run __ptDeleteRun() again"};}
      if(!still){run.deleted={at:Date.now(),cloud:"deleted, checked absent",attempts:attempt};persist();return {deleted:true,id:id,cloud:run.deleted.cloud,attempts:attempt};}
    }
    return {deleted:false,id:id,why:"the cloud copy came back after three deletes — something is still pushing it; stop and investigate"};
  };
  return "harness installed (durable: corpus persists to localStorage['"+PT_KEY+"'] every turn + every GM response; recover with __ptLoad())";
})();
