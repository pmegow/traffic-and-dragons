// #733 public adapter and drawer: each deliberate regression names its actual guarding test.
// Browser checks share a sequential fixture; run the entire dev/cdp-browser.js suite for each host clause.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),rc=0;
var node=['node',['dev/tests-733-map-public.js']],browser=['node',['dev/tests-733-map-browser.js']],only='FAIL #733 public ';
rc|=sabotage.prove({file:'atlas.js',command:node,only:only,cases:[
 {label:'the public document dispatcher returns a generated private sheet',find:'function atlasDoc(zoneId){if(typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()){return atlasPublicDoc(zoneId);}',replace:'function atlasDoc(zoneId){',mustFail:only+'the original seed generates the undisclosed hut inside the old visibility radius'}
]});
rc|=sabotage.prove({file:'atlas-public.js',command:node,only:only,cases:[
 {label:'a proposed classification selects a public glyph',find:'kind:"landmark",bearing:f.bearing,mode:f.mode',replace:'kind:f.kind,bearing:f.bearing,mode:f.mode',mustFail:only+'public adapter ignores upstream classification and archival quote fields'},
 {label:'a card repeats an archival quote containing an unaccepted classification',find:'". Disclosed on turn "+f.source.turn+"."',replace:'". "+f.source.quote',mustFail:only+'public adapter ignores upstream classification and archival quote fields'},
 {label:'the public schematic drops the three stationary discoveries',find:'features:p.features.map(function(f){return {id:f.id,name:f.label,kind:"landmark",bearing:f.bearing,mode:f.mode};})',replace:'features:[]',mustFail:only+'three stationary discoveries change only knowledge and every public surface agrees'},
 {label:'an ordinary absent party pointer is treated as an unexpected error',find:'if(!A||!p){if(typeof worldState!=="undefined"&&worldState)delete worldState.placeDecls;return null;}',replace:'',mustFail:only+'a missing party pointer leaves the last public position untouched and never escapes'},
 {label:'an unexpected public follow failure loses its diagnostic',find:'}catch(e){atlasProblem("following the public map",e);return null;}',replace:'}catch(e){return null;}',mustFail:only+'an unexpected public follow error reports its reason without escaping or advancing'},
 {label:'private place classification chooses the public sheet scale',find:'function atlasPublicScale(){return "wild";}',replace:'function atlasPublicScale(){return worldState.world.sublocation?"interior":(worldState.atlas.kinds[worldState.world.location]?"town":"wild");}',mustFail:only+'private place classification cannot label a public sheet or change its scene'},
 {label:'the current sheet carries discoveries from the first feature container',find:'p=atlasKnowledgeProjection(k);',replace:'p=atlasKnowledgeProjection(Object.keys(memory.map.geography.features).length?memory.map.geography.features.f1.container:k);',mustFail:only+'changing place cannot carry discoveries into another container'}
]});
var drawer=[
 {label:'the open drawer signature ignores newly disclosed geography',find:'A.knowledge,memory&&memory.map&&memory.map.geography&&memory.map.geography.revision,A.knowledge&&memory&&memory.map&&memory.map.identity',replace:'A.knowledge,0,A.knowledge&&memory&&memory.map&&memory.map.identity',mustFail:'FAIL #733 browser three stationary narrated landmarks update the open drawer immediately'},
 {label:'crowded labels disappear without the actionable disclosure warning',find:'if(dropped.length&&P.warning!==warning)atlasPaneSay(dropped.length+" map labels overlap and are omitted. Select a symbol or use the Arrow keys to read every known feature.");',replace:'',mustFail:'FAIL #733 browser crowded public labels produce one actionable warning per unchanged drawing'}
];
var activation=[
 {label:'an open private canvas survives activation when its public replacement fails',find:'if(typeof atlasPaneClose==="function")atlasPaneClose({defer:true});',replace:'',mustFail:'FAIL #733 browser activation clears an open private pane even when public drawing fails'}
];
rc|=sabotage.prove({file:'ui-atlas.js',skip:!chrome.path,command:browser,cases:drawer});
rc|=sabotage.prove({file:'atlas-public.js',skip:!chrome.path,command:browser,cases:activation});
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-733-map-public.js',drawer.length+activation.length,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(rc?1:0);
