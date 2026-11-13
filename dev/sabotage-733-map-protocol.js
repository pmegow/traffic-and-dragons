// Each clause runs the named #733 protocol test and mutates only its scratch clone.
var sabotage=require('./sabotage.js'),rc=0;
var command=['node',['dev/tests-733-map-protocol.js']],only='FAIL #733 protocol ';
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
  {label:'a repeated declaration after a rename loses its original filing scope',find:'if(match)k=match.container;',replace:'',mustFail:only+'exact new repeats after an alias retain the scoped handle beside new landmarks'},
  {label:'an ambiguous canonical label selects a filing container',find:'if(match){out.reason="the public label is ambiguous in this resolved place";break;}match=existing;',replace:'match=existing;',mustFail:only+'canonical ambiguity never chooses the first matching repeated label'},
  {label:'a hidden nested declaration becomes a public discovery',find:'if(depth){out.reason="a nested MAP_REVEAL is not a public narrative directive";break;}',replace:'if(false){out.reason="a nested MAP_REVEAL is not a public narrative directive";break;}',mustFail:only+'private nested directives cannot publish a public discovery'},
  {label:'disclosures use the final location instead of their source position',find:'st=R&&typeof R.placeAt==="function"?R.placeAt(m.index):null;',replace:'st=null;',mustFail:only+'each declaration uses its source position in the location timeline'},
  {label:'malformed declarations no longer refuse the whole group',find:'if(!out.reason&&count!==out.items.length)out.reason="a MAP_REVEAL directive is truncated or malformed";',replace:'',mustFail:only+'malformed and truncated directives refuse as a group'},
  {label:'candidate state is installed before receipt formatting can fail',find:'out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);',replace:'memory.map.geography=MapKnowledge.prepare(s,[q.items[0].event],{channel:"gm",commit:"early",turn:worldState.turn,container:q.items[0].container,text:q.items[0].event.quote}).state;out=atlasKnowledgePublish(raw,items);visible=cleanTxt(out);',mustFail:only+'a formatting failure cannot install discoveries without their public receipt'},
  {label:'the canonical collision guard is removed',find:'problem=atlasKnowledgeCollision(s,groups);if(problem){atlasKnowledgeSay(problem+"; no new map discoveries were filed");return raw;}',replace:'',mustFail:only+'canonical collisions across scoped groups refuse the whole turn'},
  {label:'filing keys stop resolving after a place merge',find:'return MapKnowledge.project(memory&&memory.map&&memory.map.geography,resolve(k),"player",resolve);',replace:'return MapKnowledge.project(memory&&memory.map&&memory.map.geography,resolve(k),"player");',mustFail:only+'place merges preserve the public projection and allow scoped label updates'},
  {label:'a reroll loses the committed readable receipt',find:'if(lines.length)text+=(text?"\\n\\n":"")+"Retained discoveries from this turn:\\n"+lines.join("\\n");',replace:'',mustFail:only+'readable receipt survives save round trip and reroll without new discoveries'},
  {label:'a reroll retains a new undisclosed directive',find:'text=text.replace(/\\[(?:MAP_REVEAL|EXIT)(?::[^\\]]*)?\\]/g,"").replace(/\\[(?:MAP_REVEAL|EXIT)[^\\]]*$/,"");',replace:'',mustFail:only+'readable receipt survives save round trip and reroll without new discoveries'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
  {label:'receipt publication moves to the end of a turn after its arrival',find:'return out+text.slice(cursor);',replace:'return text+"\\n\\n"+items.map(function(item){return item.event.quote;}).join("\\n");',mustFail:only+'accepted receipts publish at their directive position before later movement'},
  {label:'an arbitrary quoted receipt suppresses the public declaration',find:'out+=text.slice(cursor,item.end)+"\\n\\n"+e.quote+"\\n\\n";',replace:'out+=text.slice(cursor,item.end)+(text.indexOf(e.quote)<0?"\\n\\n"+e.quote+"\\n\\n":"");',mustFail:only+'a quoted receipt never suppresses the deliberate public disclosure'},
  {label:'an altered queue supplies fields absent from the original public directive',find:'if(JSON.stringify(typeof atlasKnowledgeDirectiveEvent==="function"?atlasKnowledgeDirectiveEvent(item.directive):atlasKnowledgeFields(fields))!==JSON.stringify(e))throw new Error("the queued map disclosure differs from its public directive");',replace:'',mustFail:only+'a stale or altered queued directive cannot acquire public authority'},
  {label:'a reroll suppresses retained discoveries because their words already occur',find:'if(lines.length)text+=',replace:'if(lines.length&&lines.every(function(line){return text.indexOf(line.split(": ").slice(1).join(": "))<0;}))text+=',mustFail:only+'rerolls retain a scoped discovery block even after a quoted receipt'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:command,only:only,cases:[
  {label:'the parser commits geography without a narrated turn',find:'R.mapReveals=atlasKnowledgeRead(text,R);}},',replace:'R.mapReveals=atlasKnowledgeRead(text,R);atlasKnowledgeCommit(text,R.mapReveals);}},',mustFail:only+'parser and sync alone do not commit disclosures'},
  {label:'the strip registry exposes raw map declarations',find:'"SOUNDSCAPE","MAP_PLACE","MAP_REVEAL"];',replace:'"SOUNDSCAPE","MAP_PLACE"];',mustFail:only+'cleanTxt is not a discovery writer or a public receipt factory'}
]});
rc|=sabotage.prove({file:'game.js',command:command,only:only,cases:[
  {label:'the narrated commit omits disclosures before the camp snapshot',find:'if(!_refusal&&typeof atlasKnowledgeCommit==="function")resp=atlasKnowledgeCommit(resp,_audioMuts&&_audioMuts.mapReveals);',replace:'',mustFail:only+'actual commit publishes three discoveries before the due checkpoint'},
  {label:'a refused GM reply can publish a discovery',find:'if(!_refusal&&typeof atlasKnowledgeCommit==="function")resp=atlasKnowledgeCommit(resp,_audioMuts&&_audioMuts.mapReveals);',replace:'if(typeof atlasKnowledgeCommit==="function")resp=atlasKnowledgeCommit(resp,_audioMuts&&_audioMuts.mapReveals);',mustFail:only+'actual refused commit cannot publish a positive discovery receipt'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
  {label:'a refused reroll replaces the admitted source with noncanon prose',find:'if(typeof detectModelRefusal==="function"&&detectModelRefusal(cleanTxt(raw))){',replace:'if(false){',mustFail:only+'an actual refused reroll preserves the original admitted narration'}
]});
rc|=sabotage.prove({file:'api.js',command:command,only:only,cases:[
  {label:'the player geography projection falls through to private descriptions',find:'if(audience==="player"&&typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive())return atlasKnowledgePlayerBlock();',replace:'',mustFail:only+'Table Talk receives public geography and no blueprint description'}
]});
rc|=sabotage.prove({file:'table-talk.js',command:command,only:only,cases:[
  {label:'Table Talk requests the private GM geography block',find:'var geo=(typeof buildGeoBlock==="function")?buildGeoBlock("player"):"";',replace:'var geo=(typeof buildGeoBlock==="function")?buildGeoBlock():"";',mustFail:only+'Table Talk receives public geography and no blueprint description'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
  {label:'compatibility kind proposals become public narration',find:'label+(direction?',replace:'label+", a "+e.proposalKind+(direction?',mustFail:only+'legacy proposed types remain private and cannot poison repeats or rerolls'},
  {label:'retained discoveries repeat old typed receipt quotes',find:'atlasKnowledgeReceipt(r.events[j])',replace:'r.events[j].quote',mustFail:only+'legacy proposed types remain private and cannot poison repeats or rerolls'},
  {label:'the short neutral disclosure grammar is rejected',find:'if(fields.length!==4&&fields.length!==5){',replace:'if(fields.length!==5){',mustFail:only+'neutral four-field declarations do not assert an inferred kind'}
]});
process.exit(rc?1:0);
