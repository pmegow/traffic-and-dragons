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
function _downloadBlob(blob,filename){
  var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
// Returns a Promise<bool>: true = written into the campaign folder (restorable later), false =
// fell back to a browser download (path unknown to us). Existing callers ignore the return value,
// so adding it is backward compatible.
function exportToFolder(type,blob,filename){
  if(!_campFolderHandle){ _downloadBlob(blob,filename); return Promise.resolve(false); }
  var sub=_SUBFOLDERS[type]||"misc";
  return _campFolderHandle.getDirectoryHandle(sub,{create:true}).then(function(dir){
    return dir.getFileHandle(filename,{create:true});
  }).then(function(fh){
    return fh.createWritable();
  }).then(function(w){
    return w.write(blob).then(function(){return w.close();});
  }).then(function(){
    // Name the WHOLE path, campaign folder included — "Saved to renders/x.jpg" left the user
    // guessing which folder that was (field request 2026-07-27).
    var _fn=(_campFolderHandle&&_campFolderHandle.name)?_campFolderHandle.name+"/":"";
    showToast("Saved to "+_fn+sub+"/"+filename);
    return true;
  }).catch(function(e){
    showToast("Folder write failed: "+e.message);
    _downloadBlob(blob,filename);
    return false;
  });
}

// ── #30: the campaign folder must SURVIVE A RELOAD ───────────────────────────────────────────
// _campFolderHandle was a plain var, so every reload (including File ▸ Clear cache & reload)
// silently dropped it and the next save reverted to a download with no warning — the user picked
// a folder once and quietly stopped getting files there. File System Access handles ARE
// structured-cloneable, so IndexedDB can hold one across sessions. Permission does NOT survive:
// a restored handle comes back in the "prompt" state and re-granting needs a USER GESTURE, so we
// restore the handle at boot but only ask for permission inside a click (see _ensureFolderPerm).
var FS_IDB="tnd_fs_v1", FS_IDB_STORE="handles", FS_IDB_KEY="campFolder", CP_IDB_STORE="checkpoints";/* #300: the offline camp copy lives beside the folder handle — IndexedDB, never localStorage */
var _campFolderPending=null;   // restored but not yet re-permissioned
function _idbOpen(){
  return new Promise(function(res,rej){
    if(typeof indexedDB==="undefined"||!indexedDB){rej(new Error("no indexedDB"));return;}
    var rq=indexedDB.open(FS_IDB,2);/* #300: v2 adds the checkpoints store */
    rq.onupgradeneeded=function(){var db=rq.result;if(!db.objectStoreNames.contains(FS_IDB_STORE))db.createObjectStore(FS_IDB_STORE);if(!db.objectStoreNames.contains(CP_IDB_STORE))db.createObjectStore(CP_IDB_STORE);};
    rq.onsuccess=function(){res(rq.result);};
    rq.onerror=function(){rej(rq.error||new Error("indexedDB open failed"));};
  });
}
function _idbSet(key,val){
  return _idbOpen().then(function(db){return new Promise(function(res,rej){
    var tx=db.transaction(FS_IDB_STORE,"readwrite");
    tx.objectStore(FS_IDB_STORE).put(val,key);
    tx.oncomplete=function(){res(true);};tx.onerror=function(){rej(tx.error);};
  });});
}
function _idbGet(key){
  return _idbOpen().then(function(db){return new Promise(function(res,rej){
    var tx=db.transaction(FS_IDB_STORE,"readonly");
    var rq=tx.objectStore(FS_IDB_STORE).get(key);
    rq.onsuccess=function(){res(rq.result||null);};rq.onerror=function(){rej(rq.error);};
  });});
}
// #300: the checkpoint store — one snapshot per campaign id.
function idbPutCheckpoint(campId,snap){
  return _idbOpen().then(function(db){return new Promise(function(res,rej){
    var tx=db.transaction(CP_IDB_STORE,"readwrite");tx.objectStore(CP_IDB_STORE).put(snap,campId);
    tx.oncomplete=function(){res(true);};tx.onerror=function(){rej(tx.error);};
  });});
}
function idbGetCheckpoint(campId){
  return _idbOpen().then(function(db){return new Promise(function(res,rej){
    var tx=db.transaction(CP_IDB_STORE,"readonly");var rq=tx.objectStore(CP_IDB_STORE).get(campId);
    rq.onsuccess=function(){res(rq.result||null);};rq.onerror=function(){rej(rq.error);};
  });});
}
function persistCampaignFolder(){
  if(!_campFolderHandle)return Promise.resolve(false);
  return _idbSet(FS_IDB_KEY,_campFolderHandle).catch(function(e){
    console.warn("[files] could not persist the campaign folder handle — it will not survive a reload:",e&&e.message);
    return false;
  });
}
// Boot path. Never prompts (no gesture available); a handle whose permission has lapsed is parked
// in _campFolderPending for the first save/restore that DOES have a gesture.
function restoreCampaignFolder(){
  return _idbGet(FS_IDB_KEY).then(function(h){
    if(!h)return false;
    if(!h.queryPermission){_campFolderHandle=h;updateCampFolderUI();return true;}
    return h.queryPermission({mode:"readwrite"}).then(function(p){
      if(p==="granted"){_campFolderHandle=h;updateCampFolderUI();return true;}
      _campFolderPending=h;
      console.info("[files] campaign folder restored but needs re-permission — will ask on the next save");
      return false;
    });
  }).catch(function(e){console.warn("[files] campaign folder restore failed:",e&&e.message);return false;});
}
// Call from inside a user gesture. Resolves true when a usable folder handle is live.
function _ensureFolderPerm(){
  if(_campFolderHandle)return Promise.resolve(true);
  if(!_campFolderPending||!_campFolderPending.requestPermission)return Promise.resolve(false);
  var h=_campFolderPending;
  return h.requestPermission({mode:"readwrite"}).then(function(p){
    if(p!=="granted")return false;
    _campFolderHandle=h;_campFolderPending=null;updateCampFolderUI();
    return true;
  }).catch(function(e){return _folderPickerFailure(e,"permission");});
}

// ── #30: image saving that reaches the right place per platform ──────────────────────────────
// A web page CANNOT write to the iOS Photos app or the Windows Pictures folder directly. The two
// reachable primitives are the OS share sheet (Web Share Level 2 — the ONLY route to Photos) and
// a folder/download on desktop. Order: share when the device offers it, else the campaign folder,
// else a download.
function canShareFiles(){
  return !!(typeof navigator!=="undefined"&&navigator.share&&navigator.canShare&&typeof File==="function");
}
function shareImageFile(blob,filename){
  return new Promise(function(res){
    if(!canShareFiles()){res(false);return;}
    var file;
    try{file=new File([blob],filename,{type:blob.type||"image/jpeg"});}catch(e){res(false);return;}
    var ok=false;
    try{ok=navigator.canShare({files:[file]});}catch(e2){ok=false;}
    if(!ok){res(false);return;}
    navigator.share({files:[file],title:filename}).then(function(){res(true);}).catch(function(e3){
      // AbortError = the user dismissed the sheet. That is a DECISION, not a failure — falling
      // back to a download here would hand them a file they just declined to save.
      res(!!(e3&&e3.name==="AbortError"));
    });
  });
}
// Name the file after what it actually IS. buildFilename says .jpg, but fal returns whatever the
// model produced — a .jpg that is really a PNG confuses the OS and the restore path alike.
function _renderFilenameFor(blob,filename){
  var t=((blob&&blob.type)||"").toLowerCase(),ext="";
  if(t.indexOf("png")>=0)ext="png";
  else if(t.indexOf("webp")>=0)ext="webp";
  else if(t.indexOf("jpeg")>=0||t.indexOf("jpg")>=0)ext="jpg";
  if(!ext)return filename;
  return String(filename).replace(/\.(jpe?g|png|webp)$/i,"")+"."+ext;
}
// The one funnel for saving a render. Records a pointer describing WHERE it went, so a later load
// knows what is restorable ("renders") and what is only a record ("share"/"download").
//
// ORDER MATTERS, and the first version had it wrong (field report 2026-07-27): it tried the share
// sheet first, but DESKTOP Chrome implements navigator.share too, so a user who had deliberately
// configured a campaign folder got the Windows share UI instead of their folder. A configured
// folder is an explicit instruction — it always wins. The share sheet is reserved for a browser
// with NO folder picker at all (iOS Safari), where it is the only route to the Photos app; on a
// desktop with no folder chosen, a plain download is the predictable thing rather than a surprise
// share dialog. Capability check, never UA sniffing.
function saveRenderImage(blob,filename,turn){
  filename=_renderFilenameFor(blob,filename);
  return _ensureFolderPerm().then(function(haveFolder){
    if(haveFolder){
      return exportToFolder("render",blob,filename).then(function(toFolder){
        recordRenderPointer(filename,turn,toFolder?"renders":"download");
        return toFolder?"folder":"download";
      });
    }
    if(typeof window!=="undefined"&&window.showDirectoryPicker){
      _downloadBlob(blob,filename);
      showToast("Saved to your downloads: "+filename+" — File ▸ Set campaign folder to keep renders with the campaign");
      recordRenderPointer(filename,turn,"download");
      return "download";
    }
    return shareImageFile(blob,filename).then(function(shared){
      if(shared){recordRenderPointer(filename,turn,"share");return "share";}
      _downloadBlob(blob,filename);
      recordRenderPointer(filename,turn,"download");
      return "download";
    });
  });
}
function recordRenderPointer(filename,turn,kind){
  if(!worldState)return;
  if(typeof renderPointerAdd!=="function")return;
  worldState.renders=renderPointerAdd(worldState.renders||[],{f:filename,t:(typeof turn==="number"?turn:(worldState.turn||0)),k:kind},typeof RENDER_PTR_CAP==="number"?RENDER_PTR_CAP:60);
  if(typeof saveAll==="function")saveAll();
}
// Re-attach saved renders to the narration frames they belong to, after a reload/clear-cache.
// ONLY "renders" pointers are restorable: a shared image lives in Photos, which a web page can
// never read back, and a download's path is unknown to us. A file that no longer exists is
// skipped silently — the row's explicit requirement. Resolves with the number restored.
function restoreSavedRenders(){
  if(!worldState||!worldState.renders||!worldState.renders.length)return Promise.resolve(0);
  if(!_campFolderHandle)return Promise.resolve(0);
  var ptrs=[],i;
  for(i=0;i<worldState.renders.length;i++)if(worldState.renders[i]&&worldState.renders[i].k==="renders")ptrs.push(worldState.renders[i]);
  if(!ptrs.length)return Promise.resolve(0);
  return _campFolderHandle.getDirectoryHandle(_SUBFOLDERS.render,{create:false}).then(function(dir){
    var done=0;
    function step(n){
      if(n>=ptrs.length)return done;
      var p=ptrs[n];
      return dir.getFileHandle(p.f,{create:false}).then(function(fh){return fh.getFile();}).then(function(file){
        if(_attachRestoredRender(file,p))done++;
      }).catch(function(){/* gone from disk — skip this one, exactly as specified */})
        .then(function(){return step(n+1);});
    }
    return Promise.resolve(step(0));
  }).catch(function(){return 0;});
}
function _attachRestoredRender(file,ptr){
  var story=document.getElementById("story-narrative");
  if(!story)return false;
  var frame=story.querySelector('.msg.narrator[data-turn="'+ptr.t+'"]');
  if(!frame)return false;                                   // that turn isn't on screen — nothing to attach to
  if(frame.querySelector('img.restored-render[data-f="'+ptr.f+'"]'))return false;   // already there
  var img=document.createElement("img");
  img.className="restored-render";
  img.setAttribute("data-f",ptr.f);
  img.alt="Saved render, turn "+ptr.t;
  img.style.cssText="display:block;max-width:100%;border-radius:8px;margin-top:10px;";
  var objectUrl=URL.createObjectURL(file),objectUrlReleased=false;
  function releaseObjectUrl(){if(objectUrlReleased)return;objectUrlReleased=true;URL.revokeObjectURL(objectUrl);}
  img.src=objectUrl;
  img.onload=function(){setTimeout(releaseObjectUrl,0);};
  img.onerror=function(){
    console.warn("[files] restored render could not be displayed — object URL released: "+ptr.f);
    releaseObjectUrl();
  };
  frame.appendChild(img);
  return true;
}
function _slugFolderName(s){return(s||"Campaign").replace(/[^a-zA-Z0-9_\-]/g,"_");}
function _openCampaignSubfolder(rootHandle,campName){
  var slug=_slugFolderName(campName);
  return rootHandle.getDirectoryHandle(slug,{create:true}).then(function(sub){
    _campRootHandle=rootHandle;
    _campFolderHandle=sub;
    _campFolderPending=null;
    persistCampaignFolder();   // #30: survive the next reload
    updateCampFolderUI();
    return sub;
  });
}
function _folderPickerFailure(e,action){
  if(e&&e.name==="AbortError"){
    console.info("[files] campaign folder picker cancelled during "+action);
    return false;
  }
  var reason=(e&&e.message)||String(e||"unknown filesystem error");
  console.warn("[files] campaign folder "+action+" failed:",reason);
  showToast("Campaign folder "+action+" failed: "+reason);
  return false;
}
function setCampaignFolder(){
  if(!window.showDirectoryPicker){showToast("Folder picker not supported in this browser.");return Promise.resolve(false);}
  var campName=(worldState&&worldState.campName)||"Campaign";
  return window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Folder ready: "+sub.name+"/");
    return true;
  }).catch(function(e){return _folderPickerFailure(e,"selection");});
}
function initCampaignFolderForGame(){
  if(!window.showDirectoryPicker)return Promise.resolve(false);
  var campName=(worldState&&worldState.campName)||"Campaign";
  return window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Saving to "+sub.name+"/");
    return true;
  }).catch(function(e){return _folderPickerFailure(e,"initialization");});
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
  _campFolderHandle=null;_campRootHandle=null;_campFolderPending=null;
  // #30: forget the PERSISTED handle too — otherwise "cleared" would silently un-clear itself on
  // the next reload, which is exactly the kind of lie the persistence was added to remove.
  updateCampFolderUI();
  return _idbSet(FS_IDB_KEY,null).then(function(){
    showToast("Campaign folder cleared.");
    return true;
  }).catch(function(e){
    var reason=(e&&e.message)||String(e||"unknown IndexedDB error");
    console.warn("[files] campaign folder cleared for this tab, but its persisted handle could not be removed:",reason);
    showToast("Folder cleared for this tab, but reload may restore it: "+reason);
    return false;
  });
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
  /* Owner call 2026-09-03 (the missing Iron Meridian save): say WHERE the file goes, not just its name.
     A folder restored from a previous session is only a name until Save re-arms it (below). */
  var dest=saveDestination(_campFolderHandle&&_campFolderHandle.name,_campFolderPending&&_campFolderPending.name,!!(typeof window!=="undefined"&&window.showDirectoryPicker),_SUBFOLDERS.save);
  var modal=modalShell("save-confirm-modal",/* #14 */
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:6px;'>Save Game (local)</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Turn "+worldState.turn+" &nbsp;·&nbsp; "+worldState.world.location+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Saves to</div>"
    +"<div id='sc-dest' style='font-size:12px;font-family:var(--font-mono);color:"+(dest.kind==="downloads"?"var(--t1)":"var(--acc)")+";margin-bottom:10px;overflow-wrap:anywhere;'>"+escHtml(dest.text)+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>File</div>"
    +"<input id='sc-fname' type='text' value='"+fname+"' style='width:100%;font-size:12px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);padding:8px 10px;color:var(--t1);box-sizing:border-box;margin-bottom:"+(alreadySaved?"12":"20")+"px;'/>"
    +(alreadySaved?"<div style='font-size:12px;color:var(--acc);margin-bottom:16px;'>&#9888; A file with this name may already exist in "+escHtml(dest.kind==="downloads"?"your Downloads folder":dest.text.replace(/ \(reconnects on Save\)$/,""))+".</div>":"")
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
    var blob=new Blob([data],{type:"application/json"});
    /* Re-arm a folder restored from a previous session INSIDE this click (the gesture the permission
       prompt needs) — before this, a post-reload save silently fell to Downloads while the menu still
       showed the folder's name (the missing Iron Meridian save, 2026-09-03). */
    _ensureFolderPerm().then(function(){return exportToFolder("save",blob,actualFname);});
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
    sessionLog=Array.isArray(data.sessionLog)?data.sessionLog:[];
    var mm=data.memory||{};
    /* attitudeSpec carried through (v1.439, F7 — brief D): this whitelist silently DROPPED the
       v1.383 heal marker, so every .tnd import re-fired the one-time clear and wiped correct
       new-spec dispositions on the next load. A pre-v1.383 file has no marker → the heal fires →
       correct (its values ARE old-spec). */
    memory={attitudeSpec:mm.attitudeSpec,npcs:mm.npcs||{},locations:mm.locations||{},quests:mm.quests||{},lore:Array.isArray(mm.lore)?mm.lore:[],keyDecisions:Array.isArray(mm.keyDecisions)?mm.keyDecisions:[],futureEvents:Array.isArray(mm.futureEvents)?mm.futureEvents:[],chapters:Array.isArray(mm.chapters)?mm.chapters:[],eras:Array.isArray(mm.eras)?mm.eras:[],/* #168R (entry-13 review, brief D incidental): the whitelist silently dropped compiled eras on every .tnd import — the same class as the attitudeSpec and #144A drops above */map:mm.map||{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:mm.npcGraph?{edges:mm.npcGraph.edges||[],factions:mm.npcGraph.factions||{},factionEdges:mm.npcGraph.factionEdges||[],npcFactions:mm.npcGraph.npcFactions||{}}:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:archiveRebuild(mm.archive)};/* JP0-5: this used to be a hand-copied key list, and it destroyed a category on every .tnd import FOUR separate times (attitudeSpec, eras, the #144A trio, npcDeathCorrections + relDowngrades). It is now derived from MEMORY_ARCHIVE_KEYS (state.js) and carries UNKNOWN categories through verbatim, so the next one costs no edit here at all. */
    migrateWorldState();/* relationship re-keying must see the imported campaign's memory aliases, not the outgoing campaign's. */
    if(typeof healMemory==="function")healMemory();
    saveAll();document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showGame();syncUI();initAbilities();initSpells();addMsg("system","Loaded: "+escHtml(worldState.character.name)+" Turn "+worldState.turn);/* imported-file name (#22/UA18) */if(typeof initReplaySession==="function")initReplaySession();/* replay the story pane like init()/campLoad do — importSave left it empty (audit E65) */if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}catch(err){showToast("Import failed: "+err.message);}};
  reader.readAsText(file);event.target.value="";
}
