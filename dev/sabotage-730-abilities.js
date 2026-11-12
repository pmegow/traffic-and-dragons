// Browser proof uses dev/cdp-browser.js. No paid calls; every mutation is attributed and restored.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),rc=0;
var engine=['node',['dev/run-tests.js','#730 authored creature and NPC abilities']],unit=['node',['dev/tests-730-designer-abilities.js']];
rc+=sabotage.prove({file:'game.js',command:engine,cases:[
 {label:'entity ability arrays admitted',find:'ae&&ae.abilities!==undefined&&typeof ae.abilities!=="string"',replace:'false',mustFail:'#730 optional abilities validate as text'},
 {label:'ability fields evade prose revision',find:'if(o&&o.abilities!==undefined)add(o,["abilities"],section+"."+i+".",caps.field);',replace:'if(false)add(o,["abilities"],section+"."+i+".",caps.field);',mustFail:'#730 ability prose shares runtime caps'},
 {label:'NPC seed drops mechanics',find:'if(_seed.abilities)fileNpcAuthored(_am,_seed.abilities,"abilities");',replace:'',mustFail:'#730 NPC mechanics are protected authored data'},
 {label:'NPC export omits ability field',find:'if(abilities)npcs[npcs.length-1].abilities=abilities;',replace:'',mustFail:'#730 abilities-only NPC exports no mechanics into notes'},
 {label:'abilities-only export contaminates notes',find:'npcKnowledgeContext(mem,{omitAbilities:true}).slice(0,400)',replace:'npcKnowledgeContext(mem).slice(0,400)',mustFail:'#730 abilities-only NPC exports no mechanics into notes'}
]});
rc+=sabotage.prove({file:'memory.js',command:engine,cases:[
 {label:'same prose under different fields is incorrectly deduplicated',find:'&&(n.authored[i].field||"notes")===(field||"notes")',replace:'',mustFail:'#730 identity merge preserves same text under distinct authored fields'},
 {label:'GM detail loses abilities',find:'var _abilities=opts&&opts.omitAbilities?"":npcAbilityText(n);',replace:'var _abilities="";',mustFail:'#730 NPC mechanics are protected authored data'},
 {label:'sheet context loses mechanics under long dossiers',find:'opts&&opts.omitAbilities?"":npcAbilityText(n),npcSecretText(n),npcAuthoredText(n)',replace:'npcSecretText(n),npcAuthoredText(n),opts&&opts.omitAbilities?"":npcAbilityText(n)',mustFail:'#730 long NPC dossiers cannot crowd abilities out'}
]});
rc+=sabotage.prove({file:'tag_table.js',command:engine,cases:[
 {label:'merge erases typed provenance',find:'fileNpcAuthored(memory.npcs[mgCanon],_mgAuth[_mgAi].text,_mgAuth[_mgAi].field);',replace:'fileNpcAuthored(memory.npcs[mgCanon],_mgAuth[_mgAi].text);',mustFail:'#730 identity merge preserves same text under distinct authored fields'}
]});
rc+=sabotage.prove({file:'api.js',command:engine,cases:[
 {label:'hot NPC details repeat abilities',find:'memoryNpcDetail(hnN,{omitAbilities:true})',replace:'memoryNpcDetail(hnN)',mustFail:'#730 NPC abilities reach opening and unnamed combat'},
 {label:'NPC mechanics wait until name mention',find:'    +buildNpcAbilitiesBlock()',replace:'',mustFail:'#730 NPC abilities reach opening and unnamed combat'},
 {label:'bestiary omits authored abilities',find:'if(typeof _bc.abilities==="string"&&_bc.abilities.trim())_detail+=',replace:'if(false)_detail+=',mustFail:'#730 creature mechanics follow the whole-entry act gate'}
]});
rc+=sabotage.prove({file:'companion-talk.js',command:unit,cases:[
 {label:'player conversation receives private ability section',find:'memoryNpcDetail(partner.name,{omitAbilities:true})',replace:'memoryNpcDetail(partner.name)',mustFail:'FAIL #730 player-facing enemy card and companion conversation exclude private abilities'}
]});
rc+=sabotage.prove({file:'designer-creatures.js',command:unit,cases:[
 {label:'generated abilities discarded',find:'["desc","displayName","abilities"].forEach',replace:'["desc","displayName"].forEach',mustFail:'FAIL #730 generated creature abilities are typed and retained'},
 {label:'review loses omitted ability prose',find:'if(previous&&next.abilities===undefined&&previous.abilities!==undefined)next.abilities=previous.abilities;',replace:'',mustFail:'FAIL #730 review replacements preserve omitted abilities'},
 {label:'portrait includes private powers',find:'return "Bestiary illustration. Visible appearance: "+c.desc',replace:'return "Bestiary illustration. Abilities: "+c.abilities+" Visible appearance: "+c.desc',mustFail:'FAIL #730 abilities are absent from creature and NPC portrait requests'}
]});
rc+=sabotage.prove({file:'designer-assistant.js',command:unit,cases:[
 {label:'class ability arrays lose their scoped type',find:"var sectionLists={customClasses:{abilities:'ability'}};",replace:'var sectionLists={};',mustFail:'FAIL #730 assistant handles entity prose and retains structured class abilities'}
]});
rc+=sabotage.prove({file:'campaign_generator.js',command:unit,cases:[
 {label:'campaign generation forgets NPC abilities schema',find:'"abilities":"Optional prose: spells, special attacks, resistances',replace:'"powers":"Optional prose: spells, special attacks, resistances',mustFail:'FAIL #730 starter campaign generation requests and retains NPC ability prose'}
]});
rc+=sabotage.prove({file:'blueprint-designer.html',skip:!chrome.path,command:['node',['dev/tests-730-designer-abilities-browser.js']],cases:[
 {label:'NPC editor loses abilities field',find:'+entityAbilitiesField("npc",i,n)',replace:'+""',mustFail:'#730 both entity cards expose an Abilities textarea'},
 {label:'creature editor loses abilities field',find:'+entityAbilitiesField("creature",i,C);',replace:'+"";',mustFail:'#730 both entity cards expose an Abilities textarea'}
]});
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-730-abilities.js',2,chrome.why);process.exit(verdict.SKIP_EXIT);}process.exit(rc?1:0);
