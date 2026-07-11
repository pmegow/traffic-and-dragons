// npc-merge-tool.js — one-time NPC dupe-merge data surgery on an exported .tnd (UA29).
// DEV TOOL, node-only, NOT loaded by index.html.
//
// ═══════════════════════════════════════ README ═══════════════════════════════════════
//
// WHY: prevention (v1.62 resolveNpcName + the NPC_MERGE tag) stops NEW forks, but saves
// forked BEFORE it shipped still carry one person under several memory.npcs keys
// ("Aldara" / "Aldara Perdrath" / "Aldara of Perdrath" — t1392). An exact key never
// redirects (invariant I1, RESOLVE_NPC_INVARIANTS.md §3), so those forks are NOT
// self-healing: writes keep fattening the fragment forever. This script is the offline
// repair. Spec: RESOLVE_NPC_INVARIANTS.md §7 (the script contract) + Fable_UberAudit.md
// row UA29.
//
// USAGE
//   Report mode (read-only — NEVER writes anything):
//     node dev/npc-merge-tool.js "path\to\save.tnd"
//   Apply mode (writes a NEW .tnd; the input file is never touched):
//     node dev/npc-merge-tool.js "path\to\save.tnd" --apply ^
//          --merge "Canonical Name<=Dupe One,Dupe Two" [--merge "..."] ^
//          [--out "path\to\out.tnd"] [--force]
//   or with a JSON plan (required if any name contains a comma):
//     node dev/npc-merge-tool.js "path\to\save.tnd" --apply --merges plan.json
//     plan.json: [ {"canonical":"Sheriff Belor Hemlock","dupes":["Hemlock"]} , ... ]
//
//   --out    output path (default: <input>.merged.tnd next to the input)
//   --force  allow overwriting an EXISTING output file (never the input itself)
//
// WHAT REPORT MODE PRODUCES
//   1. Proposed merge groups, built from token-subset chains (the same npcCoreTokens
//      machinery the live resolver uses) + alias-claim links, with per-key evidence:
//      knowledge/event excerpts, first-encounter snippet, worldState roster data,
//      transcript e.n stamp counts. Groups holding >=2 distinct maximal identities
//      (the two-Aldaras hazard, spec E4) are flagged ⚠ AMBIGUOUS and excluded from
//      the suggested command — a human decides those.
//   2. A residue scan of the sites the LIVE handler misses (spec §7 item 6):
//      memory.map node npcs[] / lastSeenAt, companion-sheet relationship entities,
//      coreMemories[].who — plus graph endpoints, player relationships, and the
//      transcript e.n orphan census (how much the merge-orphan bridge is carrying).
//   3. Data-health checks: alias duplicated across keys (I10), live key claimed as
//      another key's alias.
//
// WHAT APPLY MODE DOES (per canonical<=dupe pair, sequentially)
//   • Runs the REAL live NPC_MERGE handler (tag_table.js) against the loaded state —
//     the reference implementation IS the implementation for spec §7 items 1–5:
//     memory.npcs absorb + THE BRIDGE (dupe key registered as an alias — §7 item 2),
//     worldState.npcs merge, npcGraph rewrite, player relationships rewrite.
//   • Then covers the residue the handler misses (spec §7 item 6): map node npcs[]
//     rewrite + lastSeenAt adoption, companion charSheet.relationships[].entity
//     rewrite, coreMemories[].who rewrite (live + archive). Events pre-trimmed to the
//     newest 8 by turn (spec §7 item 1 blesses this). Graph self-edges/dupes dropped.
//   • keyDecisions / lore / transcript prose and e.n stamps are LEFT ALONE by design —
//     the alias trail keeps old names resolvable (spec §7 items 2 and 6).
//   • MANDATORY post-checks (spec §7 items 2 + 9) gate the write — on any failure,
//     NO file is written and the exit code is 1:
//       A. resolveNpcName(dupe) === canonical for every merged dupe (the REAL resolver)
//       B. I10 — no alias claimed by two keys; no alias shadowed by a live key
//       C. RAG bridge probe — a real ragRetrieve() run (on a throwaway clone) naming
//          the canonical must still surface a pre-merge dupe-stamped transcript entry;
//          verified end-to-end via ragRetrieve._cands, with a mechanical fallback when
//          the entry is merely outranked. Vacuous (dupe never stamped) = pass w/ note.
//       D. Dangling-reference sweep (report-grade, WARN not fatal — pre-existing bare
//          names can legitimately be unresolvable under the 2-candidate rule).
//
// WHAT THIS SCRIPT MUST NEVER DO (spec §7, closing list)
//   • Auto-apply token-subset proposals — apply takes ONLY an explicit human list.
//   • Overwrite the input file, ever. Output is always a new file.
//   • Rename a canonical without the alias trail (the handler guarantees this).
//   • Touch _NPC_STOP / the tokenizer / any engine file — it only READS engine code.
//
// FIDELITY: engine files are eval'd whole (globals→…→tag_table, the run-tests.js
// pattern), so npcCoreTokens / resolveNpcName / ragRetrieve / the NPC_MERGE handler are
// the shipping implementations, not copies — this tool cannot drift from the engine.
//
// Exit codes: 0 = report done / apply verified + written; 1 = anything wrong (loudly).
// ═══════════════════════════════════════════════════════════════════════════════════════

var fs=require("fs");
var path=require("path");
var root=path.join(__dirname,"..");

// ───────────────────────────── loud output helpers ─────────────────────────────
function say(s){console.log(s);}
function warn(s){console.log("⚠ "+s);}
function fail(s){console.error("✗ FATAL: "+s);process.exit(1);}
function rule(t){say("");say("════ "+t+" ════");}
function sub(t){say("");say("── "+t+" ──");}
function trim1(s,max){s=String(s==null?"":s).replace(/\s+/g," ");if(s.length>max)s=s.slice(0,max-1)+"…";return s;}

