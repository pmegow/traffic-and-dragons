var _campFolderHandle=null;
var _campRootHandle=null;
var _SUBFOLDERS={save:"saves",narrative:"logs",character:"characters",render:"renders",portrait:"characters"};
function buildFilename(type){
  var c=worldState&&worldState.character?worldState.character:{name:"unknown"};
  var turn=worldState?worldState.turn:0;
  var slug=function(s){return(s||"unknown").replace(/[^a-zA-Z0-9_\-]/g,"_");};
  var camp=slug(worldState&&worldState.campName||c.name);
  var char=slug(c.name);
  var base=camp+"_"+char;
  if(type==="save")     return base+"_t"+turn+".json";
  if(type==="narrative")return base+"_t"+turn+".txt";
  if(type==="character")return base+"_character.char";
  if(type==="render")   return base+"_t"+turn+".jpg";
  if(type==="portrait") return base+"_portrait.png";
  return base+"_t"+turn;
}
function exportToFolder(type,blob,filename){
  if(!_campFolderHandle){
    var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
    return;
  }
  var sub=_SUBFOLDERS[type]||"misc";
  _campFolderHandle.getDirectoryHandle(sub,{create:true}).then(function(dir){
    return dir.getFileHandle(filename,{create:true});
  }).then(function(fh){
    return fh.createWritable();
  }).then(function(w){
    return w.write(blob).then(function(){return w.close();});
  }).then(function(){
    showToast("Saved to "+sub+"/"+filename);
  }).catch(function(e){
    showToast("Folder write failed: "+e.message);
    var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  });
}
function _slugFolderName(s){return(s||"Campaign").replace(/[^a-zA-Z0-9_\-]/g,"_");}
function _openCampaignSubfolder(rootHandle,campName){
  var slug=_slugFolderName(campName);
  return rootHandle.getDirectoryHandle(slug,{create:true}).then(function(sub){
    _campRootHandle=rootHandle;
    _campFolderHandle=sub;
    updateCampFolderUI();
    return sub;
  });
}
function setCampaignFolder(){
  if(!window.showDirectoryPicker){showToast("Folder picker not supported in this browser.");return;}
  var campName=(worldState&&worldState.campName)||"Campaign";
  window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Folder ready: "+sub.name+"/");
  }).catch(function(){});
}
function initCampaignFolderForGame(){
  if(!window.showDirectoryPicker)return;
  var campName=(worldState&&worldState.campName)||"Campaign";
  window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Saving to "+sub.name+"/");
  }).catch(function(){});
}
function _collectDirEntries(dirHandle){
  var entries=[];var iter=dirHandle.values();
  function step(){return iter.next().then(function(r){if(r.done)return entries;entries.push(r.value);return step();});}
  return step();
}
function _copyDir(srcDir,destDir){
  return _collectDirEntries(srcDir).then(function(entries){
    var chain=Promise.resolve();
    entries.forEach(function(entry){
      chain=chain.then(function(){
        if(entry.kind==="file"){
          return entry.getFile().then(function(file){
            return destDir.getFileHandle(entry.name,{create:true}).then(function(fh){
              return fh.createWritable().then(function(w){return w.write(file).then(function(){return w.close();});});
            });
          });
        } else {
          return destDir.getDirectoryHandle(entry.name,{create:true}).then(function(sub){return _copyDir(entry,sub);});
        }
      });
    });
    return chain;
  });
}
function renameCampaignFolder(newName){
  if(!_campRootHandle||!_campFolderHandle)return;
  var oldHandle=_campFolderHandle;
  var oldName=oldHandle.name;
  var newSlug=_slugFolderName(newName);
  if(oldName===newSlug)return;
  _campRootHandle.getDirectoryHandle(newSlug,{create:true}).then(function(newDir){
    return _copyDir(oldHandle,newDir).then(function(){
      return _campRootHandle.removeEntry(oldName,{recursive:true});
    }).then(function(){
      _campFolderHandle=newDir;
      updateCampFolderUI();
      showToast("📁 Renamed to "+newSlug+"/");
    });
  }).catch(function(e){showToast("Folder rename failed: "+e.message);});
}
function clearCampaignFolder(){
  _campFolderHandle=null;_campRootHandle=null;
  updateCampFolderUI();
  showToast("Campaign folder cleared.");
}
function updateCampFolderUI(){
  ["","cs-","api-"].forEach(function(p){
    var btn=document.getElementById(p+"fm-set-folder");
    var clr=document.getElementById(p+"fm-clear-folder");
    if(btn)btn.style.display=_campFolderHandle?"none":"block";
    if(clr){clr.style.display=_campFolderHandle?"block":"none";if(_campFolderHandle)clr.textContent="📁 "+_campFolderHandle.name+" ×";}
  });
}
function compressPortrait(dataUrl,cb){
  var img=new Image();
  img.onload=function(){
    var maxW=400,maxH=600,scale=Math.min(1,maxW/img.width,maxH/img.height);
    var cw=Math.round(img.width*scale),ch=Math.round(img.height*scale);
    var canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
    canvas.getContext("2d").drawImage(img,0,0,cw,ch);
    cb(canvas.toDataURL("image/jpeg",0.8));
  };
  img.onerror=function(){cb(dataUrl);}; // fallback: store as-is if canvas fails
  img.src=dataUrl;
}
function showToast(msg){var t=document.createElement("div");t.textContent=msg;t.style.cssText="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1800;border:1px solid var(--acc);color:var(--acc);padding:10px 20px;border-radius:20px;font-size:13px;font-family:Georgia,serif;z-index:400;pointer-events:none;";document.body.appendChild(t);setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.remove();},500);},2000);}
function showLoadingModal(msg){
  var ex=document.getElementById("loading-modal");if(ex)ex.remove();
  if(!document.getElementById("lm-kf")){var s=document.createElement("style");s.id="lm-kf";s.textContent="@keyframes lm-spin{to{transform:rotate(360deg)}}";document.head.appendChild(s);}
  var modal=document.createElement("div");modal.id="loading-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:500;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:36px 48px;text-align:center;min-width:220px;'>"
    +"<div style='width:44px;height:44px;border:3px solid var(--bg3);border-top-color:var(--acc);border-radius:50%;animation:lm-spin .75s linear infinite;margin:0 auto 18px;'></div>"
    +"<div style='font-size:13px;color:var(--t1);font-family:Georgia,serif;'>"+msg+"</div>"
    +"</div>";
  document.body.appendChild(modal);
  return function(){var m=document.getElementById("loading-modal");if(m)m.remove();};
}
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
  cs={tone:null,name:"",gender:"M",age:"early twenties",appear:"",mark:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,step:1};
  buildDots();buildToneGrid();
}
function switchTab(tab){activeChatTab=tab;var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");var tn=document.getElementById("tab-narrative"),tt=document.getElementById("tab-tabletalk"),badge=document.getElementById("tab-tt-badge");sn.style.display=tab==="narrative"?"flex":"none";st.style.display=tab==="tabletalk"?"flex":"none";tn.className="chat-tab"+(tab==="narrative"?" active":"");tt.className="chat-tab"+(tab==="tabletalk"?" active":"");if(tab==="tabletalk"&&badge)badge.className="tab-badge";}
function addMsg(type,html){var isTTMsg=(type==="tabletalk");var story=document.getElementById(isTTMsg?"story-tabletalk":"story-narrative");var div=document.createElement("div");div.className="msg "+type;div.innerHTML=html;story.appendChild(div);story.scrollTop=story.scrollHeight;if(isTTMsg&&activeChatTab!=="tabletalk"){var badge=document.getElementById("tab-tt-badge");if(badge)badge.className="tab-badge on";}return div;}
function syncUI(){if(!worldState)return;updateHUD();updatePartyPanel();updateInvPanel();updateAbPanel(false);updateSpPanel();updateMemStatus();if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}else{document.getElementById("cpanel").classList.remove("active");}}
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
  var i;
  // ── Party section ────────────────────────────────────────────────────────
  var partyHtml='<button class="sb-party-btn sb-pb-player" onclick="showCharSheet()">'+c.name+'</button>';
  for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].partyMember){var pnm=worldState.npcs[i].name;partyHtml+='<button class="sb-party-btn" onclick="showNpcSheet(\''+pnm.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+'\')">' +pnm+'</button>';}}
  // ── NPCs (non-party) ─────────────────────────────────────────────────────
  var npcR="";for(i=0;i<worldState.npcs.length;i++){if(!worldState.npcs[i].partyMember)npcR+=sr(worldState.npcs[i].name,worldState.npcs[i].status+" / "+worldState.npcs[i].rel);}
  var qR="";for(i=0;i<worldState.questLog.length;i++)qR+=sr(worldState.questLog[i].title,worldState.questLog[i].status);
  sb.innerHTML='<div class="sb-sec" style="border-top:1px solid var(--brd);padding-top:14px;">'+partyHtml+'</div>'
    +'<div class="sb-sec">'+sr("Location",w.location)+sr("Time",w.time)+sr("Weather",w.weather)+'</div>'
    +(npcR?'<div class="sb-sec">'+npcR+'</div>':"")
    +(qR?'<div class="sb-sec">'+qR+'</div>':"");
}
function updatePartyPanel(){
  if(!worldState)return;
  var c=worldState.character;
  var npcs=(worldState.npcs||[]).filter(function(n){return n.partyMember&&n.name!==c.name;});
  var pss=document.getElementById("pss-party");if(!pss)return;
  pss.style.display="";
  document.getElementById("party-cnt").textContent=1+npcs.length;
  var h="",i,m,sheet,hp,maxHp,cls;
  // Player always first
  h+="<div onclick='showCharSheet()' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
    +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(c.name)+" <span style='color:var(--t2);font-weight:normal;font-size:9px;'>YOU</span></div>"
    +"<div style='font-size:10px;color:var(--t2);'>"+escHtml(c.cls)+"</div>"
    +"<div style='font-size:10px;color:#e06060;'>HP "+c.hp+"/"+c.maxHp+"</div>"
    +"</div>";
  for(i=0;i<npcs.length;i++){
    m=npcs[i];sheet=m.charSheet||null;
    hp=sheet?sheet.hp:null;maxHp=sheet?sheet.maxHp:null;
    cls=sheet?(sheet.cls||""):(m.role||"");
    h+="<div onclick='showNpcSheet(\""+escHtml(m.name)+"\")' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(m.name)+"</div>"
      +(cls?"<div style='font-size:10px;color:var(--t2);'>"+escHtml(cls)+"</div>":"")
      +(hp!==null?"<div style='font-size:10px;color:#e06060;'>HP "+hp+(maxHp?"/"+maxHp:"")+"</div>":"")
      +"</div>";
  }
  document.getElementById("party-list").innerHTML=h;
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
function updateCombat(){
  if(!worldState||!worldState.combat)return;
  var cm=worldState.combat,pc=worldState.character;
  document.getElementById("ct-round").textContent="Round "+cm.round;
  document.getElementById("en-name").textContent=cm.name;
  document.getElementById("en-hpt").textContent=cm.hp+"/"+cm.maxHp;
  document.getElementById("en-hpbar").style.width=Math.max(0,Math.round((cm.hp/cm.maxHp)*100))+"%";
  document.getElementById("en-morale").textContent=cm.morale;
  document.getElementById("pl-name").textContent=pc.name;
  document.getElementById("pl-hpt").textContent=pc.hp+"/"+pc.maxHp;
  document.getElementById("pl-hpbar").style.width=Math.max(0,Math.round((pc.hp/pc.maxHp)*100))+"%";
  var sb2=document.getElementById("en-statblock");
  if(sb2){
    var sbh="";
    if(cm.stats){
      var sm2=function(v){var m=Math.floor((v-10)/2);return(m>=0?"+":"")+m;};
      sbh+="STR "+cm.stats.STR+"("+sm2(cm.stats.STR)+") "
          +"DEX "+cm.stats.DEX+"("+sm2(cm.stats.DEX)+") "
          +"CON "+cm.stats.CON+"("+sm2(cm.stats.CON)+") "
          +"INT "+cm.stats.INT+"("+sm2(cm.stats.INT)+") "
          +"WIS "+cm.stats.WIS+"("+sm2(cm.stats.WIS)+") "
          +"CHA "+cm.stats.CHA+"("+sm2(cm.stats.CHA)+") "
          +"<span style='color:var(--acc);'>CR "+cm.stats.CR+"</span>";
    }
    if(cm.immune&&cm.immune.length)sbh+="<span style='color:#c06060;margin-left:8px;'>Immune: "+cm.immune.join(", ")+"</span>";
    if(cm.resist&&cm.resist.length)sbh+="<span style='color:var(--t2);margin-left:8px;'>Resist: "+cm.resist.join(", ")+"</span>";
    if(cm.vuln&&cm.vuln.length)sbh+="<span style='color:var(--acc);margin-left:8px;'>Vuln: "+cm.vuln.join(", ")+"</span>";
    sb2.innerHTML=sbh;
    sb2.style.display=sbh?"block":"none";
  }
}
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
function toggleAdultMode(){adultMode=!adultMode;store.set(ADK,adultMode?"1":"");["fm-adult-cb","cs-fm-adult-cb","api-fm-adult-cb"].forEach(function(id){var cb=document.getElementById(id);if(cb)cb.checked=adultMode;});showToast(adultMode?"18+ content enabled":"18+ content disabled");}
function loadAdultMode(){var v=store.get(ADK);adultMode=!!(v&&v==="1");["fm-adult-cb","cs-fm-adult-cb","api-fm-adult-cb"].forEach(function(id){var cb=document.getElementById(id);if(cb)cb.checked=adultMode;});}

// ── Server connect / disconnect ──────────────────────────────────────────────
var ASHEN_SERVER_URL = "https://ashen-crown-server.fly.dev"; // URL is fixed (fly.io app name); internal branding updated

function updateServerUI(){
  var connected=storageAdapter.isServerMode();
  ["","cs-","api-"].forEach(function(p){
    var btnConn=document.getElementById(p+"fm-server-connect");
    var btnDisc=document.getElementById(p+"fm-server-disconnect");
    if(btnConn) btnConn.style.display=connected?"none":"block";
    if(btnDisc) btnDisc.style.display=connected?"block":"none";
  });
  if(connected){
    // Fetch username from server to show in button label
    fetch(ASHEN_SERVER_URL+"/auth/me",{headers:{"Authorization":"Bearer "+(localStorage.getItem("ashen_server_tok_v1")||"")}})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(d){
        ["fm-server-user","cs-fm-server-user","api-fm-server-user"].forEach(function(id){var span=document.getElementById(id);if(span&&d&&d.username)span.textContent=d.username;});
      }).catch(function(){});
  }
}

