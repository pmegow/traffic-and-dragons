// #733: public EXIT admission has the same source and commit authority as explicit disclosures.
var sabotage=require('./sabotage.js'),rc=0,command=['node',['dev/tests-733-map-exits.js']],only='FAIL #733 exits ';
rc|=sabotage.prove({file:'atlas-knowledge-exits.js',command:command,only:only,cases:[
 {label:'direction words in a display note become established bearings',find:'bearing:"unknown",mode:"reported"',replace:'bearing:"N",mode:"reported"',mustFail:only+'three declared roads appear while stationary without inferred bearings'},
 {label:'a declared way is promoted to direct observation',find:'bearing:"unknown",mode:"reported"',replace:'bearing:"unknown",mode:"observed"',mustFail:only+'three declared roads appear while stationary without inferred bearings'},
 {label:'source validation happens after the private known-way write',find:'if(source.reason){refuse(source.reason);return;}',replace:'',mustFail:only+'private and truncated nesting cannot publish or file an EXIT'},
 {label:'the exit borrows the final source location',find:'at=rPlaceAt(R,m.index);',replace:'at=rPlaceAt(R,raw.length);',mustFail:only+'EXIT and known-way filing use source position before and after movement'},
 {label:'a full open-way list discards a fresh public declaration',find:'xr.code!=="capacity"&&xr.code!=="known"',replace:'xr.code!=="known"',mustFail:only+'sixth public way is retained despite legacy open-list capacity'},
 {label:'a filed destination discards its fresh public declaration',find:'xr.code!=="capacity"&&xr.code!=="known"',replace:'xr.code!=="capacity"',mustFail:only+'already-known destination remains a public declaration without identity inference'},
 {label:'semantic EXIT refusals are treated as accepted declarations',find:'if(xr.code!=="capacity"&&xr.code!=="known"){q.reason=xr.reason;continue;}',replace:'',mustFail:only+'self and conflicting floor-plan EXIT refusals cannot disclose'},
 {label:'known observed points receive a weaker fallback update',find:'(count&&!recorded)||explicit||',replace:'explicit||',mustFail:only+'weaker EXIT repetition cannot reject an independent newly declared way'},
 {label:'explicit map disclosures lose precedence over EXIT fallback',find:'(count&&!recorded)||explicit||',replace:'(count&&!recorded)||',mustFail:only+'explicit MAP wins over matching EXIT in either source order'},
 {label:'duplicate EXIT tokens create repeated admission receipts',find:'||Object.prototype.hasOwnProperty.call(seen,key)',replace:'',mustFail:only+'duplicate current EXITs share one admission and retry does not grow'},
 {label:'an ambiguous canonical label is treated as one known point',find:'if(count>1)throw new Error("the public exit label is ambiguous in this resolved place");',replace:'',mustFail:only+'canonical public label ambiguity refuses rather than choosing a handle'},
 {label:'replaying the same engine token suppresses its published receipt',find:'recorded=receipt;break;',replace:'recorded=null;break;',mustFail:only+'identical engine-token replay preserves the public discovery sentence'},
 {label:'combined declarations can exceed the per-turn bound',find:'if(all.length>16){refuse("at most 16 public map disclosures are accepted per turn");return;}',replace:'',mustFail:only+'the sixteen-input bound includes explicit MAP and fallback EXIT together'},
 {label:'extra EXIT operands gain public authority',find:'fields.length>2||',replace:'',mustFail:only+'malformed EXIT fields and labels refuse before known-way writes'},
 {label:'a malformed trailing EXIT is silently ignored',find:'if(records.length!==(raw.match(/\\[EXIT(?::|\\])/g)||[]).length){refuse("an EXIT directive is truncated or malformed");return;}',replace:'',mustFail:only+'malformed EXIT fields and labels refuse before known-way writes'}
]});
rc|=sabotage.prove({file:'atlas-knowledge-source.js',command:command,only:only,cases:[
 {label:'private location tokens silently supply public scope',find:'    for(;cursor<source[i].start;cursor++)',replace:'    if(!source[i].map)continue;\n    for(;cursor<source[i].start;cursor++)',mustFail:only+'private location tokens cannot become scope for public EXIT or MAP'},
 {label:'canon envelopes grant EXIT public authority',find:'if(m[1]==="MAP_REVEAL"||m[1]==="EXIT")',replace:'if(m[1]==="EXIT")continue;\n    if(m[1]==="MAP_REVEAL"||m[1]==="EXIT")',mustFail:only+'canon envelope EXIT is refused before known-way filing'}
]});
rc|=sabotage.prove({file:'memory.js',command:command,only:only,cases:[
 {label:'known-way filing ignores the declaration source key',find:'var key=_exitR(at&&at.key?at.key:currentNodeKey()),node=memory.map.nodes[key];',replace:'var key=_exitR(currentNodeKey()),node=memory.map.nodes[key];',mustFail:only+'EXIT and known-way filing use source position before and after movement'},
 {label:'place matching borrows the final world instead of the EXIT source',find:'resolvePlaceName(nm,at&&at.world?at.world:worldState.world.location,{sub:at?at.sub||null:worldState.world.sublocation||null})',replace:'resolvePlaceName(nm,worldState.world.location,{sub:worldState.world.sublocation||null})',mustFail:only+'source-position context also controls the existing place resolver'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
 {label:'coalescing hides a forged fallback before its source is validated',find:'atlasKnowledgePublish(raw,q.items);/* Validate every queued source before any coalescing can hide a changed declaration. */',replace:'',mustFail:only+'tampered fallback cannot hide behind an existing explicit discovery'},
 {label:'the prose reroll retains a new EXIT directive',find:'text=text.replace(/\\[(?:MAP_REVEAL|EXIT)(?::[^\\]]*)?\\]/g,"").replace(/\\[(?:MAP_REVEAL|EXIT)[^\\]]*$/,"");',replace:'',mustFail:only+'prose reroll cannot carry a new EXIT directive into history'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:command,only:only,cases:[
 {label:'active EXIT parsing falls back to the unsourced legacy writer',find:'if(typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()){atlasKnowledgeExitApply(text,R);return;}',replace:'',mustFail:only+'three declared roads appear while stationary without inferred bearings'}
]});
rc|=sabotage.prove({file:'api.js',command:command,only:only,cases:[
 {label:'private movement reaches writers before public source refusal',find:'if(_mapMovementProblem){',replace:'if(false){',mustFail:only+'actual commit cannot move or title the public map from private geography'},
 {label:'known-way writes lose the original pre-envelope source',find:'applyMutsTable(_w2Plan.ordinary,{deferCommit:true,mapSource:_mapSourceRaw})',replace:'applyMutsTable(_w2Plan.ordinary,{deferCommit:true})',mustFail:only+'canon envelope EXIT is refused before known-way filing'}
]});
process.exit(rc?1:0);
