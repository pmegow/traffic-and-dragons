function buildGeoBlock(){
  if(!memory.map||!worldState||!worldState.world)return"";
  var w=worldState.world,lines=[],i;
  var wKey=w.location;
  var wNode=memory.map.nodes[wKey];
  var subKey=w.sublocation?wKey+"|"+w.sublocation:null;
  var subNode=subKey?memory.map.nodes[subKey]:null;
  var activeNode=subNode||wNode;
  // Location header
  var locLine="World: "+w.location+(w.sublocation?" | Sub-location: "+w.sublocation:"");
  lines.push(locLine);
  // Canonical descriptions
  if(wNode&&wNode.description)lines.push("Location desc: "+wNode.description);
  if(wNode&&wNode.size)lines.push("Location size: "+wNode.size+(wNode.travelMins?" (~"+wNode.travelMins+"min to cross)":""));
  if(subNode&&subNode.description)lines.push("Sub-location desc: "+subNode.description);
  if(subNode&&subNode.size)lines.push("Sub-location size: "+subNode.size+(subNode.travelMins?" (~"+subNode.travelMins+"min to cross)":""));
  // Items
  if(activeNode&&activeNode.items.length){
    var present=activeNode.items.filter(function(it){return!it.taken;});
    var gone=activeNode.items.filter(function(it){return it.taken;});
    if(present.length)lines.push("Items here: "+present.map(function(it){return it.name;}).join(", "));
    if(gone.length)lines.push("Items previously here (now gone): "+gone.map(function(it){return it.name;}).join(", "));
  }
  // Known sub-locations
  // Only include sub-locations visited in the last 20 turns to keep the prompt lean in long campaigns.
  var subLocs=[],nKeys=Object.keys(memory.map.nodes),cutoff=worldState.turn-20;
  for(i=0;i<nKeys.length;i++){var sn=memory.map.nodes[nKeys[i]];if(sn.parent===w.location&&sn.firstVisit>=cutoff)subLocs.push(nKeys[i].split("|")[1]);}
  if(subLocs.length)lines.push("Known sub-locations: "+subLocs.join(", "));
  // Connections + arrival
  if(memory.map.lastArrivalFrom)lines.push("Arrived from: "+memory.map.lastArrivalFrom);
  var conns=[];
  for(i=0;i<memory.map.edges.length;i++){var e=memory.map.edges[i];if(e.from===w.location)conns.push(e.to);else if(e.to===w.location)conns.push(e.from);}
  if(conns.length)lines.push("Connected to: "+conns.join(", "));
  // NPCs elsewhere
  var npcLocs=[],nNames=Object.keys(memory.npcs);
  for(i=0;i<nNames.length;i++){var nm=memory.npcs[nNames[i]];if(nm.lastSeenAt&&nm.lastSeenAt!==wKey&&nm.lastSeenAt!==subKey)npcLocs.push(nNames[i]+" → "+nm.lastSeenAt);}
  if(npcLocs.length)lines.push("NPCs elsewhere: "+npcLocs.join(", "));
  return"GEOGRAPHY (strict continuity — never contradict):\n"+lines.join("\n")+"\n\n";
}
function getRulesBlock(){var all=DEFAULT_RULES.concat(customRules);return"NARRATIVE RULES (STRICTLY ENFORCED -- check EVERY response before outputting):\n"+all.map(function(r,i){return(i+1)+". "+r;}).join("\n")+"\n\n";}
function saveRules(){try{store.set(RLK,JSON.stringify(customRules));}catch(e){}}
function loadRules(){try{var r=store.get(RLK);if(r)customRules=JSON.parse(r);}catch(e){}}
function buildSysPrompt(){
  var c=worldState.character,w=worldState.world,tone=worldState.tone||{};
  var tb=tone.voice?"TONE -- "+tone.name.toUpperCase()+":\n"+tone.voice+"\n\n":"TONE: "+(tone.name||"Sword and Sorcery")+"\n\n";
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];var npcAka=npc.aliases&&npc.aliases.length?" [aka: "+npc.aliases.join(", ")+"]":"";ns.push(npc.name+npcAka+" ("+npc.status+", "+npc.rel+(npc.pronouns?", "+npc.pronouns:"")+(npc.partyMember?", PARTY MEMBER":"")+")");}nstr=ns.join("; ");}
  var qstr="none";if(worldState.questLog.length){var qs=[];for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].status==="active")qs.push(worldState.questLog[i].title);}if(qs.length)qstr=qs.join(", ");}
  var abilstr="none";if(c.abilities&&c.abilities.length){var as2=[];for(i=0;i<c.abilities.length;i++)as2.push(c.abilities[i].nm);abilstr=as2.join(", ");}
  var spstr="none";if(c.spells&&c.spells.length){var sp2=[];for(i=0;i<c.spells.length;i++){if(!c.spells[i].used)sp2.push(c.spells[i].nm);}if(sp2.length)spstr=sp2.join(", ");}
  var nextXP=c.level<10?XP_LEVELS[c.level]:"max";
  var genderDisplay=c.gender==="F"?"female":c.gender==="NB"?"non-binary":"male";
  var condStr="";if(c.conditions&&c.conditions.length){condStr="Conditions: "+c.conditions.map(function(x){return x.name+(x.duration?" ("+x.duration+")":"");}).join(", ")+"\n";}
  var relStr="";if(c.relationships&&c.relationships.length){relStr="Relationships: "+c.relationships.map(function(x){return x.entity+" ("+x.descriptor+")";}).join(", ")+"\n";}
  var saveStr="";if(c.saveModifiers&&c.saveModifiers.length){saveStr="Save modifiers: "+c.saveModifiers.map(function(x){var v=x.amount>=0?"+"+x.amount:""+x.amount;return v+" vs "+x.type+" ["+x.source+"]";}).join(", ")+"\n";}
  var langStr="";if(c.languages&&c.languages.length){langStr="Languages: "+c.languages.map(function(x){return x.name+(x.broken?" (broken)":"");}).join(", ")+"\n";}
  var skillStr="";if(c.skills){var nzSkills=[],nzKeys=Object.keys(c.skills);for(var nzk=0;nzk<nzKeys.length;nzk++){if(c.skills[nzKeys[nzk]]>0)nzSkills.push(nzKeys[nzk]+": "+SKILL_LEVELS[skillLevel(c.skills[nzKeys[nzk]])]);}if(nzSkills.length)skillStr="Skills (earned): "+nzSkills.join(", ")+"\n";}
  var cb="";if(worldState.combat){var cm=worldState.combat;var cbStats="";if(cm.stats)cbStats=" | STR:"+cm.stats.STR+" DEX:"+cm.stats.DEX+" CON:"+cm.stats.CON+" INT:"+cm.stats.INT+" WIS:"+cm.stats.WIS+" CHA:"+cm.stats.CHA+" CR:"+cm.stats.CR;var cbDmgMod="";if(cm.immune&&cm.immune.length)cbDmgMod+=" | Immune:"+cm.immune.join(",");if(cm.resist&&cm.resist.length)cbDmgMod+=" | Resist:"+cm.resist.join(",");if(cm.vuln&&cm.vuln.length)cbDmgMod+=" | Vuln:"+cm.vuln.join(",");cb="COMBAT ACTIVE:\nEnemy: "+cm.name+" HP:"+cm.hp+"/"+cm.maxHp+" AC:"+cm.ac+" Atk:+"+cm.atk+" Dmg:"+cm.dmg+" Morale:"+cm.morale+" Round:"+cm.round+cbStats+cbDmgMod+"\n\n";}
  var hist=worldState.eventHistory.length?"STORY SO FAR:\n"+worldState.eventHistory.join("\n")+"\n\n":"";
  var memToc=memoryTOC();
  var hotNpcs="";var npcNames=Object.keys(memory.npcs);
  if(npcNames.length&&sessionLog.length){var recent=sessionLog.slice(-6).map(function(m){return m.content;}).join(" ");for(i=0;i<npcNames.length;i++){if(recent.indexOf(npcNames[i])>=0)hotNpcs+=memoryNpcDetail(npcNames[i])+"\n";}}
  var identity="PLAYER IDENTITY (never forget this): "+c.name+", a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" | Level "+c.level+" | "+(c.actualAlignment||c.statedAlignment||"Neutral")+(c.deity?" | Deity: "+c.deity:"")+" | Trait: "+c.trait+" | Flaw: "+c.flaw+"\n\n";
  var adultBlock=adultMode?"ADULT CONTENT ENABLED (player has opted in): Explicit violence, sexual content between adult characters, crude language, and graphic mature themes are fully permitted and encouraged when narratively appropriate. Do not fade to black, do not sanitize descriptions, do not soften mature scenes unless the player explicitly asks. All content must still involve adults only.\n\n":"";
  return identity+getRulesBlock()+adultBlock
    +"You are the Game Master for Traffic and Dragons, a sword and sorcery RPG. Write vivid, atmospheric, second-person prose. Mature violence and adult themes are fully permitted. The world state below is absolute truth -- never contradict it.\n\n"
    +tb
    +"CHARACTER: "+c.name+" ("+genderDisplay+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +"Trait: "+c.trait+" | Flaw: "+c.flaw+" | Motivation: "+c.motivation+(c.deity?" | Deity: "+c.deity:"")+"\n"
    +"Abilities: "+abilstr+"\nSpells available: "+spstr+"\nInventory: "+c.inventory.join(", ")+"\n"
    +condStr+relStr+saveStr+langStr+skillStr
    +"Location: "+w.location+", "+w.region+" | Time: "+w.time+" | Weather: "+w.weather+"\n"
    +"NPCs: "+nstr+" | Quests: "+qstr+"\n\n"
    +(memToc?"MEMORY DIRECTORY:\n"+memToc+"\n\n":"")
  +(function(){var s=getNameSuggestions(10);return s.length?"AVAILABLE NAMES (use these for new NPCs): "+s.join(", ")+"\n\n":""}())
    +(hotNpcs?"ACTIVE NPC DETAILS:\n"+hotNpcs+"\n":"")
    +buildNpcGraph()
    +buildGeoBlock()
    +cb+hist
    +"MECHANICS: DC 10=easy 15=moderate 20=hard. Always show dice with the specific stat or check name: [DICE:Strength check|result|outcome] e.g. [DICE:Constitution saving throw|14|success] or [DICE:Dexterity check|8|failed]\n\n"
    +"STATE TAGS (use in responses, never shown to player):\n"
    +"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N]\n"
    +"[NPC:name|status|relation] [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n"
    +"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten\n"
    +"[LOCATION_SIZE:scale|travelMins] -- size of current location; scale=tiny/small/medium/large/vast; travelMins=estimated minutes to cross on foot (e.g. [LOCATION_SIZE:large|45]); emit once on first visit alongside LOCATION_DESC\n"
    +"[SUBLOCATION:name] -- player enters a named area within current world location (e.g. tavern common room, thieves' guild hall)\n"
    +"[SUBLOCATION_LEAVE] -- player exits the sub-location back to the parent world location\n"
    +"[LOCATION_ITEM:name|placed] -- item left or hidden here (pair with [ITEM_LOST:]); [LOCATION_ITEM:name|taken] -- item removed by NPC/event (player pickup auto-handled by [ITEM_GAINED:])\n"
    +"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] [ENEMY_HP:-X] [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n"
    +"[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N] -- always emit alongside COMBAT_START; use official D&D stats\n"
    +"[COMBAT_IMMUNE:fire,poison] [COMBAT_RESIST:cold,lightning] [COMBAT_VULN:thunder] -- omit entirely if none; comma-separated damage types only\n"
    +"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n"
    +"[SPELL_USED:spellname] (leveled spells only -- cantrips never expend; use exact spell name)\n"
    +"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n"
    +"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n"
    +"[NPC_ALIAS:canonical_name|alias] -- when an NPC is given a new name or title; links alias to canonical; prevents duplicate entries; emit alongside the NPC tag that introduces the alias\n"
    +"[NPC_MERGE:canonical_name|duplicate_name] -- when two NPC entries turn out to be the same person; absorbs events/knowledge from duplicate into canonical and removes duplicate\n"
    +"[NPC_LINK:name1|name2|relationship] -- relationship between two named characters (NPC↔NPC or NPC↔player); emit when establishing or changing how two characters relate (e.g. [NPC_LINK:Zarith|Guard Captain|employer/employee], [NPC_LINK:Borin|player|old debt]); updates existing link if already set\n"
    +"[FACTION:name|desc] -- register or update a faction, guild, order, or organisation (e.g. [FACTION:The Black Hand|criminal thieves guild controlling the docks]); use on first mention\n"
    +"[NPC_FACTION:npcName|factionName|role] -- assign an NPC to a faction with their role (e.g. [NPC_FACTION:Zarith|The Black Hand|enforcer]); auto-registers the faction if unknown\n"
    +"[FACTION_REL:faction1|faction2|relationship] -- relationship between two factions (e.g. [FACTION_REL:The Black Hand|City Watch|bitter enemies], [FACTION_REL:Merchant Guild|City Watch|uneasy allies])\n"
    +"[SKILL_SUCCESS:skill_id] -- on a successful skilled action (exact ids: Jumping, Sprinting, Lifting, Grappling, Climbing, Swimming, Distance Running, Riding, Hold Breath, Endure Pain, Tolerate Alcohol/Drugs, Foraging, Cooking, Survival, Animal Handling, Navigation, Tracking, Arcana, Lore, Investigation, Nature, First Aid, Alchemy, Smithing, Handcraft, Persuasion, Deception, Intimidation, Performance, Trading, Stealth, Sleight of Hand, Lockpicking, Gambling, Perception, Insight)\n"
