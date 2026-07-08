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
  for(i=0;i<nKeys.length;i++){var sn=memory.map.nodes[nKeys[i]];if(sn.parent===w.location&&((sn.lastVisit||sn.firstVisit)>=cutoff))subLocs.push(nKeys[i].split("|")[1]);}/* filter on RECENCY, not first visit, so a frequently-used sub-location doesn't vanish 20 turns after first entry (audit E53) */
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
// #20 quest-lifecycle teeth (v1.172): the t198 corpus check showed the lifecycle going silent in
// mature campaigns — 0 [QUEST:] emissions in the indexed window, and quests sitting at 4/4 and 3/3
// objectives complete but never closed. Two data-driven nudges, both in this per-turn block:
// ① a quest whose objectives are ALL done gets an explicit close-or-extend instruction (the engine
// can detect this state deterministically; the GM decides which); ② a standing one-line reminder
// that unregistered crises/goals must be filed. Volatile half — never touches the cached block.
function buildQuestBlock(){
  var crisisLine="If the party is pursuing a significant threat, goal, or job NOT listed above, register it NOW: [QUEST:title|offered|desc] (or |active if they are already committed). Active crises ARE quests.\n";
  if(!worldState||!worldState.questLog||!worldState.questLog.length)return "QUESTS: none active.\n"+crisisLine+"\n";
  var active=[],offered=[],i;
  for(i=0;i<worldState.questLog.length;i++){var q=worldState.questLog[i];if(q.status==="active")active.push(q);else if(q.status==="offered")offered.push(q);}
  var out="";
  if(active.length){out+="ACTIVE QUESTS (authoritative — steer toward these; advance objectives via [QUEST_STEP:title|objective|done]):\n";for(i=0;i<active.length;i++){var aq=active[i];out+="• "+aq.title+(aq.desc?" — "+aq.desc:"")+"\n";var allDone=false;if(aq.objectives&&aq.objectives.length){allDone=true;var oj;for(oj=0;oj<aq.objectives.length;oj++){out+="    ["+(aq.objectives[oj].done?"x":" ")+"] "+aq.objectives[oj].text+"\n";if(!aq.objectives[oj].done)allDone=false;}}
    if(allDone)out+="    ⚑ ALL OBJECTIVES COMPLETE — if this quest is truly finished, emit [QUEST:"+aq.title+"|completed] now, together with its rewards ([XP:]/[GOLD:]/[ITEM_GAINED:]); if work remains, add the next objective via [QUEST_STEP:"+aq.title+"|objective].\n";}}
  if(offered.length){out+="OFFERED QUESTS (awaiting player acceptance — do NOT treat as active or advance objectives):\n";for(i=0;i<offered.length;i++){out+="• "+offered[i].title+(offered[i].desc?" — "+offered[i].desc:"")+"\n";}}
  if(!out)out="QUESTS: none active.\n";
  return out+crisisLine+"\n";
}
// P3 quest-lifecycle escalation, STAMP side (audit P3): runs at the end of every applyMuts pass.
// Each active quest whose objectives are ALL done gets q.allDoneSince = the turn the state was
// first seen; recomputed every response, so adding an unfinished objective or changing status
// clears the stamp. sendAction reads the stamps via buildQuestEscalation() below.
function stampQuestCompletion(){
  if(!worldState||!worldState.questLog)return;
  var i,j;
  for(i=0;i<worldState.questLog.length;i++){
    var q=worldState.questLog[i];
    var all=q.status==="active"&&!!(q.objectives&&q.objectives.length);
    if(all){for(j=0;j<q.objectives.length;j++){if(!q.objectives[j].done){all=false;break;}}}
    if(all){if(q.allDoneSince==null)q.allDoneSince=worldState.turn;}
    else if(q.allDoneSince!=null)delete q.allDoneSince;
  }
}
// P3 escalation, READ side: the "⚑ ALL OBJECTIVES COMPLETE" line in buildQuestBlock is a
// mid-system-prompt instruction and the 75-turn diagnostic run showed the GM ignoring it for
// ~35 turns (zero quests ever completed; XP starved). The user-message channel outranks
// mid-prompt lines, so once a quest has sat all-objectives-done for QUEST_ESCALATE_TURNS+
// turns, sendAction prepends this bracketed engine note to the OUTGOING API message. Only the
// API/sessionLog copy carries it — the displayed chat line and the worldState.transcript player
// entry keep the player's clean prose. One note per turn (the stalest quest); silent while
// worldState.combat is set so a fight is never derailed.
function buildQuestEscalation(){
  if(!worldState||!worldState.questLog||worldState.combat)return"";
  var pick=null,stale=0,i;
  for(i=0;i<worldState.questLog.length;i++){
    var q=worldState.questLog[i];
    if(q.status!=="active"||q.allDoneSince==null)continue;
    var n=worldState.turn-q.allDoneSince;
    if(n>=QUEST_ESCALATE_TURNS&&n>stale){stale=n;pick=q;}
  }
  if(!pick)return"";
  return"[ENGINE NOTE: Quest '"+pick.title+"' has had all objectives complete for "+stale+" turns. In THIS response either emit [QUEST:"+pick.title+"|completed] together with its rewards ([XP:]/[GOLD:]/[ITEM_GAINED:]), or add the next objective via [QUEST_STEP:"+pick.title+"|<objective>].]";
}
function buildSysPrompt(){
  var c=worldState.character,w=worldState.world,tone=worldState.tone||{};
  var tb=tone.voice?"TONE -- "+tone.name.toUpperCase()+":\n"+tone.voice+"\n\n":"TONE: "+(tone.name||"Sword and Sorcery")+"\n\n";
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];if(/\bdead\b/i.test(npc.status||""))continue;/* dead NPCs stay in memory.npcs but aren't listed as present */var npcAka=npc.aliases&&npc.aliases.length?" [aka: "+npc.aliases.join(", ")+"]":"";/* pronoun fallback: explicit wins; party members derive from charSheet.gender; everyone else defaults to they/them so the GM never has to guess */var npcPr=npc.pronouns||(npc.partyMember&&npc.charSheet&&npc.charSheet.gender?pronounsForGender(npc.charSheet.gender):"they/them");ns.push(npc.name+npcAka+" ("+npc.status+", "+npc.rel+(npcPr?", "+npcPr:"")+(npc.partyMember?", PARTY MEMBER":"")+")");}if(ns.length)nstr=ns.join("; ");}
  // PARTY MEMBER SHEETS — companions' full combat kit (class/spells/abilities). Without this the
  // GM only sees the one-line NPC roster entry and never knows a companion can cast → they default
  // to swinging a weapon. Rich block so a caster casts, a rogue uses tricks, etc.
  var partyBlock="";
  if(worldState.npcs.length){
    var pmArr=[],pj;
    for(pj=0;pj<worldState.npcs.length;pj++){
      var pmN=worldState.npcs[pj];
      if(!pmN.partyMember||!pmN.charSheet)continue;
      if(/\bdead\b/i.test(pmN.status||""))continue;
      var pcs=pmN.charSheet;
      var pAb="none";if(pcs.abilities&&pcs.abilities.length){var pa2=[],pai;for(pai=0;pai<pcs.abilities.length;pai++)pa2.push(pcs.abilities[pai].nm);if(pa2.length)pAb=pa2.join(", ");}
      var pSp="none";if(pcs.spells&&pcs.spells.length){var ps2=[],psi;for(psi=0;psi<pcs.spells.length;psi++){if(!pcs.spells[psi].used)ps2.push(pcs.spells[psi].nm);}if(ps2.length)pSp=ps2.join(", ");}
      var pSt=pcs.stats?("STR "+pcs.stats.STR+" DEX "+pcs.stats.DEX+" CON "+pcs.stats.CON+" INT "+pcs.stats.INT+" WIS "+pcs.stats.WIS+" CHA "+pcs.stats.CHA):"";
      var pInv=(pcs.inventory&&pcs.inventory.length)?pcs.inventory.join(", "):"none";
      var line=pmN.name+" — "+(pcs.subraceNm?pcs.subraceNm+" ":"")+(pcs.ancestry?pcs.ancestry+" ":"")+(pcs.cls||"adventurer")+(pcs.archetypeNm?" ["+pcs.archetypeNm+"]":"")+", Level "+(pcs.level||1)+" | HP "+pcs.hp+"/"+pcs.maxHp+"\n";
      if(pSt)line+="  Stats: "+pSt+"\n";
      line+="  Abilities: "+pAb+"\n  Spells available: "+pSp+"\n  Inventory: "+pInv;
      pmArr.push(line);
    }
    if(pmArr.length)partyBlock="PARTY MEMBER SHEETS (companions fighting alongside the player — have each act IN CHARACTER using their OWN abilities and spells below, not just weapons: a spellcaster should cast from their spell list, a rogue should use stealth and tricks. Track their resources with COMPANION_* tags):\n"+pmArr.join("\n")+"\n\n";
  }
  // Live party-size note so the GM never narrates a join it can't make (the engine also caps it).
  var pmCnt=partyCompanionCount(),pmCap=partyCompanionCap();
  var partyCapBlock="PARTY SIZE: "+pmCnt+" of "+pmCap+" companion slots filled (hard cap "+PARTY_MAX+" total, including the player)."+(pmCnt>=pmCap?" THE PARTY IS FULL — do NOT have any new NPC join the party (no [PARTY_MEMBER:|true]) until a current companion leaves or dies. An NPC may still aid the party temporarily as an ally without becoming a member.":"")+"\n\n";
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
  // RAG episodic excerpts (#27 Phase 1) — "" unless worldState.ragMemory is on. VOLATILE
  // half ONLY: retrieval changes per turn and must never touch the cached stable block.
  var ragBlock=typeof ragRetrieve==="function"?ragRetrieve(typeof lastAction==="string"&&lastAction?lastAction:""):"";
  var legacyBlock="";
  if(worldState.pendingLegacy){
    var _lc=worldState.pendingLegacy;
    var _lpron=_lc.gender?pronounsForGender(_lc.gender):"they/them";
    var _lgw=_lc.gender==="F"?"female":_lc.gender==="NB"?"non-binary":_lc.gender==="M"?"male":"";
    var _lrel=(_lc.relationships&&_lc.relationships.length)?_lc.relationships.map(function(r){return r.entity+(r.descriptor?" ("+r.descriptor+")":"");}).join(", "):"";
    var _linv=(_lc.inventory&&_lc.inventory.length)?_lc.inventory.join(", "):"";
    var _lpers="";if(_lc.trait)_lpers+=" trait — "+_lc.trait+";";if(_lc.flaw)_lpers+=" flaw — "+_lc.flaw+";";if(_lc.motivation)_lpers+=" motivation — "+_lc.motivation+";";
    legacyBlock="LEGACY CHARACTER — INTRODUCE THIS SESSION:\n"
      +"A figure from another story walks this world: "+_lc.name+", "+(_lgw?"("+_lgw+", pronouns "+_lpron+") ":"")+"a "+(_lc.ancestry?_lc.ancestry+" ":"")+_lc.cls+" (Level "+_lc.level+")"+(_lc.age?", "+_lc.age:"")+".\n"
      +(_lc.appear?"Appearance: "+_lc.appear+"\n":"")
      +(_lc.mark?"Distinguishing mark: "+_lc.mark+"\n":"")
      +(_lc.backstory?"History: "+_lc.backstory+"\n":"")
      +(_lpers?"Personality:"+_lpers+"\n":"")
      +(_lc.alignment?"Alignment: "+_lc.alignment+(_lc.deity?" | Deity: "+_lc.deity:"")+"\n":"")
      +(_lrel?"People they know and remember (preserve these — do NOT forget or invent relationships): "+_lrel+"\n":"")
      +(_linv?"Carries: "+_linv+"\n":"")
      +"This is the SAME person from their own tale. Preserve their gender ("+_lpron+"), appearance, personality, the people they love, and their possessions EXACTLY as listed — never change their pronouns and never invent new family or gear. They retain who they are, but they do NOT recognize "+c.name+" and know nothing of this campaign's events.\n"
      +"Introduce them organically as a background NPC within the next 1-2 turns — do not force them into the scene unnaturally. Register them with [NPC:"+_lc.name+"|alive|neutral]"+(_lgw?" and [NPC_PRONOUN:"+_lc.name+"|"+_lpron+"]":"")+".\n\n";
  }
  var hotNpcs="";var npcNames=Object.keys(memory.npcs);
  // Match aliases too — an NPC mentioned only by alias/short form in recent prose otherwise
  // got no detail block, and the GM improvised from momentum instead of memory (audit #13).
  if(npcNames.length&&sessionLog.length){var recent=sessionLog.slice(-6).map(function(m){return m.content;}).join(" ");for(i=0;i<npcNames.length;i++){var hnN=npcNames[i],hnHit=recent.indexOf(hnN)>=0;if(!hnHit&&memory.npcs[hnN].aliases){var haj;for(haj=0;haj<memory.npcs[hnN].aliases.length;haj++){if(recent.indexOf(memory.npcs[hnN].aliases[haj])>=0){hnHit=true;break;}}}if(hnHit)hotNpcs+=memoryNpcDetail(hnN)+"\n";}}
  var identity="PLAYER IDENTITY (never forget this): "+c.name+", a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" | Level "+c.level+" | "+(c.actualAlignment||c.statedAlignment||"Neutral")+(c.deity?" | Deity: "+c.deity:"")+(c.trait?" | Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+"\n\n";
  var adultBlock=adultMode?"ADULT CONTENT ENABLED (player has opted in): Explicit violence, sexual content between adult characters, and graphic mature themes are fully permitted and encouraged when narratively appropriate. PROFANITY IS FULLY UNLOCKED — strong language and crude words (fuck, shit, etc.) are permitted without restriction; swear freely and naturally wherever the chosen prose voice, a character's mouth, or the heat of the moment calls for it. Do NOT self-censor, do NOT soften word choice, do NOT substitute milder words or censor with symbols. Do not fade to black, time-skip, or cut away to the afterglow (e.g. jumping to 'Later, …') at the moment an intimate scene begins — depict the encounter itself on-screen, not just the lead-up and the morning after. Do not sanitize descriptions, do not soften mature scenes unless the player explicitly asks. All content must still involve adults only.\n\n":"";
  // Prose-inspiration voice (TODO #23) — merged into the STYLE rule so there's one
  // unified voice directive, not a separate block the model can average away.
  var _paVc="",_paProfane=false,_paDNA="";
  var _paId=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:(typeof proseAuthor!=="undefined"?proseAuthor:"");
  if(_paId&&typeof AUTHORS!=="undefined"){
    var pa=null,pj;for(pj=0;pj<AUTHORS.length;pj++){if(AUTHORS[pj].id===_paId){pa=AUTHORS[pj];break;}}
    if(pa){if(pa.vc){_paVc=pa.vc;_paProfane=!!pa.profane;}if(pa.contentDNA)_paDNA=pa.contentDNA;}
  }
  var narrativeDesignBlock=_paDNA?"NARRATIVE DESIGN — these structural principles govern this campaign; they shape what happens and why, not how it is written:\n"+_paDNA+"\n\n":"";
  // BESTIARY (blueprint creatures, v1.176) — campaign-constant, so it lives in the STABLE half:
  // worldState.bestiary is set once at blueprint apply and never mutated per turn (a mid-campaign
  // edit would cost one cache re-write, then warm again). Keeps signature monsters canonical
  // instead of re-improvised from their names.
  var bestiaryBlock="";
  if(worldState.bestiary&&worldState.bestiary.length){
    var _bls=["BESTIARY — the creatures of this campaign. Reach for these before inventing new monsters, and keep their nature, threat, and behaviour canonical. Combat stats still go through [COMBAT_START:]/[COMBAT_STATS:] as usual:"];
    var _bi;for(_bi=0;_bi<worldState.bestiary.length;_bi++){
      var _bc=worldState.bestiary[_bi],_bm=[];
      if(_bc.kind)_bm.push(_bc.kind);
      if(_bc.threat)_bm.push("threat: "+_bc.threat);
      _bls.push("• "+_bc.name+(_bm.length?" ("+_bm.join(", ")+")":"")+(_bc.notes?" — "+_bc.notes:""));
    }
    bestiaryBlock=_bls.join("\n")+"\n\n";
  }
  // Transient control-switch reinforcement — overrides the sessionLog momentum where the
  // OLD protagonist was "you". Set on swap, auto-cleared in sendAction after ~2 turns.
  var switchBlock="";
  if(worldState.recentSwitch){var rs=worldState.recentSwitch;switchBlock="*** CONTROL RECENTLY SWITCHED — READ CAREFULLY ***\nThe player now plays "+rs.to+". Second-person narration ('you'/'your') refers to "+rs.to+" and ONLY "+rs.to+". "+rs.from+" is now a non-player companion in the party — describe "+rs.from+" in the third person by name, never as 'you'. The conversation history above was written while "+rs.from+" was the player character; do NOT let that mislead you into addressing "+rs.from+" as the protagonist. The protagonist is now "+rs.to+".\n\n";}
  // Transient departure marker — set by the "Part ways" button; auto-cleared in sendAction after ~2 turns.
  var leftBlock="";
  if(worldState.recentlyLeft&&worldState.recentlyLeft.length){var _ln=worldState.recentlyLeft.map(function(x){return x.name;}).join(", ");leftBlock="*** PARTY DEPARTURE ***\n"+_ln+" has LEFT the party and is no longer travelling with the player. Do not narrate them as present in the current scene or acting alongside the party; the conversation history above may still show them present, but they have gone. They remain part of the world and may reappear later as an ordinary NPC if the story brings them back.\n\n";}
  // ── Stable/volatile split (TODO #11 prompt caching) ───────────────────────
  // STABLE: campaign-constant text only — byte-identical turn to turn, so the Anthropic
  // adapter can put a cache_control breakpoint after it. Rules, tone, and voice change only
  // on explicit user edits (one cache invalidation, then warm again). Anything that reads
  // worldState/memory/sessionLog MUST stay out of this block — a single leaked turn counter
  // kills every cache hit. VOLATILE: all per-turn state. STYLE stays at the very END of the
  // volatile block (not in stable) on purpose: end-of-prompt position is load-bearing for
  // prose-voice fidelity (audit #2) and it's only a few hundred uncached tokens.
  var stable=getRulesBlock()+adultBlock
    +"You are the Game Master for Traffic and Dragons, a sword and sorcery RPG. Write vivid second-person prose that keeps the player in danger, mystery, and wonder. You drive the adventure forward — push hooks and threats, never wait to be entertained. Mature violence and adult themes are fully permitted. The world state below is absolute truth -- never contradict it.\n\n"
    +tb
    // With a prose author set, TONE and VOICE were two competing style directives the model
    // averaged — the "voice evaporated" mechanism (audit #2). Subordinate tone style explicitly.
    +(_paVc?"NOTE: The TONE above governs CONTENT only (magic prevalence, danger, stakes, moral register). All prose STYLE is governed by the VOICE directive in the STYLE section at the end of this prompt — where they differ on style, the VOICE wins.\n\n":"")
    +narrativeDesignBlock
    +bestiaryBlock
    +"MECHANICS: DC 10=easy 15=moderate 20=hard. Always show dice with the specific stat or check name: [DICE:Strength check|result|outcome] e.g. [DICE:Constitution saving throw|14|success] or [DICE:Dexterity check|8|failed]\n\n"
    +"STATE TAGS (use in responses, never shown to player):\n"
    +"[HP:+/-X] [GOLD:+/-X gp -- ALWAYS in gold pieces; 10sp=1gp, 100cp=1gp; convert before tagging] [ITEM_GAINED:name] [ITEM_LOST:name] [LOCATION:name] [XP:N]\n"
    +"ITEM TAG FORMAT: emit the tag once per item with the bare item name -- never bake quantities into the name (no 'Torch x3'); to grant three torches, emit [ITEM_GAINED:Torch] three times.\n"
    +"[NPC:name|status|relation] -- status=current mood/condition in 2-4 WORDS (a label like 'wary, bargaining' -- never a sentence; scene detail belongs in prose or [NPC_NOTE:]), relation=how they relate to the player (ally/enemy/acquaintance/rival/etc.); NEVER put pronouns in these fields -- pronouns go ONLY in [NPC_PRONOUN:]. [PARTY_MEMBER:name|true/false] [QUEST:title|status] [ABILITY_GAINED:Name|Desc]\n"
    +"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten\n"
    +"[LOCATION_SIZE:scale|travelMins] -- size of current location; scale=tiny/small/medium/large/vast; travelMins=estimated minutes to cross on foot (e.g. [LOCATION_SIZE:large|45]); emit once on first visit alongside LOCATION_DESC\n"
    +"[SUBLOCATION:name] -- player enters a named area within current world location (e.g. tavern common room, thieves' guild hall)\n"
    +"[SUBLOCATION_LEAVE] -- player exits the sub-location back to the parent world location\n"
    +"[TIME:time of day] -- update whenever time meaningfully advances (e.g. [TIME:dawn], [TIME:late night]); the world clock does NOT move on its own, so a night's camp, a long journey, or a rest all need this tag or the prompt keeps reporting the old time\n"
    +"[WEATHER:description] -- update when the weather changes (e.g. [WEATHER:heavy rain], [WEATHER:clear and cold])\n"
    +"[LOCATION_ITEM:name|placed] -- item left or hidden here (pair with [ITEM_LOST:]); [LOCATION_ITEM:name|taken] -- item removed by NPC/event (player pickup auto-handled by [ITEM_GAINED:])\n"
    +"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] [ENEMY_HP:-X] [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n"
    +"[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N] -- always emit alongside COMBAT_START; use official D&D stats\n"
    +"[COMBAT_IMMUNE:fire,poison] [COMBAT_RESIST:cold,lightning] [COMBAT_VULN:thunder] -- omit entirely if none; comma-separated damage types only\n"
    +"CLOSE EVERY FIGHT: emit [COMBAT_END:...] the moment combat ends by ANY means -- not only a kill. Use [COMBAT_END:fled] when the enemy breaks off or is driven away, [COMBAT_END:truce] on a parley/surrender, [COMBAT_END:disengaged] when the party leaves the fight. A fight left unclosed sits stale in the tracker.\n"
    +"[ALIGNMENT:law+1] [ALIGNMENT:good-1] (use on morally significant choices only)\n"
    +"[SPELL_USED:spellname] (leveled spells only -- cantrips never expend; use exact spell name)\n"
    +"[SPELL_DEF:Name|range=X|targets=Y|duration=Z|effect=...|cost=slot|tier=1|magical=yes] -- ONLY when a spell is cast that is NOT already in the CANONICAL SPELL RULES list (one you invented or a homebrew): define its canon ONCE so the engine pins it and it can never drift. '=' per field, '|' between fields; keep effect free of '|' and ']'. Recorded once, re-injected forever -- do not redefine a spell already listed.\n"
    +"[REST:long] when the party completes a full/long rest (a night's sleep) -- restores every expended spell slot for the whole party so 1/day spells can be cast again; narrate HP recovery with [HP:+N] as usual\n"
    +"[FUTURE_EVENT_RESOLVED:what] (when a pending future event occurs)\n"
    +"[LORE:fact] [DECISION:description] [FUTURE_EVENT:what|when] [NPC_NOTE:name|note] [NPC_PRONOUN:name|she/her]\n"
    +"[NPC_FORGET:name|person or event] -- erase one specific memory from an NPC (emit when the Oubliate spell is cast and the WIS save fails); the engine scrubs that fact from what the NPC knows so it cannot resurface\n"
    +"[RETCON:what was corrected] -- emit whenever you correct, rewind, or retract something you previously narrated (including after an out-of-character correction from the player); the engine de-indexes the superseded narration from episodic memory so the wrong version can never resurface as truth\n"
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
    +"[STORY_BEAT:one sentence] -- major narrative milestone; use sparingly for truly significant moments only. Concrete triggers, one beat per such moment: a companion joins or leaves the party, an oath or bargain is struck, a major revelation lands, first blood is drawn in a significant conflict, a quest completes\n"
    +"[ARC_COMPLETE:arc title] -- emit when the current arc's objective is fulfilled; advances to the next arc\n"
    +"[ACT_COMPLETE:act title] -- emit when the act's turning point occurs; advances to the next act\n"
    +"COMPANION SHEET TAGS — use these (not the player tags) when the event affects a named party member, not the player:\n"
    +"[COMPANION_HP:Name|+/-N] [COMPANION_ITEM_GAINED:Name|item] [COMPANION_ITEM_LOST:Name|item] [COMPANION_XP:Name|N]\n"
    +"[COMPANION_CONDITION:Name|condName|duration] [COMPANION_CONDITION_REMOVED:Name|condName]\n"
    +"[COMPANION_RELATIONSHIP:Name|entity|descriptor] [COMPANION_RELATIONSHIP_REMOVED:Name|entity]\n"
    +"[COMPANION_ABILITY:Name|abilityName|desc] [COMPANION_ALIGNMENT:Name|law+1]\n"
    +"Use the companion's exact name as it appears in the party list. Apply the same upkeep rules as for the player.\n"
    +"THE MOMENT an NPC agrees to travel with the party — even conditionally or provisionally — you MUST emit [PARTY_MEMBER:name|true] in that same response; never narrate a joining without the tag.\n"
    +"XP IS SHARED AUTOMATICALLY: every [XP:N] you award is mirrored by the engine to all party members. Use [COMPANION_XP:Name|N] ONLY for a bonus one companion earns alone — never re-emit a shared award with it.\n\n";
  var volatile_=identity+switchBlock+leftBlock
    +"CHARACTER: "+c.name+" ("+genderDisplay+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +(c.trait||c.flaw||c.motivation?(c.trait?"Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+(c.motivation?" | Motivation: "+c.motivation:"")+"\n":"")+(c.deity?"Deity: "+c.deity+"\n":"")/* trailing \n so "Motivation:" doesn't glue to the next line (audit E54) */
    +"Abilities: "+abilstr+"\nSpells available: "+spstr+"\nInventory: "+c.inventory.join(", ")+"\n"
    +condStr+relStr+saveStr+langStr+skillStr
    +buildSpellBibleBlock()
    +buildAbilityBibleBlock()
    +partyBlock
    +partyCapBlock
    +"Location: "+w.location+", "+w.region+" | Time: "+w.time+" | Weather: "+w.weather+"\n"
    +"NPCs: "+nstr+"\n\n"+questBlock+buildSkeletonBlock()
    +(memToc?"MEMORY DIRECTORY:\n"+memToc+"\n\n":"")
  +(function(){var s=getNameSuggestions(10,true);return s.length?"AVAILABLE NAMES (use these for new NPCs): "+s.join(", ")+"\n\n":""}())
    +(hotNpcs?"ACTIVE NPC DETAILS:\n"+hotNpcs+"\n":"")
    +ragBlock
    +legacyBlock
    +buildNpcGraph()
    +buildGeoBlock()
    +cb+hist
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: "+(_paVc?"Write EVERY sentence of narration in this voice — a reader should recognise the author from rhythm, sentence length, and word choice alone. Commit fully; never blend with a neutral GM voice. VOICE: "+_paVc+(_paProfane?(adultMode?" This voice swears: use strong, crude profanity freely and naturally — never censored.":" Keep this voice's rhythm and bite, but keep the language clean — no profanity."):"")+" ":"Write clean, readable prose. ")+"Do NOT use em-dashes or en-dashes anywhere; use commas or separate sentences instead. Do not cram multiple clauses or similes into one long sentence; break a long thought into several short ones, one main image per sentence. Do NOT end your response with suggested actions, a 'You could' line, or an [ACTIONS:] tag — action suggestions are handled separately by the engine. Never show tags in prose. Death is possible.";
  return {stable:stable,volatile:volatile_};
}
function buildSkeletonBlock(){
  if(!worldState.skeleton)return"";
  var sk=worldState.skeleton,lines=[],i,j;
  lines.push("CAMPAIGN SKELETON — this is the overarching narrative structure. Every scene, quest, and encounter should serve this story. Do not invent unrelated side-plots that pull away from the current arc.");
  lines.push("Premise: "+sk.premise);
  for(i=0;i<sk.acts.length;i++){
    var act=sk.acts[i],label="Act "+(i+1)+": "+act.title;
    if(act.status==="completed")label+=" [COMPLETED]";
    else if(act.status==="active")label+=" [CURRENT"+(act.parallel?" — PARALLEL: arcs can be pursued in any order":"")+"]";
    lines.push(label+" — Goal: "+act.goal);
    if(act.status==="active"){
      lines.push("  Turning point (end of act): "+act.turningPoint);
      // Act reward (v1.178): the milestone payout — bigger in scale than an arc's, granted with
      // the [ACT_COMPLETE:] emission itself so finishing an act always lands like one.
      if(act.reward)lines.push("  ACT REWARD — when you emit [ACT_COMPLETE:"+act.title+"], grant this in the SAME response via the matching tags ([ITEM_GAINED:]/[GOLD:]/[XP:]/[ABILITY_GAINED:]) and give the grant a scene worthy of an act's end: "+act.reward);
      for(j=0;j<act.arcs.length;j++){
        var arc=act.arcs[j],as=arc.status==="completed"?"DONE":arc.status==="active"?"CURRENT":"upcoming";
        var typeHint=arc.type?" ("+arc.type+")":"";
        lines.push("  Arc "+(j+1)+": "+arc.title+" ["+as+"]"+typeHint+" — "+arc.objective
          +(arc.status==="active"&&arc.dnaHint?"\n    HOW TO RUN THIS ARC: "+arc.dnaHint:"")
          // Arc reward (v1.176): grant travels WITH the [ARC_COMPLETE:] emission — same-response
          // tags, so completing an arc always pays out (loot, gold, or the prop a later arc needs).
          +(arc.status==="active"&&arc.reward?"\n    ARC REWARD — when you emit [ARC_COMPLETE:"+arc.title+"], grant this in the SAME response via the matching tags ([ITEM_GAINED:]/[GOLD:]/[XP:]/[ABILITY_GAINED:]): "+arc.reward:""));
      }
    }
  }
  var pacingNote="PACING: Drive scenes toward the CURRENT arc's objective. When the objective is met, emit [ARC_COMPLETE:title]. When the act's turning point occurs, emit [ACT_COMPLETE:title]. Do not stall — if a scene has run 4+ turns without advancing the arc, push toward a transition or resolution.";
  var activeAct=null;for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="active"){activeAct=sk.acts[i];break;}}
  if(activeAct){
    // F3 (audit playthrough v1.214): an act can sit "active" with EVERY arc already completed,
    // because [ACT_COMPLETE:] is a separate GM emission the model neglects (the act lagged 4 turns
    // after its last arc closed). Deterministically detect the all-arcs-done state and prepend a
    // strong close-the-act nudge, mirroring the quest ALL-OBJECTIVES-COMPLETE teeth (#20).
    var _allArcsDone=activeAct.arcs.length>0;for(j=0;j<activeAct.arcs.length;j++){if(activeAct.arcs[j].status!=="completed"){_allArcsDone=false;break;}}
    if(_allArcsDone)pacingNote="⚑ ALL ARCS COMPLETE for the current act (\""+activeAct.title+"\") — its story is finished. Emit [ACT_COMPLETE:"+activeAct.title+"] at the next natural beat to advance the campaign"+(activeAct.reward?", granting the ACT REWARD in that same response":"")+".\n"+pacingNote;
    var activeArcs=[];for(j=0;j<activeAct.arcs.length;j++){if(activeAct.arcs[j].status==="active")activeArcs.push(activeAct.arcs[j]);}
    if(activeArcs.length>1)pacingNote+="\nThis act is PARALLEL — multiple arcs are active simultaneously. The player chooses which to pursue. Weave hooks for the others into scenes naturally, but follow the player's lead. Do not force a specific arc order. Run each through its HOW TO RUN THIS ARC directive above.";
    // Generic type-hint only when the active arc has NO dnaHint — otherwise it contradicts the author
    // sensibility (a generic "investigation → gather clues" line is what flattened campaigns into procedure).
    if(activeArcs.length===1&&!activeArcs[0].dnaHint&&activeArcs[0].type)pacingNote+="\nThe current arc is "+activeArcs[0].type+"-focused. Shape encounters and scenes accordingly: "+(activeArcs[0].type==="investigation"?"clues, interrogation, deduction, piecing together evidence":activeArcs[0].type==="exploration"?"travel, discovery, environmental challenges, mapping unknown territory":activeArcs[0].type==="social"?"politics, alliances, persuasion, betrayal, negotiation":activeArcs[0].type==="combat"?"battles, sieges, hunts, tactical encounters":"varied challenges")+".";
  }
  lines.push(pacingNote);
  return lines.join("\n")+"\n\n";
}
// buildSpellBibleBlock (TODO #10) — the anti-drift injection. Re-feeds the CANONICAL rules for
// every spell the player currently knows, every turn, so the GM narrates from fixed bounds instead
// of re-improvising a spell's range/targets/duration from its name (the Message-went-limitless
// drift). Same re-inject-from-data pattern as the quest block / char sheet / [LOCATION_DESC:].
// VOLATILE half only (reads worldState.character.spells live). Bounded by known spells, so cheap.
// Player-only for now; companion spell canon is a follow-up (their spells live on charSheet.spells).
function buildSpellBibleBlock(){
  var c=worldState&&worldState.character;
  if(!c||!c.spells||!c.spells.length||typeof capabilityLookup!=="function")return"";
  var seen={},lines=[],i;
  for(i=0;i<c.spells.length;i++){
    var sp=c.spells[i];if(!sp||!sp.nm)continue;
    var e=capabilityLookup(sp.nm);if(!e)continue;
    var key=capBaseName(sp.nm);if(seen[key])continue;seen[key]=1;
    var nm=String(sp.nm).replace(/\s*\(.*\)/,"").trim();
    var bits=[e.cost,e.range,e.targets,e.duration];if(e.save)bits.push("save: "+e.save);
    lines.push("- "+nm+" ["+bits.filter(Boolean).join(" | ")+"]: "+e.effect);
  }
  if(!lines.length)return"";
  return "CANONICAL SPELL RULES (authoritative — these bounds are FIXED; never expand a spell's range, targets, duration, or effect beyond what is written here, and honor these over any remembered version when the spell is cast):\n"+lines.join("\n")+"\n\n";
}
// buildAbilityBibleBlock (TODO #10) — the ability half of the anti-drift injection. Re-feeds canon
// for the player's class abilities every turn via capabilityLookup (which resolves an ability that
// is really a spell — Sacred Flame, Hunter's Mark — through spell_bible, so its canon is never
// duplicated or contradicted). VOLATILE half; bounded by known abilities. Abilities not yet in the
// bible (later class features / archetype grants) simply don't render — partial coverage is fine.
function buildAbilityBibleBlock(){
  var c=worldState&&worldState.character;
  if(!c||!c.abilities||!c.abilities.length||typeof capabilityLookup!=="function")return"";
  var seen={},lines=[],i;
  for(i=0;i<c.abilities.length;i++){
    var ab=c.abilities[i];if(!ab||!ab.nm)continue;
    var e=capabilityLookup(ab.nm);if(!e)continue;
    var key=capBaseName(ab.nm);if(seen[key])continue;seen[key]=1;
    var nm=String(ab.nm).replace(/\s*\(.*\)/,"").trim();
    var bits=[e.cost,e.range,e.targets,e.duration];if(e.save)bits.push("save: "+e.save);
    lines.push("- "+nm+" ["+bits.filter(Boolean).join(" | ")+"]: "+e.effect);
  }
  if(!lines.length)return"";
  return "CANONICAL ABILITY RULES (authoritative — these bounds are FIXED; honor them over any remembered version when the ability is used):\n"+lines.join("\n")+"\n\n";
}
// ── Model-output JSON cleanup ────────────────────────────────────────────────
// Shared by every JSON-expecting call (skeleton, action suggestions, summarize,
// character randomiser). Extracted from 4 inline copies so test.html exercises the
// REAL parsing path with known-bad model outputs (TODO #14).
function stripCodeFences(s){return String(s||"").replace(/```[a-z]*\n?/gi,"").replace(/```/g,"").trim();}
// Full repair for OBJECT payloads: fences, stray pre/postamble prose, trailing commas,
// bare control characters (a literal newline inside a JSON string is invalid; the escaped
// two-char \n is unaffected). NOT for array payloads — the first-{ trim would eat "[".
function repairModelJson(s){
  s=stripCodeFences(s);
  var fi=s.indexOf("{");if(fi>0)s=s.slice(fi);
  var li=s.lastIndexOf("}");if(li>=0&&li<s.length-1)s=s.slice(0,li+1);
  s=s.replace(/,\s*([}\]])/g,"$1");
  s=s.replace(/[\x00-\x1F\x7F]/g," ");
  return s;
}
var _CT_TAGS=/\[(HP|GOLD|ITEM_GAINED|ITEM_LOST|LOCATION|NPC|XP|QUEST_STEP|QUEST|DICE|COMBAT_START|COMBAT_END|COMBAT_ROUND|ENEMY_HP|ENEMY_SURRENDERS|ABILITY_GAINED|ALIGNMENT|LORE|DECISION|FUTURE_EVENT_RESOLVED|FUTURE_EVENT|NPC_NOTE|NPC_FORGET|NPC_PRONOUN|SPELL_USED|SPELL_DEF|SKILL_SUCCESS|CONDITION|CONDITION_REMOVED|RELATIONSHIP|RELATIONSHIP_REMOVED|SAVE_MOD|SAVE_MOD_REMOVED|LANGUAGE|STORY_BEAT|PARTY_MEMBER|COMBAT_STATS|COMBAT_IMMUNE|COMBAT_RESIST|COMBAT_VULN|LOCATION_DESC|LOCATION_SIZE|SUBLOCATION|TIME|WEATHER|REST|LOCATION_ITEM|NPC_ALIAS|NPC_MERGE|NPC_LINK|FACTION|NPC_FACTION|FACTION_REL|COMPANION_HP|COMPANION_ITEM_GAINED|COMPANION_ITEM_LOST|COMPANION_XP|COMPANION_CONDITION|COMPANION_CONDITION_REMOVED|COMPANION_RELATIONSHIP|COMPANION_RELATIONSHIP_REMOVED|COMPANION_ABILITY|COMPANION_ALIGNMENT|ARC_COMPLETE|ACT_COMPLETE|ACTIONS|RETCON):[^\]]+\]/g;
var _CT_BARE=/\[(ENEMY_SURRENDERS|SUBLOCATION_LEAVE)\]/g;
var _CT_DASH=/[ \t]*[—–][ \t]*/g;
var _CT_NL=/\n{3,}/g;
function cleanTxt(t){
  return t.replace(_CT_TAGS,"").replace(_CT_BARE,"")
    .replace(_CT_DASH,", ").replace(_CT_NL,"\n\n").trim();
}
// Renders EVERY [DICE:] tag in the response, not just the first (audit E10) — cleanTxt strips them
// all, so a second roll used to vanish from the display. One dice-block div per tag.
function diceTxt(t){var ms=String(t||"").match(/\[DICE:([^\]]+)\]/g);if(!ms)return"";var out="",di;for(di=0;di<ms.length;di++){var mm=ms[di].match(/\[DICE:([^\]]+)\]/);if(!mm)continue;var p=mm[1].split("|");var lbl=p[0]?'<span style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);margin-right:8px;">'+p[0]+'</span>':'';out+='<div class="dice-block">'+lbl+'d20: <strong>'+(p[1]||"?")+'</strong>'+(p[2]?" -- "+p[2]:"")+'</div>';}return out;}
// Builds the suggested-action buttons. PRIMARY: the structured [ACTIONS:a|b|c] tag, read
// from the RAW response (cleanTxt has already stripped it from `clean`). FALLBACK: the legacy
// prose "*You could ...*" line, so messages stored before the tag format still render on reload.
function parseActions(clean,raw){
  var btns="",acts=[],i;
  var tag=raw?raw.match(/\[ACTIONS:(.+)\]/i):null; // greedy to the last ] on the line, so an action containing a bracket still parses
  if(tag){
    var parts=tag[1].split("|");
    for(i=0;i<parts.length;i++){var pt=parts[i].trim().replace(/^[(\[]?[A-C][)\].:]\s*/,"").replace(/\*/g,"").trim();if(pt.length>1&&acts.length<3)acts.push(pt);}
  }
  if(!acts.length){
    // Tolerant: the model used the pipe-bracket format but DROPPED the ACTIONS: prefix (common on
    // non-Claude models), e.g. "You could... [a|b|c]". Match a trailing bracket containing pipes,
    // with an optional "You could" lead-in, and strip the whole thing from the displayed prose.
    var pb=clean.match(/(?:you could[\s.…]*)?\[([^\]\n]+\|[^\]\n]+)\]\.?\s*$/i);
    if(pb){var pbp=pb[1].split("|"),pj;for(pj=0;pj<pbp.length;pj++){var pbx=pbp[pj].trim().replace(/^[(\[]?[A-C][)\].:]\s*/,"").replace(/\*/g,"").trim();if(pbx.length>1&&acts.length<3)acts.push(pbx);}if(acts.length)clean=clean.replace(pb[0],"").trim();}
  }
  if(!acts.length){
    // Legacy prose suggestion line (pre-[ACTIONS:] saves). Three passes: canonical *You could …*,
    // any trailing italic line with semicolons, then a bare un-asterisked "You could …;…".
    var match=clean.match(/\*You could (.+?)\*\.?\s*$/i);
    if(!match)match=clean.match(/\*([^*\n]+;[^*\n]+)\*\.?\s*$/);
    if(!match)match=clean.match(/You could ([^\n]*;[^\n]*?)\.?\s*$/i);
    if(match){
      var hasSemi=match[1].indexOf(";")>=0;
      var rawp=hasSemi?match[1].split(/;\s*(?:or\s+)?/):match[1].split(/,\s*or\s+|\s+or\s+/);
      for(i=0;i<rawp.length;i++){var a=rawp[i].trim().replace(/^or\s+/i,"").replace(/^you\s+(?:could|might|can|may)\s+/i,"").replace(/[.*]$/,"").replace(/\*\*?/g,"").replace(/^[(\[]?[A-C][)\].:]\s*/,"").trim();if(a.length>2)acts.push(a);}
      clean=clean.replace(match[0],"").trim(); // strip the legacy line from the displayed prose
    }
  }
  if(acts.length){btns='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';for(i=0;i<acts.length;i++){var _ea=escHtml(acts[i]);btns+='<button class="qa" title="Tap to edit · hold or Ctrl-click to send" onclick="sendSuggestedAction(this,event)" data-action="'+_ea+'">'+_ea+'</button>';}btns+='</div>';}/* escape action text (audit E81) */
  return{clean:clean,btns:btns};
}
function bondToast(owner,entity,desc,kind){var p=owner?owner+" bond":"Bond";if(kind==="ended")showToast(p+" ended: "+entity);else showToast(p+(kind==="updated"?" updated":"")+": "+entity+" -- "+desc);}
function findCompanionChar(name){
  if(!worldState||!worldState.npcs)return null;
  // Resolve aliases / short forms (audit E16) — a COMPANION_* tag addressed as "Hemlock" must reach
  // the companion registered as "Sheriff Belor Hemlock", the same way NPC/PARTY_MEMBER tags do.
  var raw=name.trim().toLowerCase();
  var canon=(typeof resolveNpcName==="function")?resolveNpcName(name.trim()).toLowerCase():raw;
  var i;for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];if(npc.partyMember&&npc.charSheet){var nn=npc.name.toLowerCase();if(nn===raw||nn===canon)return npc.charSheet;}}
  // Backstop (audit P2 remedy b): the name DOES match a party member, but they have no charSheet —
  // the COMPANION_* update is about to be dropped. Make that loud instead of silent (no-silent-failures);
  // dedupe once per name per response (map cleared at the top of applyMuts).
  for(i=0;i<worldState.npcs.length;i++){var np2=worldState.npcs[i];if(np2.partyMember&&!np2.charSheet){var nn2=np2.name.toLowerCase();if(nn2===raw||nn2===canon){warnSheetlessCompanion(np2.name);break;}}}
  return null;
}
var _sheetlessWarned={};
function warnSheetlessCompanion(name){
  if(_sheetlessWarned[name])return;_sheetlessWarned[name]=1;
  if(typeof console!=="undefined")console.warn("[companion] "+name+" is a party member without a character sheet — COMPANION_* update dropped");
  if(typeof showToast==="function")showToast("⚠ "+name+" has no character sheet yet — companion update dropped.");
}
// True for a pronoun pair like "he/him", "she/her", "they/them" (incl. common neopronouns).
// Whitelisted tokens so real relations like "ally/foe" don't false-positive.
function isPronounStr(s){return /^\s*(he|she|they|it|ze|zie|xe|fae|ey|per)\s*\/\s*(him|her|them|it|its|hir|zir|xem|faer|em|per)\s*$/i.test(s||"");}
// Inventory stacks via a trailing " xN" suffix: gaining a duplicate increments the count instead of
// pushing a second entry; losing decrements (and drops the suffix at 1). Genuine repeat pickups (5x
// poison arrow) collapse to one "Poison arrow x5" line.
// Stack-matching tolerates case, extra whitespace, and a trailing plural "s" (so "Travel ration",
// "travel rations", and "Saddle"/"Saddles" stack) — but NOT parenthetical qualifiers: "Sword (rusty)"
// and "Sword (enchanted)" are distinct and must stay separate. A trailing " xN" count is stripped first.
function _invNorm(s){return (s||"").replace(/\s*x\d+\s*$/i,"").toLowerCase().replace(/\s+/g," ").trim().replace(/s$/,"");}
function _invCount(s){var m=(s||"").match(/\sx(\d+)\s*$/i);return m?parseInt(m[1],10):1;}
function _invBase(s){return (s||"").replace(/\s*x\d+\s*$/i,"").trim();}
// P14: a quantity baked into an item TAG ("Rope x3") means N of the base item, not one item
// literally named "Rope x3" — without this, gaining "Rope x3" onto an existing "Rope" stack
// stepped the count to x2 instead of x4, and losing "Rope x2" removed only one. The x must be
// a separate token (whitespace before, single digit 2-9 after) so names that merely end in x
// ("Potion of Hex") are never mangled.
function _qtyParse(name){var m=(name||"").trim().match(/^(.*\S)\s+x([2-9])$/i);return m?{base:m[1],n:parseInt(m[2],10)}:{base:(name||"").trim(),n:1};}
function addInventoryItem(inv,name){var t=_invNorm(name),i;
  for(i=0;i<inv.length;i++){if(_invNorm(inv[i])===t){inv[i]=_invBase(inv[i])+" x"+(_invCount(inv[i])+1);return;}}
  inv.push(name);
}
function removeInventoryItem(inv,name){var t=_invNorm(name),i;
  for(i=0;i<inv.length;i++){if(_invNorm(inv[i])===t){var n=_invCount(inv[i])-1;if(n<=0)inv.splice(i,1);else if(n===1)inv[i]=_invBase(inv[i]);else inv[i]=_invBase(inv[i])+" x"+n;return true;}}
  return false;
}
function applyMuts(text){
  var muts=[],turn=worldState.turn;
  _sheetlessWarned={};// per-response dedupe window for the sheet-less companion warning (audit P2)
  var hpTags=text.match(/\[HP:\s*([+-]?\d+)[^\]]*\]/g)||[];var hpi;for(hpi=0;hpi<hpTags.length;hpi++){var hpm=hpTags[hpi].match(/\[HP:\s*([+-]?\d+)[^\]]*\]/);if(!hpm)continue;var dv=parseInt(hpm[1]);worldState.character.hp=Math.min(worldState.character.maxHp,Math.max(0,worldState.character.hp+dv));muts.push(dv>0?"Healed "+dv+" HP":"Took "+Math.abs(dv)+" damage");}
  var goldTags=text.match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/g)||[];var gli;for(gli=0;gli<goldTags.length;gli++){var glm=goldTags[gli].match(/\[GOLD:\s*([+-]?\d+)[^\]]*\]/);if(!glm)continue;var dg=parseInt(glm[1]);worldState.character.gold=Math.max(0,worldState.character.gold+dg);muts.push(dg>0?"+"+dg+" gp":dg+" gp");}
  var igTags=text.match(/\[ITEM_GAINED:([^\]]+)\]/g)||[];var igi;for(igi=0;igi<igTags.length;igi++){var igm=igTags[igi].match(/\[ITEM_GAINED:([^\]]+)\]/);if(!igm)continue;var igq=_qtyParse(igm[1]),igqi;for(igqi=0;igqi<igq.n;igqi++)addInventoryItem(worldState.character.inventory,igq.base);muts.push("+"+igq.base+(igq.n>1?" x"+igq.n:""));autoTakeLocationItem(igq.base);}/* P14: "Rope x3" → 3 × Rope */
  var ilTags=text.match(/\[ITEM_LOST:([^\]]+)\]/g)||[];var ili;for(ili=0;ili<ilTags.length;ili++){var ilm=ilTags[ili].match(/\[ITEM_LOST:([^\]]+)\]/);if(!ilm)continue;var ilq=_qtyParse(ilm[1]),ilqi;for(ilqi=0;ilqi<ilq.n;ilqi++)removeInventoryItem(worldState.character.inventory,ilq.base);muts.push("-"+ilq.base+(ilq.n>1?" x"+ilq.n:""));}/* P14: "Rope x2" removes up to 2 copies */
  // fileLocation reads worldState.world.location as the PREVIOUS node to record a travel edge, so it
  // must run BEFORE we overwrite it — otherwise prev===dest and no edge is ever recorded (was the bug).
  var loc=text.match(/\[LOCATION:([^\]]+)\]/);if(loc){var _lname=loc[1].trim();/* trim so a leading space doesn't fork the map node (audit E52) */var _prevLoc=worldState.world.location;fileLocation(_lname,"",turn);worldState.world.location=_lname;worldState.world.sublocation=null;muts.push("-> "+_lname);
    // F2 (audit playthrough v1.214): a WORLD-location change means any active fight is over — the
    // party has traveled away. The GM often narrates a foe fleeing / breaking off / a truce without
    // emitting [COMBAT_END:], so worldState.combat (and the combat panel) went stale for ~13 turns.
    // The kill-safety-net below only catches 0-HP corpses, not disengagement. Clear it here, unless
    // this same response opens a fresh fight (COMBAT_START below overwrites it anyway).
    if(worldState.combat&&_lname!==_prevLoc&&!/\[COMBAT_START:/.test(text)){var _staleFoe=worldState.combat.name;worldState.combat=null;muts.push("Combat ended (left the area)");if(typeof console!=="undefined")console.warn("[combat] auto-cleared stale combat ("+_staleFoe+") on move to "+_lname+" — GM emitted no [COMBAT_END:]");}}
  // SUBLOCATION / SUBLOCATION_LEAVE run BEFORE LOCATION_DESC/LOCATION_SIZE (audit E9): a first-visit
  // sub-location described in the same response would otherwise file its desc/size to the PARENT node
  // (world.sublocation not yet set) — write-once, so permanently poisoning the parent or losing the
  // sub-node's desc. Mirrors the LOCATION-before-DESC ordering already established above.
  var sloctag=text.match(/\[SUBLOCATION:([^\]]+)\]/);if(sloctag){worldState.world.sublocation=sloctag[1].trim();fileSubLocation(sloctag[1].trim(),turn);muts.push("Sub: "+sloctag[1].trim());}
  if(/\[SUBLOCATION_LEAVE\]/.test(text)){worldState.world.sublocation=null;muts.push("Left sub-location");}
  // TIME / WEATHER (audit R2): the world clock has no engine advancement — only these tags and the
  // Sync modal move it. Free-text values (e.g. "dawn", "late night", "heavy rain") matching how
  // world.time/weather were seeded at game start and are edited in the Sync modal.
  var timeTag=text.match(/\[TIME:([^\]]+)\]/);if(timeTag){worldState.world.time=timeTag[1].trim();muts.push("Time: "+timeTag[1].trim());}
  var wxTag=text.match(/\[WEATHER:([^\]]+)\]/);if(wxTag){worldState.world.weather=wxTag[1].trim();muts.push("Weather: "+wxTag[1].trim());}
  var ldesc=text.match(/\[LOCATION_DESC:([^\]]+)\]/);if(ldesc)fileLocationDesc(ldesc[1]);
  var lsize=text.match(/\[LOCATION_SIZE:([^|]+)\|([^\]]+)\]/);if(lsize){var lsKey=worldState.world.sublocation?worldState.world.location+"|"+worldState.world.sublocation:worldState.world.location;if(memory.map&&memory.map.nodes[lsKey]){memory.map.nodes[lsKey].size=lsize[1].trim();memory.map.nodes[lsKey].travelMins=parseInt(lsize[2])||null;}}
  var locItms=text.match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/g)||[];var lii;for(lii=0;lii<locItms.length;lii++){var lip=locItms[lii].match(/\[LOCATION_ITEM:([^|]+)\|(placed|taken)\]/);if(!lip)continue;fileLocationItem(lip[1].trim(),lip[2],turn);muts.push(lip[2]==="placed"?"Left: "+lip[1].trim():"Taken: "+lip[1].trim());}
  // NPC_ALIAS — register before NPC tags so aliases resolve in the same turn
  var npcAliasTags=text.match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/g)||[];var alii;for(alii=0;alii<npcAliasTags.length;alii++){var alp=npcAliasTags[alii].match(/\[NPC_ALIAS:([^|\]]+)\|([^\]]+)\]/);if(!alp)continue;var alCanon=alp[1].trim(),alAlias=alp[2].trim();if(!memory.npcs[alCanon])memory.npcs[alCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[alCanon].aliases)memory.npcs[alCanon].aliases=[];if(memory.npcs[alCanon].aliases.indexOf(alAlias)<0)memory.npcs[alCanon].aliases.push(alAlias);var wsali;for(wsali=0;wsali<worldState.npcs.length;wsali++){if(worldState.npcs[wsali].name===alCanon){if(!worldState.npcs[wsali].aliases)worldState.npcs[wsali].aliases=[];if(worldState.npcs[wsali].aliases.indexOf(alAlias)<0)worldState.npcs[wsali].aliases.push(alAlias);break;}}muts.push("Alias: "+alAlias+" -> "+alCanon);}
  // NPC_MERGE — absorb duplicate into canonical, clean up relationships
  var npcMergeTags=text.match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/g)||[];var mgii;for(mgii=0;mgii<npcMergeTags.length;mgii++){var mgp=npcMergeTags[mgii].match(/\[NPC_MERGE:([^|\]]+)\|([^\]]+)\]/);if(!mgp)continue;var mgCanon=mgp[1].trim(),mgDupe=mgp[2].trim();if(memory.npcs[mgDupe]){if(!memory.npcs[mgCanon])memory.npcs[mgCanon]={attitude:"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[mgCanon].aliases)memory.npcs[mgCanon].aliases=[];if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);var mgevs=memory.npcs[mgDupe].events||[],mgevi;for(mgevi=0;mgevi<mgevs.length;mgevi++)memory.npcs[mgCanon].events.push(mgevs[mgevi]);var mgkns=memory.npcs[mgDupe].knowledge||[],mgkni;for(mgkni=0;mgkni<mgkns.length;mgkni++){if(memory.npcs[mgCanon].knowledge.indexOf(mgkns[mgkni])<0)memory.npcs[mgCanon].knowledge.push(mgkns[mgkni]);}if(memory.npcs[mgDupe].aliases){var mgals=memory.npcs[mgDupe].aliases,mgali;for(mgali=0;mgali<mgals.length;mgali++){if(memory.npcs[mgCanon].aliases.indexOf(mgals[mgali])<0)memory.npcs[mgCanon].aliases.push(mgals[mgali]);}}if(!memory.npcs[mgCanon].firstEncounter&&memory.npcs[mgDupe].firstEncounter)memory.npcs[mgCanon].firstEncounter=memory.npcs[mgDupe].firstEncounter;delete memory.npcs[mgDupe];}
    // Graft the dupe's worldState-side data onto canonical before removing it (audit E10) — partyMember,
    // charSheet, portrait, pronouns lived only on the worldState entry and were silently dropped,
    // ejecting a companion recruited under the short name and deleting their whole sheet.
    var _mgDupN=null,_mgCanN=null,_mgi;for(_mgi=0;_mgi<worldState.npcs.length;_mgi++){if(worldState.npcs[_mgi].name===mgDupe)_mgDupN=worldState.npcs[_mgi];else if(worldState.npcs[_mgi].name===mgCanon)_mgCanN=worldState.npcs[_mgi];}
    if(_mgDupN){
      if(!_mgCanN){_mgCanN={name:mgCanon,status:_mgDupN.status||"unknown",rel:_mgDupN.rel||"unknown",met:_mgDupN.met||turn,partyMember:false,portrait:null,aliases:[]};worldState.npcs.push(_mgCanN);}
      if(_mgDupN.partyMember)_mgCanN.partyMember=true;
      if(_mgDupN.charSheet&&!_mgCanN.charSheet)_mgCanN.charSheet=_mgDupN.charSheet;
      if(_mgDupN.portrait&&!_mgCanN.portrait)_mgCanN.portrait=_mgDupN.portrait;
      if(_mgDupN.portraitOffset&&!_mgCanN.portraitOffset)_mgCanN.portraitOffset=_mgDupN.portraitOffset;
      if(_mgDupN.pronouns&&!_mgCanN.pronouns)_mgCanN.pronouns=_mgDupN.pronouns;
      if((!_mgCanN.status||_mgCanN.status==="unknown")&&_mgDupN.status)_mgCanN.status=_mgDupN.status;
      if((!_mgCanN.rel||_mgCanN.rel==="unknown")&&_mgDupN.rel)_mgCanN.rel=_mgDupN.rel;
      if(typeof _mgDupN.met==="number"&&(typeof _mgCanN.met!=="number"||_mgDupN.met<_mgCanN.met))_mgCanN.met=_mgDupN.met;
    }
    worldState.npcs=worldState.npcs.filter(function(n){return n.name!==mgDupe;});
    // Re-key npcGraph edges + faction memberships dupe -> canonical (audit E31) so the merged NPC
    // stops rendering as a separate person in the NPC GRAPH block.
    if(memory.npcGraph){var _mge=memory.npcGraph.edges||[],_mgei;for(_mgei=0;_mgei<_mge.length;_mgei++){if(_mge[_mgei].a===mgDupe)_mge[_mgei].a=mgCanon;if(_mge[_mgei].b===mgDupe)_mge[_mgei].b=mgCanon;}var _mgnf=memory.npcGraph.npcFactions;if(_mgnf&&_mgnf[mgDupe]){if(!_mgnf[mgCanon])_mgnf[mgCanon]=_mgnf[mgDupe];else _mgnf[mgCanon]=_mgnf[mgCanon].concat(_mgnf[mgDupe]);delete _mgnf[mgDupe];}}if(worldState.character.relationships){var rgj,newRels2=[],seenRel={};for(rgj=0;rgj<worldState.character.relationships.length;rgj++){var rent=worldState.character.relationships[rgj].entity;if(rent===mgDupe)worldState.character.relationships[rgj].entity=mgCanon;var rkey=worldState.character.relationships[rgj].entity;if(!seenRel[rkey]){seenRel[rkey]=true;newRels2.push(worldState.character.relationships[rgj]);}}worldState.character.relationships=newRels2;}muts.push("Merged: "+mgDupe+" -> "+mgCanon);}
  // First-encounter snippet — computed once per response, lazily (cleanTxt is ~40 regex passes).
  // Strips the trailing suggestion line and cuts at a sentence boundary so the stored
  // prose reads clean. Written once per NPC, never overwritten.
  var feSnip=null;
  function feGet(){if(feSnip===null){var ft=cleanTxt(text).replace(/\*You could[\s\S]*$/,"").trim().slice(0,280);var fb=Math.max(ft.lastIndexOf(". "),ft.lastIndexOf("! "),ft.lastIndexOf("? "));if(fb>60)ft=ft.slice(0,fb+1);feSnip=ft;}return feSnip;}
  // NPC tags — resolve aliases to canonical before storing.
  // name+status groups are bounded by ] ([^|\]]+) so a 2-field tag immediately followed by another
  // tag (e.g. [NPC_PRONOUN:]) can't be stitched into one over-captured match (the Lorcan corruption).
  var npcs=text.match(/\[NPC:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var ni;for(ni=0;ni<npcs.length;ni++){var np=npcs[ni].match(/\[NPC:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!np)continue;var npName=resolveNpcName(np[1].trim());/* 3rd (relation) field optional — 2-field [NPC:name|status] no longer dropped (audit E42) */
    var npStatus=clampNpcMood((np[2]||"").trim()),npRel=clampNpcMood((np[3]||"").trim()),npPron="";/* P6: roster labels, not paragraphs */
    // The GM sometimes writes a pronoun where status/relation belongs — route it to pronouns, never store it as the relation.
    if(isPronounStr(npRel)){npPron=npRel;npRel="";}
    if(isPronounStr(npStatus)){if(!npPron)npPron=npStatus;npStatus="";}
    var found=false,nj;for(nj=0;nj<worldState.npcs.length;nj++){if(worldState.npcs[nj].name===npName){if(npStatus)worldState.npcs[nj].status=npStatus;if(npRel)worldState.npcs[nj].rel=npRel;if(npPron)worldState.npcs[nj].pronouns=npPron;found=true;break;}}
    if(!found){worldState.npcs.push({name:npName,status:npStatus||"unknown",rel:npRel||"unknown",pronouns:npPron||null,met:turn,partyMember:false,portrait:null,aliases:[]});if(typeof checkLegacyCharacter==="function")checkLegacyCharacter();}// per-new-NPC legacy roll (the intended trigger; previously only ran once on page load)
    if(!memory.npcs[npName])memory.npcs[npName]={attitude:npRel||"unknown",knowledge:[],events:[],aliases:[]};if(!memory.npcs[npName].firstEncounter)memory.npcs[npName].firstEncounter=feGet();if(npRel)memory.npcs[npName].attitude=npRel;if(npPron)memory.npcs[npName].pronouns=npPron;mapNpcLocation(npName);muts.push("NPC: "+npName);}
  // Tolerate a leading "+" and trailing junk ([XP:+25 xp]) — same loosening as GOLD/HP (audit #7);
  // an unparsed XP tag is stripped by cleanTxt and the award vanished with no visible symptom.
  // Companion XP parity (v1.172): party XP is SHARED — every companion automatically earns what
  // the player earns. The GM almost never emitted COMPANION_XP on its own (t198: player 37,350 XP,
  // companions ~23,000 and falling behind until keeping them "doesn't make sense" — user call
  // 2026-07-04), so the engine mirrors every [XP:N] to all party companions. A [COMPANION_XP:Name|N]
  // in the SAME response supersedes the mirror for that companion (individual award, no double-count).
  var _xpSkip=null;
  function _xpMirror(n){
    if(_xpSkip===null){_xpSkip=[];var _mt=text.match(/\[COMPANION_XP:([^|\]]+)\|/g)||[],_mi;for(_mi=0;_mi<_mt.length;_mi++){var _mm=_mt[_mi].match(/\[COMPANION_XP:([^|\]]+)\|/);if(_mm){var _mcs=findCompanionChar(_mm[1].trim());if(_mcs)_xpSkip.push(_mcs);}}}
    var _pi2,_shared=0;
    for(_pi2=0;_pi2<worldState.npcs.length;_pi2++){var _pn2=worldState.npcs[_pi2];
      if(!_pn2.partyMember||!_pn2.charSheet)continue;
      if(_xpSkip.indexOf(_pn2.charSheet)>=0)continue;
      if(typeof _pn2.charSheet.xp!=="number")_pn2.charSheet.xp=0;
      _pn2.charSheet.xp+=n;_shared++;checkCompanionLevelUp(_pn2.charSheet);
    }
    if(_shared)muts.push("party +"+n+" XP");
  }
  var xpTags=text.match(/\[XP:\s*\+?(\d+)[^\]]*\]/g)||[];var xpi;for(xpi=0;xpi<xpTags.length;xpi++){var xpm=xpTags[xpi].match(/\[XP:\s*\+?(\d+)[^\]]*\]/);if(!xpm)continue;worldState.character.xp+=parseInt(xpm[1]);muts.push("+"+xpm[1]+" XP");checkLevelUp();_xpMirror(parseInt(xpm[1]));}
  // [QUEST:title|status] or [QUEST:title|status|desc]. status: offered|active|completed|failed.
  var quests=text.match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var qi;for(qi=0;qi<quests.length;qi++){var qp=quests[qi].match(/\[QUEST:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!qp)continue;var qTitle=qp[1].trim(),qStat=qp[2].trim().toLowerCase(),qDesc=qp[3]?qp[3].trim():"";if(qStat==="complete"||qStat==="done"||qStat==="finished")qStat="completed";else if(qStat==="abandoned"||qStat==="dropped")qStat="failed";else if(qStat==="accepted")qStat="active";else if(qStat==="declined")qStat="failed";/* synonyms that would otherwise vanish from the authoritative prompt block (audit E30) */var qIdx=-1,qj;for(qj=0;qj<worldState.questLog.length;qj++){if(worldState.questLog[qj].title.toLowerCase()===qTitle.toLowerCase()){qIdx=qj;break;}}if(qIdx<0){worldState.questLog.push({title:qTitle,status:qStat,desc:qDesc,objectives:[],started:turn});if(qStat==="offered"){if(typeof showToast==="function")showToast("⚑ Quest opportunity: "+qTitle);muts.push("Quest offered: "+qTitle);}else muts.push("Quest: "+qTitle+" ("+qStat+")");}else{var qq=worldState.questLog[qIdx];qq.status=qStat;if(qDesc)qq.desc=qDesc;muts.push("Quest "+qTitle+": "+qStat);}if(qStat==="completed"||qStat==="failed")archiveQuest(qTitle,qStat);}
  // [QUEST_STEP:title|objective|done] — add an objective or set its done state
  var qsteps=text.match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/g)||[];var qsi;for(qsi=0;qsi<qsteps.length;qsi++){var qsp=qsteps[qsi].match(/\[QUEST_STEP:([^|\]]+)\|([^|\]]+)\|?([^\]]*)\]/);if(!qsp)continue;var qsTitle=qsp[1].trim(),qsObj=qsp[2].trim(),qsDone=/^(true|done|1|yes|x)$/i.test((qsp[3]||"").trim());var qsq=null,qk;for(qk=0;qk<worldState.questLog.length;qk++){if(worldState.questLog[qk].title.toLowerCase()===qsTitle.toLowerCase()){qsq=worldState.questLog[qk];break;}}if(!qsq)continue;if(qsq.status==="offered")continue;/* engine backstop: never advance an unaccepted quest (audit #14) */if(!qsq.objectives)qsq.objectives=[];var ofound=false,oj2;for(oj2=0;oj2<qsq.objectives.length;oj2++){if(qsq.objectives[oj2].text.toLowerCase()===qsObj.toLowerCase()){qsq.objectives[oj2].done=qsDone;ofound=true;break;}}if(!ofound)qsq.objectives.push({text:qsObj,done:qsDone});muts.push(qsTitle+(qsDone?" ✓ ":" + ")+qsObj);}
  // Morale is free text (e.g. "fights to the death"), not one word — the old (\w+) silently killed
  // the whole COMBAT_START, so the fight went untracked (audit E17). Tolerate any non-] payload.
  var cs2=text.match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/);if(cs2){worldState.combat={name:cs2[1].trim(),hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5].trim(),morale:cs2[6].trim(),round:1};muts.push("Combat: "+cs2[1].trim());}
  var cstats=text.match(/\[COMBAT_STATS:STR:(\d+)\|DEX:(\d+)\|CON:(\d+)\|INT:(\d+)\|WIS:(\d+)\|CHA:(\d+)\|CR:([0-9.\/]+)\]/);if(cstats&&worldState.combat){worldState.combat.stats={STR:+cstats[1],DEX:+cstats[2],CON:+cstats[3],INT:+cstats[4],WIS:+cstats[5],CHA:+cstats[6],CR:cstats[7]};}
  var cimm=text.match(/\[COMBAT_IMMUNE:([^\]]+)\]/);if(cimm&&worldState.combat){worldState.combat.immune=cimm[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
  var cresist=text.match(/\[COMBAT_RESIST:([^\]]+)\]/);if(cresist&&worldState.combat){worldState.combat.resist=cresist[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
  var cvuln=text.match(/\[COMBAT_VULN:([^\]]+)\]/);if(cvuln&&worldState.combat){worldState.combat.vuln=cvuln[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s&&s.toLowerCase()!=="none";});}
  var ehp=text.match(/\[ENEMY_HP:\s*([+-]?\d+)[^\]]*\]/);if(ehp&&worldState.combat){worldState.combat.hp=Math.max(0,worldState.combat.hp+parseInt(ehp[1]));}/* tolerate trailing text like "-8 slashing" (audit E17) */
  var cr=text.match(/\[COMBAT_ROUND:(\d+)\]/);if(cr&&worldState.combat)worldState.combat.round=parseInt(cr[1]);
  var ce=text.match(/\[COMBAT_END:([^\]]+)\]/);if(ce){worldState.combat=null;muts.push("Combat: "+ce[1].trim());}/* tolerate multi-word outcomes like "enemy fled" (audit E17) */
  // Safety net: the GM sometimes narrates a kill without emitting [COMBAT_END:], leaving a
  // 0-HP corpse in the panel indefinitely. Auto-clear once HP hits 0, unless this same
  // response already closed combat explicitly above.
  else if(worldState.combat&&worldState.combat.hp<=0){var deadName=worldState.combat.name;worldState.combat=null;muts.push("Combat: victory ("+deadName+")");}
  var abs=text.match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var abi;for(abi=0;abi<abs.length;abi++){var abp=abs[abi].match(/\[ABILITY_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!abp)continue;if(!worldState.character.abilities)worldState.character.abilities=[];var already=false,abj;for(abj=0;abj<worldState.character.abilities.length;abj++){if(worldState.character.abilities[abj].nm===abp[1]){already=true;break;}}if(!already){worldState.character.abilities.push({nm:abp[1],ds:abp[2],gained:turn});muts.push("Ability: "+abp[1]);}}
  var alms=text.match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\[ALIGNMENT:(law|good)([+-]\d+)\]/i);if(ap){if(!worldState.character.alignLaw)worldState.character.alignLaw=0;if(!worldState.character.alignGood)worldState.character.alignGood=0;if(ap[1].toLowerCase()==="law")worldState.character.alignLaw=Math.max(-3,Math.min(3,worldState.character.alignLaw+parseInt(ap[2])));else worldState.character.alignGood=Math.max(-3,Math.min(3,worldState.character.alignGood+parseInt(ap[2])));var newAl=alignLabel(worldState.character.alignLaw,worldState.character.alignGood);if(newAl!==worldState.character.actualAlignment){muts.push("Align: "+newAl);worldState.character.actualAlignment=newAl;}}}
  var spellUsed=text.match(/\[SPELL_USED:([^\]]+)\]/g)||[];var sui;for(sui=0;sui<spellUsed.length;sui++){var sup=spellUsed[sui].match(/\[SPELL_USED:([^\]]+)\]/);if(sup&&worldState.character.spells){var spNm=sup[1].toLowerCase().trim(),spj;for(spj=0;spj<worldState.character.spells.length;spj++){var sp=worldState.character.spells[spj];if(sp.lvl===0)continue;// cantrips never expend
var spBase=sp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();if(spBase===spNm||sp.nm.toLowerCase()===spNm){sp.used=true;muts.push("Spell used: "+sp.nm);break;}}}}
  // SPELL_DEF (TODO #10) — the GM canonizes an INVENTED or homebrew spell (one not in the
  // CANONICAL SPELL RULES list) ONCE into the per-campaign overlay worldState.capabilityBible, which
  // capabilityLookup already prefers over the static base. Write-once (LOCATION_DESC pattern) so a
  // spell cannot re-drift via redefinition. Format: [SPELL_DEF:Name|range=X|targets=Y|duration=Z|
  // effect=...|cost=slot|tier=1|save=...|magical=yes] — '=' per field, '|' between fields.
  var spellDefs=text.match(/\[SPELL_DEF:([^\]]+)\]/g)||[];var sdi;for(sdi=0;sdi<spellDefs.length;sdi++){
    var sdm=spellDefs[sdi].match(/\[SPELL_DEF:([^\]]+)\]/);if(!sdm)continue;
    var sdParts=sdm[1].split("|"),sdName=(sdParts[0]||"").trim();if(!sdName||typeof capBaseName!=="function")continue;
    var sdKey=capBaseName(sdName);if(!worldState.capabilityBible)worldState.capabilityBible={};
    if(worldState.capabilityBible[sdKey])continue;// write-once: first definition wins, never overwritten
    var sdEntry={kind:"spell",tier:0,cost:"at-will",isMagical:true,range:"",targets:"",duration:"",effect:""},sdp;
    for(sdp=1;sdp<sdParts.length;sdp++){var kv=sdParts[sdp].split("=");if(kv.length<2)continue;var kk=kv[0].trim().toLowerCase(),vv=kv.slice(1).join("=").trim();
      if(kk==="range")sdEntry.range=vv;else if(kk==="targets"||kk==="target")sdEntry.targets=vv;else if(kk==="duration")sdEntry.duration=vv;else if(kk==="effect")sdEntry.effect=vv;else if(kk==="cost")sdEntry.cost=vv;else if(kk==="tier")sdEntry.tier=parseInt(vv)||0;else if(kk==="save")sdEntry.save=vv;else if(kk==="dice")sdEntry.dice=vv;else if(kk==="magical")sdEntry.isMagical=/^\s*(y|t|1|true)/i.test(vv);}
    worldState.capabilityBible[sdKey]=sdEntry;muts.push("Spell canon defined: "+sdName);
  }
  // [REST:long] — the party completes a full rest. restSpells() restores expended (non-cantrip)
  // slots party-wide (audit P10 tail): the P10 rule tells the GM a used 1/day spell can't be recast
  // before a rest, but until this tag the ONLY thing that reset slots was the Rest button — so a
  // narrative long rest left Hunter's Mark permanently expended. HP recovery stays GM-narrated via
  // [HP:]; this closes only the spell-slot side. [REST:short] is accepted as a no-op for now.
  if(/\[REST:\s*long\b[^\]]*\]/i.test(text)&&typeof restSpells==="function"){restSpells();muts.push("Rest: spell slots restored");}
  var lores=text.match(/\[LORE:([^\]]+)\]/g)||[];for(var li=0;li<lores.length;li++){var lp=lores[li].match(/\[LORE:([^\]]+)\]/);if(lp)fileLore(lp[1]);}
  var decs=text.match(/\[DECISION:([^\]]+)\]/g)||[];for(var di=0;di<decs.length;di++){var dp=decs[di].match(/\[DECISION:([^\]]+)\]/);if(dp)fileDecision(turn,dp[1]);}
  var fes=text.match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/g)||[];for(var fi=0;fi<fes.length;fi++){var fp=fes[fi].match(/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/);if(fp)fileFutureEvent(fp[2],"",fp[1],turn);}
  var fres=text.match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/g)||[];var fri;for(fri=0;fri<fres.length;fri++){var frp=fres[fri].match(/\[FUTURE_EVENT_RESOLVED:([^\]]+)\]/);if(frp)resolveFutureEvent(frp[1]);}
  var nns=text.match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/g)||[];for(var nni=0;nni<nns.length;nni++){var nnp=nns[nni].match(/\[NPC_NOTE:([^|\]]+)\|([^\]]+)\]/);if(nnp)fileNpcEvent(nnp[1],nnp[2],turn);}
  // [NPC_FORGET:name|person or event] — Oubliate: scrub a specific memory from an NPC so it stops re-injecting
  var forgets=text.match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/g)||[];var fgi;for(fgi=0;fgi<forgets.length;fgi++){var fgp=forgets[fgi].match(/\[NPC_FORGET:([^|\]]+)\|([^\]]+)\]/);if(!fgp)continue;var fgName=resolveNpcName(fgp[1].trim()),fgWhat=fgp[2].trim().toLowerCase();var fgNpc=memory.npcs[fgName];if(!fgNpc)continue;var fgRem=0;if(fgNpc.knowledge){var fgkb=fgNpc.knowledge.length;fgNpc.knowledge=fgNpc.knowledge.filter(function(k){return String(k).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgkb-fgNpc.knowledge.length;}if(fgNpc.events){var fgeb=fgNpc.events.length;fgNpc.events=fgNpc.events.filter(function(e){return String(e&&e.note!==undefined?e.note:e).toLowerCase().indexOf(fgWhat)<0;});fgRem+=fgeb-fgNpc.events.length;}muts.push(fgName+" forgets: "+fgp[2].trim()+(fgRem?" ("+fgRem+")":""));}
  var nprons=text.match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/g)||[];for(var pni=0;pni<nprons.length;pni++){var pnp=nprons[pni].match(/\[NPC_PRONOUN:([^|\]]+)\|([^\]]+)\]/);if(pnp){var pname=resolveNpcName(pnp[1]),ppron=pnp[2],pfound=false,pnj;for(pnj=0;pnj<worldState.npcs.length;pnj++){if(worldState.npcs[pnj].name===pname){worldState.npcs[pnj].pronouns=ppron;pfound=true;break;}}if(!pfound)worldState.npcs.push({name:pname,status:"unknown",rel:"unknown",pronouns:ppron,met:turn,partyMember:false,portrait:null,aliases:[]});if(memory.npcs[pname])memory.npcs[pname].pronouns=ppron;else memory.npcs[pname]={attitude:"unknown",knowledge:[],events:[],aliases:[],pronouns:ppron};muts.push("Pronouns: "+pname+" ("+ppron+")");}}
  // NPC_LINK — relationship between two named entities
  var npcLinks=text.match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nli;for(nli=0;nli<npcLinks.length;nli++){var nlp=npcLinks[nli].match(/\[NPC_LINK:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nlp)continue;var _plName=(worldState.character&&worldState.character.name)||"player";var _plMap=function(n){return /^player$/i.test(n)?_plName:n;};var nlA=resolveNpcName(_plMap(nlp[1].trim())),nlB=resolveNpcName(_plMap(nlp[2].trim())),nlRel=nlp[3].trim();npcLinkUpsert(nlA,nlB,nlRel);muts.push("Link: "+nlA+" ↔ "+nlB+" ("+nlRel+")");}/* map the literal "player" to the PC name so it doesn't file a phantom NPC (audit E48) */
  // FACTION — register or update a faction
  var facTags=text.match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/g)||[];var fti;for(fti=0;fti<facTags.length;fti++){var ftp=facTags[fti].match(/\[FACTION:([^|\]]+)\|([^\]]+)\]/);if(!ftp)continue;factionUpsert(ftp[1].trim(),ftp[2].trim());muts.push("Faction: "+ftp[1].trim());}
  // NPC_FACTION — assign NPC to a faction with optional role
  var nfTags=text.match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var nfti;for(nfti=0;nfti<nfTags.length;nfti++){var nfp=nfTags[nfti].match(/\[NPC_FACTION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!nfp)continue;npcFactionSet(resolveNpcName(nfp[1].trim()),nfp[2].trim(),nfp[3].trim());muts.push(nfp[1].trim()+": "+nfp[2].trim()+" ["+nfp[3].trim()+"]");}
  // FACTION_REL — relationship between two factions
  var frTags=text.match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var frti;for(frti=0;frti<frTags.length;frti++){var frp2=frTags[frti].match(/\[FACTION_REL:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!frp2)continue;factionLinkUpsert(frp2[1].trim(),frp2[2].trim(),frp2[3].trim());muts.push("FactionRel: "+frp2[1].trim()+" ↔ "+frp2[2].trim()+" ("+frp2[3].trim()+")");}
  // Party member flag
  var pmTags=text.match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/g)||[];var pmi;for(pmi=0;pmi<pmTags.length;pmi++){var pmp=pmTags[pmi].match(/\[PARTY_MEMBER:([^|\]]+)\|([^\]]+)\]/);if(!pmp)continue;var pmName=resolveNpcName(pmp[1].trim()),pmVal=pmp[2].trim().toLowerCase()==="true",pmFoundIdx=-1,pmk;for(pmk=0;pmk<worldState.npcs.length;pmk++){if(worldState.npcs[pmk].name===pmName){pmFoundIdx=pmk;break;}}
    // Party cap backstop: refuse a join that would exceed PARTY_MAX (players+companions). Already-members and removals are never blocked.
    if(pmVal&&!(pmFoundIdx>=0&&worldState.npcs[pmFoundIdx].partyMember)&&partyCompanionCount()>=partyCompanionCap()){
      if(pmFoundIdx<0){worldState.npcs.push({name:pmName,status:"unknown",rel:"ally",met:turn,partyMember:false,portrait:null,aliases:[]});}
      else worldState.npcs[pmFoundIdx].partyMember=false;
      if(!memory.npcs[pmName])memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],aliases:[],partyMember:false};
      if(typeof showToast==="function")showToast("Party full (max "+PARTY_MAX+") — "+pmName+" can't join until someone leaves.");
      muts.push("Party full: "+pmName+" not added");continue;
    }
    if(pmFoundIdx>=0){worldState.npcs[pmFoundIdx].partyMember=pmVal;}else{worldState.npcs.push({name:pmName,status:"unknown",rel:"unknown",met:turn,partyMember:pmVal,portrait:null,aliases:[]});pmFoundIdx=worldState.npcs.length-1;}
    // Narrative-path joins arrive sheet-less (audit P2): flag for async sheet generation after the
    // turn settles (applyMuts is synchronous — no API call here; game.js processPendingCompanionSheets
    // picks the flag up, same fire-after-render pattern as generateActions). Cleared on attach/departure.
    if(pmVal&&!worldState.npcs[pmFoundIdx].charSheet)worldState.npcs[pmFoundIdx].sheetPending=true;
    else if(!pmVal)delete worldState.npcs[pmFoundIdx].sheetPending;
    if(memory.npcs[pmName])memory.npcs[pmName].partyMember=pmVal;else memory.npcs[pmName]={attitude:"unknown",knowledge:[],events:[],aliases:[],partyMember:pmVal};if(pmVal&&!memory.npcs[pmName].firstEncounter)memory.npcs[pmName].firstEncounter=feGet();muts.push(pmVal?"Party: +"+pmName:"Party: -"+pmName);}
  // Skills
  var skSuccs=text.match(/\[SKILL_SUCCESS:([^\]]+)\]/g)||[];var sski;for(sski=0;sski<skSuccs.length;sski++){var sskp=skSuccs[sski].match(/\[SKILL_SUCCESS:([^\]]+)\]/);if(!sskp)continue;var sskid=sskp[1].trim();if(!worldState.character.skills)worldState.character.skills=initSkills();
    // Resolve a case-drifted id ("stealth" -> "Stealth") against SKILLS so a lowercased tag isn't a silent no-op (audit E29).
    if(typeof worldState.character.skills[sskid]!=="number"){var _skl=sskid.toLowerCase(),_ski;for(_ski=0;_ski<SKILLS.length;_ski++){if(SKILLS[_ski].id.toLowerCase()===_skl){sskid=SKILLS[_ski].id;break;}}}
    if(typeof worldState.character.skills[sskid]==="number"){var prevLvl=skillLevel(worldState.character.skills[sskid]);worldState.character.skills[sskid]++;var newLvl=skillLevel(worldState.character.skills[sskid]);if(newLvl>prevLvl){muts.push(sskid+": "+SKILL_LEVELS[newLvl]);showToast(sskid+": "+SKILL_LEVELS[newLvl]);}else muts.push(sskid+" +1");}}
  // Conditions
  var condTags=text.match(/\[CONDITION:([^|\]]+)\|([^\]]+)\]/g)||[];var condi;for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|\]]+)\|([^\]]+)\]/);if(!condp)continue;if(!worldState.character.conditions)worldState.character.conditions=[];var cnm=condp[1].trim(),cdur=condp[2].trim(),calready=false,condj;for(condj=0;condj<worldState.character.conditions.length;condj++){if(worldState.character.conditions[condj].name.toLowerCase()===cnm.toLowerCase()){worldState.character.conditions[condj].duration=cdur;calready=true;break;}}/* case-insensitive so "Poisoned"/"poisoned" don't duplicate (E29) */if(!calready){worldState.character.conditions.push({name:cnm,duration:cdur});muts.push("Condition: "+cnm);}}
  var condRems=text.match(/\[CONDITION_REMOVED:([^\]]+)\]/g)||[];var cri2;for(cri2=0;cri2<condRems.length;cri2++){var crp2=condRems[cri2].match(/\[CONDITION_REMOVED:([^\]]+)\]/);if(!crp2)continue;if(!worldState.character.conditions)continue;var cbef=worldState.character.conditions.length,_crn=crp2[1].trim().toLowerCase();worldState.character.conditions=worldState.character.conditions.filter(function(x){return x.name.toLowerCase()!==_crn;});if(worldState.character.conditions.length<cbef)muts.push("Cured: "+crp2[1].trim());}/* case-insensitive (E29) */
  // Relationships
  var relTags=text.match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/g)||[];var reli;for(reli=0;reli<relTags.length;reli++){var relp=relTags[reli].match(/\[RELATIONSHIP:([^|\]]+)\|([^\]]+)\]/);if(!relp)continue;if(!worldState.character.relationships)worldState.character.relationships=[];var rnm=resolveNpcName(relp[1].trim()),rdsc=relp[2].trim(),rfound=false,relj;for(relj=0;relj<worldState.character.relationships.length;relj++){if(worldState.character.relationships[relj].entity===rnm){var prevRdsc=worldState.character.relationships[relj].descriptor;worldState.character.relationships[relj].descriptor=rdsc;rfound=true;if(prevRdsc!==rdsc)bondToast(null,rnm,rdsc,"updated");break;}}if(!rfound){worldState.character.relationships.push({entity:rnm,descriptor:rdsc});muts.push("Rel: "+rnm+" ("+rdsc+")");bondToast(null,rnm,rdsc,"new");}}
  var relRems=text.match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/g)||[];var rri2;for(rri2=0;rri2<relRems.length;rri2++){var rrp2=relRems[rri2].match(/\[RELATIONSHIP_REMOVED:([^\]]+)\]/);if(!rrp2)continue;if(!worldState.character.relationships)continue;var rrName=resolveNpcName(rrp2[1].trim());worldState.character.relationships=worldState.character.relationships.filter(function(x){return x.entity!==rrName;});muts.push("Rel removed: "+rrName);bondToast(null,rrName,null,"ended");}
  // Save modifiers
  var saveTags=text.match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var smi2;for(smi2=0;smi2<saveTags.length;smi2++){var smp2=saveTags[smi2].match(/\[SAVE_MOD:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!smp2)continue;if(!worldState.character.saveModifiers)worldState.character.saveModifiers=[];var ssrc=smp2[1].trim(),stype=smp2[2].trim(),sval=parseInt(smp2[3]);if(isNaN(sval))continue;var sfound=false,smj;for(smj=0;smj<worldState.character.saveModifiers.length;smj++){if(worldState.character.saveModifiers[smj].source===ssrc){worldState.character.saveModifiers[smj].type=stype;worldState.character.saveModifiers[smj].amount=sval;sfound=true;break;}}if(!sfound)worldState.character.saveModifiers.push({source:ssrc,type:stype,amount:sval});var svalStr=sval>=0?"+"+sval:""+sval;muts.push("Save "+svalStr+" vs "+stype+" ["+ssrc+"]");}
  var saveRemTags=text.match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/g)||[];var smri2;for(smri2=0;smri2<saveRemTags.length;smri2++){var smrp2=saveRemTags[smri2].match(/\[SAVE_MOD_REMOVED:([^\]]+)\]/);if(!smrp2)continue;if(!worldState.character.saveModifiers)continue;var _srn=smrp2[1].trim().toLowerCase();worldState.character.saveModifiers=worldState.character.saveModifiers.filter(function(x){return x.source.toLowerCase()!==_srn;});}/* case-insensitive (E29) */
  // Languages
  var langTags=text.match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/g)||[];var lni2;for(lni2=0;lni2<langTags.length;lni2++){var lnp2=langTags[lni2].match(/\[LANGUAGE:([^|\]]+)\|([^\]]+)\]/);if(!lnp2)continue;if(!worldState.character.languages)worldState.character.languages=[];var lname=lnp2[1].trim(),lbroken=lnp2[2].trim().toLowerCase()==="broken",lfound=false,lj2;for(lj2=0;lj2<worldState.character.languages.length;lj2++){if(worldState.character.languages[lj2].name.toLowerCase()===lname.toLowerCase()){worldState.character.languages[lj2].broken=lbroken;lfound=true;break;}}/* case-insensitive so "Elvish"/"elvish" don't duplicate (E29) */if(!lfound){worldState.character.languages.push({name:lname,broken:lbroken});muts.push((lbroken?"Broken ":"")+"Language: "+lname);}}
  // Story beats
  var beatTags=text.match(/\[STORY_BEAT:([^\]]+)\]/g)||[];var bti2;for(bti2=0;bti2<beatTags.length;bti2++){var btp2=beatTags[bti2].match(/\[STORY_BEAT:([^\]]+)\]/);if(!btp2)continue;if(!worldState.character.storyBeats)worldState.character.storyBeats=[];worldState.character.storyBeats.push({text:btp2[1],turn:turn});fileDecision(turn,"[Story Beat] "+btp2[1]);}
  // ── Campaign skeleton progression ──
  var arcDone=text.match(/\[ARC_COMPLETE:([^\]]+)\]/);
  if(arcDone&&worldState.skeleton){
    var _sk=worldState.skeleton,_ad=arcDone[1].trim(),_si,_sj;
    for(_si=0;_si<_sk.acts.length;_si++){
      if(_sk.acts[_si].status!=="active")continue;
      var _act=_sk.acts[_si],_matched=false;
      // In parallel acts, match by title; in sequential, complete the first active arc
      for(_sj=0;_sj<_act.arcs.length;_sj++){
        if(_act.arcs[_sj].status!=="active")continue;
        if(_act.parallel&&_act.arcs[_sj].title.toLowerCase()!==_ad.toLowerCase())continue;
        _act.arcs[_sj].status="completed";_matched=true;
        muts.push("Arc complete: "+_act.arcs[_sj].title);
        if(!_act.parallel&&_sj+1<_act.arcs.length){_act.arcs[_sj+1].status="active";muts.push("New arc: "+_act.arcs[_sj+1].title);}
        break;
      }
      if(_matched)break;
    }
  }
  var actDone=text.match(/\[ACT_COMPLETE:([^\]]+)\]/);
  if(actDone&&worldState.skeleton){
    var _sk2=worldState.skeleton,_si2;
    for(_si2=0;_si2<_sk2.acts.length;_si2++){
      if(_sk2.acts[_si2].status!=="active")continue;
      _sk2.acts[_si2].status="completed";
      muts.push("Act complete: "+_sk2.acts[_si2].title);
      if(_si2+1<_sk2.acts.length){
        _sk2.acts[_si2+1].status="active";
        var _fa=_sk2.acts[_si2+1].arcs,_isP=!!_sk2.acts[_si2+1].parallel;
        if(_fa&&_fa.length){for(var _fj=0;_fj<_fa.length;_fj++){if(_isP||_fj===0)_fa[_fj].status="active";}}
        muts.push("New act: "+_sk2.acts[_si2+1].title);
      }else{muts.push("Campaign complete!");}
      break;
    }
  }
  // ── Companion sheet tags (COMPANION_* prefix targets party member charSheets) ──
  var cHpTags=text.match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/g)||[];var cHpi;for(cHpi=0;cHpi<cHpTags.length;cHpi++){var cHpm=cHpTags[cHpi].match(/\[COMPANION_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);if(!cHpm)continue;var cHpCs=findCompanionChar(cHpm[1]);if(!cHpCs)continue;var cHpdv=parseInt(cHpm[2]);cHpCs.hp=Math.min(cHpCs.maxHp||cHpCs.hp,Math.max(0,cHpCs.hp+cHpdv));muts.push(cHpm[1].trim()+(cHpdv>0?" healed ":" took ")+Math.abs(cHpdv)+" HP");}
  var cIgTags=text.match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/g)||[];var cIgi;for(cIgi=0;cIgi<cIgTags.length;cIgi++){var cIgm=cIgTags[cIgi].match(/\[COMPANION_ITEM_GAINED:([^|\]]+)\|([^\]]+)\]/);if(!cIgm)continue;var cIgCs=findCompanionChar(cIgm[1]);if(!cIgCs)continue;if(!cIgCs.inventory)cIgCs.inventory=[];addInventoryItem(cIgCs.inventory,cIgm[2].trim());muts.push(cIgm[1].trim()+": +"+cIgm[2].trim());}
  var cIlTags=text.match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/g)||[];var cIli;for(cIli=0;cIli<cIlTags.length;cIli++){var cIlm=cIlTags[cIli].match(/\[COMPANION_ITEM_LOST:([^|\]]+)\|([^\]]+)\]/);if(!cIlm)continue;var cIlCs=findCompanionChar(cIlm[1]);if(!cIlCs||!cIlCs.inventory)continue;removeInventoryItem(cIlCs.inventory,cIlm[2].trim());muts.push(cIlm[1].trim()+": -"+cIlm[2].trim());}
  var cXpTags=text.match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/g)||[];var cXpi;for(cXpi=0;cXpi<cXpTags.length;cXpi++){var cXpm=cXpTags[cXpi].match(/\[COMPANION_XP:([^|\]]+)\|\s*\+?(\d+)[^\]]*\]/);if(!cXpm)continue;var cXpCs=findCompanionChar(cXpm[1]);if(!cXpCs)continue;if(typeof cXpCs.xp!=="number")cXpCs.xp=0;cXpCs.xp+=parseInt(cXpm[2]);muts.push(cXpm[1].trim()+": +"+cXpm[2]+" XP");checkCompanionLevelUp(cXpCs);}
  var cCondTags=text.match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cCondi;for(cCondi=0;cCondi<cCondTags.length;cCondi++){var cCondp=cCondTags[cCondi].match(/\[COMPANION_CONDITION:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cCondp)continue;var cCondCs=findCompanionChar(cCondp[1]);if(!cCondCs)continue;if(!cCondCs.conditions)cCondCs.conditions=[];var cCnm=cCondp[2].trim(),cCdur=cCondp[3].trim(),cCalready=false,cCondj;for(cCondj=0;cCondj<cCondCs.conditions.length;cCondj++){if(cCondCs.conditions[cCondj].name===cCnm){cCondCs.conditions[cCondj].duration=cCdur;cCalready=true;break;}}if(!cCalready){cCondCs.conditions.push({name:cCnm,duration:cCdur});muts.push(cCondp[1].trim()+": "+cCnm);}}
  var cCrTags=text.match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cCri;for(cCri=0;cCri<cCrTags.length;cCri++){var cCrp=cCrTags[cCri].match(/\[COMPANION_CONDITION_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cCrp)continue;var cCrCs=findCompanionChar(cCrp[1]);if(!cCrCs||!cCrCs.conditions)continue;cCrCs.conditions=cCrCs.conditions.filter(function(x){return x.name!==cCrp[2].trim();});muts.push(cCrp[1].trim()+": cured "+cCrp[2].trim());}
  var cRelTags=text.match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cReli;for(cReli=0;cReli<cRelTags.length;cReli++){var cRelp=cRelTags[cReli].match(/\[COMPANION_RELATIONSHIP:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cRelp)continue;var cRelCs=findCompanionChar(cRelp[1]);if(!cRelCs)continue;if(!cRelCs.relationships)cRelCs.relationships=[];var cRnm=resolveNpcName(cRelp[2].trim()),cRdsc=cRelp[3].trim(),cRfound=false,cRelj;for(cRelj=0;cRelj<cRelCs.relationships.length;cRelj++){if(cRelCs.relationships[cRelj].entity===cRnm){var prevCRdsc=cRelCs.relationships[cRelj].descriptor;cRelCs.relationships[cRelj].descriptor=cRdsc;cRfound=true;if(prevCRdsc!==cRdsc)bondToast(cRelp[1].trim(),cRnm,cRdsc,"updated");break;}}if(!cRfound){cRelCs.relationships.push({entity:cRnm,descriptor:cRdsc});muts.push(cRelp[1].trim()+": rel "+cRnm+" ("+cRdsc+")");bondToast(cRelp[1].trim(),cRnm,cRdsc,"new");}}
  var cRrTags=text.match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/g)||[];var cRri;for(cRri=0;cRri<cRrTags.length;cRri++){var cRrp=cRrTags[cRri].match(/\[COMPANION_RELATIONSHIP_REMOVED:([^|\]]+)\|([^\]]+)\]/);if(!cRrp)continue;var cRrCs=findCompanionChar(cRrp[1]);if(!cRrCs||!cRrCs.relationships)continue;var cRrNm=resolveNpcName(cRrp[2].trim());cRrCs.relationships=cRrCs.relationships.filter(function(x){return x.entity!==cRrNm;});muts.push(cRrp[1].trim()+": rel removed "+cRrNm);bondToast(cRrp[1].trim(),cRrNm,null,"ended");}
  var cAbTags=text.match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/g)||[];var cAbi;for(cAbi=0;cAbi<cAbTags.length;cAbi++){var cAbp=cAbTags[cAbi].match(/\[COMPANION_ABILITY:([^|\]]+)\|([^|]+)\|([^\]]+)\]/);if(!cAbp)continue;var cAbCs=findCompanionChar(cAbp[1]);if(!cAbCs)continue;if(!cAbCs.abilities)cAbCs.abilities=[];var cAnm=cAbp[2].trim(),cAalready=false,cAbj;for(cAbj=0;cAbj<cAbCs.abilities.length;cAbj++){if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;break;}}if(!cAalready){cAbCs.abilities.push({nm:cAnm,ds:cAbp[3].trim(),gained:turn});muts.push(cAbp[1].trim()+": ability "+cAnm);}}
  var cAlTags=text.match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\[COMPANION_ALIGNMENT:([^|\]]+)\|(law|good)([+-]\d+)\]/i);if(!cAlp)continue;var cAlCs=findCompanionChar(cAlp[1]);if(!cAlCs)continue;if(!cAlCs.alignLaw)cAlCs.alignLaw=0;if(!cAlCs.alignGood)cAlCs.alignGood=0;if(cAlp[2].toLowerCase()==="law")cAlCs.alignLaw=Math.max(-3,Math.min(3,cAlCs.alignLaw+parseInt(cAlp[3])));else cAlCs.alignGood=Math.max(-3,Math.min(3,cAlCs.alignGood+parseInt(cAlp[3])));var cNewAl=alignLabel(cAlCs.alignLaw,cAlCs.alignGood);if(cNewAl!==cAlCs.actualAlignment){muts.push(cAlp[1].trim()+": align "+cNewAl);cAlCs.actualAlignment=cNewAl;}}
  stampQuestCompletion();/* P3: stamp/clear allDoneSince on every mutation pass, after all quest tags landed */
  if(muts.length)addMsg("system",escHtml(muts.join(" | ")));/* mut labels carry model-derived names (audit E11) */
  syncUI();saveAll();
}
// ── Usage/cost telemetry (TODO #21) ───────────────────────────────────────────
// Estimated $ for one response's usage, priced from MODEL_PRICING (globals.js) by
// model-ID prefix. Unknown models (custom overrides, non-Anthropic) return 0.
function usageCost(u,model){
  if(!model)return 0;
  var keys=Object.keys(MODEL_PRICING),p=null,i;
  for(i=0;i<keys.length;i++){if(model.indexOf(keys[i])===0){p=MODEL_PRICING[keys[i]];break;}}
  if(!p)return 0;
  return ((u.in||0)*p.in+(u.out||0)*p.out+(u.cacheRead||0)*p.cacheRead+(u.cacheWrite||0)*p.cacheWrite)/1000000;
}
// Accumulate one response's usage onto worldState.usage (total + per-kind bucket).
// Not persisted here — every calling flow saves shortly after (saveAll/saveCore).
function recordUsage(u,kind,model){
  if(!worldState)return;
  if(!worldState.usage)worldState.usage=blankUsage();
  var t=worldState.usage;
  t.in+=u.in||0;t.out+=u.out||0;t.cacheRead+=u.cacheRead||0;t.cacheWrite+=u.cacheWrite||0;t.calls++;
  t.costUSD+=usageCost(u,model);
  if(!t.byKind[kind])t.byKind[kind]={in:0,out:0,cacheRead:0,cacheWrite:0,calls:0,costUSD:0};
  var k=t.byKind[kind];
  k.in+=u.in||0;k.out+=u.out||0;k.cacheRead+=u.cacheRead||0;k.cacheWrite+=u.cacheWrite||0;k.calls++;
  k.costUSD+=usageCost(u,model);
}
async function callGM(msg,sysOverride,maxTok,modelOverride,opts){
  // opts.noHistory: send only this message, not the whole sessionLog — for utility calls
  // (action suggestions) where history is irrelevant and just burns tokens (audit #17).
  // opts.kind: telemetry bucket for recordUsage; defaults to "turn" for gameplay calls
  // (no sysOverride) and "other" for utility calls.
  var msgs=(opts&&opts.noHistory)?[{role:"user",content:msg}]:sessionLog.concat([{role:"user",content:msg}]);
  var prov=PROVIDERS[activeProvider]||PROVIDERS.anthropic;
  var key=providerKeys[activeProvider]||apiKey||"";
  var model=modelOverride||providerModels[activeProvider]||prov.defaultModel;
  // Gameplay turns get the {stable, volatile} split from buildSysPrompt (TODO #11);
  // sysOverride callers still pass a plain string. Adapters accept both shapes.
  var sys=sysOverride||buildSysPrompt();
  // gameplay turns only; summarize() passes its own sysOverride. reinforce is a per-provider
  // CONSTANT, so it belongs in the stable (cacheable) half — appending it to volatile would
  // work too, but stable keeps OpenAI's automatic prefix caching effective.
  if(!sysOverride&&prov.reinforce){if(typeof sys==="string")sys+=prov.reinforce;else sys.stable+=prov.reinforce;}
  var _tok=maxTok||1000;if(prov.tokScale!=null)_tok=prov.tokScale===0?null:Math.round(_tok*prov.tokScale);
  var body=prov.buildBody(msgs,sys,_tok,model);
  var url=typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint; // Gemini embeds the model in the URL
  var res;try{res=await fetch(url,{method:"POST",headers:prov.headers(key),body:JSON.stringify(body)});}catch(e){throw new Error("Network: "+e.message);}
  var raw;try{raw=await res.text();}catch(e){throw new Error("Read error");}
  var data;try{data=JSON.parse(raw);}catch(e){throw new Error("HTTP "+res.status+": "+raw.slice(0,200));}
  if(!res.ok){var _em=(data.error&&data.error.message)||(typeof data.error==="string"?data.error:"")||data.message||data.msg||"";throw new Error("HTTP "+res.status+(_em?": "+_em:""));}
  // Record usage BEFORE parseResponse — an empty-content response still billed input tokens.
  if(prov.parseUsage){try{var _u=prov.parseUsage(data);if(_u)recordUsage(_u,(opts&&opts.kind)||(sysOverride?"other":"turn"),model);}catch(e){}}
  return prov.parseResponse(data);
}

