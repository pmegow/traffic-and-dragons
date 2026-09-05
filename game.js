function startGame(char,toneName,toneVoice,authorId){
  // Ensure all v10 character fields are initialised
  if(!char.gender)char.gender="M";
  if(!char.skills)char.skills=initSkills();
  if(!char.conditions)char.conditions=[];
  if(!char.relationships)char.relationships=[];
  if(!char.saveModifiers)char.saveModifiers=[];
  if(!char.languages)char.languages=[];
  if(char.portrait===undefined)char.portrait=null;
  if(!char.backstory)char.backstory="";
  if(!char.storyBeats)char.storyBeats=[];
  // Mint a campaign id if none is active (audit E13): the normal wizard path never called
  // setActiveCampId, so a first-ever campaign had campId null for its whole first session —
  // updateCampMeta/snapshotActiveCamp both no-op on a null id, so it was never listed or
  // snapshotted and "New Game" deleted it with no save. The import/campNew paths already mint one.
  if(!getActiveCampId())setActiveCampId(newCampaignId());
  worldState={ver:10,campId:getActiveCampId(),campName:char._campName||char.name,legacyCharsUsed:[],pendingLegacy:null,character:char,world:{location:char._startLoc||"The Crossroads of Ashenveil",region:"The Blighted Reach",time:"dusk",weather:"cold wind carrying ash",threat:"low",sublocation:null},tone:{name:toneName||"Sword and Sorcery",voice:toneVoice||""},npcs:[],questLog:[],eventHistory:[],combat:null,turn:0,transcript:[],actStartTurn:0,clock:{min:12*MIN_PER_HOUR,schedule:[]}};/* #73: new campaigns open at the declared dusk; rendered time derives from this scalar */
  delete worldState.character._startLoc;delete worldState.character._campName;
  if(arguments.length>=4){worldState.proseAuthor=authorId||"";proseAuthor=authorId||"";store.set(PROSE_K,authorId||"");}
  sessionLog=[];memory=blankMemory();lastAction=null;// don't let the previous campaign's last action leak into this one's Retry (audit E83)
  // Add any companions selected during character creation
  var ci;for(ci=0;ci<pendingCompanions.length;ci++){
    var comp=pendingCompanions[ci];
    worldState.npcs.push({name:comp.name,status:"ally",rel:"companion",met:0,partyMember:true,pronouns:pronounsForGender(comp.gender),portrait:null,charSheet:comp}); // portrait rides on charSheet only (#3 dedupe)
    memory.npcs[comp.name]={attitude:"ally",knowledge:[],events:[],partyMember:true,pronouns:pronounsForGender(comp.gender)};
    npcLinkUpsert(char.name,comp.name,"companions");
  }
  pendingCompanions=[];
  relationshipMigrateWorld();/* #168 W7: imported player/companion sheets enter through the same lossless axis adapter. */
  // Apply blueprint if one was loaded (.blueprint file)
  if(pendingBlueprint){
    applyBlueprint(pendingBlueprint);
    pendingBlueprint=null;
  }
  // Seed a map node for the STARTING location (audit E15) — nodes are otherwise created only on
  // travel, so first-visit [LOCATION_DESC/SIZE/ITEM] and NPC last-seen stamps at the opening
  // location were silently dropped (fileLocationDesc/etc. early-return with no node).
  if(memory.map&&worldState.world&&worldState.world.location&&!memory.map.nodes[worldState.world.location]){
    memory.map.nodes[worldState.world.location]={firstVisit:0,visits:1,description:null,parent:null,npcs:[],items:[],size:null,travelMins:null};
  }
  if(typeof guestbookSeedStart==="function")guestbookSeedStart();/* #173: the creation-time party stands at the opening node — turn-0 provenance (runs even when a blueprint pre-seeded the node: the party is there either way) */
  saveAll();showGame();syncUI();initAbilities();initSpells();
  if(typeof takeCheckpoint==="function")takeCheckpoint("campaign start");/* #300: the campaign start is the first camp — a hero who dies before ever resting has somewhere to wake */
  addMsg("system",char.name+" the "+char.cls+" enters the world.");
  if(typeof initCampaignFolderForGame==="function")initCampaignFolderForGame();
  // Busy-gate the whole startup (audit E22): skeleton generation is async and the game screen is
  // already shown with a live input, so without this a typed action could interleave with the
  // skeleton call and beginAdventure. beginAdventure clears busy when the opening scene lands.
  busy=true;var _sbtn=document.getElementById("sendbtn");if(_sbtn)_sbtn.disabled=true;
  if(worldState.skeleton){
    // Blueprint provided a skeleton — skip generation, go straight to the adventure
    beginAdventure();
  }else{
    // Generate the campaign skeleton, then open the adventure. If skeleton generation fails
    // (network, parse, bad provider), log it and start anyway — the game works without one.
    var _skMsg=addMsg("thinking","Forging the campaign...");
    generateSkeleton(function(tx){try{_skMsg.innerHTML=tx;}catch(_e){}}).then(function(){_skMsg.remove();beginAdventure();}).catch(function(e){_skMsg.remove();var reason=e&&e.message?e.message:"unknown error";showToast("Skeleton failed ("+reason+") — playing freeform",6000);if(typeof console!=="undefined")console.warn("[skeleton] "+reason);if(typeof reportError==="function")reportError("skeleton",reason,(e&&e.stack)||"");beginAdventure();});
  }
}
// Model escalation for engine utility calls (skeleton since v1.2xx, suggestions since v1.249):
// the "Allow model upgrade for complex tasks" toggle gates it; every provider declares its own
// upgradeModel. Null = use the session model.
function upgradeModelFor(){
  var prov=(typeof PROVIDERS!=="undefined"&&PROVIDERS[activeProvider])||null;
  return(prov&&typeof allowModelUpgrade!=="undefined"&&allowModelUpgrade&&prov.upgradeModel)?prov.upgradeModel:null;
}
// UA38 ②③ + UA39 ①: the suggestion call was scene-starved — head-sliced prose, no geography,
// spell NAMES without canon — so it invented a lockable exit (t333) and recommended a cross-town
// Message, a 120ft cantrip (t355). A tapped suggestion becomes player INTENT the GM then tends
// to oblige, so a hallucinating side model is a drift injection vector. Three pure, engine-tested
// helpers close the gaps: canon-annotated spell list, canonical location line, scene TAIL slice.
// ── Suggestion context (v1.288): the UN-STARVED call ──────────────────────────────────────────
// History: the buttons were split out of the narrative at v1.110 (#14) to protect prose voice and
// kill the [ACTIONS:] parsing pain — but the split STARVED the call: a 200-token hand-written
// prompt + a scene tail, no canon. Every fence since (v1.245 canon-annotated spell list + geo
// line + tail slice, v1.249 model escalation) hand-fed back a FRACTION of the lost context, and
// Sonnet still produced the t580 "Send a Message to someone who knows Thassilonian lore" button
// with Message's 120ft canon sitting in its prompt. Fix the cause, not the symptom: the call now
// reuses the main turn's FULL buildSysPrompt() — stable half BYTE-IDENTICAL so it rides the
// turn's still-warm prompt cache at the 0.1x read rate (a perturbed stable kills every cache hit
// SILENTLY; engine-tested), with a SUGGESTION MODE block appended to the VOLATILE half only
// (block 2 is never cached, and the JSON-output instruction must land AFTER the STYLE prose
// directive or the two formats fight). Runs on the ACTIVE gameplay model — caches are
// model-scoped, so the old upgradeModelFor() escalation would forfeit the cache read, and the
// v1.238 money test proves Sonnet-WITH-canon refuses exactly what Sonnet-starved suggested.
// ⚠ USER FLAG (2026-07-12): this must not affect narrative voice/content at all (the call is
// read-only — never writes sessionLog/transcript, never feeds the GM's prompt), but the user
// asked for a watch marker: if voice, cost, or cache health ever seems off, suspect THIS change
// first (Usage modal → actions In/call + prompt-cache health are the instruments).
var SUGGESTION_MODE_BLOCK="\n\n=== SUGGESTION MODE — THIS CALL ONLY ===\n"
 +"You are NOT narrating a turn. Based on the RECENT SCENES in the user message and everything above (the character sheet, canonical spell rules, geography, and NPC list), suggest exactly 3 short actions the player could take next.\n"
 +"Suggest only actions involving people, objects, and exits explicitly present in the scene or the location description — NEVER invent doors, exits, items, or people the narration has not mentioned.\n"
 +"Never suggest casting a spell or using an ability this character does not have, and never suggest a cast that exceeds a spell's canonical range or targets: a target in another building, street, or district — or anyone not present in the scene or whose current location is unknown — is OUT OF RANGE for a short-range spell.\n"
 +"A spell is a spice, not a default: at most ONE of the 3 suggestions may involve casting a spell or using a named ability — the other two must be mundane actions (move, hide, wait, talk, search, signal by hand).\n"
 +"Legal kinds you rarely offer and should when the scene supports them: buying or selling (when FOR SALE HERE / WANTED HERE lists something), resting or making camp, using a carried item from the inventory, and accepting an offered quest.\n"
 +"Suggest only people, places, and facts the story has already surfaced on screen. The campaign outline's unrevealed names and plans are SPOILERS — never put one in a suggestion, no matter what the background material says about them.\n"
 +"Ignore the STYLE directive for this call. FIRST take stock: list who and what is ACTUALLY present in the scene right now — the people, creatures, and objects the narration has placed there. Then write the 3 actions, each referencing ONLY entities from that list or plain surroundings. A person or thing the narration has not placed in the scene (a driver, a guard, a shopkeep) does not exist — never aim an action at one.\n"
 +"Output ONLY one valid JSON object, no prose, no markdown, no backticks: {\"present\":\"one line listing who and what is in the scene\",\"actions\":[\"...\",\"...\",\"...\"]} — exactly 3 actions, each under 10 words.";/* #141: the present field IS the checking space t833 proved the instant-JSON call lacks — the driverless-cart phantom (field 2026-08-07) */
