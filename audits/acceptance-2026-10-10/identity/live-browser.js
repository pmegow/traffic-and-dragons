/* Test-only browser driver. Install in a fresh signed-out isolated preview; never reads or returns any credential. Load live-fixture.json and pass the parsed object to install. */
window.__identityAcceptanceInstall=function(seed){
  var output=[];window.__identityAcceptance={output:output};
  function ensure(ok,msg){if(!ok)throw new Error(msg);}
  window.__identityAcceptance.prepare=function(mirror,same){
    ensure(!storageAdapter.hasToken(),'Refused: signed-in profile');ensure(!gmViaServer(),'Refused: server GM route');
    worldState=JSON.parse(JSON.stringify(seed.worldState));memory=JSON.parse(JSON.stringify(seed.memory));sessionLog=[];
    var P='Wilhelmina Underbough',Q='Queen Underbough',est=mirror?Q:P,arr=mirror?P:Q;
    memory.npcs[est]={attitude:'composed',knowledge:['identity-acceptance established signet'],events:[],aliases:[],pronouns:'she/her'};
    worldState.npcs.push({name:est,status:'present',rel:'neutral',pronouns:'she/her',met:85,partyMember:false,aliases:[]});sceneRefsEnsure();
    var staged=applyMuts('[NPC_NOTE:'+arr+'|identity-acceptance arrival marker]');ensure(!(staged.errors||[]).length,'Fixture handler errors');ensure(memory.npcs[arr]&&memory.npcs[arr].provisional,'Fixture did not open question');
    var story=same?'Queen Underbough and Wilhelmina Underbough are explicitly ONE AND THE SAME woman. She introduces herself by her given name and her title; there is no daughter or second woman in this scene.':'Queen Underbough and Wilhelmina Underbough are explicitly TWO DIFFERENT women: the queen and her adult daughter. Both women are standing beside each other in the room. Each keeps the name already used; no new name is needed.';
    sessionLog=[{role:'user',content:'Established story fact for this synthetic campaign: '+story},{role:'assistant',content:same?'The woman sets her crown on the table and smiles.':'The two women face each other across the table.'}];
    var notes=buildEngineNotes();ensure(notes.indexOf('NAME COLLISION')>=0,'Actual note registry failed to deliver collision');ensure(notes.indexOf(mirror?'by a given name':'under a title')>=0,'Wrong direction wording');
    var record={mirror:!!mirror,same:!!same,established:est,arrival:arr,story:story,deliveredMessage:notes+'\n\nI ask '+arr+' to confirm who she is, then wait for her reply.',version:APP_VERSION,expectedTag:same?'[NPC_MERGE:'+est+'|'+arr+']':'[MERGE:npc|'+arr+'|'+arr+']'};
    window.__identityAcceptance.pending=record;return record;
  };
  window.__identityAcceptance.run=async function(){
    var record=window.__identityAcceptance.pending;ensure(record,'prepare first');ensure(!storageAdapter.hasToken()&&!gmViaServer(),'Refused: server account route');
    ensure(!!((providerKeys&&providerKeys[activeProvider])||apiKey),'Provider not configured; owner must configure visible preview');record.provider=activeProvider;record.model=providerModels[activeProvider]||PROVIDERS[activeProvider].defaultModel;
    try {record.raw=await callGM(record.deliveredMessage,null,1500,null,{kind:'turn'});worldState.turn++;record.applied=applyMuts(record.raw);ensure(!(record.applied.errors||[]).length,'Handler errors in actual response');
      ensure(record.raw.indexOf(record.expectedTag)>=0,'Model did not emit the exact requested decision tag');var est=record.established,arr=record.arrival;
      if(record.same){ensure(!memory.npcs[arr]&&!!memory.npcs[est],'SAME did not merge');ensure(resolveNpcName(arr)===est,'SAME alias does not resolve');}
      else {ensure(!!memory.npcs[est]&&!!memory.npcs[arr],'ANOTHER lost one identity');ensure(!memory.npcs[arr].provisional,'ANOTHER remains provisional');ensure(resolveNpcName(arr)===arr,'ANOTHER resolves to relative');}
      record.state={keys:Object.keys(memory.npcs),established:memory.npcs[est],arrival:memory.npcs[arr]||null};worldState.turn+=10;record.remainingNote=buildProvisionalNudge();ensure(record.remainingNote==='','Decision note repeats');record.ok=true;
    }catch(e){record.ok=false;record.error=String(e&&e.message||e);}output.push(record);window.__identityAcceptance.pending=null;return record;
  };
  return {ready:true,cases:[{mirror:false,same:true},{mirror:false,same:false},{mirror:true,same:true},{mirror:true,same:false}]};
};
