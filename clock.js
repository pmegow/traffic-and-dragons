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

var MIN_PER_HOUR=60, MIN_PER_DAY=1440;

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

// DERIVED human view of an elapsed-minutes value — {d, h, m}. Never stored.
function clockParts(min){
  var t=Math.max(0,Math.floor(Number(min)||0));
  return { d:Math.floor(t/MIN_PER_DAY), h:Math.floor((t%MIN_PER_DAY)/MIN_PER_HOUR), m:t%MIN_PER_HOUR };
}

// "Day 4, 14h 30m elapsed" — the elapsed-time label. v1 is elapsed, NOT wall-clock time-of-day
// (that's the calendar fast-follow), so the wording says "elapsed" to avoid implying a tod.
function clockFmt(min){
  var p=clockParts(min==null?clockNow():min);
  var hm=(p.h<10?"0":"")+p.h+"h "+(p.m<10?"0":"")+p.m+"m";
  return "Day "+p.d+", "+hm+" elapsed";
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

// ── The shared injection block ──────────────────────────────────────────────────────────────
// ONE pure builder, called by BOTH buildSysPrompt (volatile half) AND Table Talk's ttStateBlock,
// so the game and the help desk can never disagree about the clock or a countdown. Every number
// here is computed from data at call time — the GM (and TT) read it, never remember it.
// Returns "" only if there is genuinely nothing to say (no elapsed time, no schedule) so an
// untouched save stays byte-clean.
function buildClockBlock(){
  var c=clockEnsure();if(!c)return "";
  var due=scheduleDue(), pending=schedulePending();
  if(c.min===0 && !due.length && !pending.length)return "";   // nothing has happened yet
  var s="CAMPAIGN CLOCK: "+clockFmt(c.min)+".\n";
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
