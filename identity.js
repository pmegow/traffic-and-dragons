// identity.js — #156 THE IDENTITY LAYER, Phase A: the spine + the npc domain. ⛨ DRIFT SURFACE.
//
// The engine keys every canonical store by model-authored name strings, and string equality
// fails in two directions at campaign scale: DRIFT (many names accrete around one thing) and
// COLLISION (one name is reused for a new thing, fusing two entities' canon into one record —
// the three-Savahs class, field-confirmed at t1593). Five stores grew independent partial
// guards; this file is the shared spine they consolidate into (proposal + adjudicated plan:
// DOC/identity_hardening_fable.html §7).
//
// ONE registry (IDENTITY_DOMAINS — the PROVIDERS/BIBLE_TYPES/TAG_TABLE house pattern), ONE
// resolver (resolveEntity), ONE action pair ([ALIAS:domain|a|b] / [MERGE:domain|a|b] — thin
// routes into the battle-tested legacy handlers for npc), and the PROVISIONAL RECORD: an
// upsert-time collision suspect lands in a NEW identity ("Savah °t1530") instead of the
// existing record, so the turn is never blocked AND the fusion never happens (Sol §2 — a
// collision "nudged later" has already fused; the third outcome is create-distinct). A one-shot
// GM decision then folds it back ([NPC_MERGE:]) or renames it ([MERGE:npc|Proper Name|prov]).
//
// Phase A scope: npc (full adapter) + capability/item (already-conforming type domains —
// normalization IS their resolution; merge=null by the TYPE ruling). The location domain lands
// in Phase B on the A0-ruled additive-ID representation; quest/faction wait for evidence
// (Phase C, gated). MATCHING STAYS DOMAIN-TYPED (Sol §6): this shared layer owns dispatch,
// refusal, receipts, and the confirmation protocol — never token heuristics.
//
// Load order: after clock.js, before tag_table.js (whose ALIAS/MERGE entries and NPC handler
// call into here at parse time). Everything here reads worldState/memory as globals, exactly
// like the tag handlers do.

var IDENTITY_DOMAINS={
  npc:{
    keys:function(){return (typeof memory!=="undefined"&&memory&&memory.npcs)?Object.keys(memory.npcs):[];},
    aliases:function(key){var e=memory.npcs&&memory.npcs[key];return (e&&e.aliases)||[];},
    tokens:function(key){return npcCoreTokens(key);},
    resolve:function(name){return resolveNpcName(name);},
    context:function(key){var e=memory.npcs&&memory.npcs[key];return {lastSeenAt:(e&&e.lastSeenAt)||null};},
    /* merge/registerAlias ROUTE INTO the shipping NPC_MERGE / NPC_ALIAS handlers — the years of
       battle-testing (B3 death carry, #144A overflow archiving, epithet routing) ride along and
       the two tag surfaces cannot drift apart. Operands are pipe-refused upstream, so the
       synthesized legacy tag text is unambiguous. */
    merge:function(canonical,duplicate,R){return _identityRouteLegacy("NPC_MERGE",canonical+"|"+duplicate,R);},
    registerAlias:function(canonical,alias,R){return _identityRouteLegacy("NPC_ALIAS",canonical+"|"+alias,R);},
    namingRules:["Never give a new character the name of anyone in KNOWN NPCs — the engine would file the new person into the existing record. Pick a fresh name (AVAILABLE NAMES) or leave them unnamed."]
  },
  capability:{
    keys:function(){var out=Object.keys(typeof CAPABILITY_BIBLE!=="undefined"?CAPABILITY_BIBLE:{}),ov=(typeof worldState!=="undefined"&&worldState&&worldState.capabilityBible)||{},k;for(k in ov){if(out.indexOf(k)<0)out.push(k);}return out;},
    aliases:function(){return [];},
    tokens:function(key){return String(key||"").toLowerCase().split(/\s+/);},
    resolve:function(name){return capBaseName(name);},
    context:function(){return {};},
    merge:null,          /* write-once overlay + normalization-collapse IS the semantics (§7.2) */
    registerAlias:null,
    namingRules:["Spells and abilities resolve by their exact canonical name — use the name as written in the character's list, never a re-worded variant."]
  },
  item:{
    keys:function(){var out=Object.keys(typeof ITEM_BIBLE!=="undefined"?ITEM_BIBLE:{}),ov=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)||{},k;for(k in ov){if(out.indexOf(k)<0)out.push(k);}return out;},
    aliases:function(){return [];},
    tokens:function(key){return String(key||"").toLowerCase().split(/\s+/);},
    resolve:function(name){return itemBaseName(name);},
    context:function(){return {};},
    merge:null,          /* TYPE ruling (#81): eleven iron keys correctly collapse to one type */
    registerAlias:null,
    namingRules:[]
  }
};

