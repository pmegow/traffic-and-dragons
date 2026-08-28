// sabotage-drift-hardening.js — prove the W4/W5 drift-boundary guards are not decorative.
// Each mutation removes one load-bearing clause; the exact hostile fixture in engine-tests must
// turn red, and sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({file:"game.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"commit hook removed — missing-axis observers never see real turns",
    mustFail:"W4 wiring: committed GM turns arm the observer and the shared engine-n",
   find:"  if(!o.isOpening&&!_refusal&&typeof observeDriftAxes===\"function\")observeDriftAxes(resp,clean);/* #197: refusal text is meta-voice, not narration — no drift-axis candidates from it */",replace:""},
  {label:"reference rejection narrowed — 'toward Jorgenfist' arms location filing",
    mustFail:"W4 location filing: exact Jorgenfist entry survives eight untagged tur",
   find:"toward|towards|remembering|recalling",replace:"remembering|recalling"},
  {label:"location tag identity loosened — LOCATION_DESC falsely suppresses the filing watch",
    mustFail:"W4 location filing: exact Jorgenfist entry survives eight untagged tur",
   find:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION):[^\\]]+\\]|\\[SUBLOCATION_LEAVE\\]/i.test(raw),cue;",
   replace:"var hasLoc=/\\[(?:LOCATION|SUBLOCATION)/i.test(raw),cue;"},
  {label:"#28 commit-time player write removed — turns commit with no player half",
    /* the #76 source contract (run-tests startup) reds FIRST — it pins the write's existence
       inside commitGmTurn before the engine tests ever run; attribute to the actual catcher */
    mustFail:"the player transcript write lives inside commitGmTurn",
   find:"  if(o.logPlayer&&o.playerTxt!=null&&!o.isOpening)logTranscript(\"player\",o.playerTxt);",
   replace:""},
  {label:"#28 logPlayer isTT guard dropped — Table Talk questions would reach the story record",
    mustFail:"transcript logPlayer flag guarded by !isTT",
   find:"logPlayer:(!isTT&&!(opts&&opts.silent))",
   replace:"logPlayer:true"}
]});

rc|=sabotage.prove({file:"api.js",command:["node",["dev/run-tests.js"]],also:["globals.js"],cases:[/* #199: the builders' constants live in globals.js — the working copy must ride or a pre-commit proof loads a constants-less engine and misattributes */
  {label:"#196 persistence threshold deleted — the 0-HP note fires on the first zero turn",
    mustFail:"#196 0-HP observer: counts through combat but fires only outside it",
   find:"  if(dur<HP_ZERO_NOTE_TURNS)return\"\";",replace:""},
  {label:"#196 combat silence removed — the note interrupts a live fight",
    mustFail:"#196 0-HP observer: counts through combat but fires only outside it",
   find:"  if(!worldState.hpZero)worldState.hpZero={since:worldState.turn};\n  if(worldState.combat)return\"\";",
   replace:"  if(!worldState.hpZero)worldState.hpZero={since:worldState.turn};"},
  {label:"#196 heal-clear removed — a stale since stamp survives recovery",
    mustFail:"#196 0-HP observer: counts through combat but fires only outside it",
   find:"if(!c||c.hp!==0){if(worldState.hpZero)delete worldState.hpZero;return\"\";}",
   replace:"if(!c||c.hp!==0){return\"\";}"},
  {label:"#196 builder dropped from the registry — the note can never reach a request",
    mustFail:"#196 registry + latch: buildHpZeroNudge rides NOTE_BUILDERS",
   find:"buildConditionAudit,buildHpZeroNudge,",replace:"buildConditionAudit,"},
  {label:"#199 mid-clause pre-token filter removed — title chains mint phantom principals",
    mustFail:"#199 fixture pin: the standard model-test blueprint yields Valerius",
   find:"    if(!/^[a-z]+,?$/.test(m[1]))continue;",replace:""},
  {label:"#199 premise limb disabled — the campaign's Valerius goes unwatched",
    mustFail:"#199 principal staging: both limbs fire after the threshold",
   find:"    if(!onRoster&&!(typeof memory!==\"undefined\"&&memory&&memory.npcs&&memory.npcs[canon]))missing.push(nm);",
   replace:"    if(false)missing.push(nm);"},
  {label:"#199 ask cap removed — an owner's silence never becomes a ruling",
    mustFail:"#199 principal staging: both limbs fire after the threshold",
   find:"if(rec&&(rec.n>=PRINCIPAL_NUDGE_MAX||t-rec.t<PRINCIPAL_NUDGE_COOLDOWN))continue;",
   replace:"if(rec&&(t-rec.t<PRINCIPAL_NUDGE_COOLDOWN))continue;"},
  {label:"#199 builder dropped from the registry — the note can never reach a request",
    mustFail:"#199 registry + latch: buildPrincipalStageNudge rides NOTE_BUILDERS",
   find:"buildArcStagingNudge,buildPrincipalStageNudge,",replace:"buildArcStagingNudge,"},
  {label:"#201 nudge reachability check removed — the dead-handle reveal is taught again",
    mustFail:"#201 the conflict nudge teaches only REACHABLE ceremonies",
   find:"var liveHandle=handle&&typeof _sceneRefActor===\"function\"&&!!_sceneRefActor(c.handle);",
   replace:"var liveHandle=true;"}
]});

rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"strict duration promotion disabled — five days falls back to turn ageing",
    mustFail:"W4 clock-aware future events promote strict durations, including legac",
   find:"if(strict>0&&typeof scheduleAdd===\"function\"){",replace:"if(false&&typeof scheduleAdd===\"function\"){"},
  {label:"outcome gate removed — merely discussing a future event marks it complete",
    mustFail:"W4 future-event resolve assist requires both token overlap and an outc",
   find:"FUTURE_OUTCOME_RE.test(s)&&futureResolveOverlap(s,f.what)",replace:"futureResolveOverlap(s,f.what)"},
  {label:"#194L6 rumor-mill cap dropped — a node's mention list accumulates forever",
    mustFail:"#194L6 node rumor texture",
   find:"  if(mn.length>NODE_MENTION_CAP)mn.splice(0,mn.length-NODE_MENTION_CAP);",replace:""}
]});

rc|=sabotage.prove({file:"identity.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"#201 handle separator unification removed — the t2032 spelling deadlock returns",
    mustFail:"#201 the t2032 shape: an underscore citation binds the hyphen-registered",
   find:"function w2HandleKey(h){return String(h||\"\").toLowerCase().replace(/[-_\\s]+/g,\" \").trim();}",
   replace:"function w2HandleKey(h){return String(h||\"\").toLowerCase().replace(/\\s+/g,\" \").trim();}"},
  {label:"#201 conflict collapse removed — every respelled retry mints (and toasts) a fresh record",
    mustFail:"#201 conflict records collapse across spellings",
   find:"if(!c.resolved&&c.subject===s&&w2HandleKey(c.handle)===w2HandleKey(h))",
   replace:"if(!c.resolved&&c.subject===s&&c.handle===h)"},
  {label:"#200 quarantine toast dedupe removed — a poisoned-id replay re-toasts every attempt",
    mustFail:"#201/#200 a poisoned-id replay quarantines again but does NOT re-toast",
   find:"if(_priorRct||_subjSeen){",replace:"if(false){"},
  {label:"#201 valve re-grant removed — a failed reveal leaves the fork note capped forever",
    mustFail:"#201 a failed reveal re-grants ONE fork-note delivery",
   find:"    if(!regrant)return;",replace:"    return;"},
  {label:"#193 capitalization evidence dropped — 'the caul of mist' becomes a death warrant",
    mustFail:"#193 the probe table",
   find:"    for(i=0;i<rt.length;i++){if(!rt[i].cap)continue;",
   replace:"    for(i=0;i<rt.length;i++){"},
  {label:"#193 personal-segment rule dropped — an order-name token self-names its bare title",
    mustFail:"#193 the probe table",
   find:"for(j=0;j<ct.length;j++){if(ct[j].t===\"of\"){hitOf=true;break;}seg.push(ct[j]);}",
   replace:"for(j=0;j<ct.length;j++){seg.push(ct[j]);}"},
  {label:"#193 input-shaped tie-brake removed — a two-person token tie silently picks one",
    mustFail:"#193 the probe table",
   find:"    else if(score===bestScore&&resolveNpcName(k)!==resolveNpcName(best))tied=true;",
   replace:""},
  {label:"#193 bare-death seam check removed — the descriptor upsert authority returns",
    mustFail:"#193 the bare-death seam refuses a descriptor operand",
   find:"if(worldState.sceneRefs&&!npcIsDead(ws)&&typeof w2SelfNamingCanon===\"function\"&&w2SelfNamingCanon(dm[1].trim())!==nm){",
   replace:"if(false){"},
  {label:"#194L6 tier misgrade — an undated assertion wears a fresh sighting's clothes again",
    mustFail:"#194L6 tier derivation",
   find:"    return{tier:\"legacy\",at:m.lastSeenAt};",
   replace:"    return{tier:\"witnessed\",at:m.lastSeenAt,turn:epoch};"},
  {label:"child match removed — LOCATION mints a world twin of a known sublocation",
    mustFail:"W5 world/sub-location twin is refused loudly without minting a node or",
   find:"if(locSame(k,target)||locDisplayLeaf(k).toLowerCase()===leaf)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};",
   replace:"if(false)return {requested:raw,child:k,parent:current,leaf:locDisplayLeaf(k)};"}
]});

