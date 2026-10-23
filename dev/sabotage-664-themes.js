// Real Chrome through dev/cdp-browser.js; unavailable Chrome is a loud skip.
// Every mutation must fail the named browser assertion, in the runner's disposable clone.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0,command=['node',['dev/tests-664-themes-browser.js','--focused']];
function prove(file,cases){failed+=sabotage.prove({file:file,command:command,skip:!chrome.path,cases:cases});}
prove('website/game-theme.js',[
 {label:'saved light is ignored',find:'localStorage.getItem(KEY)==="light"',replace:'localStorage.getItem(KEY)==="lite"',mustFail:'home.html saved light wins'},
 {label:'saved dark loses to the site fallback',find:'else if(localStorage.getItem(KEY)==="dark")t="dark";',replace:'',mustFail:'website/index.html saved dark wins'},
 {label:'cross-tab changes stop updating pages',find:'if(!e||e.key===null||e.key===KEY)apply();',replace:'if(false)apply();',mustFail:'home.html follows the game in another tab'}
]);
prove('home.html',[
 {label:'theme loading moves after first paint',find:'<script src="website/game-theme.js"></script>',replace:'',mustFail:'home.html applies its preference before styles'}
]);
prove('website/index.html',[
 {label:'the public site ignores device preference without a saved choice',find:'data-theme-default="system"',replace:'data-theme-default="dark"',mustFail:'public site follows the device with no saved choice'}
]);
prove('website/themes.css',[
 {label:'light background stops changing',find:'--bg0:#b0a68b;',replace:'--bg0:#0c0d11;',mustFail:'blueprint-designer.html paints both palettes'}
]);
prove('ui-modals.js',[
 {label:'death dialogs keep dark panels',find:'☠ You died</div>',replace:'☠ You died</div><style>#respawn-modal>div{background:#181818!important}</style>',mustFail:'dialog surfaces and primary labels'},
 {label:'game ignores a setting changed by another tab',find:'if(!e||e.key===null||e.key===THEME_KEY)loadTheme();',replace:'if(false)loadTheme();',mustFail:'dialog surfaces and primary labels'}
]);
prove('char-creation.js',[
 {label:'wizard stat choices retain a fixed dark surface',find:"background:var(--bg2);color:var(--t0);cursor:pointer;font-family:var(--font);'>+1</button>",replace:"background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+1</button>",mustFail:'character wizard controls follow both palettes'}
]);
failed+=sabotage.prove({file:'dev/bible-server.js',command:['node',['dev/tests-bible-editor-launcher.js']],cases:[
 {label:'the local editor launcher refuses the shared theme controller',find:'  "/website/game-theme.js": "website/game-theme.js",',replace:'',mustFail:"launcher server serves the page's own asset website/game-theme.js"}
]});
prove('map_viewer.html',[
 {label:'standalone SVG loses its resolved palette',find:'var palette=getComputedStyle(document.documentElement);',replace:'return svg; var palette=getComputedStyle(document.documentElement);',mustFail:'map nodes and standalone SVG'}
]);
prove('story_compiler.html',[
 {label:'preview no longer follows a preference change',find:'document.addEventListener("tnd:theme",syncPreviewTheme);',replace:'',mustFail:'compiled preview follows the app'}
]);
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-664-themes.js',11,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
