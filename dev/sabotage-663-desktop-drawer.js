// #663: desktop must use the same drawer; prove rendering and scrolling checks with real regressions.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0;
var browser=['node',['dev/tests-611-mobile-browser.js','--drawer-only']];
failed+=sabotage.prove({file:'mobile.css',command:browser,skip:!chrome.path,cases:[
 {label:'desktop pull is hidden',find:'#mobile-grip{display:flex;',replace:'#mobile-grip{display:none;',mustFail:'#663 desktop exposes the shared drawer pull'},
 {label:'closed drawer retains a rail',find:'width:var(--mobile-drawer,0px);transition:none;',replace:'width:calc(var(--mobile-drawer,0px) + 32px);transition:none;',mustFail:'#663 desktop closes the entire drawer'},
 {label:'desktop quick tabs disappear',find:'#mobile-panel-tabs{display:flex;',replace:'#mobile-panel-tabs{display:none;',mustFail:'#663 desktop displays the quick tab rail'}
]});
failed+=sabotage.prove({file:'ui-mobile.js',command:browser,skip:!chrome.path,cases:[
 {label:'default opening grows with the whole desktop',find:'Math.min(360,Math.round(mobileEl("story-area").clientWidth*0.43))',replace:'Math.round(mobileEl("story-area").clientWidth*0.43)',mustFail:'#663 the default desktop opening is compact'},
 {label:'desktop resize stops clamping the drawer',find:'  mobileDrawerWidth(mobileUI.width);',replace:'  if(phone)mobileDrawerWidth(mobileUI.width);',mustFail:'#663 resizing clamps the drawer to the available space'},
 {label:'keyboard tab selection stops moving down',find:'var step={ArrowDown:1,ArrowUp:-1}',replace:'var step={ArrowDown:0,ArrowUp:-1}',mustFail:'#663 vertical tabs support keyboard navigation'}
]});
failed+=sabotage.prove({file:'ui-shell.js',command:browser,skip:!chrome.path,cases:[
 {label:'latest narration is no longer pinned after reflow',find:'if(el)el.scrollTop=el.scrollHeight;',replace:'if(el)el.scrollTop=el.scrollTop;',mustFail:'#663 resizing keeps the latest narration visible'},
 {label:'reading history is forced to the newest turn',find:'return storyAtBottom(document.getElementById(id));',replace:'return true;',mustFail:'#663 resizing while reading history never jumps'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-663-desktop-drawer.js',8,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
