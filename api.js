var __lastRagBlock="";/* UA36 harness enabler — the RAG block buildSysPrompt last injected ("" when the flag is off); capture-only */
function buildGeoBlock(){
  if(!memory.map||!worldState||!worldState.world)return"";
  var w=worldState.world,lines=[],i;
  var wKey=w.location;
  var wNode=memory.map.nodes[wKey];
  var subKey=w.sublocation?wKey+"|"+w.sublocation:null;
  var subNode=subKey?memory.map.nodes[subKey]:null;
  var activeNode=subNode||wNode;
  // Location header. P3-F3 (v1.275): the header carries its own correction teeth — the v1.271
  // playtest traveled two days to a burned waystation while this line still said "Marrowgate"
  // and the GM never flinched (TIME/WEATHER emitted diligently, LOCATION never). Volatile half,
  // zero cache cost.
  var locLine="World: "+w.location+(w.sublocation?" | Sub-location: "+w.sublocation:"")
    +" — if the scene is NO LONGER here, emit [LOCATION:name] NOW; every line below describes the old place";
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
// #46: one condition, one injected phrase — "Unconscious (until awakened; since t155; from
// Reaper Spider attack)". The age is what lets the GM judge staleness; cause lands in Phase B.
function condInjectFmt(x){
  var meta=[];
  if(x.duration)meta.push(x.duration);
  if(x.turn)meta.push("since t"+x.turn);
  if(x.until!=null)meta.push("expires ~t"+x.until);/* v1.257: the GM sees the remaining clock */
  if(x.cause)meta.push("from "+x.cause);
  return x.name+(meta.length?" ("+meta.join("; ")+")":"");
}
// #40 Core Memory: the permanent tier — always injected (VOLATILE half: the list grows during
// play), never compressed, never evicted by the churn caps. Written ONLY by the engine-detected
// triggers (detectCoreMoments, game.js). Renders NOTHING when empty, so pre-#40 saves and fresh
// campaigns produce a byte-identical prompt — the natural off-state, no flag needed.
// #63 (v1.304): now a VIEW assembled from the party's sheets (moments live on the character
// schema, witnessed-by-all — see fileCoreMemory). Same-moment copies across sheets dedupe to one
// line, so an unchanged party renders byte-identically to the old shared list. A moment stamped
// with a DIFFERENT campaign (an imported character's carried history) renders attributed to that
// campaign — its turn number means nothing here.
function buildCoreMemoryBlock(){
  if(!worldState||!worldState.character)return"";
  var camp=worldState.campName||"",seen={},cur=[],prior=[],i;
  function collect(list){
    var j;for(j=0;j<(list||[]).length;j++){var m=list[j];if(!m||!m.text)continue;
      var k=(m.camp||"")+"|"+m.turn+"|"+m.text;if(seen[k])continue;seen[k]=1;
      if(m.camp&&m.camp!==camp)prior.push(m);else cur.push(m);}
  }
  collect(worldState.character.coreMemories);
  var _cmParty=livingPartyCompanions();/* #6: shared party scan */
  for(i=0;i<_cmParty.length;i++)collect(_cmParty[i].charSheet.coreMemories);
  if(!cur.length&&!prior.length)return"";
  var L=["DEFINING MOMENTS — permanent party history the whole party carries forever. These are canon: recall them naturally when relevant, never contradict them, and let them shade tone and relationships:"];
  for(i=0;i<prior.length;i++)L.push("- ("+prior[i].camp+" — an earlier adventure) "+prior[i].text);
  for(i=0;i<cur.length;i++)L.push("- (turn "+cur[i].turn+") "+cur[i].text);
  return L.join("\n")+"\n\n";
}
function saveRules(){try{store.set(RLK,JSON.stringify(customRules));}catch(e){console.warn("[rules] save failed — custom rules NOT persisted:",e.message);if(typeof showToast==="function")showToast("⚠ Custom rules could not be saved.");}}
function loadRules(){try{var r=store.get(RLK);if(r)customRules=JSON.parse(r);}catch(e){console.warn("[rules] load failed — playing with default rules only:",e.message);}}
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
  if(active.length){out+="ACTIVE QUESTS (authoritative — steer toward these; advance objectives via [QUEST_STEP:title|objective|done]):\n";for(i=0;i<active.length;i++){var aq=active[i];out+="• "+aq.title+(aq.desc?" — "+aq.desc:"")+"\n";var allDone=false,hasObj=!!(aq.objectives&&aq.objectives.length);if(hasObj){allDone=true;var oj;for(oj=0;oj<aq.objectives.length;oj++){out+="    ["+(aq.objectives[oj].done?"x":" ")+"] "+aq.objectives[oj].text+"\n";if(!aq.objectives[oj].done)allDone=false;}}
    if(allDone)out+="    ⚑ ALL OBJECTIVES COMPLETE — if this quest is truly finished, emit [QUEST:"+aq.title+"|completed] now, together with its rewards ([XP:]/[GOLD:]/[ITEM_GAINED:]); if work remains, add the next objective via [QUEST_STEP:"+aq.title+"|objective].\n";
    // UA30-b: an active quest with NO objectives can never trip the all-complete teeth above,
    // so it floats forever, invisible to the finish line. Nudge the GM to file trackable steps.
    else if(!hasObj)out+="    ⚑ NO OBJECTIVES FILED — break this quest into 1–3 concrete objectives now via [QUEST_STEP:"+aq.title+"|objective] so progress can be tracked and the quest can complete.\n";}}
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
// #46 audit teeth (v1.255): the standing "emit REMOVED now" instruction on the sheets is
// passive and got ignored (the Daeris test); this is the POINTED version — same engine-detects/
// GM-decides shape as buildQuestEscalation, its own function so condition issues stay traceable
// (user call 2026-07-10: no function pollution). Fires when any party condition has sat for
// CONDITION_AUDIT_TURNS+ (unstamped legacy conditions count as infinitely old), at most once
// per CONDITION_AUDIT_COOLDOWN turns (worldState.lastConditionAudit, written on fire).
function buildConditionAudit(){
  if(!worldState||!worldState.character)return"";
  var lines=[],due=false,expired=false;
  function scan(who,list,companion){
    var i;for(i=0;i<(list||[]).length;i++){var cd=list[i];
      var age=cd.turn?(worldState.turn-cd.turn):null;
      var exp=(cd.until!=null&&cd.until<=worldState.turn);/* v1.257: a scheduled expiry (parsed from "N turns/rounds") */
      if(exp)expired=true;
      if(age===null||age>=CONDITION_AUDIT_TURNS)due=true;
      lines.push("- "+who+": "+cd.name+(cd.duration?" ("+cd.duration+")":"")+(exp?" — its DECLARED DURATION HAS NOW ELAPSED (due t"+cd.until+")":(age===null?" — long-standing, onset unknown":" — since t"+cd.turn+", "+age+" turns ago"))+(companion?" [companion — use COMPANION_CONDITION_REMOVED:"+who+"|"+cd.name+"]":" [player — use CONDITION_REMOVED:"+cd.name+"]"));
    }
  }
  scan(worldState.character.name,worldState.character.conditions,false);
  var i,_caParty=livingPartyCompanions();/* #6: shared party scan */
  for(i=0;i<_caParty.length;i++)scan(_caParty[i].name,_caParty[i].charSheet.conditions,true);
  if(!lines.length)return"";
  // Expiry audits are APPOINTMENTS: they fire through combat (a 3-round stun ending mid-fight is
  // the whole point) and through the cooldown. Staleness audits keep the original gates.
  if(!expired){
    if(worldState.combat)return"";/* mid-fight conditions are ACTIVE business, not staleness */
    if(worldState.turn-(worldState.lastConditionAudit||0)<CONDITION_AUDIT_COOLDOWN)return"";
    if(!due)return"";
  }
  // Consume fired appointments — one audit per declaration; if the GM keeps the condition,
  // staleness governs from here (no every-turn re-fire on a reaffirmed condition).
  function consume(list){var j;for(j=0;j<(list||[]).length;j++){if(list[j].until!=null&&list[j].until<=worldState.turn)delete list[j].until;}}
  consume(worldState.character.conditions);
  var _ccParty=partyCompanionsWithSheets(true);/* DELIBERATE (user ruling 2026-07-16): appointment-consume is hygiene, not a benefit — clearing a dead companion's stale expiry stamps is inert (the audit SCAN already excludes dead) */
  for(i=0;i<_ccParty.length;i++)consume(_ccParty[i].charSheet.conditions);
  worldState.lastConditionAudit=worldState.turn;
  return"[ENGINE NOTE — CONDITION AUDIT (not a player action): the tracker lists the conditions below. For EACH one, decide in THIS response: if it no longer matches the fiction, emit its REMOVED tag; if it still holds, let it visibly shape the narration.\n"+lines.join("\n")+"]";
}
// UA41: relationship reciprocity — the Morwen class (t455): the GM files player-centric
// [RELATIONSHIP:] at the moment and never the mirror [COMPANION_RELATIONSHIP:], so marriages
// sat one-directional for 150+ turns. Deterministic detect / GM decides, same shape as
// buildQuestEscalation. Backstop sizing (Playtest-2 evidence: explicit bond scenes reciprocate
// unprompted): fires ONCE per (entity, descriptor) pair, ever; silent mid-combat. The pair is
// marked consumed at BUILD time — a failed/retried turn burns the nudge; accepted for a
// backstop (the alternative couples the note builder to the parse cycle for marginal gain).
function buildReciprocityNudge(){
  if(!worldState||!worldState.character||worldState.combat)return"";
  var c=worldState.character,rl=c.relationships||[],i,j;
  for(i=0;i<rl.length;i++){var r=rl[i];
    if(!r||!r.entity||!r.descriptor)continue;
    if(typeof WEIGHTY_REL_RE==="undefined"||!WEIGHTY_REL_RE.test(r.descriptor))continue;
    var cs=findCompanionChar(r.entity);if(!cs)continue;/* party members with sheets only */
    var key=r.entity+"|"+r.descriptor;
    if(worldState.reciprocityNudged&&worldState.reciprocityNudged[key])continue;
    var mirrored=false,cr=cs.relationships||[];
    for(j=0;j<cr.length;j++){if(cr[j].entity&&cr[j].entity.toLowerCase()===c.name.toLowerCase()){mirrored=true;break;}}
    if(mirrored)continue;
    if(!worldState.reciprocityNudged)worldState.reciprocityNudged={};
    worldState.reciprocityNudged[key]=worldState.turn;
    return "[ENGINE NOTE — RELATIONSHIP RECIPROCITY (not a player action): the player's sheet records "+r.entity+" as \""+r.descriptor+"\", but "+r.entity+"'s own sheet has NO relationship entry for "+c.name+". If the fiction agrees the bond is mutual, emit [COMPANION_RELATIONSHIP:"+r.entity+"|"+c.name+"|<their descriptor for "+c.name+">] in this response; if it is genuinely one-sided, leave it as is.]";
  }
  return"";
}
// UA31 (v1.287, pre-review approved): the AUDIT_PLAYTHRU desync — [ARC_COMPLETE:] fired while the
// twin quest of the same name never closed, so the arc side moved on while the quest floated open
// (and its reward never paid). When a skeleton arc is completed but a live questLog entry with a
// matching title is still open, nudge the GM to close it (or add whatever step remains). NUDGE,
// never auto-close: engine-closing a quest the GM hasn't narrated closed drops it from the journal
// mid-scene (the row's ⚠ guard). Conservative title match (exact or one-contains-the-other,
// case-insensitive — the findCompanionNpc discipline, no fuzzy scoring); one note per (arc, quest)
// pair per campaign via worldState.arcQuestNudged (the reciprocity-latch pattern); silent in combat
// WITHOUT consuming the latch (the mark only writes when a note is actually returned).
function buildArcQuestNudge(){
  if(!worldState||worldState.combat||!worldState.skeleton||!worldState.questLog)return"";
  var sk=worldState.skeleton,i,j,k;/* #11①: titleMatch hoisted to arcTitleMatch (helpers.js) */
  for(i=0;i<(sk.acts||[]).length;i++){var act=sk.acts[i];
    for(j=0;j<(act.arcs||[]).length;j++){var arc=act.arcs[j];
      if(arc.status!=="completed")continue;
      for(k=0;k<worldState.questLog.length;k++){var q=worldState.questLog[k];
        if(q.status!=="active"&&q.status!=="offered")continue;
        if(!arcTitleMatch(arc.title,q.title))continue;
        var key=arc.title+"|"+q.title;
        if(worldState.arcQuestNudged&&worldState.arcQuestNudged[key])continue;
        if(!worldState.arcQuestNudged)worldState.arcQuestNudged={};
        worldState.arcQuestNudged[key]=worldState.turn;
        return "[ENGINE NOTE — ARC/QUEST DESYNC (not a player action): the story arc '"+arc.title+"' is marked COMPLETE, but the quest '"+q.title+"' is still open in the journal. If the fiction has finished it, emit [QUEST:"+q.title+"|completed] in this response together with its rewards ([XP:]/[GOLD:]/[ITEM_GAINED:]); if work genuinely remains, add the objective that is left via [QUEST_STEP:"+q.title+"|<objective>]. Do not silently leave it open.]";
      }
    }
  }
  return"";
}
// #23 (v1.297, user-designed): the INVERSE of buildArcQuestNudge. Where that one catches a COMPLETED
// arc whose quest is still open, this catches an ACTIVE arc whose originating same-name quest has
// ALREADY completed+archived — the t727 Runelords drift: the 'Skinsaw Man' quest closed, but the arc
// lingered and metastasized into an emergent 'Skinsaw Network' the authored spine never called for.
// SOFT nudge only, never auto-close — the user's ONE worry is a PREMATURE close, so the note offers
// both directions and explicitly forbids forcing it shut. Unlike the reciprocity/arc-quest latches
// (one shot), this RE-FIRES every ARC_DRIFT_RECHECK turns (worldState.arcDriftNudged[key]=lastTurn),
// so a "justify and forget" can't let the open arc quietly go stale 100 turns on. Skipped when a LIVE
// quest still matches the arc title (the arc is legitimately tracked, not drifting) and silent in
// combat WITHOUT resetting the timer (the mark only writes when a note is actually returned).
function buildArcDriftNudge(){
  if(!worldState||worldState.combat||!worldState.skeleton||!memory||!memory.quests)return"";
  var sk=worldState.skeleton,i,j,qk;/* #11①: titleMatch hoisted to arcTitleMatch (helpers.js) */
  var qkeys=Object.keys(memory.quests),ql=worldState.questLog||[];
  for(i=0;i<(sk.acts||[]).length;i++){var act=sk.acts[i];
    for(j=0;j<(act.arcs||[]).length;j++){var arc=act.arcs[j];
      if(arc.status!=="active")continue;
      // legit-in-progress guard: a live quest tracking this arc means it is NOT drifting
      var live=false,lk;for(lk=0;lk<ql.length;lk++){if((ql[lk].status==="active"||ql[lk].status==="offered")&&arcTitleMatch(arc.title,ql[lk].title)){live=true;break;}}
      if(live)continue;
      // the arc's first matching COMPLETED archived quest (failed/declined don't imply the arc is done)
      var mq=null;for(qk=0;qk<qkeys.length;qk++){var aq=memory.quests[qkeys[qk]];if(aq&&aq.status==="completed"&&arcTitleMatch(arc.title,aq.title||qkeys[qk])){mq=aq.title||qkeys[qk];break;}}
      if(!mq)continue;
      var key=arc.title+"|"+mq,last=worldState.arcDriftNudged&&worldState.arcDriftNudged[key];
      if(last!=null&&(worldState.turn-last)<ARC_DRIFT_RECHECK)continue;/* still inside the recheck window */
      if(!worldState.arcDriftNudged)worldState.arcDriftNudged={};
      worldState.arcDriftNudged[key]=worldState.turn;
      return "[ENGINE NOTE — ARC DRIFT CHECK (not a player action): the arc '"+arc.title+"' is still active, but its originating quest '"+mq+"' has already been completed. If this arc's story is genuinely finished, emit [ARC_COMPLETE:"+arc.title+"] with its reward. If real work legitimately remains, that is fine — do NOT force it closed — but keep it converging toward the arc's objective"+(arc.objective?" ('"+arc.objective+"')":"")+" instead of sprawling into new open-ended threads. (This check repeats about every "+ARC_DRIFT_RECHECK+" turns while the arc stays open.)]";
    }
  }
  return"";
}
// #61: weighty-bond downgrade nudge — the [RELATIONSHIP:] upsert is last-write-wins, so a
// moment-description could silently overwrite a defining bond (t582→t727 Frizwick: "Husband —
// beloved family" → "Husband"). The write is NEVER blocked or reverted (the GM owns the fiction);
// stampRelationshipChanges (game.js) records the drop and this note asks the GM to confirm or
// restore NEXT turn. One entry per call, consumed at build time (the reciprocity-latch pattern);
// silent mid-combat WITHOUT consuming.
function buildRelationshipDowngradeNudge(){
  if(!worldState||worldState.combat)return"";
  var q=worldState.relDowngrades;
  if(!q||!q.length)return"";
  var d=q.shift();if(!q.length)delete worldState.relDowngrades;
  var whose=d.who?d.who+"'s":"the player's",tag=d.who?"[COMPANION_RELATIONSHIP:"+d.who+"|"+d.entity+"|<descriptor>]":"[RELATIONSHIP:"+d.entity+"|<descriptor>]";
  return "[ENGINE NOTE — BOND DOWNGRADE CHECK (not a player action): "+whose+" recorded bond with "+d.entity+" was just overwritten from \""+d.prev+"\" to \""+d.next+"\". If the bond has genuinely changed, leave it. But if the old descriptor was the BOND and the new one only describes a passing moment or mood, restore the bond's substance via "+tag+" — a defining bond (marriage, oath, sworn enmity) must not silently decay into a scene note.]";
}
// #61: periodic relationship audit — the cadence backstop behind the per-turn injection (party
// sheets now carry Relationships lines; this catches DESCRIPTOR ROT: bonds that evolved in the
// fiction without a tag). Same engine-detects/GM-decides shape as buildConditionAudit: fires at
// most once per REL_AUDIT_TURNS (worldState.lastRelAudit, written on fire); a party join/leave
// sets worldState.relAuditDue (stampRelationshipChanges, game.js) and pulls the audit forward —
// a newcomer's bonds need filing NOW, not in 40 turns. Silent mid-combat without consuming.
function buildRelationshipAudit(){
  if(!worldState||!worldState.character||worldState.combat)return"";
  var c=worldState.character,lines=[],i,j;
  function fmt(who,list){
    for(j=0;j<(list||[]).length;j++){var r=list[j];if(!r||!r.entity)continue;
      lines.push("- "+who+" → "+r.entity+": \""+(r.descriptor||"")+"\""+(r.turn?" (since t"+r.turn+")":" (long-standing)"));}
  }
  fmt(c.name,c.relationships);
  var _raParty=livingPartyCompanions();/* #6: shared party scan */
  for(i=0;i<_raParty.length;i++)fmt(_raParty[i].name,_raParty[i].charSheet.relationships);
  var eventDue=!!worldState.relAuditDue;
  var timerDue=(worldState.turn-(worldState.lastRelAudit||0))>=REL_AUDIT_TURNS;
  if(!eventDue&&!timerDue)return"";
  if(!lines.length&&!eventDue){worldState.lastRelAudit=worldState.turn;return"";}/* nothing to re-ground; consume the window so the first filed bond isn't audited one turn later */
  worldState.lastRelAudit=worldState.turn;delete worldState.relAuditDue;
  return "[ENGINE NOTE — RELATIONSHIP AUDIT (not a player action): below is every recorded bond in the party"+(eventDue?"; the party's composition just changed, so re-ground them now":"")+". For EACH: if it still matches the fiction, leave it alone — do NOT re-emit unchanged bonds. If it has grown, faded, or reads wrong, refresh it with [RELATIONSHIP:entity|descriptor] (player) or [COMPANION_RELATIONSHIP:Name|entity|descriptor] (companion), or end it with the matching REMOVED tag. Bonds the fiction has clearly established but that are MISSING below — especially for anyone who just joined — must be filed NOW with the same tags.\n"+(lines.length?lines.join("\n"):"- (none recorded yet)")+"]";
}
// #57 leg C: fork healing — the summarize extractor may PROPOSE that two on-file NPCs are the
// same person (the t378 "Woman in Bronze"/Daeris class: zero shared name tokens, invisible to
// resolveNpcName's consolidation). The engine NEVER auto-merges (a wrong merge fuses two real
// people — UA29's E4 hazard): this note asks the GM to confirm in-fiction via the battle-tested
// [NPC_MERGE:], or stay silent. One hint per turn; once per pair EVER (worldState.mergeHintNudged,
// the reciprocity-latch pattern — a re-proposal after a GM decline is dropped at queue time);
// consumed at build time; silent mid-combat WITHOUT consuming (the queue keeps the hint). Hints
// whose pair has already been healed (merged/aliased since queueing) are discarded silently.
function buildMergeConfirmNudge(){
  if(!worldState||worldState.combat)return"";
  var q=worldState.pendingMergeHints;
  if(!q||!q.length)return"";
  var h=null;
  while(q.length){var c=q.shift();
    if(resolveNpcName(c.canonical)!==resolveNpcName(c.duplicate)&&memory.npcs[c.canonical]&&memory.npcs[c.duplicate]){h=c;break;}
  }
  if(!q.length)delete worldState.pendingMergeHints;
  if(!h)return"";
  if(!worldState.mergeHintNudged)worldState.mergeHintNudged={};
  worldState.mergeHintNudged[h.canonical+"|"+h.duplicate]=worldState.turn;
  return "[ENGINE NOTE — POSSIBLE DUPLICATE NPC (not a player action): the record suggests \""+h.canonical+"\" and \""+h.duplicate+"\" may be the SAME person. If the story has confirmed this, emit [NPC_MERGE:"+h.canonical+"|"+h.duplicate+"] in this response (and [NPC_SUPERSEDE:] for any recorded fact the reveal made outdated). If they are genuinely different people, emit nothing — this note will not repeat.]";
}
// The engine-notes registry (user-approved shape + name, 2026-07-10): sendAction calls ONE
// orchestrator; each check stays a single-purpose, separately-traceable function. Adding the
// next engine nag = adding a list entry, not editing sendAction.
// #60: ghost-consumable check — the engine detected (deterministically, detectGhostConsumables
// in game.js: a consumable's head noun named in the turn's text with no ITEM_LOST emitted) and
// the GM DECIDES here — the note asks it to verify its OWN narration and either emit the
// battle-tested tag or explicitly leave the sheet alone. Never auto-decrements: the #60 design
// space rejected every shape where a second model writes inventory unattended; the only write
// path stays the sole parser. One item per turn (note pressure), cooldown latch written on fire
// (CONSUMABLE_NUDGE_COOLDOWN — an ignored nudge means "not spent", don't re-nag), silent
// mid-combat WITHOUT consuming (spends happen in combat; the check keeps until the dust settles).
function buildConsumableNudge(){
  if(!worldState||worldState.combat)return"";
  var q=worldState.consumableChecks;if(!q||!q.length)return"";
  var c=q.shift();if(!q.length)delete worldState.consumableChecks;
  if(!worldState.consumableNudged)worldState.consumableNudged={};
  worldState.consumableNudged[c.key]=worldState.turn;
  var tag=c.who?"[COMPANION_ITEM_LOST:"+c.who+"|"+c.item+"]":"[ITEM_LOST:"+c.item+"]";
  var whose=c.who?c.who+"'s":"the player's";
  return "[ENGINE NOTE — CONSUMABLE CHECK (not a player action): the recent scene mentioned "+whose+" '"+c.item+"' but no item-loss tag was emitted. Check your own recent narration: if one or more units were actually expended (thrown, drunk, detonated, burned, used up), emit "+tag+" in THIS response — one tag per unit spent. If it was merely mentioned, carried, examined, or reached for without being consumed, leave the sheet alone — do NOT invent a consumption.]";
}
var NOTE_BUILDERS=[buildQuestEscalation,buildConditionAudit,buildReciprocityNudge,buildArcQuestNudge,buildArcDriftNudge,buildRelationshipDowngradeNudge,buildRelationshipAudit,buildMergeConfirmNudge,buildConsumableNudge];
function buildEngineNotes(){
  var out=[],i;
  for(i=0;i<NOTE_BUILDERS.length;i++){var n=NOTE_BUILDERS[i]();if(n)out.push(n);}
  return out.join("\n\n");
}
function buildSysPrompt(){
  var c=worldState.character,w=worldState.world,tone=worldState.tone||{};
  var tb=tone.voice?"TONE -- "+tone.name.toUpperCase()+":\n"+tone.voice+"\n\n":"TONE: "+(tone.name||"Sword and Sorcery")+"\n\n";
  // #61: the roster's rel field is last-[NPC:]-tag residue — for PARTY members it decayed to
  // "companion"/"acquaintance" while the sheet held the real bond ("Wife"), and the contradiction
  // (re-injected every turn) is what seeded relationship hallucinations (t755 Frizwick). For party
  // members the PLAYER'S relationship descriptor is authoritative when one exists; non-party NPCs
  // keep npc.rel untouched — theirs often carries identity ("mother of Morwen") no descriptor has.
  var relByEntity={},_rbi,_rbl=(c.relationships||[]);for(_rbi=0;_rbi<_rbl.length;_rbi++){if(_rbl[_rbi]&&_rbl[_rbi].entity&&_rbl[_rbi].descriptor)relByEntity[_rbl[_rbi].entity.toLowerCase()]=_rbl[_rbi].descriptor;}
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];if(/\bdead\b/i.test(npc.status||""))continue;/* dead NPCs stay in memory.npcs but aren't listed as present */var npcAka=npc.aliases&&npc.aliases.length?" [aka: "+npc.aliases.join(", ")+"]":"";/* pronoun fallback: explicit wins; party members derive from charSheet.gender; everyone else defaults to they/them so the GM never has to guess */var npcPr=npc.pronouns||(npc.partyMember&&npc.charSheet&&npc.charSheet.gender?pronounsForGender(npc.charSheet.gender):"they/them");var npcRel=(npc.partyMember&&relByEntity[npc.name.toLowerCase()])||npc.rel;ns.push(npc.name+npcAka+" ("+npc.status+", "+npcRel+(npcPr?", "+npcPr:"")+(npc.partyMember?", PARTY MEMBER":"")+")");}if(ns.length)nstr=ns.join("; ");}
  // PARTY MEMBER SHEETS — companions' full combat kit (class/spells/abilities). Without this the
  // GM only sees the one-line NPC roster entry and never knows a companion can cast → they default
  // to swinging a weapon. Rich block so a caster casts, a rogue uses tricks, etc.
  var partyBlock="";
  if(worldState.npcs.length){
    var pmArr=[],pj,_pbParty=livingPartyCompanions();/* #6: shared party scan; body stays inline (per-companion prompt text) */
    for(pj=0;pj<_pbParty.length;pj++){
      var pmN=_pbParty[pj];
      var pcs=pmN.charSheet;
      var pAb="none";if(pcs.abilities&&pcs.abilities.length){var pa2=[],pai;for(pai=0;pai<pcs.abilities.length;pai++)pa2.push(pcs.abilities[pai].nm);if(pa2.length)pAb=pa2.join(", ");}
      // Playtest-F1 (v1.239): name expended spells EXPLICITLY instead of omitting them — the bible
      // block still injects an omitted spell's canon, so omission read as "available" to the GM
      // (the t31/t35 Charm Person incident). Absence communicates nothing; a stated clause is iron.
      var pSp="none",pSpUsed=[];if(pcs.spells&&pcs.spells.length){var ps2=[],psi;for(psi=0;psi<pcs.spells.length;psi++){if(!pcs.spells[psi].used)ps2.push(pcs.spells[psi].nm);else pSpUsed.push(pcs.spells[psi].nm);}if(ps2.length)pSp=ps2.join(", ");}
      var pSt=pcs.stats?("STR "+pcs.stats.STR+" DEX "+pcs.stats.DEX+" CON "+pcs.stats.CON+" INT "+pcs.stats.INT+" WIS "+pcs.stats.WIS+" CHA "+pcs.stats.CHA):"";
      var pInv=(pcs.inventory&&pcs.inventory.length)?pcs.inventory.join(", "):"none";
      var line=pmN.name+" — "+(pcs.subraceNm?pcs.subraceNm+" ":"")+(pcs.ancestry?pcs.ancestry+" ":"")+(pcs.cls||"adventurer")+(pcs.archetypeNm?" ["+pcs.archetypeNm+"]":"")+", Level "+(pcs.level||1)+" | HP "+pcs.hp+"/"+pcs.maxHp+"\n";
      if(pSt)line+="  Stats: "+pSt+"\n";
      line+="  Abilities: "+pAb+"\n  Spells available: "+pSp+(pSpUsed.length?"\n  Spells EXPENDED (cannot cast until a long rest): "+pSpUsed.join(", "):"")+"\n  Inventory: "+pInv;
      // #46: companion conditions were WRITTEN by [COMPANION_CONDITION:] but never injected —
      // a write-path with no read-path, so they silently rotted (Daeris, Unconscious for ~200
      // turns while narrated awake). Inject with age so stale state is visible and self-corrects.
      if(pcs.conditions&&pcs.conditions.length)line+="\n  Conditions: "+pcs.conditions.map(condInjectFmt).join(", ");
      // #61: companion relationships were WRITTEN by [COMPANION_RELATIONSHIP:] but never injected —
      // the same write-path-with-no-read-path class as the #46 conditions above. The GM never saw
      // a companion's bonds (Morwen's marriages, 222 turns invisible at t755) and reconstructed
      // party dynamics from the roster's decayed one-liners → hallucinated relationships.
      if(pcs.relationships&&pcs.relationships.length)line+="\n  Relationships: "+pcs.relationships.map(function(r){return r.entity+(r.descriptor?" ("+r.descriptor+")":"");}).join(", ");
      pmArr.push(line);
    }
    if(pmArr.length)partyBlock="PARTY MEMBER SHEETS (companions fighting alongside the player — have each act IN CHARACTER using their OWN abilities and spells below, not just weapons: a spellcaster should cast from their spell list, a rogue should use stealth and tricks. Track their resources with COMPANION_* tags. If a companion's listed Condition no longer matches the fiction, emit [COMPANION_CONDITION_REMOVED:Name|condition] NOW. Each Relationships line is that companion's CANONICAL record of their bonds — never contradict it, and update it with [COMPANION_RELATIONSHIP:] when a bond genuinely changes):\n"+pmArr.join("\n")+"\n\n";
  }
  // Live party-size note so the GM never narrates a join it can't make (the engine also caps it).
  var pmCnt=partyCompanionCount(),pmCap=partyCompanionCap();
  var partyCapBlock="PARTY SIZE: "+pmCnt+" of "+pmCap+" companion slots filled (hard cap "+PARTY_MAX+" total, including the player)."+(pmCnt>=pmCap?" THE PARTY IS FULL — do NOT have any new NPC join the party (no [PARTY_MEMBER:|true]) until a current companion leaves or dies. An NPC may still aid the party temporarily as an ally without becoming a member.":"")+"\n\n";
  var questBlock=buildQuestBlock();
  var abilstr="none";if(c.abilities&&c.abilities.length){var as2=[];for(i=0;i<c.abilities.length;i++)as2.push(c.abilities[i].nm);abilstr=as2.join(", ");}
  // Playtest-F1 (v1.239): expended spells are NAMED, not omitted — see the companion-block note above.
  var spstr="none",spUsed=[];if(c.spells&&c.spells.length){var sp2=[];for(i=0;i<c.spells.length;i++){if(!c.spells[i].used)sp2.push(c.spells[i].nm);else spUsed.push(c.spells[i].nm);}if(sp2.length)spstr=sp2.join(", ");}
  var nextXP=c.level<10?XP_LEVELS[c.level]:"max";
  var genderDisplay=c.gender==="F"?"female":c.gender==="NB"?"non-binary":"male";
  // #46: injected conditions carry their AGE (engine-stamped turn) + cause when known, and each
  // afflicted sheet gets a cleanup instruction. Root cause of the Daeris incident (t359): a
  // condition the GM can't SEE (or can't see is 200 turns old) is never honored and never
  // removed — visibility + age is what makes stale state self-correcting.
  var condStr="";if(c.conditions&&c.conditions.length){condStr="Conditions: "+c.conditions.map(condInjectFmt).join(", ")+" — if a condition no longer matches the fiction, emit [CONDITION_REMOVED:name] NOW\n";}
  var relStr="";if(c.relationships&&c.relationships.length){relStr="Relationships: "+c.relationships.map(function(x){return x.entity+" ("+x.descriptor+")";}).join(", ")+"\n";}
  var saveStr="";if(c.saveModifiers&&c.saveModifiers.length){saveStr="Save modifiers: "+c.saveModifiers.map(function(x){var v=x.amount>=0?"+"+x.amount:""+x.amount;return v+" vs "+x.type+" ["+x.source+"]";}).join(", ")+"\n";}
  var langStr="";if(c.languages&&c.languages.length){langStr="Languages: "+c.languages.map(function(x){return x.name+(x.broken?" (broken)":"");}).join(", ")+"\n";}
  var skillStr="";if(c.skills){var nzSkills=[],nzKeys=Object.keys(c.skills);for(var nzk=0;nzk<nzKeys.length;nzk++){if(c.skills[nzKeys[nzk]]>0)nzSkills.push(nzKeys[nzk]+": "+SKILL_LEVELS[skillLevel(c.skills[nzKeys[nzk]])]);}if(nzSkills.length)skillStr="Skills (earned): "+nzSkills.join(", ")+"\n";}
  // UA26: one line per LIVING foe; down foes summarized once so the GM narrates the aftermath
  // without re-fighting them. combat.engaged marks who the player is actively fighting.
  var cb="";if(worldState.combat){var cm=worldState.combat;var cbLines=[],cbDown=[],cfi,cfs=cm.foes||[];
    for(cfi=0;cfi<cfs.length;cfi++){var cf=cfs[cfi];
      if(cf.down||cf.hp<=0){cbDown.push(cf.name+" ("+(cf.down||"slain")+")");continue;}
      var cbStats="";if(cf.stats)cbStats=" | STR:"+cf.stats.STR+" DEX:"+cf.stats.DEX+" CON:"+cf.stats.CON+" INT:"+cf.stats.INT+" WIS:"+cf.stats.WIS+" CHA:"+cf.stats.CHA+" CR:"+cf.stats.CR;
      var cbDmgMod="";if(cf.immune&&cf.immune.length)cbDmgMod+=" | Immune:"+cf.immune.join(",");if(cf.resist&&cf.resist.length)cbDmgMod+=" | Resist:"+cf.resist.join(",");if(cf.vuln&&cf.vuln.length)cbDmgMod+=" | Vuln:"+cf.vuln.join(",");
      cbLines.push("Enemy: "+cf.name+(cm.engaged===cf.name?" [ENGAGED with the player]":"")+" HP:"+cf.hp+"/"+cf.maxHp+" AC:"+cf.ac+" Atk:+"+cf.atk+" Dmg:"+cf.dmg+" Morale:"+cf.morale+cbStats+cbDmgMod);}
    cb="COMBAT ACTIVE (Round "+cm.round+(cfs.length>1?"; "+cfs.length+" foes — use [ENEMY_HP:Name|-X] to address each":"")+"):\n"+cbLines.join("\n")+(cbDown.length?"\nOut of the fight: "+cbDown.join(", "):"")+"\n\n";}
  var hist=worldState.eventHistory.length?"STORY SO FAR:\n"+worldState.eventHistory.join("\n")+"\n\n":"";
  var memToc=memoryTOC();
  // RAG episodic excerpts (#27 Phase 1) — "" unless worldState.ragMemory is on. VOLATILE
  // half ONLY: retrieval changes per turn and must never touch the cached stable block.
  var ragBlock=typeof ragRetrieve==="function"?ragRetrieve(typeof lastAction==="string"&&lastAction?lastAction:""):"";
  __lastRagBlock=ragBlock;/* UA36 harness enabler — capture-ONLY side channel (window.__lastRagBlock in the browser) for the RAG A/B; the engine never reads it back */
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
    // UA1: the STATE TAGS block is DERIVED from the tag table (tag_table.js) — byte-identical
    // to the battle-tested hand-written text (frozen by an engine test + a pre/post stable-half
    // capture). Doc wording changes are separate deliberate commits, never bundled with mechanics.
    +buildStateTagsDoc();
  var volatile_=identity+switchBlock+leftBlock
    +"CHARACTER: "+c.name+" ("+genderDisplay+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +(c.trait||c.flaw||c.motivation?(c.trait?"Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+(c.motivation?" | Motivation: "+c.motivation:"")+"\n":"")+(c.deity?"Deity: "+c.deity+"\n":"")/* trailing \n so "Motivation:" doesn't glue to the next line (audit E54) */
    +"Abilities: "+abilstr+"\nSpells available: "+spstr+(spUsed.length?"\nSpells EXPENDED (cannot cast until a long rest — never treat these as castable): "+spUsed.join(", "):"")+"\nInventory: "+c.inventory.join(", ")+"\n"
    +condStr+relStr+saveStr+langStr+skillStr
    +buildSpellBibleBlock()
    +buildAbilityBibleBlock()
    +buildCompanionSpellBibleBlock()
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
    +buildCoreMemoryBlock()
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: "+(_paVc?"Write EVERY sentence of narration in this voice — a reader should recognise the author from rhythm, sentence length, and word choice alone. Commit fully; never blend with a neutral GM voice. VOICE: "+_paVc+(_paProfane?(adultMode?" This voice swears: use strong, crude profanity freely and naturally — never censored.":" Keep this voice's rhythm and bite, but keep the language clean — no profanity."):"")+" ":"Write clean, readable prose. ")+"Do NOT use em-dashes or en-dashes anywhere; use commas or separate sentences instead. Do not cram multiple clauses or similes into one long sentence; break a long thought into several short ones, one main image per sentence. Do NOT end your response with suggested actions, a 'You could' line, or an [ACTIONS:] tag — action suggestions are handled separately by the engine. Never show tags in prose. Death is possible.";
  return {stable:stable,volatile:volatile_};
}
function buildSkeletonBlock(){
  if(!worldState.skeleton)return"";
  var sk=worldState.skeleton,lines=[],i,j;
  lines.push("CAMPAIGN SKELETON — this is the overarching narrative structure. Every scene, quest, and encounter should serve this story. Do not invent unrelated side-plots that pull away from the current arc.");
  // #23/#43 blueprint fidelity: when the player deliberately loaded an AUTHORED adventure, the acts/arcs
  // below are the load-bearing spine — the failure mode (v1.224 audit) was backstory-driven personalization
  // supplanting the authored plot (an emergent notation-seal subplot displacing the Skinsaw arcs). Steer
  // toward the authored beats; personalize the TELLING, don't replace the STORY.
  if(worldState.blueprintName)lines.push("AUTHORED CAMPAIGN — this is \""+worldState.blueprintName+"\", a pre-written adventure the player deliberately chose. The acts and arcs below are its AUTHORED SPINE, not loose suggestions: steer scenes toward the CURRENT arc's objective and advance through the authored beats. Use the character's backstory, flaw, and personality to COLOR those beats — never to replace them with an unrelated emergent subplot. The player picked this story to live it; deliver it.");
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
    // #23 (v1.296) per-arc pacing budget: the act nudge below caught act-scale stalls, but the t727 save
    // showed a single arc metastasizing (~220 turns in one "Skinsaw Man" arc that kept spawning fresh
    // sub-objectives instead of closing) while the act nudge just repeated "the act is long". When exactly
    // ONE arc is active and it has outlived ARC_TURN_BUDGET (measured from arc.startTurn), fire a TARGETED
    // close-THIS-arc nudge and let it SUPERSEDE the generic act-turn line (it already asks to advance toward
    // the act's turning point). Skipped when >1 arc is active (parallel — can't attribute the overstay) and
    // when the arc lacks startTurn (pre-v1.296 arc that hasn't been re-stamped — fail safe to no nudge).
    var _arcNudged=false;
    if(!_allArcsDone&&activeArcs.length===1&&activeArcs[0].startTurn!=null){
      var _arcTurns=worldState.turn-activeArcs[0].startTurn;
      if(_arcTurns>ARC_TURN_BUDGET){pacingNote="⚑ PACING — the current arc (\""+activeArcs[0].title+"\") has run "+_arcTurns+" turns (soft target ~"+ARC_TURN_BUDGET+"). It is dragging: bring THIS arc to a decisive resolution and emit [ARC_COMPLETE:"+activeArcs[0].title+"], then move toward the act's turning point. Stop opening new threads or sub-objectives inside it. (Advance toward the ending — do NOT skip an active crisis or cut a scene mid-stakes; steer, don't teleport.)\n"+pacingNote;_arcNudged=true;}
    }
    // #23/#43 act pacing budget: a soft nudge once the ACTIVE act has run past ACT_TURN_BUDGET turns
    // (the t308 save sat 308 turns in Act 1; the scene-level "4+ turns" rule never catches an act-scale
    // stall). Skipped when all arcs are done — the close nudge above already owns that — or when the more
    // actionable per-arc nudge already fired. The parenthetical is the anti-over-rail guard: steer toward
    // the ending, never teleport past an active crisis or cut a scene.
    var _actTurns=worldState.turn-(worldState.actStartTurn||0);
    if(!_allArcsDone&&!_arcNudged&&_actTurns>ACT_TURN_BUDGET)pacingNote="⚑ PACING — the current act (\""+activeAct.title+"\") has run "+_actTurns+" turns (soft target ~"+ACT_TURN_BUDGET+" per act). Bring the ACTIVE arc to a decisive resolution and move toward the act's turning point; stop opening unrelated detours. (Advance toward the ending — do NOT skip an active crisis or cut a scene mid-stakes; steer, don't teleport.)\n"+pacingNote;
    if(activeArcs.length>1)pacingNote+="\nThis act is PARALLEL — multiple arcs are active simultaneously. The player chooses which to pursue. Weave hooks for the others into scenes naturally, but follow the player's lead. Do not force a specific arc order. Run each through its HOW TO RUN THIS ARC directive above.";
    // Generic type-hint only when the active arc has NO dnaHint — otherwise it contradicts the author
    // sensibility (a generic "investigation → gather clues" line is what flattened campaigns into procedure).
    if(activeArcs.length===1&&!activeArcs[0].dnaHint&&activeArcs[0].type)pacingNote+="\nThe current arc is "+activeArcs[0].type+"-focused. Shape encounters and scenes accordingly: "+(activeArcs[0].type==="investigation"?"clues, interrogation, deduction, piecing together evidence":activeArcs[0].type==="exploration"?"travel, discovery, environmental challenges, mapping unknown territory":activeArcs[0].type==="social"?"politics, alliances, persuasion, betrayal, negotiation":activeArcs[0].type==="combat"?"battles, sieges, hunts, tactical encounters":"varied challenges")+".";
  }
  lines.push(pacingNote);
  return lines.join("\n")+"\n\n";
}
// capBibleLine (TODO #10) — one canonical capability line for the injection: LABELED and COMPLETE
// (every attribute, "N/A" where inapplicable) so the GM can query any of a spell/ability's bounds
// and never come up empty (the Death-Sight-has-no-duration problem). Shared by both injection blocks.
function capBibleLine(nm,e){
  function f(v){return v||"N/A";}
  return "- "+nm+" — cost: "+f(e.cost)+" | range: "+f(e.range)+" | targets: "+f(e.targets)+" | duration: "+f(e.duration)+" | save: "+f(e.save)+" | damage: "+f(e.dice)+". "+f(e.effect);
}
// buildSpellBibleBlock (TODO #10) — the anti-drift injection. Re-feeds the CANONICAL rules for
// every spell the player currently knows, every turn, so the GM narrates from fixed bounds instead
// of re-improvising a spell's range/targets/duration from its name (the Message-went-limitless
// drift). Same re-inject-from-data pattern as the quest block / char sheet / [LOCATION_DESC:].
// VOLATILE half only (reads worldState.character.spells live). Bounded by known spells, so cheap.
// Companion spell canon: buildCompanionSpellBibleBlock below (UA25, v1.263 — closed the v1.224
// B1(b) gap where charSheet.spells got no re-injection and companions cast from vibes).
function buildSpellBibleBlock(){
  var c=worldState&&worldState.character;
  if(!c||!c.spells||!c.spells.length||typeof capabilityLookup!=="function")return"";
  var seen={},lines=[],i;
  for(i=0;i<c.spells.length;i++){
    var sp=c.spells[i];if(!sp||!sp.nm)continue;
    var e=capabilityLookup(sp.nm);if(!e)continue;
    var key=capBaseName(sp.nm);if(seen[key])continue;seen[key]=1;
    var nm=String(sp.nm).replace(/\s*\(.*\)/,"").trim();
    // Playtest-F1 (v1.239): the expended state must live HERE, in the block the GM provably
    // consults at cast time (the money test showed 8 unprompted range holds from these lines,
    // while a sheet-side "expended" clause alone was ignored — the GM cast a spent slot anyway).
    // Slot state is as canonical as range: the marker leads the line.
    if(sp.lvl>0&&sp.used)nm="[EXPENDED — slot already spent; this spell CANNOT be cast again until a long rest] "+nm;
    lines.push(capBibleLine(nm,e));
  }
  if(!lines.length)return"";
  return "CANONICAL SPELL RULES (authoritative — these bounds are FIXED; never expand a spell's range, targets, duration, or effect beyond what is written here, honor these over any remembered version when the spell is cast, and REFUSE any cast of a spell marked [EXPENDED]):\n"+lines.join("\n")+"\n\n";
}
// UA25: the companion half of the #10 anti-drift injection. ONE canon line per spell across the
// whole party: bounds are identical for every caster, so spells the player's own block already
// covers are not repeated. Slot state is per-owner and stays on the party sheet (Spells
// available / EXPENDED lines) — this block is pure canon, deliberately without the player
// block's [EXPENDED] markers. VOLATILE half only (reads charSheets live).
function buildCompanionSpellBibleBlock(){
  if(!worldState||!worldState.npcs||!worldState.npcs.length||typeof capabilityLookup!=="function")return"";
  var seen={},i,c=worldState.character;
  if(c&&c.spells){for(i=0;i<c.spells.length;i++){if(c.spells[i]&&c.spells[i].nm)seen[capBaseName(c.spells[i].nm)]=1;}}
  var lines=[],pj,ps,_sbParty=livingPartyCompanions();/* #6: shared party scan */
  for(pj=0;pj<_sbParty.length;pj++){var n=_sbParty[pj];
    if(!n.charSheet.spells)continue;
    for(ps=0;ps<n.charSheet.spells.length;ps++){var sp=n.charSheet.spells[ps];
      if(!sp||!sp.nm)continue;
      var key=capBaseName(sp.nm);if(seen[key])continue;
      var e=capabilityLookup(sp.nm);if(!e)continue;
      seen[key]=1;
      lines.push(capBibleLine(String(sp.nm).replace(/\s*\(.*\)/,"").trim(),e));}}
  if(!lines.length)return"";
  return "CANONICAL COMPANION SPELL RULES (authoritative for PARTY MEMBERS' spells — the same fixed-bounds discipline as the player's list above; each companion's expended slots are listed on their party sheet; mark a companion's leveled cast with [COMPANION_SPELL_USED:Name|spell]):\n"+lines.join("\n")+"\n\n";
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
    lines.push(capBibleLine(nm,e));
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
// UA1: the strip regexes are DERIVED from the tag table's strip registry (tag_table.js) — one
// source of truth for what gets parsed, stripped, and documented. An engine test freezes the
// derived .source against the pre-refactor literal, so any registry edit that would change
// stripping is a deliberate, test-visible act.
var _CT_TAGS=buildCtTags();
var _CT_BARE=buildCtBare();
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
function findCompanionNpc(name){
  if(!worldState||!worldState.npcs)return null;
  // Resolve aliases / short forms (audit E16) — a COMPANION_* tag addressed as "Hemlock" must reach
  // the companion registered as "Sheriff Belor Hemlock", the same way NPC/PARTY_MEMBER tags do.
  var raw=name.trim().toLowerCase();
  var canon=(typeof resolveNpcName==="function")?resolveNpcName(name.trim()).toLowerCase():raw;
  var i,_fcParty=partyCompanionsWithSheets(true);/* DELIBERATE (user ruling 2026-07-16, AUDIT_FABLE_07_16 #6): tag ROUTING still reaches dead sheets — the death turn's own [COMPANION_HP:]/[COMPANION_CONDITION:] land after [NPC:|dead] in table order and must not drop; benefit tags gate at their source (XP mirror + COMPANION_XP refuse dead) */
  for(i=0;i<_fcParty.length;i++){var npc=_fcParty[i];var nn=npc.name.toLowerCase();if(nn===raw||nn===canon)return npc;}
  // Backstop (audit P2 remedy b): the name DOES match a party member, but they have no charSheet —
  // the COMPANION_* update is about to be dropped. Make that loud instead of silent (no-silent-failures);
  // dedupe once per name per response (map cleared at the top of applyMuts).
  for(i=0;i<worldState.npcs.length;i++){var np2=worldState.npcs[i];if(np2.partyMember&&!np2.charSheet){var nn2=np2.name.toLowerCase();if(nn2===raw||nn2===canon){warnSheetlessCompanion(np2.name);break;}}}
  return null;
}
function findCompanionChar(name){var _fcn=findCompanionNpc(name);return _fcn?_fcn.charSheet:null;}
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
// ── #50(d): model-inventory sanitation + duplicate healing (v1.291) ────────────
// Byte-identical duplicate inventory entries can only be MINTED where a model-emitted array is
// copied verbatim — sheet generation (normalizeCompanionSheet) and regeneration (generateNpcSheet).
// Every play-time write stacks via addInventoryItem, which provably cannot produce two identical
// siblings (the Frizwick t455 three-adjacent-pairs anomaly). Two teeth:
//   sanitizeModelInventory — guards the FAUCETS: strings only, duplicates stack on arrival
//   (quantity-aware: two "Rope x3" fold to x6), cap counts unique entries.
//   foldDuplicateInventory — heals the STOCK: migrateWorldState folds exact-duplicate entries
//   already sitting in saves into proper " xN" stacks.
function sanitizeModelInventory(list,cap){
  var out=[],i,j,max=cap||1e9;
  if(!list||!list.length)return out;
  for(i=0;i<list.length&&out.length<max;i++){
    if(typeof list[i]!=="string"||!list[i])continue;
    var q=_qtyParse(list[i]),t=_invNorm(q.base),hit=false;
    for(j=0;j<out.length;j++){if(_invNorm(out[j])===t){out[j]=_invBase(out[j])+" x"+(_invCount(out[j])+q.n);hit=true;break;}}
    if(!hit)out.push(list[i]);
  }
  return out;
}
// Folds BYTE-IDENTICAL entries only — healing must never guess at intent, so "Dagger"+"Dagger"
// becomes "Dagger x2" but "Dagger"+"dagger" is left alone (play-time writes already stack the
// loose-match class; anything loose-distinct in a save could be deliberate). In place, order
// preserved (first occurrence keeps its slot); returns the number of entries folded away.
function foldDuplicateInventory(inv){
  if(!inv||inv.length<2)return 0;
  var seen={},out=[],folded=0,i,k,kk;
  for(i=0;i<inv.length;i++){
    k=inv[i];kk="k:"+k; // prefixed key — an item literally named "__proto__" must not walk the prototype
    if(typeof k==="string"&&seen[kk]!=null){var fi=seen[kk];out[fi]=_invBase(out[fi])+" x"+(_invCount(out[fi])+_invCount(k));folded++;}
    else{if(typeof k==="string")seen[kk]=out.length;out.push(k);}
  }
  if(folded){inv.length=0;for(i=0;i<out.length;i++)inv.push(out[i]);}
  return folded;
}
// ⛨ UA1 CLOSED (v1.261): the tag TABLE is the ONLY parser. applyMutsLegacy and the
// TAG_AUTHORITY/TAG_SHADOW cross-check machinery are DELETED — the reverse soak finished clean
// (159 scripted parity runs + ~160 real turns across two devices, zero diffs ever;
// tnd_tagdiff_v1 never written). Rollback is `git revert` of the v1.261 commit — the one-line
// flag flip died with the flags. The unknown-tag scan is called here unconditionally: it is a
// vocabulary tripwire (the phantom-tag class, inverted), not a parity tool — v1.260 had left it
// dark in production behind the retired shadow gate.
function applyMuts(text){
  var R=applyMutsTable(text);
  __tagUnknownScan(text);
  return R;
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
  var _cost=usageCost(u,model);
  t.costUSD+=_cost;
  if(!t.byKind[kind])t.byKind[kind]={in:0,out:0,cacheRead:0,cacheWrite:0,calls:0,costUSD:0};
  var k=t.byKind[kind];
  k.in+=u.in||0;k.out+=u.out||0;k.cacheRead+=u.cacheRead||0;k.cacheWrite+=u.cacheWrite||0;k.calls++;
  k.costUSD+=_cost;
  // #30 (v1.280): a call that carries tokens but prices at $0 means its model id missed
  // MODEL_PRICING — the exact silent-undercount class from the t198 evaluation (~1/3 of the
  // window's calls priced $0). Count it visibly (total + per-kind, healing pre-#30
  // accumulators) and warn once per model id per session so the id can be added.
  if(_cost===0&&((u.in||0)+(u.out||0)+(u.cacheRead||0)+(u.cacheWrite||0))>0){
    if(typeof t.unpriced!=="number")t.unpriced=0;
    if(typeof k.unpriced!=="number")k.unpriced=0;
    t.unpriced++;k.unpriced++;
    var _mid=model||"(no model id)";
    if(!_unpricedWarned[_mid]){_unpricedWarned[_mid]=1;console.warn("[usage] no MODEL_PRICING entry matches '"+_mid+"' — tokens counted, $0 priced; the cost figures UNDERCOUNT real spend until this id is added (#30)");}
  }
}
var _unpricedWarned={};
// UA5: djb2 hash + per-campaign memo for the stable-purity tripwire above. console.warn on
// every mid-campaign change (each one is a full cache re-write); toast once per session.
var _stableHash=null,_stableHashCamp=null,_stableWarned=false;
function _stableHashOf(s){var h=5381,i;for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return h;}
function _checkStablePurity(stable){
  var h=_stableHashOf(stable),cid=(typeof worldState!=="undefined"&&worldState&&worldState.campId)||null;
  if(_stableHash!==null&&_stableHashCamp===cid&&h!==_stableHash){
    console.warn("[cache] STABLE prompt half changed mid-campaign — prompt cache resets (1.25x write). Expected only after editing rules/adult content/tone or switching provider/model; anything else is a purity leak feeding per-turn state into the cached block (UA5).");
    if(typeof showToast==="function"&&!_stableWarned){_stableWarned=true;showToast("ⓘ Stable prompt changed — cache reset (fine if you just edited rules).");}
  }
  _stableHash=h;_stableHashCamp=cid;
}
// UA28: a provider's reinforce may be a string CONSTANT (non-Claude tag discipline) or a
// FUNCTION of the model id (Anthropic — Haiku nudges, "" for Sonnet/Opus). Extracted so the
// engine tests exercise the exact resolution callGM sends — a byte-identity test on the
// Sonnet path is the guard against the block ever leaking onto the money-tested prompt.
function resolveReinforce(prov,model){var r=prov&&prov.reinforce;if(typeof r==="function")r=r(model);return r||"";}
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
  // gameplay turns only; summarize() passes its own sysOverride. reinforce is constant per
  // provider+model (UA28: resolveReinforce handles the model-conditional shape), so it belongs
  // in the stable (cacheable) half — appending it to volatile would work too, but stable keeps
  // OpenAI's automatic prefix caching effective and never displaces STYLE from the volatile end.
  if(!sysOverride){var _rf=resolveReinforce(prov,model);if(_rf){if(typeof sys==="string")sys+=_rf;else sys.stable+=_rf;}
    _lastTurnModel=model;/* #45: gameplay turns only — logTranscript stamps this onto the GM entry */}
  // UA5 tripwire: the stable half must be byte-identical turn-over-turn within a campaign or
  // every cache hit dies SILENTLY (pure cost regression, no functional symptom). Legit changes
  // exist (rules/adult/tone edits, provider/model switch) — so warn loudly, never block.
  // Hashed AFTER the reinforce append so what's checked is exactly what's sent.
  if(!sysOverride&&sys&&typeof sys!=="string")_checkStablePurity(sys.stable);
  var _tok=maxTok||1000;if(prov.tokScale!=null)_tok=prov.tokScale===0?null:Math.round(_tok*prov.tokScale);
  var body=prov.buildBody(msgs,sys,_tok,model);
  var url=typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint; // Gemini embeds the model in the URL
  var res;try{res=await fetch(url,{method:"POST",headers:prov.headers(key),body:JSON.stringify(body)});}catch(e){throw new Error("Network: "+e.message);}
  var raw;try{raw=await res.text();}catch(e){throw new Error("Read error");}
  var data;try{data=JSON.parse(raw);}catch(e){throw new Error("HTTP "+res.status+": "+raw.slice(0,200));}
  if(!res.ok){var _em=(data.error&&data.error.message)||(typeof data.error==="string"?data.error:"")||data.message||data.msg||"";throw new Error("HTTP "+res.status+(_em?": "+_em:""));}
  // Record usage BEFORE parseResponse — an empty-content response still billed input tokens.
  if(prov.parseUsage){try{var _u=prov.parseUsage(data);if(_u)recordUsage(_u,(opts&&opts.kind)||(sysOverride?"other":"turn"),model);}catch(e){console.warn("[usage] telemetry parse failed — this call is uncounted (pricing dataset undercounts, TODO #30):",e.message);}}
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
