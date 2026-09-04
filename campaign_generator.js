// campaign_generator.js — shared campaign-skeleton generator, one-pass review, and designer
// draft generation (TODO #59, v1.290). ONE module, TWO consumers:
//   1. game.js generateSkeleton() — the on-the-fly skeleton at freeform campaign start now gets
//      ONE review pass (the Blueprint Designer's reviewer discipline, scoped to the skeleton
//      schema) plus an auto-correction call before play begins. A review/correction failure
//      NEVER blocks campaign start — the caller falls back to the valid first draft, loudly.
//   2. blueprint-designer.html "✨ Generate…" — one-click full draft blueprint (skeleton + seed
//      NPCs/locations/rules) straight into the editor; never auto-saved (RG.4) — the author
//      hand-reviews and can run the designer's full chunked 🔍 Review on it.
// This file IS the "generator API": pure client-side functions over callGM/repairModelJson
// (api.js) — no server, no DOM, no game-state writes, no toasts (failure handling belongs to
// the callers, who each have their own surface for it). Load AFTER api.js, BEFORE game.js.
// The skeleton schema is FROZEN exactly as generateSkeleton has always produced it — the review
// pass improves CONTENT only; worldState.skeleton shape, status-stamping semantics, and
// buildSkeletonBlock are untouched (drift-policy pre-review 2026-07-13, recorded in TODO #59).

var SKELETON_ARCHITECT_SYS="You are a campaign architect for a tabletop RPG. Output ONLY valid JSON. No prose, no markdown, no backticks.";
var SKELETON_REVIEW_SYS="You are a meticulous, blunt reviewer of TTRPG campaign structure. Output ONLY valid JSON in the requested shape. Keep every finding terse.";

// ── Shared prompt fragments ─────────────────────────────────────────────────────
// Byte-for-byte the fragments generateSkeleton has always sent (extracted v1.290 so the
// designer's Generate builds its acts on the SAME schema and rules). The character-specific
// rules (flaw/motivation) stay caller-side in game.js, spliced BETWEEN head and tail — the
// assembled game prompt is byte-identical to the pre-extraction original.
function skelActsSchema(withDna){
  return '"acts":['
    +'{"title":"Act 1 title","goal":"What must be accomplished","turningPoint":"The event that ends this act and propels into the next","parallel":false,"arcs":['
    +'{"title":"Arc title","objective":"What the player pursues in this arc","type":"combat or investigation or exploration or social"'+(withDna?',"dnaHint":"One vivid sentence: how THIS arc should feel and unfold in the narrative design above — specific to this arc, never generic procedure"':'')+'}]},'
    +'{"title":"Act 2 title","goal":"...","turningPoint":"...","parallel":true,"arcs":[{"title":"...","objective":"...","type":"..."'+(withDna?',"dnaHint":"..."':'')+'}]},'
    +'{"title":"Act 3 title","goal":"...","turningPoint":"The climax/resolution","parallel":false,"arcs":[{"title":"...","objective":"...","type":"..."'+(withDna?',"dnaHint":"..."':'')+'}]}'
    +"]";
}
function skelRulesHead(withDna){
  return (withDna?"- Each arc MUST include a dnaHint: one concrete sentence telling the GM how to run THAT specific arc in the narrative design above. NOT generic procedure — e.g. for an investigation arc, not 'gather clues and interrogate' but how this author would twist it (who the clues implicate, what the truth costs, where the betrayal lies). The dnaHint is what keeps the campaign in voice turn after turn, so make it sharp and specific to the arc's content.\n":"")
    +"- Each act should have 2-4 arcs\n"
    +"- Act 1: establish the world, introduce the threat, end with a revelation or loss\n"
    +"- Act 2: escalation, alliances, setbacks — the longest act\n"
    +"- Act 3: convergence and climax — the shortest act\n"
    +"- Arcs are waypoints, not scripts — leave room for player agency between them\n";
}
function skelRulesTail(){
  return "- Each arc has a type: combat (fights, sieges, hunts), investigation (mysteries, clues, interrogation), exploration (travel, discovery, mapping), or social (politics, alliances, persuasion). Mix types within an act for variety.\n"
    +"- An act may be parallel:true — its arcs can be pursued in any order (sandbox). Use this when the narrative supports it (e.g. investigating multiple leads, visiting locations in any order). Acts 1 and 3 are usually sequential; Act 2 is often parallel.";
}

