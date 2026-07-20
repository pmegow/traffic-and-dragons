// ── table-talk.js — the Table Talk HELP AGENT (TODO #76) ─────────────────────────────────
//
// Table Talk is not a second GM. It is an out-of-character help desk that answers direct
// factual questions about the APP, the RULES, and this campaign's own HISTORY — and never
// advances the story.
//
// WHY THIS IS A SEPARATE FILE (and a separate prompt builder):
//   Table Talk is a second consumer of the same DATA, not a variant of the game prompt. It
//   deliberately does NOT call buildSysPrompt and does NOT reuse its stable half. Sharing the
//   stable half would put a second, differently-shaped prefix in front of the cached block and
//   silently kill prompt-cache hits on real gameplay turns — the UA5 failure mode, which has no
//   functional symptom, only a cost regression. Keep these two prompt builders apart.
//
// WHAT MAKES "NEVER GM" TRUE:
//   Not the prompt wording. The TT path in sendAction never calls applyMuts and never calls
//   logTranscript, so it structurally cannot mutate world state or the narrative record. The
//   prompt tells the model this explicitly (#74 ③) because the old TT silently discarded tags
//   the GM believed it was writing — it emitted [CALENDAR:11 days to winter solstice] into a
//   void (the #73 evidence). A capability the model thinks it has, and doesn't, is a silent
//   failure; state it plainly instead.
//
// THE LOAD-BEARING RULE — NEVER INFER:
//   Answer from what the engine actually stores; say plainly when something is not tracked.
//   This is GENERAL, not a set of special cases. Do NOT add per-topic branches here. The worked
//   example is dates: there is no calendar today (world.time is free text with no advancement),
//   so "days to the solstice" must come back "not tracked" — and when TODO #73 lands a real
//   campaign clock, this file needs ZERO changes, because it reads worldState.world generically
//   like every other fact. An `if (question is about dates)` branch would be a bug twice over.

// ── App help: derived from the RENDERED File menu, never hand-written ─────────────────────
// CLAUDE.md's rule is that File menus are GENERATED from one spec (buildFileMenus, ui-boot.js),
// never hand-authored. buildFileMenus builds HTML imperatively, so there is no object to walk —
// but the rendered menu is a better source anyway: it is literally what the player is looking
// at, including per-surface differences. A hand-written help block would rot silently every
// time the UI moved; this cannot, because it has no independent copy of the truth.
function ttMenuOutline(){
  var root=(typeof document!=="undefined")&&document.getElementById("file-menu");
  if(!root)return "";
  var lines=[];
  function labelOf(el){
    // Drawer buttons are <span>label</span><span>▶</span>; plain buttons are bare text.
    var s=el.querySelector&&el.querySelector("span");
    var t=s?s.textContent:el.textContent;
    return String(t||"").replace(/▶/g,"").replace(/\s+/g," ").trim();
  }
  function pad(d){return new Array(d+1).join("  ");}
  // Icon-only controls (the campaign-folder clear button renders as a bare "×") carry no
  // meaning in a help list — a label with no letters or digits is decoration, not a feature.
  function meaningful(s){return /[a-z0-9]/i.test(s);}
  function walk(node,depth){
    var kids=node.children||[],i,el,L;
    for(i=0;i<kids.length;i++){
      el=kids[i];
      // A drawer: its own label, then its contents one level deeper.
      if(el.className&&String(el.className).indexOf("fm-subwrap")>=0){
        var db=el.querySelector("button"),box=el.querySelector(".fm-sub");
        if(db){L=labelOf(db);if(L)lines.push(pad(depth)+"- "+L+" ▸");}
        if(box)walk(box,depth+1);
        continue;
      }
      if(el.tagName==="BUTTON"){L=labelOf(el);if(L&&meaningful(L))lines.push(pad(depth)+"- "+L);continue;}
      // File-input rows are <label><input hidden/>text</label>.
      if(el.tagName==="LABEL"){L=String(el.textContent||"").replace(/\s+/g," ").trim();if(L)lines.push(pad(depth)+"- "+L);continue;}
      if(el.children&&el.children.length)walk(el,depth);
    }
  }
  try{walk(root,0);}catch(e){
    // Never let a DOM shape change take down the whole answer — degrade to no app help,
    // loudly (no-silent-failures), and let the rest of the prompt still build.
    if(typeof console!=="undefined")console.warn("[TT] menu outline failed:",e&&e.message);
    return "";
  }
  if(!lines.length)return "";
  return "APP — FILE MENU (what the player can actually click, read live from the rendered menu):\n"
    +lines.join("\n")
    +"\nThe File menu is the ▾ button in the top bar. Items shown dimmed are unavailable on the current screen."
    +"\nThis list is the ONLY app knowledge you have. It covers menu-reachable features; if a question is about"
    +"\nsomething outside this menu (tabs, the input row, sheet interactions), say you do not have that documented"
    +"\nrather than guessing at the UI.";
}