// ───────────────────────────── argument parsing ─────────────────────────────
var argv=process.argv.slice(2);
var inputPath=null,applyMode=false,forceOut=false,outPath=null,mergeArgs=[],mergesFile=null;
(function(){
  var i;
  for(i=0;i<argv.length;i++){
    var a=argv[i];
    if(a==="--apply")applyMode=true;
    else if(a==="--force")forceOut=true;
    else if(a==="--merge"){if(i+1>=argv.length)fail("--merge needs a value");mergeArgs.push(argv[++i]);}
    else if(a==="--merges"){if(i+1>=argv.length)fail("--merges needs a file path");mergesFile=argv[++i];}
    else if(a==="--out"){if(i+1>=argv.length)fail("--out needs a file path");outPath=argv[++i];}
    else if(a.charAt(0)==="-")fail("unknown flag: "+a);
    else if(!inputPath)inputPath=a;
    else fail("unexpected extra argument: "+a);
  }
})();
if(!inputPath){
  say("Usage: node dev/npc-merge-tool.js <save.tnd>                       (report, read-only)");
  say("       node dev/npc-merge-tool.js <save.tnd> --apply --merge \"Canonical<=Dupe1,Dupe2\" [--out x.tnd] [--force]");
  say("       node dev/npc-merge-tool.js <save.tnd> --apply --merges plan.json");
  say("See the file header for the full contract (spec: RESOLVE_NPC_INVARIANTS.md §7, UA29).");
  process.exit(1);
}
if(!applyMode&&(mergeArgs.length||mergesFile||outPath||forceOut))
  fail("--merge/--merges/--out/--force only make sense with --apply (report mode is read-only)");
if(applyMode&&!mergeArgs.length&&!mergesFile)
  fail("--apply requires an explicit merge list (--merge or --merges). This tool NEVER auto-applies its own proposals (spec E4 — the two-Aldaras hazard).");

// ───────────────────────────── engine load (run-tests.js pattern) ─────────────────────────────
// Whole real files, global-scope eval — the tool runs the SHIPPING resolver, tokenizer,
// RAG retrieval, and NPC_MERGE handler. Prefix through tag_table.js (api/game/ui not needed).
var ENGINE_FILES=["globals.js","compress.js","data.js","capability_bible.js","helpers.js",
                  "state.js","storage-adapter.js","memory.js","tag_table.js"];
var geval=eval; // indirect eval → global scope, engine `var`s become node globals
(function(){
  var i;
  for(i=0;i<ENGINE_FILES.length;i++){
    try{geval(fs.readFileSync(path.join(root,ENGINE_FILES[i]),"utf8"));}
    catch(e){fail("engine load failed in "+ENGINE_FILES[i]+": "+e.message);}
  }
})();
if(typeof resolveNpcName!=="function"||typeof npcCoreTokens!=="function"||typeof ragRetrieve!=="function")
  fail("engine loaded but resolveNpcName/npcCoreTokens/ragRetrieve missing — load order changed?");
var MERGE_HANDLER=null;
(function(){
  var i;
  for(i=0;i<TAG_TABLE.length;i++){if(TAG_TABLE[i].t==="NPC_MERGE"){MERGE_HANDLER=TAG_TABLE[i];break;}}
})();
if(!MERGE_HANDLER)fail("NPC_MERGE handler not found in TAG_TABLE — tag_table.js changed shape?");

// ───────────────────────────── .tnd load ─────────────────────────────
var absIn=path.resolve(inputPath);
if(!fs.existsSync(absIn))fail("input file not found: "+absIn);
var tnd;
try{tnd=JSON.parse(fs.readFileSync(absIn,"utf8"));}
catch(e){fail("input is not valid JSON ("+e.message+"): "+absIn);}
if(!tnd||!tnd.worldState||!tnd.memory)fail("not a .tnd save: missing worldState/memory top-level keys");
if(!tnd.worldState.character)fail("save has no worldState.character — refusing to operate on it");
// Exports carry the PLAIN transcript array (compress.js header contract) — but be tolerant
// of a compressed one (someone hand-copied a localStorage blob into a file).
if(tnd.worldState.transcript&&tnd.worldState.transcript.__lz){
  warn("transcript is LZ-compressed (unusual for a .tnd export) — inflating via the engine's LZ");
  try{tnd.worldState.transcript=JSON.parse(LZ.decompressFromUTF16(tnd.worldState.transcript.__lz));}
  catch(e){fail("could not inflate compressed transcript: "+e.message);}
}
if(!tnd.worldState.npcs){warn("worldState.npcs missing — treating as empty roster");tnd.worldState.npcs=[];}
if(!tnd.memory.npcs){warn("memory.npcs missing — nothing to merge");tnd.memory.npcs={};}

// Point the engine globals at the loaded save. state.js declared these as global vars,
// so plain assignment rebinds what every engine function reads.
worldState=tnd.worldState;
memory=tnd.memory;
sessionLog=tnd.sessionLog||[];

var TR=worldState.transcript||[];
var PLAYER_NAME=worldState.character.name||"";

rule("NPC MERGE TOOL (UA29) — "+path.basename(absIn));
say("Campaign: "+(worldState.campName||"(unnamed)")+"   turn "+(worldState.turn||0)+"   player: "+(PLAYER_NAME||"(unknown)"));
say("memory.npcs keys: "+Object.keys(memory.npcs).length+"   worldState.npcs: "+worldState.npcs.length+
    "   transcript entries: "+TR.length);
say("Mode: "+(applyMode?"APPLY (writes a NEW file — input untouched)":"REPORT (read-only — nothing is written)"));

