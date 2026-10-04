var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),failed=0;
// Browser proofs use dev/cdp-browser.js; missing Chrome is reported, never called a pass.
failed+=sabotage.prove({file:'designer-prose.js',command:['node',['dev/tests-designer-prose.js']],cases:[
 {label:'long fields skip revision',find:'f.owner[f.key].length>f.limit',replace:'f.owner[f.key].length>f.limit+100000',mustFail:'complete drafts are revised without slicing or mutating the original'},
 {label:'unfinished revisions accepted',find:'if(!/[.!?。！？]',replace:'if(false&&!/[.!?。！？]',mustFail:'overlong empty and unfinished revisions fail without partial writes'},
 {label:'oversized revisions accepted',find:'if(text.length>limit)',replace:'if(false&&text.length>limit)',mustFail:'overlong empty and unfinished revisions fail without partial writes'},
 {label:'late cancellation ignored',find:'if(!current())throw new Error("Text revision cancelled or the draft changed; originals were kept.");\n        if(result',replace:'if(result',mustFail:'cancellation rejects late model results'},
 {label:'identity names automatically rewritten',find:'if(f.identity)throw',replace:'if(false&&f.identity)throw',mustFail:'identity labels are never silently renamed by shortening'}
]});
failed+=sabotage.prove({file:'game.js',command:['node',['dev/run-tests.js','class bible (#72)']],cases:[
 {label:'authoring drafts clamped again',find:'!(opts&&opts.preserveProse)&&',replace:'',mustFail:'blueprint authoring preserves overlong drafts while runtime normalization still caps them'},
 {label:'runtime cap removed',find:'f.owner[f.key]=clampStr(f.owner[f.key],f.limit);',replace:'',mustFail:'#315 normalizeBlueprint clamps every imported prose field'}
]});
failed+=sabotage.prove({file:'blueprint-designer.html',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'catalog publishes newly overlong draft',find:'var readiness=designerValidate();if(readiness){error.textContent=readiness;return;}',replace:'',mustFail:'catalog rechecks text limits at confirmation after a draft changes'},
 {label:'file load loses authoring mode',find:'bp=normalizeBlueprint(obj,{preserveProse:true});',replace:'bp=normalizeBlueprint(obj);',mustFail:'loaded NPC notes preserve the exact reported tail beyond 800'},
 {label:'AI fix skips its revision pass',find:'snapshot=null;if(!_applyingAll)await fitDesignerText(writtenSince(before));',replace:'snapshot=null;',mustFail:'AI fixes draft in full then revise before finalizing'},
 {label:'an AI write shortens text it did not write',find:'if(written)fields=fields.filter(written);',replace:'',mustFail:'the imported note was not sent for shortening'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-547-designer-prose.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
