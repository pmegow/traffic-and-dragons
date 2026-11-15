// #744: every mutation runs its own named guard in a scratch clone.
'use strict';
const sabotage=require('./sabotage.js'),only='FAIL #744 public ',command=['node',['dev/tests-744-map-public.js']];let rc=0;
rc|=sabotage.prove({file:'atlas-public-places.js',command,only,cases:[
 {label:'unvisited blueprint nodes become recovered public sheets',find:'typeof r.visits==="number"&&r.visits>0',replace:'true',mustFail:only+'recovery retains current visited and receipted scopes while withholding seeded nodes'},
 {label:'public receipt scopes vanish from recovery',find:'if(geo&&!MapKnowledge.problem(geo)){',replace:'if(false){',mustFail:only+'recovery retains current visited and receipted scopes while withholding seeded nodes'},
 {label:'following travel starts a fresh registry and reassigns the first sheet',find:'var store=JSON.parse(JSON.stringify(atlasPublicPlacesRead(A))),id,why;',replace:'var store={v:1,next:1,places:Object.create(null)},id,why;',mustFail:only+'travel returns to stable sheets and notes without moving the party during selection'},
 {label:'alias repairs leave duplicate public sheet choices',find:'if(Object.prototype.hasOwnProperty.call(seen,key))continue;seen[key]=true;',replace:'seen[key]=true;',mustFail:only+'canonical aliases coalesce sheets without losing either source feature or note'},
 {label:'public place capacity silently exceeds the promised boundary',find:'var ATLAS_PUBLIC_PLACE_CAP=1024;',replace:'var ATLAS_PUBLIC_PLACE_CAP=2048;',mustFail:only+'the 1024 place boundary preserves all sheets and refuses overflow atomically'},
 {label:'damaged stored registries bypass schema validation',find:'if(Object.prototype.hasOwnProperty.call(A,"publicPlaces")){why=atlasPublicPlacesProblem(A,store);if(why)throw new Error(why);return store;}',replace:'if(Object.prototype.hasOwnProperty.call(A,"publicPlaces"))return store;',mustFail:only+'damaged registries fail closed without silently rebuilding from private recipes'},
 {label:'public maps read another campaign memory without checking ownership',find:'if(typeof memoryOwnerMismatch==="function"&&memoryOwnerMismatch(worldState,memory))throw new Error("the map memory belongs to a different campaign");',replace:'',mustFail:only+'foreign campaign memory cannot supply public sheets features or recovered names'},
 {label:'a prepared arrival installs before later recovery can refuse',find:'var store=JSON.parse(JSON.stringify(atlasPublicPlacesRead(A))),id,why;',replace:'var store=JSON.parse(JSON.stringify(atlasPublicPlacesRead(A))),id,why;A.publicPlaces=store;',mustFail:only+'a late recovery overflow cannot install a partially extended public registry'}
]});
rc|=sabotage.prove({file:'atlas-public-landscape.js',command,only,cases:[
 {label:'the current disclosed landscape is omitted',find:'add(title,"here","unknown",null);',replace:'',mustFail:only+'whole place phrases supply scenery without extracting nouns from building names'},
 {label:'a noun inside a building name is treated as landscape',find:'head=words[words.length-1],i;',replace:'head=words[0],i;',/* #765: rows are nouns and the head noun decides; same regression */mustFail:only+'whole place phrases supply scenery without extracting nouns from building names'},
 {label:'reported landscape is drawn as observed physical scenery',find:'if(f.mode==="observed")add(f.label,f.id,f.bearing,f.id);',replace:'add(f.label,f.id,f.bearing,f.id);',mustFail:only+'reported landscapes and unknown-position routes cannot add physical geometry'},
 {label:'an unpositioned route receives physical geometry',find:'if(feature&&bearing==="unknown")return;',replace:'',/* #765 */mustFail:only+'reported landscapes and unknown-position routes cannot add physical geometry'},
 {label:'landscape derivation reorders its evidence in place',find:'features.forEach(function(f)',replace:'features.sort(function(a,b){return a.id<b.id?-1:1;}).forEach(function(f)',mustFail:only+'landscape derivation is deterministic bounded and leaves evidence unchanged'},
 {label:'landscape routes grow without their bound',find:'if(out.routes.length>=32)return;',replace:'',/* #765 */mustFail:only+'landscape derivation is deterministic bounded and leaves evidence unchanged'}
]});
rc|=sabotage.prove({file:'atlas-public.js',command,only,cases:[
 {label:'a selected former sheet borrows the current location discoveries',find:'k=place.container;p=atlasKnowledgeProjection(k);',replace:'k=atlasPublicContext();p=atlasKnowledgeProjection(k);',mustFail:only+'travel returns to stable sheets and notes without moving the party during selection'},
 {label:'the party marker appears on every visited sheet',find:'return place&&place.container===atlasPublicContext()?{',replace:'return place?{',mustFail:only+'travel returns to stable sheets and notes without moving the party during selection'},
 {label:'failed travel claims the party stayed at the previous mapped place',find:'placed=!!place&&place.container===atlasPublicContext();',replace:'placed=!!place;',mustFail:only+'the 1024 place boundary preserves all sheets and refuses overflow atomically'}
]});
rc|=sabotage.prove({file:'atlas.js',command,only,cases:[
 {label:'the old public atlas version has no migration',find:',2:function(A){A.v=3;return A;}',replace:'',mustFail:only+'atlas v2 recovery retains earlier visited sheets current scope and feature notes'},
 {label:'public notes depend on the sheet rather than stable feature identity',find:'atlasNoteBucket()==="publicNotes"?String(id):zoneId+"|"+id',replace:'atlasNoteBucket()==="publicNotes"?zoneId+"|"+id:zoneId+"|"+id',mustFail:only+'canonical aliases coalesce sheets without losing either source feature or note'}
]});
process.exit(rc?1:0);
