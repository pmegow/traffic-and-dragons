// Batch membership is a snapshot; each entry is checked again before spending and attaching.
var designerPortraitBatch=null;
function syncDesignerPortraitBatch(){
  var button=document.getElementById("btn-render-missing"),job=designerPortraitBatch;
  button.textContent=job?(job.cancelled?"Stopping portraits":"Stop rendering missing portraits"):"Render all missing portraits";
  button.disabled=!!(job&&job.cancelled);
}
async function renderMissingDesignerPortraits(){
  if(designerPortraitBatch){
    designerPortraitBatch.cancelled=true;
    designerPortraitBatch.ticker.set("Stopping after the current portrait…");
    syncDesignerPortraitBatch();return;
  }
  var target=bp,queue=[];
  Object.keys(DESIGNER_PORTRAITS).forEach(function(type){
    var cfg=DESIGNER_PORTRAITS[type];
    (target[cfg.section]||[]).forEach(function(c){if(c&&!c.portrait)queue.push({type:type,subject:c});});
  });
  if(!queue.length){setStatus("No missing portraits — all creatures and NPCs already have one.","ok");return;}
  if(!falAvailable()){setStatus("Sign in from the game or configure an image key before generating portraits.","err");return;}
  var job={cancelled:false,ticker:statusTicker("Rendering missing portraits…")},done=0,skipped=0,processed=0,failures=[];
  designerPortraitBatch=job;syncDesignerPortraitBatch();
  try{
    for(var i=0;i<queue.length;i++){
      if(job.cancelled||bp!==target)break;
      var entry=queue[i],c=entry.subject,cfg=DESIGNER_PORTRAITS[entry.type];
      if(target[cfg.section].indexOf(c)<0||c.portrait||creaturePortraitBusy(c)){skipped++;processed++;continue;}
      job.ticker.set("Rendering missing portraits: "+(i+1)+"/"+queue.length+" — "+(c.name||cfg.label)+"…");
      var result=await generateDesignerPortrait(entry.type,c,null,{missingOnly:true,quiet:true});
      processed++;
      if(result.status==="saved")done++;
      else if(result.status==="skipped")skipped++;
      else failures.push((c.name||cfg.label)+": "+result.reason);
    }
  }catch(err){console.warn("[designer portrait batch] "+err.message);failures.push(err.message);}
  finally{job.ticker.stop();designerPortraitBatch=null;syncDesignerPortraitBatch();}
  var stopped=job.cancelled||bp!==target;
  setStatus("Portrait batch "+(stopped?"stopped":"complete")+": "+done+" rendered, "+skipped+" skipped, "+failures.length+" failed."
    +(bp!==target?" The blueprint changed.":"")+(queue.length>processed?" "+(queue.length-processed)+" not attempted.":"")
    +(failures.length?" "+failures.join("; "):""),failures.length?"err":stopped?"":"ok");
}