rc|=sabotage.prove({file:"tag_table.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"duplicate acquisition receipt removed — the second satchel is silent",
    mustFail:"W5 duplicate grants warn without blocking, but repeated tags still exp",
   find:"duplicateItemGrantWarning(worldState.character.inventory,igq.base,igCounts[itemBaseName(igq.base)],null,R,text);",replace:""},
  {label:"death-retraction memory cleanup removed - the repaired NPC still injects deceased",
    mustFail:"owner ruling: NPC_DEATH_RETRACTED heals only an existing dead NPC at a",
   find:"if(drDeathAttitude)drMemory.attitude=\"\";",replace:""},
  {label:"completion node gate removed - an old receipt drags a progressed living NPC backward",
    mustFail:"owner repair completion replay requires its prior receipt and the unch",
   find:"drCompletionReplay=!drRecordedDead&&drPrior&&drAtTarget",replace:"drCompletionReplay=!drRecordedDead&&drPrior"},
  {label:"completion residue gate removed - a clean replay grows the archive forever",
    mustFail:"owner repair completion replay requires its prior receipt and the unch",
   find:"&&drAtTarget&&drNeedsCleanup",replace:"&&drAtTarget"},
  /* #253 (JP0-8): the SPELL_DEF on-catalog refusal. Injected canon + the mana price both read
     capabilityLookup, so a shadow of a curated entry is a silent, permanent drift write. */
  {label:"#253: the on-catalog refusal is dropped — one hallucinated tag permanently rewrites curated spell canon and its mana price",
    mustFail:"curated canon is overwritable again",
   find:"  if(typeof capIsBaseCatalog===\"function\"&&capIsBaseCatalog(sdName)){",
   replace:"  if(false){"},
  {label:"#253: the refusal goes silent in the mutation trail — the player and the log see nothing said no",
    mustFail:"no ⚠ muts line naming the refused spell",
   find:"    R.muts.push(\"⚠ Spell canon NOT redefined: \"+sdName+\" is already curated — the official entry stands\");",
   replace:""}
]});

/* #253 (JP0-8, Fable f51): the predicate itself — too wide refuses every emergent spell, too
   narrow lets the shadow back in. Both directions are pinned by their own engine assertion. */
rc|=sabotage.prove({file:"capability_bible.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"#253: capIsBaseCatalog never matches — the handler's guard is decorative and the shadow returns",
    mustFail:"curated canon is overwritable again",
   find:"  return !!(key&&typeof CAPABILITY_BIBLE!==\"undefined\"&&CAPABILITY_BIBLE[key]);",
   replace:"  return false;"},
  {label:"#253: capIsBaseCatalog matches everything — genuinely emergent spells can no longer be defined at all",
    mustFail:"an off-catalog emergent spell was refused",
   find:"  return !!(key&&typeof CAPABILITY_BIBLE!==\"undefined\"&&CAPABILITY_BIBLE[key]);",
   replace:"  return !!key;"}
]});

