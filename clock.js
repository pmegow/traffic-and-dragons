// ── clock.js — the CAMPAIGN CLOCK (TODO #73) ─────────────────────────────────────────────
//
// The engine had no concept of a DAY, so every in-fiction deadline was a hallucination: asked
// "how many days to the solstice" the GM answered 11, then 8, then 94, and emitted invented
// [CALENDAR:]/[DAYS_TO_SOLSTICE:] tags for a system that did not exist. Root cause: the GM was
// asked to REMEMBER and re-state a number. This subsystem removes that request — the engine
// stores one anchor, and every countdown is RECOMPUTED from it. A number the GM never re-states
// cannot drift.
//
// DESIGN (full spec: DOC/DOC_clock.html):
//   • Counter = ONE scalar, worldState.clock.min = total minutes since epoch (campaign start=0),
//     MONOTONIC. The day/hour/minute view is DERIVED, never stored (no carry-desync).
//   • The GM does ZERO arithmetic. It emits a duration ESTIMATE in natural units ([TIME_ADVANCE:2h]);
//     the engine (deterministic JS) does every add and every countdown. "LLMs are bad at math" is
//     the REASON for this shape, not a constraint worked around.
//   • Scheduler stores an ABSOLUTE dueMin; "time remaining" is computed (due − now) every turn.
//   • Firing is THRESHOLD (now ≥ due), never exact-minute — JUMP-SAFE: a 1h deadline slept past by
//     a 6h rest fires on waking (660 ≥ 360). See scheduleDue(). Do NOT turn ≥ into ==.
//   • Firing SURFACES to the GM (buildClockBlock → HAPPENING NOW); the GM narrates and emits the
//     consequent tag itself. The engine tracks time; the GM stays the only mutator.
//
// v1 SCOPE: the clock measures ELAPSED campaign time. Mapping elapsed → an in-world wall-clock
// date (named months, "3rd of Frostfall") and retiring free-text [TIME:] are the fast-follow —
// both are the display / date-projection layer. So this file does NOT touch world.time.
//
// #89 (v1.433, ratified 2026-07-23): the Day boundary IS dawn — clock%1440==0 ≡ dawn (~6am).
// This adds an INTERPRETATION to the existing boundary, not a new offset: Day numbers are
// unmoved, no migration, and the eventual C4 time-of-day mapping becomes (clock%1440)/60 + 6.
// It exists so an overnight sleep can "roll forward to the start of the next Day" and "wake at
// dawn" as ONE operation (clockSleepRoll below). Days run dawn-to-dawn — the adventuring day.

var MIN_PER_HOUR=60, MIN_PER_DAY=1440;

// #89: a single GM response may not advance the clock more than this (30 days). A legitimate
// long skip ("three weeks pass") fits comfortably; anything larger is almost certainly a
// malformed tag ("9999d" = 27 years), and applying it SILENTLY was the exact no-silent-failures
// class the #73 Fable review flagged (todo_checkWithFable #3 — "a [TIME_ADVANCE:9999d] would
// apply; is a loud-warn cap wanted?"). Verdict: yes — clamp LOUDLY (warn + muts note).
var CLOCK_MAX_RESPONSE_ADVANCE=30*MIN_PER_DAY;

// Lazily ensure the clock exists (migrateWorldState also adds it; this guards direct callers and
// any pre-migration path). Never throws, never mutates time.
function clockEnsure(){
  if(typeof worldState==="undefined"||!worldState)return null;
  if(!worldState.clock||typeof worldState.clock.min!=="number"||isNaN(worldState.clock.min)){
    worldState.clock={min:0,schedule:[]};
  }
  if(!worldState.clock.schedule)worldState.clock.schedule=[];
  return worldState.clock;
}

function clockNow(){var c=clockEnsure();return c?c.min:0;}

