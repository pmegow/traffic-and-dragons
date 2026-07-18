// error-report.js — TODO #16: mobile error reporting. One job: get runtime errors OFF the
// invisible mobile console and into pmegow@gmail.com's inbox, via a webhook the client POSTs to.
//
// Transport: Google Apps Script web app (TODO #16 Option A — free, no new accounts). The GAS
// side is ~10 lines (doPost → MailApp.sendEmail); deploy it as "Web app, execute as me, anyone
// has access" and paste the /exec URL into ERROR_WEBHOOK_URL below. An EMPTY URL disables
// reporting entirely (one console.info at first attempt — deliberate, not a silent failure:
// nothing is wrong, the feature just isn't configured on this checkout).
//
// The POST is a "simple request" (no custom headers, text/plain body) so there is NO CORS
// preflight — GAS web apps can't answer OPTIONS. GAS replies through a 302 to
// script.googleusercontent.com which fetch follows; the final response carries CORS headers on
// anonymous deployments, so r.ok is readable and delivery is verifiable (no-silent-failures).
//
// Wired callers (all typeof-guarded so a missing file can never throw):
//   window.onerror / onunhandledrejection  — here, at load time (browser only)
//   sendAction turn catch + re-roll catch  — game.js
//   skeleton catch                         — game.js beginAdventure path
//   action-suggestion catch                — game.js generateActions
//   summarize catch                        — memory.js
//   Piper narration-death crumb            — tts.js loadSettings boot forensics
//
// Flood control: 1 email per ER_DEBOUNCE_MS (30s) — suppressed errors are COUNTED and the count
// rides the next email, so a cascade reads as "first error + N more" instead of an inbox flood.
// ER_SESSION_CAP (10) hard-stops a boot-loop from mailing forever; the cap trip is console.warned
// once. ES5 throughout (var, no arrows) per project convention.

var ERROR_WEBHOOK_URL = ""; // ← paste the GAS /exec URL here (empty = reporting disabled)

var ER_DEBOUNCE_MS  = 30000;
var ER_SESSION_CAP  = 10;
var ER_DETAIL_MAX   = 4000;

var _erLastSentAt   = 0;     // Date.now() of the last accepted send
var _erSuppressed   = 0;     // errors swallowed by the debounce window since that send
var _erSentCount    = 0;     // accepted sends this page load (vs ER_SESSION_CAP)
var _erDisabledNote = false; // "reporting not configured" logged once
var _erCapNote      = false; // "session cap hit" logged once
var _erInReporter   = false; // reentrancy latch — a bug in HERE must not recurse via window.onerror

// Transport seam — engine tests stub this; the browser build fetches. Returns nothing; delivery
// success/failure is console-logged (the ONLY place that can see it — this IS the error channel,
// so it gets console + nothing else: no toasts, no recursion into reportError).
function _erSend(payload){
  try{
    fetch(ERROR_WEBHOOK_URL,{method:"POST",body:JSON.stringify(payload)})
      .then(function(r){
        if(r.ok)console.info("[error-report] sent ("+payload.ctx+")");
        else console.warn("[error-report] webhook answered "+r.status+" — report may not have been delivered");
      })
      .catch(function(e){console.warn("[error-report] send failed:",e&&e.message);});
  }catch(e){console.warn("[error-report] send failed:",e&&e.message);}
}

// reportError(context, message, detail) — the single public entry point. Returns a string naming
// the outcome ("sent"/"disabled"/"debounced"/"capped"/"reentered") — callers ignore it; tests read it.
function reportError(ctx,msg,detail){
  if(_erInReporter)return "reentered";
  _erInReporter=true;
  var out="sent";
  try{
    if(!ERROR_WEBHOOK_URL){
      if(!_erDisabledNote){_erDisabledNote=true;console.info("[error-report] no webhook URL configured — error reporting off (TODO #16: paste the GAS /exec URL into ERROR_WEBHOOK_URL in error-report.js)");}
      out="disabled";
    }else if(_erSentCount>=ER_SESSION_CAP){
      if(!_erCapNote){_erCapNote=true;console.warn("[error-report] session cap ("+ER_SESSION_CAP+") reached — no further reports this page load");}
      out="capped";
    }else if(Date.now()-_erLastSentAt<ER_DEBOUNCE_MS){
      _erSuppressed++;
      out="debounced";
    }else{
      var payload={
        ctx:String(ctx||"unknown"),
        msg:String(msg||"(no message)").slice(0,500),
        detail:String(detail||"").slice(0,ER_DETAIL_MAX),
        app:(typeof APP_VERSION!=="undefined"?APP_VERSION:"?"),
        url:(typeof location!=="undefined"?location.href:"(node)"),
        ua:(typeof navigator!=="undefined"?navigator.userAgent:"(node)"),
        online:(typeof navigator!=="undefined"&&"onLine" in navigator?navigator.onLine:null),
        camp:(typeof worldState!=="undefined"&&worldState&&worldState.campName)||null,
        turn:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||null,
        suppressed:_erSuppressed,
        ts:new Date().toISOString()
      };
      _erSuppressed=0;
      _erLastSentAt=Date.now();
      _erSentCount++;
      _erSend(payload);
    }
  }catch(e){
    try{console.warn("[error-report] reporter itself failed:",e&&e.message);}catch(e2){}
    out="reporter-error";
  }
  _erInReporter=false;
  return out;
}

// ── Global hooks (browser only — the node test runner loads this file with no window) ─────────
if(typeof window!=="undefined"){
  window.onerror=function(msg,src,line,col,err){
    reportError("window.onerror",msg,(src||"")+":"+(line||0)+":"+(col||0)+"\n"+((err&&err.stack)||""));
    return false; // never swallow — the browser's default console logging still runs
  };
  window.onunhandledrejection=function(ev){
    var r=ev&&ev.reason;
    reportError("unhandledrejection",(r&&r.message)||String(r),(r&&r.stack)||"");
  };
}
