// Browser clauses use dev/cdp-browser.js; missing Chrome is an explicit skip.
// Each clause runs the real browser scenario it guards, with image responses intercepted.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),rc=0;
function prove(file,cases){return sabotage.prove({file:file,skip:!chrome.path,command:['node',['dev/tests-732-missing-portraits-browser.js']],only:'FAIL #732 ',cases:cases});}
rc+=prove('designer-menu.js',[
 {label:'File loses the batch action',find:'id:"btn-render-missing",label:"Render all missing portraits"',replace:'id:"btn-render-lost",label:"Render all missing portraits"',mustFail:'FAIL #732 File menu exposes missing portraits on desktop and phone'}
]);
rc+=prove('designer-portrait-batch.js',[
 {label:'progress includes existing portraits',find:'if(c&&!c.portrait)queue.push',replace:'if(c)queue.push',mustFail:'FAIL #732 only missing NPC and creature portraits render and survive autosave'},
 {label:'requests launch concurrently',find:'var result=await generateDesignerPortrait(',replace:'var result=generateDesignerPortrait(',mustFail:'FAIL #732 only missing NPC and creature portraits render and survive autosave'},
 {label:'Stop no longer stops subsequent requests',find:'if(job.cancelled||bp!==target)break;',replace:'if(bp!==target)break;',mustFail:'FAIL #732 progress ticks and Stop keeps the current result without launching more'},
 {label:'provider failure disappears from the report',find:'else failures.push((c.name||cfg.label)+": "+result.reason);',replace:'else skipped++;',mustFail:'FAIL #732 failure identifies the entry and later entries still render'},
 {label:'deleted queue entries still cost a request',find:'if(target[cfg.section].indexOf(c)<0||c.portrait||creaturePortraitBusy(c))',replace:'if(c.portrait||creaturePortraitBusy(c))',mustFail:'FAIL #732 queued entries gained portraits or removed are skipped before spending'},
 {label:'batch opts into overwriting present images',find:'{missingOnly:true,quiet:true}',replace:'{missingOnly:false,quiet:true}',mustFail:'FAIL #732 an image added during rendering is never overwritten'},
 {label:'old queue continues after a new blueprint loads',find:'if(job.cancelled||bp!==target)break;',replace:'if(job.cancelled)break;',mustFail:'FAIL #732 switching blueprints stops the queue and discards its late image'},
 {label:'blank names and notes are never reported',find:'else failures.push((c.name||cfg.label)+": "+result.reason);',replace:'else failures.push("Unspecified error");',mustFail:'FAIL #732 empty invalid and busy entries never create duplicate requests'},
 {label:'an empty queue does not say it is finished',find:'No missing portraits — all creatures and NPCs already have one.',replace:'Portraits.',mustFail:'FAIL #732 empty invalid and busy entries never create duplicate requests'},
 {label:'missing image access fails silently',find:'if(!falAvailable()){setStatus("Sign in from the game or configure an image key before generating portraits.","err");return;}',replace:'if(!falAvailable())return;',mustFail:'FAIL #732 missing image access is reported before any request'}
]);
rc+=prove('blueprint-designer.html',[
 {label:'late result overwrites an image added meanwhile',find:'    if(options.missingOnly&&c.portrait)return result("skipped");',replace:'    // missing-only attachment guard removed',mustFail:'FAIL #732 an image added during rendering is never overwritten'},
 {label:'autosave is suppressed while a portrait batch runs',find:'function saveDraft(){if(designerDraftReady&&designerDrafts)designerDrafts.schedule();}',replace:'function saveDraft(){if(designerDraftReady&&designerDrafts&&!designerPortraitBatch)designerDrafts.schedule();}',mustFail:'FAIL #732 only missing NPC and creature portraits render and survive autosave'},
 {label:'portrait additions no longer mark the draft dirty',find:'c.portrait=portrait;markDirty();return result("saved",',replace:'c.portrait=portrait;return result("saved",',mustFail:'FAIL #732 only missing NPC and creature portraits render and survive autosave'}
]);
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-732-missing-portraits.js',14,chrome.why);process.exit(verdict.SKIP_EXIT);}process.exit(rc?1:0);