// ── #146 (drift pass order 3): sanctioned clock corrections are TRANSACTIONS ─────────────
// A raw console edit (`clock.min-=1160`, the #142 interim repair) landed TWICE on the live
// campaign — transcript ck stamps prove 8820→6500 between t1525 and t1526, exactly −2×1160 —
// because a scalar edit has no expected-before value, no identity, and no cross-device memory.
// Receipts live ON worldState.clock so they ride the save/sync blob: the second device (the
// likely double-fire vector) SEES the first application and refuses. Refusals are loud and
// mutate NOTHING.
function clockRepair(repairId,expectedMin,delta){
  var c=clockEnsure();if(!c)return false;
  if(!c.repairs)c.repairs=[];
  var i;for(i=0;i<c.repairs.length;i++){if(c.repairs[i].id===repairId){
    if(typeof console!=="undefined")console.warn("[clock] repair \""+repairId+"\" ALREADY APPLIED (t"+c.repairs[i].t+", "+c.repairs[i].before+"→"+c.repairs[i].after+") — refused (#146)");
    if(typeof showToast==="function")showToast("Clock repair refused: already applied");
    return false;}}
  if(c.min!==expectedMin){
    if(typeof console!=="undefined")console.warn("[clock] repair \""+repairId+"\" REFUSED — clock.min is "+c.min+", expected "+expectedMin+"; the anomaly this repair targets is not present. Re-derive from the transcript ck stamps before writing anything (#146)");
    if(typeof showToast==="function")showToast("Clock repair refused: state mismatch — see console");
    return false;}
  c.repairs.push({id:repairId,before:c.min,after:c.min+delta,t:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||0});
  c.min+=delta;
  if(typeof console!=="undefined")console.info("[clock] repair \""+repairId+"\" applied: "+(c.min-delta)+" → "+c.min+" (receipt rides the save — a second run on ANY device refuses)");
  if(typeof showToast==="function")showToast("⏱ Clock repaired: "+repairId);
  if(typeof saveAll==="function")saveAll();
  return true;
}

// #146 load-time diagnostics: the invariants a healthy timeline can never violate. Pure —
// migrateWorldState WARNS on each hit and heals NOTHING (transcript stamps are decree-immutable
// and schedule anchors carry adjudication evidence; quarantine-and-ask, never guess).
function clockTimelineAnomalies(c){
  var out=[];if(!c||!Array.isArray(c.schedule))return out;
  var i;for(i=0;i<c.schedule.length;i++){var s=c.schedule[i];if(!s)continue;
    if(typeof s.born==="number"&&s.born>c.min)out.push("schedule \""+s.label+"\" born at min "+s.born+" is AFTER now ("+c.min+") — the clock moved backward under it");
    if(typeof s.dueMin==="number"&&typeof s.born==="number"&&s.dueMin<s.born)out.push("schedule \""+s.label+"\" is due ("+s.dueMin+") BEFORE it was born ("+s.born+")");
  }
  return out;
}

// Advance by a whole number of minutes, clamped to >= 1 (min turn = 1 minute) and MONOTONIC —
// a negative or zero advance is coerced up, never applied backward. Returns the minutes added.
function clockAdvance(min){
  var c=clockEnsure();if(!c)return 0;
  var n=Math.round(Number(min));
  if(!isFinite(n)||n<1)n=1;               // fail-safe-small: the clock creeps, never freezes or reverses
  c.min+=n;
  return n;
}

// Parse a duration string into minutes. Unit-suffixed and compound: "2h", "30m", "45",
// "1d 6h", "1d6h30m". Bare number = minutes. Unknown junk → 0 (caller clamps).
//   d = day (1440m), h = hour (60m), m = minute. A bare integer is minutes.
function parseDuration(str){
  if(typeof str==="number")return isFinite(str)?Math.round(str):0;
  var s=String(str==null?"":str).toLowerCase().trim();
  if(!s)return 0;
  // Bare integer (no letters) → minutes.
  if(/^\d+$/.test(s))return parseInt(s,10);
  var total=0,any=false,re=/(\d+)\s*([dhm])/g,mm;
  while((mm=re.exec(s))){
    any=true;var v=parseInt(mm[1],10);
    total+= mm[2]==="d"?v*MIN_PER_DAY : mm[2]==="h"?v*MIN_PER_HOUR : v;
  }
  return any?total:0;
}

