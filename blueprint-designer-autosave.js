// Storage recovery stays visible independently of authoring and model-request messages.
(function(){
  "use strict";
  var starting=false,attempt=0,message=document.getElementById("draft-message"),actions=document.getElementById("draft-actions"),line=document.getElementById("draft-state");
  function button(label,fn,holder){var b=document.createElement("button");b.className="tbtn";b.style.margin="4px 0 4px 8px";b.textContent=label;b.onclick=fn;(holder||actions).appendChild(b);}
  function download(value,name){var blob=new Blob([typeof value==="string"?value:JSON.stringify(value,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function recoveryButtons(recovery,holder,active){
    holder=holder||actions;
    function add(label,fn){button(label,fn,holder);}
    if(recovery.retained){
      add("Download recovery backup",function(){download(recovery.retained.payload&&recovery.retained.payload.bp?recovery.retained.payload:recovery.retained,"retained-designer-draft.json");});
      add("Remove recovery backup…",function(){
        if(!window.confirm("Remove the retained recovery backup? Download it and verify the file first. The current working draft will remain saved."))return;
        designerDraftStore.removeRecovery(recovery.retained).then(function(){if(active)showRecovery();else start();},function(e){console.warn("[designer recovery] "+e.message);message.textContent=e.message;});
      });
    }
    if(recovery.saved)add("Download saved copy",function(){download(recovery.saved.payload&&recovery.saved.payload.bp?recovery.saved.payload:recovery.saved,"saved-designer-draft.json");});
    if(recovery.legacy)add("Download legacy copy",function(){download(recovery.legacy,"legacy-designer-draft.json");});
    if(!active&&recovery.saved&&recovery.legacy){
      if(recovery.saved.schema===1&&recovery.saved.payload&&recovery.saved.payload.bp)add("Continue saved copy",function(){start("saved");});
      var legacy=null;try{legacy=JSON.parse(recovery.legacy);}catch(e){console.warn("[designer recovery] "+e.message);}
      if(legacy&&legacy.bp&&legacy.bp.format)add("Continue legacy copy",function(){start("legacy");});
    }
    if(!active&&!recovery.error&&(recovery.saved||recovery.legacy))add("Start new; retain recovery copies",function(){
      if(window.confirm("Start a blank blueprint and keep the existing copies for recovery?"))start("new");
    });
  }
  function showRecovery(){
    var token=attempt,holder=document.getElementById("draft-recovery");holder.hidden=false;holder.textContent="Reading recovery copies…";
    designerDraftStore.recovery().then(function(r){if(token!==attempt||!designerDraftReady)return;holder.textContent="Recovery downloads reopen through Load. ";recoveryButtons(r,holder,true);},function(e){console.warn("[designer recovery] "+e.message);if(token===attempt)holder.textContent=e.message;});
  }
  document.getElementById("draft-backups").onclick=function(){var holder=document.getElementById("draft-recovery");if(!holder.hidden){holder.hidden=true;holder.textContent="";}else showRecovery();};
  function paint(state){
    actions.textContent="";line.style.color=state.kind==="error"?"var(--err)":"var(--mu)";
    if(state.kind==="saved"){message.textContent="Draft saved on this device.";return;}
    if(state.kind==="pending"){message.textContent="Saving draft on this device… Keep this tab open until saved.";return;}
    var e=state.error;console.warn("[designer draft] "+e.message);
    message.textContent="Draft could not be saved on this device: "+e.message+" Save a .blueprint file to keep your changes.";
    if(e.code!=="conflict"&&e.code!=="legacy")button("Retry autosave",function(){designerDrafts.retry().then(consumeDesignerIncoming).catch(function(){});});
  }
  function start(choice){
    if(starting)return;starting=true;designerDraftReady=false;var token=++attempt;
    if(designerDrafts)designerDrafts.close();
    document.getElementById("designer-controls").inert=true;document.getElementById("app").inert=true;delete window.__bpdTest;document.getElementById("draft-backups").hidden=true;document.getElementById("draft-recovery").hidden=true;document.getElementById("draft-recovery").textContent="";
    actions.textContent="";message.textContent="Opening your saved draft…";line.style.color="var(--mu)";
    if(designerDraftStore)designerDraftStore.close();
    designerDraftStore=DesignerDrafts.create();var store=designerDraftStore;
    store.load(choice,choice==="new"?{bp:blankBp(),dirty:false,editionBaseline:null,at:Date.now()}:null).then(function(payload){
      if(token!==attempt)return;
      restoreDesignerDraft(payload,choice==="new");
      designerDrafts=DesignerDrafts.writer(designerDraftStore,function(){return {bp:bp,dirty:dirty,editionBaseline:editionBaseline,at:Date.now()};},paint);
      designerDraftReady=true;document.getElementById("designer-controls").inert=false;document.getElementById("app").inert=false;exposeDesignerTestSeam();document.getElementById("draft-backups").hidden=false;
      designerDrafts.schedule();designerDrafts.flush().then(consumeDesignerIncoming).catch(function(){});
    }).catch(function(e){
      if(token!==attempt)return;
      console.warn("[designer draft restore] "+e.message);line.style.color="var(--err)";
      message.textContent="Your draft has not been opened: "+e.message+" Existing copies have been kept.";
      button("Retry opening",function(){start();});
      store.recovery().then(function(r){if(token===attempt&&!designerDraftReady)recoveryButtons(r);},function(recoveryError){console.warn("[designer recovery] "+recoveryError.message);});
    }).then(function(){if(token===attempt)starting=false;});
  }
  // Downloads of recovery envelopes can be reopened through the ordinary Load button.
  var loadBlueprint=loadBlueprintObject;
  loadBlueprintObject=function(obj){
    if(obj&&!obj.format&&obj.bp&&obj.bp.format){
      loadBlueprint(obj.bp);
      if(Object.prototype.hasOwnProperty.call(obj,"editionBaseline"))editionBaseline=obj.editionBaseline;
      dirty=!!obj.dirty;updateEdition();saveDraft();
    }else loadBlueprint(obj);
  };
  window.addEventListener("storage",function(e){if(e.key===DesignerDrafts.legacyKey&&designerDraftReady)saveDraft();});
  window.addEventListener("pagehide",function(){if(designerDrafts)designerDrafts.flush().catch(function(){});});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&designerDrafts)designerDrafts.flush().catch(function(){});});
  start();
})();