async function describePortraitImage(base64Url,charName){
  var key=(typeof providerKeys!=="undefined"&&providerKeys.anthropic)?providerKeys.anthropic:(activeProvider==="anthropic"?apiKey:"");
  if(!key)throw new Error("Needs a Claude (Anthropic) key.");
  var mm=base64Url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if(!mm)throw new Error("Portrait must be a base64 image.");
  var model=(typeof providerModels!=="undefined"&&providerModels.anthropic)||PROVIDERS.anthropic.defaultModel;
  var sys="You are a character artist's eye for a dark fantasy RPG. Look at the portrait and write a vivid 2-3 sentence physical description for a character sheet: face, hair, eyes, build, complexion, notable marks, and visible clothing or gear. Write it in the third person as an appearance entry. Output ONLY the description -- no preamble, no quotes.";
  var body={model:model,max_tokens:400,system:sys,messages:[{role:"user",content:[
    {type:"text",text:"Describe this character's appearance for their sheet."+(charName?" Their name is "+charName+".":"")},
    {type:"image",source:{type:"base64",media_type:mm[1],data:mm[2]}}
  ]}]};
  var r=await fetch(PROVIDERS.anthropic.endpoint,{method:"POST",headers:PROVIDERS.anthropic.headers(key),body:JSON.stringify(body)});
  if(!r.ok)throw new Error("Claude "+r.status);
  var data=await r.json();
  return (PROVIDERS.anthropic.parseResponse(data)||"").trim();
}