// THE shared resolver — name → canonical identity through the domain's adapter. For npc this IS
// resolveNpcName (parity engine-tested); legacy tag call sites keep calling resolveNpcName
// directly (deliberate Phase A call: zero parse-path churn buys nothing until the location
// domain needs the shared path in Phase B — recorded in the Phase A review).
function resolveEntity(domain,name){
  var d=IDENTITY_DOMAINS[domain];
  if(!d){if(typeof console!=="undefined")console.warn("[identity] unknown domain '"+domain+"' — name passed through unresolved");return name;}
  return d.resolve(name);
}

// Route a generalized action into the shipping legacy handler out of TAG_TABLE (the
// npc-merge-core precedent: drive the SHIPPING handler, copy nothing).
function _identityRouteLegacy(tag,payload,R){
  var i;
  for(i=0;i<TAG_TABLE.length;i++){
    if(TAG_TABLE[i].t===tag){TAG_TABLE[i].apply("["+tag+":"+payload+"]",R);return true;}
  }
  if(typeof console!=="undefined")console.warn("[identity] legacy handler "+tag+" missing from TAG_TABLE — routing failed");
  return false;
}

// The [ALIAS:domain|a|b] / [MERGE:domain|a|b] parse core (called by the two tag_table entries).
// REFUSALS ARE LOUD AND MUTATION-FREE: a payload that does not split into exactly domain|a|b
// carried a pipe-bearing operand (real location keys contain pipes — Sol §5); those route
// through the Phase B cleanup tool, never through tag grammar. No escaping scheme is invented.
function _identityActionTag(kind,text,R){
  var re=new RegExp("\\["+kind+":([^\\]]+)\\]","g"),m;
  while((m=re.exec(text))){
    var parts=m[1].split("|");
    if(parts.length!==3){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":] REFUSED — expected domain|a|b, got "+parts.length+" segment(s) in \""+m[1].slice(0,80)+"\" (pipe-bearing operands route through the cleanup tool, never tag grammar — Sol §5)");
      R.muts.push(kind+" refused (malformed operand)");
      continue;
    }
    var domain=parts[0].trim().toLowerCase(),a=parts[1].trim(),b=parts[2].trim();
    var d=IDENTITY_DOMAINS[domain];
    if(!d){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":"+domain+"|…] REFUSED — unknown domain (Phase A registry: "+Object.keys(IDENTITY_DOMAINS).join(", ")+")");
      R.muts.push(kind+" refused (unknown domain '"+domain+"')");
      continue;
    }
    var op=kind==="MERGE"?d.merge:d.registerAlias;
    if(!op){
      if(typeof console!=="undefined")console.warn("[identity] ["+kind+":"+domain+"|…] REFUSED — the "+domain+" domain is not "+(kind==="MERGE"?"merge":"alias")+"-capable (type domains collapse by normalization; structural repairs ride the cleanup tool)");
      R.muts.push(kind+" refused ("+domain+" not capable)");
      continue;
    }
    op(a,b,R);
  }
}

// ── The provisional record (create-distinct — §7.1) ─────────────────────────────────────────
// Called by the [NPC:] handler with the RAW name and RAW relation operand. Returns the key the
// upsert should write: the resolved canonical (normal case) or a freshly minted provisional
// identity when the write is a collision suspect. THE PREDICATE IS NARROW ON PURPOSE — every
// clause below guards a real false-positive class, and a false provisional is one nudge round
// while a missed fusion is permanent canon corruption:
//   introduction-shaped rel  — the Savah t1530 signature ("unknown, not yet met" into a rich
//                              file); an ordinary re-tag ("ally") never mints
//   history-rich record      — a thin record has nothing worth protecting; normal upsert
//   living, non-party        — companions get re-tagged constantly; dead-name reuse stays with
//                              B3's refusal flow (evidence-gated follow-up, Phase A review)
//   under PROVISIONAL_CAP    — beyond it, degrade LOUDLY to today's direct write (the guard
//                              may never be worse than the status quo it replaces)
// Known honest limit (recorded): the t988 class — the model FALSELY asserting familiarity
// ("a woman named Savah who you've dealt with before") — is not engine-detectable; the NAMING
// clause and the suggestion-pool filter attack that side's base rate instead.
function npcUpsertTarget(rawName,rawRel,R){
  var resolved=resolveNpcName(rawName);
  var mem=memory.npcs&&memory.npcs[resolved];
  if(!mem)return resolved;
  if(!NPC_INTRO_REL_RE.test(rawRel||""))return resolved;
  var wsN=(typeof wsNpcByName==="function")?wsNpcByName(resolved):null;
  if(wsN&&wsN.partyMember)return resolved;
  if(mem.dead||(wsN&&wsN.dead))return resolved;
  if(((mem.knowledge||[]).length+(mem.events||[]).length)<2)return resolved;
  var key=resolved+" °t"+R.turn;
  if(memory.npcs[key])return key; /* same-response re-tag accumulates on the one provisional */
  var k,outstanding=0;
  for(k in memory.npcs){if(memory.npcs[k].provisional)outstanding++;}
  if(outstanding>=PROVISIONAL_CAP){
    if(typeof console!=="undefined")console.warn("[identity] provisional cap ("+PROVISIONAL_CAP+") reached — '"+rawName+"' written to the existing record (pre-#156 behavior). Resolve outstanding provisionals via their nudges.");
    return resolved;
  }
  memory.npcs[key]={attitude:"",knowledge:[],events:[],aliases:[],provisional:{of:resolved,turn:R.turn}};
  R.muts.push("⚠ possible name collision: '"+rawName+"' filed as PROVISIONAL '"+key+"'");
  if(typeof console!=="undefined")console.warn("[identity] '"+rawName+"' resolves to a history-rich record but this write is introduction-shaped (\""+rawRel+"\") — filed PROVISIONALLY as '"+key+"' so the established record cannot fuse; the GM decides same/distinct via the next engine note (#156)");
  if(typeof showToast==="function")showToast("⚠ Possible name collision: "+rawName+" — filed separately pending confirmation");
  return key;
}

