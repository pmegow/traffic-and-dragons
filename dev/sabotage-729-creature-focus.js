// Browser driver: dev/cdp-browser.js. Paid generation is never part of the mutation gate.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),failed=0;
failed+=sabotage.prove({file:'designer-creatures.js',command:['node',['dev/tests-designer-creatures.js']],cases:[
 {label:'legacy creature misses the focus instruction',find:'Show the creature clearly in a fitting habitat; no lettering or stat blocks."+focus;',replace:'Show the creature clearly in a fitting habitat; no lettering or stat blocks.";',mustFail:'#729 creature portraits request 55mm f/1.8 and a softly blurred habitat'},
 {label:'requested aperture replaced with deep focus',find:'55mm lens at f/1.8 with shallow depth of field',replace:'55mm lens at f/16 with deep depth of field',mustFail:'#729 creature portraits request 55mm f/1.8 and a softly blurred habitat'},
 {label:'habitat remains crisp',find:'the background is softly blurred into gentle bokeh',replace:'the background is crisp and finely detailed',mustFail:'#729 creature portraits request 55mm f/1.8 and a softly blurred habitat'}
]});
failed+=sabotage.prove({file:'designer-creatures.js',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'public appearance loses its focus at the image boundary',find:'Show only this appearance in a fitting habitat; no lettering or stat blocks."+focus;',replace:'Show only this appearance in a fitting habitat; no lettering or stat blocks.";',mustFail:'#729 public creature request carries shallow focus through the image boundary'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-729-creature-focus.js',1,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
