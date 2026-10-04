// #221: prove draft preservation, explicit decisions, game-card modals and Bible deep links.
// Browser cases use dev/cdp-browser.js; missing Chrome must report SKIP, never a passing proof.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0;
failed+=sabotage.prove({file:'capability-names.html',command:['node',['dev/tests-221-capability-names.js']],cases:[
 {label:'original names are silently accepted by default',find:'return {from:key,to:""};',replace:'return {from:key,to:key};',mustFail:'blank defaults require an explicit decision'},
 {label:'blank names pass the implementation gate',find:'if(!key){errors[i]=',replace:'if(false){errors[i]=',mustFail:'blank and delimiter names block implementation'},
 {label:'collisions ignore engine name normalization',find:'var key=capBaseName(row.to);',replace:'var key=row.to;',mustFail:'engine-normalized collisions mark both rows'},
 {label:'exports drop unfinished rows',find:'names:list},null,2)',replace:'names:list.filter(function(row){return !!row.to;})},null,2)',mustFail:'draft round trip preserves unfinished'},
 {label:'ready flag bypasses fresh validation',find:'var list=read(text,bible);',replace:'var list=read(text,bible);if(JSON.parse(text).readyToApply)return list;',mustFail:'readiness cannot be forged'},
 {label:'malformed imported names bypass shape validation',find:'typeof row.to!=="string"||',replace:'',mustFail:'bad imports and changed bible cannot discard choices'}
]});
failed+=sabotage.prove({file:'capability-names.html',skip:!chrome.path,command:['node',['dev/tests-221-capability-names-browser.js']],cases:[
 {label:'drafts report saved without writing storage',find:'localStorage.setItem(KEY,CapabilityNames.pack(list));',replace:'',mustFail:'unfinished edits survive reload and file export'},
 {label:'the modal renders a different capability',find:'bibleCardHTML(name,CAPABILITY_BIBLE[name])',replace:'bibleCardHTML(name,CAPABILITY_BIBLE["zone of truth"])',mustFail:'original names open the game card'},
 {label:'the modal loses its close controls',find:'closeId:"name-card-close",outside:true',replace:'closeId:"name-card-close",outside:true,wireClose:false',mustFail:'original names open the game card'},
 {label:'a long modal exceeds the viewport',find:'max-height:calc(100vh - 40px);',replace:'',mustFail:'long game cards fit a narrow viewport'}
]});
failed+=sabotage.prove({file:'bible_study.html',skip:!chrome.path,command:['node',['dev/tests-221-capability-names-browser.js']],cases:[
 {label:'Bible navigation no longer focuses the requested card',find:'card.focus();card.scrollIntoView({block:"center"});',replace:'',mustFail:'Bible links reveal the exact card'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-221-capability-names.js',5,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
