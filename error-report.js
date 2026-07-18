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

var ERROR_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzivwUvDUoEX6tFDnFy16DAj9gwehAkIaLv1XDSYcL-JChkeBEdt84eCvJJeuZv2lNvjQ/exec"; // GAS web app (deployed 2026-07-18) → emails pmegow@gmail.com; empty = reporting disabled

var ER_DEBOUNCE_MS  = 30000;
var ER_SESSION_CAP  = 10;
var ER_DETAIL_MAX   = 4000;

var _erLastSentAt   = 0;     // Date.now() of the last accepted send
var _erSuppressed   = 0;     // errors swallowed by the debounce window since that send
var _erSentCount    = 0;     // accepted sends this page load (vs ER_SESSION_CAP)
var _erDisabledNote = false; // "reporting not configured" logged once
var _erCapNote      = false; // "session cap hit" logged once
var _erInReporter   = false; // reentrancy latch — a bug in HERE must not recurse via window.onerror

// Shared POST core — both report species (crash + user report) go through here.
// cb(ok, errMsg, body) always fires exactly once; never throws. body = the webhook's parsed JSON
// response (or null) — GAS reports PER-HALF failures in it ({sheet, email, screenshot}: null=ok,
// string=error). Discarding it is how the Drive-permission screenshot failure stayed invisible
// for the pipeline's whole first month (v1.365 lesson) — callers must surface non-null halves.
function _erPost(payload,cb){
  try{
    fetch(ERROR_WEBHOOK_URL,{method:"POST",body:JSON.stringify(payload)})
      .then(function(r){
        return r.text().then(function(t){
          var body=null;try{body=JSON.parse(t);}catch(e2){}
          cb(!!r.ok,r.ok?null:("webhook answered "+r.status),body);
        });
      })
      .catch(function(e){cb(false,(e&&e.message)||"send failed");});
  }catch(e){cb(false,(e&&e.message)||"send failed");}
}

