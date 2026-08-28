// ── clock.js — the CAMPAIGN CLOCK (TODO #73) ─────────────────────────────────────────────
//
// The engine had no concept of a DAY, so every in-fiction deadline was a hallucination: asked
// "how many days to the solstice" the GM answered 11, then 8, then 94, and emitted invented
// [CALENDAR:]/[DAYS_TO_SOLSTICE:] tags for a system that did not exist. Root cause: the GM was
// asked to REMEMBER and re-state a number. This subsystem removes that request — the engine
// stores one anchor, and every countdown is RECOMPUTED from it. A number the GM never re-states
// cannot drift.
//
// DESIGN (full spec: DOC/Research/DOC_clock.html):
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
// The clock measures ELAPSED campaign time. The dawn-anchored wall-clock projection is derived
// here too; named calendar dates remain a future layer. world.time survives as compatibility
// flavor and [TIME:] input, but all current-time rendering comes from the clock scalar.
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

/* ── #274 (Fable f63, joint review 2026-08-27) — a poisoned scalar must not cost the timeline ──
   clockEnsure below and migrateWorldState (state.js) both replaced the WHOLE clock object the
   moment clock.min stopped being a usable number: timeline position, EVERY scheduled deadline,
   and the #146 repair receipts, with no warning and no archive. Losing the receipts is the
   sharper half — it disarms the double-fire protection itself, so a repeated repair id would
   re-apply on any device after the reset, which is the exact class #146 exists to stop.
   Entry vectors are a bad console clockRepair delta (`c.min+='19h'` CONCATENATES to the string
   "882019h" — the typeof limb) and a mangled blob carrying a numeric NaN (the isNaN limb).
   Same shape as the JP0-4 store rescue (state.js rescueCorruptStore): preserve the unreadable
   original under a bounded per-campaign key, shout on BOTH channels, THEN rebuild. ONE slot per
   campaign, and a newer corruption OVERWRITES — a clock is replaced wholesale, so the newest
   corrupt object is the most complete picture of what was lost (the opposite of UA3's transcript
   rescue, where survivors are prepended and the OLDEST blob holds the longest record).
   Only the SCALAR was poisoned, so schedule[] and repairs[] are CARRIED whenever they are still
   arrays — losing every deadline because min became a string IS the defect. Junk halves rebuild
   empty and the message says which. This never heals the scalar (the #146 rule: the anchors are
   adjudication evidence; the one sanctioned correction is an idempotent clockRepair), and nothing
   in the app deletes a rescue key. */
