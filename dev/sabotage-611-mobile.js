// #611: prove the phone's main regression checks can detect the reported failures.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0;
var browser=['node',['dev/tests-611-mobile-browser.js']];
failed+=sabotage.prove({file:'mobile.css',command:browser,skip:!chrome.path,cases:[
 {label:'phone File trigger is hidden again',find:'#file-btn{display:block;',replace:'#file-btn{display:none;',mustFail:'hierarchical File trigger visible on phone'},
 {label:'Save Load children float in the root menu again',find:'#file-menu .fm-sub{margin-left:10px;',replace:'#file-menu .fm-sub{display:block!important;margin-left:10px;',mustFail:'save child hidden until parent opens'},
 {label:'expanded menu runs off the phone screen',find:'max-height:calc(100dvh - 60px);',replace:'max-height:none;',mustFail:'expanded File fits phone'},
 {label:'thumb target shrinks back to the visible gutter',find:'width:44px;height:96px;',replace:'width:8px;height:96px;',mustFail:'thumb-sized grabber target'},
 {label:'tabs remain outside the closing drawer',find:'width:var(--mobile-drawer,0px);transition:none;',replace:'width:calc(var(--mobile-drawer,0px) + 32px);transition:none;',mustFail:'closed drawer hides its tabs'},
 {label:'composer controls regain wasted vertical space',find:'height:28px;min-height:28px;max-height:28px;',replace:'height:40px;min-height:40px;max-height:40px;',mustFail:'action height'}
]});
failed+=sabotage.prove({file:'ui-mobile.js',command:browser,skip:!chrome.path,cases:[
 {label:'double tap no longer toggles the drawer',find:'lastTap=null;mobileToggleDrawer();',replace:'lastTap=null;',mustFail:'double tap closes entire drawer'},
 {label:'double tap uses the wrong opening proportion',find:'clientWidth*0.43',replace:'clientWidth*0.50',mustFail:'double tap opens demo proportion'},
 {label:'completed campaign becomes an empty act again',find:'act.done?"Act Complete":act.text',replace:'act.done?"Act —":act.text',mustFail:'completed campaign retained'},
 {label:'drawer snaps instead of holding the release point',find:'Math.min(max,width)',replace:'Math.min(max,Math.round(width/40)*40)',mustFail:'exact release width'},
 {label:'enemy card is bottom aligned instead of centered',find:'outside:true,maxWidth:420',replace:'outside:true,maxWidth:420,align:"flex-end"',mustFail:'enemy modal centered'}
]});
failed+=sabotage.prove({file:'ui-modals.js',command:browser,skip:!chrome.path,cases:[
 {label:'accepted item definition leaves the panel stale',find:'if(itemDefAccept(k)){updateInvPanel();showToast(',replace:'if(itemDefAccept(k)){showToast(',mustFail:'panel reflects accepted weapon immediately'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-611-mobile.js',12,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
