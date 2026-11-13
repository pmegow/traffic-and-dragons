/* atlas-knowledge-migrate.js — explicit writer-side upgrade of public geography.
   Old typed statements remain in the detached backup and private receipt history. */
function atlasKnowledgeMigrate(){
  if(!atlasKnowledgeActive())return {ok:true,changed:false};
  try{
    var A=worldState.atlas,s=memory&&memory.map&&memory.map.geography,r,backupPresent=Object.prototype.hasOwnProperty.call(A,"legacyKnowledge");
    if(typeof memoryOwnerMismatch==="function"&&memoryOwnerMismatch(worldState,memory))return {ok:false,changed:false,reason:"the map memory belongs to a different campaign"};
    r=MapKnowledge.upgrade(s);
    if(!r.ok)return {ok:false,changed:false,reason:r.reason};
    if(r.upgraded&&backupPresent&&JSON.stringify(A.legacyKnowledge)!==JSON.stringify(r.backup))return {ok:false,changed:false,reason:"the existing map knowledge backup differs; migration was withheld"};
    var changed=r.upgraded||typeof worldState.ver!=="number"||worldState.ver<13;
    if(r.upgraded){
      if(!backupPresent)A.legacyKnowledge=r.backup;
      memory.map.geography=r.state;
    }
    if(typeof worldState.ver!=="number"||worldState.ver<13)worldState.ver=13;
    return {ok:true,changed:changed};
  }catch(e){return {ok:false,changed:false,reason:"map knowledge migration failed: "+((e&&e.message)||e)};}
}

/* A later summary or UI save must obey the same backup ordering as the initial load. */
function atlasKnowledgeCanSaveMemory(){
  if(!atlasKnowledgeActive())return true;
  var g=memory&&memory.map&&memory.map.geography;
  if(!g||g.v!==2)return true;
  if(saveCore())return true;
  atlasKnowledgeSay("the map version and backup could not be saved; public map memory was not written");
  return false;
}
