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
// Move a quest out of the live log into the long-term archive (memory.quests).
function archiveQuest(title,status){
  if(!worldState||!worldState.questLog)return;
  var i;for(i=0;i<worldState.questLog.length;i++){
    if(worldState.questLog[i].title.toLowerCase()===title.toLowerCase()){
      var q=worldState.questLog[i];
      if(!memory.quests)memory.quests={};
      memory.quests[q.title]={title:q.title,desc:q.desc||"",objectives:q.objectives||[],status:status,turn:(worldState.turn||0)};
      worldState.questLog.splice(i,1);
      return;
    }
  }
}
// Authoritative active+offered quest block re-injected every turn — the anti-drift anchor.
function buildQuestBlock(){
  if(!worldState||!worldState.questLog||!worldState.questLog.length)return "QUESTS: none active.\n\n";
  var active=[],offered=[],i;
  for(i=0;i<worldState.questLog.length;i++){var q=worldState.questLog[i];if(q.status==="active")active.push(q);else if(q.status==="offered")offered.push(q);}
  var out="";
  if(active.length){out+="ACTIVE QUESTS (authoritative — steer toward these; advance objectives via [QUEST_STEP:title|objective|done]):\n";for(i=0;i<active.length;i++){var aq=active[i];out+="• "+aq.title+(aq.desc?" — "+aq.desc:"")+"\n";if(aq.objectives&&aq.objectives.length){var oj;for(oj=0;oj<aq.objectives.length;oj++)out+="    ["+(aq.objectives[oj].done?"x":" ")+"] "+aq.objectives[oj].text+"\n";}}}
  if(offered.length){out+="OFFERED QUESTS (awaiting player acceptance — do NOT treat as active or advance objectives):\n";for(i=0;i<offered.length;i++){out+="• "+offered[i].title+(offered[i].desc?" — "+offered[i].desc:"")+"\n";}}
  if(!out)out="QUESTS: none active.\n";
  return out+"\n";
}
function buildSysPrompt(){
  var c=worldState.character,w=worldState.world,tone=worldState.tone||{};
  var tb=tone.voice?"TONE -- "+tone.name.toUpperCase()+":\n"+tone.voice+"\n\n":"TONE: "+(tone.name||"Sword and Sorcery")+"\n\n";
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];var npcAka=npc.aliases&&npc.aliases.length?" [aka: "+npc.aliases.join(", ")+"]":"";ns.push(npc.name+npcAka+" ("+npc.status+", "+npc.rel+(npc.pronouns?", "+npc.pronouns:"")+(npc.partyMember?", PARTY MEMBER":"")+")");}nstr=ns.join("; ");}
  var questBlock=buildQuestBlock();
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
  var legacyBlock="";
  if(worldState.pendingLegacy){var _lc=worldState.pendingLegacy;legacyBlock="LEGACY CHARACTER — INTRODUCE THIS SESSION:\nA figure from another story walks this world: "+_lc.name+", a "+(_lc.ancestry?_lc.ancestry+" ":"")+_lc.cls+" (Level "+_lc.level+")."+(_lc.backstory?" History: "+_lc.backstory:"")+(_lc.trait?" Known trait: "+_lc.trait+".":"")+"\nIntroduce them organically as a background NPC within the next 1-2 turns — do not force them into the scene unnaturally. They have no memory of a prior life. Register them with [NPC:"+_lc.name+"|alive|neutral].\n\n";}
  var hotNpcs="";var npcNames=Object.keys(memory.npcs);
  if(npcNames.length&&sessionLog.length){var recent=sessionLog.slice(-6).map(function(m){return m.content;}).join(" ");for(i=0;i<npcNames.length;i++){if(recent.indexOf(npcNames[i])>=0)hotNpcs+=memoryNpcDetail(npcNames[i])+"\n";}}
  var identity="PLAYER IDENTITY (never forget this): "+c.name+", a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" | Level "+c.level+" | "+(c.actualAlignment||c.statedAlignment||"Neutral")+(c.deity?" | Deity: "+c.deity:"")+" | Trait: "+c.trait+" | Flaw: "+c.flaw+"\n\n";
  var adultBlock=adultMode?"ADULT CONTENT ENABLED (player has opted in): Explicit violence, sexual content between adult characters, crude language, and graphic mature themes are fully permitted and encouraged when narratively appropriate. Do not fade to black, do not sanitize descriptions, do not soften mature scenes unless the player explicitly asks. All content must still involve adults only.\n\n":"";
  // Transient control-switch reinforcement — overrides the sessionLog momentum where the
  // OLD protagonist was "you". Set on swap, auto-cleared in sendAction after ~2 turns.
  var switchBlock="";
  if(worldState.recentSwitch){var rs=worldState.recentSwitch;switchBlock="*** CONTROL RECENTLY SWITCHED — READ CAREFULLY ***\nThe player now plays "+rs.to+". Second-person narration ('you'/'your') refers to "+rs.to+" and ONLY "+rs.to+". "+rs.from+" is now a non-player companion in the party — describe "+rs.from+" in the third person by name, never as 'you'. The conversation history above was written while "+rs.from+" was the player character; do NOT let that mislead you into addressing "+rs.from+" as the protagonist. The protagonist is now "+rs.to+".\n\n";}
  return identity+switchBlock+getRulesBlock()+adultBlock
    +"You are the Game Master for Traffic and Dragons, a sword and sorcery RPG. Write vivid, economical, second-person prose. Mature violence and adult themes are fully permitted. The world state below is absolute truth -- never contradict it.\n\n"
    +tb
    +"CHARACTER: "+c.name+" ("+genderDisplay+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +"Trait: "+c.trait+" | Flaw: "+c.flaw+" | Motivation: "+c.motivation+(c.deity?" | Deity: "+c.deity:"")+"\n"
    +"Abilities: "+abilstr+"\nSpells available: "+spstr+"\nInventory: "+c.inventory.join(", ")+"\n"
    +condStr+relStr+saveStr+langStr+skillStr
    +"Location: "+w.location+", "+w.region+" | Time: "+w.time+" | Weather: "+w.weather+"\n"
    +"NPCs: "+nstr+"\n\n"+questBlock
    +(memToc?"MEMORY DIRECTORY:\n"+memToc+"\n\n":"")
  +(function(){var s=getNameSuggestions(10);return s.length?"AVAILABLE NAMES (use these for new NPCs): "+s.join(", ")+"\n\n":""}())
    +(hotNpcs?"ACTIVE NPC DETAILS:\n"+hotNpcs+"\n":"")
    +legacyBlock
    +buildNpcGraph()
    +buildGeoBlock()
    +cb+hist
    +"MECHANICS: DC 10=easy 15=moderate 20=hard. Always show dice with the specific stat or check name: [DICE:Strength check|result|outcome] e.g. [DICE:Constitution saving throw|14|success] or [DICE:Dexterity check|8|failed]\n\n"
    +"STATE TAGS (use in responses, never shown to player):\n"
    +"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N]\n"
    +"[NPC:name|status|relation] -- status=current mood/condition, relation=how they relate to the player (ally/enemy/acquaintance/rival/etc.); NEVER put pronouns in these fields -- pronouns go ONLY in [NPC_PRONOUN:]. [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n"
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
    +"[NPC_FORGET:name|person or event] -- erase one specific memory from an NPC (emit when the Oubliate spell is cast and the WIS save fails); the engine scrubs that fact from what the NPC knows so it cannot resurface\n"
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
    +"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only\n"
    +"COMPANION SHEET TAGS — use these (not the player tags) when the event affects a named party member, not the player:\n"
    +"[COMPANION_HP:Name|+/-N] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item] [COMPANION_XP:Name|N]\n"
    +"[COMPANION_CONDITION:Name|condName|duration] [COMPANION_CONDITION_REMOVED:Name|condName]\n"
    +"[COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_RELATIONSHIP_REMOVED:Name|entity]\n"
    +"[COMPANION_ABILITY:Name|abilityName|desc] [COMPANION_ALIGNMENT:Name|law+1]\n"
    +"Use the companion's exact name as it appears in the party list. Apply the same upkeep rules as for the player.\n\n"
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: HARD LIMIT — prose must be 2-3 sentences maximum, never more. Then the suggestion line. No exceptions, no matter how dramatic the moment. End EVERY response with *You could [action]; [action]; or [action].* where each action is plain text with no labels or markdown. Always use semicolons to separate the options, never commas. Never show tags in prose. Death is possible.";
}
function cleanTxt(t){
  return t.replace(/\[(HP|GOLD|ITEM_GAINED|ITEM_LOST|LOCATION|NPC|XP|QUEST_STEP|QUEST|DICE|COMBAT_START|COMBAT_END|COMBAT_ROUND|ENEMY_HP|ENEMY_SURRENDERS|ABILITY_GAINED|ALIGNMENT|LORE|DECISION|FUTURE_EVENT_RESOLVED|FUTURE_EVENT|NPC_NOTE|NPC_FORGET|NPC_PRONOUN|SPELL_USED|SKILL_SUCCESS|CONDITION|CONDITION_REMOVED|RELATIONSHIP|RELATIONSHIP_REMOVED|SAVE_MOD|SAVE_MOD_REMOVED|LANGUAGE|STORY_BEAT|PARTY_MEMBER|COMBAT_STATS|COMBAT_IMMUNE|COMBAT_RESIST|COMBAT_VULN|LOCATION_DESC|LOCATION_SIZE|SUBLOCATION|LOCATION_ITEM|NPC_ALIAS|NPC_MERGE|NPC_LINK|FACTION|NPC_FACTION|FACTION_REL|COMPANION_HP|COMPANION_ITEM_GAINED|COMPANION_ITEM_LOST|COMPANION_XP|COMPANION_CONDITION|COMPANION_CONDITION_REMOVED|COMPANION_RELATIONSHIP|COMPANION_RELATIONSHIP_REMOVED|COMPANION_ABILITY|COMPANION_ALIGNMENT):[^\]]+\]/g,"")
    .replace(/\[ENEMY_SURRENDERS\]/g,"").replace(/\[SUBLOCATION_LEAVE\]/g,"").replace(/\n{3,}/g,"\n\n").trim();
}
function diceTxt(t){var m=t.match(/\[DICE:([^\]]+)\]/);if(!m)return"";var p=m[1].split("|");var lbl=p[0]?'<span style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);margin-right:8px;">'+p[0]+'</span>':'';return'<div class="dice-block">'+lbl+'d20: <strong>'+(p[1]||"?")+'</strong>'+(p[2]?" -- "+p[2]:"")+'</div>';}
function parseActions(clean){
  var btns="",match=clean.match(/\*You could (.+?)\*\.?\s*$/i);
  // Fallback: GM drifted from the canonical phrasing ("You might...", "Perhaps...") —
  // accept any trailing italic line that contains semicolons rather than rendering plain text.
  if(!match)match=clean.match(/\*([^*\n]+;[^*\n]+)\*\.?\s*$/);
  // Fallback 2: model dropped the *asterisks* entirely (gpt-4o does this) — accept a
  // bare trailing "You could ...; ...; or ..." line. Anchored to end + requires a
  // semicolon, so it won't grab a mid-prose "you could". Never trust the model to emit markdown.
  if(!match)match=clean.match(/You could ([^\n]*;[^\n]*?)\.?\s*$/i);
  if(!match)return{clean:clean,btns:""};
  var hasSemi=match[1].indexOf(";")>=0;
  var raw=hasSemi?match[1].split(/;\s*(?:or\s+)?/):match[1].split(/,\s*or\s+|\s+or\s+/),acts=[],i;
  for(i=0;i<raw.length;i++){var a=raw[i].trim().replace(/^or\s+/i,"").replace(/^you\s+(?:could|might|can|may)\s+/i,"").replace(/[.*]$/,"").replace(/\*\*?/g,"").replace(/^\[?[A-C]\]?\s*/,"").trim();if(a.length>2)acts.push(a);}
  if(acts.length){btns='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';for(i=0;i<acts.length;i++){btns+='<button class="qa" onclick="sendSuggestedAction(this)" data-action="'+acts[i].replace(/"/g,"&quot;")+'">'+acts[i]+'</button>';}btns+='</div>';}
  return{clean:clean.replace(match[0],"").trim(),btns:btns};
}
function bondToast(owner,entity,desc,kind){var p=owner?owner+" bond":"Bond";if(kind==="ended")showToast(p+" ended: "+entity);else showToast(p+(kind==="updated"?" updated":"")+": "+entity+" -- "+desc);}
function findCompanionChar(name){
  if(!worldState||!worldState.npcs)return null;
  var n=name.trim().toLowerCase(),i;
  for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];if(npc.partyMember&&npc.charSheet&&npc.name.toLowerCase()===n)return npc.charSheet;}
  return null;
}
// True for a pronoun pair like "he/him", "she/her", "they/them" (incl. common neopronouns).
// Whitelisted tokens so real relations like "ally/foe" don't false-positive.
function isPronounStr(s){return /^\s*(he|she|they|it|ze|zie|xe|fae|ey|per)\s*\/\s*(him|her|them|it|its|hir|zir|xem|faer|em|per)\s*$/i.test(s||"");}
// Inventory stacks via a trailing " xN" suffix: gaining a duplicate increments the count instead of
// pushing a second entry; losing decrements (and drops the suffix at 1). Genuine repeat pickups (5x
// poison arrow) collapse to one "Poison arrow x5" line.
function _invEsc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function addInventoryItem(inv,name){var i;
  for(i=0;i<inv.length;i++){if(inv[i]===name){inv[i]=name+" x2";return;}}
  var re=new RegExp("^"+_invEsc(name)+" x(\\d+)$","i");
  for(i=0;i<inv.length;i++){var m=inv[i].match(re);if(m){inv[i]=name+" x"+(parseInt(m[1],10)+1);return;}}
  inv.push(name);
}
function removeInventoryItem(inv,name){var i;
  for(i=0;i<inv.length;i++){if(inv[i]===name){inv.splice(i,1);return true;}}
  var re=new RegExp("^"+_invEsc(name)+" x(\\d+)$","i");
  for(i=0;i<inv.length;i++){var m=inv[i].match(re);if(m){var n=parseInt(m[1],10)-1;inv[i]=n<=1?name:name+" x"+n;return true;}}
  return false;
}
function applyMuts(text){
  var muts=[],turn=worldState.turn;
  var hpTags=text.match(/\[HP:\s*([+-]?\d+)[^\]]*\]/g)||[];var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:\s*([+-]?\d+)[^\]]*\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}
  var goldTags=text.match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);muts.push(dg>0?"+"+dg+" gp":dg+" gp");}
  var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[];var igi;for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;addInventoryItem(worldState.character.inventory,igm[1]);muts.push("+"+igm[1]);autoTakeLocationItem(igm[1]);}
  var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;removeInventoryItem(worldState.character.inventory,ilm[1]);muts.push("-"+ilm[1]);}
  // fileLocation reads worldState.world.location as the PREVIOUS node to record a travel edge, so it
  // must run BEFORE we overwrite it — otherwise prev===dest and no edge is ever recorded (was the bug).
  var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){fileLocation(loc[1],"",turn);worldState.world.location=loc[1];worldState.world.sublocation=null;muts.push("-> "+loc[1]);}
  var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);
  var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}
  var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),turn);muts.push("Sub: "+sloctag[1].trim());}
  if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;muts.push("Left sub-location");}
  var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],turn);muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}
  // NPC_ALIAS — register before NPC tags so aliases resolve in the same turn
  var npcAliasTags=text.match(/\[NPC_ALIAS:([^|]+)\|([^\]]+)\]/g)||[];var alii;for(alii=0;alii<npcAliasTags.length;alii++){var alp=npcAliasTags[alii].match(/\[NPC_ALIAS:([^|]+)\|([^\]]+)\]/);if(!alp)continue;var alCanon=alp[1].trim(),alAlias=alp[2].trim();if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var wsali;for(wsali=0;wsali<worldState.npcs.length;wsali++){if(worldState.npcs[wsali].name===alCanon){if(!worldState.npcs[wsali].aliases)worldState.npcs[wsali].aliases=[];if(worldState.npcs[wsali].aliases.indexOf(alAlias)<0)worldState.npcs[wsali].aliases.push(alAlias);break;}}muts.push("Alias: "+alAlias+" -> "+alCanon);}
  // NPC_MERGE — absorb duplicate into canonical, clean up relationships
  var npcMergeTags=text.match(/\[NPC_MERGE:([^|]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}if(!memory.npcs[mgCanon].firstEncounter&&memory.npcs[mgDupe].firstEncounter)memory.npcs[mgCanon].firstEncounter=memory.npcs[mgDupe].firstEncounter;delete memory.npcs[mgDupe];}worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});if(worldState.character.relationships){var rgj,newRels2=[],seenRel={};for(rgj=0;rgj<worldState.character.relationships.length;rgj++){var rent=worldState.character.relationships[rgj].entity;if(rent===mgDupe)worldState.character.relationships[rgj].entity=mgCanon;var rkey=worldState.character.relationships[rgj].entity;if(!seenRel[rkey]){seenRel[rkey]=true;newRels2.push(worldState.character.relationships[rgj]);}}worldState.character.relationships=newRels2;}muts.push("Merged: "+mgDupe+" -> "+mgCanon);}
  // First-encounter snippet — computed once per response, lazily (cleanTxt is ~40 regex passes).
  // Strips the trailing suggestion line and cuts at a sentence boundary so the stored
  // prose reads clean. Written once per NPC, never overwritten.
  var feSnip=null;
  function feGet(){if(feSnip===null){var ft=cleanTxt(text).replace(/\*You could[\s\S]*$/,"").trim().slice(0,280);var fb=Math.max(ft.lastIndexOf(". "),ft.lastIndexOf("! "),ft.lastIndexOf("? "));if(fb>60)ft=ft.slice(0,fb+1);feSnip=ft;}return feSnip;}
  // NPC tags — resolve aliases to canonical before storing.
  // name+status groups are bounded by ] ([^|\]]+) so a 2-field tag immediately followed by another
  // tag (e.g. [NPC_PRONOUN:]) can't be stitched into one over-captured match (the Lorcan corruption).
  var npcs=text.match(/\[NPC:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/);if(!np)continue;var npName=resolveNpcName(np[1].trim());
    var npStatus=(np[2]||"").trim(),npRel=(np[3]||"").trim(),npPron="";
    // The GM sometimes writes a pronoun where status/relation belongs — route it to pronouns, never store it as the relation.
    if(isPronounStr(npRel)){npPron=npRel;npRel="";}
    if(isPronounStr(npStatus)){if(!npPron)npPron=npStatus;npStatus="";}
    var found=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===npName){if(npStatus)worldState.npcs[nj].status=npStatus;if(npRel)worldState.npcs[nj].rel=npRel;if(npPron)worldState.npcs[nj].pronouns=npPron;found=true;break;}}
    if(!found){worldState.npcs.push({name:npName,status:npStatus||"unknown",rel:npRel||"unknown",pronouns:npPron||null,met:turn,partyMember:false,portrait:null,aliases:[]});fileUsedName(npName);}
    if(!memory.npcs[npName])memory.npcs[npName]={attitude:npRel||"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[npName].firstEncounter)memory.npcs[npName].firstEncounter=feGet();if(npRel)memory.npcs[npName].attitude=npRel;if(npPron)memory.npcs[npName].pronouns=npPron;mapNpcLocation(npName);muts.push("NPC: "+npName);}
  var xpTags=text.match(/\[XP:(\d+)\]/g)||[];var xpi;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:(\d+)\]/);if(!xpm)continue;worldState.character.xp+=parseInt(xpm[1]);muts.push("+"+xpm[1]+" XP");checkLevelUp();}
  // [QUEST:title|status] or [QUEST:title|status|desc]. status: offered|active|completed|failed.
  var quests=text.match(/\[QUEST:([^|]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!qp)continue;var qTitle=qp[1].trim(),qStat=qp[2].trim().toLowerCase(),qDesc=qp[3]?qp[3].trim():"";if(qStat==="complete"||qStat==="done"||qStat==="finished")qStat="completed";else if(qStat==="abandoned"||qStat==="dropped")qStat="failed";var qIdx=-1,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title.toLowerCase()===qTitle.toLowerCase()){qIdx=qj;break;}}if(qIdx<0){worldState.questLog.push({title:qTitle,status:qStat,desc:qDesc,objectives:[],started:turn});if(qStat==="offered"){if(typeof showToast==="function")showToast("⚑ Quest opportunity: "+qTitle);muts.push("Quest offered: "+qTitle);}else muts.push("Quest: "+qTitle+" ("+qStat+")");}else{var qq=worldState.questLog[qIdx];qq.status=qStat;if(qDesc)qq.desc=qDesc;muts.push("Quest "+qTitle+": "+qStat);}if(qStat==="completed"||qStat==="failed")archiveQuest(qTitle,qStat);}
  // [QUEST_STEP:title|objective|done] — add an objective or set its done state
  var qsteps=text.match(/\[QUEST_STEP:([^|]+)\|([^|]+)\|?([^\]]*)\]/g)||[];var qsi;for(qsi=0;qsi<qsteps.length;qsi++){var qsp=qsteps[qsi].match(/\[QUEST_STEP:([^|]+)\|([^|]+)\|?([^\]]*)\]/);if(!qsp)continue;var qsTitle=qsp[1].trim(),qsObj=qsp[2].trim(),qsDone=/^(true|done|1|yes|x)$/i.test((qsp[3]||"").trim());var qsq=null,qk;for(qk=0;qk<worldState.questLog.length;qk++){if(worldState.questLog[qk].title.toLowerCase()===qsTitle.toLowerCase()){qsq=worldState.questLog[qk];break;}}if(!qsq)continue;if(!qsq.objectives)qsq.objectives=[];var ofound=false,oj2;for(oj2=0;oj2<qsq.objectives.length;oj2++){if(qsq.objectives[oj2].text.toLowerCase()===qsObj.toLowerCase()){qsq.objectives[oj2].done=qsDone;ofound=true;break;}}if(!ofound)qsq.objectives.push({text:qsObj,done:qsDone});muts.push(qsTitle+(qsDone?" ✓ ":" + ")+qsObj);}
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
  // [NPC_FORGET:name|person or event] — Oubliate: scrub a specific memory from an NPC so it stops re-injecting
  var forgets=text.match(/\[NPC_FORGET:([^|]+)\|([^\]]+)\]/g)||[];var fgi;for(fgi=0;fgi<forgets.length;fgi++){var fgp=forgets[fgi].match(/\[NPC_FORGET:([^|]+)\|([^\]]+)\]/);if(!fgp)continue;var fgName=resolveNpcName(fgp[1].trim()),fgWhat=fgp[2].trim().toLowerCase();var fgNpc=memory.npcs[fgName];if(!fgNpc)continue;var fgRem=0;if(fgNpc.knowledge){var fgkb=fgNpc.knowledge.length;fgNpc.knowledge=fgNpc.knowledge.filter(function(k){return String(k).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgkb-fgNpc.knowledge.length;}if(fgNpc.events){var fgeb=fgNpc.events.length;fgNpc.events=fgNpc.events.filter(function(e){return String(e&&e.note!==undefined?e.note:e).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgeb-fgNpc.events.length;}muts.push(fgName+" forgets: "+fgp[2].trim()+(fgRem?" ("+fgRem+")":""));}
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
  var pmTags=text.match(/\[PARTY_MEMBER:([^|]+)\|([^\]]+)\]/g)||[];var pmi;for(pmi=0;pmi<pmTags.length;pmi++){var pmp=pmTags[pmi].match(/\[PARTY_MEMBER:([^|]+)\|([^\]]+)\]/);if(!pmp)continue;var pmName=resolveNpcName(pmp[1].trim()),pmVal=pmp[2].trim().toLowerCase()==="true",pmFoundIdx=-1,pmk;for(pmk=0;pmk<worldState.npcs.length;pmk++){if(worldState.npcs[pmk].name===pmName){pmFoundIdx=pmk;break;}}if(pmFoundIdx>=0){worldState.npcs[pmFoundIdx].partyMember=pmVal;}else{worldState.npcs.push({name:pmName,status:"unknown",rel:"unknown",met:turn,partyMember:pmVal,portrait:null});fileUsedName(pmName);}if(memory.npcs[pmName])memory.npcs[pmName].partyMember=pmVal;else memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],partyMember:pmVal};if(pmVal&&!memory.npcs[pmName].firstEncounter)memory.npcs[pmName].firstEncounter=feGet();muts.push(pmVal?"Party: +"+pmName:"Party: -"+pmName);}
  // Skills
  var skSuccs=text.match(/\[SKILL_SUCCESS:([^\]]+)\]/g)||[];var sski;for(sski=0;sski<skSuccs.length;sski++){var sskp=skSuccs[sski].match(/\[SKILL_SUCCESS:([^\]]+)\]/);if(!sskp)continue;var sskid=sskp[1].trim();if(!worldState.character.skills)worldState.character.skills=initSkills();if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else muts.push(sskid+" +1");}}
  // Conditions
  var condTags=text.match(/\[CONDITION:([^|]+)\|([^\]]+)\]/g)||[];var condi;for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|]+)\|([^\]]+)\]/);if(!condp)continue;if(!worldState.character.conditions)worldState.character.conditions=[];var cnm=condp[1].trim(),cdur=condp[2].trim(),calready=false,condj;for(condj=0;condj<worldState.character.conditions.length;condj++){if(worldState.character.conditions[condj].name===cnm){worldState.character.conditions[condj].duration=cdur;calready=true;break;}}if(!calready){worldState.character.conditions.push({name:cnm,duration:cdur});muts.push("Condition: "+cnm);}}
  var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length;worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name!==crp2[1].trim();});if(worldState.character.conditions.length<cbef)muts.push("Cured: "+crp2[1].trim());}
  // Relationships
  var relTags=text.match(/\[RELATIONSHIP:([^|]+)\|([^\]]+)\]/g)||[];var reli;for(reli=0;reli<relTags.length;reli++){var relp=relTags[reli].match(/\[RELATIONSHIP:([^|]+)\|([^\]]+)\]/);if(!relp)continue;if(!worldState.character.relationships)worldState.character.relationships=[];var rnm=resolveNpcName(relp[1].trim()),rdsc=relp[2].trim(),rfound=false,relj;for(relj=0;relj<worldState.character.relationships.length;relj++){if(worldState.character.relationships[relj].entity===rnm){var prevRdsc=worldState.character.relationships[relj].descriptor;worldState.character.relationships[relj].descriptor=rdsc;rfound=true;if(prevRdsc!==rdsc)bondToast(null,rnm,rdsc,"updated");break;}}if(!rfound){worldState.character.relationships.push({entity:rnm,descriptor:rdsc});muts.push("Rel: "+rnm+" ("+rdsc+")");bondToast(null,rnm,rdsc,"new");}}
  var relRems=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[];var rri2;for(rri2=0;rri2<relRems.length;rri2++){var rrp2=relRems[rri2].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(!rrp2)continue;if(!worldState.character.relationships)continue;var rrName=resolveNpcName(rrp2[1].trim());worldState.character.relationships=worldState.character.relationships.filter(function(x){return x.entity!==rrName;});muts.push("Rel removed: "+rrName);bondToast(null,rrName,null,"ended");}
  // Save modifiers
  var saveTags=text.match(/\[SAVE_MOD:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}
  var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source!==smrp2[1].trim();});}
  // Languages
  var langTags=text.match(/\[LANGUAGE:([^|]+)\|([^\]]+)\]/g)||[];var lni2;for(lni2=0;lni2<langTags.length;lni2++){var lnp2=langTags[lni2].match(/\[LANGUAGE:([^|]+)\|([^\]]+)\]/);if(!lnp2)continue;if(!worldState.character.languages)worldState.character.languages=[];var lname=lnp2[1].trim(),lbroken=lnp2[2].trim().toLowerCase()==="broken",lfound=false,lj2;for(lj2=0;lj2<worldState.character.languages.length;lj2++){if(worldState.character.languages[lj2].name===lname){worldState.character.languages[lj2].broken=lbroken;lfound=true;break;}}if(!lfound){worldState.character.languages.push({name:lname,broken:lbroken});muts.push((lbroken?"Broken ":"")+"Language: "+lname);}}
  // Story beats
  var beatTags=text.match(/\[STORY_BEAT:([^\]]+)\]/g)||[];var bti2;for(bti2=0;bti2<beatTags.length;bti2++){var btp2=beatTags[bti2].match(/\[STORY_BEAT:([^\]]+)\]/);if(!btp2)continue;if(!worldState.character.storyBeats)worldState.character.storyBeats=[];worldState.character.storyBeats.push({text:btp2[1],turn:turn});fileDecision(turn,"[Story Beat] "+btp2[1]);}
  // ── Companion sheet tags (COMPANION_* prefix targets party member charSheets) ──
  var cHpTags=text.match(/\[COMPANION_HP:([^|]+)\|([+-]?\d+)\]/g)||[];var cHpi;for(cHpi=0;cHpi<cHpTags.length;cHpi++){var cHpm=cHpTags[cHpi].match(/\[COMPANION_HP:([^|]+)\|([+-]?\d+)\]/);if(!cHpm)continue;var cHpCs=findCompanionChar(cHpm[1]);if(!cHpCs)continue;var cHpdv=parseInt(cHpm[2]);cHpCs.hp=Math.min(cHpCs.maxHp||cHpCs.hp,Math.max(0,cHpCs.hp+cHpdv));muts.push(cHpm[1].trim()+(cHpdv>0?" healed ":" took ")+Math.abs(cHpdv)+" HP");}
  var cIgTags=text.match(/\[COMPANION_ITEM_GAINED:([^|]+)\|([^\]]+)\]/g)||[];var cIgi;for(cIgi=0;cIgi<cIgTags.length;cIgi++){var cIgm=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|]+)\|([^\]]+)\]/);if(!cIgm)continue;var cIgCs=findCompanionChar(cIgm[1]);if(!cIgCs)continue;if(!cIgCs.inventory)cIgCs.inventory=[];cIgCs.inventory.push(cIgm[2].trim());muts.push(cIgm[1].trim()+": +"+cIgm[2].trim());}
  var cIlTags=text.match(/\[COMPANION_ITEM_LOST:([^|]+)\|([^\]]+)\]/g)||[];var cIli;for(cIli=0;cIli<cIlTags.length;cIli++){var cIlm=cIlTags[cIli].match(/\[COMPANION_ITEM_LOST:([^|]+)\|([^\]]+)\]/);if(!cIlm)continue;var cIlCs=findCompanionChar(cIlm[1]);if(!cIlCs||!cIlCs.inventory)continue;cIlCs.inventory=cIlCs.inventory.filter(function(x){return x!==cIlm[2].trim();});muts.push(cIlm[1].trim()+": -"+cIlm[2].trim());}
  var cXpTags=text.match(/\[COMPANION_XP:([^|]+)\|(\d+)\]/g)||[];var cXpi;for(cXpi=0;cXpi<cXpTags.length;cXpi++){var cXpm=cXpTags[cXpi].match(/\[COMPANION_XP:([^|]+)\|(\d+)\]/);if(!cXpm)continue;var cXpCs=findCompanionChar(cXpm[1]);if(!cXpCs)continue;if(typeof cXpCs.xp!=="number")cXpCs.xp=0;cXpCs.xp+=parseInt(cXpm[2]);muts.push(cXpm[1].trim()+": +"+cXpm[2]+" XP");checkCompanionLevelUp(cXpCs);}
  var cCondTags=text.match(/\[COMPANION_CONDITION:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cCondi;for(cCondi=0;cCondi<cCondTags.length;cCondi++){var cCondp=cCondTags[cCondi].match(/\[COMPANION_CONDITION:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!cCondp)continue;var cCondCs=findCompanionChar(cCondp[1]);if(!cCondCs)continue;if(!cCondCs.conditions)cCondCs.conditions=[];var cCnm=cCondp[2].trim(),cCdur=cCondp[3].trim(),cCalready=false,cCondj;for(cCondj=0;cCondj<cCondCs.conditions.length;cCondj++){if(cCondCs.conditions[cCondj].name===cCnm){cCondCs.conditions[cCondj].duration=cCdur;cCalready=true;break;}}if(!cCalready){cCondCs.conditions.push({name:cCnm,duration:cCdur});muts.push(cCondp[1].trim()+": "+cCnm);}}
  var cCrTags=text.match(/\[COMPANION_CONDITION_REMOVED:([^|]+)\|([^\]]+)\]/g)||[];var cCri;for(cCri=0;cCri<cCrTags.length;cCri++){var cCrp=cCrTags[cCri].match(/\[COMPANION_CONDITION_REMOVED:([^|]+)\|([^\]]+)\]/);if(!cCrp)continue;var cCrCs=findCompanionChar(cCrp[1]);if(!cCrCs||!cCrCs.conditions)continue;cCrCs.conditions=cCrCs.conditions.filter(function(x){return x.name!==cCrp[2].trim();});muts.push(cCrp[1].trim()+": cured "+cCrp[2].trim());}
  var cRelTags=text.match(/\[COMPANION_RELATIONSHIP:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cReli;for(cReli=0;cReli<cRelTags.length;cReli++){var cRelp=cRelTags[cReli].match(/\[COMPANION_RELATIONSHIP:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!cRelp)continue;var cRelCs=findCompanionChar(cRelp[1]);if(!cRelCs)continue;if(!cRelCs.relationships)cRelCs.relationships=[];var cRnm=resolveNpcName(cRelp[2].trim()),cRdsc=cRelp[3].trim(),cRfound=false,cRelj;for(cRelj=0;cRelj<cRelCs.relationships.length;cRelj++){if(cRelCs.relationships[cRelj].entity===cRnm){var prevCRdsc=cRelCs.relationships[cRelj].descriptor;cRelCs.relationships[cRelj].descriptor=cRdsc;cRfound=true;if(prevCRdsc!==cRdsc)bondToast(cRelp[1].trim(),cRnm,cRdsc,"updated");break;}}if(!cRfound){cRelCs.relationships.push({entity:cRnm,descriptor:cRdsc});muts.push(cRelp[1].trim()+": rel "+cRnm+" ("+cRdsc+")");bondToast(cRelp[1].trim(),cRnm,cRdsc,"new");}}
  var cRrTags=text.match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|]+)\|([^\]]+)\]/g)||[];var cRri;for(cRri=0;cRri<cRrTags.length;cRri++){var cRrp=cRrTags[cRri].match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|]+)\|([^\]]+)\]/);if(!cRrp)continue;var cRrCs=findCompanionChar(cRrp[1]);if(!cRrCs||!cRrCs.relationships)continue;var cRrNm=resolveNpcName(cRrp[2].trim());cRrCs.relationships=cRrCs.relationships.filter(function(x){return x.entity!==cRrNm;});muts.push(cRrp[1].trim()+": rel removed "+cRrNm);bondToast(cRrp[1].trim(),cRrNm,null,"ended");}
  var cAbTags=text.match(/\[COMPANION_ABILITY:([^|]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cAbi;for(cAbi=0;cAbi<cAbTags.length;cAbi++){var cAbp=cAbTags[cAbi].match(/\[COMPANION_ABILITY:([^|]+)\|([^|]+)\|([^\]]+)\]/);if(!cAbp)continue;var cAbCs=findCompanionChar(cAbp[1]);if(!cAbCs)continue;if(!cAbCs.abilities)cAbCs.abilities=[];var cAnm=cAbp[2].trim(),cAalready=false,cAbj;for(cAbj=0;cAbj<cAbCs.abilities.length;cAbj++){if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;break;}}if(!cAalready){cAbCs.abilities.push({nm:cAnm,ds:cAbp[3].trim(),gained:turn});muts.push(cAbp[1].trim()+": ability "+cAnm);}}
  var cAlTags=text.match(/\[COMPANION_ALIGNMENT:([^|]+)\|(law|good)([+-]\d+)\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\[COMPANION_ALIGNMENT:([^|]+)\|(law|good)([+-]\d+)\]/i);if(!cAlp)continue;var cAlCs=findCompanionChar(cAlp[1]);if(!cAlCs)continue;if(!cAlCs.alignLaw)cAlCs.alignLaw=0;if(!cAlCs.alignGood)cAlCs.alignGood=0;if(cAlp[2].toLowerCase()==="law")cAlCs.alignLaw=Math.max(-3,Math.min(3,cAlCs.alignLaw+parseInt(cAlp[3])));else cAlCs.alignGood=Math.max(-3,Math.min(3,cAlCs.alignGood+parseInt(cAlp[3])));var cNewAl=alignLabel(cAlCs.alignLaw,cAlCs.alignGood);if(cNewAl!==cAlCs.actualAlignment){muts.push(cAlp[1].trim()+": align "+cNewAl);cAlCs.actualAlignment=cNewAl;}}
  if(muts.length)addMsg("system",muts.join(" | "));
  syncUI();saveAll();
}
async function callGM(msg,sysOverride,maxTok){
  var msgs=sessionLog.concat([{role:"user",content:msg}]);
  var prov=PROVIDERS[activeProvider]||PROVIDERS.anthropic;
  var key=providerKeys[activeProvider]||apiKey||"";
  var model=providerModels[activeProvider]||prov.defaultModel;
  var sys=sysOverride||buildSysPrompt();
  if(!sysOverride&&prov.reinforce)sys+=prov.reinforce; // gameplay turns only; summarize() passes its own sysOverride
  var body=prov.buildBody(msgs,sys,maxTok||1000,model);
  var url=typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint; // Gemini embeds the model in the URL
  var res;try{res=await fetch(url,{method:"POST",headers:prov.headers(key),body:JSON.stringify(body)});}catch(e){throw new Error("Network: "+e.message);}
  var raw;try{raw=await res.text();}catch(e){throw new Error("Read error");}
  var data;try{data=JSON.parse(raw);}catch(e){throw new Error("HTTP "+res.status+": "+raw.slice(0,200));}
  if(!res.ok)throw new Error((data.error&&data.error.message)||"HTTP "+res.status);
  return prov.parseResponse(data);
}
