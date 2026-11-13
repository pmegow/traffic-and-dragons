// #733 source bridge: each mutation must fail its named source regression in a scratch clone.
var sabotage=require('./sabotage.js'),rc=0,command=['node',['dev/tests-733-map-source.js']],only='FAIL #733 source ';
rc|=sabotage.prove({file:'atlas-knowledge-source.js',command:command,only:only,cases:[
 {label:'a stale ordinary source gains new raw authority',find:'if(q.raw!==text)return refuse("the queued ordinary map source changed before rebasing");',replace:'',mustFail:only+'a stale ordinary source is not rebased'},
 {label:'reordered geographic source tokens are accepted',find:'if(source[i].text!==parsed[i].text)return refuse("the geographic token sequence changed during preprocessing");',replace:'',mustFail:only+'changed or reordered geographic tokens refuse rebasing'},
 {label:'a canon-envelope map declaration becomes public',find:'if(open!==null){scopeError="a map disclosure inside a canon envelope is not public authority";break;}',replace:'',mustFail:only+'map declarations inside canon envelopes never become public authority'},
 {label:'original private nesting is ignored',find:'if(depth)return refuse("a nested private map directive is not public authority");',replace:'',mustFail:only+'original private nesting cannot be flattened into public authority'},
 {label:'a prior parser refusal is discarded',find:'if(q.reason)return refuse(q.reason);',replace:'',mustFail:only+'an existing parse refusal survives source rebasing'},
 {label:'tampered queued offsets are silently repaired',find:'if(!item||item.start!==parsed[i].start||item.end!==parsed[i].end||item.directive!==parsed[i].text)return refuse("the queued map source offsets changed before rebasing");',replace:'',mustFail:only+'tampered queued directive offsets refuse'},
 {label:'malformed canon markers stop protecting their scope',find:'if(open!==null||/(?:\\[CANON_TXN_(?:BEGIN|END)(?::|\\])|^[ \\t]*CANON_TXN_(?:BEGIN|END):)/m.test(remainder))return refuse("the canon envelope scope is truncated or malformed");',replace:'',mustFail:only+'malformed and truncated canon scopes refuse without guessing'}
]});
rc|=sabotage.prove({file:'api.js',command:command,only:only,cases:[
 {label:'ordinary W2 offsets reach the original narrated commit',find:'R.mapReveals=atlasKnowledgeRebase(_mapSourceRaw,_w2Plan.ordinary,R.mapReveals);',replace:'R.mapReveals=R.mapReveals;',mustFail:only+'actual quest transaction admits outside map directive at original source position'},
 {label:'the raw source is captured after bare marker restoration',find:'var _mapSourceRaw=text;',replace:'var _mapSourceRaw=tagRestoreBareMarkers(text,true);',mustFail:only+'bare canon markers retain original narrated offsets'}
]});process.exit(rc?1:0);