// #227 the deep-time age ladder — a SHARED fragment, so the freeform campaign start and the
// designer's ✨ Generate produce the same closed enum of world ages. Deliberately separate from
// skelActsSchema: that is the STORY spine, this is world canon, and the reviewer constraint
// names them separately. Optional by contract — a model that omits it must never block a start.
function skelDeepTimeSchema(){
  return ',"deepTime":[{"name":"The oldest age","when":"how long ago it ended, in plain words","note":"one short clause on what it was"},'
    +'{"name":"a middle age","when":"...","note":"..."},'
    +'{"name":"living memory","when":"...","note":"..."}]';
}
function skelDeepTimeRule(){
  return "- deepTime is this world's COMPLETE age ladder, oldest first: 3-4 named ages, the first being the OLDEST THING THAT HAS EVER EXISTED here. Nothing may predate it. Every rung must be concrete and nameable (an empire, a cataclysm, a dynasty, a founding) — never \"the time before time\", \"ages beyond counting\", or any age defined only by being older than another. The GM will be held to this ceiling for the whole campaign, so pick an oldest age the story actually needs.\n";
}

// ── Pure structure helpers (engine-tested) ──────────────────────────────────────
// Split out of the old generateSkeleton inline checks — behavior identical (throw before any
// worldState write either way). validate throws; stamp mutates in place and returns the skel.
function validateSkeletonStructure(skel){
  if(!skel||!skel.premise||!skel.acts||skel.acts.length!==3)throw new Error("Invalid skeleton structure");
  var i;for(i=0;i<skel.acts.length;i++){if(!skel.acts[i].arcs||!skel.acts[i].arcs.length)throw new Error("Act "+(i+1)+" has no arcs");}
  return skel;
}
function stampSkeletonStatus(skel){
  var i,j;
  for(i=0;i<skel.acts.length;i++){
    skel.acts[i].status=i===0?"active":"pending";
    var isParallel=!!skel.acts[i].parallel;
    for(j=0;j<skel.acts[i].arcs.length;j++){var _a=i===0&&(isParallel||j===0);skel.acts[i].arcs[j].status=_a?"active":"pending";if(_a)skel.acts[i].arcs[j].startTurn=0;/* #23 per-arc pacing clock — game begins at turn 0 */}
  }
  return skel;
}
function skeletonHasDna(skel){
  var i,j;
  for(i=0;i<skel.acts.length;i++){var arcs=skel.acts[i].arcs||[];for(j=0;j<arcs.length;j++){if(arcs[j].dnaHint)return true;}}
  return false;
}

// ── One-pass review (ala the designer, skeleton-scoped) ─────────────────────────
// The designer's multi-chunk review targets sections a skeleton doesn't have (NPCs, locations,
// creatures, rules); this is its "story" chunk + the name-drop consistency check in ONE call,
// with the same convergence discipline. Findings are auto-applied (no human curates them), so
// each finding carries exactly ONE fix — an alternatives-bearing fix is worthless here.
var SKELETON_REVIEW_CONSTRAINTS=
  "CONSTRAINT CHECK — verify EVERY finding against these before you output; violations make the finding worthless:"
  +"\n1. THE SCHEMA IS FIXED: premise + exactly 3 acts (title/goal/turningPoint/parallel), each with arcs (title/objective/type, optional dnaHint), plus an optional deepTime age ladder (name/when/note rungs, oldest first).  Never propose new fields, sections, NPC rosters, or stat blocks — every fix is an edit to an EXISTING field."
  +"\n2. EXACTLY ONE fix per finding — one sentence, self-contained, applyable as written. If 'or', 'alternatively', or 'either' would appear in it, pick the better option yourself instead."
  +"\n3. NO NEW HOLES. Any person, place, faction, or thing a fix introduces must already appear in the skeleton, or the fix must say to establish it in the premise as part of the same edit. A fix that name-drops something undefined is worse than no fix."
  +"\n4. ENGINE CONTRACT — the game runtime ALREADY handles these; do NOT raise findings about them: parallel:true acts (full parallel-play instructions are injected every turn), arc/act rewards, generic arc-type guidance, how content is delivered to the GM, and all stats/dice/HP/XP/leveling/combat mechanics.";