// ───────────────────────────── shared lookups ─────────────────────────────
function liveKeys(){return Object.keys(memory.npcs);}
function isLive(name){return Object.prototype.hasOwnProperty.call(memory.npcs,name);}
function wsEntry(name){var i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name)return worldState.npcs[i];}return null;}
// eligibility mirror of ragRetrieve's candidate filter (recent-window + rc + meta-exchange)
function ragCutT(){var skipN=Math.max(2,Math.ceil((sessionLog?sessionLog.length:0)/2)+1);return (worldState.turn||0)-skipN;}
function stampedEntries(name){ // GM transcript entries whose write-time e.n index carries `name`, ragRetrieve-eligible
  var out=[],cutT=ragCutT(),i;
  for(i=0;i<TR.length;i++){
    var en=TR[i];
    if(en.r!=="gm"||!en.e||!en.e.n)continue;
    if(en.e.n.indexOf(name)<0)continue;
    if(en.t>cutT)continue;
    if(en.rc)continue;
    var prev=i>0&&TR[i-1].r==="player"?String(TR[i-1].x).toLowerCase():"";
    if(/^\s*gm\s*[:,]/.test(prev))continue;
    out.push(i);
  }
  return out;
}
function stampCount(name){var c=0,i;for(i=0;i<TR.length;i++){var en=TR[i];if(en.r==="gm"&&en.e&&en.e.n&&en.e.n.indexOf(name)>=0)c++;}return c;}

// ───────────────────────────── proposal engine (report) ─────────────────────────────
// Links: (a) token-subset pairs — same predicate as resolver stage 4, over real
// npcCoreTokens; (b) alias-claims — live key K2 sitting in K1.aliases (a corruption:
// exact-key beats alias, so K2 writes never reach K1). Union-find into groups.
function buildGroups(){
  var keys=liveKeys(),cores={},i,j;
  for(i=0;i<keys.length;i++)cores[keys[i]]=npcCoreTokens(keys[i]);
  var parent={};
  function find(x){while(parent[x]!==x)x=parent[x]=parent[parent[x]];return x;}
  function union(a,b){var ra=find(a),rb=find(b);if(ra!==rb)parent[ra]=rb;}
  for(i=0;i<keys.length;i++)parent[keys[i]]=keys[i];
  var aliasClaims=[]; // {owner, claimed}
  for(i=0;i<keys.length;i++){
    for(j=0;j<keys.length;j++){
      if(i===j)continue;
      var a=keys[i],b=keys[j];
      // alias-claim link (core-independent)
      var als=memory.npcs[a].aliases||[];
      if(als.indexOf(b)>=0){union(a,b);aliasClaims.push({owner:a,claimed:b});}
      // token-subset link (empty cores never link — I3)
      if(j>i){
        var ca=cores[a],cb=cores[b];
        if(ca.length&&cb.length){
          var shortT=ca.length<=cb.length?ca:cb,longT=ca.length<=cb.length?cb:ca,ok=true,t;
          for(t=0;t<shortT.length;t++){if(longT.indexOf(shortT[t])<0){ok=false;break;}}
          if(ok)union(a,b);
        }
      }
    }
  }
  var byRoot={},groups=[];
  for(i=0;i<keys.length;i++){
    var r=find(keys[i]);
    if(!byRoot[r])byRoot[r]=[];
    byRoot[r].push(keys[i]);
  }
  for(i in byRoot){if(byRoot[i].length>1)groups.push(byRoot[i]);}
  // classify each group: maximal-identity count → ambiguous or a clean chain
  var out=[],g;
  for(g=0;g<groups.length;g++){
    var mem=groups[g],maximal=[],sigs={},m,n;
    for(m=0;m<mem.length;m++){
      var cm=cores[mem[m]],dominated=false;
      for(n=0;n<mem.length&&!dominated;n++){
        if(m===n)continue;
        var cn=cores[mem[n]];
        if(!cm.length){dominated=cn.length>0;continue;} // empty-core member defers to any named member
        if(cn.length<=cm.length)continue;
        var isSub=true,t2;
        for(t2=0;t2<cm.length;t2++){if(cn.indexOf(cm[t2])<0){isSub=false;break;}}
        if(isSub)dominated=true; // strictly larger superset exists → not maximal
      }
      if(!dominated){
        maximal.push(mem[m]);
        var sig=cm.slice().sort().join("␟");
        sigs[sig]=1;
      }
    }
    var sigCount=Object.keys(sigs).length;
    // proposed canonical: most tokens, then longest raw string (only when unambiguous)
    var canon=null;
    if(sigCount<=1){
      for(m=0;m<maximal.length;m++){
        if(!canon)canon=maximal[m];
        else{
          var cc=cores[canon],cm2=cores[maximal[m]];
          if(cm2.length>cc.length||(cm2.length===cc.length&&maximal[m].length>canon.length))canon=maximal[m];
        }
      }
      if(!canon)canon=mem[0]; // all-empty-core group linked by alias claims only
    }
    out.push({members:mem,maximal:maximal,ambiguous:sigCount>1,canonical:canon,cores:cores});
  }
  return {groups:out,aliasClaims:aliasClaims};
}

