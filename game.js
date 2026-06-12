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
  worldState={ver:10,campId:getActiveCampId(),campName:char._campName||char.name,legacyCharsUsed:[],pendingLegacy:null,character:char,world:{location:char._startLoc||"The Crossroads of Ashenveil",region:"The Blighted Reach",time:"dusk",weather:"cold wind carrying ash",threat:"low",sublocation:null},tone:{name:toneName||"Sword and Sorcery",voice:toneVoice||""},npcs:[],questLog:[],eventHistory:[],combat:null,turn:0};
  delete worldState.character._startLoc;delete worldState.character._campName;
  sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
  // Add any companions selected during character creation
  var ci;for(ci=0;ci<pendingCompanions.length;ci++){
    var comp=pendingCompanions[ci];
    worldState.npcs.push({name:comp.name,status:"ally",rel:"companion",met:0,partyMember:true,portrait:comp.portrait||null,charSheet:comp});
    memory.npcs[comp.name]={attitude:"ally",knowledge:[],events:[],partyMember:true};
    npcLinkUpsert(char.name,comp.name,"companions");
  }
  pendingCompanions=[];
  saveAll();showGame();syncUI();initAbilities();initSpells();
  addMsg("system",char.name+" the "+char.cls+" enters the world.");
  if(typeof initCampaignFolderForGame==="function")initCampaignFolderForGame();
  beginAdventure();
}
function checkLegacyCharacter(){
  if(!legacyCharsOn||!worldState)return;
  if(!worldState.legacyCharsUsed)worldState.legacyCharsUsed=[];
  if(worldState.pendingLegacy)return;
  if(Math.random()*100>=legacyChancePct)return;
  var meta=getCampMeta(),activeId=getActiveCampId(),candidates=[],i;
  for(i=0;i<meta.length;i++){
    if(meta[i].id===activeId)continue;
    var raw=store.get("tnd_camp_"+meta[i].id+"_ws");if(!raw)continue;
    try{
      var ws=JSON.parse(raw);var ch=ws&&ws.character;
      if(!ch||!ch.name)continue;
      if(worldState.legacyCharsUsed.indexOf(ch.name)>=0)continue;
      if(worldState.character&&ch.name===worldState.character.name)continue;
      candidates.push(ch);
    }catch(e){}
  }
  if(!candidates.length)return;
  var pick=candidates[Math.floor(Math.random()*candidates.length)];
  worldState.pendingLegacy={name:pick.name,cls:pick.cls||"",ancestry:pick.subraceNm||pick.ancestry||"",level:pick.level||1,backstory:pick.backstory||"",trait:pick.trait||"",queuedAt:worldState.turn};
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
  document.body.appendChild(modal);window._sbPicks=[];
}
function sbPick(s,v,btn){
  var c=worldState.character,picks=window._sbPicks||[],pi;
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s&&picks[pi].v===v){picks.splice(pi,1);window._sbPicks=picks;btn.style.borderColor="#444";btn.style.color="var(--t0)";document.getElementById("sb-cur-"+s).textContent=c.stats[s];document.getElementById("sb-cur-"+s).style.color="var(--t0)";document.getElementById("sb-warn").textContent="";return;}}
  if(c.stats[s]+v>20){document.getElementById("sb-warn").textContent=s+" at max.";return;}
  var total=0;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total+v>2){document.getElementById("sb-warn").textContent="Max +2.";return;}
  if(v===2&&picks.length>0){document.getElementById("sb-warn").textContent="+2 = one stat only.";return;}
  if(v===1){for(pi=0;pi<picks.length;pi++){if(picks[pi].v===2){document.getElementById("sb-warn").textContent="Can't mix.";return;}}}
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s){document.getElementById("sb-warn").textContent=s+" already picked.";return;}}
  picks.push({s:s,v:v});window._sbPicks=picks;document.getElementById("sb-warn").textContent="";btn.style.borderColor="var(--acc)";btn.style.color="var(--acc)";document.getElementById("sb-cur-"+s).textContent=c.stats[s]+v;document.getElementById("sb-cur-"+s).style.color="var(--acc)";
}
function sbBack(){var m=document.getElementById("sb-modal");if(m)m.remove();}
function sbConfirm(){var picks=window._sbPicks||[];var total=0,pi;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total!==2){document.getElementById("sb-warn").textContent="Must spend +2.";return;}var c=worldState.character;for(pi=0;pi<picks.length;pi++)c.stats[picks[pi].s]+=picks[pi].v;var m=document.getElementById("sb-modal");if(m)m.remove();addMsg("system","Stats: "+picks.map(function(p){return p.s+"+"+p.v;}).join(", "));syncUI();saveAll();}
function sendSuggestedAction(btn){
  var action=btn.getAttribute("data-action");if(!action)return;
  var msgs=document.getElementById("story-narrative").querySelectorAll(".msg.narrator");
  if(msgs.length){var last=msgs[msgs.length-1];var btndivs=last.querySelectorAll(".qa");if(btndivs.length){var parent=btndivs[0].parentElement;if(parent)parent.remove();}}
  sendAction(action);
}
async function sendAction(override){
  if(busy||!worldState)return;var inp=document.getElementById("userinput");
  var txt=override!==null?override:inp.value.trim();if(!txt)return;
  var isTT=activeChatTab==="tabletalk";
  busy=true;inp.value="";document.getElementById("sendbtn").disabled=true;lastAction=txt;
  addMsg(isTT?"tabletalk":"player",isTT?"[Table Talk] "+txt:txt);
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
      var clean=cleanTxt(resp),dice=diceTxt(resp),parsed=parseActions(clean);
      addMsg("narrator",(dice||"")+"<p>"+parsed.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(parsed.btns||""),{replayText:parsed.clean});
      if(typeof TTS!=="undefined")TTS.speakResponse(parsed.clean);
      sessionLog.push({role:"user",content:txt},{role:"assistant",content:resp});
      saveAll();if(worldState.turn>0&&worldState.turn%10===0&&!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))exportNarrative();
    }
    syncUI();
  }catch(e){th.remove();var em=addMsg("system","GM error: "+e.message);if(_attachGMErrorUI(em,function(){retryLast();},e.message))return;}
  busy=false;document.getElementById("sendbtn").disabled=false;document.getElementById("userinput").focus();
}
function retryLast(){if(lastAction)sendAction(lastAction);}
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
    var rb=document.createElement("button");rb.className="qa";rb.textContent="Retry";rb.onclick=retryFn;em.appendChild(rb);
    return false;
  }
}
async function beginAdventure(){
  busy=true;document.getElementById("sendbtn").disabled=true;var th=addMsg("thinking","The world stirs...");
  try{
    var c=worldState.character,w=worldState.world;
    var compNpcs=(worldState.npcs||[]).filter(function(n){return n.partyMember;});
    var compStr="";if(compNpcs.length){var cds=compNpcs.map(function(n){var s=n.charSheet;return n.name+(s?" ("+s.cls+(s.archetypeNm?" ["+s.archetypeNm+"]":"")+", Lv"+s.level+")":"");});compStr=" They travel with companions: "+cds.join(", ")+". Introduce the full party together in the opening scene.";}
    var intro="Open the adventure at "+w.location+", "+w.region+", at "+w.time+". "+c.name+" is a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Trait: "+c.trait+". Flaw: "+c.flaw+". Wants: "+c.motivation+"."+compStr+" Write a vivid 3-5 sentence opening. Give rich sensory detail. Plant an immediate hook. End with *You could [A]; [B]; or [C].* as always, using semicolons to separate options.";
    var resp=await callGM(intro);th.remove();applyMuts(resp);var clean=cleanTxt(resp),dice=diceTxt(resp),parsed=parseActions(clean);
    addMsg("narrator",(dice||"")+"<p>"+parsed.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(parsed.btns||""),{replayText:parsed.clean});
    if(typeof TTS!=="undefined")TTS.speakResponse(parsed.clean);
    sessionLog.push({role:"user",content:intro},{role:"assistant",content:resp});syncUI();saveAll();
    _promptCampaignFolder();
  }catch(e){th.remove();var em=addMsg("system","Failed to start: "+e.message);if(_attachGMErrorUI(em,beginAdventure,e.message))return;}
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