// #89: an overnight sleep — roll forward to the next Day boundary, which IS dawn (see header).
// Returns the minutes added (1..1440): bedding down 10 minutes before dawn sleeps 10 minutes
// ("the rest of the night"); sleeping AT dawn exactly sleeps a full day to the next dawn
// (1440-0=1440 — the boundary case falls out of the formula, no special case). Monotonic by
// construction (the roll is always ≥1). ONE call site per rest path: restSpells() owns it, so
// the Rest button and the GM's [REST:long] tag (whose handler calls restSpells) can never
// double-roll.
function clockSleepRoll(){
  var c=clockEnsure();if(!c)return 0;
  var r=MIN_PER_DAY-(c.min%MIN_PER_DAY);
  c.min+=r;
  return r;
}

// DERIVED human view of an elapsed-minutes value — {d, h, m}. Never stored.
function clockParts(min){
  var t=Math.max(0,Math.floor(Number(min)||0));
  return { d:Math.floor(t/MIN_PER_DAY), h:Math.floor((t%MIN_PER_DAY)/MIN_PER_HOUR), m:t%MIN_PER_HOUR };
}

// The DISPLAY day number — 1-based, because the first day of a campaign is "Day 1" to everyone
// who is not a programmer (user call 2026-07-30). Deliberately NOT folded into clockParts().d,
// which stays a pure 0-based decomposition of elapsed time (whole days / hours / minutes) and is
// what every arithmetic consumer wants; conflating "days elapsed" with "which day is it" is how
// off-by-ones get baked into stored data. Nothing stored changes — this is a label over the same
// scalar — so there is no migration and .ck stamps written under the old label still render right.
// BOTH labels below route through it, so the player UI and the GM's clock block can never differ.
function clockDayNumber(min){
  return clockParts(min==null?clockNow():min).d+1;
}

// "Day 5, 14h 30m elapsed" — the elapsed-time label. v1 is elapsed, NOT wall-clock time-of-day
// (that's the calendar fast-follow), so the wording says "elapsed" to avoid implying a tod.
function clockFmt(min){
  var v=(min==null?clockNow():min);
  var p=clockParts(v);
  var hm=(p.h<10?"0":"")+p.h+"h "+(p.m<10?"0":"")+p.m+"m";
  return "Day "+clockDayNumber(v)+", "+hm+" elapsed";
}

// ── Player-facing time of day (#106b) ───────────────────────────────────────────────────────
// The clock counts ELAPSED minutes, but players read a wall clock. The mapping was already
// fixed by #89 and written into this file's header: clock%1440==0 IS dawn (~6am), so
// time-of-day = (clock%1440) + 6h, wrapped at midnight. This is that documented projection
// and nothing more — no new state, no stored time-of-day, so it cannot desync from the counter.
//
// Wrapping is intentional and correct: an adventuring Day runs dawn-to-dawn, so 20h into Day 3
// is 2am on the calendar morning AFTER Day 3 began, while still being Day 3. Hour 0 renders as
// 12 (midnight/noon), matching how a person reads a clock.
var DAWN_OFFSET_MIN=6*MIN_PER_HOUR;
function clockTimeOfDay(min){
  var t=Math.max(0,Math.floor(Number(min==null?clockNow():min)||0));
  var tod=((t%MIN_PER_DAY)+DAWN_OFFSET_MIN)%MIN_PER_DAY;
  var h24=Math.floor(tod/MIN_PER_HOUR), m=tod%MIN_PER_HOUR;
  var ap=h24<12?"am":"pm", h=h24%12; if(h===0)h=12;
  return h+":"+(m<10?"0":"")+m+" "+ap;
}
// "Day 2, 11:23 pm" — the ONE player-facing stamp, shared by the turn caption and the session
// bar so the two surfaces can never disagree. Day number is clockDayNumber(), the SAME 1-based
// number clockFmt feeds the GM (a save predating the clock reads Day 1 until time advances).
function clockStamp(min){
  var v=(min==null?clockNow():min);
  return "Day "+clockDayNumber(v)+", "+clockTimeOfDay(v);
}

// Render a positive minute-gap as the coarsest natural phrase: "in 7 days", "in 3 hours",
// "in 6 minutes". Countdown ONLY — the engine computes this every turn from due−now so the GM
// never remembers it.
function fmtGap(gapMin){
  var g=Math.max(0,Math.round(gapMin));
  if(g>=MIN_PER_DAY){var d=Math.round(g/MIN_PER_DAY);return "in "+d+" day"+(d===1?"":"s");}
  if(g>=MIN_PER_HOUR){var h=Math.round(g/MIN_PER_HOUR);return "in "+h+" hour"+(h===1?"":"s");}
  return "in "+g+" minute"+(g===1?"":"s");
}