function clockRescueCorrupt(bad){
  var isArr=function(x){return Object.prototype.toString.call(x)==="[object Array]";};
  var keepSched=(bad&&isArr(bad.schedule))?bad.schedule:null;
  var keepRep=(bad&&isArr(bad.repairs))?bad.repairs:null;
  var raw=null;
  /* JSON turns NaN/Infinity into null and NaN is one of the two poisons this exists for, so a
     non-finite number is snapshotted as its own text: the preserved bytes must show WHAT the
     scalar was, never a lossy null. */
  try{raw=JSON.stringify(bad,function(k,v){return (typeof v==="number"&&!isFinite(v))?("__nonfinite:"+String(v)):v;});}catch(e){raw=null;}
  if(raw==null){try{raw=String(bad);}catch(e2){raw=null;}}
  var rk=CLOCK_RESCUE_K+((typeof getActiveCampId==="function"&&getActiveCampId())||"default"),kept=false;
  if(typeof store!=="undefined"&&store&&typeof raw==="string"&&raw.length){
    try{store.set(rk,raw);kept=store.get(rk)===raw;}catch(e3){kept=false;}
  }
  var gone=[];
  if(!keepSched)gone.push("scheduled deadlines");
  if(!keepRep)gone.push("#146 repair receipts");
  var lost=gone.join(" and ");
  if(typeof console!=="undefined")console.error("[clock] the campaign clock could not be read — clock.min was \""+String(bad&&bad.min)+"\" ("+(typeof (bad&&bad.min))+"); "+(kept?("the unreadable clock is preserved under "+rk):"the unreadable clock could NOT be preserved")+". The timeline is reset to Day 1"+(lost?(" and the "+lost+" were unreadable too and are LOST"):", but every deadline and repair receipt was intact and is CARRIED FORWARD")+" (#274)");
  if(typeof showToast==="function")showToast("⚠ Your campaign clock could not be read — the date was reset to Day 1"+(lost?(", and your "+lost.replace("#146 repair receipts","repair history")+" were lost."):", but your deadlines were kept.")+(kept?" A backup of the unreadable clock was kept.":" It could NOT be backed up."),9000);
  var out={min:0,schedule:keepSched||[]};
  if(keepRep)out.repairs=keepRep;
  return out;
}
// Lazily ensure the clock exists (migrateWorldState also adds it; this guards direct callers and
// any pre-migration path). Never throws, never mutates time.
// #274: ABSENT is not CORRUPT — a legacy/new save with no clock still mints one silently; only a
// clock that is PRESENT and unreadable goes through the rescue.
function clockEnsure(){
  if(typeof worldState==="undefined"||!worldState)return null;
  var c=worldState.clock;
  if(!c)worldState.clock={min:0,schedule:[]};
  else if(typeof c.min!=="number"||isNaN(c.min))worldState.clock=clockRescueCorrupt(c);
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

// W4: only a deliberately narrow duration grammar may cross from the fuzzy future-event store
// into the deterministic scheduler. Natural-language dates ("after the feast", "at dusk") stay
// pending for GM judgment; exact scalar intervals get one clock authority immediately.
var FUTURE_NUMBER_WORDS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
function parseStrictFutureDuration(str){
  var s=String(str==null?"":str).toLowerCase().trim();
  s=s.replace(/^(?:in|within|after)\s+/,"");
  var m=s.match(/^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
  if(!m)return 0;
  var n=/^\d+$/.test(m[1])?parseInt(m[1],10):FUTURE_NUMBER_WORDS[m[1]];
  if(!n||n<1)return 0;
  var u=m[2].charAt(0);return u==="w"?n*7*MIN_PER_DAY:u==="d"?n*MIN_PER_DAY:u==="h"?n*MIN_PER_HOUR:n;
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

// W5: the clock scalar is authoritative wherever time is rendered. world.time survives only as
// compatibility/flavor input for [TIME:] reconciliation and old saves; it is never displayed
// beside the clock as a second current truth.
function worldTimeDisplay(min){
  if(typeof worldState!=="undefined"&&worldState&&worldState.clock&&typeof worldState.clock.min==="number")return clockStamp(min);
  return (typeof worldState!=="undefined"&&worldState&&worldState.world&&worldState.world.time)||"not set";
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
// #235 (JP0-10, joint review): the SCHEDULE-authority comparator. feNearDup's floor (2 shared
// stemmed tokens covering half the smaller fingerprint) is right for fuzzy futureEvents but too
// loose for a store whose countdowns are served as authoritative canon every turn — "meet the
// innkeeper at dawn" / "meet the ferryman at dawn" share exactly {meet, dawn} and were silently
// merged: one countdown corrupted, the other errand untrackable while the kept entry lived.
// A schedule fold demands shared>=3 significant tokens, OR shared==2 where one label's tokens
// are a strict SUBSET of the other's (a plain restatement). The #217 Wyla bracelet field
// fixtures share 4-5 tokens and keep folding — pinned by both test families.
function scheduleNearDup(a,b){
  if(typeof feNearDup!=="function"||typeof feTokens!=="function")return false;
  if(!feNearDup(a,b))return false;
  var at=feTokens(a),bt=feTokens(b),shared=0,aEx=0,bEx=0,i;
  for(i=0;i<at.length;i++){if(bt.indexOf(at[i])>=0)shared++;else aEx++;}
  for(i=0;i<bt.length;i++){if(at.indexOf(bt[i])<0)bEx++;}
  return shared>=3||(shared>=2&&(aEx===0||bEx===0));
}
function scheduleAdd(label,whenStr){
  scheduleAdd._lastFold=null;/* #235: per-call fold hint for the SCHEDULE handler's honest muts line */
  var c=clockEnsure();if(!c)return null;
  var lbl=String(label==null?"":label).trim();if(!lbl)return null;
  var mins=parseDuration(whenStr);if(mins<1)mins=1;            // "in <1 min" is meaningless; floor at 1
  var due=c.min+mins;
  var i,key=lbl.toLowerCase();
  for(i=0;i<c.schedule.length;i++){
    if(String(c.schedule[i].label||"").toLowerCase()===key){c.schedule[i].dueMin=due;return c.schedule[i];}
  }
  /* #217 (the triple-booked bracelet deadline, live t2097): the GM re-states one errand in fresh
     words and exact-match let every phrasing through — three deadlines for one collection, all
     injected into UPCOMING, and the contradiction reached the fiction. fileFutureEvent got this
     tooth as #29①; this is the SAME fingerprint (feNearDup — #150 extracted it so schedule code
     shares thresholds, not a rival heuristic). Fold = the exact-match semantics: keep the
     original label (stable identity), adopt the NEWEST deadline (the GM's latest statement of
     the deal is the freshest information — last-write-wins, exactly what an exact match does). */
  if(typeof feNearDup==="function"){
    for(i=0;i<c.schedule.length;i++){
      if(scheduleNearDup(lbl,c.schedule[i].label)){/* #235: schedule-authority comparator, not the raw futureEvents fingerprint */
        c.schedule[i].dueMin=due;
        scheduleAdd._lastFold={from:lbl,into:c.schedule[i].label};
        if(typeof console!=="undefined")console.info("[clock] #217: \""+lbl.slice(0,60)+"\" near-duplicates scheduled \""+String(c.schedule[i].label).slice(0,60)+"\" — deadline refreshed, no twin filed");
        return c.schedule[i];
      }
    }
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
  scheduleRemove._lastRemoved=[];/* #270 (f66): per-call casualty list — the substring matching is owner-accepted and PINNED; only the HONESTY of the count changes (the muts line used to admit one retirement while several landed) */
  var c=clockEnsure();if(!c)return 0;
  var key=String(label==null?"":label).toLowerCase().trim();if(!key)return 0;
  var before=c.schedule.length;
  c.schedule=c.schedule.filter(function(e){var hit=String(e.label||"").toLowerCase().indexOf(key)>=0;if(hit)scheduleRemove._lastRemoved.push(String(e.label||""));return !hit;});
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
  /* #270 (Fable f64): a narrow post-band GRACE before the demand. "Noon" declared 31 minutes
     after the noon band closed is narrative slop, not a mislabel — and the demand note's first
     taught fix is [REST:long], inviting a compliant GM to turn half an hour of slop into a jump
     to next dawn. Within the grace: keep the text as color, roll nothing, demand nothing, one
     console line. The pinned #142 skip case sits 130m past band close — far outside it. */
  if(ph.tgt<off&&(off-ph.b1)>=0&&(off-ph.b1)<RECONCILE_GRACE_MIN){
    if(typeof console!=="undefined")console.info("[clock] '"+label+"' ended "+(off-ph.b1)+"m ago — within the "+RECONCILE_GRACE_MIN+"m post-band grace; kept as narrative color, no roll, no demand (#270)");
    return 0;
  }
  if(ph.tgt<off&&delta>RECONCILE_SKIP_MIN){
    worldState.reconcileSkip={label:label,delta:delta,turn:worldState.turn||0};
    if(typeof console!=="undefined")console.warn("[clock] reconcile SKIPPED — '"+label+"' is "+Math.round(delta/60)+"h ahead ACROSS dawn (phase already passed today); mislabel presumed. Real skips need [REST:long] or [TIME_ADVANCE:] (#142)");
    return 0;
  }
  return clockAdvance(delta);
}

// ── #217: the load sweep for schedules that pre-date the write-time fold ────────────────
// Collapses near-duplicate entries an EXISTING save already carries (the live t2097 triple).
// Sort by born DESC, greedily keep the first of each fingerprint group, fold older twins into
// their kept sibling — freshest-born wins by construction (the latest statement of the deal;
// on the live save that is the three-day entry the fiction at t2087 was actually arguing about).
// The #146 never-auto-heal rule guards the SCALAR and its anchors; this removes redundant ROWS
// with complete pre-images archived to clock.repairs — reversible by construction. Never
// touches c.min. Idempotent: a clean schedule is a no-op and mints no repair record.
function scheduleDedupSweep(){
  var c=(typeof worldState!=="undefined"&&worldState&&worldState.clock)||null;
  if(!c||!c.schedule||c.schedule.length<2||typeof feNearDup!=="function")return 0;
  var sorted=c.schedule.slice().sort(function(a,b){return (b.born||0)-(a.born||0);});
  var kept=[],removed=[],i,j;
  for(i=0;i<sorted.length;i++){
    var hit=false;
    for(j=0;j<kept.length;j++){
      if(scheduleNearDup(sorted[i].label,kept[j].label)){removed.push({id:sorted[i].id,label:sorted[i].label,dueMin:sorted[i].dueMin,born:sorted[i].born,foldedInto:kept[j].id});hit=true;break;}/* #235: same schedule-authority comparator as the write path */
    }
    if(!hit)kept.push(sorted[i]);
  }
  if(!removed.length)return 0;
  // Preserve the surviving entries' ORIGINAL relative order (kept was built newest-first).
  c.schedule=c.schedule.filter(function(e){var k;for(k=0;k<removed.length;k++)if(removed[k].id===e.id)return false;return true;});
  if(!c.repairs)c.repairs=[];
  c.repairs.push({id:"217-schedule-dedupe",removed:removed,t:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||0});
  if(typeof console!=="undefined")console.warn("[clock] #217: collapsed "+removed.length+" near-duplicate schedule entr"+(removed.length===1?"y":"ies")+" into "+(kept.length)+" (pre-images in clock.repairs): "+removed.map(function(r){return "\""+String(r.label).slice(0,50)+"\"";}).join(", "));
  return removed.length;
}

// ── #216: [TIME_CHECK:] — the read-before-write declaration ─────────────────────────────
// Field origin (t2175, 2026-08-22): sonnet-5 narrated sundown and camped the party in full dark
// while the clock read 11:57 AM. #158's recognizer — precision-tuned on the 328-turn audit — was
// blind to nightfall rendered as pure imagery, and widening its grammar would trade the false
// alarms that audit exists to prevent. The fix is upstream of recognition entirely: the GM opens
// every response by DECLARING the phase as a structured tag (the #141 forced-checking-space
// shape — committing to a phase before writing prose anchors the prose), and the engine's
// detection becomes a deterministic band comparison. READ-ONLY BY CONSTRUCTION: this never moves
// the clock — [TIME:] reconciles and [TIME_ADVANCE:] charges; a declaration that could advance
// time would let the GM teleport the clock by assertion, the exact back door #73 closed.
function clockPhaseIndex(label){
  if(!label)return -1;
  var i;for(i=0;i<TIME_PHASES.length;i++)if(TIME_PHASES[i].re.test(label))return i;
  return -1;
}
// The [TIME_CHECK:] core — compare the declared phase against the CURRENT clock (the handler's
// table position, before TIME_ADVANCE/REST, makes "current" mean the pre-advance clock the GM
// actually read in its prompt). Off-band ≥ PHASE_MISMATCH_MIN arms the same one-shot GM-decides
// record #158 uses — one latch, one nudge, one vocabulary; a structured declaration is simply a
// higher-confidence assertion than any prose scan. Unmappable text warns loudly and arms nothing.
function clockCheckDeclared(label){
  if(typeof worldState==="undefined"||!worldState)return null;
  var idx=clockPhaseIndex(label);
  if(idx<0){
    if(typeof console!=="undefined")console.warn("[clock] #216: [TIME_CHECK:"+label+"] names no known phase — declaration ignored (labels: dawn, morning, midmorning, midday, afternoon, dusk, evening, night, midnight, late night)");
    return null;
  }
  var d=clockPhaseBandDist(idx);
  if(d<PHASE_MISMATCH_MIN)return null;
  worldState.phaseMismatch={idx:idx,label:String(label).toLowerCase().replace(/\s+/g," "),turn:(worldState.turn||0),stamp:(typeof clockStamp==="function"?clockStamp():"")};
  if(typeof console!=="undefined")console.warn("[clock] #216: GM declared '"+label+"' but the clock reads "+worldState.phaseMismatch.stamp+" ("+Math.round(d/60)+"h off-band) — GM-decides reconcile nudge armed");
  return worldState.phaseMismatch;
}

// ── #158: the phase-mismatch detector (Sol-amended spec, adjudicated 2026-08-09) ────────────
// The t1605 class: prose narrated a full march day into dusk while the clock read 11:10 am —
// the phase existed only in narration, and nothing could notice. This is the deterministic
// sibling of the #142 reconcile guard, on the OTHER direction: narration ahead of (or simply
// disagreeing with) the clock. It recognizes a HIGH-CONFIDENCE current-phase assertion in
// committed CLEAN prose, compares it against the post-applyMuts clock by BAND distance, and
// arms a one-shot GM-decides nudge. It NEVER moves the clock — a flashback may name any phase
// it likes, and only the GM knows which mentions are the story's now.
//
// Recognition contract (precision over recall — a noisy detector teaches everyone to ignore
// it): prose forms are \b-ANCHORED DERIVATIONS of TIME_PHASES (one vocabulary, two compiled
// shapes — the label regexes are unanchored and would match "Morningstar"/"knight"); quoted
// dialogue is stripped ("we move at dusk" is a plan, not narration); sentences carrying
// future/modal, historical, figurative, negated, vision/memory, or interrogative markers are
// rejected WHOLE (deliberately over-conservative); overlapping matches resolve by the registry's
// specificity order ("late night" is late-night, never bare night); and the LAST qualifying cue
// wins — narrative recency, because a scene ends where its final time-word leaves it.
var TIME_PHASES_PROSE=(function(){
  var out=[],i;
  for(i=0;i<TIME_PHASES.length;i++)out.push(new RegExp("\\b(?:"+TIME_PHASES[i].re.source+")\\b","gi"));
  return out;
})();
var _PHASE_REJECT_RE=/(?:\bwill\b|'ll\b|\bshall\b|\bwould\b|\bcould\b|\bshould\b|\bgoing to\b|\bplan(?:s|ned|ning)?\b|\bintend\w*\b|\bhope\w*\b|\bexpect\w*\b|\bmeant to\b|\btomorrow\b|\bnext\b|\bby the time\b|\bback by\b|\bif\b|\bunless\b|\bwhen\b|\bonce\b|\buntil\b|\btill\b|\bsince\b|\bearlier\b|\byesterday\b|\blast night\b|\bago\b|\bthat (?:morning|evening|night|afternoon|dawn|dusk)\b|\bnot\b|\bnever\b|\bno longer\b|\bhardly\b|\bbarely\b|\blike\b|\bas if\b|\bas though\b|\bcolou?r of\b|\bshade of\b|\bdream\w*\b|\bvision\w*\b|\bmemor(?:y|ies)\b|\bremember\w*\b|\brecall\w*\b|\bimagin\w*\b|\bflashback\w*\b|\bsay(?:s|ing)?\b|\bsaid\b|\bask(?:s|ed|ing)?\b|\brepl(?:y|ies|ied)\b|\bmutter\w*\b|\bwhisper\w*\b|\bmurmur\w*\b|\banswer\w*\b|\b(?:dawn|morning|noon|midday|afternoon|dusk|evening|night|midnight)\s+of\s+(?:my|your|his|her|its|our|their)\b)/i;/* #158 corpus hardenings: "back by <phase>" is a return plan (t1413); a speech verb in the sentence means the phase was SPOKEN, not narrated (t1412) */
function clockPhaseAssertion(text){
  var s=String(text||"");
  if(!s)return null;
  /* #158 (the t1412 corpus alarm): an ODD straight-quote count (or mismatched curly pairs)
     means quote roles are unknowable from some point on — a stray opener can turn everything
     after it into unmarked dialogue ('"Rest. She said nothing more. Dawn comes cold…' may all
     be one spoken block whose closer was lost). Broken parity distrusts the WHOLE entry. Costs
     ~1% of corpus turns (2/328 measured); a persisting mismatch re-detects next turn anyway. */
  var _sq=(s.match(/"/g)||[]).length;
  if(_sq%2)return null;
  if((s.match(/“/g)||[]).length!==(s.match(/”/g)||[]).length)return null;
  /* Keep terminal closing quotes on the sentence they close. The old splitter ended at the
     punctuation and made the quote the first character of the NEXT narration sentence; the
     any-quote precision guard then rejected that innocent sentence (the exact t1605 miss). */
  var best=null,re=/[^.!?]+(?:[.!?]+["”]*|$)/g,m;
  while((m=re.exec(s))){
    var sent=m[0],off=m.index;
    if(/\?\s*$/.test(sent))continue;
    /* #158: ANY quote character makes the sentence speech territory — spoken plans ("We move
       at dusk"), attribution fragments, scare quotes, and every mispair shape all reject on
       this one rule. Deliberately simpler than span-stripping (the first build stripped
       balanced pairs and patched the mispair leaks one by one — sabotage showed the guards had
       collapsed into exactly this rule). Narration sentences that assert a phase carry no
       quotes; the corpus audit confirms zero precision cost. */
    if(/["“”]/.test(sent))continue;
    if(_PHASE_REJECT_RE.test(sent))continue;
    var claimed=[],i,pm,j;
    for(i=0;i<TIME_PHASES_PROSE.length;i++){
      TIME_PHASES_PROSE[i].lastIndex=0;
      while((pm=TIME_PHASES_PROSE[i].exec(sent))){
        var st=pm.index,en=pm.index+pm[0].length,ov=false;
        if(/\b(?:this|that)\s+$/i.test(sent.slice(Math.max(0,st-8),st)))continue;/* #158 (t1586): "this afternoon"/"that morning" is a REFERENCE to a period, not a scene-time assertion */
        /* Reject only a cue syntactically governed by "before" ("escape before dawn"). Bare
           `before` cannot reject the whole sentence: "Dawn breaks before you" asserts dawn.
           #158b (field t1806, v1.619): the governed run tolerates a short modifier phrase —
           "before the first grey hint of dawn" armed a false dawn mismatch at 1:00 AM because
           the old pattern allowed only an optional "the". Clause punctuation still severs
           government ("an hour before, at dawn," keeps its assertion). */
        if(/\bbefore\b[^.!?;,]{0,32}$/i.test(sent.slice(Math.max(0,st-40),st)))continue;
        /* #195④ (field 2026-08-17, 1:17pm): "the permanent twilight of the Underbridge" is a
           PLACE's standing darkness, not a scene-time assertion — it armed the reconcile nudge
           mid-afternoon. Two reject contexts: a standing-condition adjective immediately before
           the cue (permanent twilight, eternal night), and attribute-of-place government after
           it — the CAPITAL letter is the discriminator ("twilight of the Underbridge" rejects;
           "the dusk of the second day" keeps its assertion). */
        if(/\b(?:permanent(?:ly)?|perpetual|eternal|endless|everlasting|unending|constant)\s+$/i.test(sent.slice(Math.max(0,st-16),st)))continue;
        if(/^\s+of\s+(?:the\s+)?[A-Z]/.test(sent.slice(en,en+24)))continue;
        for(j=0;j<claimed.length;j++){if(st<claimed[j].en&&en>claimed[j].st){ov=true;break;}}
        if(!ov)claimed.push({st:st,en:en,idx:i,label:pm[0]});
      }
    }
    for(i=0;i<claimed.length;i++){
      var g=off+claimed[i].st;
      if(!best||g>best.at)best={at:g,idx:claimed[i].idx,label:claimed[i].label};
    }
  }
  return best?{idx:best.idx,label:best.label,at:best.at}:null;
}
// Distance from the current clock to the asserted phase's [b0,b1) BAND (not its target minute):
// in-band = 0 (agreement self-silences, whatever tags did or did not fire — a [TIME:morning]
// under dusk narration is a CONTRADICTION and still measures far). Circular, min of the two
// directions, so "evening" narrated at 17:40 is 0 and dusk at 17:40 is 50m of slop, not 23h.
function clockPhaseBandDist(idx){
  var c=clockEnsure();if(!c)return 0;
  var ph=TIME_PHASES[idx];if(!ph)return 0;
  var off=c.min%MIN_PER_DAY;
  if(off>=ph.b0&&off<ph.b1)return 0;
  var fwd=(ph.b0-off+MIN_PER_DAY)%MIN_PER_DAY;
  /* #270 (Fable f62): the BACKWARD leg never wraps the dawn seam. Days run dawn-to-dawn (#89 —
     offset 0 IS dawn), so a phase reachable backward only by crossing offset 0 is YESTERDAY'S
     phase — that is the mismatch class itself, not adjacency. The old circular min tolerated
     "night" from 6:00–9:58am (night's band ends at the seam), the exact t2175 blind window two
     hours earlier. The FORWARD wrap stays legal: "dawn" declared minutes before dawn is the
     night-owl anticipation #142 explicitly protects. */
  var back=(off>=ph.b1)?(off-(ph.b1-1)):MIN_PER_DAY;
  return Math.min(fwd,back);
}
// The commit-seam entry point — called by commitGmTurn (after applyMuts, so the parser tail has
// already reconciled any [TIME:]) and by rerollLast (whose replacement prose applies NO tags at
// all, so a nudge is the only possible heal there). CLEAN text only — raw text would match the
// tags' own words. Arms worldState.phaseMismatch (a NOTE_LATCH_FIELDS one-shot).
function clockPhaseDetect(cleanText){
  if(typeof worldState==="undefined"||!worldState)return null;
  var a=clockPhaseAssertion(cleanText);
  if(!a)return null;
  var d=clockPhaseBandDist(a.idx);
  if(d<PHASE_MISMATCH_MIN)return null;
  worldState.phaseMismatch={idx:a.idx,label:String(a.label).toLowerCase().replace(/\s+/g," "),turn:(worldState.turn||0),stamp:(typeof clockStamp==="function"?clockStamp():"")};
  if(typeof console!=="undefined")console.warn("[clock] #158: narration asserts '"+a.label+"' but the clock reads "+worldState.phaseMismatch.stamp+" ("+Math.round(d/60)+"h off-band) — GM-decides reconcile nudge armed");
  return worldState.phaseMismatch;
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