// ── Rules: full name index always, full canon only for what the question names ────────────
// User call 2026-07-20 after costing the alternative: injecting all 169 entries every call is
// ~15k tokens (~$0.045/question), paid even on questions that have nothing to do with rules.
// The index alone is ~1-2k and buys the thing that actually matters — TT always knows what
// EXISTS, so "not in the bible" is an honest answer rather than a guess.
function ttCapabilityNames(){
  var seen={},out=[],k;
  if(typeof CAPABILITY_BIBLE!=="undefined"&&CAPABILITY_BIBLE)for(k in CAPABILITY_BIBLE)if(!seen[k]){seen[k]=1;out.push(k);}
  if(typeof worldState!=="undefined"&&worldState&&worldState.capabilityBible)for(k in worldState.capabilityBible)if(!seen[k]){seen[k]=1;out.push(k);}
  out.sort();
  return out;
}

// Longest-first so "detect magic" wins over a bare "detect" substring.
function ttMatchedCapabilities(question){
  var lc=" "+String(question||"").toLowerCase().replace(/[^a-z0-9' ]+/g," ").replace(/\s+/g," ")+" ";
  var all=ttCapabilityNames().slice(0),out=[],i;
  all.sort(function(a,b){return b.length-a.length;});
  for(i=0;i<all.length&&out.length<TT_CAP_MATCH_MAX;i++){
    if(lc.indexOf(" "+all[i]+" ")>=0)out.push(all[i]);
  }
  return out;
}

function ttCapabilityBlock(question){
  var names=ttCapabilityNames();
  if(!names.length)return "";
  var s="RULES — CAPABILITY BIBLE\nEvery spell and ability the bible defines, by name. If a name is NOT on this list, the bible does\nnot define it — say so; do not invent its mechanics.\n"+names.join(", ")+"\n";
  var hit=ttMatchedCapabilities(question),i,e;
  if(hit.length){
    s+="\nFULL CANON for the capabilities named in this question (authoritative — quote these numbers exactly):\n";
    for(i=0;i<hit.length;i++){
      e=(typeof capabilityLookup==="function")?capabilityLookup(hit[i]):null;
      if(e&&typeof capBibleLine==="function")s+=capBibleLine(hit[i],e)+"\n";
    }
  }else{
    s+="\n(The question names no capability from the list above. If the player meant one, ask which.)\n";
  }
  return s;
}

// ── Campaign facts: what the engine actually stores, stated as data ───────────────────────
// Deliberately reuses the game prompt's own builders where they are pure reads (buildGeoBlock,
// buildQuestBlock) so TT and the GM can never disagree about the same fact.
function ttStateBlock(){
  var c=(typeof worldState!=="undefined"&&worldState&&worldState.character)||null;
  if(!c)return "";
  var w=(worldState.world)||{},s=[],i;
  s.push("CAMPAIGN FACTS (engine-stored — these are the ONLY facts you may state as certain):");
  s.push("Campaign: "+(worldState.campName||"(unnamed)")+" | Turn: "+(worldState.turn||0));
  s.push("Player character: "+c.name+" — level "+c.level+" "+(c.ancestry||"")+" "+(c.cls||"")
    +" | HP "+c.hp+"/"+c.maxHp+" | gold "+c.gold+" | XP "+c.xp);
  s.push("Location: "+(w.location||"unknown")+(w.sublocation?" — "+w.sublocation:"")
    +" | time of day: "+(w.time||"not set")+" | weather: "+(w.weather||"not set"));
  s.push("NOTE ON TIME: the engine tracks a free-text TIME OF DAY only. There is no date, no day"
    +"\ncounter, no calendar, and no season tracking anywhere in the save. Any question about dates,"
    +"\nelapsed days, or a countdown to a future date is NOT TRACKED — say so.");
  // Party
  var party=[];
  if(worldState.npcs)for(i=0;i<worldState.npcs.length;i++){var n=worldState.npcs[i];if(n.partyMember)party.push(n.name+(n.charSheet?" (lv"+n.charSheet.level+" "+(n.charSheet.cls||"")+", HP "+n.charSheet.hp+"/"+n.charSheet.maxHp+")":""));}
  s.push("Party: "+(party.length?party.join(", "):"(no companions)"));
  if(c.inventory&&c.inventory.length)s.push("Inventory: "+c.inventory.join(", "));
  if(c.spells&&c.spells.length){var sp=[];for(i=0;i<c.spells.length;i++)sp.push(c.spells[i].nm+(c.spells[i].used?" (used)":""));s.push("Known spells: "+sp.join(", "));}
  if(c.abilities&&c.abilities.length){var ab=[];for(i=0;i<c.abilities.length;i++)ab.push(c.abilities[i].nm);s.push("Abilities: "+ab.join(", "));}
  if(c.conditions&&c.conditions.length){var cd=[];for(i=0;i<c.conditions.length;i++)cd.push(c.conditions[i].name);s.push("Conditions: "+cd.join(", "));}
  if(worldState.combat&&worldState.combat.foes){var fo=[];for(i=0;i<worldState.combat.foes.length;i++){var f=worldState.combat.foes[i];fo.push(f.name+" "+f.hp+"/"+f.maxHp+(f.down?" ("+f.down+")":""));}s.push("IN COMBAT — round "+worldState.combat.round+": "+fo.join(", "));}
  var geo=(typeof buildGeoBlock==="function")?buildGeoBlock():"";
  var qb=(typeof buildQuestBlock==="function")?buildQuestBlock():"";
  return s.join("\n")+(geo?"\n\n"+geo:"")+(qb?"\n\n"+qb:"");
}

// ── Recall: memory tiers always, plus RAG over the raw transcript keyed on the question ───
// The rat-kabob vendor only ever existed in raw transcript — a passing detail no summarizer
// would ever promote into memory.npcs. Memory tiers alone would miss him; this is why the
// question-keyed RAG pass is in the always-on path rather than an optimization.
function ttRecallBlock(question){
  var out="";
  var toc=(typeof memoryTOC==="function")?memoryTOC():"";
  if(toc)out+=toc+"\n";
  var rag=(typeof ragRetrieve==="function")?ragRetrieve(question):"";
  if(rag)out+="\n"+rag+"\n";
  return out;
}

// ── Table Talk's own short memory — separate from sessionLog, on purpose ──────────────────
// #74 ②: TT used to be sent against the full narrative sessionLog carrying one "be
// out-of-character" instruction, and history won — the GM narrated, was corrected, complied,
// then narrated again on the very next question because the correction was never recorded
// anywhere it could see. TT now sends noHistory and supplies THIS log instead, so follow-ups
// work while TT chatter still never touches story context or the GM's narrative memory.
function ttHistoryBlock(){
  var log=(typeof worldState!=="undefined"&&worldState&&worldState.ttLog)||[];
  if(!log.length)return "";
  var lines=[],used=0,i;
  for(i=log.length-1;i>=0;i--){
    var pair="Player: "+log[i].q+"\nYou: "+log[i].a;
    if(used+pair.length>TT_HISTORY_CHARS&&lines.length)break;
    used+=pair.length;lines.unshift(pair);
    if(lines.length>=TT_HISTORY_MAX)break;
  }
  return "EARLIER IN THIS TABLE-TALK CONVERSATION (oldest first):\n"+lines.join("\n\n")+"\n";
}

function ttLogExchange(question,answer){
  if(typeof worldState==="undefined"||!worldState)return;
  if(!worldState.ttLog)worldState.ttLog=[];
  worldState.ttLog.push({q:String(question||"").slice(0,600),a:String(answer||"").slice(0,1200),turn:worldState.turn||0});
  // Hard cap — this rides the save blob, so it must not grow without bound.
  while(worldState.ttLog.length>TT_HISTORY_MAX*2)worldState.ttLog.shift();
}

// ── The prompt ────────────────────────────────────────────────────────────────────────────
// Returns a plain STRING (a sysOverride), matching how every non-gameplay call already works.
// Not the {stable,volatile} shape: that shape exists for the gameplay cache, and TT must stay
// out of it entirely.
function buildTableTalkPrompt(question){
  var p=[];
  p.push("You are the Game Master of this campaign, speaking OUT OF CHARACTER, directly to the player, "
    +"between moments of play. You are a help desk right now, not a narrator.");
  p.push("VOICE: plain first person, as yourself, the GM. Same voice whether the question is about the "
    +"world, the rules, or the app itself. Never the second-person story voice.");

  p.push("ABSOLUTE PROHIBITIONS:\n"
    +"- ZERO narrative prose. No scene-setting, no description, no atmosphere, no story advancement.\n"
    +"- Never describe what the player character does, sees, feels, or experiences.\n"
    +"- Never write phrases like 'you slip', 'you notice', 'ahead lies', 'the air grows cold'.\n"
    +"- Nothing you say here happens in the story. You are not taking a turn.\n"
    +"- No small talk, no pleasantries, no offers to continue the adventure, no 'shall we?'.");

  p.push("YOU CANNOT WRITE STATE HERE. State tags emitted in Table Talk are discarded by the engine — "
    +"they are not parsed and nothing is listening. Do not emit any [TAG:...]. If something genuinely "
    +"needs to change on the sheet, tell the player to use the Sync button or raise it on their next "
    +"story turn. Do not pretend to have recorded anything.");

  p.push("NEVER INFER — THIS IS THE MOST IMPORTANT RULE:\n"
    +"Answer ONLY from the facts given below. If the engine does not store something, say plainly that "
    +"it is not tracked, and say what IS known instead. Do not estimate, do not reason your way to a "
    +"number, do not reconstruct it from the story. A confident wrong number is the worst possible "
    +"answer here — it is exactly what this mode exists to prevent. 'I don't have that' is a good answer.");

  p.push("ANSWER STYLE: direct and short. Lead with the answer. One or two sentences for most questions. "
    +"No preamble, no restating the question, no summary at the end. If you are quoting a stored number "
    +"(a range, a duration, an HP total), quote it exactly as given below.");

  var app=ttMenuOutline();if(app)p.push(app);
  var caps=ttCapabilityBlock(question);if(caps)p.push(caps);
  var st=ttStateBlock();if(st)p.push(st);
  var rec=ttRecallBlock(question);if(rec)p.push("CAMPAIGN MEMORY\n"+rec);
  var hist=ttHistoryBlock();if(hist)p.push(hist);

  p.push("Past-scene excerpts and memory entries above are a RECORD of what happened, useful for "
    +"answering 'who/what/when' questions. They are not the current state — the CAMPAIGN FACTS block "
    +"is. Answer the player's question now, directly.");
  return p.join("\n\n");
}
