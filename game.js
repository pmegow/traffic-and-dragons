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
    generateSkeleton().then(function(){_skMsg.remove();beginAdventure();}).catch(function(e){_skMsg.remove();var reason=e&&e.message?e.message:"unknown error";showToast("Skeleton failed ("+reason+") — playing freeform",6000);if(typeof console!=="undefined")console.warn("[skeleton] "+reason);beginAdventure();});
  }
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
    // Send ONLY the latest scene + a sheet digest, not the whole sessionLog (audit #17), and give
    // the model the character's actual kit so it can't suggest spells the player doesn't have —
    // the "Cast Magic Missile" button root cause (audit #4 / TODO Known issue #4).
    var c=worldState.character,sp=[],ab=[],si;
    if(c.spells){for(si=0;si<c.spells.length;si++){if(!c.spells[si].used)sp.push(c.spells[si].nm.replace(/\s*\(.*\)/,""));}}
    if(c.abilities){for(si=0;si<c.abilities.length;si++)ab.push(c.abilities[si].nm);}
    var sheet="THE PLAYER CHARACTER: "+c.name+", level "+c.level+" "+c.cls+", HP "+c.hp+"/"+c.maxHp+". Abilities: "+(ab.join(", ")||"none")+". Spells available: "+(sp.join(", ")||"NONE — this character cannot cast spells")+". Suggested actions must be things THIS character can actually do — never suggest casting a spell or using an ability that is not listed above.";
    var lastGm="";for(si=sessionLog.length-1;si>=0;si--){if(sessionLog[si].role==="assistant"){lastGm=cleanTxt(sessionLog[si].content);break;}}
    var resp=await callGM("LATEST SCENE:\n"+lastGm.slice(0,2400)+"\n\nBased on this scene, suggest exactly 3 short actions the player could take next. Output ONLY a JSON array of 3 strings, each under 10 words. No prose, no markdown, no backticks.","You suggest player actions for a tabletop RPG. "+sheet+" Output ONLY a valid JSON array of 3 short strings.",200,null,{noHistory:true,kind:"actions"});
    if(worldState.turn!==turnAt)throw new Error("stale"); // a newer turn landed; discard quietly
    var acts=JSON.parse(stripCodeFences(resp)); // array payload — fences only, no object repair
    if(!acts||!acts.length){_cleanup();return;}/* remove the "…" placeholders on an empty result too (audit E25) */
    for(i=0;i<3&&i<acts.length;i++){var a=acts[i].trim();btns[i].textContent=a;btns[i].setAttribute("data-action",a);btns[i].setAttribute("title","Tap to edit · hold or Ctrl-click to send");btns[i].setAttribute("onclick","sendSuggestedAction(this,event)");btns[i].disabled=false;}
    // saveAll (not saveCore): this async call finishes AFTER the turn's debounced sync fires,
    // so a local-only save left the server blob holding the PREVIOUS turn's buttons — device B
    // rendered stale actions while the text matched. saveAll re-arms the debounce with the
    // fresh lastActions (one cheap extra POST at most).
    worldState.lastActions=acts.slice(0,3);saveAll();
  }catch(e){_cleanup();}
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
    var dup=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===ch.name){dup=true;break;}}
    if(dup)continue;
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
    var hpGain=cls?Math.ceil(cls.hd/2)+1+conMod:3;hpGain=Math.max(1,hpGain);
    c.maxHp+=hpGain;c.hp+=hpGain;totalHp+=hpGain;
    var features=CLASS_FEATURES[c.cls]||{};
    if(features[c.level]){c.abilities.push({nm:"Lv"+c.level,ds:features[c.level],gained:worldState.turn});newFeatures.push(features[c.level]);}
    if(STAT_BUMP_LEVELS.indexOf(c.level)>=0)bumpsOwed++;
  }
  addMsg("system","Level up! "+oldLvl+" -> "+newLvl+" | HP +"+totalHp+" (now "+c.maxHp+")");
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
    var hpGain=cls?Math.ceil(cls.hd/2)+1+conMod:3;hpGain=Math.max(1,hpGain);
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
function _compNpcByName(name){if(!worldState||!worldState.npcs)return null;var i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name)return worldState.npcs[i];}return null;}
function buildCompanionSheetPrompt(npcName){
  var npc=_compNpcByName(npcName)||{};
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
    +'{"name":'+JSON.stringify(npcName)+',"gender":"M or F or NB","age":"apparent age","appear":"one-line physical description","cls":"one class from the list","level":'+c.level+',"stats":{"STR":12,"DEX":12,"CON":12,"INT":12,"WIS":12,"CHA":12},"maxHp":12,"gold":10,"inventory":["3-6 items fitting the class"],"abilities":[{"nm":"ability name","ds":"one-line description"}],"spells":[{"nm":"spell name","lvl":1}],"trait":"one line","flaw":"one line","motivation":"one line"}\n'
    +"Stats: 8-16, weighted toward the class's prime stat. maxHp: appropriate for the class hit die and level. spells: [] unless the class is a caster (Sorcerer, Cleric, Druid, Necromancer, Ranger, Paladin — cantrips are lvl 0). abilities: 1-3 signature class abilities.";
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
  for(l=2;l<=level;l++)hp+=Math.max(1,Math.ceil(hd/2)+1+conMod);
  return hp;
}
// Minimal but fully valid v10 companion sheet — the fallback when generation fails, and the
// guaranteed-shape base that normalizeCompanionSheet overlays model output onto.
function buildCompanionSheetStub(npcName){
  var npc=_compNpcByName(npcName)||{};
  var mem=(memory&&memory.npcs&&memory.npcs[npcName])||{};
  var lvl=(worldState&&worldState.character&&worldState.character.level)||1;
  var cls=guessCompanionClass((npc.rel||"")+" "+(npc.status||"")+" "+((mem.knowledge||[]).join(" ")));
  var gender=npc.pronouns==="she/her"?"F":npc.pronouns==="they/them"?"NB":"M";
  var hp=companionBaselineHp(cls,lvl,0);
  return {name:npcName,gender:gender,age:"adult",appear:"",mark:"",backstory:"",ancestry:"Human",subrace:null,subraceNm:null,heritageVariant:null,
    cls:cls,stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},hp:hp,maxHp:hp,gold:0,inventory:[],level:lvl,xp:XP_LEVELS[lvl-1]||0,
    abilities:[],spells:[],archetype:null,archetypeNm:null,statedAlignment:"True Neutral",actualAlignment:"True Neutral",alignLaw:0,alignGood:0,deity:null,
    trait:null,flaw:null,motivation:null,languages:[{name:"Common",broken:false}],skills:initSkills(),conditions:[],relationships:[],saveModifiers:[],
    portrait:null,storyBeats:[],partyMember:true};
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
  if(raw.inventory&&raw.inventory.length){s.inventory=[];for(i=0;i<raw.inventory.length&&s.inventory.length<12;i++){if(typeof raw.inventory[i]==="string")s.inventory.push(raw.inventory[i]);}}
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
  catch(e){return null;}
}
// Attach a generated/stub sheet to the named party member; makes findCompanionChar resolve them.
function attachCompanionSheet(npcName,sheet){
  var npc=_compNpcByName(npcName);
  if(!npc||npc.charSheet)return null;
  npc.charSheet=sheet;delete npc.sheetPending;
  if(memory&&memory.npcs&&memory.npcs[npcName])memory.npcs[npcName].partyMember=true;
  return npc;
}
var _sheetGenInFlight={};
async function generateCompanionSheet(npcName){
  var npc=_compNpcByName(npcName);
  if(!npc||npc.charSheet||_sheetGenInFlight[npcName])return;
  _sheetGenInFlight[npcName]=1;
  var sheet=null,failReason=null;
  try{
    var p=buildCompanionSheetPrompt(npcName);
    var resp=await callGM(p.msg,p.sys,600,null,{noHistory:true,kind:"other"});
    sheet=parseCompanionSheet(resp,npcName);
    if(!sheet)failReason="model returned invalid JSON";
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
    if(n.partyMember&&!n.charSheet&&!/dead/i.test(n.status||"")){n.sheetPending=true;found=true;}}
  if(!found)return;
  if(typeof busy!=="undefined"&&busy)return;
  processPendingCompanionSheets();
}
function showArchetypeModal(){
  var c=worldState.character,archs=ARCHETYPES[c.cls]||[];var ex=document.getElementById("arch-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="arch-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";
  var ch="",i;for(i=0;i<archs.length;i++){ch+="<div class='sc' onclick='pickArchetype("+i+")' style='text-align:left;padding:14px 16px;margin-bottom:10px;'><div class='nm' style='margin-bottom:5px;'>"+archs[i].nm+"</div><div style='font-size:12px;color:var(--t1);line-height:1.5;'>"+archs[i].desc+"</div></div>";}
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;'><div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Level 3 Milestone</div><div style='font-size:18px;color:var(--t0);margin-bottom:18px;'>Choose Archetype</div>"+ch+"</div>";
  document.body.appendChild(modal);
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
  var c=worldState.character;var ex=document.getElementById("sb-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="sb-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  var rh="",i;for(i=0;i<STATS.length;i++){var s=STATS[i];rh+="<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'><span style='width:36px;font-weight:bold;color:var(--t1);'>"+s+"</span><span style='width:32px;font-size:16px;font-weight:bold;' id='sb-cur-"+s+"'>"+c.stats[s]+"</span><button onclick=\"sbPick('"+s+"',1,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+1</button><button onclick=\"sbPick('"+s+"',2,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+2</button></div>";}
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:380px;width:100%;'><div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Stat Improvement</div><div style='font-size:13px;color:var(--t2);margin-bottom:18px;'>+2 to one or +1 to two. Max 20.</div>"+rh+"<p id='sb-warn' style='font-size:12px;color:#c04040;min-height:16px;'></p><div style='display:flex;gap:10px;'><button onclick='sbBack()' style='padding:10px 18px;font-family:var(--font);border:1px solid var(--brd);border-radius:var(--r);background:var(--bg1);color:var(--t0);cursor:pointer;'>Back</button><button onclick='sbConfirm()' style='flex:1;padding:12px;font-size:14px;font-family:var(--font);background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Confirm</button></div></div>";
  document.body.appendChild(modal);_sbPicks=[];
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
  var inp=document.getElementById("userinput");if(!inp)return;
  // APPEND to whatever's already typed (#33) — the player may have started a partial thought
  // before tapping a suggestion; replacing would eat it. The × button clears in one tap.
  var fp=toFirstPerson(action),cur=inp.value;
  if(cur&&!/\s$/.test(cur))cur+=" ";
  inp.value=cur+fp;inp.focus();
  try{inp.setSelectionRange(inp.value.length,inp.value.length);}catch(e){}
}
async function sendAction(override,opts){
  if(busy||!worldState)return;var inp=document.getElementById("userinput");
  var txt=override!==null?override:inp.value.trim();if(!txt)return;
  // Re-present a stat bump the player backed out of (audit E64) — it's an earned reward, not
  // something to forfeit; showing it again before the turn makes "Back" a defer, not a loss.
  if(typeof _levelBumpsOwed!=="undefined"&&_levelBumpsOwed>0&&!(opts&&opts.silent)&&!document.getElementById("sb-modal")){maybeShowLevelBump();return;}
  var isTT=activeChatTab==="tabletalk";
  busy=true;inp.value="";document.getElementById("sendbtn").disabled=true;lastAction=txt;
  if(!(opts&&opts.silent))addMsg(isTT?"tabletalk":"player",isTT?"[Table Talk] "+escHtml(txt):escHtml(txt));/* escape player input into the DOM (audit E11) */
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
    if(!isTT&&!(opts&&opts.silent)){var _qesc=buildQuestEscalation();if(_qesc)apiTxt=_qesc+"\n\n"+txt;}
    var resp=await callGM(apiTxt,sys);th.remove();
    if(isTT){addMsg("tabletalk","<em>[GM]</em> <p>"+escProse(resp)+"</p>");}/* escape GM table-talk output (audit E11) */
    else{
      worldState.turn++;
      if(typeof memory.nameIdx==="number")memory.nameIdx+=10; // rotate the AVAILABLE NAMES window once per narrative turn (buildSysPrompt only peeks — audit #12)
      // Order is significant: applyMuts on raw text first, then cleanTxt strips tags, then parseActions on clean text.
      applyMuts(resp);_committed=true;/* state is now mutated — a later throw must NOT offer a re-applying Retry (E82) */
      if(worldState.pendingLegacy){var _lcn=worldState.pendingLegacy.name;
        if(resp.indexOf(_lcn)>=0){if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];worldState.legacyCharsUsed.push(_lcn);worldState.pendingLegacy=null;}// actually introduced → mark used
        else if((worldState.turn-worldState.pendingLegacy.queuedAt)>=5){worldState.pendingLegacy=null;}// expired unintroduced → un-queue WITHOUT burning them, so they can roll again later (audit E85)
      }
      if(worldState.recentSwitch&&(worldState.turn-worldState.recentSwitch.turn)>=2)worldState.recentSwitch=null; // POV reinforcement done; sessionLog now carries new-POV turns
      if(worldState.recentlyLeft){worldState.recentlyLeft=worldState.recentlyLeft.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentlyLeft.length)worldState.recentlyLeft=null;}
      var clean=cleanTxt(resp),dice=diceTxt(resp);
      // UA6: persist HISTORY before any display step. applyMuts' trailing saveAll already
      // persisted the mutated state, so a throw in addMsg/TTS used to strand a saved state
      // whose sessionLog/transcript lacked this GM turn — next prompt desynced from state,
      // narration lost. With history+state saved first, a display throw leaves them
      // consistent and reload REPLAYS the missed narration from the transcript.
      logTranscript("gm",clean,resp);
      sessionLog.push({role:"user",content:apiTxt},{role:"assistant",content:resp});/* apiTxt so the API history stays consistent with what the GM actually answered (P3 note included) */
      saveAll();
      var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn});/* escProse: escape model output before it hits the story DOM (audit E11) */
      if(typeof TTS!=="undefined")TTS.speakResponse(clean);
      generateActions(narEl);
      processPendingCompanionSheets();// draw up sheets for any narrative-path join this turn (audit P2)
    }
    syncUI();
  }catch(e){th.remove();
    if(_committed){addMsg("system","Turn applied, but a display step failed: "+e.message);}/* no Retry — the mutation already landed (E82) */
    else{var em=addMsg("system","GM error: "+e.message);if(_attachGMErrorUI(em,function(){retryLast();},e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
  }
  busy=false;document.getElementById("sendbtn").disabled=false;document.getElementById("userinput").focus();
}
function retryLast(){if(lastAction)sendAction(lastAction);}
// Re-roll the last GM narration in the CURRENT prose voice WITHOUT advancing the turn
// or re-applying state tags — a clean A/B tool for trying Prose Inspiration voices on the
// same scene. Pops the last exchange so the GM regenerates in the original context, then
// swaps the displayed narration + the sessionLog assistant entry for the new one.
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
    }
    var story=document.getElementById("story-narrative");
    if(story){var nars=story.querySelectorAll(".msg.narrator");if(nars.length)nars[nars.length-1].parentNode.removeChild(nars[nars.length-1]);}
    var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn});/* escProse: escape model output before it hits the story DOM (audit E11) */
    if(typeof TTS!=="undefined")TTS.speakResponse(clean);
    saveAll();
    generateActions(narEl);
  }catch(e){
    th.remove();sessionLog.push(prevU,prevA); // restore the original exchange on failure
    addMsg("system","Re-roll error: "+e.message);
  }
  busy=false;document.getElementById("sendbtn").disabled=false;
}
function _attachGMErrorUI(em,retryFn,msg){
  var isAuth=/invalid.{0,10}key|api.{0,6}key|authentication_error|401|permission_denied/i.test(msg);
  if(isAuth){
    var kw=document.createElement("div");kw.style.cssText="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;";
    var ki=document.createElement("input");ki.type="password";ki.placeholder="Paste new API key…";ki.autocomplete="off";
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
      a.arcs=(a.arcs||[]).map(function(arc){return Object.assign({},arc,{status:"pending"});});
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
      for(j=0;j<skel.acts[i].arcs.length;j++){skel.acts[i].arcs[j].status=(i===0&&(isP||j===0))?"active":"pending";}
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
  // Custom rules from the blueprint
  if(bp.rules&&bp.rules.length){
    var ri;for(ri=0;ri<bp.rules.length;ri++){
      if(customRules.indexOf(bp.rules[ri])===-1)customRules.push(bp.rules[ri]);
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
async function generateSkeleton(){
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
    +'"acts":['
    +'{"title":"Act 1 title","goal":"What must be accomplished","turningPoint":"The event that ends this act and propels into the next","parallel":false,"arcs":['
    +'{"title":"Arc title","objective":"What the player pursues in this arc","type":"combat or investigation or exploration or social"'+(_skelDNA?',"dnaHint":"One vivid sentence: how THIS arc should feel and unfold in the narrative design above — specific to this arc, never generic procedure"':'')+'}]},'
    +'{"title":"Act 2 title","goal":"...","turningPoint":"...","parallel":true,"arcs":[{"title":"...","objective":"...","type":"..."'+(_skelDNA?',"dnaHint":"..."':'')+'}]},'
    +'{"title":"Act 3 title","goal":"...","turningPoint":"The climax/resolution","parallel":false,"arcs":[{"title":"...","objective":"...","type":"..."'+(_skelDNA?',"dnaHint":"..."':'')+'}]}'
    +"]}\n\n"
    +"RULES:\n"
    +(_skelDNA?"- Each arc MUST include a dnaHint: one concrete sentence telling the GM how to run THAT specific arc in the narrative design above. NOT generic procedure — e.g. for an investigation arc, not 'gather clues and interrogate' but how this author would twist it (who the clues implicate, what the truth costs, where the betrayal lies). The dnaHint is what keeps the campaign in voice turn after turn, so make it sharp and specific to the arc's content.\n":"")
    +"- Each act should have 2-4 arcs\n"
    +"- Act 1: establish the world, introduce the threat, end with a revelation or loss\n"
    +"- Act 2: escalation, alliances, setbacks — the longest act\n"
    +"- Act 3: convergence and climax — the shortest act\n"
    +"- Arcs are waypoints, not scripts — leave room for player agency between them\n"
    +(c.flaw?"- The character's flaw should be a source of tension, not just flavor\n":"")
    +(c.motivation?"- Weave the motivation into the central conflict so pursuing the plot IS pursuing the motivation\n":"- Weave the character's backstory into the central conflict so pursuing the plot IS personal\n")
    +"- Each arc has a type: combat (fights, sieges, hunts), investigation (mysteries, clues, interrogation), exploration (travel, discovery, mapping), or social (politics, alliances, persuasion). Mix types within an act for variety.\n"
    +"- An act may be parallel:true — its arcs can be pursued in any order (sandbox). Use this when the narrative supports it (e.g. investigating multiple leads, visiting locations in any order). Acts 1 and 3 are usually sequential; Act 2 is often parallel.";
  var prov=PROVIDERS[activeProvider]||PROVIDERS.anthropic;
  var skelModel=(allowModelUpgrade&&prov.upgradeModel)?prov.upgradeModel:null;
  var resp=await callGM(prompt,"You are a campaign architect for a tabletop RPG. Output ONLY valid JSON. No prose, no markdown, no backticks.",8192,skelModel,{kind:"skeleton"});
  var skel=JSON.parse(repairModelJson(resp)); // shared cleanup (api.js) — covered by test.html
  if(!skel.premise||!skel.acts||skel.acts.length!==3)throw new Error("Invalid skeleton structure");
  var ai,aj;for(ai=0;ai<skel.acts.length;ai++){skel.acts[ai].status=ai===0?"active":"pending";if(!skel.acts[ai].arcs||!skel.acts[ai].arcs.length)throw new Error("Act "+(ai+1)+" has no arcs");var isParallel=!!skel.acts[ai].parallel;for(aj=0;aj<skel.acts[ai].arcs.length;aj++){skel.acts[ai].arcs[aj].status=(ai===0&&(isParallel||aj===0))?"active":"pending";}}
  worldState.skeleton=skel;saveCore();
}
async function beginAdventure(){
  busy=true;document.getElementById("sendbtn").disabled=true;var th=addMsg("thinking","The world stirs...");
  try{
    var c=worldState.character,w=worldState.world;
    var compNpcs=(worldState.npcs||[]).filter(function(n){return n.partyMember;});
    var compStr="";if(compNpcs.length){var cds=compNpcs.map(function(n){var s=n.charSheet;return n.name+(s?" ("+pronounsForGender(s.gender)+", "+s.cls+(s.archetypeNm?" ["+s.archetypeNm+"]":"")+", Lv"+s.level+")":"");});compStr=" They travel with companions: "+cds.join(", ")+". Use each companion's stated pronouns; never reassign a companion's gender. Introduce the full party together in the opening scene.";}
    var intro="Open the adventure at "+w.location+", "+w.region+", at "+w.time+". "+c.name+" is a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+"."+(c.trait?" Trait: "+c.trait+".":"")+(c.flaw?" Flaw: "+c.flaw+".":"")+(c.motivation?" Wants: "+c.motivation+".":"")+(c.backstory?" Backstory: "+c.backstory:"")+compStr+" Write a vivid 3-5 sentence opening. Give rich sensory detail. Plant an immediate hook. Do not end with suggested actions or a 'You could' line — action buttons are handled separately.";
    var resp=await callGM(intro);th.remove();applyMuts(resp);var clean=cleanTxt(resp),dice=diceTxt(resp);
    var narEl=addMsg("narrator",(dice||"")+"<p>"+escProse(clean)+"</p>",{replayText:clean,turn:worldState.turn});/* escProse: escape model output before it hits the story DOM (audit E11) */
    logTranscript("gm",clean,resp);
    if(typeof TTS!=="undefined")TTS.speakResponse(clean);
    sessionLog.push({role:"user",content:intro},{role:"assistant",content:resp});syncUI();saveAll();
    generateActions(narEl);
    processPendingCompanionSheets();// a join can land in the opening scene too (audit P2)
    _promptCampaignFolder();
  }catch(e){th.remove();var em=addMsg("system","Failed to start: "+e.message);if(_attachGMErrorUI(em,beginAdventure,e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
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
    var genderWord=c.gender==="F"?"female":c.gender==="NB"?"androgynous":"male";
    var charDesc=c.name+", a "+genderWord+" "+c.age+" "+c.ancestry+" "+c.cls+", "+c.appear+(c.mark?", "+c.mark:"");
    var rp="Write a detailed image generation prompt for the current scene. "
      +"Protagonist (describe exactly as written, do not invent appearance): "+charDesc+". "
      +"Spell out hair colour, eye colour, skin tone, clothing and visible gear explicitly. "
      +"Scene: "+w.location+", "+w.region+", "+w.time+", "+w.weather+". "
      +"Style: dark fantasy, dramatic lighting, painterly cinematic. "
      +"2-3 sentences. Output ONLY the prompt, no game tags.";
    var resp=await callGM(rp,"You are an image prompt writer for a dark fantasy RPG. Output ONLY the image generation prompt. Describe the protagonist's exact physical appearance with full specificity. No narration, no tags.");
    th.remove();
    var div=addMsg("render-out","");
    div.style.whiteSpace="normal";div.style.fontFamily="inherit";
    var imageUrl="",promptShown=false;

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
    toolbar.appendChild(saveBtn);toolbar.appendChild(portraitBtn);toolbar.appendChild(promptBtn);toolbar.appendChild(closeBtn);
    div.appendChild(toolbar);

    if(falKey){
      var imgStatus=document.createElement("div");
      imgStatus.style.cssText="font-size:12px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;";
      imgStatus.textContent="Generating image…";
      div.appendChild(imgStatus);
      try{
        var mdlCfg=RENDER_MODELS[0],mi2;for(mi2=0;mi2<RENDER_MODELS.length;mi2++){if(RENDER_MODELS[mi2].id===renderModel){mdlCfg=RENDER_MODELS[mi2];break;}}
        var portrait=worldState.character.portrait;
        var usingI2I=!!(portrait&&mdlCfg.img2img);
        if(usingI2I)imgStatus.textContent="Generating scene (portrait-seeded)…";
        var falEndpoint=usingI2I?mdlCfg.img2img.endpoint:mdlCfg.id;
        var falBody=usingI2I?mdlCfg.img2img.body(resp,portrait,img2imgStrength(mdlCfg)):mdlCfg.body(resp);
        var falRes=await fetch("https://fal.run/"+falEndpoint,{method:"POST",headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},body:JSON.stringify(falBody)});
        if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
        var falData=await falRes.json();
        if(falData.images&&falData.images[0]&&falData.images[0].url){
          imageUrl=falData.images[0].url;
          imgStatus.remove();
          var img=document.createElement("img");img.src=imageUrl;
          img.style.cssText="width:100%;border-radius:4px;display:block;";
          img.alt="Scene illustration";div.appendChild(img);
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
  var pj,ps;for(pj=0;pj<(worldState.npcs||[]).length;pj++){var _pn=worldState.npcs[pj];if(_pn.partyMember&&_pn.charSheet&&_pn.charSheet.spells){for(ps=0;ps<_pn.charSheet.spells.length;ps++){if(_pn.charSheet.spells[ps].lvl>0)_pn.charSheet.spells[ps].used=false;}}}
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
async function syncCharSheet(){
  if(busy||!worldState)return;
  busy=true;
  if(typeof showToast==="function")showToast("Syncing sheet…");
  var companions=[];var pi;for(pi=0;pi<worldState.npcs.length;pi++){if(worldState.npcs[pi].partyMember&&worldState.npcs[pi].charSheet)companions.push(worldState.npcs[pi].name);}
  var compLine=companions.length?"Party members to also audit: "+companions.join(", ")+". For each use COMPANION_ prefixed tags: [COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_CONDITION:Name|cond|dur] [COMPANION_CONDITION_REMOVED:Name|cond] [COMPANION_ALIGNMENT:Name|law+1].":"";
  var auditMsg="[GM SHEET SYNC — internal, not a player action] Audit ALL character sheets against events in this session. "
    +"Emit ONLY state tags — zero prose, zero narration, zero 'You could' line. "
    +"For the player — allowed tags: [RELATIONSHIP:entity|descriptor] [RELATIONSHIP_REMOVED:entity] [CONDITION:name|duration] [CONDITION_REMOVED:name] "
    +"[NPC:name|status|relation] [QUEST:title|status] [ALIGNMENT:law+1] (or law-1/good+1/good-1). "
    +compLine+" "
    +"Do NOT emit XP, HP, GOLD, ITEM_GAINED, or ITEM_LOST tags — those are tracked turn-by-turn. "
    +"Only emit tags for things that have actually changed or are genuinely missing. "
    +"If nothing needs updating, reply with a single period only.";
  try{
    var resp=await callGM(auditMsg,null,500,null,{kind:"sync"});
    applyMuts(resp);
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
    snapshotActiveCamp();
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    var nid=newCampaignId();setActiveCampId(nid);
    worldState=null;sessionLog=[];memory=blankMemory();
    pendingCompanions=[];
    document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
    showChar();
  });
}