rc|=sabotage.prove({file:"api.js",command:["node",["dev/run-tests.js"]],cases:[
  {label:"persistent consumable record not stored — an ignored check cannot re-fire",
    mustFail:"W5 consumable checks re-fire boundedly without a fresh mention and res",
   find:"p.push(c);worldState.consumablePending=p;",replace:"p.push(c);"},
  {label:"clock shortfall replaced by the original price — partial elapsed time is double-billed",
    mustFail:"W4 travel pricing asks only for the clock shortfall; an honest two-day",
   find:"[TIME_ADVANCE:\"+q.shortfall+\"m]",replace:"[TIME_ADVANCE:\"+(q.shortfall+q.elapsed)+\"m]"},
  {label:"#194L6 the not-a-visit clause deleted — rumor texture starts placing people in scenes",
    mustFail:"#194L6 node rumor texture",
   find:" — hearing a name here is not a visit, and places no one in the scene.\");",
   replace:"\");"}
]});

/* #187④a: the turn-addressed [RETCON:what|turn] extension. */
rc|=sabotage.prove({file:"state.js",command:["node",["dev/run-tests.js","RAG episodic"]],cases:[
  {label:"turn-addressing silently degrades to adjacency — late corrections eat the wrong turns again (#187④a)",
    mustFail:"#187④a: turn-addressed [RETCON:what|turn] marks the NAMED turn",
   find:"if(_rpTm){",replace:"if(false){"}
]});

/* #188: the bigram qualification lane (the wine-cellar confabulation fix).
   #224 re-anchored the first clause: the qualify branch is now shared with the rare-word lane,
   and killing the WHOLE branch is the honest mutation — a blex-only kill would be rescued by
   rlex qualifying the same fixture (its two rare words clear the word bar on their own). */
rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js","RAG episodic"]],cases:[
  {label:"the qualification branch dies — directed memory questions go blind again (#188/#224)",
    mustFail:"#188: a rare input PHRASE qualifies and serves its scene",
   find:"}else if(blex>=RAG_BIGRAM_QUALIFY||rlex>=RAG_RARE_QUALIFY){sc=blex+rlex;}",replace:"}else if(false){sc=blex+rlex;}"},
  {label:"the bigram df ceiling dies — common phrases lift unrelated scenes again (#188)",
    mustFail:"#188: a phrase carried by more than 1% of entries identifies nothing",
   find:"if(elig[i].bhits[j]&&bdf[j]<=bMaxDf)",replace:"if(elig[i].bhits[j])"},
  {label:"#261: the term pool shrinks back to first-come 8 — verbose questions starve the rare-word lane again",
    mustFail:"VERBOSE question no longer starves",
   find:"if(w.length>=4&&!RAG_STOP[w]&&!seen[w]){seen[w]=1;out.push(w);if(out.length>=20)break;}",
   replace:"if(w.length>=4&&!RAG_STOP[w]&&!seen[w]){seen[w]=1;out.push(w);if(out.length>=8)break;}"},
  {label:"#261: the bigram pool shrinks back to first-come 6 — the identifying phrase in a verbose question is discarded",
    mustFail:"collection stays bounded",
   find:"if(!seen[bg]){seen[bg]=1;out.push(bg);if(out.length>=12)break;}",
   replace:"if(!seen[bg]){seen[bg]=1;out.push(bg);}"}
]});

/* #224: the rare-WORD lane (the Giant's Bane rank-loss fix). */
rc|=sabotage.prove({file:"memory.js",command:["node",["dev/run-tests.js","RAG episodic"]],cases:[
  {label:"the rare-word lane's compete half dies — the answer scene loses to entity noise again (#224)",
    mustFail:"#224: a rare input WORD lifts the answer-bearing scene past rich enti",
   find:"sc+=Math.min(8,lex*1.5)+blex+rlex;",replace:"sc+=Math.min(8,lex*1.5)+blex;"},
  {label:"the word lane's df ceiling dies — common-ish words qualify unrelated scenes (#224)",
    mustFail:"#224: a word carried by more than 1% of entries identifies nothing",
   find:"if(elig[i].hits[j]&&df[j]<=bMaxDf)rlex+=",replace:"if(elig[i].hits[j])rlex+="},
  {label:"the single-word 8-cap dies — medium-df word piles swamp entity ranking (#224)",
    mustFail:"#224: the single-word 8-cap survives",
   find:"sc+=Math.min(8,lex*1.5)+blex+rlex;",replace:"sc+=lex*1.5+blex+rlex;"}
]});

process.exit(rc?1:0);