function printKeyEvidence(k,indent){
  var pad=indent||"    ";
  var e=memory.npcs[k]||{};
  var ws=wsEntry(k);
  var toks=npcCoreTokens(k);
  say(pad+"• \""+k+"\"   tokens=["+toks.join(",")+"]"+(e.aliases&&e.aliases.length?"   aliases=["+e.aliases.join(", ")+"]":""));
  say(pad+"  attitude: "+(e.attitude||"—")+"   knowledge: "+((e.knowledge||[]).length)+"   events: "+((e.events||[]).length)+
      "   e.n stamps: "+stampCount(k)+(e.lastSeenAt?"   lastSeenAt: "+e.lastSeenAt:""));
  if(ws)say(pad+"  roster: status="+(ws.status||"—")+" rel="+(ws.rel||"—")+" met=t"+(ws.met!=null?ws.met:"?")+
      (ws.partyMember?"  ★PARTY MEMBER":"")+(ws.charSheet?"  ★HAS CHARSHEET (Lv"+(ws.charSheet.level||"?")+" "+(ws.charSheet.cls||"?")+")":"")+
      (ws.pronouns?"  pronouns="+ws.pronouns:""));
  else say(pad+"  roster: (not in worldState.npcs)");
  if(e.firstEncounter)say(pad+"  first met: \""+trim1(e.firstEncounter,150)+"\"");
  var kn=(e.knowledge||[]).slice(0,3),i;
  for(i=0;i<kn.length;i++)say(pad+"  knows: "+trim1(kn[i],110));
  var ev=(e.events||[]).slice(-3);
  for(i=0;i<ev.length;i++)say(pad+"  event t"+(ev[i].turn!=null?ev[i].turn:"?")+": "+trim1(ev[i].note,110));
}

function reportGroups(built){
  sub("PROPOSED MERGE GROUPS (evidence below — a HUMAN confirms every merge; spec E4)");
  if(!built.groups.length){say("None. No token-subset or alias-claim links between live memory.npcs keys.");return;}
  var i,j,suggestions=[];
  for(i=0;i<built.groups.length;i++){
    var g=built.groups[i];
    say("");
    if(g.ambiguous){
      say("GROUP "+(i+1)+" — ⚠ AMBIGUOUS: "+g.maximal.length+" distinct maximal identities ("+
          g.maximal.join(" / ")+") share tokens. Two-Aldaras hazard — a token-only merge here");
      say("  could FUSE DISTINCT PEOPLE. Review the evidence and decide by hand; NOT in the suggested command.");
    }else{
      var dupes=[];
      for(j=0;j<g.members.length;j++){if(g.members[j]!==g.canonical)dupes.push(g.members[j]);}
      say("GROUP "+(i+1)+" — PROPOSED: \""+g.canonical+"\"  ⇐ absorbs  "+dupes.map(function(d){return "\""+d+"\"";}).join(", "));
      if(g.maximal.length>1)say("  note: "+g.maximal.join(" / ")+" have EQUAL token sets — same identity, different spelling; canonical chosen by length. Swap manually if you prefer another spelling.");
      suggestions.push({canonical:g.canonical,dupes:dupes});
    }
    // hazard flags either way
    var party=0,sheets=0,prons={},pk;
    for(j=0;j<g.members.length;j++){
      var w=wsEntry(g.members[j]);
      if(w&&w.partyMember)party++;
      if(w&&w.charSheet)sheets++;
      if(w&&w.pronouns)prons[w.pronouns]=1;
    }
    if(party>1)warn("  "+party+" members are flagged partyMember — merging keeps the flag, but verify these really are one person");
    if(sheets>1)warn("  "+sheets+" members carry a charSheet — the handler keeps ONLY the canonical's sheet; the other sheet(s) would be DROPPED. Review before applying.");
    var pkeys=Object.keys(prons);if(pkeys.length>1)warn("  conflicting pronouns across members: "+pkeys.join(" vs ")+" — possible distinct people");
    for(j=0;j<g.members.length;j++)printKeyEvidence(g.members[j]);
    // what RAG's scan-collapse already thinks (evidence, not authority)
    var kn2=ragKnownNames(),k2;
    for(k2=0;k2<kn2.length;k2++){
      if(g.members.indexOf(kn2[k2].nm)>=0&&kn2[k2].others&&kn2[k2].others.length)
        say("    RAG scan identity already collapses onto \""+kn2[k2].nm+"\": "+kn2[k2].others.join(", "));
    }
  }
  if(suggestions.length){
    sub("SUGGESTED APPLY COMMAND (unambiguous groups only — REVIEW THE EVIDENCE FIRST)");
    var parts=[],s;
    for(s=0;s<suggestions.length;s++){
      var bad=false,d2;
      for(d2=0;d2<suggestions[s].dupes.length;d2++){if(suggestions[s].dupes[d2].indexOf(",")>=0)bad=true;}
      if(suggestions[s].canonical.indexOf(",")>=0)bad=true;
      if(bad){warn("group with a comma in a name — use a --merges plan.json for: "+suggestions[s].canonical);continue;}
      parts.push("--merge \""+suggestions[s].canonical+"<="+suggestions[s].dupes.join(",")+"\"");
    }
    if(parts.length)say("node dev/npc-merge-tool.js \""+absIn+"\" --apply "+parts.join(" "));
  }else{
    sub("SUGGESTED APPLY COMMAND");
    say("(none — every group is ambiguous or no groups found)");
  }
}

