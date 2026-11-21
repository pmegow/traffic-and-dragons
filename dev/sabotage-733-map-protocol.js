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
  {label:'the canonical collision guard is removed',find:'problem=atlasKnowledgeCollision(s,groups,s0);if(problem)return refuse("state",problem,"; these map declarations were not filed");',replace:'',mustFail:only+'canonical collisions across scoped groups refuse the whole turn'},
  {label:'filing keys stop resolving after a place merge',find:'return MapKnowledge.project(memory&&memory.map&&memory.map.geography,resolve(k),"player",resolve);',replace:'return MapKnowledge.project(memory&&memory.map&&memory.map.geography,resolve(k),"player");',mustFail:only+'place merges preserve the public projection and allow scoped label updates'},
  {label:'#775: a reroll keeps the lines that only restate the turn\'s discoveries',find:'return atlasKnowledgeUnlist(text,lines.concat(atlasKnowledgeTurnReceipts(true)));',replace:'return text;',mustFail:only+'a reroll adds no discovery and no line: the committed geography stands through a save round trip'},
  {label:'#775: the reroll note no longer tells the GM what the map holds',find:'(lines.length?lines.join(" "):"none were committed in this turn.");',replace:'"";',mustFail:only+'a reroll adds no discovery and no line: the committed geography stands through a save round trip'},
  {label:'a reroll retains a new undisclosed directive',find:'text=text.replace(/\\[(?:MAP_REVEAL|EXIT)(?::[^\\]]*)?\\]/g,"").replace(/\\[(?:MAP_REVEAL|EXIT)[^\\]]*$/,"");',replace:'',mustFail:only+'a reroll adds no discovery and no line: the committed geography stands through a save round trip'}
]});
rc|=sabotage.prove({file:'atlas-knowledge.js',command:command,only:only,cases:[
  /* #775: the two clauses that stood here guarded WHERE the receipt was printed in the story and that a quotation never suppressed it. Nothing is printed now; what they become: the story is stored as written, and a quotation is never cut. */
  {label:'#775: the engine writes its receipt into the story again',find:'result.text=atlasKnowledgeUnsaid(raw,items);',replace:'result.text=out;',mustFail:only+'a directive before a later arrival is filed where it stood, and the turn is stored as written'},
  {label:'#775: a quotation of the sentence inside other prose is cut out of the reply',find:'q=items[i].event.quote;at=atlasKnowledgeWrittenAt(text,items[i].start,items[i].end,q);',replace:'q=items[i].event.quote;at=text.indexOf(q);',mustFail:only+'a quotation of the sentence inside other prose stays, and the disclosure is filed'},
  {label:'#775: what the map gained is not said',find:'    atlasKnowledgeNews(s0,s);',replace:'',mustFail:only+'a valid directive files its feature at admission and adds no line to the story'},
  {label:'#775: an unchanged repeat is announced again',find:'      if(o&&o.label===f.label&&o.bearing===f.bearing&&o.mode===f.mode)continue;\n',replace:'',mustFail:only+'exact new repeats after an alias retain the scoped handle beside new landmarks'},
  {label:'an altered queue supplies fields absent from the original public directive',find:'if(JSON.stringify(typeof atlasKnowledgeDirectiveEvent==="function"?atlasKnowledgeDirectiveEvent(item.directive):atlasKnowledgeFields(fields))!==JSON.stringify(e))throw new Error("the queued map disclosure differs from its public directive");',replace:'',mustFail:only+'a stale or altered queued directive cannot acquire public authority'},
  {label:'#775: a reroll drops any line that merely CONTAINS a discovery sentence',find:'if(bare&&(restated.indexOf(bare)>=0||',replace:'if(bare&&(restated.some(function(r){return bare.indexOf(r)>=0;})||',mustFail:only+'a reroll keeps a quotation inside its prose and appends no discovery block'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:command,only:only,cases:[
  {label:'the parser commits geography without a narrated turn',find:'R.mapReveals=atlasKnowledgeRead(text,R);}},',replace:'R.mapReveals=atlasKnowledgeRead(text,R);atlasKnowledgeCommit(text,R.mapReveals);}},',mustFail:only+'parser and sync alone do not commit disclosures'},
  {label:'the strip registry exposes raw map declarations',find:'"SOUNDSCAPE","MAP_PLACE","MAP_REVEAL"];',replace:'"SOUNDSCAPE","MAP_PLACE"];',mustFail:only+'cleanTxt is not a discovery writer or a public receipt factory'}
]});
rc|=sabotage.prove({file:'game.js',command:command,only:only,cases:[
  {label:'the narrated commit omits disclosures before the camp snapshot',find:'if(!_refusal&&typeof atlasKnowledgeCommitResult==="function"){',replace:'if(false){',mustFail:only+'actual commit publishes three discoveries before the due checkpoint'},
  {label:'a refused GM reply can publish a discovery',find:'if(!_refusal&&typeof atlasKnowledgeCommitResult==="function"){',replace:'if(typeof atlasKnowledgeCommitResult==="function"){',mustFail:only+'actual refused commit cannot publish a positive discovery receipt'}
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
