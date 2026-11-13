// #733: source privacy, bounded extraction proposals and detached admission each have a named failure.
var sabotage=require('./sabotage.js'),prefix='FAIL #733 extraction ';
var cases=[
 {label:'canon body prose becomes public extraction input',find:'if(open!==null)return;',replace:'if(false)return;',mustFail:'payload excludes every bracket subtree and canon envelope body'},
 {label:'tag subtree bytes remain in a later public span',find:'i=j;start=i;continue;',replace:'i=j;continue;',mustFail:'payload excludes every bracket subtree and canon envelope body'},
 {label:'bare canon body is treated as ordinary narration',find:'if((i===0||raw.charAt(i-1)==="\\n")&&',replace:'if(false&&',mustFail:'bare canon envelopes also hide body prose'},
 {label:'unclosed private tags are accepted as a safe source',find:'if(depth)return refuse("the extraction source contains an unclosed tag subtree");',replace:'',mustFail:'unbalanced private tags and malformed canon scopes refuse before payload'},
 {label:'hidden movement supplies public location scope',find:'var problem=atlasKnowledgeMovementProblem(raw);if(problem)return refuse(problem);',replace:'var problem="";',mustFail:'private movement cannot poison public source scope'},
 {label:'every public assertion borrows the final location',find:'placeStateAt(tl,a)',replace:'placeStateAt(tl,raw.length)',mustFail:'source scopes follow movement positions without minting nodes'},
 {label:'private source metadata leaks in known feature context',find:'scope.known.push({id:f.id,label:f.label,bearing:f.bearing,mode:f.mode});',replace:'scope.known.push(f);',mustFail:'known payload contains only detached scoped public attributes'},
 {label:'known context silently exceeds its bounded projection',find:'if(total>=128)',replace:'if(false)',mustFail:'public known-context and source scope caps are explicit'},
 {label:'unsupported record fields are accepted',find:'if(!atlasExtractionFields(e,["source","label","quote","mode","bearing","bearingQuote"]))',replace:'if(false)',mustFail:'closed JSON envelope and records reject extra missing and malformed fields'},
 {label:'overflowed candidates pass the closed envelope',find:'||obj.overflow!==false',replace:'',mustFail:'closed JSON envelope and records reject extra missing and malformed fields'},
 {label:'cut provider completion is parsed as a whole candidate',find:'if(finish&&(finish.cut||finish.cap))',replace:'if(false)',mustFail:'closed JSON envelope and records reject extra missing and malformed fields'},
 {label:'literal label quotation requirement becomes folded guesswork',find:'at<0||e.quote.indexOf(e.label)<0',replace:'at<0',mustFail:'source ids exact quotes literal labels and record bound are enforced'},
 {label:'records exceed the bounded extraction group',find:'||events.length>16',replace:'',mustFail:'source ids exact quotes literal labels and record bound are enforced'},
 {label:'direction need not match its literal support',find:'if(found!==e.bearing)',replace:'if(false)',mustFail:'bearing needs exact unambiguous cardinal evidence'},
 {label:'possessive s masquerades as south',find:'north|east|south|west)\\b/g)||[];',replace:'north|east|south|west|s)\\b/g)||[];',mustFail:'complete directional assertions do not misread possessives as south'},
 {label:'clipped absence assertions gain disclosure authority',find:')\\b/i.test(local))return refuse("the supporting local assertion is absent or hypothetical");',replace:')\\b/i.test(local)&&false)return refuse("the supporting local assertion is absent or hypothetical");',mustFail:'clipped absent and hypothetical assertions are conservatively refused'},
 {label:'tampered source scope bypasses the original position pin',find:'a.container!==locResolve(b.container)',replace:'false',mustFail:'prepare revalidates records and raw span pins without mutating state'},
 {label:'known observations are downgraded by weaker proposals',find:'mode:f&&f.mode==="observed"?"observed":e.mode',replace:'mode:e.mode',mustFail:'known stronger attributes survive weaker extraction while new point proceeds'},
 {label:'explicit MAP records lose precedence to extraction',find:'if(skip){skipped++;continue;}',replace:'',mustFail:'explicit MAP knowledge wins without suppressing unrelated extraction'},
 {label:'a conflicting established direction is silently ignored',find:'if(f&&f.bearing!=="unknown"&&e.bearing!=="unknown"&&f.bearing!==e.bearing)',replace:'if(false)',mustFail:'conflicting known bearing refuses all detached additions'},
 {label:'canonical ambiguity chooses a public handle arbitrarily',find:'if(matches.length>1)',replace:'if(false)',mustFail:'canonical rename reuses the existing filing handle and ambiguity refuses'},
 {label:'the first prepared scope mutates the live store before the last validates',find:'next=result.state;',replace:'Object.assign(state,result.state);next=result.state;',mustFail:'later group refusal cannot install an earlier detached success'},
 {label:'same-source duplicate records create repeated receipt events',find:'if(Object.prototype.hasOwnProperty.call(seen,key))',replace:'if(false)',mustFail:'duplicate records coalesce without allocating another identity'},
 {label:'public source text loses its bounded capacity',find:'total>16000||segments.length>=64',replace:'false',mustFail:'source input size segment and public text bounds fail visibly'}
];
cases.forEach(function(c){c.mustFail=prefix+c.mustFail;});
process.exit(sabotage.prove({file:'atlas-knowledge-extract.js',command:['node',['dev/tests-733-map-extract.js']],only:prefix,cases:cases})?1:0);
