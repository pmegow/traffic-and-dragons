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
// TWO HOSTS, ONE ENGINE: all grouping/surgery/verification logic lives in
// dev/npc-merge-core.js, shared with the point-and-click UI at dev/npc-merge-studio.html
// (a satellite page — open it directly, load the .tnd, tick the merges, download the
// result). This CLI is the scriptable/loggable host; the studio is the friendly one.
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
// WHAT APPLY MODE DOES (per canonical<=dupe pair, sequentially — see npc-merge-core.js)
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
// core → console: map log levels onto the CLI's symbols
function cliLog(level,text){
  if(level==="ok")say("  ✓ "+text);
  else if(level==="note")say("  ~ "+text);
  else if(level==="warn")warn("  "+text);
  else if(level==="fatal")console.error("  ✗ "+text);
  else say("  "+text);
}
// per-merge log lines sit one level deeper than the GROUP header
function mergeLog(level,text){
  if(/^(GROUP:|merging )/.test(text))say((text.indexOf("GROUP:")===0?"":"  ")+text);
  else if(level==="warn")warn("    "+text);
  else say("    "+text);
}

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
  say("Prefer clicking? Open dev/npc-merge-studio.html in a browser instead.");
  say("See the file header for the full contract (spec: RESOLVE_NPC_INVARIANTS.md §7, UA29).");
  process.exit(1);
}
if(!applyMode&&(mergeArgs.length||mergesFile||outPath||forceOut))
  fail("--merge/--merges/--out/--force only make sense with --apply (report mode is read-only)");
if(applyMode&&!mergeArgs.length&&!mergesFile)
  fail("--apply requires an explicit merge list (--merge or --merges). This tool NEVER auto-applies its own proposals (spec E4 — the two-Aldaras hazard).");

// ───────────────────────────── engine load (run-tests.js pattern) ─────────────────────────────
// Whole real files, global-scope eval — the tool runs the SHIPPING resolver, tokenizer,
// RAG retrieval, and NPC_MERGE handler. Prefix through tag_table.js (api/game/ui not
// needed), then the shared merge core.
var ENGINE_FILES=["globals.js","compress.js","data.js","capability_bible.js","helpers.js",
                  "state.js","storage-adapter.js","memory.js","tag_table.js"];
var geval=eval; // indirect eval → global scope, engine `var`s become node globals
(function(){
  var i;
  for(i=0;i<ENGINE_FILES.length;i++){
    try{geval(fs.readFileSync(path.join(root,ENGINE_FILES[i]),"utf8"));}
    catch(e){fail("engine load failed in "+ENGINE_FILES[i]+": "+e.message);}
  }
  try{geval(fs.readFileSync(path.join(__dirname,"npc-merge-core.js"),"utf8"));}
  catch(e){fail("core load failed in npc-merge-core.js: "+e.message);}
})();
if(typeof resolveNpcName!=="function"||typeof npcCoreTokens!=="function"||typeof ragRetrieve!=="function")
  fail("engine loaded but resolveNpcName/npcCoreTokens/ragRetrieve missing — load order changed?");
if(typeof nmcBuildGroups!=="function")fail("npc-merge-core.js loaded but nmcBuildGroups missing");
if(!nmcFindMergeHandler())fail("NPC_MERGE handler not found in TAG_TABLE — tag_table.js changed shape?");

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

rule("NPC MERGE TOOL (UA29) — "+path.basename(absIn));
say("Campaign: "+(worldState.campName||"(unnamed)")+"   turn "+(worldState.turn||0)+"   player: "+(nmcPlayerName()||"(unknown)"));
say("memory.npcs keys: "+Object.keys(memory.npcs).length+"   worldState.npcs: "+worldState.npcs.length+
    "   transcript entries: "+nmcTr().length);
say("Mode: "+(applyMode?"APPLY (writes a NEW file — input untouched)":"REPORT (read-only — nothing is written)"));

// ───────────────────────────── report rendering (CLI host) ─────────────────────────────
function printKeyEvidence(k,indent){
  var pad=indent||"    ";
  var ev=nmcKeyEvidence(k);
  say(pad+"• \""+k+"\"   tokens=["+ev.tokens.join(",")+"]"+(ev.aliases.length?"   aliases=["+ev.aliases.join(", ")+"]":""));
  say(pad+"  attitude: "+(ev.attitude||"—")+"   knowledge: "+ev.knowledge.length+"   events: "+ev.events.length+
      "   e.n stamps: "+ev.stamps+(ev.lastSeenAt?"   lastSeenAt: "+ev.lastSeenAt:""));
  if(ev.roster)say(pad+"  roster: status="+(ev.roster.status||"—")+" rel="+(ev.roster.rel||"—")+" met=t"+(ev.roster.met!=null?ev.roster.met:"?")+
      (ev.roster.partyMember?"  ★PARTY MEMBER":"")+(ev.roster.charSheet?"  ★HAS CHARSHEET (Lv"+(ev.roster.charSheet.level||"?")+" "+(ev.roster.charSheet.cls||"?")+")":"")+
      (ev.roster.pronouns?"  pronouns="+ev.roster.pronouns:""));
  else say(pad+"  roster: (not in worldState.npcs)");
  if(ev.firstEncounter)say(pad+"  first met: \""+nmcTrim(ev.firstEncounter,150)+"\"");
  var kn=ev.knowledge.slice(0,3),i;
  for(i=0;i<kn.length;i++)say(pad+"  knows: "+nmcTrim(kn[i],110));
  var evs=ev.events.slice(-3);
  for(i=0;i<evs.length;i++)say(pad+"  event t"+(evs[i].turn!=null?evs[i].turn:"?")+": "+nmcTrim(evs[i].note,110));
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
    var hz=nmcGroupHazards(g);
    for(j=0;j<hz.length;j++)warn("  "+hz[j]);
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

// ───────────────────────────── apply: plan parsing ─────────────────────────────
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
  var errs=nmcValidatePlan(plan);
  if(errs.length)fail(errs.join("\n✗ FATAL: "));
  return plan;
}

// ───────────────────────────── main ─────────────────────────────
if(!applyMode){
  var built=buildAndReport();
  process.exit(0);
}
function buildAndReport(){
  var built=nmcBuildGroups();
  reportGroups(built);
  sub("RESIDUE SCAN — the three sites the live NPC_MERGE handler misses (spec §7 item 6), plus context");
  nmcResidueScan(cliLog);
  sub("DATA HEALTH (invariant checks on the CURRENT save)");
  nmcHealthScan(built,cliLog);
  rule("REPORT COMPLETE — nothing was written. Review, then re-run with --apply and an explicit merge list (or use dev/npc-merge-studio.html).");
  return built;
}

// APPLY
var plan=parsePlan();
// output path safety BEFORE any mutation
var absOut=outPath?path.resolve(outPath):absIn.replace(/\.tnd$/i,"")+".merged.tnd";
if(absOut.toLowerCase()===absIn.toLowerCase())fail("output path equals the input path — this tool NEVER overwrites the input");
if(fs.existsSync(absOut)&&!forceOut)fail("output file already exists (pass --force to overwrite it): "+absOut);

// echo the plan against the proposal engine so a human sees ambiguity flags one last time
var built2=nmcBuildGroups();
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
try{nmcApplyPlan(plan,mergeLog);}
catch(e){fail(e.message+" — aborting before any write");}

sub("POST-MERGE VERIFICATION (mandatory — write is gated on these)");
var fatalCount=nmcPostChecks(plan,cliLog);
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
