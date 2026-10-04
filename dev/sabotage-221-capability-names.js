// #221: prove draft preservation, explicit decisions, game-card modals and Bible deep links.
// Browser cases use dev/cdp-browser.js; missing Chrome must report SKIP, never a passing proof.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js');
var chrome=require('./cdp-browser.js').locateChrome(),failed=0;
failed+=sabotage.prove({file:'capability-names.html',command:['node',['dev/tests-221-capability-names.js']],cases:[
 {label:'copied names lose title capitalization',find:'return word.charAt(0).toUpperCase()+word.slice(1);',replace:'return word;',mustFail:'copied original names use title case'},
 {label:'class spell lists stop contributing usage',find:'pool(def.spells,owner);',replace:'',mustFail:'usage includes class levels'},
 {label:'class level features disappear from usage',find:'Object.keys(def.levels||{})',replace:'Object.keys({})',mustFail:'usage includes class levels'},
 {label:'racial lineages disappear from usage',find:'(node.lineages||[]).forEach',replace:'[].forEach',mustFail:'usage includes class levels'},
 {label:'original names are silently accepted by default',find:'return {from:key,to:""};',replace:'return {from:key,to:key};',mustFail:'blank defaults require an explicit decision'},
 {label:'blank names pass the implementation gate',find:'if(!key){errors[i]=',replace:'if(false){errors[i]=',mustFail:'blank and delimiter names block implementation'},
 {label:'collisions ignore engine name normalization',find:'var key=capBaseName(row.to);',replace:'var key=row.to;',mustFail:'engine-normalized collisions mark both rows'},
 {label:'exports drop unfinished rows',find:'names:list},null,2)',replace:'names:list.filter(function(row){return !!row.to;})},null,2)',mustFail:'draft round trip preserves unfinished'},
 {label:'ready flag bypasses fresh validation',find:'var list=read(text,bible);',replace:'var list=read(text,bible);if(JSON.parse(text).readyToApply)return list;',mustFail:'readiness cannot be forged'},
 {label:'malformed imported names bypass shape validation',find:'typeof row.to!=="string"||',replace:'',mustFail:'bad imports and changed bible cannot discard choices'}
]});
failed+=sabotage.prove({file:'capability-names.html',skip:!chrome.path,command:['node',['dev/tests-221-capability-names-browser.js']],cases:[
 {label:'copy button does not copy the original',find:'updateName(CapabilityNames.titleName(row.from));input.focus();',replace:'input.focus();',mustFail:'middle copy buttons keep one original explicitly'},
 {label:'copy button goes after the new-name column',find:'tr.appendChild(left);tr.appendChild(middle);tr.appendChild(right);',replace:'tr.appendChild(left);tr.appendChild(right);tr.appendChild(middle);',mustFail:'middle copy buttons keep one original explicitly'},
 {label:'copying capitalization counts as a rename',find:'different=filled&&capBaseName(row.to)!==capBaseName(row.from)',replace:'different=filled&&row.to!==row.from',mustFail:'middle copy buttons keep one original explicitly'},
 {label:'spelling suggestions are disabled',find:'input.spellcheck=true;',replace:'input.spellcheck=false;',mustFail:'new-name fields enable English spellchecking'},
 {label:'Save reads the project file without writing it',find:'projectRequest("POST",{text:text,revision:revision})',replace:'projectRequest("GET")',mustFail:'unfinished edits survive reload and project save'},
 {label:'drafts report saved without writing storage',find:'localStorage.setItem(KEY,CapabilityNames.pack(list));',replace:'',mustFail:'unfinished edits survive reload and project save'},
 {label:'the modal renders a different capability',find:'bibleCardHTML(name,CAPABILITY_BIBLE[name])',replace:'bibleCardHTML(name,CAPABILITY_BIBLE["zone of truth"])',mustFail:'original names open the game card'},
 {label:'the modal loses its close controls',find:'closeId:"name-card-close",outside:true',replace:'closeId:"name-card-close",outside:true,wireClose:false',mustFail:'original names open the game card'},
 {label:'a long modal exceeds the viewport',find:'max-height:calc(100vh - 40px);',replace:'',mustFail:'long game cards fit a narrow viewport'}
]});
failed+=sabotage.prove({file:'bible_study.html',skip:!chrome.path,command:['node',['dev/tests-221-capability-names-browser.js']],cases:[
 {label:'Bible navigation no longer focuses the requested card',find:'card.focus();card.scrollIntoView({block:"center"});',replace:'',mustFail:'Bible links reveal the exact card'}
]});
failed+=sabotage.prove({file:'dev/capability-names-store.js',command:['node',['dev/tests-221-names-store.js']],cases:[
 {label:'stale edits overwrite the newer project file',find:'if(payload.revision!==current.revision)',replace:'if(false)',mustFail:'invalid and stale writes leave the current file'},
 {label:'a failed replacement already overwrote the original',find:'fs.renameSync(temp,file);',replace:'fs.writeFileSync(file,text);fs.renameSync(temp,file);',mustFail:'failed atomic replacement preserves'},
 {label:'names file validation accepts an empty list',find:'box.CapabilityNames.read(payload.text,box.CAPABILITY_BIBLE)',replace:'[]',mustFail:'repeated saves replace one project file'}
]});
failed+=sabotage.prove({file:'dev/bible-server.js',command:['node',['dev/tests-221-names-store.js']],cases:[
 {label:'foreign pages can write the names file',find:'if (namesOrigin && !',replace:'if (false && !',mustFail:'project save endpoint refuses foreign origins'},
 {label:'stale pages bypass the helper version check',find:'if (req.headers["x-bible-helper-version"] !== HELPER_VERSION)',replace:'if (false)',mustFail:'project save endpoint refuses foreign origins'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-221-capability-names.js',10,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
