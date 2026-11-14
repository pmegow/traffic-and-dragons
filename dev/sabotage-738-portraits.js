var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
// Browser clauses use dev/cdp-browser.js; missing Chrome is a reported skip.
var chrome=require('./cdp-browser.js').locateChrome();
var command=['node',['dev/run-tests.js','#738 blueprint portraits throughout play']];
var rc=sabotage.prove({file:'game.js',command:command,cases:[
 {label:'selected companion fill omitted',find:'if(n.portrait&&!npcPortrait(_portraitNpc))',replace:'if(false)',mustFail:'#738 a selected exact companion receives the blueprint image without replacing its sheet'},
 {label:'authored image overwrites chosen image',find:'if(n.portrait&&!npcPortrait(_portraitNpc))',replace:'if(n.portrait)',mustFail:'#738 an existing chosen portrait wins over the blueprint'},
 {label:'folded source duplicates admitted',find:'if(count!==1)return null;',replace:'if(count<1)return null;',mustFail:'#738 ambiguous source names withhold the companion image'},
 {label:'folded roster duplicates admitted',find:'if(count!==1||target.name!==name)return null;',replace:'if(!target||target.name!==name)return null;',mustFail:'#738 case-variant roster rows withhold the companion image'},
 {label:'case-only name guessed',find:'if(count!==1||target.name!==name)return null;',replace:'if(count!==1)return null;',mustFail:'#738 a case-only primary match receives no image'},
 {label:'provisional identity borrows original face',find:'npcIsProvisional(name)||(target.charSheet&&target.charSheet.name!==name)',replace:'(target.charSheet&&target.charSheet.name!==name)',mustFail:'#738 provisional identity and mismatched sheet name withhold the image'},
 {label:'different sheet identity borrows face',find:'npcIsProvisional(name)||(target.charSheet&&target.charSheet.name!==name)',replace:'npcIsProvisional(name)',mustFail:'#738 provisional identity and mismatched sheet name withhold the image'},
 {label:'case-variant memory duplicate hidden by owner fold',find:'identityNameFold(k)===fold&&k!==name',replace:'false',mustFail:'#738 case-variant memory records withhold the companion image'},
 {label:'competing hero alias ignored',find:'var claims=identityNameClaims(name);',replace:'var claims=identityNameClaims(name,["@player"]);',mustFail:'#738 competing hero and alias claims withhold the companion image'},
 {label:'conflicting source alias bypasses admission',find:'if(identitySheetIssue(source,name,[identityNpcOwner(name)]))return null;',replace:'',mustFail:'#738 matching source aliases must still pass identity admission'},
 {label:'blueprint export drops authored face',find:'if(portrait)npcs[npcs.length-1].portrait=portrait;',replace:'if(false)npcs[npcs.length-1].portrait=portrait;',mustFail:'#738 blueprint export carries the canonical portrait without mutating state'}
]});
rc|=sabotage.prove({file:'helpers.js',command:command,cases:[
 {label:'invalid image admitted into a sheet',find:'portraitAdmit(candidate,where||("NPC "+n.name))',replace:'portraitAdmit({portrait:null},where||("NPC "+n.name))',mustFail:'#738 malformed matching portrait is diagnosed without changing the sheet'},
 {label:'portrait written only to wrapper',find:'(n.charSheet||n).portrait=candidate.portrait;',replace:'n.portrait=candidate.portrait;',mustFail:'#738 a selected exact companion receives the blueprint image without replacing its sheet'},
 {label:'old row portrait remains after sheet adoption',find:'if(n.charSheet)n.portrait=null;',replace:'',mustFail:'#738 accepted merge keeps the canonical face before adopting a sheet'},
 {label:'portrait owner changes without transport dirty mark',find:'if(typeof storageAdapter!=="undefined"&&storageAdapter.markPortraitDirty)storageAdapter.markPortraitDirty();',replace:'',mustFail:'#738 accepted image merge marks the portrait transport dirty'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:command,cases:[
 {label:'duplicate sheet face lost at merge',find:'npcPortrait(_mgCanN)||npcPortrait(_mgDupN)',replace:'npcPortrait(_mgCanN)||_mgDupN.portrait',mustFail:'#738 accepted merge preserves a duplicate sheet image'},
 {label:'adopted face replaces canonical image',find:'npcPortrait(_mgCanN)||npcPortrait(_mgDupN)',replace:'npcPortrait(_mgDupN)||npcPortrait(_mgCanN)',mustFail:'#738 accepted merge keeps the canonical face before adopting a sheet'},
 {label:'chosen face inherits another portrait crop',find:'_mgPortraitFrom=npcPortrait(_mgCanN)?_mgCanN:_mgDupN',replace:'_mgPortraitFrom=_mgDupN',mustFail:'#738 accepted merge keeps the chosen face framing through export'},
 {label:'unframed face retains adopted sheet crop',find:'if(_mgCanN.charSheet)_mgCanN.charSheet.portraitOffset=',replace:'if(_mgCanN.charSheet&&_mgPortraitOffset)_mgCanN.charSheet.portraitOffset=',mustFail:'#738 an unframed chosen face never inherits the duplicate crop'},
 {label:'merge strands image outside sheet',find:'npcPortraitWrite(_mgCanN,_mgPortrait,"accepted NPC merge "+mgCanon)',replace:'(_mgCanN.portrait=_mgPortrait)',mustFail:'#738 accepted merge moves a row image into the survivor sheet'}
]});
rc|=sabotage.prove({file:'ui-sheets.js',skip:!chrome.path,command:['node',['dev/tests-734-blueprint-portraits-browser.js']],cases:[
 {label:'manual generation loses authored fallback',find:',portraitFallback:npcPortrait(wsNpc)',replace:'',mustFail:'FAIL #738 manual sheet generation keeps the authored image and releases busy'},
 {label:'refused manual generation consumes original image',find:'sheet.portrait=null;/* Model output cannot replace',replace:'wsNpc.portrait=null;sheet.portrait=null;/* Model output cannot replace',mustFail:'FAIL #738 refused manual sheet retains the roster image and releases busy'},
 {label:'refused manual generation leaves busy latched',find:'finally{busy=false;}',replace:'finally{}',mustFail:'FAIL #738 refused manual sheet retains the roster image and releases busy'}
]});
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-738-portraits.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(rc?1:0);
