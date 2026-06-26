function startGame(char,toneName,toneVoice){
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
  worldState={ver:10,campId:getActiveCampId(),campName:char._campName||char.name,legacyCharsUsed:[],pendingLegacy:null,character:char,world:{location:char._startLoc||"The Crossroads of Ashenveil",region:"The Blighted Reach",time:"dusk",weather:"cold wind carrying ash",threat:"low",sublocation:null},tone:{name:toneName||"Sword and Sorcery",voice:toneVoice||""},npcs:[],questLog:[],eventHistory:[],combat:null,turn:0,transcript:[]};
  delete worldState.character._startLoc;delete worldState.character._campName;
  sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
  // Add any companions selected during character creation
  var ci;for(ci=0;ci<pendingCompanions.length;ci++){
    var comp=pendingCompanions[ci];
    worldState.npcs.push({name:comp.name,status:"ally",rel:"companion",met:0,partyMember:true,pronouns:pronounsForGender(comp.gender),portrait:comp.portrait||null,charSheet:comp});
    memory.npcs[comp.name]={attitude:"ally",knowledge:[],events:[],partyMember:true,pronouns:pronounsForGender(comp.gender)};
    npcLinkUpsert(char.name,comp.name,"companions");
  }
  pendingCompanions=[];
  // Apply campaign blueprint if one was loaded (.campaign file)
  if(pendingBlueprint){
    applyBlueprint(pendingBlueprint);
    pendingBlueprint=null;
  }
  saveAll();showGame();syncUI();initAbilities();initSpells();
  addMsg("system",char.name+" the "+char.cls+" enters the world.");
  if(typeof initCampaignFolderForGame==="function")initCampaignFolderForGame();
  if(worldState.skeleton){
    // Blueprint provided a skeleton — skip generation, go straight to the adventure
    beginAdventure();
  }else{
    // Generate the campaign skeleton, then open the adventure. If skeleton generation fails
    // (network, parse, bad provider), log it and start anyway — the game works without one.
    var _skMsg=addMsg("thinking","Forging the campaign...");
    generateSkeleton().then(function(){_skMsg.remove();beginAdventure();}).catch(function(e){_skMsg.remove();showToast("Campaign skeleton failed — playing freeform");if(typeof console!=="undefined")console.warn("[skeleton] "+e.message);beginAdventure();});
  }
}
async function generateActions(msgEl){
  var btnDiv=document.createElement("div");
  btnDiv.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;";
  var btns=[],i;
  for(i=0;i<3;i++){var b=document.createElement("button");b.className="qa";b.textContent="…";b.disabled=true;b.style.minWidth="80px";btnDiv.appendChild(b);btns.push(b);}
  msgEl.appendChild(btnDiv);
  try{
    var resp=await callGM("Based on what just happened, suggest exactly 3 short actions the player could take next. Output ONLY a JSON array of 3 strings, each under 10 words. No prose, no markdown, no backticks.","You suggest player actions for a tabletop RPG. Output ONLY a valid JSON array of 3 short strings.",200);
    var cleaned=resp.replace(/```json/g,"").replace(/```/g,"").trim();
    var acts=JSON.parse(cleaned);
    if(!acts||!acts.length)return;
    for(i=0;i<3&&i<acts.length;i++){var a=acts[i].trim();btns[i].textContent=a;btns[i].setAttribute("data-action",a);btns[i].setAttribute("title","Tap to edit · hold or Ctrl-click to send");btns[i].setAttribute("onclick","sendSuggestedAction(this,event)");btns[i].disabled=false;}
    worldState.lastActions=acts.slice(0,3);saveCore();
  }catch(e){for(i=0;i<3;i++)btns[i].parentNode.removeChild(btns[i]);if(btnDiv.parentNode)btnDiv.parentNode.removeChild(btnDiv);}
}
function buildActionButtons(acts){
  if(!acts||!acts.length)return"";
  var h='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">',i;
  for(i=0;i<acts.length;i++){h+='<button class="qa" title="Tap to edit · hold or Ctrl-click to send" onclick="sendSuggestedAction(this,event)" data-action="'+acts[i].replace(/"/g,"&quot;")+'">'+acts[i]+'</button>';}
  return h+"</div>";
}
// Fetch the Character Library once and cache it; legacy candidates are drawn from this (server-side)
// pool rather than from other campaigns. Async, so checkLegacyCharacter rolls against the cache.
function loadLegacyLibrary(){
  if(!legacyCharsOn||legacyLibLoading)return;
  if(typeof storageAdapter==="undefined"||!storageAdapter.listCharLibrary)return;
  legacyLibLoading=true;
  storageAdapter.listCharLibrary(function(err,list){
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
function checkLevelUp(){
  if(!worldState)return;var c=worldState.character,newLvl=getLvl(c.xp);if(newLvl<=c.level)return;
  var oldLvl=c.level;c.level=newLvl;var i,cls=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===c.cls){cls=CLSS[i];break;}}
  var hpGain=cls?Math.ceil(cls.hd/2)+1+Math.floor((c.stats.CON-10)/2):3;hpGain=Math.max(1,hpGain);c.maxHp+=hpGain;c.hp+=hpGain;
  addMsg("system","Level up! "+oldLvl+" -> "+newLvl+" | HP +"+hpGain+" (now "+c.maxHp+")");
  var features=CLASS_FEATURES[c.cls]||{};if(features[newLvl]){if(!c.abilities)c.abilities=[];c.abilities.push({nm:"Lv"+newLvl,ds:features[newLvl],gained:worldState.turn});addMsg("narrator","<p><em>"+features[newLvl]+"</em></p>");updateAbPanel(true);}
  if(newLvl===3&&!c.archetype)showArchetypeModal();
  else if(STAT_BUMP_LEVELS.indexOf(newLvl)>=0)showStatBumpModal();
}
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
  var src=SPELLS[c.cls]||ARCH_SPELLS[arch.id];if(src&&(!c.spells||!c.spells.length)){if(!c.spells)c.spells=[];var i;if(src.cantrips){for(i=0;i<src.cantrips.length;i++)c.spells.push({nm:src.cantrips[i],lvl:0,used:false});}if(src[1]){for(i=0;i<src[1].length;i++)c.spells.push({nm:src[1][i],lvl:1,used:false});}}
  var m=document.getElementById("arch-modal");if(m)m.remove();addMsg("system","Archetype: "+arch.nm);updateAbPanel(true);initSpells();syncUI();saveAll();
}
function showStatBumpModal(){
  var c=worldState.character;var ex=document.getElementById("sb-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="sb-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  var rh="",i;for(i=0;i<STATS.length;i++){var s=STATS[i];rh+="<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'><span style='width:36px;font-weight:bold;color:var(--t1);'>"+s+"</span><span style='width:32px;font-size:16px;font-weight:bold;' id='sb-cur-"+s+"'>"+c.stats[s]+"</span><button onclick=\"sbPick('"+s+"',1,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:Georgia,serif;'>+1</button><button onclick=\"sbPick('"+s+"',2,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:Georgia,serif;'>+2</button></div>";}
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:380px;width:100%;'><div style='font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;'>Stat Improvement</div><div style='font-size:13px;color:var(--t2);margin-bottom:18px;'>+2 to one or +1 to two. Max 20.</div>"+rh+"<p id='sb-warn' style='font-size:12px;color:#c04040;min-height:16px;'></p><div style='display:flex;gap:10px;'><button onclick='sbBack()' style='padding:10px 18px;font-family:Georgia,serif;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg1);color:var(--t0);cursor:pointer;'>Back</button><button onclick='sbConfirm()' style='flex:1;padding:12px;font-size:14px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Confirm</button></div></div>";
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
function sbConfirm(){var picks=_sbPicks||[];var total=0,pi;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total!==2){document.getElementById("sb-warn").textContent="Must spend +2.";return;}var c=worldState.character;for(pi=0;pi<picks.length;pi++)c.stats[picks[pi].s]+=picks[pi].v;var m=document.getElementById("sb-modal");if(m)m.remove();addMsg("system","Stats: "+picks.map(function(p){return p.s+"+"+p.v;}).join(", "));syncUI();saveAll();}
// A plain tap POPULATES the input (editable) so the player can tweak/combine before sending.
// Ctrl/Cmd-click (desktop) or a long-press (mobile, handled in wireButtons) EXECUTES immediately.
function sendSuggestedAction(btn,ev){
  var action=btn.getAttribute("data-action");if(!action)return;
  if(Date.now()<_qaSuppressUntil){_qaSuppressUntil=0;return;} // a long-press already executed this; swallow the trailing click
  if(ev&&(ev.ctrlKey||ev.metaKey)){if(!busy)sendAction(toFirstPerson(action));return;}
  var inp=document.getElementById("userinput");if(!inp)return;
  var fp=toFirstPerson(action);
  inp.value=fp;inp.focus();
  try{inp.setSelectionRange(fp.length,fp.length);}catch(e){}
}
async function sendAction(override,opts){
  if(busy||!worldState)return;var inp=document.getElementById("userinput");
  var txt=override!==null?override:inp.value.trim();if(!txt)return;
  var isTT=activeChatTab==="tabletalk";
  busy=true;inp.value="";document.getElementById("sendbtn").disabled=true;lastAction=txt;
  if(!(opts&&opts.silent))addMsg(isTT?"tabletalk":"player",isTT?"[Table Talk] "+txt:txt);
  if(!isTT&&!(opts&&opts.silent))logTranscript("player",txt);
  var th=addMsg("thinking","The world turns...");
  try{
    if(!isTT&&sessionTokens()>=1000)await summarize();
    var sys=isTT?"STRICT OUT-OF-CHARACTER MODE. The player is speaking to you as the GM, not as a character in the story. YOUR RESPONSE MUST CONTAIN ZERO narrative prose, ZERO second-person story description, ZERO scene-setting, and ZERO story advancement. Do not describe what the player character does, sees, or experiences. Do not use phrases like 'you slip', 'you notice', 'ahead lies', or any story language. Respond ONLY in plain first-person GM voice -- conversational, direct, factual. Answer their question or engage with their comment as a game master would between sessions. Any narrative content in your response is a STRICT VIOLATION of these instructions.":null;
    var resp=await callGM(txt,sys);th.remove();
    if(isTT){addMsg("tabletalk","<em>[GM]</em> "+resp.replace(/\*(.*?)\*/g,"<em>$1</em>"));}
    else{
      worldState.turn++;
      // Order is significant: applyMuts on raw text first, then cleanTxt strips tags, then parseActions on clean text.
      applyMuts(resp);
      if(worldState.pendingLegacy){var _lcn=worldState.pendingLegacy.name;if(resp.indexOf(_lcn)>=0||(worldState.turn-worldState.pendingLegacy.queuedAt)>=5){if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];worldState.legacyCharsUsed.push(_lcn);worldState.pendingLegacy=null;}}
      if(worldState.recentSwitch&&(worldState.turn-worldState.recentSwitch.turn)>=2)worldState.recentSwitch=null; // POV reinforcement done; sessionLog now carries new-POV turns
      if(worldState.recentlyLeft){worldState.recentlyLeft=worldState.recentlyLeft.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentlyLeft.length)worldState.recentlyLeft=null;}
      var clean=cleanTxt(resp),dice=diceTxt(resp);
      var narEl=addMsg("narrator",(dice||"")+"<p>"+clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>",{replayText:clean});
      logTranscript("gm",clean);
      if(typeof TTS!=="undefined")TTS.speakResponse(clean);
      sessionLog.push({role:"user",content:txt},{role:"assistant",content:resp});
      saveAll();if(worldState.turn>0&&worldState.turn%10===0&&!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))exportNarrative();
      generateActions(narEl);
    }
    syncUI();
  }catch(e){th.remove();var em=addMsg("system","GM error: "+e.message);if(_attachGMErrorUI(em,function(){retryLast();},e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
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
  var prevA=sessionLog.pop(),prevU=sessionLog.pop(); // context is now just before the last action
  var th=addMsg("thinking","Re-rolling the scene...");
  try{
    var resp=await callGM(prevU.content,null,1000); // current voice; no muts, no turn++
    th.remove();
    sessionLog.push({role:"user",content:prevU.content},{role:"assistant",content:resp});
    var clean=cleanTxt(resp),dice=diceTxt(resp);
    var story=document.getElementById("story-narrative");
    if(story){var nars=story.querySelectorAll(".msg.narrator");if(nars.length)nars[nars.length-1].parentNode.removeChild(nars[nars.length-1]);}
    var narEl=addMsg("narrator",(dice||"")+"<p>"+clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>",{replayText:clean});
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
    ki.style.cssText="flex:1;min-width:200px;padding:5px 8px;font-family:Georgia,serif;font-size:12px;background:var(--bg2);border:1px solid var(--acc);border-radius:var(--r);color:var(--t0);outline:none;";
    var kb=document.createElement("button");kb.className="qa";kb.textContent="Update & Retry";
    kb.onclick=function(){
      var k=ki.value.trim();if(!k)return;
      apiKey=k;try{localStorage.setItem(AKK,k);}catch(x){}
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
  if(!bp||typeof bp!=="object")return"Not a valid campaign file.";
  if(bp.format!=="tnd-campaign-v1")return"Unrecognised campaign format.";
  if(!bp.name)return"Campaign file has no name.";
  if(!bp.premise&&(!bp.acts||!bp.acts.length))return"Campaign file has no premise or acts.";
  if(bp.acts){
    var i,j;for(i=0;i<bp.acts.length;i++){
      var a=bp.acts[i];if(!a.title||!a.goal)return"Act "+(i+1)+" is missing a title or goal.";
      if(!a.arcs||!a.arcs.length)return"Act "+(i+1)+" has no arcs.";
      for(j=0;j<a.arcs.length;j++){if(!a.arcs[j].title||!a.arcs[j].objective)return"Act "+(i+1)+", arc "+(j+1)+" is missing a title or objective.";}
    }
  }
  return null;
}
function applyBlueprint(bp){
  // Skeleton — stamp act/arc status
  if(bp.acts&&bp.acts.length){
    var skel={premise:bp.premise||"",acts:bp.acts},i,j;
    for(i=0;i<skel.acts.length;i++){
      skel.acts[i].status=i===0?"active":"pending";
      var isP=!!skel.acts[i].parallel;
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
  // Locations — seed into memory.locations and memory.map
  if(bp.locations&&bp.locations.length){
    var li;for(li=0;li<bp.locations.length;li++){
      var loc=bp.locations[li];
      if(!memory.locations[loc.name])memory.locations[loc.name]={visits:0,notes:[]};
      if(loc.description)memory.locations[loc.name].notes.push(loc.description);
      if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
      if(!memory.map.nodes[loc.name])memory.map.nodes[loc.name]={firstVisit:null,visits:0,description:loc.description||null,parent:null,npcs:[],items:[]};
    }
  }
  // Custom rules from the blueprint
  if(bp.rules&&bp.rules.length){
    var ri;for(ri=0;ri<bp.rules.length;ri++){
      if(customRules.indexOf(bp.rules[ri])===-1)customRules.push(bp.rules[ri]);
    }
    saveRules();
  }
  // Region override
  if(bp.startingRegion)worldState.world.region=bp.startingRegion;
  // Store blueprint name on worldState for reference
  worldState.blueprintName=bp.name;
}
async function generateSkeleton(){
  var c=worldState.character,w=worldState.world,t=worldState.tone;
  var prompt="Design a three-act campaign skeleton for this RPG character and setting. Output ONLY valid JSON, no markdown.\n\n"
    +"CHARACTER: "+c.name+", "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+"\n"
    +(c.trait||c.flaw||c.motivation?(c.trait?"Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+(c.motivation?" | Motivation: "+c.motivation:"")+"\n":"")
    +(c.deity?"Deity: "+c.deity+"\n":"")
    +(c.backstory?"Backstory: "+c.backstory+"\n":"")
    +"SETTING: "+w.location+", "+w.region+" | Tone: "+(t&&t.name?t.name:"Sword and Sorcery")+"\n\n"
    +"Generate a campaign with a central conflict that ties to the character's backstory and personality. The story should feel personal, not generic.\n\n"
    +"JSON format:\n"
    +'{"premise":"One paragraph: the central conflict driving the campaign",'
    +'"acts":['
    +'{"title":"Act 1 title","goal":"What must be accomplished","turningPoint":"The event that ends this act and propels into the next","parallel":false,"arcs":['
    +'{"title":"Arc title","objective":"What the player pursues in this arc","type":"combat or investigation or exploration or social"}]},'
    +'{"title":"Act 2 title","goal":"...","turningPoint":"...","parallel":true,"arcs":[{"title":"...","objective":"...","type":"..."}]},'
    +'{"title":"Act 3 title","goal":"...","turningPoint":"The climax/resolution","parallel":false,"arcs":[{"title":"...","objective":"...","type":"..."}]}'
    +"]}\n\n"
    +"RULES:\n"
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
  var resp=await callGM(prompt,"You are a campaign architect for a tabletop RPG. Output ONLY valid JSON. No prose, no markdown, no backticks.",8192,skelModel);
  var cleaned=resp.replace(/```json/gi,"").replace(/```/g,"").trim();
  // Extract from first { to last } — discards any stray preamble/postamble
  var fi=cleaned.indexOf("{");if(fi>0)cleaned=cleaned.slice(fi);
  var li=cleaned.lastIndexOf("}");if(li>=0&&li<cleaned.length-1)cleaned=cleaned.slice(0,li+1);
  // Fix trailing commas before } or ]
  cleaned=cleaned.replace(/,\s*([}\]])/g,"$1");
  // Replace bare control characters (incl. literal newlines the model embeds in string values —
  // 0x0A inside a JSON string is invalid; the escaped form \\n is two chars and unaffected).
  cleaned=cleaned.replace(/[\x00-\x1F\x7F]/g," ");
  var skel=JSON.parse(cleaned);
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
    var narEl=addMsg("narrator",(dice||"")+"<p>"+clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>",{replayText:clean});
    logTranscript("gm",clean);
    if(typeof TTS!=="undefined")TTS.speakResponse(clean);
    sessionLog.push({role:"user",content:intro},{role:"assistant",content:resp});syncUI();saveAll();
    generateActions(narEl);
    _promptCampaignFolder();
  }catch(e){th.remove();var em=addMsg("system","Failed to start: "+e.message);if(_attachGMErrorUI(em,beginAdventure,e.message)){busy=false;document.getElementById("sendbtn").disabled=false;return;}}
  busy=false;document.getElementById("sendbtn").disabled=false;
}
function _promptCampaignFolder(){
  if(!window.showDirectoryPicker)return;  // browser doesn't support it
  if(typeof _campFolderHandle!=="undefined"&&_campFolderHandle)return;  // already set
  if(localStorage.getItem("tnd_folder_declined_v1"))return;  // user previously dismissed
  var banner=document.createElement("div");
  banner.style.cssText="position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--bg1);border:1px solid var(--acc);border-radius:var(--r);padding:12px 16px;z-index:500;display:flex;align-items:center;gap:12px;font-size:13px;font-family:Georgia,serif;color:var(--t1);box-shadow:0 4px 16px rgba(0,0,0,.5);max-width:420px;width:90%;";
  banner.innerHTML="<span>📁 Set a campaign folder to keep saves, renders, and logs organized?</span>"
    +"<button id='folder-yes' style='padding:6px 14px;font-size:12px;font-family:Georgia,serif;background:var(--acc);border:none;border-radius:var(--r);color:#000;cursor:pointer;white-space:nowrap;'>Set folder</button>"
    +"<button id='folder-no' style='padding:6px 10px;font-size:12px;font-family:Georgia,serif;background:none;border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;white-space:nowrap;'>Not now</button>";
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
    promptDiv.style.cssText="display:none;font-size:11px;color:var(--t2);line-height:1.6;margin-bottom:8px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--brd);white-space:pre-wrap;font-family:monospace;word-break:break-word;";
    promptDiv.textContent=resp;
    div.appendChild(promptDiv);

    // Utility toolbar
    var toolbar=document.createElement("div");
    toolbar.style.cssText="display:flex;gap:4px;margin-bottom:8px;";
    function mkBtn(label,title){
      var b=document.createElement("button");b.title=title;b.textContent=label;
      b.style.cssText="height:26px;padding:0 9px;font-size:11px;font-family:Georgia,serif;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--t1);cursor:pointer;";
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
        var falBody=usingI2I?mdlCfg.img2img.body(resp,portrait):mdlCfg.body(resp);
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
    var resp=await callGM(auditMsg,null,500);
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
  var modal=document.createElement("div");modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML='<div style="background:#181818;border:1px solid #6a2020;border-radius:10px;padding:28px 24px;max-width:340px;width:90%;text-align:center;"><p style="font-size:16px;color:var(--t0);margin-bottom:8px;">Start a new campaign?</p><p style="font-size:13px;color:var(--t2);margin-bottom:24px;">Your current playthrough will be saved and can be resumed from Campaigns.</p><div style="display:flex;gap:10px;"><button id="ng-cancel" style="flex:1;padding:10px;font-family:Georgia,serif;background:#222;border:1px solid #444;border-radius:6px;color:var(--t1);cursor:pointer;">Cancel</button><button id="ng-go" style="flex:1;padding:10px;font-family:Georgia,serif;background:#6a2020;border:1px solid #8b2a2a;border-radius:6px;color:var(--t0);cursor:pointer;font-weight:bold;">New game</button></div></div>';
  document.body.appendChild(modal);
  document.getElementById("ng-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("ng-go").addEventListener("click",function(){
    modal.remove();
    snapshotActiveCamp();
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    var nid=newCampaignId();setActiveCampId(nid);
    worldState=null;sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
    pendingCompanions=[];
    document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
    showChar();
  });
}