// The one-shot decision channel: while any provisional is outstanding, ask the GM to settle it —
// SAME person (fold back via the battle-tested [NPC_MERGE:]) or DIFFERENT person (rename via
// [MERGE:npc|Proper Name|provisional], which creates the new canonical and folds the provisional
// in). Re-fires per record every PROVISIONAL_NUDGE_COOLDOWN turns until resolved (an unresolved
// provisional is live fragmentation — the #29/#134 re-fire lesson); one record per turn (note
// pressure); silent mid-combat WITHOUT consuming; latch worldState.provisionalNudged rides
// NOTE_LATCH_FIELDS so the #14 suggestion prompt build can never eat it.
function buildProvisionalNudge(){
  if(!worldState||worldState.combat)return"";
  if(typeof memory==="undefined"||!memory||!memory.npcs)return"";
  var k,best=null;
  for(k in memory.npcs){
    var p=memory.npcs[k].provisional;
    if(!p)continue;
    var last=(worldState.provisionalNudged&&worldState.provisionalNudged[k])||0;
    if(worldState.turn-last<PROVISIONAL_NUDGE_COOLDOWN)continue;
    if(!best||p.turn<memory.npcs[best].provisional.turn)best=k;
  }
  if(!best)return"";
  if(!worldState.provisionalNudged)worldState.provisionalNudged={};
  worldState.provisionalNudged[best]=worldState.turn;
  var of=memory.npcs[best].provisional.of,cm=memory.npcs[of],ev="";
  if(cm&&cm.lastSeenAt)ev=" The established "+of+" was last seen at "+cm.lastSeenAt+".";
  return "[ENGINE NOTE — NAME COLLISION, DECIDE (not a player action): a new \""+of+"\" was introduced and is filed PROVISIONALLY as \""+best+"\" so the established record stays clean."+ev+" Decide from the STORY in THIS response: if they are the SAME person, emit [NPC_MERGE:"+of+"|"+best+"]. If they are a DIFFERENT person, give them their own name and emit [MERGE:npc|<Their Proper Name>|"+best+"] — pick a name not already in KNOWN NPCs. This note re-fires until one tag lands.]";
}

// ── The NAMING clause (stable half — §2.6, amended §7.3) ────────────────────────────────────
// Campaign-constant by construction (cache-safe). States the RULE with the MECHANISM — the
// model has no idea names are primary keys. Domain lines assemble from each adapter's
// namingRules in fixed registry order; the two location-convention lines live here as literals
// until Phase B ships the location adapter (marked, so they move rather than duplicate).
function buildNamingClause(){
  var order=["npc","capability","item"],lines=[],i,j;
  lines.push("NAMING (identity discipline): The engine files everything by name: the same name IS the same entity, permanently, and a reused name writes into the existing file.");
  for(i=0;i<order.length;i++){
    var nr=IDENTITY_DOMAINS[order[i]].namingRules||[];
    for(j=0;j<nr.length;j++)lines.push(nr[j]);
  }
  /* location-domain conventions (Phase B moves these into its adapter's namingRules): */
  lines.push("Name roads, passes and trails by their endpoints in ONE fixed form — e.g. North Road (Magnimar–Sandpoint) — and reuse that exact form every time; the engine treats the pair as unordered, so never invent a reversed twin.");
  lines.push("A place inside a known settlement is [SUBLOCATION:], never a new [LOCATION:] with the parent baked into the name.");
  return lines.join("\n")+"\n\n";
}
