// Authoring proposals are detached from the draft until the author applies a validated result.
(function(root){
  var named={npcs:'name role pronouns notes abilities secret revealAct armor status relation agenda agendaKind',locations:'name description desc notes region status sizeNote',creatures:'name kind threat notes abilities desc displayName revealAct availableActs environment',customClasses:'name desc hd prime statPriority abilities features skillSeeds gear'};
  var top='name author tone proseAuthor narratorVoice premise startingLocation startingRegion startingTime'.split(' ');
  var shapes={acts:'title goal turningPoint reward parallel dnaHint desc',arcs:'title objective type dnaHint reward desc'};
  var names={npcs:'NPC',locations:'Location',creatures:'Creature',customClasses:'Custom class',acts:'Act',arcs:'Arc',rules:'Rule'};
  function owns(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function text(bp){return JSON.parse(JSON.stringify(bp,function(k,v){return k==='portrait'||k==='review'||k.charAt(0)==='_'?undefined:v;}));}
  function key(s){return String(s||'').trim().toLowerCase();}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function fields(item,list){
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('A proposed item must be an object.');
    Object.keys(item).forEach(function(k){if(list.split(' ').indexOf(k)<0)throw new Error('Unsupported field: '+k+'.');});
  }
  var valueTypes={
    integer:function(v){return typeof v==='number'&&isFinite(v)&&Math.floor(v)===v;},
    boolean:function(v){return typeof v==='boolean';},
    text:function(v){return typeof v==='string';},
    armor:function(v){return typeof v==='string'||typeof v==='number'&&isFinite(v);}
  };
  var fieldTypes={revealAct:'integer',hd:'integer',lvl:'integer',parallel:'boolean',armor:'armor'};
  var listTypes={availableActs:'integer',statPriority:'text',skillSeeds:'text',features:'feature'};
  var sectionLists={customClasses:{abilities:'ability'}};
  var nested={ability:'nm ds',feature:'lvl nm ds'};
  function writeFields(item,old,host,actCount,section){
    Object.keys(item).forEach(function(k){
      var value=item[k],before=old&&old[k],type=listTypes[k]||(sectionLists[section]&&sectionLists[section][k]);
      if(type){
        if(!Array.isArray(value))throw new Error(k+' must be a list.');
        value.forEach(function(v,i){
          if(owns(nested,type)){fields(v,nested[type]);writeFields(v,Array.isArray(before)?before[i]:null,host,actCount);}
          else if(!valueTypes[type](v))throw new Error(k+' has an invalid '+type+' value.');
        });
      }else{
        type=fieldTypes[k]||'text';if(!valueTypes[type](value))throw new Error(k+' must be '+type+'.');
        if(k==='revealAct'&&(value<1||value>actCount))throw new Error('revealAct must name an existing act.');
        if(typeof value==='string'){
          var limit=k==='environment'?80:k==='premise'?host.caps.premise:k==='rule'?host.caps.rule:host.caps.field;
          if(value.length>limit&&value!==before)throw new Error(k+' exceeds its text limit of '+limit+'. Request a shorter revision.');
        }
      }
    });
  }
  function unique(rows,field,section){
    var seen=Object.create(null);(rows||[]).forEach(function(row){var k=key(row&&row[field]);if(!k)throw new Error(section+' needs a '+field+'.');if(seen[k])throw new Error('Duplicate '+section+' identity: '+row[field]+'.');seen[k]=1;});
  }
  function roster(bp,oldName,newName){
    if(!Array.isArray(bp.availableClasses))return;
    var i=bp.availableClasses.map(key).indexOf(key(oldName));
    if(i>=0){if(newName)bp.availableClasses[i]=newName;else bp.availableClasses.splice(i,1);}
    else if(!oldName&&newName)bp.availableClasses.push(newName);
  }
  function prepare(bp,patches,host){
    if(!Array.isArray(patches)||patches.length>40)throw new Error('A proposal may contain at most 40 item edits.');
    var candidate=copy(bp),changes=[],seen=Object.create(null);
    var rosterBefore=copy(bp.availableClasses||null);
    patches.forEach(function(raw){
      fields(raw,'action section name act item');
      var p=copy(raw),sec=p.section,action=p.action,rows,idField,old=null,index=-1,identity;
      if(['add','update','delete'].indexOf(action)<0)throw new Error('Each edit needs an explicit add, update or delete action.');
      if(owns(named,sec)){rows=candidate[sec]||[];idField='name';}
      else if(sec==='acts'){if(action!=='update')throw new Error('Add, remove or reorder acts using the act controls.');rows=candidate.acts||[];idField='title';}
      else if(sec==='arcs'){
        var matches=(candidate.acts||[]).filter(function(a){return key(a.title)===key(p.act);});
        if(matches.length!==1)throw new Error('An arc needs one unambiguous existing act title.');p.act=matches[0].title;rows=matches[0].arcs||[];idField='title';
      }else if(sec==='rules'){rows=candidate.rules||[];}
      else if(top.indexOf(sec)<0)throw new Error('Unsupported section: '+sec+'.');
      if(rows){
        identity=p.name||(p.item&&p.item[idField])||'';
        var matchesAt=[];rows.forEach(function(row,i){if(sec==='rules'?row===p.name:key(row[idField])===key(identity))matchesAt.push(i);});
        if(action==='add'&&sec==='rules'&&p.name)throw new Error('A new rule cannot target an existing rule.');
        if(action==='add'){if(matchesAt.length)throw new Error('Cannot add an already existing '+sec+' item.');}
        else if(matchesAt.length!==1)throw new Error('An update or deletion needs one unique existing '+sec+' target.');
        index=matchesAt.length?matchesAt[0]:-1;old=index>=0?rows[index]:null;
        if(old&&idField)identity=old[idField];
        if(action!=='delete'){
          if(sec==='rules'){if(typeof p.item!=='string'||!p.item.trim())throw new Error('A rule needs text.');writeFields({rule:p.item},{rule:old},host,candidate.acts.length);}
          else{
            fields(p.item,owns(named,sec)?named[sec]:shapes[sec]);
            if(sec==='creatures'&&owns(p.item,'availableActs')&&owns(p.item,'revealAct'))throw new Error('A creature cannot have both availableActs and revealAct.');
            writeFields(p.item,old,host,candidate.acts.length,sec);
            p.item=Object.assign({},old||{},p.item);
            if(sec==='creatures'){
              if(owns(raw.item,'availableActs'))delete p.item.revealAct;
              if(owns(raw.item,'revealAct'))delete p.item.availableActs;
            }
            if(typeof p.item[idField]!=='string'||!p.item[idField].trim())throw new Error(sec+' needs a '+idField+'.');
            if(sec==='acts')p.item.arcs=old.arcs;
          }
        }
      }else{
        if(action!=='update'||typeof p.item!=='string')throw new Error('A blueprint field needs an update with text.');
        old=candidate[sec];identity=sec;var one={};one[sec]=p.item;writeFields(one,candidate,host,candidate.acts.length);
      }
      var target=sec+'|'+key(p.act)+'|'+key(identity||p.item);
      if(seen[target])throw new Error('Duplicate edit target: '+identity+'.');seen[target]=1;
      var before=old===null||old===undefined?null:copy(old),after=null;
      if(sec==='rules'){
        if(action==='add'){candidate.rules.push(p.item);after=p.item;}
        else if(action==='delete')candidate.rules.splice(index,1);
        else{candidate.rules[index]=p.item;after=p.item;}
      }else{
        var merged={section:sec,name:identity,act:p.act,item:p.item};if(action==='delete')merged.delete=true;
        host.merge(candidate,[merged],{});
        after=action==='delete'?null:rows?sec==='arcs'?(candidate.acts.filter(function(a){return key(a.title)===key(p.act);})[0].arcs.filter(function(a){return key(a.title)===key(p.item.title);})[0]):(candidate[sec]||[]).filter(function(a){return key(a[idField])===key(p.item[idField]);})[0]:candidate[sec];
      }
      if(sec==='customClasses')roster(candidate,old&&old.name,action==='delete'?'':p.item.name);
      changes.push({label:(names[sec]||sec)+': '+(identity||p.item)+' ('+action+')',before:before,after:after,top:top.indexOf(sec)>=0?sec:null});
    });
    Object.keys(named).forEach(function(sec){unique(candidate[sec],'name',sec);});
    unique(candidate.acts,'title','acts');(candidate.acts||[]).forEach(function(a){unique(a.arcs,'title','arcs');});
    var error=host.validate(candidate);if(error)throw new Error('Invalid proposal: '+error);
    host.normalize(candidate);
    error=host.validate(candidate);if(error)throw new Error('Invalid proposal: '+error);
    changes.forEach(function(change){if(change.top)change.after=candidate[change.top];delete change.top;});
    if(!same(rosterBefore,candidate.availableClasses||null))changes.push({label:'Available classes',before:rosterBefore,after:candidate.availableClasses});
    return {candidate:candidate,changes:changes};
  }
  function current(source,stamp,host){if(host.current()!==source||host.key(source)!==stamp)throw new Error('The blueprint changed or this assistant was closed. Ask again using the current draft.');}
  var system='You are the AI assistant for a TTRPG blueprint author. Answer questions and design requested content that respects the supplied campaign canon. Advice-only questions return patches: []. When asked to add or change content, propose only those edits; the author reviews and applies them. Never claim edits are already applied. Do not invent external canon; distinguish existing facts from proposed ideas. Return ONLY JSON {"reply":"clear concise answer","patches":[]}. At most 40 item patches. Each patch has action (add/update/delete), section, name (exact existing target for update/delete), item (object, or string for rules/top fields). An add uses a new name in item. Supported named sections and fields: '+JSON.stringify(named)+'. Custom classes: hd is 6/8/10/12; prime is STR/DEX/CON/INT/WIS/CHA; statPriority lists all six once; abilities is [{nm,ds}], at least one; features is [{lvl,nm,ds}] levels 2..20; skillSeeds is [] unless a known engine skill is certain; gear and desc are text. New custom classes are added to an existing restricted playable-class roster. Never duplicate a base class. NPC and creature abilities are optional text for spells, special attacks, resistances and their limits, separate from notes and appearance; they are GM guidance, never a list of class ability objects. Creatures: environment is habitat text; availableActs is exact unique existing 1-based act numbers (omit for unrestricted, [] for none), never combine with legacy revealAct; notes are GM-only, desc is visible appearance, displayName is the public disguise name. Fields for acts: '+shapes.acts+'; update only, never add/delete/reorder acts or embed arcs. Arcs: '+shapes.arcs+'; include act: exact parent title. Rules: item is text, name is the EXACT full old rule to edit/delete. Top-level string sections (update only): '+top.join(', ')+'. No images, metadata, new fields or whole-section replacements. Preserve existing detail; omitted update fields stay unchanged. Keep new narrative text fields within 800 characters, environment within 80, premise within 2500, rules within 1200. Describe ideas as suggestions; only requested changes become patches.';
  async function request(bp,question,host,finding){
    if(typeof question!=='string'||!question.trim()||question.length>4000)throw new Error('Enter a request of 1 to 4,000 characters.');
    var stamp=host.key(bp),opts={noHistory:true,kind:'other',finish:{}},payload=text(bp);
    var response=await host.ask('CURRENT BLUEPRINT:\n'+JSON.stringify(payload)+'\n'+(finding?'REVIEW QUESTION CONTEXT:\n'+JSON.stringify(text(finding))+'\n':'')+(host.previous&&host.previous()?'PREVIOUS EXCHANGE (context only; current blueprint is authoritative):\n'+JSON.stringify(host.previous())+'\n':'')+'AUTHOR REQUEST:\n'+question,system,16000,host.model?host.model():undefined,opts);
    current(bp,stamp,host);
    if(opts.finish&&opts.finish.cut)throw new Error('The model response ended early ('+(opts.finish.reason||'truncated')+'). Request a smaller change and try again.');
    if(typeof response!=='string'||response.length>200000)throw new Error('The assistant response is missing or too large.');
    var parsed=JSON.parse(host.repair(response));
    if(!parsed||typeof parsed.reply!=='string'||parsed.reply.length>12000||!Array.isArray(parsed.patches))throw new Error('The assistant must return a reply (at most 12,000 characters) and an item patch list.');
    var prepared=parsed.patches.length?prepare(bp,parsed.patches,host):{changes:[]};
    return {source:bp,stamp:stamp,reply:parsed.reply,patches:copy(parsed.patches),changes:prepared.changes};
  }
  function apply(proposal,bp,host){
    if(proposal.source!==bp)throw new Error('The blueprint changed. Ask again using the current draft.');
    current(bp,proposal.stamp,host);
    if(!proposal.patches.length)throw new Error('This reply contains advice only.');
    return prepare(bp,proposal.patches,host).candidate;
  }
  var api={request:request,apply:apply,prepare:prepare,text:text};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DesignerAssistant=api;
})(this);