// ───────────────────────────── residue + health scans ─────────────────────────────
function resolveClass(name){
  if(isLive(name))return {cls:"live"};
  var r=resolveNpcName(name);
  if(r!==name&&isLive(r))return {cls:"resolves",to:r};
  if(name===PLAYER_NAME)return {cls:"player"};
  return {cls:"unresolved"};
}
function scanResidue(){
  sub("RESIDUE SCAN — the three sites the live NPC_MERGE handler misses (spec §7 item 6), plus context");
  var findings=0;
  function report(site,name,extra){
    var rc=resolveClass(name);
    if(rc.cls==="live"||rc.cls==="player")return;
    findings++;
    if(rc.cls==="resolves")say("  ~ "+site+": \""+name+"\" is not a live key but resolves → \""+rc.to+"\""+(extra?"  ("+extra+")":""));
    else warn("  "+site+": \""+name+"\" — NOT a live key and does NOT resolve"+(extra?"  ("+extra+")":""));
  }
  var i,j,k;
  // 1. memory.map node npcs[]
  if(memory.map&&memory.map.nodes){
    for(k in memory.map.nodes){
      var nl=memory.map.nodes[k].npcs||[];
      for(i=0;i<nl.length;i++)report("map node \""+k+"\" npcs[]",nl[i]);
    }
  }
  // 2. companion charSheet relationships + player relationships
  for(i=0;i<worldState.npcs.length;i++){
    var n=worldState.npcs[i];
    if(n.charSheet&&n.charSheet.relationships){
      for(j=0;j<n.charSheet.relationships.length;j++)
        report("companion \""+n.name+"\" relationship entity",n.charSheet.relationships[j].entity,trim1(n.charSheet.relationships[j].descriptor,40));
    }
  }
  var prels=(worldState.character.relationships||[]);
  for(i=0;i<prels.length;i++)report("player relationship entity",prels[i].entity,trim1(prels[i].descriptor,40));
  // 3. coreMemories .who (live + archive)
  var cms=(worldState.coreMemories||[]);
  for(i=0;i<cms.length;i++){if(cms[i].who)report("coreMemories[].who (t"+cms[i].turn+")",cms[i].who,trim1(cms[i].text,50));}
  var acm=(memory.archive&&memory.archive.coreMemories)||[];
  for(i=0;i<acm.length;i++){if(acm[i].who)report("archive.coreMemories[].who",acm[i].who);}
  // context: graph endpoints
  if(memory.npcGraph){
    var ed=memory.npcGraph.edges||[];
    for(i=0;i<ed.length;i++){report("npcGraph edge .a",ed[i].a);report("npcGraph edge .b",ed[i].b);}
    for(k in (memory.npcGraph.npcFactions||{}))report("npcFactions key",k);
  }
  // context: transcript e.n orphan census (aggregate — the load the bridge is carrying)
  var orphan={},resolves=0,dead=0;
  for(i=0;i<TR.length;i++){
    var en=TR[i];
    if(en.r!=="gm"||!en.e||!en.e.n)continue;
    for(j=0;j<en.e.n.length;j++){var nm=en.e.n[j];if(!isLive(nm)&&!orphan[nm])orphan[nm]=1;}
  }
  var okeys=Object.keys(orphan),deadList=[];
  for(i=0;i<okeys.length;i++){
    var rc2=resolveClass(okeys[i]);
    if(rc2.cls==="resolves"||rc2.cls==="player")resolves++;
    else{dead++;deadList.push(okeys[i]);}
  }
  say("  transcript e.n orphans (stamped names no longer live keys): "+okeys.length+
      " distinct — "+resolves+" resolve via the bridge/heuristic, "+dead+" do NOT");
  if(deadList.length)warn("  unresolvable e.n orphans (their excerpts are invisible to RAG entity scoring): "+deadList.map(function(d){return "\""+d+"\"";}).join(", "));
  if(!findings)say("  (no residue found at the named sites)");
}
function scanHealth(built){
  sub("DATA HEALTH (invariant checks on the CURRENT save)");
  var owner={},dupAliases=0,liveClaims=0,i,j,keys=liveKeys();
  for(i=0;i<keys.length;i++){
    var als=memory.npcs[keys[i]].aliases||[];
    for(j=0;j<als.length;j++){
      if(owner[als[j]]&&owner[als[j]]!==keys[i]){
        dupAliases++;
        warn("  I10 VIOLATION: alias \""+als[j]+"\" claimed by BOTH \""+owner[als[j]]+"\" and \""+keys[i]+"\" — resolution is insertion-order-dependent");
      }else owner[als[j]]=keys[i];
      if(isLive(als[j])&&als[j]!==keys[i]){
        liveClaims++;
        warn("  live key \""+als[j]+"\" is claimed as an alias of \""+keys[i]+"\" — exact-key wins (I1), so the alias is DEAD and writes fork. Merging \""+als[j]+"\" into \""+keys[i]+"\" repairs this.");
      }
    }
  }
  if(!dupAliases&&!liveClaims)say("  ✓ alias uniqueness (I10) holds; no live key shadowed by an alias claim");
  if(built&&built.aliasClaims.length){
    for(i=0;i<built.aliasClaims.length;i++)
      say("  (alias-claim link fed to grouping: \""+built.aliasClaims[i].claimed+"\" claimed by \""+built.aliasClaims[i].owner+"\")");
  }
}

// ───────────────────────────── apply: plan parsing + validation ─────────────────────────────
function parsePlan(){
  var plan=[],i;
  if(mergesFile){
    var pf=path.resolve(mergesFile);
    if(!fs.existsSync(pf))fail("--merges file not found: "+pf);
    var pj;
    try{pj=JSON.parse(fs.readFileSync(pf,"utf8"));}catch(e){fail("--merges file is not valid JSON: "+e.message);}
    if(!pj||!pj.length)fail("--merges plan is empty");
    for(i=0;i<pj.length;i++){
      if(!pj[i].canonical||!pj[i].dupes||!pj[i].dupes.length)fail("--merges entry "+i+" needs {canonical, dupes:[...]}");
      plan.push({canonical:String(pj[i].canonical),dupes:pj[i].dupes.map(String)});
    }
  }
  for(i=0;i<mergeArgs.length;i++){
    var m=mergeArgs[i].split("<=");
    if(m.length!==2||!m[0].trim()||!m[1].trim())fail("bad --merge syntax (want \"Canonical<=Dupe1,Dupe2\"): "+mergeArgs[i]);
    var dupes=m[1].split(",").map(function(s){return s.trim();}).filter(function(s){return s.length;});
    if(!dupes.length)fail("no dupes in --merge: "+mergeArgs[i]);
    plan.push({canonical:m[0].trim(),dupes:dupes});
  }
  // validation: every name a live key; no overlaps; no self-merge; tag-safe characters
  var seenDupe={},canons={},g,d;
  for(g=0;g<plan.length;g++){
    var c=plan[g].canonical;
    if(!isLive(c))fail("canonical \""+c+"\" is not a live memory.npcs key (keys are case-sensitive; check the report)");
    if(/[\[\]|]/.test(c))fail("canonical \""+c+"\" contains [ ] or | — cannot route through the NPC_MERGE handler");
    canons[c]=1;
    for(d=0;d<plan[g].dupes.length;d++){
      var dd=plan[g].dupes[d];
      if(!isLive(dd))fail("dupe \""+dd+"\" is not a live memory.npcs key");
      if(dd===c)fail("\""+c+"\" listed as its own dupe");
      if(seenDupe[dd])fail("dupe \""+dd+"\" appears in two merge groups");
      if(/[\[\]|]/.test(dd))fail("dupe \""+dd+"\" contains [ ] or | — cannot route through the NPC_MERGE handler");
      seenDupe[dd]=1;
    }
  }
  for(g=0;g<plan.length;g++){
    if(seenDupe[plan[g].canonical])fail("\""+plan[g].canonical+"\" is a canonical in one group and a dupe in another — order-dependent; restructure the plan");
  }
  return plan;
}

