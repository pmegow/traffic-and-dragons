// #611: prove the phone's main regression checks can detect the reported failures.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0;
var browser=['node',['dev/tests-611-mobile-browser.js']];
failed+=sabotage.prove({file:'mobile.css',command:browser,skip:!chrome.path,cases:[
 {label:'composer controls regain wasted vertical space',find:'height:28px;min-height:28px;max-height:28px;',replace:'height:40px;min-height:40px;max-height:40px;',mustFail:'action height'}
]});
failed+=sabotage.prove({file:'ui-mobile.js',command:browser,skip:!chrome.path,cases:[
 {label:'completed campaign becomes an empty act again',find:'act.done?"Act Complete":act.text',replace:'act.done?"Act —":act.text',mustFail:'completed campaign retained'},
 {label:'drawer snaps instead of holding the release point',find:'Math.min(max,width)',replace:'Math.min(max,Math.round(width/40)*40)',mustFail:'exact release width'},
 {label:'enemy card is bottom aligned instead of centered',find:'outside:true,maxWidth:420',replace:'outside:true,maxWidth:420,align:"flex-end"',mustFail:'enemy modal centered'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-611-mobile.js',4,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
