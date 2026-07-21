// ui-files.js — campaign folder handles (File System Access API), filename builder, folder
// export/rename, and save/blueprint/narrative export-import.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
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
  if(type==="save")     return base+"_t"+turn+".tnd";
  if(type==="narrative")return base+"_t"+turn+".html";
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
  eachMenuEl("set-folder",function(btn){btn.style.display=_campFolderHandle?"none":"block";});/* #15⑤ */
  eachMenuEl("clear-folder",function(clr){clr.style.display=_campFolderHandle?"block":"none";if(_campFolderHandle)clr.textContent="📁 "+_campFolderHandle.name+" ×";});
}
// Export Narrative (v1.229) — an on-demand, self-contained HTML keepsake of the whole story. Reads
// worldState.transcript (the COMPLETE, ordered, cross-device record — NOT the DOM, which the old removed
// exportNarrative scraped and which only holds the last ~20 repainted entries after a reload). A v0 of the
// memento / story compiler (#5, "standalone HTML first"). buildNarrativeHtml is a pure ws->string function
// so it's inspectable; exportNarrativeHtml wraps it in a Blob and routes through the folder/downloads path.
function buildNarrativeHtml(ws){
  var esc=(typeof escHtml==="function")?escHtml:function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");};
  var c=(ws&&ws.character)||{name:"Unknown"};
  var tr=(ws&&ws.transcript)||[];
  var camp=(ws&&ws.campName)||c.name||"A Chronicle";
  var who=(c.subraceNm?c.subraceNm+" ":"")+(c.ancestry||"")+" "+(c.cls||"")+(c.level?", Level "+c.level:"");
  var body="",lastTurn=null,i,k;
  for(i=0;i<tr.length;i++){
    var e=tr[i];if(!e||e.x==null||e.x==="")continue;
    if(e.t!=null&&e.t!==lastTurn){body+="<div class='turn'>Turn "+esc(String(e.t))+"</div>";lastTurn=e.t;}
    if(e.r==="player"){
      body+="<p class='act'>"+esc(e.x)+"</p>";
    }else{
      var paras=String(e.x).split(/\n{2,}|\n/),pj="";
      for(k=0;k<paras.length;k++){if(paras[k].trim())pj+="<p>"+esc(paras[k].trim())+"</p>";}
      body+="<div class='gm'>"+(pj||"<p>"+esc(e.x)+"</p>")+"</div>";
    }
  }
  var when="";try{when=new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});}catch(ex){}
  var ver=(typeof APP_VERSION!=="undefined")?APP_VERSION:"";
  var css=":root{--ink:#2b2620;--dim:#8a7f6d;--acc:#b8935a;--bg:#f7f1e6;--line:#e3d8c4;}"
    +"*{box-sizing:border-box;}html,body{margin:0;}"
    +"body{background:var(--bg);color:var(--ink);font:17px/1.72 Georgia,'Iowan Old Style','Times New Roman',serif;}"
    +".wrap{max-width:720px;margin:0 auto;padding:56px 24px 96px;}"
    +"header{text-align:center;border-bottom:2px solid var(--acc);padding-bottom:26px;margin-bottom:36px;}"
    +"header h1{font-size:30px;line-height:1.25;margin:0 0 10px;font-weight:700;}"
    +"header .who{font-size:15px;color:var(--dim);font-style:italic;margin:0 0 12px;}"
    +"header .meta{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.16em;}"
    +".turn{text-align:center;font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.22em;margin:34px 0 12px;}"
    +".gm p{margin:0 0 16px;}"
    +".act{margin:20px 0;padding:2px 0 2px 18px;border-left:3px solid var(--acc);color:#5c5140;font-style:italic;}"
    +".act::before{content:'\\276F   ';color:var(--acc);font-style:normal;}"
    +"footer{margin-top:64px;padding-top:18px;border-top:1px solid var(--line);text-align:center;font-size:12px;color:var(--dim);}"
    +"@media print{body{background:#fff;}.wrap{padding:0 0 24px;}}";
  return "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
    +"<meta name='viewport' content='width=device-width,initial-scale=1'>"
    +"<title>"+esc(camp)+" — a Traffic and Dragons chronicle</title><style>"+css+"</style></head><body><div class='wrap'>"
    +"<header><h1>"+esc(camp)+"</h1><div class='who'>"+esc(who.trim())+"</div>"
    +"<div class='meta'>Turns 0&ndash;"+esc(String((ws&&ws.turn)||0))+" &middot; "+tr.length+" passages</div></header>"
    +"<main>"+(body||"<p style='text-align:center;color:var(--dim)'>No narrative recorded yet.</p>")+"</main>"
    +"<footer>Chronicled by Traffic and Dragons"+(when?" &middot; "+esc(when):"")+(ver?" &middot; "+esc(ver):"")+"</footer>"
    +"</div></body></html>";
}
function exportNarrativeHtml(){
  if(!worldState){if(typeof showToast==="function")showToast("No campaign loaded.");return;}
  if(typeof closeAllMenus==="function")closeAllMenus();else{var fm=document.getElementById("file-menu");if(fm)fm.style.display="none";}
  var blob=new Blob([buildNarrativeHtml(worldState)],{type:"text/html"});
  exportToFolder("narrative",blob,buildFilename("narrative"));
}
function exportSave(){
  if(!worldState)return;
  document.getElementById("file-menu").style.display="none";
  var fname=buildFilename("save");
  // Check if we've saved this filename before (same turn = likely overwrite)
  var saved=[];try{var sr=localStorage.getItem("tnd_saved_files_v1");if(sr)saved=JSON.parse(sr);}catch(e){}
  var alreadySaved=saved.indexOf(fname)>=0;
  var modal=modalShell("save-confirm-modal",/* #14 */
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:6px;'>Save Game (local)</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Turn "+worldState.turn+" &nbsp;·&nbsp; "+worldState.world.location+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>File</div>"
    +"<input id='sc-fname' type='text' value='"+fname+"' style='width:100%;font-size:12px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);padding:8px 10px;color:var(--t1);box-sizing:border-box;margin-bottom:"+(alreadySaved?"12":"20")+"px;'/>"
    +(alreadySaved?"<div style='font-size:12px;color:var(--acc);margin-bottom:16px;'>&#9888; A file with this name may already exist in your downloads folder.</div>":"")
    +"<div style='display:flex;gap:10px;'><button id='sc-cancel' style='flex:1;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Cancel</button>"
    +"<button id='sc-save' style='flex:1;padding:10px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:var(--on-acc);font-weight:bold;cursor:pointer;'>Save</button></div>",
    {maxWidth:400,outside:true});
  function getFname(){var el=document.getElementById("sc-fname");return(el&&el.value.trim())||fname;}
  function doSave(){
    var actualFname=getFname();
    // The async server reconcile can REPLACE worldState between modal-open and this click
    // (stale local state adopted the server blob mid-dialog) — the payload below serializes
    // the LIVE state, so a prefilled (unedited) filename must be recomputed from it too, or
    // the file gets the pre-reconcile turn stamp (the t4-name-on-t139-data bug, 2026-07-03).
    if(actualFname===fname)actualFname=buildFilename("save");
    modal.remove();
    var data=JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory},null,2);
    var blob=new Blob([data],{type:"application/json"});exportToFolder("save",blob,actualFname);
    if(saved.indexOf(actualFname)<0)saved.push(actualFname);
    if(saved.length>100)saved=saved.slice(-100);
    try{localStorage.setItem("tnd_saved_files_v1",JSON.stringify(saved));}catch(e){}
  }
  document.getElementById("sc-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("sc-save").addEventListener("click",doSave);
  document.getElementById("sc-fname").addEventListener("keydown",function(e){if(e.key==="Enter")doSave();});
}
// buildBlueprintFromGame moved to game.js (v1.156) — pure data logic, now headless-testable.
// The Blueprint Designer is a fully EXTERNAL page (blueprint-designer.html, D5 revised
// 2026-07-03) with NO File-menu entry by user preference — open it directly.
function exportBlueprint(){
  if(!worldState||!worldState.character)return;
  document.getElementById("file-menu").style.display="none";
  var bp=buildBlueprintFromGame();
  var connected=storageAdapter.isServerMode();
  var voiceOpts="",vCur=bp.proseAuthor||"",vi;
  for(vi=0;vi<AUTHORS.length;vi++){voiceOpts+="<option value='"+AUTHORS[vi].id+"'"+(AUTHORS[vi].id===vCur?" selected":"")+">"+escHtml(AUTHORS[vi].nm)+(AUTHORS[vi].blurb?" — "+escHtml(AUTHORS[vi].blurb):"")+"</option>";}
  // #9 narrator voice — the audio twin of the prose voice. "" ships no opinion, so the player's own
  // narrator survives the import (applyBlueprint's E20 rule). TTS.voices() is the shared catalog.
  var nvOpts="<option value=''>— none (player's own narrator) —</option>",nvCur=bp.narratorVoice||"",nvList=(typeof TTS!=="undefined"&&TTS.voices)?TTS.voices():[],nvi;
  for(nvi=0;nvi<nvList.length;nvi++){nvOpts+="<option value='"+nvList[nvi].id+"'"+(nvList[nvi].id===nvCur?" selected":"")+">"+escHtml(nvList[nvi].label)+"</option>";}
  var modal=modalShell("bp-export-modal",/* #14 */
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:16px;'>Export as Blueprint</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Blueprint name</div>"
    +"<input id='bp-export-name' type='text' value='"+bp.name.replace(/'/g,"&#39;")+"' style='width:100%;padding:9px 12px;font-size:14px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);box-sizing:border-box;margin-bottom:12px;'/>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Prose voice <span style='opacity:0.6;'>(player can override)</span></div>"
    +"<select id='bp-export-voice' style='width:100%;padding:9px 12px;font-size:12px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);box-sizing:border-box;margin-bottom:12px;'>"+voiceOpts+"</select>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Narrator voice <span style='opacity:0.6;'>(player can override)</span></div>"
    +"<select id='bp-export-nvoice' style='width:100%;padding:9px 12px;font-size:12px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);box-sizing:border-box;margin-bottom:12px;'>"+nvOpts+"</select>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Acts: "+(bp.acts.length)+" &nbsp;·&nbsp; NPCs: "+bp.npcs.length+" &nbsp;·&nbsp; Locations: "+bp.locations.length+"</div>"
    +"<div style='display:flex;gap:10px;flex-wrap:wrap;'>"
    +"<button id='bp-export-cancel' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Cancel</button>"
    +"<button id='bp-export-dl' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);cursor:pointer;'>&#8595; Download</button>"
    +(connected?"<button id='bp-export-cloud' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:var(--on-acc);font-weight:bold;cursor:pointer;'>&#9729; Save to blueprint library</button>":"<button disabled style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:default;opacity:0.5;'>&#9729; Save to blueprint library</button>")
    +"</div>",
    {maxWidth:420,outside:true});
  function getName(){return (document.getElementById("bp-export-name").value||bp.name).trim();}
  function getVoice(){var s=document.getElementById("bp-export-voice");return s?s.value:"";}
  function getNVoice(){var s=document.getElementById("bp-export-nvoice");return s?s.value:"";}
  document.getElementById("bp-export-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("bp-export-dl").addEventListener("click",function(){
    bp.name=getName();bp.proseAuthor=getVoice();bp.narratorVoice=getNVoice();
    var data=JSON.stringify(bp,null,2);
    var blob=new Blob([data],{type:"application/json"});
    var fname=(bp.name||"blueprint").replace(/[^a-z0-9_\-\s]/gi,"").replace(/\s+/g,"_").toLowerCase()+".blueprint";
    exportToFolder("save",blob,fname);
    modal.remove();
  });
  if(connected){
    document.getElementById("bp-export-cloud").addEventListener("click",function(){
      bp.name=getName();bp.proseAuthor=getVoice();bp.narratorVoice=getNVoice();
      var btn=document.getElementById("bp-export-cloud");btn.disabled=true;btn.textContent="Saving…";
      storageAdapter.saveBlueprintToLibrary(bp,function(err){
        if(err){showToast("Blueprint save failed: "+err);btn.disabled=false;btn.textContent="☁ Save to blueprint library";}
        else{modal.remove();showToast("Blueprint saved to the blueprint library.");}
      });
    });
  }
}
function importSave(event){
  var file=event.target.files[0];if(!file)return;var reader=new FileReader();
  reader.onload=function(e){try{var data=JSON.parse(e.target.result);
    if(!data.worldState||!data.worldState.character)throw new Error("Invalid save.");
    var ws=data.worldState,ch=ws.character;
    if(typeof ch.name!=="string")throw new Error("Invalid character data.");
    if(!Array.isArray(ch.inventory))ch.inventory=[];
    if(!Array.isArray(ch.abilities))ch.abilities=[];
    if(!Array.isArray(ch.spells))ch.spells=[];
    if(!Array.isArray(ws.npcs))ws.npcs=[];
    if(!Array.isArray(ws.questLog))ws.questLog=[];
    if(!Array.isArray(ws.eventHistory))ws.eventHistory=[];
    if(!ws.world||typeof ws.world!=="object")throw new Error("Invalid world data.");
    // Snapshot (and flush, via E74) the OUTGOING campaign before repointing (audit E12) — importSave
    // used to overwrite worldState + the active campaign id without preserving the current campaign,
    // silently destroying its in-session progress since the last snapshot.
    if(!snapshotActiveCamp())throw new Error("Storage full — couldn't back up the current campaign before importing.");/* B4: surfaces via this function's own import-error path */
    worldState=ws;
    // Resolve campaign slot: reuse the file's own campId if present, else current active, else mint new
    var _cid=ws.campId;
    if(_cid){setActiveCampId(_cid);}
    else{var _aid=getActiveCampId();if(!_aid){_aid=newCampaignId();setActiveCampId(_aid);}worldState.campId=_aid;}
    migrateWorldState(); // older exports miss v10 fields (objectives/transcript/etc) — same battery loadState runs (audit #15)
    sessionLog=Array.isArray(data.sessionLog)?data.sessionLog:[];
    var mm=data.memory||{};
    memory={npcs:mm.npcs||{},locations:mm.locations||{},quests:mm.quests||{},lore:Array.isArray(mm.lore)?mm.lore:[],keyDecisions:Array.isArray(mm.keyDecisions)?mm.keyDecisions:[],futureEvents:Array.isArray(mm.futureEvents)?mm.futureEvents:[],chapters:Array.isArray(mm.chapters)?mm.chapters:[],map:mm.map||{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:mm.npcGraph?{edges:mm.npcGraph.edges||[],factions:mm.npcGraph.factions||{},factionEdges:mm.npcGraph.factionEdges||[],npcFactions:mm.npcGraph.npcFactions||{}}:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:mm.archive?{lore:mm.archive.lore||[],decisions:mm.archive.decisions||[],chapters:mm.archive.chapters||[]}:{lore:[],decisions:[],chapters:[]}};/* archive survives export/import (P12) */
    saveAll();document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showGame();syncUI();initAbilities();initSpells();addMsg("system","Loaded: "+escHtml(worldState.character.name)+" Turn "+worldState.turn);/* imported-file name (#22/UA18) */if(typeof initReplaySession==="function")initReplaySession();/* replay the story pane like init()/campLoad do — importSave left it empty (audit E65) */if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}catch(err){showToast("Import failed: "+err.message);}};
  reader.readAsText(file);event.target.value="";
}
