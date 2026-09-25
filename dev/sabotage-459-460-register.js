// #459 records never recited + #460 the sheet outranks the GM's memory — every guard proven by mutation in a disposable clone.
// The engine manifest's working set rides into the clone; the standalone suite, the scrub tool and the registry ride via `also`.
//   node dev/sabotage-459-460-register.js
var sabotage=require('./sabotage.js'),code=0;
var ALSO=['dev/tests-459-register-gate.js','dev/register-scrub.js','dev/run-standalone-suites.js','dev/engine-tests.js','blueprint-designer.html'];
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:ALSO,cases:cases});}
var SEC='#459 / #460',STAND='dev/tests-459-register-gate.js';
prove('helpers.js',['dev/run-tests.js',SEC],[
 {label:'the widened list loses the tithe half',find:'"lien","liens","tithe","tithes","collateral","creditor","creditors","escrow","foreclosures","foreclosure","foreclosed","foreclose","repayments","repayment","soul-tax"]',replace:'"lien","liens"]',mustFail:'#459 ② REGISTER_WORDS widened'},
 {label:'the settled reason files in the register',find:'— filed as a bare \'settled\': \\""+h.slice(0,80)+"\\"");h="settled";}',replace:'— filed as a bare \'settled\': \\""+h.slice(0,80)+"\\"");}',mustFail:'#459 the settled filing lands in plain speech'},
 {label:'a place phrase stops counting as a doing',find:'||MOOD_PLACE_RE.test(p)',replace:'',mustFail:'#460 ① a sheeted resident\'s GM-written mood is kept to what they are DOING'},
 {label:'the sheet never leads',find:'  return !!(n&&!n.partyMember&&n.charSheet&&typeof n.charSheet.trait==="string"&&n.charSheet.trait.trim());',replace:'  return false;',mustFail:'#460 ① the memory attitude line is omitted'},
 {label:'the census forgets the record channel',find:'var rc=c.record||[];for(i=0;i<rc.length;i++){out.record++;if(rc[i].dropped)out.recordDropped++;}',replace:'',mustFail:'#459 ③ summarize() awaits recordRegisterGuard'}
]);
prove('campaign_generator.js',['dev/run-tests.js',SEC],[
 {label:'an arc title in the register passes the gate',find:'chk(rn+" title",r.title);',replace:'',mustFail:'#459 ① skeletonRegisterScan is the deterministic REGISTER gate'},
 {label:'the gate downgrades to MED',find:'out.push({sev:"HIGH",where:where,',replace:'out.push({sev:"MED",where:where,',mustFail:'#459 ① skeletonRegisterScan is the deterministic REGISTER gate'}
]);
prove('game.js',['dev/run-tests.js',SEC],[
 {label:'the gate\'s findings never reach the correction',find:'var findings=_gate.concat(await reviewCampaignSkeleton(',replace:'var findings=[].concat(await reviewCampaignSkeleton(',mustFail:'#459 ① generateSkeleton source contract'}
]);
prove('game.js',[STAND],[
 {label:'the corrected skeleton is never re-scanned',find:'  var _still=skeletonRegisterScan(skel);\n  if(_still.length){',replace:'  var _still=[];\n  if(_still.length){',mustFail:'① a correction that keeps the register: ONE regeneration'}
]);
prove('memory.js',[STAND],[
 {label:'a dirty record line is kept instead of dropped',find:'if(d.cleaned){j.set(d.text);out.cleaned++;}else{j.drop();out.dropped++;}',replace:'if(d.cleaned){j.set(d.text);out.cleaned++;}else{out.dropped++;}',mustFail:'③ recordRegisterGuard: a clean rewrite replaces the knowledge line'}
]);
prove('memory.js',['dev/run-tests.js',SEC],[
 {label:'summarize files without the record guard',find:'    await recordRegisterGuard(extracted,worldState.turn);/* #459 ③: a knowledge or lore line in the register is re-asked ONCE, else dropped — never filed */\n',replace:'',mustFail:'#459 ③ summarize() awaits recordRegisterGuard'},
 {label:'the NPC detail keeps the attitude beside a trait',find:'((n.attitude&&!(typeof sheetTraitLeads==="function"&&sheetTraitLeads(name)))?" — toward you: "+n.attitude:"")',replace:'(n.attitude?" — toward you: "+n.attitude:"")',mustFail:'#460 ① the memory attitude line is omitted'}
]);
prove('api.js',['dev/run-tests.js',SEC],[
 {label:'the mood leads a sheeted resident again',find:'if(_pcs.trait){npcBits.push("plays as: "+_pcs.trait);if(_pcs.flaw)npcBits.push("flaw: "+_pcs.flaw);if(_moodBit)npcBits.push("now: "+_moodBit);_moodPushed=true;}',replace:'if(_pcs.trait){if(_moodBit)npcBits.push("mood: "+_moodBit);npcBits.push("trait: "+_pcs.trait);if(_pcs.flaw)npcBits.push("flaw: "+_pcs.flaw);_moodPushed=true;}',mustFail:'#460 ① the sheet outranks the GM\'s memory for a present sheeted resident'},
 {label:'STYLE loses the record clause',find:'THE RECORD IS YOURS, NOT THEIRS: when a character speaks of the past they speak as people do — short, vague, feeling first, never the wording of the record; a companion who was there says less, not more; a stranger has only heard a garbled version. ',replace:'',mustFail:'#459 ④ STYLE carries THE RECORD IS YOURS'},
 {label:'STYLE loses the greetings clause',find:'NO STOCK BLESSINGS OR RITUAL GREETINGS: no formula hellos and no invented rites of welcome; people greet the way their trait says they would, or not at all. ',replace:'',mustFail:'#460 ② STYLE carries NO STOCK BLESSINGS'}
]);
prove('tag_table.js',['dev/run-tests.js',SEC],[
 {label:'the mood write keeps the GM\'s adjectives',find:'var _mdo=moodDoingOnly(npStatus);\n      if(_mdo!==npStatus){',replace:'var _mdo=moodDoingOnly(npStatus);\n      if(false){',mustFail:'#460 ① a sheeted resident\'s GM-written mood is kept to what they are DOING'}
]);
prove('blueprint-designer.html',['dev/run-tests.js',SEC],[
 {label:'Generate stops seeding the review',find:'      if(_regF.length)draft.review={findings:_regF,sections:0,failedSections:0};\n',replace:'',mustFail:'#459 ① the designer\'s Generate takes the same gate'}
]);
process.exit(code);
