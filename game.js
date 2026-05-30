function startGame(char,toneName,toneVoice){
  worldState={ver:8,character:char,world:{location:char._startLoc||"The Crossroads of Ashenveil",region:"The Blighted Reach",time:"dusk",weather:"cold wind carrying ash",threat:"low"},tone:{name:toneName||"Sword and Sorcery",voice:toneVoice||""},npcs:[],questLog:[],eventHistory:[],combat:null,turn:0};
  delete worldState.character._startLoc;
  sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[]};
  saveAll();showGame();syncUI();initAbilities();initSpells();
  addMsg("system",char.name+" the "+char.cls+" enters the world.");
  beginAdventure();
}
function checkLevelUp(){
  if(!worldState)return;var c=worldState.character,newLvl=getLvl(c.xp);if(newLvl<=c.level)return;
  var oldLvl=c.level;c.level=newLvl;var i,cls=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===c.cls){cls=CLSS[i];break;}}
  var hpGain=cls?Math.ceil(cls.hd/2)+1+Math.floor((c.stats.CON-10)/2):3;hpGain=Math.max(1,hpGain);c.maxHp+=hpGain;c.hp+=hpGain;
  addMsg("system","Level up! "+oldLvl+" -> "+newLvl+" | HP +"+hpGain+" (now "+c.maxHp+")");
  var features=CLASS_FEATURES[c.cls]||{};if(features[newLvl]){if(!c.abilities)c.abilities=[];c.abilities.push({nm:"Lv"+newLvl,ds:features[newLvl],gained:worldState.turn});addMsg("narrator","<p><em>"+features[newLvl]+"</em></p>");updateAbPanel(true);}
  syncUI();saveAll();
  if(newLvl===3&&!c.archetype)showArchetypeModal();
  else if(STAT_BUMP_LEVELS.indexOf(newLvl)>=0)showStatBumpModal();
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
    if(!isTT)worldState.turn++;
    var sys=isTT?"STRICT OUT-OF-CHARACTER MODE. The player is speaking to you as the GM, not as a character in the story. YOUR RESPONSE MUST CONTAIN ZERO narrative prose, ZERO second-person story description, ZERO scene-setting, and ZERO story advancement. Do not describe what the player character does, sees, or experiences. Do not use phrases like 'you slip', 'you notice', 'ahead lies', or any story language. Respond ONLY in plain first-person GM voice -- conversational, direct, factual. Answer their question or engage with their comment as a game master would between sessions. Any narrative content in your response is a STRICT VIOLATION of these instructions.":null;
    var resp=await callGM(txt,sys);th.remove();
    if(isTT){addMsg("tabletalk","<em>[GM]</em> "+resp.replace(/\*(.*?)\*/g,"<em>$1</em>"));}
    else{
      applyMuts(resp);var clean=cleanTxt(resp),dice=diceTxt(resp),parsed=parseActions(clean);
      addMsg("narrator",(dice||"")+"<p>"+parsed.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(parsed.btns||""));
      sessionLog.push({role:"user",content:txt},{role:"assistant",content:resp});
      saveAll();if(worldState.turn>0&&worldState.turn%10===0)exportNarrative();
    }
    syncUI();
  }catch(e){th.remove();var em=addMsg("system","GM error: "+e.message);var rb=document.createElement("button");rb.className="qa";rb.textContent="Retry";rb.onclick=function(){retryLast();};em.appendChild(rb);}
  busy=false;document.getElementById("sendbtn").disabled=false;document.getElementById("userinput").focus();
}
function retryLast(){if(lastAction)sendAction(lastAction);}
async function beginAdventure(){
  busy=true;document.getElementById("sendbtn").disabled=true;var th=addMsg("thinking","The world stirs...");
  try{
    var c=worldState.character,w=worldState.world;
    var intro="Open the adventure at "+w.location+", "+w.region+", at "+w.time+". "+c.name+" is a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Trait: "+c.trait+". Flaw: "+c.flaw+". Wants: "+c.motivation+". Write a vivid 3-5 sentence opening. Give rich sensory detail. Plant an immediate hook. End with *You could [A]; [B]; or [C].* as always, using semicolons to separate options.";
    var resp=await callGM(intro);th.remove();applyMuts(resp);var clean=cleanTxt(resp),dice=diceTxt(resp),parsed=parseActions(clean);
    addMsg("narrator",(dice||"")+"<p>"+parsed.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(parsed.btns||""));
    sessionLog.push({role:"user",content:intro},{role:"assistant",content:resp});syncUI();saveAll();
  }catch(e){th.remove();var em=addMsg("system","Failed to start: "+e.message);var rb=document.createElement("button");rb.className="qa";rb.textContent="Retry";rb.onclick=beginAdventure;em.appendChild(rb);}
  busy=false;document.getElementById("sendbtn").disabled=false;
}
async function doRender(){
  if(!worldState||busy)return;busy=true;var th=addMsg("thinking","Composing scene...");
  try{
    var c=worldState.character,w=worldState.world;
    var rp="Write an image generation prompt for the current scene. Photorealistic, 50mm lens, cinematic lighting, shallow depth of field. Include: environment ("+w.location+", "+w.time+", "+w.weather+"), protagonist ("+c.age+" "+c.ancestry+" "+c.cls+", "+c.appear+"), any present NPCs, mood, composition. Output ONLY the prompt, 2-3 sentences, no game tags.";
    var resp=await callGM(rp,"You are an image prompt writer. Output ONLY the image generation prompt text. No narration, no tags, no game content.");
    th.remove();var div=addMsg("render-out",resp);
    var cb=document.createElement("button");cb.className="copy-btn";cb.textContent="Copy";cb.onclick=function(){try{navigator.clipboard.writeText(resp);cb.textContent="Copied!";}catch(e){cb.textContent="Select manually";}};
    div.appendChild(cb);
  }catch(e){th.remove();addMsg("system","Render failed: "+e.message);}
  busy=false;
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
function newGame(){
  var modal=document.createElement("div");modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML='<div style="background:#181818;border:1px solid #6a2020;border-radius:10px;padding:28px 24px;max-width:340px;width:90%;text-align:center;"><p style="font-size:16px;color:var(--t0);margin-bottom:8px;">Start a new game?</p><p style="font-size:13px;color:var(--t2);margin-bottom:24px;">Current save will be permanently deleted.</p><div style="display:flex;gap:10px;"><button id="ng-cancel" style="flex:1;padding:10px;font-family:Georgia,serif;background:#222;border:1px solid #444;border-radius:6px;color:var(--t1);cursor:pointer;">Cancel</button><button id="ng-go" style="flex:1;padding:10px;font-family:Georgia,serif;background:#6a2020;border:1px solid #8b2a2a;border-radius:6px;color:var(--t0);cursor:pointer;font-weight:bold;">New game</button></div></div>';
  document.body.appendChild(modal);
  document.getElementById("ng-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("ng-go").addEventListener("click",function(){modal.remove();store.del(WSK);store.del(SLK);store.del(MEM_KEY);store.del(RLK);worldState=null;sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[]};document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showChar();});
}
