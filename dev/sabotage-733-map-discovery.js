var sabotage=require('./sabotage.js'),only='FAIL #733 discovery ';
process.exit(sabotage.prove({file:'atlas-discovery.js',command:['node',['dev/tests-733-map-discovery.js']],only:only,cases:[
 {label:'the utility inherits private conversation history',find:'noHistory:true',replace:'noHistory:false',mustFail:only+'a narrated omission is extracted without mutation then committed while stationary'},
 {label:'extraction permits extra transport attempts',find:'noRetry:true',replace:'noRetry:false',mustFail:only+'a narrated omission is extracted without mutation then committed while stationary'},
 {label:'stale context is accepted across the extraction await',find:'function atlasDiscoveryCheck(context){if(!atlasDiscoveryCurrent(context))throw atlasDiscoveryStale();}',replace:'function atlasDiscoveryCheck(context){}',mustFail:only+'a changed campaign during extraction aborts the obsolete turn'},
 {label:'changed narration borrows an extraction for another source',find:'offer.source.raw!==String(raw||"")||',replace:'',mustFail:only+'a source changed before synchronous commit cannot consume the extraction'},
 {label:'a changed pre-commit map is overwritten by an old offer',find:'!atlasDiscoveryCurrent(offer.context)',replace:'false',mustFail:only+'knowledge changed between extraction and commit cannot be overwritten'},
 {label:'failed extraction silently disappears',find:'atlasKnowledgeSay("landmarks could not be checked: "+((e&&e.message)||e)+". The original narration and explicit map declarations are retained.");',replace:'',mustFail:only+'failed extraction preserves original declarations and reports why'}
]})?1:0);