// Hard cap on findings actually applied — mirrors the prompt's circuit breaker.
var SKELETON_FINDINGS_CAP=8;
function normalizeSkeletonFindings(r){
  if(!r||!r.findings||!r.findings.length)return [];
  var out=[],i,f;
  for(i=0;i<r.findings.length&&out.length<SKELETON_FINDINGS_CAP;i++){
    f=r.findings[i];
    if(!f||!f.issue||!f.fix)continue; // a fix-less finding is unactionable here — nobody to consult
    out.push({sev:String(f.sev||"MED").toUpperCase(),where:String(f.where||""),issue:String(f.issue),fix:String(f.fix)});
  }
  return out;
}
async function reviewCampaignSkeleton(skel,model,kind){
  var withDna=skeletonHasDna(skel);
  var msg="Review this three-act campaign skeleton for a tabletop RPG run by an AI Game Master. Every structural gap you find is a gap the GM will fill by IMPROVISING mid-campaign — which causes canon drift over a long game. This is a ONE-PASS review whose fixes are applied automatically, unseen by a human: report only genuine, worth-fixing issues.\n\nSKELETON:\n"
    +JSON.stringify({premise:skel.premise,acts:skel.acts},null,1)
    +"\n\nFOCUS — report findings ONLY about:\n"
    +"- arcs that are PLACES or standing situations rather than completable objectives (the engine can never complete a place)\n"
    +"- acts without a concrete turningPoint, or a turningPoint that does not propel into the next act\n"
    +"- a premise the acts never actually pursue, or a final act that fails to resolve the premise\n"
    +"- NAME-DROPS: people, places, factions, or things referenced in the premise or arcs but never established anywhere in the skeleton\n"
    +"- contradictions between acts or arcs"
    +(withDna?"\n- dnaHints that are generic procedure instead of arc-specific narrative direction":"")
    +"\nReport every genuine issue, worst-first (hard cap "+SKELETON_FINDINGS_CAP+" as a circuit breaker). If the skeleton is sound, return an empty findings array — do NOT invent issues to fill space.\n\n"
    +'Output ONLY this JSON:\n{"findings":[{"sev":"HIGH|MED|LOW","where":"premise, or the act/arc title","issue":"what is wrong","fix":"one concrete edit instruction"}]}\n\n'
    +SKELETON_REVIEW_CONSTRAINTS; // constraints LAST — end-of-prompt position is load-bearing (audit #2)
  var resp=await callGM(msg,SKELETON_REVIEW_SYS,2000,model,{noHistory:true,kind:kind||"other"});
  return normalizeSkeletonFindings(JSON.parse(repairModelJson(resp)));
}
async function correctCampaignSkeleton(skel,findings,model,kind){
  var lines=[],i;
  for(i=0;i<findings.length;i++)lines.push((i+1)+". ["+findings[i].sev+"] "+(findings[i].where?findings[i].where+" — ":"")+findings[i].issue+" FIX: "+findings[i].fix);
  var withDna=skeletonHasDna(skel);
  var msg="Apply review fixes to this three-act campaign skeleton for a tabletop RPG. Output ONLY valid JSON, no markdown.\n\nSKELETON:\n"
    +JSON.stringify({premise:skel.premise,acts:skel.acts},null,1)
    +"\n\nFINDINGS — apply EVERY fix:\n"+lines.join("\n")
    +"\n\nOutput the COMPLETE corrected skeleton in the exact same schema: {\"premise\":\"...\",\"acts\":[...]} with exactly 3 acts, every act keeping title/goal/turningPoint/parallel and its arcs keeping title/objective/type"+(withDna?"/dnaHint":"")+". Apply all fixes; keep everything not flagged verbatim; never add fields, and never drop an arc that was not flagged.";
  var resp=await callGM(msg,SKELETON_ARCHITECT_SYS,8192,model,{noHistory:true,kind:kind||"other"});
  var fixed=JSON.parse(repairModelJson(resp));
  validateSkeletonStructure(fixed); // a correction that breaks structure throws → caller keeps the draft
  return fixed;
}