// ── Scheduler ─────────────────────────────────────────────────────────────────────────────
// A scheduled event stores an ABSOLUTE dueMin. Duplicate label (case-insensitive) refreshes the
// due-time in place rather than twinning (the #29 futureEvents dedup lesson).
function scheduleAdd(label,whenStr){
  var c=clockEnsure();if(!c)return null;
  var lbl=String(label==null?"":label).trim();if(!lbl)return null;
  var mins=parseDuration(whenStr);if(mins<1)mins=1;            // "in <1 min" is meaningless; floor at 1
  var due=c.min+mins;
  var i,key=lbl.toLowerCase();
  for(i=0;i<c.schedule.length;i++){
    if(String(c.schedule[i].label||"").toLowerCase()===key){c.schedule[i].dueMin=due;return c.schedule[i];}
  }
  var ev={id:"sch"+(c.schedule.length+1)+"_"+due,label:lbl,dueMin:due,born:c.min};
  c.schedule.push(ev);
  // #150 (drift pass order 6): PROMOTION — the same anticipated fact used to live in BOTH stores
  // under different lifecycle rules (the live t1549 Sable pair: the futureEvents copy 0 turns
  // from silent age-expiry while its schedule twin had 1.6 in-fiction days on the clock). A
  // fuzzy pending event that fingerprint-matches the new schedule retires as promoted — the
  // clock, with its due-time and escalation, becomes the ONE lifecycle authority.
  if(typeof memory!=="undefined"&&memory&&Array.isArray(memory.futureEvents)&&typeof feNearDup==="function"){
    var fi;for(fi=memory.futureEvents.length-1;fi>=0;fi--){var fev=memory.futureEvents[fi];
      if(fev&&!fev.resolved&&feNearDup(fev.what,lbl)){
        memory.futureEvents.splice(fi,1);
        memArchive().futureEvents.push({when:fev.when,who:fev.who,what:fev.what,setTurn:fev.setTurn,promoted:ev.id});
        if(typeof console!=="undefined")console.info("[clock] #150: pending thread \""+String(fev.what).slice(0,60)+"\" promoted to schedule \""+lbl+"\" — retired from futureEvents (one lifecycle authority)");
      }}}
  return ev;
}

// Remove a scheduled event by label (case-insensitive substring — the GM rarely re-types a long
// label verbatim). Returns the count removed. Used by both RESOLVED and CANCEL.
function scheduleRemove(label){
  var c=clockEnsure();if(!c)return 0;
  var key=String(label==null?"":label).toLowerCase().trim();if(!key)return 0;
  var before=c.schedule.length;
  c.schedule=c.schedule.filter(function(e){return String(e.label||"").toLowerCase().indexOf(key)<0;});
  return before-c.schedule.length;
}

// All PENDING (not-yet-due) events, soonest first — for the UPCOMING block.
function schedulePending(){
  var c=clockEnsure();if(!c)return [];
  return c.schedule.filter(function(e){return e.dueMin>c.min;})
    .sort(function(a,b){return a.dueMin-b.dueMin;});
}

// All DUE events (now ≥ due), oldest-due first — for the HAPPENING NOW block. THIS is the
// jump-safe check: threshold (>=), never exact-minute, so anything the clock passed over in one
// big advance (a rest) is caught. Each carries `elapsed` = how long ago it came due, so the GM
// can narrate a slept-past event as already-happened rather than happening-now.
function scheduleDue(){
  var c=clockEnsure();if(!c)return [];
  return c.schedule.filter(function(e){return c.min>=e.dueMin;})
    .sort(function(a,b){return a.dueMin-b.dueMin;})
    .map(function(e){return {label:e.label,dueMin:e.dueMin,elapsed:c.min-e.dueMin};});
}