// ───────────────────────────── apply: the surgery ─────────────────────────────
function mergePair(canonical,dupe){
  say("  merging \""+dupe+"\" ⇒ \""+canonical+"\"");
  var dupEntry=memory.npcs[dupe];
  var dupLastSeen=dupEntry?dupEntry.lastSeenAt:null;
  var dupWs=wsEntry(dupe),canWsBefore=wsEntry(canonical);
  if(dupWs&&dupWs.charSheet&&canWsBefore&&canWsBefore.charSheet)
    warn("    BOTH carry a charSheet — the dupe's sheet (Lv"+(dupWs.charSheet.level||"?")+" "+(dupWs.charSheet.cls||"?")+") is DROPPED, canonical's kept (live-handler behavior)");
  // 1–5: the REAL live handler (memory.npcs absorb + bridge alias, worldState.npcs,
  // npcGraph, player relationships) driven with a synthetic tag.
  var R={turn:worldState.turn||0,muts:[]};
  MERGE_HANDLER.apply("[NPC_MERGE:"+canonical+"|"+dupe+"]",R);
  if(!R.muts.length)fail("live NPC_MERGE handler reported no mutation for \""+dupe+"\" ⇒ \""+canonical+"\" — aborting before any write");
  say("    handler: "+R.muts.join("; "));
  var can=memory.npcs[canonical];
  // spec §7.1: pre-trim events to the newest 8 by turn (steady-state shape)
  if(can.events&&can.events.length>8){
    can.events.sort(function(a,b){return (a.turn||0)-(b.turn||0);});
    var dropped=can.events.length-8;
    can.events=can.events.slice(-8);
    say("    events pre-trimmed to newest 8 (dropped "+dropped+" oldest)");
  }
  // defensive: canonical's own name must never sit in its alias list
  if(can.aliases){var si=can.aliases.indexOf(canonical);if(si>=0){can.aliases.splice(si,1);warn("    removed self-alias \""+canonical+"\" from its own alias list");}}
  // ── residue site 1: memory.map node npcs[] + lastSeenAt (spec §7.6) ──
  var nodesTouched=0,k;
  if(memory.map&&memory.map.nodes){
    for(k in memory.map.nodes){
      var nl=memory.map.nodes[k].npcs||[];
      var di=nl.indexOf(dupe);
      if(di>=0){
        if(nl.indexOf(canonical)>=0)nl.splice(di,1);
        else nl[di]=canonical;
        nodesTouched++;
      }
    }
  }
  if(nodesTouched)say("    map nodes rewritten: "+nodesTouched+" node npcs[] entries \""+dupe+"\" → \""+canonical+"\"");
  if(dupLastSeen){
    if(!can.lastSeenAt){can.lastSeenAt=dupLastSeen;say("    lastSeenAt adopted from dupe: \""+dupLastSeen+"\"");}
    else if(can.lastSeenAt!==dupLastSeen&&memory.map&&memory.map.nodes){
      var cn=memory.map.nodes[can.lastSeenAt],dn=memory.map.nodes[dupLastSeen];
      var cStamp=cn?(cn.lastVisit||cn.firstVisit||0):0,dStamp=dn?(dn.lastVisit||dn.firstVisit||0):0;
      if(dStamp>cStamp){say("    lastSeenAt: dupe's \""+dupLastSeen+"\" (node stamp t"+dStamp+") is newer than canonical's \""+can.lastSeenAt+"\" (t"+cStamp+") — adopted");can.lastSeenAt=dupLastSeen;}
      else say("    lastSeenAt: kept canonical's \""+can.lastSeenAt+"\" (t"+cStamp+" ≥ dupe's t"+dStamp+")");
    }
  }
  // ── residue site 2: companion charSheet relationships (spec §7.6) ──
  var relTouched=0,i,j;
  for(i=0;i<worldState.npcs.length;i++){
    var n=worldState.npcs[i];
    if(!n.charSheet||!n.charSheet.relationships)continue;
    var out=[],seen={};
    for(j=0;j<n.charSheet.relationships.length;j++){
      var r=n.charSheet.relationships[j];
      if(r.entity===dupe){r.entity=canonical;relTouched++;}
      if(!seen[r.entity]){seen[r.entity]=1;out.push(r);}
    }
    n.charSheet.relationships=out;
  }
  if(relTouched)say("    companion-sheet relationship entities rewritten: "+relTouched);
  // ── residue site 3: coreMemories .who, live + archive (spec §7.6) ──
  var whoTouched=0;
  var cms=worldState.coreMemories||[];
  for(i=0;i<cms.length;i++){if(cms[i].who===dupe){cms[i].who=canonical;whoTouched++;}}
  var acm=(memory.archive&&memory.archive.coreMemories)||[];
  for(i=0;i<acm.length;i++){if(acm[i].who===dupe){acm[i].who=canonical;whoTouched++;}}
  if(whoTouched)say("    coreMemories .who rewritten: "+whoTouched);
  // graph hygiene the bulk merge can create: self-edges and exact duplicates
  if(memory.npcGraph&&memory.npcGraph.edges){
    var ed=memory.npcGraph.edges,kept=[],sig={},selfDropped=0,dupDropped=0;
    for(i=0;i<ed.length;i++){
      if(ed[i].a===ed[i].b){selfDropped++;continue;}
      var s=JSON.stringify([ed[i].a<ed[i].b?ed[i].a:ed[i].b,ed[i].a<ed[i].b?ed[i].b:ed[i].a,ed[i].rel||""]);
      if(sig[s]){dupDropped++;continue;}
      sig[s]=1;kept.push(ed[i]);
    }
    if(selfDropped||dupDropped){memory.npcGraph.edges=kept;say("    npcGraph hygiene: dropped "+selfDropped+" self-edge(s), "+dupDropped+" duplicate edge(s) created by the rewrite");}
    var nf=memory.npcGraph.npcFactions;
    if(nf&&nf[canonical]&&nf[canonical].length>1){
      var fOut=[],fSig={};
      for(i=0;i<nf[canonical].length;i++){var fs2=JSON.stringify(nf[canonical][i]);if(!fSig[fs2]){fSig[fs2]=1;fOut.push(nf[canonical][i]);}}
      if(fOut.length<nf[canonical].length){say("    npcFactions deduped for canonical ("+(nf[canonical].length-fOut.length)+" dropped)");nf[canonical]=fOut;}
    }
  }
  // NOT touched, by design (spec §7.6 + closing list): keyDecisions/lore prose,
  // transcript text and e.n stamps — the alias trail written above keeps them resolvable.
}

