function showToast(msg){var t=document.createElement("div");t.textContent=msg;t.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1800;border:1px solid var(--acc);color:var(--acc);padding:10px 20px;border-radius:20px;font-size:13px;font-family:Georgia,serif;z-index:400;pointer-events:none;";document.body.appendChild(t);setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.remove();},500);},2000);}
function showGame(){
  document.getElementById("char-screen").style.display="none";
  document.getElementById("game-screen").style.display="flex";
  var ca=document.getElementById("creation-arch");if(ca)ca.remove();
  var cb=document.getElementById("creation-bump");if(cb)cb.remove();
  var cs3=document.getElementById("creation-spells");if(cs3)cs3.remove();
}
function showChar(){
  document.getElementById("char-screen").style.display="block";
  document.getElementById("game-screen").style.display="none";
  cs={tone:null,name:"",pronouns:"he/him",age:"early twenties",appear:"",mark:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,step:1};
  buildDots();buildToneGrid();
}
function switchTab(tab){activeChatTab=tab;var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");var tn=document.getElementById("tab-narrative"),tt=document.getElementById("tab-tabletalk"),badge=document.getElementById("tab-tt-badge");sn.style.display=tab==="narrative"?"flex":"none";st.style.display=tab==="tabletalk"?"flex":"none";tn.className="chat-tab"+(tab==="narrative"?" active":"");tt.className="chat-tab"+(tab==="tabletalk"?" active":"");if(tab==="tabletalk"&&badge)badge.className="tab-badge";}
function addMsg(type,html){var isTTMsg=(type==="tabletalk");var story=document.getElementById(isTTMsg?"story-tabletalk":"story-narrative");var div=document.createElement("div");div.className="msg "+type;div.innerHTML=html;story.appendChild(div);story.scrollTop=story.scrollHeight;if(isTTMsg&&activeChatTab!=="tabletalk"){var badge=document.getElementById("tab-tt-badge");if(badge)badge.className="tab-badge on";}return div;}
function syncUI(){if(!worldState)return;updateHUD();updateInvPanel();updateAbPanel(false);updateSpPanel();updateMemStatus();if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}else{document.getElementById("cpanel").classList.remove("active");}}
function updateHUD(){
  if(!worldState)return;var c=worldState.character,w=worldState.world;
  document.getElementById("hud-name").textContent=c.name;
  document.getElementById("hud-cls").textContent=(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" Lv"+c.level;
  document.getElementById("hud-hp").textContent=c.hp+"/"+c.maxHp+" HP";
  document.getElementById("hud-gold").textContent=c.gold+" gp";
  document.getElementById("hud-align").textContent=c.actualAlignment||c.statedAlignment||"Neutral";
  document.getElementById("hud-loc").textContent=w.location;
  function sr(k,v){return'<div class="sb-row"><span class="sb-k">'+k+'</span><span class="sb-v">'+v+'</span></div>';}
  var sb=document.getElementById("sb-content");if(!sb)return;
  var i,statR="";for(i=0;i<STATS.length;i++)statR+=sr(STATS[i],c.stats[STATS[i]]+" ("+smod(c.stats[STATS[i]])+")");
  var npcR="";for(i=0;i<worldState.npcs.length;i++)npcR+=sr(worldState.npcs[i].name,worldState.npcs[i].status+" / "+worldState.npcs[i].rel);
  var qR="";for(i=0;i<worldState.questLog.length;i++)qR+=sr(worldState.questLog[i].title,worldState.questLog[i].status);
  sb.innerHTML='<div class="sb-sec">'+sr("Name",c.name)+sr("Class",c.cls)+sr("Level",c.level)+sr("XP",c.xp)+sr("HP",c.hp+"/"+c.maxHp)+sr("Gold",c.gold+" gp")+sr("Alignment",c.actualAlignment||"?")+'</div><div class="sb-sec">'+statR+'</div><div class="sb-sec">'+sr("Location",w.location)+sr("Time",w.time)+sr("Weather",w.weather)+'</div>'+(npcR?'<div class="sb-sec">'+npcR+'</div>':"")+(qR?'<div class="sb-sec">'+qR+'</div>':"");
}
function updateInvPanel(){
  if(!worldState)return;var inv=worldState.character.inventory,gold=worldState.character.gold;
  var weps=["sword","blade","axe","bow","staff","crossbow","knife","dagger","spear","mace","hammer","blades"];
  var arm=["armor","chainmail","leather","hide","shield","helm","cloak","mail","scale"];
  document.getElementById("inv-cnt").textContent=inv.length;document.getElementById("inv-gold").textContent=gold+" gp";
  var h="",i;for(i=0;i<inv.length;i++){var lc=inv[i].toLowerCase(),eq=false,j;for(j=0;j<weps.length;j++){if(lc.indexOf(weps[j])>=0){eq=true;break;}}if(!eq)for(j=0;j<arm.length;j++){if(lc.indexOf(arm[j])>=0){eq=true;break;}}h+='<div class="ii'+(eq?' eq':'')+'" title="'+inv[i]+'">'+inv[i]+'</div>';}
  document.getElementById("inv-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">Empty</div>';
}
function updateAbPanel(hl){
  if(!worldState)return;var abs=worldState.character.abilities||[];document.getElementById("ab-cnt").textContent=abs.length;
  var h="",i;for(i=0;i<abs.length;i++){h+='<div class="ai'+(hl&&i===abs.length-1?" nw":"")+'"><span class="an">'+abs[i].nm+'</span><span class="ad">'+abs[i].ds+'</span></div>';}
  document.getElementById("ab-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">None yet</div>';
}
function updateSpPanel(){
  if(!worldState)return;
  var spells=worldState.character.spells||[];
  var avail=spells.filter(function(s){return !s.used;}).length;
  document.getElementById("sp-cnt").textContent=avail+"/"+spells.length;
  var h="",i,sp,tag,nm,ds;
  for(i=0;i<spells.length;i++){
    sp=spells[i];
    tag=sp.lvl===0?"C":String(sp.lvl);
    nm=sp.nm.indexOf("(")>=0?sp.nm.slice(0,sp.nm.indexOf("(")).trim():sp.nm;
    ds=sp.nm.indexOf("(")>=0?sp.nm.slice(sp.nm.indexOf("(")+1).replace(")",""):"";
    h+="<div class='sp-item"+(sp.used?" used":"")+"'>";
    h+="<span class='sp-nm'>["+tag+"] "+nm+"</span>";
    if(ds||sp.used)h+="<span class='sp-ds'>"+(ds||"")+(sp.used?" -- expended":"")+"</span>";
    h+="</div>";
  }
  if(!h)h="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No spells</div>";
  else h+="<button onclick='restSpells()' style='width:100%;margin-top:6px;padding:5px;font-size:10px;font-family:Georgia,serif;background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Rest (restore spells)</button>";
  document.getElementById("sp-list").innerHTML=h;
}
function updateCombat(){if(!worldState||!worldState.combat)return;var cm=worldState.combat,pc=worldState.character;document.getElementById("ct-round").textContent="Round "+cm.round;document.getElementById("en-name").textContent=cm.name;document.getElementById("en-hpt").textContent=cm.hp+"/"+cm.maxHp;document.getElementById("en-hpbar").style.width=Math.max(0,Math.round((cm.hp/cm.maxHp)*100))+"%";document.getElementById("en-morale").textContent=cm.morale;document.getElementById("pl-name").textContent=pc.name;document.getElementById("pl-hpt").textContent=pc.hp+"/"+pc.maxHp;document.getElementById("pl-hpbar").style.width=Math.max(0,Math.round((pc.hp/pc.maxHp)*100))+"%";}
function updateMemStatus(){if(!worldState)return;var dot=document.getElementById("memdot"),txt=document.getElementById("memstatus");var t=sessionTokens();dot.className=t>=1000?"mdot c":t>=800?"mdot w":"mdot";txt.textContent="Session: ~"+t+"tk | Chapters: "+memory.chapters.length+" | NPCs: "+Object.keys(memory.npcs).length+" | Turn "+worldState.turn;}
function showRulesModal(){
  var ex=document.getElementById("rules-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="rules-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modal.appendChild(inner);document.body.appendChild(modal);
  function renderRules(){
    var h="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Narrative Rules</span><button id='rules-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div><div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>Strictly enforced on every GM response.</div>",i;
    for(i=0;i<DEFAULT_RULES.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);margin-bottom:6px;font-size:12px;display:flex;gap:8px;'><span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-top:1px;'>DEFAULT</span><span style='color:var(--t1);'>"+DEFAULT_RULES[i]+"</span></div>";}
    for(i=0;i<customRules.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--acc);border-radius:var(--r);margin-bottom:6px;font-size:12px;color:var(--t0);display:flex;justify-content:space-between;align-items:flex-start;gap:8px;'><span>"+customRules[i]+"</span><button onclick='removeRule("+i+")' style='background:none;border:none;color:#c04040;cursor:pointer;font-size:16px;flex-shrink:0;line-height:1;'>&#215;</button></div>";}
    h+="<div style='display:flex;gap:6px;margin-top:14px;'><input id='rules-new' type='text' placeholder='Add a custom rule...' class='sc-inp' style='flex:1;'/><button id='rules-add' style='padding:7px 14px;font-size:12px;font-family:Georgia,serif;background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>Add</button></div>";
    inner.innerHTML=h;
    document.getElementById("rules-x").addEventListener("click",function(){modal.remove();});
    document.getElementById("rules-add").addEventListener("click",function(){var v=document.getElementById("rules-new").value.trim();if(!v)return;customRules.push(v);saveRules();renderRules();});
  }
  renderRules();
}
function removeRule(idx){customRules.splice(idx,1);saveRules();showRulesModal();}
function toggleAdultMode(){adultMode=!adultMode;store.set(ADK,adultMode?"1":"");var cb=document.getElementById("fm-adult-cb");if(cb)cb.checked=adultMode;showToast(adultMode?"18+ content enabled":"18+ content disabled");}
function loadAdultMode(){var v=store.get(ADK);adultMode=!!(v&&v==="1");var cb=document.getElementById("fm-adult-cb");if(cb)cb.checked=adultMode;}

// ── Server connect / disconnect ──────────────────────────────────────────────
var ASHEN_SERVER_URL = "https://ashen-crown-server.fly.dev";

function updateServerUI(){
  var connected=storageAdapter.isServerMode();
  var btnConn=document.getElementById("fm-server-connect");
  var btnDisc=document.getElementById("fm-server-disconnect");
  if(btnConn) btnConn.style.display=connected?"none":"block";
  if(btnDisc) btnDisc.style.display=connected?"block":"none";
  if(connected){
    // Fetch username from server to show in button label
    fetch(ASHEN_SERVER_URL+"/auth/me",{headers:{"Authorization":"Bearer "+(localStorage.getItem("ashen_server_tok_v1")||"")}})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(d){
        var span=document.getElementById("fm-server-user");
        if(span&&d&&d.username) span.textContent=d.username;
      }).catch(function(){});
  }
}

function connectToServer(){
  storageAdapter.loginWithServer(ASHEN_SERVER_URL,function(err,info){
    if(err){showToast("Server login failed.");return;}
    updateServerUI();
    document.getElementById("file-menu").style.display="none";
    showToast("☁ Connected as "+info.username);
    // Fire an initial sync
    storageAdapter.syncToServer();
  });
}

function disconnectFromServer(){
  storageAdapter.logoutFromServer(function(){
    updateServerUI();
    document.getElementById("file-menu").style.display="none";
    showToast("☁ Disconnected from server.");
  });
}

function showSyncModal(){
  var ex=document.getElementById("sync-modal");if(ex)ex.remove();if(!worldState){showToast("No active game.");return;}
  var dir="ui";var modalDiv=document.createElement("div");modalDiv.id="sync-modal";modalDiv.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modalDiv.appendChild(inner);document.body.appendChild(modalDiv);
  function renderSync(){
    var c=worldState.character,w=worldState.world,isUI=(dir==="ui"),ro=isUI?"":"readonly";
    inner.innerHTML="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Sync World State</span><button id='sc-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +"<div style='font-size:11px;color:var(--t2);font-family:monospace;background:var(--bg2);padding:6px 10px;border-radius:4px;margin-bottom:14px;'>Lv "+c.level+" | XP "+c.xp+" | HP "+c.hp+"/"+c.maxHp+" | Gold "+c.gold+" | Turn "+worldState.turn+"</div>"
      +"<div style='display:flex;gap:8px;margin-bottom:16px;'><button id='sc-ui' class='sc-dir"+(isUI?" active":"")+"'>UI -> Game</button><button id='sc-gm' class='sc-dir"+(!isUI?" active":"")+"'>Game -> UI</button></div>"
      +"<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;'>"
      +"<div><label class='sc-lbl'>HP</label><input id='sc-hp' type='number' class='sc-inp' value='"+c.hp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Max HP</label><input id='sc-maxhp' type='number' class='sc-inp' value='"+c.maxHp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Gold</label><input id='sc-gold' type='number' class='sc-inp' value='"+c.gold+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>XP</label><input id='sc-xp' type='number' class='sc-inp' value='"+c.xp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Level</label><input id='sc-level' type='number' min='1' max='10' class='sc-inp' value='"+c.level+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Location</label><input id='sc-loc' type='text' class='sc-inp' value='"+w.location+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Time</label><input id='sc-time' type='text' class='sc-inp' value='"+w.time+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Weather</label><input id='sc-weather' type='text' class='sc-inp' value='"+w.weather+"' "+ro+"/></div></div>"
      +"<div style='margin-bottom:12px;'><label class='sc-lbl'>Inventory (one per line)</label><textarea id='sc-inv' class='sc-inp' style='height:80px;resize:vertical;' "+ro+">"+c.inventory.join("\n")+"</textarea></div>"
      +(isUI?"<button id='sc-apply' style='width:100%;padding:13px;font-size:15px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>APPLY</button>":"<div style='text-align:center;font-size:12px;color:var(--t2);padding:8px;'>Showing live game state. Switch to UI -> Game to edit.</div>")
      +"<p id='sc-msg' style='font-size:12px;min-height:16px;margin-top:8px;text-align:center;'></p>";
    document.getElementById("sc-x").addEventListener("click",function(){modalDiv.remove();});
    document.getElementById("sc-ui").addEventListener("click",function(){dir="ui";renderSync();});
    document.getElementById("sc-gm").addEventListener("click",function(){dir="game";syncUI();renderSync();});
    if(isUI){document.getElementById("sc-apply").addEventListener("click",function(){
      var c2=worldState.character,w2=worldState.world;
      var hp2=parseInt(document.getElementById("sc-hp").value),mhp2=parseInt(document.getElementById("sc-maxhp").value);
      var gld2=parseInt(document.getElementById("sc-gold").value),xp2=parseInt(document.getElementById("sc-xp").value),lvl2=parseInt(document.getElementById("sc-level").value);
      var loc2=document.getElementById("sc-loc").value.trim(),tm2=document.getElementById("sc-time").value.trim(),wx2=document.getElementById("sc-weather").value.trim();
      var rawInv=document.getElementById("sc-inv").value.trim();
      var inv2=rawInv?rawInv.split("\n").map(function(x){return x.trim();}).filter(function(x){return x.length>0;}):[];
      if(!isNaN(mhp2)&&mhp2>0)c2.maxHp=mhp2;if(!isNaN(hp2))c2.hp=Math.min(c2.maxHp,Math.max(0,hp2));
      if(!isNaN(gld2))c2.gold=Math.max(0,gld2);if(!isNaN(xp2))c2.xp=Math.max(0,xp2);
      if(!isNaN(lvl2)&&lvl2>=1&&lvl2<=10)c2.level=lvl2;if(loc2)w2.location=loc2;if(tm2)w2.time=tm2;if(wx2)w2.weather=wx2;
      if(inv2.length>0)c2.inventory=inv2;syncUI();saveAll();renderSync();
      var msg=document.getElementById("sc-msg");if(msg){msg.textContent="Applied.";msg.style.color="var(--grn)";}
    });}
  }
  renderSync();
}
function exportNarrative(){
  if(!worldState)return;var lines=["ASHEN CROWN -- SESSION LOG","Character: "+worldState.character.name+" | "+worldState.character.cls+" Lv"+worldState.character.level,"Turn: "+worldState.turn,"","===="];
  var story=document.getElementById("story-narrative"),msgs=story.querySelectorAll(".msg"),i;
  for(i=0;i<msgs.length;i++){var m=msgs[i];if(m.classList.contains("narrator")){lines.push(m.innerText||m.textContent);lines.push("");}else if(m.classList.contains("player")){lines.push("> "+(m.innerText||m.textContent));lines.push("");}else if(m.classList.contains("system")){lines.push("[ "+(m.innerText||m.textContent)+" ]");}}
  var blob=new Blob([lines.join("\n")],{type:"text/plain"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="ashen_"+worldState.character.name.replace(/\s+/g,"_")+"_t"+worldState.turn+".txt";a.click();URL.revokeObjectURL(url);
}
function exportSave(){
  if(!worldState)return;var data=JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory},null,2);
  var blob=new Blob([data],{type:"application/json"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="ashen_"+worldState.character.name.replace(/\s+/g,"_")+"_t"+worldState.turn+".json";a.click();URL.revokeObjectURL(url);
}
function importSave(event){
  var file=event.target.files[0];if(!file)return;var reader=new FileReader();
  reader.onload=function(e){try{var data=JSON.parse(e.target.result);if(!data.worldState||!data.worldState.character)throw new Error("Invalid save.");worldState=data.worldState;sessionLog=data.sessionLog||[];memory=data.memory||{npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[]};saveAll();document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showGame();syncUI();initAbilities();initSpells();addMsg("system","Loaded: "+worldState.character.name+" Turn "+worldState.turn);if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}catch(err){showToast("Import failed: "+err.message);}};
  reader.readAsText(file);event.target.value="";
}
function wireButtons(){
  document.getElementById("api-btn").addEventListener("click",submitKey);
  document.getElementById("api-input").addEventListener("keydown",function(e){if(e.key==="Enter")submitKey();});
  document.getElementById("tone-next").addEventListener("click",function(){if(!cs.tone){document.getElementById("s1-warn").textContent="Choose a tone.";return;}if(cs.tone==="custom"){var t=document.getElementById("tone-ct");if(!t||!t.value.trim()){document.getElementById("s1-warn").textContent="Describe your custom tone.";return;}}document.getElementById("s1-warn").textContent="";goStep(2);});
  document.getElementById("id-back").addEventListener("click",function(){goStep(1);});
  document.getElementById("id-next").addEventListener("click",function(){var n=document.getElementById("char-name").value.trim();if(!n){document.getElementById("s2-warn").textContent="Enter a name.";return;}cs.name=n;cs.pronouns=document.getElementById("char-pronouns").value;cs.age=document.getElementById("char-age").value;cs.appear=document.getElementById("char-appear").value.trim();cs.mark=document.getElementById("char-mark").value.trim();document.getElementById("s2-warn").textContent="";goStep(3);});
  document.getElementById("anc-back").addEventListener("click",function(){if(document.getElementById("anc-detail").style.display!=="none")hideAncDetail();else goStep(2);});
  document.getElementById("anc-back-detail").addEventListener("click",hideAncDetail);
  document.getElementById("anc-next").addEventListener("click",function(){if(!cs.ancestry){document.getElementById("s3-warn").textContent="Choose an ancestry.";return;}if(!cs.subrace){document.getElementById("s3-warn").textContent="Choose a subrace.";return;}var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(cs.ancestry==="halfblood"&&cs.subrace&&a&&a.subraces){var selH=null,hk2;for(hk2=0;hk2<a.subraces.length;hk2++){if(a.subraces[hk2].id===cs.subrace){selH=a.subraces[hk2];break;}}if(selH&&selH.lineages&&selH.lineages.length&&!cs.heritageVariant){document.getElementById("s3-warn").textContent="Choose a "+selH.nm+" lineage.";return;}}if(a&&a.fc>0&&cs.fp.length<a.fc){document.getElementById("s3-warn").textContent="Choose "+a.fc+" stat bonuses.";return;}document.getElementById("s3-warn").textContent="";goStep(4);});
  document.getElementById("cls-back").addEventListener("click",function(){goStep(3);});
  document.getElementById("cls-next").addEventListener("click",function(){if(!cs.cls){document.getElementById("s4-warn").textContent="Choose a class.";return;}document.getElementById("s4-warn").textContent="";goStep(5);});
  document.getElementById("sts-back").addEventListener("click",function(){goStep(4);});
  document.getElementById("sts-next").addEventListener("click",function(){if(!cs.rolled&&cs.statMode==="roll"){document.getElementById("s5-warn").textContent="Roll your stats first.";return;}document.getElementById("s5-warn").textContent="";goStep(6);});
  document.getElementById("roll-btn").addEventListener("click",rollAllStats);
  document.getElementById("per-back").addEventListener("click",function(){goStep(5);});
  document.getElementById("per-next").addEventListener("click",function(){var t=pval("char-trait","char-trait-c"),f=pval("char-flaw","char-flaw-c"),m=pval("char-mot","char-mot-c");if(!t||!f||!m){document.getElementById("s6-warn").textContent="Fill in all three fields.";return;}document.getElementById("s6-warn").textContent="";goStep(7);});
  document.getElementById("char-trait").addEventListener("change",function(){document.getElementById("trait-cw").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("char-flaw").addEventListener("change",function(){document.getElementById("flaw-cw").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("char-mot").addEventListener("change",function(){document.getElementById("mot-cw").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("char-alignment").addEventListener("change",function(){if(!cs.deityEdited)buildStep6Deity();});
  document.getElementById("char-deity").addEventListener("input",function(){cs.deityEdited=this.value!==getDefaultDeity();});
  document.getElementById("rv-back").addEventListener("click",function(){goStep(6);});
  document.getElementById("rv-go").addEventListener("click",confirmChar);
  document.getElementById("rv-start-loc").addEventListener("change",function(){document.getElementById("rv-start-loc-custom").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("rv-start-level").addEventListener("change",function(){var b=document.getElementById("rv-go");if(b)b.textContent=parseInt(this.value)>=3?"Assign level perks":"Begin your journey";buildDots();});
  document.getElementById("state-btn").addEventListener("click",function(){document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("sb-close").addEventListener("click",function(){document.getElementById("sidebar").classList.remove("open");});
  document.getElementById("sendbtn").addEventListener("click",function(){sendAction(null);});
  document.getElementById("userinput").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey)sendAction(null);});
  document.getElementById("sync-btn").addEventListener("click",showSyncModal);
  document.getElementById("render-btn").addEventListener("click",doRender);
  document.getElementById("file-btn").addEventListener("click",function(e){e.stopPropagation();document.getElementById("file-menu").style.display=document.getElementById("file-menu").style.display==="block"?"none":"block";});
  document.addEventListener("click",function(){var fm=document.getElementById("file-menu");if(fm)fm.style.display="none";});
  document.getElementById("fm-export").addEventListener("click",exportSave);
  document.getElementById("import-inp").addEventListener("change",importSave);
  document.getElementById("import-step1").addEventListener("change",importSave);
  document.getElementById("fm-narrative").addEventListener("click",exportNarrative);
  document.getElementById("fm-rules").addEventListener("click",showRulesModal);
  document.getElementById("fm-adult-cb").addEventListener("change",toggleAdultMode);
  document.getElementById("fm-sync-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";showSyncModal();});
  document.getElementById("fm-state-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("fm-render-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";doRender();});
  document.getElementById("fm-server-connect").addEventListener("click",connectToServer);
  document.getElementById("fm-server-disconnect").addEventListener("click",disconnectFromServer);
  document.getElementById("fm-newgame").addEventListener("click",newGame);
  // Start panel collapsed on mobile so first tap expands (not collapses)
  if(window.innerWidth<=600){panelCol=true;var rp=document.getElementById("rpanel");if(rp)rp.classList.add("col");}
  document.getElementById("panel-tog").addEventListener("click",function(){panelCol=!panelCol;document.getElementById("rpanel").classList.toggle("col",panelCol);});
  // Swipe right to collapse, swipe left to expand
  (function(){
    var rp=document.getElementById("rpanel"),tx=0;
    rp.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});
    rp.addEventListener("touchend",function(e){
      var dx=e.changedTouches[0].clientX-tx;
      if(Math.abs(dx)<30)return;
      panelCol=dx>0;  // swipe right → collapse, swipe left → expand
      rp.classList.toggle("col",panelCol);
    },{passive:true});
  })();
  document.getElementById("psh-inv").addEventListener("click",function(){secCol.inv=!secCol.inv;document.getElementById("pss-inv").classList.toggle("col",secCol.inv);});
  document.getElementById("psh-ab").addEventListener("click",function(){secCol.ab=!secCol.ab;document.getElementById("pss-ab").classList.toggle("col",secCol.ab);});
  document.getElementById("psh-sp").addEventListener("click",function(){secCol.sp=!secCol.sp;document.getElementById("pss-sp").classList.toggle("col",secCol.sp);});
}
function submitKey(){var k=document.getElementById("api-input").value.trim();if(k.indexOf("sk-")<0){document.getElementById("api-warn").textContent="Invalid key format.";return;}apiKey=k;store.set(AKK,k);document.getElementById("api-screen").style.display="none";init();}
function init(){loadRules();loadAdultMode();updateServerUI();storageAdapter.load(function(saved){if(saved&&worldState){showGame();syncUI();initAbilities();initSpells();addMsg("system","Welcome back, "+worldState.character.name+".");addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");var sll=sessionLog.length;if(sll>=2){var slu=sessionLog[sll-2],sla=sessionLog[sll-1];if(slu&&slu.role==="user")addMsg("player",slu.content);if(sla&&sla.role==="assistant"){var slc=cleanTxt(sla.content),sld=diceTxt(sla.content),slp=parseActions(slc);addMsg("narrator",(sld||"")+"<p>"+slp.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(slp.btns||""));}}if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}else{showChar();}});}
window.addEventListener("load",function(){wireButtons();var k=store.get(AKK);if(k){apiKey=k;document.getElementById("api-screen").style.display="none";init();}});
