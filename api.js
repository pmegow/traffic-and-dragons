function getRulesBlock(){var all=DEFAULT_RULES.concat(customRules);return"NARRATIVE RULES (STRICTLY ENFORCED -- check EVERY response before outputting):\n"+all.map(function(r,i){return(i+1)+". "+r;}).join("\n")+"\n\n";}
function saveRules(){try{store.set(RLK,JSON.stringify(customRules));}catch(e){}}
function loadRules(){try{var r=store.get(RLK);if(r)customRules=JSON.parse(r);}catch(e){}}
function buildSysPrompt(){
  var c=worldState.character,w=worldState.world,tone=worldState.tone||{};
  var tb=tone.voice?"TONE -- "+tone.name.toUpperCase()+":\n"+tone.voice+"\n\n":"TONE: "+(tone.name||"Sword and Sorcery")+"\n\n";
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];ns.push(npc.name+" ("+npc.status+", "+npc.rel+(npc.pronouns?", "+npc.pronouns:"")+")");}nstr=ns.join("; ");}
  var qstr="none";if(worldState.questLog.length){var qs=[];for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].status==="active")qs.push(worldState.questLog[i].title);}if(qs.length)qstr=qs.join(", ");}
  var abilstr="none";if(c.abilities&&c.abilities.length){var as2=[];for(i=0;i<c.abilities.length;i++)as2.push(c.abilities[i].nm);abilstr=as2.join(", ");}
  var spstr="none";if(c.spells&&c.spells.length){var sp2=[];for(i=0;i<c.spells.length;i++){if(!c.spells[i].used)sp2.push(c.spells[i].nm);}if(sp2.length)spstr=sp2.join(", ");}
  var nextXP=c.level<10?XP_LEVELS[c.level]:"max";
  var cb="";if(worldState.combat){var cm=worldState.combat;cb="COMBAT ACTIVE:\nEnemy: "+cm.name+" HP:"+cm.hp+"/"+cm.maxHp+" AC:"+cm.ac+" Atk:+"+cm.atk+" Dmg:"+cm.dmg+" Morale:"+cm.morale+" Round:"+cm.round+"\n\n";}
  var hist=worldState.eventHistory.length?"STORY SO FAR:\n"+worldState.eventHistory.join("\n")+"\n\n":"";
  var memToc=memoryTOC();
  var hotNpcs="";var npcNames=Object.keys(memory.npcs);
  if(npcNames.length&&sessionLog.length){var recent=sessionLog.slice(-6).map(function(m){return m.content;}).join(" ");for(i=0;i<npcNames.length;i++){if(recent.indexOf(npcNames[i])>=0)hotNpcs+=memoryNpcDetail(npcNames[i])+"\n";}}
  var identity="PLAYER IDENTITY (never forget this): "+c.name+", a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" | Level "+c.level+" | "+(c.actualAlignment||c.statedAlignment||"Neutral")+(c.deity?" | Deity: "+c.deity:"")+" | Trait: "+c.trait+" | Flaw: "+c.flaw+"\n\n";
  var adultBlock=adultMode?"ADULT CONTENT ENABLED (player has opted in): Explicit violence, sexual content between adult characters, crude language, and graphic mature themes are fully permitted and encouraged when narratively appropriate. Do not fade to black, do not sanitize descriptions, do not soften mature scenes unless the player explicitly asks. All content must still involve adults only.\n\n":"";
  return identity+getRulesBlock()+adultBlock
    +"You are the Game Master for Ashen Crown, a sword and sorcery RPG. Write vivid, atmospheric, second-person prose. Mature violence and adult themes are fully permitted. The world state below is absolute truth -- never contradict it.\n\n"
    +tb
    +"CHARACTER: "+c.name+" ("+c.pronouns+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +"Trait: "+c.trait+" | Flaw: "+c.flaw+" | Motivation: "+c.motivation+(c.deity?" | Deity: "+c.deity:"")+"\n"
    +"Abilities: "+abilstr+"\nSpells available: "+spstr+"\nInventory: "+c.inventory.join(", ")+"\n"
    +"Location: "+w.location+", "+w.region+" | Time: "+w.time+" | Weather: "+w.weather+"\n"
    +"NPCs: "+nstr+" | Quests: "+qstr+"\n\n"
    +(memToc?"MEMORY DIRECTORY:\n"+memToc+"\n\n":"")
  +(function(){var s=getNameSuggestions(10);return s.length?"AVAILABLE NAMES (use these for new NPCs): "+s.join(", ")+"\n\n":""}())
    +(hotNpcs?"ACTIVE NPC DETAILS:\n"+hotNpcs+"\n":"")
    +cb+hist
    +"MECHANICS: DC 10=easy 15=moderate 20=hard. Always show dice with the specific stat or check name: [DICE:Strength check|result|outcome] e.g. [DICE:Constitution saving throw|14|success] or [DICE:Dexterity check|8|failed]\n\n"
    +"STATE TAGS (use in responses, never shown to player):\n"
    +"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging, never re-denominate existing balance] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N]\n"
    +"[NPC:name|status|relation] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n"
    +"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] [ENEMY_HP:-X] [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n"
    +"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n"
    +"[SPELL_USED:spellname] (leveled spells only -- cantrips never expend; use exact spell name)\n"
    +"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n"
    +"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n\n"
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: 3-5 sentences vivid second-person. End EVERY response with *You could [action]; [action]; or [action].* where each action is plain text with no labels or markdown. Always use semicolons to separate the options, never commas. Never show tags in prose. Death is possible.";
}
function cleanTxt(t){
  return t.replace(/\[(HP|GOLD|ITEM_GAINED|ITEM_LOST|LOCATION|NPC|XP|QUEST|DICE|COMBAT_START|COMBAT_END|COMBAT_ROUND|ENEMY_HP|ENEMY_SURRENDERS|ABILITY_GAINED|ALIGNMENT|LORE|DECISION|FUTURE_EVENT_RESOLVED|FUTURE_EVENT|NPC_NOTE|NPC_PRONOUN|SPELL_USED):[^\]]+\]/g,"")
    .replace(/\[ENEMY_SURRENDERS\]/g,"").replace(/\n{3,}/g,"\n\n").trim();
}
function diceTxt(t){var m=t.match(/\[DICE:([^\]]+)\]/);if(!m)return"";var p=m[1].split("|");var lbl=p[0]?'<span style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);margin-right:8px;">'+p[0]+'</span>':'';return'<div class="dice-block">'+lbl+'d20: <strong>'+(p[1]||"?")+'</strong>'+(p[2]?" -- "+p[2]:"")+'</div>';}
function parseActions(clean){
  var btns="",match=clean.match(/\*You could (.+?)\*\.?\s*$/i);
  if(!match)return{clean:clean,btns:""};
  var hasSemi=match[1].indexOf(";")>=0;
  var raw=hasSemi?match[1].split(/;\s*(?:or\s+)?/):match[1].split(/,\s*or\s+|\s+or\s+/),acts=[],i;
  for(i=0;i<raw.length;i++){var a=raw[i].trim().replace(/^or\s+/i,"").replace(/[.*]$/,"").replace(/\*\*?/g,"").replace(/^\[?[A-C]\]?\s*/,"").trim();if(a.length>2)acts.push(a);}
  if(acts.length){btns='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';for(i=0;i<acts.length;i++){btns+='<button class="qa" onclick="sendSuggestedAction(this)" data-action="'+acts[i].replace(/"/g,"&quot;")+'">'+acts[i]+'</button>';}btns+='</div>';}
  return{clean:clean.replace(/\*You could .+?\*\.?\s*$/i,"").trim(),btns:btns};
}
function applyMuts(text){
  var muts=[],turn=worldState.turn;
  var hp=text.match(/\[HP:([+-]?\d+)\]/);if(hp){var dv=parseInt(hp[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}
  var gold=text.match(/\[GOLD:([+-]?\d+)\]/);if(gold){var dg=parseInt(gold[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);muts.push(dg>0?"+"+dg+" gp":dg+" gp");}
  var ig=text.match(/\[ITEM_GAINED:([^\]]+)\]/);if(ig){worldState.character.inventory.push(ig[1]);muts.push("+"+ig[1]);}
  var il=text.match(/\[ITEM_LOST:([^\]]+)\]/);if(il){worldState.character.inventory=worldState.character.inventory.filter(function(x){return x!==il[1];});muts.push("-"+il[1]);}
  var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){worldState.world.location=loc[1];fileLocation(loc[1],"",turn);muts.push("-> "+loc[1]);}
  var npcs=text.match(/\[NPC:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!np)continue;var found=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===np[1]){worldState.npcs[nj].status=np[2];worldState.npcs[nj].rel=np[3];found=true;break;}}if(!found){worldState.npcs.push({name:np[1],status:np[2],rel:np[3],met:turn});fileUsedName(np[1]);}if(!memory.npcs[np[1]])memory.npcs[np[1]]={attitude:np[3],knowledge:[],events:[]};memory.npcs[np[1]].attitude=np[3];muts.push("NPC: "+np[1]);}
  var xp=text.match(/\[XP:(\d+)\]/);if(xp){worldState.character.xp+=parseInt(xp[1]);muts.push("+"+xp[1]+" XP");checkLevelUp();}
  var quests=text.match(/\[QUEST:([^|]+)\|([^\]]+)\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|]+)\|([^\]]+)\]/);if(!qp)continue;var qf=false,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title===qp[1]){worldState.questLog[qj].status=qp[2];qf=true;break;}}if(!qf)worldState.questLog.push({title:qp[1],status:qp[2],started:turn});}
  var cs2=text.match(/\[COMBAT_START:([^|]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|(\w+)\]/);if(cs2){worldState.combat={name:cs2[1],hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5],morale:cs2[6],round:1};muts.push("Combat: "+cs2[1]);}
  var ehp=text.match(/\[ENEMY_HP:([+-]?\d+)\]/);if(ehp&&worldState.combat){worldState.combat.hp=Math.max(0,worldState.combat.hp+parseInt(ehp[1]));}
  var cr=text.match(/\[COMBAT_ROUND:(\d+)\]/);if(cr&&worldState.combat)worldState.combat.round=parseInt(cr[1]);
  var ce=text.match(/\[COMBAT_END:(\w+)\]/);if(ce){worldState.combat=null;muts.push("Combat: "+ce[1]);}
  var abs=text.match(/\[ABILITY_GAINED:([^|]+)\|([^\]]+)\]/g)||[];var abi;for(abi=0;abi<abs.length;abi++){var abp=abs[abi].match(/\[ABILITY_GAINED:([^|]+)\|([^\]]+)\]/);if(!abp)continue;if(!worldState.character.abilities)worldState.character.abilities=[];var already=false,abj;for(abj=0;abj<worldState.character.abilities.length;abj++){if(worldState.character.abilities[abj].nm===abp[1]){already=true;break;}}if(!already){worldState.character.abilities.push({nm:abp[1],ds:abp[2],gained:turn});muts.push("Ability: "+abp[1]);}}
  var alms=text.match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/i);if(ap){if(!worldState.character.alignLaw)worldState.character.alignLaw=0;if(!worldState.character.alignGood)worldState.character.alignGood=0;if(ap[1].toLowerCase()==="law")worldState.character.alignLaw=Math.max(-3,Math.min(3,worldState.character.alignLaw+parseInt(ap[2])));else worldState.character.alignGood=Math.max(-3,Math.min(3,worldState.character.alignGood+parseInt(ap[2])));var newAl=alignLabel(worldState.character.alignLaw,worldState.character.alignGood);if(newAl!==worldState.character.actualAlignment){muts.push("Align: "+newAl);worldState.character.actualAlignment=newAl;}}}
  var spellUsed=text.match(/\[SPELL_USED:([^\]]+)\]/g)||[];var sui;for(sui=0;sui<spellUsed.length;sui++){var sup=spellUsed[sui].match(/\[SPELL_USED:([^\]]+)\]/);if(sup&&worldState.character.spells){var spNm=sup[1].toLowerCase().trim(),spj;for(spj=0;spj<worldState.character.spells.length;spj++){var sp=worldState.character.spells[spj];if(sp.lvl===0)continue;// cantrips never expend
var spBase=sp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();if(spBase===spNm||sp.nm.toLowerCase()===spNm){sp.used=true;muts.push("Spell used: "+sp.nm);break;}}}}
  var lores=text.match(/\[LORE:([^\]]+)\]/g)||[];for(var li=0;li<lores.length;li++){var lp=lores[li].match(/\[LORE:([^\]]+)\]/);if(lp)fileLore(lp[1]);}
  var decs=text.match(/\[DECISION:([^\]]+)\]/g)||[];for(var di=0;di<decs.length;di++){var dp=decs[di].match(/\[DECISION:([^\]]+)\]/);if(dp)fileDecision(turn,dp[1]);}
  var fes=text.match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/g)||[];for(var fi=0;fi<fes.length;fi++){var fp=fes[fi].match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/);if(fp)fileFutureEvent(fp[2],"",fp[1],turn);}
  var fres=text.match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/g)||[];var fri;for(fri=0;fri<fres.length;fri++){var frp=fres[fri].match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/);if(frp)resolveFutureEvent(frp[1]);}
  var nns=text.match(/\[NPC_NOTE:([^|]+)\|([^\]]+)\]/g)||[];for(var nni=0;nni<nns.length;nni++){var nnp=nns[nni].match(/\[NPC_NOTE:([^|]+)\|([^\]]+)\]/);if(nnp)fileNpcEvent(nnp[1],nnp[2],turn);}
  var nprons=text.match(/\[NPC_PRONOUN:([^|]+)\|([^\]]+)\]/g)||[];for(var pni=0;pni<nprons.length;pni++){var pnp=nprons[pni].match(/\[NPC_PRONOUN:([^|]+)\|([^\]]+)\]/);if(pnp){var pname=pnp[1],ppron=pnp[2],pfound=false,pnj;for(pnj=0;pnj<worldState.npcs.length;pnj++){if(worldState.npcs[pnj].name===pname){worldState.npcs[pnj].pronouns=ppron;pfound=true;break;}}if(!pfound)worldState.npcs.push({name:pname,status:"unknown",rel:"unknown",pronouns:ppron,met:turn});if(memory.npcs[pname])memory.npcs[pname].pronouns=ppron;else memory.npcs[pname]={attitude:"unknown",knowledge:[],events:[],pronouns:ppron};muts.push("Pronouns: "+pname+" ("+ppron+")");}}
  if(muts.length)addMsg("system",muts.join(" | "));
  syncUI();saveAll();
}
async function callGM(msg,sysOverride,maxTok){
  var msgs=sessionLog.concat([{role:"user",content:msg}]);
  var body={model:MDL,max_tokens:maxTok||1000,system:sysOverride||buildSysPrompt(),messages:msgs};
  var res;try{res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify(body)});}catch(e){throw new Error("Network: "+e.message);}
  var raw;try{raw=await res.text();}catch(e){throw new Error("Read error");}
  var data;try{data=JSON.parse(raw);}catch(e){throw new Error("HTTP "+res.status+": "+raw.slice(0,200));}
  if(!res.ok)throw new Error((data.error&&data.error.message)||"HTTP "+res.status);
  if(!data.content||!data.content[0]||!data.content[0].text)throw new Error("Empty response");
  return data.content[0].text;
}