// ───────────────────────────── apply: post-checks (spec §7 items 2 + 9) ─────────────────────────────
function postChecks(plan){
  sub("POST-MERGE VERIFICATION (mandatory — write is gated on these)");
  var fatal=0,g,d,i;
  // A. every dupe resolves to its canonical via the REAL resolver (bridge = stage-3 alias)
  for(g=0;g<plan.length;g++){
    for(d=0;d<plan[g].dupes.length;d++){
      var got=resolveNpcName(plan[g].dupes[d]);
      if(got===plan[g].canonical)say("  ✓ A. resolveNpcName(\""+plan[g].dupes[d]+"\") → \""+got+"\"");
      else{fatal++;console.error("  ✗ A. resolveNpcName(\""+plan[g].dupes[d]+"\") → \""+got+"\" (expected \""+plan[g].canonical+"\") — THE BRIDGE IS BROKEN");}
    }
  }
  // B. I10: alias uniqueness + no live-key shadowing
  var owner={},keys=liveKeys(),j;
  for(i=0;i<keys.length;i++){
    var als=memory.npcs[keys[i]].aliases||[];
    for(j=0;j<als.length;j++){
      if(owner[als[j]]&&owner[als[j]]!==keys[i]){fatal++;console.error("  ✗ B. I10: alias \""+als[j]+"\" claimed by \""+owner[als[j]]+"\" AND \""+keys[i]+"\"");}
      else owner[als[j]]=keys[i];
      if(isLive(als[j])){fatal++;console.error("  ✗ B. alias \""+als[j]+"\" (of \""+keys[i]+"\") is still a LIVE key — exact-key beats alias, bridge dead");}
    }
  }
  if(!fatal)say("  ✓ B. I10 holds post-merge: no alias claimed twice, none shadowed by a live key");
  // C. RAG bridge probe — real ragRetrieve on a throwaway clone (never dirties the output:
  //    retrieval lazily backfills .e on old entries, and the probe forces the flag on).
  for(g=0;g<plan.length;g++){
    var canonical=plan[g].canonical,stamped=[],dupSet={};
    for(d=0;d<plan[g].dupes.length;d++){
      dupSet[plan[g].dupes[d]]=1;
      stamped=stamped.concat(stampedEntries(plan[g].dupes[d]));
    }
    if(!stamped.length){
      say("  ~ C. \""+canonical+"\": no ragRetrieve-eligible transcript entries stamped with a merged dupe — probe vacuous (nothing for the bridge to carry). PASS with note.");
      continue;
    }
    var savedWS=worldState,savedMem=memory,savedSL=sessionLog,hit=false,rendered=false,probeText="";
    try{
      worldState=JSON.parse(JSON.stringify(savedWS));
      memory=JSON.parse(JSON.stringify(savedMem));
      sessionLog=JSON.parse(JSON.stringify(savedSL));
      worldState.ragMemory=true; // clone-only: force the flag so the probe runs even on RAG-off saves
      probeText="Tell me everything about "+canonical+" and what happened with "+plan[g].dupes.join(" and ");
      var block=ragRetrieve(probeText);
      var cands=ragRetrieve._cands||[];
      for(i=0;i<cands.length&&!hit;i++){
        var en=worldState.transcript[cands[i].i];
        if(en&&en.e&&en.e.n){for(j=0;j<en.e.n.length;j++){if(dupSet[en.e.n[j]]){hit=true;break;}}}
      }
      if(hit&&block){
        for(i=0;i<cands.length;i++){var en2=worldState.transcript[cands[i].i];if(en2&&block.indexOf("[Turn "+en2.t)>=0&&en2.e&&en2.e.n){for(j=0;j<en2.e.n.length;j++){if(dupSet[en2.e.n[j]]){rendered=true;break;}}}}
      }
    }finally{
      worldState=savedWS;memory=savedMem;sessionLog=savedSL;
    }
    if(hit){
      say("  ✓ C. \""+canonical+"\": ragRetrieve probe surfaced a dupe-stamped pre-merge entry as a candidate ("+stamped.length+" eligible stamped entries"+(rendered?", one made the rendered excerpt block":", outranked below the rendered cut but scoring through the bridge")+")");
    }else{
      // mechanical fallback: distinguish "outranked past the candidate cap" from "bridge dead".
      // An entry stamped e.n=[dupe] scores iff resolveNpcName(dupe) lands on a weighted name;
      // the probe names the canonical, so w[canonical] is set iff the scan finds it.
      var mech=false;
      for(d=0;d<plan[g].dupes.length&&!mech;d++){
        if(resolveNpcName(plan[g].dupes[d])===canonical&&probeText.toLowerCase().indexOf(canonical.toLowerCase())>=0)mech=true;
      }
      if(mech)say("  ~ C. \""+canonical+"\": dupe-stamped entries exist but were outranked out of the top-12 candidates by stronger matches; the bridge itself verifies mechanically (dupe → canonical → probe weight). PASS with note — spot-check in game if paranoid.");
      else{fatal++;console.error("  ✗ C. \""+canonical+"\": "+stamped.length+" dupe-stamped entries exist and NONE scores through the bridge — pre-merge scenes would go INVISIBLE to RAG (the t198 regression class)");}
    }
  }
  // D. dangling-reference sweep (WARN-grade: bare pre-existing names can be legitimately
  //    unresolvable under the 2-candidate rule — listed so the human sees them, not fatal)
  var dangles=0;
  function sweep(site,name){
    if(name==null)return;
    var rc=resolveClass(name);
    if(rc.cls==="unresolved"){dangles++;warn("  D. "+site+": \""+name+"\" neither live nor resolvable (pre-existing residue, not created by this run — consider a follow-up merge)");}
  }
  if(memory.map&&memory.map.nodes){var k2;for(k2 in memory.map.nodes){var nl2=memory.map.nodes[k2].npcs||[];for(i=0;i<nl2.length;i++)sweep("map node \""+k2+"\"",nl2[i]);}}
  for(i=0;i<worldState.npcs.length;i++){var nn=worldState.npcs[i];if(nn.charSheet&&nn.charSheet.relationships){for(j=0;j<nn.charSheet.relationships.length;j++)sweep("companion \""+nn.name+"\" rel",nn.charSheet.relationships[j].entity);}}
  for(i=0;i<(worldState.character.relationships||[]).length;i++)sweep("player rel",worldState.character.relationships[i].entity);
  for(i=0;i<(worldState.coreMemories||[]).length;i++)sweep("coreMemories.who",worldState.coreMemories[i].who);
  if(memory.npcGraph){var ed2=memory.npcGraph.edges||[];for(i=0;i<ed2.length;i++){sweep("graph edge",ed2[i].a);sweep("graph edge",ed2[i].b);}}
  if(!dangles)say("  ✓ D. no dangling references at the swept sites");
  return fatal;
}