function connectToServer(){
  storageAdapter.loginWithServer(ASHEN_SERVER_URL,function(err,info){
    if(err){showToast("Server login failed.");return;}
    updateServerUI();
    document.getElementById("file-menu").style.display="none";
    document.getElementById("cs-file-menu").style.display="none";
    showToast("☁ Connected as "+info.username);
    storageAdapter.syncCampaignList(function(){showCampaignPicker();});
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
      +"<div><label class='sc-lbl'>Location</label><input id='sc-loc' type='text' class='sc-inp' value='"+escHtml(w.location)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Time</label><input id='sc-time' type='text' class='sc-inp' value='"+escHtml(w.time)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Weather</label><input id='sc-weather' type='text' class='sc-inp' value='"+escHtml(w.weather)+"' "+ro+"/></div></div>"
      +"<div style='margin-bottom:12px;'><label class='sc-lbl'>Inventory (one per line)</label><textarea id='sc-inv' class='sc-inp' style='height:80px;resize:vertical;' "+ro+">"+escHtml(c.inventory.join("\n"))+"</textarea></div>"
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
  if(!worldState)return;var lines=["TRAFFIC AND DRAGONS -- SESSION LOG","Character: "+worldState.character.name+" | "+worldState.character.cls+" Lv"+worldState.character.level,"Turn: "+worldState.turn,"","===="];
  var story=document.getElementById("story-narrative"),msgs=story.querySelectorAll(".msg"),i;
  for(i=0;i<msgs.length;i++){var m=msgs[i];if(m.classList.contains("narrator")){lines.push(m.innerText||m.textContent);lines.push("");}else if(m.classList.contains("player")){lines.push("> "+(m.innerText||m.textContent));lines.push("");}else if(m.classList.contains("system")){lines.push("[ "+(m.innerText||m.textContent)+" ]");}}
  var fname=buildFilename("narrative");var blob=new Blob([lines.join("\n")],{type:"text/plain"});exportToFolder("narrative",blob,fname);
}
function exportSave(){
  if(!worldState)return;
  document.getElementById("file-menu").style.display="none";
  var fname=buildFilename("save");
  // Check if we've saved this filename before (same turn = likely overwrite)
  var saved=[];try{var sr=localStorage.getItem("ashen_saved_files_v1");if(sr)saved=JSON.parse(sr);}catch(e){}
  var alreadySaved=saved.indexOf(fname)>=0;
  var ex=document.getElementById("save-confirm-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="save-confirm-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:400px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:6px;'>Save Game</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Turn "+worldState.turn+" &nbsp;·&nbsp; "+worldState.world.location+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>File</div>"
    +"<div style='font-size:12px;color:var(--t1);font-family:monospace;background:var(--bg2);padding:8px 10px;border-radius:var(--r);margin-bottom:"+(alreadySaved?"12":"20")+"px;word-break:break-all;'>"+fname+"</div>"
    +(alreadySaved?"<div style='font-size:12px;color:var(--acc);margin-bottom:16px;'>&#9888; A file with this name may already exist in your downloads folder.</div>":"")
    +"<div style='display:flex;gap:10px;'><button id='sc-cancel' style='flex:1;padding:10px;font-family:Georgia,serif;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Cancel</button>"
    +"<button id='sc-save' style='flex:1;padding:10px;font-family:Georgia,serif;background:var(--acc);border:none;border-radius:var(--r);color:#000;font-weight:bold;cursor:pointer;'>Save</button></div>"
    +"</div>";
  document.body.appendChild(modal);
  document.getElementById("sc-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("sc-save").addEventListener("click",function(){
    modal.remove();
    var data=JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory},null,2);
    var blob=new Blob([data],{type:"application/json"});exportToFolder("save",blob,fname);
    // Record this filename as saved
    if(saved.indexOf(fname)<0)saved.push(fname);
    if(saved.length>100)saved=saved.slice(-100);
    try{localStorage.setItem("ashen_saved_files_v1",JSON.stringify(saved));}catch(e){}
  });
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
}
function importSave(event){
  var file=event.target.files[0];if(!file)return;var reader=new FileReader();
  reader.onload=function(e){try{var data=JSON.parse(e.target.result);if(!data.worldState||!data.worldState.character)throw new Error("Invalid save.");worldState=data.worldState;sessionLog=data.sessionLog||[];memory=data.memory||{npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[]};saveAll();document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showGame();syncUI();initAbilities();initSpells();addMsg("system","Loaded: "+worldState.character.name+" Turn "+worldState.turn);if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}catch(err){showToast("Import failed: "+err.message);}};
  reader.readAsText(file);event.target.value="";
}
function showCharSheet(){
  if(!worldState)return;
  var ex=document.getElementById("cs-modal");if(ex)ex.remove();
  var c=worldState.character;

  // ── helpers ──────────────────────────────────────────────────────────────
  function sec(title,body){return'<div class="cs-sec"><div class="cs-sec-hd cs-sec-tog" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">'+title+'<span class="cs-tog-arr" style="font-size:10px;color:var(--t2);flex-shrink:0;margin-left:8px;">&#9654;</span></div><div class="cs-sec-body" style="display:none;">'+body+'</div></div>';}
  function kv(k,v){return'<div class="cs-kv"><span class="cs-k">'+k+'</span><span class="cs-v">'+v+'</span></div>';}

  // ── header ───────────────────────────────────────────────────────────────
  var initials=c.name.split(" ").map(function(w2){return w2[0]||"";}).join("").toUpperCase().slice(0,2)||"?";
  var genderLbl=c.gender==="F"?"Female":c.gender==="NB"?"Non-binary":"Male";
  var subnm=c.subraceNm?c.subraceNm+" ":"";
  var clsLine=subnm+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"");
  var lvl=c.level,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
  var xpPct=lvl>=10?100:Math.min(100,Math.round(((c.xp-prevXP)/Math.max(1,nextXP-prevXP))*100));

  // ── stats ─────────────────────────────────────────────────────────────────
  var statHtml="<div class='cs-stat-grid'>",i;
  for(i=0;i<STATS.length;i++){var s=STATS[i],v=c.stats[s];statHtml+="<div class='cs-stat'><div class='cs-sn'>"+s+"</div><div class='cs-sv'>"+v+"</div><div class='cs-sm'>"+smod(v)+"</div></div>";}
  statHtml+="</div>";

  // ── skills ────────────────────────────────────────────────────────────────
  var skillHtml,earnedSkills=[],si2;
  if(c.skills){for(si2=0;si2<SKILLS.length;si2++){var skl=SKILLS[si2],succ=(typeof c.skills[skl.id]==="number")?c.skills[skl.id]:0;if(succ>0)earnedSkills.push(skl.label+" ("+SKILL_LEVELS[skillLevel(succ)]+")");}  }
  skillHtml=earnedSkills.length?'<div class="cs-v">'+earnedSkills.join(", ")+"</div>":'<span class="cs-none">None yet</span>';

  // ── conditions ────────────────────────────────────────────────────────────
  var condHtml;
  if(c.conditions&&c.conditions.length){
    condHtml="<div class='cs-list'>";
    for(i=0;i<c.conditions.length;i++)condHtml+='<div class="cs-list-row"><span style="color:#e06060">'+c.conditions[i].name+'</span><span class="cs-dim"> — '+c.conditions[i].duration+'</span></div>';
    condHtml+="</div>";
  }else condHtml='<span class="cs-none">None</span>';

  // ── relationships ─────────────────────────────────────────────────────────
  var relHtml;
  if(c.relationships&&c.relationships.length){
    relHtml="<div class='cs-list'>";
    for(i=0;i<c.relationships.length;i++)relHtml+='<div class="cs-list-row"><span style="color:var(--acc)">'+c.relationships[i].entity+'</span><span class="cs-dim"> — '+c.relationships[i].descriptor+'</span></div>';
    relHtml+="</div>";
  }else relHtml='<span class="cs-none">None</span>';

  // ── languages ─────────────────────────────────────────────────────────────
  var langHtml,langParts=[];
  if(c.languages&&c.languages.length){
    for(i=0;i<c.languages.length;i++){var lang=c.languages[i];langParts.push(lang.broken?'<span style="color:#a07838">'+lang.name+' (broken)</span>':lang.name);}
    langHtml='<div class="cs-v">'+langParts.join(", ")+"</div>";
  }else langHtml='<span class="cs-none">Common</span>';

  // ── save modifiers ────────────────────────────────────────────────────────
  var saveHtml="";
  if(c.saveModifiers&&c.saveModifiers.length){
    saveHtml="<div class='cs-list'>";
    for(i=0;i<c.saveModifiers.length;i++){var sm=c.saveModifiers[i],sv=sm.amount>=0?"+"+sm.amount:""+sm.amount;saveHtml+='<div class="cs-list-row"><span>'+sv+' vs '+sm.type+'</span><span class="cs-dim"> ['+sm.source+']</span></div>';}
    saveHtml+="</div>";
  }

  // ── story beats ───────────────────────────────────────────────────────────
  var beatsHtml="";
  if(c.storyBeats&&c.storyBeats.length){
    for(i=c.storyBeats.length-1;i>=0;i--)beatsHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+c.storyBeats[i].turn+'</span>'+c.storyBeats[i].text+'</div>';
  }

  // ── abilities ─────────────────────────────────────────────────────────────
  var abilHtml="";
  if(c.abilities&&c.abilities.length){for(i=0;i<c.abilities.length;i++){abilHtml+='<div class="cs-abil"><span class="cs-abil-nm">'+c.abilities[i].nm+'</span><span class="cs-abil-ds">'+c.abilities[i].ds+'</span></div>';}}
  else abilHtml='<span class="cs-none">None yet</span>';

  // ── spells ────────────────────────────────────────────────────────────────
  var spellHtml="";
  if(c.spells&&c.spells.length){
    var spParts=[];
    for(i=0;i<c.spells.length;i++){
      var sp2=c.spells[i],stag=sp2.lvl===0?"C":String(sp2.lvl);
      var nm2=sp2.nm.indexOf("(")>=0?sp2.nm.slice(0,sp2.nm.indexOf("(")).trim():sp2.nm;
      var spTxt="["+stag+"] "+nm2;
      spParts.push(sp2.used?'<span style="color:var(--t2);text-decoration:line-through">'+spTxt+'</span>':spTxt);
    }
    spellHtml='<div class="cs-v" style="line-height:1.9">'+spParts.join(", ")+"</div>";
  }

  // ── inventory ─────────────────────────────────────────────────────────────
  var invHtml=c.inventory&&c.inventory.length?'<div class="cs-v">'+c.inventory.join(", ")+"</div>":'<span class="cs-none">Empty</span>';

  // ── compose ───────────────────────────────────────────────────────────────
  var modal=document.createElement("div");modal.id="cs-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";

  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;'>"
    +"<div style='display:flex;justify-content:flex-end;margin-bottom:10px;'><button id='cs-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div>"

    +"<div class='cs-hero'>"
    +"<div style='position:relative;flex-shrink:0;'>"
    +"<div class='cs-avatar' id='cs-avatar-btn' title='Edit portrait'>"+(c.portrait?"<img src='"+c.portrait+"' alt='"+c.name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    +"</div>"
    +"<div class='cs-hero-info'>"
    +"<div class='cs-hero-name'>"+c.name+"</div>"
    +"<div class='cs-hero-cls'>"+clsLine+"</div>"
    +"<div class='cs-hero-sub'>"+genderLbl+" · "+c.age+(c.deity?" · "+c.deity:"")+"</div>"
    +"<div style='margin-top:8px;font-size:13px;'>"
    +"<span style='color:var(--acc)'>Lv "+lvl+"</span>"
    +" &nbsp;·&nbsp; <span style='color:#e06060'>"+c.hp+"/"+c.maxHp+" HP</span>"
    +" &nbsp;·&nbsp; <span style='color:#c0a040'>"+c.gold+" gp</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(c.actualAlignment||c.statedAlignment||"Neutral")+"</span>"
    +"</div>"
    +"<div class='cs-xp-wrap'>"
    +"<div class='cs-xp-lbl'><span>"+c.xp+" XP</span><span>"+(lvl<10?"Next: "+nextXP+" XP":"Max level")+"</span></div>"
    +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+xpPct+"%;'></div></div>"
    +"</div>"
    +"</div></div>"

    +sec("Attributes",statHtml)
    +sec("Character"
      ,(c.appear?kv("Appearance",c.appear):"")
      +(c.mark?kv("Distinguishing Mark",c.mark):"")
      +kv("Trait",c.trait||"—")
      +kv("Flaw",c.flaw||"—")
      +kv("Motivation",c.motivation||"—")
      +(c.backstory?kv("Backstory",c.backstory):"")
    )
    +sec("Conditions",condHtml)
    +sec("Relationships",relHtml)
    +sec("Languages",langHtml)
    +(c.saveModifiers&&c.saveModifiers.length?sec("Save Modifiers",saveHtml):"")
    +sec("Skills",skillHtml)
    +(c.storyBeats&&c.storyBeats.length?sec("Story Beats",beatsHtml):"")
    +sec("Abilities",abilHtml)
    +(c.spells&&c.spells.length?sec("Spells",spellHtml):"")
    +sec("Inventory",invHtml)

    +"</div>";

  document.body.appendChild(modal);
  document.getElementById("cs-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  // ── collapsible sections ──────────────────────────────────────────────────
  (function(){var hdrs=modal.querySelectorAll(".cs-sec-tog"),hi;for(hi=0;hi<hdrs.length;hi++){hdrs[hi].addEventListener("click",function(){var body=this.parentNode.querySelector(".cs-sec-body"),arr=this.querySelector(".cs-tog-arr"),open=body.style.display!=="none";body.style.display=open?"none":"block";arr.style.transform=open?"":"rotate(90deg)";});}})();

  // ── portrait handlers ─────────────────────────────────────────────────────
  function refreshAvatar(){
    var av=document.getElementById("cs-avatar-btn");if(!av)return;
    var c2=worldState.character;
    av.innerHTML=(c2.portrait?"<img src='"+c2.portrait+"' alt='"+c2.name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
  }
  document.getElementById("cs-avatar-btn").addEventListener("click",function(){showPortraitModal(refreshAvatar);});
}
async function showPortraitModal(refreshFn,opts){
  var ex=document.getElementById("portrait-modal");if(ex)ex.remove();
  // opts = {getPortrait, setPortrait, subject} — defaults to player character
  var getPort=opts&&opts.getPortrait?opts.getPortrait:function(){return worldState.character.portrait;};
  var setPort=opts&&opts.setPortrait?opts.setPortrait:function(url){worldState.character.portrait=url;saveAll();};
  var c=opts&&opts.subject?opts.subject:worldState.character;
  var genderWord=!c.gender||c.gender==="NB"?"androgynous":c.gender==="F"?"female":"male";
  var pmRefSrc=getPort()||null;
  var hasPortrait=!!(getPort());

  function buildCharDesc(){
    var d=c.name;
    if(c.age||c.ancestry||c.cls)d+=", a "+genderWord+(c.age?" "+c.age:"")+(c.ancestry?" "+c.ancestry:"")+(c.cls?" "+c.cls:"")+(c.archetypeNm?" ["+c.archetypeNm+"]":"");
    if(c.appear)d+=", "+c.appear;
    if(c.mark)d+=", "+c.mark;
    if(c.inventory&&c.inventory.length)d+=". Visible wardrobe/gear: "+c.inventory.join(", ");
    return d;
  }

  var modal=document.createElement("div");modal.id="portrait-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;";
  var IS="width:100%;padding:9px 12px;font-size:13px;font-family:Georgia,serif;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:10px;box-sizing:border-box;";
  var BA="display:block;width:100%;padding:10px 14px;font-size:13px;font-family:Georgia,serif;border-radius:var(--r);cursor:pointer;text-align:left;box-sizing:border-box;background:var(--acc);border:none;color:#000;font-weight:bold;";
  function div(lbl){return "<div style='display:flex;align-items:center;gap:8px;margin:14px 0;'><div style='flex:1;height:1px;background:var(--brd);'></div><span style='font-size:11px;color:var(--t2);'>"+lbl+"</span><div style='flex:1;height:1px;background:var(--brd);'></div></div>";}
  function lbl(t){return "<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>"+t+"</div>";}


  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;margin:20px 0 40px;'>"
    // Header
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'>"
    +"<span style='font-size:15px;color:var(--t0);font-weight:bold;'>&#129718; Edit Portrait</span>"
    +"<button id='pm-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;line-height:1;'>&#215;</button>"
    +"</div>"
    // ── Current portrait preview ───────────────────────────────────────────
    +(hasPortrait?"<div style='text-align:center;margin-bottom:20px;'><img src='"+getPort()+"' style='width:90px;height:135px;object-fit:cover;border-radius:50%;border:2px solid var(--acc);display:inline-block;'></div>":"")
    // ── 1. Upload / Save / Remove (same row) ──────────────────────────────
    +"<div style='display:flex;gap:6px;margin-bottom:4px;'>"
    +"<button id='pm-upload' style='flex:1;padding:10px 4px;font-size:12px;font-family:Georgia,serif;border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--acc);border:none;color:#000;font-weight:bold;'>&#8593; Upload</button>"
    +(hasPortrait?"<button id='pm-save-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:Georgia,serif;border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--acc);border:none;color:#000;font-weight:bold;'>&#8595; Save</button>":"")
    +(hasPortrait?"<button id='pm-remove-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:Georgia,serif;border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--acc);border:none;color:#000;font-weight:bold;'>&#10005; Remove</button>":"")
    +"</div>"
    +"<input type='file' id='pm-file' accept='image/*' style='display:none;'>"
    // ── 2. Generate from scratch ───────────────────────────────────────────
    +div("or generate from scratch")
    +lbl("Additional details (optional):")
    +"<input type='text' id='pm-details-gen' placeholder='e.g. wearing a hood, battle-scarred, torch light' style='"+IS+"'/>"
    +"<button id='pm-gen' style='"+BA+"'>&#129718; Generate from Character Sheet</button>"
    // ── 3. Update current portrait (only when one exists) ─────────────────
    +(hasPortrait?div("update current portrait"):"")
    +(hasPortrait?lbl("Additional details (optional):"):"")
    +(hasPortrait?"<input type='text' id='pm-details-upd' placeholder='e.g. now wearing plate armour, older, battle-worn' style='"+IS+"'/>":"")
    +(hasPortrait?"<button id='pm-upd' style='"+BA+"'>&#10024; Update from Character Sheet</button>":"")
    // ── Result ─────────────────────────────────────────────────────────────
    +"<div id='pm-status' style='margin-top:14px;'></div>"
    +"</div>";

  document.body.appendChild(modal);

  function pmClose(){modal.remove();}
  document.getElementById("pm-x").addEventListener("click",pmClose);
  modal.addEventListener("click",function(e){if(e.target===modal)pmClose();});
  if(document.getElementById("pm-save-portrait")){
    document.getElementById("pm-save-portrait").addEventListener("click",function(){
      var purl=getPort();if(!purl)return;
      var fname=buildFilename("portrait");
      fetch(purl).then(function(r){return r.blob();}).then(function(blob){exportToFolder("portrait",blob,fname);}).catch(function(){var a=document.createElement("a");a.href=purl;a.download=fname;a.click();});
    });
  }
  if(document.getElementById("pm-remove-portrait")){
    document.getElementById("pm-remove-portrait").addEventListener("click",function(){
      setPort(null);if(refreshFn)refreshFn();pmClose();
    });
  }

  // ── Shared: show image result ────────────────────────────────────────────
  function showResult(imgUrl,isImg2Img,genPrompt){
    var status=document.getElementById("pm-status");
    status.innerHTML="";
    var prev=document.createElement("div");
    var img=document.createElement("img");img.src=imgUrl;img.style.cssText="width:100%;border-radius:var(--r);display:block;margin-bottom:10px;";
    var BS2="padding:8px 12px;font-family:Georgia,serif;font-size:12px;background:var(--acc);border:none;color:#000;border-radius:var(--r);cursor:pointer;font-weight:bold;margin-right:5px;margin-bottom:6px;";
    var useBtn=document.createElement("button");useBtn.textContent="Use as Portrait";useBtn.style.cssText=BS2;
    var editBtn=document.createElement("button");editBtn.textContent="Edit Prompt";editBtn.style.cssText=BS2;
    var discardBtn=document.createElement("button");discardBtn.textContent="Discard";discardBtn.style.cssText=BS2;
    var btnRow=document.createElement("div");btnRow.appendChild(useBtn);btnRow.appendChild(editBtn);btnRow.appendChild(discardBtn);
    var editArea=document.createElement("div");editArea.style.cssText="margin-top:8px;display:none;";
    var promptTA=document.createElement("textarea");promptTA.value=genPrompt||"";
    promptTA.style.cssText="width:100%;height:80px;padding:8px;font-size:12px;font-family:monospace;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;resize:vertical;margin-bottom:6px;";
    var regenBtn=document.createElement("button");regenBtn.textContent="Regenerate with this prompt";regenBtn.style.cssText="display:block;width:100%;"+BS2;
    editArea.appendChild(promptTA);editArea.appendChild(regenBtn);
    prev.appendChild(img);prev.appendChild(btnRow);prev.appendChild(editArea);
    status.appendChild(prev);
    useBtn.addEventListener("click",function(){
      useBtn.disabled=true;useBtn.textContent="Saving…";
      fetch(imgUrl).then(function(r){return r.blob();}).then(function(blob){
        var fr=new FileReader();
        fr.onload=function(e2){compressPortrait(e2.target.result,function(compressed){setPort(compressed);if(refreshFn)refreshFn();pmClose();});};
        fr.readAsDataURL(blob);
      }).catch(function(){useBtn.disabled=false;useBtn.textContent="Use as Portrait";});
    });
    editBtn.addEventListener("click",function(){
      var open=editArea.style.display!=="none";
      editArea.style.display=open?"none":"block";
    });
    regenBtn.addEventListener("click",function(){runGenerateWithPrompt(isImg2Img,promptTA.value.trim());});
    discardBtn.addEventListener("click",function(){status.innerHTML="";});
  }

  // ── Shared: generate / img2img ───────────────────────────────────────────
  async function runGenerate(isImg2Img,details){
    var status=document.getElementById("pm-status");
    if(!falKey){status.innerHTML="<span style='font-size:12px;color:var(--red);'>No fal.ai key — add one via File → fal.ai image key…</span>";return;}
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    var charDesc=buildCharDesc();
    var promptReq=isImg2Img
      ?"Write an image generation prompt to update a fantasy character portrait using a reference photo. "
        +"Maintain the person's likeness from the reference but render them as: "+charDesc+". "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Dark fantasy painterly style, dramatic lighting, upper body portrait. 2-3 sentences. Output ONLY the prompt."
      :"Write a detailed image generation prompt for a fantasy character portrait. "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Base character description (use where not overridden): "+charDesc+". "
        +"Spell out hair, eyes, skin tone, clothing, and visible gear explicitly. "
        +"Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly. 2-3 sentences. Output ONLY the prompt, no commentary, no tags.";
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Writing portrait prompt…</span>";
    busy=true;
    try{
      var prompt=await callGM(promptReq,"You are a portrait image prompt writer for a dark fantasy RPG. Output ONLY the image prompt. No narration, no game tags.",600);
      status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
      var falRes,mdlCfg=RENDER_MODELS[0],mi;
      if(isImg2Img){
        falRes=await fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify({image_url:pmRefSrc,prompt:prompt,strength:0.75,num_inference_steps:28,num_images:1})});
      }else{
        for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
        falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify(mdlCfg.body(prompt))});
      }
      if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
      var falData=await falRes.json();
      if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
      showResult(falData.images[0].url,isImg2Img,prompt);
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+err.message+"</span>";
    }
    busy=false;
  }

  // ── Shared: regenerate with edited prompt (skips Claude step) ───────────
  async function runGenerateWithPrompt(isImg2Img,prompt){
    var status=document.getElementById("pm-status");
    if(!falKey||!prompt)return;
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
    busy=true;
    try{
      var falRes,mdlCfg=RENDER_MODELS[0],mi;
      if(isImg2Img){
        falRes=await fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify({image_url:pmRefSrc,prompt:prompt,strength:0.75,num_inference_steps:28,num_images:1})});
      }else{
        for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
        falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify(mdlCfg.body(prompt))});
      }
      if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
      var falData=await falRes.json();
      if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
      showResult(falData.images[0].url,isImg2Img,prompt);
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+err.message+"</span>";
    }
    busy=false;
  }

  // ── 1. Upload ────────────────────────────────────────────────────────────
  document.getElementById("pm-upload").addEventListener("click",function(){document.getElementById("pm-file").click();});
  document.getElementById("pm-file").addEventListener("change",function(){
    var file=this.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(e){compressPortrait(e.target.result,function(compressed){setPort(compressed);if(refreshFn)refreshFn();pmClose();});};
    reader.readAsDataURL(file);this.value="";
  });

  // ── 2. Generate ──────────────────────────────────────────────────────────
  document.getElementById("pm-gen").addEventListener("click",function(){
    runGenerate(false,document.getElementById("pm-details-gen").value.trim());
  });

  // ── 3. Update ────────────────────────────────────────────────────────────
  if(document.getElementById("pm-upd")){
    document.getElementById("pm-upd").addEventListener("click",function(){
      runGenerate(true,document.getElementById("pm-details-upd").value.trim());
    });
  }
}
async function generateNpcSheet(name,doneCb){
  if(!worldState)return;
  if(busy){showToast("Game is busy — try again in a moment.");return;}
  var wsNpc=null,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){wsNpc=worldState.npcs[i];break;}}
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc){showToast("NPC not found.");return;}
  // Build context from all known data
  var ctx="NPC name: "+name+"\nStatus: "+(wsNpc.status||"unknown")+"\nRelation to player: "+(wsNpc.rel||"unknown")+"\n";
  if(wsNpc.pronouns)ctx+="Pronouns: "+wsNpc.pronouns+"\n";
  if(memNpc){
    if(memNpc.attitude)ctx+="Attitude/personality: "+memNpc.attitude+"\n";
    if(memNpc.knowledge&&memNpc.knowledge.length)ctx+="Known facts: "+memNpc.knowledge.join("; ")+"\n";
    if(memNpc.events&&memNpc.events.length){ctx+="Event log:\n";for(i=0;i<memNpc.events.length;i++)ctx+="  Turn "+memNpc.events[i].turn+": "+memNpc.events[i].note+"\n";}
  }
  var prompt="Generate a full D&D-style character sheet for a party member NPC. Use the game world, tone, and lore you already know. "
    +"Be creative but strictly consistent with all known facts listed below.\n\nKnown information:\n"+ctx+"\n"
    +"Output ONLY a single valid JSON object — no markdown, no code fences, no commentary:\n"
    +'{"gender":"M/F/NB","age":"age as string","appear":"full physical description","mark":"distinguishing mark or empty string","backstory":"2-3 sentence backstory consistent with known events",'
    +'"ancestry":"Human/Elf/Dwarf/Gnome/Tiefling/Hollow-Born/Half-Blood","subraceNm":"specific subrace name",'
    +'"cls":"Warrior/Rogue/Sorcerer/Ranger/Berserker/Paladin/Cleric/Druid","archetypeNm":"archetype or empty string",'
    +'"stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},'
    +'"hp":20,"maxHp":20,"gold":10,"level":1,"xp":0,'
    +'"trait":"personality trait","flaw":"character flaw","motivation":"core motivation",'
    +'"statedAlignment":"alignment string","actualAlignment":"alignment string","deity":"deity name or empty string",'
    +'"abilities":[{"nm":"ability name","ds":"description"}],'
    +'"spells":[{"nm":"spell name","lvl":1,"used":false}],'
    +'"inventory":["item1","item2"],'
    +'"languages":[{"name":"Common","broken":false}]}';
  busy=true;
  var removeLoader=showLoadingModal("Generating character sheet…");
  try{
    var resp=await callGM(prompt,"You are a D&D character sheet generator for a fantasy RPG. Output ONLY a single valid JSON object. No markdown fences, no extra text.",2000);
    var json=resp.trim().replace(/^```[a-z]*\n?/,"").replace(/\n?```$/,"").trim();
    var sheet=JSON.parse(json);
    sheet.name=name;
    if(!sheet.stats)sheet.stats={STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10};
    if(!sheet.abilities)sheet.abilities=[];
    if(!sheet.spells)sheet.spells=[];
    if(!sheet.inventory)sheet.inventory=[];
    if(!sheet.languages)sheet.languages=[{name:"Common",broken:false}];
    if(!sheet.conditions)sheet.conditions=[];
    if(!sheet.relationships)sheet.relationships=[];
    if(!sheet.saveModifiers)sheet.saveModifiers=[];
    if(!sheet.storyBeats)sheet.storyBeats=[];
    if(!sheet.skills){sheet.skills={};var sk2;for(sk2=0;sk2<SKILLS.length;sk2++)sheet.skills[SKILLS[sk2].id]=0;}
    sheet.portrait=wsNpc.portrait||null;
    sheet.partyMember=true;
    // Seed the player↔NPC relationship from live tracking data
    if(!sheet.relationships)sheet.relationships=[];
    if(worldState&&worldState.character){
      var pcn=worldState.character.name,hasPC=false,rki;
      for(rki=0;rki<sheet.relationships.length;rki++){if(sheet.relationships[rki].entity===pcn){hasPC=true;break;}}
      if(!hasPC&&wsNpc.rel&&wsNpc.rel!=="unknown")sheet.relationships.push({entity:pcn,descriptor:wsNpc.rel});
    }
    wsNpc.charSheet=sheet;
    saveAll();removeLoader();showToast("Character sheet ready!");
    if(doneCb)doneCb();
  }catch(err){removeLoader();showToast("Sheet generation failed: "+err.message);}
  busy=false;
}
function showNpcSheet(name){
  if(!worldState)return;
  var ex=document.getElementById("npc-modal");if(ex)ex.remove();
  var wsNpc=null,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){wsNpc=worldState.npcs[i];break;}}
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc&&!memNpc)return;
  var isParty=!!(wsNpc&&wsNpc.partyMember);
  var sheet=isParty&&wsNpc&&wsNpc.charSheet?wsNpc.charSheet:null;

  function sec(title,body){return'<div class="cs-sec"><div class="cs-sec-hd cs-sec-tog" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">'+title+'<span class="cs-tog-arr" style="font-size:10px;color:var(--t2);flex-shrink:0;margin-left:8px;">&#9654;</span></div><div class="cs-sec-body" style="display:none;">'+body+'</div></div>';}
  function kv(k,v){return'<div class="cs-kv"><span class="cs-k">'+k+'</span><span class="cs-v">'+v+'</span></div>';}

  var initials=name.split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";
  var portrait=wsNpc&&wsNpc.portrait?wsNpc.portrait:null;

  // ── Avatar ────────────────────────────────────────────────────────────────
  var avatarHtml=isParty
    ?"<div class='cs-avatar' id='npc-avatar-btn' title='Edit portrait'>"+(portrait?"<img src='"+portrait+"' alt='"+name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    :"<div class='cs-avatar' style='font-size:16px;cursor:default;'>"+initials+"</div>";

  // ── Hero info block ───────────────────────────────────────────────────────
  var heroInfo;
  if(sheet){
    var gLbl=sheet.gender==="F"?"Female":sheet.gender==="NB"?"Non-binary":"Male";
    var clsLine=(sheet.subraceNm?sheet.subraceNm+" ":"")+(sheet.ancestry||"")+" "+(sheet.cls||"")+(sheet.archetypeNm?" ["+sheet.archetypeNm+"]":"");
    var lvl=sheet.level||1,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
    var xpPct=lvl>=10?100:Math.min(100,Math.round(((sheet.xp-prevXP)/Math.max(1,nextXP-prevXP))*100));
    heroInfo="<div class='cs-hero-name'>"+name+"</div>"
      +"<div class='cs-hero-cls'>"+clsLine+"</div>"
      +"<div class='cs-hero-sub'>"+gLbl+" · "+(sheet.age||"?")+(sheet.deity?" · "+sheet.deity:"")+"</div>"
      +"<div style='margin-top:8px;font-size:13px;'>"
      +"<span style='color:var(--acc)'>Lv "+lvl+"</span>"
      +" &nbsp;·&nbsp; <span style='color:#e06060'>"+(sheet.hp||0)+"/"+(sheet.maxHp||0)+" HP</span>"
      +" &nbsp;·&nbsp; <span style='color:#c0a040'>"+(sheet.gold||0)+" gp</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(sheet.actualAlignment||sheet.statedAlignment||"Neutral")+"</span></div>"
      +"<div class='cs-xp-wrap'><div class='cs-xp-lbl'><span>"+(sheet.xp||0)+" XP</span>"
      +"<span>"+(lvl<10?"Next: "+nextXP+" XP":"Max level")+"</span></div>"
      +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+xpPct+"%;'></div></div></div>";
  }else{
    heroInfo="<div class='cs-hero-name'>"+name+"</div>"
      +(isParty?"<div class='cs-hero-cls'>Party Member</div>":"<div class='cs-hero-cls'>NPC</div>")
      +(wsNpc&&wsNpc.met?"<div class='cs-hero-sub'>First met: turn "+wsNpc.met+"</div>":"");
  }

  // ── Full character sheet sections (when charSheet exists) ─────────────────
  var sheetSections="";
  if(sheet){
    var SN=["STR","DEX","CON","INT","WIS","CHA"],statHtml="<div class='cs-stat-grid'>";
    for(i=0;i<SN.length;i++){var sv=sheet.stats&&sheet.stats[SN[i]]?sheet.stats[SN[i]]:10;statHtml+="<div class='cs-stat'><div class='cs-sn'>"+SN[i]+"</div><div class='cs-sv'>"+sv+"</div><div class='cs-sm'>"+smod(sv)+"</div></div>";}
    statHtml+="</div>";
    var earnedSk=[],ski;
    if(sheet.skills){for(ski=0;ski<SKILLS.length;ski++){var sk3=SKILLS[ski],sc=(typeof sheet.skills[sk3.id]==="number")?sheet.skills[sk3.id]:0;if(sc>0)earnedSk.push(sk3.label+" ("+SKILL_LEVELS[skillLevel(sc)]+")");}  }
    var skillHtml2=earnedSk.length?'<div class="cs-v">'+earnedSk.join(", ")+"</div>":'<span class="cs-none">None yet</span>';
    var condHtml2=sheet.conditions&&sheet.conditions.length?"<div class='cs-list'>"+(function(){var h="";for(i=0;i<sheet.conditions.length;i++)h+='<div class="cs-list-row"><span style="color:#e06060">'+sheet.conditions[i].name+'</span><span class="cs-dim"> — '+sheet.conditions[i].duration+'</span></div>';return h;})()+"</div>":'<span class="cs-none">None</span>';
    // Merge live player relationship in case sheet was generated before this fix
    var sheetRels=sheet.relationships?sheet.relationships.slice():[];
    if(worldState&&worldState.character){var pcn2=worldState.character.name,hasPC2=false,rki2;for(rki2=0;rki2<sheetRels.length;rki2++){if(sheetRels[rki2].entity===pcn2){hasPC2=true;break;}}if(!hasPC2&&wsNpc&&wsNpc.rel&&wsNpc.rel!=="unknown")sheetRels.push({entity:pcn2,descriptor:wsNpc.rel});}
    var relHtml2=sheetRels.length?"<div class='cs-list'>"+(function(){var h="";for(i=0;i<sheetRels.length;i++)h+='<div class="cs-list-row"><span style="color:var(--acc)">'+sheetRels[i].entity+'</span><span class="cs-dim"> — '+sheetRels[i].descriptor+'</span></div>';return h;})()+"</div>":'<span class="cs-none">None</span>';
    var langPts=[];if(sheet.languages&&sheet.languages.length){for(i=0;i<sheet.languages.length;i++){var lg=sheet.languages[i];langPts.push(lg.broken?'<span style="color:#a07838">'+lg.name+' (broken)</span>':lg.name);}}
    var langHtml2=langPts.length?'<div class="cs-v">'+langPts.join(", ")+"</div>":'<span class="cs-none">Common</span>';
    var saveHtml2="";if(sheet.saveModifiers&&sheet.saveModifiers.length){saveHtml2="<div class='cs-list'>";for(i=0;i<sheet.saveModifiers.length;i++){var smx=sheet.saveModifiers[i],svx=(smx.amount>=0?"+":"")+smx.amount;saveHtml2+='<div class="cs-list-row"><span>'+svx+' vs '+smx.type+'</span><span class="cs-dim"> ['+smx.source+']</span></div>';}saveHtml2+="</div>";}
    var beatsHtml2="";if(sheet.storyBeats&&sheet.storyBeats.length){for(i=sheet.storyBeats.length-1;i>=0;i--)beatsHtml2+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+sheet.storyBeats[i].turn+'</span>'+sheet.storyBeats[i].text+'</div>';}
    var abilHtml2=sheet.abilities&&sheet.abilities.length?(function(){var h="";for(i=0;i<sheet.abilities.length;i++)h+='<div class="cs-abil"><span class="cs-abil-nm">'+sheet.abilities[i].nm+'</span><span class="cs-abil-ds">'+sheet.abilities[i].ds+'</span></div>';return h;})():'<span class="cs-none">None yet</span>';
    var spellHtml2="";if(sheet.spells&&sheet.spells.length){var spPts2=[];for(i=0;i<sheet.spells.length;i++){var sp3=sheet.spells[i],stg=(sp3.lvl===0?"C":String(sp3.lvl)),nm4=(sp3.nm.indexOf("(")>=0?sp3.nm.slice(0,sp3.nm.indexOf("(")).trim():sp3.nm);var stxt="["+stg+"] "+nm4;spPts2.push(sp3.used?'<span style="color:var(--t2);text-decoration:line-through">'+stxt+'</span>':stxt);}spellHtml2='<div class="cs-v" style="line-height:1.9">'+spPts2.join(", ")+"</div>";}
    var invHtml2=sheet.inventory&&sheet.inventory.length?'<div class="cs-v">'+sheet.inventory.join(", ")+"</div>":'<span class="cs-none">Empty</span>';
    var charKv=(sheet.appear?kv("Appearance",sheet.appear):"")+(sheet.mark?kv("Distinguishing Mark",sheet.mark):"")+kv("Trait",sheet.trait||"—")+kv("Flaw",sheet.flaw||"—")+kv("Motivation",sheet.motivation||"—")+(sheet.backstory?kv("Backstory",sheet.backstory):"");
    sheetSections=sec("Attributes",statHtml)+sec("Character",charKv)+sec("Conditions",condHtml2)+sec("Relationships",relHtml2)+sec("Languages",langHtml2)+(sheet.saveModifiers&&sheet.saveModifiers.length?sec("Save Modifiers",saveHtml2):"")+sec("Skills",skillHtml2)+(sheet.storyBeats&&sheet.storyBeats.length?sec("Story Beats",beatsHtml2):"")+sec("Abilities",abilHtml2)+(sheet.spells&&sheet.spells.length?sec("Spells",spellHtml2):"")+sec("Inventory",invHtml2);
  }

  // ── NPC sections (always shown) ───────────────────────────────────────────
  var statusBlock="";
  if(wsNpc){statusBlock+=kv("Status",wsNpc.status||"—")+kv("Relation",wsNpc.rel||"—");if(wsNpc.pronouns)statusBlock+=kv("Pronouns",wsNpc.pronouns);}
  var memBlock="";
  if(memNpc){if(memNpc.attitude)memBlock+=kv("Attitude",memNpc.attitude);if(memNpc.knowledge&&memNpc.knowledge.length)memBlock+=kv("Knows",memNpc.knowledge.join("; "));}
  var evHtml="";
  if(memNpc&&memNpc.events&&memNpc.events.length){for(i=memNpc.events.length-1;i>=0;i--)evHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+memNpc.events[i].turn+'</span>'+memNpc.events[i].note+'</div>';}
  var npcSections=sec("Status",statusBlock||'<span class="cs-none">No data</span>')+(memBlock?sec("Profile",memBlock):"")+(evHtml?sec("History",evHtml):"");

  // ── Generate / Regenerate button ──────────────────────────────────────────
  var genBtnHtml=isParty?"<div style='margin-top:16px;'><button id='npc-gen-sheet' style='display:block;width:100%;padding:11px 14px;font-size:13px;font-family:Georgia,serif;border-radius:var(--r);cursor:pointer;text-align:center;background:var(--acc);border:none;color:#000;font-weight:bold;'>"+(sheet?"&#8635; Regenerate Sheet":"&#10022; Generate Character Sheet")+"</button></div>":"";

  var modal=document.createElement("div");modal.id="npc-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;'>"
    +"<div style='display:flex;justify-content:flex-end;margin-bottom:10px;'><button id='npc-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div>"
    +"<div class='cs-hero'><div style='position:relative;flex-shrink:0;'>"+avatarHtml+"</div>"
    +"<div class='cs-hero-info'>"+heroInfo+"</div></div>"
    +sheetSections
    +(sheetSections?"<div style='height:1px;background:var(--brd);margin:18px 0;'></div>":"")
    +npcSections
    +genBtnHtml
    +"</div>";

  document.body.appendChild(modal);
  document.getElementById("npc-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  (function(){var hdrs=modal.querySelectorAll(".cs-sec-tog"),hi;for(hi=0;hi<hdrs.length;hi++){hdrs[hi].addEventListener("click",function(){var body=this.parentNode.querySelector(".cs-sec-body"),arr=this.querySelector(".cs-tog-arr"),open=body.style.display!=="none";body.style.display=open?"none":"block";arr.style.transform=open?"":"rotate(90deg)";});}})();

  // ── Generate / Regenerate ─────────────────────────────────────────────────
  if(document.getElementById("npc-gen-sheet")){
    document.getElementById("npc-gen-sheet").addEventListener("click",function(){
      modal.remove();generateNpcSheet(name,function(){showNpcSheet(name);});
    });
  }

  // ── Portrait (party members only) ─────────────────────────────────────────
  if(isParty&&document.getElementById("npc-avatar-btn")){
    function refreshNpcAvatar(){
      var av=document.getElementById("npc-avatar-btn");if(!av)return;
      var port=wsNpc.portrait||null;
      av.innerHTML=(port?"<img src='"+port+"' alt='"+name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
    }
    // Use charSheet as portrait subject if available — richer prompt
    var npcSubject=sheet||{name:name,gender:"NB",age:"",ancestry:"",cls:"",archetypeNm:null,appear:"",mark:"",inventory:[]};
    var npcPortOpts={
      getPortrait:function(){return wsNpc.portrait||null;},
      setPortrait:function(url){wsNpc.portrait=url;if(wsNpc.charSheet)wsNpc.charSheet.portrait=url;saveAll();},
      subject:npcSubject
    };
    document.getElementById("npc-avatar-btn").addEventListener("click",function(){showPortraitModal(refreshNpcAvatar,npcPortOpts);});
  }
}
// ── Character browser modal ───────────────────────────────────────────────────
function showCharacterBrowser(){
  var ex=document.getElementById("char-browser-modal");if(ex)ex.remove();
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  var modal=document.createElement("div");modal.id="char-browser-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";

  function getCharFromCampaign(id,cb){
    var raw=store.get("ashen_camp_"+id+"_ws");
    if(raw){try{var ws=JSON.parse(raw);if(ws&&ws.character)return cb(null,ws.character);}catch(e){}}
    // Fall back to server
    var tok=localStorage.getItem("ashen_server_tok_v1")||"";
    var url=(localStorage.getItem("ashen_server_url_v1")||"").replace(/\/$/,"");
    if(!url||!tok){return cb("Not available locally and not connected to server.");}
    fetch(url+"/api/campaigns/"+id,{headers:{"Authorization":"Bearer "+tok}})
      .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(function(d){if(d&&d.worldState&&d.worldState.character)cb(null,d.worldState.character);else cb("No character data on server.");})
      .catch(function(e){cb(e.message);});
  }

  function render(){
    var meta=getCampMeta().slice().sort(function(a,b){return b.savedAt-a.savedAt;});
    var rows="";
    if(!meta.length){
      rows="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No saved campaigns found.</div>";
    } else {
      for(var i=0;i<meta.length;i++){
        var cm=meta[i];
        rows+="<div style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;'>"
          +"<div style='flex:1;min-width:0;'>"
          +"<div style='font-size:14px;color:var(--t0);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(cm.charName)+"</div>"
          +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>Lv"+cm.level+" "+escHtml(cm.charAncestry)+" "+escHtml(cm.charClass)+"&ensp;&mdash;&ensp;"+escHtml(cm.location)+"</div>"
          +"</div>"
          +"<button onclick='_charBrowserPick(\""+escHtml(cm.id)+"\")' style='padding:6px 14px;font-size:12px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;flex-shrink:0;'>Select</button>"
          +"</div>";
      }
    }
    modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
      +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
      +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Import Character</span>"
      +"<button id='cbr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +rows
      +"<div style='border-top:1px solid var(--brd);margin-top:14px;padding-top:14px;text-align:center;'>"
      +"<label style='display:inline-block;padding:8px 20px;font-size:12px;font-family:Georgia,serif;border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;' onmouseover='this.style.borderColor=\"var(--acc)\";this.style.color=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd2)\";this.style.color=\"var(--t2)\"'>"
      +"<input type='file' id='cbr-file-inp' accept='.char' style='display:none;'/> Import from file (.char)&hellip;</label></div>"
      +"</div>";
    document.getElementById("cbr-x").addEventListener("click",function(){modal.remove();});
    document.getElementById("cbr-file-inp").addEventListener("change",function(e){
      modal.remove();
      importCharacterFile(e);
    });
    window._charBrowserPick=function(id){
      var btn=modal.querySelector("[onclick*='"+id+"']");if(btn){btn.textContent="Loading…";btn.disabled=true;}
      getCharFromCampaign(id,function(err,char){
        if(err){showToast("Could not load character: "+err);if(btn){btn.textContent="Select";btn.disabled=false;}return;}
        modal.remove();
        showCharImportPreview(char,function(){
          snapshotActiveCamp();
          store.del(WSK);store.del(SLK);store.del(MEM_KEY);
          var nid=newCampaignId();setActiveCampId(nid);
          worldState=null;sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
          document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
          startGame(char,"Sword and Sorcery","");
        },showCharacterBrowser);
      });
    };
  }
  document.body.appendChild(modal);render();
}
// ── Character import preview modal ───────────────────────────────────────────
function showCharImportPreview(char, onAccept, onCancel){
  var ex=document.getElementById("char-import-preview");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-import-preview";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var initials=(char.name||"?").split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();
  var portrait=char.portrait?"<img src='"+char.portrait+"' alt='"+escHtml(char.name)+"' style='width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;'>":initials;
  var stats=char.stats||{};
  var statRow=["STR","DEX","CON","INT","WIS","CHA"].map(function(s){
    return "<div style='text-align:center;'><div style='font-size:10px;color:var(--t2);'>"+s+"</div><div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+(stats[s]||"—")+"</div></div>";
  }).join("");
  var abilities=(char.abilities||[]).slice(0,4).map(function(a){return "<div style='font-size:11px;color:var(--t1);margin-bottom:3px;'><span style='color:var(--acc);'>"+escHtml(a.nm)+"</span> — "+escHtml(a.ds)+"</div>";}).join("");
  var spells=(char.spells||[]).filter(function(s){return!s.used;}).slice(0,6).map(function(s){return escHtml(s.nm);}).join(", ");
  var inv=escHtml((char.inventory||[]).join(", ")||"Nothing");
  var langs=(char.languages||[]).map(function(l){return escHtml(l.name)+(l.broken?" (broken)":"");}).join(", ")||"Common";
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
    +"<span style='font-size:15px;color:var(--t0);font-weight:bold;'>Import Character</span>"
    +"<button id='cip-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='display:flex;gap:16px;align-items:center;margin-bottom:18px;'>"
    +"<div style='width:64px;height:64px;border-radius:50%;background:var(--bg3);border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--acc);font-weight:bold;flex-shrink:0;overflow:hidden;'>"+portrait+"</div>"
    +"<div><div style='font-size:18px;color:var(--acc);font-weight:bold;'>"+escHtml(char.name)+"</div>"
    +"<div style='font-size:12px;color:var(--t1);margin-top:2px;'>Lv"+(char.level||1)+" · "+escHtml(char.subraceNm||char.ancestry||"")+" "+escHtml(char.cls||"")+(char.archetypeNm?" ("+escHtml(char.archetypeNm)+")":"")+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(char.gender||"")+" · "+escHtml(char.age||"")+(char.deity?" · "+escHtml(char.deity):"")+"</div>"
    +"</div></div>"
    +"<div style='display:grid;grid-template-columns:repeat(6,1fr);gap:6px;background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:14px;'>"+statRow+"</div>"
    +"<div style='display:flex;gap:16px;margin-bottom:14px;font-size:12px;'>"
    +"<span style='color:#e06060;'>HP "+char.hp+"/"+char.maxHp+"</span>"
    +"<span style='color:var(--acc);'>"+char.gold+"gp</span>"
    +"<span style='color:var(--t1);'>"+escHtml(alignLabel(char.alignLaw||0,char.alignGood||0))+"</span>"
    +"</div>"
    +(char.appear?"<div style='font-size:11px;color:var(--t2);margin-bottom:10px;font-style:italic;'>"+escHtml(char.appear)+(char.mark?" — "+escHtml(char.mark):"")+"</div>":"")
    +(char.backstory?"<div style='font-size:11px;color:var(--t2);margin-bottom:10px;'>"+escHtml(char.backstory)+"</div>":"")
    +(abilities?"<div style='margin-bottom:10px;border-top:1px solid var(--brd);padding-top:10px;'>"+abilities+"</div>":"")
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:6px;'><span style='color:var(--t1);'>Languages:</span> "+langs+"</div>"
    +(spells?"<div style='font-size:11px;color:var(--t2);margin-bottom:6px;'><span style='color:var(--t1);'>Spells:</span> "+spells+"</div>":"")
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'><span style='color:var(--t1);'>Inventory:</span> "+inv+"</div>"
    +"<div style='display:flex;gap:10px;'>"
    +"<button id='cip-accept' style='flex:1;padding:11px;font-size:13px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Play as "+escHtml(char.name)+"</button>"
    +"<button id='cip-cancel' style='padding:11px 18px;font-size:13px;font-family:Georgia,serif;background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div></div>";
  document.body.appendChild(modal);
  function doCancel(){modal.remove();if(typeof onCancel==="function")onCancel();}
  document.getElementById("cip-x").addEventListener("click",doCancel);
  document.getElementById("cip-cancel").addEventListener("click",doCancel);
  document.getElementById("cip-accept").addEventListener("click",function(){modal.remove();onAccept();});
}
// ── Campaign management UI ────────────────────────────────────────────────────
function showCampaignPicker(){
  document.getElementById("file-menu").style.display="none";
  var ex=document.getElementById("camp-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="camp-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  function timeAgo(ts){var d=Math.floor((Date.now()-ts)/1000);if(d<60)return"just now";if(d<3600)return Math.floor(d/60)+"m ago";if(d<86400)return Math.floor(d/3600)+"h ago";return Math.floor(d/86400)+"d ago";}
  function render(){
    var meta=getCampMeta(),activeId=getActiveCampId();
    var sorted=meta.slice().sort(function(a,b){return b.savedAt-a.savedAt;});
    var rows="";
    if(!sorted.length){rows="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No saved campaigns yet.</div>";}
    else{var i;for(i=0;i<sorted.length;i++){var cm=sorted[i],isActive=cm.id===activeId;
      var dispName=cm.campName||cm.charName;
      rows+="<div style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:"+(isActive?"rgba(200,146,42,.08)":"var(--bg2)")+";border:1px solid "+(isActive?"var(--acc)":"var(--brd)")+";border-radius:8px;margin-bottom:8px;'>"
        +"<div style='flex:1;min-width:0;'>"
        +"<div style='display:flex;align-items:center;gap:6px;'>"
        +"<span id='camp-name-"+cm.id+"' style='font-size:14px;color:"+(isActive?"var(--acc)":"var(--t0)")+";font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(dispName)+"</span>"
        +"<button onclick='campStartRename(\""+escHtml(cm.id)+"\")' title='Rename' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:11px;padding:0 2px;flex-shrink:0;' onmouseover='this.style.color=\"var(--acc)\"' onmouseout='this.style.color=\"var(--t2)\"'>&#129718;</button>"
        +"</div>"
        +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(cm.charName)+" &mdash; Lv"+cm.level+" "+escHtml(cm.charAncestry)+" "+escHtml(cm.charClass)+"&ensp;&mdash;&ensp;"+escHtml(cm.location)+"</div>"
        +"<div style='font-size:10px;color:var(--t2);margin-top:2px;'>"+(isActive?"<span style='color:var(--acc);'>&#9679; Playing now</span>":"Last saved "+timeAgo(cm.savedAt))+"</div>"
        +"</div>"
        +(isActive?"<span style='font-size:10px;color:var(--acc);flex-shrink:0;'>ACTIVE</span>"
          :"<button onclick='campLoad(\""+cm.id+"\")' style='padding:6px 14px;font-size:12px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;flex-shrink:0;'>Load</button>"
          +"<button onclick='campDelete(\""+cm.id+"\")' style='padding:6px 10px;font-size:14px;font-family:Georgia,serif;background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;flex-shrink:0;margin-left:6px;'>&#215;</button>")
        +"</div>";}}
    modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
      +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Campaigns</span><button id='camp-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +rows
      +"<button onclick='campNew()' style='width:100%;margin-top:14px;padding:12px;font-size:13px;font-family:Georgia,serif;background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>&#10022; New Campaign</button>"
      +"</div>";
    document.getElementById("camp-x").addEventListener("click",function(){modal.remove();});
  }
  document.body.appendChild(modal);render();
}
function campLoad(id){
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  var ok=switchToCampaign(id);
  if(!ok){showToast("Failed to load campaign.");return;}
  document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
  syncUI();showGame();initAbilities();initSpells();
  addMsg("system","Campaign loaded: "+worldState.character.name+".");
  addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");
  var sll=sessionLog.length;if(sll>=2){var slu=sessionLog[sll-2],sla=sessionLog[sll-1];
    if(slu&&slu.role==="user")addMsg("player",slu.content);
    if(sla&&sla.role==="assistant"){var slc=cleanTxt(sla.content),sld=diceTxt(sla.content),slp=parseActions(slc);addMsg("narrator",(sld||"")+"<p>"+slp.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(slp.btns||""));}}
  if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}
}
function campDelete(id){
  if(!confirm("Delete this campaign? This cannot be undone."))return;
  deleteCampaign(id);
  var ex=document.getElementById("camp-modal");if(ex)ex.remove();
  showCampaignPicker();
}
function campStartRename(id){
  var span=document.getElementById("camp-name-"+id);if(!span)return;
  var cur=span.textContent;
  var safeVal=cur.replace(/&/g,"&amp;").replace(/'/g,"&#39;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  span.outerHTML="<input id='camp-rename-"+id+"' value='"+safeVal+"' style='font-size:14px;font-family:Georgia,serif;background:var(--bg3);border:1px solid var(--acc);border-radius:4px;color:var(--t0);padding:2px 6px;width:140px;' onblur='campSaveRename(\""+id+"\")' onkeydown='if(event.key===\"Enter\")campSaveRename(\""+id+"\");if(event.key===\"Escape\")showCampaignPicker();'/>";
  var inp=document.getElementById("camp-rename-"+id);if(inp){inp.focus();inp.select();}
}
function campSaveRename(id){
  var inp=document.getElementById("camp-rename-"+id);if(!inp)return;
  var name=inp.value.trim();if(!name)return showCampaignPicker();
  var meta=getCampMeta();
  for(var i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].campName=name;break;}}
  setCampMeta(meta);
  // Also update worldState.campName if this is the active campaign
  if(id===getActiveCampId()&&worldState){worldState.campName=name;saveAll();renameCampaignFolder(name);}
  else {
    // Patch the stored worldState for this campaign
    var raw=store.get("ashen_camp_"+id+"_ws");
    if(raw){try{var ws=JSON.parse(raw);ws.campName=name;store.set("ashen_camp_"+id+"_ws",JSON.stringify(ws));}catch(e){}}
  }
  showCampaignPicker();
}
function campNew(){
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  snapshotActiveCamp();
  store.del(WSK);store.del(SLK);store.del(MEM_KEY);
  var nid=newCampaignId();setActiveCampId(nid);
  worldState=null;sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
  document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
  showChar();
}
// ── Character I/O ─────────────────────────────────────────────────────────────
function _doExportChar(name, sheet){
  var data=JSON.stringify({ver:10,type:"character",character:sheet},null,2);
  var blob=new Blob([data],{type:"application/json"});
  var slug=function(s){return(s||"unknown").replace(/[^a-zA-Z0-9_\-]/g,"_");};
  var camp=slug(worldState.campName||worldState.character.name);
  var fname=camp+"_"+slug(name)+"_character.char";
  exportToFolder("character",blob,fname);
}
function exportCharacter(){
  document.getElementById("file-menu").style.display="none";
  if(!worldState){showToast("No active game.");return;}
  // Build list: player + any NPC with a full character sheet
  var chars=[{name:worldState.character.name,sheet:worldState.character,label:"Player character"}];
  var i,npc;for(i=0;i<worldState.npcs.length;i++){npc=worldState.npcs[i];if(npc.charSheet){var sub="Party member";if(npc.charSheet.cls)sub+=" · "+npc.charSheet.cls+(npc.charSheet.level?" Lv"+npc.charSheet.level:"");chars.push({name:npc.name,sheet:npc.charSheet,label:sub});}}
  // Always show picker — never silently download
  var ex=document.getElementById("char-export-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-export-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  var rows="",ci;for(ci=0;ci<chars.length;ci++){
    var slug=function(s){return(s||"unknown").replace(/\s+/g,"_");};
    var camp=slug(worldState.campName||worldState.character.name);
    var fname=camp+"_"+slug(chars[ci].name)+"_character.char";
    rows+="<div onclick='_charExportPick("+ci+")' style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;cursor:pointer;' onmouseover='this.style.borderColor=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd)\"'>"
      +"<div style='flex:1;min-width:0;'><div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+chars[ci].name+"</div>"
      +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+chars[ci].label+"</div>"
      +"<div style='font-size:10px;color:var(--t2);margin-top:3px;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+fname+"</div></div>"
      +"<span style='font-size:18px;color:var(--t2);flex-shrink:0;'>&#8595;</span></div>";
  }
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>Export Character</span><button id='cep-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +rows+"</div>";
  document.body.appendChild(modal);
  document.getElementById("cep-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  window._charExportList=chars;
}
function _charExportPick(idx){
  var modal=document.getElementById("char-export-modal");if(modal)modal.remove();
  var c=window._charExportList&&window._charExportList[idx];if(c)_doExportChar(c.name,c.sheet);
}
function importCharacterFile(e){
  var file=e.target.files&&e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var data=JSON.parse(ev.target.result);
      if(!data.character||!data.character.name){showToast("Invalid character file.");return;}
      var char=data.character;
      if(!char.skills)char.skills=initSkills();if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];
      if(!char.saveModifiers)char.saveModifiers=[];if(!char.languages)char.languages=[];if(char.portrait===undefined)char.portrait=null;
      if(!char.storyBeats)char.storyBeats=[];if(!char.abilities)char.abilities=[];if(!char.spells)char.spells=[];
      showCharImportPreview(char, function(){
        snapshotActiveCamp();
        store.del(WSK);store.del(SLK);store.del(MEM_KEY);
        var nid=newCampaignId();setActiveCampId(nid);
        worldState=null;sessionLog=[];memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
        document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
        startGame(char,"Sword and Sorcery","");
      },showCharacterBrowser);
    }catch(err){showToast("Failed to import: "+err.message);}
  };
  reader.readAsText(file);e.target.value="";
}
function wireButtons(){
  document.getElementById("api-btn").addEventListener("click",submitKey);
  document.getElementById("api-input").addEventListener("keydown",function(e){if(e.key==="Enter")submitKey();});
  document.getElementById("tone-next").addEventListener("click",function(){if(!cs.tone){document.getElementById("s1-warn").textContent="Choose a tone.";return;}if(cs.tone==="custom"){var t=document.getElementById("tone-ct");if(!t||!t.value.trim()){document.getElementById("s1-warn").textContent="Describe your custom tone.";return;}}document.getElementById("s1-warn").textContent="";goStep(2);});
  document.getElementById("id-back").addEventListener("click",function(){goStep(1);});
  document.getElementById("id-next").addEventListener("click",function(){var n=document.getElementById("char-name").value.trim();if(!n){document.getElementById("s2-warn").textContent="Enter a name.";return;}cs.name=n;cs.gender=document.getElementById("char-gender").value;cs.age=document.getElementById("char-age").value;cs.appear=document.getElementById("char-appear").value.trim();cs.mark=document.getElementById("char-mark").value.trim();cs.backstory=document.getElementById("char-backstory").value.trim();document.getElementById("s2-warn").textContent="";goStep(3);});
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
  document.addEventListener("click",function(){var fm=document.getElementById("file-menu");if(fm)fm.style.display="none";var cfm=document.getElementById("cs-file-menu");if(cfm)cfm.style.display="none";var afm=document.getElementById("api-file-menu");if(afm)afm.style.display="none";});
  document.getElementById("cs-file-btn").addEventListener("click",function(e){e.stopPropagation();var cfm=document.getElementById("cs-file-menu");cfm.style.display=cfm.style.display==="block"?"none":"block";});
  document.getElementById("cs-fm-campaigns").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";showCampaignPicker();});
  document.getElementById("cs-import-inp").addEventListener("change",importSave);
  document.getElementById("cs-import-char-btn").addEventListener("click",showCharacterBrowser);
  document.getElementById("cs-fm-devmode").addEventListener("click",function(e){e.stopPropagation();var sub=document.getElementById("cs-fm-devmenu"),arrow=document.getElementById("cs-fm-devmode-arrow");var open=sub.style.display!=="none";sub.style.display=open?"none":"block";arrow.style.transform=open?"":"rotate(90deg)";});
  document.getElementById("cs-fm-rules").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";showRulesModal();});
  document.getElementById("cs-fm-fal-key").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";showRenderOptionsModal();});
  document.getElementById("cs-fm-adult-cb").addEventListener("change",toggleAdultMode);
  document.getElementById("cs-fm-server-connect").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";connectToServer();});
  document.getElementById("cs-fm-server-disconnect").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";disconnectFromServer();});
  document.getElementById("cs-fm-set-folder").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";setCampaignFolder();});
  document.getElementById("cs-fm-clear-folder").addEventListener("click",function(){document.getElementById("cs-file-menu").style.display="none";clearCampaignFolder();});
  document.getElementById("api-file-btn").addEventListener("click",function(e){e.stopPropagation();var afm=document.getElementById("api-file-menu");afm.style.display=afm.style.display==="block"?"none":"block";});
  document.getElementById("api-fm-campaigns").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";showCampaignPicker();});
  document.getElementById("api-import-inp").addEventListener("change",importSave);
  document.getElementById("api-import-char-btn").addEventListener("click",showCharacterBrowser);
  document.getElementById("api-fm-devmode").addEventListener("click",function(e){e.stopPropagation();var sub=document.getElementById("api-fm-devmenu"),arrow=document.getElementById("api-fm-devmode-arrow");var open=sub.style.display!=="none";sub.style.display=open?"none":"block";arrow.style.transform=open?"":"rotate(90deg)";});
  document.getElementById("api-fm-rules").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";showRulesModal();});
  document.getElementById("api-fm-fal-key").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";showRenderOptionsModal();});
  document.getElementById("api-fm-adult-cb").addEventListener("change",toggleAdultMode);
  document.getElementById("api-fm-server-connect").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";connectToServer();});
  document.getElementById("api-fm-server-disconnect").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";disconnectFromServer();});
  document.getElementById("api-fm-set-folder").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";setCampaignFolder();});
  document.getElementById("api-fm-clear-folder").addEventListener("click",function(){document.getElementById("api-file-menu").style.display="none";clearCampaignFolder();});
  document.getElementById("fm-export").addEventListener("click",exportSave);
  document.getElementById("import-inp").addEventListener("change",importSave);
  document.getElementById("import-step1").addEventListener("change",importSave);
  // fm-narrative button removed (auto-export every 10 turns handles this)
  document.getElementById("fm-devmode").addEventListener("click",function(e){
    e.stopPropagation();
    var sub=document.getElementById("fm-devmenu"),arrow=document.getElementById("fm-devmode-arrow");
    var open=sub.style.display!=="none";
    sub.style.display=open?"none":"block";
    arrow.style.transform=open?"":"rotate(90deg)";
  });
  document.getElementById("fm-rules").addEventListener("click",showRulesModal);
  document.getElementById("fm-fal-key").addEventListener("click",showRenderOptionsModal);
  document.getElementById("fm-adult-cb").addEventListener("change",toggleAdultMode);
  document.getElementById("fm-sync-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";showSyncModal();});
  document.getElementById("fm-state-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("fm-render-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";doRender();});
  document.getElementById("fm-server-connect").addEventListener("click",connectToServer);
  document.getElementById("fm-server-disconnect").addEventListener("click",disconnectFromServer);
  document.getElementById("fm-set-folder").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";setCampaignFolder();});
  document.getElementById("fm-clear-folder").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";clearCampaignFolder();});
  document.getElementById("fm-campaigns").addEventListener("click",showCampaignPicker);
  document.getElementById("fm-export-char").addEventListener("click",exportCharacter);
  document.getElementById("import-char-btn").addEventListener("click",showCharacterBrowser);
  document.getElementById("fm-newgame").addEventListener("click",newGame);
  window.addEventListener("beforeunload",function(){snapshotActiveCamp();});
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
  document.getElementById("psh-party").addEventListener("click",function(){secCol.party=!secCol.party;document.getElementById("pss-party").classList.toggle("col",secCol.party);});
  document.getElementById("psh-inv").addEventListener("click",function(){secCol.inv=!secCol.inv;document.getElementById("pss-inv").classList.toggle("col",secCol.inv);});
  document.getElementById("psh-ab").addEventListener("click",function(){secCol.ab=!secCol.ab;document.getElementById("pss-ab").classList.toggle("col",secCol.ab);});
  document.getElementById("psh-sp").addEventListener("click",function(){secCol.sp=!secCol.sp;document.getElementById("pss-sp").classList.toggle("col",secCol.sp);});
}
function loadFalKey(){var fk=store.get(FAL_KEY_K);if(fk){falKey=fk;var fi=document.getElementById("fal-input");if(fi)fi.value=fk;}}
function loadRenderModel(){var m=store.get(RENDER_MDL_K);if(m)renderModel=m;}
function showRenderOptionsModal(){
  document.getElementById("file-menu").style.display="none";
  var ex=document.getElementById("render-opts-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="render-opts-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  // Build model rows
  var mhtml="",mi;
  for(mi=0;mi<RENDER_MODELS.length;mi++){
    var m=RENDER_MODELS[mi],sel=(m.id===renderModel);
    mhtml+="<div class='ro-row' data-id='"+m.id+"' style='display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid "+(sel?"var(--acc)":"var(--brd)")+";background:"+(sel?"rgba(200,146,42,.08)":"var(--bg2)")+";margin-bottom:6px;'>"
      +"<div style='width:13px;height:13px;border-radius:50%;border:2px solid "+(sel?"var(--acc)":"var(--brd2)")+";background:"+(sel?"var(--acc)":"transparent")+";flex-shrink:0;'></div>"
      +"<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+m.label+"</span>"
      +"</div>";
  }
  modal.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:400px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🖼 Render Options</span><button id='ro-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>fal.ai API Key</div>"
    +"<input type='password' id='ro-fal-inp' placeholder='fal_key_...' style='width:100%;padding:9px 12px;font-size:13px;font-family:monospace;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:8px;box-sizing:border-box;'/>"
    +"<div style='display:flex;gap:6px;margin-bottom:22px;'><button id='ro-fal-clear' style='padding:7px 13px;font-family:Georgia,serif;font-size:12px;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Clear</button><button id='ro-fal-save' style='flex:1;padding:8px;font-size:13px;font-family:Georgia,serif;background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save Key</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Image Model</div>"
    +mhtml
    +"<p id='ro-msg' style='font-size:12px;min-height:16px;margin-top:10px;text-align:center;'></p>"
    +"</div>";
  document.body.appendChild(modal);
  var inp=document.getElementById("ro-fal-inp");if(falKey)inp.value=falKey;
  document.getElementById("ro-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("ro-fal-save").addEventListener("click",function(){var v=inp.value.trim();if(v){falKey=v;store.set(FAL_KEY_K,v);var msg=document.getElementById("ro-msg");msg.textContent="Key saved.";msg.style.color="var(--grn)";}else{document.getElementById("ro-msg").textContent="Enter a key.";}});
  document.getElementById("ro-fal-clear").addEventListener("click",function(){falKey="";store.del(FAL_KEY_K);inp.value="";var msg=document.getElementById("ro-msg");msg.textContent="Key cleared.";msg.style.color="var(--t2)";});
  // Model rows — update in place on click
  var rows=modal.querySelectorAll(".ro-row");
  Array.prototype.forEach.call(rows,function(row){
    row.addEventListener("click",function(){
      renderModel=this.getAttribute("data-id");store.set(RENDER_MDL_K,renderModel);
      Array.prototype.forEach.call(rows,function(r){
        var s=(r.getAttribute("data-id")===renderModel);
        r.style.borderColor=s?"var(--acc)":"var(--brd)";r.style.background=s?"rgba(200,146,42,.08)":"var(--bg2)";
        var dot=r.querySelector("div");if(dot){dot.style.borderColor=s?"var(--acc)":"var(--brd2)";dot.style.background=s?"var(--acc)":"transparent";}
        var lbl=r.querySelector("span");if(lbl)lbl.style.color=s?"var(--acc)":"var(--t1)";
      });
      var mdlName=renderModel.split("/").pop();var msg=document.getElementById("ro-msg");if(msg){msg.textContent="Model: "+mdlName;msg.style.color="var(--grn)";}
    });
  });
}
function submitKey(){var k=document.getElementById("api-input").value.trim();if(k.indexOf("sk-")<0){document.getElementById("api-warn").textContent="Invalid key format.";return;}apiKey=k;store.set(AKK,k);var falEl=document.getElementById("fal-input");var fk=falEl?falEl.value.trim():"";if(fk){falKey=fk;store.set(FAL_KEY_K,fk);}document.getElementById("api-screen").style.display="none";init();}
function init(){loadRules();loadAdultMode();updateServerUI();storageAdapter.load(function(saved){if(saved&&worldState){if(!getActiveCampId())migrateToCampaigns();showGame();syncUI();initAbilities();initSpells();addMsg("system","Welcome back, "+worldState.character.name+".");addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");var sll=sessionLog.length;if(sll>=2){var slu=sessionLog[sll-2],sla=sessionLog[sll-1];if(slu&&slu.role==="user")addMsg("player",slu.content);if(sla&&sla.role==="assistant"){var slc=cleanTxt(sla.content),sld=diceTxt(sla.content),slp=parseActions(slc);addMsg("narrator",(sld||"")+"<p>"+slp.clean.replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>")+"</p>"+(slp.btns||""));}}if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}else{showChar();}});}
window.addEventListener("load",function(){wireButtons();loadFalKey();loadRenderModel();var k=store.get(AKK);if(k){apiKey=k;document.getElementById("api-screen").style.display="none";init();}});