+"[SKILL_SUCCESS:Tracking] covers both wilderness tracking (following prey or people by physical signs) and urban tailing (shadowing a mark through crowds, alleys, or city streets). Use WIS for reading the environment, INT for anticipating movement patterns.\n"
    +"[CONDITION:name|duration] [CONDITION_REMOVED:name] -- duration is descriptive (e.g. 'until antidote', 'saving throw each hour CON DC 15')\n"
    +"[RELATIONSHIP:entity|descriptor] [RELATIONSHIP_REMOVED:entity] -- entity=NPC or faction; descriptor=Allied/Rival/Wanted/Hunted/Indebted/Marked/Feared/etc.\n"
    +"[SAVE_MOD:source|type|amount] [SAVE_MOD_REMOVED:source] -- type=stat (CON/DEX/etc.) or threat (Poison/Fire/Cold/Lightning/Fear/Charm/Psionic/Holy/Shadow/Disease/Magic/Other); amount=integer\n"
    +"[LANGUAGE:name|fluent] or [LANGUAGE:name|broken] -- when character learns or improves a language\n"
    +"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only\n\n"
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: 3-5 sentences vivid second-person. End EVERY response with *You could [action]; [action]; or [action].* where each action is plain text with no labels or markdown. Always use semicolons to separate the options, never commas. Never show tags in prose. Death is possible.";
}
function cleanTxt(t){
  return t.replace(/\[(HP|GOLD|ITEM_GAINED|ITEM_LOST|LOCATION|NPC|XP|QUEST|DICE|COMBAT_START|COMBAT_END|COMBAT_ROUND|ENEMY_HP|ENEMY_SURRENDERS|ABILITY_GAINED|ALIGNMENT|LORE|DECISION|FUTURE_EVENT_RESOLVED|FUTURE_EVENT|NPC_NOTE|NPC_PRONOUN|SPELL_USED|SKILL_SUCCESS|CONDITION|CONDITION_REMOVED|RELATIONSHIP|RELATIONSHIP_REMOVED|SAVE_MOD|SAVE_MOD_REMOVED|LANGUAGE|STORY_BEAT|PARTY_MEMBER|COMBAT_STATS|COMBAT_IMMUNE|COMBAT_RESIST|COMBAT_VULN|LOCATION_DESC|LOCATION_SIZE|SUBLOCATION|LOCATION_ITEM|NPC_ALIAS|NPC_MERGE|NPC_LINK|FACTION|NPC_FACTION|FACTION_REL):[^\]]+\]/g,"")
    .replace(/\[ENEMY_SURRENDERS\]/g,"").replace(/\[SUBLOCATION_LEAVE\]/g,"").replace(/\n{3,}/g,"\n\n").trim();
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
  var hpTags=text.match(/\[HP:([+-]?\d+)\]/g)||[];var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:([+-]?\d+)\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}
  var goldTags=text.match(/\[GOLD:([+-]?\d+)\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:([+-]?\d+)\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);muts.push(dg>0?"+"+dg+" gp":dg+" gp");}
  var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[];var igi;for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;worldState.character.inventory.push(igm[1]);muts.push("+"+igm[1]);autoTakeLocationItem(igm[1]);}
  var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;var ilName=ilm[1];worldState.character.inventory=worldState.character.inventory.filter(function(x){return x!==ilName;});muts.push("-"+ilName);}
  var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){worldState.world.location=loc[1];worldState.world.sublocation=null;fileLocation(loc[1],"",turn);muts.push("-> "+loc[1]);}
  var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);
  var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}
  var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),turn);muts.push("Sub: "+sloctag[1].trim());}
  if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;muts.push("Left sub-location");}
  var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],turn);muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}
  // NPC_ALIAS — register before NPC tags so aliases resolve in the same turn
  var npcAliasTags=text.match(/\[NPC_ALIAS:([^|]+)\|([^\]]+)\]/g)||[];var alii;for(alii=0;alii<npcAliasTags.length;alii++){var alp=npcAliasTags[alii].match(/\[NPC_ALIAS:([^|]+)\|([^\]]+)\]/);if(!alp)continue;var alCanon=alp[1].trim(),alAlias=alp[2].trim();if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var wsali;for(wsali=0;wsali<worldState.npcs.length;wsali++){if(worldState.npcs[wsali].name===alCanon){if(!worldState.npcs[wsali].aliases)worldState.npcs[wsali].aliases=[];if(worldState.npcs[wsali].aliases.indexOf(alAlias)<0)worldState.npcs[wsali].aliases.push(alAlias);break;}}muts.push("Alias: "+alAlias+" -> "+alCanon);}
  // NPC_MERGE — absorb duplicate into canonical, clean up relationships
  var npcMergeTags=text.match(/\[NPC_MERGE:([^|]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}delete memory.npcs[mgDupe];}worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});if(worldState.character.relationships){var rgj,newRels2=[],seenRel={};for(rgj=0;rgj<worldState.character.relationships.length;rgj++){var rent=worldState.character.relationships[rgj].entity;if(rent===mgDupe)worldState.character.relationships[rgj].entity=mgCanon;var rkey=worldState.character.relationships[rgj].entity;if(!seenRel[rkey]){seenRel[rkey]=true;newRels2.push(worldState.character.relationships[rgj]);}}worldState.character.relationships=newRels2;}muts.push("Merged: "+mgDupe+" -> "+mgCanon);}
  // NPC tags — resolve aliases to canonical before storing
  var npcs=text.match(/\[NPC:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!np)continue;var npName=resolveNpcName(np[1].trim());var found=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===npName){worldState.npcs[nj].status=np[2];worldState.npcs[nj].rel=np[3];found=true;break;}}if(!found){worldState.npcs.push({name:npName,status:np[2],rel:np[3],met:turn,partyMember:false,portrait:null,aliases:[]});fileUsedName(npName);}if(!memory.npcs[npName])memory.npcs[npName]={attitude:np[3],knowledge:[],events:[],aliases:[]};memory.npcs[npName].attitude=np[3];mapNpcLocation(npName);muts.push("NPC: "+npName);}
  var xpTags=text.match(/\[XP:(\d+)\]/g)||[];var xpi;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:(\d+)\]/);if(!xpm)continue;worldState.character.xp+=parseInt(xpm[1]);muts.push("+"+xpm[1]+" XP");checkLevelUp();}
  var quests=text.match(/\[QUEST:([^|]+)\|([^\]]+)\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|]+)\|([^\]]+)\]/);if(!qp)continue;var qf=false,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title===qp[1]){worldState.questLog[qj].status=qp[2];qf=true;break;}}if(!qf)worldState.questLog.push({title:qp[1],status:qp[2],started:turn});}
  var cs2=text.match(/\[COMBAT_START:([^|]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|(\w+)\]/);if(cs2){worldState.combat={name:cs2[1],hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5],morale:cs2[6],round:1};muts.push("Combat: "+cs2[1]);}
  var cstats=text.match(/\[COMBAT_STATS:STR:(\d+)\|DEX:(\d+)\|CON:(\d+)\|INT:(\d+)\|WIS:(\d+)\|CHA:(\d+)\|CR:([0-9.\/]+)\]/);if(cstats&&worldState.combat){worldState.combat.stats={STR:+cstats[1],DEX:+cstats[2],CON:+cstats[3],INT:+cstats[4],WIS:+cstats[5],CHA:+cstats[6],CR:cstats[7]};}
  var cimm=text.match(/\[COMBAT_IMMUNE:([^\]]+)\]/);if(cimm&&worldState.combat){worldState.combat.immune=cimm[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
  var cresist=text.match(/\[COMBAT_RESIST:([^\]]+)\]/);if(cresist&&worldState.combat){worldState.combat.resist=cresist[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
  var cvuln=text.match(/\[COMBAT_VULN:([^\]]+)\]/);if(cvuln&&worldState.combat){worldState.combat.vuln=cvuln[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
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
  var nprons=text.match(/\[NPC_PRONOUN:([^|]+)\|([^\]]+)\]/g)||[];for(var pni=0;pni<nprons.length;pni++){var pnp=nprons[pni].match(/\[NPC_PRONOUN:([^|]+)\|([^\]]+)\]/);if(pnp){var pname=resolveNpcName(pnp[1]),ppron=pnp[2],pfound=false,pnj;for(pnj=0;pnj<worldState.npcs.length;pnj++){if(worldState.npcs[pnj].name===pname){worldState.npcs[pnj].pronouns=ppron;pfound=true;break;}}if(!pfound)worldState.npcs.push({name:pname,status:"unknown",rel:"unknown",pronouns:ppron,met:turn,partyMember:false,portrait:null});if(memory.npcs[pname])memory.npcs[pname].pronouns=ppron;else memory.npcs[pname]={attitude:"unknown",knowledge:[],events:[],pronouns:ppron};muts.push("Pronouns: "+pname+" ("+ppron+")");}}
  // NPC_LINK — relationship between two named entities
  var npcLinks=text.match(/\[NPC_LINK:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nli;for(nli=0;nli<npcLinks.length;nli++){var nlp=npcLinks[nli].match(/\[NPC_LINK:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!nlp)continue;var nlA=resolveNpcName(nlp[1].trim()),nlB=resolveNpcName(nlp[2].trim()),nlRel=nlp[3].trim();npcLinkUpsert(nlA,nlB,nlRel);muts.push("Link: "+nlA+" ↔ "+nlB+" ("+nlRel+")");}
  // FACTION — register or update a faction
  var facTags=text.match(/\[FACTION:([^|]+)\|([^\]]+)\]/g)||[];var fti;for(fti=0;fti<facTags.length;fti++){var ftp=facTags[fti].match(/\[FACTION:([^|]+)\|([^\]]+)\]/);if(!ftp)continue;factionUpsert(ftp[1].trim(),ftp[2].trim());muts.push("Faction: "+ftp[1].trim());}
  // NPC_FACTION — assign NPC to a faction with optional role
  var nfTags=text.match(/\[NPC_FACTION:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nfti;for(nfti=0;nfti<nfTags.length;nfti++){var nfp=nfTags[nfti].match(/\[NPC_FACTION:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!nfp)continue;npcFactionSet(resolveNpcName(nfp[1].trim()),nfp[2].trim(),nfp[3].trim());muts.push(nfp[1].trim()+": "+nfp[2].trim()+" ["+nfp[3].trim()+"]");}
  // FACTION_REL — relationship between two factions
  var frTags=text.match(/\[FACTION_REL:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var frti;for(frti=0;frti<frTags.length;frti++){var frp2=frTags[frti].match(/\[FACTION_REL:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!frp2)continue;factionLinkUpsert(frp2[1].trim(),frp2[2].trim(),frp2[3].trim());muts.push("FactionRel: "+frp2[1].trim()+" ↔ "+frp2[2].trim()+" ("+frp2[3].trim()+")");}
  // Party member flag
  var pmTags=text.match(/\[PARTY_MEMBER:([^|]+)\|([^\]]+)\]/g)||[];var pmi;for(pmi=0;pmi<pmTags.length;pmi++){var pmp=pmTags[pmi].match(/\[PARTY_MEMBER:([^|]+)\|([^\]]+)\]/);if(!pmp)continue;var pmName=resolveNpcName(pmp[1].trim()),pmVal=pmp[2].trim().toLowerCase()==="true",pmFoundIdx=-1,pmk;for(pmk=0;pmk<worldState.npcs.length;pmk++){if(worldState.npcs[pmk].name===pmName){pmFoundIdx=pmk;break;}}if(pmFoundIdx>=0){worldState.npcs[pmFoundIdx].partyMember=pmVal;}else{worldState.npcs.push({name:pmName,status:"unknown",rel:"unknown",met:turn,partyMember:pmVal,portrait:null});fileUsedName(pmName);}if(memory.npcs[pmName])memory.npcs[pmName].partyMember=pmVal;else memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],partyMember:pmVal};muts.push(pmVal?"Party: +"+pmName:"Party: -"+pmName);}
  // Skills
  var skSuccs=text.match(/\[SKILL_SUCCESS:([^\]]+)\]/g)||[];var sski;for(sski=0;sski<skSuccs.length;sski++){var sskp=skSuccs[sski].match(/\[SKILL_SUCCESS:([^\]]+)\]/);if(!sskp)continue;var sskid=sskp[1].trim();if(!worldState.character.skills)worldState.character.skills=initSkills();if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else muts.push(sskid+" +1");}}
  // Conditions
  var condTags=text.match(/\[CONDITION:([^|]+)\|([^\]]+)\]/g)||[];var condi;for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|]+)\|([^\]]+)\]/);if(!condp)continue;if(!worldState.character.conditions)worldState.character.conditions=[];var cnm=condp[1].trim(),cdur=condp[2].trim(),calready=false,condj;for(condj=0;condj<worldState.character.conditions.length;condj++){if(worldState.character.conditions[condj].name===cnm){worldState.character.conditions[condj].duration=cdur;calready=true;break;}}if(!calready){worldState.character.conditions.push({name:cnm,duration:cdur});muts.push("Condition: "+cnm);}}
  var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length;worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name!==crp2[1].trim();});if(worldState.character.conditions.length<cbef)muts.push("Cured: "+crp2[1].trim());}
  // Relationships
  var relTags=text.match(/\[RELATIONSHIP:([^|]+)\|([^\]]+)\]/g)||[];var reli;for(reli=0;reli<relTags.length;reli++){var relp=relTags[reli].match(/\[RELATIONSHIP:([^|]+)\|([^\]]+)\]/);if(!relp)continue;if(!worldState.character.relationships)worldState.character.relationships=[];var rnm=resolveNpcName(relp[1].trim()),rdsc=relp[2].trim(),rfound=false,relj;for(relj=0;relj<worldState.character.relationships.length;relj++){if(worldState.character.relationships[relj].entity===rnm){worldState.character.relationships[relj].descriptor=rdsc;rfound=true;break;}}if(!rfound){worldState.character.relationships.push({entity:rnm,descriptor:rdsc});muts.push("Rel: "+rnm+" ("+rdsc+")");}}
  var relRems=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[];var rri2;for(rri2=0;rri2<relRems.length;rri2++){var rrp2=relRems[rri2].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(!rrp2)continue;if(!worldState.character.relationships)continue;var rrName=resolveNpcName(rrp2[1].trim());worldState.character.relationships=worldState.character.relationships.filter(function(x){return x.entity!==rrName;});muts.push("Rel removed: "+rrName);}
  // Save modifiers
  var saveTags=text.match(/\[SAVE_MOD:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}
  var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source!==smrp2[1].trim();});}
  // Languages
  var langTags=text.match(/\[LANGUAGE:([^|]+)\|([^\]]+)\]/g)||[];var lni2;for(lni2=0;lni2<langTags.length;lni2++){var lnp2=langTags[lni2].match(/\[LANGUAGE:([^|]+)\|([^\]]+)\]/);if(!lnp2)continue;if(!worldState.character.languages)worldState.character.languages=[];var lname=lnp2[1].trim(),lbroken=lnp2[2].trim().toLowerCase()==="broken",lfound=false,lj2;for(lj2=0;lj2<worldState.character.languages.length;lj2++){if(worldState.character.languages[lj2].name===lname){worldState.character.languages[lj2].broken=lbroken;lfound=true;break;}}if(!lfound){worldState.character.languages.push({name:lname,broken:lbroken});muts.push((lbroken?"Broken ":"")+"Language: "+lname);}}
  // Story beats
  var beatTags=text.match(/\[STORY_BEAT:([^\]]+)\]/g)||[];var bti2;for(bti2=0;bti2<beatTags.length;bti2++){var btp2=beatTags[bti2].match(/\[STORY_BEAT:([^\]]+)\]/);if(!btp2)continue;if(!worldState.character.storyBeats)worldState.character.storyBeats=[];worldState.character.storyBeats.push({text:btp2[1],turn:turn});fileDecision(turn,"[Story Beat] "+btp2[1]);}
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
