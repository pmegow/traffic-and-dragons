var sabotage=require('./sabotage.js'),only='FAIL #733 discovery ',rc=0;
rc|=sabotage.prove({file:'atlas-discovery.js',command:['node',['dev/tests-733-map-discovery.js']],only:only,cases:[
 {label:'#775: what the extraction put on the map is not said in the Console',find:'    if(typeof atlasKnowledgeNews==="function")atlasKnowledgeNews(_was,prepared.state);/* #775: what the map gained is said in the Console */',replace:'',mustFail:only+'a narrated omission is extracted without mutation then committed while stationary'},
 {label:'the utility inherits private conversation history',find:'noHistory:true',replace:'noHistory:false',mustFail:only+'a narrated omission is extracted without mutation then committed while stationary'},
 {label:'extraction permits extra transport attempts',find:'noRetry:true',replace:'noRetry:false',mustFail:only+'a narrated omission is extracted without mutation then committed while stationary'},
 {label:'stale context is accepted across the extraction await',find:'function atlasDiscoveryCheck(context){if(!atlasDiscoveryCurrent(context))throw atlasDiscoveryStale();}',replace:'function atlasDiscoveryCheck(context){}',mustFail:only+'a changed campaign during extraction aborts the obsolete turn'},
 {label:'changed narration borrows an extraction for another source',find:'offer.source.raw!==String(raw||"")||',replace:'',mustFail:only+'a source changed before synchronous commit cannot consume the extraction'},
 {label:'a changed pre-commit map is overwritten by an old offer',find:'!atlasDiscoveryCurrent(offer.context)',replace:'false',mustFail:only+'knowledge changed between extraction and commit cannot be overwritten'},
 {label:'failed extraction silently disappears',find:'atlasKnowledgeSay("landmarks could not be checked: "+((e&&e.message)||e)+". The original narration and explicit map declarations are retained.");',replace:'',mustFail:only+'failed extraction preserves original declarations and reports why'}
]});
rc|=sabotage.prove({file:'game.js',command:['node',['dev/tests-733-map-discovery.js']],only:only,cases:[
 {label:'parsed proposals suppress extraction after the explicit commit refuses them',find:'atlasDiscoveryCommit(_mapExtraction,_mapCommit)',replace:'atlasDiscoveryCommit(_mapExtraction,{accepted:_audioMuts.mapReveals.items,refusal:null})',mustFail:only+'rejected foreign-place declarations cannot suppress valid extracted discoveries'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:['node',['dev/tests-733-map-discovery.js']],only:only,cases:[
 {label:'prepared groups are called accepted before the whole batch is installed',find:'out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);',replace:'result.accepted=JSON.parse(JSON.stringify(items));out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);',mustFail:only+'only atomically installed declarations are returned as accepted'},
 {label:'a publication validation exception is misclassified as a safe state conflict',find:'return refuse("source","the discovery could not be recorded: "+((e&&e.message)||e));',replace:'return refuse("state","the discovery could not be recorded: "+((e&&e.message)||e));',mustFail:only+'unsafe or tampered declaration sources withhold otherwise valid extraction'},
 {label:'successful explicit disclosures lose their precedence at the handoff',find:'result.text=shown;result.accepted=accepted;',replace:'result.text=shown;',mustFail:only+'successful explicit disclosure and repeated rename keep precedence over extraction'}
]});
rc|=sabotage.prove({file:'atlas-discovery.js',command:['node',['dev/tests-733-map-discovery.js']],only:only,cases:[
 {label:'unsafe declaration sources are allowed into extraction fallback',find:'committed&&committed.refusal&&committed.refusal.kind!=="state"',replace:'false',mustFail:only+'unsafe or tampered declaration sources withhold otherwise valid extraction'},
 {label:'safe state conflicts suppress independent exact-quote extraction',find:'committed&&committed.refusal&&committed.refusal.kind!=="state"',replace:'committed&&committed.refusal',mustFail:only+'a rejected bearing change leaves an independent quoted discovery recoverable'}
]});
process.exit(rc?1:0);
