/* atlas-public-places.js — visited public sheets, independent of private generator recipes.
   IDs survive returns and identity merges. Reads coalesce aliases without rewriting campaign data. */
var ATLAS_PUBLIC_PLACE_CAP=1024;
function atlasPublicPlaceKey(key){return typeof locResolve==="function"?locResolve(key):key;}
function atlasPublicPlaceName(key){return typeof locDisplayLeaf==="function"?locDisplayLeaf(key):String(key).split("|").pop();}
function atlasPublicPlacesProblem(A,store){
  var ids,i,r,id,n,seen=Object.create(null);
  function record(x){return !!x&&typeof x==="object"&&!Array.isArray(x);}
  function text(x){return typeof x==="string"&&x.trim()===x&&x.length>0&&x.length<=500&&!/[\x00-\x1f]/.test(x);}
  if(!record(store)||store.v!==1||Object.keys(store).sort().join()!=="next,places,v")return "unknown or malformed public places record";
  if(!record(store.places)||typeof store.next!=="number"||store.next<1||store.next>ATLAS_PUBLIC_PLACE_CAP||Math.floor(store.next)!==store.next)return "invalid public places index";
  ids=Object.keys(store.places);
  if(!ids.length||ids.length>ATLAS_PUBLIC_PLACE_CAP||!Object.prototype.hasOwnProperty.call(store.places,A.seed))return "invalid public places count or first sheet";
  for(i=0;i<ids.length;i++){
    id=ids[i];r=store.places[id];
    if(id!==A.seed){n=Number(id.slice((A.seed+"/public/").length));if(id!==A.seed+"/public/"+n||n<1||n>=store.next||Math.floor(n)!==n)return "invalid public sheet ID";}
    if(!record(r)||Object.keys(r).sort().join()!=="container,name,turn"||!text(r.container)||!text(r.name)||typeof r.turn!=="number"||!isFinite(r.turn)||r.turn<0||Math.floor(r.turn)!==r.turn)return "invalid public sheet "+id;
    if(Object.prototype.hasOwnProperty.call(seen,r.container))return "duplicate public place container";
    seen[r.container]=true;
  }
  return "";
}
/* audit 2026-11-19, A8: THE one line for the place limit — once a session for the campaign, never a report. Both doors that
   meet the limit say it here: the follow of a new place, and the recovery of a place that was never given a sheet. */
function atlasPublicLimitSay(A,e){if(atlasOnce(A,"place-limit"))atlasSay("warn",e.message);}
function atlasPublicPlacesAdd(A,store,key,turn){
  var resolved=atlasPublicPlaceKey(key),ids=Object.keys(store.places),i,id;
  for(i=0;i<ids.length;i++)if(atlasPublicPlaceKey(store.places[ids[i]].container)===resolved)return ids[i];
  if(ids.length>=ATLAS_PUBLIC_PLACE_CAP){var full=new Error("the public atlas has reached its "+ATLAS_PUBLIC_PLACE_CAP+" place limit; existing sheets are preserved");full.atlasLimit=true;throw full;}/* audit 2026-11-19, A8: a limit, not a fault — the follow says it once and mails nothing */
  id=ids.length?A.seed+"/public/"+(store.next++):A.seed;
  store.places[id]={container:resolved,name:atlasPublicPlaceName(resolved),turn:typeof turn==="number"&&isFinite(turn)&&turn>=0?Math.floor(turn):atlasTurn()};
  return id;
}
/* Positive visits and public receipt containers are evidence; a seeded node or its description is not.
   This also retains passed-through locations when a single narrated turn has several arrivals. */
function atlasPublicPlacesMemoryGuard(){
  if(typeof memoryOwnerMismatch==="function"&&memoryOwnerMismatch(worldState,memory))throw new Error("the map memory belongs to a different campaign");
}
function atlasPublicPlacesRecover(A,store){
  atlasPublicPlacesMemoryGuard();
  var map=memory&&memory.map,nodes=map&&map.nodes,geo=map&&map.geography,keys,i,r,rows=[];
  if(nodes){keys=Object.keys(nodes);for(i=0;i<keys.length;i++){r=nodes[keys[i]];if(r&&typeof r.visits==="number"&&r.visits>0)rows.push({key:keys[i],turn:typeof r.firstVisit==="number"?r.firstVisit:atlasTurn()});}}
  if(geo&&!MapKnowledge.problem(geo)){keys=Object.keys(geo.receipts);for(i=0;i<keys.length;i++){r=geo.receipts[keys[i]];rows.push({key:r.container,turn:r.turn});}}
  rows.sort(function(a,b){return (a.turn-b.turn)||(a.key<b.key?-1:a.key>b.key?1:0);});
  for(i=0;i<rows.length;i++)atlasPublicPlacesAdd(A,store,rows[i].key,rows[i].turn);
  return store;
}
function atlasPublicPlacesRead(A){
  atlasPublicPlacesMemoryGuard();
  var store=A.publicPlaces,why,key;
  if(Object.prototype.hasOwnProperty.call(A,"publicPlaces")){why=atlasPublicPlacesProblem(A,store);if(why)throw new Error(why);return store;}
  key=atlasKnowledgeContext();if(!key)throw new Error("the public atlas has no established current place");
  store={v:1,next:1,places:Object.create(null)};atlasPublicPlacesAdd(A,store,key,atlasTurn());
  atlasPublicPlacesRecover(A,store);why=atlasPublicPlacesProblem(A,store);if(why)throw new Error(why);
  return store;
}
function atlasPublicPlacesList(A){
  var store=atlasPublicPlacesRead(A),ids=Object.keys(store.places),seen=Object.create(null),out=[],i,r,key;
  for(i=0;i<ids.length;i++){
    r=store.places[ids[i]];key=atlasPublicPlaceKey(r.container);
    if(Object.prototype.hasOwnProperty.call(seen,key))continue;seen[key]=true;
    out.push({id:ids[i],container:key,kind:"schematic",name:key===r.container?r.name:atlasPublicPlaceName(key),parent:null,turn:r.turn});
  }
  return out;
}
function atlasPublicPlace(A,id){
  var store=atlasPublicPlacesRead(A),r=Object.prototype.hasOwnProperty.call(store.places,id)?store.places[id]:null,rows,i;
  if(!r)return null;rows=atlasPublicPlacesList(A);
  for(i=0;i<rows.length;i++)if(rows[i].container===atlasPublicPlaceKey(r.container))return rows[i];
  return null;
}
function atlasPublicPlacesFollow(A){
  var store=JSON.parse(JSON.stringify(atlasPublicPlacesRead(A))),id,why;
  var had=Object.keys(store.places).length,isNew;
  id=atlasPublicPlacesAdd(A,store,atlasKnowledgeContext(),atlasTurn());isNew=Object.keys(store.places).length!==had;
  /* audit 2026-11-19, A8 (its review): at the limit, recovering a place that was never given a sheet threw on every follow —
     so the party could not be followed back to a place that HAS a sheet. When the place the party stands in already has
     its sheet, the follow answers with it and installs nothing (the registry is extended whole or not at all, #744); a
     NEW arrival that cannot be completed is still refused whole. */
  try{atlasPublicPlacesRecover(A,store);}catch(e){if(e&&e.atlasLimit&&!isNew){atlasPublicLimitSay(A,e);return id;}throw e;}
  why=atlasPublicPlacesProblem(A,store);if(why)throw new Error(why);
  A.publicPlaces=store;return id;
}