// ── #129 escalate-then-expire teeth ────────────────────────────────────────────────────────
// Resolution used to depend entirely on the GM emitting [SCHEDULE_RESOLVED:] unprompted — and
// the GM rarely volunteers resolution tags (the #29 futureEvents lesson, relearned in the field:
// "Tide turns against the return route" came due at minute 357 and was still served as
// HAPPENING NOW at minute 6,005, ~1,100 turns of phantom urgency). Deterministic backstop in
// two steps: past SCHEDULE_ESCALATE_MIN overdue, buildScheduleEscalation (api.js) rides the
// engine-note channel demanding the GM narrate the consequence and resolve; past
// SCHEDULE_EXPIRE_MIN, the sweep below retires the entry LOUDLY — warn + toast + a permanent
// record in memory.archive.expiredSchedules, never a silent vanish.
var SCHEDULE_ESCALATE_MIN=3*MIN_PER_HOUR;   // overdue this long → the engine note demands resolution
var SCHEDULE_EXPIRE_MIN=2*MIN_PER_DAY;      // overdue this long → auto-retired (loudly)

// Retire every schedule entry that outlived its escalation window. Returns the retired entries.
// Called from the applyMutsTable tail (beside stampQuestCompletion) so it runs on every real
// turn — including the turn a big TIME_ADVANCE/rest jumps an entry straight past the threshold.
function scheduleSweepExpired(){
  var c=clockEnsure();if(!c||!c.schedule.length)return [];
  var kept=[],out=[],i;
  for(i=0;i<c.schedule.length;i++){
    if(c.min-c.schedule[i].dueMin>SCHEDULE_EXPIRE_MIN)out.push(c.schedule[i]);else kept.push(c.schedule[i]);
  }
  if(!out.length)return out;
  c.schedule=kept;
  for(i=0;i<out.length;i++){
    var ex=out[i];
    if(typeof memory!=="undefined"&&memory){
      if(!memory.archive)memory.archive={};
      if(!memory.archive.expiredSchedules)memory.archive.expiredSchedules=[];
      memory.archive.expiredSchedules.push({label:ex.label,dueMin:ex.dueMin,born:ex.born,expiredAtMin:c.min,turn:(typeof worldState!=="undefined"&&worldState)?worldState.turn:0});
    }
    console.warn("[clock] scheduled event EXPIRED unresolved, "+(c.min-ex.dueMin)+"m overdue: \""+ex.label+"\" — retired to memory.archive.expiredSchedules (the GM never emitted [SCHEDULE_RESOLVED:] through the escalation window)");
    if(typeof showToast==="function")showToast("⏰ Scheduled event expired unresolved: "+ex.label);
  }
  return out;
}

