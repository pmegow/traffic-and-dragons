var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
/* Real Chrome through dev/cdp-browser.js; missing Chrome is a loud skip, never a pass. */
var chrome=require('./cdp-browser.js').locateChrome();
var command=['node',['dev/tests-bible-study-theme-browser.js']];
var failed=0;
failed+=sabotage.prove({file:'bible_study.html',command:command,skip:!chrome.path,cases:[
 {label:'the reference page stops following the system preference',find:'<script src="website/system-theme.js"></script>',replace:'',mustFail:'initial light preference paints the shared palette'}
]});
failed+=sabotage.prove({file:'website/system-theme.js',command:command,skip:!chrome.path,cases:[
 {label:'live preference changes are no longer observed',find:'preference.addEventListener("change", apply)',replace:'preference.addEventListener("change", function () {})',mustFail:'a preference change repaints without losing filter or card nodes'}
]});
failed+=sabotage.prove({file:'helpers.js',command:command,skip:!chrome.path,cases:[
 {label:'magical label keeps its dark-only foreground',find:'color:var(--magic-ink,#c99be0);',replace:'color:#c99be0;',mustFail:'light-mode semantic badges remain readable'},
 {label:'trained-only label keeps its dark-only foreground',find:'color:var(--trained-ink,#d09090);',replace:'color:#d09090;',mustFail:'light-mode semantic badges remain readable'},
 {label:'untrained label keeps its dark-only foreground',find:'color:var(--untrained-ink,#d0b070);',replace:'color:#d0b070;',mustFail:'light-mode semantic badges remain readable'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-bible-study-theme.js',5,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
