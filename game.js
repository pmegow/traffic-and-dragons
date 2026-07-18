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
  worldState={ver:10,campId:getActiveCampId(),campName:char._campName||char.name,legacyCharsUsed:[],pendingLegacy:null,character:char,world:{location:char._startLoc||"The Crossroads of Ashenveil",region:"The Blighted Reach",time:"dusk",weather:"cold wind carrying ash",threat:"low",sublocation:null},tone:{name:toneName||"Sword and Sorcery",voice:toneVoice||""},npcs:[],questLog:[],eventHistory:[],combat:null,turn:0,transcript:[],actStartTurn:0};
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
  saveAll();showGame();syncUI();initAbilities();initSpells();
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
 +"Ignore the STYLE directive for this call. Output ONLY a valid JSON array of 3 strings, each under 10 words. No prose, no markdown, no backticks.";
function buildSuggestionSys(){
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
  return {stable:s.stable+(rf||""),volatile:s.volatile+SUGGESTION_MODE_BLOCK+mpPov};
}
// The last 5 player/GM exchanges as labeled pairs (the ragRetrieve excerpt convention), oldest
// first, GM halves tag-stripped, under a ~6k char budget — five lavish prose turns can't balloon
// the call; under pressure the window degrades 4→3→2 but the NEWEST pair always survives.
function suggestionHistoryPairs(){
  var out=[],chars=0,i;
  for(i=sessionLog.length-1;i>=0&&out.length<5;i--){
    if(sessionLog[i].role!=="assistant")continue;
    var gm=cleanTxt(sessionLog[i].content);
    var pl=(i>0&&sessionLog[i-1].role==="user")?sessionLog[i-1].content:"";
    var block=(pl?"Player: "+pl+"\n":"")+"GM: "+gm;
    if(out.length>0&&chars+block.length>6000)break;
    out.unshift(block);chars+=block.length;
  }
  return out.join("\n\n");
}
// Tolerant array parse: the full-context prompt is prose-flavored, so accept a fenced or
// prose-wrapped array too. Anything else throws into generateActions' quiet-removal path.
function parseSuggestionArray(resp){
  var txt=stripCodeFences(resp);
  try{return JSON.parse(txt);}catch(e){var m=txt.match(/\[[\s\S]*\]/);if(!m)throw e;return JSON.parse(m[0]);}
}
async function generateActions(msgEl){
  var btnDiv=document.createElement("div");
  btnDiv.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
  var btns=[],i;
  for(i=0;i<3;i++){var b=document.createElement("button");b.className="qa";b.textContent="…";b.disabled=true;b.style.minWidth="80px";btnDiv.appendChild(b);btns.push(b);}
  msgEl.appendChild(btnDiv);
  worldState.lastActions=null; // clear now (audit E26) — if this call fails, reload won't re-attach the PREVIOUS turn's buttons to the newest narration
  var turnAt=worldState.turn; // race guard: a fast next action can land while this call is in flight
  function _cleanup(){for(var _c=0;_c<3;_c++){if(btns[_c].parentNode)btns[_c].parentNode.removeChild(btns[_c]);}if(btnDiv.parentNode)btnDiv.parentNode.removeChild(btnDiv);}
  try{
    // v1.288 un-starve: the full gameplay system prompt (stable byte-identical → cache read;
    // SUGGESTION MODE appended to volatile) + the last 5 exchanges as labeled pairs. noHistory
    // stays true — the window IS the history, at a bounded cost. Runs on the ACTIVE model (null
    // override): caches are model-scoped, an escalated model would pay full freight. See the
    // block comment above the suggestion helpers for the whole incident history.
    var resp=await callGM("RECENT SCENES (oldest first — the LAST one is the current moment):\n"+suggestionHistoryPairs()+"\n\nSuggest exactly 3 short actions the player could take next. Output ONLY a JSON array of 3 strings, each under 10 words.",buildSuggestionSys(),200,null,{noHistory:true,kind:"actions"});
    if(worldState.turn!==turnAt)throw new Error("stale"); // a newer turn landed; discard quietly
    var acts=parseSuggestionArray(resp);
    if(!acts||!acts.length){_cleanup();return;}/* remove the "…" placeholders on an empty result too (audit E25) */
    /* TODO #1 P3 (D4): in a multi-PC round, label whose options these are. Display prefix ONLY —
       data-action stays the bare action (the queue line re-attaches the name at submit). */
    var _mpPfx=(typeof playerCount==="function"&&playerCount()>1&&activePlayer()&&activePlayer().name)?activePlayer().name+": ":"";
    for(i=0;i<3&&i<acts.length;i++){var a=acts[i].trim();btns[i].textContent=_mpPfx+a;btns[i].setAttribute("data-action",a);btns[i].setAttribute("title","Tap to edit · hold or Ctrl-click to send");btns[i].setAttribute("onclick","sendSuggestedAction(this,event)");btns[i].disabled=false;}
    // saveAll (not saveCore): this async call finishes AFTER the turn's debounced sync fires,
    // so a local-only save left the server blob holding the PREVIOUS turn's buttons — device B
    // rendered stale actions while the text matched. saveAll re-arms the debounce with the
    // fresh lastActions (one cheap extra POST at most).
    worldState.lastActions=acts.slice(0,3);saveAll();
  }catch(e){console.warn("[actions] suggestion call failed — buttons removed (deliberately quiet in the UI; the turn itself succeeded):",e.message);if(typeof reportError==="function")reportError("actions",e.message,(e&&e.stack)||"");_cleanup();}
}
function buildActionButtons(acts){
  if(!acts||!acts.length)return"";
  var h='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">',i;
  for(i=0;i<acts.length;i++){var _ea=escHtml(acts[i]);h+='<button class="qa" title="Tap to edit · hold or Ctrl-click to send" onclick="sendSuggestedAction(this,event)" data-action="'+_ea+'">'+_ea+'</button>';}/* escape model-authored action text (audit E81) */
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
  // Capture the FULL identity so the legacy NPC is portrayed consistently — same person, gender,
  // relationships and gear as in their own tale (fixes #18: Ammut forgot his wives + got mis-gendered).
  worldState.pendingLegacy={
    name:pick.name,gender:pick.gender||"",cls:pick.cls||"",ancestry:pick.subraceNm||pick.ancestry||"",
    level:pick.level||1,age:pick.age||"",appear:pick.appear||"",mark:pick.mark||"",
    backstory:pick.backstory||"",trait:pick.trait||"",flaw:pick.flaw||"",motivation:pick.motivation||"",
    alignment:pick.actualAlignment||pick.statedAlignment||"",deity:pick.deity||"",
    relationships:(pick.relationships||[]).slice(0,8),inventory:(pick.inventory||[]).slice(0,12),
    queuedAt:worldState.turn};
  saveCore();
  if(typeof showToast==="function")showToast("☠ A familiar face approaches...");
}
// audit E1: a single big [XP:] can cross several levels at once (an act reward, or a
// low-level char handed a large award). The old one-shot form granted HP once, only the
// TOP level's feature, and fired at most one modal — so a 1→10 jump skipped Lv2-9 features,
// most HP, and the archetype. Loop per level like checkCompanionLevelUp already does, then
// queue the modals owed across the whole span (archetype first, then each stat bump).
var _levelBumpsOwed=0; // stat bumps owed from a multi-level jump; drained by sbConfirm
function checkLevelUp(){
  if(!worldState)return;var c=worldState.character,newLvl=getLvl(c.xp);if(newLvl<=c.level)return;
  var oldLvl=c.level,i,cls=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===c.cls){cls=CLSS[i];break;}}
  if(!c.abilities)c.abilities=[];
  var totalHp=0,bumpsOwed=0,newFeatures=[];
  while(c.level<newLvl){
    c.level++;
    var conMod=c.stats&&typeof c.stats.CON==="number"?Math.floor((c.stats.CON-10)/2):0;
    var hpGain=cls?hpGainPerLevel(cls.hd,conMod):3;/* #11②: shared formula (unknown-class fallback 3 unchanged) */
    c.maxHp+=hpGain;c.hp+=hpGain;totalHp+=hpGain;
    var features=CLASS_FEATURES[c.cls]||{};
    if(features[c.level]){c.abilities.push({nm:"Lv"+c.level,ds:features[c.level],gained:worldState.turn});newFeatures.push(features[c.level]);}
    if(STAT_BUMP_LEVELS.indexOf(c.level)>=0)bumpsOwed++;
  }
  addMsg("system","Level up! "+oldLvl+" -> "+newLvl+" | HP +"+totalHp+" (now "+c.maxHp+")");
  if(typeof Sound!=="undefined")Sound.play("levelup");
  for(i=0;i<newFeatures.length;i++)addMsg("narrator","<p><em>"+newFeatures[i]+"</em></p>");
  if(newFeatures.length)updateAbPanel(true);
  _levelBumpsOwed+=bumpsOwed;
  if(oldLvl<3&&newLvl>=3&&!c.archetype)showArchetypeModal(); // archetype first; pickArchetype then drains the bump queue
  else maybeShowLevelBump();
}
// Show the next owed stat-bump modal, if any. Called after the archetype pick and after each
// bump confirm so a jump that crosses both level 4 and 8 presents both, one at a time.
function maybeShowLevelBump(){if(_levelBumpsOwed>0)showStatBumpModal();}
function checkCompanionLevelUp(cs){
  // Companion auto-level: HP + class features only. No archetype/stat-bump modals —
  // companions level silently; the GM narrates growth if it matters.
  if(!cs||typeof cs.xp!=="number")return;
  if(typeof cs.level!=="number"||cs.level<1)cs.level=1;
  var newLvl=getLvl(cs.xp);if(newLvl<=cs.level)return;
  var oldLvl=cs.level,i,cls=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===cs.cls){cls=CLSS[i];break;}}
  while(cs.level<newLvl){
    cs.level++;
    var conMod=cs.stats&&typeof cs.stats.CON==="number"?Math.floor((cs.stats.CON-10)/2):0;
    var hpGain=cls?hpGainPerLevel(cls.hd,conMod):3;/* #11②: shared formula (unknown-class fallback 3 unchanged) */
    cs.maxHp=(cs.maxHp||0)+hpGain;cs.hp=(cs.hp||0)+hpGain;
    var features=CLASS_FEATURES[cs.cls]||{};
    if(features[cs.level]){if(!cs.abilities)cs.abilities=[];cs.abilities.push({nm:"Lv"+cs.level,ds:features[cs.level],gained:worldState?worldState.turn:0});}
  }
  addMsg("system",(cs.name||"Companion")+" levels up! "+oldLvl+" -> "+newLvl);
  showToast((cs.name||"Companion")+" reached level "+newLvl+"!");
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
  var kn=(mem.knowledge||[]).join("; ");if(kn.length>3000)kn=kn.slice(0,3000)+"…";
  if(kn)known+="Known facts: "+kn+"\n";
  var ev=(mem.events||[]).slice(-8).join("; ");if(ev.length>1500)ev=ev.slice(0,1500)+"…";
  if(ev)known+="Recent events: "+ev+"\n";
  var clsIds=[],i;for(i=0;i<CLSS.length;i++)clsIds.push(CLSS[i].id);
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
  var map=[[/necromancer|death.?mage/,"Necromancer"],[/sorcer|wizard|mage|arcanist|witch|warlock/,"Sorcerer"],[/cleric|priest|healer|acolyte|chaplain/,"Cleric"],[/druid|shaman/,"Druid"],[/paladin|knight|templar/,"Paladin"],[/berserk|barbarian/,"Berserker"],[/ranger|hunter|tracker|scout|archer/,"Ranger"],[/rogue|thief|assassin|smuggler|spy|burglar|cutpurse/,"Rogue"]],i;
  for(i=0;i<map.length;i++){if(map[i][0].test(t))return map[i][1];}
  return "Warrior";
}
// Class-baseline HP: level 1 = hit die + CON mod, then the same per-level gain the level-up
// systems use (ceil(hd/2)+1+CON mod, min 1) — keeps generated companions on the engine's curve.
function companionBaselineHp(clsId,level,conMod){
  var cls=null,i;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===clsId){cls=CLSS[i];break;}}
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
  var cls=guessCompanionClass((npc.rel||"")+" "+(npc.status||"")+" "+((mem.knowledge||[]).join(" ")));
  var gender=npc.pronouns==="she/her"?"F":npc.pronouns==="they/them"?"NB":"M";
  var hp=companionBaselineHp(cls,lvl,0);
  return {name:npcName,gender:gender,age:"adult",appear:"",mark:"",backstory:"",ancestry:"Human",subrace:null,subraceNm:null,heritageVariant:null,
    cls:cls,stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},hp:hp,maxHp:hp,gold:0,inventory:[],level:lvl,xp:XP_LEVELS[lvl-1]||0,
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
  if(typeof raw.cls==="string"){for(i=0;i<CLSS.length;i++){if(CLSS[i].id.toLowerCase()===raw.cls.trim().toLowerCase()){s.cls=CLSS[i].id;break;}}}
  if(raw.stats&&typeof raw.stats==="object"){var ks=["STR","DEX","CON","INT","WIS","CHA"];for(i=0;i<ks.length;i++){var v=parseInt(raw.stats[ks[i]]);if(!isNaN(v))s.stats[ks[i]]=Math.max(3,Math.min(20,v));}}
  if(typeof raw.gold==="number"&&raw.gold>=0)s.gold=Math.min(10000,Math.floor(raw.gold));
  if(raw.inventory&&raw.inventory.length)s.inventory=sanitizeModelInventory(raw.inventory,12);/* #50d: model arrays arrive verbatim — stack duplicates on arrival, never push raw */
  if(raw.abilities&&raw.abilities.length){s.abilities=[];for(i=0;i<raw.abilities.length&&s.abilities.length<6;i++){var ab=raw.abilities[i];if(ab&&typeof ab.nm==="string")s.abilities.push({nm:ab.nm,ds:typeof ab.ds==="string"?ab.ds:"",gained:worldState?worldState.turn:0});}}
  if(raw.spells&&raw.spells.length){s.spells=[];for(i=0;i<raw.spells.length&&s.spells.length<10;i++){var sp=raw.spells[i];if(sp&&typeof sp.nm==="string")s.spells.push({nm:sp.nm,lvl:parseInt(sp.lvl)||0,used:false});}}
  s.level=(worldState&&worldState.character&&worldState.character.level)||1;
  s.xp=XP_LEVELS[s.level-1]||0;
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
    if(typeof capabilityLookup==="function"&&capabilityLookup(sp.nm))continue;/* on-catalog or already-overlaid — base canon wins */
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
    /* \bdead\b (AUDIT_FABLE_07_16 #6 sanctioned fix): was /dead/i — the ONLY site without the word
       boundary, so an "undead" companion read as dead here and was never flagged for a sheet */
    if(n.partyMember&&!n.charSheet&&!/\bdead\b/i.test(n.status||"")){n.sheetPending=true;found=true;}}
  if(!found)return;
  if(typeof busy!=="undefined"&&busy)return;
  processPendingCompanionSheets();
}
function showArchetypeModal(){
  var c=worldState.character,archs=ARCHETYPES[c.cls]||[];
  var ch="",i;for(i=0;i<archs.length;i++){ch+="<div class='sc' onclick='pickArchetype("+i+")' style='text-align:left;padding:14px 16px;margin-bottom:10px;'><div class='nm' style='margin-bottom:5px;'>"+archs[i].nm+"</div><div style='font-size:12px;color:var(--t1);line-height:1.5;'>"+archs[i].desc+"</div></div>";}
  /* #14: modalShell (ui-shell.js) — wireClose:false, forced milestone choice (no × / no outside-close) */
  modalShell("arch-modal","<div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Level 3 Milestone</div><div style='font-size:18px;color:var(--t0);margin-bottom:18px;'>Choose Archetype</div>"+ch,
    {overlayExtra:"overflow-y:auto;",boxBg:"#181818",maxWidth:480,wireClose:false});
}
function pickArchetype(idx){
  var c=worldState.character,archs=ARCHETYPES[c.cls]||[];if(idx>=archs.length)return;var arch=archs[idx];c.archetype=arch.id;c.archetypeNm=arch.nm;
  if(!c.abilities)c.abilities=[];c.abilities.push({nm:arch.nm,ds:arch.desc,gained:worldState.turn});
  // Grant the archetype/class spell list even if the character already owns RACIAL spells (audit E21):
  // the old `!c.spells.length` guard skipped the whole grant for e.g. a Drow Rogue picking Arcane
  // Trickster, leaving them with no AT spells. Append what's missing (dedupe by name).
  var src=SPELLS[c.cls]||ARCH_SPELLS[arch.id];if(src){if(!c.spells)c.spells=[];var i,_have={};for(i=0;i<c.spells.length;i++)_have[c.spells[i].nm]=1;if(src.cantrips){for(i=0;i<src.cantrips.length;i++)if(!_have[src.cantrips[i]])c.spells.push({nm:src.cantrips[i],lvl:0,used:false});}if(src[1]){for(i=0;i<src[1].length;i++)if(!_have[src[1][i]])c.spells.push({nm:src[1][i],lvl:1,used:false});}}
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
function sbConfirm(){var picks=_sbPicks||[];var total=0,pi;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total!==2){document.getElementById("sb-warn").textContent="Must spend +2.";return;}var c=worldState.character;for(pi=0;pi<picks.length;pi++)c.stats[picks[pi].s]+=picks[pi].v;var m=document.getElementById("sb-modal");if(m)m.remove();addMsg("system","Stats: "+picks.map(function(p){return p.s+"+"+p.v;}).join(", "));if(_levelBumpsOwed>0)_levelBumpsOwed--;syncUI();saveAll();maybeShowLevelBump();/* drain the multi-level bump queue (E1) */}
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
  var c=worldState.character,snap={hp:c.hp,maxHp:c.maxHp,rels:{},party:{}},i;
  var rl=c.relationships||[];for(i=0;i<rl.length;i++){if(rl[i]&&rl[i].entity)snap.rels[rl[i].entity]=rl[i].descriptor;}
  var ns=worldState.npcs||[];for(i=0;i<ns.length;i++){var n=ns[i];
    if(n&&n.partyMember)snap.party[n.name]={dead:/\bdead\b/i.test(n.status||""),hp:n.charSheet?n.charSheet.hp:null,maxHp:n.charSheet?n.charSheet.maxHp:null};}
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
    if(/\bdead\b/i.test(n.status||"")&&!isSubject)continue;
    fileTo(n.charSheet);
  }
  if(filedAny&&typeof showToast==="function")showToast("★ Defining moment: "+text);
  if(filedAny&&typeof Sound!=="undefined")Sound.play("moment");
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
  var seen={},ns=worldState.npcs||[];
  for(i=0;i<ns.length;i++){var n=ns[i];if(!n||!n.partyMember)continue;seen[n.name]=1;
    var p=pre.party[n.name];
    if(!p){fileCoreMemory("party",n.name,n.name+" joined the party"+here+".");continue;}
    if(!p.dead&&/\bdead\b/i.test(n.status||"")){fileCoreMemory("death",n.name,n.name+" died"+foe+here+".");continue;}
    if(n.charSheet)cross(p.hp,p.maxHp,n.charSheet.hp,n.charSheet.maxHp,n.name);
  }
  var preNames=Object.keys(pre.party);
  for(i=0;i<preNames.length;i++){if(!seen[preNames[i]])fileCoreMemory("party",preNames[i],preNames[i]+" parted ways with the party"+here+".");}
  var rl=c.relationships||[];
  for(i=0;i<rl.length;i++){var r=rl[i];
    if(!r||!r.descriptor||!r.entity)continue;
    if(typeof WEIGHTY_REL_RE!=="undefined"&&WEIGHTY_REL_RE.test(r.descriptor)&&pre.rels[r.entity]!==r.descriptor)
      fileCoreMemory("bond",r.entity,"The bond between "+c.name+" and "+r.entity+" became \""+r.descriptor+"\".");/* #63: name BOTH parties — the old "The bond with X" left the player implicit, which reads as nonsense on X's own sheet and is meaningless once the moment travels to another campaign */
  }
}
// ── Condition turn-stamps (#46, Phase A) ────────────────────────────────────────────────────
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
  function relMap(list){var m={},i;for(i=0;i<(list||[]).length;i++){if(list[i]&&list[i].entity)m[list[i].entity]=list[i].descriptor||"";}return m;}
  var snap={player:relMap(worldState.character.relationships),party:{},names:{}},i;
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(n&&n.partyMember){snap.names[n.name]=1;if(n.charSheet)snap.party[n.name]=relMap(n.charSheet.relationships);}}
  return snap;
}
function stampRelationshipChanges(pre){
  if(!pre||!worldState||!worldState.character)return;
  function sweep(who,list,had){
    var i;for(i=0;i<(list||[]).length;i++){var r=list[i];if(!r||!r.entity)continue;
      var prev=had[r.entity];
      if(prev===undefined){if(!r.turn)r.turn=worldState.turn;continue;}/* new bond */
      if(prev===(r.descriptor||""))continue;/* unchanged */
      r.turn=worldState.turn;/* changed descriptor = the bond's new shape starts now */
      if(typeof WEIGHTY_REL_RE!=="undefined"&&WEIGHTY_REL_RE.test(prev)&&!WEIGHTY_REL_RE.test(r.descriptor||"")){
        if(!worldState.relDowngrades)worldState.relDowngrades=[];
        worldState.relDowngrades.push({who:who,entity:r.entity,prev:prev,next:r.descriptor||"",turn:worldState.turn});
        if(worldState.relDowngrades.length>8)worldState.relDowngrades.shift();/* bounded; oldest drop is also the stalest */
        if(typeof showToast==="function")showToast("⚠ Bond downgraded: "+(who||worldState.character.name)+" → "+r.entity+" (\""+prev+"\" → \""+(r.descriptor||"")+"\") — the GM will be asked to confirm");
      }
    }
  }
  sweep(null,worldState.character.relationships,pre.player);
  var i,nowNames={};
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(!n||!n.partyMember)continue;nowNames[n.name]=1;
    if(n.charSheet)sweep(n.name,n.charSheet.relationships,pre.party[n.name]||{});}
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
// Detection: an inventory entry counts as a consumable if it is a counted stack (" xN", N≥2 —
// the t582 "Blasting charge x4" form) OR its base name matches CONSUMABLE_RE. It is flagged when
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
function detectGhostConsumables(playerTxt,raw){
  if(!worldState||!worldState.character)return;
  var hay=String(playerTxt||"")+"\n"+String(raw||"");
  // item-loss tags already in this response → those items are handled, not ghosts
  var lostNorm={},tags=String(raw||"").match(/\[(?:COMPANION_)?ITEM_LOST:[^\]]+\]/g)||[],ti;
  for(ti=0;ti<tags.length;ti++){
    var tm=tags[ti].match(/\[COMPANION_ITEM_LOST:[^|\]]+\|([^\]]+)\]/)||tags[ti].match(/\[ITEM_LOST:([^\]]+)\]/);
    if(tm)lostNorm[_invNorm(_qtyParse(tm[1]).base)]=1;
  }
  function sweep(who,inv){
    var j;for(j=0;j<(inv||[]).length;j++){var entry=inv[j];if(typeof entry!=="string")continue;
      var base=_invBase(entry),norm=_invNorm(entry);
      if(_invCount(entry)<2&&!CONSUMABLE_RE.test(base))continue;
      if(lostNorm[norm])continue;
      var head=consumableHeadNoun(base);if(head.length<3)head=base;
      var re;try{re=new RegExp("\\b"+head.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(s|es)?\\b","i");}catch(e){continue;}
      if(!re.test(hay))continue;
      var key=(who||"")+"|"+norm;
      var last=worldState.consumableNudged&&worldState.consumableNudged[key];
      if(last!=null&&(worldState.turn-last)<CONSUMABLE_NUDGE_COOLDOWN)continue;
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
function commitGmTurn(resp,opts){
  var o=opts||{};
  if(!o.isOpening){
    worldState.turn++;
    if(typeof memory.nameIdx==="number")memory.nameIdx+=10; // rotate the AVAILABLE NAMES window once per narrative turn (buildSysPrompt only peeks — audit #12)
  }
  // Order is significant: applyMuts on raw text first, then cleanTxt strips tags.
  var _cmPre=coreMemorySnapshot();/* #40: pre-state for the defining-moments diff */
  var _cnPre=conditionSnapshot();/* #46: pre-state for condition turn-stamps */
  var _rlPre=relationshipSnapshot();/* #61: pre-state for relationship stamps + downgrade/audit triggers */
  applyMuts(resp);
  if(o.onMutated)o.onMutated();/* state is now mutated — callers that offer Retry must latch here (E82) */
  detectCoreMoments(_cmPre);stampNewConditions(_cnPre);stampRelationshipChanges(_rlPre);/* #40/#46/#61: AFTER applyMuts */
  if(!o.isOpening){
    detectGhostConsumables(o.playerTxt,resp);/* #60: ghost-consumable check — queues for buildConsumableNudge; syncCharSheet naturally excluded (its audit already asks for missing tags) */
    if(worldState.pendingLegacy){var _lcn=worldState.pendingLegacy.name;
      if(resp.indexOf(_lcn)>=0){if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];worldState.legacyCharsUsed.push(_lcn);worldState.pendingLegacy=null;}// actually introduced → mark used
      else if((worldState.turn-worldState.pendingLegacy.queuedAt)>=5){worldState.pendingLegacy=null;}// expired unintroduced → un-queue WITHOUT burning them, so they can roll again later (audit E85)
    }
    if(worldState.recentSwitch&&(worldState.turn-worldState.recentSwitch.turn)>=2)worldState.recentSwitch=null; // POV reinforcement done; sessionLog now carries new-POV turns
    if(worldState.mpEnded&&(worldState.turn-worldState.mpEnded.turn)>=3)worldState.mpEnded=null; // D12 exit reinforcement done — sessionLog now carries second-person turns again (3 not 2: the retained tail holds ~3 exchanges, so the third-person prose must be fully out of the window before the note stops firing)
    if(worldState.recentlyLeft){worldState.recentlyLeft=worldState.recentlyLeft.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentlyLeft.length)worldState.recentlyLeft=null;}
  }
  var clean=cleanTxt(resp),dice=diceTxt(resp);
  // UA6: persist HISTORY before any display step. applyMuts' trailing saveAll already
  // persisted the mutated state, so a throw in addMsg/TTS used to strand a saved state
  // whose sessionLog/transcript lacked this GM turn — next prompt desynced from state,
  // narration lost. With history+state saved first, a display throw leaves them
  // consistent and reload REPLAYS the missed narration from the transcript.
  logTranscript("gm",clean,resp);
  sessionLog.push({role:"user",content:o.userMsg},{role:"assistant",content:resp});
  saveAll();
  var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn});/* escProse: escape model output before it hits the story DOM (audit E11) */
  if(typeof TTS!=="undefined")TTS.speakResponse(clean);
  generateActions(narEl);
  processPendingCompanionSheets();// draw up sheets for any narrative-path join this turn (audit P2)
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
async function sendAction(override,opts){
  if(busy||!worldState)return;var inp=document.getElementById("action-input");
  var txt=override!==null?override:inp.value.trim();if(!txt)return;
  // Re-present a stat bump the player backed out of (audit E64) — it's an earned reward, not
  // something to forfeit; showing it again before the turn makes "Back" a defer, not a loss.
  if(typeof _levelBumpsOwed!=="undefined"&&_levelBumpsOwed>0&&!(opts&&opts.silent)&&!document.getElementById("sb-modal")){maybeShowLevelBump();return;}
  var isTT=activeChatTab==="tabletalk";
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
  busy=true;inp.value="";document.getElementById("sendbtn").disabled=true;lastAction=txt;
  if(!(opts&&opts.silent)&&!_mpResolve)addMsg(isTT?"tabletalk":"player",isTT?"[Table Talk] "+escHtml(txt):escHtml(txt));/* escape player input into the DOM (audit E11); a resolved round already displayed its per-PC lines */
  // Skip the transcript write on a retry of the same action — the failed attempt already
  // logged it, and a duplicate player line corrupts the story-compiler record (audit #9).
  var _tl=worldState.transcript;
  var _isRetryDup=!!(_tl&&_tl.length&&_tl[_tl.length-1].r==="player"&&_tl[_tl.length-1].x===String(txt).trim());
  if(!isTT&&!(opts&&opts.silent)&&!_isRetryDup)logTranscript("player",txt);
  var th=addMsg("thinking","The world turns...");
  var _committed=false; // true once applyMuts has mutated state — a Retry after that would double-apply (audit E82)
  try{
    if(!isTT&&sessionTokens()>=SUMMARIZE_AT)await summarize();
    var sys=isTT?"STRICT OUT-OF-CHARACTER MODE. The player is speaking to you as the GM, not as a character in the story. YOUR RESPONSE MUST CONTAIN ZERO narrative prose, ZERO second-person story description, ZERO scene-setting, and ZERO story advancement. Do not describe what the player character does, sees, or experiences. Do not use phrases like 'you slip', 'you notice', 'ahead lies', or any story language. Respond ONLY in plain first-person GM voice -- conversational, direct, factual. Answer their question or engage with their comment as a game master would between sessions. Any narrative content in your response is a STRICT VIOLATION of these instructions.":null;
    // P3 quest escalation: when an active quest has sat all-objectives-done for
    // QUEST_ESCALATE_TURNS+ turns (see buildQuestEscalation, api.js), prepend a bracketed
    // engine note to the OUTGOING API message. apiTxt is what callGM sends and what
    // sessionLog stores (sessionLog IS the API history); the displayed chat line and the
    // worldState.transcript player entry above already captured the clean txt, and
    // lastAction/retry keep the clean txt too, so the note never reaches the player.
    var apiTxt=txt;
    if(!isTT&&!(opts&&opts.silent)){var _en=buildEngineNotes();if(_en)apiTxt=_en+"\n\n"+txt;}/* v1.255: the engine-notes registry (quest escalation + condition audit; adding a check = a NOTE_BUILDERS entry) */
    var resp=await callGM(apiTxt,sys);th.remove();
    if(isTT){addMsg("tabletalk","<em>[GM]</em> <p>"+escProse(resp)+"</p>");}/* escape GM table-talk output (audit E11) */
    else{
      // The whole commit sequence lives in commitGmTurn (audit 07-16 #5) — shared with
      // beginAdventure. This path's order is the canonical one commitGmTurn reproduces.
      commitGmTurn(resp,{userMsg:apiTxt,playerTxt:txt,onMutated:function(){_committed=true;/* a later throw must NOT offer a re-applying Retry (E82) */}});
    }
    syncUI();
  }catch(e){th.remove();
    if(typeof reportError==="function")reportError("turn",e.message,((e&&e.stack)||"")+(_committed?"\n(state committed; display step failed)":""));/* #16: the mobile console is invisible — mail the failure */
    if(_committed){addMsg("system","Turn applied, but a display step failed: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn applied, but display failed");}/* no Retry — the mutation already landed (E82) */
    else{var em=addMsg("system","GM error: "+e.message);if(typeof carNotify==="function")carNotify("error","Turn failed — tap to retry");if(_attachGMErrorUI(em,function(){retryLast();},e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
  }
  busy=false;document.getElementById("sendbtn").disabled=false;document.getElementById("action-input").focus();
  if(typeof carMode!=="undefined"&&carMode){var _pk=document.getElementById("action-input");if(_pk&&_pk.value.trim()&&typeof carNotify==="function")carNotify("info","Heard you — tap to send");}
}
function retryLast(){if(lastAction)sendAction(lastAction,{mpBypass:true});}/* P3: a retried multi-PC round is already an assembled block — re-queueing it as one PC's action would corrupt the round */
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
    var resp=await callGM(prevU.content,null,1000); // current voice; no muts, no turn++
    th.remove();
    sessionLog.push({role:"user",content:prevU.content},{role:"assistant",content:resp});
    var clean=cleanTxt(resp),dice=diceTxt(resp);
    // Keep the transcript honest: the re-rolled scene replaces the discarded one, so the
    // story-compiler record matches what the player actually read (audit #9).
    if(worldState.transcript&&worldState.transcript.length&&worldState.transcript[worldState.transcript.length-1].r==="gm"){
      worldState.transcript[worldState.transcript.length-1].x=clean.trim();
      if(typeof ragEntitiesFromRaw==="function")worldState.transcript[worldState.transcript.length-1].e=ragEntitiesFromRaw(resp); // keep the #27 entity index honest too
      // Audit 07-16 #1: this is an IN-PLACE mutation of the last entry (same object, same
      // length — no swap), invisible to the serialize memo's identity checks except via its
      // last-entry .x compare. Invalidate explicitly so even an .e-only change (identical
      // reroll text) can never persist a stale compressed blob.
      if(typeof serializeWorldState!=="undefined"&&serializeWorldState.invalidateTranscriptMemo)serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
    }
    var story=document.getElementById("story-narrative");
    if(story){var nars=story.querySelectorAll(".msg.narrator");if(nars.length)nars[nars.length-1].parentNode.removeChild(nars[nars.length-1]);}
    var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn});/* escProse: escape model output before it hits the story DOM (audit E11) */
    if(typeof TTS!=="undefined")TTS.speakResponse(clean);
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
  if(typeof bp.premise!=="string")bp.premise=bp.premise==null?"":String(bp.premise);
  if(typeof bp.startingLocation!=="string")bp.startingLocation="";
  if(typeof bp.startingRegion!=="string")bp.startingRegion="";
  if(!Array.isArray(bp.acts))bp.acts=[];
  // Every act needs an arcs array (audit E19) — applyBlueprint iterates act.arcs unconditionally,
  // and the cloud-library path skips validateBlueprint, so a missing arcs crashed startGame.
  for(var _ai=0;_ai<bp.acts.length;_ai++){if(bp.acts[_ai]&&!Array.isArray(bp.acts[_ai].arcs))bp.acts[_ai].arcs=[];}
  if(!Array.isArray(bp.npcs))bp.npcs=[];
  if(!Array.isArray(bp.locations))bp.locations=[];
  if(!Array.isArray(bp.rules))bp.rules=[];
  if(!Array.isArray(bp.creatures))bp.creatures=[]; // v1.176 — campaign bestiary
  return bp;
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
    var notes=(mem&&mem.knowledge&&mem.knowledge.length)?mem.knowledge.join("; ").slice(0,400):"";
    npcs.push({name:n.name,role:n.status||"neutral",notes:notes,pronouns:n.pronouns||mem&&mem.pronouns||"they/them"});
  });
  var locations=[];
  if(memory.map&&memory.map.nodes){
    Object.keys(memory.map.nodes).forEach(function(key){
      if(key.indexOf("|")>=0)return; // skip sub-locations
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
      worldState.npcs.push({name:n.name,status:n.role||"neutral",rel:n.role||"neutral",met:0,pronouns:n.pronouns||"they/them"});
      memory.npcs[n.name]={attitude:n.role||"neutral",knowledge:n.notes?[n.notes]:[],events:[],pronouns:n.pronouns||"they/them"};
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
  // Store blueprint name on worldState for reference
  worldState.blueprintName=bp.name;
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
    +"}\n\n"
    +"RULES:\n"
    +skelRulesHead(!!_skelDNA)
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
  worldState.skeleton=skel;saveCore();
}
async function beginAdventure(){
  busy=true;document.getElementById("sendbtn").disabled=true;var th=addMsg("thinking","The world stirs...");
  var _openingCommitted=false;/* E82 latch for the opening — set by commitGmTurn's onMutated below */
  try{
    var c=worldState.character,w=worldState.world;
    var compNpcs=(worldState.npcs||[]).filter(function(n){return n.partyMember;});
    var compStr="";if(compNpcs.length){var cds=compNpcs.map(function(n){var s=n.charSheet;return n.name+(s?" ("+pronounsForGender(s.gender)+", "+s.cls+(s.archetypeNm?" ["+s.archetypeNm+"]":"")+", Lv"+s.level+")":"");});compStr=" They travel with companions: "+cds.join(", ")+". Use each companion's stated pronouns; never reassign a companion's gender. Introduce the full party together in the opening scene.";}
    var intro="Open the adventure at "+w.location+", "+w.region+", at "+w.time+". "+c.name+" is a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+"."+(c.trait?" Trait: "+c.trait+".":"")+(c.flaw?" Flaw: "+c.flaw+".":"")+(c.motivation?" Wants: "+c.motivation+".":"")+(c.backstory?" Backstory: "+c.backstory:"")+compStr+" Write a vivid 3-5 sentence opening. Give rich sensory detail. Plant an immediate hook. Do not end with suggested actions or a 'You could' line — action buttons are handled separately.";
    var resp=await callGM(intro);th.remove();
    // Unified commit (audit 07-16 #5): inherits sendAction's canonical UA6 order — transcript/
    // sessionLog/state now persist BEFORE the opening scene renders, so a display throw can no
    // longer strand a saved state that lacks the opening narration. isOpening: no turn++.
    commitGmTurn(resp,{userMsg:intro,isOpening:true,onMutated:function(){_openingCommitted=true;/* E82 latch for the opening (user ruling 2026-07-16) */}});
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
async function doRender(){
  if(!worldState||_rendering)return;_rendering=true;var th=addMsg("thinking","Composing scene...");
  try{
    var c=worldState.character,w=worldState.world;
    // Build a character-specific anchor so the model paints the same person each time
    var gw=genderWord(c.gender);/* #11③: shared mapping (local renamed — the old `var genderWord` would shadow the helper) */
    var charDesc=c.name+", a "+gw+" "+c.age+" "+c.ancestry+" "+c.cls+", "+c.appear+(c.mark?", "+c.mark:"");
    // Party render (all models): describe every living companion so the scene portrays the whole party
    // with correct appearances, not invented ones. Portrait-likeness seeding (below) is Nano-only.
    var party=livingPartyCompanions(),compDescs=[],pi;
    for(pi=0;pi<party.length;pi++){
      var pcs=party[pi].charSheet;
      var pg=genderWord(pcs.gender);/* #11③: shared mapping */
      var pd=party[pi].name+", a "+pg+(pcs.age?" "+pcs.age:"")+" "+(pcs.ancestry||"")+" "+(pcs.cls||"")+(pcs.appear?", "+pcs.appear:"")+(pcs.mark?", "+pcs.mark:"");
      compDescs.push(pd.replace(/\s+/g," ").trim());
    }
    var hasParty=compDescs.length>0;
    var rp="Write a detailed image generation prompt for the current scene"
      +(hasParty?", portraying the whole adventuring party together in one composition":"")+". "
      +"Protagonist (describe exactly as written, do not invent appearance): "+charDesc+". "
      +(hasParty?"Party members also present — include every one, describe each exactly as written, do not invent appearance: "+compDescs.join("; ")+". ":"")
      +"Spell out each character's hair colour, eye colour, skin tone, clothing and visible gear explicitly. "
      +"Scene: "+w.location+", "+w.region+", "+w.time+", "+w.weather+". "
      +(hasParty?"All "+(compDescs.length+1)+" party members must be present and individually recognizable in the scene. ":"")
      +"Depict a candid, dynamic moment — characters in varied, natural poses (moving, turning, gesturing, mid-action), interacting with the environment and one another from a cinematic camera angle; NOT a static, front-facing line-up or posed group portrait. "
      +"Style: dark fantasy concept art, dramatic high-contrast cinematic lighting — strong directional key light, warm rim-light, deep shadows, moody atmospheric colour grading, rich painterly texture. "
      +(hasParty?"3-4 sentences":"2-3 sentences")+". Output ONLY the prompt, no game tags.";
    var resp=await callGM(rp,"You are an image prompt writer for a dark fantasy RPG. Output ONLY the image generation prompt. Describe the protagonist's exact physical appearance with full specificity. No narration, no tags.");
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
    var saveBtn=mkBtn("↓ Save","Save image to disk");
    saveBtn.addEventListener("click",function(){
      if(!imageUrl)return;
      fetch(imageUrl).then(function(r){return r.blob();}).then(function(blob){
        var fname=buildFilename("render");exportToFolder("render",blob,fname);
      }).catch(function(){window.open(imageUrl,"_blank");});
    });
    // ✨ Enhance: second img2img pass over the FINISHED render — a hard cinematic relight/regrade
    // (Flux img2img at ENHANCE_STRENGTH), reusing the scene prompt so content stays coherent. This is
    // what an aggressive editor does to buy drama Nano's flat compositor pass lacks. Replaces in place;
    // Save/Portrait then act on the enhanced image. Re-runnable (each pass re-grades the current image).
    var enhanceBtn=mkBtn("✨ Enhance","Cinematic relight & regrade of this image");
    enhanceBtn.addEventListener("click",function(){
      if(!imageUrl){showToast("Image not ready yet.");return;}
      if(!falKey){showToast("Set a fal.ai key first.");return;}
      enhanceBtn.textContent="Enhancing…";enhanceBtn.disabled=true;
      var ep=withImgStyle(resp)+" "+ENHANCE_DIRECTIVE;
      fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
        headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
        body:JSON.stringify({prompt:ep,image_url:imageUrl,strength:ENHANCE_STRENGTH,num_inference_steps:28,num_images:1})})
        .then(function(r){if(!r.ok)throw new Error("fal.ai HTTP "+r.status);return r.json();})
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

    if(falKey){
      var imgStatus=document.createElement("div");
      imgStatus.style.cssText="font-size:12px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;";
      imgStatus.textContent="Generating image…";
      div.appendChild(imgStatus);
      try{
        var mdlCfg=RENDER_MODELS[0],mi2;for(mi2=0;mi2<RENDER_MODELS.length;mi2++){if(RENDER_MODELS[mi2].id===renderModel){mdlCfg=RENDER_MODELS[mi2];break;}}
        // Seed portraits: player first, then each living companion WITH a portrait — but only Nano
        // Banana 2 composites multiple references, so companion seeds are gathered for Nano only.
        // Flux/Qwen receive just the player (their body fn takes seeds[0]) — behavior unchanged.
        var isNano=mdlCfg.id==="fal-ai/nano-banana-2";
        var seeds=[],pj;
        if(worldState.character.portrait)seeds.push(worldState.character.portrait);
        if(isNano){for(pj=0;pj<party.length;pj++){var cpo=npcPortrait(party[pj]);if(cpo)seeds.push(cpo);}}
        var usingI2I=!!(seeds.length&&mdlCfg.img2img);
        if(usingI2I)imgStatus.textContent=(isNano&&seeds.length>1)?("Generating party scene ("+seeds.length+" portraits seeded)…"):"Generating scene (portrait-seeded)…";
        var falEndpoint=usingI2I?mdlCfg.img2img.endpoint:mdlCfg.id;
        var falPrompt=withImgStyle(resp);
        // Nano Banana 2 is an edit/compositor — left alone it clings to the reference portraits' posed,
        // front-facing headshot framing (the "school-portrait" stiffness). Tell it the references are
        // likeness-only so it re-stages everyone dynamically. Scene-render only; portrait paths stay posed.
        if(isNano&&seeds.length)falPrompt+=" IMPORTANT: the supplied reference image(s) define each character's facial likeness and costume ONLY — do NOT copy their frontal, posed headshot framing; re-stage every figure in a natural, dynamic pose within the scene.";
        var falBody=usingI2I?mdlCfg.img2img.body(falPrompt,seeds,img2imgStrength(mdlCfg)):mdlCfg.body(falPrompt);
        var falRes=await fetch("https://fal.run/"+falEndpoint,{method:"POST",headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},body:JSON.stringify(falBody)});
        if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
        var falData=await falRes.json();
        if(falData.images&&falData.images[0]&&falData.images[0].url){
          imageUrl=falData.images[0].url;
          imgStatus.remove();
          var img=document.createElement("img");img.src=imageUrl;
          img.style.cssText="width:100%;border-radius:4px;display:block;";
          img.alt="Scene illustration";div.appendChild(img);sceneImg=img;
        }else{imgStatus.textContent="No image returned.";}
      }catch(fe){imgStatus.textContent="Image error: "+fe.message;}
    }else{
      // No fal key — show the prompt text and a hint
      promptShown=true;promptDiv.style.display="block";
      promptBtn.style.borderColor="var(--acc)";promptBtn.style.color="var(--acc)";
      var hint=document.createElement("div");
      hint.style.cssText="font-size:11px;color:var(--t2);font-style:italic;margin-top:2px;";
      hint.textContent="Set a fal.ai key (File → fal.ai image key…) to generate images.";
      div.appendChild(hint);
    }
  }catch(e){if(th.parentNode)th.remove();addMsg("system","Render failed: "+e.message);}
  _rendering=false;
}
function restSpells(){
  if(!worldState||!worldState.character.spells)return;
  var i;for(i=0;i<worldState.character.spells.length;i++){if(worldState.character.spells[i].lvl>0)worldState.character.spells[i].used=false;}
  // Also restore party companions' expended spells (audit E84) — a rest is party-wide.
  var pj,ps,_rsParty=livingPartyCompanions();/* user ruling 2026-07-16 (AUDIT_FABLE_07_16 #6): dead companions get NOTHING — no rest slots */
  for(pj=0;pj<_rsParty.length;pj++){var _pn=_rsParty[pj];if(_pn.charSheet.spells){for(ps=0;ps<_pn.charSheet.spells.length;ps++){if(_pn.charSheet.spells[ps].lvl>0)_pn.charSheet.spells[ps].used=false;}}}
  updateSpPanel();saveCore();showToast("Spell slots restored.");
}
function initAbilities(){
  if(!worldState)return;var c=worldState.character;
  if(!c.abilities||!c.abilities.length){
    var abs=[],i,anc=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].nm===c.ancestry||ANCS[i].id===c.ancestry){anc=ANCS[i];break;}}
    if(anc&&anc.subraces&&c.subrace){for(i=0;i<anc.subraces.length;i++){if(anc.subraces[i].id===c.subrace){var rlbl2=c.ancestry==="Half-Blood"?"[Racial] One parent trait":"[Racial] "+anc.subraces[i].nm;var rdesc2=anc.subraces[i].desc;if(c.heritageVariant&&anc.subraces[i].lineages){var rlk2;for(rlk2=0;rlk2<anc.subraces[i].lineages.length;rlk2++){if(anc.subraces[i].lineages[rlk2].id===c.heritageVariant){rdesc2=anc.subraces[i].lineages[rlk2].desc;break;}}}abs.push({nm:rlbl2,ds:rdesc2,gained:0});break;}}}
    var st=ABILS[c.cls]||[];for(i=0;i<st.length;i++)abs.push({nm:st[i].nm,ds:st[i].ds,gained:0});
    c.abilities=abs;}
  updateAbPanel(false);
}
function initSpells(){
  if(!worldState)return;var c=worldState.character;
  if(!c.spells||!c.spells.length){
    var src=SPELLS[c.cls]||(c.archetype?ARCH_SPELLS[c.archetype]:null);
    if(src){if(!c.spells)c.spells=[];var i,sl,maxSlot=c.level>=5?3:c.level>=3?2:1;if(src.cantrips){for(i=0;i<src.cantrips.length;i++)c.spells.push({nm:src.cantrips[i],lvl:0,used:false});}for(sl=1;sl<=maxSlot;sl++){if(src[sl]){for(i=0;i<src[sl].length;i++)c.spells.push({nm:src[sl][i],lvl:sl,used:false});}}}}
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
  var compLine=companions.length?"Party members to also audit: "+companions.join(", ")+". For each use COMPANION_ prefixed tags: [COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_CONDITION:Name|cond|dur] [COMPANION_CONDITION_REMOVED:Name|cond] [COMPANION_ALIGNMENT:Name|law+1] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item].":"";
  return "[GM SHEET SYNC — internal, not a player action] Audit ALL character sheets against events in this session. "
    +"Emit ONLY state tags — zero prose, zero narration, zero 'You could' line. "
    +"For the player — allowed tags: [RELATIONSHIP:entity|descriptor] [RELATIONSHIP_REMOVED:entity] [CONDITION:name|duration] [CONDITION_REMOVED:name] "
    +"[NPC:name|status|relation] [QUEST:title|status] [ALIGNMENT:law+1] (or law-1/good+1/good-1) [ITEM_GAINED:name] [ITEM_LOST:name]. "
    +compLine+" "
    +"ITEM tags are DISCREPANCY CORRECTIONS ONLY, and finding item discrepancies is a core duty of this audit: go item by item — emit [ITEM_LOST:] for anything the story shows spent, sold, or taken that the sheet still lists, and [ITEM_GAINED:] for anything the story clearly shows acquired that is MISSING from the sheet (a story-established item absent from the sheet is exactly the error you exist to repair — repair it). The prohibition runs ONE way only: never re-emit a gain or loss the sheet ALREADY reflects, because that double-applies it. "
    +"Close a quest ONLY if this session's events unambiguously show it finished — never on inference or partial progress; a legitimate close carries its rewards as normal. "/* P4-F1 resolution (user: keep) — sync closes pay like any close, this line guards the hallucinated-close edge */
    +"Do NOT emit XP, HP, or GOLD tags — those are tracked turn-by-turn. "
    +"Only emit tags for things that have actually changed or are genuinely missing. "
    +"If nothing needs updating, reply with a single period only.";
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
  });
}