// Crash-path transport seam — engine tests stub this. Delivery success/failure is console-logged
// (the ONLY place that can see it — this IS the error channel, so it gets console + nothing else:
// no toasts, no recursion into reportError).
function _erSend(payload){
  _erPost(payload,function(ok,err,body){
    if(ok)console.info("[error-report] sent ("+payload.ctx+")");
    else console.warn("[error-report] "+(err||"send failed")+" — report may not have been delivered");
    if(ok&&body&&(body.sheet||body.email))
      console.warn("[error-report] webhook stored the report PARTIALLY — sheet: "+(body.sheet||"ok")+"; email: "+(body.email||"ok"));
  });
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
        kind:"crash",
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

// ── User bug reports (#16b) — "not all bugs are crashes" ──────────────────────────────────────
// The player-initiated species: nonsense action suggestions, hallucinations, drift, broken
// screens. Same webhook, kind:"user-report", NO crash debounce (the user pressed the button; they
// meant it) — just an in-flight latch. The UI half (screenshot capture + modal) lives in
// ui-modals.js showBugReportModal(); this half is the DOM-free payload assembly + transport.

// Hint table — ONE place mapping "what the user's message sounds like" → "which extra state to
// attach" (abstraction over scattered conditionals). Each gather() is individually try/caught: a
// failed gather reports its own failure INSIDE the report instead of killing it. Rules:
// NOTHING sensitive — no API keys, no tokens, no portrait image data. The sync hint sends a
// connected BOOLEAN, never the token.
var ER_REPORT_HINTS=[
  {id:"quests",re:/quest|objective|journal|task/i,gather:function(w){
    if(!w||!w.questLog||!w.questLog.length)return "quest log: empty";
    var ls=[],i,j;for(i=0;i<w.questLog.length;i++){var q=w.questLog[i];var os="";
      if(q.objectives&&q.objectives.length){var ob=[];for(j=0;j<q.objectives.length;j++)ob.push((q.objectives[j].done?"[x] ":"[ ] ")+q.objectives[j].text);os=" — "+ob.join("; ");}
      ls.push(q.title+" ("+q.status+")"+os);}
    return "quest log:\n"+ls.join("\n");}},
  {id:"render",re:/render|scene|image|picture|portrait|illustrat/i,gather:function(w){
    var m=(typeof renderModel!=="undefined")?renderModel:"?";
    var hasP=!!(w&&w.character&&w.character.portrait);
    var s="render model: "+m+"; portrait on file: "+hasP;
    try{if(typeof img2imgStrength==="function"&&typeof RENDER_MODELS!=="undefined"){var i;for(i=0;i<RENDER_MODELS.length;i++){if(RENDER_MODELS[i].id===m&&RENDER_MODELS[i].img2img){s+="; img2img strength: "+img2imgStrength(RENDER_MODELS[i].img2img);break;}}}}catch(e){}
    return s;}},
  {id:"provider",re:/model|llm|provider|claude|sonnet|opus|haiku|gpt|gemini|grok|ollama/i,gather:function(){
    var p=(typeof activeProvider!=="undefined")?activeProvider:"?";
    var m="default";
    try{if(typeof providerModels!=="undefined"&&providerModels[p])m=providerModels[p];}catch(e){}
    return "LLM provider: "+p+"; model override: "+m;}},
  {id:"tts",re:/voice|speech|speak|narrat|tts|piper|audio|sound|mute|silen/i,gather:function(){
    var s="tts: ?";
    try{if(typeof store!=="undefined")s="tts engine: "+(store.get("tnd_tts_engine_v1")||"(legacy-inferred)")+"; on: "+(store.get("tnd_tts_on_v1")==="1")+"; piper voice: "+(store.get("tnd_piper_voice_v1")||"(default)")+"; rate: "+(store.get("tnd_tts_rate_v1")||"1.0");}catch(e){}
    return s;}},
  {id:"combat",re:/combat|fight|battle|enemy|foe|attack|initiative|round/i,gather:function(w){
    return "combat state: "+((w&&w.combat)?JSON.stringify(w.combat):"none");}},
  {id:"memory",re:/memor|remember|forgot|forget|drift|hallucinat|contradict|canon|recall/i,gather:function(w){
    var s="memory stats: ";
    try{
      var mm=(typeof memory!=="undefined")?memory:null;
      s+="NPCs "+(mm&&mm.npcs?Object.keys(mm.npcs).length:0)+", chapters "+(mm&&mm.chapters?mm.chapters.length:0)+", lore "+(mm&&mm.lore?mm.lore.length:0)+", pending events "+(mm&&mm.futureEvents?mm.futureEvents.length:0);
      if(typeof sessionTokens==="function")s+=", session ~"+sessionTokens()+"tk of "+(typeof SUMMARIZE_AT!=="undefined"?SUMMARIZE_AT:"?");
      if(w)s+=", RAG "+(w.ragMemory!==false?"on":"OFF");
    }catch(e){s+="(partial: "+e.message+")";}
    return s;}},
  {id:"sync",re:/sync|server|cloud|device|login/i,gather:function(w){
    var conn=false;try{if(typeof store!=="undefined")conn=!!store.get("tnd_server_tok_v1");}catch(e){}
    return "server connected: "+conn+"; campId: "+((w&&w.campId)||"none");}},
  // "storage full" reports must carry the numbers that diagnose them: per-key size breakdown
  // (key NAMES + sizes ONLY — never values; tnd_ak_v1's value is the API key) and the store
  // wrapper's in-memory-fallback key list (_mKeys = writes localStorage REJECTED — the direct
  // evidence of what stopped persisting). Sizes in UTF-16 chars, the unit quotas count.
  {id:"storage",re:/storag|quota|\bfull\b|space|persist|\bsav/i,gather:function(){
    var out=[],rows=[],total=0,i,k,v;
    try{
      if(typeof localStorage==="undefined")out.push("localStorage: (not available in this environment)");
      else{
        for(i=0;i<localStorage.length;i++){k=localStorage.key(i);v=localStorage.getItem(k)||"";rows.push([k,k.length+v.length]);total+=k.length+v.length;}
        rows.sort(function(a,b){return b[1]-a[1];});
        out.push("localStorage: ~"+Math.round(total/1024)+"K chars across "+rows.length+" keys (5MB quota ≈ 2,500K chars)");
        for(i=0;i<rows.length&&i<10;i++)out.push("  "+rows[i][0]+": "+Math.round(rows[i][1]/1024)+"K");
        if(rows.length>10)out.push("  (+"+(rows.length-10)+" smaller keys)");
      }
    }catch(e){out.push("localStorage scan failed: "+e.message);}
    try{
      if(typeof _mKeys!=="undefined"){
        var mk=Object.keys(_mKeys);
        out.push(mk.length?("⚠ IN-MEMORY FALLBACK ACTIVE — keys localStorage REJECTED: "+mk.join(", ")):"in-memory fallback: empty (all writes persisting)");
      }
    }catch(e){}
    return out.join("\n");}}
];

var ER_ENTRY_MAX=1200;   // per transcript entry in the context block
var ER_RAW_MAX=2500;     // the newest raw (tags-unstripped) GM response
var ER_CONTEXT_MAX=20000;// whole context block

// Build the auto-attached context for a user report. DOM-free and defensive throughout — every
// section guards its own globals so this works pre-game, mid-wizard, or in the node test runner.
function erReportContext(userText){
  var out=[],i;
  var w=(typeof worldState!=="undefined")?worldState:null;
  // ① digest
  try{
    if(w&&w.character){
      var c=w.character;
      out.push("STATE: "+c.name+" ("+c.cls+" Lv"+c.level+") HP "+c.hp+"/"+c.maxHp+", "+c.gold+" gp — "
        +((w.world&&w.world.location)||"?")+(w.world&&w.world.sublocation?" / "+w.world.sublocation:"")
        +", "+((w.world&&w.world.time)||"?")+" — turn "+w.turn);
    }else out.push("STATE: no active campaign");
  }catch(e){out.push("STATE: (gather failed: "+e.message+")");}
  // ② last 5 exchanges (≈10 transcript entries), oldest first, each capped
  try{
    var tr=(w&&w.transcript)||[];
    var start=Math.max(0,tr.length-10);
    if(tr.length>start){
      out.push("LAST EXCHANGES (clean text):");
      for(i=start;i<tr.length;i++){var en=tr[i];
        out.push("[t"+en.t+" "+(en.r==="gm"?"GM":"player")+(en.m?" · "+en.m:"")+"] "+String(en.x||"").slice(0,ER_ENTRY_MAX));}
    }else out.push("LAST EXCHANGES: (no transcript)");
  }catch(e){out.push("LAST EXCHANGES: (gather failed: "+e.message+")");}
  // ③ newest RAW GM response — tags un-stripped, because "prose said it, tag missing" is half of
  // every drift diagnosis
  try{
    if(typeof sessionLog!=="undefined"&&sessionLog&&sessionLog.length){
      for(i=sessionLog.length-1;i>=0;i--){
        if(sessionLog[i].role==="assistant"){out.push("NEWEST RAW GM RESPONSE (tags intact):\n"+String(sessionLog[i].content||"").slice(0,ER_RAW_MAX));break;}
      }
    }
  }catch(e){out.push("RAW RESPONSE: (gather failed: "+e.message+")");}
  // ④ the suggestion buttons on screen — the "this suggestion makes no sense" species
  try{
    if(w&&w.lastActions&&w.lastActions.length)out.push("SUGGESTED ACTIONS SHOWN: "+w.lastActions.join(" | "));
  }catch(e){}
  // ⑤ hint-matched extras
  var msg=String(userText||"");
  for(i=0;i<ER_REPORT_HINTS.length;i++){
    var h=ER_REPORT_HINTS[i];
    if(!h.re.test(msg))continue;
    try{out.push("["+h.id.toUpperCase()+"] "+h.gather(w));}
    catch(e){out.push("["+h.id.toUpperCase()+"] (gather failed: "+e.message+")");}
  }
  return out.join("\n").slice(0,ER_CONTEXT_MAX);
}

var ER_SHOT_MAX=1500000; // ~1.5MB of base64 — beyond this the image is dropped, noted in the report
var _erReportInFlight=false;

// sendUserReport(text, screenshotDataUrl|null, cb(ok, errMsg)) — the modal's Send handler.
// Failure is the CALLER's to surface (inline in the modal); this never toasts.
function sendUserReport(text,screenshot,cb){
  cb=cb||function(){};
  if(!ERROR_WEBHOOK_URL){cb(false,"bug reporting isn't configured — ERROR_WEBHOOK_URL is empty (error-report.js)");return;}
  if(_erReportInFlight){cb(false,"a report is already sending");return;}
  _erReportInFlight=true;
  var payload={
    kind:"user-report",
    report:String(text||"").slice(0,4000),
    context:erReportContext(text),
    screenshot:(screenshot&&screenshot.length<=ER_SHOT_MAX)?screenshot:null,
    app:(typeof APP_VERSION!=="undefined"?APP_VERSION:"?"),
    url:(typeof location!=="undefined"?location.href:"(node)"),
    ua:(typeof navigator!=="undefined"?navigator.userAgent:"(node)"),
    online:(typeof navigator!=="undefined"&&"onLine" in navigator?navigator.onLine:null),
    camp:(typeof worldState!=="undefined"&&worldState&&worldState.campName)||null,
    turn:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||null,
    ts:new Date().toISOString()
  };
  if(screenshot&&!payload.screenshot)payload.context+="\n(screenshot dropped: "+screenshot.length+" chars exceeds "+ER_SHOT_MAX+")";
  _erPost(payload,function(ok,err,body){
    _erReportInFlight=false;
    if(ok)console.info("[error-report] user report sent");
    else console.warn("[error-report] user report failed:",err);
    if(ok&&body&&(body.screenshot||body.sheet||body.email))
      console.warn("[error-report] webhook stored the report PARTIALLY — screenshot: "+(body.screenshot||"ok")+"; sheet: "+(body.sheet||"ok")+"; email: "+(body.email||"ok"));
    cb(ok,err,body);
  });
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
