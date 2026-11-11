// Each regression is proved in the disposable scratch clone. Browser support: dev/cdp-browser.js.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),failed=0;
failed+=sabotage.prove({file:'blueprint-designer-drafts.js',command:['node',['dev/tests-725-designer-drafts.js']],cases:[
 {label:'older completion acknowledges newer edits',find:'completed=serial;running=null;',replace:'completed=requested;running=null;',mustFail:'pending begins before debounce and clears only after the latest transaction'},
 {label:'parallel writes bypass the queue',find:'if(running)return running;',replace:'',mustFail:'pending begins before debounce and clears only after the latest transaction'},
 {label:'editing hides a failed save',find:'cancelTimer();if(error)return;',replace:'cancelTimer();error=null;',mustFail:'failed writes retain pending edits and report the reason until explicit retry'},
 {label:'conflict retry overwrites another tab',find:'if(error&&(error.code==="conflict"||error.code==="legacy"))return Promise.reject(error);',replace:'',mustFail:'conflicts cannot be retried into an overwrite'},
 {label:'closed writer repaints a new session',find:'if(!stopped)paint("saved");',replace:'paint("saved");',mustFail:'closed writers cannot repaint a replacement session'},
 {label:'late blocked connection leaks',find:'if(done||closed){db.close();',replace:'if(done||closed){',mustFail:'blocked opens reject visibly and close late connections'}
]});
var browserCommand=['node',['dev/tests-725-designer-drafts-browser.js']];
failed+=sabotage.prove({file:'blueprint-designer-drafts.js',skip:!chrome.path,command:browserCommand,cases:[
 {label:'large drafts go back into localStorage',find:'return commit(payload,revision,legacyRaw);',replace:'localStorage.setItem(LEGACY,JSON.stringify(payload));return Promise.resolve();',mustFail:'large portrait draft survives reload byte-for-byte'},
 {label:'migration removes the old draft',find:'return payload;\n          });',replace:'localStorage.removeItem(LEGACY);return payload;\n          });',mustFail:'migration preserves the legacy draft, portraits, originals and exact edition baseline'},
 {label:'aborted transaction claims success',find:'tx.onabort=function(){reject(failure||tx.error||problem("The draft write was interrupted; the previous saved copy is intact."));};',replace:'tx.onabort=function(){resolve();};',mustFail:'aborted writes keep the previously durable draft intact'},
 {label:'revision conflict check removed',find:'if(displaced?JSON.stringify(row)!==JSON.stringify(displaced):(row?row.revision:0)!==expected)',replace:'if(false)',mustFail:'two tabs cannot overwrite a newer revision'},
 {label:'legacy recovery discards displaced saved data',find:'s.put(displaced,"recovery");put();',replace:'put();',mustFail:'choosing legacy retains the displaced saved copy atomically'},
 {label:'damaged saved copy blocks valid legacy recovery',find:'if(choice!=="legacy"||!legacyText)checkRow(row);',replace:'checkRow(row);',mustFail:'damaged current data can recover valid legacy without erasing evidence'},
 {label:'unavailable database hides readable legacy backup',find:'return {saved:null,legacy:raw,retained:null,error:e};',replace:'return {saved:null,legacy:null,retained:null,error:e};',mustFail:'unavailable IndexedDB still permits a legacy recovery download'},
 {label:'recovery slot overwrites an earlier backup',find:'if(found.target.result)throw problem(',replace:'if(false)throw problem(',mustFail:'an occupied recovery backup is preserved until explicit removal'}
]});
failed+=sabotage.prove({file:'blueprint-designer-autosave.js',skip:!chrome.path,command:browserCommand,cases:[
 {label:'Home incoming removed before durability',find:'designerDrafts.schedule();designerDrafts.flush().then(consumeDesignerIncoming)',replace:'consumeDesignerIncoming();designerDrafts.schedule();designerDrafts.flush().then(consumeDesignerIncoming)',mustFail:'Home incoming is retained until its replacement is durable'},
 {label:'recovery copies inaccessible after successful restore',find:'document.getElementById("draft-backups").hidden=false;',replace:'document.getElementById("draft-backups").hidden=true;',mustFail:'recovery copies remain accessible after a successful restore'},
 {label:'obsolete recovery result appends controls after retry',find:'if(token===attempt&&!designerDraftReady)recoveryButtons(r);',replace:'recoveryButtons(r);',mustFail:'editor access waits for draft restore and stale recovery callbacks are ignored'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-725-designer-drafts.js',11,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
