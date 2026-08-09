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
  // #105 (B17): the state-change record — what the story has durably DONE to this place. Served
  // beside the frozen first-visit description because that description is write-once by design;
  // where the two disagree, the change record is the current truth.
  var chg=[];
  if(wNode&&wNode.stateNotes)wNode.stateNotes.forEach(function(x){chg.push(x.n+" (t"+x.t+")");});
  if(subNode&&subNode.stateNotes)subNode.stateNotes.forEach(function(x){chg.push(x.n+" (t"+x.t+")");});
  if(chg.length)lines.push("CHANGED since first visit (this OVERRIDES the descriptions above where they disagree): "+chg.join("; "));
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
  // NPCs elsewhere. B3: the dead are excluded — "Rinn → the docks" affirmatively implied he was
  // findable there forever; the roster's DECEASED line now carries the truth instead.
  // B21: living NON-SPLIT party members are excluded too — lastSeenAt re-stamps only on [NPC:]
  // tags, never on ordinary party travel, so for a companion walking WITH the party it goes stale
  // and affirmatively lies ("Frizwick → <old node>" against the party sheet's presence — the
  // t1410 confabulation seed). Split members keep their line: their thread really is elsewhere.
  var partyHere={},phN;
  for(i=0;i<worldState.npcs.length;i++){phN=worldState.npcs[i];
    if(phN.partyMember&&!npcIsDead(phN)&&!(phN.charSheet&&phN.charSheet.splitLoc&&phN.charSheet.splitLoc.location))partyHere[phN.name]=1;}
  var npcLocs=[],nNames=Object.keys(memory.npcs);
  for(i=0;i<nNames.length;i++){var nm=memory.npcs[nNames[i]];if(nm.lastSeenAt&&!nm.dead&&!partyHere[nNames[i]]&&nm.lastSeenAt!==wKey&&nm.lastSeenAt!==subKey)npcLocs.push(nNames[i]+" → "+nm.lastSeenAt);}
  if(npcLocs.length)lines.push("NPCs elsewhere: "+npcLocs.join(", "));
  // TODO #1 P5 (D11, F4 "Hard A"): split party members' threads inject EVERY turn while any
  // split exists — the GM must never forget an absent thread (the #53 canon-starve lesson,
  // applied to geography). No splits = this whole section is absent, byte-identical geo.
  var splits=(typeof partySplitMembers==="function")?partySplitMembers():[];
  if(splits.length){
    lines.push("SPLIT THREADS — these party members are ELSEWHERE right now: they cannot perceive, assist, or be assisted by the main party this round; give each split thread its own beat every turn. They move ONLY via [PARTY_SPLIT:Name|Location] (emit [PARTY_SPLIT:Name|rejoin] when they return); bare [LOCATION:] NEVER moves them.");
    var sGroups={},sgi;
    for(sgi=0;sgi<splits.length;sgi++){var sl=splits[sgi].charSheet.splitLoc;var sgk=sl.location+(sl.sublocation?" ("+sl.sublocation+")":"");if(!sGroups[sgk])sGroups[sgk]={names:[],loc:sl.location};sGroups[sgk].names.push(splits[sgi].name);}
    var sgks=Object.keys(sGroups);
    for(sgi=0;sgi<sgks.length;sgi++){var sg=sGroups[sgks[sgi]];var sgLine="— "+sgks[sgi]+": "+sg.names.join(", ");
      var sgNode=memory.map.nodes[sg.loc];
      if(sgNode&&sgNode.description)sgLine+=". "+sgNode.description;
      var sgConns=[],sgei;for(sgei=0;sgei<memory.map.edges.length;sgei++){var sge=memory.map.edges[sgei];if(sge.from===sg.loc)sgConns.push(sge.to);else if(sge.to===sg.loc)sgConns.push(sge.from);}
      if(sgConns.length)sgLine+=" [connected to: "+sgConns.join(", ")+"]";
      lines.push(sgLine);}
  }
  return"GEOGRAPHY (strict continuity — never contradict):\n"+lines.join("\n")+"\n\n";
}
// #105 (B17): the ALWAYS-PRESENT roll-up of materially changed REMOTE locations. The structural
// trap it defeats: the prompt is frozen BEFORE generation, and the GM decides to reference a
// distant place INSIDE its own output — so mention-triggered injection (the memoryNpcDetail
// last-6-messages pattern) can never help; only an always-present compact record can. The
// current node and its parent are EXCLUDED — buildGeoBlock already serves their notes in place.
// Most-recent-first, capped at CHANGED_LOC_MAX with a VISIBLE overflow line. Volatile half only
// (per-turn state — a leak into stable kills prompt caching campaign-wide); ""-clean when no
// location has ever changed, so untouched saves keep a byte-identical prompt.
function buildChangedLocationsBlock(){
  if(!memory.map||!memory.map.nodes)return"";
  var w=(worldState&&worldState.world)||{};
  var wKey=w.location,subKey=w.sublocation?w.location+"|"+w.sublocation:null;
  var rows=[],keys=Object.keys(memory.map.nodes),i,j;
  for(i=0;i<keys.length;i++){
    var k=keys[i];if(k===wKey||k===subKey)continue;
    var nd=memory.map.nodes[k];
    if(!nd.stateNotes||!nd.stateNotes.length)continue;
    var latest=0;for(j=0;j<nd.stateNotes.length;j++)if(nd.stateNotes[j].t>latest)latest=nd.stateNotes[j].t;
    rows.push({k:k,latest:latest,txt:nd.stateNotes.map(function(x){return x.n;}).join("; ")});
  }
  if(!rows.length)return"";
  rows.sort(function(a,b){return b.latest-a.latest;});
  var shown=rows.slice(0,CHANGED_LOC_MAX),over=rows.length-shown.length;
  var s="CHANGED LOCATIONS (durable changes the story has made — if any of these places comes up, its CURRENT state is this, not its old description):\n";
  for(i=0;i<shown.length;i++)s+="  - "+shown[i].k.replace("|"," — ")+": "+shown[i].txt+"\n";
  if(over>0)s+="  (+"+over+" more changed locations — older changes remain on record)\n";
  return s+"\n";
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
    // #129 zero-objective stamp: an ACTIVE quest with no checklist leaves the player nothing to
    // follow (the #20 teeth only fire on completion, so an objective-less quest never trips them).
    // Recomputed every response like allDoneSince — adding a QUEST_STEP or changing status heals it.
    var none=q.status==="active"&&!(q.objectives&&q.objectives.length);
    if(none){if(q.noObjSince==null)q.noObjSince=worldState.turn;}
    else if(q.noObjSince!=null)delete q.noObjSince;
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
// #129: the inverse gap — an ACTIVE quest with NO objectives at all gives the player no checklist
// and the #20 completion teeth nothing to detect. Reads the noObjSince stamp written by
// stampQuestCompletion above; fires once the quest has sat empty for QUEST_OBJECTIVE_NUDGE_TURNS
// (grace, so a just-accepted quest gets its steps naturally first). Same shape as
// buildQuestEscalation: one note per turn (the stalest), silent in combat.
function buildQuestObjectiveNudge(){
  if(!worldState||!worldState.questLog||worldState.combat)return"";
  var pick=null,stale=-1,i;
  for(i=0;i<worldState.questLog.length;i++){
    var q=worldState.questLog[i];
    if(q.status!=="active"||q.noObjSince==null)continue;
    var n=worldState.turn-q.noObjSince;
    if(n>=QUEST_OBJECTIVE_NUDGE_TURNS&&n>stale){stale=n;pick=q;}
  }
  if(!pick)return"";
  return"[ENGINE NOTE: Quest '"+pick.title+"' has been active for "+stale+" turns with NO recorded objectives — the player has no checklist. In THIS response emit [QUEST_STEP:"+pick.title+"|<first concrete objective>] from the leads the story has already established; add further steps as they become concrete.]";
}
// #134 (t1431 field finding — the multiplying beds; Sol's sibling row #133 carries the stale-splitLoc primary): interior canon has exactly ONE pin, the
// write-once [LOCATION_DESC:], and the GM files it unprompted for ~8% of sub-locations — so a
// lived-in room's furniture exists only in prose, evaporates within a couple of summarize
// cycles, and gets re-imagined from genre priors on return (one bed at t1413 became a "gap
// between beds" by t1431). Engine-detects/GM-decides, the #20/#129 teeth shape: once the party
// is SETTLED at an undescribed node — past the arrival turn, deliberately, because arrival
// responses are dramatically crowded and write-once means a rushed description is pinned
// forever — demand the description. Latch stamps on fire (the buildConditionAudit precedent);
// re-fires every LOC_DESC_NUDGE_COOLDOWN turns while still null; a filed description ends it.
function buildLocationDescNudge(){
  if(!worldState||worldState.combat||typeof memory==="undefined"||!memory||!memory.map)return"";
  var key=currentNodeKey();if(!key)return"";
  var node=memory.map.nodes[key];
  if(!node||node.description)return"";
  if(node.firstVisit>=worldState.turn)return"";
  var st=worldState.locDescNudged||(worldState.locDescNudged={});
  if(st[key]!=null&&worldState.turn-st[key]<LOC_DESC_NUDGE_COOLDOWN)return"";
  st[key]=worldState.turn;
  var nm=worldState.world.sublocation||worldState.world.location;
  return"[ENGINE NOTE: The current location '"+nm+"' has NO permanent description on file. In THIS response emit [LOCATION_DESC:<1-2 sentences>] fixing its PHYSICAL facts — layout, exits, and countable furnishings (beds, chairs, windows, doors) — exactly as the place exists in the story RIGHT NOW. The engine serves it back on every visit and it cannot be rewritten later, so record facts, not mood.]";
}
// #133 (t1431/B21 field finding — stale splits poison strict geography indefinitely): a
// charSheet.splitLoc is cleared ONLY by [PARTY_SPLIT:Name|rejoin], and the GM never volunteers
// resolution tags (the #29/#20/#129 channel failure, third instance — fix the class). Frizwick's
// sea-cave split survived ≥166 turns, so SPLIT THREADS asserted "she is elsewhere / cannot
// assist" every turn against a narrative that had her in the room — the standing ammunition
// under B21's confabulation and the multiplying-beds drift. Teeth: aged splits (past
// SPLIT_AUDIT_TURNS; LEGACY-unstamped = infinitely old, the #46 precedent) get ONE audit note
// listing every aged member (condition-audit style — heals a multi-split save in one turn) with
// a NEUTRAL fork: rejoin or re-affirm, story decides. The B21 lesson is load-bearing in the
// wording: the record must never command the narrative ("do not narrate them as absent merely
// because this record says so"). Audited-stamp on fire (the buildConditionAudit precedent);
// re-affirming re-emits [PARTY_SPLIT:] which mints a fresh stamped splitLoc — the reset is the write.
function buildSplitAudit(){
  if(!worldState||worldState.combat)return"";
  if(typeof partySplitMembers!=="function")return"";
  var splits=partySplitMembers(),due=[],i;
  for(i=0;i<splits.length;i++){
    var sl=splits[i].charSheet.splitLoc;
    var age=(sl.turn==null)?Infinity:worldState.turn-sl.turn;
    /* #133b: a world-location-only match (split at "Magnimar" while the party is IN Magnimar —
       the live Daeris/Morwen shape) waives the age gate: near-certain staleness, but a
       granularity gap the engine can't resolve alone (she may truly be elsewhere in the city),
       so it goes to the GM immediately rather than auto-rejoining. Exact node matches never
       reach here — the applyMuts tail folds those back deterministically. */
    var sameWorld=sl.location===worldState.world.location;
    if(age<SPLIT_AUDIT_TURNS&&!sameWorld)continue;
    if(sl.audited!=null&&worldState.turn-sl.audited<SPLIT_AUDIT_TURNS)continue;
    due.push(splits[i]);
  }
  if(!due.length)return"";
  var lines=[];
  for(i=0;i<due.length;i++){
    var d=due[i],dl=d.charSheet.splitLoc;
    dl.audited=worldState.turn;
    lines.push("— "+d.name+": recorded as SPLIT OFF at "+dl.location+(dl.sublocation?" ("+dl.sublocation+")":"")+(dl.turn!=null?" since turn "+dl.turn:" since before the record began"));
  }
  return"[ENGINE NOTE — SPLIT AUDIT: the party record still lists the member(s) below as split off on their own thread:\n"+lines.join("\n")+"\nFor EACH: if the story has them WITH the party right now, emit [PARTY_SPLIT:"+due[0].name+"|rejoin] (one per member, their own name); if they are genuinely still apart, re-affirm the split by re-emitting [PARTY_SPLIT:<Name>|<their current location>] — re-affirming resets this check. Decide from the STORY: do not narrate them as absent merely because this record says so.]";
}
// #137 (the t1467 phantom-presence collapse — DOC/OffTheRails_fable.html + _sol.html): the
// INVERSE of buildSplitAudit above. That audit can only police records that EXIST; when a
// narrated stay-behind never earns a [PARTY_SPLIT:] (or the tag died to the pre-v1.550 purge),
// every presence reader defaults the member to co-located and the GM eventually materializes
// them (Daeris, t1463). This is the deterministic sweep: every PRESENCE_AUDIT_TURNS, list the
// members the record holds WITH the party and demand confirmation-or-tag. Engine detects, GM
// decides — never auto-place from prose. Silent in combat WITHOUT consuming (the deadStatusNudge
// discipline); split members are deliberately absent (buildSplitAudit owns them).
function buildPresenceAudit(){
  if(worldState.combat)return"";
  if(typeof livingPartyCompanions!=="function")return"";
  var last=worldState.lastPresenceAudit||0;
  if(worldState.turn-last<PRESENCE_AUDIT_TURNS)return"";
  var withParty=[],all=livingPartyCompanions(),i;
  for(i=0;i<all.length;i++){if(!(all[i].charSheet&&all[i].charSheet.splitLoc&&all[i].charSheet.splitLoc.location))withParty.push(all[i].name);}
  if(!withParty.length)return"";
  worldState.lastPresenceAudit=worldState.turn;
  return"[ENGINE NOTE — PRESENCE CHECK (not a player action): the tracker records these party members as WITH the player in the current scene: "+withParty.join(", ")+". For EACH one who is NOT physically present where you are narrating (stayed behind, waiting elsewhere, separated for any reason), emit [PARTY_SPLIT:Name|Location] or [PARTY_SPLIT:Name|Location|Sublocation] NOW — the record cannot heal itself, and an unrecorded separation eventually makes the engine assert their presence until the story breaks. If everyone listed is genuinely present, emit nothing.]";
}
// #140③ (user go 2026-08-07): the deity-drift nudge — a divine-class character whose ACTUAL
// alignment has walked off their god's grid. State-based with a cooldown (the #29 lesson:
// event-based teeth rot), judged ONLY against DEITY_MAP's own grid — a custom/homebrew deity
// has no grid and is never judged. Descriptive and reversible: the GM decides whether the god
// has noticed (an omen, a chill in granted power, a dream) — or has not, YET; never a silent
// mechanical revocation. Covers the player and divine companions alike.
function buildDeityDriftNudge(){
  if(worldState.combat||typeof DEITY_MAP==="undefined")return"";
  var latch=worldState.deityDriftNudged||{};
  function check(sheet,who){
    if(!sheet||!sheet.deity||!sheet.cls||!DEITY_MAP[sheet.cls])return null;
    var al=sheet.actualAlignment||sheet.statedAlignment;
    if(!al)return null;
    var grid=DEITY_MAP[sheet.cls],mine=[],k,known=false;
    for(k in grid){if(grid[k]===sheet.deity){known=true;if(k===al)return null;mine.push(k);}}
    if(!known)return null;/* custom deity — no grid to judge */
    if(latch[who]&&worldState.turn-latch[who]<DEITY_DRIFT_COOLDOWN)return null;
    return {who:who,deity:sheet.deity,al:al,favors:mine};
  }
  var hit=check(worldState.character,worldState.character.name);
  if(!hit&&typeof livingPartyCompanions==="function"){
    var comps=livingPartyCompanions(),ci;
    for(ci=0;ci<comps.length&&!hit;ci++)hit=check(comps[ci].charSheet,comps[ci].name);
  }
  if(!hit)return"";
  if(!worldState.deityDriftNudged)worldState.deityDriftNudged={};
  worldState.deityDriftNudged[hit.who]=worldState.turn;
  return"[ENGINE NOTE — DEITY DRIFT (not a player action): "+hit.who+" now walks "+hit.al+", while their deity "+hit.deity+" favors "+hit.favors.join(" / ")+". Decide from the story whether the god has noticed: an omen, a cooling in granted power, a pointed dream — or no reaction YET if the story hasn't earned one. Never silently revoke abilities; if the rift ever becomes canon, show it in the fiction first.]";
}
// #142: the reconcile-skip heal note — the demand half of skip-and-demand (Direction-1 of the
// adversarial review: skip-and-warn would turn the forgotten-rest morning-after into a stuck
// clock; this note bounds that failure to one turn). One shot, 2-turn shelf.
function buildReconcileSkipNudge(){
  var s=worldState.reconcileSkip;
  if(!s)return"";
  if(worldState.turn-s.turn>2){worldState.reconcileSkip=null;return"";}
  worldState.reconcileSkip=null;
  return"[ENGINE NOTE — CLOCK LABEL MISMATCH (not a player action): you declared the time as '"+s.label+"', but that phase already passed this day — the clock was NOT advanced ("+Math.round(s.delta/60)+"h would have jumped to tomorrow). Resolve it now: if a night's sleep genuinely passed, emit [REST:long]; if days passed, emit [TIME_ADVANCE:Nd]; if it is actually still the same day, re-declare the correct time of day with [TIME:...]. Never restate elapsed totals yourself — the engine does all arithmetic.]";
}
// #137 fast path: commitGmTurn arms worldState.presencePing when the RAW response narrated a
// stay-behind (detectStayBehind, helpers.js) with no [PARTY_SPLIT:] in the same response. One
// shot, 2-turn shelf life (the recentSwitch pattern) — consumed on fire, expired silently.
function buildStayBehindNudge(){
  var p=worldState.presencePing;
  if(!p)return"";
  if(worldState.turn-p.turn>2){worldState.presencePing=null;return"";}
  worldState.presencePing=null;
  return"[ENGINE NOTE — SEPARATION UNRECORDED (not a player action): your recent narration described "+p.name+" staying behind or separating from the party, but no [PARTY_SPLIT:] was recorded — the engine still treats them as present in every scene. If they truly separated, emit [PARTY_SPLIT:"+p.name+"|Location] (add |Sublocation if known) NOW; if they are actually with the party, emit nothing and keep narrating them present.]";
}
// #129: the escalation half of the schedule teeth (expiry lives in clock.js scheduleSweepExpired).
// The HAPPENING NOW line in buildClockBlock is a mid-prompt instruction, and the field showed the
// GM ignoring it indefinitely — the same channel failure as the #20 quest teeth, so the same fix:
// once an event has sat unresolved past SCHEDULE_ESCALATE_MIN, this note rides the user-message
// engine-note channel demanding narration + [SCHEDULE_RESOLVED:]. One note per turn (the stalest);
// silent in combat so a fight is never derailed.
function buildScheduleEscalation(){
  if(!worldState||worldState.combat)return"";
  if(typeof scheduleDue!=="function")return"";
  // B21: expire-before-escalate — an entry already past SCHEDULE_EXPIRE_MIN belongs to the sweep
  // (next applyMuts tail), never to a narrate-the-consequence command. Without this guard, the
  // teeth's first run on an old save handed the GM a command to narrate a ~1,100-turn-stale tide
  // deadline, and it confabulated a present party member trapped there (Runelords t1410).
  var due=scheduleDue(),pick=null,i;
  for(i=0;i<due.length;i++){
    if(due[i].elapsed>=SCHEDULE_ESCALATE_MIN&&due[i].elapsed<=SCHEDULE_EXPIRE_MIN&&(!pick||due[i].elapsed>pick.elapsed))pick=due[i];
  }
  if(!pick)return"";
  var ago=fmtGap(pick.elapsed).replace(/^in /,"");
  return"[ENGINE NOTE: Scheduled event '"+pick.label+"' came due "+ago+" ago and is still unresolved. In THIS response narrate its consequence — after this long it has already happened, so treat it as something the world did while the party was busy — then emit [SCHEDULE_RESOLVED:"+pick.label+"]. If events have made it moot, emit [SCHEDULE_CANCEL:"+pick.label+"] instead. Unresolved events are auto-retired "+(SCHEDULE_EXPIRE_MIN/MIN_PER_DAY)+" in-game days after coming due.]";
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
      var key=arc.title+"|"+mq,rec=worldState.arcDriftNudged&&worldState.arcDriftNudged[key];
      if(typeof rec==="number")rec={t:rec,n:1};/* pre-#127 stamp was a bare lastTurn number = one check already sent */
      if(rec&&(worldState.turn-rec.t)<ARC_DRIFT_RECHECK)continue;/* still inside the recheck window */
      if(!worldState.arcDriftNudged)worldState.arcDriftNudged={};
      var nth=(rec?rec.n:0)+1;
      worldState.arcDriftNudged[key]={t:worldState.turn,n:nth};
      // #127-①: the soft note alone had no teeth — the GM can "justify and forget" forever (the
      // prompt-channel lesson). After two unanswered checks the note becomes a forced fork: one
      // of the two tags, THIS response. Still never auto-closed (the premature-close worry
      // stands); [ARC_CONTINUE:] is the sanctioned "it really is still open" answer and resets
      // the escalation.
      if(nth>=3){
        return "[ENGINE NOTE — ARC DRIFT CHECK, FINAL (check #"+nth+", not a player action): the arc '"+arc.title+"' is still active, but its originating quest '"+mq+"' completed long ago, and two previous checks went unanswered. You MUST answer IN THIS RESPONSE with exactly one of: [ARC_COMPLETE:"+arc.title+"] (the story is finished — grant its reward in the same response), or [ARC_CONTINUE:"+arc.title+"|one line naming the concrete work that remains]. Do not leave this check unanswered again.]";
      }
      return "[ENGINE NOTE — ARC DRIFT CHECK (not a player action): the arc '"+arc.title+"' is still active, but its originating quest '"+mq+"' has already been completed. If this arc's story is genuinely finished, emit [ARC_COMPLETE:"+arc.title+"] with its reward. If real work legitimately remains, that is fine — do NOT force it closed: answer [ARC_CONTINUE:"+arc.title+"|why] to confirm it, and keep it converging toward the arc's objective"+(arc.objective?" ('"+arc.objective+"')":"")+" instead of sprawling into new open-ended threads. (Repeats about every "+ARC_DRIFT_RECHECK+" turns; after two unanswered checks it becomes a required choice.)]";
    }
  }
  return"";
}
// #127-②: quest pressure through the FRONT door. When an arc is ACTIVE but the story has never
// staged it — no live/offered quest matches its title AND no archived quest does (an archived
// match means it already ran; that aftermath is buildArcDriftNudge's case) — the GM is told to
// surface it in-fiction and register it as a [QUEST:|offered]. Field evidence (t1385 live save,
// 2026-08-02): Act 2's three parallel arcs sat active 507 turns with no matching quest ever
// offered — the player literally never heard of Jorgenfist; the only "quest pressure" was
// skeleton content leaking through companion dialogue and suggestion buttons. Re-fires every
// ARC_DRIFT_RECHECK turns while the arc stays unstaged (a one-shot would just rot silently —
// the #29 lesson); one arc per turn (first unstaged wins); silent in combat WITHOUT burning the
// window (the stamp only writes when a note is returned).
function buildArcStagingNudge(){
  if(!worldState||worldState.combat||!worldState.skeleton)return"";
  var sk=worldState.skeleton,ql=worldState.questLog||[],i,j,k;
  var qkeys=Object.keys((typeof memory!=="undefined"&&memory&&memory.quests)||{});
  for(i=0;i<(sk.acts||[]).length;i++){var act=sk.acts[i];
    if(act.status!=="active")continue;
    for(j=0;j<(act.arcs||[]).length;j++){var arc=act.arcs[j];
      if(arc.status!=="active")continue;
      var tracked=false;
      for(k=0;k<ql.length;k++){if((ql[k].status==="active"||ql[k].status==="offered")&&arcTitleMatch(arc.title,ql[k].title)){tracked=true;break;}}
      if(!tracked)for(k=0;k<qkeys.length;k++){var aq=memory.quests[qkeys[k]];if(aq&&arcTitleMatch(arc.title,aq.title||qkeys[k])){tracked=true;break;}}
      if(tracked)continue;
      var last=worldState.arcStaged&&worldState.arcStaged[arc.title];
      if(last!=null&&(worldState.turn-last)<ARC_DRIFT_RECHECK)continue;
      if(!worldState.arcStaged)worldState.arcStaged={};
      worldState.arcStaged[arc.title]=worldState.turn;
      return "[ENGINE NOTE — STAGE THIS ARC (not a player action): the arc '"+arc.title+"'"+(arc.objective?" ('"+arc.objective+"')":"")+" is ACTIVE, but the story has never introduced it — the player has no way to know it exists. Over the next few turns, surface it IN-FICTION through the world: a rumor, a messenger, a discovery, a consequence, whatever fits the current scene — never an exposition dump, and never through a companion suddenly knowing things they were not there to learn. When the hook lands, register it with [QUEST:<player-facing title>|offered|<desc>]. (Repeats about every "+ARC_DRIFT_RECHECK+" turns until a matching quest exists.)]";
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
  var keepTag=c.who?"[COMPANION_ITEM_KEPT:"+c.who+"|"+c.item+"]":"[ITEM_KEPT:"+c.item+"]";
  var whose=c.who?c.who+"'s":"the player's";
  return "[ENGINE NOTE — CONSUMABLE CHECK (not a player action): the recent scene mentioned "+whose+" '"+c.item+"' but no item-loss tag was emitted. Check your own recent narration: if one or more units were actually expended (thrown, drunk, detonated, burned, used up), emit "+tag+" in THIS response — one tag per unit spent. If it was merely mentioned, carried, examined, or reached for without being consumed, emit "+keepTag+" instead — that records the decision and stops this check re-asking. Answer with ONE of those two tags and nothing else: never in the story text, and never invent a consumption.]";
}
// B3: dead-status conflict nudge — the [NPC:] handler REFUSED a status write on a dead character
// (the resurrection-by-overwrite leg). Same engine-detects/GM-decides shape as the downgrade
// nudge: one per turn, consumed at build time, silent mid-combat WITHOUT consuming (the queue
// keeps the conflict until the dust settles).
function buildDeadStatusNudge(){
  if(!worldState||worldState.combat)return"";
  var q=worldState.deadStatusConflicts;
  if(!q||!q.length)return"";
  var d=q.shift();if(!q.length)delete worldState.deadStatusConflicts;
  var w=wsNpcByName(d.name);var died=(w&&typeof w.dead==="number")?" (died t"+w.dead+")":"";
  return "[ENGINE NOTE — DEAD CHARACTER (not a player action): "+d.name+" is recorded DEAD"+died+", but the last response set their status to \""+d.status+"\", which the engine refused. If they are genuinely alive again through an explicit in-story resurrection, emit [NPC:"+d.name+"|resurrected|relation] to confirm it. Otherwise they stay dead: never narrate them as present or alive — only as remains, memory, or legacy.]";
}
// TODO #1 D12 exit, round 3 (2026-07-18 — the fix that actually addresses the mechanism).
// Rounds 1-2 put the reversal in the SYSTEM prompt (mid-volatile, then post-STYLE). Both failed
// in the field for the same reason, which the header below already states: the system prompt
// sits BEFORE the whole conversation, and the retained tail is ~3 exchanges of the GM's OWN
// third-person prose. No position INSIDE the system prompt is later than that history, so
// recency won twice. This channel is the answer — the note rides the user message, i.e. the
// newest tokens in context, after all the third-person output it has to overrule.
// Deliberately NOT bound by the protocol clause's "respond only with tags": this note is a
// narration-mode directive, and says so in its own text (the clause targets bookkeeping notes).
function buildMpEndNote(){
  if(!worldState||!worldState.mpEnded||!worldState.character)return"";
  if(typeof playerCount==="function"&&playerCount()>1)return"";/* re-promoted mid-window — the D12 override rules again */
  var nm=worldState.character.name;
  return "[NARRATION MODE CHANGE — this note is a PROSE directive, not bookkeeping, and applies to THIS response: the multiplayer session has ended and "+nm+" is the only player character again. Write this response in SECOND PERSON: 'you' means "+nm+". The third-person narration in the recent turns above was the multiplayer mode and is now over — do not continue that style. Change the prose silently; never mention the mode change in the story.]";
}
// v1.381 — mood staleness audit. The engine-detected half of the mood/relation repair: v1.379/380
// stopped the corruption and cleaned the data, but nothing made a stale mood HEAL. `status` was
// write-once-per-mention and immortal otherwise, so a single emission pinned a character's
// "current" mood for an entire arc — the reported case read watchful/tense for ~50 turns while
// the memory tier still said easy/approving.
// Shape follows buildRelationshipAudit (timer + stamp + empty-window consumption + combat gate),
// but triggers on PER-ITEM age like buildConditionAudit: mood carries individual staleness in a
// way bonds do not, so a global sweep clock would be the wrong instrument.
// SCOPE (v1): party members only — they are in every scene, they are what the player notices, and
// the set is deterministic. Extending to NPCs present in the scene needs lastSeenAt-vs-current-node
// logic and is deliberately deferred; an empty mood on an OFF-SCREEN character is CORRECT and must
// never be nagged (the campaign's endgame villain has no current mood because nobody has seen him).
// Anti-churn is load-bearing: without "leave accurate ones alone", a compliant GM re-emits every
// mood each time this fires — costing tokens AND re-rolling the vocabulary-leak dice on characters
// that were fine. Partial updates (v1.379) are what make the refresh cheap: the GM can now update a
// mood alone via [NPC:Name|mood|] without restating the relationship.
function buildMoodAudit(){
  if(!worldState||!worldState.character||worldState.combat)return"";
  if(worldState.turn-(worldState.lastMoodAudit||0)<MOOD_AUDIT_COOLDOWN)return"";
  var party=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[],lines=[],due=false,i;
  for(i=0;i<party.length;i++){
    var n=party[i],mood=n.status||"",age=worldState.turn-(n.statusTurn||0);
    if(!mood){due=true;lines.push("- "+n.name+": (no mood recorded) — set one from how they are ACTUALLY behaving now");}
    else{
      if(age>=MOOD_AUDIT_TURNS)due=true;
      lines.push("- "+n.name+": \""+mood+"\""+(n.statusTurn?" (set t"+n.statusTurn+", "+age+" turns ago)":" (age unknown)"));
    }
  }
  if(!lines.length){worldState.lastMoodAudit=worldState.turn;return"";}/* nobody to audit — consume the window so a companion joining next turn isn't audited one turn later */
  if(!due)return"";
  worldState.lastMoodAudit=worldState.turn;
  return "[ENGINE NOTE — MOOD CHECK (not a player action): the tracker's record of how each party member is FEELING is below, with its age. For EACH: if it still matches how you are actually writing them, leave it alone — do NOT re-emit an unchanged mood. If it has gone stale, or was never set, emit [NPC:Name|new mood|] — the empty third slot updates the mood WITHOUT touching their relationship. Mood is 2-4 words for their CURRENT emotional state ONLY; never a relationship word (ally/companion/acquaintance), which the engine tracks separately.\n"+lines.join("\n")+"]";
}
// #96 compliance nudge (field finding 2026-07-26, same night as the cutover): the [SAY:] duty is
// new and the sessionLog is full of the GM's own UNTAGGED dialogue — momentum beats a doc line
// (the prompt-channel lesson: an instruction that loses to the GM's recent output needs a new
// CHANNEL, not a better position). Fires while the newest GM response contains quoted dialogue
// but no [SAY:] tag; goes silent the moment compliance starts. Live evidence: 3/3 recent field
// responses were dialogue-heavy with zero tags — every line read in the narrator's voice.
function buildSayComplianceNudge(){
  if(typeof sessionLog==="undefined"||!sessionLog||!sessionLog.length)return"";
  var last=null,i;
  for(i=sessionLog.length-1;i>=0;i--){if(sessionLog[i]&&sessionLog[i].role==="assistant"){last=String(sessionLog[i].content||"");break;}}
  if(!last)return"";
  var quoteChars=(last.match(/["“”]/g)||[]).length;
  if(quoteChars<2)return"";/* no quoted dialogue — nothing was mis-voiced */
  var sayCount=(last.match(/\[SAY:/g)||[]).length;
  // Partial compliance counts as non-compliance (Fable review entry 7): each tagged speech accounts
  // for ~2 quote chars, so tags present but >=2 untagged quote-pairs of slack means lines shipped
  // mis-voiced. The +4 slack keeps a compliant response with a scare quote / inch marks silent.
  if(sayCount>0&&quoteChars<2*sayCount+4)return"";
  var lead=sayCount>0?"your previous response left some quoted dialogue without a [SAY:] tag, so those lines were read aloud in the NARRATOR'S voice instead of the character's":"your previous response contained quoted dialogue with NO [SAY:] tags, so every spoken line was read aloud in the NARRATOR'S voice instead of the character's";
  return "[ENGINE NOTE — VOICE TAGS MISSING (not a player action): "+lead+". From THIS response on, place [SAY:Character Name] immediately before EVERY line of quoted dialogue — including the player character's own lines (use their character NAME, never 'you'). The tag is invisible to the player. See [SAY:] in STATE TAGS.]";
}
var NOTE_BUILDERS=[buildQuestEscalation,buildQuestObjectiveNudge,buildSplitAudit,buildPresenceAudit,buildStayBehindNudge,buildDeityDriftNudge,buildReconcileSkipNudge,buildLocationDescNudge,buildScheduleEscalation,buildConditionAudit,buildReciprocityNudge,buildArcQuestNudge,buildArcStagingNudge,buildArcDriftNudge,buildRelationshipDowngradeNudge,buildRelationshipAudit,buildMergeConfirmNudge,buildConsumableNudge,buildDeadStatusNudge,buildMpEndNote,buildMoodAudit,buildSayComplianceNudge];/* #137: presence audit + stay-behind nudge beside their sibling buildSplitAudit */
// B5: the shared silence clause. Engine notes ride the USER message (highest-authority channel,
// chosen deliberately — see buildQuestEscalation's header), and no builder ever said HOW to
// answer: "leave the sheet alone" reads as an invitation to answer in prose, and sonnet-5 (which
// we run with thinking disabled) opened responses with spoken bookkeeping ("Nothing spent, no
// tag needed" — the B5 field reports). One clause appended after the joined notes fixes all ten
// builders at once. Wording constraints (the drift risk): it MUST keep tag emission as the
// sanctioned response (these notes exist because softer instructions were ignored — suppressing
// the tags would silently revive the #60/#46 classes), and it must NOT suppress a note's
// legitimate fictional consequences (the condition audit's "let it visibly shape the narration"
// — the limp shows, the checking doesn't). Only appended when a note fired: an empty notes block
// stays byte-empty (engine-tested — the common turn must not grow a phantom preamble).
var ENGINE_NOTES_PROTOCOL="[ENGINE NOTES PROTOCOL: the bracketed notes above are engine bookkeeping, not part of the story. Respond to them ONLY by emitting the state tags they call for, or by silently leaving state unchanged. The narrative must read as if the notes do not exist — never acknowledge a note, a tag, or the act of checking in the story text. Their fictional CONSEQUENCES may still shape the scene: a kept wound may limp, an expended vial is simply gone. ONE EXCEPTION: a note that explicitly identifies itself as a PROSE or NARRATION directive is not bookkeeping — apply it to the writing of this response as instructed.]";
function buildEngineNotes(){
  var out=[],i;
  for(i=0;i<NOTE_BUILDERS.length;i++){var n=NOTE_BUILDERS[i]();if(n)out.push(n);}
  if(!out.length)return"";
  return out.join("\n\n")+"\n\n"+ENGINE_NOTES_PROTOCOL;
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
  // B3 (v1.361): dead NPCs render as an AFFIRMATIVE "DECEASED" line, never as silent omission —
  // absence taught the GM nothing, so every other tier (TOC/detail/RAG excerpts/geography) kept
  // presenting the dead as alive and NOTHING in "the CURRENT state blocks above" overrode it
  // (the Rinn Toldrath class). Cap 10 most recent; the full record stays in memory.npcs.
  var _decList=[];
  var i,nstr="none";if(worldState.npcs.length){var ns=[];for(i=0;i<worldState.npcs.length;i++){var npc=worldState.npcs[i];if(npcIsDead(npc)){_decList.push({n:npc.name,t:(typeof npc.dead==="number"?npc.dead:0)});continue;}var npcAka=npc.aliases&&npc.aliases.length?" [aka: "+npc.aliases.join(", ")+"]":"";/* pronoun fallback: explicit wins; party members derive from charSheet.gender; everyone else defaults to they/them so the GM never has to guess */var npcPr=npc.pronouns||(npc.partyMember&&npc.charSheet&&npc.charSheet.gender?pronounsForGender(npc.charSheet.gender):"they/them");var npcRel=(npc.partyMember&&relByEntity[npc.name.toLowerCase()])||npc.rel;
    /* v1.372: build the parenthetical from PRESENT parts only. Mood may now be legitimately empty
       (a character whose current mood was never recorded, or was repaired away), and the old
       unguarded concatenation rendered that as a stray leading comma — "Morwen Zethran (, Wife…)".
       Byte-identical to the previous output whenever every part is present. */
    /* v1.382: LABEL the mood. The prompt carries two mood-ish readings for the same character —
       npc.status here (GM-written, per-turn) and memory.npcs[].attitude in the NPC-detail and graph
       blocks (summarizer-written, slower). Both were rendered as bare adjective pairs, so they read
       as rival claims about one thing rather than complementary facts about two: a character can be
       "watchful, tense" about the job while "easy, approving" toward the player, and both be true.
       Labels remove the adjudication entirely — the model never has to guess which is which. */
    var npcBits=[];if(npc.status)npcBits.push("mood: "+npc.status);if(npcRel)npcBits.push(npcRel);if(npcPr)npcBits.push(npcPr);if(npc.partyMember)npcBits.push("PARTY MEMBER");
    ns.push(npc.name+npcAka+(npcBits.length?" ("+npcBits.join(", ")+")":""));}if(ns.length)nstr=ns.join("; ");}
  if(_decList.length){
    _decList.sort(function(a,b){return b.t-a.t;});
    var _decShow=_decList.slice(0,10),_decStr=[],_dsi;
    for(_dsi=0;_dsi<_decShow.length;_dsi++)_decStr.push(_decShow[_dsi].n+(_decShow[_dsi].t?" (died t"+_decShow[_dsi].t+")":""));
    nstr+="\nDECEASED — permanent canon, they are DEAD: never narrate them as present or alive, only as remains, memory, or legacy: "+_decStr.join(", ")+(_decList.length>10?" (+"+(_decList.length-10)+" more long dead)":"");
  }
  // PARTY MEMBER SHEETS — companions' full combat kit (class/spells/abilities). Without this the
  // GM only sees the one-line NPC roster entry and never knows a companion can cast → they default
  // to swinging a weapon. Rich block so a caster casts, a rogue uses tricks, etc.
  var partyBlock="";
  if(worldState.npcs.length){
    var pmArr=[],awArr=[],pj,_pbParty=livingPartyCompanions();/* #6: shared party scan; body stays inline (per-companion prompt text) */
    for(pj=0;pj<_pbParty.length;pj++){
      var pmN=_pbParty[pj];
      var pcs=pmN.charSheet;
      /* #137: membership is NOT presence. A split member's sheet must never ride under the
         "fighting alongside" header (the t1467 amplifier — the prompt asserted Daeris present
         every turn while SPLIT THREADS said otherwise). Their kit stays available under the
         AWAY header so their own thread can still be narrated with real capabilities. */
      var pmAway=!!(pcs.splitLoc&&pcs.splitLoc.location);
      var pAb="none";if(pcs.abilities&&pcs.abilities.length){var pa2=[],pai;for(pai=0;pai<pcs.abilities.length;pai++)pa2.push(pcs.abilities[pai].nm);if(pa2.length)pAb=pa2.join(", ");}
      // Playtest-F1 (v1.239): name expended spells EXPLICITLY instead of omitting them — the bible
      // block still injects an omitted spell's canon, so omission read as "available" to the GM
      // (the t31/t35 Charm Person incident). Absence communicates nothing; a stated clause is iron.
      /* #110 (v1.508): companion availability is their OWN mana pool; racial 1/day stays the
         one per-spell hard gate. Same restructure as the player sheet. */
      var pSp="none";if(pcs.spells&&pcs.spells.length){var ps2=[],psi;for(psi=0;psi<pcs.spells.length;psi++){var _ps=pcs.spells[psi];ps2.push(_ps.racial&&_ps.used&&_ps.lvl>0?_ps.nm+" [1/day — EXPENDED until dawn]":_ps.nm);}pSp=ps2.join(", ");}
      var pMx=manaMax(pcs);
      var pSt=pcs.stats?("STR "+pcs.stats.STR+" DEX "+pcs.stats.DEX+" CON "+pcs.stats.CON+" INT "+pcs.stats.INT+" WIS "+pcs.stats.WIS+" CHA "+pcs.stats.CHA):"";
      var pInv=(pcs.inventory&&pcs.inventory.length)?pcs.inventory.join(", "):"none";
      /* #140 ①+②: alignment finally reaches the GM for companions (it shaped nothing before —
         the sheet line never carried it), with the stated-vs-actual tension when play has
         drifted them. Descriptive, not directive — the GM decides what the tension means. */
      var pmAl=pcs.actualAlignment||pcs.statedAlignment||"";
      var pmAlTension=(pcs.statedAlignment&&pcs.actualAlignment&&pcs.statedAlignment!==pcs.actualAlignment)?" (professed "+pcs.statedAlignment+" — play has drifted them)":"";
      var line=pmN.name+" — "+(pcs.subraceNm?pcs.subraceNm+" ":"")+(pcs.ancestry?pcs.ancestry+" ":"")+(pcs.cls||"adventurer")+(pcs.archetypeNm?" ["+pcs.archetypeNm+"]":"")+", Level "+(pcs.level||1)+" | HP "+pcs.hp+"/"+pcs.maxHp+(pmAl?" | "+pmAl+pmAlTension:"")+"\n";
      if(pSt)line+="  Stats: "+pSt+"\n";
      line+="  Abilities: "+pAb+"\n  Spells: "+pSp+(pMx>0?"\n  Mana: "+manaCur(pcs)+"/"+pMx+(pcs.cls==="Necromancer"?" (Necromancer — may overdraw in blood; the engine deducts it)":""):"")+"\n  Inventory: "+pInv;
      // #46: companion conditions were WRITTEN by [COMPANION_CONDITION:] but never injected —
      // a write-path with no read-path, so they silently rotted (Daeris, Unconscious for ~200
      // turns while narrated awake). Inject with age so stale state is visible and self-corrects.
      if(pcs.conditions&&pcs.conditions.length)line+="\n  Conditions: "+pcs.conditions.map(condInjectFmt).join(", ");
      // #61: companion relationships were WRITTEN by [COMPANION_RELATIONSHIP:] but never injected —
      // the same write-path-with-no-read-path class as the #46 conditions above. The GM never saw
      // a companion's bonds (Morwen's marriages, 222 turns invisible at t755) and reconstructed
      // party dynamics from the roster's decayed one-liners → hallucinated relationships.
      if(pcs.relationships&&pcs.relationships.length)line+="\n  Relationships: "+pcs.relationships.map(function(r){return r.entity+(r.descriptor?" ("+r.descriptor+")":"");}).join(", ");
      if(pmAway){line+="\n  Currently at: "+pcs.splitLoc.location+(pcs.splitLoc.sublocation?" ("+pcs.splitLoc.sublocation+")":"");awArr.push(line);}
      else pmArr.push(line);
    }
    if(pmArr.length)partyBlock="PARTY MEMBER SHEETS (companions fighting alongside the player — have each act IN CHARACTER using their OWN abilities and spells below, not just weapons: a spellcaster should cast from their spell list, a rogue should use stealth and tricks. Track their resources with COMPANION_* tags. If a companion's listed Condition no longer matches the fiction, emit [COMPANION_CONDITION_REMOVED:Name|condition] NOW. Each Relationships line is that companion's CANONICAL record of their bonds — never contradict it, and update it with [COMPANION_RELATIONSHIP:] when a bond genuinely changes):\n"+pmArr.join("\n")+"\n\n";
    if(awArr.length)partyBlock+="PARTY MEMBERS CURRENTLY AWAY (split from the party — NOT in this scene; they act only in their own thread per SPLIT THREADS; never narrate them as present here, and never have them assist the player's scene):\n"+awArr.join("\n")+"\n\n";
  }
  // Live party-size note so the GM never narrates a join it can't make (the engine also caps it).
  var pmCnt=partyCompanionCount(),pmCap=partyCompanionCap();
  var partyCapBlock="PARTY SIZE: "+pmCnt+" of "+pmCap+" companion slots filled (hard cap "+PARTY_MAX+" total, including the player)."+(pmCnt>=pmCap?" THE PARTY IS FULL — do NOT have any new NPC join the party (no [PARTY_MEMBER:|true]) until a current companion leaves or dies. An NPC may still aid the party temporarily as an ally without becoming a member.":"")
    // TODO #1 P1: >1 guard is load-bearing — single-player prompts must stay BYTE-IDENTICAL
    // (the DOC_multiplayer invariant; engine-tested). Full round semantics arrive with P3/P4.
    +(typeof playerCount==="function"&&playerCount()>1?" PLAYERS: "+playerCount()+" party members are PLAYER characters (hot-seat multiplayer — each acts on their own player's intent)."
      /* TODO #1 P4 (D8/D10): the multiplayer round rules — VOLATILE-only, playerCount>1 gated
         (single-player byte-identity is the spec anchor, engine-tested). References the existing
         COMPANION_* tag docs in the stable half; adds NO tag vocabulary. */
      +"\nMULTIPLAYER ROUND RULES:"
      +"\n- The player message each turn is a labeled round block — one line per player character, \"Name: action\". Resolve ALL of the round's actions in ONE narration, ordered sensibly within the fiction; no player character's action may be skipped."
      /* D12 (supersedes D10, user field ruling 2026-07-18): third person for EVERYONE while
         multiple players are active — "you" privileges one player at the table; naming every
         character gives all players equal agency and keeps the narrative clean. */
      +"\n- NARRATION IS THIRD-PERSON while multiple players are active: refer to EVERY player character by name (he/she/they) — the word \"you\" must not appear in narration. No character is the camera; give each player's character their own clearly-attributed beat."
      +"\n- STATE TAG ROUTING: bare tags (HP, GOLD, ITEM_GAINED/ITEM_LOST, SPELL_USED, CONDITION, ALIGNMENT, ABILITY_GAINED, SKILL_SUCCESS, ...) always mean "+c.name+" and ONLY "+c.name+". For every OTHER player character use the name-addressed COMPANION_* tags (e.g. [COMPANION_HP:Name|-3]), exactly as for companions. NEVER emit a bare mutation tag for something that happened to a player character other than "+c.name+"."
      +"\n- [XP:N] stays a single shared award (the engine mirrors it to every party member) — emit it once per round, never per character; [COMPANION_XP:] remains individual-bonus-only.":"")
    +"\n\n";
  var questBlock=buildQuestBlock();
  var abilstr="none";if(c.abilities&&c.abilities.length){var as2=[];for(i=0;i<c.abilities.length;i++)as2.push(c.abilities[i].nm);abilstr=as2.join(", ");}
  // Playtest-F1 (v1.239): unavailability is NAMED, not omitted. #110 (v1.508): availability is
  // now the MANA POOL — the sheet lists every known spell, annotates the one remaining hard
  // gate (racial 1/day), and states the pool. The refusal teeth live in the bible block header.
  var spstr="none";if(c.spells&&c.spells.length){var sp2=[];for(i=0;i<c.spells.length;i++){var _sp=c.spells[i];sp2.push(_sp.racial&&_sp.used&&_sp.lvl>0?_sp.nm+" [1/day — EXPENDED until dawn]":_sp.nm);}spstr=sp2.join(", ");}
  var _mMx=manaMax(c),manaStr=_mMx>0?"Mana: "+manaCur(c)+"/"+_mMx+" — a leveled cast costs its TIER in mana (cantrips free); a spell is castable only while the pool covers it."+(c.cls==="Necromancer"?" NECROMANCER: may cast beyond an empty pool — the engine automatically pays "+MANA_BLOOD_HP+" HP per missing mana point (never emit [HP:] for that price).":"")+"\n":"";
  var nextXP=c.level<classXpLevels().length?classXpLevels()[c.level]:"max";/* C6 ②: the 1-20 curve */
  var genderDisplay=c.gender==="F"?"female":c.gender==="NB"?"non-binary":"male";
  // #46: injected conditions carry their AGE (engine-stamped turn) + cause when known, and each
  // afflicted sheet gets a cleanup instruction. Root cause of the Daeris incident (t359): a
  // condition the GM can't SEE (or can't see is 200 turns old) is never honored and never
  // removed — visibility + age is what makes stale state self-correcting.
  var condStr="";if(c.conditions&&c.conditions.length){condStr="Conditions: "+c.conditions.map(condInjectFmt).join(", ")+" — if a condition no longer matches the fiction, emit [CONDITION_REMOVED:name] NOW\n";}
  var relStr="";if(c.relationships&&c.relationships.length){relStr="Relationships: "+c.relationships.map(function(x){return x.entity+" ("+x.descriptor+")";}).join(", ")+"\n";}
  var saveStr="";if(c.saveModifiers&&c.saveModifiers.length){saveStr="Save modifiers: "+c.saveModifiers.map(function(x){var v=x.amount>=0?"+"+x.amount:""+x.amount;return v+" vs "+x.type+" ["+x.source+"]";}).join(", ")+"\n";}
  var langStr="";if(c.languages&&c.languages.length){langStr="Languages: "+c.languages.map(function(x){return x.name+(x.broken?" (broken)":"");}).join(", ")+"\n";}
  // #52: the earned-skills line is now the skills-bible canon block (level + bonus + canonical
  // definition per earned skill) — same slot in the sheet, richer content, ""-clean when none.
  var skillStr=buildSkillCanonBlock(c);
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
  if(npcNames.length&&sessionLog.length){var recent=sessionLog.slice(-6).map(function(m){return m.role==="user"?stripEngineNotes(m.content):m.content;}).join(" ");/* #145: engine notes ride the user half — without the strip, a split/presence audit NAMING an absent companion activated their full detail block (stale posture claims included), the protection machinery feeding the exact contradiction it guards against (live t1549: Frizwick/Daeris note-only mentions). The summarize path already strips (memory.js:1059); the hot scan now matches it. A player action naming a split member is story text and still activates — the SPLIT THREADS design needs that. */for(i=0;i<npcNames.length;i++){var hnN=npcNames[i],hnHit=recent.indexOf(hnN)>=0;if(!hnHit&&memory.npcs[hnN].aliases){var haj;for(haj=0;haj<memory.npcs[hnN].aliases.length;haj++){if(recent.indexOf(memory.npcs[hnN].aliases[haj])>=0){hnHit=true;break;}}}if(hnHit)hotNpcs+=memoryNpcDetail(hnN)+"\n";}}
  /* #140 ②: the stated-vs-actual tension line — "who they claimed to be vs who play has made
     them" was tracked but never surfaced. Fires only on genuine divergence (byte-clean when
     stated===actual); descriptive, the GM decides whether characters notice. */
  var idAlTension=(c.statedAlignment&&c.actualAlignment&&c.statedAlignment!==c.actualAlignment)?" (professed "+c.statedAlignment+" at the start — their choices have drifted them, and those who knew them then may notice)":"";
  var identity="PLAYER IDENTITY (never forget this): "+c.name+", a "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" | Level "+c.level+" | "+(c.actualAlignment||c.statedAlignment||"Neutral")+idAlTension+(c.deity?" | Deity: "+c.deity:"")+(c.trait?" | Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+"\n\n";
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
  // TODO #1 D12 follow-up (user field report 2026-07-18): leaving multiplayer needs the same
  // history-momentum antidote as a control switch — after the last co-PC demotes, the sessionLog
  // is full of the GM's OWN third-person narration and one role line can't outweigh it (the
  // narration stayed third-person in the field). Same recentSwitch pattern: set by the demote
  // toggles when playerCount drops to 1, auto-cleared in commitGmTurn after ~2 turns, deleted
  // instantly by a re-promote (the D12 override takes back over).
  var mpEndBlock="";
  if(worldState.mpEnded){mpEndBlock="*** MULTIPLAYER ENDED — SINGLE PLAYER RESUMED ***\nThe hot-seat session is over: "+c.name+" is the ONLY player character again. Return to SECOND-PERSON narration immediately — 'you'/'your' means "+c.name+". The recent history's third-person narration of "+c.name+" was the multiplayer mode and no longer applies; companions are narrated in third person as usual.\n\n";}
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
    // #52: the skills ladder — campaign-constant text derived from SKILL_LEVEL_MECHANICS
    // (skills_bible.js), so it is stable-half-safe; a ladder rebalance is one deliberate
    // cache invalidation. The per-character earned list rides the VOLATILE sheet below.
    +buildSkillMechanicsDoc()
    // UA1: the STATE TAGS block is DERIVED from the tag table (tag_table.js) — byte-identical
    // to the battle-tested hand-written text (frozen by an engine test + a pre/post stable-half
    // capture). Doc wording changes are separate deliberate commits, never bundled with mechanics.
    +buildStateTagsDoc();
  var volatile_=identity+switchBlock+mpEndBlock+leftBlock
    +"CHARACTER: "+c.name+" ("+genderDisplay+"), "+(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+", Level "+c.level+" ("+c.xp+" XP, next: "+nextXP+")\n"
    +"HP: "+c.hp+"/"+c.maxHp+" | Gold: "+c.gold+" gp | Alignment: "+(c.actualAlignment||c.statedAlignment||"Neutral")+"\n"
    +"Stats: STR "+c.stats.STR+" DEX "+c.stats.DEX+" CON "+c.stats.CON+" INT "+c.stats.INT+" WIS "+c.stats.WIS+" CHA "+c.stats.CHA+"\n"
    +(c.trait||c.flaw||c.motivation?(c.trait?"Trait: "+c.trait:"")+(c.flaw?" | Flaw: "+c.flaw:"")+(c.motivation?" | Motivation: "+c.motivation:"")+"\n":"")+(c.deity?"Deity: "+c.deity+"\n":"")/* trailing \n so "Motivation:" doesn't glue to the next line (audit E54) */
    +"Abilities: "+abilstr+"\nSpells: "+spstr+"\n"+manaStr+"Inventory: "+c.inventory.join(", ")+"\n"
    +condStr+relStr+saveStr+langStr+skillStr
    +buildSpellBibleBlock()
    +buildAbilityBibleBlock()
    +buildCompanionSpellBibleBlock()
    +partyBlock
    +partyCapBlock
    +"Location: "+w.location+", "+w.region+" | Time: "+w.time+" | Weather: "+w.weather+"\n"
    +"NPCs: "+nstr+"\n\n"+questBlock+buildSkeletonBlock()
    +(memToc?"MEMORY DIRECTORY:\n"+memToc+"\n\n":"")
    +buildChangedLocationsBlock()/* #105: remote changed-locations roll-up — volatile only, ""-clean when nothing changed */
  +(function(){var s=getNameSuggestions(10,true);return s.length?"AVAILABLE NAMES (use these for new NPCs): "+s.join(", ")+"\n\n":""}())
    +(hotNpcs?"ACTIVE NPC DETAILS:\n"+hotNpcs+"\n":"")
    +ragBlock
    +legacyBlock
    +buildNpcGraph()
    +buildGeoBlock()
    +buildClockBlock()/* #73: campaign clock + computed deadline countdowns — volatile only (a per-turn counter must never touch the cached stable half) */
    +cb+hist
    +buildCoreMemoryBlock()
    +"REMINDER -- PLAYER IDENTITY: "+c.name+" is a "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+". Level "+c.level+". Never forget this.\n\n"
    +"STYLE: "+(_paVc?"Write EVERY sentence of narration in this voice — a reader should recognise the author from rhythm, sentence length, and word choice alone. Commit fully; never blend with a neutral GM voice. VOICE: "+_paVc+(_paProfane?(adultMode?" This voice swears: use strong, crude profanity freely and naturally — never censored.":" Keep this voice's rhythm and bite, but keep the language clean — no profanity."):"")+" ":"Write clean, readable prose. ")+"Do NOT use em-dashes or en-dashes anywhere; use commas or separate sentences instead. Do not cram multiple clauses or similes into one long sentence; break a long thought into several short ones, one main image per sentence. Do NOT end your response with suggested actions, a 'You could' line, or an [ACTIONS:] tag — action suggestions are handled separately by the engine. Never show tags in prose. Death is possible."
    /* D12 (supersedes D10, user field ruling 2026-07-18): the third-person override must sit
       AFTER STYLE — end-of-prompt position is what lets it beat the stable role block's
       "second-person" instruction (same position-is-authority mechanic STYLE itself relies on).
       playerCount>1 gated: single-player prompts stay byte-identical (engine-tested). */
    +(typeof playerCount==="function"&&playerCount()>1?" MULTIPLAYER OVERRIDE — THIRD-PERSON NARRATION: multiple players share this game, so narrate EVERY player character by name in third person; the word 'you' must not appear in narration (it would privilege one player). All other style rules stand."
      /* D12 exit, round 2 (field failure 2026-07-18: the mid-volatile block alone lost to the
         GM's own third-person history twice over). The reversal command needs the SAME end-of-
         prompt authority slot that makes the multiplayer override itself stick — mutually
         exclusive with it by gate (override: playerCount>1; this: mpEnded && playerCount<=1). */
      :(worldState.mpEnded?" NARRATION MODE — SECOND PERSON RESUMED: the multiplayer session is OVER. Starting with THIS response, address "+c.name+" as 'you' again — vivid second-person prose, exactly as before multiplayer. Do NOT continue the third-person style of the recent turns; that mode has ended.":""));
  return {stable:stable,volatile:volatile_};
}
function buildSkeletonBlock(){
  if(!worldState.skeleton)return"";
  var sk=worldState.skeleton,lines=[],i,j;
  lines.push("CAMPAIGN SKELETON — this is the overarching narrative structure. Every scene, quest, and encounter should serve this story. Do not invent unrelated side-plots that pull away from the current arc.");
  // #127-③: the knowledge boundary. Field evidence (t1385): companions voiced skeleton facts the
  // story had never surfaced — the spine (future arcs, villains, act goals) was in scope with no
  // instruction separating GM planning knowledge from CHARACTER knowledge. A prompt fence alone
  // is known-imperfect for this class, but it names the rule everything else (staging notes,
  // suggestion gate) enforces mechanically.
  lines.push("GM-EYES ONLY: this skeleton is your private planning document. NO character in the world knows it. Companions and NPCs may reference only what the story has surfaced on-screen — never let future arcs, act goals, villain names, or premise secrets reach dialogue, rumor, or suggestion before the fiction reveals them. To bring an upcoming beat into play, STAGE it in the world first (a rumor, a messenger, a discovery), then let characters react to what they actually witnessed.");
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
    if(activeArcs.length>1)pacingNote+="\nThis act is PARALLEL — multiple arcs are active simultaneously. The player chooses which to pursue. Weave hooks for the others into scenes naturally, but follow the player's lead. Do not force a specific arc order. Run each through its HOW TO RUN THIS ARC directive above.\nHOOK DELIVERY: foreshadow the arcs the party is NOT currently pursuing ONLY through named NPCs who have a reason to know — a sheriff reporting trouble, a scholar mentioning rumors, a merchant with news from the road. Never drop arc names, locations, or characters into party banter or narrator asides unprompted. The hook must arrive as something someone SAYS to the player, not something the party just knows.";
    // Generic type-hint only when the active arc has NO dnaHint — otherwise it contradicts the author
    // sensibility (a generic "investigation → gather clues" line is what flattened campaigns into procedure).
    if(activeArcs.length===1&&!activeArcs[0].dnaHint&&activeArcs[0].type)pacingNote+="\nThe current arc is "+activeArcs[0].type+"-focused. Shape encounters and scenes accordingly: "+(activeArcs[0].type==="investigation"?"clues, interrogation, deduction, piecing together evidence":activeArcs[0].type==="exploration"?"travel, discovery, environmental challenges, mapping unknown territory":activeArcs[0].type==="social"?"politics, alliances, persuasion, betrayal, negotiation":activeArcs[0].type==="combat"?"battles, sieges, hunts, tactical encounters":"varied challenges")+".";
  }
  lines.push(pacingNote);
  return lines.join("\n")+"\n\n";
}
// ── #52 skills bible injection ───────────────────────────────────────────────
// buildSkillMechanicsDoc — the STABLE-half skills ladder. Rendered entirely from
// skills_bible.js data (SKILL_LEVEL_MECHANICS + the untrained lists), all of it constant,
// so the output is byte-identical turn to turn (the cache invariant). The [SKILL_SUCCESS:]
// hygiene line exists because auto-successes would otherwise grind skill levels for free —
// routine work must not earn progress.
function buildSkillMechanicsDoc(){
  if(typeof SKILL_LEVEL_MECHANICS==="undefined"||typeof skillsUntrained!=="function")return"";
  var steps=[],i;
  for(i=1;i<SKILL_LEVEL_MECHANICS.length;i++)steps.push(SKILL_LEVELS[i]+": "+SKILL_LEVEL_MECHANICS[i].rule);
  var hard=skillsUntrained("hard"),no=skillsUntrained("no");
  return "SKILL MECHANICS: skills grow through tested use — each success you reward with [SKILL_SUCCESS:] advances that skill. Add the earned level's bonus ON TOP of the stat modifier on any d20 check where the skill applies (the character's earned skills are listed with their bonuses on the sheet below). Ladder — "
    +steps.join("; ")+". "
    +"Auto-successes are routine work: never emit [SKILL_SUCCESS:] for them — only rolled or genuinely tested successes earn progress. "
    +"Untrained (no earned level): most skills may be attempted on the raw stat modifier"
    +(hard.length?", but "+hard.join(", ")+" suffer +5 DC or disadvantage untrained":"")
    +(no.length?", and "+no.join(", ")+" cannot be meaningfully attempted untrained":"")+".\n\n";
}
// buildSkillCanonBlock — the VOLATILE half of #52: level, bonus, stats, and canonical
// definition for the player's EARNED skills only (same re-inject-from-data anti-drift
// pattern as the spell bible — the GM adjudicates a skill from fixed canon, not from
// whatever its name evokes this turn). ""-clean when no skill has been earned, which keeps
// a fresh character's prompt byte-identical to the pre-#52 empty case.
function buildSkillCanonBlock(c){
  if(!c||!c.skills||typeof skillBibleEntry!=="function")return"";
  var lines=[],ids=Object.keys(c.skills),i,statsById={};
  if(typeof SKILLS!=="undefined"){for(i=0;i<SKILLS.length;i++)statsById[SKILLS[i].id]=(SKILLS[i].stats||[]).join("/");}
  for(i=0;i<ids.length;i++){
    var id=ids[i],succ=c.skills[id];if(!(succ>0))continue;
    var lvl=skillLevel(succ),e=skillBibleEntry(id);
    lines.push("- "+id+" — "+SKILL_LEVELS[lvl]+" (+"+skillLevelBonus(lvl)+(statsById[id]?"; "+statsById[id]:"")+")"+(e?". "+e.def:""));
  }
  if(!lines.length)return"";
  return "SKILLS (earned — apply the SKILL MECHANICS ladder: bonus on checks, auto-success bands):\n"+lines.join("\n")+"\n";
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
    // Playtest-F1 (v1.239): availability state must live HERE, in the block the GM provably
    // consults at cast time (the money test showed 8 unprompted range holds from these lines,
    // while a sheet-side clause alone was ignored — the GM cast a spent slot anyway).
    // #110 (v1.508): under the mana economy the only per-spell hard gate left is the racial
    // 1/day heritage grant — everything else is governed by the pool (the header's mana
    // refusal + the sheet's Mana line). Non-racial spells never carry the marker now.
    if(sp.lvl>0&&sp.used&&sp.racial)nm="[EXPENDED — 1/day heritage spell already spent; CANNOT be cast again until dawn] "+nm;
    lines.push(capBibleLine(nm,e));
  }
  if(!lines.length)return"";
  return "CANONICAL SPELL RULES (authoritative — these bounds are FIXED; never expand a spell's range, targets, duration, or effect beyond what is written here, honor these over any remembered version when the spell is cast, and REFUSE any cast of a spell marked [EXPENDED]. MANA: a leveled cast costs its Tier from the caster's Mana pool — REFUSE any cast the pool cannot cover; the ONE exception is a Necromancer, who may cast beyond an empty pool at a blood price the engine deducts automatically):\n"+lines.join("\n")+"\n\n";
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
  // #132: a response cut at the output cap can end mid-tag ("…listening. [SCH" — B21). The strip
  // regexes above need the closing ], so the ragged fragment used to render raw. End-anchored
  // (and ≥3 leading caps, the __tagUnknownScan shape) so complete tags and lowercase bracket
  // prose are untouched; the raw truth stays in sessionLog, this is display-side only.
  // Unknown-tag containment (the [MANA:-1] Zone-of-Truth leak, 2026-08-07): the GM sometimes
  // INVENTS a tag; __tagUnknownScan warns the console (the developer signal, untouched), but
  // known-name stripping let the invention reach the displayed prose — and TTS read it aloud.
  // Any [ALLCAPS…] tag shape (colon or bare, the __tagUnknownScan shape) is display-stripped
  // with a loud warn. Lowercase/mixed-case bracket prose ("[sic]") is deliberately untouched.
  return t.replace(_CT_TAGS,"").replace(_CT_BARE,"")
    .replace(/\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g,function(_m){
      if(typeof console!=="undefined")console.warn("[tags] unknown tag stripped from display (invented vocabulary — see the __tagUnknownScan warn for the parse side): "+_m.slice(0,60));
      return "";
    })
    .replace(/\[[A-Z][A-Z_]{2,}(:[^\]]*)?\s*$/,"")
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
  if(acts.length){btns='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';for(i=0;i<acts.length;i++){var _ea=escHtml(punctuateAction(acts[i]));btns+='<button class="qa" title="Tap to edit · hold or Ctrl-click to send" onclick="sendSuggestedAction(this,event)" data-action="'+_ea+'">'+_ea+'</button>';}btns+='</div>';}/* escape action text (audit E81); #88: punctuate the legacy pre-[ACTIONS:] replay path too */
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
// #75(b) v1.385: DASH VARIANTS normalise too. The GM writes the same item with an em-dash one
// turn and a hyphen the next ("Iron ring — unmarked" / "Iron ring - unmarked"), and because the
// two strings differed here they were two separate stacks of the same three rings — on the t881
// save, exactly 2 such pairs across the party (Iron ring, Iron key; verified by enumerating every
// NEW collision the change causes, since a wrong merge silently destroys a real item — the
// superficially-similar "Dark tooth cap 'Third'/'Seventh'" pair correctly does NOT fold).
// Every dash character folds to "-" and the
// spacing around it collapses, so all of "A — B", "A - B", "A—B" agree. Spaced words are NOT
// folded into hyphenated ones ("well worn" stays distinct from "well-worn") — deliberately
// conservative, since a wrong merge silently destroys a real item.
// Non-strings coerce to "" (not just null/undefined): load-time migration deliberately preserves
// non-string inventory entries, and a primitive that throws on one kills whatever loop touched it —
// inventorySnapshot sits BEFORE applyMuts in the turn path, so that throw cost the entire turn.
function _invStr(s){return typeof s==="string"?s:"";}
function _invNorm(s){return _invStr(s).replace(/\s*x\d+\s*$/i,"").toLowerCase().replace(/[—–−‑]/g,"-").replace(/\s*-\s*/g,"-").replace(/\s+/g," ").trim().replace(/s$/,"");}
function _invCount(s){var m=_invStr(s).match(/\sx(\d+)\s*$/i);return m?parseInt(m[1],10):1;}
function _invBase(s){return _invStr(s).replace(/\s*x\d+\s*$/i,"").trim();}
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
// #60b (v1.384) — the confirmed-negative latch behind [ITEM_KEPT:]/[COMPANION_ITEM_KEPT:].
// ROOT CAUSE it closes (measured on the t881 Runelords corpus, turns 760-881): the consumable
// check's "not consumed" branch had NO output channel — the note said "leave the sheet alone",
// i.e. emit nothing — and with thinking disabled (globals.js) the GM had nowhere to put the
// decision except the prose. That prose ("No blasting charge spent in that beat") went through
// cleanTxt untouched (it is not a tag) into worldState.transcript, where it STILL CONTAINED the
// item's head noun — which re-armed detectGhostConsumables on the next sweep. The check was
// eating its own denials: of the 29 "charge" mentions in that window, the only 5 carrying a
// consumption verb were the GM's own leaked bookkeeping lines. Zero real spends, 14 leaked turns.
// A silence clause cannot fix this (B5/v1.367 tried and the leak continued at t849/853/867/868) —
// the decision needs somewhere to GO. This is that somewhere: a normal tag, stripped from display
// like any other, so nothing reaches the transcript and the loop has no fuel.
// The latch records the COUNT at which the GM confirmed "not spent", so the check stays silent
// for that item until the count actually changes (a real spend, or a fresh acquisition) rather
// than re-nagging every CONSUMABLE_NUDGE_COOLDOWN turns on a decision already made.
function _stampItemKept(who,inv,name){
  var n=_invNorm(name),i;
  for(i=0;i<(inv||[]).length;i++){
    if(_invNorm(inv[i])!==n)continue;
    if(!worldState.consumableKept)worldState.consumableKept={};
    worldState.consumableKept[(who||"")+"|"+n]=_invCount(inv[i]);
    return true;
  }
  console.warn("[ITEM_KEPT] no inventory entry matches '"+name+"'"+(who?" on "+who:"")+" — latch not written");
  return false;
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
    // #75(b) v1.385: key on _invNorm, not the raw string. Byte-identical matching could never
    // heal the dash-variant splits this pass exists to clean up ("Iron ring — unmarked" vs
    // "Iron ring - unmarked"), and raw matching was already INCONSISTENT with the write path —
    // addInventoryItem/removeInventoryItem have always stacked by _invNorm, so the migration was
    // using a stricter notion of "same item" than the code that creates the stacks.
    // Verified on the t881 save: norm keying merges exactly 2 groups across the whole party, both
    // genuine dash twins; the look-alike "Dark tooth cap 'Third'/'Seventh'" pair is untouched.
    k=inv[i];kk="k:"+(typeof k==="string"?_invNorm(k):k); // prefixed key — an item literally named "__proto__" must not walk the prototype
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
  __mpBareTagScan(text);
  // #137 provenance ring — the record the t1467 forensics lacked: per-response tag names +
  // mutation labels, ON THE SAVE (rides exports/sync), capped at TAG_LOG_CAP. Observational
  // only, zero parser contact; makes emitted-then-purged vs never-emitted decidable next time.
  try{
    var _tlNames=[],_tlSeen={},_tlM=String(text||"").match(/\[([A-Z][A-Z_]{2,}):/g)||[],_tli;
    for(_tli=0;_tli<_tlM.length;_tli++){var _tn=_tlM[_tli].slice(1,-1);if(!_tlSeen[_tn]){_tlSeen[_tn]=1;_tlNames.push(_tn);}}
    if(!worldState.tagLog)worldState.tagLog=[];
    worldState.tagLog.push({t:R.turn,tags:_tlNames,m:(R.muts||[]).slice(0,10)});
    if(worldState.tagLog.length>TAG_LOG_CAP)worldState.tagLog=worldState.tagLog.slice(worldState.tagLog.length-TAG_LOG_CAP);
  }catch(_tle){if(typeof console!=="undefined")console.warn("[tags] provenance ring write failed:",_tle&&_tle.message);}
  return R;
}
// ── TODO #1 P4 (D8): soft misroute tripwire ──────────────────────────────────
// OBSERVATIONAL ONLY — zero parser contact, zero mutation, runs AFTER the table has applied.
// In a multi-PC round every bare sheet-mutation tag lands on the HERO by definition (D8: bare
// tags keep meaning worldState.character). That is often correct — but if the GM meant another
// player character it is a silent misroute, so we surface every bare hit: one console warn per
// tag, ONE batched toast per response (soft — never a block, the spec's ruling). XP is excluded
// (deliberately shared — the party mirror). Single-player: gated off entirely.
var MP_BARE_TAGS=["HP","GOLD","ITEM_GAINED","ITEM_LOST","SPELL_USED","CONDITION","CONDITION_REMOVED","RELATIONSHIP","RELATIONSHIP_REMOVED","SAVE_MOD","SAVE_MOD_REMOVED","ALIGNMENT","ABILITY_GAINED","LANGUAGE","SKILL_SUCCESS"];
function __mpBareTagScan(text){
  if(typeof playerCount!=="function"||playerCount()<=1)return;
  var hits=[],i;
  for(i=0;i<MP_BARE_TAGS.length;i++){
    var re=new RegExp("\\["+MP_BARE_TAGS[i]+":","g"),m;
    while((m=re.exec(text))!==null)hits.push(MP_BARE_TAGS[i]);
  }
  if(!hits.length)return;
  var hero=(worldState&&worldState.character&&worldState.character.name)||"the hero";
  console.warn("[multiplayer] "+hits.length+" bare mutation tag(s) in a multi-PC round — applied to "+hero+" ("+hits.join(", ")+"). If any were meant for another PC, the GM should have used COMPANION_* tags; correct via Sync.");
  if(typeof showToast==="function")showToast("⚠ "+hits.length+" bare tag"+(hits.length>1?"s":"")+" → "+hero+" (multi-PC round). Wrong sheet? Fix via Sync.",5000);
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
// ── B15 / known-issue #11: an exhausted API balance is a BILLING state, not a broken subsystem ──
// The field report: the account ran out of credit, Anthropic answered HTTP 400 "Your credit
// balance is too low to access the Anthropic API…", and the generic `"HTTP "+status+": "+body`
// throw below reached the player through summarize()'s catch as "Memory filing failed (…)". The
// player was told the memory system was broken; a gameplay turn would have said "GM error" with
// equal wrongness. Every caller renders the same condition as ITS OWN component failing, so the
// recognition has to live at the ONE boundary they all pass through — here.
//
// Detection is per-provider DATA, per the PROVIDERS idiom (no `if(provider===…)` anywhere): a
// provider may carry an optional `creditError(status,message)` and it then OWNS the decision;
// everything without one falls through to the shared shape below. Matching is on the MESSAGE, not
// the status, because the status varies by provider for the identical condition (Anthropic 400,
// OpenAI 429) — a status gate would silently miss the next one.
var CREDIT_EXHAUSTED_RE=/credit balance is too low|insufficient_quota|exceeded your current quota|billing hard limit/i;
var CREDIT_EXHAUSTED_TOAST="⚠ Your API credit has run out — top up under Plans & Billing at your provider.";
var CREDIT_EXHAUSTED_PREFIX="API credit exhausted — ";
var _creditToasted=false;/* once per page load: a failed turn and the summarize retry that follows it must not double-toast */
function isCreditExhausted(prov,status,message){
  if(prov&&typeof prov.creditError==="function"){
    try{return !!prov.creditError(status,message);}
    catch(e){console.warn("[credit] "+((prov&&prov.id)||"provider")+".creditError() threw — falling back to the shared shape:",e.message);}
  }
  return CREDIT_EXHAUSTED_RE.test(String(message||""));
}
// Shapes the Error thrown for every non-ok HTTP response from a provider. Credit exhaustion gets
// a plain leading clause (so whatever system line the caller prints around e.message reads
// honestly) plus ONE toast per page load; the error still THROWS, so every caller's catch — and
// its busy=false, its Retry offer, its #16 report — runs exactly as before. The message must stay
// free of "key"/"401"/"permission_denied", or _attachGMErrorUI (game.js) would swap the Retry
// button for a paste-a-new-key box, which is the wrong remedy; an engine test pins that.
// Any other status keeps the byte-identical "HTTP <status>[: <message>]" shape callers branch on.
function providerHttpError(prov,status,message){
  if(isCreditExhausted(prov,status,message)){
    console.warn("[credit] "+((prov&&prov.id)||"provider")+" refused the request for billing reasons (HTTP "+status+"): "+message);
    if(!_creditToasted){_creditToasted=true;if(typeof showToast==="function")showToast(CREDIT_EXHAUSTED_TOAST);}
    return new Error(CREDIT_EXHAUSTED_PREFIX+"top up your provider account (Plans & Billing), then retry. Provider said: "+message);
  }
  return new Error("HTTP "+status+(message?": "+message:""));
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
  var _tok=maxTok||1500;/* 1000→1500 (v1.540, user call): the cap is runaway insurance, not a style lever — the model never sees it, and at 1000 it was scissoring legitimate long prose turns mid-tag (the #132 field toast). #132's crumb frequency is the tuning gauge */if(prov.tokScale!=null)_tok=prov.tokScale===0?null:Math.round(_tok*prov.tokScale);
  var body=prov.buildBody(msgs,sys,_tok,model);
  var url=typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint; // Gemini embeds the model in the URL
  var res;try{res=await fetch(url,{method:"POST",headers:prov.headers(key),body:JSON.stringify(body)});}catch(e){throw new Error("Network: "+e.message);}
  var raw;try{raw=await res.text();}catch(e){throw new Error("Read error");}
  // Both non-ok paths route through providerHttpError (B15) — the unparseable-body one too, since
  // a gateway/HTML error page carrying the billing text must be recognised just the same.
  var data;try{data=JSON.parse(raw);}catch(e){throw providerHttpError(prov,res.status,raw.slice(0,200));}
  if(!res.ok){var _em=(data.error&&data.error.message)||(typeof data.error==="string"?data.error:"")||data.message||data.msg||"";throw providerHttpError(prov,res.status,_em);}
  // Record usage BEFORE parseResponse — an empty-content response still billed input tokens.
  if(prov.parseUsage){try{var _u=prov.parseUsage(data);if(_u)recordUsage(_u,(opts&&opts.kind)||(sysOverride?"other":"turn"),model);}catch(e){console.warn("[usage] telemetry parse failed — this call is uncounted (pricing dataset undercounts, TODO #30):",e.message);}}
  // #132: length-cap truncation is LOUD — a cut response may have been mid-tag, and that tag's
  // mutation is lost (handlers only match complete tags; cleanTxt drops the ragged fragment from
  // display). The transcript/sessionLog keep the raw truth; this is the only warning channel.
  if(prov.parseFinish){try{var _fin=prov.parseFinish(data);if(_fin){
    console.warn("[truncation] "+prov.id+" response cut at the output-token cap (finish: "+_fin+", kind: "+((opts&&opts.kind)||(sysOverride?"other":"turn"))+") — any tag being emitted at the cut is LOST (#132)");
    if(typeof showToast==="function")showToast("⚠ Response hit the length limit — its tail was cut");
    if(typeof erCrumb==="function")erCrumb("turn-truncated",{p:prov.id,f:_fin,k:(opts&&opts.kind)||(sysOverride?"other":"turn")});
  }}catch(e3){}}
  return prov.parseResponse(data);
}

// The vision prompt behind "🔍 Describe appearance from image" (portrait modal + creation wizard).
// Hoisted to a named constant so it is greppable and testable, like TAG_REINFORCE.
//
// ⚠ WHY THE DURABILITY RULE IS LOAD-BEARING (user field note 2026-07-27: "spilling from beneath an
// olive coloured hood" is too specific): char.appear is not a caption, it is CANON with two
// consumers that both treat it as permanent — buildSysPrompt injects it into the character sheet
// every turn (api.js, "Appearance:"), and doRender feeds it to the image model for the protagonist
// AND every party member under "describe exactly as written, do not invent appearance". So a
// garment baked in here means the GM still believes in that hood fifty turns and three outfits
// later, and every scene render keeps drawing it. Pose/expression/background are the same class of
// mistake for the same reason, so they are excluded too. A general style REGISTER survives a change
// of clothes and is genuinely useful to both consumers, so it stays allowed.
var PORTRAIT_DESC_SYS="You are a character artist's eye for a dark fantasy RPG. Look at the portrait and write a vivid 2-3 sentence physical description for a character sheet.\n"
 +"DESCRIBE ONLY WHAT IS DURABLE. This entry is re-read as canon for the whole campaign, long after the character has changed clothes: face shape and features, hair colour and texture, eye colour, build and bearing, complexion, apparent age, and PERMANENT marks (scars, tattoos, a broken nose, a missing finger).\n"
 +"DO NOT tie the description to this one image. No specific garments, garment colours, armour pieces or accessories (never 'an olive hood', 'a red cloak', 'a silver brooch'), and no pose, gesture, facial expression, background, weather or lighting.\n"
 +"A general style REGISTER is fine and useful, because it survives a change of outfit: 'dressed for hard travel', 'carries herself like someone used to armour', 'in the sober cut of a city clerk'. A named colour or a named item is not.\n"
 +"Write it in the third person as an appearance entry. Output ONLY the description -- no preamble, no quotes.";
async function describePortraitImage(base64Url,charName){
  var key=(typeof providerKeys!=="undefined"&&providerKeys.anthropic)?providerKeys.anthropic:(activeProvider==="anthropic"?apiKey:"");
  if(!key)throw new Error("Needs a Claude (Anthropic) key.");
  var mm=base64Url.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if(!mm)throw new Error("Portrait must be a base64 image.");
  var model=(typeof providerModels!=="undefined"&&providerModels.anthropic)||PROVIDERS.anthropic.defaultModel;
  var body={model:model,max_tokens:400,system:PORTRAIT_DESC_SYS,messages:[{role:"user",content:[
    {type:"text",text:"Describe this character's appearance for their sheet."+(charName?" Their name is "+charName+".":"")},
    {type:"image",source:{type:"base64",media_type:mm[1],data:mm[2]}}
  ]}]};
  var r=await fetch(PROVIDERS.anthropic.endpoint,{method:"POST",headers:PROVIDERS.anthropic.headers(key),body:JSON.stringify(body)});
  if(!r.ok)throw new Error("Claude "+r.status);
  var data=await r.json();
  return (PROVIDERS.anthropic.parseResponse(data)||"").trim();
}