// ── Designer draft generation (the "✨ Generate…" button) ───────────────────────
// One call → a full basic blueprint object (name/tone/startingLocation/premise/acts + seed
// NPCs/locations/rules) built on the SAME acts schema+rules as the game skeleton. The caller
// (blueprint-designer.html) normalizes/validates it and lands it in the editor UNSAVED.
// opts: {concept:"", toneId:""|TONES id, toneName:"", toneList:"high, gritty, …", dna:""}
async function generateBlueprintDraft(opts,model){
  var withDna=!!opts.dna;
  var prompt="Design a complete starter campaign blueprint for a tabletop RPG run by an AI Game Master. Output ONLY valid JSON, no markdown.\n\n"
    +(opts.concept
      ?"CONCEPT — build the whole campaign around this:\n"+opts.concept+"\n\n"
      :"CONCEPT: none given — invent a fresh, specific campaign. Commit to one strong idea; avoid the generic 'ancient evil awakens' default unless you twist it hard.\n\n")
    +(opts.toneName?"TONE: "+opts.toneName+"\n\n":"TONE: your choice — set \"tone\" to whichever id best fits the campaign.\n\n")
    +(withDna?"NARRATIVE DESIGN — shape the three acts and all arcs to reflect these story sensibilities (author's structural DNA, not prose style):\n"+opts.dna+"\n\n":"")
    +"JSON format:\n"
    +'{"name":"Campaign title","tone":"'+(opts.toneId?opts.toneId:"one of: "+opts.toneList)+'","startingLocation":"Where play begins (must appear in locations)","startingRegion":"The wider region","premise":"One paragraph: the central conflict driving the campaign",'
    +skelActsSchema(withDna)+skelDeepTimeSchema()+','
    +'"npcs":[{"name":"","role":"ally or villain or neutral","pronouns":"e.g. she/her","notes":"2-4 sentences of immediately available GM guidance: public identity, motives, early-act behavior. NO gated hidden truth.","secret":"The hidden truth and discovery conditions; withheld until revealAct opens. Never duplicate this truth in notes, premise, other NPC notes, or future-act titles/goals, which are visible early. Future-act arc objectives open only with that act.","revealAct":3}],'
    +'"locations":[{"name":"","description":"2-4 sentences of canonical description the GM will inject verbatim"}],'
    +'"rules":["optional standing GM directive — omit entries unless the world truly needs one"]}'
    +"\n\nRULES:\n"
    +skelRulesHead(withDna)
    +skelDeepTimeRule()
    +skelRulesTail()
    +"\n- Seed 4-6 NPCs (allies, villains, and at least one wildcard) and 3-6 locations; startingLocation MUST be one of the locations.\n"
    +"- 0-3 rules, only for standing world directives (magic works differently here, a faction hunts spellcasters) — never mechanics; stats/dice/XP are engine-side.\n"
    +"- NO NAME-DROPS: every person, place, faction, or god referenced in the premise, acts, arcs, or NPC notes must be defined in npcs or locations, or established in the premise itself.\n"
    +"- NPC notes and location descriptions are CHARACTER and canon, not stat blocks.";
  var resp=await callGM(prompt,SKELETON_ARCHITECT_SYS,8192,model,{noHistory:true,kind:"other"});
  var draft=JSON.parse(repairModelJson(resp));
  validateSkeletonStructure(draft); // the premise+acts core shares the skeleton schema
  return draft;
}