// #283 (Sol brief 35②): the ask half of the suggestion call, ONE constant so the user message can
// never again fight the mode block over the output shape — it used to demand "a JSON array of 3
// strings" (the HIGHEST-authority channel) against the block's {present, actions} object, the
// tolerant parser hid the conflict, and the #141 forced checking space silently vanished.
var SUGGESTION_ASK="Suggest exactly 3 short actions the player could take next. FIRST take stock of who and what is actually present, then write the actions. Output ONLY one valid JSON object: {\"present\":\"one line listing who and what is in the scene\",\"actions\":[\"...\",\"...\",\"...\"]} — exactly 3 actions, each under 10 words, no prose, no markdown, no backticks.";
// t833 (2026-07-18) — the recurring Message-cantrip class (t355 cross-town range → t580 unlocated
// target → t833 casting while INVISIBLE + an invented back exit). The un-starve (v1.288) put every
// fact and fence in the prompt, and the reconstruction of the t833 call verified all of it present
// and ordered — yet the model, forced to emit instant JSON with no checking space, still lets the
// "clever rogue cantrip" prior win in every stealth scene; each incident just found the fence's
// next uncovered face. So stop enumerating sins and feed the checker what it never had:
// ① its own concealment state as explicit DATA with the consequence spelled out (the sheet said
//   "Conditions: Invisible" but the model had to INFER "casting ends it" — it never did), and
// ② the previous button set, so spell-fixation (2 of 3 buttons pushing Message) meets direct
//   counter-pressure instead of none.
// Both are VOLATILE-half appends in suggestion mode only — the stable half stays byte-identical
// (cache prefix) and gameplay turns are untouched.
function suggestionTacticalLine(){
  var c=(typeof activePlayer==="function"?activePlayer():null)||(worldState&&worldState.character)||null;
  var conds=(c&&c.conditions)||[],i;
  for(i=0;i<conds.length;i++){
    if(/invisib|hidden|conceal|disguis|stealth/i.test(conds[i].name||"")){
      return "\nCONCEALMENT CHECK: "+((c&&c.name)||"the player")+" is currently "+conds[i].name
        +(conds[i].duration?" ("+conds[i].duration+")":"")
        +". Casting ANY spell, attacking, or speaking reveals them and can end the effect. Do not suggest an action that breaks concealment unless its payoff is clearly worth being revealed, and make that trade explicit in the wording.";
    }
  }
  return "";
}
function suggestionVarietyLine(prev){
  if(!prev||!prev.length)return "";
  return "\nPREVIOUS SUGGESTIONS (do not repeat any of them, and do not lean on the same spell again): "+prev.join(" | ");
}
function buildSuggestionSys(prevActs){
  var s=buildSysPrompt();
  // Mirror callGM's gameplay-turn reinforce append (same resolveReinforce, same inputs): the
  // cache is a PREFIX match, so the suggestion call's stable must be byte-identical to what the
  // main turn actually sent — which includes the model-conditional reinforce on weak models.
  var prov=PROVIDERS[activeProvider]||PROVIDERS.anthropic;
  var model=providerModels[activeProvider]||prov.defaultModel;
  var rf=resolveReinforce(prov,model);
  // TODO #1 P3 (D4): per-PC POV — in a multi-PC round the suggestions are for the sub-turn PC,
  // drawn from THEIR sheet. VOLATILE-only append (after the mode block, so the JSON-output
  // instruction still wins the format fight); the stable half must stay byte-identical to the
  // main turn's or every cache hit dies (engine-tested). Single-player: zero change.
  var mpPov="";
  if(typeof playerCount==="function"&&playerCount()>1){
    var _sp=activePlayer();
    if(_sp&&_sp.name){
      mpPov="\nMULTIPLAYER SUB-TURN: suggest actions for "+_sp.name+" SPECIFICALLY — the party member whose turn it is (their sheet is in the context above; if they are the main character sheet, use that). Only actions "+_sp.name+" can take with THEIR OWN abilities, spells, and items — never another party member's.";
      /* P5: a split PC's options must be scene-local to THEIR thread, not the party's */
      var _spLoc=pcEffectiveLoc(_sp);
      if(_spLoc.location)mpPov+=" "+_sp.name+" is currently at "+_spLoc.location+(_spLoc.sublocation?" ("+_spLoc.sublocation+")":"")+(_sp.splitLoc?" — SPLIT OFF from the party; suggest only actions available there.":".");
    }
  }
  /* #304 C: the suggestion call sends the TURN's volatile byte-for-byte (captured in callGM) so the
     second breakpoint reads at 0.1×; the mode block and its appends ride in `extra`, a third uncached
     block. The buttons still see the outcome — the GM's own last response is in the history pairs. */
  var cap=(typeof lastTurnSys==="function")?lastTurnSys():null;
  var useCap=!!(cap&&cap.volatile&&Date.now()-cap.at<5*60*1000);
  return {stable:useCap?cap.stable:s.stable+(rf||""),volatile:useCap?cap.volatile:s.volatile,extra:SUGGESTION_MODE_BLOCK+suggestionTacticalLine()+suggestionVarietyLine(prevActs)+mpPov};
}
// #305 ②: the FOURTH button — engine-authored from state, no token. Priority: rest when wounded
// (never mid-fight) → use a carried consumable with defined canon → accept the offered quest →
// buy when a want is on the table and there is coin → the periodic wildcard. Null when nothing applies.
function engineFourthAction(){
  if(!worldState||!worldState.character)return null;
  var c=worldState.character,i;
  if(!worldState.combat&&typeof c.hp==="number"&&typeof c.maxHp==="number"&&c.hp<c.maxHp/2)return {kind:"rest",text:"Rest and recover — you are badly hurt."};
  if(typeof endingOffered==="function"&&endingOffered())return {kind:"ending",text:endingOfferText()};/* #325: the authored tale is told — the ending is offered, never forced */
  var wounded=typeof c.hp==="number"&&c.hp<c.maxHp,hurtOrAfflicted=wounded||((c.conditions||[]).length>0);
  if(hurtOrAfflicted&&typeof itemLookup==="function"){for(i=0;i<(c.inventory||[]).length;i++){var it=c.inventory[i],e=itemLookup(it);if(e&&e.category==="consumable"&&e.effect&&e.effect!=="N/A")return {kind:"use",text:"Use your "+(typeof _invBase==="function"?_invBase(it):it)+"."};}}
  var q=worldState.questLog||[];for(i=0;i<q.length;i++)if(q[i]&&q[i].status==="offered")return {kind:"accept",text:"Accept the offer: "+q[i].title+"."};
  if((c.gold||0)>0&&memory&&memory.map&&worldState.world&&worldState.world.location){var key=worldState.world.location;if(typeof locResolve==="function")key=locResolve(key);var node=memory.map.nodes[key];var live=(node&&typeof waresOfferedHere==="function")?waresOfferedHere(node,buildSceneManifest().npcs):[];/* a seller or their shop must be IN the scene (2026-09-03) */if(live.length)return {kind:"buy",text:"Buy the "+live[0].item+" ("+live[0].price+")."};}
  if(montageDue())return {kind:"montage",text:"Skip ahead — a montage to the next real decision."};/* #308 */
  if(typeof WILDCARD_EVERY==="number"&&WILDCARD_EVERY>0&&worldState.turn>0&&worldState.turn%WILDCARD_EVERY===0)return {kind:"wild",text:"Do something reckless."};
  return null;
}
// #308 ①: is a MONTAGE due? MONTAGE_AFTER_TURNS committed turns (the tag log) with no combat tag, no
// move tag, no open fight, no downed hero, no escort — the bellows-pumping stretch the review measured
// at twenty full-price turns. Pure over the tag log.
function montageDue(){
  if(!worldState||worldState.combat||worldState.downed||worldState.deathScene||typeof MONTAGE_AFTER_TURNS!=="number")return false;
  var tl=worldState.tagLog||[];if(tl.length<MONTAGE_AFTER_TURNS)return false;
  var i,j,bad=["COMBAT_START","ENEMY_HP","ENEMY_SLAIN","COMBAT_END","COMBAT_ROUND","LOCATION","SUBLOCATION","SUBLOCATION_LEAVE","REST","TIME_ADVANCE_LARGE"];
  for(i=tl.length-MONTAGE_AFTER_TURNS;i<tl.length;i++){var tags=(tl[i]&&tl[i].tags)||[];for(j=0;j<tags.length;j++)if(bad.indexOf(tags[j])>=0)return false;}
  return true;
}
function montageArmIfChosen(text){if(!worldState)return;if(/\bmontage\b|skip ahead/i.test(String(text||"")))worldState.montagePing={turn:worldState.turn};}
function recklessArmIfChosen(text){if(!worldState)return;if(/do something reckless/i.test(String(text||"")))worldState.recklessPing={turn:worldState.turn};}
// The last 3 player/GM exchanges (#304 B; was 5) as labeled pairs (the ragRetrieve excerpt convention), oldest
// first, GM halves tag-stripped, under a ~6k char budget — five lavish prose turns can't balloon
// the call; under pressure the window degrades 4→3→2 but the NEWEST pair always survives.
function suggestionHistoryPairs(){
  var out=[],chars=0,i;
  for(i=sessionLog.length-1;i>=0&&out.length<3;i--){/* #304 B (owner ruling 2026-09-02): five → three exchanges — the newest pair always survives below */
    if(sessionLog[i].role!=="assistant")continue;
    var gm=cleanTxt(sessionLog[i].content);
    var pl=(i>0&&sessionLog[i-1].role==="user")?sessionLog[i-1].content:"";
    var block=(pl?"Player: "+pl+"\n":"")+"GM: "+gm;
    if(out.length>0&&chars+block.length>6000)break;
    out.unshift(block);chars+=block.length;
  }
  return out.join("\n\n");
}
// Tolerant parse. #141: primary shape is now the scene-check OBJECT {present, actions} — the
// present line is the checking space the instant-JSON call lacked (t833 / the driverless-cart
// phantom, field 2026-08-07) and is logged as field telemetry. Every legacy tolerance survives:
// bare arrays, fenced/prose-wrapped payloads. An object without an actions array THROWS into
// generateActions' quiet-removal path — never a silent pass-through.
function parseSuggestionArray(resp){
  var txt=stripCodeFences(resp);
  function pick(v){
    if(v instanceof Array)return v;
    if(v&&typeof v==="object"&&v.actions instanceof Array){
      if(typeof v.present==="string"&&v.present&&typeof console!=="undefined")console.info("[actions] scene check (#141): "+v.present.slice(0,160));
      return v.actions;
    }
    return null;
  }
  var got=null;
  try{got=pick(JSON.parse(txt));}catch(e){}
  if(got)return got;
  var mo=txt.match(/\{[\s\S]*\}/);
  if(mo){try{got=pick(JSON.parse(mo[0]));}catch(e2){}}
  if(got)return got;
  var ma=txt.match(/\[[\s\S]*\]/);
  if(ma)return JSON.parse(ma[0]);
  throw new Error("no suggestion payload found in the response");
}
// ── #126: suggestion affordance gate ──────────────────────────────────────────────────────────
// The t355 cross-town-Message class RECURRED in the field (2026-08-02: "Send Message to Ameiko
// checking Sandpoint's quiet" offered on the Magnimar road) despite the un-starved context — the
// forensic showed the NPC GRAPH block explicitly said "NPCs elsewhere: Ameiko → Sandpoint" and
// the model built the button anyway. The prompt channel is exhausted for this class, so this is
// a new CHANNEL: a deterministic validator between model output and rendered buttons. The prompt
// and its cache split are UNTOUCHED (the v1.288 starvation lesson stands; roster/RAG remain
// narration context) — they just no longer AUTHORIZE a button target. Authorization is scene-
// local, derived from data the engine already holds (party, lastSeenAt map stamps, the newest
// narration, map edges, the bible's range canon). Rules are deliberately NARROW (the B3-refusal
// style): a tapped suggestion becomes player intent, so a false reject costs a legitimate
// creative option — the fuzzy off-scene-mention class LOGS but passes until field telemetry
// earns it a promotion.
var SUGGESTION_NAME_STOP={the:1,old:1,young:1,lady:1,lord:1,sir:1,sheriff:1,father:1,mother:1,brother:1,sister:1,master:1,captain:1,guard:1};
// Distinctive-token alternation for an NPC name: buttons say "Ameiko", the roster says "Ameiko
// Kaijitsu" — match any name token ≥4 chars that isn't a title/stop word.
function suggestionNameAlt(nm){
  var toks=String(nm||"").split(/\s+/).filter(function(t){return t.length>=4&&!SUGGESTION_NAME_STOP[t.toLowerCase()];});
  if(!toks.length)toks=[String(nm||"")];
  return "("+toks.map(function(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}).join("|")+")";
}
// Remote-capable only when the canon SAYS so in distance words; self/touch/Nft/N-A are all
// scene-scale — they cannot reach someone who is not present.
function suggestionRangeLocal(rangeStr){
  return !/mile|unlimited|any distance|anywhere|same plane/i.test(String(rangeStr||""));
}
// Does the text INVOKE this capability (vs merely containing its words)? Generic English
// collides with short spell names ("send a message", "heal up"): a single-word name counts only
// when Capitalized mid-text (proper-noun signal) or within reach of a casting verb. Multi-word
// names are distinctive enough on their own. The sentence-initial "Message Ameiko…" ambiguity
// this rule can't resolve is closed by rule ④ (#12/B18): verb-adjacent absent-NPC address is
// rejected on adjacency alone, capitalization-independent.
function suggestionInvokesCap(text,capName){
  var esc=String(capName).replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
  var m=String(text).match(new RegExp("\\b"+esc+"\\b","i"));
  if(!m)return false;
  if(String(capName).indexOf(" ")>=0)return true;
  var at=String(text).indexOf(m[0]);
  var midCap=at>0&&/[A-Z]/.test(m[0].charAt(0));
  var castVerb=/\b(cast|casts|casting|use|uses|using|invoke|invoking|channel)\b[\s\S]{0,24}$/i.test(String(text).slice(0,at));
  return midCap||castVerb;
}
// The scene-local manifest: who is PRESENT, where the exits lead, what the active character can
// actually use — pure derivation from existing state, no new bookkeeping, no model involvement.
function buildSceneManifest(){
  var man={npcs:[],exits:[],caps:[]},i,seen={};
  function addNpc(nm){var k=String(nm).toLowerCase();if(!seen[k]){seen[k]=1;man.npcs.push(nm);}}
  var loc=(worldState.world&&worldState.world.location)||"";
  var sub=(worldState.world&&worldState.world.sublocation)||null;
  var nodeKey=sub?loc+"|"+sub:loc;
  var npcs=worldState.npcs||[];
  for(i=0;i<npcs.length;i++){
    var n=npcs[i];
    if(n.dead)continue;
    /* #137: membership is not presence — a split member (charSheet.splitLoc set) is NOT an
       authorized local interaction target; with them excluded here, gate rule ④ rejects
       direct address of them exactly like any absent NPC (the t1467 Daeris class). */
    if(n.partyMember){if(!(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location))addNpc(n.name);continue;}
    var mn=(typeof memory!=="undefined"&&memory.npcs&&memory.npcs[n.name])||{};
    var ls=String(mn.lastSeenAt||"");
    /* #156B: presence resolves through the location identity table — a stamp under the current
       node's merged alias is HERE. Same-world test runs on the RESOLVED keys. */
    var rls=ls?locResolve(ls):"",rLoc=locResolve(loc),rNode=locResolve(nodeKey);
    if(rls&&(rls===rNode||rls===rLoc||rls.indexOf(rLoc+"|")===0))addNpc(n.name);
  }
  // #283 (Sol brief 35①): presence by STRUCTURED observation only — the active scene frame's
  // observed[] list (#194: [SAY:] speakers, combat-named rostered NPCs, [SCENE_CAST:] members,
  // all split-guarded at the post-handler seam). The old pass scanned the last GM entry's PROSE
  // for living roster names with NO polarity judgment and no sourced-presence consultation, so
  // "Ameiko remains in Sandpoint, miles away" authorized Ameiko and disabled the local-cap and
  // absent-direct-address rules for that button set — the exact mention-to-presence inference
  // #194 made impossible in the canonical writers, alive in the UI authorization seam. The
  // frame-node guard keeps a stale frame (party moved this response, frame not yet rotated)
  // from authorizing the OLD scene's cast at the new node. Residual trade, accepted: a rostered
  // NPC narrated into the scene with zero tags is no longer authorized until they speak/fight/
  // are cast — rule ④ then rejects direct address, and the manifest fallback substitutes.
  var _frame=worldState.sceneRefs&&worldState.sceneRefs.active;
  if(_frame&&_frame.observed instanceof Array&&typeof locResolve==="function"
     &&_frame.node!=null&&locResolve(String(_frame.node))===locResolve(nodeKey)){
    for(i=0;i<_frame.observed.length;i++){
      var _ob=_frame.observed[i]&&_frame.observed[i].entity;if(!_ob)continue;
      var _obNm=(typeof resolveNpcName==="function")?resolveNpcName(_ob):_ob;
      for(var _oj=0;_oj<npcs.length;_oj++){if(npcs[_oj].name===_obNm&&!npcs[_oj].dead){addNpc(npcs[_oj].name);break;}}
    }
  }
  // B24: world-map edges are connectivity at WORLD-NODE grain only. Inside a sub-location the
  // party must leave first (the t1459 button offered an overland road from a sealed chamber
  // under The Spire), and mid-combat nobody strolls off down a highway — in both states the
  // edges are NOT immediate affordances. Sublocated scenes get the one geographically honest
  // move instead: the way back out (man.back), which rule ⑤ passes by construction.
  var map=(typeof memory!=="undefined"&&memory.map)||{};
  if(sub){
    man.back=loc;
  }else if(!worldState.combat){
    (map.edges||[]).forEach(function(ed){
      if(ed.from===loc&&man.exits.indexOf(ed.to)<0)man.exits.push(ed.to);
      if(ed.to===loc&&man.exits.indexOf(ed.from)<0)man.exits.push(ed.from);
    });
  }
  var c=worldState.character||{};
  function addCap(nm){
    var e=(typeof capabilityLookup==="function")?capabilityLookup(nm):null;
    if(e)man.caps.push({name:capBaseName(nm),range:String(e.range||"")});
  }
  (c.spells||[]).forEach(function(s){addCap(s.nm);});
  (c.abilities||[]).forEach(function(a){addCap(a.nm);});
  return man;
}
// null = passes; {rule,detail} = reject. Narrow, high-precision rules only.
function validateSuggestion(text,man){
  var i,j,t=String(text||""),npcs=worldState.npcs||[];
  var present={};for(i=0;i<man.npcs.length;i++)present[String(man.npcs[i]).toLowerCase()]=1;
  // ① a scene-scale capability aimed at someone who is not here (THE field case)
  for(i=0;i<man.caps.length;i++){
    var cap=man.caps[i];
    if(!suggestionRangeLocal(cap.range))continue;
    if(!suggestionInvokesCap(t,cap.name))continue;
    for(j=0;j<npcs.length;j++){
      if(present[String(npcs[j].name).toLowerCase()])continue;
      if(new RegExp("\\b"+suggestionNameAlt(npcs[j].name)+"\\b","i").test(t))
        return {rule:"local-cap-remote-target",detail:cap.name+" ("+cap.range+") aimed at "+npcs[j].name+", who is not present"};
    }
  }
  // ② casting a bible spell the active character does not own
  if(/\b(cast|casts|casting)\b/i.test(t)&&typeof CAPABILITY_BIBLE!=="undefined"){
    var owned={};for(i=0;i<man.caps.length;i++)owned[man.caps[i].name]=1;
    for(var key in CAPABILITY_BIBLE){
      if(CAPABILITY_BIBLE[key].kind!=="spell"||owned[key])continue;
      if(suggestionInvokesCap(t,key))return {rule:"unowned-capability",detail:"casts "+key+", which is not on the active character's sheet"};
    }
  }
  // ③ direct interaction with the DECEASED (B3 stamp) — mere mention stays legal
  for(j=0;j<npcs.length;j++){
    if(!npcs[j].dead)continue;
    if(new RegExp("\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give)\\b[\\s\\S]{0,24}\\b"+suggestionNameAlt(npcs[j].name)+"\\b","i").test(t))
      return {rule:"dead-npc-interaction",detail:npcs[j].name+" is deceased (t"+npcs[j].dead+")"};
  }
  // ④ (#12/B18, promoted from the log-only class): a direct-address verb IMMEDIATELY aimed at
  // an absent NPC — "message Hemlock" from the Sea Cave tunnels (t1114). ADJACENCY is the
  // precision lever: the verb must sit right on the name (articles/prepositions only between),
  // so "Ask Morwen about Ameiko" binds to PRESENT Morwen and a trailing absent name never
  // false-positives, while "message Hemlock" / "Message to Ameiko" are caught regardless of
  // capitalization (this closes the sentence-initial leak rule ① documented).
  for(j=0;j<npcs.length;j++){
    if(npcs[j].dead)continue;/* ③ owns the dead — its message names the real reason */
    if(present[String(npcs[j].name).toLowerCase()])continue;
    if(new RegExp("\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give|message|signal|hail|summon|contact|warn|alert|call out to)\\b[ '\"]{0,3}(to |with |the |a )?"+suggestionNameAlt(npcs[j].name)+"\\b","i").test(t))
      return {rule:"absent-npc-direct-address",detail:npcs[j].name+" is not present in the scene"};
  }
  // ⑤ (B24, t1459): ASSERTED immediate overland travel while inside a sub-location — a LEADING
  // travel verb aimed at a known world node other than the current location. The leading verb
  // is the precision lever: it makes the travel BE the action, so "Press on toward Varisia -
  // North Road." from a sealed chamber rejects, while planning shapes ("Return to Sandpoint
  // tomorrow to report…") and mid-suggestion mentions stay legal and ride the tier-2 watch
  // line below (the #126 telemetry-before-promotion pattern). Heading back to the CURRENT
  // world location always passes — that is the legitimate way out.
  var wSub=worldState.world&&worldState.world.sublocation;
  if(wSub){
    var tvm=t.match(/^\s*(?:press on (?:toward|to)|head (?:to|for|toward|towards)|travel to|set out (?:for|toward|towards)|ride (?:to|toward|towards)|march (?:to|toward|towards)|journey (?:to|toward|towards)|make for)\s+(.+)$/i);
    if(tvm){
      var tvDest=tvm[1].replace(/[.!?]+\s*$/,"").trim().toLowerCase();
      var tvNodes=(typeof memory!=="undefined"&&memory.map&&memory.map.nodes)||{};
      for(var tvk in tvNodes){
        if(tvk.indexOf("|")>=0||locIsSub(tvk))continue;                    // world nodes only — #156B: world-ness derives from the parent relation, not key shape (a reparented ex-world node is a sub)
        if(tvk.toLowerCase()!==tvDest)continue;
        if(!locSame(tvk,worldState.world.location))                        // #156B: the current location's merged alias is HERE, not remote travel
          return {rule:"unreachable-travel",detail:"asserts immediate travel to "+tvk+" from inside "+worldState.world.location+" — "+wSub};
        break;
      }
    }
    // Tier-2 (LOG ONLY, watching): a remote world node named anywhere in a suggestion while
    // sublocated — legal fiction (plans, letters, talk of home) until the field says otherwise;
    // same telemetry-before-promotion arc as the off-scene-NPC line below.
    var tvN2=(typeof memory!=="undefined"&&memory.map&&memory.map.nodes)||{};
    for(var tk2 in tvN2){
      if(tk2.indexOf("|")>=0||locIsSub(tk2)||locSame(tk2,worldState.world.location))continue;/* #156B */
      var tkEsc=tk2.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      if(new RegExp("\\b"+tkEsc+"\\b","i").test(t)){
        console.info("[actions] remote location named in a suggestion while sublocated (allowed, watching): \""+t+"\" → "+tk2);
        break;
      }
    }
  }
  // ⑥ (#143, the Mokmurian button): a suggestion naming an entity the story has NEVER
  // introduced. The axis is INTRODUCTION, not meeting (user ruling 2026-08-07: planning
  // against a heard-of General Zod is legitimate play — one on-screen mention, ever, makes a
  // name fair game forever). npc.introduced is a lazy stamp back-filled by a one-time
  // transcript scan (the RAG backfill pattern); blueprint-seeded dossiers (met:0, no
  // first-encounter, zero transcript presence) are exactly what this catches — their
  // GM-eyes-only knowledge must never surface in a player-facing button before the story
  // says the name. Present/party members short-circuit above via `present`.
  for(j=0;j<npcs.length;j++){
    var cbN=npcs[j];
    if(cbN.dead)continue;
    if(!new RegExp("\\b"+suggestionNameAlt(cbN.name)+"\\b","i").test(t))continue;
    if(cbN.introduced)continue;/* stamped fair game */
    // Record signals prove introduction without a scan: they only exist through lived play
    // (tag registration, a first-encounter snippet, a map sighting) — and PRESENCE is
    // introduction happening right now. Stamp durably in every case: narration-presence is
    // transient (drops out of the last-entry window) but introduction is forever.
    var cbMem=(typeof memory!=="undefined"&&memory.npcs&&memory.npcs[cbN.name])||{};
    if(present[String(cbN.name).toLowerCase()]||cbN.met>0||cbMem.firstEncounter||cbMem.lastSeenAt){
      cbN.introduced=worldState.turn||1;continue;
    }
    var cbFound=0,cbTr=worldState.transcript,cbNl=String(cbN.name).toLowerCase(),cbk;
    if(cbTr instanceof Array){
      for(cbk=0;cbk<cbTr.length;cbk++){
        var cbx=cbTr[cbk]&&cbTr[cbk].x;
        if(cbx&&String(cbx).toLowerCase().indexOf(cbNl)>=0){cbFound=cbTr[cbk].t||1;break;}
      }
    }
    if(cbFound){cbN.introduced=cbFound;continue;}/* lazy backfill — scan once, stamped forever */
    return {rule:"unintroduced-entity",detail:cbN.name+" has never been introduced in the story — outline material may not surface in a button before the narration says the name"};
  }
  // Fuzzy class: off-scene NPC named with no capability involved — legal fiction (letters,
  // asking a companion about them). LOG ONLY; telemetry decides if it ever graduates.
  for(j=0;j<npcs.length;j++){
    if(npcs[j].dead||present[String(npcs[j].name).toLowerCase()])continue;
    if(new RegExp("\\b"+suggestionNameAlt(npcs[j].name)+"\\b","i").test(t)){
      console.info("[actions] off-scene NPC named in a suggestion (allowed, watching): \""+t+"\" → "+npcs[j].name);
      break;
    }
  }
  // ⑦ (2026-09-03, the High Spire lift terminal): a purchase of a recorded ware with neither the seller
  // nor their shop in the scene — the settlement's market record is not a stall in front of the player.
  if(/^(buy|purchase|haggle for|pay for)\b/i.test(t)&&typeof waresOfferedHere==="function"&&typeof memory!=="undefined"&&memory&&memory.map&&worldState.world&&worldState.world.location){
    var _bk=worldState.world.location;if(typeof locResolve==="function")_bk=locResolve(_bk);var _bn=memory.map.nodes[_bk],_bl=(_bn&&typeof nodeWaresLive==="function")?nodeWaresLive(_bn):[],_bo=_bn?waresOfferedHere(_bn,man.npcs):[],_bi;
    for(_bi=0;_bi<_bl.length;_bi++){var _bw=_bl[_bi];if(!new RegExp("\\b"+suggestionNameAlt(_bw.item)+"\\b","i").test(t))continue;
      if(_bo.some(function(o){return o.item===_bw.item;}))break;
      return {rule:"buy-without-seller",detail:_bw.item+" is on the settlement's record but neither its seller nor its shop is in the scene"};}
  }
  return null;
}
// Deterministic local fallback — engine-composed from the manifest AND still revalidated below.
// B24: the old "valid by construction" assumption WAS the bug (a rejected button got replaced
// with overland travel from inside a sealed sub-location) — construction keeps candidates
// scene-plausible, validateSuggestion is the belt, and the terminal generic is the axiomatic
// floor (names no entity, no capability, no destination), so the loop provably terminates.
function suggestionFallback(man,taken){
  var cands=[],i,j;
  if(man.back)cands.push("Head back toward "+man.back+".");
  for(i=0;i<man.exits.length;i++)cands.push("Press on toward "+man.exits[i]+".");
  /* #305 ③: flavour from STATE, not stock phrases — a wounded hero binds wounds, coin gets counted,
     a market gets browsed, a companion gets checked on by name. Still revalidated below. */
  var c=worldState&&worldState.character;
  if(c&&typeof c.hp==="number"&&c.hp<c.maxHp/2)cands.push("Bind your wounds and rest.");
  for(i=0;i<man.npcs.length;i++)cands.push("Check on "+man.npcs[i]+".");
  if(c&&memory&&memory.map&&worldState.world&&worldState.world.location&&typeof nodeWaresLive==="function"){var _wk=worldState.world.location;if(typeof locResolve==="function")_wk=locResolve(_wk);var _wn=memory.map.nodes[_wk];if(_wn&&nodeWaresLive(_wn).length)cands.push("Look over what's for sale here.");}
  if(c&&(c.gold||0)>0)cands.push("Count your coin and think.");
  for(i=0;i<man.npcs.length;i++)cands.push("Talk things over with "+man.npcs[i]+".");
  cands.push("Rest and take stock of the situation.");
  cands.push("Study your surroundings carefully.");
  for(i=0;i<cands.length;i++){
    var dup=false;
    for(j=0;j<taken.length;j++){if(String(taken[j]).toLowerCase()===cands[i].toLowerCase()){dup=true;break;}}
    if(dup)continue;
    if(validateSuggestion(cands[i],man)!==null)continue;
    return cands[i];
  }
  return "Take a moment to consider your next move.";
}
// Fail CLOSED: an invalid button is never shown — it is logged loudly (console + #16 crumb)
// and replaced by a manifest fallback. Valid buttons pass through byte-untouched.
function applySuggestionGate(acts){
  if(!acts||!acts.length)return acts;
  var man=buildSceneManifest(),out=[],i;
  for(i=0;i<acts.length&&i<3;i++){
    var t=String(acts[i]||"").trim();
    var bad=t?validateSuggestion(t,man):{rule:"empty",detail:"blank suggestion"};
    if(!bad){out.push(t);continue;}
    var fb=suggestionFallback(man,out.concat(acts));
    console.warn("[actions] suggestion REJECTED ("+bad.rule+"): \""+t+"\" — "+bad.detail+"; replaced with \""+fb+"\"");
    if(typeof erCrumb==="function")erCrumb("suggestion-reject",{rule:bad.rule,txt:t.slice(0,80)});
    out.push(fb);
  }
  return out;
}
async function generateActions(msgEl){
  /* #300: a downed hero gets the engine's two moves — no model call, no token, no invented rescue. */
  if(worldState&&worldState.deathScene&&worldState.deathScene.stage==="choose"&&typeof deathChoiceButtons==="function"){var _dcb=deathChoiceButtons();msgEl.insertAdjacentHTML("beforeend",buildActionButtons(_dcb));worldState.lastActions=_dcb;if(typeof saveAll==="function")saveAll();return;}/* #301 */
  if(worldState&&worldState.deathScene){worldState.lastActions=null;return;}/* #301: no suggestions while Death speaks — the next line is the question */
  if(worldState&&worldState.pendingCheck){worldState.lastActions=null;return;}/* #329: the die is the only button while a roll is pending */
  if(worldState&&worldState.downed&&typeof downedChoices==="function"){var _dc=downedChoices();msgEl.insertAdjacentHTML("beforeend",buildActionButtons(_dc));worldState.lastActions=_dc;if(typeof saveAll==="function")saveAll();return;}
  var btnDiv=document.createElement("div");
  btnDiv.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
  var btns=[],i;
  for(i=0;i<3;i++){var b=document.createElement("button");b.className="qa";b.textContent="…";b.disabled=true;b.style.minWidth="80px";btnDiv.appendChild(b);btns.push(b);}
  msgEl.appendChild(btnDiv);
  // t833: keep the outgoing set for the anti-fixation line BEFORE the E26 clear below
  var prevActs=(worldState.lastActions&&worldState.lastActions.slice)?worldState.lastActions.slice(0,3):null;
  worldState.lastActions=null; // clear now (audit E26) — if this call fails, reload won't re-attach the PREVIOUS turn's buttons to the newest narration
  var turnAt=worldState.turn; // race guard: a fast next action can land while this call is in flight
  function _cleanup(){for(var _c=0;_c<3;_c++){if(btns[_c].parentNode)btns[_c].parentNode.removeChild(btns[_c]);}if(btnDiv.parentNode)btnDiv.parentNode.removeChild(btnDiv);}
  try{
    // v1.288 un-starve: the full gameplay system prompt (stable byte-identical → cache read;
    // SUGGESTION MODE appended to volatile) + the last 5 exchanges as labeled pairs. noHistory
    // stays true — the window IS the history, at a bounded cost. Runs on the ACTIVE model (null
    // override): caches are model-scoped, an escalated model would pay full freight. See the
    // block comment above the suggestion helpers for the whole incident history.
    /* #328 (owner ruling 2026-09-03): the GM wrote its own buttons at the end of the turn ([SUGGEST:], filed by the
       tag table for THIS turn). Use them and skip the second full-prompt call. Anything short of three, or the
       setting off, falls through to the v1.288 un-starved call below — byte-for-byte, the rollback path. */
    var _ib=(typeof suggestInband!=="undefined"&&suggestInband&&worldState.suggestInband&&worldState.suggestInband.turn===worldState.turn)?worldState.suggestInband.acts:null;
    delete worldState.suggestInband;
    var resp=null;
    if(_ib&&_ib.length>=3){resp=JSON.stringify({present:"",actions:_ib.slice(0,3)});if(typeof console!=="undefined")console.info("[actions] #328 in-band buttons used — no suggestion call");}
    else resp=await callGM("RECENT SCENES (oldest first — the LAST one is the current moment):\n"+suggestionHistoryPairs()+"\n\n"+SUGGESTION_ASK,buildSuggestionSys(prevActs),200,null,{noHistory:true,kind:"actions"});/* #283②: SUGGESTION_ASK matches the mode block's object demand — the user channel no longer erases the #141 checking space */
    if(worldState.turn!==turnAt)throw new Error("stale"); // a newer turn landed; discard quietly
    var acts=parseSuggestionArray(resp);
    if(!acts||!acts.length){_cleanup();return;}/* remove the "…" placeholders on an empty result too (audit E25) */
    acts=applySuggestionGate(acts);/* #126 affordance gate — an impossible button is never rendered (fail closed, loud log) */
    /* TODO #1 P3 (D4): in a multi-PC round, label whose options these are. Display prefix ONLY —
       data-action stays the bare action (the queue line re-attaches the name at submit). */
    var _mpPfx=(typeof playerCount==="function"&&playerCount()>1&&activePlayer()&&activePlayer().name)?activePlayer().name+": ":"";
    for(i=0;i<3&&i<acts.length;i++){var a=punctuateAction(acts[i].trim());btns[i].textContent=_mpPfx+a;btns[i].setAttribute("data-action",a);btns[i].setAttribute("title","Tap to edit · hold or Ctrl-click to send");btns[i].setAttribute("onclick","sendSuggestedAction(this,event)");btns[i].disabled=false;}/* #88: punctuated so a tapped suggestion reads as a real sentence and gets a clean TTS pause boundary */
    worldState.lastActions=acts.slice(0,3);
    /* #305 ②: the fourth, engine-authored button — appended after the model's three, no token, and
       exempt from the affordance gate (it names sheet, quest, and market facts, never scene entities). */
    var _fa=(typeof engineFourthAction==="function")?engineFourthAction():null;
    if(_fa&&_fa.text){var _fb=document.createElement("button");_fb.className="qa";var _fat=punctuateAction(_fa.text);_fb.textContent=_mpPfx+_fat;_fb.setAttribute("data-action",_fat);_fb.setAttribute("title","Tap to edit · hold or Ctrl-click to send");_fb.setAttribute("onclick","sendSuggestedAction(this,event)");_fb.style.borderStyle="dashed";btnDiv.appendChild(_fb);worldState.lastActions.push(_fat);}
  }catch(e){console.warn("[actions] suggestion call failed — buttons removed (deliberately quiet in the UI; the turn itself succeeded):",e.message);if(typeof reportError==="function")reportError("actions",e.message,(e&&e.stack)||"");_cleanup();}
  finally{saveAll();}/* #280b: the turn's ONE cloud sync — EVERY exit (fresh buttons, the empty result, the failure's honest E26 null, the stale race) converges the server to the truth. R4's local-only save here left the E26 null on the wire while the fresh buttons stayed stranded on this device (the JP0-11 cap skips the mature-save flush), so the other device rendered the newest narration buttonless — the 2026-08-29 field report. One POST per turn, unchanged: the commit no longer arms one. */
}
// ── #96: dialogue attribution via [SAY:] tags — deterministic, no second model call ──────────
// The GM names each line's speaker AT AUTHORING TIME with [SAY:Name] placed just before the
// quote (tag_table: stripped from display like every state tag; no state mutation). This
// replaced the #9 LLM post-pass at v1.447 — the GM knew who spoke while writing, and the
// post-pass paid a second model call to reconstruct that knowledge from the finished prose
// (field evidence 2026-07-26: it misbound lines WITH explicit attribution). Attribution now
// travels inside the response itself: no 400-token speakers call, no wait fuse, no unit cap,
// and muted turns keep their maps (derivation is free). Storage format is UNCHANGED
// ({n:<unitCount>, s:{unitIndex:name}}) — stampTranscriptSpeakers, speakerVoiceMap, the replay
// button, and the sp.n splitter fuse all behave exactly as before; only the map's PRODUCER
// moved from a model call to the pure function below.
//
// (#93 ②, v1.603: speakerSpans() — which grouped units into whole dialogue spans — is DELETED.
// The v1.451 segment-claiming deriver iterates UNITS and never grouped them, so its only caller
// had been its own engine test since that rework. Its surviving concern, that a multi-clause line
// stays one contiguous dialogue run with the attribution outside it, is asserted directly on the
// units in the B14b splitter test.)
// The producer (#96, reworked v1.451 on same-night field evidence). Pure: RAW response + CLEAN
// text in, {n,s} map or null out. The raw text is cut into SEGMENTS at the [SAY:] tags — each
// tag owns every character until the next tag — and each dialogue UNIT is located inside those
// segments with a forward-only cursor, taking its segment's speaker. Unit-level segment claiming
// (v1) matched only each tag's FIRST quote, which the field falsified within hours: real GM
// speeches are MULTI-SPAN ('"Steady," she says. "First time in days…"' — continuations narrated
// flat), and the #93 adjacent-paragraph span merge glued two speakers into ONE span, which both
// silenced the second speaker's tag AND broke opening-prefix matching. Segments fix all of it:
// continuations sit inside their tag's segment, and a merged span's units land in DIFFERENT
// segments and split correctly. Text before the first tag belongs to nobody (narrator), a unit
// not found in any segment is skipped (clean/raw divergence — narrator, never a guess), and
// unknown speaker names still pass through: speakerVoiceMap drops what it cannot resolve.
var SAY_TAG_RE=/\[SAY:([^\]|]+)(?:\|[^\]]*)?\]/g;   // [SAY:Name] — the |descriptor payload is reserved (delivery styles, later)
function _sayNorm(s){return String(s||"").replace(/[“”"]/g,"").replace(/\s+/g," ").replace(/^\s+|\s+$/g,"").toLowerCase();}
// #93 ①b: _sayNorm strips quote marks, which made segment matching QUOTE-BLIND — narration sitting
// in speaker A's segment that happened to contain the text of speaker B's later tagged line captured
// B's line into A's voice, and the forward-only cursor then never reached B's segment at all (probe
// W1: "Frizwick will only say ten out of ten, as always." stole Frizwick's own "Ten out of ten,").
// So a segment is scanned into the same quote-stripped text as before PLUS a parallel mask marking
// which characters sit inside a quoted run, and a key must LAND inside one.
// Two properties the mask has to have, both load-bearing:
//   • quote state CARRIES across segment boundaries — a [SAY:] tag does not reset parity, and the GM
//     may write '"[SAY:X]Ten out of ten," he says.' with the opener in the PREVIOUS segment. Restart
//     it per segment and that correctly-authored shape narrates flat forever, while sayTagCoverage
//     reports it unmapped. (It does NOT also silence buildSayComplianceNudge on that shape —
//     measured: sayTagCoverage's paragraphGaps floor fires there regardless of the map. That
//     detector defect is separate and predates #93; it is recorded in the #93 row.)
//   • state RESETS at a blank-line paragraph break, mirroring splitSentences' per-paragraph _inQ,
//     so mask and unit labels stay coherent. normalizeForTTS turns newlines into spaces, so the
//     break has to be found BEFORE normalizing.
// The mask must see the text splitSentences sees. Two ways the RAW slice differs from the CLEAN
// text, both found by adversarial review of the first cut and both able to produce a WRONG
// CHARACTER VOICE — the exact harm #93 exists to remove:
//   • a quote glyph inside any stripped tag payload ([NPC_NOTE:… she keeps saying "ten out of ten])
//     toggled the mask, so every later key landed unmasked and the WHOLE map was thrown away;
//   • cleanTxt CREATES paragraph breaks the raw does not have, by removing a tag that sat alone on
//     its own line. splitSentences resets its quote state there and the mask did not, so the mask
//     inverted, the correct in-quote hit was rejected, and the forward-only cursor walked on into a
//     LATER speaker's segment and bound the line to them.
// Stripping fixes the first. The second needs more than stripping: when the tag that creates the
// break is the [SAY:] tag itself, its two slices end and begin with a lone newline each, so no
// per-slice split can see it — hence the `tail` seam carried on the shared state object.
// cleanTxt's own regexes are reused so the two cannot drift, but applied SILENTLY: cleanTxt's
// unknown-tag catch-all warns, and warning once per segment per turn would be permanent console noise.
function _sayStripTags(s){
  s=String(s||"");
  if(typeof _CT_TAGS!=="undefined")s=s.replace(_CT_TAGS,"");
  if(typeof _CT_BARE!=="undefined")s=s.replace(_CT_BARE,"");
  return s.replace(/\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g,"").replace(/\[[A-Z][A-Z_]{2,}(:[^\]]*)?\s*$/,"");
}
function _saySegScan(rawSlice,state){
  var _s=_sayStripTags(rawSlice);
  var _head=(_s.match(/^\s*/)||[""])[0];
  if(state.tail&&/\n\s*\n/.test(state.tail+_head))state.inQ=false;   // the break straddles the tag cut
  if(/\S/.test(_s))state.tail=(_s.match(/\s*$/)||[""])[0];else state.tail=(state.tail||"")+_s;
  var chunks=_s.split(/\n\s*\n/),text="",mask=[],para=[],ci,k,ch,norm;
  for(ci=0;ci<chunks.length;ci++){
    if(ci>0)state.inQ=false;                          // paragraph break — parity restarts
    norm=TTS._textPrep.normalizeForTTS(chunks[ci]);
    if(norm&&text){text+=" ";mask.push(false);para.push(true);}       // the break itself is one space, as _sayNorm would collapse it
    for(k=0;k<norm.length;k++){
      ch=norm.charAt(k);
      if(ch==='"'||ch==="“"||ch==="”"){state.inQ=!state.inQ;continue;}
      if(ch===" "&&(!text||text.charAt(text.length-1)===" "))continue;
      text+=ch.toLowerCase();mask.push(state.inQ);para.push(ci>0);/* P4a: continuation paragraphs of a segment own no voice */
    }
  }
  while(text.charAt(text.length-1)===" "){text=text.slice(0,-1);mask.pop();para.pop();}
  return {text:text,mask:mask,para:para};
}
function deriveSpeakerMapFromTags(raw,clean){
  if(!raw||typeof TTS==="undefined"||!TTS._textPrep)return null;
  SAY_TAG_RE.lastIndex=0;
  // Segment text must pass through the SAME character rewrites the units underwent (splitSentences
  // runs normalizeForTTS: emphasis stripped, em/en-dash -> ", ", "..." -> "…") or a dash/markdown
  // inside a quoted line makes its 48-char key unfindable and the line narrates flat.
  var segs=[],m,prevEnd=0,prevName=null,sawTag=false,qs={inQ:false};
  while((m=SAY_TAG_RE.exec(raw))){
    sawTag=true;
    segs.push(_sayCarry({name:prevName},_saySegScan(raw.slice(prevEnd,m.index),qs)));
    var nm=String(m[1]).replace(/^\s+|\s+$/g,"");
    prevName=nm||null;                                // [SAY: ] with a blank name owns its segment as narrator
    prevEnd=SAY_TAG_RE.lastIndex;
  }
  if(!sawTag)return null;
  segs.push(_sayCarry({name:prevName},_saySegScan(raw.slice(prevEnd),qs)));
  var units=TTS._textPrep.splitSentences(clean,null,true);
  var out={},kept=0,si=0,off=0,i;
  for(i=0;i<units.length;i++){
    var u=units[i];
    if(!u)continue;
    // A unit the splitter FLATTENED (#93 ①) is narration for voicing purposes but still holds real
    // quoted text in the raw, so it must consume the forward-only cursor: leaving it unconsumed let
    // its text stay claimable and capture a LATER speaker's identical tagged line into the wrong voice.
    var _isFlat=!!u.flat;
    if((u.spk===null||u.spk===undefined)&&!_isFlat)continue;   // narration keeps the narrator, always
    var key=_sayNorm(u.text).slice(0,48);
    if(!key)continue;
    var j=si,hit=-1;
    while(j<segs.length){
      var from=(j===si)?off:0;
      for(;;){
        hit=segs[j].text.indexOf(key,from);
        if(hit<0)break;
        if(segs[j].mask[hit])break;                   // the hit must START inside a quoted run
        from=hit+1;                                   // a narration echo of the line — keep looking
      }
      if(hit>=0)break;
      j++;
    }
    if(j>=segs.length)continue;                       // not in any segment — narrator, cursor unmoved
    si=j;off=hit+key.length;                          // forward-only: repeated identical lines bind in order
    if(_isFlat)continue;                              // cursor advanced, but a flattened unit takes no voice
    /* P4a (owner ruling 2026-08-13): ALL quotes must be tagged — including each new paragraph of a
       continuing speech. A hit in a CONTINUATION paragraph of the segment consumes the cursor (it
       is real quoted text, so later speakers cannot steal it) but takes NO voice: the narrator
       reads it flat and sayTagCoverage counts it missing, so the compliance channel demands the
       tag. This retired the inherited-voice guess and the parity-discriminator debate with it. */
    if(segs[j].name&&!(segs[j].para&&segs[j].para[hit])){out[i]=segs[j].name;kept++;}
  }
  return kept?{n:units.length,s:out}:null;
}
function _sayCarry(seg,scan){seg.text=scan.text;seg.mask=scan.mask;seg.para=scan.para;return seg;}

/* #168: the SAY compliance detector reads the same dialogue units and ownership map as playback.
   Counts of quote glyphs are not evidence: a single tag can intentionally own multiple speech
   spans. Deterministic gaps are (a) dialogue units playback could not map and (b) a new dialogue
   paragraph whose first quote has no tag before it in that paragraph. */
function sayTagCoverage(raw,clean){
  raw=String(raw||"");clean=String(clean||"");
  if(typeof TTS==="undefined"||!TTS._textPrep)return null;
  var units=TTS._textPrep.splitSentences(clean,null,true),sp=deriveSpeakerMapFromTags(raw,clean),dialogue=0,mapped=0,i;
  for(i=0;i<units.length;i++){
    if(!units[i]||units[i].spk===null||units[i].spk===undefined)continue;
    /* P4a: a SHORT fully-enclosed quote carrying no punctuation at all ("the Whisper Gate", a song
       title, a nickname) is a scare/name quote, not speech — real dialogue fragments carry their
       comma or terminal mark inside the quotes. Exempt from COVERAGE only; playback already reads
       unmapped units in the narrator's voice, so there is nothing to mis-voice. */
    var _ut=String(units[i].text||"");
    if(/^["“][^"“”]{1,40}["”]$/.test(_ut)&&!/[.,!?;:…]/.test(_ut))continue;
    dialogue++;if(sp&&sp.s&&Object.prototype.hasOwnProperty.call(sp.s,i))mapped++;
  }
  var missing=Math.max(0,dialogue-mapped),paragraphGaps=0,paras=raw.replace(/\r\n/g,"\n").split(/\n\s*\n/);
  for(i=0;i<paras.length;i++){
    var p=paras[i],qm=p.search(/["“]/),plain=p.replace(/^\s*(?:\[[A-Z][A-Z_]{1,}(?::[^\]]*)?\]\s*)*/,"");
    if(qm<0||!(p.slice(qm+1).match(/["”]/)))continue;
    /* A paragraph-initial quote is a deterministic new spoken line. Attribution syntax is the
       second deterministic shape. Interior scare quotes in narration are not a speaker boundary. */
    var spoken=/^["“]/.test(plain)||/["”]\s*,?\s*(?:(?:[A-Z][A-Za-z'’-]*|he|she|they)\s+){0,4}(?:says?|said|asks?|asked|answers?|answered|whispers?|whispered|murmurs?|murmured)\b/.test(p);/* P4a: no /i — lowercase words matched the name slot and scare-quoted nouns in narration read as speech */
    if(spoken&&!/\[SAY:[^\]]+\]/.test(p))paragraphGaps++;/* P4a: a tag ANYWHERE in the paragraph is compliance — the old before-the-quote anchor nagged tag-inside-quote and tripped on quotes inside stripped payloads */
  }
  if(paragraphGaps>missing)missing=paragraphGaps;
  return {dialogue:dialogue,mapped:mapped,missing:missing,paragraphGaps:paragraphGaps};
}

// Stored NAMES -> live voice ids. Deliberately resolved at speak time, not at write time, so
// rebinding a character's voice retroactively re-voices every past turn they speak in.
// The `n` check is the splitter fuse — see the test for why it exists.
function speakerVoiceMap(sp,text){
  if(!sp||!sp.s||typeof TTS==="undefined"||!TTS._textPrep)return null;
  var units=TTS._textPrep.splitSentences(text,null,true);
  if(units.length!==sp.n){
    console.warn("[speakers] unit count moved ("+sp.n+" stored, "+units.length+" now) — dropping the speaker map for this passage; it will narrate in one voice");
    return null;
  }
  var out=null;
  Object.keys(sp.s).forEach(function(k){
    var ch=_speakerChar(sp.s[k]);
    if(!ch)return;
    var vid=TTS.characterVoiceId(ch);
    if(!vid)return;
    if(!out)out={};
    out[parseInt(k,10)]=vid;
  });
  return out;
}
// Alias-tolerant lookup: the model may write "Belor" for the sheet filed as "Sheriff Belor Hemlock".
function _speakerVoiceSubject(name){
  var nm=(typeof resolveNpcName==="function")?resolveNpcName(name):name;
  if(!worldState)return null;
  var c=worldState.character;
  if(c&&c.name===nm)return {char:c,owner:c};
  var ns=worldState.npcs||[],i,p,g,owner;
  for(i=0;i<ns.length;i++)if(ns[i]&&ns[i].name===nm){
    owner=ns[i].charSheet||ns[i];
    p=String(owner.pronouns||ns[i].pronouns||((typeof memory!=="undefined"&&memory&&memory.npcs&&memory.npcs[nm])?memory.npcs[nm].pronouns:"")||"").toLowerCase().replace(/\s+/g,"");
    g=owner.gender;
    if(g!=="M"&&g!=="F"&&g!=="NB")g=/^she\//.test(p)?"F":(/^he\//.test(p)?"M":(/^they\//.test(p)?"NB":"ANY"));
    return {char:{name:owner.name||nm,gender:g,pronouns:p,voiceId:owner.voiceId||""},owner:owner};
  }
  return null;
}
function _speakerChar(name){var s=_speakerVoiceSubject(name);return s?s.char:null;}

// #96b/#174: PIN the auto-cast pick on first speech. The name-hash is stable turn to turn, but a
// bench edit re-deals every unpinned character. Sheetless roster NPCs keep the pin on their world
// record; a generated sheet inherits it. Assigned voices remain untouched and user-recastable.
function pinAutoCastVoices(sp){
  if(!sp||!sp.s||typeof TTS==="undefined"||!TTS.autoCastVoiceId)return false;
  var seen={},pinned=false,k,nm,sub,ch,v;
  for(k in sp.s){
    nm=sp.s[k];
    if(seen[nm])continue;
    seen[nm]=1;
    sub=_speakerVoiceSubject(nm);
    ch=sub&&sub.char;
    if(!sub||!ch||sub.owner.voiceId)continue;
    v=TTS.autoCastVoiceId(ch);
    if(!v)continue;
    sub.owner.voiceId=v;
    pinned=true;
    console.info("[speakers] pinned voice "+v+" to "+nm+" (auto-cast, now permanent — change it on their NPC card)");
  }
  return pinned;
}
// Attribution derives SYNCHRONOUSLY from the response's own [SAY:] tags (#96) — nothing waits on
// a network call, and derivation is free, so the map is stamped even while MUTED (the old
// post-pass skipped muted turns to save a model call, which left their replays voiceless
// forever). Every failure path is "narrate flat": a throw here must never cost the read itself.
// #272 D1 split the old narrateWithSpeakers in two: the SYNC half below does derivation + every
// worldState write (the .sp stamp, auto-cast voice pinning) with NO save and NO audio, so
// commitGmTurn can run it BEFORE its single commit save — the old post-save stamp invalidated
// the compression memo and forced a second full-transcript LZ pass on 88-95% of live turns (f70).
function deriveAndStampSpeakers(clean,raw,entry,trOwn){
  if(typeof TTS==="undefined")return null;
  var sp=null;
  try{sp=deriveSpeakerMapFromTags(raw,clean);}catch(e){console.warn("[speakers] tag derivation failed — narrating in one voice:",e&&e.message);}
  if(!sp)return null;
  stampTranscriptSpeakers(entry,sp,trOwn);/* #177: the OWNING array rides with the entry */
  try{pinAutoCastVoices(sp);}catch(e2){console.warn("[speakers] voice pinning failed (read unaffected):",e2&&e2.message);}
  return sp;
}
// #272 D1: the AUDIO half — zero state writes.
function speakNarration(clean,sp){
  if(typeof TTS==="undefined")return;
  if(!TTS.isOn()&&!(typeof carMode!=="undefined"&&carMode))return;   // muted: map kept, no read
  TTS.speakResponse(clean,sp?speakerVoiceMap(sp,clean):null);
}
// Narration entry point for a NON-commit caller (rerollLast) — derive+stamp, persist, speak.
// commitGmTurn no longer routes through here: it calls the halves itself around its single save.
function narrateWithSpeakers(clean,raw,narEl,entry,trOwn){
  var sp=deriveAndStampSpeakers(clean,raw,entry,trOwn);
  if(sp){
    if(narEl)narEl._sp=sp;   // the per-message replay button reads this at click time
    saveAll();
  }
  speakNarration(clean,sp);
}
function buildActionButtons(acts){
  if(!acts||!acts.length)return"";
  var h='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">',i;
  for(i=0;i<acts.length;i++){var _ea=escHtml(punctuateAction(acts[i]));h+='<button class="qa" title="Tap to edit · hold or Ctrl-click to send" onclick="sendSuggestedAction(this,event)" data-action="'+_ea+'">'+_ea+'</button>';}/* escape model-authored action text (audit E81); #88: punctuate here too, so reload/campLoad also covers pre-#88 stored worldState.lastActions */
  return h+"</div>";
}
// Fetch the Character Library once and cache it; legacy candidates are drawn from this (server-side)
// pool rather than from other campaigns. Async, so checkLegacyCharacter rolls against the cache.
function loadLegacyLibrary(){
  if(!legacyCharsOn||legacyLibLoading)return;
  if(typeof storageAdapter==="undefined"||!storageAdapter.listCharacterLibrary)return;
  legacyLibLoading=true;
  storageAdapter.listCharacterLibrary(function(err,list){
    legacyLibLoading=false;
    if(!err&&list&&typeof list.length==="number")legacyLibCache=list;
  });
}
function checkLegacyCharacter(){
  if(!legacyCharsOn||!worldState)return;
  if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];
  if(worldState.pendingLegacy)return;
  if(Math.random()*100>=legacyChancePct)return;
  // Draw from the Character Library (server-side). If not cached yet, kick off the fetch and skip this
  // roll — the next new-NPC roll will have data. Requires a server connection.
  if(!legacyLibCache){loadLegacyLibrary();return;}
  var lib=legacyLibCache,candidates=[],i;
  for(i=0;i<lib.length;i++){
    var ch=lib[i]&&lib[i].character?lib[i].character:lib[i];
    if(!ch||!ch.name)continue;
    if(worldState.legacyCharsUsed.indexOf(ch.name)>=0)continue;
    if(worldState.character&&ch.name===worldState.character.name)continue;
    if(wsNpcByName(ch.name))continue;/* already an NPC in this campaign (#7: shared lookup) */
    candidates.push(ch);
  }
  if(!candidates.length){if(legacyChancePct>=100&&typeof console!=="undefined")console.warn("[legacy] enabled and rolled, but no eligible character in the Character Library (need a saved library character that isn't the current PC or already met; requires server connection).");return;}
  var pick=candidates[Math.floor(Math.random()*candidates.length)];
  migrateCharClassNames(pick);/* #100: server-library entries may predate the Berserker→Primal rename — heal before the cls string reaches the GM prompt */
  if(typeof migrateCapabilityRenames==="function")migrateCapabilityRenames(pick);/* #221 */
  relationshipMigrateSheet(pick,"@legacy:"+pick.name,{portable:true});
  // Capture the FULL identity so the legacy NPC is portrayed consistently — same person, gender,
  // relationships and gear as in their own tale (fixes #18: Ammut forgot his wives + got mis-gendered).
  worldState.pendingLegacy={
    name:pick.name,gender:pick.gender||"",cls:pick.cls||"",ancestry:pick.subraceNm||pick.ancestry||"",
    level:pick.level||1,age:pick.age||"",appear:pick.appear||"",mark:pick.mark||"",
    backstory:pick.backstory||"",trait:pick.trait||"",flaw:pick.flaw||"",motivation:pick.motivation||"",
    alignment:pick.actualAlignment||pick.statedAlignment||"",deity:pick.deity||"",
    relationships:(pick.relationships||[]).slice(0,8),relationshipAxisProposals:(pick.relationshipAxisProposals||[]).slice(0,8),inventory:(pick.inventory||[]).slice(0,12),
    queuedAt:worldState.turn};
  saveCore();
  if(typeof showToast==="function")showToast("☠ A familiar face approaches...");
}
// audit E1: a single big [XP:] can cross several levels at once (an act reward, or a
// low-level char handed a large award). The old one-shot form granted HP once, only the
// TOP level's feature, and fired at most one modal — so a 1→10 jump skipped Lv2-9 features,
// most HP, and the archetype. Loop per level like checkCompanionLevelUp already does, then
// queue the modals owed across the whole span (archetype first, then each stat bump).
// #284 (Sol brief 36): owed level-up choices are SAVE STATE — worldState.levelUpOwed, keyed by the
// character they belong to: {"<name>":{bumps:N,spells:[{tier,count,pool,source}]}}. The old
// module-variable queues were page-lifetime: checkLevelUp committed the LEVEL durably, then a
// reload (or device handoff) before the forced modals completed cleared the queues, and the same
// XP could never rebuild them (newLvl <= c.level returns immediately) — earned archetype/stat/
// spell picks stranded forever. Keying by character also closes two latent leaks the module vars
// carried: a campaign switch and a mid-owe PC swap both offered one character's picks to another.
// Absent = nothing owed. HONEST LIMIT: pre-#284 stranded bumps/picks are NOT reconstructed — the
// schema has no creation-stat baseline and pre-C2 saves never got picks at all, so inventing owed
// records could double-grant; the archetype, which IS deterministic, self-heals via
// levelUpArchetypeDue. Drained by sbConfirm/spuConfirm in the creation-flow order
// (archetype modal → stat bumps → spell picks); re-surfaced by resurfaceLevelUpOwed at boot and
// by the sendAction guard before the next turn.
function _luOwed(){
  if(!worldState.levelUpOwed)worldState.levelUpOwed={};
  var nm=(worldState.character&&worldState.character.name)||"?";
  if(!worldState.levelUpOwed[nm])worldState.levelUpOwed[nm]={bumps:0,spells:[]};
  return worldState.levelUpOwed[nm];
}
// #284: deterministic archetype reconstruction — a level-3+ player character with no committed
// archetype (and a class that HAS archetypes) is owed the milestone, whatever stranded it: the
// wizard forces the pick at creation for L3+ starts and checkLevelUp forces it at the 3-crossing,
// so a null archetype at L3+ is always a defect state. pickArchetype's catch-up grant (rows
// 3..current, deduped, + the archetype tier schedule) makes the late ask COMPLETE. #192
// archetype-less custom classes stay exempt (an empty wireClose:false modal would soft-lock).
function levelUpArchetypeDue(){
  var c=worldState&&worldState.character;
  return !!(c&&c.level>=3&&!c.archetype&&((classDef(c.cls)||{}).archetypes||[]).length);
}
// #284: the one re-surface seam — boot (ui-boot init, the #81 pendingItemDefs precedent) and the
// sendAction guard both call this. Creation-flow order; returns whether a milestone was opened.
// #302 (owner ruling 2026-09-03): NO XP migration. When the curve changes, a character whose
// banked XP now clears a higher gate simply levels on load — player through checkLevelUp (owed
// archetype/bump/spell picks queue exactly as in play and resurface right after), companions
// through their silent auto-level. Idempotent: a second call with no new XP changes nothing.
function relevelOnLoad(){
  if(!worldState||!worldState.character)return;
  var c=worldState.character;
  if(typeof c.xp==="number"&&typeof getLvl==="function"&&getLvl(c.xp)>(c.level||1))checkLevelUp();
  var i,ns=worldState.npcs||[];
  for(i=0;i<ns.length;i++){var n=ns[i];if(!n||!n.partyMember||!n.charSheet)continue;if(typeof npcIsDead==="function"&&npcIsDead(n))continue;checkCompanionLevelUp(n.charSheet);}
}
function resurfaceLevelUpOwed(){
  if(typeof relevelOnLoad==="function")relevelOnLoad();/* #302: the curve applies before any owed pick is surfaced */
  if(typeof document==="undefined"||!worldState||!worldState.character)return false;
  if(levelUpArchetypeDue()){if(!document.getElementById("arch-modal"))showArchetypeModal();return true;}
  var lo=_luOwed();
  if(lo.bumps>0){if(!document.getElementById("sb-modal"))showStatBumpModal();return true;}
  if(lo.spells.length){maybeShowSpellUnlock();return true;}
  return false;
}
function checkLevelUp(){
  if(!worldState)return;var c=worldState.character,newLvl=getLvl(c.xp);if(newLvl<=c.level)return;
  var oldLvl=c.level,i,cls=classDef(c.cls);/* #72 C6 ①: THE class lookup */
  if(!c.abilities)c.abilities=[];
  var totalHp=0,bumpsOwed=0,newFeatures=[],newFeatNames=[];/* owner 2026-08-24: names feed the gain toasts */
  while(c.level<newLvl){
    c.level++;
    var conMod=c.stats&&typeof c.stats.CON==="number"?Math.floor((c.stats.CON-10)/2):0;
    var hpGain=cls?hpGainPerLevel(cls.hd,conMod):3;/* #11②: shared formula (unknown-class fallback 3 unchanged) */
    c.maxHp+=hpGain;c.hp+=hpGain;totalHp+=hpGain;
    // C6 ②: level rows come from the class bible — class rows (2/5/7/9/11/13/15/17) plus, once
    // an archetype is committed, its rows (6/10/14/18 + capstone 20). Features are NAMED
    // ({nm,ds}), not the legacy "Lv5" string blobs. No retroactive grants: only the level being
    // crossed RIGHT NOW is read (the C6 invariant — Ammut sees the new world at his next level).
    var _lvFeats=classFeaturesAt(c.cls,c.level).concat(archFeaturesAt(c.cls,c.archetype,c.level)),_lf;
    for(_lf=0;_lf<_lvFeats.length;_lf++){c.abilities.push({nm:_lvFeats[_lf].nm,ds:_lvFeats[_lf].ds,gained:worldState.turn});newFeatures.push(_lvFeats[_lf].nm+" — "+_lvFeats[_lf].ds);newFeatNames.push(_lvFeats[_lf].nm);}
    if(STAT_BUMP_LEVELS.indexOf(c.level)>=0)bumpsOwed++;
  }
  // #72 C2: queue the picks for every tier unlocked by this level change. A fill-phase blank
  // bench is skipped LOUDLY, never queued — an empty picker would be a dead modal.
  var _unl=spellUnlocksCrossed(c.cls,c.archetype,oldLvl,newLvl),_ui2;
  for(_ui2=0;_ui2<_unl.length;_ui2++){
    if(!_unl[_ui2].pool.length){console.info("[levelup] spell tier "+_unl[_ui2].tier+" unlocked at L"+_unl[_ui2].level+" but its bench is a fill-phase blank — no picks to offer (see class_bible)");continue;}
    _luOwed().spells.push({tier:_unl[_ui2].tier,count:SPELL_UNLOCK_PICKS[String(_unl[_ui2].tier)]||1,pool:_unl[_ui2].pool.slice(),source:_unl[_ui2].source});/* #284: durable */
    addMsg("system","✨ Spell tier "+_unl[_ui2].tier+" unlocked — choose "+(SPELL_UNLOCK_PICKS[String(_unl[_ui2].tier)]||1)+" new spell"+((SPELL_UNLOCK_PICKS[String(_unl[_ui2].tier)]||1)>1?"s":"")+".");
  }
  if(typeof Sound!=="undefined")Sound.play("click_glass");/* #7: the attention sound fires BEFORE the message so it claims the playIfQuiet window (the toast-level poke must not double up) */
  addMsg("system","Level up! "+oldLvl+" -> "+newLvl+" | HP +"+totalHp+" (now "+c.maxHp+")");
  for(i=0;i<newFeatures.length;i++)addMsg("narrator","<p><em>"+newFeatures[i]+"</em></p>");
  // Owner request 2026-08-24 ("I had to go into his sheet to see what changed"): the feed lines
  // above land BEFORE the GM's prose renders and scroll straight out of view — the toast is the
  // attention channel. Name the character and every gained ability; the feed keeps the full desc.
  showToast("⬆ "+c.name+" reached level "+newLvl+"!");
  if(newFeatNames.length)showToast("★ "+c.name+" gained "+(newFeatNames.length>1?"new abilities: ":"a new ability: ")+newFeatNames.join(", "));
  if(newFeatures.length)updateAbPanel(true);
  _luOwed().bumps+=bumpsOwed;/* #284: durable */
  if(oldLvl<3&&newLvl>=3&&!c.archetype&&((classDef(c.cls)||{}).archetypes||[]).length)showArchetypeModal(); // archetype first; pickArchetype then drains the bump queue. #192: an archetype-less custom class skips the milestone — an empty wireClose:false modal would soft-lock the game
  else maybeShowLevelBump();
}
// Show the next owed stat-bump modal, if any. Called after the archetype pick and after each
// bump confirm so a jump that crosses both level 4 and 8 presents both, one at a time.
function maybeShowLevelBump(){if(_luOwed().bumps>0){showStatBumpModal();return;}maybeShowSpellUnlock();/* #72 C2: spell picks after the bump queue drains */}
function maybeShowSpellUnlock(){
  var _lo=_luOwed();
  if(!_lo.spells.length)return;
  if(typeof document==="undefined")return;/* headless: the queue survives (in the SAVE, #284); the picker is a DOM surface */
  if(document.getElementById("spu-modal"))return;
  showSpellUnlockModal(_lo.spells[0]);
}
// #72 C2: the tier-unlock picker — the creation picker's rhythm (bench list + bible one-liners,
// pick exactly N) as a milestone modal in the stat-bump house style. Forced choice: no ×, no
// outside-close (same as the archetype/bump milestones); already-known spells are filtered by
// base name so a re-shown modal can never offer a duplicate.
function showSpellUnlockModal(unl){
  var c=worldState.character,have={},i;
  for(i=0;i<(c.spells||[]).length;i++)have[capBaseName(c.spells[i].nm)]=1;
  var pool=[];for(i=0;i<unl.pool.length;i++){if(!have[capBaseName(unl.pool[i])])pool.push(unl.pool[i]);}
  if(!pool.length){/* everything on the bench already known (GM grants, prior picks) — nothing to offer */
    console.info("[levelup] tier "+unl.tier+" unlock: the whole bench is already known — pick skipped");
    _luOwed().spells.shift();saveAll();maybeShowSpellUnlock();return;
  }
  var need=Math.min(unl.count,pool.length);
  window._spuPicks=[];window._spuNeed=need;window._spuTier=unl.tier;
  var ch="";
  for(i=0;i<pool.length;i++){
    var ds=(typeof spellPickDesc==="function")?spellPickDesc(pool[i]):"";
    ch+="<div class='sc' id='spu-opt-"+i+"' onclick='spuToggle("+i+")' data-nm=\""+pool[i].replace(/"/g,"&quot;")+"\" style='text-align:left;padding:12px 14px;margin-bottom:8px;'><div class='nm' style='font-size:14px;'>"+pool[i]+"</div>"+(ds?"<div class='sb' style='font-size:11px;color:var(--t2);margin-top:3px;'>"+ds+"</div>":"")+"</div>";
  }
  modalShell("spu-modal","<div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Tier "+unl.tier+" Spells Unlocked</div><div style='font-size:13px;color:var(--t1);margin-bottom:12px;'>Choose "+need+" — <span id='spu-count'>0</span>/"+need+" selected.</div><div id='spu-list' style='max-height:min(672px,60vh);overflow-y:auto;padding-right:4px;'>"+ch+"</div><div id='spu-warn' style='color:var(--red);font-size:12px;margin:6px 0;'></div><button id='spu-confirm' onclick='spuConfirm()' style='width:100%;padding:12px;margin-top:6px;'>Confirm</button>",
    {overlayExtra:"overflow-y:auto;",boxBg:"#181818",maxWidth:480,wireClose:false});
}
function spuToggle(i){
  var el=document.getElementById("spu-opt-"+i);if(!el)return;
  var nm=el.getAttribute("data-nm"),at=window._spuPicks.indexOf(nm);
  if(at>=0){window._spuPicks.splice(at,1);el.style.borderColor="var(--brd)";el.style.background="";}
  else{
    if(window._spuPicks.length>=window._spuNeed)return;/* full — deselect something first */
    window._spuPicks.push(nm);el.style.borderColor="var(--acc)";el.style.background="var(--bg2)";
  }
  var ce=document.getElementById("spu-count");if(ce)ce.textContent=String(window._spuPicks.length);
}
function spuConfirm(){
  var picks=window._spuPicks||[];
  if(picks.length!==window._spuNeed){var w=document.getElementById("spu-warn");if(w)w.textContent="Choose exactly "+window._spuNeed+".";return;}
  var c=worldState.character,i;
  if(!c.spells)c.spells=[];
  for(i=0;i<picks.length;i++)c.spells.push({nm:picks[i],lvl:window._spuTier,used:false});
  var m=document.getElementById("spu-modal");if(m)m.remove();
  addMsg("system","Learned: "+picks.join(", ")+" (tier "+window._spuTier+")");
  if(typeof Sound!=="undefined")Sound.play("chime");
  _luOwed().spells.shift();/* #284: the drain persists via the saveAll below */
  initSpells();syncUI();saveAll();
  maybeShowSpellUnlock();/* drain the next queued unlock (a multi-level jump can owe several) */
}
function checkCompanionLevelUp(cs){
  // Companion auto-level: HP + class features only. No archetype/stat-bump modals —
  // companions level silently; the GM narrates growth if it matters.
  if(!cs||typeof cs.xp!=="number")return;
  if(typeof cs.level!=="number"||cs.level<1)cs.level=1;
  var newLvl=getLvl(cs.xp);if(newLvl<=cs.level)return;
  var oldLvl=cs.level,cls=classDef(cs.cls),_cFeatNames=[];/* owner 2026-08-24: names feed the gain toast, companion twin of checkLevelUp's */
  while(cs.level<newLvl){
    cs.level++;
    var conMod=cs.stats&&typeof cs.stats.CON==="number"?Math.floor((cs.stats.CON-10)/2):0;
    var hpGain=cls?hpGainPerLevel(cls.hd,conMod):3;/* #11②: shared formula (unknown-class fallback 3 unchanged) */
    cs.maxHp=(cs.maxHp||0)+hpGain;cs.hp=(cs.hp||0)+hpGain;
    var _cFeats=classFeaturesAt(cs.cls,cs.level).concat(archFeaturesAt(cs.cls,cs.archetype,cs.level)),_cf;/* C6 ②: bible rows, companion twin of checkLevelUp */
    for(_cf=0;_cf<_cFeats.length;_cf++){if(!cs.abilities)cs.abilities=[];cs.abilities.push({nm:_cFeats[_cf].nm,ds:_cFeats[_cf].ds,gained:worldState?worldState.turn:0});_cFeatNames.push(_cFeats[_cf].nm);}
  }
  // #72 C2 companion twin: silent AUTO-PICK — companions level without modals, so each crossed
  // unlock takes the first N bench spells not already known (base-name dedupe). The bench is
  // canon (bible-authored), so an auto-pick can never introduce off-canon content; the mana
  // pool grows with the picks automatically (#110 derives it from the known bench).
  var _cUnl=spellUnlocksCrossed(cs.cls,cs.archetype,oldLvl,newLvl),_cu,_cp,_learned=[];
  for(_cu=0;_cu<_cUnl.length;_cu++){
    if(!_cUnl[_cu].pool.length)continue;
    var _cHave={},_ch;if(!cs.spells)cs.spells=[];
    for(_ch=0;_ch<cs.spells.length;_ch++)_cHave[capBaseName(cs.spells[_ch].nm)]=1;
    var _cNeed=SPELL_UNLOCK_PICKS[String(_cUnl[_cu].tier)]||1;
    for(_cp=0;_cp<_cUnl[_cu].pool.length&&_cNeed>0;_cp++){
      var _cNm=_cUnl[_cu].pool[_cp];
      if(_cHave[capBaseName(_cNm)])continue;
      cs.spells.push({nm:_cNm,lvl:_cUnl[_cu].tier,used:false});_cHave[capBaseName(_cNm)]=1;_learned.push(_cNm);_cNeed--;
    }
  }
  if(_learned.length)addMsg("system",(cs.name||"Companion")+" learns: "+_learned.join(", "));
  if(_cFeatNames.length)addMsg("system",(cs.name||"Companion")+" gains: "+_cFeatNames.join(", "));/* owner 2026-08-24: gained features had NO visible line at all */
  addMsg("system",(cs.name||"Companion")+" levels up! "+oldLvl+" -> "+newLvl);
  showToast((cs.name||"Companion")+" reached level "+newLvl+"!");
  if(_cFeatNames.length)showToast("★ "+(cs.name||"Companion")+" gained "+(_cFeatNames.length>1?"new abilities: ":"a new ability: ")+_cFeatNames.join(", "));
}
// ── Companion sheet generation (audit P2) ─────────────────────────────────────
// A narrative-path recruit ([PARTY_MEMBER:name|true] on a GM-invented NPC) used to join with NO
// charSheet: the PARTY MEMBER SHEETS block never rendered them, every COMPANION_* tag no-oped
// through findCompanionChar, and the [XP:] mirror skipped them. applyMuts flags such joins
// (npc.sheetPending); processPendingCompanionSheets — fired after the turn settles, same
// fire-after-render pattern as generateActions — asks the model for a sheet. The prompt build and
// the parse/attach are pure functions so the engine tests exercise them without network, and a
// deterministic stub guarantees a party member is NEVER left sheet-less (no-silent-failures).
function buildCompanionSheetPrompt(npcName){
  var npc=wsNpcByName(npcName)||{};/* #7: _compNpcByName retired — wsNpcByName (helpers.js) is the one exact-name lookup */
  var mem=(memory&&memory.npcs&&memory.npcs[npcName])||{};
  var c=worldState.character;
  var known="Status: "+(npc.status||mem.attitude||"unknown")+" | Relation to the player: "+(npc.rel||"unknown")+(npc.pronouns?" | Pronouns: "+npc.pronouns:"")+"\n";
  if(mem.firstEncounter)known+="First met: "+mem.firstEncounter+"\n";
  var kn=npcKnowledgeContext(mem);if(kn.length>3000)kn=kn.slice(0,3000)+"…";
  if(kn)known+="Known facts: "+kn+"\n";
  var ev=(mem.events||[]).slice(-8).join("; ");if(ev.length>1500)ev=ev.slice(0,1500)+"…";
  if(ev)known+="Recent events: "+ev+"\n";
  var clsIds=classDefs().map(function(cd){return cd.id;});/* #72 C6 ① */
  var msg="Create a character sheet for "+npcName+", an NPC who has just joined the party as a companion.\n\n"
    +"WHAT IS KNOWN ABOUT "+npcName+":\n"+known+"\n"
    +"The player character is "+c.name+", a level "+c.level+" "+c.cls+". "+npcName+"'s level MUST be exactly "+c.level+".\n"
    +"Pick cls from exactly this list: "+clsIds.join(", ")+" — whichever best fits who "+npcName+" is.\n\n"
    +"Output ONLY a JSON object with exactly these fields (no extra fields, no prose, no markdown):\n"
    +'{"name":'+JSON.stringify(npcName)+',"gender":"M or F or NB","age":"apparent age","appear":"one-line physical description","cls":"one class from the list","level":'+c.level+',"stats":{"STR":12,"DEX":12,"CON":12,"INT":12,"WIS":12,"CHA":12},"maxHp":12,"gold":10,"inventory":["3-6 items fitting the class"],"abilities":[{"nm":"ability name","ds":"one-line description"}],"spells":[{"nm":"spell name","lvl":1,"def":{"tier":1,"cost":"1 slot or at-will","range":"60ft","targets":"1 creature","duration":"instant","save":"WIS negates or N/A","dice":"3d6 or N/A","effect":"one concise line"}}],"trait":"one line","flaw":"one line","motivation":"one line"}\n'
    +"Stats: 8-16, weighted toward the class's prime stat. maxHp: appropriate for the class hit die and level. spells: [] unless the class is a caster (Sorcerer, Cleric, Druid, Necromancer, Ranger, Paladin — cantrips are lvl 0). abilities: 1-3 signature class abilities. def is REQUIRED on every spell — it becomes the table's binding canon for that spell (fixed numbers, no vague wording).";
  return {msg:msg,sys:"You generate companion character sheets for a sword & sorcery RPG. Output ONLY one valid JSON object. No prose, no markdown, no backticks."};
}
// Deterministic class guess from what the story already established about the NPC (rel/status/knowledge).
function guessCompanionClass(text){
  var t=(text||"").toLowerCase();
  var map=[[/necromancer|death.?mage/,"Necromancer"],[/sorcer|wizard|mage|arcanist|witch|warlock/,"Sorcerer"],[/cleric|priest|healer|acolyte|chaplain/,"Cleric"],[/druid|shaman/,"Druid"],[/paladin|knight|templar/,"Paladin"],[/berserk|barbarian|primal/,"Primal"],[/ranger|hunter|tracker|scout|archer/,"Ranger"],[/rogue|thief|assassin|smuggler|spy|burglar|cutpurse/,"Rogue"]],i;
  for(i=0;i<map.length;i++){if(map[i][0].test(t))return map[i][1];}
  return "Warrior";
}
// Class-baseline HP: level 1 = hit die + CON mod, then the same per-level gain the level-up
// systems use (ceil(hd/2)+1+CON mod, min 1) — keeps generated companions on the engine's curve.
function companionBaselineHp(clsId,level,conMod){
  var cls=classDef(clsId);/* #72 C6 ①: THE class lookup */
  var hd=cls?cls.hd:10,hp=Math.max(1,hd+conMod),l;
  for(l=2;l<=level;l++)hp+=hpGainPerLevel(hd,conMod);/* #11②: shared formula */
  return hp;
}
// Minimal but fully valid v10 companion sheet — the fallback when generation fails, and the
// guaranteed-shape base that normalizeCompanionSheet overlays model output onto.
function buildCompanionSheetStub(npcName){
  var npc=wsNpcByName(npcName)||{};
  var mem=(memory&&memory.npcs&&memory.npcs[npcName])||{};
  var lvl=(worldState&&worldState.character&&worldState.character.level)||1;
  var cls=guessCompanionClass((npc.rel||"")+" "+(npc.status||"")+" "+npcKnowledgeContext(mem));
  var gender=npc.pronouns==="she/her"?"F":npc.pronouns==="they/them"?"NB":"M";
  var hp=companionBaselineHp(cls,lvl,0);
  return {name:npcName,gender:gender,age:"adult",appear:"",mark:"",backstory:"",ancestry:"Human",subrace:null,subraceNm:null,heritageVariant:null,
    cls:cls,stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},hp:hp,maxHp:hp,gold:0,inventory:[],level:lvl,xp:classXpLevels()[lvl-1]||0,
    abilities:[],spells:[],archetype:null,archetypeNm:null,statedAlignment:"True Neutral",actualAlignment:"True Neutral",alignLaw:0,alignGood:0,deity:null,
    trait:null,flaw:null,motivation:null,languages:[{name:"Common",broken:false}],skills:initSkills(),conditions:[],relationships:[],saveModifiers:[],
    portrait:null,storyBeats:[],coreMemories:[],partyMember:true};
}
// Overlay validated model fields onto the stub base. Level is engine-owned (always the player's
// current level, XP seeded at the band floor so the shared [XP:] mirror levels the companion in
// step from here). HP is accepted only within [half, double] of the class baseline — outside that
// band the number is confabulated and the baseline wins.
function normalizeCompanionSheet(raw,npcName){
  if(!raw||typeof raw!=="object")return null;
  var s=buildCompanionSheetStub(npcName),i;
  if(raw.gender==="M"||raw.gender==="F"||raw.gender==="NB")s.gender=raw.gender;
  var strF=["age","appear","trait","flaw","motivation"];
  for(i=0;i<strF.length;i++){if(typeof raw[strF[i]]==="string"&&raw[strF[i]])s[strF[i]]=raw[strF[i]];}
  if(typeof raw.cls==="string"){var cd=classDef(raw.cls);if(cd)s.cls=cd.id;}/* #72 C6 ①: classDef's CI+trim fallback = the old loop */
  if(raw.stats&&typeof raw.stats==="object"){var ks=["STR","DEX","CON","INT","WIS","CHA"];for(i=0;i<ks.length;i++){var v=parseInt(raw.stats[ks[i]]);if(!isNaN(v))s.stats[ks[i]]=Math.max(3,Math.min(20,v));}}
  if(typeof raw.gold==="number"&&raw.gold>=0)s.gold=Math.min(10000,Math.floor(raw.gold));
  if(raw.inventory&&raw.inventory.length)s.inventory=sanitizeModelInventory(raw.inventory,12);/* #50d: model arrays arrive verbatim — stack duplicates on arrival, never push raw */
  if(raw.abilities&&raw.abilities.length){s.abilities=[];for(i=0;i<raw.abilities.length&&s.abilities.length<6;i++){var ab=raw.abilities[i];if(ab&&typeof ab.nm==="string")s.abilities.push({nm:ab.nm,ds:typeof ab.ds==="string"?ab.ds:"",gained:worldState?worldState.turn:0});}}
  if(raw.spells&&raw.spells.length){s.spells=[];for(i=0;i<raw.spells.length&&s.spells.length<10;i++){var sp=raw.spells[i];if(sp&&typeof sp.nm==="string")s.spells.push({nm:sp.nm,lvl:parseInt(sp.lvl)||0,used:false});}}
  s.level=(worldState&&worldState.character&&worldState.character.level)||1;
  s.xp=classXpLevels()[s.level-1]||0;
  var conMod=Math.floor((s.stats.CON-10)/2);
  var base=companionBaselineHp(s.cls,s.level,conMod);
  var mhp=parseInt(raw.maxHp);
  s.maxHp=(!isNaN(mhp)&&mhp>=Math.ceil(base/2)&&mhp<=base*2)?mhp:base;
  s.hp=s.maxHp;
  return s;
}
function parseCompanionSheet(resp,npcName){
  try{return normalizeCompanionSheet(JSON.parse(repairModelJson(resp)),npcName);}
  catch(e){console.warn("[companion] sheet JSON unparseable for "+npcName+" — stub fallback will be used:",e.message);return null;}
}
// #48③ (v1.275): sheet generation self-defines its off-catalog picks. The generator must ship a
// `def` with every spell; any pick that doesn't already resolve through capabilityLookup gets its
// def converted to a [SPELL_DEF:] tag and routed through applyMuts — ONE writer (the handler's
// write-once overlay), never a second path into worldState.capabilityBible. Category derives from
// the class deterministically so a rolled enemy caster's tradition menu stays correct.
var COMPANION_CLS_TRADITION={"Cleric":"divine","Paladin":"divine","Druid":"primal","Ranger":"primal","Sorcerer":"arcane","Necromancer":"necromantic"};
function spellDefTag(sp,cls){
  if(!sp||typeof sp.nm!=="string"||!sp.def||typeof sp.def!=="object")return null;
  var d=sp.def,parts=["[SPELL_DEF:"+sp.nm];
  parts.push("tier="+(parseInt(d.tier)||parseInt(sp.lvl)||0));
  if(d.cost)parts.push("cost="+d.cost);
  if(d.range)parts.push("range="+d.range);
  if(d.targets)parts.push("targets="+d.targets);
  if(d.duration)parts.push("duration="+d.duration);
  if(d.save)parts.push("save="+d.save);
  if(d.dice)parts.push("dice="+d.dice);
  if(d.effect)parts.push("effect="+d.effect);
  var trad=COMPANION_CLS_TRADITION[cls];if(trad)parts.push("category="+trad);
  return parts.join("|").replace(/\]/g,"")+"]";/* strip stray ] from model values so the tag can't self-terminate early */
}
function canonizeCompanionSpellDefs(resp,cls,npcName){
  var raw;try{raw=JSON.parse(repairModelJson(resp));}catch(e){return 0;}
  if(!raw||!raw.spells||!raw.spells.length)return 0;
  var tags=[],i;
  for(i=0;i<raw.spells.length;i++){var sp=raw.spells[i];
    if(!sp||typeof sp.nm!=="string")continue;
    if(typeof capabilityLookup==="function"&&capabilityLookup(sp.nm))continue;/* on-catalog or already-overlaid — base canon wins. #253: the SPELL_DEF handler now reaches the SAME verdict itself (capIsBaseCatalog for the static half, its own write-once check for the overlay half), so this filter is a redundant-but-harmless second line: it saves building tags that would only be refused. Keep the two predicates in agreement — this one is deliberately the union, capIsBaseCatalog deliberately the static half. */
    var tg=spellDefTag(sp,cls);if(tg)tags.push(tg);}
  if(tags.length){applyMuts(tags.join(""));console.warn("[companion sheet] "+npcName+": canonized "+tags.length+" off-catalog spell def(s) via SPELL_DEF (#48③)");}
  return tags.length;
}
// Attach a generated/stub sheet to the named party member; makes findCompanionChar resolve them.
function attachCompanionSheet(npcName,sheet){
  var npc=wsNpcByName(npcName);
  if(!npc||npc.charSheet)return null;
  npc.charSheet=sheet;delete npc.sheetPending;
  if(memory&&memory.npcs&&memory.npcs[npcName])memory.npcs[npcName].partyMember=true;
  return npc;
}
var _sheetGenInFlight={};
async function generateCompanionSheet(npcName){
  var npc=wsNpcByName(npcName);
  if(!npc||npc.charSheet||_sheetGenInFlight[npcName])return;
  _sheetGenInFlight[npcName]=1;
  var sheet=null,failReason=null;
  try{
    var p=buildCompanionSheetPrompt(npcName);
    var resp=await callGM(p.msg,p.sys,1000,null,{noHistory:true,kind:"other"});/* 600→1000 (v1.275): per-spell defs (#48③) need the headroom */
    sheet=parseCompanionSheet(resp,npcName);
    if(!sheet)failReason="model returned invalid JSON";
    if(sheet)canonizeCompanionSpellDefs(resp,sheet.cls,npcName);/* #48③: off-catalog picks self-define before first cast */
  }catch(e){failReason=(e&&e.message)||"request failed";}
  delete _sheetGenInFlight[npcName];
  if(!sheet)sheet=buildCompanionSheetStub(npcName);// a party member must NEVER stay sheet-less
  if(!attachCompanionSheet(npcName,sheet))return;// npc vanished or got a sheet meanwhile
  saveAll();
  if(failReason){
    if(typeof console!=="undefined")console.warn("[companion sheet] "+npcName+": generation failed ("+failReason+") — deterministic stub used");
    if(typeof showToast==="function")showToast("⚠ "+npcName+"'s sheet generation failed ("+failReason+") — stub sheet used.",6000);
  }else if(typeof showToast==="function")showToast(npcName+"'s sheet drawn up.");
}
// Post-turn hook (called after the narration renders, like generateActions): kick generation for
// every flagged sheet-less party member. Fire-and-forget; attach + saveAll happen on completion.
function processPendingCompanionSheets(){
  if(!worldState||!worldState.npcs)return;
  var i;for(i=0;i<worldState.npcs.length;i++){
    var n=worldState.npcs[i];
    if(n.partyMember&&n.sheetPending&&!n.charSheet)generateCompanionSheet(n.name);
  }
}
// Lazy migration for existing saves (called from initState/_applyLoadedCampaign): flag any
// sheet-less living party member, then kick generation unless a turn is in flight — the flags
// persist, so the next turn's post-render hook picks them up.
function migratePendingCompanionSheets(){
  if(!worldState||!worldState.npcs)return;
  var found=false,i;
  for(i=0;i<worldState.npcs.length;i++){var n=worldState.npcs[i];
    /* v1.439 (F1): npcIsDead — the raw regex missed "slain"/"deceased"/"perished" AND the B3 dead
       flag, so a slain companion kept getting flagged for a sheet. (The AUDIT_FABLE #6 word-boundary
       fix lives on inside NPC_DEAD_RE — "undead" still reads alive.) */
    if(n.partyMember&&!n.charSheet&&!npcIsDead(n)){n.sheetPending=true;found=true;}}
  if(!found)return;
  if(typeof busy!=="undefined"&&busy)return;
  processPendingCompanionSheets();
}
function showArchetypeModal(){
  var c=worldState.character,archs=(classDef(c.cls)||{}).archetypes||[];/* C6 ② */
  var ch="",i;for(i=0;i<archs.length;i++){ch+="<div class='sc' onclick='pickArchetype("+i+")' style='text-align:left;padding:14px 16px;margin-bottom:10px;'><div class='nm' style='margin-bottom:5px;'>"+archs[i].nm+"</div><div style='font-size:12px;color:var(--t1);line-height:1.5;'>"+archs[i].desc+"</div></div>";}
  /* #14: modalShell (ui-shell.js) — wireClose:false, forced milestone choice (no × / no outside-close) */
  modalShell("arch-modal","<div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Level 3 Milestone</div><div style='font-size:18px;color:var(--t0);margin-bottom:18px;'>Choose Archetype</div>"+ch,
    {overlayExtra:"overflow-y:auto;",boxBg:"#181818",maxWidth:480,wireClose:false});
}
// #320 (owner report 2026-09-03, the Iron Meridian Gazz): the archetype pick grants the archetype's OWN
// spell bench — third casters (ARCH_SPELLS: Eldritch Knight, Arcane Trickster) — and NOTHING for a
// class whose spells are chosen at creation and at the tier unlocks. The audit-E21 line read
// SPELLS[c.cls]||ARCH_SPELLS[...] so a Sorcerer at L3 had every class cantrip and L1 spell dumped on
// the sheet with no pick (Prestidigitation, Ray of Frost, Magic Missile, Shield appeared unchosen, and
// the suggestion gate — correctly — treated them as owned). Racial spells never block the grant (E21
// kept). Returns the names added; dedupe by base name via grantSpellsFromList (#101).
function archetypeSpellGrant(c,archId){
  var src=(typeof ARCH_SPELLS!=="undefined")?ARCH_SPELLS[archId]:null;if(!src||!c)return [];
  if(!c.spells)c.spells=[];var before=c.spells.length;
  grantSpellsFromList(c,src.cantrips,0);grantSpellsFromList(c,src[1],1);
  return c.spells.slice(before).map(function(s){return s.nm;});
}
function pickArchetype(idx){
  var c=worldState.character,archs=(classDef(c.cls)||{}).archetypes||[];if(idx>=archs.length)return;var arch=archs[idx];c.archetype=arch.id;c.archetypeNm=arch.nm;
  if(!c.abilities)c.abilities=[];c.abilities.push({nm:arch.nm,ds:arch.desc,gained:worldState.turn});
  // C6 ②: the archetype's level rows up to the CURRENT level land with the commitment — normally
  // just the L3 row, but a jump that crossed 3-6 before the pick catches up here. Dedupe by name
  // so a re-pick path can never double-grant.
  var _apLv,_apF,_apHave={},_api;for(_api=0;_api<c.abilities.length;_api++)_apHave[c.abilities[_api].nm]=1;
  for(_apLv=3;_apLv<=c.level;_apLv++){var _apRows=archFeaturesAt(c.cls,arch.id,_apLv);for(_apF=0;_apF<_apRows.length;_apF++){if(!_apHave[_apRows[_apF].nm]){c.abilities.push({nm:_apRows[_apF].nm,ds:_apRows[_apF].ds,gained:worldState.turn});_apHave[_apRows[_apF].nm]=1;}}}
  // Grant the archetype/class spell list even if the character already owns RACIAL spells (audit E21):
  // the old `!c.spells.length` guard skipped the whole grant for e.g. a Drow Rogue picking Arcane
  // Trickster, leaving them with no AT spells. Append what's missing (dedupe by name).
  var _apAdded=archetypeSpellGrant(c,arch.id);if(_apAdded.length)addMsg("system","Learned: "+_apAdded.join(", ")+" ("+arch.nm+")");/* #320: the archetype's OWN bench only */
  // #72 C2 (C7 third casters): the archetype's own tier schedule catches up at the pick —
  // normally just T1@3, but a jump that crossed 3-10 before the pick owes T2 as well. Queued
  // like any unlock; the maybeShowLevelBump below drains bumps first, then these.
  var _apUnl=spellUnlocksCrossed(c.cls,arch.id,2,c.level),_apu;
  for(_apu=0;_apu<_apUnl.length;_apu++){
    if(_apUnl[_apu].source!=="arch"||!_apUnl[_apu].pool.length)continue;
    _luOwed().spells.push({tier:_apUnl[_apu].tier,count:SPELL_UNLOCK_PICKS[String(_apUnl[_apu].tier)]||1,pool:_apUnl[_apu].pool.slice(),source:"arch"});/* #284: durable */
  }
  var m=document.getElementById("arch-modal");if(m)m.remove();addMsg("system","Archetype: "+arch.nm);updateAbPanel(true);initSpells();syncUI();saveAll();
  maybeShowLevelBump(); // a jump that crossed both 3 and 4/8 owes a stat bump next (E1)
}
function showStatBumpModal(){
  var c=worldState.character;
  var rh="",i;for(i=0;i<STATS.length;i++){var s=STATS[i];rh+="<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'><span style='width:36px;font-weight:bold;color:var(--t1);'>"+s+"</span><span style='width:32px;font-size:16px;font-weight:bold;' id='sb-cur-"+s+"'>"+c.stats[s]+"</span><button onclick=\"sbPick('"+s+"',1,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+1</button><button onclick=\"sbPick('"+s+"',2,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+2</button></div>";}
  /* #14: modalShell (ui-shell.js) — wireClose:false, forced milestone choice (Back/Confirm only) */
  modalShell("sb-modal","<div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Stat Improvement</div><div style='font-size:13px;color:var(--t2);margin-bottom:18px;'>+2 to one or +1 to two. Max 20.</div>"+rh+"<p id='sb-warn' style='font-size:12px;color:#c04040;min-height:16px;'></p><div style='display:flex;gap:10px;'><button onclick='sbBack()' style='padding:10px 18px;font-family:var(--font);border:1px solid var(--brd);border-radius:var(--r);background:var(--bg1);color:var(--t0);cursor:pointer;'>Back</button><button onclick='sbConfirm()' style='flex:1;padding:12px;font-size:14px;font-family:var(--font);background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Confirm</button></div>",
    {boxBg:"#181818",maxWidth:380,wireClose:false});
  _sbPicks=[];
}
function sbPick(s,v,btn){
  var c=worldState.character,picks=_sbPicks||[],pi;
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s&&picks[pi].v===v){picks.splice(pi,1);_sbPicks=picks;btn.style.borderColor="#444";btn.style.color="var(--t0)";document.getElementById("sb-cur-"+s).textContent=c.stats[s];document.getElementById("sb-cur-"+s).style.color="var(--t0)";document.getElementById("sb-warn").textContent="";return;}}
  if(c.stats[s]+v>20){document.getElementById("sb-warn").textContent=s+" at max.";return;}
  var total=0;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total+v>2){document.getElementById("sb-warn").textContent="Max +2.";return;}
  if(v===2&&picks.length>0){document.getElementById("sb-warn").textContent="+2 = one stat only.";return;}
  if(v===1){for(pi=0;pi<picks.length;pi++){if(picks[pi].v===2){document.getElementById("sb-warn").textContent="Can't mix.";return;}}}
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s){document.getElementById("sb-warn").textContent=s+" already picked.";return;}}
  picks.push({s:s,v:v});_sbPicks=picks;document.getElementById("sb-warn").textContent="";btn.style.borderColor="var(--acc)";btn.style.color="var(--acc)";document.getElementById("sb-cur-"+s).textContent=c.stats[s]+v;document.getElementById("sb-cur-"+s).style.color="var(--acc)";
}
function sbBack(){var m=document.getElementById("sb-modal");if(m)m.remove();}
function sbConfirm(){var picks=_sbPicks||[];var total=0,pi;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total!==2){document.getElementById("sb-warn").textContent="Must spend +2.";return;}var c=worldState.character;for(pi=0;pi<picks.length;pi++)c.stats[picks[pi].s]+=picks[pi].v;var m=document.getElementById("sb-modal");if(m)m.remove();addMsg("system","Stats: "+picks.map(function(p){return p.s+"+"+p.v;}).join(", "));var _lo=_luOwed();if(_lo.bumps>0)_lo.bumps--;/* #284: the drain persists via the saveAll */syncUI();saveAll();maybeShowLevelBump();/* drain the multi-level bump queue (E1) */}
// A plain tap POPULATES the input (editable) so the player can tweak/combine before sending.
// Ctrl/Cmd-click (desktop) or a long-press (mobile, handled in wireButtons) EXECUTES immediately.
function sendSuggestedAction(btn,ev){
  var action=btn.getAttribute("data-action");if(!action)return;
  if(Date.now()<_qaSuppressUntil){_qaSuppressUntil=0;return;} // a long-press already executed this; swallow the trailing click
  if(ev&&(ev.ctrlKey||ev.metaKey)){if(!busy)sendAction(toFirstPerson(action));return;}
  var inp=document.getElementById("action-input");if(!inp)return;
  // APPEND to whatever's already typed (#33) — the player may have started a partial thought
  // before tapping a suggestion; replacing would eat it. The × button clears in one tap.
  var fp=toFirstPerson(action),cur=inp.value;
  if(cur&&!/\s$/.test(cur))cur+=" ";
  inp.value=cur+fp;inp.focus();
  try{inp.setSelectionRange(inp.value.length,inp.value.length);}catch(e){}
}
// ── Core Memory (#40): permanent, always-injected defining moments ─────────────────────────
// ENGINE-DETECTED, never GM-judged: a snapshot-diff wrapped around applyMuts at the TURN call
// site (commitGmTurn — the unified sendAction/beginAdventure commit pipeline, audit 07-16 #5).
// Deliberately NOT inside applyMuts or tag_table:
//   • zero parser contact — nothing to implement twice pre-cutover, survives the UA1 cutover
//     unchanged, and invisible to the shadow diff (which clones state at applyMuts ENTRY);
//   • syncCharSheet's audit-prompt applyMuts is naturally excluded (a sheet CORRECTION
//     crossing the HP threshold is bookkeeping, not a story moment);
//   • rerollLast keeps mutations (it never re-runs applyMuts), so a moment filed from the
//     original response remains mechanically true even after the prose is re-rolled — no purge.
// #63 (v1.304, supersedes the party-shared v1): core memories live on the CHARACTER SCHEMA —
// character.coreMemories[]/charSheet.coreMemories[] — filed WITNESSED-BY-ALL (user ruling
// 2026-07-16): every present party member carries the moment on their own sheet, because a
// witnessed moment is part of each witness's history. The v1 worldState list violated PC↔
// companion interchangeability (export Morwen → new campaign → her defining moments stayed
// behind with the quest log); on the schema they ride .char exports, library imports, and
// _switchPlayerCharacter swaps for free — the same portability contract as relationships/
// conditions/storyBeats. Entries carry a camp stamp so an imported character's moments from an
// earlier adventure render attributed to that campaign, not as bogus turn numbers in the new
// one. The DEFINING MOMENTS block (api.js) is now a VIEW assembled from the party's sheets;
// worldState.coreMemories is migrated to sheets and DELETED (single source — the portrait
// lesson: dual-homing is the drift class). Empty sheets render nothing — byte-identical prompt.
function coreMemorySnapshot(){
  if(!worldState||!worldState.character)return null;
  var c=worldState.character,snap={hp:c.hp,maxHp:c.maxHp,align:c.actualAlignment||null,rels:{},party:{}},i;/* #140③: label pre-state for the flip moment */
  var rl=relationshipRows(c,null);for(i=0;i<rl.length;i++){if(rl[i]&&rl[i].entity)snap.rels[rl[i].entity]=rl[i].bond||"";}
  var ns=worldState.npcs||[];for(i=0;i<ns.length;i++){var n=ns[i];
    if(n&&n.partyMember)snap.party[n.name]={dead:npcIsDead(n),hp:n.charSheet?n.charSheet.hp:null,maxHp:n.charSheet?n.charSheet.maxHp:null,align:n.charSheet?(n.charSheet.actualAlignment||null):null};}/* v1.439 (F1): flag+all death words, not just "dead" */
  return snap;
}
function fileCoreMemory(kind,who,text){
  if(!worldState||!worldState.character)return;
  var camp=worldState.campName||"",cap=(typeof CORE_MEMORY_CAP!=="undefined")?CORE_MEMORY_CAP:25,filedAny=false,i;
  function fileTo(owner){
    if(!owner)return;
    if(!owner.coreMemories)owner.coreMemories=[];
    var cm=owner.coreMemories,j;
    for(j=0;j<cm.length;j++){if(cm[j].turn===worldState.turn&&cm[j].kind===kind&&cm[j].who===who)return;}// one moment per event per turn per witness
    cm.push({text:text,turn:worldState.turn,kind:kind,who:who,camp:camp});
    filedAny=true;
    if(cm.length>cap){
      // Evict the oldest near-death first (the repetitive class); preserve it in memory.archive
      // rather than deleting — "never forget" degrades to "cold storage", not to loss.
      var ev=-1;for(j=0;j<cm.length;j++){if(cm[j].kind==="near-death"){ev=j;break;}}
      if(ev<0)ev=0;
      var out=cm.splice(ev,1)[0];
      if(typeof memory!=="undefined"&&memory&&memory.archive){if(!memory.archive.coreMemories)memory.archive.coreMemories=[];memory.archive.coreMemories.push(out);}
      console.warn("[core-memory] "+(owner.name||"?")+" over cap ("+cap+") — evicted to archive: \""+out.text+"\". A chronically full list means the #40 triggers fire too easily.");
    }
  }
  // Witnesses: the player + every living party member with a sheet — plus the SUBJECT's sheet
  // even off-party/dead (a just-departed companion carries their own departure; a fallen one
  // carries their death — that history must travel if they're ever exported or return).
  fileTo(worldState.character);
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(!n||!n.charSheet)continue;
    var isSubject=(n.name===who);
    if(!n.partyMember&&!isSubject)continue;
    if(npcIsDead(n)&&!isSubject)continue;/* v1.439 (F1): a slain witness is as dead as a "dead" one */
    fileTo(n.charSheet);
  }
  if(filedAny&&typeof agendaBirthMaybe==="function")agendaBirthMaybe(kind,who,text);/* #330: a defining moment may birth a companion's new want (1 in 4, one per moment) */
  if(filedAny&&typeof Sound!=="undefined")Sound.play("click_glass");/* #7: before the toast — claims the playIfQuiet window */
  if(filedAny&&typeof showToast==="function")showToast("★ Defining moment: "+text);
  return filedAny;/* #40 GM tag (v1.307): lets the CORE_MEMORY handler report honestly — no muts line for a deduped no-op */
}
function detectCoreMoments(pre){
  if(!pre||!worldState||!worldState.character)return;
  var c=worldState.character,w=worldState.world||{},i;
  var here=w.location?(" at "+(w.sublocation?w.sublocation+", "+w.location:w.location)):"";
  var foe="";/* UA26: foes[] shape — name the engaged foe, else the first tracked one */
  if(worldState.combat&&worldState.combat.foes&&worldState.combat.foes.length)foe=" fighting "+(worldState.combat.engaged||worldState.combat.foes[0].name);
  function cross(preHp,preMax,postHp,postMax,who){
    if(typeof preHp!=="number"||typeof postHp!=="number")return;
    var mx=(typeof postMax==="number"&&postMax>0)?postMax:preMax;
    if(typeof mx!=="number"||mx<=0)return;
    var th=Math.max(1,Math.floor(mx*0.1));// crossing semantics = free hysteresis: hovering low files once
    if(preHp>th&&postHp<=th)fileCoreMemory("near-death",who,who+" was nearly slain"+foe+here+" ("+Math.max(0,postHp)+"/"+mx+" HP).");
  }
  cross(pre.hp,pre.maxHp,c.hp,c.maxHp,c.name);
  /* #140③ (user go 2026-08-07): a LABEL flip is a defining moment — the person they are
     changed on the record. Crossing semantics come free (labels only change at the ±2
     thresholds); axis moves inside a label file nothing. */
  function alignFlip(preAl,postAl,who){
    if(preAl&&postAl&&preAl!==postAl)fileCoreMemory("alignment",who,who+"'s compass turned: "+preAl+" → "+postAl+here+".");
  }
  alignFlip(pre.align,c.actualAlignment,c.name);
  var seen={},ns=worldState.npcs||[];
  for(i=0;i<ns.length;i++){var n=ns[i];if(!n||!n.partyMember)continue;seen[n.name]=1;
    var p=pre.party[n.name];
    if(!p){fileCoreMemory("party",n.name,n.name+" joined the party"+here+".");continue;}
    if(!p.dead&&npcIsDead(n)){fileCoreMemory("death",n.name,n.name+" died"+foe+here+".");continue;}/* v1.439 (F1): "slain" now fires the death moment */
    if(n.charSheet){cross(p.hp,p.maxHp,n.charSheet.hp,n.charSheet.maxHp,n.name);alignFlip(p.align,n.charSheet.actualAlignment,n.name);}
  }
  var preNames=Object.keys(pre.party);
  for(i=0;i<preNames.length;i++){if(!seen[preNames[i]])fileCoreMemory("party",preNames[i],preNames[i]+" parted ways with the party"+here+".");}
  var rl=relationshipRows(c,null);
  for(i=0;i<rl.length;i++){var r=rl[i];
    if(!r||!r.bond||!r.entity)continue;
    if(typeof WEIGHTY_REL_RE!=="undefined"&&WEIGHTY_REL_RE.test(r.bond)&&pre.rels[r.entity]!==r.bond)
      fileCoreMemory("bond",r.entity,"The bond between "+c.name+" and "+r.entity+" became \""+r.bond+"\".");/* #168 W7: only the durable axis can mint a permanent moment; current dynamics are categorically excluded. */
  }
}
// ── Condition turn-stamps (#46, Phase A) ────────────────────────────────────────────────────
// ── #107: report what actually reached the sheet ────────────────────────────────────────────
// FIELD REPORT (2026-07-30): the GM narrated the quartermaster "handing over what's left of the
// blasting supplies, a few coils of rope, nothing fancy" and the player had no way to know
// whether any of it became inventory. Narration and sheet are separate channels — the prose can
// describe an acquisition the tags never made — and until now the sheet changed in silence.
//
// Same snapshot-diff idiom as Core Memory / conditions / relationships below, and for the same
// reason: ZERO parser contact. Deliberately NOT a showToast inside the ITEM_GAINED handler,
// because syncCharSheet applies a batch of ITEM_GAINED tags during its audit and already owns a
// louder per-correction trail (#50a) — a handler toast would double-report there. Wired at the
// TURN call site only, so syncCharSheet is excluded for free (the #40 precedent).
//
// Absence is deliberately meaningful: a narrated pickup with NO toast means the tag never fired.
// That is the signal the player has been missing, so this must never toast speculatively.
function inventorySnapshot(){
  if(!worldState||!worldState.character)return null;
  var m={},inv=worldState.character.inventory||[],i;
  // Skip non-string entries (load-time migration deliberately preserves them, and the other two
  // inventory readers both skip them) — this snapshot runs BEFORE applyMuts, so a throw here
  // would lose the whole turn and make Retry re-throw forever.
  for(i=0;i<inv.length;i++){if(typeof inv[i]!=="string")continue;m[_invNorm(inv[i])]={label:_invBase(inv[i]),n:_invCount(inv[i])};}
  return m;
}
// Diff against a pre-applyMuts snapshot and announce the net gain. Counts are compared per
// normalized key so a stack going 5→7 reports "x2" (what you just got), never "x7" (what you
// now hold) — the delta is the answer to "did that land?". Returns the list for testability;
// null when nothing was gained, so callers can tell "no gains" from "toast suppressed".
var INV_TOAST_MAX=6;
function toastInventoryGains(pre){
  if(!pre)return null;
  var post=inventorySnapshot();if(!post)return null;
  var gained=[],k;
  for(k in post){
    if(!Object.prototype.hasOwnProperty.call(post,k))continue;
    var was=pre[k]?pre[k].n:0,now=post[k].n;
    if(now>was)gained.push(post[k].label+((now-was)>1?" x"+(now-was):""));
  }
  if(!gained.length)return null;
  // A sync-style batch could name dozens; keep the toast readable but never claim it listed all.
  var shown=gained.slice(0,INV_TOAST_MAX).join(", ");
  if(gained.length>INV_TOAST_MAX)shown+=" +"+(gained.length-INV_TOAST_MAX)+" more";
  if(typeof showToast==="function")showToast("🎒 Collected: "+shown);
  return gained;
}

// Same snapshot-diff pattern as Core Memory above, same rationale: zero parser contact (the
// running tag-table soak stays pristine; the stamp moves into the handlers at cutover and this
// post-pass retires). A condition present after applyMuts but not before gets .turn stamped —
// duration updates keep the ORIGINAL stamp (the affliction's onset, not its latest mention).
// syncCharSheet is excluded on purpose: an audit-filed correction has no honest onset turn.
function conditionSnapshot(){
  if(!worldState||!worldState.character)return null;
  function names(list){var m={},i;for(i=0;i<(list||[]).length;i++)m[list[i].name]=1;return m;}
  var snap={player:names(worldState.character.conditions),party:{}},i;
  var _csParty=partyCompanionsWithSheets(true);/* DELIBERATE (user ruling 2026-07-16): read-side snapshot keeps dead companions so DEATH-TURN condition changes still stamp/toast (routing to dead sheets is deliberate — see findCompanionNpc) */
  for(i=0;i<_csParty.length;i++)snap.party[_csParty[i].name]=names(_csParty[i].charSheet.conditions);
  return snap;
}
function stampNewConditions(pre){
  if(!pre||!worldState||!worldState.character)return;
  // Stamps new conditions with their onset turn AND toasts every change in both directions —
  // condition add/removal previously had zero UI feedback (v1.256, from the Daeris audit test:
  // "yay that it's done... no toast"). Toasting HERE instead of inside the tag handlers keeps
  // both parsers untouched (no pre-cutover double-implementation, no shadow-soak noise).
  function names(list){var m={},i;for(i=0;i<(list||[]).length;i++)m[list[i].name]=1;return m;}
  function diff(who,list,had){
    var i,now=names(list);
    for(i=0;i<(list||[]).length;i++){if(!had[list[i].name]){
      if(!list[i].turn)list[i].turn=worldState.turn;
      // v1.257: a strict "N turns/rounds" duration schedules its own audit — the expiry lives ON
      // the condition (derive, don't duplicate: no side schedule to desync; an early removal takes
      // its appointment with it). Free-text durations (hours, "until awakened") don't parse and
      // fall to the 12-turn staleness rule; a misparse costs one early audit, never a mutation.
      if(!list[i].until&&list[i].duration){var _dm=String(list[i].duration).match(/(\d+)\s*(?:turn|round)s?\b/i);if(_dm)list[i].until=worldState.turn+parseInt(_dm[1],10);}
      if(typeof showToast==="function")showToast("⚠ Condition: "+who+" — "+list[i].name+(list[i].duration?" ("+list[i].duration+")":""));
    }}
    var hk=Object.keys(had);
    for(i=0;i<hk.length;i++){if(!now[hk[i]]&&typeof showToast==="function")showToast("✓ Condition lifted: "+who+" — "+hk[i]);}
  }
  diff(worldState.character.name,worldState.character.conditions,pre.player);
  var i,_scParty=partyCompanionsWithSheets(true);/* DELIBERATE (user ruling 2026-07-16): mirrors conditionSnapshot — death-turn stamps/toasts must land */
  for(i=0;i<_scParty.length;i++)diff(_scParty[i].name,_scParty[i].charSheet.conditions,pre.party[_scParty[i].name]||{});
}
// ── Relationship turn-stamps + downgrade/audit triggers (#61) ───────────────────────────────
// Same snapshot-diff post-pass pattern as Core Memory (#40) and condition stamps (#46) above,
// same rationale: ZERO parser contact — tag_table stays the untouched sole parser, and
// syncCharSheet's audit-prompt applyMuts is naturally excluded (a sheet correction has no honest
// onset turn and shouldn't trip the downgrade nudge the player just hand-drove). Three jobs:
//   1. stamp .turn on new/changed relationship entries (player + companions) — feeds the
//      "(since tN)" ages in buildRelationshipAudit; pre-#61 entries stay unstamped ("long-standing");
//   2. detect a WEIGHTY→non-weighty descriptor overwrite and queue it on worldState.relDowngrades
//      for buildRelationshipDowngradeNudge (api.js) — plus a loud toast, per the no-silent-failure
//      policy. An explicit [RELATIONSHIP_REMOVED:] (entity gone entirely) is deliberate, not a
//      downgrade, and is NOT flagged;
//   3. on party composition change (join/leave), set worldState.relAuditDue so the relationship
//      audit fires next turn instead of waiting out the 40-turn window.
function relationshipSnapshot(){
  if(!worldState||!worldState.character)return null;
  function relMap(sheet,who){var m={},rows=relationshipRows(sheet,who),i;for(i=0;i<rows.length;i++){if(rows[i]&&rows[i].entity)m[rows[i].entity]=rows[i].bond||"";}return m;}
  var snap={player:relMap(worldState.character,null),party:{},names:{}},i;
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(n&&n.partyMember){snap.names[n.name]=1;if(n.charSheet)snap.party[n.name]=relMap(n.charSheet,n.name);}}
  return snap;
}
function stampRelationshipChanges(pre){
  if(!pre||!worldState||!worldState.character)return;
  function sweep(who,sheet,had){
    var rows=relationshipRows(sheet,who),i;for(i=0;i<rows.length;i++){var r=rows[i];if(!r||!r.entity)continue;
      var prev=had[r.entity];
      if(prev===undefined){if(r.bond&&!r.bondTurn)r.bondTurn=worldState.turn;continue;}/* new bond */
      if(prev===(r.bond||""))continue;/* unchanged */
      r.bondTurn=worldState.turn;/* changed durable bond starts now */
      var _rk=relationshipEdgeKey(who,r.entity),_rr=worldState.relBondReceipts&&worldState.relBondReceipts[_rk],_explicit=!!(_rr&&_rr.turn===worldState.turn&&_rr.prev===prev&&_rr.next===(r.bond||""));
      /* #167: ANY rewrite of this pair's descriptor RESOLVES its pending downgrade check —
         a weighty restore healed it, a consciously different truth re-stated it; either way
         the persistent nudge stops. Resolve BEFORE the arm below so a fresh weighty→non-weighty
         on the same pair re-arms cleanly. */
      if(worldState.relDowngrades){
        for(var _di=worldState.relDowngrades.length-1;_di>=0;_di--){var _de=worldState.relDowngrades[_di];if(_de.who===who&&_de.entity===r.entity)worldState.relDowngrades.splice(_di,1);}
        if(!worldState.relDowngrades.length)delete worldState.relDowngrades;
      }
      if(!_explicit&&typeof WEIGHTY_REL_RE!=="undefined"&&WEIGHTY_REL_RE.test(prev)&&!WEIGHTY_REL_RE.test(r.bond||"")){
        if(!worldState.relDowngrades)worldState.relDowngrades=[];
        worldState.relDowngrades.push({who:who,entity:r.entity,prev:prev,next:r.bond||"",turn:worldState.turn});
        if(worldState.relDowngrades.length>8)worldState.relDowngrades.shift();/* bounded; oldest drop is also the stalest */
        if(typeof showToast==="function")showToast("⚠ Bond downgraded outside the axis adapter: "+(who||worldState.character.name)+" → "+r.entity+" (\""+prev+"\" → \""+(r.bond||"")+"\") — the GM will be asked to confirm");
      }
    }
  }
  sweep(null,worldState.character,pre.player);
  var i,nowNames={};
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(!n||!n.partyMember)continue;nowNames[n.name]=1;
    if(n.charSheet)sweep(n.name,n.charSheet,pre.party[n.name]||{});}
  var pk=Object.keys(pre.names),joined=false,left=false;
  for(i=0;i<pk.length;i++){if(!nowNames[pk[i]])left=true;}
  var nk=Object.keys(nowNames);
  for(i=0;i<nk.length;i++){if(!pre.names[nk[i]])joined=true;}
  if(joined||left)worldState.relAuditDue=worldState.turn;
}
// ── Ghost-consumable detection (#60) ─────────────────────────────────────────────────────────
// The t582 class: a consumable is narrated as spent (charge thrown, potion drunk) but the GM
// never emits [ITEM_LOST:] — the sheet ghosts the unit forever. Strengthening the stable prompt
// rule is spent (it already names "a charge detonated" and was ignored), and every auto-writer
// design was rejected (#60 row: a second model mutating authoritative inventory is the drift
// surface firing constantly). This is the house pattern instead — the ENGINE detects
// deterministically, the GM DECIDES via an engine note (buildConsumableNudge, api.js), and the
// only write path remains the battle-tested tag through the sole parser.
// Detection: an inventory entry counts as a consumable if its base name matches CONSUMABLE_RE.
// v1.384 (#60b) DELETED the original "or it is a counted stack (' xN', N≥2)" leg. That leg was
// added for the t582 "Blasting charge x4" form, but it never earned its keep: "charge" is in
// CONSUMABLE_RE, so the motivating case was always caught by name alone. What the count leg
// actually did was assert "counted ⇒ consumable", which is false for a party that outfits itself
// — on the t881 corpus 20 of 23 counted stacks were durable gear (Saddles x3, Mountain gloves x3,
// Boot liners x3, Iron key x4), and they generated 35 of 109 candidate hits over 120 turns.
// It is flagged when
// its HEAD NOUN appears in this turn's player action or GM narration with no matching
// ITEM_LOST/COMPANION_ITEM_LOST in the same response. Head-noun matching is deliberate: the t582
// narration said "a charge is wedged", never "Blasting charge" — full-name matching misses the
// real case. The cost is a loose match ("Frizwick charges the door" flags the stack); the nudge
// wording carries the leave-alone escape for exactly that, and the cooldown latch keeps an
// ignored nudge from re-nagging (CONSUMABLE_NUDGE_COOLDOWN).
// Head noun: "X of Y" compounds head on the first segment's last word ("Greater Potion of
// Healing" → potion); plain compounds on the last word ("Blasting charge" → charge).
function consumableHeadNoun(base){
  var b=String(base||"").replace(/\s*\([^)]*\)\s*$/,"").trim();
  var ofm=b.match(/^(.+?)\s+of\s+/i);if(ofm)b=ofm[1].trim();
  var words=b.split(/\s+/);
  return words[words.length-1]||"";
}
var GENERIC_CONSUMABLE_HEAD_RE=/^(?:fire|oil|acid|dust|powder|water)$/i;
var CONSUMABLE_USE_RE=/\b(?:drink(?:s|ing)?|drank|quaff(?:s|ed|ing)?|swallow(?:s|ed|ing)?|apply|applies|applied|applying|smear(?:s|ed|ing)?|hurl(?:s|ed|ing)?|throw(?:s|ing)?|threw|toss(?:es|ed|ing)?|lob(?:s|bed|bing)?|ignite(?:s|d|ing)?|light(?:s|ed|ing)?|detonat(?:e|es|ed|ing)|use(?:s|d|ing)?|spend(?:s|ing)?|spent|consum(?:e|es|ed|ing)|uncork(?:s|ed|ing)?|empty|empties|emptied|pour(?:s|ed|ing)?|sprinkl(?:e|es|ed|ing)|scatter(?:s|ed|ing)?|activat(?:e|es|ed|ing)|wedg(?:e|es|ed|ing))\b/i;
function consumableUseEvidence(hay,base,head){
  if(!GENERIC_CONSUMABLE_HEAD_RE.test(head))return true;
  var h=String(hay||"").replace(/’/g,"'"),b=String(base||"").replace(/’/g,"'").replace(/\s*\([^)]*\)\s*$/,"").trim();
  var esc=b.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+"),re;
  try{re=new RegExp("\\b"+esc+"\\b","ig");}catch(e){return false;}
  var m;while((m=re.exec(h))){var win=h.slice(Math.max(0,m.index-80),Math.min(h.length,re.lastIndex+80));if(CONSUMABLE_USE_RE.test(win))return true;}
  return false;
}
function detectGhostConsumables(playerTxt,raw){
  if(!worldState||!worldState.character)return;
  var hay=String(playerTxt||"")+"\n"+String(raw||"");
  // item-loss tags already in this response → those items are handled, not ghosts
  var lostNorm={},tags=String(raw||"").match(/\[(?:COMPANION_)?ITEM_LOST:[^\]]+\]/g)||[],ti;
  for(ti=0;ti<tags.length;ti++){
    var cm=tags[ti].match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/),pm=tags[ti].match(/\[ITEM_LOST:([^\]]+)\]/);
    if(cm){var owner=(typeof resolveNpcName==="function")?resolveNpcName(cm[1].trim()):cm[1].trim();lostNorm[owner+"|"+_invNorm(_qtyParse(cm[2]).base)]=1;}
    else if(pm)lostNorm["|"+_invNorm(_qtyParse(pm[1]).base)]=1;
  }
  var liveKeys={};/* #60b: every key the current party can legitimately hold a latch for */
  function sweep(who,inv){
    var j;for(j=0;j<(inv||[]).length;j++){var entry=inv[j];if(typeof entry!=="string")continue;
      var base=_invBase(entry),norm=_invNorm(entry);
      var itemDef=(typeof itemLookup==="function")?itemLookup(base):null;
      if(itemDef?itemDef.category!=="consumable":!CONSUMABLE_RE.test(base))continue;
      var key=(who||"")+"|"+norm;
      liveKeys[key]=1;
      if(lostNorm[key])continue;
      // #60b: the GM already answered "not spent" for this item at this exact count. Stay silent
      // until the count actually moves — a spend or a fresh acquisition is new information, a
      // re-mention of the same unspent stack is not (that re-nagging is what produced the leak).
      var kept=worldState.consumableKept&&worldState.consumableKept[key];
      if(kept!=null){
        if(kept===_invCount(entry))continue;
        delete worldState.consumableKept[key];/* count moved — the confirmation is stale, let the check speak again */
      }
      var head=consumableHeadNoun(base);if(head.length<3)head=base;
      if(!consumableUseEvidence(hay,base,head))continue;
      var re;try{re=new RegExp("\\b"+head.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es)?\\b","i");}catch(e){continue;}
      if(!re.test(hay))continue;
      var last=worldState.consumableNudged&&worldState.consumableNudged[key];
      if(last!=null&&(worldState.turn-last)<CONSUMABLE_NUDGE_COOLDOWN)continue;
      var pending=false,pi;for(pi=0;pi<((worldState.consumablePending)||[]).length;pi++){if(worldState.consumablePending[pi].key===key){pending=true;break;}}
      if(pending)continue;
      if(!worldState.consumableChecks)worldState.consumableChecks=[];
      var dup=false,k;for(k=0;k<worldState.consumableChecks.length;k++){if(worldState.consumableChecks[k].key===key){dup=true;break;}}
      if(dup)continue;
      worldState.consumableChecks.push({who:who,item:base,key:key});
      if(worldState.consumableChecks.length>6)worldState.consumableChecks.shift();/* bounded; oldest is stalest */
    }
  }
  sweep(null,worldState.character.inventory);
  var ni,_swParty=livingPartyCompanions();/* #6: shared party scan */
  for(ni=0;ni<_swParty.length;ni++)sweep(_swParty[ni].name,_swParty[ni].charSheet.inventory);
  // #60b: prune orphaned latches (item fully spent, sold, or its owner left the party). The
  // standing monotonic-resources rule — consumableKept is per-item-per-owner and would otherwise
  // accumulate for the life of the campaign. The sweep above just enumerated every legitimate
  // key, so anything else is dead weight. A returning companion simply gets checked again.
  if(worldState.consumableKept){
    var kk=Object.keys(worldState.consumableKept),kx;
    for(kx=0;kx<kk.length;kx++)if(!liveKeys[kk[kx]])delete worldState.consumableKept[kk[kx]];
    if(!Object.keys(worldState.consumableKept).length)delete worldState.consumableKept;
  }
  if(worldState.consumablePending){worldState.consumablePending=worldState.consumablePending.filter(function(x){return x&&liveKeys[x.key];});if(!worldState.consumablePending.length)delete worldState.consumablePending;}
}
// ── THE GM-turn commit pipeline (audit 07-16 #5) ─────────────────────────────────────────────
// One home for the formerly duplicated sendAction/beginAdventure commit sequences. sendAction's
// order is CANONICAL — it carries UA6 (persist history BEFORE any display step) and every later
// fix; beginAdventure now inherits it, which closes its display-first gap (a throw in the
// opening addMsg used to strand a saved state whose transcript/sessionLog lacked the opening
// scene — exactly the desync class UA6 fixed for normal turns). rerollLast is deliberately NOT
// unified: it never re-runs applyMuts, swaps sessionLog entries instead of appending, and
// replaces the last transcript entry in place — different semantics, forcing it in would lie.
// opts:
//   userMsg   — user-role content pushed to sessionLog. sendAction passes apiTxt so the API
//               history stays consistent with what the GM actually answered (P3 engine notes
//               included); beginAdventure passes the intro directive.
//   playerTxt — clean player action text for detectGhostConsumables (#60).
//   isOpening — beginAdventure's opening scene: skips turn++/nameIdx rotation (the opening is
//               not a numbered turn), the ghost-consumable check (no player action yet), and
//               transient-marker maintenance (pendingLegacy/recentSwitch/recentlyLeft are
//               mid-game constructs) — explicit per-caller differences, never behavior loss.
//   onMutated — called the moment applyMuts lands (sendAction latches _committed here for the
//               E82 no-double-apply Retry guard).
// Returns the narrator message element.
var LOCATION_FILING_TURNS=8,TRAVEL_PRICE_TURNS=12;
function _driftEsc(s){return String(s||"").replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&");}
/* P4b (#169): the filing cue is now SENTENCE-disciplined. Dialogue is stripped first (spoken
   intent is not movement), and the sentence carrying the trigger must (a) be free of negation/
   hypothetical/dream framing and (b) contain the party ("you/we/us/the party") — a courier
   entering a fortress on the horizon is scenery, not an unfiled party location. */
var _LOC_CUE_VETO=/\b(?:not|never|won't|will not|cannot|can't|refuse[sd]?|if|unless|would|could|might|hop(?:e|es|ed|ing)|plan(?:s|ned|ning)?|intend(?:s|ed|ing)?|dream(?:s|t|ed|ing)?|vision|imagin\w+|nightmare|memor(?:y|ies))\b/i;
var _LOC_CUE_PARTY=/\b(?:you|your|we|us|our|the party)\b/i;
function detectLocationFilingCue(clean){
  var s=String(clean||"").replace(/"[^"]*"/g," ").replace(/“[^”]*”/g," ");if(!s)return null;
  var sents=s.match(/[^.!?]+[.!?]*/g)||[s];
  var nodes=(memory&&memory.map&&memory.map.nodes)||{},ks=Object.keys(nodes),i,k,nm,esc,si,sent;
  for(i=0;i<ks.length;i++){
    k=ks[i];if(nodes[k]&&nodes[k].parent)continue;nm=(typeof locDisplayLeaf==="function")?locDisplayLeaf(k):k;esc=_driftEsc(nm);
    var hitRe=new RegExp("(?:\\b(?:enter(?:s|ed|ing)?|inside|within)\\b[^.!?]{0,70}\\b"+esc+"\\b|\\bthrough\\b[^.!?]{0,90}\\b"+esc+"\\b)","i");
    var refRe=new RegExp("\\b(?:toward|towards|remembering|recalling)\\s+(?:the\\s+)?"+esc+"\\b|\\b(?:map|drawing|sketch)\\s+of\\s+(?:the\\s+)?"+esc+"\\b","i");
    for(si=0;si<sents.length;si++){
      sent=sents[si];
      if(!hitRe.test(sent)||refRe.test(sent))continue;
      if(_LOC_CUE_VETO.test(sent)||!_LOC_CUE_PARTY.test(sent))continue;
      return nm;
    }
  }
  for(si=0;si<sents.length;si++){
    sent=sents[si];
    if(_LOC_CUE_VETO.test(sent)||!_LOC_CUE_PARTY.test(sent))continue;
    var g=sent.match(/\b(?:enter(?:s|ed|ing)?|step(?:s|ped|ping)?\s+into|pass(?:es|ed|ing)?\s+into|inside|through)\b[^.!?]{0,45}?\b((?:[A-Z][A-Za-z'’.-]*\s+){0,3}(?:chamber|hall|tunnel|vault|fortress|citadel|keep))\b/i);
    if(g)return g[1].replace(/^the\s+/i,"").trim();
  }
  return null;
}
function _driftNumber(v){var s=String(v||"").toLowerCase();return /^\d+$/.test(s)?parseInt(s,10):((typeof FUTURE_NUMBER_WORDS!=="undefined"&&FUTURE_NUMBER_WORDS[s])||0);}
function detectTravelPrice(clean){
  var s=String(clean||"");if(/\b(?:teleport|portal|instant(?:ly)?|magical shortcut)\b/i.test(s))return null;
  var num="(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)",m;
  m=s.match(new RegExp("\\b([A-Z][A-Za-z'’.-]*(?:\\s+[A-Z][A-Za-z'’.-]*){0,3})\\s+(?:is\\s+)?still\\s+"+num+"\\s+days?\\s+(?:south|north|east|west|away)\\b"));
  if(m)return {destination:m[1].trim(),days:_driftNumber(m[2])};
  m=s.match(new RegExp("\\b"+num+"\\s+days?\\s+(?:to|until|before\\s+reaching)\\s+([A-Z][A-Za-z'’.-]*(?:\\s+[A-Z][A-Za-z'’.-]*){0,3})\\b","i"));
  return m?{destination:m[2].trim(),days:_driftNumber(m[1])}:null;
}
function detectDatedCommitment(clean){
  var s=String(clean||"").replace(/\s+/g," ").trim();if(!s||s.length>900)return null;
  var money=/\b(?:gold|gp|silver|sp|copper|cp|pay|payment|owe|owed|deliver|delivery|ready)\b/i;
  var interval=/\b(?:call\s+it|in|within|after)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:minutes?|hours?|days?|weeks?)\b/i;
  var mm=s.match(money),im=s.match(interval);if(!mm||!im||Math.abs(mm.index-im.index)>160||/\b(?:if|could|might|maybe|hypothetically)\b/i.test(s))return null;
  var at=im.index,start=Math.max(0,at-130),end=Math.min(s.length,at+130);return s.slice(start,end);
}
// W4 observers store at most one candidate per axis. They detect gaps and arm GM-decides notes;
// no prose path mutates location, clock, quests, schedules, or future-event lifecycle.
function observeDriftAxes(raw,clean){
  if(!worldState)return;raw=String(raw||"");clean=String(clean||"");var turn=worldState.turn||0;
  var hasLoc=/\[(?:LOCATION|SUBLOCATION):[^\]]+\]|\[SUBLOCATION_LEAVE\]/i.test(raw),cue;
  if(hasLoc){delete worldState.locationFilingWatch;delete worldState.locationFilingPing;}
  else{
    cue=detectLocationFilingCue(clean);
    if(cue&&((typeof locSame==="function"&&locSame(cue,worldState.world.location))||(worldState.world.sublocation&&String(cue).toLowerCase()===String(worldState.world.sublocation).toLowerCase())))cue=null;
    var lw=worldState.locationFilingWatch;
    if(cue&&(!lw||String(lw.place).toLowerCase()!==String(cue).toLowerCase()))lw=worldState.locationFilingWatch={place:cue,firstTurn:turn,lastTurn:turn,count:1};
    else if(lw){lw.lastTurn=turn;lw.count=(lw.count||1)+1;}/* P4b: counting related-but-unnamed turns is the FEATURE (the ratified fixture: an entry survives eight untagged turns) — weak cues are killed at the SOURCE by the sentence discipline above */
    if(lw&&lw.count>=LOCATION_FILING_TURNS){worldState.locationFilingPing={place:lw.place,firstTurn:lw.firstTurn,turn:turn};delete worldState.locationFilingWatch;}
  }
  var price=detectTravelPrice(clean);
  if(price&&price.days>0)worldState.travelPriceWatch={destination:price.destination,expected:price.days*MIN_PER_DAY,startMin:clockNow(),startTurn:turn};
  var tw=worldState.travelPriceWatch,lm=raw.match(/\[LOCATION:([^\]]+)\]/i);
  if(tw&&lm){
    var arrived=locResolve(normalizeEndpointPair(lm[1].trim())),same=(typeof locSame==="function")?locSame(arrived,tw.destination):String(arrived).toLowerCase()===String(tw.destination).toLowerCase();
    if(same){var elapsed=Math.max(0,clockNow()-tw.startMin),shortfall=Math.max(0,tw.expected-elapsed);
      if(turn-tw.startTurn<=TRAVEL_PRICE_TURNS&&shortfall>=MIN_PER_HOUR&&!/\b(?:teleport|portal|instant(?:ly)?|shortcut|abandon(?:ed)?\s+the\s+route)\b/i.test(clean))worldState.travelPricePing={destination:tw.destination,elapsed:elapsed,shortfall:shortfall,turn:turn};
      delete worldState.travelPriceWatch;
    }
  }
  if(tw&&turn-tw.startTurn>TRAVEL_PRICE_TURNS)delete worldState.travelPriceWatch;
  var hasLifecycle=/\[(?:SCHEDULE|FUTURE_EVENT|QUEST)(?::|_)/.test(raw);
  if(hasLifecycle)delete worldState.commitmentPing;
  else{var dc=detectDatedCommitment(clean);if(dc)worldState.commitmentPing={text:dc,turn:turn};}
  if(worldState.commitmentPing&&turn-worldState.commitmentPing.turn>COMMITMENT_PING_MAX_AGE)delete worldState.commitmentPing;/* P4b (#169): a commitment nobody could deliver a note for in 10 turns is stale context, not a live gap */
}
function isBookkeepingResponse(raw,clean,dice){
  if(String(clean||"").trim()||String(dice||"").trim())return false;
  var s=String(raw||""),known={},i,m,ms;
  if(typeof TAG_STRIP_NAMES!=="undefined")for(i=0;i<TAG_STRIP_NAMES.length;i++)known[TAG_STRIP_NAMES[i]]=1;
  if(typeof TAG_STRIP_BARE!=="undefined")for(i=0;i<TAG_STRIP_BARE.length;i++)known[TAG_STRIP_BARE[i]]=1;
  ms=s.match(/\[([A-Z][A-Z_]{1,})(?::[^\]]*)?\]/g)||[];
  for(i=0;i<ms.length;i++){m=ms[i].match(/^\[([A-Z][A-Z_]{1,})/);if(m&&known[m[1]])return true;}
  return false;
}
function commitGmTurn(resp,opts){
  var o=opts||{};
  if(typeof clearPendingAction==="function")clearPendingAction();/* #14: a committed turn supersedes any persisted failed action */
  /* #197: an IN-BAND model refusal ("I cannot continue generating content for this scene…" —
     field t1985) is judged on the CLEAN text before any mutation. A refusal turn still commits
     (the player saw it; re-roll needs the transcript pair) but as NON-CANON: no tag application,
     rf-marked for retrieval exclusion, delivered note latches restored, loudly toasted. */
  var _refusal=(typeof detectModelRefusal==="function")&&detectModelRefusal(cleanTxt(resp));
  /* #28 (v1.670): the player's line enters the PERMANENT record only when its answer commits —
     logged HERE, before turn++ so the pair keeps its historical stamps (player@N, gm@N+1). A
     failed call now leaves NO orphan (the gpt-4o 44×429 memento class: runs of unanswered player
     lines): the old pre-call write in sendAction and its same-text dedup guard are DELETED —
     in-flight recovery is #14 pending-action's job, never the story record's. Refusal turns
     still log the pair (#197: the player saw it; re-roll needs it). Silent sends and Table Talk
     never pass logPlayer, and the opening has no player half. */
  if(o.logPlayer&&o.playerTxt!=null&&!o.isOpening)logTranscript("player",o.playerTxt);
  if(!o.isOpening){
    worldState.turn++;
    if(typeof memory.nameIdx==="number")memory.nameIdx+=10; // rotate the AVAILABLE NAMES window once per narrative turn (buildSysPrompt only peeks — audit #12)
  }
  // Order is significant: applyMuts on raw text first, then cleanTxt strips tags.
  var _cmPre=coreMemorySnapshot();/* #40: pre-state for the defining-moments diff */
  var _cnPre=conditionSnapshot();/* #46: pre-state for condition turn-stamps */
  var _rlPre=relationshipSnapshot();/* #61: pre-state for relationship stamps + downgrade/audit triggers */
  var _clkPre=(typeof clockNow==="function")?clockNow():null;/* #105b: pre-state for the per-turn time receipt */
  var _invPre=inventorySnapshot();/* #107: pre-state for the "what did I actually collect" toast */
  if(_refusal){
    /* Owner ruling 2026-08-20: refused narration is not tag-accessible. The parser never runs;
       tagLogRefusal records the withheld tag names in the provenance ring so the zero-tag turn
       is attributable (#137 — absence must never be ambiguous). Delivered engine notes were
       never acted on, so their one-shot latches are un-burned (the #151 principle — same reason
       a dead provider call restores them; the snapshot rides in via sendAction's opts). */
    if(typeof tagLogRefusal==="function")tagLogRefusal(resp);
    if(o.latchSnap&&typeof restoreNoteLatches==="function")restoreNoteLatches(o.latchSnap);
    if(typeof noteLogDiscard==="function")noteLogDiscard();/* #309: a note the GM never acted on is not a note the engine fired */
    console.warn("[refusal] the model declined to narrate (turn "+worldState.turn+") — committed as NON-CANON: embedded tags withheld, retrieval-excluded (#197)");
    if(typeof showToast==="function")showToast("⚠ The model declined this scene — re-roll or rephrase",6000);
    if(typeof erCrumb==="function")erCrumb("turn-refused",{t:worldState.turn,ch:String(resp||"").length});
  }else{
  applyMuts(resp,{deferSave:true});/* #272 D1: the commit save below is THE turn's one save — applyMuts' trailing save was LZ pass 1 of three */
  if(o.latchSnap&&typeof noteLogCommit==="function")noteLogCommit();else if(typeof noteLogDiscard==="function")noteLogDiscard();/* #309: the notes ring files only DELIVERED gameplay notes (latchSnap rides only on those turns) */
  /* #149: a FIRED aftermath nudge is consumed by the turn that commits — whether the GM filed
     a [LOCATION_STATE:] or stayed silent, the one shot is spent. A pending stamped by THIS
     response's own combat close has no .fired flag and survives to fire next turn; a failed
     provider call never reaches here, so the shot survives transport loss. */
  if(worldState.pendingLocState&&worldState.pendingLocState.fired)delete worldState.pendingLocState;
  }
  if(o.onMutated)o.onMutated();/* state is now mutated — callers that offer Retry must latch here (E82) */
  if(worldState.checkpointDue){var _cpr=worldState.checkpointDue;delete worldState.checkpointDue;if(typeof takeCheckpoint==="function")takeCheckpoint(_cpr);}/* #300: the camp queued by [REST:long] / an act close is taken here, after the response committed */
  if(worldState.deathPending&&typeof resolvePlayerDeath==="function")resolvePlayerDeath();/* #300: the death narration is in the book; now the consequence */
  if(worldState.deathScene&&typeof deathSceneAdvance==="function"){if(worldState.deathScene.stage==="arrive")deathSceneAdvance("arrive");else if(worldState.deathScene.stage==="answer")deathSceneAdvance("answer");}/* #301: the scene's turn boundary */
  detectCoreMoments(_cmPre);stampNewConditions(_cnPre);stampRelationshipChanges(_rlPre);/* #40/#46/#61: AFTER applyMuts */
  if(typeof agendaAdoptSeeds==="function")agendaAdoptSeeds();/* #330: a blueprint want adopts onto the sheet the turn it exists */
  toastInventoryGains(_invPre);/* #107: say what reached the sheet — silence means the tag never fired */
  if(!o.isOpening){
    // #137 stay-behind watcher (fast path; buildPresenceAudit is the deterministic sibling):
    // a narrated stay-behind with NO [PARTY_SPLIT:] in the same response arms a one-shot ping
    // for buildStayBehindNudge. Only non-split members are scanned — an already-recorded split
    // needs no nudge, and a response that carries ANY [PARTY_SPLIT:] is handling its own splits.
    if(!_refusal&&typeof detectStayBehind==="function"&&String(resp).indexOf("[PARTY_SPLIT:")<0){/* #197: a refusal is not narration — no presence inference from it */
      var _sbNames=livingPartyCompanions().filter(function(n){return !(n.charSheet&&n.charSheet.splitLoc);}).map(function(n){return n.name;});
      var _sbHit=detectStayBehind(resp,_sbNames);
      if(!_sbHit&&typeof detectPartyAbsenceCorrection==="function")_sbHit=detectPartyAbsenceCorrection(o.playerTxt,_sbNames);
      if(_sbHit)worldState.presencePing={name:_sbHit,turn:worldState.turn};
      /* #189ⓐ: the PLAYER-INPUT twin — a departure declared in the player's own words
         ("You two get some sleep") that neither the GM's tags nor its prose recorded. Its own
         ping/builder because the wording differs (player-declared vs narrated) and names may
         be absent (a nameless subgroup directive — the GM resolves who). */
      if(!_sbHit&&typeof detectPlayerStayBehind==="function"){
        var _psbHit=detectPlayerStayBehind(o.playerTxt,_sbNames);
        if(_psbHit)worldState.playerSplitPing={names:_psbHit.names||[],turn:worldState.turn};
      }
    }
    if(!_refusal)detectGhostConsumables(o.playerTxt,resp);/* #60: ghost-consumable check — queues for buildConsumableNudge; syncCharSheet naturally excluded (its audit already asks for missing tags); #197: refusals excluded too */
    if(worldState.pendingLegacy){var _lcn=worldState.pendingLegacy.name,_lp=worldState.pendingLegacy;
      if(_lp.introduced||resp.indexOf(_lcn)>=0){if(!_lp.introduced){if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];worldState.legacyCharsUsed.push(_lcn);_lp.introduced=true;}if(relationshipAdoptPortableProposals(_lp,_lcn))worldState.pendingLegacy=null;}// introduced relationship conflicts transfer losslessly before the transient cameo record retires
      else if((worldState.turn-_lp.queuedAt)>=5){worldState.pendingLegacy=null;}// expired unintroduced → un-queue WITHOUT burning them, so they can roll again later (audit E85)
    }
    if(worldState.recentSwitch&&(worldState.turn-worldState.recentSwitch.turn)>=2)worldState.recentSwitch=null; // POV reinforcement done; sessionLog now carries new-POV turns
    /* #172: the D12 exit clear is COMPLIANCE-boxed, not time-boxed. It used to fire once three turns
       had passed regardless of whether the GM ever switched back — miss that window and the campaign
       narrated in third person forever, with nothing left to correct it (the field report). The
       retirement now lives in personDriftDetect, which clears mpEnded the moment a response actually
       narrates in second person. A GM that complies on turn 1 retires it a turn EARLIER than the old
       counter did; one that never complies keeps being asked. */
    if(worldState.recentlyLeft){worldState.recentlyLeft=worldState.recentlyLeft.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentlyLeft.length)worldState.recentlyLeft=null;}
    if(worldState.recentAbandon){worldState.recentAbandon=worldState.recentAbandon.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentAbandon.length)worldState.recentAbandon=null;}/* #229: same 2-turn shelf as recentlyLeft */
    if(worldState.recentWallSweep){worldState.recentWallSweep=worldState.recentWallSweep.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentWallSweep.length)worldState.recentWallSweep=null;}/* #234: the wall's post-sweep note rides the same shelf */
  }
  if(typeof erCrumb==="function")erCrumb("turn","t"+worldState.turn+" "+String(resp||"").length+"ch");
  var clean=cleanTxt(resp),dice=diceTxt(resp),_bookkeeping=isBookkeepingResponse(resp,clean,dice);
  if(!o.isOpening&&!_refusal&&typeof observeDriftAxes==="function")observeDriftAxes(resp,clean);/* #197: refusal text is meta-voice, not narration — no drift-axis candidates from it */
  // UA6: persist HISTORY before any display step. applyMuts' trailing saveAll already
  // persisted the mutated state, so a throw in addMsg/TTS used to strand a saved state
  // whose sessionLog/transcript lacked this GM turn — next prompt desynced from state,
  // narration lost. With history+state saved first, a display throw leaves them
  // consistent and reload REPLAYS the missed narration from the transcript.
  /* #105b: the time receipt. Read the clock AFTER every mutation (TIME_ADVANCE, and the [REST:long]
     dawn roll that restSpells owns) so the stamp is what the clock ACTUALLY did this turn, not what
     the tag claimed. A zero here is real signal — it means the GM billed the turn no time at all. */
  if(!_refusal&&typeof personDriftDetect==="function")personDriftDetect(clean,_bookkeeping);/* #172: narrative-person watcher — CLEAN text (tag payloads carry no prose person), post-applyMuts, beside the phase watcher for the same reason: sheet-sync and Table Talk never reach commitGmTurn, so only real narration is judged; #197: a refusal is first-person meta by nature and must not count as drift */
  if(!_refusal&&typeof clockPhaseDetect==="function")clockPhaseDetect(clean);/* #158: phase-mismatch watcher — post-applyMuts (the parser tail already reconciled any [TIME:], so agreement self-silences by band math), CLEAN text only (raw would match the tags' own words). Openings included; sheet-sync and TT never pass through commitGmTurn, so non-story text is never scanned; #197: refusal text asserts no phase */
  /* #189ⓑ: item-owner binding watcher — CLEAN committed prose only, refusals excluded, one
     standing record (first wins until delivered, so a multi-turn scene can't re-arm mid-nudge). */
  if(!_refusal&&!worldState.itemMisPing&&typeof detectItemMisattribution==="function"){
    var _imHit=detectItemMisattribution(clean);
    if(_imHit)worldState.itemMisPing={wrong:_imHit.wrong,item:_imHit.item,owner:_imHit.owner,turn:worldState.turn};
  }
  logTranscript("gm",clean,resp,(_clkPre===null?undefined:clockNow()-_clkPre),{bookkeeping:_bookkeeping,refusal:_refusal});
  worldState.lastTurnAt=Date.now();/* #308: Car Mode's "previously on" keys off how long ago the last turn landed */
  var _slUser={role:"user",content:o.userMsg},_slGm={role:"assistant",content:resp};
  if(_bookkeeping){_slUser.bk=1;_slGm.bk=1;}
  sessionLog.push(_slUser,_slGm);
  /* #272 D1: the speaker map derives and stamps BEFORE the single commit save, so the turn's
     state, history, AND .sp attribution persist atomically in ONE LZ pass — the old post-save
     stamp invalidated the compression memo and forced a third full-transcript pass (f70).
     Bookkeeping turns never stamped speakers (narrateWithSpeakers ran after their early return)
     and still don't. */
  var _spMap=_bookkeeping?null:deriveAndStampSpeakers(clean,resp,worldState.transcript[worldState.transcript.length-1],worldState.transcript);
  if(_bookkeeping){
    saveAll();/* bookkeeping turns never reach generateActions — the commit is their one sync */
    processPendingCompanionSheets();
    if(worldState.pendingItemDefs&&worldState.pendingItemDefs.length&&typeof showItemDefConfirmModal==="function")showItemDefConfirmModal();if(worldState.pendingRewardClaims&&worldState.pendingRewardClaims.length&&typeof showRewardClaimModal==="function")showRewardClaimModal();/* #215: an unanswered claim survives the tab closing */
    return null;
  }
  /* #280b (field 2026-08-29): the narration commit persists LOCALLY; the turn's ONE cloud sync
     moves to generateActions' completion. The commit-time POST fired at +1.5s — inside the
     suggestion call's async window, AFTER its E26 lastActions clear — so the server blob carried
     null buttons, the JP0-11 size cap skips the page-hide flush on any mature save, and the
     second device rendered the newest narration buttonless. UA6 unchanged: state+history+speakers
     still persist here, before any display step. */
  saveLocal();
  var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn,ck:(typeof clockNow==="function"?clockNow():null)});/* escProse: escape model output before it hits the story DOM (audit E11) */
  if(_spMap&&narEl)narEl._sp=_spMap;   // the per-message replay button reads this at click time
  speakNarration(clean,_spMap);/* #96: map derived from the response's own [SAY:] tags; #177: entry + owning array were captured together at the stamp */
  generateActions(narEl);
  processPendingCompanionSheets();// draw up sheets for any narrative-path join this turn (audit P2)
  /* #81: [ITEM_DEF:] proposals queued by this turn go to the player NOW — the confirm modal is
     the only path from proposal to canon (accept writes the overlay; decline drops loudly). */
  if(worldState.pendingItemDefs&&worldState.pendingItemDefs.length&&typeof showItemDefConfirmModal==="function")showItemDefConfirmModal();if(worldState.pendingRewardClaims&&worldState.pendingRewardClaims.length&&typeof showRewardClaimModal==="function")showRewardClaimModal();/* #215: an unanswered claim survives the tab closing */
  return narEl;
}
// TODO #1 P3 (D4): mid-round suggestion refresh — strip the previous sub-turn's buttons off the
// last narration and generate a fresh set for the (new) spotlight PC. DOM-side companion to the
// pure queue helpers in helpers.js.
function mpRefreshSuggestions(){
  var story=document.getElementById("story-narrative");if(!story)return;
  var nars=story.querySelectorAll(".msg.narrator");if(!nars.length)return;
  var narEl=nars[nars.length-1];
  var olds=narEl.querySelectorAll("button.qa"),i;
  for(i=0;i<olds.length;i++){var wrap=olds[i].parentNode;if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap);else if(olds[i].parentNode)olds[i].parentNode.removeChild(olds[i]);}
  generateActions(narEl);
}
// B16: hand the player their words back after a FAILED turn. sendAction clears the box at submit,
// so until now a failure left the typed/spoken action reachable only through the Retry button —
// and a page killed before that tap (exactly what the reporting device's previous load did) lost
// it entirely. Worst in hands-free Car Mode, where "just retype it" is not an option.
// Refuses to clobber: STT auto-listen (or the player) can queue a NEW action while the turn is in
// flight, and that draft outranks a failed one. Returns true only when it actually restored.
// Takes the element rather than reading the DOM so the caller's existing reference is reused and
// the rule stays testable without a document.
function restoreFailedInput(inp,txt){
  if(!inp||!txt||String(inp.value||"").trim())return false;
  inp.value=txt;return true;
}
// #14 (B16 residual): restoreFailedInput only survives within the page load — a kill before
// the retry tap erased the action (exactly what the reporting device did). The pending action
// persists in its OWN key, written ONLY on the story-failure path, cleared by the next
// committed turn. Deliberately NOT lastAction (it feeds ragRetrieve — persisting it would
// change RAG's first-query-after-reload input) and deliberately NOT saveAll (a failure-path
// flush would also persist the orphan player transcript entry). Campaign-stamped so a switch
// never resurrects another campaign's draft — a foreign draft is left in place for its owner.
function savePendingAction(txt){
  txt=String(txt||"").trim();if(!txt)return;
  try{store.set(PENDING_ACT_K,JSON.stringify({camp:(worldState&&worldState.campId)||null,txt:txt}));}
  catch(e){console.warn("[pending] could not persist the failed action:",e&&e.message);}
}
function clearPendingAction(){try{store.del(PENDING_ACT_K);}catch(e){}}
function restorePendingAction(){
  var raw=null;try{raw=store.get(PENDING_ACT_K);}catch(e){return null;}
  if(!raw)return null;
  var rec=null;try{rec=JSON.parse(raw);}catch(e){clearPendingAction();return null;/* corrupt record: self-heal, loudly pointless to keep */}
  if(!rec||!rec.txt||!String(rec.txt).trim())return null;
  if(rec.camp!==((worldState&&worldState.campId)||null))return null;
  return rec.txt;
}
async function sendAction(override,opts){
  if(busy||!worldState)return;var inp=document.getElementById("action-input");
  if(typeof campaignEnded==="function"&&campaignEnded()&&!(opts&&opts.silent)){if(typeof showToast==="function")showToast("This campaign has ended — its story is complete (File ▸ Export Narrative keeps it)");return;}/* #300 */
  /* #301: at the choose stage the two buttons are the whole vocabulary — no model call. */
  if(worldState.deathScene&&worldState.deathScene.stage==="choose"&&!(opts&&opts.silent)){
    var _dcTxt=override!==null?override:(inp?inp.value.trim():"");var _dch=deathChoiceFromText(_dcTxt);
    if(_dch==="back"){if(inp)inp.value="";deathSceneChoose("back");return;}
    if(_dch==="onward"){if(inp)inp.value="";if(typeof showOnwardConfirmModal==="function")showOnwardConfirmModal();else deathSceneOnwardConfirm();return;}
    if(typeof showToast==="function")showToast("Death waits. Walk back to camp, or go onward.");return;
  }
  /* #329: a typed action while a roll is pending lets the check lapse — the story moves on without it. */
  if(worldState.pendingCheck&&!(opts&&opts.silent)){delete worldState.pendingCheck;if(typeof console!=="undefined")console.info("[dice] #329 pending "+worldState.turn+" check lapsed — the player acted instead of rolling");}
  /* #325: the offered ending is a DECISION, not an action — no model call, a modal decides. */
  if(!(opts&&opts.silent)&&typeof endingChoiceFromText==="function"&&typeof endingOffered==="function"){var _eoTxt=override!==null?override:(inp?inp.value.trim():"");
    if(_eoTxt&&endingChoiceFromText(_eoTxt)&&endingOffered()){if(inp)inp.value="";if(typeof showEndingOfferModal==="function")showEndingOfferModal();else endingDecide("write");return;}}
  var txt=override!==null?override:inp.value.trim();if(!txt)return;
  if(typeof recklessArmIfChosen==="function"&&!(opts&&opts.silent))recklessArmIfChosen(txt);/* #305: the wildcard's reward note */
  if(typeof montageArmIfChosen==="function"&&!(opts&&opts.silent))montageArmIfChosen(txt);/* #308: the montage contract */
  // B10/v1.421 — repair the audio context HERE, in the send gesture. iOS interrupts the context
  // between turns, when nothing is watching (_armCtxWatch disarms itself while !_playing), so the
  // next read starts on a dead context and loses its first line to the native voice. This tap is a
  // real user gesture and lands seconds before narration, which makes it the one moment a rebuild
  // is both permitted and early enough to matter. No-op unless the context is actually broken.
  if(typeof TTS!=="undefined"&&typeof TTS.recoverAudio==="function")TTS.recoverAudio("send");
  // #90 (v1.436): wake the auto-stopped TTS machine while the GM is thinking — the field lesson:
  // Fly parks the box after ~2min idle and real turns idle longer than that, so without this the
  // FIRST unit of nearly every read paid the cold boot and timed out into the local ladder.
  if(typeof TTS!=="undefined"&&typeof TTS.prewarmServer==="function")TTS.prewarmServer();
  // Re-present a stat bump the player backed out of (audit E64) — it's an earned reward, not
  // something to forfeit; showing it again before the turn makes "Back" a defer, not a loss.
  /* #284: ONE re-surface seam for every owed milestone — durable queues (worldState.levelUpOwed)
     + the deterministic archetype reconstruction, in creation-flow order. Blocks the turn until
     the earned choices are made, and now survives reload/device handoff (the brief-36 strand). */
  if(!(opts&&opts.silent)&&typeof resurfaceLevelUpOwed==="function"&&!document.getElementById("sb-modal")&&!document.getElementById("spu-modal")&&!document.getElementById("arch-modal")&&resurfaceLevelUpOwed())return;
  // opts.ttRetry forces the Table Talk path regardless of the current tab — a failed TT question
  // must retry AS Table Talk even if the player switched to Story while it was in flight (#76).
  var isTT=(opts&&opts.ttRetry)?true:(activeChatTab==="tabletalk");
  // ── TODO #1 P3 (D3/D5): multi-PC sub-turn queue ───────────────────────────────────────────
  // Engaged ONLY when playerCount()>1 and this is a real story action (Table Talk and silent
  // engine sends bypass — they are out-of-character). Each submit queues the SPOTLIGHT PC's
  // action and advances the pointer (D7: the hero slot IS the turn indicator); the last PC's
  // submit assembles the whole round into ONE labeled block (D5) and falls through to the
  // normal single-call path below — so retry, transcript (ONE player entry per round: the
  // block), engine notes, and summarize all keep their existing semantics. opts.mpResolve
  // marks that fall-through so the block isn't addMsg'd twice (the queue lines already were).
  var _mpResolve=false;
  if(!isTT&&!(opts&&opts.silent)&&!(opts&&opts.mpBypass)&&typeof playerCount==="function"&&playerCount()>1){
    var _who=activePlayer();var _whoNm=(_who&&_who.name)||worldState.character.name;
    mpQueuePush(_whoNm,txt);
    inp.value="";
    addMsg("player","<b>"+escHtml(_whoNm)+":</b> "+escHtml(txt));/* escape player input (E11) */
    var _next=mpNextUnqueued();
    if(_next){
      setActivePC(_next);saveAll();syncUI();
      if(typeof showToast==="function")showToast("⚔ "+_next+"'s turn",2500);
      mpRefreshSuggestions();
      return;/* no API call — the round is still collecting */
    }
    txt=mpAssembleRound();
    worldState.mpQueue=[];
    setActivePC(mpPcOrder()[0]||null);/* round resets to the first PC (spec step 6) — the post-response suggestions generate for them */
    saveAll();syncUI();
    _mpResolve=true;
  }
  // lastAction feeds the topbar Retry button (retryLast), which sends as a STORY turn. A Table
  // Talk question must never land there: ask a TT question, switch to Story, hit Retry, and the
  // out-of-character question would be replayed as a real player action — transcript-logged,
  // applyMuts'd, turn advanced. TT keeps its retry payload in the catch closure instead (#76).
  busy=true;inp.value="";document.getElementById("sendbtn").disabled=true;if(!isTT)lastAction=txt;if(!isTT)lastActionOpts=(opts&&opts.silent)?{silent:true,rollTag:opts.rollTag||null}:null;/* #329: Retry must not turn an engine continuation into the player's words (the #76 literal stays intact) */
  if(!(opts&&opts.silent)&&!_mpResolve)addMsg(isTT?"tabletalk":"player",isTT?"[Table Talk] "+escHtml(txt):escHtml(txt));/* escape player input into the DOM (audit E11); a resolved round already displayed its per-PC lines */
  // #28 (v1.670): the player transcript write moved INTO commitGmTurn (logPlayer below) — an
  // action reaches the permanent record only once its answer commits, so failed calls can no
  // longer strand orphan player lines. The same-text retry dedup guard that lived here is dead
  // with it: nothing is written before the call, so there is nothing to deduplicate.
  var th=addMsg("thinking","The world turns...");
  var _committed=false; // true once applyMuts has mutated state — a Retry after that would double-apply (audit E82)
  // B16 turn-lifecycle stamps. Nothing recorded when the request LEFT, how long it was in flight,
  // or whether the page was backgrounded — so a field "Network: Load failed" could not be told
  // apart from a memory-pressure stall (the B9 class), a dropped radio, or a failure that never
  // reached the transport at all. _tSent stays 0 until the request actually departs, which is
  // itself the signal that the throw came from summarize/prompt-build rather than from the wire.
  var _tSent=0,_hid0=0,_restored=false;
  try{
    if(!isTT&&sessionTokens()>=SUMMARIZE_AT)await summarize();
    // #76: Table Talk is a HELP AGENT with its own prompt builder (table-talk.js) — app help
    // derived from the rendered File menu, capability-bible canon, engine-stored campaign facts,
    // memory tiers + question-keyed RAG, and its OWN rolling history. Deliberately NOT
    // buildSysPrompt: sharing that stable half would kill gameplay prompt-cache hits (UA5).
    var sys=isTT?buildTableTalkPrompt(txt):null;
    // P3 quest escalation: when an active quest has sat all-objectives-done for
    // QUEST_ESCALATE_TURNS+ turns (see buildQuestEscalation, api.js), prepend a bracketed
    // engine note to the OUTGOING API message. apiTxt is what callGM sends and what
    // sessionLog stores (sessionLog IS the API history); the displayed chat line already
    // captured the clean txt, the transcript player entry captures it at COMMIT time (#28,
    // commitGmTurn's logPlayer), and lastAction/retry keep the clean txt too, so the note
    // never reaches the player.
    var apiTxt=txt;
    if(!isTT&&!(opts&&opts.silent)){var _latchSnap=snapshotNoteLatches();/* #151: capture BEFORE the builders stamp/consume — the catch restores when the turn dies pre-commit */var _en=buildEngineNotes();if(_en)apiTxt=_en+"\n\n"+txt;}/* v1.255: the engine-notes registry (quest escalation + condition audit; adding a check = a NOTE_BUILDERS entry) */
    _tSent=Date.now();_hid0=(typeof document!=="undefined"&&document.hidden)?1:0;
    if(typeof erCrumb==="function")erCrumb("turn-start","t"+worldState.turn+(isTT?" tt":"")+((opts&&opts.silent)?" sil":"")+" "+String(apiTxt).length+"ch bg"+_hid0);/* pre-increment turn — commitGmTurn's "turn" crumb carries the post-increment one, so the pair brackets the request */
    // #76: TT sends noHistory — the narrative sessionLog is what used to overpower the
    // out-of-character instruction (#74 ②: GM narrated, was corrected, complied, then narrated
    // again next question). Its context now comes from buildTableTalkPrompt instead, including
    // a TT-only history. kind:"tabletalk" gives it its own Usage-modal bucket.
    var resp=await callGM(apiTxt,sys,null,null,isTT?{noHistory:true,kind:"tabletalk"}:undefined);th.remove();
    /* #323 (owner call 2026-09-03): a model refusal gets ONE automatic retry with the narrate-the-beat
       note before anything is shown — the t140 kiss comes back as a kiss, not a policy sentence. The
       retry's answer is judged by the same detector; a second refusal falls through to the #197
       non-canon commit exactly as before. The record keeps the ORIGINAL user message (the note is
       engine ceremony, not the player's words). Table Talk is never retried. */
    if(!isTT&&typeof detectModelRefusal==="function"&&typeof refusalRetryNote==="function"&&detectModelRefusal(cleanTxt(resp))){
      var _rrTh=addMsg("thinking","Rephrasing the ask\u2026");
      try{
        var _rr2=await callGM(refusalRetryNote()+"\n\n"+apiTxt,sys,null,null,undefined);
        if(!detectModelRefusal(cleanTxt(_rr2))){resp=_rr2;if(typeof console!=="undefined")console.info("[refusal] #323 the retry narrated the beat");}
        else if(typeof console!=="undefined")console.warn("[refusal] #323 the retry declined too \u2014 committing the refusal as non-canon (#197)");
      }catch(_rrE){if(typeof console!=="undefined")console.warn("[refusal] #323 retry call failed: "+(_rrE&&_rrE.message)+" \u2014 committing the original refusal");}
      if(_rrTh&&_rrTh.remove)_rrTh.remove();
    }
    if(opts&&opts.rollTag&&!isTT)resp=opts.rollTag+"\n"+String(resp||"");/* #329: the player's roll rides the continuation as the [DICE:] record the transcript keeps */
    if(isTT){
      // #74 ①: the TT pane never ran cleanTxt, unlike the narrative path, so any stray tag
      // rendered verbatim to the player (the [CALENDAR:…] sighting). Strip them here too.
      var ttClean=(typeof cleanTxt==="function")?cleanTxt(resp):resp;
      ttLogExchange(txt,ttClean);
      addMsg("tabletalk","<em>[GM]</em> <p>"+escProse(ttClean)+"</p>");/* escape GM table-talk output (audit E11) */
      saveAll();/* persist the TT log; debounced server sync coalesces the burst */
    }
    else{
      // The whole commit sequence lives in commitGmTurn (audit 07-16 #5) — shared with
      // beginAdventure. This path's order is the canonical one commitGmTurn reproduces.
      commitGmTurn(resp,{userMsg:apiTxt,playerTxt:txt,logPlayer:(!isTT&&!(opts&&opts.silent))/* #28: same exclusions the old pre-call write had — TT and silent engine sends leave no player line */,latchSnap:(typeof _latchSnap!=="undefined"?_latchSnap:null)/* #197: a refusal commit un-burns the delivered note latches — same snapshot the catch below uses */,onMutated:function(){_committed=true;/* a later throw must NOT offer a re-applying Retry (E82) */}});
    }
    syncUI();
  }catch(e){th.remove();
    if(!_committed&&typeof _latchSnap!=="undefined"&&_latchSnap&&typeof restoreNoteLatches==="function"){restoreNoteLatches(_latchSnap);if(typeof noteLogDiscard==="function")noteLogDiscard();}/* #309 *//* #151: the request never committed — un-burn every audit/nudge latch the builders stamped composing it, so the same audit fires again next turn instead of silently skipping its cooldown window */
    var _hid1=(typeof document!=="undefined"&&document.hidden)?1:0;
    if(typeof erCrumb==="function")erCrumb("turn-fail",(_tSent?(Date.now()-_tSent)+"ms":"pre-send")+(_committed?" post":" pre")+" bg"+_hid0+_hid1+" "+String((e&&e.message)||"?").slice(0,28));/* survives a page kill via the crumb ring, unlike the report below */
    // B16: ctx:"turn" alone could not tell a Story turn from a Table Talk question from a silent
    // engine send — three very different failures under one fingerprint. Kept in the detail (the
    // GAS sheet's column schema is fixed) and ctx left alone so existing rows still dedup.
    if(typeof reportError==="function")reportError("turn",e.message,((e&&e.stack)||"")
      +"\n(turn: "+(isTT?"tabletalk":"story")+((opts&&opts.silent)?", silent engine send":"")+(_tSent?", "+(Date.now()-_tSent)+"ms in flight":", failed before send")+")"
      +(_committed?"\n(state committed; display step failed)":""));/* #16: the mobile console is invisible — mail the failure */
    if(_committed){addMsg("system","Turn applied, but a display step failed: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn applied, but display failed");}/* no Retry — the mutation already landed (E82) */
    else{if(!_mpResolve&&!(opts&&opts.silent)){_restored=restoreFailedInput(inp,txt);if(!isTT)savePendingAction(txt);/* #14: survive a page kill too — story turns only (a TT question restored into the story box would cross channels) */}
      var em=addMsg(isTT?"tabletalk":"system","GM error: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn failed — tap to retry");if(_attachGMErrorUI(em,isTT?function(){sendAction(txt,{ttRetry:true});}:function(){retryLast();},e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
  }
  busy=false;document.getElementById("sendbtn").disabled=false;document.getElementById("action-input").focus();
  // A non-empty box here normally means STT heard something WHILE the turn was in flight. Since
  // B16 it can also be the failed action we just put back — and announcing "Heard you" would
  // overwrite the accurate "Turn failed — tap to retry" the catch just spoke, with a lie.
  if(typeof carMode!=="undefined"&&carMode&&!_restored){var _pk=document.getElementById("action-input");if(_pk&&_pk.value.trim()&&typeof carNotify==="function")carNotify("info","Heard you — tap to send");}
}
// #329: the click on the pending die. Rolls client-side, shows the result where the die was, and sends the
// engine note as a SILENT continuation (no player line, no engine notes) with the [DICE:] record riding
// along so the transcript and the provenance ring keep the roll exactly as a GM-rolled one.
function rollPendingCheck(){
  var chk=worldState&&worldState.pendingCheck;if(!chk||busy)return;
  var r=resolveCheck(chk,rollD20());delete worldState.pendingCheck;
  if(typeof document!=="undefined"){var el=document.querySelector(".dice-pending");if(el){var wrap=document.createElement("div");wrap.innerHTML=diceTxt(r.diceTag);if(wrap.firstChild)el.parentNode.replaceChild(wrap.firstChild,el);}}
  if(typeof Sound!=="undefined")Sound.play("click_glass");
  if(typeof saveAll==="function")saveAll();
  sendAction(r.note,{silent:true,rollTag:r.diceTag});
}
function retryLast(){if(lastAction)sendAction(lastAction,lastActionOpts?{mpBypass:true,silent:true,rollTag:lastActionOpts.rollTag}:{mpBypass:true});}/* P3: a retried multi-PC round is already an assembled block — re-queueing it as one PC's action would corrupt the round */
// Re-roll the last GM narration in the CURRENT prose voice WITHOUT advancing the turn
// or re-applying state tags — a clean A/B tool for trying Prose Inspiration voices on the
// same scene. Pops the last exchange so the GM regenerates in the original context, then
// swaps the displayed narration + the sessionLog assistant entry for the new one.
// Deliberately NOT unified into commitGmTurn (audit 07-16 #5): it swaps/replaces instead of
// appending and never runs applyMuts — a different pipeline, not a duplicate of it.
async function rerollLast(){
  if(busy||!worldState)return;
  if(activeChatTab==="tabletalk"){if(typeof showToast==="function")showToast("Switch to the Story tab to re-roll.");return;}
  var n=sessionLog.length;
  if(n<2||sessionLog[n-1].role!=="assistant"||sessionLog[n-2].role!=="user"){if(typeof showToast==="function")showToast("Nothing to re-roll yet.");return;}
  busy=true;document.getElementById("sendbtn").disabled=true;
  // UA4 note: the pop-push below is marker-safe — both the success path (push swapped pair)
  // and the failure path (restore originals) leave sessionLog.length unchanged, so the
  // sessKept extraction marker (#28) stays valid. Pinned by an engine test; if this ever
  // stops being net-neutral, adjust worldState.sessKept alongside.
  var prevA=sessionLog.pop(),prevU=sessionLog.pop(); // context is now just before the last action
  var th=addMsg("thinking","Re-rolling the scene...");
  try{
    var resp=await callGM(prevU.content,null,1500); // current voice; no muts, no turn++ (1500 = the turn budget, v1.540)
    th.remove();
    sessionLog.push({role:"user",content:prevU.content},{role:"assistant",content:resp});
    var clean=cleanTxt(resp),dice=diceTxt(resp);
    /* #197: the replacement is judged like any narration — a rerolled-in refusal must not become
       servable canon (rf set below), and a real narration replacing a refusal clears the mark. */
    var _rrRefusal=(typeof detectModelRefusal==="function")&&detectModelRefusal(clean);
    if(_rrRefusal&&typeof showToast==="function")showToast("⚠ The model declined this scene — re-roll or rephrase",6000);
    // Keep the transcript honest: the re-rolled scene replaces the discarded one, so the
    // story-compiler record matches what the player actually read (audit #9).
    if(worldState.transcript&&worldState.transcript.length&&worldState.transcript[worldState.transcript.length-1].r==="gm"){
      // Audit 07-16 #1 → #177: an IN-PLACE mutation of the last entry (same object, same
      // length — no swap) is invisible to the serialize memo except via its last-entry .x
      // compare; an .e-only change (identical reroll text) slipped even that. The accessor
      // owns the invalidation now — this was the site the explicit-invalidate convention
      // was invented for.
      mutateTranscriptEntry(worldState.transcript,worldState.transcript.length-1,function(e){
        e.x=clean.trim();
        if(_rrRefusal)e.rf=1;else if(e.rf)delete e.rf;/* #197: the mark follows the CURRENT text — set on a rerolled-in refusal, cleared when real narration replaces one */
        if(typeof ragEntitiesFromRaw==="function")e.e=ragEntitiesFromRaw(resp); // keep the #27 entity index honest too
      });
    }else{
      /* #198ⓒ: the turn being re-rolled never logged narration (the last entry is the PLAYER
         line — the pre-#198 empty-commit shape, field t2002: the replaced sonnet-5 reroll
         reached display and sessionLog but the transcript permanently lacks the turn). PUSH
         the replacement instead of skipping, through the same seam as a normal commit, so the
         story-compiler record carries what the player actually read. The #198 parseResponse
         throw makes new empty commits impossible; this covers the reroll of any turn already
         in that state. */
      logTranscript("gm",clean.trim(),resp,undefined,{refusal:_rrRefusal});
    }
    if(!_rrRefusal&&typeof personDriftDetect==="function")personDriftDetect(clean,false);/* #172: a reroll REPLACES the canonical narration, so its PERSON is what the campaign now carries — judge the replacement, exactly as the phase watcher does; #197: refusals are meta-voice, never judged */
    if(!_rrRefusal&&typeof clockPhaseDetect==="function")clockPhaseDetect(clean);/* #158: rerolls REPLACE canonical narration but apply NO tags at all ("no muts" above) — so a replacement that asserts a phase has no same-response tag heal, and the nudge is the only channel. Detect on the replacement CLEAN prose. */
    var story=document.getElementById("story-narrative");
    if(story){var nars=story.querySelectorAll(".msg.narrator");if(nars.length)nars[nars.length-1].parentNode.removeChild(nars[nars.length-1]);}
    /* #106b: a re-roll re-narrates the SAME turn and never re-runs applyMuts, so the moment is
       unchanged — take the stamp off the existing transcript entry (same entry the speaker pass
       below uses) rather than re-reading the clock. */
    var _rrEnt=worldState.transcript[worldState.transcript.length-1];
    var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn,ck:(_rrEnt?_rrEnt.ck:null)});/* escProse: escape model output before it hits the story DOM (audit E11) */
    narrateWithSpeakers(clean,resp,narEl,_rrEnt,worldState.transcript);/* #96; #177: owning array rides along */
    saveAll();
    generateActions(narEl);
  }catch(e){
    th.remove();sessionLog.push(prevU,prevA); // restore the original exchange on failure
    if(typeof reportError==="function")reportError("reroll",e.message,(e&&e.stack)||"");
    addMsg("system","Re-roll error: "+e.message);
  }
  busy=false;document.getElementById("sendbtn").disabled=false;
}
function _attachGMErrorUI(em,retryFn,msg){
  var isAuth=/invalid.{0,10}key|api.{0,6}key|authentication_error|401|permission_denied/i.test(msg);
  if(isAuth){
    var kw=document.createElement("div");kw.style.cssText="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;";
    var ki=document.createElement("input");ki.type="password";ki.placeholder="Paste new API key…";ki.autocomplete="one-time-code";
    ki.style.cssText="flex:1;min-width:200px;padding:5px 8px;font-family:var(--font);font-size:12px;background:var(--bg2);border:1px solid var(--acc);border-radius:var(--r);color:var(--t0);outline:none;";
    var kb=document.createElement("button");kb.className="qa";kb.textContent="Update & Retry";
    kb.onclick=function(){
      var k=ki.value.trim();if(!k)return;
      // Write the ACTIVE provider's key slot — callGM reads providerKeys[activeProvider] first,
      // so writing only apiKey/AKK left the stale key winning and retry failing forever (audit #10).
      apiKey=k;providerKeys[activeProvider]=k;
      if(typeof saveProviderSettings==="function")saveProviderSettings();
      try{localStorage.setItem(AKK,k);}catch(x){}
      em.remove();
      busy=false;document.getElementById("sendbtn").disabled=false;
      if(typeof retryFn==="function")retryFn();
    };
    ki.addEventListener("keydown",function(e){if(e.key==="Enter")kb.click();});
    kw.appendChild(ki);kw.appendChild(kb);em.appendChild(kw);
    ki.focus();
    return true;
  }else{
    em.style.display="inline-block";em.style.maxWidth="100%"; // shrink the error bubble to its text width
    var rb=document.createElement("button");rb.className="qa";rb.textContent="Retry";rb.onclick=retryFn;
    rb.style.cssText="display:block;width:100%;box-sizing:border-box;margin-top:8px;text-align:center;"; // button drops below the text, matched to its width -> solid block
    em.appendChild(rb);
    return false;
  }
}
function validateBlueprint(bp){
  if(!bp||typeof bp!=="object")return"Not a valid blueprint file.";
  if(bp.format!=="tnd-blueprint-v1"&&bp.format!=="tnd-campaign-v1")return"Unrecognised blueprint format.";
  if(!bp.name)return"Blueprint has no name.";
  if(!bp.premise&&(!bp.acts||!bp.acts.length))return"Blueprint has no premise or acts.";
  if(bp.acts){
    var i,j;for(i=0;i<bp.acts.length;i++){
      var a=bp.acts[i];if(!a.title||!a.goal)return"Act "+(i+1)+" is missing a title or goal.";
      if(!a.arcs||!a.arcs.length)return"Act "+(i+1)+" has no arcs.";
      for(j=0;j<a.arcs.length;j++){if(!a.arcs[j].title||!a.arcs[j].objective)return"Act "+(i+1)+", arc "+(j+1)+" is missing a title or objective.";}
    }
  }
  if(bp.creatures){var ci;for(ci=0;ci<bp.creatures.length;ci++){if(!bp.creatures[ci].name)return"Creature "+(ci+1)+" is missing a name.";}}
  for(var ni=0;ni<(bp.npcs||[]).length;ni++){
    var ns=bp.npcs[ni];if(!ns||!ns.secret)continue;
    if(typeof ns.secret!=="string"||!validRevealAct(ns.revealAct,bp.acts))return "NPC \""+(ns.name||ni+1)+"\" secret needs a reveal act number from 1 to "+(bp.acts||[]).length+". It stays withheld until a valid act opens.";
  }
  // #192 — custom classes + the curated availability roster. Every refusal is LOUD and names
  // the class: this data becomes character-progression canon when the engine consumes it, and
  // a malformed class discovered at level-up would be far worse than a refused save.
  if(bp.customClasses&&bp.customClasses.length){
    var cci,seenCC={};
    for(cci=0;cci<bp.customClasses.length;cci++){
      var cc=bp.customClasses[cci],who="Custom class "+(cci+1);
      if(!cc||typeof cc!=="object")return who+" is not an object.";
      if(!cc.name)return who+" is missing a name.";
      who="Custom class \""+cc.name+"\"";
      if(cc.name.indexOf("|")>=0)return who+" — names are identity keys and cannot contain \"|\".";
      if(classDef(cc.name))return who+" duplicates a base class — rename it.";
      if(seenCC[cc.name.toLowerCase()])return who+" is defined twice.";
      seenCC[cc.name.toLowerCase()]=1;
      if(CUSTOM_CLASS_HIT_DICE.indexOf(cc.hd)<0)return who+" needs a hit die of 6, 8, 10, or 12.";
      if(CUSTOM_CLASS_STATS.indexOf(cc.prime)<0)return who+" needs a prime stat (STR/DEX/CON/INT/WIS/CHA).";
      var sp=cc.statPriority||[],spi;
      if(sp.length!==6)return who+" — stat priority must list all six stats, best first.";
      for(spi=0;spi<6;spi++){if(sp.indexOf(CUSTOM_CLASS_STATS[spi])<0)return who+" — stat priority is missing "+CUSTOM_CLASS_STATS[spi]+".";}
      if(!cc.abilities||!cc.abilities.length)return who+" needs at least one starting ability.";
      var cai;for(cai=0;cai<cc.abilities.length;cai++){var ab=cc.abilities[cai];if(!ab||!ab.nm||!ab.ds)return who+" — starting ability "+(cai+1)+" needs both a name and an effect.";}
      var cfi;for(cfi=0;cfi<(cc.features||[]).length;cfi++){
        var ft=cc.features[cfi];
        if(!ft||!ft.nm||!ft.ds)return who+" — level feature "+(cfi+1)+" needs both a name and an effect.";
        if(typeof ft.lvl!=="number"||ft.lvl%1!==0||ft.lvl<2||ft.lvl>20)return who+" — level feature \""+ft.nm+"\" needs a level between 2 and 20.";
      }
      if(typeof SKILLS!=="undefined"){
        var ssi;for(ssi=0;ssi<(cc.skillSeeds||[]).length;ssi++){
          var seed=String(cc.skillSeeds[ssi]).toLowerCase(),seedOk=false,ski;
          for(ski=0;ski<SKILLS.length;ski++){if(SKILLS[ski].id.toLowerCase()===seed||SKILLS[ski].label.toLowerCase()===seed){seedOk=true;break;}}
          if(!seedOk)return who+" — skill seed \""+cc.skillSeeds[ssi]+"\" is not a known skill.";
        }
      }
    }
  }
  if(bp.availableClasses){
    if(!bp.availableClasses.length)return "Available-classes restriction is empty — no class could ever be picked; check at least one class or remove the restriction.";
    var avi;for(avi=0;avi<bp.availableClasses.length;avi++){
      var avn=bp.availableClasses[avi],avKnown=!!classDef(avn),avj;
      if(!avKnown&&bp.customClasses){for(avj=0;avj<bp.customClasses.length;avj++){if(bp.customClasses[avj]&&String(bp.customClasses[avj].name).toLowerCase()===String(avn).toLowerCase()){avKnown=true;break;}}}
      if(!avKnown)return "Available class \""+avn+"\" is neither a base class nor a custom class in this blueprint.";
    }
  }
  return null;
}
// ── Blueprint Designer §5.1 (D1/D1b) — the load-time normalizer ────────────────
// One canonical shape: format "tnd-blueprint-v1" with author + tone always present.
// Accepts the legacy "tnd-campaign-v1" format string, repairs invalid tone ids
// ("high_fantasy" → "high"), and defaults every collection so the editor and
// round-trip (R5.3) never meet a missing field. Runs at EVERY blueprint entry
// point (file import, cloud library, _applyBlueprint choke point). Mutates and
// returns bp — callers keep their reference.
function normalizeToneId(t){
  if(!t)return "";
  var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===t)return t;}
  var norm=String(t).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  for(i=0;i<TONES.length;i++){if(TONES[i].id===norm)return TONES[i].id;}
  for(i=0;i<TONES.length;i++){if(TONES[i].nm.toLowerCase()===norm)return TONES[i].id;}
  var first=norm.split(" ")[0];
  for(i=0;i<TONES.length;i++){if(TONES[i].id===first)return TONES[i].id;}
  for(i=0;i<TONES.length;i++){if(TONES[i].nm.toLowerCase().indexOf(norm)===0)return TONES[i].id;}
  return "";
}
function normalizeBlueprint(bp){
  if(!bp||typeof bp!=="object")return bp;
  if(bp.format==="tnd-campaign-v1")bp.format="tnd-blueprint-v1";
  if(typeof bp.author!=="string")bp.author="";
  bp.tone=normalizeToneId(bp.tone);
  if(typeof bp.proseAuthor!=="string")bp.proseAuthor="";
  if(typeof bp.narratorVoice!=="string")bp.narratorVoice=""; // #9 — authored Piper narrator voice id ("" = player's own)
  if(typeof bp.premise!=="string")bp.premise=bp.premise==null?"":String(bp.premise);
  if(typeof bp.startingLocation!=="string")bp.startingLocation="";
  if(typeof bp.startingRegion!=="string")bp.startingRegion="";
  if(!Array.isArray(bp.acts))bp.acts=[];
  // Every act needs an arcs array (audit E19) — applyBlueprint iterates act.arcs unconditionally,
  // and the cloud-library path skips validateBlueprint, so a missing arcs crashed startGame.
  for(var _ai=0;_ai<bp.acts.length;_ai++){if(bp.acts[_ai]&&!Array.isArray(bp.acts[_ai].arcs))bp.acts[_ai].arcs=[];}
  if(!Array.isArray(bp.npcs))bp.npcs=[];
  bp.npcs.forEach(function(n){if(n&&typeof n.revealAct==="string"&&/^\d+$/.test(n.revealAct.trim()))n.revealAct=Number(n.revealAct);});
  if(!Array.isArray(bp.locations))bp.locations=[];
  if(!Array.isArray(bp.rules))bp.rules=[];
  if(!Array.isArray(bp.creatures))bp.creatures=[]; // v1.176 — campaign bestiary
  // #227 the deep-time age ladder. ABSENT STAYS ABSENT — same reasoning as availableClasses
  // below: a blueprint that never declared world ages must not grow an empty field on every
  // designer save, and absence is exactly what keeps every legacy blueprint's prompt
  // byte-identical (buildDeepTimeBlock is ""-clean). A ladder that normalizes to nothing
  // (all rungs nameless) is dropped rather than kept as an empty husk.
  if("deepTime" in bp){
    var _dtn=normalizeDeepTime(bp.deepTime);
    if(_dtn.length)bp.deepTime=_dtn;else delete bp.deepTime;
  }
  // #192 — campaign class roster (see the block comment above normalizeCustomClass).
  // availableClasses ABSENT means "no restriction" — never expand it to a full list here,
  // or a future base class would be silently excluded by every file that never meant to curate.
  if(!Array.isArray(bp.customClasses))bp.customClasses=[];
  for(var _cci=0;_cci<bp.customClasses.length;_cci++)normalizeCustomClass(bp.customClasses[_cci]);
  if(!Array.isArray(bp.availableClasses))delete bp.availableClasses; // null/junk shapes → absence (unrestricted) beats guessing
  else{
    var _avSeen={},_avList=[],_avi;
    for(_avi=0;_avi<bp.availableClasses.length;_avi++){
      var _avn=String(bp.availableClasses[_avi]==null?"":bp.availableClasses[_avi]).trim();
      if(_avn&&!_avSeen[_avn.toLowerCase()]){_avSeen[_avn.toLowerCase()]=1;_avList.push(_avn);}
    }
    bp.availableClasses=_avList; // an authored-empty list survives to validation, which refuses it LOUDLY
  }
  /* #315 (review C5): every prose field an author can type is capped here, at the ONE choke point every
     blueprint passes through. Short fields are untouched byte-for-byte (legacy prompts stay identical). */
  if(typeof clampStr==="function"&&typeof IMPORT_CAPS!=="undefined"){
    var _cp=IMPORT_CAPS,_ci,_cj;
    bp.premise=clampStr(bp.premise,_cp.premise);["startingLocation","startingRegion","author","name"].forEach(function(k){bp[k]=clampStr(bp[k],_cp.field);});
    for(_ci=0;_ci<bp.acts.length;_ci++){var _a=bp.acts[_ai=_ci];if(!_a)continue;["title","goal","dnaHint","desc"].forEach(function(k){_a[k]=clampStr(_a[k],_cp.field);});
      for(_cj=0;_cj<(_a.arcs||[]).length;_cj++){var _r=_a.arcs[_cj];if(_r)["title","objective","dnaHint","desc"].forEach(function(k){_r[k]=clampStr(_r[k],_cp.field);});}}
    [bp.npcs,bp.locations,bp.creatures].forEach(function(list){for(var _k=0;_k<list.length;_k++){var _o=list[_k];if(_o&&typeof _o==="object")["name","notes","secret","desc","role","status","relation","sizeNote"].forEach(function(f){_o[f]=clampStr(_o[f],_cp.field);});}});
    for(_ci=0;_ci<bp.rules.length;_ci++)bp.rules[_ci]=clampStr(bp.rules[_ci],_cp.rule);
  }
  return bp;
}
// ── #192 — blueprint class roster: custom classes + curated availability ───────
// A blueprint may carry campaign-specific classes (customClasses — the steampunk Tinkerer
// that exists nowhere else) and a curated creation roster (availableClasses). The engine
// does NOT consume either field yet: creation-screen filtering and the classDef() overlay
// are the follow-on milestone (TODO #192). Normalize/validate keep the authored data
// canonical and loudly checkable now, so the designer and the future wizard read ONE shape.
var CUSTOM_CLASS_STATS=["STR","DEX","CON","INT","WIS","CHA"];
var CUSTOM_CLASS_HIT_DICE=[6,8,10,12];
// CSV-or-array → clean array. The designer's text inputs speak CSV; the file format is
// always the array (fileOut ships whatever bp holds, so canonicalization must happen
// before the field ever rests in bp — bpFieldSet routes through this too).
function csvToList(v,upper){
  var arr=Array.isArray(v)?v:String(v==null?"":v).split(/[,;]+/);
  var out=[],i,s;
  for(i=0;i<arr.length;i++){s=String(arr[i]==null?"":arr[i]).trim();if(upper)s=s.toUpperCase();if(s)out.push(s);}
  return out;
}
function normalizeCustomClass(cc){
  if(!cc||typeof cc!=="object")return cc;
  cc.name=cc.name==null?"":String(cc.name).trim();
  cc.desc=cc.desc==null?"":String(cc.desc);
  cc.gear=cc.gear==null?"":String(cc.gear);
  cc.prime=cc.prime==null?"":String(cc.prime).trim().toUpperCase();
  if(typeof cc.hd==="string"&&/^\d+$/.test(cc.hd.trim()))cc.hd=parseInt(cc.hd,10);
  cc.statPriority=csvToList(cc.statPriority,true);
  cc.skillSeeds=csvToList(cc.skillSeeds,false);
  if(!Array.isArray(cc.abilities))cc.abilities=[];
  cc.abilities.forEach(function(a){if(a&&typeof a==="object"){a.nm=a.nm==null?"":String(a.nm);a.ds=a.ds==null?"":String(a.ds);}});
  if(!Array.isArray(cc.features))cc.features=[];
  cc.features.forEach(function(f){if(f&&typeof f==="object"){f.nm=f.nm==null?"":String(f.nm);f.ds=f.ds==null?"":String(f.ds);if(typeof f.lvl==="string"&&/^\d+$/.test(f.lvl.trim()))f.lvl=parseInt(f.lvl,10);}});
  return cc;
}
// The checkable class roster for a blueprint: every base class from the class bible first,
// then the blueprint's own custom classes in authored order. Pure — the designer's Available
// Classes checklist and (later) the creation wizard's filter both read THIS list, so the two
// surfaces can never disagree about what "all classes" means.
function blueprintClassList(bp){
  var out=[],L=classDefs(),i;
  for(i=0;i<L.length;i++)out.push({name:L[i].id,desc:L[i].desc||"",custom:false});
  var cc=(bp&&bp.customClasses)||[];
  for(i=0;i<cc.length;i++){if(cc[i]&&cc[i].name)out.push({name:cc[i].name,desc:cc[i].desc||"",custom:true});}
  return out;
}
function blueprintClassAvailable(bp,name){
  if(!bp||!Array.isArray(bp.availableClasses))return true; // absent = no restriction
  var i,n=String(name==null?"":name).toLowerCase();
  for(i=0;i<bp.availableClasses.length;i++){if(String(bp.availableClasses[i]).toLowerCase()===n)return true;}
  return false;
}
// Moved here from ui.js (v1.156) so the headless suite can exercise it — it's pure
// data logic. Packages the current campaign into a blueprint (strips per-run state:
// no character, HP/XP/gold, combat, transcript). Acts/arcs statuses reset to pending.
// D1: emits author + tone (tone reverse-mapped from worldState.tone.name).
// §5.5: NPC notes carry the FULL knowledge list (joined, capped), not just knowledge[0].
function buildBlueprintFromGame(){
  var sk=worldState.skeleton,acts=[];
  if(sk&&sk.acts&&sk.acts.length){
    var i;for(i=0;i<sk.acts.length;i++){
      var a=Object.assign({},sk.acts[i]);a.status="pending";
      a.arcs=(a.arcs||[]).map(function(arc){var _ea=Object.assign({},arc,{status:"pending"});delete _ea.startTurn;/* #23 runtime pacing clock — never author it into an exported blueprint */return _ea;});
      acts.push(a);
    }
  }
  var npcs=[];
  (worldState.npcs||[]).forEach(function(n){
    var mem=memory.npcs&&memory.npcs[n.name];
    var notes=mem?(npcAuthoredText(mem)||npcKnowledgeContext(mem).slice(0,400)):"";
    /* v1.439 (F2, brief B): role is RELATION-shaped by both authoring specs (designer + generator) —
       export the relation, never the mood the old line leaked (the same category error v1.379 fixed) */
    npcs.push({name:n.name,role:(n.rel&&n.rel!=="unknown")?n.rel:"neutral",notes:notes,pronouns:n.pronouns||mem&&mem.pronouns||"they/them"});
    var secret=npcSecretExport(mem);if(secret){npcs[npcs.length-1].secret=secret.secret;npcs[npcs.length-1].revealAct=secret.revealAct;}
  });
  var locations=[];
  if(memory.map&&memory.map.nodes){
    Object.keys(memory.map.nodes).forEach(function(key){
      if(key.indexOf("|")>=0||locIsSub(key))return; // skip sub-locations — #156B: including reparented ex-world nodes (parent relation, not key shape)
      var node=memory.map.nodes[key];
      locations.push({name:key,description:node.description||""});
    });
  }
  return {
    format:     "tnd-blueprint-v1",
    name:       worldState.campName||worldState.character.name||"Unnamed Campaign",
    author:     "",
    tone:       normalizeToneId(worldState.tone&&worldState.tone.name||""),
    proseAuthor: worldState.proseAuthor!=null?worldState.proseAuthor:"",
    narratorVoice: worldState.piperVoice!=null?worldState.piperVoice:"", // #9 — the campaign's narrator pin, not the device default

    premise:    sk&&sk.premise||"",
    acts:       acts,
    npcs:       npcs,
    locations:  locations,
    creatures:  (worldState.bestiary||[]).slice(),
    rules:      (customRules||[]).slice(),
    startingRegion:   worldState.world&&worldState.world.region||"",
    startingLocation: worldState.world&&worldState.world.location||""
  };
}
// P8 (audit): blueprint authors sometimes paste full mechanical stat blocks into NPC bios
// ("HUMAN FORM STATISTICS: AC 14 (leather armour), 52 HP. Actions: Shortbow…"). Stored
// verbatim as memory.npcs knowledge, that text re-injects (13KB for Azaka) into the
// volatile prompt whenever the NPC is mentioned, while worldState.bestiary is the intended
// single home for creature mechanics. Conservative split: only when a clear mechanical
// marker — an ALL-CAPS "…STATISTICS:" header, or a line carrying both "AC N" and "N HP" —
// appears AFTER a meaningful narrative lead-in (≥40 chars). Ambiguous bios are left
// intact: a mangled bio is worse than a fat one. Returns {bio, stats} or null (no split).
function splitNpcStatBlock(text){
  if(!text)return null;
  var s=String(text),idx=-1;
  var m=/[A-Z][A-Z'()\/,\- ]*STATISTICS\s*:/.exec(s);
  if(m)idx=m.index;
  var m2=/(^|\n)[^\n]*\bAC\s*\d+[^\n]*\b\d+\s*HP\b/.exec(s);
  if(m2){var i2=m2.index+m2[1].length;if(idx<0||i2<idx)idx=i2;}
  var m3=/(^|\n)[^\n]*\b\d+\s*HP\b[^\n]*\bAC\s*\d+/.exec(s);
  if(m3){var i3=m3.index+m3[1].length;if(idx<0||i3<idx)idx=i3;}
  if(idx<40)return null; // no marker, or no meaningful narrative before it — leave the bio intact
  var bio=s.slice(0,idx).replace(/\s+$/,"");
  var stats=s.slice(idx).replace(/^\s+/,"");
  if(!bio||!stats)return null;
  return {bio:bio,stats:stats};
}
function applyBlueprint(bp){
  /* #192: persist the class roster into worldState as COPIES (a reused bp object must never be
     able to mutate canon later); the classDefs overlay + classAvailable read these from here on,
     and both ride the sync blob like any worldState field. Absent = unrestricted / no customs. */
  if(bp.customClasses&&bp.customClasses.length)worldState.customClasses=JSON.parse(JSON.stringify(bp.customClasses));
  if(bp.availableClasses&&bp.availableClasses.length)worldState.availableClasses=bp.availableClasses.slice();
  // Skeleton — stamp act/arc status
  if(bp.acts&&bp.acts.length){
    var skel={premise:bp.premise||"",acts:bp.acts},i,j;
    for(i=0;i<skel.acts.length;i++){
      skel.acts[i].status=i===0?"active":"pending";
      var isP=!!skel.acts[i].parallel;
      if(!skel.acts[i].arcs)skel.acts[i].arcs=[]; // defensive — a raw blueprint bypassing normalizeBlueprint (audit E19)
      for(j=0;j<skel.acts[i].arcs.length;j++){var _ba=i===0&&(isP||j===0);skel.acts[i].arcs[j].status=_ba?"active":"pending";if(_ba)skel.acts[i].arcs[j].startTurn=0;/* #23 per-arc pacing clock — game begins at turn 0 */}
    }
    worldState.skeleton=skel;
  }
  // NPCs — seed into both worldState.npcs and memory.npcs
  if(bp.npcs&&bp.npcs.length){
    var ni;for(ni=0;ni<bp.npcs.length;ni++){
      var n=bp.npcs[ni];
      /* v1.439 (F2, brief B): role fans into RELATION only. The old line wrote it into status
         (mood) and attitude (disposition) too — recreating in one call the exact contamination
         v1.379-383 separated. Mood/disposition start empty; play fills them. */
      var _seedN={name:n.name,status:"",statusTurn:0,rel:n.role||"neutral",met:0,pronouns:n.pronouns||"they/them"},_seedA=(typeof seedArmor==="function")?seedArmor(n):undefined;if(_seedA!==undefined)_seedN.armor=_seedA;/* #319: the blueprint's plot-armor override rides the roster */if(n.agenda){_seedN.agenda=String(n.agenda).slice(0,160);_seedN.agendaKind=n.agendaKind||"";}/* #330: the authored want rides the roster until the sheet exists */
      worldState.npcs.push(_seedN);
      memory.npcs[n.name]={attitude:"",knowledge:n.notes?[n.notes]:[],events:[],pronouns:n.pronouns||"they/them"};
    }
  }
  // Locations — seed memory.locations (metadata only) + memory.map. The map node
  // description is the SINGLE home for the blueprint text (audit P7): it used to be
  // pushed into locations[].notes as well — byte-identical, ~43KB duplicated per ToA
  // campaign, riding every sync POST. Nothing reads locations[].notes for injection
  // (GEOGRAPHY/buildGeoBlock reads the node description); notes stay reserved for
  // runtime [LOCATION:] event notes via fileLocation.
  if(bp.locations&&bp.locations.length){
    var li;for(li=0;li<bp.locations.length;li++){
      var loc=bp.locations[li];
      if(!memory.locations[loc.name])memory.locations[loc.name]={visited:[],notes:[]};// was {visits:0} — wrong shape crashed fileLocation on first travel (audit #8)
      if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
      if(!memory.map.nodes[loc.name])memory.map.nodes[loc.name]={firstVisit:null,visits:0,description:loc.description||null,parent:null,npcs:[],items:[]};
    }
  }
  // Creatures — campaign bestiary; buildSysPrompt injects it into the STABLE prompt half
  // (campaign-constant: set once here, never mutated per turn, so it caches).
  if(bp.creatures&&bp.creatures.length)worldState.bestiary=bp.creatures;
  // P8: split mechanical stat blocks out of blueprint NPC bios — narrative stays as
  // memory knowledge, mechanics join the bestiary (single home, STABLE half so it caches).
  // Runs AFTER the creatures seed so an author-provided bestiary entry wins: if the name
  // already exists there, the bio is left whole rather than losing the stat text.
  if(bp.npcs&&bp.npcs.length){
    var si;for(si=0;si<bp.npcs.length;si++){
      var sn=bp.npcs[si];if(!sn.notes)continue;
      var sp=splitNpcStatBlock(sn.notes);if(!sp)continue;
      var dup=false,sj;
      if(worldState.bestiary){for(sj=0;sj<worldState.bestiary.length;sj++){if(String(worldState.bestiary[sj].name).toLowerCase()===String(sn.name).toLowerCase()){dup=true;break;}}}
      if(dup)continue;
      if(!worldState.bestiary)worldState.bestiary=[];
      worldState.bestiary.push({name:sn.name,kind:"npc",threat:"",notes:sp.stats});
      var mn=memory.npcs[sn.name];
      if(mn&&mn.knowledge){var ki=mn.knowledge.indexOf(sn.notes);if(ki>=0)mn.knowledge[ki]=sp.bio;}
    }
  }
  // Stat extraction precedes provenance marking so mechanics have their single bestiary home.
  for(var _an=0;_an<(bp.npcs||[]).length;_an++){
    var _am=memory.npcs[bp.npcs[_an].name];
    if(_am&&_am.knowledge&&_am.knowledge.length)fileNpcAuthored(_am,_am.knowledge[0]);
    var _seed=bp.npcs[_an];if(_seed.secret){fileNpcSecret(_am,_seed.secret,_seed.revealAct);if(!validRevealAct(_seed.revealAct,(worldState.skeleton||{}).acts))console.warn("[blueprint] "+_seed.name+": secret withheld — invalid revealAct");}
  }
  // Custom rules from the blueprint — WRAPPED as quoted data (TODO #22, v1.350): a raw push gave a
  // semi-trusted campaign file the same prompt authority as the player's own rules (an embedded
  // "ignore all other rules…" would read as OUR instruction). The wrapper keeps the rule enforced
  // but visibly provenance-marked and quoted; dedupe keys on the wrapped string so re-imports of
  // the same blueprint stay idempotent. Forward-only: rules already imported raw by older saves
  // can't be told apart from user-authored ones, so they are left as-is.
  if(bp.rules&&bp.rules.length){
    var ri;for(ri=0;ri<bp.rules.length;ri++){
      var wrapped='Blueprint rule (quoted from the campaign file): "'+bp.rules[ri]+'"';
      if(customRules.indexOf(wrapped)===-1)customRules.push(wrapped);
    }
    saveRules();
  }
  // #227 the deep-time age ladder — WRITE-ONCE at campaign start. There is deliberately no tag
  // for this, so the only writers are here and the generated skeleton: it rides the CACHED stable
  // half, and a mid-campaign write would silently kill every prompt-cache hit for the rest of the
  // campaign. It is also the point of the feature — a ceiling the GM can raise is not a ceiling.
  if(bp.deepTime&&bp.deepTime.length)worldState.deepTime=normalizeDeepTime(bp.deepTime);
  // Location + region override — blueprint is authoritative; overwrite whatever the wizard set
  if(bp.startingLocation)worldState.world.location=bp.startingLocation;
  if(bp.startingRegion)worldState.world.region=bp.startingRegion;
  // Prose voice — author's choice; player can override via Dev Mode. Only a NON-EMPTY blueprint
  // voice overrides (audit E20): normalizeBlueprint coerces an unset voice to "", and applyBlueprint
  // runs AFTER startGame set worldState.proseAuthor from the wizard pick, so a blank "" would clobber
  // the player's Step-1 choice with the house default.
  if(bp.proseAuthor){
    worldState.proseAuthor=bp.proseAuthor;
    if(typeof AUTHORS!=="undefined"){
      var _paFound=false,_pai;for(_pai=0;_pai<AUTHORS.length;_pai++){if(AUTHORS[_pai].id===bp.proseAuthor){_paFound=true;break;}}
      if(!_paFound)showToast("Blueprint voice \""+bp.proseAuthor+"\" not recognised — using default.");
    }
  }
  // Narrator voice (#9) — the AUDIO twin of the prose voice above, and it follows the same E20 rule:
  // only a non-empty authored voice pins the campaign, so a blueprint that doesn't care about
  // narration can't wipe a pin the player already made. Output config only — it is read by
  // TTS.resolvePiperVoice at speak time and never enters buildSysPrompt (drift-guarded by test).
  if(bp.narratorVoice){
    worldState.piperVoice=bp.narratorVoice;
    if(typeof TTS!=="undefined"&&TTS.voiceKnown&&!TTS.voiceKnown(bp.narratorVoice))
      showToast("Blueprint narrator voice \""+bp.narratorVoice+"\" isn't in this build's voice set — using the default narrator.");
  }
  // Store blueprint name on worldState for reference
  worldState.blueprintName=bp.name;
}
// Repair is evidence-bound: a matching author source AND a recorded original must exist.
// It adds provenance to the original, preserving both the archive and subsequent play facts.
function restoreAuthoredDossiers(bp,names){
  var result={restored:0,names:[],missing:[]},archive=(memory.archive&&memory.archive.superseded)||[];
  for(var i=0;i<(names||[]).length;i++){
    var name=names[i],seed=null,j,n=memory.npcs[resolveNpcName(name)];
    for(j=0;j<(bp.npcs||[]).length;j++)if(bp.npcs[j].name===name)seed=bp.npcs[j];
    if(!n||!seed||!seed.notes){result.missing.push(name);continue;}
    var split=splitNpcStatBlock(seed.notes),candidates=[seed.notes];if(split)candidates.push(split.bio);
    var source=null;
    for(j=0;j<archive.length;j++)if(resolveNpcName(archive[j].npc)===resolveNpcName(name)&&candidates.indexOf(archive[j].fact)>=0){source=archive[j].fact;break;}
    if(!source){result.missing.push(name);continue;}
    if(fileNpcAuthored(n,source)){result.restored++;result.names.push(name);console.info("[memory] restored authored dossier for "+name+" from superseded archive");}
  }
  return result;
}
async function generateSkeleton(statusFn){
  var c=worldState.character,w=worldState.world,t=worldState.tone;
  var _skelDNA="",_skelPaId=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:(typeof proseAuthor!=="undefined"?proseAuthor:"");
  if(_skelPaId&&typeof AUTHORS!=="undefined"){for(var _spi=0;_spi<AUTHORS.length;_spi++){if(AUTHORS[_spi].id===_skelPaId&&AUTHORS[_spi].contentDNA){_skelDNA=AUTHORS[_spi].contentDNA;break;}}}
  var prompt="Design a three-act campaign skeleton for this RPG character and setting. Output ONLY valid JSON, no markdown.\n\n"
    +"CHARACTER: "+c.name+", "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+"\n"
    +(c.trait||c.flaw||c.motivation?(c.trait?"Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+(c.motivation?" | Motivation: "+c.motivation:"")+"\n":"")
    +(c.deity?"Deity: "+c.deity+"\n":"")
    +(c.backstory?"Backstory: "+c.backstory+"\n":"")
    +"SETTING: "+w.location+", "+w.region+" | Tone: "+(t&&t.name?t.name:"Sword and Sorcery")+"\n\n"
    +(_skelDNA?"NARRATIVE DESIGN — shape the three acts and all arcs to reflect these story sensibilities (author's structural DNA, not prose style):\n"+_skelDNA+"\n\n":"")
    +"Generate a campaign with a central conflict that ties to the character's backstory and personality. The story should feel personal, not generic.\n\n"
    +"JSON format:\n"
    +'{"premise":"One paragraph: the central conflict driving the campaign",'
    // Schema + generic rules are shared fragments (campaign_generator.js, #59) — the designer's
    // ✨ Generate builds its acts on the SAME text; the assembled prompt here is byte-identical
    // to the pre-extraction original (flaw/motivation lines splice between head and tail).
    +skelActsSchema(!!_skelDNA)
    +skelDeepTimeSchema()
    +"}\n\n"
    +"RULES:\n"
    +skelRulesHead(!!_skelDNA)
    +skelDeepTimeRule()
    +(c.flaw?"- The character's flaw should be a source of tension, not just flavor\n":"")
    +(c.motivation?"- Weave the motivation into the central conflict so pursuing the plot IS pursuing the motivation\n":"- Weave the character's backstory into the central conflict so pursuing the plot IS personal\n")
    +skelRulesTail();
  var resp=await callGM(prompt,SKELETON_ARCHITECT_SYS,8192,upgradeModelFor(),{kind:"skeleton"});/* v1.249: shared escalation helper (was an inline twin) */
  var skel=JSON.parse(repairModelJson(resp)); // shared cleanup (api.js) — covered by test.html
  validateSkeletonStructure(skel);
  // ONE review pass + auto-correction (#59, v1.290) — the Blueprint Designer's reviewer
  // discipline, scoped to the skeleton schema (campaign_generator.js). Both extra calls ride
  // the "skeleton" usage bucket. A review/correction failure NEVER blocks campaign start:
  // fall back to the valid first draft, loudly (toast + console — no silent failures).
  try{
    if(statusFn)statusFn("Reviewing the campaign...");
    var findings=await reviewCampaignSkeleton(skel,upgradeModelFor(),"skeleton");
    if(findings.length){
      if(statusFn)statusFn("Refining the campaign ("+findings.length+" fix"+(findings.length===1?"":"es")+")...");
      skel=await correctCampaignSkeleton(skel,findings,upgradeModelFor(),"skeleton");
      if(typeof console!=="undefined")console.log("[skeleton review] applied "+findings.length+" fix(es)");
    }else if(typeof console!=="undefined")console.log("[skeleton review] clean — no findings");
  }catch(re){
    showToast("Campaign review failed ("+(re&&re.message?re.message:"unknown")+") — using the first draft",5000);
    if(typeof console!=="undefined")console.warn("[skeleton review] "+(re&&re.message?re.message:re));
  }
  stampSkeletonStatus(skel);
  // #227 — the freeform half of the age ladder (the #59 two-consumer pattern). A model that
  // omits or mangles it must NEVER block campaign start: absence is a loud warn and the
  // campaign simply plays with no ceiling, exactly as every campaign did before this shipped.
  // The ladder lives on worldState, never inside the story spine, so there is ONE home for it
  // and buildSkeletonBlock stays untouched.
  var _dtGen=normalizeDeepTime(skel.deepTime);
  if(_dtGen.length)worldState.deepTime=_dtGen;
  else if(typeof console!=="undefined")console.warn("[skeleton] no usable deepTime age ladder generated — campaign starts with no age ceiling (#227)");
  delete skel.deepTime;
  worldState.skeleton=skel;saveCore();
}
async function beginAdventure(){
  busy=true;document.getElementById("sendbtn").disabled=true;var th=addMsg("thinking","The world stirs...");
  var _openingCommitted=false;/* E82 latch for the opening — set by commitGmTurn's onMutated below */
  try{
    var c=worldState.character,w=worldState.world;
    var compNpcs=(worldState.npcs||[]).filter(function(n){return n.partyMember;});
    var compStr="";if(compNpcs.length){var cds=compNpcs.map(function(n){var s=n.charSheet;return n.name+(s?" ("+pronounsForGender(s.gender)+", "+s.cls+(s.archetypeNm?" ["+s.archetypeNm+"]":"")+", Lv"+s.level+")":"");});compStr=" They travel with companions: "+cds.join(", ")+". Use each companion's stated pronouns; never reassign a companion's gender. Introduce the full party together in the opening scene.";}
    var intro="Open the adventure at "+w.location+", "+w.region+", at "+worldTimeDisplay()+". "+c.name+" is a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+"."+(c.trait?" Trait: "+c.trait+".":"")+(c.flaw?" Flaw: "+c.flaw+".":"")+(c.motivation?" Wants: "+c.motivation+".":"")+(c.backstory?" Backstory: "+c.backstory:"")+compStr+" Write a vivid 3-5 sentence opening. Give rich sensory detail. Plant an immediate hook. Do not end with suggested actions or a 'You could' line — action buttons are handled separately.";
    var resp=await callGM(intro);th.remove();
    // Unified commit (audit 07-16 #5): inherits sendAction's canonical UA6 order — transcript/
    // sessionLog/state now persist BEFORE the opening scene renders, so a display throw can no
    // longer strand a saved state that lacks the opening narration. isOpening: no turn++.
    commitGmTurn(resp,{userMsg:intro,isOpening:true,onMutated:function(){_openingCommitted=true;/* E82 latch for the opening (user ruling 2026-07-16) */}});
    if(typeof showFirstTurnOverlay==="function")showFirstTurnOverlay();/* #307: four sentences, once per device, after the first scene is on screen */
    syncUI();
    _promptCampaignFolder();
  }catch(e){th.remove();
    if(_openingCommitted){
      // E82 for the opening (user ruling 2026-07-16, surfaced by audit #5): the opening's tags
      // already landed and persisted (UA6 order) — a Retry would re-run the whole opening call
      // and double-apply them (double starting gold, duplicate NPCs). No Retry offered; the
      // persisted transcript replays the scene on reload.
      addMsg("system","Opening scene hit an error after your world was saved ("+e.message+") — reload to replay the scene. (Retry disabled: it would double-apply the opening.)");
      if(typeof carNotify==="function")carNotify("error","Opening failed — reload to continue");
    }else{
      var em=addMsg("system","Failed to start: "+e.message);if(typeof carNotify==="function")carNotify("error","Failed to start — tap to retry");if(_attachGMErrorUI(em,beginAdventure,e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}
    }}
  busy=false;document.getElementById("sendbtn").disabled=false;
}
function _promptCampaignFolder(){
  if(!window.showDirectoryPicker)return;  // browser doesn't support it
  if(typeof _campFolderHandle!=="undefined"&&_campFolderHandle)return;  // already set
  if(localStorage.getItem("tnd_folder_declined_v1"))return;  // user previously dismissed
  var banner=document.createElement("div");
  banner.style.cssText="position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--bg1);border:1px solid var(--acc);border-radius:var(--r);padding:12px 16px;z-index:500;display:flex;align-items:center;gap:12px;font-size:13px;font-family:var(--font);color:var(--t1);box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:420px;width:90%;";
  banner.innerHTML="<span>📁 Set a campaign folder to keep saves, renders, and logs organized?</span>"
    +"<button id='folder-yes' style='padding:6px 14px;font-size:12px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:#000;cursor:pointer;white-space:nowrap;'>Set folder</button>"
    +"<button id='folder-no' style='padding:6px 10px;font-size:12px;font-family:var(--font);background:none;border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;white-space:nowrap;'>Not now</button>";
  document.body.appendChild(banner);
  document.getElementById("folder-yes").addEventListener("click",function(){banner.remove();setCampaignFolder();});
  document.getElementById("folder-no").addEventListener("click",function(){banner.remove();localStorage.setItem("tnd_folder_declined_v1","1");});
}
var _rendering=false;
// #165: the scene-render REQUEST builder, extracted pure for engine tests. The field failure
// (2026-08-11): the old "3-4 sentences" party budget forced FIVE characters into triage — the
// writer compressed Daeris to "human cleric", dropping her gender, and Flux painted its default
// (male) cleric. Same mechanism as the retired STYLE sentence cap: hard counts make the model
// cram and drop. The party budget is now a PER-CHARACTER FLOOR (one full sentence each, scene
// after), and the spell-out line demands gender explicitly so compression can never shed it.
function buildSceneRenderRequest(c,party,w){
  var gw=genderWord(c.gender);/* #11③: shared mapping (local renamed — the old `var genderWord` would shadow the helper) */
  var charDesc=c.name+", a "+gw+" "+c.age+" "+c.ancestry+" "+c.cls+", "+c.appear+(c.mark?", "+c.mark:"");
  var compDescs=[],pi;
  for(pi=0;pi<party.length;pi++){
    var pcs=party[pi].charSheet;
    var pg=genderWord(pcs.gender);/* #11③: shared mapping */
    var pd=party[pi].name+", a "+pg+(pcs.age?" "+pcs.age:"")+" "+(pcs.ancestry||"")+" "+(pcs.cls||"")+(pcs.appear?", "+pcs.appear:"")+(pcs.mark?", "+pcs.mark:"");
    compDescs.push(pd.replace(/\s+/g," ").trim());
  }
  var hasParty=compDescs.length>0;
  return "Write a detailed image generation prompt for the current scene"
    +(hasParty?", portraying the whole adventuring party together in one composition":"")+". "
    +"Protagonist (describe exactly as written, do not invent appearance): "+charDesc+". "
    +(hasParty?"Party members also present — include every one, describe each exactly as written, do not invent appearance: "+compDescs.join("; ")+". ":"")
    +"Spell out each character's gender, hair colour, eye colour, skin tone, clothing and visible gear explicitly — never omit or change a character's stated gender. "
    +"Scene: "+w.location+", "+w.region+", "+worldTimeDisplay()+", "+w.weather+". "
    +(hasParty?"All "+(compDescs.length+1)+" party members must be present and individually recognizable in the scene. ":"")
    +"Freeze the scene's CURRENT action at its most dramatic instant — mid-motion, never the calm after it. "
    /* Abstract dynamism ("natural, dynamic poses") renders as a polite tableau — image models act
       on CONCRETE craft vocabulary. Owner report t2084: four full-length figures standing in a
       row despite the old directive. Per-character pose clauses + hard variety constraints +
       one named camera/motion sentence are the working levers. */
    /* Owner directive (t2084 follow-up): comic-book COMPOSITION/POSING vocabulary — scoped away
       from the art style on purpose, so renders gain splash-page energy without going cel-shaded. */
    +"Comic-book splash-panel composition and posing: dramatic foreshortening, exaggerated action angles, bodies cutting across the frame on diagonals — while the ART STYLE below stays painterly, never cel-shaded or inked. "
    +"POSE every character by what they are doing in the scene right now — give each a specific mid-action body position (mid-swing, lunging, bracing, twisting to look, hauling, diving); NO two characters in the same stance, at least one seen from behind or in profile, at least one large in the foreground partially cropped by the frame; never a static front-facing line-up or posed group portrait. "
    /* Owner follow-up: scattered gazes read as separate figures sharing a canvas — converging
       eye-lines are what bind a composition into ONE event. The writer must NAME the focal point
       and aim every gaze at it; the one sanctioned exception must still serve the same scene. */
    /* #209d (practitioner synthesis, 2026-08-21): the old "nobody looks at the camera" clause was
       the most-converged FAILURE phrasing in the research — a negation (which every model family
       ignores) that also injects the token "camera" (which invites the very thing it forbids;
       the Grok arm's protagonist glared straight into the lens). Positive candid framing is the
       working replacement, and the directive now teaches the never-negate rule to the writer. */
    +"EYE-LINES: name the scene's single FOCAL POINT — the threat, the discovery, the speaker — and aim every character's gaze, face and body orientation at it. Every figure is CANDID — absorbed in the scene, unaware of being observed. Write orientation POSITIVELY: never a negation ('not looking at the camera' both fails as a negation and summons the camera). "
    /* #209 (the five-way field read, 2026-08-21): gaze WORDS are the weakest lever image models
       have — three of four written gazes aimed at the stairs and the renders still scattered.
       Two working levers: an ANCHORED facing phrase closing every pose clause (concrete craft
       vocabulary, the t2084 lesson again), and BODY ORIENTATION as the enforceable floor — models
       obey torso lines far more reliably than pupils. The one-exception allowance survives but
       the exception's BODY still squares to the focal point. */
    +"END every character's pose clause with an explicit facing phrase that NAMES the focal point ('eyes locked on the stair-summit', 'squared toward the breach') — never an unanchored gaze. BODY ORIENTATION IS THE FLOOR: even where a head turns away, the torso and stance still angle toward the focal point, and the clause says so. At most one character may look elsewhere, and only with a stated reason that serves the same scene (guarding a flank, spotting a second danger) — that character's body still points at the focal point. "
    /* #209f (owner art direction 2026-08-22, the Storval Stairs render): of four figures the ONE
       that read correctly was seen fully from behind — face completely hidden. A visible face is
       not a goal, and the multiSeed reference legend quietly biases the writer toward showing
       every face so the likeness "lands"; this licence releases that. Positive phrasing per the
       #209d never-negate rule — it licenses the strong choice rather than forbidding faces. */
    +"FACES ARE OPTIONAL: a character seen fully from behind — face completely hidden — is often the STRONGEST orientation read in the frame; identity still carries through hair, silhouette, build, and gear, so a referenced likeness may keep its face hidden. Choose each character's view angle for the scene's geometry and the focal point, never to guarantee a visible face. "
    /* #209b (A/B-validated on the live scene, 2026-08-21 — nano_v2_viewangle vs the control):
       the two levers that actually moved the render were STAGING GEOMETRY (focal point deeper in
       frame than every figure) and CAMERA-RELATIVE VIEW ANGLES per character — view-angle
       vocabulary ('three-quarter rear view') steers bodies where gaze words never did; the
       previously-astray cleric converged completely once 'seen from behind at the flank'
       replaced 'her gaze fixed upward'. The formation-vector arm helped torsos but not gazes. */
    +"STAGE THE GEOMETRY IN ONE OPENING SENTENCE before any character: the focal point sits DEEPER IN FRAME than every figure, with the camera low behind or beside the group ('the X rises deep in the frame beyond every figure; the camera sits low behind the party'), so that orientation follows from staging. Then give each character a CAMERA-RELATIVE VIEW ANGLE inside their pose clause — 'seen in three-quarter rear view', 'seen from behind at the flank', 'in full profile facing the X' — view-angle words steer bodies far more reliably than gaze words. "
    /* #209c (research synthesis, 2026-08-21): text encoders concentrate a concept in one or two
       tokens and propagate poorly across mentions — a pronoun binds to nothing and a synonym
       mints a SECOND concept (the five-way's own prompt said staircase/stairs/stairway/steps/
       terraces and scattered). One name, repeated verbatim, binds every clause to one target. */
    +"NAME THE FOCAL POINT ONCE and repeat that EXACT name in every character's facing phrase — never a pronoun ('it', 'them'), never a synonym (staircase does not become steps or terraces): one repeated name is what binds all four clauses to one target. "
    /* #209d: implied motion orients a body more reliably than static facing words (convergent
       practice — 'walking away toward the gate' is the community's rear-view idiom of choice). */
    +"Prefer MOTION VERBS aimed at the named focal point over static facing words — 'striding toward the X', 'driving up the X', 'leaning into the X' — a body in motion toward a target is oriented by construction. "
    /* #209e (the adversarially-verified gaze deep-research, 2026-08-21): gaze is a RELATION
       clause — the weakest measured instruction class (~1-in-5 fail at the top end) — and the
       only single-prompt mitigation is dual-channel redundancy (TextGaze: head and eyes are
       separately-describable axes). And the booru ontology's trap transfers: 'eye contact' is
       trained as MUTUAL gaze — in a group scene it turns characters toward EACH OTHER. */
    +"Write gaze in TWO CHANNELS per character — head and eyes as separate statements ('head turned toward the X, eyes fixed on the X'): stating both is the working mitigation for the least-obeyed instruction class. Never write 'eye contact' when characters should watch the focal point — it means MUTUAL gaze and turns them toward each other; reserve it for a deliberate two-character beat. "
    +"Style: dark fantasy concept art, dramatic high-contrast cinematic lighting — strong directional key light, warm rim-light, deep shadows, moody atmospheric colour grading, rich painterly texture. "
    +"End with ONE camera-and-motion sentence naming a specific angle and framing (low-angle close shot, over-the-shoulder, dutch tilt, worm's-eye) plus a motion cue (blade streaking, sparks flying, cloth and hair in motion). "
    +(hasParty?"Give EVERY character ONE full sentence of physical description before any scene detail — never compress a character to a bare role noun — then that character's pose clause, then 1-2 sentences for the environment":"3-4 sentences including the protagonist's specific mid-action pose")+". Output ONLY the prompt, no game tags.";
}
// #165: portrait-seed selection as DATA — a model's img2img entry declares multiSeed (Nano, Grok)
// and gets the companions' portraits; single-reference APIs (Flux family, Qwen) get the player
// only. Replaces the hardcoded isNano check that silently starved Grok's 3-reference capability.
// #166: returns {urls,names,omitted} — names align with urls so the reference LEGEND can tell
// the compositor which face belongs to which character (Grok received 3 anonymous refs for 4
// described characters and guessed; Daeris's likeness averaged away). maxSeeds (table data)
// caps at COLLECTION so the legend always matches what is actually sent; over-cap and
// portrait-less members land in `omitted` and are declared described-only.
function collectRenderSeeds(mdlCfg,character,party){
  var urls=[],names=[],omitted=[],pj;
  /* #208 ② (owner ruling 2026-09-01): a PARTY scene seeds references only on an engine that
     declares img2img.partyRefs (Nano Banana 2 — the five-way champion). Everywhere else the
     party renders text-only: a single-reference model's solo-portrait seed collapses the
     party to one figure, and Grok's compositor painted its seeded faces twice while dropping
     the described-only member. Solo scenes (no companions) keep every engine's own seeding. */
  if(party&&party.length&&!(mdlCfg&&mdlCfg.img2img&&mdlCfg.img2img.partyRefs))return {urls:[],names:[],omitted:[],textOnly:true};
  if(character.portrait){urls.push(character.portrait);names.push(character.name||"the protagonist");}
  var multi=!!(mdlCfg&&mdlCfg.img2img&&mdlCfg.img2img.multiSeed);
  var cap=(multi&&mdlCfg.img2img.maxSeeds)?mdlCfg.img2img.maxSeeds:Infinity;
  for(pj=0;pj<party.length;pj++){
    var cpo=multi?npcPortrait(party[pj]):null;
    if(cpo&&urls.length<cap){urls.push(cpo);names.push(party[pj].name);}
    else if(multi)omitted.push(party[pj].name);
  }
  return {urls:urls,names:names,omitted:omitted};
}
// #166: the numbered reference legend appended to a multiSeed image prompt — the mapping the
// compositor otherwise has to guess. Unseeded members are named described-only so the model
// neither hunts for a missing reference nor borrows a wrong one.
function buildSeedLegend(names,omitted){
  var parts=[],i;
  for(i=0;i<names.length;i++)parts.push("Reference image "+(i+1)+" is "+names[i]);
  var s=" "+parts.join("; ")+" — match each named character's face, colouring and build to their numbered reference EXACTLY.";
  /* #209c (vendor-documented: Gemini-family references carry POSE/composition signal, not just
     identity — four front-facing bust portraits are four "face the camera" votes against the
     scene's staging). Reassign the references to identity ONLY; orientation stays with the text. */
  s+=" Use the reference images for face, colouring and build ONLY — every figure's pose, body orientation and gaze follow the WRITTEN description, never the reference portrait's pose.";
  if(omitted&&omitted.length)s+=" "+omitted.join(", ")+" has no reference image — paint them strictly from their written description.";
  /* #208 ①: the exact-count clause — a reference mints a body AND its description mints a body
     unless the prompt says one-body-per-face outright (Grok painted both seeded companions twice). */
  var total=names.length+((omitted&&omitted.length)||0);
  s+=" The scene contains EXACTLY "+total+" "+(total===1?"person":"people")+": one body per named character, never the same face twice"+(omitted&&omitted.length?"; described-only names must still appear":"")+".";
  return s;
}
async function doRender(){
  if(!worldState||_rendering)return;_rendering=true;var th=addMsg("thinking","Composing scene...");
  try{
    var c=worldState.character,w=worldState.world;
    var party=livingPartyCompanions();
    var rp=buildSceneRenderRequest(c,party,w);
    var resp=await callGM(rp,"You are an image prompt writer for a dark fantasy RPG. Output ONLY the image generation prompt. Describe EVERY listed character's exact physical appearance with full specificity — gender, colouring, build — never invent or alter them. No narration, no tags.");
    th.remove();
    var div=addMsg("render-out","");
    div.style.whiteSpace="normal";div.style.fontFamily="inherit";
    var imageUrl="",promptShown=false,sceneImg=null;

    // Hidden prompt panel
    var promptDiv=document.createElement("div");
    promptDiv.style.cssText="display:none;font-size:11px;color:var(--t2);line-height:1.6;margin-bottom:8px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--brd);white-space:pre-wrap;font-family:var(--font-mono);word-break:break-word;";
    promptDiv.textContent=resp;
    div.appendChild(promptDiv);

    // Utility toolbar
    var toolbar=document.createElement("div");
    toolbar.style.cssText="display:flex;gap:4px;margin-bottom:8px;";
    function mkBtn(label,title){
      var b=document.createElement("button");b.title=title;b.textContent=label;
      b.style.cssText="height:26px;padding:0 9px;font-size:11px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--t1);cursor:pointer;";
      b.addEventListener("mouseover",function(){b.style.background="var(--bg3)";});
      b.addEventListener("mouseout",function(){b.style.background="var(--bg2)";});
      return b;
    }
    // #30: one funnel — share sheet (the only route to the phone's Photos app) → campaign folder
    // → download. The click is the user gesture a lapsed folder permission needs, so the re-grant
    // prompt can only happen from here. The turn is stamped now, since the pointer is what lets a
    // later load re-attach this image to THIS narration frame.
    var saveBtn=mkBtn("↓ Save","Save image (Photos on a phone, campaign folder on desktop)");
    saveBtn.addEventListener("click",function(){
      if(!imageUrl)return;
      var _rt=worldState?worldState.turn:0;
      fetch(imageUrl).then(function(r){return r.blob();}).then(function(blob){
        var fname=buildFilename("render");
        if(typeof saveRenderImage==="function")return saveRenderImage(blob,fname,_rt);
        return exportToFolder("render",blob,fname);
      }).catch(function(){window.open(imageUrl,"_blank");});
    });
    // ✨ Enhance: second img2img pass over the FINISHED render — a hard cinematic relight/regrade
    // (Flux img2img at ENHANCE_STRENGTH), reusing the scene prompt so content stays coherent. This is
    // what an aggressive editor does to buy drama Nano's flat compositor pass lacks. Replaces in place;
    // Save/Portrait then act on the enhanced image. Re-runnable (each pass re-grades the current image).
    var enhanceBtn=mkBtn("✨ Enhance","Cinematic relight & regrade of this image");
    enhanceBtn.addEventListener("click",function(){
      if(!imageUrl){showToast("Image not ready yet.");return;}
      if(!falAvailable()){showToast("Sign in or set a fal.ai key first.");return;}
      enhanceBtn.textContent="Enhancing…";enhanceBtn.disabled=true;
      var ep=withImgStyle(resp)+" "+ENHANCE_DIRECTIVE;
      falFetch("fal-ai/flux/dev/image-to-image",{prompt:ep,image_url:imageUrl,strength:ENHANCE_STRENGTH,num_inference_steps:28,num_images:1})
        .then(function(r){if(!r.ok)return r.text().catch(function(){return "";}).then(function(t){throw new Error(falErrorMsg(r.status,t));});return r.json();})/* #163b */
        .then(function(d){
          if(!(d.images&&d.images[0]&&d.images[0].url))throw new Error("No image returned.");
          imageUrl=d.images[0].url;if(sceneImg)sceneImg.src=imageUrl;
          enhanceBtn.textContent="✨ Enhance";enhanceBtn.disabled=false;
        })
        .catch(function(e){enhanceBtn.textContent="✨ Enhance";enhanceBtn.disabled=false;showToast("Enhance failed: "+e.message);});
    });
    var portraitBtn=mkBtn("⧉ Portrait","Use this scene as character portrait");
    portraitBtn.addEventListener("click",function(){
      if(!imageUrl){showToast("Image not ready yet.");return;}
      portraitBtn.textContent="Saving…";portraitBtn.disabled=true;
      fetch(imageUrl).then(function(r){return r.blob();}).then(function(blob){
        var fr=new FileReader();
        fr.onload=function(e2){compressPortrait(e2.target.result,function(compressed){worldState.character.portrait=compressed;storageAdapter.markPortraitDirty();saveAll();showToast("Portrait updated!");portraitBtn.textContent="⧉ Portrait";portraitBtn.disabled=false;});};
        fr.readAsDataURL(blob);
      }).catch(function(){portraitBtn.textContent="⧉ Portrait";portraitBtn.disabled=false;showToast("Could not save portrait.");});
    });
    var promptBtn=mkBtn("¶ Prompt","View / hide the image prompt");
    promptBtn.addEventListener("click",function(){
      promptShown=!promptShown;
      promptDiv.style.display=promptShown?"block":"none";
      promptBtn.style.borderColor=promptShown?"var(--acc)":"var(--brd)";
      promptBtn.style.color=promptShown?"var(--acc)":"var(--t1)";
    });
    var closeBtn=mkBtn("× Close","Remove this image");
    closeBtn.addEventListener("click",function(){div.remove();});
    toolbar.appendChild(saveBtn);toolbar.appendChild(enhanceBtn);toolbar.appendChild(portraitBtn);toolbar.appendChild(promptBtn);toolbar.appendChild(closeBtn);
    div.appendChild(toolbar);

    if(falAvailable()){
      var imgStatus=document.createElement("div");
      imgStatus.style.cssText="font-size:12px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;";
      var mdlCfg=RENDER_MODELS[0],mi2;for(mi2=0;mi2<RENDER_MODELS.length;mi2++){if(RENDER_MODELS[mi2].id===renderModel){mdlCfg=RENDER_MODELS[mi2];break;}}
      imgStatus.textContent=renderStatusText(mdlCfg,null,false,false);/* the model is named from the first frame (owner call 2026-09-03) */
      div.appendChild(imgStatus);
      try{
        /* #165: seed selection is table-driven (multiSeed on the img2img entry) — Nano AND Grok
           gather the party now; single-reference models get the player only. */
        var isMulti=!!(mdlCfg.img2img&&mdlCfg.img2img.multiSeed);
        var sc=collectRenderSeeds(mdlCfg,worldState.character,party);
        var seeds=sc.urls;
        var usingI2I=!!(seeds.length&&mdlCfg.img2img);
        /* #165: say the truth about what seeded — "portrait-seeded" alone read as "everyone's
           portrait" and the player reasonably expected companion likeness from a single-ref model.
           #166: an over-cap member is named as described-only right in the status. */
        imgStatus.textContent=renderStatusText(mdlCfg,sc,isMulti,usingI2I);/* one builder, every seed case names the model (helpers.js) */
        var falEndpoint=usingI2I?mdlCfg.img2img.endpoint:mdlCfg.id;
        var falPrompt=withImgStyle(resp);
        // Edit/compositor models (Nano, Grok) cling to the reference portraits' posed, front-facing
        // headshot framing (the "school-portrait" stiffness). Tell them the references are
        // likeness-only so everyone re-stages dynamically. Scene-render only; portrait paths stay posed.
        // #166: and NAME each numbered reference — three anonymous refs against four described
        // characters made Grok guess, and Daeris's likeness averaged away.
        if(isMulti&&seeds.length)falPrompt+=" IMPORTANT: the supplied reference image(s) define each character's facial likeness, colouring and costume ONLY — do NOT copy their frontal, posed headshot framing or stance; re-stage every figure in a NEW mid-action pose fitting the scene, no two figures in the same stance, at least one angled away from the camera."+buildSeedLegend(sc.names,sc.omitted);
        var falBody=usingI2I?mdlCfg.img2img.body(falPrompt,seeds,img2imgStrength(mdlCfg)):mdlCfg.body(falPrompt);
        // Elapsed-seconds heartbeat (owner call 2026-08-31, the Seedream hang): a frozen status
        // line reads as broken long before it reads as slow — a ticking counter is what tells
        // the player the app is alive. Cleared EXPLICITLY before any terminal text is written
        // (the interval would otherwise overwrite the error a second later); the success path's
        // imgStatus.remove() is covered by the isConnected self-stop.
        var _rTick0=Date.now(),_rTickBase=imgStatus.textContent;
        var _rTick=setInterval(function(){
          if(!imgStatus.isConnected){clearInterval(_rTick);return;}
          imgStatus.textContent=_rTickBase+" "+Math.round((Date.now()-_rTick0)/1000)+"s";
        },1000);
        var falData;
        if(mdlCfg.slow){
          // #293: slow engines ride the queue lane — the status callback rewrites the ticker's
          // base text with REAL state (queue position / rendering); elapsed seconds keep ticking.
          var _rBase0=_rTickBase;
          falData=await falQueueRender(falEndpoint,falBody,function(st){_rTickBase=_rBase0+" — "+st;});
        }else{
          var falRes=await falFetch(falEndpoint,falBody);/* §3.7: own key direct, or the server's key via /api/render */
          if(!falRes.ok){clearInterval(_rTick);throw new Error(falErrorMsg(falRes.status,await falRes.text().catch(function(){return "";})));}/* #163b: surface fal's own complaint */
          falData=await falRes.json();
        }
        clearInterval(_rTick);
        if(falData.images&&falData.images[0]&&falData.images[0].url){
          imageUrl=falData.images[0].url;
          imgStatus.remove();
          var img=document.createElement("img");img.src=imageUrl;
          img.style.cssText="width:100%;border-radius:4px;display:block;";
          img.alt="Scene illustration";div.appendChild(img);sceneImg=img;
        }else{imgStatus.textContent="No image returned.";}
      }catch(fe){if(typeof _rTick!=="undefined")clearInterval(_rTick);imgStatus.textContent="Image error: "+fe.message;}
    }else{
      // No fal key — show the prompt text and a hint
      promptShown=true;promptDiv.style.display="block";
      promptBtn.style.borderColor="var(--acc)";promptBtn.style.color="var(--acc)";
      var hint=document.createElement("div");
      hint.style.cssText="font-size:11px;color:var(--t2);font-style:italic;margin-top:2px;";
      hint.textContent="Sign in (File → Account…) or set a fal.ai key (File → Render Options…) to generate images.";
      div.appendChild(hint);
    }
  }catch(e){if(th.parentNode)th.remove();addMsg("system","Render failed: "+e.message);}
  _rendering=false;
}
function restSpells(fromTag){
  if(!worldState)return 0;
  if(typeof restHealFull==="function")restHealFull();/* #300: a long rest heals the party to full — the one site, both paths */
  // #89 note: the spell-restore is GUARDED per-list rather than gating the whole function — the
  // old early return meant a spell-less character's (a Warrior's) Rest did NOTHING at all, which
  // matters now that resting also moves the clock.
  var i;
  if(worldState.character.spells){for(i=0;i<worldState.character.spells.length;i++){if(worldState.character.spells[i].lvl>0)worldState.character.spells[i].used=false;}}
  worldState.character.mana=manaMax(worldState.character);/* #110: rest is the ONE refill — the pool tops up here and nowhere else */
  // Also restore party companions' expended spells (audit E84) — a rest is party-wide.
  var pj,ps,_rsParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — no rest slots, no mana */
  for(pj=0;pj<_rsParty.length;pj++){var _pn=_rsParty[pj];if(_pn.charSheet.spells){for(ps=0;ps<_pn.charSheet.spells.length;ps++){if(_pn.charSheet.spells[ps].lvl>0)_pn.charSheet.spells[ps].used=false;}}
    _pn.charSheet.mana=manaMax(_pn.charSheet);/* #110: each pool refills from its own sheet */}
  // #89 (v1.433): an overnight rest rolls the campaign clock forward to DAWN of the next day
  // (the Day boundary IS dawn — ratified 2026-07-23; see clockSleepRoll). This is the ONE roll
  // site for both rest paths: the topbar Rest button calls here directly, and the GM's
  // [REST:long] tag handler calls restSpells() — so neither path can double-roll. The same
  // response's [TIME_ADVANCE:] tags are absorbed by the tag handler (the 28h-sleep guard).
  var _slept=(typeof clockSleepRoll==="function")?clockSleepRoll():0;
  if(typeof updateSpPanel==="function")updateSpPanel();/* typeof: the headless engine harness has no panels */
  saveCore();
  if(typeof showToast==="function")showToast(_slept?("Rested until dawn — "+clockFmt()+". Healed, mana restored."):"Healed, mana restored.");
  if(!fromTag&&typeof takeCheckpoint==="function")takeCheckpoint("rest");/* #300: the button path takes the camp now; the tag path queued it for commit */
  return _slept;
}
// #300 — the camp. Capture (state.js), then persist to BOTH transports: IndexedDB (the offline copy) and
// the server slot (PUT /api/campaigns/:id/checkpoint). Never localStorage. Fallen multiplayer PCs rejoin here.
function takeCheckpoint(reason){
  if(!worldState||campaignEnded())return null;
  var snap=checkpointCapture(reason);if(!snap)return null;
  var id=worldState.campId||"local";
  if(typeof idbPutCheckpoint==="function")idbPutCheckpoint(id,snap).catch(function(e){console.warn("[checkpoint] IndexedDB copy failed:",e&&e.message);});
  if(typeof storageAdapter!=="undefined"&&storageAdapter.putCheckpoint)storageAdapter.putCheckpoint(id,snap);
  if(typeof showToast==="function")showToast("⛺ Camp saved — "+(snap.location||"here")+" (turn "+snap.turn+")");
  if(typeof mpRejoinFallen==="function")mpRejoinFallen();
  return snap;
}
// #300 — after a reload the in-memory camp is gone: refill it from IndexedDB, else the server.
function restoreCheckpointHolder(){
  if(!worldState||checkpointHeld())return;
  var id=worldState.campId||"local";
  var fromServer=function(){if(typeof storageAdapter!=="undefined"&&storageAdapter.getCheckpoint)storageAdapter.getCheckpoint(id,function(err,snap){if(!err&&snap&&snap.ws){checkpointHold(snap);console.log("[checkpoint] camp restored from the server (turn "+snap.turn+")");}});};
  if(typeof idbGetCheckpoint==="function")idbGetCheckpoint(id).then(function(snap){if(snap&&snap.ws){checkpointHold(snap);console.log("[checkpoint] camp restored from IndexedDB (turn "+snap.turn+")");}else fromServer();}).catch(fromServer);
  else fromServer();
}
// #300 — a true death resolves here, at commit. Three respawns per campaign; the fourth ends it.
function resolvePlayerDeath(){
  var dp=worldState&&worldState.deathPending;if(!dp)return null;
  var cause=dp.cause||"slain",c=worldState.character;
  if((worldState.respawns||0)>=RESPAWNS_PER_CAMPAIGN){
    worldState.ended={turn:worldState.turn,cause:cause,at:Date.now(),deaths:(worldState.respawns||0)+1};
    delete worldState.deathPending;delete worldState.downed;worldState.combat=null;
    if(typeof fileCoreMemory==="function"&&c)fileCoreMemory("death",c.name,c.name+" died the final time — "+cause+".");
    worldState.denouementOwed=true;/* #301: no escort, no question — the GM writes the campaign's denouement */
    if(typeof saveAll==="function")saveAll();
    if(typeof document!=="undefined"&&typeof campaignDenouement==="function")setTimeout(campaignDenouement,0);
    else if(typeof showCampaignEndedModal==="function")showCampaignEndedModal(cause);
    if(typeof carNotify==="function")carNotify("ended","You have died for the last time. This story is complete.");
    return {action:"ended"};
  }
  var snap=checkpointHeld();
  if(!snap){console.warn("[death] no camp on file — nowhere to wake; the death stands until a camp exists (#300)");if(typeof showToast==="function")showToast("☠ No camp on file — nowhere to wake");return {action:"no-camp"};}
  /* #301: the escort walk sits between the death and the camp. Death arrives (a silent engine send),
     the player asks their one question, Death answers, the player walks back or onward. */
  deathSceneBegin(cause);
  return {action:"escort"};
}
function deathSceneBegin(cause){
  worldState.deathScene={stage:"arrive",cause:cause||"slain",walk:(worldState.respawns||0)+1,startTurn:worldState.turn,answer:null};
  delete worldState.deathPending;delete worldState.downed;worldState.combat=null;
  if(typeof saveAll==="function")saveAll();
  if(typeof carNotify==="function")carNotify("info","Death has come for you.");
  if(typeof document!=="undefined"&&typeof sendAction==="function")setTimeout(function(){sendAction(deathArrivalDirective(),{silent:true});},0);
}
function deathArrivalDirective(){
  var ds=worldState.deathScene||{},c=worldState.character,d=worldState.deaths||[],i,prior=[];
  for(i=0;i<d.length;i++)prior.push("t"+d[i].turn+" — "+(d[i].cause||"slain"));
  var walk=ds.walk||1,last=walk>=RESPAWNS_PER_CAMPAIGN;
  var cp=worldState.checkpoint||{};
  return "[ENGINE — DEATH ARRIVES (not a player action): "+c.name+" has just died ("+(ds.cause||"slain")+"). Narrate Death's arrival in the scene as it stands — the body, the quiet, then Death, in the voice described in the DEATH SCENE block. Death states the terms plainly, in voice: it will walk "+c.name+" back to the last camp ("+(cp.location||"the last camp")+") or onward, and on the way "+c.name+" may ask ONE question — one — and Death will answer with what the world already knows. "
    +(prior.length?"Death remembers the earlier walks ("+prior.join("; ")+") and says so, briefly. ":"This is their first walk together; Death has never walked "+c.name+" before. ")
    +(last?"This is the LAST walk Death will offer — say so plainly: the next death is the end. ":"This is walk "+walk+" of "+RESPAWNS_PER_CAMPAIGN+"; do not call it the last. ")
    +"End on Death waiting for the question. No tags, no options, no clock.]";
}
// The scene's turn boundary: after the arrival commits the next player line is the question; after the
// answer commits (the DEATH_ANSWER handler moved the stage to choose) the engine offers the two buttons.
function deathSceneAdvance(afterStage){
  var ds=worldState&&worldState.deathScene;if(!ds)return;
  if(afterStage==="arrive"&&ds.stage==="arrive")ds.stage="question";
  else if(afterStage==="answer"&&ds.stage==="answer"){ds.stage="choose";if(!ds.answer)ds.answer=null;}
}
function deathSceneChoose(choice){
  var ds=worldState&&worldState.deathScene;if(!ds)return null;
  if(choice==="onward")return {action:"confirm"};
  if(choice!=="back")return null;
  var gift=ds.answer||null,cause=ds.cause||"slain";
  var snap=checkpointHeld();if(!snap)return {action:"no-camp"};
  delete worldState.deathScene;
  var r=checkpointRestore(snap,{cause:cause});
  if(!r.ok){console.warn("[death] restore failed: "+r.reason);return {action:"failed",reason:r.reason};}
  if(gift){/* MANDATORY CANON, filed on the RESTORED world — memory came back from camp, so this lands after */
    if(typeof fileLore==="function")fileLore("Death's answer (walk "+r.respawn+"): "+gift);
    if(typeof fileCoreMemory==="function")fileCoreMemory("death-gift",worldState.character.name,"On the walk back from death, "+worldState.character.name+" asked one question and Death answered: \""+gift+"\"");
    if(worldState.respawnNote)worldState.respawnNote.gift=gift;
  }
  if(typeof saveAll==="function")saveAll();
  if(typeof rebuildNarrativeFromTranscript==="function"){try{rebuildNarrativeFromTranscript(true);}catch(e){}}
  if(typeof syncUI==="function"){try{syncUI();}catch(e){}}
  if(typeof showRespawnModal==="function")showRespawnModal(r,cause);
  if(typeof carNotify==="function")carNotify("respawn","You wake again at "+r.camp+". Respawn "+r.respawn+" of "+RESPAWNS_PER_CAMPAIGN+".");
  return {action:"respawn",turn:r.turn,camp:r.camp};
}
function deathSceneOnwardConfirm(){
  var ds=worldState&&worldState.deathScene;var cause=(ds&&ds.cause)||"slain";
  delete worldState.deathScene;
  worldState.ended={turn:worldState.turn,cause:cause+" — and walked onward with Death",at:Date.now(),deaths:(worldState.respawns||0)+1,onward:true};
  worldState.denouementOwed=true;
  if(typeof fileCoreMemory==="function")fileCoreMemory("death",worldState.character.name,worldState.character.name+" died — "+cause+" — and walked onward with Death.");
  if(typeof saveAll==="function")saveAll();
  if(typeof document!=="undefined"&&typeof campaignDenouement==="function")setTimeout(campaignDenouement,0);
  return {action:"ended"};
}
// #301: the denouement — asked of the GM (a plain sysOverride call, no history), filed as the campaign's last
// GM entry and its final chapter. Owed until it lands: a failed call leaves denouementOwed set and boot retries.
async function campaignDenouement(){
  if(!worldState||!worldState.denouementOwed||busy)return;
  busy=true;
  try{
    var text=await callGM(buildDenouementPrompt(),denouementSys(),1500,null,{kind:"other",noHistory:true});/* #325: the living-hero variant when the spine ended the tale */
    fileDenouement(String(text||"").trim());
    if(typeof addMsg==="function")addMsg("narrator",escHtml(String(text||"").trim()).replace(/\n/g,"<br>"));
    if(typeof showCampaignEndedModal==="function")showCampaignEndedModal(worldState.ended&&worldState.ended.cause);
  }catch(e){console.warn("[denouement] not written yet — will retry at next boot:",e&&e.message);if(typeof showToast==="function")showToast("The denouement could not be written yet — it will be tried again next time");}
  finally{busy=false;}
}
// #325: the player's answer to the offered ending. "write" closes the campaign exactly like the fourth
// death (ended + denouementOwed → campaignDenouement writes the epilogue from the record, the living-
// hero variant); "play" snoozes the offer for ENDING_REOFFER_TURNS. Pure over state; the DOM modal calls it.
function endingDecide(choice){
  if(!worldState||!worldState.spineComplete||(typeof campaignEnded==="function"&&campaignEnded()))return null;
  if(choice==="write"){
    worldState.ended={turn:worldState.turn,cause:"the tale is told",at:Date.now(),spine:true,deaths:(worldState.respawns||0)};
    worldState.denouementOwed=true;worldState.lastActions=null;
    if(typeof saveAll==="function")saveAll();
    if(typeof document!=="undefined"&&typeof campaignDenouement==="function")setTimeout(campaignDenouement,0);
    return {action:"ended"};
  }
  worldState.spineComplete.snoozedUntil=worldState.turn+((typeof ENDING_REOFFER_TURNS==="number")?ENDING_REOFFER_TURNS:15);
  if(typeof saveAll==="function")saveAll();
  return {action:"play"};
}
function fileDenouement(text){
  if(!worldState)return;
  var t=String(text||"").trim();if(!t)return;
  if(typeof logTranscript==="function")logTranscript("gm",t,t,undefined,{denouement:true});
  if(memory){if(!memory.chapters)memory.chapters=[];memory.chapters.push({turn:worldState.turn,summary:"DENOUEMENT: "+t.slice(0,600)});}
  delete worldState.denouementOwed;
  if(!worldState.ended)worldState.ended={turn:worldState.turn,cause:"the story closed",at:Date.now()};
  if(typeof saveAll==="function")saveAll();
}
// #300 multiplayer — death is personal. A fallen PC companion is parked with its sheet; the party
// continues; at the next camp they rejoin whole.
function mpFallPC(name,cause){
  var n=wsNpcByName(name);if(!n||!n.charSheet)return false;
  if(!worldState.mpFallen)worldState.mpFallen=[];
  worldState.mpFallen.push({name:n.name,sheet:JSON.parse(JSON.stringify(n.charSheet)),turn:worldState.turn,cause:cause||""});
  n.dead=worldState.turn;n.status="dead";if(memory.npcs&&memory.npcs[n.name])memory.npcs[n.name].dead=worldState.turn;
  if(typeof showToast==="function")showToast("☠ "+n.name+" has fallen — they rejoin at the next camp");
  return true;
}
function mpRejoinFallen(){
  var f=worldState&&worldState.mpFallen;if(!f||!f.length)return 0;var k=0;
  while(f.length){var rec=f.shift();var n=wsNpcByName(rec.name);if(!n)continue;
    delete n.dead;n.status="alive";n.charSheet=rec.sheet;n.charSheet.hp=n.charSheet.maxHp;
    if(memory.npcs&&memory.npcs[n.name])delete memory.npcs[n.name].dead;
    if(typeof fileCoreMemory==="function")fileCoreMemory("death",n.name,n.name+" fell"+(rec.cause?" to "+rec.cause:"")+" and returned to the party at camp.");k++;}
  delete worldState.mpFallen;
  if(k&&typeof showToast==="function")showToast("⛺ "+k+" fallen companion"+(k>1?"s":"")+" rejoin at camp");
  return k;
}
function initAbilities(){
  if(!worldState)return;var c=worldState.character;
  if(!c.abilities||!c.abilities.length){
    var abs=[],i,anc=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].nm===c.ancestry||ANCS[i].id===c.ancestry){anc=ANCS[i];break;}}
    if(anc&&anc.subraces&&c.subrace){for(i=0;i<anc.subraces.length;i++){if(anc.subraces[i].id===c.subrace){var rlbl2=c.ancestry==="Half-Blood"?"[Racial] One parent trait":"[Racial] "+anc.subraces[i].nm;var rdesc2=anc.subraces[i].desc;if(c.heritageVariant&&anc.subraces[i].lineages){var rlk2;for(rlk2=0;rlk2<anc.subraces[i].lineages.length;rlk2++){if(anc.subraces[i].lineages[rlk2].id===c.heritageVariant){rdesc2=anc.subraces[i].lineages[rlk2].desc;break;}}}abs.push({nm:rlbl2,ds:rdesc2,gained:0});break;}}}
    var st=(classDef(c.cls)||{}).abilities||[];for(i=0;i<st.length;i++)abs.push({nm:st[i].nm,ds:st[i].ds,gained:0});/* C6 ② */
    c.abilities=abs;}
  updateAbPanel(false);
}
// #101: THE spell-grant — appends what's missing from a list, deduped by capBaseName so a
// legacy parenthetical label ("Fire Bolt (d10 fire, 120ft)") and its bare twin ("Fire Bolt")
// are the same spell. Existing entries (and their used flags) are never touched.
function grantSpellsFromList(c,list,lvl){
  if(!list||!list.length)return;
  if(!c.spells)c.spells=[];
  var i,have={};
  for(i=0;i<c.spells.length;i++)have[capBaseName(c.spells[i].nm)]=1;
  for(i=0;i<list.length;i++){
    var b=capBaseName(list[i]);
    if(!have[b]){c.spells.push({nm:list[i],lvl:lvl,used:false});have[b]=1;}
  }
}
function initSpells(){
  if(!worldState)return;var c=worldState.character;
  if(!c.spells||!c.spells.length){
    var src=SPELLS[c.cls]||(c.archetype?ARCH_SPELLS[c.archetype]:null);
    if(src){var sl,maxSlot=c.level>=5?3:c.level>=3?2:1;grantSpellsFromList(c,src.cantrips,0);for(sl=1;sl<=maxSlot;sl++)grantSpellsFromList(c,src[sl],sl);}}
  updateSpPanel();
}
// #50a (v1.274, user-ratified "allow both directions, loud"): the sync audit may now emit item
// CORRECTIONS — the missed-consumption class (4 blasting charges surviving their own detonation)
// and the missed-pickup class (the P3-F4 oilcloth bundle) were permanently unrepairable under the
// old blanket prohibition. Anti-double-spend is prompt-side (correct DISCREPANCIES only — the
// sheet shown to the GM is current truth) + the loud engine-side trail: syncCharSheet diffs every
// inventory around applyMuts and toasts each correction, so a wrong one is visible and revertable
// via the Sync modal. XP/HP/GOLD stay forbidden — the audit has no discrepancy basis for those.
function buildSheetSyncPrompt(companions){
  var compLine=companions.length?"Party members to also audit: "+companions.join(", ")+". For each use COMPANION_ prefixed tags: [COMPANION_RELATIONSHIP_BOND:Name|entity|durable bond] [COMPANION_RELATIONSHIP_DYNAMIC:Name|entity|current dynamic] and their axis-specific REMOVED forms; [COMPANION_CONDITION:Name|cond|dur] [COMPANION_CONDITION_REMOVED:Name|cond] [COMPANION_ALIGNMENT:Name|law+1] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item].":"";
  return "[GM SHEET SYNC — internal, not a player action] Audit ALL character sheets against events in this session. "
    +"Emit ONLY state tags — zero prose, zero narration, zero 'You could' line. "
    +"For the player — allowed tags: [RELATIONSHIP_BOND:entity|durable bond] [RELATIONSHIP_DYNAMIC:entity|current dynamic] and their axis-specific REMOVED forms; [CONDITION:name|duration] [CONDITION_REMOVED:name] "
    +"[NPC:name|status|relation] [QUEST:title|status] [ALIGNMENT:law+1] (or law-1/good+1/good-1) [ITEM_GAINED:name] [ITEM_LOST:name]. "
    +compLine+" "
    +"ITEM tags are DISCREPANCY CORRECTIONS ONLY, and finding item discrepancies is a core duty of this audit: go item by item — emit [ITEM_LOST:] for anything the story shows spent, sold, or taken that the sheet still lists, and [ITEM_GAINED:] for anything the story clearly shows acquired that is MISSING from the sheet (a story-established item absent from the sheet is exactly the error you exist to repair — repair it). The prohibition runs ONE way only: never re-emit a gain or loss the sheet ALREADY reflects, because that double-applies it. "
    +"Close a quest ONLY if this session's events unambiguously show it finished — never on inference or partial progress; a legitimate close carries its rewards as normal. "/* P4-F1 resolution (user: keep) — sync closes pay like any close, this line guards the hallucinated-close edge */
    +"Do NOT emit XP, HP, or GOLD tags — those are tracked turn-by-turn. "
    +"Only emit tags for things that have actually changed or are genuinely missing. "
    +"If nothing needs updating, reply with a single period only.";
}
// #229 (owner request 2026-08-24): the Suggest-completion review prompt — PURE and engine-tested
// (the buildSheetSyncPrompt precedent). Enumerates ONE quest with per-objective checked state so
// the GM judges strictly against committed story; the response routes through applyMuts (the one
// parser — [QUEST_STEP:]/[QUEST:completed]/reward tags land exactly like any turn's), and the
// surviving prose is the explanation the decisions modal renders. Returns null for a title that
// is not a live ACTIVE quest.
function buildQuestSuggestPrompt(title){
  if(!worldState||!worldState.questLog)return null;
  var q=null,i;for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].title===title&&worldState.questLog[i].status==="active"){q=worldState.questLog[i];break;}}
  if(!q)return null;
  var objLines="";var oj;var obs=q.objectives||[];
  for(oj=0;oj<obs.length;oj++){objLines+="  ["+(obs[oj].done?"x":" ")+"] "+obs[oj].text+(obs[oj].optional?" (optional)":"")+"\n";}
  if(!objLines)objLines="  (no objectives recorded)\n";
  return "[GM QUEST COMPLETION REVIEW — internal, not a player action] Review the quest \""+q.title+"\""+(q.desc?" — "+q.desc:"")+"\n"
    +"Objectives as recorded:\n"+objLines
    +"Judge STRICTLY from events that have ALREADY happened in the story — never invent, assume, or advance anything. "
    +"For each UNCHECKED objective whose outcome the story has already achieved or made irrelevant, emit [QUEST_STEP:"+q.title+"|<objective text verbatim>|true]. "
    +"If every required objective is (or becomes) checked AND the quest's own end condition — the outcome its description promises — has genuinely occurred on-screen, emit [QUEST:"+q.title+"|completed] together with its rewards ([XP:]/[GOLD:]/[ITEM_GAINED:]); otherwise do NOT complete it. "
    +"Then, as plain prose, briefly explain each decision — one short sentence per objective, including why anything was LEFT unchecked. If nothing qualifies, emit no tags and explain why not. "
    /* #321 (owner report 2026-09-03, The Descent): the model reasoned "completed" and emitted no tags — the
       verdict is now STRUCTURED and the engine writes the tags from it (questReviewSynthesize). */
    +"FINALLY, on their own lines: one line \"DONE: <objective text verbatim>\" for each objective the story has already achieved, then exactly one line \"VERDICT: COMPLETED\" or \"VERDICT: NOT YET\". These lines are required even when you also emitted the tags.";
}
// #321: the review's verdict → tags. The model's prose said "formally completed" while the tag lane
// stayed empty (gemini, The Descent, t60s) — the decision was made and nothing applied. Pure: reads the
// DONE:/VERDICT: lines, appends the tags they imply when absent ([QUEST_STEP:|true] for a DONE line
// matching an UNCHECKED objective; [QUEST:title|completed] for VERDICT: COMPLETED), never doubles a tag
// the model already emitted, and strips the marker lines so the explanation reads as prose. Rewards are
// deterministic downstream (#302 milestone XP on completion). Returns {text, synthesized:[...]}.
function _reEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function questReviewSynthesize(resp,title){
  var text=String(resp||""),out={text:text,synthesized:[]};if(!worldState||!worldState.questLog)return out;
  var q=null,i;for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].title===title&&worldState.questLog[i].status==="active"){q=worldState.questLog[i];break;}}
  if(!q)return out;
  var lines=text.split(/\r?\n/),keep=[],done=[],verdict=null,m;
  for(i=0;i<lines.length;i++){var ln=lines[i].trim();
    if((m=ln.match(/^DONE:\s*(.+)$/i))){done.push(m[1].trim());continue;}
    if((m=ln.match(/^VERDICT:\s*(COMPLETED|NOT YET|NOT COMPLETED|INCOMPLETE)\b/i))){verdict=/^COMPLETED$/i.test(m[1])?"completed":"not yet";continue;}
    keep.push(lines[i]);}
  text=keep.join("\n");
  var obs=q.objectives||[],j,add=[],tEsc=_reEsc(title);
  for(i=0;i<done.length;i++){var d=done[i].toLowerCase();
    for(j=0;j<obs.length;j++){var ot=String(obs[j].text||"");if(obs[j].done||!ot)continue;var ol=ot.toLowerCase();
      if(ol===d||ol.indexOf(d)>=0||d.indexOf(ol)>=0){
        if(!new RegExp("\\[QUEST_STEP:"+tEsc+"\\|"+_reEsc(ot)+"\\|(?:true|done|1|yes|x)\\]","i").test(text)){add.push("[QUEST_STEP:"+title+"|"+ot+"|true]");out.synthesized.push("step: "+ot);}
        break;}}}
  if(verdict==="completed"&&!new RegExp("\\[QUEST:"+tEsc+"\\|(?:completed?|done|finished)","i").test(text)){add.push("[QUEST:"+title+"|completed]");out.synthesized.push("completed");}
  if(add.length){text=text.replace(/\s+$/,"")+"\n"+add.join("");if(typeof console!=="undefined")console.warn("[review] #321 verdict synthesized into tags for \""+title+"\": "+out.synthesized.join(", "));}
  out.text=text;return out;
}
// #230 (owner request 2026-08-24, the Cleaver/greed-ring class): player-initiated "Define item" —
// an item's nature narrated in old prose is exactly what the GM later misremembers (t2316:
// "Cleaver was forged to bind" when the CURVED RUNEBLADE binds). The fix is the EXISTING
// [ITEM_DEF:] → player-confirm → ITEM CANON pipeline (#81 — injected authoritatively every turn),
// entered from a sheet button instead of waiting for the GM to volunteer a def. PURE builder
// (the buildSheetSyncPrompt precedent); returns null when the ask is meaningless: item already
// canon (write-once — the handler would ignore the def), already pending (the confirm modal is
// the next step, not another call), or carried by nobody.
function buildItemDefinePrompt(rawItem){
  if(!worldState||!worldState.character)return null;
  var key=typeof itemBaseName==="function"?itemBaseName(rawItem):"";
  if(!key)return null;
  /* #285 (f18): the gate is the SHARED itemDefEligible predicate — canon-less items AND
     classification-only curated BASE entries (organize-only, never inject, nature still drifts)
     are eligible; overlay/alias/effect-bearing entries refuse as before. */
  if(typeof itemDefEligible==="function"){if(!itemDefEligible(rawItem))return null;}
  else if(typeof itemLookup==="function"&&itemLookup(rawItem))return null;/* satellite fallback: old gate */
  var pend=worldState.pendingItemDefs||[],pi;
  for(pi=0;pi<pend.length;pi++)if(pend[pi].key===key)return null;/* awaiting confirmation already */
  var carried=(worldState.character.inventory||[]).indexOf(rawItem)>=0;
  if(!carried&&typeof livingPartyCompanions==="function"){var _pc=livingPartyCompanions(),ci;
    for(ci=0;ci<_pc.length&&!carried;ci++){if(_pc[ci].charSheet&&(_pc[ci].charSheet.inventory||[]).indexOf(rawItem)>=0)carried=true;}}
  if(!carried)return null;/* the def is TYPE canon, but the entry point is a carried item's row */
  var _shadowBase=(typeof ITEM_BIBLE!=="undefined"&&ITEM_BIBLE[key])||null;/* #285: eligibility already proved it classification-only when present */
  var _opening=_shadowBase
    ?"The carried item \""+rawItem+"\" has only an organize-only catalog entry (no mechanics — it never reaches ITEM CANON injection). The curated entry classifies it as \""+_shadowBase.category+"\" with value "+_shadowBase.value+"; keep those unless the story contradicts them — your definition REPLACES that entry wholesale once the player accepts. "
    :"The carried item \""+rawItem+"\" has no entry in ITEM CANON. ";
  return "[GM ITEM CANON REVIEW — internal, not a player action] "+_opening
    +"Review what the story has ALREADY ESTABLISHED about it — how it was found, what it visibly did, what identification or use revealed — and capture that as canon. "
    +"Emit exactly one [ITEM_DEF:"+key+"|category=...|effect=...|uses=...|value=...] (category one of weapon/armor/consumable/tool/quest/treasure/mundane; '=' per field, '|' between fields; effect free of '|' and ']'; \"N/A\" where truly inapplicable; TYPE definition only — never instance state like charges left or provenance). "
    +"Ground every word in committed story: never invent powers, numbers, or lore the narrative has not shown. If the story has established nothing mechanical yet, emit NO tag and say so in one sentence. "
    +"After the tag, one short sentence naming which scene(s) the definition comes from.";
}
function _itemDefProposalFor(resp,key){
  var re=/\[ITEM_DEF:([^\]|]+)\|[^\]]*\]/g,m;
  while((m=re.exec(String(resp||"")))){
    var proposed=typeof itemBaseName==="function"?itemBaseName(m[1]):String(m[1]).replace(/^\s+|\s+$/g,"").toLowerCase();
    if(proposed===key)return true;
  }
  return false;
}
// #230 async caller — the #229 review-call shape: busy-gated, escalated model, response through
// the ONE parser (the ITEM_DEF handler queues the proposal; cap/dedupe/write-once all apply),
// then the EXISTING #81 confirm modal is surfaced — the player stays the gate.
async function defineItemFromStory(rawItem,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  if(busy||!worldState)return;
  var key=typeof itemBaseName==="function"?itemBaseName(rawItem):"";
  // Already awaiting confirmation? Skip the call — just reopen the confirm modal (free).
  var pend=worldState.pendingItemDefs||[],pi;
  for(pi=0;pi<pend.length;pi++)if(pend[pi].key===key){var _cs0=document.getElementById("cs-modal");if(_cs0)_cs0.remove();if(typeof showItemDefConfirmModal==="function")showItemDefConfirmModal();return;}
  var queueWasFull=pend.length>=5;
  var auditMsg=buildItemDefinePrompt(rawItem);
  if(!auditMsg){if(typeof showToast==="function")showToast("Already canon (or not carried): "+rawItem);return;}
  busy=true;
  if(typeof showToast==="function")showToast("📖 Consulting the story about: "+rawItem+"…");
  try{
    var resp=await callGM(auditMsg,null,500,upgradeModelFor(),{kind:"sync"});
    applyMuts(resp,{allow:REVIEW_CALL_TAGS});/* #264: a Define hallucination must not move the party or touch canon outside the item class */
    saveAll();
    var landed=false;pend=worldState.pendingItemDefs||[];
    for(pi=0;pi<pend.length;pi++)if(pend[pi].key===key)landed=true;
    if(landed){
      var _cs=document.getElementById("cs-modal");if(_cs)_cs.remove();/* the confirm modal must not fight the sheet for the screen */
      if(typeof showItemDefConfirmModal==="function")showItemDefConfirmModal();
    }else if(queueWasFull&&_itemDefProposalFor(resp,key)){
      if(typeof showToast==="function")showToast("canon was proposed but the confirm queue is full — answer the pending item proposals first.",6000);
    }else{
      var why=cleanTxt(resp).trim();
      if(typeof showToast==="function")showToast("No canon proposed"+(why?" — "+(why.length>140?why.slice(0,140)+"…":why):" (the story has established nothing mechanical yet)"),6000);
    }
  }catch(e){
    if(typeof showToast==="function")showToast("Item review failed: "+(e.message||"unknown error"));
  }
  busy=false;
}
// The async caller (syncCharSheet pattern): busy-gated, escalated model (a sloppy review WRITES
// wrong quest state), applyMuts on the result, then the decisions modal. UI-side rendering
// (showQuestDecisionsModal) lives in ui-modals.js.
async function suggestQuestCompletion(title){
  if(busy||!worldState)return;
  var auditMsg=buildQuestSuggestPrompt(title);
  if(!auditMsg){if(typeof showToast==="function")showToast("Quest not found or not active: "+title);return;}
  busy=true;
  if(typeof showToast==="function")showToast("Reviewing quest: "+title+"…");
  try{
    var resp=await callGM(auditMsg,null,700,upgradeModelFor(),{kind:"sync"});
    var _qs=questReviewSynthesize(resp,title);resp=_qs.text;/* #321: the verdict lines become the tags the model forgot */
    var R=applyMuts(resp,{allow:REVIEW_CALL_TAGS});/* the one parser — reopen guards, #205b, reward parsing all apply; #264: quest/item/reward whitelist, everything else strips loudly */
    saveAll();if(typeof syncUI==="function")syncUI();
    var explanation=cleanTxt(resp);
    var changed=(R&&R.muts)?R.muts.slice():[];
    if(_qs.synthesized.length)changed.push("engine wrote the tags from the GM's verdict: "+_qs.synthesized.join(", "));/* #321: loud, attributable */
    if(typeof showQuestDecisionsModal==="function")showQuestDecisionsModal(title,changed,explanation);
    else if(typeof showToast==="function")showToast(changed.length?("Review applied: "+changed.join("; ")):"Review: no changes.");
  }catch(e){
    if(typeof showToast==="function")showToast("Quest review failed: "+(e.message||"unknown error"));
  }
  busy=false;
}
// Pure inventory diff for the loud correction trail (engine-tested): human-readable lines for
// items added/removed between two snapshots. Order-insensitive, count-aware.
function invDiffLines(before,after){
  function tally(list){var m={},i;for(i=0;i<(list||[]).length;i++){m[list[i]]=(m[list[i]]||0)+1;}return m;}
  var b=tally(before),a=tally(after),out=[],k;
  for(k in a){if((a[k]||0)>(b[k]||0))out.push("+"+k+((a[k]-(b[k]||0))>1?" x"+(a[k]-(b[k]||0)):""));}
  for(k in b){if((b[k]||0)>(a[k]||0))out.push("−"+k+((b[k]-(a[k]||0))>1?" x"+(b[k]-(a[k]||0)):""));}
  return out;
}
async function syncCharSheet(){
  if(busy||!worldState)return;
  busy=true;
  if(typeof showToast==="function")showToast("Syncing sheet…");
  var companions=[];var pi,_syParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — the sheet audit no longer enumerates them */
  for(pi=0;pi<_syParty.length;pi++)companions.push(_syParty[pi].name);
  var auditMsg=buildSheetSyncPrompt(companions);
  try{
    // v1.250 (user decree: "syncSheet fights drift. Always fight drift."): the audit RESULT
    // mutates sheets through applyMuts — a sloppy audit WRITES wrong state — so this call
    // escalates to the provider's upgradeModel like the skeleton and suggestions do. The
    // Daeris test showed Haiku ignores even the targeted cleanup instructions.
    var resp=await callGM(auditMsg,null,500,upgradeModelFor(),{kind:"sync"});
    // #50a loud trail: snapshot every inventory, diff after applyMuts, toast each correction.
    var invBefore={player:(worldState.character.inventory||[]).slice()};
    var ci,_ivParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): matches the living-only companions list above */
    for(ci=0;ci<_ivParty.length;ci++)invBefore[_ivParty[ci].name]=(_ivParty[ci].charSheet.inventory||[]).slice();
    applyMuts(resp);/* #40: deliberately NO detectCoreMoments here — a sheet-sync correction is bookkeeping, not a story moment */
    var who;for(who in invBefore){
      var nowInv=who==="player"?worldState.character.inventory:(function(){var i2;for(i2=0;i2<worldState.npcs.length;i2++){if(worldState.npcs[i2].name===who&&worldState.npcs[i2].charSheet)return worldState.npcs[i2].charSheet.inventory;}return [];})();
      var dl=invDiffLines(invBefore[who],nowInv),di;
      for(di=0;di<dl.length;di++){if(typeof showToast==="function")showToast("Sync correction ("+(who==="player"?worldState.character.name:who)+"): "+dl[di]);}
    }
    saveAll();
    if(typeof showToast==="function")showToast("Sheet synced.");
    var ex=document.getElementById("cs-modal");if(ex)ex.remove();
    if(typeof showCharSheet==="function")showCharSheet();
  }catch(e){
    if(typeof showToast==="function")showToast("Sync failed: "+(e.message||"unknown error"));
  }
  busy=false;
}
function newGame(){
  if(busy){if(typeof showToast==="function")showToast("Finish the current turn first.");return;}// audit E23
  var modal=document.createElement("div");modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML='<div style="background:#181818;border:1px solid #6a2020;border-radius:10px;padding:28px 24px;max-width:340px;width:90%;text-align:center;"><p style="font-size:16px;color:var(--t0);margin-bottom:8px;">Start a new campaign?</p><p style="font-size:13px;color:var(--t2);margin-bottom:24px;">Your current playthrough will be saved and can be resumed from Campaigns.</p><div style="display:flex;gap:10px;"><button id="ng-cancel" style="flex:1;padding:10px;font-family:var(--font);background:#222;border:1px solid #444;border-radius:6px;color:var(--t1);cursor:pointer;">Cancel</button><button id="ng-go" style="flex:1;padding:10px;font-family:var(--font);background:#6a2020;border:1px solid #8b2a2a;border-radius:6px;color:var(--t0);cursor:pointer;font-weight:bold;">New game</button></div></div>';
  document.body.appendChild(modal);
  document.getElementById("ng-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("ng-go").addEventListener("click",function(){
    modal.remove();
    if(!snapshotActiveCamp())return;/* B4: storage full — don't wipe the only local copy of the current campaign */
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    var nid=newCampaignId();setActiveCampId(nid);
    worldState=null;sessionLog=[];memory=blankMemory();
    pendingCompanions=[];
    document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
    showChar();
    if(typeof consumeHomeQuickStart==="function"&&consumeHomeQuickStart())return;/* #307 */
    if(typeof consumeHomeBlueprint==="function")consumeHomeBlueprint();/* #290 */
  });
}