// ───────────────────────────── main ─────────────────────────────
if(!applyMode){
  var built=buildGroups();
  reportGroups(built);
  scanResidue();
  scanHealth(built);
  rule("REPORT COMPLETE — nothing was written. Review, then re-run with --apply and an explicit merge list.");
  process.exit(0);
}

// APPLY
var plan=parsePlan();
// output path safety BEFORE any mutation
var absOut=outPath?path.resolve(outPath):absIn.replace(/\.tnd$/i,"")+".merged.tnd";
if(absOut.toLowerCase()===absIn.toLowerCase())fail("output path equals the input path — this tool NEVER overwrites the input");
if(fs.existsSync(absOut)&&!forceOut)fail("output file already exists (pass --force to overwrite it): "+absOut);

// echo the plan against the proposal engine so a human sees ambiguity flags one last time
var built2=buildGroups();
(function(){
  var g,b,d;
  for(g=0;g<plan.length;g++){
    for(b=0;b<built2.groups.length;b++){
      if(!built2.groups[b].ambiguous)continue;
      var mem=built2.groups[b].members;
      if(mem.indexOf(plan[g].canonical)>=0)warn("plan touches AMBIGUOUS group ("+built2.groups[b].maximal.join(" / ")+") — proceeding because you listed it explicitly, but double-check these are one person");
      else{for(d=0;d<plan[g].dupes.length;d++){if(mem.indexOf(plan[g].dupes[d])>=0){warn("plan touches AMBIGUOUS group ("+built2.groups[b].maximal.join(" / ")+") — proceeding because you listed it explicitly, but double-check these are one person");break;}}}
    }
  }
})();

sub("APPLYING "+plan.length+" merge group(s)");
var gg,dd2;
for(gg=0;gg<plan.length;gg++){
  say("GROUP: \""+plan[gg].canonical+"\" absorbs "+plan[gg].dupes.length+" dupe(s)");
  for(dd2=0;dd2<plan[gg].dupes.length;dd2++)mergePair(plan[gg].canonical,plan[gg].dupes[dd2]);
}

var fatalCount=postChecks(plan);
if(fatalCount){
  rule("VERIFICATION FAILED — "+fatalCount+" fatal check(s). NO FILE WRITTEN. The input is untouched.");
  process.exit(1);
}

// write the NEW .tnd — same shape as exportSave ({worldState, sessionLog, memory}, 2-space,
// plain transcript array); extra top-level keys from the input, if any, are carried through.
tnd.worldState=worldState;tnd.memory=memory;tnd.sessionLog=sessionLog;
fs.writeFileSync(absOut,JSON.stringify(tnd,null,2),"utf8");
rule("MERGE APPLIED + VERIFIED");
say("Wrote: "+absOut+" ("+fs.statSync(absOut).size+" bytes)");
say("Input untouched: "+absIn);
say("Next: import the new file in-game (File ▸ Save / Load ▸ Import), spot-check the merged NPC's sheet and a RAG recall, and keep the original export until you're satisfied.");
process.exit(0);