// ── #131 time-phase reconciliation ──────────────────────────────────────────────────────────
// The free-text [TIME:] field and this clock were two independent writers for one fact, and the
// field showed them serving the GM contradictory time context ("dawn" vs "3:15 pm" in the same
// prompt — the B21 screenshot). Ruling (2026-08-03): [TIME:] STAYS the GM's narrative channel,
// and the ENGINE reconciles the clock to it — forward-only (monotonic, the #73 heart), called
// from the applyMutsTable tail so a same-response [TIME_ADVANCE:]/[REST:long] lands first (a
// consistent pair no-ops via the band check; an inconsistent one gets topped up to the declared
// phase). Unmappable free text ("the storm-dark hour") is flavor: stored, never clock-applied.
// Entry order is load-bearing — most specific first ("late night" before "night", "afternoon"
// before "noon", "midmorning" before "morning"). tgt = elapsed-of-day minute (dawn=0 ≡ 6am);
// [b0,b1) = the band within which the phase is ALREADY true (declaration no-ops).
var TIME_PHASES=[
  {re:/late\s*night|small\s+hours|wee\s+hours/i, tgt:1140, b0:1080, b1:1440},
  {re:/midnight/i,                               tgt:1080, b0:1020, b1:1140},
  {re:/mid-?morning/i,                           tgt:180,  b0:120,  b1:330},
  {re:/afternoon/i,                              tgt:480,  b0:420,  b1:690},
  {re:/noon|midday/i,                            tgt:360,  b0:330,  b1:420},
  {re:/dawn|daybreak|sunrise|first\s+light/i,    tgt:0,    b0:0,    b1:90},
  {re:/dusk|sunset|sundown|twilight/i,           tgt:780,  b0:750,  b1:840},
  {re:/evening/i,                                tgt:720,  b0:690,  b1:840},
  {re:/night(fall)?|after\s+dark/i,              tgt:900,  b0:840,  b1:1440},
  {re:/morning/i,                                tgt:120,  b0:60,   b1:360}
];
// Advance the clock forward to the declared phase's next occurrence. Returns minutes added
// (0 = in-band, exact, or unmapped). Routes through clockAdvance so monotonicity holds.
function clockReconcilePhase(label){
  var c=clockEnsure();if(!c||!label)return 0;
  var i,ph=null;
  for(i=0;i<TIME_PHASES.length;i++){if(TIME_PHASES[i].re.test(label)){ph=TIME_PHASES[i];break;}}
  if(!ph)return 0;
  var off=c.min%MIN_PER_DAY;
  if(off>=ph.b0&&off<ph.b1)return 0;
  var delta=(ph.tgt-off+MIN_PER_DAY)%MIN_PER_DAY;
  if(delta===0)return 0;
  /* #142 (the t1524 19-hour jump): a top-up that CROSSES DAWN (ph.tgt<off — the declared phase
     already happened this engine-day) AND exceeds RECONCILE_SKIP_MIN is presumed a mislabel,
     not a timeskip — the legitimate doors into tomorrow ([REST:long], explicit [TIME_ADVANCE:])
     move the clock BEFORE this reconcile runs. Skip-and-DEMAND: keep the [TIME:] text (the GM's
     declared narrative truth), roll nothing, arm the one-shot heal note (buildReconcileSkipNudge)
     so a genuine forgotten-rest morning-after is corrected next turn instead of sticking. Honest
     same-day skips (a day fishing until dusk) and small dawn-approaches (the night-owl 1am→dawn)
     reconcile exactly as before. */
  if(ph.tgt<off&&delta>RECONCILE_SKIP_MIN){
    worldState.reconcileSkip={label:label,delta:delta,turn:worldState.turn||0};
    if(typeof console!=="undefined")console.warn("[clock] reconcile SKIPPED — '"+label+"' is "+Math.round(delta/60)+"h ahead ACROSS dawn (phase already passed today); mislabel presumed. Real skips need [REST:long] or [TIME_ADVANCE:] (#142)");
    return 0;
  }
  return clockAdvance(delta);
}

// ── The shared injection block ──────────────────────────────────────────────────────────────
// ONE pure builder, called by BOTH buildSysPrompt (volatile half) AND Table Talk's ttStateBlock,
// so the game and the help desk can never disagree about the clock or a countdown. Every number
// here is computed from data at call time — the GM (and TT) read it, never remember it.
// Returns "" only if there is genuinely nothing to say (no elapsed time, no schedule) so an
// untouched save stays byte-clean.
function buildClockBlock(){
  var c=clockEnsure();if(!c)return "";
  // B21: past-expiry entries are the sweep's business, not HAPPENING NOW material. A past-expiry
  // entry can only exist at prompt time on the go-live/migration turn (every later crossing is
  // swept in the same response's applyMuts tail) — and serving it there is what fed the GM a
  // days-stale deadline to narrate.
  var due=scheduleDue().filter(function(e){return e.elapsed<=SCHEDULE_EXPIRE_MIN;}), pending=schedulePending();
  if(c.min===0 && !due.length && !pending.length)return "";   // nothing has happened yet
  var s="CAMPAIGN CLOCK: "+clockFmt(c.min)+" (days run dawn to dawn — 00h00m elapsed-of-day is dawn, ~6am).\n";
  if(pending.length){
    s+="UPCOMING (computed from the clock — never invent or restate these numbers):\n";
    var i;for(i=0;i<pending.length;i++)s+="  - "+pending[i].label+" ("+fmtGap(pending[i].dueMin-c.min)+")\n";
  }
  if(due.length){
    s+="HAPPENING NOW (these came due — narrate them; a long-elapsed one already happened, so narrate it as such, not as arriving this instant):\n";
    var j;for(j=0;j<due.length;j++){
      var e=due[j], when=e.elapsed<=0?"": e.elapsed<MIN_PER_HOUR?" ("+e.elapsed+"m ago)": " ("+fmtGap(e.elapsed).replace(/^in /,"")+" ago)";
      s+="  - "+e.label+when+"\n";
    }
  }
  return s+"\n";
}
