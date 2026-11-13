/* map-legacy-copy.js — dev-only planner for reviewed historical public evidence.
   It never discovers candidates from private atlas recipes or prose name matching.
   A caller supplies SHA-256 and the shared campaign restamp helpers; no live state is installed. */
var MapLegacyCopy=(function(){
  "use strict";
  function own(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k);}
  function obj(o){return !!o&&typeof o==="object"&&!Array.isArray(o);}
  function text(s,max){return typeof s==="string"&&s.length>0&&s.length<=max&&s.trim()===s;}
  function integer(n){return typeof n==="number"&&isFinite(n)&&n>=0&&Math.floor(n)===n;}
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function shape(o,keys){if(!obj(o))return false;var ks=Object.keys(o),i;if(ks.length!==keys.length)return false;for(i=0;i<keys.length;i++)if(!own(o,keys[i]))return false;return true;}
  function fail(reason){return {ok:false,reason:"legacy map copy: "+reason};}
  function identityDiff(a,b,path,out){
    if(JSON.stringify(a)===JSON.stringify(b))return;
    if(!a||!b||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b)){out.push({path:path,from:a,to:b});return;}
    var keys=Object.keys(a),more=Object.keys(b),i,k;
    for(i=0;i<more.length;i++)if(keys.indexOf(more[i])<0)keys.push(more[i]);
    for(i=0;i<keys.length;i++){k=keys[i];identityDiff(a[k],b[k],path+"."+k,out);}
  }
  function remainingOwner(o,id,path){
    if(!o||typeof o!=="object")return "";var keys=Object.keys(o),i,k,p;
    for(i=0;i<keys.length;i++){k=keys[i];if(k==="campId"&&o[k]===id)return path+"."+k;if((k==="ws"||k==="mem"||k==="snapshot")&&typeof o[k]==="string"&&o[k].indexOf(id)>=0)return path+"."+k;p=remainingOwner(o[k],id,path+"."+k);if(p)return p;}return "";
  }
  function plan(raw,manifest,services){
    try{
      if(typeof raw!=="string"||raw.length>50000000)return fail("a bounded original JSON save is required");
      if(!services||typeof services.hash!=="function")return fail("a SHA-256 source verifier is required");
      if(typeof services.restampId!=="function"||typeof services.restampName!=="function")return fail("shared campaign restamp helpers are required");
      if(typeof MapKnowledge!=="object")return fail("the public knowledge core is unavailable");
      if(!shape(manifest,["version","id","authority","source","copy","sources","facts","withheld","limitations"])||manifest.version!==1||manifest.authority!=="reviewed-public-transcript"||!text(manifest.id,90))return fail("unsupported reviewed manifest");
      if(!shape(manifest.source,["sha256","atlasSHA256","campId","turn"])||!/^[a-f0-9]{64}$/.test(manifest.source.sha256)||!/^[a-f0-9]{64}$/.test(manifest.source.atlasSHA256)||!text(manifest.source.campId,120)||!integer(manifest.source.turn))return fail("invalid source identity");
      if(!shape(manifest.copy,["campId","campName"])||!text(manifest.copy.campId,160)||!text(manifest.copy.campName,240)||manifest.copy.campId===manifest.source.campId)return fail("copy identity must differ from its source");
      if(!Array.isArray(manifest.sources)||!manifest.sources.length||manifest.sources.length>128||!Array.isArray(manifest.facts)||!manifest.facts.length||manifest.facts.length>128||!Array.isArray(manifest.withheld)||!Array.isArray(manifest.limitations))return fail("invalid evidence collection");
      if(manifest.withheld.length>128||manifest.limitations.length>32)return fail("report collection exceeds its bounded capacity");
      for(var wi=0;wi<manifest.withheld.length;wi++)if(!shape(manifest.withheld[wi],["label","reason"])||!text(manifest.withheld[wi].label,240)||!text(manifest.withheld[wi].reason,1800))return fail("invalid report collection entry");
      for(var li=0;li<manifest.limitations.length;li++)if(!text(manifest.limitations[li],1800))return fail("invalid report collection limitation");
      var input=JSON.parse(raw),w=input&&input.worldState,m=input&&input.memory,A=w&&w.atlas,stamp=A&&A.legacyMigration,manifestHash=services.hash(JSON.stringify(manifest)),sourceHash=services.hash(raw),i,j,k,s,row,lookup=Object.create(null),labels=Object.create(null),f,primary,refs,allRefs,quote,event,p,state=MapKnowledge.create(),r,c,report,admitted=[],latest,proof;
      if(!w||!m||!m.map||!obj(m.map.nodes)||!obj(A)||!Array.isArray(w.transcript)||!Array.isArray(input.sessionLog)||!w.world)return fail("save lacks the world, location memory, atlas or public transcript");
      if(stamp){
        if(!obj(A.legacyAtlas)||services.hash(JSON.stringify(A.legacyAtlas))!==manifest.source.atlasSHA256)return fail("original atlas backup is absent or changed");
        if(stamp.sourceCampaignId!==manifest.source.campId||stamp.copyCampaignId!==manifest.copy.campId||stamp.sourceTurn!==manifest.source.turn)return fail("migration proof identity changed");
        if(stamp.version!==1||stamp.sourceSHA256!==manifest.source.sha256||stamp.manifestSHA256!==manifestHash||w.campId!==manifest.copy.campId||m.campId!==w.campId||A.knowledge!==1)return fail("existing migration identity or reviewed manifest differs");
      }else{
        if(sourceHash!==manifest.source.sha256)return fail("original source fingerprint changed; no copy was created");
        if(w.campId!==manifest.source.campId||w.turn!==manifest.source.turn)return fail("source campaign identity or turn changed");
        if(m.campId&&m.campId!==w.campId)return fail("memory owner differs from the source campaign");
        if(A.knowledge||own(m.map,"geography")||own(A,"legacyAtlas"))return fail("existing public geography or backup cannot be overwritten");
        if(services.hash(JSON.stringify(A))!==manifest.source.atlasSHA256)return fail("original atlas backup fingerprint changed");
        if(A.v!==1||w.ver>13||!text(A.seed,160))return fail("unsupported legacy save or atlas version");
      }
      for(i=0;i<manifest.sources.length;i++){
        s=manifest.sources[i];
        if(!shape(s,["id","index","turn","location","text"])||!text(s.id,80)||own(lookup,s.id)||!integer(s.index)||!integer(s.turn)||s.turn>manifest.source.turn||!text(s.location,300)||typeof s.text!=="string"||s.text.length>100000)return fail("invalid or repeated source declaration");
        row=w.transcript[s.index];
        if(!row||row.r!=="gm"||row.db||row.dead||row.rf||row.bk)return fail("source "+s.id+" is not a surviving public GM narration");
        if(row.t!==s.turn||row.l!==s.location||row.x!==s.text)return fail("source "+s.id+" changed its text, turn or location");
        lookup[s.id]=s;
      }
      for(i=0;i<manifest.facts.length;i++){
        f=manifest.facts[i];
        if(!shape(f,["label","container","bearing","mode","source","start","end","attributeSources","rationale","canonicalKey"])||!text(f.container,300)||!own(m.map.nodes,f.container)||!text(f.rationale,1800))return fail("invalid reviewed fact "+i);
        var labelKey=JSON.stringify([f.container,String(f.label).replace(/\s+/g," ").toLowerCase()]);if(own(labels,labelKey))return fail("duplicate reviewed label in "+f.container);labels[labelKey]=1;
        primary=lookup[f.source];if(!primary)return fail("fact "+i+" has an unknown source reference");
        if(primary.location!==f.container)return fail("fact "+i+" primary scope differs from its public source");
        if(!integer(f.start)||!integer(f.end)||f.end<=f.start||f.end>primary.text.length)return fail("fact "+i+" has invalid source quote bounds");
        if(f.canonicalKey!==null&&(!text(f.canonicalKey,300)||!own(m.map.nodes,f.canonicalKey)))return fail("fact "+i+" refers to an absent canonical node");
        if(!shape(f.attributeSources,["label","bearing","mode"]))return fail("fact "+i+" needs reviewed per-attribute evidence");
        allRefs=[];latest=primary.turn;
        for(j=0;j<3;j++){
          k=["label","bearing","mode"][j];refs=f.attributeSources[k];
          if(!Array.isArray(refs)||refs.length>16||(!refs.length&&(k!=="bearing"||f.bearing!=="unknown")))return fail("fact "+i+" "+k+" lacks reviewed evidence");
          if(k==="label"&&refs.indexOf(f.source)<0)return fail("fact "+i+" label omits its primary source evidence");
          for(var ri=0;ri<refs.length;ri++){
            if(!own(lookup,refs[ri]))return fail("fact "+i+" has an unknown source reference");
            if(allRefs.indexOf(refs[ri])<0)allRefs.push(refs[ri]);latest=Math.max(latest,lookup[refs[ri]].turn);
          }
        }
        quote=primary.text.slice(f.start,f.end);event={op:"disclose",id:"new",label:f.label,proposalKind:"",bearing:f.bearing,mode:f.mode,quote:quote};
        p=MapKnowledge.eventProblem(event);if(p)return fail("fact "+i+": "+p);
        r=MapKnowledge.prepare(state,[event],{channel:"gm",commit:"legacy:"+manifest.id+":"+i,turn:latest,container:f.container,text:primary.text});if(!r.ok)return fail(r.reason);state=r.state;
        proof={featureId:"f"+(state.next-1),label:f.label,container:f.container,bearing:f.bearing,mode:f.mode,quote:quote,canonicalKey:f.canonicalKey,rationale:f.rationale,attributeSources:clone(f.attributeSources),sources:allRefs.map(function(id){var src=lookup[id];return {id:id,index:src.index,turn:src.turn,location:src.location};})};admitted.push(proof);
      }
      if(stamp){
        if(JSON.stringify(stamp.admitted)!==JSON.stringify(admitted))return fail("migration proof declarations changed");
        var historical=Object.keys(state.receipts);for(i=0;i<historical.length;i++)if(!m.map.geography||!m.map.geography.receipts||JSON.stringify(m.map.geography.receipts[historical[i]])!==JSON.stringify(state.receipts[historical[i]]))return fail("migration proof receipts changed");
        p=MapKnowledge.problem(m.map.geography);if(p)return fail("migrated knowledge is damaged: "+p);
        return {ok:true,already:true,candidate:clone(input),report:{sourceSHA256:manifest.source.sha256,manifestSHA256:manifestHash,admitted:clone(stamp.admitted),withheld:clone(manifest.withheld),limitations:clone(manifest.limitations),restampedIds:stamp.restampedIds,restampedNames:stamp.restampedNames,identityEdits:clone(stamp.identityEdits)}};
      }
      c=clone(input);var beforeRestamp=clone(c.worldState),restampedIds=services.restampId(c.worldState,w.campId,manifest.copy.campId),restampedNames=services.restampName(c.worldState,w.campName,manifest.copy.campName,manifest.copy.campId),identityEdits=[];
      identityDiff(beforeRestamp,c.worldState,"worldState",identityEdits);
      for(i=0;i<identityEdits.length;i++){var edit=identityEdits[i];if(!(/\.campId$/.test(edit.path)&&edit.from===w.campId&&edit.to===manifest.copy.campId)&&!(/\.camp$/.test(edit.path)&&edit.from===w.campName&&edit.to===manifest.copy.campName))return fail("shared restamp changed a non-ownership field: "+edit.path);}
      identityEdits.push({path:"worldState.campId",from:w.campId,to:manifest.copy.campId},{path:"worldState.campName",from:w.campName,to:manifest.copy.campName},{path:"memory.campId",from:m.campId,to:manifest.copy.campId});
      c.worldState.campId=manifest.copy.campId;c.worldState.campName=manifest.copy.campName;c.memory.campId=manifest.copy.campId;c.worldState.ver=13;
      p=remainingOwner(c,w.campId,"save");if(p)return fail("unhandled source owner stamp at "+p+"; checkpoint or archive needs explicit migration");
      c.worldState.atlas.legacyAtlas=clone(A);c.worldState.atlas.knowledge=1;c.worldState.atlas.v=2;c.worldState.atlas.at=A.seed;c.worldState.atlas.spot=null;c.worldState.atlas.off=null;c.worldState.atlas.ptr=JSON.stringify([w.world.location,w.world.sublocation||null]);
      if(!own(c.worldState.atlas,"publicNotes"))c.worldState.atlas.publicNotes={};
      c.memory.map.geography=clone(state);
      report={sourceSHA256:manifest.source.sha256,manifestSHA256:manifestHash,admitted:admitted,withheld:clone(manifest.withheld),limitations:clone(manifest.limitations),restampedIds:restampedIds,restampedNames:restampedNames,identityEdits:identityEdits};
      c.worldState.atlas.legacyMigration={version:1,sourceSHA256:manifest.source.sha256,manifestSHA256:manifestHash,sourceCampaignId:w.campId,copyCampaignId:manifest.copy.campId,sourceTurn:w.turn,admitted:clone(admitted),restampedIds:restampedIds,restampedNames:restampedNames,identityEdits:clone(identityEdits)};
      return {ok:true,already:false,candidate:c,report:report};
    }catch(e){return fail("planning failed: "+((e&&e.message)||e));}
  }
  return {plan:plan};
})();

