/* #481 F2 (audit 2026-09-29, Fable-approved): the ONE image-source gate. A portrait string was pasted into src='…' unescaped,
   so a crafted save could close the attribute and add an event handler (the stored API key and session token are one read
   away). Admits an image data URL (png/jpeg/jpg/gif/webp, base64), https: and blob: — anything else is "" with one console
   line — and returns it HTML-escaped, safe inside a quoted src. Every portrait src= goes through safeImgSrc (the IMAGE SRC
   CONTRACT in run-tests.js forbids a raw one); every import boundary drops a failing portrait through portraitAdmit. */
var SAFE_IMG_DATA_RE=/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+\/=]+$/,SAFE_IMG_URL_RE=/^(?:https:\/\/|blob:)[^\s"'<>`]+$/i;
function safeImgSrcOk(url){var s=String(url==null?"":url);return !!s&&(SAFE_IMG_DATA_RE.test(s)||SAFE_IMG_URL_RE.test(s));}
function safeImgSrc(url){if(url==null||url==="")return "";var s=String(url);if(!safeImgSrcOk(s)){if(typeof console!=="undefined")console.warn("[portrait] refused an image source that is not an image data URL, https: or blob: — "+s.slice(0,60));return "";}return escHtml(s);}
/* the import boundary: a sheet whose portrait fails the gate loses it (loud); returns 1 when one was dropped */
function portraitAdmit(sheet,where){if(!sheet||typeof sheet!=="object"||!sheet.portrait)return 0;if(safeImgSrcOk(sheet.portrait))return 0;
  if(typeof console!=="undefined")console.warn("[portrait] dropped a portrait that is not an image ("+(where||"import")+"): "+(sheet.name||"?")+" — "+String(sheet.portrait).slice(0,60));delete sheet.portrait;return 1;}
/* a whole worldState at an import boundary: the hero, every npc wrapper and every npc sheet; returns the count dropped */
function portraitsSanitizeWorld(ws){var n=0,i;if(!ws)return 0;n+=portraitAdmit(ws.character,"save");var np=ws.npcs||[];for(i=0;i<np.length;i++){n+=portraitAdmit(np[i],"save");n+=portraitAdmit(np[i]&&np[i].charSheet,"save");}return n;}
function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
// Render model/user prose as SAFE story-DOM HTML (audit E11): escape FIRST, then apply the intentional
// *emphasis* and blank-line-to-paragraph transforms — so markup in GM output or player input can't
// inject a <script>/<img onerror> into the narrative (the API key lives in localStorage). The `*` and
// `\n` survive escHtml, so the two formatting passes still work. Callers wrap in <p> where needed.
function escProse(t){return escHtml(String(t||"")).replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n\n/g,"</p><p>");}
function smod(v){var m=Math.floor((v-10)/2);return(m>=0?"+":"")+m;}
// Canonical pronouns from a character's gender (M/F/NB). Used to seed companion/NPC pronouns so the
// GM never has to guess and gender-swap them (defaults to he/him for M or anything unspecified).
function pronounsForGender(g){return g==="F"?"she/her":g==="NB"?"they/them":"he/him";}
// AUDIT_FABLE_07_16 #11③: gender → image-prompt word (fal.ai render/portrait paths). An UNSET
// gender defaults to "male" (the wizard/doRender behavior) UNLESS the caller passes an explicit
// unsetDefault — the ui.js portrait modal deliberately defaults unset to "androgynous" (divergence
// preserved, not unified; see that call site).
function genderWord(g,unsetDefault){if(g==="F")return"female";if(g==="NB")return"androgynous";if(!g&&unsetDefault)return unsetDefault;return"male";}
// #11③ display-label variant (char sheet / wizard review). NOTE: api.js keeps two PROSE mappings
// inline ("non-binary" lowercase; the legacy block's 4-way with an empty-string default) — third
// and fourth mappings, deliberately not unified here.
function genderLabel(g){return g==="F"?"Female":g==="NB"?"Non-binary":"Male";}
// AUDIT_FABLE_07_16 #11②: per-level HP gain — ceil(hd/2)+1+CON mod, floor 1. ONE formula for the
// player level-up loop, the companion auto-level loop, and generated-companion baseline HP
// (the game.js "keeps companions on the engine's curve" promise, now enforced by shared code).
function hpGainPerLevel(hd,conMod){return Math.max(1,Math.ceil(hd/2)+1+conMod);}
// AUDIT_FABLE_07_16 #7: THE exact-name worldState.npcs lookup — === match, first hit, object or
// null. Lives in helpers.js (loads before state/memory/tag_table/api/game/ui) so every consumer
// can share it; formerly inlined ~14× (and game.js's _compNpcByName couldn't serve earlier files).
// Sites needing the INDEX (splice/write-back) or a compound predicate (name+charSheet,
// name+partyMember) keep their own loops — this helper is name-only on purpose.
function wsNpcByName(name){
  if(typeof worldState==="undefined"||!worldState||!worldState.npcs)return null;
  var i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name)return worldState.npcs[i];}
  return null;
}
/* #532: the fields that pin how a character sounds: every slot of the ONE table (TTS.characterVoiceSlots, tts.js: the Piper
   backup and each cloud voice), the delivery direction and the speed. A sheetless speaker carries them on the roster row, a
   sheeted one on the sheet (the pin OWNER, as speakerSubjectOfRow reads it). A host that loads no voice module (the offline
   merge tool) finds the slot fields by their names on the objects it is given: voiceId, and any field that ends in VoiceId.
   A test holds every slot of the table to that naming rule. */
function voicePinFields(objs){
  var f=["voiceDirection","voiceRate"],s,i,k;
  if(typeof TTS!=="undefined"&&TTS&&TTS.characterVoiceSlots){s=TTS.characterVoiceSlots();for(i=0;i<s.length;i++)f.push(s[i].field);return f;}
  f.push("voiceId");
  for(i=0;i<(objs||[]).length;i++)for(k in (objs[i]||{}))if(k.length>7&&k.slice(-7)==="VoiceId"&&f.indexOf(k)<0)f.push(k);
  return f;
}
/* #532: fills each voice field the OWNER lacks from the first source that holds a value that fits, and returns how many it
   filled. The owner's own pin always wins, and a field no source holds is not written at all. fits(field,value) is optional. */
function voicePinsFill(owner,sources,fits){
  var f=voicePinFields([owner].concat(sources)),n=0,i,j,src;
  for(i=0;i<f.length;i++){
    if(owner[f[i]])continue;
    for(j=0;j<sources.length;j++){src=sources[j];if(src&&src[f[i]]&&(!fits||fits(f[i],src[f[i]]))){owner[f[i]]=src[f[i]];n++;break;}}
  }
  return n;
}
/* #532 review: a voice follows a person only when it fits them. M and F match exactly, as in casting (castGenderMatches, tts.js).
   A stranger cast before their sex was known may hold a voice of the other sex; it is not carried onto a man or a woman, who is
   cast again, matched, at the next line. Only a KNOWN mismatch refuses: a voice the catalog does not list, a person of unknown
   sex, the direction and the speed all pass. */
function voicePinFitsGender(gender){
  return function(field,value){
    var vg;
    if((gender!=="M"&&gender!=="F")||typeof TTS==="undefined"||!TTS||!TTS.pinnedVoiceGender)return true;
    vg=TTS.pinnedVoiceGender(field,value);
    return !vg||vg===gender;
  };
}
/* #539: the sheet owns the pins from the moment it is attached, so the row's copies go: all of them, by the same list. The two
   sheet-attach sites call it only with the voice module loaded (where inheritVoicePins carried the pins); the merge fold calls
   it in every host, because its own fill ran there. */
function releaseRowVoicePins(row){
  if(row)voicePinFields([row]).forEach(function(f){delete row[f];});
  return row;
}
/* The voice subject of one roster row: its pin owner (the sheet when it has one, else the row) and the character the caster
   reads (name, sex from the sheet or from the pronouns on record, every pin). Lifted from _speakerVoiceSubject (game.js) by the
   #532 review, so the merge fold asks the SAME rule for the survivor's sex that casting uses. */
function speakerSubjectOfRow(row,nm){
  var owner,p,g;
  owner=row.charSheet||row;
  p=String(owner.pronouns||row.pronouns||((typeof memory!=="undefined"&&memory&&memory.npcs&&memory.npcs[nm])?memory.npcs[nm].pronouns:"")||"").toLowerCase().replace(/\s+/g,"");
  g=owner.gender;
  if(g!=="M"&&g!=="F"&&g!=="NB")g=/^she\//.test(p)?"F":(/^he\//.test(p)?"M":(/^they\//.test(p)?"NB":"ANY"));
  var _sc={name:owner.name||nm,gender:g,pronouns:p,voiceId:owner.voiceId||"",speechifyVoiceId:owner.speechifyVoiceId||"",voiceDirection:owner.voiceDirection||"",voiceRate:Number(owner.voiceRate)||0};
  var _scs=(typeof TTS!=="undefined"&&TTS.characterVoiceSlots)?TTS.characterVoiceSlots():[],_sci;for(_sci=0;_sci<_scs.length;_sci++)if(!(_scs[_sci].field in _sc))_sc[_scs[_sci].field]=owner[_scs[_sci].field]||"";/* #456: every slot field, never a hand list */
  return {char:_sc,owner:owner,row:row};
}
/* #532 review: while a merge of two names is pending they are one person as far as the ear is concerned. With scene refs live
   (every campaign) the first [NPC_MERGE:] is only a proposal: it waits in worldState.pendingMergeHints, then in
   worldState.mergeConfirmArmed for the one turn its confirmation is asked. The revealed name usually speaks on that same turn.
   Whichever of the two names has no voice yet takes the voice settings the other was heard in (those that fit). Returns how
   many it took. */
function voicePinsFromPendingMerge(owner,name,gender){
  var ws=(typeof worldState!=="undefined"&&worldState)||null,hints,a,i,other,row,n=0;
  if(!ws)return 0;
  hints=(ws.pendingMergeHints||[]).slice();a=ws.mergeConfirmArmed;
  if(a&&a.turn>=ws.turn)hints.push(a);
  for(i=0;i<hints.length;i++){
    other=hints[i].canonical===name?hints[i].duplicate:(hints[i].duplicate===name?hints[i].canonical:"");
    row=other?wsNpcByName(other):null;
    if(row)n+=voicePinsFill(owner,[row.charSheet,row],voicePinFitsGender(gender));
  }
  return n;
}
// AUDIT_FABLE_07_16 #11①: conservative arc↔quest title match — exact or one-contains-the-other,
// case-insensitive (the findCompanionNpc discipline, no fuzzy scoring). Shared by
// buildArcQuestNudge and buildArcDriftNudge (api.js), which defined it twice char-identically.
function arcTitleMatch(a,b){a=(a||"").toLowerCase();b=(b||"").toLowerCase();if(!a||!b)return false;return a===b||a.indexOf(b)>=0||b.indexOf(a)>=0;}
// Known issue #3 dedupe: an NPC's portrait has ONE canonical home — charSheet.portrait when a
// sheet exists (rides inline in the sync blob, atomic with state), npc.portrait otherwise
// (sheet-less NPCs; travels via the separate /portrait store). ALL display reads go through
// this helper; the npc.portrait fallback also covers pre-dedupe saves before migration runs.
function npcPortrait(n){if(!n)return null;return (n.charSheet&&n.charSheet.portrait)||n.portrait||null;}
// Effective img2img strength for a render model (#42): the user's per-model override from Render
// Options when set, else the model's declared default. null when the model's img2img has no
// strength knob (edit-style APIs like nano-banana) — callers hide the control / omit the param.
function img2imgStrength(cfg){
  if(!cfg||!cfg.img2img||typeof cfg.img2img.strength!=="number")return null;
  var o=renderStrength[cfg.id];
  return typeof o==="number"?o:cfg.img2img.strength;
}
// Fixed style boilerplate appended to EVERY fal.ai image-generation prompt (scene render + all
// portrait paths). withImgStyle() applies it at the fal.run boundary rather than baking it into the
// GM prompt-writer instruction, so the string lands verbatim regardless of what the model writes.
// Dedup-safe: the "Edit Prompt → Regenerate" path passes a prompt that already carries the suffix.
/* #208a (owner call 2026-08-21, the Flux drop): a stored render-model id that no longer exists in
   RENDER_MODELS must fall back to the shipped default LOUDLY — a dangling id would break doRender
   on the next click (the loadProviderSettings pruning precedent). */
// The quest panel's COMPASS (owner call 2026-09-03: "it's difficult to know what the current arc should
// be"). Titles ONLY — an arc's objective and an act's goal are the author's spine and routinely state
// outcomes the player has not discovered. Pure over worldState.skeleton; null when there is nothing
// to point at (no skeleton, no active act). Between arcs the act still shows.
// #376 (owner call 2026-09-08): ONE act-label formatter for the status bar, the quest panel and the GM's skeleton
// block. An authored title that already opens with "Act …" ("Act 2: The Severing of Bloodlines") is kept as written;
// any other title gets "Act N: " in front. Three surfaces used to format this three ways and two of them doubled it.
function actLabel(n,title){var at=String(title||"");return /^act\s/i.test(at)?at:"Act "+n+": "+at;}
/* #425 (the_fae_crysalis t33, 2026-09-20): the hero's lived history as ONE digest for the campaign-skeleton generator and
   its reviewer (game.js skeletonCharBlock). Pure over the character: bonds first (who this character's people are), then
   the other defining moments, then the newest story beats in the order they happened, each labelled by the adventure it
   came from (a raw campaign id reads as "an earlier adventure"). "" when the character has no record at all — a fresh
   hero prints no block. Capped so a 2,400-turn record stays a briefing: newest beats kept, oldest dropped. Age is
   deliberately not here (the 2026-08-10 "age is cosmetic-only" ruling). */
var CHAR_RECORD_CAP=3000;
function charRecordDigest(c){
  if(!c)return "";
  var cm=Array.isArray(c.coreMemories)?c.coreMemories:[],sb=Array.isArray(c.storyBeats)?c.storyBeats:[],seen={},bonds=[],rest=[],beats=[],i;
  function label(m){var k=String((m&&m.camp)||"");return !k||/^camp_\d/.test(k)?"an earlier adventure":k;}
  function line(m){var t=String((m&&m.text)||"").replace(/\s+/g," ").trim();if(!t||seen[t])return null;seen[t]=1;return "- ("+label(m)+") "+t;}
  for(i=0;i<cm.length;i++){var l=line(cm[i]);if(!l)continue;if(cm[i].kind==="bond")bonds.push(l);else rest.push(l);}
  var out=bonds.concat(rest),used=out.join("\n").length;
  for(i=sb.length-1;i>=0;i--){var b=line(sb[i]);if(!b)continue;if(used+b.length+1>CHAR_RECORD_CAP)break;beats.unshift(b);used+=b.length+1;}
  return out.concat(beats).join("\n");
}
/* #426 (owner ruling 2026-09-20): the stake modal is asked at Begin only when the hero has no written backstory —
   every legacy import (their record IS their backstory) and a fresh hero who left the field blank. Pure. */
function stakeAskWanted(c){return !!c&&!String(c.backstory||"").trim();}
/* B39 (2026-09-21): ONE observed AudioContext.resume() for every context in the app. B10 root-caused the "Failed to
   start the audio device" report to a resume() whose promise nobody handled, and the v1.437 fix observed only tts.js's
   context; sound.js's earcon context (a second context, reached from every toast, gesture or not) and stt.js's mic
   context kept the bare `try{ctx.resume();}catch(e){}` — a synchronous catch cannot see an async rejection, so the
   B10 fingerprint came back as B39 from the contexts B10 never instrumented. The promise is returned UNCHANGED (callers
   may chain); a reporter rides alongside — never a bare .catch(){}, which would silence the only signal this class
   has ever produced. The crumb + console line keep the record; onRefused lets the owner mark the context doomed. */
function resumeObserved(ctx,tag,onRefused){
  if(!ctx||typeof ctx.resume!=="function")return null;
  var pr;try{pr=ctx.resume();}catch(e){return null;}
  if(pr&&typeof pr.then==="function")pr.then(null,function(e){
    var why=(e&&(e.name+": "+e.message))||String(e);
    if(typeof console!=="undefined")console.warn("[audio] AudioContext.resume() REFUSED ("+(tag||"?")+", state "+ctx.state+"): "+why+" — context marked unrecoverable; the next user gesture rebuilds it");
    if(typeof erCrumb==="function")erCrumb("ctx-refused",(tag||"?")+" "+ctx.state+" "+why.slice(0,40));
    if(typeof onRefused==="function"){try{onRefused(e,why);}catch(_e){}}
  });
  return pr;
}
function questBearing(){
  var sk=(typeof worldState!=="undefined"&&worldState&&worldState.skeleton)||null;if(!sk||!sk.acts)return null;
  var i,j;for(i=0;i<sk.acts.length;i++){var a=sk.acts[i];if(!a||a.status!=="active")continue;
    var arcs=a.arcs||[],out={actN:i+1,actTitle:String(a.title||""),arcN:null,arcOf:arcs.length,arcTitle:null};
    for(j=0;j<arcs.length;j++)if(arcs[j]&&arcs[j].status==="active"){out.arcN=j+1;out.arcTitle=String(arcs[j].title||"");break;}
    return out;}
  return null;
}
function questBearingText(b){
  if(!b)return "";var s=actLabel(b.actN,b.actTitle);/* #376 */
  if(b.arcN)s+="\nArc "+b.arcN+"/"+b.arcOf+" \u201c"+b.arcTitle+"\u201d";
  return s;
}
// #329 roll your own dice — the pure half. parseCheckTag reads "[CHECK:label|+mod|DC n]"; resolveCheck
// turns the player's d20 into the total, the outcome, the [DICE:] record the transcript keeps (the
// same shape the GM writes when it rolls), and the engine note the continuation carries.
function parseCheckTag(body){var p=String(body||"").split("|"),label=(p[0]||"").trim(),mod=parseInt(String(p[1]||"").replace(/[^-+\d]/g,""),10),dc=null,i;if(!label)return null;if(isNaN(mod))mod=0;for(i=1;i<p.length;i++){var m=String(p[i]).match(/DC\s*(\d+)/i);if(m)dc=parseInt(m[1],10);}return {label:label,mod:mod,dc:dc};}
function resolveCheck(chk,roll){var total=roll+(chk.mod||0),outcome=(chk.dc!=null)?(total>=chk.dc?"success":"failed"):(roll===20?"critical":(roll===1?"fumble":"rolled"));
  var note="[ENGINE NOTE \u2014 THE PLAYER ROLLED (not a player action): "+chk.label+": d20 = "+roll+(chk.mod?(chk.mod>0?" + ":" \u2212 ")+Math.abs(chk.mod):"")+" = "+total+(chk.dc!=null?" against DC "+chk.dc:"")+" \u2192 "+outcome.toUpperCase()+". Narrate the outcome of that check now; the roll is final \u2014 do not roll again and do not emit another [DICE:] for it.]";
  return {roll:roll,total:total,outcome:outcome,diceTag:"[DICE:"+chk.label+"|"+total+"|"+outcome+"]",note:note};}
function rollD20(){return 1+Math.floor(Math.random()*20);}
// #350 (owner 2026-09-05: "more often than not the player gets 14+ — I wanted a record to verify"): THE dice
// record. Nothing kept a roll before — [DICE:] was strip-only and the player's own roll rode a silent send
// that left no transcript line. Every roll the engine sees is filed here: the player's click (face, mod,
// DC, outcome — authoritative) and any [DICE:] the GM writes (label, total, outcome; the face only when
// the GM states it). Bounded ring (monotonic-resources rule); rides the save and the sync blob.
var DICE_LOG_MAX=500;
function diceLogFile(e){
  if(!worldState||!e)return null;if(!worldState.diceLog)worldState.diceLog=[];
  var rec={t:(typeof e.t==="number")?e.t:(worldState.turn||0),by:e.by==="gm"?"gm":"player",label:String(e.label||"").slice(0,80),
    face:(typeof e.face==="number"&&e.face>=1&&e.face<=20)?e.face:null,mod:(typeof e.mod==="number")?e.mod:null,dc:(typeof e.dc==="number")?e.dc:null,
    total:(typeof e.total==="number")?e.total:null,outcome:String(e.outcome||"").slice(0,20)};
  worldState.diceLog.push(rec);while(worldState.diceLog.length>DICE_LOG_MAX)worldState.diceLog.shift();
  return rec;
}
// The readout — pure, engine-tested, shared by Table Talk and whoever else asks. Faces are counted only
// where a face was recorded (the player's own rolls, or a GM tag that stated one).
function diceStats(log){
  log=log||(worldState&&worldState.diceLog)||[];var n=log.length,faces=[],hist={},hi=0,sum=0,byP=0,byG=0,succ=0,judged=0,dcs=[],i;
  for(i=1;i<=20;i++)hist[i]=0;
  for(i=0;i<n;i++){var r=log[i];if(r.by==="gm")byG++;else byP++;
    if(typeof r.face==="number"){faces.push(r.face);hist[r.face]++;sum+=r.face;if(r.face>=14)hi++;}
    if(typeof r.dc==="number")dcs.push(r.dc);
    if(r.outcome==="success"||r.outcome==="failed"){judged++;if(r.outcome==="success")succ++;}}
  var dcMean=dcs.length?Math.round(dcs.reduce(function(a,b){return a+b;},0)/dcs.length*10)/10:null;
  return {rolls:n,byPlayer:byP,byGm:byG,faces:faces.length,hist:hist,meanFace:faces.length?Math.round(sum/faces.length*100)/100:null,
    share14plus:faces.length?Math.round(hi/faces.length*1000)/10:null,expected14plus:35,judged:judged,successRate:judged?Math.round(succ/judged*1000)/10:null,dcMean:dcMean};
}
function diceStatsLine(){
  var s=diceStats();if(!s.rolls)return "";
  return "Dice record: "+s.rolls+" roll"+(s.rolls>1?"s":"")+" ("+s.byPlayer+" by the player, "+s.byGm+" by the GM)"
    +(s.faces?"; d20 faces recorded "+s.faces+", mean "+s.meanFace+", 14+ on "+s.share14plus+"% (a fair die: 35%)":"; no d20 faces recorded yet")
    +(s.judged?"; checks against a DC: "+s.judged+", success "+s.successRate+"%"+(s.dcMean!=null?", mean DC "+s.dcMean:""):"")+".";
}
// ── #355 the REGISTER guard (owner ruling 2026-09-06: ledgers are banned as a STORY DEVICE, never as data) ──
// The GM used "the ledger rots" as its big line six hours after the ruling. The data.js rule bans
// building plots on paperwork; this is the model's own metaphor vocabulary, which no plot rule
// touches — the #227 antiquity-ratchet class (house style beating the voice directive). Three parts:
// a STYLE clause at the end of the prompt, this census on the CLEANED narration (player text and
// Table Talk never scanned), and an engine note the next turn naming the word — the "new channel"
// lesson: an instruction that loses to the model's own recent output must arrive beside it.
// The list is deliberately tight — unambiguous clerical nouns only. "account", "contract", "bill",
// "record", "register" and "the books" are all legitimate English in a fantasy mouth and stay out.
var REGISTER_WORDS=["ledger","ledgers","invoice","invoices","invoiced","paperwork","bookkeeping","bookkeeper","clerical","spreadsheet","spreadsheets","accountant","accountants","tally sheet","balance sheet",
  /* #459 ② (owner 2026-09-25, the Necrotic Dungeon's "soul-tax lien" recited at a village hearth): the debt-and-tithe half of the
     register — every consumer inherits it (the #355 note, the #372 chapter guard, the labels, the sheet report, the #459 skeleton gate
     and record guard). "collateral" is the owner's call and catches "collateral damage" too — a known, accepted false positive. */
  "lien","liens","tithe","tithes","collateral","creditor","creditors","escrow","foreclosures","foreclosure","foreclosed","foreclose","repayments","repayment","soul-tax"];
var REGISTER_RE=new RegExp("\\b(?:"+REGISTER_WORDS.map(function(w){return w.replace(/ /g,"\\s+");}).join("|")+")\\b","gi");
var REGISTER_LOG_MAX=50;
/* #372: the guard's reach. ONE scanner over a word list (registerScan is the #355 instance, signature kept).
   PAPERWORK_WORDS extend the tight list for LABELS and SHEETS only — plot nouns a prose list cannot see ("Recover
   the manifest" is the ledger plot by another door) — never for the narration note, whose false-positive
   discipline (#355) stands. IDIOM_WORDS is a second census, modern idiom, numbers only: no note, no latch. */
function wordListRe(words){return new RegExp("\\b(?:"+words.map(function(w){return w.replace(/ /g,"\\s+");}).join("|")+")\\b","gi");}
function wordListScan(text,re){var out=[],seen={},m,r=new RegExp(re.source,"gi");while((m=r.exec(String(text||"")))){var w=m[0].toLowerCase().replace(/\s+/g," ");if(!seen[w]){seen[w]=1;out.push(w);}}return out;}
function registerScan(text){return wordListScan(text,REGISTER_RE);}
/* #481 C7 (audit 2026-09-29, owner ruling + Fable): a campaign may NAME its plot objects with register words ("tithe-engines",
   "soul-tax lien" — a legacy skeleton written before the #459 gate, an item called "Ledger fragment", an ability "Ledger
   Memory"). The scan stays on FREE PROSE: registerMaskNames blanks every exact canonical name (whole phrase, any case, a
   typographic apostrophe allowed) before registerScan reads the text. ONE helper, used by the record guard, the #372
   chapter guard and the narration scan. Pure. */
function registerMaskNames(text,names){
  var s=String(text==null?"":text),list=(names||[]).map(function(n){return String(n==null?"":n).trim();}).filter(function(n){return n.length>=3;}).sort(function(a,b){return b.length-a.length;}),i;
  for(i=0;i<list.length;i++){var esc=list[i].replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/['\u2019]/g,"['\u2019]").replace(/\s+/g,"\\s+");
    s=s.replace(new RegExp("(^|[^A-Za-z0-9])("+esc+")(?![A-Za-z0-9])","gi"),function(m0,pre,nm){return pre+nm.replace(/\S/g,"\u25a1");});}
  return s;
}
function registerScanProse(text,names){return registerScan(registerMaskNames(text,names));}
/* #481 C7: the canonical names a record line may carry as written — the identifiers the record keys things by (the hero and
   every NPC and alias, places, quest, act and arc titles, carried items, abilities and spells, item canon, factions) and
   the skeleton's OWN register terms as written (a legacy premise built on a "soul-tax" keeps its word; a post-#459
   skeleton has none). Lore — the text being guarded — is never a source. Pure over the live state. */
function recordCanonNames(){
  var out=[],seen={};
  function add(n){n=String(n==null?"":(typeof n==="object"&&n.name!=null?n.name:n)).trim();if(n.length<3)return;var k=n.toLowerCase();if(seen[k])return;seen[k]=1;out.push(n);}
  function item(it){var b=(typeof _invBase==="function")?_invBase(it):String(it||"");b=String(b).split(/\s+[\u2014\u2013]\s+|\s+-\s+/)[0].replace(/\s*\([^)]*\)\s*$/,"");add(b);}
  function sheet(cs){if(!cs)return;(cs.inventory||[]).forEach(item);(cs.abilities||[]).forEach(add);(cs.spells||[]).forEach(add);}
  if(typeof worldState==="undefined"||!worldState)return out;
  var ws=worldState,mem=(typeof memory!=="undefined"&&memory)||{};
  if(ws.character){add(ws.character.name);sheet(ws.character);}
  (ws.npcs||[]).forEach(function(n){if(!n)return;add(n.name);(n.aliases||[]).forEach(add);sheet(n.charSheet);});
  Object.keys(mem.npcs||{}).forEach(function(k){add(k);((mem.npcs[k]&&mem.npcs[k].aliases)||[]).forEach(add);});
  Object.keys((mem.map&&mem.map.nodes)||{}).forEach(function(k){add(k.split("|").pop());});
  (ws.questLog||[]).forEach(function(q){if(q)add(q.title);});Object.keys(mem.quests||{}).forEach(add);
  Object.keys(ws.itemBible||{}).forEach(add);(ws.factions||[]).forEach(add);
  var sk=ws.skeleton;
  if(sk){var parts=[sk.premise];
    (sk.acts||[]).forEach(function(a){if(!a)return;add(a.title);add(String(a.title||"").replace(/^\s*act\s*\d+\s*[:.\-\u2013\u2014]\s*/i,""));parts.push(a.title,a.goal,a.turningPoint);(a.arcs||[]).forEach(function(r){if(!r)return;add(r.title);parts.push(r.title,r.objective);});});
    var skText=parts.filter(function(x){return x;}).join(" \n "),re=new RegExp(REGISTER_RE.source,"gi"),m;
    while((m=re.exec(skText))){var st=m.index,en=m.index+m[0].length;while(st>0&&/[A-Za-z0-9\-]/.test(skText.charAt(st-1)))st--;while(en<skText.length&&/[A-Za-z0-9\-]/.test(skText.charAt(en)))en++;add(skText.slice(st,en).replace(/^-+|-+$/g,""));}}
  return out;
}
var PAPERWORK_WORDS=["voucher","vouchers","manifest","manifests","requisition","requisitions","bearer note","bearer notes"];
var LABEL_RE=wordListRe(REGISTER_WORDS.concat(PAPERWORK_WORDS));
var IDIOM_WORDS=["christmas","refrigerator","refrigerators","napalm","fiscal quarter","fiscal quarters","low orbit","television","televisions","telephone","telephones","microwave","microwaves","laser","lasers","radar","robot","robots","computer","computers","adrenaline"];
var IDIOM_RE=wordListRe(IDIOM_WORDS);
function idiomScan(text){return wordListScan(text,IDIOM_RE);}
/* ③ the plot channel: the operands of the three lifecycle tags, pipes to spaces, in order of appearance — never the prose */
function registerLabelScan(raw){var ops=[],m,re=/\[(?:QUEST|QUEST_STEP|SCHEDULE):([^\]]*)\]/g;while((m=re.exec(String(raw||""))))ops.push(m[1].replace(/\|/g," "));return wordListScan(ops.join(" \n "),LABEL_RE);}
/* the census ring — one field, three channels (chapter / label / idiom), each capped like #355's ring; extra fields
   ride the entry (the chapter channel records reasked/cleaned). Never arms registerPing: these are counts. */
function registerCensusFile(channel,hits,turn,extra){
  if(typeof worldState==="undefined"||!worldState||!hits||!hits.length)return hits||[];
  if(!worldState.registerCensus||typeof worldState.registerCensus!=="object")worldState.registerCensus={};
  var c=worldState.registerCensus;if(!(c[channel] instanceof Array))c[channel]=[];
  var i,k;for(i=0;i<hits.length;i++){var e={turn:turn,word:hits[i]};if(extra)for(k in extra)e[k]=extra[k];c[channel].push(e);}
  while(c[channel].length>REGISTER_LOG_MAX)c[channel].shift();
  return hits;
}
function registerCensusStats(ws){ws=ws||(typeof worldState!=="undefined"?worldState:null);var c=(ws&&ws.registerCensus)||{},out={chapter:0,chapterDirty:0,label:0,idiom:0,record:0,recordDropped:0,recordDeferred:0,recordEvicted:0},i;
  var ch=c.chapter||[];for(i=0;i<ch.length;i++){out.chapter++;if(ch[i].reasked&&ch[i].cleaned===false)out.chapterDirty++;}
  var rc=c.record||[];for(i=0;i<rc.length;i++){out.record++;if(rc[i].dropped)out.recordDropped++;if(rc[i].deferred)out.recordDeferred++;if(rc[i].evicted)out.recordEvicted++;}/* #481 C7: deferred to the next window, and evicted from a full queue *//* #459 ③: knowledge/lore lines re-asked, and how many were dropped */
  out.label=(c.label||[]).length;out.idiom=(c.idiom||[]).length;return out;}
function registerCensusLine(){var s=registerCensusStats();if(!s.chapter&&!s.label&&!s.idiom&&!s.record)return "";return "Register census (counts only, no correction): chapter summaries "+s.chapter+(s.chapterDirty?" ("+s.chapterDirty+" still dirty after a re-ask)":"")+", quest/schedule labels "+s.label+", modern idiom "+s.idiom+(s.record?", record lines "+s.record+" ("+s.recordDropped+" dropped"+(s.recordDeferred?", "+s.recordDeferred+" deferred":"")+(s.recordEvicted?", "+s.recordEvicted+" evicted":"")+")":"")+".";}
/* ② the authoring seams, read at the SHEET rather than hooked at four call sites (wizard, blueprint import,
   generateNpcSheet, the #330 want birth): the live sheet is what every seam wrote, so one census over it covers
   them all, and a hand edit in the character editor too. REPORT only — personality is the player's, never the
   engine's to retro-edit. The wider label list applies: a sheet is authored text, and the reader is a human. */
var SHEET_REGISTER_FIELDS=[["backstory","backstory"],["trait","trait"],["flaw","flaw"],["motivation","motivation"],["appear","look"]];
function sheetRegisterReport(ws){
  ws=ws||(typeof worldState!=="undefined"?worldState:null);var out=[];if(!ws)return out;
  function scanSheet(name,s){if(!s)return;var i;for(i=0;i<SHEET_REGISTER_FIELDS.length;i++){var f=SHEET_REGISTER_FIELDS[i],v=s[f[0]];if(typeof v==="string"&&v){var h=wordListScan(v,LABEL_RE);if(h.length)out.push({name:name,field:f[1],words:h});}}
    var w=s.agenda&&s.agenda.want;if(typeof w==="string"&&w){var hw=wordListScan(w,LABEL_RE);if(hw.length)out.push({name:name,field:"want",words:hw});}
    /* #481 C9: the names a sheet carries — an ability ("Ledger Memory") or an item ("Ledger fragment") — are reported too */
    (s.abilities||[]).forEach(function(a){var an=String((a&&a.name!=null)?a.name:(a||"")).trim();if(!an)return;var ha=wordListScan(an,LABEL_RE);if(ha.length)out.push({name:name,field:"ability",words:ha,text:an});});
    (s.inventory||[]).forEach(function(it){var inm=String((typeof _invBase==="function")?_invBase(it):(it||"")).split(/\s+[\u2014\u2013]\s+/)[0].trim();if(!inm)return;var hi=wordListScan(inm,LABEL_RE);if(hi.length)out.push({name:name,field:"item",words:hi,text:inm});});}
  if(ws.character)scanSheet(ws.character.name||"the player",ws.character);
  var n=ws.npcs||[],i;for(i=0;i<n.length;i++)if(n[i]&&n[i].charSheet)scanSheet(n[i].name,n[i].charSheet);
  return out;
}
function registerStats(log){log=log||(worldState&&worldState.registerSlips)||[];var by={},i;for(i=0;i<log.length;i++){var w=log[i].word;by[w]=(by[w]||0)+1;}return {slips:log.length,byWord:by,lastTurn:log.length?log[log.length-1].turn:null};}
function registerStatsLine(){var s=registerStats();if(!s.slips)return "";var parts=Object.keys(s.byWord).sort().map(function(w){return w+" \u00d7"+s.byWord[w];});return "Register slips (clerical words the narration used and was corrected on): "+s.slips+" ("+parts.join(", ")+"), last at turn "+s.lastTurn+".";}
// ── #356 THE elapsed ticker (owner rule 2026-09-06: "we should always have the counter while we're
// rendering — keeps the UI alive and lets the user know we're working on something") ──
// One heartbeat for every in-flight status line: scene renders, portrait renders, portrait reads,
// the loading modal. A frozen status reads as broken long before it reads as slow (the 2026-08-31
// Seedream hang). set() swaps the base text while the seconds keep counting (the queue lane's real
// state); stop() must run BEFORE any terminal text is written or the next tick overwrites it — the
// isConnected self-stop covers hosts that simply vanish. Node-safe (the interval is unref'd).
function elapsedTicker(el,base,opts){
  var t0=Date.now(),cur=String(base||""),text=!!(opts&&opts.text),style=(opts&&opts.style)||"color:var(--t2);font-style:italic;",id=null;
  function secs(){return Math.round((Date.now()-t0)/1000);}
  function paint(){if(!el)return;var s=(cur?cur+" ":"")+secs()+"s";if(text)el.textContent=s;else el.innerHTML="<span style='"+style+"'>"+s+"</span>";}
  function stop(){if(id!==null){clearInterval(id);id=null;}}
  paint();
  if(typeof setInterval==="function"){id=setInterval(function(){if(el&&el.isConnected===false){stop();return;}paint();},1000);if(id&&typeof id.unref==="function")id.unref();}
  return {set:function(b){cur=String(b||"");paint();},stop:stop,seconds:secs,base:function(){return cur;}};
}
// #328: the [SUGGEST:a|b|c] payload → up to three clean actions. Leading "A)" / "1." markers and
// asterisks are dropped (the v1.90 parseActions lesson); blanks vanish. Pure.
function parseSuggestTag(body){var out=[],parts=String(body||"").split("|"),i;for(i=0;i<parts.length&&out.length<3;i++){var t=parts[i].replace(/\*/g,"").trim().replace(/^[(\[]?(?:[A-Ca-c]|[1-3])[)\].:]\s*/,"").trim();if(t.length>1)out.push(t);}return out;}
// ── #330 companions with agendas (owner sketch 2026-09-04) ─────────────────────────────────────
// A companion carries ONE active want on their sheet plus a SILENT backlog; readable, never editable
// (personality is not the player's to tailor). Sources: the blueprint's dossier line (adopted at the
// next commit), the GM at recruitment (the ask note), or a defining moment (the birth roll). Refusal
// is the ceiling — a companion never leaves over a want. The pure half lives here.
// kind is "peaceful" or "violent" (owner 2026-09-04: no shared stem, so no substring can ever misfile one as the other).
function agendaKindOf(k){k=String(k||"").toLowerCase();if(/peace|non/.test(k))return "peaceful";return /viol|blood|kill|avenge|slay/.test(k)?"violent":"peaceful";}
// #370 (owner ruling 2026-09-07): a flaw is malleable. companionGrow rewrites the sheet's flaw when the GM files
// [COMPANION_GROWTH:Name|the flaw|what replaced it]; the old flaw must be the one on the sheet (a shared content
// word), the old text is kept in growth[], and the caller files the defining moment and toasts. Null = refused.
function companionGrow(cs,oldFlaw,newFlaw,turn){
  if(!cs||!cs.flaw||!newFlaw)return null;var was=String(cs.flaw),o=String(oldFlaw||"").toLowerCase(),w=was.toLowerCase();
  var ok=!!o&&(w.indexOf(o)>=0||o.indexOf(w)>=0);if(!ok){var ot=o.split(/[^a-z]+/).filter(function(x){return x.length>=4;}),i;for(i=0;i<ot.length&&!ok;i++)if(w.indexOf(ot[i])>=0)ok=true;}
  if(!ok)return null;var now=String(newFlaw).trim().slice(0,160);if(!now||now.toLowerCase()===w)return null;
  if(!cs.growth)cs.growth=[];cs.growth.push({was:was,now:now,turn:turn});cs.flaw=now;return {old:was,now:now};
}
/* #437 (owner rulings 2026-09-24): a companion's MOTIVATION has a lifecycle — fulfilled → none standing → born by the
   story. The Necrotic Dungeon's ledger plot grew from Daeris's purpose ("find the original creditor… close the
   account"), settled two campaigns earlier (Runelords t1264, "her debts were paid") and never retired: the freeform
   generator read the closed debt as an open thread. Retirement: the GM tag at a defining moment, the summarizer's
   belt, the character editor. Birth: the story only (#347 — never manufactured), every filing toasts, and the write
   path REFUSES a paperwork purpose (the #372 label list). Retired lines archive on the sheet (P12 — nothing vanishes)
   and travel with it. The hero's purpose is the player's and never passes through here. */
var MOTIVATION_SETTLED_RE=/^\s*(settled|fulfilled|done|closed|abandoned|outgrown)\b\s*[:—\-]?\s*/i;
/* #481 C8 (audit 2026-09-29, Fable-approved): a campaign stamp is the display name (camp) AND the id (campId). Every
   reader used to compare display names, so renaming a campaign turned its own moments into "an earlier adventure"
   (fae t89). ONE stamper and ONE comparator. campStampOn(obj[, name]) stamps the current campaign; an explicit name
   keeps that name and carries the id only when it IS the current campaign's name. campIsCurrent(rec) compares by id
   when both sides carry one, else by name. An unstamped record counts as this campaign's (the long-standing convention).
   campRestamp is the rename's re-stamp for name-only legacy entries; an already-renamed legacy save is not repaired. */
function campStampOn(obj,name){
  var ws=(typeof worldState!=="undefined"&&worldState)?worldState:null,cur=String((ws&&ws.campName)||"");
  obj.camp=(name!=null)?String(name):cur;
  if(ws&&ws.campId&&obj.camp===cur)obj.campId=ws.campId;
  return obj;
}
/* #481 C5 (audit 2026-09-29, Fable-approved): a SCENE stays in its campaign. The scene registry is a sheet's OUTFIT and its
   relationship DYNAMICS (worn gear and bonds are the character's own and cross untouched). sceneFieldsCross is the ONE
   boundary every adoption/import site runs (startGame, importVillageResidents, adoptLibraryHero, adoptLibraryCompanion,
   _addImportedCompanion): an incoming outfit crosses only when it carries THIS campaign's stamp (outfitSet stamps with
   campStampOn); every dynamic is left at the door. sceneTurnLive is the render's negative-age test — a turn stamped after
   the current turn is another campaign's clock (Princess t18 served an outfit from t169 and a mood from t2106). There is no
   same-campaign age gate: this campaign's scene renders exactly as before. */
function sceneFieldsCross(sheet){
  if(!sheet||typeof sheet!=="object")return sheet;
  var o=sheet.outfit;if(o&&!((o.camp!==undefined||o.campId)&&campIsCurrent(o)))delete sheet.outfit;
  (sheet.relationships||[]).forEach(function(r){if(r&&r.dynamic){r.dynamic="";r.dynamicTurn=null;}});
  return sheet;
}
function sceneTurnLive(turn){var now=(typeof worldState!=="undefined"&&worldState&&typeof worldState.turn==="number")?worldState.turn:0;return !(typeof turn==="number"&&turn>now);}
function campIsCurrent(rec){
  if(!rec)return true;
  var ws=(typeof worldState!=="undefined"&&worldState)?worldState:null;
  if(rec.campId&&ws&&ws.campId)return rec.campId===ws.campId;
  if(!rec.camp)return true;
  if(!rec.campId&&/^camp_\d/.test(rec.camp))return !!(ws&&rec.camp===ws.campId);/* a legacy stamp that holds the id itself */
  return rec.camp===String((ws&&ws.campName)||"");
}
/* #509: every record campStampOn stamps — the three moment lists on every sheet (the hero and every charSheet), and each
   sheet's outfit. ONE walk, read by both re-stamps below. */
var CAMP_STAMPED_LISTS=["coreMemories","storyBeats","motivationHistory"];
function campStampedEach(ws,fn){
  if(!ws)return;
  var sheets=[ws.character],i;
  for(i=0;i<(ws.npcs||[]).length;i++)if(ws.npcs[i]&&ws.npcs[i].charSheet)sheets.push(ws.npcs[i].charSheet);
  sheets.forEach(function(cs){if(!cs)return;
    CAMP_STAMPED_LISTS.forEach(function(f){(cs[f]||[]).forEach(function(r){if(r)fn(r);});});
    if(cs.outfit&&typeof cs.outfit==="object")fn(cs.outfit);
  });
}
function campRestamp(ws,oldName,newName,id){
  var n=0;
  campStampedEach(ws,function(r){
    if(r.campId&&id&&r.campId===id){if(r.camp!==newName){r.camp=newName;n++;}}
    else if(!r.campId&&oldName&&r.camp===oldName){r.camp=newName;if(id)r.campId=id;n++;}
  });
  return n;
}
/* #509: the campaign's ID changed under it — a re-minted import (#423: the file's id is not one this device owns) or the
   re-home after a cloud save was refused for another account. campIsCurrent compares by id first (C8), so without this the
   campaign's own moments read as "an earlier adventure" and the Village held them back. Every record stamped with the old
   id follows; another campaign's records keep their own ids. Returns the count. */
function campRestampId(ws,oldId,newId){
  var n=0;
  if(!oldId||!newId||oldId===newId)return 0;
  campStampedEach(ws,function(r){if(r.campId===oldId){r.campId=newId;n++;}});
  return n;
}
function motivationSettle(cs,how,turn,camp){
  if(!cs||typeof cs.motivation!=="string"||!cs.motivation.trim())return null;
  var was=cs.motivation.trim(),h=String(how||"").trim().slice(0,200)||"settled";
  /* #459 (owner 2026-09-25): the settled filing lands in plain speech — a how written in the banned register (the label list)
     falls to a bare "settled", loudly; the purpose still settles (that fact is real), only its wording is refused, so the
     growth core memory the filing writes never recites it either. */
  var _hh=(typeof wordListScan==="function"&&typeof LABEL_RE!=="undefined")?wordListScan(h,LABEL_RE):[];
  if(_hh.length){if(typeof console!=="undefined")console.warn("[motivation] #459 "+(cs.name||"?")+": the settled reason was written in accountant's language ("+_hh.join(", ")+") — filed as a bare 'settled': \""+h.slice(0,80)+"\"");h="settled";}
  if(!cs.motivationHistory)cs.motivationHistory=[];
  var rec=campStampOn({text:was,how:h,turn:turn},camp);/* #481 C8 */
  cs.motivationHistory.push(rec);cs.motivation="";return rec;
}
function motivationBirth(cs,text,turn,camp){
  if(!cs)return null;var t=String(text||"").trim().slice(0,200);if(!t)return null;
  var hits=(typeof wordListScan==="function"&&typeof LABEL_RE!=="undefined")?wordListScan(t,LABEL_RE):[];
  if(hits.length)return {refused:hits};
  var was=(typeof cs.motivation==="string")?cs.motivation.trim():"";if(was&&was.toLowerCase()===t.toLowerCase())return null;
  if(was)motivationSettle(cs,"replaced by a new purpose",turn,camp);
  cs.motivation=t;return {now:t,replaced:was||null};
}
/* "" while a purpose stands or when none was ever recorded; otherwise how and where the last one ended — never its
   old words, so a closed paperwork purpose stays closed in the prompt. */
function motivationSettledLine(cs){
  if(!cs||(typeof cs.motivation==="string"&&cs.motivation.trim()))return "";
  var h=cs.motivationHistory;if(!h||!h.length)return "";var last=h[h.length-1];
  return "settled"+(last.camp?" in "+last.camp:"")+": "+(last.how||"settled");
}
// #386: a companion acted on their flaw unbidden — file it (ring of 20, the sheet's stamp). Null when refused.
function companionInitiativeFile(cs,what,turn){
  if(!cs||!cs.name||!what)return null;var w=String(what).trim().slice(0,200);if(!w)return null;
  if(!worldState.companionInitiatives)worldState.companionInitiatives=[];var rec={name:cs.name,what:w,turn:turn};
  worldState.companionInitiatives.push(rec);while(worldState.companionInitiatives.length>20)worldState.companionInitiatives.shift();cs.initiativeTurn=turn;return rec;
}
// The freshest act inside the window, or null.
function companionInitiativeRecent(){var ws=(typeof worldState!=="undefined")?worldState:null;if(!ws||!ws.companionInitiatives||!ws.companionInitiatives.length)return null;var r=ws.companionInitiatives[ws.companionInitiatives.length-1],every=(typeof COMPANION_INITIATIVE_EVERY==="number")?COMPANION_INITIATIVE_EVERY:12;return (ws.turn-(r.turn||0)<every)?r:null;}
function agendaFile(cs,want,kind,source,turn){
  if(!cs||!want)return null;var rec={want:String(want).trim().slice(0,160),kind:agendaKindOf(kind),source:source||"gm",born:turn};
  if(!cs.agenda){rec.since=turn;rec.lastBeat=(typeof clockNow==="function")?clockNow():0;cs.agenda=rec;return "active";}
  if(!cs.agendaQueue)cs.agendaQueue=[];cs.agendaQueue.push(rec);return "silent";
}
// Complete the ACTIVE want (no fragment) — the oldest silent one is promoted and the announce note armed —
// or resolve a SILENT want early by fragment (the Spike case): filed to history, nothing promoted.
function agendaComplete(cs,fragment,turn,how){
  if(!cs)return null;if(!cs.agendaHistory)cs.agendaHistory=[];var f=String(fragment||"").trim().toLowerCase(),i;
  if(f&&cs.agendaQueue&&cs.agendaQueue.length){for(i=0;i<cs.agendaQueue.length;i++){if(String(cs.agendaQueue[i].want).toLowerCase().indexOf(f)>=0){var q=cs.agendaQueue.splice(i,1)[0];q.done=turn;q.how=how||"resolved before its turn";cs.agendaHistory.push(q);return {done:q.want,promoted:null,early:true};}}}
  if(!cs.agenda)return null;var a=cs.agenda;a.done=turn;a.how=how||"fulfilled";cs.agendaHistory.push(a);cs.agenda=null;var next=null;
  if(cs.agendaQueue&&cs.agendaQueue.length){next=cs.agendaQueue.shift();next.since=turn;next.lastBeat=(typeof clockNow==="function")?clockNow():0;cs.agenda=next;}
  return {done:a.want,promoted:next?next.want:null,early:false};
}
// The blueprint's seed rides the roster (game.js seed) and is adopted onto a sheet that has no want yet —
// called once per committed turn, idempotent. Returns how many were adopted.
function agendaAdoptSeeds(){
  var party=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[],i,n=0;
  for(i=0;i<party.length;i++){var np=party[i],cs=np.charSheet;if(!cs||cs.agenda||(cs.agendaQueue&&cs.agendaQueue.length)||(cs.agendaHistory&&cs.agendaHistory.length))continue;
    if(np.agenda){agendaFile(cs,np.agenda,np.agendaKind,"blueprint",worldState.turn);delete np.agenda;delete np.agendaKind;n++;}}
  return n;
}
// The birth roll: at a defining moment, 1 in 4 (AGENDA_BIRTH_CHANCE) that ONE present companion — the moment's
// subject when they are a companion, else one at random — gains a new want born of it. One birth per moment.
function agendaBirthMaybe(kind,who,text){
  if(!worldState||worldState.agendaBirth)return null;
  var party=(typeof presentCompanions==="function")?presentCompanions():[],i,pick=null;if(!party.length)return null;
  for(i=0;i<party.length;i++)if(party[i].name===who){pick=party[i];break;}
  if(!pick)pick=party[Math.floor(_agendaRoll()*party.length)%party.length];
  if(_agendaRoll()>=((typeof AGENDA_BIRTH_CHANCE==="number")?AGENDA_BIRTH_CHANCE:0.25))return null;
  worldState.agendaBirth={name:pick.name,moment:String(text||kind).slice(0,200),kind:kind,turn:worldState.turn};return worldState.agendaBirth;
}
// The sheet's Wants section — readable only (no inputs by contract).
function agendaSheetHtml(cs){
  if(!cs||(!cs.agenda&&!(cs.agendaQueue&&cs.agendaQueue.length)&&!(cs.agendaHistory&&cs.agendaHistory.length)))return "";
  var h="<div class='cs-list'>",i;
  if(cs.agenda)h+="<div class='cs-list-row'><b>"+escHtml(cs.agenda.want)+"</b> <span style='color:var(--t2);font-size:11px;'>"+escHtml(cs.agenda.kind)+" · since t"+cs.agenda.since+"</span></div>";
  for(i=0;i<(cs.agendaQueue||[]).length;i++)h+="<div class='cs-list-row' style='opacity:.7;'>"+escHtml(cs.agendaQueue[i].want)+" <span style='color:var(--t2);font-size:11px;'>later · "+escHtml(cs.agendaQueue[i].kind)+"</span></div>";
  for(i=0;i<(cs.agendaHistory||[]).length;i++)h+="<div class='cs-list-row' style='color:var(--t2);text-decoration:line-through;'>"+escHtml(cs.agendaHistory[i].want)+" <span style='font-size:11px;text-decoration:none;'>t"+cs.agendaHistory[i].done+"</span></div>";
  return h+"</div>";
}
// #319 plot armor (owner ruling 2026-09-03: derived with override). The blueprint's per-NPC `armor`
// field, normalized: "none" strips derived armor; an act number grants it until that act opens;
// anything else (blank, "auto") leaves derivation to the skeleton (plotArmor, identity.js). Pure.
function seedArmor(n){var v=n&&n.armor;if(v==null)return undefined;v=String(v).trim().toLowerCase();if(v==="none"||v==="off"||v==="no")return "none";if(/^\d+$/.test(v)&&Number(v)>0)return Number(v);return undefined;}
// Where a local save is about to land (owner call 2026-09-03, the missing Iron Meridian save): the
// modal must say the FOLDER, not just the file. Browsers expose a picked folder's NAME only (never its
// path) and nothing at all about Downloads, so this is the most a page can truthfully say. Pure.
//   folderName  — the live campaign folder handle's name, or null
//   pendingName — a folder restored from IndexedDB but not yet re-permissioned this session, or null
//   hasPicker   — window.showDirectoryPicker exists (desktop Chromium); false on mobile/Firefox
// #336 (owner ruling 2026-09-04): the owner picks the CAMPAIGNS folder once; each campaign lives in its own
// slugged subfolder beneath it, derived from the campaign name at write time. This is the label every host
// shows ("Campaigns/The_Iron_Meridian__Gazz_Quickfuse_"); slugging matches ui-files' _slugFolderName.
function campaignFolderLabel(rootName,campName){
  if(!rootName)return "";
  return rootName+"/"+String(campName||"Campaign").replace(/[^a-zA-Z0-9_\-]/g,"_");
}
function saveDestination(folderName,pendingName,hasPicker,sub){
  sub=sub||"saves";
  if(folderName)return {kind:"folder",text:folderName+"/"+sub+"/"};
  if(pendingName)return {kind:"pending",text:pendingName+"/"+sub+"/ (reconnects on Save)"};
  return {kind:"downloads",text:"your browser's Downloads folder"+(hasPicker?" — File ▸ Set campaigns folder to keep saves with the campaign":"")};
}
// Side-panel quick action (owner call 2026-09-03): the phrase a click on a spell or ability drops
// into the input, or null when the thing is passive and there is nothing to DO. Spells → "Cast X.";
// active abilities → "Use X.". Passive = the bible says cost:"passive", or (GM-authored, uncanonized)
// the description calls itself passive / always on. Pure; both panels render through it.
function capabilityQuickText(nm,ds){
  nm=String(nm||"").trim();if(!nm)return null;
  var e=(typeof capabilityLookup==="function")?capabilityLookup(nm):null;
  if(e){if(/^passive/i.test(String(e.cost||"")))return null;return (e.kind==="spell"?"Cast ":"Use ")+nm+".";}
  if(/\b(passive|always[- ]on)\b/i.test(String(ds||"")))return null;
  return "Use "+nm+".";
}
// Render status line (owner call 2026-09-03): ALWAYS names the image model, in every seed case.
// One builder for doRender's three states; the elapsed ticker appends seconds to whatever it returns.
function renderStatusText(mdlCfg,sc,isMulti,usingI2I){
  var label=(mdlCfg&&mdlCfg.label)||"the image model",urls=(sc&&sc.urls)||[],om=(sc&&sc.omitted)||[];
  if(usingI2I)return (isMulti&&urls.length>1)?("Generating party scene on "+label+" ("+urls.length+" portraits seeded"+(om.length?" — "+om.join(", ")+" by description":"")+")…"):("Generating scene on "+label+" (player portrait seeded)…");
  if(sc&&sc.textOnly)return "Generating party scene on "+label+" (text-only — only Nano Banana 2 composes a party from portraits)…";/* #208 ②: say why no portrait seeded */
  return "Generating image on "+label+"…";
}
function resolveRenderModel(storedId){
  if(storedId){
    var i;for(i=0;i<RENDER_MODELS.length;i++){if(RENDER_MODELS[i].id===storedId)return storedId;}
    if(typeof console!=="undefined")console.warn("[render] stored model '"+storedId+"' is no longer offered — falling back to "+renderModel);
  }
  return renderModel;
}
var IMG_STYLE_SUFFIX="Dark fantasy concept art, painterly realism, cinematic composition, dramatic volumetric lighting, warm firelight and cool shadow contrast, ultra-detailed leather and cloth textures, realistic skin pores and fabric weave, rich atmospheric depth, high-end RPG key art, fantasy illustration, moody color grading, sharp focus, intricate craftsmanship, epic yet grounded realism, 8k detail.";
function withImgStyle(p){p=p||"";if(p.indexOf(IMG_STYLE_SUFFIX)>=0)return p;return p.replace(/\s+$/,"")+" "+IMG_STYLE_SUFFIX;}
// AUDIT_FABLE_07_16 #15③: THE initials derivation for every avatar/monogram — moved verbatim
// from ui-sheets.js so all surfaces (sheets, browsers, wizard review, companion slots) share
// one copy. The per-word `w[0]||""` guard matters: without it a double-space name renders the
// string "undefined" into the avatar (the former ui-browsers import-preview copy's bug).
function csInitials(name){return(name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";}
// Enhance pass (✨): re-grade a FINISHED scene render through img2img to buy the dramatic, painterly,
// high-contrast look an aggressive editor (e.g. GPT-image) gets on a second pass over the same image.
// Reuses the scene prompt + this directive; run on Flux img2img at ENHANCE_STRENGTH — moderate, so the
// composition and likenesses survive while lighting, contrast, and texture get pushed hard.
var ENHANCE_DIRECTIVE="Dramatically relight and colour-grade this scene as high-end cinematic concept art: strong directional key light with warm rim-light and deep, crushed shadows, rich chiaroscuro contrast, moody atmospheric haze, heightened painterly texture and fine detail, film-grade colour grading. Preserve the existing composition, characters, and their likenesses.";
var ENHANCE_STRENGTH=0.45;
// #163b: fal.ai failures carry the REAL complaint in the response body ({detail:[{loc,msg}]}
// validation arrays, or a detail string) — the old bare "fal.ai HTTP 422" cost a live round
// trip to learn WHICH field failed (the bare loras[].path id). Pure string builder so it's
// engine-testable; the three fal fetch sites await res.text() and route through here.
// Clamped + whitespace-collapsed: this lands in one-line status displays, not logs.
// #381: the server's weekly image allowance refusal — {error:"render-allowance", used, cap, resetsAt, message}.
// Pure: null unless the body is that payload. The friendly text is the server's own message.
function falAllowanceInfo(status,bodyText){
  if(status!==429||!bodyText)return null;try{var j=JSON.parse(String(bodyText));if(j&&j.error==="render-allowance")return {used:j.used,cap:j.cap,resetsAt:j.resetsAt||null,message:String(j.message||"Your included images this week are used up.")};}catch(e){}return null;
}
// #381: before the call — the account readout already knows; a player at the cap is told without a round trip.
function renderAllowanceExhausted(){var a=(typeof serverAccount!=="undefined"&&serverAccount&&serverAccount.renders)||null;if(!a||a.exempt)return null;if(typeof falKey!=="undefined"&&falKey)return null;if(!(typeof falViaServer==="function"&&falViaServer()))return null;return a.remaining<=0?a:null;}
function falErrorMsg(status,bodyText){
  var al=falAllowanceInfo(status,bodyText);if(al)return al.message;/* #381: never "fal.ai HTTP 429" for a player who simply used their week */
  var msg="fal.ai HTTP "+status;
  if(bodyText){
    var d=String(bodyText);
    try{var j=JSON.parse(d);if(j&&j.detail!=null)d=typeof j.detail==="string"?j.detail:JSON.stringify(j.detail);}catch(e){}
    d=d.replace(/\s+/g," ").trim();
    if(d)msg+=" — "+(d.length>220?d.slice(0,220)+"…":d);
  }
  return msg;
}
// ── #161: "⟳ Update from library" — the identity-field pull ───────────────────
// THE whitelist of fields the library pull may touch, as a REGISTRY (an editor-era
// field lands as one entry). Everything else is deliberately excluded: the library
// copy is a SNAPSHOT (often at export-time level — Daeris can sit there at Lv3 while
// she is Lv9 in play), so progression and play-earned state (level/xp/stats/class/
// archetype/hp/gold/inventory/spells/abilities/skills/conditions/relationships/
// languages/coreMemories/voiceId) must never flow; and `name` is the identity KEY
// everywhere (library slug, worldState keys, relationship entities) — renames are
// #156 identity-layer territory, never a field copy.
// Skip rules (schema-age tolerance): a lib field that is undefined skips — an old
// export missing a field must never delete live data; an explicit "" applies (a
// deliberate editor clear); `skipEmpty` fields (portrait) also skip null/"" — a
// portrait-less library copy never strips a live portrait (removal belongs to the
// portrait modal); per-field `valid` gates schema-constrained values.
var LIB_UPDATE_FIELDS=[
  {k:"gender",label:"Gender",valid:function(v){return v==="M"||v==="F"||v==="NB";}},
  {k:"age",label:"Age"},
  {k:"appear",label:"Appearance"},
  {k:"mark",label:"Distinguishing mark"},
  {k:"backstory",label:"Backstory"},
  {k:"trait",label:"Trait"},
  {k:"flaw",label:"Flaw"},
  {k:"motivation",label:"Motivation"},
  {k:"deity",label:"Deity"},
  {k:"portrait",label:"Portrait",kind:"image",skipEmpty:true},
  {k:"portraitOffset",label:"Portrait framing",kind:"json"}
];
function _libFieldEq(kind,a,b){
  if(kind==="json")return JSON.stringify(a||null)===JSON.stringify(b||null);
  return (a==null?"":a)===(b==null?"":b);
}
// Pure: rows of {k,label,kind,from,to} for every whitelisted field the library copy
// would change. Empty array = the sheet already matches (callers surface that LOUDLY).
function libUpdateDiff(cur,lib){
  var out=[],i,f,lv;
  if(!cur||!lib)return out;
  for(i=0;i<LIB_UPDATE_FIELDS.length;i++){
    f=LIB_UPDATE_FIELDS[i];lv=lib[f.k];
    if(lv===undefined)continue;
    if(f.skipEmpty&&(lv===null||lv===""))continue;
    if(f.valid&&!f.valid(lv))continue;
    if(_libFieldEq(f.kind,cur[f.k],lv))continue;
    out.push({k:f.k,label:f.label,kind:f.kind||"text",from:cur[f.k],to:lv});
  }
  return out;
}
// Applies exactly what libUpdateDiff reports (recomputed here so a preview and its
// apply can never drift) and returns the applied rows. Object values land as fresh
// copies — the live sheet must never share a reference with the library object.
function libUpdateApply(cur,lib){
  var d=libUpdateDiff(cur,lib),i,row;
  for(i=0;i<d.length;i++){
    row=d[i];
    cur[row.k]=(row.kind==="json"&&row.to!=null)?JSON.parse(JSON.stringify(row.to)):row.to;
  }
  return d;
}
// B3 (v1.361): NPC death is FIRST-CLASS canon — worldState.npcs[].dead / memory.npcs[].dead =
// death turn (number), or true when the death predates the flag (legacy migration). Detection is
// deliberately conservative: word-boundary death words MINUS living idioms ("half-dead, bleeding
// out" is a LIVING NPC; "wants you dead" is a mood about someone else; "playing dead" is a ruse).
// "killed" alone is NOT a death word — "killed the mayor" describes a killer, not a corpse.
// The ONE detection — the [NPC:] handler, migration, and the summarize backstop all route here.
var NPC_DEAD_RE=/\b(dead|slain|deceased|perished)\b/i;
var NPC_DEAD_EXCLUDE_RE=/(?:half|near|nearly|almost|mostly)[- ]dead|left for dead|presumed dead|playing dead|feign|not dead|dead\s+(?:tired|drunk|set|serious|inside|calm|man|men)\b|wants?\s+\S+\s+dead|dead\s+to\s+/i;
var NPC_RESURRECT_RE=/\b(resurrect(?:ed|ion)?|raised from the dead|alive again|returned? to life|restored to life|back from the dead|revived)\b/i;
function npcDeadStatus(status){var s=String(status||"");if(!s)return false;if(NPC_RESURRECT_RE.test(s))return false;/* "raised from the dead" contains a death word — resurrection phrasing is never a death */if(NPC_DEAD_EXCLUDE_RE.test(s))return false;return NPC_DEAD_RE.test(s);}
// The flag is authoritative; the status fallback covers writes that bypass the stamp — chiefly a
// server blob written by an OLDER app version mid-session (cross-device skew), where a companion
// died with status-only. Same detection either way — never a second regex.
function npcIsDead(n){return !!(n&&(n.dead||npcDeadStatus(n.status)));}
// #156 Phase A: is this npc key a PROVISIONAL identity (the create-distinct collision outcome —
// a suspect write parked in "Name °tN" so it never fuses into the established record)? The
// record's .provisional stamp is the authority; the ° key pattern is the belt-and-braces
// fallback for a record the stamp got stripped from (e.g. a hand-edited save). Never a second
// detection elsewhere — the #128 scan, the merge alias-suppression, and the nudge all call this.
function npcIsProvisional(name){
  if(typeof memory!=="undefined"&&memory&&memory.npcs&&memory.npcs[name]&&memory.npcs[name].provisional)return true;
  return / °t\d+$/.test(String(name||""));
}
// #156 Phase A: canonicalize a route name's endpoint pair to ONE fixed order (the #153 class:
// "Varisia - North Road" carried two different roads because direction/endpoints lived only in
// prose; an endpoint-ORDERED name re-fragments the moment the party travels it backwards —
// Sol §7). Gated on route nouns so ordinary parentheticals are never rewritten; splits ONLY on
// en/em dash or a SPACED hyphen, so hyphenated names ("Xin-Shalast", "Half-Sunk") stay whole.
// Output always uses the en-dash form the NAMING clause teaches. Pure; callers are the
// [LOCATION:] and [PARTY_SPLIT:] write boundaries (tag_table.js).
var ROUTE_NOUN_RE=/\b(road|pass|trail|way|route|track|crossing|bridge|highway|causeway)\b/i;
function normalizeEndpointPair(name){
  var s=String(name==null?"":name);
  var m=s.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if(!m||!ROUTE_NOUN_RE.test(m[1]))return s;
  var inner=m[2],parts=inner.split(/\s*[–—]\s*/);
  if(parts.length!==2)parts=inner.split(/\s+-\s+/);
  if(parts.length!==2)return s;
  var a=parts[0].trim(),b=parts[1].trim();
  if(!a||!b)return s;
  var flip=a.toLowerCase()>b.toLowerCase();
  return m[1].trim()+" ("+(flip?b:a)+"–"+(flip?a:b)+")";
}
// AUDIT_FABLE_07_16 #6: THE party-companion scan — partyMember NPCs that carry a charSheet, in
// worldState.npcs order. includeDead=true skips the dead filter: a handful of call sites
// (restSpells, the [XP:] mirror, syncCharSheet, and the snapshot/consume passes) historically
// had NO dead check — each routes through includeDead=true with a marker comment, preserving
// today's behavior until the user rules on whether dead companions earn XP/rest/audit.
// B3: the dead filter reads the durable flag, not the status regex — a "half-dead, bleeding out"
// companion is ALIVE and no longer silently excluded.
// #137 stay-behind watcher — the PURE half (game.js commitGmTurn calls it on the raw response).
// Detects a party member narrated as staying behind / separating only when the name is the
// clause-local subject (or owns an explicit first-person commitment), plus named departures and
// a pronoun departure whose preceding clause names exactly one party member. Possessives,
// plans/commands, and "with us/the party" remain silent. KNOWN MISS, by design:
// separations narrated without any stay-verb (Morwen sealing the door from outside, t1457)
// are invisible here — that class belongs to buildPresenceAudit, the deterministic sibling.
// Returns the first matching name or null. Never fires when the response already carries a
// [PARTY_SPLIT:] (the caller checks — a tagged separation needs no nudge).
function _partyNameForms(name){var a=[String(name)],f=String(name).split(/\s+/)[0];if(f&&f!==name)a.push(f);return a;}
function _partyNameHits(text,partyNames){
  var out=[],seen={},i,j,m,forms,esc,re;
  for(i=0;i<partyNames.length;i++){
    forms=_partyNameForms(partyNames[i]);
    for(j=0;j<forms.length;j++){
      esc=forms[j].replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&");re=new RegExp("\\b"+esc+"\\b","gi");
      while((m=re.exec(text))){
        if(j>0&&seen[i+"|"+m.index])continue;
        seen[i+"|"+m.index]=1;out.push({name:partyNames[i],form:forms[j],at:m.index,end:m.index+m[0].length});
      }
    }
  }
  out.sort(function(a,b){return a.at-b.at;});return out;
}
function _partyClauseSeparation(clause,partyNames){
  if(/^\s*(?:["“”]\s*)?(?:if|unless|should|would|could)\b/i.test(clause))return null;
  var hits=_partyNameHits(clause,partyNames),i,j,h,tail,vm,gap,after,esc,attr,firstPerson,otherSubject;
  for(i=0;i<hits.length;i++){
    h=hits[i];
    if(/^['’]s\b/i.test(clause.slice(h.end)))continue;
    tail=clause.slice(h.end);
    vm=tail.match(/^([^.!?;]{0,45}?)(?:(?:stay(?:s|ing)|remain(?:s|ing)|wait(?:s|ing))[\s,]+(?:behind|here|there|put|at\b|outside|below|above|by\b)|hang(?:s|ing)?\s+back|keep(?:s|ing)?\s+watch|left\s+behind|isn['’]?t\s+coming|is\s+not\s+coming|not\s+coming\s+(?:along|down|inside)|leaves|left(?=\s+(?:the|for)\b)|(?:has|had)\s+left\b|depart(?:s|ed)|is\s+gone|(?:rides|rode)\s+ahead|heads\s+back|goes\s+ahead)/i);
    /* #481 B5 (audit 2026-09-29): a bare "left" is a SIDE, not a departure — "settles in along your left", "at your left",
       "the residue left along the plinth" were six of six field alarms. "left" counts only with a departure complement
       ("left the", "left for", "has left") AND only when nothing but an auxiliary or an adverb stands between the name and
       it (a noun before "left" is that noun's verb — "the mule left the yard"). */
    if(vm&&/\bleft\b/i.test(vm[0].slice(vm[1].length))&&!/^\s*(?:(?:has|had|just|already|quietly|finally|then|now|silently|abruptly|simply|soon|,)\s*)*$/i.test(vm[1]))vm=null;
    if(vm){
      gap=vm[1];after=tail.slice(vm.index+vm[0].length);
      otherSubject=false;for(j=0;j<hits.length;j++){if(hits[j].at>h.at&&hits[j].at<h.end+gap.length){otherSubject=true;break;}}
      if(!otherSubject&&!/\b(?:to|may|might|will|would|could|should|if|unless|she|he|they)\b/i.test(gap)&&
         !/\bwith\s+(?:us|the\s+party)\b/i.test(vm[0]+after.slice(0,35)))return h.name;
    }
    esc=String(h.form||h.name).replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&");
    attr=new RegExp("(?:\\b"+esc+"\\b\\s+(?:says?|said|answers?|answered|murmurs?|murmured)|(?:says?|said|answers?|answered|murmurs?|murmured)\\s+\\b"+esc+"\\b)","i");
    firstPerson=/["“]\s*I(?:['’]ll|\s+will|\s+am\s+going\s+to)?\s+(?:stay|remain|wait)\b/i;
    if(attr.test(clause)&&firstPerson.test(clause))return h.name;
  }
  return null;
}
function detectStayBehind(text,partyNames){
  var t=String(text||"");if(!t||!partyNames||!partyNames.length)return null;
  var clauses=t.match(/[^.!?;\n]+[.!?;]*/g)||[],i,hit;
  for(i=0;i<clauses.length;i++){hit=_partyClauseSeparation(clauses[i],partyNames);if(hit)return hit;}
  for(i=1;i<clauses.length;i++){
    if(!/^\s*(?:then\s+)?(?:she|he|they)\s*(?:is|['’]s|are|['’]re)\s+gone\b/i.test(clauses[i]))continue;
    var ph=_partyNameHits(clauses[i-1],partyNames),uniq={},names=[],j;
    for(j=0;j<ph.length;j++){if(!uniq[ph[j].name]){uniq[ph[j].name]=1;names.push(ph[j].name);}}
    if(names.length===1)return names[0];
  }
  return null;
}
/* #189ⓐ (t1827: "You two get some sleep, Friz and I can deliver it"): the split machinery is
   edge-triggered by GM tags, so a re-departure declared in the PLAYER'S OWN INPUT had no engine
   path — the roster read everyone present and the GM later confabulated from it (Morwen's hand
   on a sword she doesn't carry). The player-input twin of detectStayBehind: narrow, rejection-
   first (the #158 precision discipline), name-or-subgroup anchored. Returns {names:[...]} —
   names may be EMPTY for a nameless subgroup directive ("you two"), the GM resolves who — or
   null. Quotes are NOT a rejection here: player input IS first-person intent, and dialogue
   aimed at companions is exactly the signal. */
function detectPlayerStayBehind(text,partyNames){
  var t=String(text||"");if(!t)return null;
  var clauses=t.match(/[^.!?;\n]+[.!?;]*/g)||[],i;
  var STAY=/\b(?:stay(?:s)?(?:\s+behind|\s+here|\s+put)?|wait(?:s)?(?:\s+here|\s+behind)?|remain(?:s)?|rest(?:s)?(?:\s+up)?|sleep(?:s)?|get\s+some\s+(?:sleep|rest)|hang\s+back|turn\s+in)\b/i;
  for(i=0;i<clauses.length;i++){
    var c=clauses[i];
    if(/\?\s*$/.test(c))continue;                                                        /* questions propose, not direct */
    if(/\b(?:don['’]?t|do\s+not|no\s+one|nobody|won['’]?t|can['’]?t|never)\b/i.test(c))continue;  /* negation */
    var sm=c.match(STAY);
    if(sm){
      var pre=c.slice(0,sm.index),post=c.slice(sm.index+sm[0].length,sm.index+sm[0].length+24);
      if(/^\s*(?:close|beside|with\s+(?:me|us))/i.test(post))continue;                   /* "stay close / with me" = accompany */
      if(/\b(?:I(?:['’]ll)?|we(?:['’]ll|['’]re)?(?:\s+all)?|let['’]s(?:\s+all)?|us)\s*$/i.test(pre))continue; /* player-self or whole-party rest — no split */
      if(/\b(?:you\s+two|you\s+both|you\s+three|the\s+rest\s+of\s+you|everyone\s+else)\b[^,]*$/i.test(pre))return {names:[]};
      if(partyNames&&partyNames.length&&typeof _partyNameHits==="function"){
        var hits=_partyNameHits(pre,partyNames),uniq={},names=[],j;
        for(j=0;j<hits.length;j++){if(!uniq[hits[j].name]){uniq[hits[j].name]=1;names.push(hits[j].name);}}
        if(names.length)return {names:names};
      }
      continue;
    }
    /* exclusive continuation: "<Name> and I can/will <motion>" — the complement stays, nameless
       from the engine's seat. Party >1 required (someone must exist to stay). */
    if(partyNames&&partyNames.length>1&&typeof _partyNameHits==="function"){
      var em=c.match(/\b(?:just\s+|only\s+)?(\S[^,]{0,30}?)\s+and\s+I\b\s*(?:can|will|['’]ll|shall|should|am\s+going\s+to|are\s+going\s+to)?\s*(?:go|head|take|deliver|bring|carry|walk|ride|run|slip|sneak|scout|visit|return|handle|make|set\s+out|do)\b/i);
      if(em&&_partyNameHits(em[1],partyNames).length===1)return {names:[]};
    }
  }
  return null;
}
/* #189ⓑ (t1833: "Morwen's hand rests near Cleaver's hilt out of old habit" — Cleaver lives ONLY
   on Ammut's sheet and Morwen carries no sword): prose item-owner binding had no guard anywhere.
   Narrow committed-prose scan: a DISTINCTIVE item (capitalized-as-stored base name owned by
   exactly ONE party sheet) attributed to a DIFFERENT party member, by direct genitive
   ("Morwen's Cleaver") or possession-by-handling ("Morwen's hand ... Cleaver"). Rejection-first:
   quoted sentences skip (characters may misspeak), a sentence that also names the true owner's
   genitive skips (attribution is present — a hand brushing Ammut's Cleaver is fine), lowercase
   gear and shared items never index. Case-SENSITIVE item match ("cleaver" the noun never fires).
   Returns {wrong, item, owner} or null. Never rewrites — the nudge is GM-decides. */
function detectItemMisattribution(text){
  var t=String(text||"");if(!t||typeof worldState==="undefined"||!worldState||!worldState.character)return null;
  var reEsc=function(s){return String(s).replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&");};
  var sheets=[{name:worldState.character.name||"",inv:worldState.character.inventory||[]}],i,j,k;
  var comps=(typeof partyCompanionsWithSheets==="function")?partyCompanionsWithSheets():[];
  for(i=0;i<comps.length;i++)sheets.push({name:comps[i].name,inv:(comps[i].charSheet&&comps[i].charSheet.inventory)||[]});
  if(sheets.length<2)return null;
  for(i=0;i<sheets.length;i++){var fn=String(sheets[i].name).split(/\s+/)[0];sheets[i].forms=fn&&fn!==sheets[i].name?[sheets[i].name,fn]:[sheets[i].name];}
  var owners={};
  for(i=0;i<sheets.length;i++)for(j=0;j<sheets[i].inv.length;j++){
    var base=(typeof _invBase==="function")?_invBase(sheets[i].inv[j]):String(sheets[i].inv[j]);
    if(!/^[A-Z]/.test(base))continue;
    if(!owners[base])owners[base]=[];
    if(owners[base].indexOf(sheets[i].name)<0)owners[base].push(sheets[i].name);
  }
  var sents=t.match(/[^.!?\n]+[.!?]*/g)||[];
  for(i=0;i<sents.length;i++){
    var s=sents[i];
    if(/["“”]/.test(s))continue;
    for(var item in owners){
      if(owners[item].length!==1||s.indexOf(item)<0)continue;
      var owner=owners[item][0],ownerSheet=null;
      for(j=0;j<sheets.length;j++)if(sheets[j].name===owner)ownerSheet=sheets[j];
      var ownerNamed=false;
      for(k=0;k<ownerSheet.forms.length;k++)if(new RegExp("\\b"+reEsc(ownerSheet.forms[k])+"['’]s\\b").test(s)){ownerNamed=true;break;}
      if(ownerNamed)continue;
      var itemEsc=reEsc(item);
      for(j=0;j<sheets.length;j++){
        if(sheets[j].name===owner)continue;
        for(k=0;k<sheets[j].forms.length;k++){
          var wEsc=reEsc(sheets[j].forms[k]);
          if(new RegExp("\\b"+wEsc+"['’]s\\s+(?:\\w+\\s+){0,2}?"+itemEsc).test(s)||
             new RegExp("\\b"+wEsc+"['’]s\\s+(?:hands?|fingers?|grip|palm|fist)\\b[^.!?]{0,40}?"+itemEsc).test(s))
            return {wrong:sheets[j].name,item:item,owner:owner};
        }
      }
    }
  }
  return null;
}
// #368: a story-box action that opens GM:/OOC: is an out-of-character ask — answered in the fiction, never charged on the clock.
function oocActionPrefix(t){return /^\s*(?:GM|OOC)\s*:/i.test(String(t||""));}
function detectPartyAbsenceCorrection(text,partyNames){
  var t=String(text||"");if(!/^\s*(?:GM|OOC)\s*:/i.test(t)||!partyNames||!partyNames.length)return null;
  var hits=_partyNameHits(t,partyNames),i,h,tail;
  for(i=0;i<hits.length;i++){
    h=hits[i];if(/^['’]s\b/i.test(t.slice(h.end)))continue;tail=t.slice(h.end,h.end+80);
    if(/^\s+(?:(?:(?:is|was)\s+(?:(?:currently\s+)?not|not\s+currently|no\s+longer)|isn['’]?t|wasn['’]?t)\s+(?:with\s+(?:us|the\s+party)|here\b|present\b|in\s+this\s+scene\b)|(?:is|was)\s+absent\b)/i.test(tail))return h.name;
  }
  return null;
}
// #231 (the arc wall): the two pure predicates the wall rests on. A quest is EMERGENT when its
// title matches no arc in the skeleton — any act, any status: a spine-titled quest belongs to the
// authored story and must never be swept by its own arc completing. skeletonArcTitles() is the
// single source both the stamp and the sweep read, so they can never disagree about what "spine"
// means (the two-surfaces-drift class).
function skeletonArcTitles(){
  var out={},sk=(typeof worldState!=="undefined"&&worldState&&worldState.skeleton)||null,i,j;
  if(!sk||!sk.acts)return out;
  for(i=0;i<sk.acts.length;i++){var arcs=sk.acts[i].arcs||[];for(j=0;j<arcs.length;j++){if(arcs[j].title)out[String(arcs[j].title).toLowerCase()]=1;}}
  return out;
}
function questIsEmergent(title){
  if(!title)return false;
  return !skeletonArcTitles()[String(title).toLowerCase()];
}
// The arc a quest born RIGHT NOW belongs to: the single active arc of the single active act.
// Returns null under ambiguity (no skeleton, no active act, or a PARALLEL act with several arcs
// live) — an unstamped quest is immune to the wall, and guessing a parent would sweep innocents.
function currentArcTitle(){
  var sk=(typeof worldState!=="undefined"&&worldState&&worldState.skeleton)||null,i,j;
  if(!sk||!sk.acts)return null;
  var act=null;
  for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="active"){act=sk.acts[i];break;}}
  if(!act||!act.arcs)return null;
  var live=[];
  for(j=0;j<act.arcs.length;j++){if(act.arcs[j].status==="active")live.push(act.arcs[j]);}
  return live.length===1?live[0].title:null;
}
// #235 (JP0-3 part A; Fable f3 + f12; owner rulings 2026-08-28) — WHO abandoned it.
// "abandoned" has three authors and one status: the player's own Abandon button (#229 →
// abandonQuestState stamps by:"player"), the #231 arc wall closing a live thread with its parent
// arc (by:"wall"), and that same sweep archiving an OFFERED hook the player never accepted
// (by:"wall" + wasOffered:true — a third semantic that used to hide under the same label).
// This is THE renderer for every reader: the reopen guard's warn + muts line (which is what the
// #229 decisions modal shows), and the Quest Journal's History line. A record with NO `by` is
// LEGACY — pre-#235 saves cannot know their own author, so they render neutrally and must never
// be read as a player drop. Pure: no state, no DOM.
function questArchiveWording(rec){
  var by=(rec&&rec.by)||"";
  if(by==="wall"){
    return (rec&&rec.wasOffered)
      ? {origin:"lapsed",label:"opportunity lapsed",phrase:"lapsed with the arc that raised it"}
      : {origin:"wall",label:"closed with the arc",phrase:"closed with the arc that began it"};
  }
  if(by==="player")return {origin:"player",label:"abandoned by you",phrase:"was abandoned by you"};
  return {origin:"unknown",label:"abandoned",phrase:"was abandoned"};
}
function partyCompanionsWithSheets(includeDead){
  var out=[],ns=(typeof worldState!=="undefined"&&worldState&&worldState.npcs)||[],i;
  for(i=0;i<ns.length;i++){var n=ns[i];if(n&&n.partyMember&&n.charSheet&&(includeDead||!npcIsDead(n)))out.push(n);}
  return out;
}
// Living party companions — partyMember NPCs that carry a charSheet and are not dead. The party-aware
// scene render iterates this to describe (all models) and seed portraits (Nano Banana 2 only). Returns
// the worldState.npcs entries; charSheet holds the v10 sheet, npcPortrait() the image.
function livingPartyCompanions(){return partyCompanionsWithSheets(false);}
/* #470 (owner 2026-09-27): ONE click uploads the whole party to the character library. The plan is pure — the hero
   first, then every living companion with a sheet, each marked with the library entry it would overwrite (matched by
   the same slug the single-character export uses) — and the run is a callback chain over an injected save function
   so the engine can test it with a mock adapter. Every row goes through portableSheet (the #81b item canon travels);
   a failure is recorded and the chain continues — the report lists saved, updated and failed by name. */
function partyUploadSlug(name){return LibrarySlug.library(name);}/* #481 F5: the ONE slug the server vendors (library-slug.js) */
/* #481 F7 (audit 2026-09-29): the plan also says which library copies are AHEAD of the live sheet (partyUploadAhead — the #427
   hazard: the confirm listed names only), and REFUSES party members whose names map to one library slot (they used to
   overwrite each other). heroAt = worldState.heroLibraryAt; a companion's stamp is its libraryAt. */
function partyUploadPlan(hero,companions,libraryList,heroAt){
  var rows=[],overwrites=[],ahead=[],refused=[],bySlug={},cand=[],group={},i;
  for(i=0;i<(libraryList||[]).length;i++){var e=libraryList[i];if(e&&e.slug)bySlug[e.slug]=e;}
  if(hero&&hero.name)cand.push({name:hero.name,sheet:hero,at:heroAt});
  for(i=0;i<(companions||[]).length;i++){var c=companions[i];if(c&&c.name&&c.charSheet)cand.push({name:c.name,sheet:c.charSheet,at:c.libraryAt});}
  for(i=0;i<cand.length;i++){var s=partyUploadSlug(cand[i].name);(group[s]=group[s]||[]).push(cand[i]);}
  for(i=0;i<cand.length;i++){
    var x=cand[i],slug=partyUploadSlug(x.name),grp=group[slug];
    if(grp.length>1){if(grp[0]===x)refused.push({slug:slug,names:grp.map(function(g){return g.name;})});continue;}
    var ex=bySlug[slug]||null,row={name:x.name,sheet:x.sheet,existing:ex,ahead:partyUploadAhead(ex,x.sheet,x.at)};
    rows.push(row);if(ex)overwrites.push(x.name);if(row.ahead)ahead.push(x.name);
  }
  return {rows:rows,overwrites:overwrites,ahead:ahead,refused:refused};
}
/* #481 F7: is the library copy ahead of the live sheet — a higher level, or saved after the copy this sheet came from (its
   library stamp)? No stamp means the date cannot say, so only the level does. Null when not ahead. Pure. */
function partyUploadAhead(ex,sheet,at){
  if(!ex)return null;var higher=(ex.level|0)>((sheet&&sheet.level)|0),newer=typeof ex.updatedAt==="number"&&typeof at==="number"&&ex.updatedAt>at;
  return higher||newer?{higher:higher,newer:newer}:null;
}
var PARTY_UPLOAD_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/* #481 F7: the confirm's line for an ahead row — "Ammut: library Lv18, saved Sep 27 → live Lv17". Pure. */
function partyUploadAheadText(row){
  var ex=(row&&row.existing)||{},d=typeof ex.updatedAt==="number"?new Date(ex.updatedAt):null;
  return row.name+": library Lv"+(ex.level|0)+(d?", saved "+PARTY_UPLOAD_MONTHS[d.getMonth()]+" "+d.getDate():"")+" → live Lv"+((row.sheet&&row.sheet.level)|0);
}
function partyUploadRun(plan,saveFn,done){
  var rows=(plan&&plan.rows)||[],report={saved:[],updated:[],failed:[]},i=0;
  function next(){
    if(i>=rows.length){done(report);return;}
    var row=rows[i++];
    saveFn(portableSheet(row.sheet),function(err){
      if(err)report.failed.push({name:row.name,err:String(err)});else if(row.existing)report.updated.push(row.name);else report.saved.push(row.name);
      next();
    });
  }
  next();
}
/* #469 (owner 2026-09-26, the Village lien line): a resident retold a party member's defining moment in the record's own
   words — 21 of 135 GM turns carried "Daeris is free of her lien". buildCoreMemoryBlock serves the record verbatim for the
   party's OWN recall; this scan catches an OUTSIDER voicing it and arms buildMotifNudge (api.js), the do-not-repeat channel
   (the standing lesson: an instruction that loses to the GM's own recent output needs a NEW channel). Pure: (raw reply, the
   served moments, the exempt names = hero + living party) → {speaker,who,gist,words} or null. Only an ATTRIBUTED line
   counts — a [SAY:Name] segment; a SAY-less segment is the narrator's own voice, not a bystander. Names never count as
   content (the exempt list, the speaker and the moment's owner are stripped); a word must be MOTIF_WORD_MIN letters and
   off the stoplist; MOTIF_MIN_WORDS distinct shared words is the bar — the owner's flagged Silas line shares exactly three
   (necrotic, tether, engines), a fresh remark about mint shares none. */
var MOTIF_MIN_WORDS=3,MOTIF_WORD_MIN=4,MOTIF_STRONG_MIN=8,MOTIF_GIST_CHARS=60;/* #469 ⑤: the field retellings kept the SHORT distinctive words (soul, lien, tomb) — a four-letter floor, and at least one shared word of MOTIF_STRONG_MIN letters so everyday domestic words (home, cottage, waiting) never add up to a retelling */
var MOTIF_STOP={before:1,after:1,around:1,through:1,toward:1,towards:1,without:1,between:1,against:1,little:1,people:1,things:1,something:1,morning:1,evening:1,together:1,another:1,because:1,should:1,really:1,always:1,though:1,across:1,beside:1,inside:1,behind:1,having:1,himself:1,herself:1,themselves:1,nothing:1,anything:1,everything:1,someone:1,anyone:1,everyone:1,already:1,almost:1,enough:1,rather:1,whether:1,during:1,within:1,beyond:1,family:1,moment:1,turned:1,looked:1,seemed:1,called:1,wanted:1,needed:1,thought:1,became:1,finally:1,better:1,longer:1,others:1,itself:1,either:1,neither:1,indeed:1,simply:1,quietly:1,gently:1,slowly:1,softly:1,nearly:1,mostly:1,waiting:1,coming:1,making:1,taking:1,giving:1,saying:1,telling:1,asking:1,knowing:1,seeing:1,walking:1,sitting:1,standing:1,holding:1,looking:1,feeling:1,thinking:1,talking:1,leaving:1,with:1,that:1,this:1,from:1,have:1,been:1,were:1,they:1,them:1,than:1,then:1,when:1,what:1,your:1,into:1,over:1,just:1,like:1,some:1,more:1,most:1,very:1,also:1,only:1,even:1,back:1,well:1,good:1,fine:1,know:1,come:1,came:1,take:1,took:1,make:1,made:1,said:1,says:1,went:1,gone:1,here:1,there:1,where:1,which:1,while:1,still:1,about:1,again:1,along:1,away:1,down:1,upon:1,each:1,much:1,many:1,such:1,same:1,both:1,last:1,next:1,first:1,never:1,ever:1,once:1,under:1,until:1,those:1,these:1,their:1,ours:1,yours:1,mine:1,onto:1,near:1,left:1,right:1,kept:1,keep:1,gave:1,give:1,held:1,hold:1,sure:1,true:1,real:1,long:1,high:1,open:1,full:1,half:1,hard:1,soft:1,late:1,early:1,later:1,tonight:1,today:1,yesterday:1,tomorrow:1,night:1,dawn:1,dusk:1,noon:1,hour:1,hours:1,week:1,month:1,year:1,years:1,time:1,times:1,home:1,house:1,door:1,room:1,fire:1,bed:1,table:1,water:1,bread:1,food:1,drink:1,cup:1,hand:1,hands:1,head:1,eyes:1,face:1,voice:1,word:1,words:1,thing:1,life:1,lives:1,world:1,place:1,road:1,lane:1,path:1,way:1,ways:1,glad:1,happy:1,peace:1,rest:1,resting:1,easy:1,light:1,warm:1,cold:1,clear:1,quiet:1,free:1,safe:1,done:1,past:1,old:1,new:1,own:1};
function motifWords(text,exempt){
  var out={},ex={},i;for(i=0;i<(exempt||[]).length;i++){String(exempt[i]||"").toLowerCase().split(/[^a-z]+/).forEach(function(p){if(p)ex[p]=1;});}
  String(text||"").toLowerCase().replace(/[\u2019']s\b/g,"").split(/[^a-z]+/).forEach(function(w){if(w.length>=MOTIF_WORD_MIN&&!MOTIF_STOP[w]&&!ex[w])out[w]=1;});
  return out;
}
/* #469 ④ (owner 2026-09-27, the neighbourly chat still circled the same past): in a small-talk kind the earlier-adventure
   moments are HELD BACK from the moments block — the street talks small (#6 D5), the past belongs to the Hall and to the
   hero's asking — and this is the asking. Pure: (the action, the last PAST_RAISED_TURNS user turns, the party's names, the
   held moments) → true when the hero raises the past: a member's name beside a past cue or beside a word from their record
   ("Ask Daeris about the Reach"), two record words with no name ("what did the tether do to the engines?"), or the hero's
   own past by cue ("my old days"). Her name alone ("Ask Daeris about the weather") raises nothing. The raise carries
   across the window so a conversation about the past keeps its record mid-story. Names never count as record words. */
var PAST_RAISED_TURNS=2,PAST_WORD_MIN=5;
var PAST_CUE_RE=/\b(remember|recall|back then|back when|before (we|you|this|all this)|(your|her|his|their|my|our) (past|old life|old days|story|tale|earlier|last) ?(adventure|life|days|campaign)?|the old days|what happened (to|with|back|before|in)|tell (me|us) (about|of)|how did you|when you were|used to|earlier adventure|first met|how (did |do )?(you|they|he|she|we)( two| both| all)? (first )?(meet|met))\b/i;/* #481 C6: how people met is the past (t92) */
function pastWords(text,ex){var out={};String(text||"").toLowerCase().replace(/[\u2019']s\b/g,"").split(/[^a-z]+/).forEach(function(w){if(w.length>=PAST_WORD_MIN&&!MOTIF_STOP[w]&&!ex[w])out[w]=1;});return out;}
function pastRaisedByHero(action,userTurns,memberNames,priorMoments){
  var texts=[String(action||"")].concat((PAST_RAISED_TURNS>0?(userTurns||[]).slice(-PAST_RAISED_TURNS):[]).map(function(t){return String(t||"");})),i,j,k;/* slice(-0) is slice(0): a zero window must mean none */
  var ex={},firsts=[];(memberNames||[]).forEach(function(n){String(n||"").toLowerCase().split(/[^a-z]+/).forEach(function(p,ix){if(p)ex[p]=1;if(ix===0&&p.length>2)firsts.push(p);});});
  var recordWords={};
  for(i=0;i<(priorMoments||[]).length;i++){var mo=priorMoments[i];if(!mo||!mo.text)continue;var ex2={},w2;for(w2 in ex)ex2[w2]=1;String(mo.who||"").toLowerCase().split(/[^a-z]+/).forEach(function(p){if(p)ex2[p]=1;});var mw=pastWords(mo.text,ex2);for(k in mw)recordWords[k]=1;}
  for(i=0;i<texts.length;i++){
    var t=texts[i];if(!t)continue;var low=t.toLowerCase(),lw=low.replace(/[\u2019']s\b/g,"").split(/[^a-z]+/);
    var named=false;for(j=0;j<firsts.length&&!named;j++)if(lw.indexOf(firsts[j])>=0)named=true;
    var cued=PAST_CUE_RE.test(low),hits=0,seenW={};
    for(j=0;j<lw.length;j++)if(lw[j].length>=PAST_WORD_MIN&&recordWords[lw[j]]&&!seenW[lw[j]]){seenW[lw[j]]=1;hits++;}
    if((named&&(cued||hits>=1))||hits>=2||(cued&&/\b(my|our)\b/.test(low)))return true;
  }
  return false;
}
function detectMomentRetelling(raw,moments,exempt){
  raw=String(raw||"");if(!raw||!moments||!moments.length)return null;
  var ex=(exempt||[]).map(function(n){return String(n||"");}),exl=ex.map(function(n){return n.toLowerCase();}),i,j,best=null;
  var re=/\[SAY:([^\]|]+)(?:\|[^\]]*)?\]([^\[]*)/g,m,segs=[];
  while((m=re.exec(raw))){var sp=m[1].trim();if(sp)segs.push({speaker:sp,text:m[2]});}
  if(!segs.length)return null;
  function firstOf(n){return n.split(/\s+/)[0];}
  for(i=0;i<segs.length;i++){
    var s=segs[i],spl=s.speaker.toLowerCase(),own=false;
    for(j=0;j<exl.length&&!own;j++)if(exl[j]&&(exl[j]===spl||firstOf(exl[j])===firstOf(spl)))own=true;
    if(own)continue;/* the party's own telling is theirs to give */
    var hit=momentEchoWords(s.text,moments,ex.concat([s.speaker]));
    if(hit&&(!best||hit.words>best.words))best={speaker:s.speaker,who:hit.who,gist:hit.gist,words:hit.words,camp:hit.camp||null};
  }
  return best;
}
/* #469 ⑥: the detector's core over PLAIN text — a transcript excerpt carries no SAY tags. (text, moments, exempt names) →
   the best echoed moment {who,gist,words} or null; the same bar as the detector (MOTIF_MIN_WORDS shared, one strong). */
function momentEchoWords(text,moments,exempt){
  var ex=(exempt||[]).map(function(n){return String(n||"");}),best=null,j,k;
  var lineWords=motifWords(text,ex);
  for(j=0;j<(moments||[]).length;j++){
    var mo=moments[j];if(!mo||!mo.text)continue;
    var mw=motifWords(mo.text,ex.concat([mo.who||""])),shared=0;
      var strong=false;for(k in mw)if(lineWords[k]){shared++;if(k.length>=MOTIF_STRONG_MIN)strong=true;}
      if(shared>=MOTIF_MIN_WORDS&&strong&&(!best||shared>best.words))best={who:mo.who||"",gist:String(mo.text).slice(0,MOTIF_GIST_CHARS),words:shared,camp:mo.camp||null};/* #481 C9: the note names the campaign */
  }
  return best;
}
/* #469 ④/⑥ (owner 2026-09-29, Village t212: the lien line came back through the scene-excerpt retriever after every other
   channel was closed): ONE gate says whether the earlier adventures are HELD right now — a small-talk kind, not standing in
   the Hall, and the hero has not raised the past (pastRaisedByHero over the action and the last user turns). The moments
   block and the excerpt retriever both ask it, so the two can never disagree. heldPastParty gathers what it needs. */
function heldPastParty(){
  if(typeof worldState==="undefined"||!worldState||!worldState.character)return null;
  var camp=worldState.campName||"",names=[worldState.character.name],prior=[],seen={};
  function take(list){var i;for(i=0;i<(list||[]).length;i++){var m=list[i];if(!m||!m.text||campIsCurrent(m))continue;/* #481 C8: by id, not display name */var k=m.camp+"|"+m.turn+"|"+m.text;if(seen[k])continue;seen[k]=1;prior.push(m);}}
  take(worldState.character.coreMemories);
  var party=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[],i;
  for(i=0;i<party.length;i++){names.push(party[i].name);take(party[i].charSheet&&party[i].charSheet.coreMemories);}
  return prior.length?{names:names,prior:prior}:null;
}
function _standingInHall(){
  var w=(typeof worldState!=="undefined"&&worldState&&worldState.world)||{},res=(typeof locResolve==="function")?locResolve:function(x){return x;};
  var hk=(typeof kindDef==="function"&&kindDef().hall&&typeof villageHallKey==="function")?res(villageHallKey()):null;
  var ak=w.sublocation?res(w.location+"|"+w.sublocation):res(w.location||"");
  return !!(hk&&ak===hk);
}
function _heroUserTurns(){var ut=[],i,sl=(typeof sessionLog!=="undefined"&&sessionLog)||[];for(i=0;i<sl.length;i++){var m=sl[i];if(m&&m.role==="user"&&!m.bk)ut.push(typeof stripEngineNotes==="function"?stripEngineNotes(m.content):m.content);}return ut;}
function pastHeldNow(names,prior){
  if(!prior||!prior.length||typeof kindDef!=="function"||!kindDef().smallTalk)return false;
  if(_standingInHall())return false;/* the Hall serves everything */
  return !pastRaisedByHero(typeof lastAction==="string"?lastAction:"",_heroUserTurns(),names,prior);
}
/* #481 C6 (audit 2026-09-29, Fable-approved): the ONE gate for the CARRIED record — the CARRIED HISTORY splice and the
   CARRIED RECORD note both ask it, outside the memoized retriever, so they can never disagree (the #479 lesson). HELD (true)
   in a small-talk kind, outside the Hall, unless the hero raises the past: pastRaisedByHero over the action and the recent
   user turns, with the party's names AND the residents the action names, and the party's prior moments AND those
   residents' carried records. Buying cakes from Nyla holds her record; "How did you and Silas meet?" serves it. An
   adventure kind is never held (byte-identical). */
function carriedHeldNow(action){
  if(typeof kindDef!=="function"||!kindDef().smallTalk||typeof worldState==="undefined"||!worldState||!worldState.character)return false;
  if(_standingInHall())return false;
  var act=String(action==null?"":action),q=(typeof ragQueryEntities==="function")?ragQueryEntities(act):{input:{}},named=[],k,i;
  for(k in q.input){var n=(typeof wsNpcByName==="function")?wsNpcByName(k):null;if(n&&!n.partyMember&&n.charSheet&&named.indexOf(n.name)<0)named.push(n.name);}
  if(!named.length)return false;/* nobody carried is named — the retriever serves nothing anyway */
  var hp=heldPastParty(),names=hp?hp.names.slice():[worldState.character.name],prior=hp?hp.prior.slice():[];
  if(!hp){var pc=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[];for(i=0;i<pc.length;i++)names.push(pc[i].name);}
  names=names.concat(named);
  var pool=(typeof _ragCarriedPool==="function")?_ragCarriedPool():[];for(i=0;i<pool.length;i++)if(named.indexOf(pool[i].who)>=0)prior.push({who:pool[i].who,text:pool[i].text});
  return !pastRaisedByHero(act,_heroUserTurns(),names,prior);
}
function ragEchoGate(){var p=heldPastParty();return (p&&pastHeldNow(p.names,p.prior))?p:null;}
function droll(s){return Math.floor(Math.random()*s)+1;}
/* #354 (v1.837): opening-hour helpers. The clock's zero is DAWN (#89: clock%1440==0 ≡ ~6am), so a
   preset's clock hour becomes minutes-since-dawn. clockHourLabel is the one phase vocabulary for a
   fresh campaign's world.time (the GM's [TIME:] tag takes over from turn one). */
var DAWN_HOUR=6;
function startClockMin(hour){if(typeof hour!=="number"||!isFinite(hour))return 0;var h=((Math.floor(hour)%24)+24)%24;return ((h-DAWN_HOUR+24)%24)*MIN_PER_HOUR;}
function clockHourLabel(hour){var h=((Math.floor(hour)%24)+24)%24;
  return h<4?"midnight":h<6?"before dawn":h<8?"dawn":h<12?"morning":h<14?"midday":h<17?"afternoon":h<19?"dusk":h<21?"evening":"night";}
function startTimeToHour(hhmm){var m=/^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(String(hhmm||""));if(!m)return null;var h=parseInt(m[1],10);return (h>=0&&h<24)?h:null;}
function startLocationEntry(loc){var i;for(i=0;i<START_LOCATIONS.length;i++){if(START_LOCATIONS[i].loc===loc)return START_LOCATIONS[i];}return null;}
/* #354: THE random hero — one pure roll of everything the wizard's first four steps decide (ancestry →
   subrace → lineage, class from the available roster, 4d6-drop-lowest stats laid onto the class's
   statPriority, floating ancestry points onto the class's top stats, gender, age, alignment). The wizard
   paints the result into cs and jumps to Review; the AI text helper fills the words afterwards. `rand`
   is injectable so the roll is testable; defaults to Math.random. */
function rollRandomHero(rand){
  rand=(typeof rand==="function")?rand:Math.random;
  function pick(arr){return arr[Math.floor(rand()*arr.length)];}
  function d6(){return Math.floor(rand()*6)+1;}
  var anc=pick(ANCS),sub=null,lin=null;
  if(anc.subraces&&anc.subraces.length){var sr=pick(anc.subraces);sub=sr.id;if(sr.lineages&&sr.lineages.length)lin=pick(sr.lineages).id;}
  var defs=classDefs().filter(function(d){return typeof classAvailable!=="function"||classAvailable(d.id);});
  var cls=pick(defs.length?defs:classDefs());
  var rolls=[],i;for(i=0;i<6;i++){var d=[d6(),d6(),d6(),d6()].sort(function(a,b){return a-b;});rolls.push(d[1]+d[2]+d[3]);}
  rolls.sort(function(a,b){return b-a;});
  var prio=cls.statPriority||STATS,bs={};for(i=0;i<prio.length;i++)bs[prio[i]]=rolls[i];
  var fp=[];if(anc.fc>0){for(i=0;i<anc.fc&&i<prio.length;i++)fp.push(prio[i]);}
  return {ancestry:anc.id,subrace:sub,heritageVariant:lin,cls:cls.id,bs:bs,fp:fp,gender:pick(["M","F","NB"]),age:pick(WIZARD_AGES),alignment:pick(WIZARD_ALIGNMENTS)};
}
function r4d6(){var d=[droll(6),droll(6),droll(6),droll(6)];d.sort(function(a,b){return a-b;});return d[1]+d[2]+d[3];}
function getFin(){
  var b={STR:cs.bs.STR,DEX:cs.bs.DEX,CON:cs.bs.CON,INT:cs.bs.INT,WIS:cs.bs.WIS,CHA:cs.bs.CHA};
  var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}
  if(!a)return b;
  if(a.fc>0){for(i=0;i<cs.fp.length;i++){b[cs.fp[i]]=(b[cs.fp[i]]||8)+1;}}
  else{var keys=Object.keys(a.stats);for(i=0;i<keys.length;i++){b[keys[i]]=(b[keys[i]]||8)+a.stats[keys[i]];}}
  return b;
}
// ── classDef (#72 C6 ①→②, v1.472/v1.533): THE class lookup ───────────────────
// C6 ② LANDED (2026-08-03): the backing store is now CLASS_BIBLE — the ① refactor
// made every former hand-rolled `for(i…) if(CLSS[i].id===…)` loop route through
// these two functions, so the swap happened HERE and nowhere else, exactly as the
// DOC_class_bible landing sequence ruled 2026-07-18. classDefs() serves a memoized
// ARRAY view (insertion order = the creation grid order — byte-identical to the
// old CLSS ordering, invariant-tested), each element the live CLASS_BIBLE entry
// object. classDef matches the canonical id exactly first, then falls back to a
// trimmed case-insensitive scan (normalizeCompanionSheet feeds it raw model
// output). Returns null when nothing matches — callers keep their own fallbacks
// (getMHP's 8, companionBaselineHp's hd 10).
// C6 INVARIANT (the spec's): an existing character's derived values must not move
// — hd/prime/castStat/statPriority and XP 1-10 are pinned to the legacy values as
// FROZEN LITERALS in the invariant test; new content applies only at the NEXT
// level-up (Ammut at L10 sees the new world at L11 — no retroactive grants).
var _classDefsArr=null,_classDefsCustomSrc=null;
/* #192: adapt a blueprint custom class (designer-validated shape) into the BIBLE class shape,
   so every downstream reader — wizard grid, confirmChar chassis, checkLevelUp rows — consumes it
   through the same accessors with zero per-shape branching. Ability-chassis only by design:
   no archetypes, no spellTiers (the spell machinery's absence paths already handle non-casters). */
function _customClassToDef(cc){
  var levels={},i,f;
  for(i=0;i<(cc.features||[]).length;i++){f=cc.features[i];
    if(!levels[f.lvl])levels[f.lvl]={features:[]};
    levels[f.lvl].features.push({nm:f.nm,ds:f.ds});}
  return {id:cc.name,nm:cc.name,desc:cc.desc||"",hd:cc.hd,prime:cc.prime,
    statPriority:(cc.statPriority||[]).slice(),gear:cc.gear||"",
    abilities:(cc.abilities||[]).slice(),skillSeeds:(cc.skillSeeds||[]).slice(),
    levels:levels,archetypes:[],custom:true};
}
/* The custom source: the ACTIVE campaign's persisted list first, the wizard-time pending
   blueprint second (creation runs before applyBlueprint persists — the handoff is seamless
   because startGame nulls pendingBlueprint only after persisting). */
function _activeCustomClasses(){
  if(typeof worldState!=="undefined"&&worldState&&worldState.customClasses&&worldState.customClasses.length)return worldState.customClasses;
  if(typeof pendingBlueprint!=="undefined"&&pendingBlueprint&&pendingBlueprint.customClasses&&pendingBlueprint.customClasses.length)return pendingBlueprint.customClasses;
  return null;
}
function classDefs(){
  /* #192: the memo keys on the custom SOURCE REFERENCE — a campaign switch, blueprint load, or
     removal changes it and rebuilds; the common no-customs path stays one identity check. */
  var src=_activeCustomClasses();
  if(_classDefsArr&&_classDefsCustomSrc===src)return _classDefsArr;
  _classDefsArr=[];var k;for(k in CLASS_BIBLE)_classDefsArr.push(CLASS_BIBLE[k]);
  if(src){var ci;for(ci=0;ci<src.length;ci++)_classDefsArr.push(_customClassToDef(src[ci]));}
  _classDefsCustomSrc=src;
  return _classDefsArr;
}
/* #192: the curated-availability gate — absent restriction = no restriction (the schema's own
   rule: never expand to a full list). Matches id or display name, case-insensitive. */
function classAvailable(idOrNm){
  var av=(typeof worldState!=="undefined"&&worldState&&worldState.availableClasses)||
         (typeof pendingBlueprint!=="undefined"&&pendingBlueprint&&pendingBlueprint.availableClasses)||null;
  if(!av||!av.length)return true;
  var n=String(idOrNm||"").toLowerCase(),i;
  for(i=0;i<av.length;i++){if(String(av[i]).toLowerCase()===n)return true;}
  var d=classDef(idOrNm);
  if(d){for(i=0;i<av.length;i++){var a=String(av[i]).toLowerCase();if(a===String(d.id).toLowerCase()||a===String(d.nm).toLowerCase())return true;}}
  return false;
}
function classDef(id){
  var L=classDefs(),i;
  for(i=0;i<L.length;i++){if(L[i].id===id)return L[i];}
  if(typeof id==="string"&&id){
    var n=id.trim().toLowerCase();
    for(i=0;i<L.length;i++){if(L[i].id.toLowerCase()===n)return L[i];}
  }
  return null;
}
// The 1–20 XP curve (#72 C4/C4b — L1–10 verbatim the shipped XP_LEVELS, so existing
// levels cannot move; 11–20 opens the post-C6 world). THE accessor: nothing reads
// CLASS_XP_LEVELS or the dead XP_LEVELS directly.
function classXpLevels(){return CLASS_XP_LEVELS;}
// Level-row features (#72 C3/C4): class rows at 2/5/7/9/11/13/15/17, archetype rows
// at 3/6/10/14/18 + capstone 20. Both return [] when nothing lands at that level —
// callers grant with no per-shape branching.
function classFeaturesAt(clsId,lvl){
  var d=classDef(clsId);
  return (d&&d.levels&&d.levels[lvl]&&d.levels[lvl].features)||[];
}
function archFeaturesAt(clsId,archId,lvl){
  if(!archId)return[];
  var d=classDef(clsId);if(!d||!d.archetypes)return[];
  var i;for(i=0;i<d.archetypes.length;i++){
    if(d.archetypes[i].id===archId)
      return (d.archetypes[i].levels&&d.archetypes[i].levels[lvl]&&d.archetypes[i].levels[lvl].features)||[];
  }
  return[];
}
// #72 C2 (ruled 2026-07-27): the spell-tier unlocks CROSSED by a level change — the class's
// spellTiers schedule plus, when an archetype is committed, the archetype's own (C7: third
// casters like Arcane Trickster/Eldritch Knight key their tiers to the archetype rows).
// PURE: returns [{tier, level, pool, source}] sorted by level; callers decide what a pick is
// worth (SPELL_UNLOCK_PICKS) and whether an empty fill-phase pool skips. Half-open interval
// (fromLvl, toLvl] means no retroactive grants ever — the C6 invariant's rhythm.
function spellUnlocksCrossed(clsId,archId,fromLvl,toLvl){
  var out=[],d=classDef(clsId);
  function scan(tiers,pools,src){
    if(!tiers)return;
    var t;for(t in tiers){var lv=tiers[t];if(typeof lv==="number"&&lv>fromLvl&&lv<=toLvl)out.push({tier:parseInt(t,10),level:lv,pool:(pools&&pools[t])||[],source:src});}
  }
  if(d)scan(d.spellTiers,d.spells,"class");
  if(archId&&d&&d.archetypes){
    var i;for(i=0;i<d.archetypes.length;i++){
      if(d.archetypes[i].id===archId){scan(d.archetypes[i].spellTiers,d.archetypes[i].spells,"arch");break;}
    }
  }
  out.sort(function(a,b){return a.level-b.level||a.tier-b.tier;});
  return out;
}
// ── #487 / #489 / #490: THE ability-name layer ────────────────────────────────────────
// An ability record is {nm,ds,gained} — no source field. Everything that needs to know WHAT an
// entry is (the sheet's sections, the duplicate check at a grant, the heal on load, the hero-tag
// guard) reads it through these pure functions, so the rule lives once.
// abilityParts: the pre-C6 engine wrote level features as {nm:"Lv5",ds:"Uncanny Dodge -- halve…"}
// (the level label in the name, the real name in the description). Unwrapped here, so a reader
// never has to know the old form existed.
function abilityParts(ab){
  var nm=String((ab&&ab.nm)||""),ds=String((ab&&ab.ds)||"");
  if(/^Lv\d+$/.test(nm)){var m=ds.match(/^(.+?)\s+--\s+([\s\S]*)$/);if(m)return {nm:m[1].trim(),ds:m[2].trim(),old:true};}
  return {nm:nm,ds:ds,old:false};
}
// The class bible's row for an ability name on THIS sheet: the row with that EXACT name (case and
// outer spaces aside) among the starting abilities, the class level rows, and the committed
// archetype's rows and the archetype itself. #507: never a base-name match — "Sneak Attack (venomed
// blade)" is a GM's own ability, not the bible's Sneak Attack (the heal deleted it as a duplicate),
// and "Wild Shape (CR 1)" is the level-7 row, not the level-2 one (a level-9 Druid was healed down
// to CR 1/4). Of several rows with one exact name (Rogue's Evasion at 1 and 7) the highest at or
// below the sheet's level wins. Returns {nm,ds,group,lv}; null = the bible has no such ability
// for this class/archetype (a GM-granted or model-written one).
function abilityBibleRow(c,nm){
  var d=classDef(c&&c.cls),k=abilityNameKey(nm),lvl=(c&&c.level)||1,best=null,lv,i,j,rows;
  if(!d||!k)return null;
  function take(rn,ds,group,at){
    if(abilityNameKey(rn)!==k)return;
    var cand={nm:rn,ds:ds,group:group,lv:at};
    if(!best||abilityRowFor(lvl,cand,best)===cand)best=cand;
  }
  rows=d.abilities||[];for(i=0;i<rows.length;i++)take(rows[i].nm,rows[i].ds,"class",1);
  if(d.levels){for(lv=1;lv<=20;lv++){rows=(d.levels[lv]&&d.levels[lv].features)||[];for(i=0;i<rows.length;i++)take(rows[i].nm,rows[i].ds,"class",lv);}}
  var archs=d.archetypes||[];
  for(j=0;j<archs.length;j++){
    if(archs[j].id!==c.archetype)continue;
    take(archs[j].nm,archs[j].desc,"archetype",3);
    for(lv=1;lv<=20;lv++){rows=(archs[j].levels&&archs[j].levels[lv]&&archs[j].levels[lv].features)||[];for(i=0;i<rows.length;i++)take(rows[i].nm,rows[i].ds,"archetype",lv);}
  }
  return best;
}
// #507: the ONE name key the ability layer compares by (abilityHeldAs, #490, uses the same).
function abilityNameKey(nm){return String(nm||"").trim().toLowerCase();}
// #507: of two bible rows, the one a sheet at level lvl should hold — the highest at or below its
// level; when neither is reached yet, the lower.
function abilityRowFor(lvl,a,b){
  var ao=a.lv<=lvl,bo=b.lv<=lvl;
  if(ao!==bo)return ao?a:b;
  return ao?(a.lv>=b.lv?a:b):(a.lv<=b.lv?a:b);
}
// #507: are two ability names ONE ability on this sheet? The same name (case and outer spaces
// aside), or two rows of one class-bible family that share a base name (Wild Shape, Wild Shape
// (CR 1/4) and Wild Shape (CR 1)). A name the bible does not hold is only ever itself.
function abilitySame(c,a,b){
  if(abilityNameKey(a)===abilityNameKey(b))return true;
  if(capBaseName(a)!==capBaseName(b))return false;
  return !!(abilityBibleRow(c,a)&&abilityBibleRow(c,b));
}
function abilityHas(c,nm){
  var L=(c&&c.abilities)||[],i;
  for(i=0;i<L.length;i++){if(abilitySame(c,abilityParts(L[i]).nm,nm))return true;}
  return false;
}
// #490: does the sheet hold this name under ANY spelling a GM tag could collide with — another
// case, stray spaces, or an old "LvN" entry carrying it in the description. Deliberately NOT
// capBaseName: "Mudwalk (greater)" is a different ability from "Mudwalk" and always was.
function abilityHeldAs(c,nm){
  var k=String(nm||"").trim().toLowerCase(),L=(c&&c.abilities)||[],i;
  for(i=0;i<L.length;i++){if(String(abilityParts(L[i]).nm).trim().toLowerCase()===k)return true;}
  return false;
}
// #490 (Rise of the Runelords t2045): WHOSE ability does a hero-form [ABILITY_GAINED:name|desc]
// describe? The GM narrated a companion using Blindsense and filed "Frizwick locates nearby
// creatures without relying on sight" with the hero's tag; it landed on the hero. Returns the
// party member's name when the description OPENS with it as the subject of the sentence
// ("Frizwick locates…"), else null (the hero's). Conservative on purpose — every doubtful shape
// stays the hero's, as before: a possessive ("Frizwick's lesson: …"), a description that
// addresses the hero ("Frizwick taught you…") or names the hero ("Frizwick and Ammut…").
// names = the party members with sheets; a first name alone counts (the GM writes "Morwen" for
// "Morwen Zethran"), a leading title or article never does ("The Entity" is not "the").
function abilityTagSubject(ds,heroName,names){
  var low=String(ds||"").trim().toLowerCase(),i,j;
  if(!low||/(^|[^a-z])(you|your|yours|yourself)([^a-z]|$)/.test(low))return null;
  var hero=String(heroName||"").trim().toLowerCase();
  if(hero&&new RegExp("(^|[^a-z0-9])"+hero.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)").test(low))return null;
  for(i=0;i<(names||[]).length;i++){
    var full=String(names[i]||"").trim().toLowerCase(),forms=[full],first=full.split(/\s+/)[0];
    if(!full)continue;
    if(first!==full&&first.length>=3&&!/^(the|old|young|sir|lady|lord|captain|sheriff|brother|sister|father|mother|master|mistress)$/.test(first))forms.push(first);
    for(j=0;j<forms.length;j++){
      if(low.indexOf(forms[j])===0&&/^\s+[a-z]/.test(low.slice(forms[j].length)))return names[i];
    }
  }
  return null;
}
// THE level-row grant (#487): a row the sheet already holds under the same name is not pushed a
// second time — the held entry takes the row's wording instead (Rogue's level-7 Evasion replaces
// the starting one; a model-written "Uncanny Dodge" becomes the bible's). Returns whether the
// sheet changed, so the caller announces only what is new.
function abilityGrant(c,row,turn){
  if(!c.abilities)c.abilities=[];
  var i,held,hr,rr;
  for(i=0;i<c.abilities.length;i++){
    held=abilityParts(c.abilities[i]).nm;
    if(!abilitySame(c,held,row.nm))continue;/* #507: a GM's variant is never this row */
    if(c.abilities[i].nm===row.nm&&c.abilities[i].ds===row.ds)return false;
    /* #507: a family is never stepped DOWN — a late level-2 Wild Shape on a sheet holding the level-7 row changes nothing */
    if(abilityNameKey(held)!==abilityNameKey(row.nm)){hr=abilityBibleRow(c,held);rr=abilityBibleRow(c,row.nm);if(hr&&rr&&hr.lv>rr.lv)return false;}
    c.abilities[i].nm=row.nm;c.abilities[i].ds=row.ds;return true;
  }
  c.abilities.push({nm:row.nm,ds:row.ds,gained:turn||0});return true;
}
// #489: which section of the sheet an ability belongs under. Derived at render — no schema field.
function abilityGroup(c,ab){
  var p=abilityParts(ab);
  if(/^\s*\[racial\]/i.test(p.nm))return "racial";
  var row=abilityBibleRow(c,p.nm);
  return row?row.group:"story";
}
// The sheet's sections in reading order, empty ones left out: [{key,label,items:[index…]}].
// items are indexes into c.abilities, in stored order within a section.
function abilityGroups(c){
  var L=(c&&c.abilities)||[],by={racial:[],"class":[],archetype:[],story:[]},i,d=classDef(c&&c.cls),archNm="",j;
  for(i=0;i<L.length;i++)by[abilityGroup(c,L[i])].push(i);
  if(d&&c.archetype){for(j=0;j<(d.archetypes||[]).length;j++){if(d.archetypes[j].id===c.archetype)archNm=d.archetypes[j].nm;}}
  var order=[["racial","Racial"],["class","Class"+(d?" — "+d.nm:"")],["archetype","Archetype"+(archNm?" — "+archNm:"")],["story","Story"]],out=[];
  for(i=0;i<order.length;i++){if(by[order[i][0]].length)out.push({key:order[i][0],label:order[i][1],items:by[order[i][0]]});}
  return out;
}
// #487 (owner ruling 2026-09-30, option a): a companion's archetype is picked by the ENGINE — the
// class's archetype that best matches what the sheet already says about them. A companion sheet
// carries a model-written archetype NAME ("Infiltrator") and never a bible id, so every archetype
// level granted nothing. Deterministic: the sheet's own words (the archetype name counts triple,
// then abilities, spells, trait, flaw, motivation) scored against each archetype's bible text by
// shared word stems; a spell on the archetype's own bench counts double. Ties and a sheet that
// matches nothing fall to bible order — so the answer never depends on the turn or the device.
// Returns the archetype id, or null for a class with no archetypes (#192 customs).
var ARCH_MATCH_STOP={the:1,and:1,with:1,that:1,this:1,from:1,your:1,their:1,they:1,them:1,when:1,once:1,have:1,into:1,than:1,then:1,will:1,can:1,cannot:1,each:1,every:1,until:1,while:1,which:1,what:1,where:1,whose:1,been:1,being:1,does:1,make:1,makes:1,made:1,take:1,takes:1,within:1,without:1,after:1,before:1,against:1,other:1,also:1,only:1,more:1,most:1,must:1,next:1,first:1,time:1,turn:1,rest:1,level:1,check:1,save:1,bonus:1,action:1,reaction:1,damage:1,target:1,creature:1,ability:1,spell:1,spells:1,feet:1,round:1,rounds:1,minute:1,minutes:1,hour:1,hours:1,long:1,short:1,about:1,knows:1,know:1};
function archMatchStems(text){
  var w=String(text||"").toLowerCase().split(/[^a-z]+/),out={},i;
  for(i=0;i<w.length;i++){if(w[i].length<4||ARCH_MATCH_STOP[w[i]])continue;out[w[i].slice(0,5)]=1;}
  return out;
}
function archetypeBestMatch(c){
  var d=classDef(c&&c.cls),archs=(d&&d.archetypes)||[];
  if(!archs.length)return null;
  var i,j,lv,k,nm=String(c.archetypeNm||"").toLowerCase().trim();
  for(i=0;i<archs.length;i++){if(nm&&(nm===String(archs[i].nm).toLowerCase()||nm===String(archs[i].id).toLowerCase()))return archs[i].id;}
  var nameStems=archMatchStems(c.archetypeNm),bodyTxt=[c.trait,c.flaw,c.motivation],spellKeys={},ownSpells=0;
  /* Only what the sheet says in its OWN words is evidence: an ability the class bible granted says
     the same thing about every member of the class, and it arrives level by level — counting it
     made one companion's answer differ between two campaigns a level apart. */
  for(i=0;i<(c.abilities||[]).length;i++){var p=abilityParts(c.abilities[i]);if(p.old||abilityBibleRow(c,p.nm))continue;bodyTxt.push(p.nm,p.ds);}
  for(i=0;i<(c.spells||[]).length;i++){spellKeys[capBaseName(c.spells[i].nm)]=1;if(!c.spells[i].racial)ownSpells++;}
  var bodyStems=archMatchStems(bodyTxt.join(" ")),best=archs[0].id,bestScore=0,casterClass=!!(d.spellTiers);
  for(i=0;i<archs.length;i++){
    var a=archs[i],txt=[a.nm,a.desc],bench=[],score=0;
    for(lv=1;lv<=20;lv++){var rows=(a.levels&&a.levels[lv]&&a.levels[lv].features)||[];for(j=0;j<rows.length;j++)txt.push(rows[j].nm,rows[j].ds);}
    for(k in (a.spells||{}))bench=bench.concat(a.spells[k]||[]);
    var legacy=(typeof ARCH_SPELLS!=="undefined"&&ARCH_SPELLS[a.id])||{};for(k in legacy)bench=bench.concat(legacy[k]||[]);
    var aStems=archMatchStems(txt.join(" ")),aNameStems=archMatchStems(a.nm+" "+a.desc);
    for(k in nameStems){if(aNameStems[k])score+=20;else if(aStems[k])score+=6;}
    for(k in bodyStems){if(aStems[k])score+=1;}
    var seen={};for(j=0;j<bench.length;j++){var bk=capBaseName(bench[j]);if(spellKeys[bk]&&!seen[bk]){seen[bk]=1;score+=2;}}
    /* A spell-less class's member who casts anyway is its casting archetype (the Rogue with a
       spell list is the Arcane Trickster, the Warrior with one the Eldritch Knight). */
    if(!casterClass&&ownSpells&&a.spellTiers)score+=20;
    if(score>bestScore){bestScore=score;best=a.id;}
  }
  return best;
}
// #487: heal ONE sheet, in place, and say what changed. Idempotent — a healed sheet returns an
// empty report. opts.pickArchetype (companions): a level-3+ sheet with no archetype id gets one
// from archetypeBestMatch (the hero's missing archetype stays the forced modal's job, #284).
//   ① old "LvN" entries become the ability they always were (bible wording when the bible has it)
//   ② an ability the class bible knows, held twice, is held once — first position, bible wording.
//      An ability the bible does NOT know is never touched, however it is worded.
//   ③ every level row from 2 to the current level that the sheet lacks is granted, in level
//      order — the committed archetype's rows (owner ruling 2026-09-30: the hero too; Ammut held
//      his 14 and 18 rows and none of 3, 6 or 10) AND the class's own rows (owner ruling
//      2026-10-01: a companion who joined at 9 held nothing from 2, 5 or 7), and before them the
//      class's STARTING abilities (same day: a level-18 Rogue companion had no Sneak Attack). This
//      retires the C6 "no retroactive grants" rule for abilities; a held name is never doubled.
// Returns {archetype:null|{id,nm}, renamed:[names], removed:[names], granted:[names]}.
function abilitySheetHeal(c,opts){
  var rep={archetype:null,renamed:[],removed:[],granted:[]},i,j,lv;
  if(!c)return rep;
  var d=classDef(c.cls),turn=(opts&&opts.turn)||0;
  if(!c.abilities)c.abilities=[];
  if(opts&&opts.pickArchetype&&!c.archetype&&(c.level||1)>=3&&d&&(d.archetypes||[]).length){
    var id=archetypeBestMatch(c);
    for(i=0;i<d.archetypes.length;i++){if(d.archetypes[i].id===id){c.archetype=id;if(!c.archetypeNm)c.archetypeNm=d.archetypes[i].nm;rep.archetype={id:id,nm:d.archetypes[i].nm};}}
  }
  for(i=0;i<c.abilities.length;i++){
    var p=abilityParts(c.abilities[i]);
    if(!p.old)continue;
    var row=abilityBibleRow(c,p.nm);
    c.abilities[i].nm=row?row.nm:p.nm;c.abilities[i].ds=row?row.ds:p.ds;rep.renamed.push(c.abilities[i].nm);
  }
  /* #507: "held twice" is abilitySame — one exact name, or two rows of one bible family — never a base-name match, so a
     GM's "Sneak Attack (venomed blade)" survives beside the bible's Sneak Attack. The kept entry holds the first position
     and takes the wording of the row the sheet's level reaches (a level-9 Druid ends on Wild Shape (CR 1)). */
  var keep=[],lvl=c.level||1;
  for(i=0;i<c.abilities.length;i++){
    var a=c.abilities[i],ra=abilityBibleRow(c,a.nm),dup=-1;
    if(ra){for(j=0;j<keep.length;j++){if(abilitySame(c,keep[j].nm,a.nm)){dup=j;break;}}}
    if(dup<0){keep.push(a);continue;}
    var rk=abilityBibleRow(c,keep[dup].nm),w=abilityRowFor(lvl,rk,ra),gone=(w===rk)?a.nm:keep[dup].nm;
    keep[dup].nm=w.nm;keep[dup].ds=w.ds;rep.removed.push(gone);
  }
  if(keep.length!==c.abilities.length)c.abilities=keep;
  /* The class's STARTING abilities count as its level-1 rows. One of them can share a name with a
     later level row (Rogue's Evasion is restated, fuller, at 7): a sheet at or past that level is
     given the level row's wording, so the grant below never leaves the weaker text in its place. */
  var start=[],sa=(d&&d.abilities)||[],w,lr;
  for(i=0;i<sa.length;i++){
    w=sa[i];
    for(lv=2;lv<=(c.level||1);lv++){lr=classFeaturesAt(c.cls,lv);for(j=0;j<lr.length;j++){if(capBaseName(lr[j].nm)===capBaseName(w.nm))w=lr[j];}}
    start.push(w);
  }
  for(lv=1;lv<=(c.level||1);lv++){
    var rows=classFeaturesAt(c.cls,lv).concat(archFeaturesAt(c.cls,c.archetype,lv));
    if(lv===1)rows=start.concat(rows);
    for(j=0;j<rows.length;j++){if(abilityHas(c,rows[j].nm))continue;c.abilities.push({nm:rows[j].nm,ds:rows[j].ds,gained:turn});rep.granted.push(rows[j].nm);}
  }
  return rep;
}
function getMHP(){var c=classDef(cs.cls);if(!c)return 8;return c.hd+Math.floor((getFin().CON-10)/2);}
/* ── mana pool (#110) ──────────────────────────────────────────────────────────────────
   The spend-by-tier casting economy, design ruled 2026-07-31 (full spec in the TODO row).
   All three are PURE reads over a character/companion sheet — no state writes here.
   manaSpellCost: what one cast spends — the capability-bible tier (the [SPELL_DEF:]
     overlay wins inside capabilityLookup), sp.lvl fallback for customs the bible can't
     resolve. Cantrips and racial 1/day grants cost 0 — racial heritage is a separate
     economy (its own used gate, recharged at dawn), NEVER pooled.
   manaMax: base = sum of manaSpellCost over the known bench (so the pool scales with
     picks automatically — a player CAN still cast each spell exactly once), then +10%
     per point of the class's castStat over 16, floored. castStat is class-bible data (#110, C6-② ported it:
     keyed per class, not per tradition); a class without one gets base only.
   manaCur: the stored c.mana clamped into [0, max] — and an ABSENT c.mana reads as
     FULL, which IS the migration ruling ("full pool for everyone"): old saves need no
     migration pass, they simply wake up topped up the first time anything reads. */
function manaSpellCost(sp){
  if(!sp||sp.racial||sp.lvl===0)return 0;
  var e=(typeof capabilityLookup==="function")?capabilityLookup(sp.nm):null;
  if(e&&typeof e.tier==="number"&&isFinite(e.tier))return e.tier;
  return (typeof sp.lvl==="number"&&isFinite(sp.lvl)&&sp.lvl>0)?sp.lvl:0;
}
/* #361: THE one used-spell gate. Since #110 `used` means "cast since rest" for every spell, but only a
   RACIAL 1/day spell is actually unavailable while used — everything else pays mana and stays castable.
   Every surface that asks "can this spell be cast right now?" reads this, never `used` alone (the character
   preview and Table Talk were still reading the slot-era meaning). */
function spellUnavailable(sp){return !!(sp&&sp.racial&&sp.used);}
function manaMax(c){
  if(!c||!c.spells||!c.spells.length)return 0;
  var base=0,i;
  for(i=0;i<c.spells.length;i++)base+=manaSpellCost(c.spells[i]);
  if(!base)return 0;
  var d=classDef(c.cls),v=d&&d.castStat&&c.stats?c.stats[d.castStat]:0;
  if(typeof v==="number"&&v>16)return Math.floor(base*(1+0.10*(v-16)));
  return base;
}
function manaCur(c){
  var max=manaMax(c);
  if(!c||typeof c.mana!=="number"||!isFinite(c.mana))return max;
  return Math.max(0,Math.min(max,c.mana));
}
/* #110b (field 2026-09-11, Silas Morne t121 — "just had a long rest, but only 2/7 mana regenerated"): THE POOL GROWS
   WITH THE MAX. The rest landed level 5 (#349) and filled the pool to the max of the level-4 bench (2); the level-5
   picks came AFTER through the modal and lifted the max to 7 while the pool stayed at 2. Every path that can raise
   manaMax — a learned spell (player pick, companion auto-learn, batch grant) or a casting-stat bump — captures the
   max BEFORE the change and calls this AFTER: the pool gains exactly the growth (a new spell arrives with its own
   mana; spent mana stays spent), clamped to the new max. A shrink never drains (manaCur clamps on read), and an
   absent pool (reads as full, the #110 ruling) is left absent. Returns the growth applied. */
function manaGrowWithMax(c,maxBefore){
  if(!c)return 0;var after=manaMax(c),grow=after-(typeof maxBefore==="number"&&isFinite(maxBefore)?maxBefore:0);
  if(grow<=0)return 0;
  if(typeof c.mana!=="number"||!isFinite(c.mana))return grow;
  c.mana=Math.max(0,Math.min(after,c.mana+grow));return grow;
}
/* #352 (v1.833/v1.834): THE vital readouts — one pure shape for every HP or MP number the HUD paints
   (the topbar hero readout and each companion card), so the hosts can never drift. The number
   carries the signal itself (no bars): its hue IS the percentage, walked along a per-vital ramp
   and muted to the palette (S 60%, L 58%). VITAL_RAMPS is the registry — adding a vital is one entry:
     hp  120° green → 0° red (hue = pct×1.2); zero = dead → still and dim, never crit.
     mp  217° blue → 330° hot pink (STOPS short of red so an empty pool never impersonates dying HP);
         zero = spent, not dead → keeps the ramp's end colour and STILL pulses (owner ruling 2026-09-06:
         a sorcerer without mana is useless, and knowing it before combat is critical).
   `crit` (under 10%) makes the host add the .hp-crit breath. Car Mode keeps its own glance palette (UA21③). */
var VITAL_RAMPS={
  hp:{from:120,to:0,zeroStill:true},
  mp:{from:217,to:330,zeroStill:false}
};
function vitalReadout(kind,cur,max){
  var ramp=VITAL_RAMPS[kind]||VITAL_RAMPS.hp;
  var mx=(typeof max==="number"&&max>0)?max:0,c=(typeof cur==="number"&&isFinite(cur))?cur:0;
  var pct=mx?Math.max(0,Math.min(100,Math.round(c/mx*100))):0;
  var alive=c>0&&mx>0,still=!mx||(!alive&&ramp.zeroStill);
  var hue=Math.round(ramp.from+(ramp.to-ramp.from)*(1-pct/100));
  return {pct:pct,alive:alive,crit:!still&&pct<10,
    color:still?"hsl("+ramp.to+",25%,45%)":"hsl("+hue+",60%,58%)"};
}
function hpReadout(hp,maxHp){return vitalReadout("hp",hp,maxHp);}
/* #352c (owner 2026-09-13): ONE span renderer for a vital on the character sheet — hero, NPC and read-only hosts all
   call it for HP and, for a caster, MP; the hue is the readout's, the crit breath rides the class the HUD uses. Unknown
   values render as a dash rather than "undefined". Pure: returns HTML, touches no DOM. */
function vitalSpanHtml(kind,cur,max,label){
  var r=vitalReadout(kind,cur,max),show=function(v){return (typeof v==="number"&&isFinite(v))?String(v):"\u2014";};
  return "<span class='cs-vital"+(r.crit?" hp-crit":"")+"' style='color:"+r.color+"'>"+show(cur)+"/"+show(max)+" "+label+"</span>";
}
function mpReadout(mp,maxMp){return vitalReadout("mp",mp,maxMp);}
/* #101 (v1.479): the ONE picker-description line, derived from the capability bible at render
   time — replaces the mechanics-bearing parentheticals that used to ride inside spell display
   names (a second copy of dice/range that could, and did, drift from the canon). Empty string
   for unknown names — callers keep their own fallback. */
function spellPickDesc(nm){
  var e=(typeof capabilityLookup==="function")?capabilityLookup(nm):null;
  if(!e||!e.effect)return"";
  var s=e.effect;
  if(s.length>140)s=s.slice(0,140).replace(/\s+\S*$/,"")+"…";
  return s;
}
function pbSp(){var t=0,i;for(i=0;i<STATS.length;i++){t+=(PBC[cs.bs[STATS[i]]]||0);}return t;}
function getToneNm(){if(!cs.tone)return"Unspecified";if(cs.tone==="custom")return"Custom";var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].nm;}return"Unspecified";}
function getToneVc(){if(!cs.tone)return"";if(cs.tone==="custom"){var el=document.getElementById("tone-ct");return el?el.value.trim():"";}var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].vc;}return"";}
function getSubNm(){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a||!a.subraces)return"";var j,k;for(j=0;j<a.subraces.length;j++){if(a.subraces[j].id===cs.subrace){if(cs.heritageVariant&&a.subraces[j].lineages){for(k=0;k<a.subraces[j].lineages.length;k++){if(a.subraces[j].lineages[k].id===cs.heritageVariant)return a.subraces[j].lineages[k].nm;}}return a.subraces[j].nm;}}return"";}
function getLvl(xp){var _X=classXpLevels();var i,l=1;for(i=1;i<_X.length;i++){if(xp>=_X[i])l=i+1;else break;}return l;}/* C6 ②: the curve length IS the cap (20) — the old Math.min(l,10) was the pre-bible world's ceiling */
// #139: seed the alignment AXES from a label — the inverse of alignLabel below, at the label's
// minimal consistent coordinate (±2, the alignLabel threshold): one point of deepening room
// remains, and a first OPPOSING shift moves the label directionally instead of teleporting it.
// Creation/companion sheets used to seed 0,0 under a non-neutral label, so the first
// [ALIGNMENT:] shift recomputed the label from coordinates that never matched it (the
// Chaotic-Neutral-snaps-to-True-Neutral defect, t1467 read 2026-08-07). Word-based parse —
// model-authored labels ("Neutral", odd casing) degrade to 0 per axis, never throw.
function alignSeedAxes(label){
  var s=String(label||"");
  var law=/lawful/i.test(s)?2:/chaotic/i.test(s)?-2:0;
  var good=/\bgood\b/i.test(s)?2:/\bevil\b/i.test(s)?-2:0;
  return {law:law,good:good};
}
function alignLabel(law,good){var l=law>=2?"Lawful":law<=-2?"Chaotic":"Neutral";var g=good>=2?"Good":good<=-2?"Evil":"Neutral";if(l==="Neutral"&&g==="Neutral")return"True Neutral";if(l==="Neutral")return"Neutral "+g;if(g==="Neutral")return l+" Neutral";return l+" "+g;}
function skillLevel(successes){var i;for(i=SKILL_THRESHOLDS.length-1;i>=0;i--){if(successes>=SKILL_THRESHOLDS[i])return i+1;}return 0;}
function initSkills(){var s={},i;for(i=0;i<SKILLS.length;i++)s[SKILLS[i].id]=0;return s;}
// UA9: THE map-node key for the current position — the geography canon's keying scheme
// ([LOCATION_DESC:] write-once storage, GEOGRAPHY block reads). World locations key by name,
// sub-locations by "Location|SubLocation". Was hand-computed at ~8 call sites; every copy was
// a divergence risk on the canon's own keys. Null when no world is loaded.
function currentNodeKey(){
  var w=(typeof worldState!=="undefined"&&worldState)?worldState.world:null;
  if(!w)return null;
  /* audit 2026-09-18 C10: compose under the CANONICAL world — fileSubLocation already did this (#156B: a stale world pointer
     from an older-device blob must not mint children under a tombstoned key); every other sub-grain writer composed raw and
     resolved the composite, which does nothing for a tombstoned parent. identity.js loads later; the guard keeps dev tools
     that load helpers alone working. */
  var loc=(typeof locResolve==="function")?locResolve(w.location):w.location;
  return w.sublocation?loc+"|"+w.sublocation:loc;
}
// Party cap helpers (PARTY_MAX total = players + companions). playerCount is 1 today; multiplayer (#1) will make it dynamic.
function partyCompanionCap(){return PARTY_MAX-1;}
/* v1.439 (F1, evidence brief C): npcIsDead, not a raw /\bdead\b/ test — the regex never matched
   "slain"/"deceased"/"perished" (exactly what the combat kill path writes) and never read the
   B3 dead FLAG, so a slain companion occupied a party slot forever. Same swap at every former
   raw-regex site in this file and game.js. */
function partyCompanionCount(){if(!worldState||!worldState.npcs)return 0;var n=0,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].partyMember&&!npcIsDead(worldState.npcs[i]))n++;}return n;}
// TODO #1 P1 (multiplayer, D8): players = the hero (unless explicitly demoted via isPC===false —
// no UI for that until P3's all-NPC rounds exist) + every living party member flagged isPC. Absent
// flags = exactly 1: the single-player invariant every existing save relies on (build record:
// DOC/todos_completed/todo_1_multiplayer_hotseat.md; pinned by the MP-P2/MP-P4 byte-identity
// tests). Same dead-filter as partyCompanionCount above.
// #172: does this narration still address the player in SECOND person? Quoted dialogue is stripped
// FIRST and that is the whole trick — characters say "you" to each other constantly, so a whole-text
// test calls every dialogue-bearing third-person response compliant. Measured over 10,055 real GM
// responses: 97.2% carry a second-person pronoun outside quotes, and the 2.8% that do not are
// exactly the third-person and pure-atmosphere ones.
// Emphasis spans (*like this*) are deliberately NOT stripped: they are narration, so a second person
// inside one is real compliance. Only DIALOGUE delimiters come out.
var SECOND_PERSON_RE=/\b(you|your|yours|yourself|yourselves)\b/i;
function personNarrationOnly(clean){
  return String(clean||"").replace(/“[^”]*”/g,"  ").replace(/«[^»]*»/g,"  ").replace(/"[^"]*"/g,"  ");
}
function narratesSecondPerson(clean){
  if(!clean)return false;
  return SECOND_PERSON_RE.test(personNarrationOnly(clean));
}
// ABSTAIN on unbalanced straight quotes — the #93 lesson, same engine, same week: with odd parity the
// quote spans cannot be trusted, so stripping them may delete narration or keep dialogue. An
// abstaining response is neither evidence of drift nor evidence of compliance.
function personQuoteParityOdd(clean){
  return ((String(clean||"").match(/"/g)||[]).length%2)===1;
}
function playerCount(){
  var n=(worldState&&worldState.character&&worldState.character.isPC===false)?0:1;
  if(worldState&&worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];if(p&&p.partyMember&&p.isPC&&!npcIsDead(p))n++;}}
  return n;
}
// TODO #1 P2 (multiplayer, D6/D7): the LIGHT active-player pointer. worldState.activePC names the
// party-member PC currently holding the display spotlight (HUD, panels, Car Mode); UNSET = the hero
// — the single-player invariant (every existing save resolves to worldState.character, byte-identical
// behavior). This is DISPLAY routing only: state writes (tag application, level-up, save/load) stay
// on their true owner, and the pointer must never leak into buildSysPrompt before P4 (engine-tested).
// A pointer that no longer names a living isPC party member with a sheet heals LOUDLY to the hero
// (warn + cleared), so demote/death/part-ways can never strand the HUD on a stale character.
function activePlayer(){
  if(typeof worldState==="undefined"||!worldState)return null;
  var nm=worldState.activePC,hero=worldState.character;
  if(nm&&hero&&nm!==hero.name){
    if(worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];
      if(p&&p.name===nm){
        if(p.partyMember&&p.isPC&&p.charSheet&&!npcIsDead(p))return p.charSheet;
        break;
      }}}
    console.warn("[multiplayer] activePC '"+nm+"' is not a living PC party member with a sheet — spotlight returns to "+(hero.name||"the hero"));
    delete worldState.activePC;
  }
  return hero;
}
// Pointer setter — validates, mutates ONLY worldState.activePC, returns success. Callers own
// saveAll()/syncUI(). null or the hero's name clears the pointer (undefined = hero, the ragMemory
// convention — legacy saves stay byte-clean). Rejection is loud, never silent.
function setActivePC(nm){
  if(typeof worldState==="undefined"||!worldState||!worldState.character)return false;
  if(nm==null||nm===worldState.character.name){delete worldState.activePC;return true;}
  if(worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];
    if(p&&p.name===nm&&p.partyMember&&p.isPC&&p.charSheet&&!npcIsDead(p))
      {worldState.activePC=nm;return true;}}}
  console.warn("[multiplayer] setActivePC('"+nm+"') rejected — not a living PC party member with a sheet");
  return false;
}
// ── TODO #1 P3 (D3/D4/D5): the sub-turn round queue — PURE state helpers, no DOM ─────────────
// A round = every active PC queues one action (worldState.mpQueue, rides the sync blob so a
// mid-round reload resumes), then the whole queue resolves as ONE labeled block in ONE GM call
// (D5 — the situation never changes under a player still waiting). Engaged ONLY when
// playerCount()>1; single-player never touches any of this (the spec anchor).
// Round order (D3): the hero first (when a PC), then living isPC party members in roster order.
function mpPcOrder(){
  var order=[];
  if(typeof worldState==="undefined"||!worldState||!worldState.character)return order;
  if(worldState.character.isPC!==false)order.push(worldState.character.name);
  if(worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];
    if(p&&p.partyMember&&p.isPC&&p.charSheet&&!npcIsDead(p))order.push(p.name);}}
  return order;
}
// Drop queue entries whose PC is no longer in the round (demoted/died/parted mid-round) — loud.
function mpPruneQueue(){
  if(!worldState.mpQueue||!worldState.mpQueue.length)return;
  var order=mpPcOrder();
  worldState.mpQueue=worldState.mpQueue.filter(function(q){
    var ok=order.indexOf(q.name)>=0;
    if(!ok)console.warn("[multiplayer] dropped queued action from '"+q.name+"' — no longer an active PC this round");
    return ok;
  });
}
// Queue (or replace — a re-submit overwrites) the given PC's action for this round.
function mpQueuePush(name,action){
  if(!worldState.mpQueue)worldState.mpQueue=[];
  mpPruneQueue();
  var i;for(i=0;i<worldState.mpQueue.length;i++){if(worldState.mpQueue[i].name===name){worldState.mpQueue[i].action=action;return;}}
  worldState.mpQueue.push({name:name,action:action});
}
// First PC in round order with no queued action, or null when the round is complete.
function mpNextUnqueued(){
  var order=mpPcOrder(),q=worldState.mpQueue||[],i,j;
  for(i=0;i<order.length;i++){
    var queued=false;
    for(j=0;j<q.length;j++){if(q[j].name===order[i]){queued=true;break;}}
    if(!queued)return order[i];
  }
  return null;
}
// The D5 labeled block — round order, one "Name: action" line per PC. Caller clears the queue.
function mpAssembleRound(){
  mpPruneQueue();
  var order=mpPcOrder(),q=worldState.mpQueue||[],lines=[],i,j;
  for(i=0;i<order.length;i++){for(j=0;j<q.length;j++){if(q[j].name===order[i]){lines.push(q[j].name+": "+q[j].action);break;}}}
  return lines.join("\n");
}
// ── TODO #1 P5 (D11, forks F1–F4 ratified 2026-07-18): hard splits — pure read helpers ───────
// A party member with charSheet.splitLoc={location,sublocation} is on their OWN thread; null/
// absent = with the party (every legacy save, byte-identical). The HERO can never split — the
// hero IS the primary thread (worldState.world.location).
// THE one effective-location derivation — HUD, party chips, geo block, and suggestions all read
// through here (no scattered splitLoc conditionals).
function pcEffectiveLoc(ch){
  if(ch&&ch.splitLoc&&ch.splitLoc.location)return {location:ch.splitLoc.location,sublocation:ch.splitLoc.sublocation||null};
  var w=(typeof worldState!=="undefined"&&worldState)?worldState.world:null;
  return {location:(w&&w.location)||"",sublocation:(w&&w.sublocation)||null};
}
// Living split party members (the dead drop out passively — a corpse is not a thread; their
// last location survives in memory.npcs[name].lastSeenAt).
function partySplitMembers(){
  var out=[];
  if(typeof worldState==="undefined"||!worldState||!worldState.npcs)return out;
  var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];
    if(p&&p.partyMember&&p.charSheet&&p.charSheet.splitLoc&&p.charSheet.splitLoc.location&&!npcIsDead(p))out.push(p);}
  return out;
}
// Convert a suggested action from 2nd person ("Gather your belongings") to 1st person
// ("Gather my belongings") when it transfers into the input / is sent. Possessives,
// reflexives and contractions convert cleanly; bare "you" is best-effort: object "you"
// (end of clause, or after a preposition/transitive verb) -> "me", otherwise subject -> "I".
function toFirstPerson(s){
  if(!s)return s;
  var out=s
    .replace(/\byou're\b/gi,"I'm").replace(/\byou've\b/gi,"I've")
    .replace(/\byou'll\b/gi,"I'll").replace(/\byou'd\b/gi,"I'd")
    .replace(/\byourselves\b/gi,"ourselves").replace(/\byourself\b/gi,"myself")
    .replace(/\byours\b/gi,"mine").replace(/\byour\b/gi,"my")
    .replace(/\byou\b(?=\s*[.,;:!?]|\s*$)/gi,"me") // object "you" at end of a clause
    .replace(/\b(to|with|at|for|from|of|on|in|into|onto|behind|near|beside|against|toward|towards|upon|before|after|around|let|lets|trust|trusts|see|sees|catch|catches|follow|follows|join|joins|tell|tells|give|gives|show|shows|warn|warns|grab|grabs|face|faces|help|helps|attack|attacks|reach|reaches|bind|binds|drag|drags|pull|pulls|push|pushes|hold|holds|free|frees|save|saves|lead|leads)\s+you\b/gi,function(m){return m.replace(/you$/i,"me");})
    .replace(/\byou\b/gi,"I"); // remaining "you" = subject
  return out.replace(/^([a-z])/,function(m){return m.toUpperCase();});
}
// #88: append terminal punctuation to a suggested action so it reads as a real sentence — and,
// since v1.409, so splitSentences (which keys pause/voice boundaries off terminal punctuation)
// treats a tapped-then-sent suggestion the same as any other player line. Deterministic (applied
// at render, not requested from the model — the model version risks over-punctuating mid-phrase).
// Idempotent: already-punctuated text — including a trailing "…" or a quote/paren closing right
// after the mark — passes through untouched, so re-running it on stored data is always safe.
function punctuateAction(s){
  s=String(s||"").replace(/\s+$/,"");
  if(!s)return s;
  return /[.!?…]["'”’)\]]?$/.test(s)?s:s+".";
}
// ── #30: saved-render POINTERS — the pure list op (engine-tested) ───────────────────────────
// A pointer is {f:filename, t:turn, k:kind} where kind is "renders" (written into the campaign
// folder → RESTORABLE on a later load), "share" (handed to the OS share sheet → the file is in
// Photos, which a web page can never read back) or "download" (browser downloads folder → path
// unknown to us). Only "renders" can ever be restored; the others are an honest record of what
// was saved where. Re-saving the same filename REPLACES its pointer (a re-render of the same
// turn overwrites the same file on disk, so two pointers would be a lie).
function renderPointerAdd(list, ptr, cap) {
  var out = [], i, e;
  if (!ptr || !ptr.f) return (list || []).slice();
  for (i = 0; i < (list || []).length; i++) {
    e = list[i];
    if (!e || !e.f || e.f === ptr.f) continue;      // drop the superseded pointer for this file
    out.push(e);
  }
  out.push({ f: String(ptr.f), t: (typeof ptr.t === "number" ? ptr.t : 0), k: String(ptr.k || "download") });
  cap = cap || 60;
  if (out.length > cap) out = out.slice(out.length - cap);   // oldest fall off the front
  return out;
}
// ── #78 Car Mode: numbered options — the two PURE pieces (engine-tested) ────────────────────
// buildOptionsSpeech renders the spoken menu; parseCarCommand recognizes what the driver said
// back. Both live here (not ui-carmode.js) so the DOM-free harness can exercise them.
//
// "Option 1: …" rather than a bare list — the number is the handle the driver speaks back, so it
// has to lead. Each action is punctuated first (#88) so splitSentences gives clean pause
// boundaries between options instead of running them together.
function buildOptionsSpeech(acts) {
  if (!acts || !acts.length) return "";
  var out = [], i, a;
  for (i = 0; i < acts.length; i++) {
    a = String(acts[i] || "").replace(/^\s+|\s+$/g, "");
    if (!a) continue;
    out.push("Option " + (out.length + 1) + ": " + punctuateAction(a));
  }
  return out.join(" ");
}
// THE FALSE-POSITIVE RULE: a command must be the WHOLE utterance, never a substring. "I attack the
// second guard" and "repeat the ritual" are ACTIONS — matching a bare /second|repeat/ anywhere in
// the transcript would silently eat real turns, which is far worse than missing a command (the
// driver just repeats themselves). So every pattern below is anchored ^…$ over the trimmed,
// punctuation-stripped text, with only a short filler prefix ("uh", "let's", "I'll take") allowed.
// Returns {kind:"pick",n} (1-based) | {kind:"repeat"} (options only) | {kind:"repeatAll"} | null.
var CAR_CMD_FILLER = /^(?:uh+|um+|ok(?:ay)?|so|well|hey|please|lets|i(?:ll| will| want to| wanna)?(?: take| do| pick| choose| go with)?|give me|do|take|pick|choose|go with|the)\s+/;
var CAR_ORDINALS = { one: 1, two: 2, three: 3, four: 4, first: 1, second: 2, third: 3, fourth: 4, "1": 1, "2": 2, "3": 3, "4": 4 };
function parseCarCommand(text, optionCount) {
  var t = String(text == null ? "" : text).toLowerCase();
  // apostrophes are DELETED, not spaced — spacing them splits "let's"→"let s" and "I'll"→"I ll",
  // which is exactly the filler the strip below is trying to remove
  t = t.replace(/['’]/g, "").replace(/[.,!?;:"”“]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  var prev = null, guard = 0;
  while (t !== prev && guard++ < 4) { prev = t; t = t.replace(CAR_CMD_FILLER, ""); }   // strip stacked filler
  // "the second one" → "second". Anchored to ORDINALS only: a blanket /\s+one$/ strip would turn
  // "choice one" into "choice" and lose a legitimate pick.
  t = t.replace(/^(first|second|third|fourth|last)\s+one$/, "$1");
  if (!t) return null;
  // full-scene replay must be tested BEFORE the options replay — "repeat everything" also
  // starts with "repeat", and the more specific phrase has to win
  if (/^(?:repeat|read|say|play)\s+(?:it\s+|that\s+|the\s+)?(?:everything|all|scene|story|narration|again from the start)$/.test(t)
      || /^(?:repeat|read)\s+everything$/.test(t) || /^everything again$/.test(t)) return { kind: "repeatAll" };
  /* #308 Car Mode bookends: "wrap up" lands the scene at a hook within two turns; "previously" speaks the recap. */
  if (/^(?:i )?roll(?: (?:the )?(?:dice|die|d20))?$/.test(t)) return { kind: "roll" };/* #329 */
  /* #6 E9: a spoken undo scoped to the LAST item move (a placement or a take) — anchored, so "never mind the guard, I attack" stays an action */
  if (/^(?:never mind|nevermind|undo(?: that| it| the last one)?|put it back|scratch that)$/.test(t)) return { kind: "undoItem" };
  /* #410: a spoken PAUSE / RESUME (owner vocabulary 2026-09-14: "stop" is too common a word). Anchored like everything
     else — "I pause at the door" is an action; bare "continue" is NOT a command because "continue" alone is a plausible
     action (keep walking), so the resume side is resume / unpause / GM resume / GM continue. What pause DOES is decided
     by carHoldDispatch below, not here. */
  if (/^(?:gm )?pause$/.test(t)) return { kind: "pause" };
  if (/^(?:gm )?(?:resume|unpause)$|^gm continue$/.test(t)) return { kind: "resume" };
  if (/^(?:lets |let us )?(?:wrap(?: it)?(?: up)?|stop here|find a stopping point|stopping point|end (?:it|here) for now)$/.test(t)) return { kind: "wrapUp" };
  if (/^(?:previously|recap|catch me up|where were we|where was i|what happened(?: last time| before)?|remind me)$/.test(t)) return { kind: "recap" };
  if (/^(?:repeat|again|say again|repeat that|say that again|read again|read that again|one more time)$/.test(t)
      || /^(?:what are )?(?:my )?(?:the )?(?:options|choices)(?: again)?$/.test(t)
      || /^repeat (?:the )?(?:options|choices)$/.test(t)) return { kind: "repeat" };
  var n = null, m;
  if (CAR_ORDINALS[t] !== undefined) n = CAR_ORDINALS[t];
  else if ((m = /^(?:option|number|choice)\s+(\w+)$/.exec(t)) && CAR_ORDINALS[m[1]] !== undefined) n = CAR_ORDINALS[m[1]];
  else if (/^last$/.test(t)) n = optionCount || 0;
  if (!n) return null;
  if (optionCount && n > optionCount) return null;   // "four" with 3 options is not a pick — let it be an action
  return { kind: "pick", n: n };
}
// #410 — what a spoken PAUSE or RESUME does, as a pure table over the moment it arrives. The Car Mode
// mic opens only AFTER narration (auto-mic on TTS done), so a spoken "pause" can almost never reach a
// playing narrator — the tap and the steering-wheel button already do that. What the word CAN do is
// HOLD the session: close the mic and stop the auto-mic loop re-opening it after every turn (the
// car-park case), until "resume" or a tap. When narration IS playing (cloud STT text arriving late),
// pause maps onto the existing TTS pause toggle, exactly as the tap does.
//   cmdKind: "pause" | "resume";  st: { ttsPlaying, ttsPaused, held }
//   → { op: "ttsPause" | "hold" | "ttsResume" | "release" | "noop", held: bool, status: key of CAR_STR | null }
// ui-carmode.js executes op; ambience (Astra's pilot) subscribes to the "tnd:car-intent" event the
// executor dispatches — pause ends ambience, the next narration start brings it back (owner ruling 1).
function carHoldDispatch(cmdKind, st) {
  var s = st || {};
  if (cmdKind === "pause") {
    if (s.ttsPlaying) return { op: "ttsPause", held: true, status: "paused" };
    return { op: "hold", held: true, status: "pausedHold" };
  }
  if (cmdKind === "resume") {
    if (s.ttsPaused) return { op: "ttsResume", held: false, status: "narratorSpeaking" };
    if (s.held) return { op: "release", held: false, status: "listening" };
    return { op: "noop", held: false, status: "nothingPaused" };
  }
  return { op: "noop", held: !!s.held, status: null };
}
// #77 Layer-2 confirm vocabulary — SAME false-positive discipline as parseCarCommand above:
// whole utterance, anchored ^…$, filler-stripped. "no time to lose" and "yes and I draw my
// sword" are ACTIONS. "again"/"repeat" are safe to claim here because a pending confirmation
// OWNS the utterance (the #78 menu grammar is never consulted while one is pending — the
// interceptor order in stt.js is pinned by the #77 CONFIRM GATE contract in run-tests.js).
// Returns "yes" | "no" | "redo" | "repeat" | null.
function parseConfirmCommand(text) {
  var t = String(text == null ? "" : text).toLowerCase();
  t = t.replace(/['’]/g, "").replace(/[.,!?;:"”“]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  var prev = null, guard = 0;
  while (t !== prev && guard++ < 4) { prev = t; t = t.replace(CAR_CMD_FILLER, ""); }
  if (!t) return null;
  if (/^(?:yes|yeah|yep|yup|aye|correct|right|thats right|that is right|confirm|send|send it|yes send it|go ahead|sure)$/.test(t)) return "yes";
  if (/^(?:no|nope|nah|cancel|dont|dont send|dont send it|discard|drop it|never mind|nevermind|scratch that|forget it)$/.test(t)) return "no";
  if (/^(?:redo|retry|try again|again|start over|re do|new take)$/.test(t)) return "redo";
  if (/^(?:repeat|repeat it|say again|what|what did you hear|read it back)$/.test(t)) return "repeat";
  return null;
}
// bibleCardHTML (TODO #10) — the shared capability-card renderer. Pure: name + bible entry in,
// ── #81 item bible accessors — the classDef()-in-helpers pattern (item_bible.js is pure data) ──
// itemBaseName: the ONE key normalizer for inventory strings. Real saves carry three provenance
// forms, all of which must strip to the TYPE key (TYPE vs INSTANCE is the ruled schema line):
//   "Alchemist's fire x5"                          → "alchemist's fire"   (count)
//   "Skinsaw knife (wrapped, ritual implement)"    → "skinsaw knife"      (parenthetical)
//   "Iron ring — unmarked x6"                      → "iron ring"          (dash clause + count)
//   "Collector's ledger - closed-eye cipher, ..."  → "collector's ledger" (spaced hyphen clause)
// Intra-word hyphens survive ("Trip-wire cord" — the dash cut requires surrounding spaces).
// ── #227 the deep-time age ladder ───────────────────────────────────────────────
// The world's history as a CLOSED, ORDERED ENUM of named rungs, oldest first. Written ONCE at
// campaign start (blueprint field or generated skeleton) and NEVER mutated in play — there is
// deliberately no tag for it, because a ceiling the GM can raise is not a ceiling, and because
// this text rides the CACHED stable half where a mid-campaign write would silently kill every
// prompt-cache hit for the rest of the campaign.
// Pure and total: any junk shape normalizes to [], which is the natural off-state ("" block).
function normalizeDeepTime(raw){
  if(!raw||Object.prototype.toString.call(raw)!=="[object Array]")return [];
  var out=[],i,r,nm;
  for(i=0;i<raw.length&&out.length<DEEP_TIME_RUNGS_CAP;i++){
    r=raw[i];
    if(!r||typeof r!=="object")continue;
    nm=String(r.name==null?"":r.name).trim();
    if(!nm)continue; // a nameless rung cannot be pointed at, so it cannot be a rung
    out.push({name:nm.slice(0,DEEP_TIME_NAME_MAX),
              when:String(r.when==null?"":r.when).trim().slice(0,DEEP_TIME_WHEN_MAX),
              note:String(r.note==null?"":r.note).trim().slice(0,DEEP_TIME_NOTE_MAX)});
  }
  return out;
}

function itemBaseName(nm){
  var s=String(nm||"");
  s=s.replace(/\s+x\d+\s*$/i,"");        // trailing count: "… x6"
  var cut=s.search(/\s+[—–-]\s+/);        // first spaced dash begins the provenance clause
  if(cut>=0)s=s.slice(0,cut);
  s=s.replace(/\s*\(.*\)/,"");           // parenthetical provenance (the capBaseName pattern)
  s=s.replace(/\s+x\d+\s*$/i,"");        // count that sat before a stripped clause
  return s.toLowerCase().replace(/\s+/g," ").trim();
}
// #492 (playtest v1.1078, 2 of 2 runs): the fourth button's buy rung named the first ware on the list without looking in the
// pack, so it offered the dagger the hero had just bought. ONE picker for both branches (village and adventure): the first
// ware whose base name the hero does not hold (itemBaseName: a count, a provenance note and letter case do not hide an item),
// or null when every ware is held — the rung then steps aside.
function firstWareNotHeld(wares,inventory){
  var held={},i;for(i=0;i<(inventory||[]).length;i++)held[itemBaseName(inventory[i])]=true;
  for(i=0;i<(wares||[]).length;i++)if(wares[i]&&!held[itemBaseName(wares[i].item)])return wares[i];
  return null;
}
// ── #157: the inventory category registry — ONE ordered list (Sol's spec §3.1) ─────────────
// Array position IS the display priority; the classifier, editor, renderers, validation, and
// tests all consume this registry. Never store separate numeric ranks that could disagree.
var INVENTORY_CATEGORY_REGISTRY=[
  {id:"weapon",     label:"Weapons"},
  {id:"armor",      label:"Armor"},
  {id:"quest",      label:"Quest"},
  {id:"consumable", label:"Consumables"},
  {id:"tool",       label:"Tools"},
  {id:"treasure",   label:"Treasure"},
  {id:"mundane",    label:"Mundane"}
];
function _invCatValid(id){var i;for(i=0;i<INVENTORY_CATEGORY_REGISTRY.length;i++){if(INVENTORY_CATEGORY_REGISTRY[i].id===id)return true;}return false;}
// The display-membership set for an entry: a VALID inventoryCategories array wins; a legacy
// entry (no array) derives [category]; invalid metadata (empty array, unknown id, category
// missing from the array's implied membership) returns null — the caller files the row under
// Unclassified and the defect stays VISIBLE, never silently repaired (Sol §3.4, spec step 3).
var _invCatWarned={};
function itemInvCategories(entry){
  if(!entry)return null;
  var arr=entry.inventoryCategories;
  if(arr===undefined)return _invCatValid(entry.category)?[entry.category]:null;
  if(!(arr instanceof Array)||!arr.length)return null;
  var seen={},i;
  for(i=0;i<arr.length;i++){if(!_invCatValid(arr[i])||seen[arr[i]])return null;seen[arr[i]]=1;}
  return arr;
}
// ── #157: exact alias index (Sol §3.6 — never substring, never stemming, never inference) ──
// One collision-checked map alias→canonical over the static bible + campaign overlay. Cached;
// the memo key is the two stores' entry counts (overlay entries are write-once, the static
// bible changes only on deploy, so counts identify the state). A collision — an alias shadowing
// a LIVE key, or two entries claiming one alias — warns loudly ONCE and EXCLUDES that alias, so
// runtime resolution is never decided by object order: the ambiguous name simply stays
// unresolved and surfaces as Unclassified.
var _itemAliasMemo=null,_itemAliasMemoKey="";
function _itemAliasIndex(){
  var stat=(typeof ITEM_BIBLE!=="undefined")?ITEM_BIBLE:{};
  var ov=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)||{};
  var mk=Object.keys(stat).length+"|"+Object.keys(ov).length;
  if(_itemAliasMemo&&_itemAliasMemoKey===mk)return _itemAliasMemo;
  var idx={},dead={},k,i;
  function claim(alias,canon){
    var a=itemBaseName(alias);
    if(!a)return;
    if(stat[a]||ov[a]){if(!_invCatWarned["ak:"+a]){_invCatWarned["ak:"+a]=1;if(typeof console!=="undefined")console.warn("[items] alias '"+a+"' (on '"+canon+"') shadows a LIVE item key — alias ignored; an exact key always wins (#157)");}dead[a]=1;return;}
    if(idx[a]&&idx[a]!==canon){if(!_invCatWarned["ad:"+a]){_invCatWarned["ad:"+a]=1;if(typeof console!=="undefined")console.warn("[items] alias '"+a+"' claimed by BOTH '"+idx[a]+"' and '"+canon+"' — ambiguous, resolves to neither (#157)");}dead[a]=1;return;}
    idx[a]=canon;
  }
  for(k in stat){var sa=stat[k].aliases||[];for(i=0;i<sa.length;i++)claim(sa[i],k);}
  for(k in ov){var oa=ov[k].aliases||[];for(i=0;i<oa.length;i++)claim(oa[i],k);}
  for(k in dead)delete idx[k];
  _itemAliasMemo=idx;_itemAliasMemoKey=mk;
  return idx;
}
// The ONE item lookup — tooltip, viewer, grouping, and GM injection all read through here. The
// emergent per-campaign overlay (worldState.itemBible — player-CONFIRMED [ITEM_DEF:] proposals,
// never raw model output) wins over the static base, so an accepted correction is
// authoritative. #157: an exact-alias hop runs only after BOTH exact-key probes miss — canonical
// resolution, never a UI-only second classifier (Sol §4).
// #294 (field 2026-08-31, the t2412 Karzoug's-ring defect): decide what one key SERVES when
// both stores hold it. An effect-bearing overlay wins WHOLESALE (#157 precedence, unchanged).
// But a CLASSIFICATION-ONLY overlay stub (effect "N/A") must not shadow real base canon —
// that shape left the ring permanently descriptionless (no tooltip, no injection, and #285
// rightly refuses Define on overlay entries, so there was no player exit either). Canon
// fields fall through to the base; the overlay keeps its display classification.
function _itemServe(ov,base){
  if(ov&&base&&ov.effect==="N/A"&&base.effect&&base.effect!=="N/A"){
    var m={},k;
    for(k in base)m[k]=base[k];
    if(ov.category)m.category=ov.category;
    if(ov.inventoryCategories)m.inventoryCategories=ov.inventoryCategories;
    return m;
  }
  return ov||base||null;
}
// #303: a bible `value` ("50 gp", "1,200 gp") → number; null for N/A or anything unparseable.
// #309 (the #297 rule generalised for every name router): does `hay` mention `needle` as a NAME?
// Word-boundaried, case-insensitive, and a possessive right after the name is a DIFFERENT thing —
// "Nolan Grimtide's raider" is not Nolan Grimtide. Epithets still match ("Kresh the Tall" ⊃ Kresh).
// #300: the companions who can actually intervene — living, in the party, and NOT split away.
function presentCompanions(){var a=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[];return a.filter(function(n){return !(n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location);});}
// #325 (owner ruling 2026-09-03): when the authored spine's LAST act closes, the ending is OFFERED,
// never forced — a modal decides, "play on" snoozes it. Pure. (#364 moved the offer to the File menu
// and the quest journal; audit E16 deleted the orphaned endingOfferText copy of its wording.)
function endingChoiceFromText(t){return /\bwrite the ending\b/i.test(String(t||""));}
function spineTold(){var sk=(typeof worldState!=="undefined"&&worldState)?worldState.skeleton:null,acts=sk&&sk.acts;if(!acts||!acts.length)return false;var i;for(i=0;i<acts.length;i++)if(!acts[i]||acts[i].status!=="completed")return false;return true;}
function endingOffered(){
  if(typeof worldState==="undefined"||!worldState||campaignEnded())return false;var sc=worldState.spineComplete;
  /* #325b: a save whose last act closed before v1.800 carries no stamp — derive it from the skeleton and backfill (the lazy-stamp precedent) */
  if(!sc&&spineTold()){var _acts=worldState.skeleton.acts,_last=_acts[_acts.length-1];sc=worldState.spineComplete={turn:_last.completedTurn||worldState.turn,act:_last.title||"",backfilled:true};}
  if(!sc)return false;if(typeof sc.snoozedUntil==="number"&&worldState.turn<sc.snoozedUntil)return false;return true;}
// #364 (owner call 2026-09-07): the ending offer leaves the fourth button for the File menu, and the
// session bar carries the signal the button used to — "Campaign Complete" in place of the act.
// Pure over state. membarActLabel → {text,done}; endingMenuVisible ignores the snooze (a menu is
// not a nag) and hides once the campaign has ended.
function membarActLabel(){var ws=(typeof worldState!=="undefined")?worldState:null;if(!ws)return null;
  if(campaignEnded()||ws.spineComplete||spineTold())return {text:"Campaign Complete",done:true};
  var sk=ws.skeleton,i;if(sk&&sk.acts){for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="active"){return {text:actLabel(i+1,sk.acts[i].title),done:false};/* #376 */}}}
  return null;}
// #366: THE coda predicate — the authored spine is told (or stamped), no act is active, the campaign
// is open. One derived truth with several consumers (the post-spine PACING line, the XP meter, and
// any future consequence detector that must stay quiet during an earned rest). Pure over state.
function codaState(){var ws=(typeof worldState!=="undefined")?worldState:null;if(!ws||campaignEnded())return false;
  if(!(ws.spineComplete||spineTold()))return false;var sk=ws.skeleton,i;if(sk&&sk.acts)for(i=0;i<sk.acts.length;i++)if(sk.acts[i]&&sk.acts[i].status==="active")return false;return true;}
function endingMenuVisible(){return !!(typeof worldState!=="undefined"&&worldState&&!campaignEnded()&&(worldState.spineComplete||spineTold()));}
function campaignEnded(){return !!(typeof worldState!=="undefined"&&worldState&&worldState.ended);}
// #300: the only two moves a downed hero has — the engine authors these buttons, no model call.
// #301: the two moves after Death has answered — engine buttons, no model call; typed text routes to one.
function deathChoiceButtons(){return ["Walk back to camp with Death","Go onward"];}
function deathChoiceFromText(t){var s=String(t||"").toLowerCase();if(/\bback\b|\bcamp\b|\breturn\b|\bwake\b/.test(s))return "back";if(/\bonward\b|\bgo on\b|\bforward\b|\bbeyond\b|\bfollow\b/.test(s))return "onward";return null;}
function downedChoices(){return ["Struggle — fight for consciousness, crawl, cling to life","Yield — let go and trust whoever finds you"];}
// #300: Rest heals. A long rest restores the hero and every living companion to full (the one heal
// site for both paths — button and [REST:long]); a short rest rolls ONE hit die + CON, never past max.
// csXpMeter — ONE XP-meter computation for every sheet host. C6 ran the curve to 20 but the
// displays kept the pre-bible lvl>=10 ceiling, so a Level 10 sheet claimed "Max level" with a
// full bar while the engine would happily ding 11 at the next gate (the Ammut t1431 report).
// "Max level" now means the END of the curve; the bar is progress within the current band.
function csXpMeter(xp,lvl,coda){
  var X=classXpLevels(),next=lvl<X.length?X[lvl]:null,prev=X[lvl-1]||0;
  if(coda&&!(next!==null&&xp>=next))return {lbl:xp+" XP",tail:"The story is what advances now",pct:next===null?100:Math.max(0,Math.min(100,Math.round(((xp-prev)/Math.max(1,next-prev))*100))),coda:true};/* #366: post-spine, the act and boss paymasters cannot fire — say so instead of "0.3% to Lv 18" (an earned level still lands at camp, #349) */
  var pct=next===null?100:Math.max(0,Math.min(100,Math.round(((xp-prev)/Math.max(1,next-prev))*100)));// low clamp: xp below the level floor rendered width:-N% — invalid CSS, dropped, div defaulted to FULL (the Morwen full-bar lie)
  if(next!==null&&xp>=next)return {lbl:xp+" / "+next+" XP",tail:"Lv "+(lvl+1)+" ready \u2014 rest to claim",pct:100};/* #349: the level is earned, the camp lands it */
  return {lbl:next===null?xp+" XP":xp+" / "+next+" XP",tail:next===null?"Max level":"Next: Lv "+(lvl+1),pct:pct};
}
function restHealFull(){var c=worldState&&worldState.character;if(!c)return 0;var n=0;if(typeof c.maxHp==="number"&&c.hp<c.maxHp){c.hp=c.maxHp;n++;}var party=(typeof livingPartyCompanions==="function")?livingPartyCompanions():[],i;for(i=0;i<party.length;i++){var cs=party[i].charSheet;if(cs&&typeof cs.maxHp==="number"&&cs.hp<cs.maxHp){cs.hp=cs.maxHp;n++;}}return n;}
function restShortHeal(){var c=worldState&&worldState.character;if(!c||typeof c.maxHp!=="number")return 0;if(c.hp>=c.maxHp)return 0;var d=(typeof classDef==="function"&&classDef(c.cls)&&classDef(c.cls).hd)||8;var mod=c.stats?Math.floor(((c.stats.CON||10)-10)/2):0;/* #349 fix: smod() returns a STRING ("+2") — "1"+"+2" concatenated and Math.max turned it NaN, so every [REST:short] since #300 set hp to NaN */var n=Math.max(1,Math.floor(Math.random()*d)+1+mod);n=Math.min(n,c.maxHp-c.hp);c.hp+=n;return n;}
function nameContains(hay,needle){
  var h=String(hay==null?"":hay).toLowerCase(),n=String(needle==null?"":needle).toLowerCase().trim();
  if(!h||!n)return false;
  var from=0,i;
  while((i=h.indexOf(n,from))>=0){
    var before=i>0?h.charAt(i-1):" ",after=h.charAt(i+n.length);
    var bOk=!/[a-z0-9]/.test(before),aOk=!after||!/[a-z0-9]/.test(after);
    var poss=(after==="'"||after==="\u2019")&&/^s?\b/.test(h.slice(i+n.length+1));
    if(bOk&&aOk&&!poss)return true;
    from=i+1;
  }
  return false;
}
/* #481 D5 (audit 2026-09-29, Fable-approved): ONE coin parser for every price the economy reads — the item bible's value,
   a ware's price, a wanted offer, the [GOLD:] tag and the quest-reward parses. Gold, silver, copper, platinum (1 gp = 10 sp
   = 100 cp; 1 pp = 10 gp; "gp"/"gold"/"gold pieces"…), thousands commas, and a BUNDLE: "1 gp per 20" / "for 20" prices one
   of twenty; "each" prices one. A price is the first number that carries a unit (a sign is no part of it — "2-3 gp" is 3);
   `lead` reads a [GOLD:] body by its LEADING signed number and only the unit written right after it ("-2 (2 sp change)" is
   -2, unit-less). → {amount, unit: "gp"|"sp"|"cp"|"pp"|null, gp: the amount in gold, per, unitGp: gold for ONE unit}, or
   null when there is no number at all ("N/A", "beyond price"). Pure. */
var COIN_UNIT_KEY={gp:"gp",gold:"gp",sp:"sp",silver:"sp",cp:"cp",copper:"cp",pp:"pp",platinum:"pp"};
function parseCoin(str,lead){
  var s=String(str==null?"":str).toLowerCase().replace(/(\d),(?=\d{3}(?!\d))/g,"$1");
  if(lead&&!/^\s*[+-]?\d/.test(s))return null;
  var re=/([+-]?\d+(?:\.\d+)?)(?:\s*(gp|sp|cp|pp|gold|silver|copper|platinum)(?![a-z])(?:\s+(?:pieces?|coins?)(?![a-z]))?)?/g,m,first=null,hit=null;
  while((m=re.exec(s))){if(!first)first=m;if(lead)break;if(m[2]){hit=m;break;}}
  hit=(lead||!hit)?first:hit;if(!hit)return null;
  var amount=parseFloat(hit[1]);if(!lead)amount=Math.abs(amount);
  var unit=hit[2]?COIN_UNIT_KEY[hit[2]]:null,gp=unit==="sp"?amount/10:unit==="cp"?amount/100:unit==="pp"?amount*10:amount;
  var pm=s.slice(hit.index+hit[0].length).match(/^\s*(?:per|for|\/)\s*(\d+)(?![\d.])/),per=pm?Math.max(1,parseInt(pm[1],10)):1;
  return {amount:amount,unit:unit,gp:gp,per:per,unitGp:gp/per};
}
/* #481 D5: a [GOLD:] tag as the purse reads it — whole gold pieces (the leading number, truncated as before). A coin in
   another unit is NOT gold: {ok:false} and the GOLD handler refuses it (never converts). */
function goldTagParse(tag){
  var raw=String(tag==null?"":tag),body=raw.replace(/^\s*\[GOLD:/i,"").replace(/\]\s*$/,""),c=parseCoin(body,true);
  if(!c)return {ok:false,raw:raw,unit:null,n:0};
  var n=c.amount<0?Math.ceil(c.amount):Math.floor(c.amount);
  return {ok:!c.unit||c.unit==="gp",raw:raw,unit:c.unit,n:n};
}
/* #481 D5: the reward a reply pays — the first [GOLD:+N] the purse would accept (a deduction or a coin in another unit is
   no reward). One reader for the completion toast, the archive's paid record and the re-completion double-pay check. */
function goldRewardIn(text){
  var tags=String(text==null?"":text).match(/\[GOLD:\s*\+?\d[^\]]*\]/gi)||[],i;
  for(i=0;i<tags.length;i++){var g=goldTagParse(tags[i]);if(g.ok&&g.n>0)return g.n;}
  return 0;
}
/* #481 C11: a narration snippet as a SENTENCE, never a cut word (the Necrotic t35 "First met: … to the rightmo"). Text
   that already ends a sentence stands; otherwise it ends at the last sentence end — a closing quote rides with its period,
   and a paragraph break counts (the old cutter knew only ". " and sliced mid-sentence at 280) — when that end is past 20
   characters (a real sentence, not a bare "Hi."), else at a word boundary with an ellipsis. Used where a first encounter
   is filed (R.feGet) and where one is shown (memoryNpcDetail, the companion-sheet prompt). Pure. */
function snippetAtSentence(text,max){
  var s=String(text==null?"":text).trim();if(max&&s.length>max)s=s.slice(0,max);
  if(!s||/[.!?]["'\u201d\u2019)\]]*$/.test(s))return s;
  var re=/[.!?]["'\u201d\u2019)\]]*(?=\s)/g,m,end=-1;while((m=re.exec(s)))end=m.index+m[0].length;
  if(end>20)return s.slice(0,end);/* a real sentence, not a bare "Hi." */
  var sp=s.lastIndexOf(" ");return (sp>0?s.slice(0,sp):s).replace(/[\s,;:\u2014\u2013-]+$/,"")+"\u2026";
}
function itemValueGp(entry){if(!entry||!entry.value)return null;var c=parseCoin(entry.value);return (c&&c.unit)?c.unitGp:null;}/* #481 D5: ONE unit, in gold */
// #303: LOCATION_SIZE text → the wares-cap tier. The GM's vocabulary is physical scale (small /
// medium / large / vast — measured on the t2097 map); settlement words are folded in as a courtesy.
// null when the node carries no size at all — an unsized place never gets a market ask.
function waresSizeTier(size){var s=String(size||"").toLowerCase().trim();if(!s)return null;if(/vast|huge|sprawling|metropol/.test(s))return "vast";if(/large|big|major|city/.test(s))return "large";if(/medium|mid|moderate|town/.test(s))return "medium";if(/small|tiny|little|hamlet|village|outpost/.test(s))return "small";return "unknown";}
/* #81b (owner field report 2026-09-13): item canon TRAVELS with the sheet. A campaign's [ITEM_DEF:] overlays live on
   worldState.itemBible; a character sheet is only a list of item names, so an exported hero arrived in the next campaign
   with his runeforged Cleaver filed Unclassified. portableSheet attaches the origin campaign's definitions for the items
   the sheet carries; adoptSheetItemDefs merges them into the destination's canon, missing keys only (canon is write-once,
   #81). Every export (the .char file, the library saves, the party upload) and every import (startGame, a resident
   moving in, an imported companion) goes through these two. Pure over worldState.itemBible; never throws. */
function sheetItemDefs(sheet){
  var out={},n=0,ovs=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)||null;if(!sheet||!ovs)return out;
  var inv=sheet.inventory||[],i;for(i=0;i<inv.length;i++){var key=itemBaseName(inv[i]);if(!key)continue;var hit=key;if(!ovs[hit]){var canon=_itemAliasIndex()[key];if(canon&&ovs[canon])hit=canon;else continue;}if(!out[hit]){out[hit]=ovs[hit];n++;}}
  return out;
}
function portableSheet(sheet){
  if(!sheet||typeof sheet!=="object")return sheet;
  var copy=JSON.parse(JSON.stringify(sheet)),defs=sheetItemDefs(sheet),k,any=false;for(k in defs){any=true;break;}
  if(any)copy.itemDefs=JSON.parse(JSON.stringify(defs));else delete copy.itemDefs;
  return copy;
}
function adoptSheetItemDefs(sheet){
  if(!sheet||typeof sheet!=="object"||!sheet.itemDefs||typeof sheet.itemDefs!=="object"||typeof worldState==="undefined"||!worldState)return 0;
  if(!worldState.itemBible)worldState.itemBible={};
  var k,n=0,adopted={};for(k in sheet.itemDefs){if(!sheet.itemDefs[k]||typeof sheet.itemDefs[k]!=="object")continue;if(worldState.itemBible[k])continue;/* the destination's canon wins — write-once */worldState.itemBible[k]=adopted[k]=JSON.parse(JSON.stringify(sheet.itemDefs[k]));n++;}
  if(n&&typeof itemBibleHeal==="function")itemBibleHeal(adopted);/* #436: a sheet exported before the fix carries the clobber with it — healed on the way in, the copies only */
  if(n&&typeof console!=="undefined")console.info("[items] "+n+" item definition(s) travelled in with "+(sheet.name||"a sheet")+" (#81b)");
  return n;
}
function itemLookup(nm){
  var key=itemBaseName(nm);
  if(!key)return null;
  var ovs=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)||null;
  var bib=(typeof ITEM_BIBLE!=="undefined"&&ITEM_BIBLE)||null;
  var hit=_itemServe(ovs&&ovs[key],bib&&bib[key]);
  if(hit)return hit;
  var canon=_itemAliasIndex()[key];
  if(!canon)return null;
  return _itemServe(ovs&&ovs[canon],bib&&bib[canon]);
}
// #285 (joint review f18): THE Define-eligibility gate — the ONE predicate the sheet button and
// buildItemDefinePrompt both call, so the surfaces can never disagree. Eligible when the item has
// no canon at all (the original #230 case), OR when it resolves BY ITS OWN KEY to a curated BASE
// entry that is classification-only (effect "N/A" outside mundane/treasure — such an entry
// organizes and tooltips but NEVER injects via buildItemBibleBlock, so the GM still re-derives the
// item's nature from its name every turn: the Cleaver drift class). The ITEM_DEF handler's
// write-once check tests only the worldState.itemBible OVERLAY, so a player-confirmed def lands
// and correctly shadows the base (#157 precedence). An existing OVERLAY entry — even a
// classification-only one — stays ineligible: there write-once is REAL and a paid review call
// could never land. Alias-resolved entries stay ineligible: the proposal would land under the
// alias's own key and split resolution from the curated canon key.
/* #289: does this account payload hide the operator's Dev-only menu rows? Pure — the DOM shell is
   applyMenuTier (ui-shell.js). null = not signed in (local dev keeps everything); a signed-in
   payload hides unless the server says isAdmin:true (a server predating the field reads as a
   non-admin, which is the safe direction for a beta tester's screen). */
function menuTierHidesDev(acct){
  if(!acct)return false;
  return acct.isAdmin!==true;
}
function itemDefEligible(rawItem){
  if(typeof itemBaseName!=="function"||typeof itemLookup!=="function")return false;
  var key=itemBaseName(rawItem);
  if(!key)return false;
  var hit=itemLookup(rawItem);
  if(!hit)return true;
  var ov=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)?worldState.itemBible[key]:null;
  var base=(typeof ITEM_BIBLE!=="undefined")?ITEM_BIBLE[key]:null;
  if(ov){
    /* #294 Part B ②: write-once is write-once-per-REAL-canon. An effect-bearing overlay is real
       canon and stays sealed; a classification-only overlay over a BASE is served through to the
       base by _itemServe (Part A) so there is nothing to define; a classification-only overlay
       with NO base (Karzoug's cracked crown at t2412) was a dead end — Define-eligible now, and
       itemDefAccept / the ITEM_DEF handler let an accepted proposal replace it. */
    if(ov.effect&&ov.effect!=="N/A")return false;
    if(base)return false;
    return ov.category!=="mundane"&&ov.category!=="treasure";
  }
  if(!base||base!==hit)return false;/* alias-resolved */
  return hit.effect==="N/A"&&hit.category!=="mundane"&&hit.category!=="treasure";
}
/* #294B: may an accepted [ITEM_DEF:] proposal land on this key? Shared by itemDefAccept and the
   ITEM_DEF tag handler so the two boundaries cannot disagree: only an EFFECT-BEARING overlay is
   sealed (write-once per real canon); a classification-only overlay is replaceable. */
function itemDefOverlayReplaceable(key){
  var ov=(typeof worldState!=="undefined"&&worldState&&worldState.itemBible)?worldState.itemBible[key]:null;
  if(!ov)return true;
  return !(ov.effect&&ov.effect!=="N/A");
}
/* #436 (field finding, The Necrotic Dungeon t11, 2026-09-23): ONE field reader for the definition
   tags ([ITEM_DEF:] and [SPELL_DEF:]). A part is KEYED when it carries '=' (the taught form) OR
   opens with a known key and a colon — the form the GM drifts into because the injected ITEM
   CANON line reads "effect: … | uses: … | value: …". The #298 positional reader took
   "uses:at-will|value:800 gp" by POSITION, so the price landed in the EFFECT slot and the drain
   mechanic the GM had written for the daggers was gone before the player ever saw the proposal.
   Returns {key,val,keyed:true,known} for a keyed part (an unknown '=' key stays keyed so the
   caller can warn on it, as before) or {val,keyed:false} for a bare part. Pure. */
function defFieldRead(part,known){
  var s=String(part==null?"":part),m=s.match(/^\s*([A-Za-z_]+)\s*([:=])\s*([\s\S]*)$/);
  if(m){var k=m[1].toLowerCase();
    if(m[2]==="="||(known&&known[k]))return{key:k,val:m[3].replace(/\s+$/,""),keyed:true,known:!!(known&&known[k])};}
  var eq=s.indexOf("=");
  if(eq>=0)return{key:s.slice(0,eq).trim().toLowerCase(),val:s.slice(eq+1).trim(),keyed:true,known:false};/* "charges left=3" — keyed, unknown, warned by the caller */
  return{val:s.trim(),keyed:false,known:false};
}
var ITEM_DEF_KEYS={category:1,effect:1,uses:1,value:1};
/* #436: the clobber fingerprint — an effect that is nothing but a field label and its payload
   ("value:250 gp"). Nine accepted overlays across three campaigns carried it, each SEALED as real
   canon (write-once tests the effect) and injected every turn as "effect: value:250 gp". The
   payload MOVES into the field it named — only into an empty one, a filled field is never
   overwritten — and the effect becomes "N/A", which every reader already treats as
   classification-only: unsealed for Define, never injected. Returns the label moved, "" when
   nothing changed (idempotent), and null when the entry carries the fingerprint but could not be
   healed (the target field holds something else — left as written for the caller to shout). Only
   value/uses labels heal: category has a real default, so an explicit "tool" is indistinguishable
   from an unset one, and the category form has never been observed. */
function itemDefHeal(e){
  if(!e||typeof e.effect!=="string")return "";
  var m=e.effect.match(/^\s*(value|uses)\s*:\s*([\s\S]*?)\s*$/i);
  if(!m)return "";
  var k=m[1].toLowerCase(),v=m[2];
  if(e[k]&&e[k]!=="N/A"&&e[k]!==v)return null;
  e[k]=v||"N/A";e.effect="N/A";
  return k;
}
/* #436: heal every entry of an overlay map (worldState.itemBible, or a sheet's travelling itemDefs)
   in place; returns the healed keys. Shouts per entry, never throws. */
function itemBibleHeal(map){
  var out=[],k;if(!map||typeof map!=="object")return out;
  for(k in map){var e=map[k];if(!e||typeof e!=="object")continue;
    var r=itemDefHeal(e);
    if(r){out.push(k);if(typeof console!=="undefined")console.warn("[items] #436 healed '"+k+"' — its effect was only a "+r+" label (the mixed =/: clobber); "+r+" is now \""+e[r]+"\", the effect is N/A, and the item is Define-eligible again");}
    else if(r===null&&typeof console!=="undefined")console.warn("[items] #436 could NOT heal '"+k+"' — its effect is a field label (\""+e.effect+"\") but that field already holds \""+e[e.effect.match(/^\s*(\w+)/)[1].toLowerCase()]+"\"; left as written, fix it by hand");}
  return out;
}
// #285: the confirm modal's shadow notice — non-empty when accepting the keyed proposal would
// REPLACE a curated base entry wholesale (multi-category listings and curated value/uses are
// superseded unless the proposal repeats them — the no-silent-failures line the player sees).
function itemDefShadowNote(key){
  if(typeof ITEM_BIBLE==="undefined"||!key||!ITEM_BIBLE[key])return"";
  return "Accepting replaces the existing organize-only catalog entry for this item ("+ITEM_BIBLE[key].category+") — the new definition becomes the whole entry.";
}
// ── #157: THE shared inventory view model (Sol §5) — one pure grouping fn, two renderers ───
// Returns non-empty category groups in registry order (+ Unclassified last), each row carrying
// its ORIGINAL array index so a visually regrouped Drop still removes the right stored row.
// Every input row appears exactly once; the stored array is never reordered or rewritten.
function groupInventory(inv){
  inv=inv||[];
  var buckets={},order=[],i,j;
  for(i=0;i<INVENTORY_CATEGORY_REGISTRY.length;i++){buckets[INVENTORY_CATEGORY_REGISTRY[i].id]={id:INVENTORY_CATEGORY_REGISTRY[i].id,label:INVENTORY_CATEGORY_REGISTRY[i].label,rows:[]};order.push(INVENTORY_CATEGORY_REGISTRY[i].id);}
  var un={id:"unclassified",label:"Unclassified",rows:[]};
  for(i=0;i<inv.length;i++){
    var raw=inv[i],e=itemLookup(raw),cats=e?itemInvCategories(e):null;
    var row={raw:raw,sourceIndex:i,key:itemBaseName(raw),entry:e,categories:cats||[]};
    if(!cats){un.rows.push(row);continue;}
    var placed=false;
    for(j=0;j<order.length;j++){if(cats.indexOf(order[j])>=0){buckets[order[j]].rows.push(row);placed=true;break;}}
    if(!placed)un.rows.push(row);
  }
  var out=[];
  for(i=0;i<order.length;i++){if(buckets[order[i]].rows.length)out.push(buckets[order[i]]);}
  if(un.rows.length)out.push(un);
  return out;
}
// ── #429 BATCH DROP (owner 2026-09-21): the sheet's × MARKS a row, one "Delete N items" button commits ──
// (The copy says DELETE: nothing is placed in the world, the item ceases to exist. The identifiers keep "drop".)
// Marks are session state: {"<idx>|<name>":true} per owner. The pair pins a mark to the row it was set
// on; invDropPlan re-resolves every mark against the LIVE inventory (index first, then by name, never
// the same row twice) so a GM turn that spliced the array between the mark and the button never drops
// the row that slid into a marked index. Pure and DOM-free — the sheet is a thin shell over these.
function invDropMarkKey(idx,name){return String(idx|0)+"|"+String(name);}
function invDropToggle(marks,idx,name){
  marks=marks||{};var k=invDropMarkKey(idx,name),out={},m;
  for(m in marks){if(marks.hasOwnProperty(m)&&marks[m]&&m!==k)out[m]=true;}
  if(!marks[k])out[k]=true;
  return out;
}
function invDropCount(marks){var n=0,m;if(!marks)return 0;for(m in marks){if(marks.hasOwnProperty(m)&&marks[m])n++;}return n;}
/* #481 F8: the row a × means. The × carries its row's index AND name, but a GM turn between the render and the click can
   splice the pack, so the index alone may now name the neighbour ("Deleted 1 item: Waterskin" for the Torch ×). The name
   wins when the two disagree — the row carrying it nearest the old index; no name (a render from before) keeps the index;
   -1 = the item is gone. Pure. */
function invMarkResolve(inv,idx,name){
  inv=inv||[];idx=idx|0;
  if(name==null||name==="")return idx>=0&&idx<inv.length?idx:-1;
  if(idx>=0&&idx<inv.length&&inv[idx]===name)return idx;
  var best=-1,i;for(i=0;i<inv.length;i++){if(inv[i]===name&&(best<0||Math.abs(i-idx)<Math.abs(best-idx)))best=i;}
  return best;
}
function invDropPlan(inv,marks){
  inv=inv||[];marks=marks||{};var live=[],stale=[],seen={},k,i;
  for(k in marks){
    if(!marks.hasOwnProperty(k)||!marks[k])continue;
    var bar=k.indexOf("|"),idx=parseInt(k.slice(0,bar),10),name=k.slice(bar+1),at=-1;
    if(idx>=0&&idx<inv.length&&inv[idx]===name&&!seen[idx])at=idx;
    else{for(i=0;i<inv.length;i++){if(inv[i]===name&&!seen[i]){at=i;break;}}}
    if(at<0){stale.push(name);continue;}
    seen[at]=true;live.push({idx:at,name:name});
  }
  live.sort(function(a,b){return a.idx-b.idx;});
  return {drop:live,stale:stale,count:live.length,ok:live.length>0};
}
function invDropApply(inv,plan){
  var names=[],i;
  for(i=plan.drop.length-1;i>=0;i--)inv.splice(plan.drop[i].idx,1);/* highest first: the lower indices stay true */
  for(i=0;i<plan.drop.length;i++)names.push(plan.drop[i].name);
  return names;
}
function invDropButtonText(n){return "Delete "+n+" item"+(n===1?"":"s");}
function invDropNamesText(names){
  names=names||[];if(names.length<=4)return names.join(", ");
  return names.slice(0,4).join(", ")+" and "+(names.length-4)+" more";
}
// Player verdicts on [ITEM_DEF:] proposals — the ONLY writers of worldState.itemBible (#81).
// Pure state ops (no DOM) so the confirm modal stays a thin veneer and the flow is engine-
// testable. Accept = write-once overlay entry (an existing key refuses — the SPELL_DEF rule);
// decline = dropped LOUDLY. Both remove the pending record; both return true only on action.
/* \u2500\u2500 #215: the withheld reward becomes a player decision \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Owner ruling 2026-08-22: telling the player to open Sync is an immersion break. When a dispute
   shelves, #213 already knows exactly what the withhold cost; this turns that receipt into a
   question. The doubt is stated honestly in the modal \u2014 the reward was held because the GM's
   account did not add up, so it may not have been earned \u2014 and the player rules.

   The payout deliberately runs the ORIGINAL reward tags back through applyMuts rather than
   re-implementing xp/gold/inventory writes: one path, so level-ups and clamping behave exactly as
   they would have. Because that path could in principle strip them again, the award is MEASURED
   \u2014 a claim that moves nothing fails loudly instead of reporting a payout that never happened. */
function rewardClaimQueue(subject,tokens,reason){
  if(typeof worldState==="undefined"||!worldState)return null;
  if(!tokens||!tokens.length)return null;
  if(!worldState.pendingRewardClaims)worldState.pendingRewardClaims=[];
  var q=worldState.pendingRewardClaims,i;
  for(i=0;i<q.length;i++)if(q[i].subject===subject&&q[i].tokens.join("")===tokens.join(""))return q[i];
  /* #262 (JP0-9/f22 path 2): the exact-match dedupe above let a SUPERSET claim queue BESIDE its
     subset — a re-armed dispute's second shelve carried T1∪T2 next to the standing T1, and
     accepting both paid T1 twice. A same-subject claim whose tokens are contained in the new
     set is REPLACED (the superset supersedes it); a disjoint same-subject claim still queues —
     genuinely separate incidents stay separately payable. */
  for(i=q.length-1;i>=0;i--){
    if(q[i].subject!==subject)continue;
    var _sub=true,_sj;for(_sj=0;_sj<q[i].tokens.length;_sj++){if(tokens.indexOf(q[i].tokens[_sj])<0){_sub=false;break;}}
    if(_sub){var _old=q.splice(i,1)[0];if(typeof console!=="undefined")console.warn("[reward] claim for "+subject+" REPLACED by a superset ("+_old.tokens.join(" ")+" ⊆ "+tokens.join(" ")+") — one payable claim, never two (#262)");}
  }
  if(q.length>=REWARD_CLAIM_CAP){
    if(typeof console!=="undefined")console.warn("[reward] claim queue full ("+REWARD_CLAIM_CAP+") \u2014 the claim for "+subject+" was dropped; answer the pending ones to make room (#215)");
    return null;
  }
  var rec={id:"rc"+worldState.turn+"-"+q.length+"-"+String(subject).replace(/[^A-Za-z0-9]/g,"").slice(0,12),
           subject:String(subject||"?"),tokens:tokens.slice(),reason:String(reason||""),turn:worldState.turn};
  q.push(rec);
  if(typeof console!=="undefined")console.warn("[reward] claim QUEUED for "+rec.subject+": "+rec.tokens.join(" ")+" ("+rec.reason+")");
  if(typeof saveAll==="function")saveAll();
  return rec;
}
function _rewardClaimTake(id){
  if(typeof worldState==="undefined"||!worldState||!worldState.pendingRewardClaims)return null;
  var q=worldState.pendingRewardClaims,i;
  for(i=0;i<q.length;i++)if(q[i].id===id){var rec=q[i];q.splice(i,1);if(!q.length)delete worldState.pendingRewardClaims;return rec;}
  return null;
}
/* #273: read the ONE value a reward group must move. null = this engine cannot measure the group
   (an unknown token, or api.js absent) \u2014 reported as unverified, NEVER assumed landed. */
function _rewardTargetRead(g,c){
  if(!g||!c)return null;
  if(g.kind==="xp")return Number(c.xp)||0;
  if(g.kind==="gold")return Number(c.gold)||0;
  if(g.kind==="item")return (typeof inventoryCountOf==="function")?inventoryCountOf(c.inventory,g.key):null;
  return null;
}
function rewardClaimAccept(id){
  var rec=_rewardClaimTake(id);
  if(!rec)return false;
  var c=worldState.character||{},i,j,g;
  /* #273 (Fable f29): measure PER TOKEN, not by sheet shape. The old before/after compared
     {xp, gold, inventory.LENGTH} \u2014 but a claimed item already carried stacks the existing line
     ("Name" \u2192 "Name x2") without changing the length, so a payout that landed was reported as
     "nothing changed"; and any single moving field vouched for every token, so a mixed claim
     passed on its xp delta while its item silently failed. Every token now names the target it
     must move and by how much (rewardAwardTargets, api.js), and only an EXACT match on every
     group is an award. Close-on-fail semantics are unchanged: the record was taken above, and a
     partial is reported as a partial rather than re-queued. */
  var groups=(typeof rewardAwardTargets==="function")?rewardAwardTargets(rec.tokens):[];
  if(!groups.length&&typeof console!=="undefined"&&typeof rewardAwardTargets!=="function")
    console.error("[reward] rewardAwardTargets is unavailable \u2014 this payout cannot be verified and will be reported as unawarded (#273)");
  for(i=0;i<groups.length;i++)groups[i].before=_rewardTargetRead(groups[i],c);
  if(typeof applyMuts==="function")applyMuts(rec.tokens.join(""));
  var cAfter=(worldState&&worldState.character)||c,landed=[],missed=[];
  for(i=0;i<groups.length;i++){
    g=groups[i];
    var after=_rewardTargetRead(g,cAfter);
    var moved=(g.before!==null&&after!==null&&g.expect!==0&&(after-g.before)===g.expect);
    for(j=0;j<g.tokens.length;j++)(moved?landed:missed).push(g.tokens[j]);
  }
  if(!groups.length)missed=rec.tokens.slice();
  if(missed.length){
    var nothing=!landed.length;
    var phrase=(typeof w2WithheldSummary==="function"&&w2WithheldSummary(missed))||missed.join(" ");
    if(typeof console!=="undefined")console.warn("[reward] claim for "+rec.subject+(nothing?" AWARDED NOTHING":" only PARTLY awarded")+" \u2014 these tokens did not move their target: "+missed.join(" ")+(landed.length?(" (landed: "+landed.join(" ")+")"):"")+"; the claim is closed and the player was "+(nothing?"not paid":"paid only in part")+" (#215/#273)");
    if(typeof showToast==="function")showToast("\u26a0 "+(nothing?"That reward could not be awarded \u2014 nothing changed.":"Only part of that reward landed.")+" Missing: "+phrase+". See the console.",8000);
    if(typeof saveAll==="function")saveAll();
    return false;
  }
  if(typeof console!=="undefined")console.info("[reward] claim for "+rec.subject+" AWARDED: "+rec.tokens.join(" "));
  if(typeof showToast==="function")showToast("\u2726 Awarded"+((typeof w2WithheldSummary==="function"&&w2WithheldSummary(rec.tokens))?": "+w2WithheldSummary(rec.tokens):""));
  if(typeof saveAll==="function")saveAll();
  return true;
}
function rewardClaimDecline(id){
  var rec=_rewardClaimTake(id);
  if(!rec)return false;
  if(typeof console!=="undefined")console.info("[reward] claim for "+rec.subject+" DECLINED by the player: "+rec.tokens.join(" "));
  if(typeof saveAll==="function")saveAll();
  return true;
}
function itemDefAccept(key){
  if(typeof worldState==="undefined"||!worldState||!worldState.pendingItemDefs)return false;
  var i,p=null;
  for(i=0;i<worldState.pendingItemDefs.length;i++){if(worldState.pendingItemDefs[i].key===key){p=worldState.pendingItemDefs[i];break;}}
  if(!p)return false;
  worldState.pendingItemDefs.splice(i,1);
  if(!worldState.itemBible)worldState.itemBible={};
  if(!itemDefOverlayReplaceable(key)){if(typeof console!=="undefined")console.warn("[items] accept refused — '"+key+"' already canon (write-once, #81)");return false;}
  var prior=worldState.itemBible[key];
  if(prior){/* #294B ②: replacing a classification-only overlay — its DISPLAY fields (#157) survive unless the proposal carries its own */
    if(prior.inventoryCategories&&!p.entry.inventoryCategories)p.entry.inventoryCategories=prior.inventoryCategories;
    if(prior.aliases&&!p.entry.aliases)p.entry.aliases=prior.aliases;
    if(typeof console!=="undefined")console.info("[items] classification-only overlay for '"+key+"' replaced by the accepted proposal (#294B)");
  }
  worldState.itemBible[key]=p.entry;
  if(typeof console!=="undefined")console.info("[items] item canon ACCEPTED: "+p.name+" ("+p.entry.category+")");
  if(typeof saveAll==="function")saveAll();
  return true;
}
function itemDefDecline(key){
  if(typeof worldState==="undefined"||!worldState||!worldState.pendingItemDefs)return false;
  var i;
  for(i=0;i<worldState.pendingItemDefs.length;i++){
    if(worldState.pendingItemDefs[i].key===key){
      var p=worldState.pendingItemDefs.splice(i,1)[0];
      if(typeof console!=="undefined")console.warn("[items] item canon DECLINED by the player: "+p.name+" — proposal dropped, nothing written (#81)");
      if(typeof saveAll==="function")saveAll();
      return true;
    }
  }
  return false;
}
// HTML string out, no DOM and no globals beyond escHtml. So BOTH the in-game click-card
// (showCapabilityCard, ui.js) and the standalone bible_study.html viewer render from THIS one
// function — one render, two hosts. CSS vars carry app-theme fallbacks so it looks right in either.
function bibleCardHTML(name,e){
  if(!e)return '<div style="padding:20px 24px;color:var(--t2,#999);font-size:13px;">No canonical entry yet for <b>'+escHtml(name)+'</b>.</div>';
  var base=String(name||"").replace(/\s*\(.*\)/,"").trim();
  var kindLabel=e.kind==="ability"?"Ability":"Spell";
  var tierLabel=(e.tier===0||e.tier==null)?(e.kind==="ability"?"":"Cantrip"):("Tier "+e.tier);
  var chip="display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:10px;margin-right:6px;";
  var badges='<span style="'+chip+'background:var(--bg3,#2a2a2a);color:var(--t1,#ccc);">'+kindLabel+(tierLabel?" &middot; "+tierLabel:"")+'</span>';
  badges+= e.isMagical
    ? '<span style="'+chip+'background:rgba(150,90,180,.25);color:#c99be0;">&#10022; magical</span>'
    : '<span style="'+chip+'background:var(--bg3,#2a2a2a);color:var(--t2,#999);">mundane</span>';
  if(e.category&&e.category.length){for(var ci=0;ci<e.category.length;ci++)badges+='<span style="'+chip+'background:rgba(184,147,90,.22);color:var(--acc,#b8935a);">'+escHtml(e.category[ci])+'</span>';}
  // Fixed attribute set — every card shows all 6, "N/A" where inapplicable (no row-count variance,
  // and the GM can never query an attribute that isn't there). Order is canonical.
  function row(k,v){return '<tr><td style="padding:3px 10px 3px 0;color:var(--t2,#999);white-space:nowrap;vertical-align:top;">'+k+'</td><td style="padding:3px 0;color:var(--t1,#ddd);">'+escHtml(v||"N/A")+'</td></tr>';}
  var rows=row("Cost",e.cost)+row("Range",e.range)+row("Targets",e.targets)+row("Duration",e.duration)+row("Save",e.save)+row("Damage",e.dice);
  return '<div style="padding:22px 24px;">'
    +'<div style="font-size:18px;font-weight:bold;color:var(--t0,#f0f0f0);margin-bottom:8px;">'+escHtml(base)+'</div>'
    +'<div style="margin-bottom:14px;">'+badges+'</div>'
    +(rows?'<table style="border-collapse:collapse;font-size:12px;margin-bottom:14px;">'+rows+'</table>':'')
    +'<div style="font-size:13px;color:var(--t1,#ccc);line-height:1.55;">'+escHtml(e.effect||"")+'</div>'
    +'</div>';
}
// itemCardHTML (#295) — bibleCardHTML's ITEM sibling: the ONE pure renderer for the inventory
// click-card. The raw carried string is the title (instance truth — counts and provenance stay
// visible); the itemLookup entry supplies TYPE canon. Canon-less items render HONESTLY — no
// guessed fields; the carried string's own inline "—" description, when present, is shown as
// what the sheet already says, and the card points at the 📖 Define path instead of inventing.
function itemCardHTML(raw,e){
  var chip="display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:10px;margin-right:6px;";
  var title='<div style="font-size:17px;font-weight:bold;color:var(--t0,#f0f0f0);margin-bottom:8px;">'+escHtml(String(raw||""))+'</div>';
  if(!e){
    var m=String(raw||"").match(/[—–]\s*(.+)$/);
    return '<div style="padding:22px 24px;">'+title
      +'<div style="font-size:13px;color:var(--t2,#999);line-height:1.55;">No canon recorded for this item yet.'+(m?'':' Its story has not been pinned down yet.')+'</div>'
      +(m?'<div style="font-size:13px;color:var(--t1,#ccc);line-height:1.55;margin-top:10px;">'+escHtml(m[1])+'</div>':'')
      +'</div>';
  }
  var badges='<span style="'+chip+'background:rgba(184,147,90,.22);color:var(--acc,#b8935a);">'+escHtml(e.category||"")+'</span>';
  if(e.inventoryCategories&&e.inventoryCategories.length&&e.inventoryCategories[0]!==e.category)badges+='<span style="'+chip+'background:var(--bg3,#2a2a2a);color:var(--t2,#999);">'+escHtml(e.inventoryCategories[0])+'</span>';
  function row(k,v){return '<tr><td style="padding:3px 10px 3px 0;color:var(--t2,#999);white-space:nowrap;vertical-align:top;">'+k+'</td><td style="padding:3px 0;color:var(--t1,#ddd);">'+escHtml(v||"N/A")+'</td></tr>';}
  var rows=row("Uses",e.uses)+row("Value",e.value);
  return '<div style="padding:22px 24px;">'+title
    +'<div style="margin-bottom:14px;">'+badges+'</div>'
    +'<table style="border-collapse:collapse;font-size:12px;margin-bottom:14px;">'+rows+'</table>'
    +'<div style="font-size:13px;color:var(--t1,#ccc);line-height:1.55;">'+(e.effect&&e.effect!=="N/A"?escHtml(e.effect):'<span style="color:var(--t2,#999);">Classification only — no effect canon recorded yet.</span>')+'</div>'
    +'</div>';
}
// skillCardHTML (#52) — the shared skill-card renderer, bibleCardHTML's sibling. Pure:
// SKILLS row (data.js — stats/category live there) + SKILLS_BIBLE entry in, HTML out.
// Used by bible_study.html's Skills section; available to any future in-game click-card.
function skillCardHTML(skill,e){
  if(!skill)return"";
  var chip="display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:2px 7px;border-radius:10px;margin-right:6px;";
  var badges='<span style="'+chip+'background:var(--bg3,#2a2a2a);color:var(--t1,#ccc);">'+escHtml(skill.cat||"")+'</span>';
  var st=(skill.stats||[]).join(" / ");
  if(st)badges+='<span style="'+chip+'background:rgba(184,147,90,.22);color:var(--acc,#b8935a);">'+escHtml(st)+'</span>';
  var ut=e&&e.untrained;
  if(ut==="no")badges+='<span style="'+chip+'background:rgba(180,80,80,.22);color:#d09090;">trained only</span>';
  else if(ut==="hard")badges+='<span style="'+chip+'background:rgba(180,140,60,.22);color:#d0b070;">hard untrained</span>';
  return '<div style="padding:22px 24px;">'
    +'<div style="font-size:18px;font-weight:bold;color:var(--t0,#f0f0f0);margin-bottom:8px;">'+escHtml(skill.label||skill.id)+'</div>'
    +'<div style="margin-bottom:14px;">'+badges+'</div>'
    +'<div style="font-size:13px;color:var(--t1,#ccc);line-height:1.55;">'+escHtml(e?e.def:"No canonical entry yet.")+'</div>'
    +'</div>';
}

// ── STT name correction (#9 follow-up, v1.330) — "Frizwick becomes Physics" ─────────────────
// Speech recognizers map audio to THEIR vocabulary; fantasy names always lose ("Frizwick" →
// "physics", "Morwen" → "more when", "Ammut" → "a mutt"). Web Speech has no vocabulary hook, but
// we hold what the recognizer doesn't: the campaign's canonical name roster. These PURE functions
// (headless-testable — the thresholds are pinned by a mangle-pair battery in engine-tests) fix a
// transcript by phonetic match against that roster. Containment: only roster names are ever
// substituted; ambiguous double-matches are SKIPPED; the corrected text lands in the input box
// where the player reviews it before sending.
//
// Two-layer match, tuned on the battery:
//   layer 1 (recall):    consonant-skeleton keys (sttPhoneticKey) within edit distance 2
//   layer 2 (precision): the vowel-preserving FOLDED forms within distance ceil(maxLen/2)
// plus a first-sound gate (keys share their leading consonant) and a length window.
function sttFold(w){
  w=String(w||"").toLowerCase().replace(/[^a-z]/g,"");
  if(!w)return"";
  return w.replace(/ph/g,"f").replace(/wh/g,"w").replace(/wr/g,"r").replace(/kn/g,"n").replace(/gn/g,"n")
          .replace(/qu/g,"kw").replace(/x/g,"ks").replace(/ck/g,"k").replace(/tch/g,"ch").replace(/dg/g,"j")
          .replace(/c(?=[eiy])/g,"s").replace(/c/g,"k").replace(/z/g,"s").replace(/v/g,"f")
          .replace(/b/g,"p").replace(/d/g,"t").replace(/g/g,"k").replace(/j/g,"ch");
}
function sttPhoneticKey(word){
  var w=sttFold(word);
  if(!w)return"";
  var key=w.charAt(0)+w.slice(1).replace(/[aeiouyhw]/g,""),out="",i;
  for(i=0;i<key.length;i++){if(key.charAt(i)!==out.charAt(out.length-1))out+=key.charAt(i);}
  return out;
}
function sttLev(a,b){
  var m=a.length,n=b.length,i,j;
  if(!m)return n;if(!n)return m;
  var prev=[],cur=[];
  for(j=0;j<=n;j++)prev[j]=j;
  for(i=1;i<=m;i++){
    cur[0]=i;
    for(j=1;j<=n;j++){
      var cost=a.charAt(i-1)===b.charAt(j-1)?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
    }
    var t=prev;prev=cur;cur=t;
  }
  return prev[n];
}
// Common-word protection: a single spoken token that IS a common English word is almost never a
// mangled name (the recognizer's whole failure mode is snapping TO these words — but when the
// player actually says one, rewriting it is worse than any missed correction). Tuned by the
// engine-test battery: every false positive it produced ("about"→Ammut, "and"→Ammut,
// "attack"→Aldus, "search"→Zethran, "market"→Morwen) is a common word; no true mangle-pair is
// ("physics", "dairies", "fizzwick" are all rare in spoken commands). Bigram HALVES stay
// exempt — "more when"/"a mutt"/"sand point" are made of common words by nature; bigram safety
// comes from the perfect-skeleton requirement instead.
var STT_COMMON={about:1,after:1,again:1,against:1,ahead:1,all:1,along:1,also:1,always:1,and:1,any:1,anyone:1,anything:1,are:1,around:1,ask:1,attack:1,away:1,back:1,bag:1,be:1,before:1,begin:1,behind:1,below:1,beside:1,best:1,better:1,between:1,blade:1,block:1,body:1,both:1,bow:1,bread:1,break:1,bring:1,but:1,buy:1,call:1,camp:1,can:1,care:1,carefully:1,carry:1,cast:1,catch:1,cave:1,chase:1,check:1,city:1,climb:1,close:1,come:1,could:1,count:1,cover:1,cut:1,dagger:1,dark:1,day:1,deal:1,defend:1,did:1,dig:1,do:1,dodge:1,does:1,done:1,door:1,down:1,drag:1,draw:1,drink:1,drop:1,each:1,east:1,eat:1,edge:1,end:1,enter:1,even:1,ever:1,every:1,eyes:1,face:1,far:1,fast:1,fight:1,find:1,fire:1,first:1,fix:1,flee:1,floor:1,follow:1,food:1,foot:1,forest:1,forward:1,from:1,front:1,gate:1,get:1,give:1,go:1,goes:1,going:1,gold:1,good:1,grab:1,great:1,ground:1,guard:1,hand:1,has:1,have:1,head:1,hear:1,heal:1,held:1,help:1,her:1,here:1,hide:1,high:1,hill:1,him:1,his:1,hit:1,hold:1,home:1,horse:1,house:1,how:1,hurry:1,if:1,inn:1,inside:1,into:1,is:1,it:1,its:1,jump:1,just:1,keep:1,key:1,kill:1,knife:1,know:1,last:1,lead:1,leave:1,left:1,let:1,light:1,like:1,listen:1,little:1,lock:1,long:1,look:1,loot:1,low:1,make:1,man:1,many:1,map:1,mark:1,market:1,may:1,me:1,men:1,might:1,mine:1,more:1,most:1,mount:1,move:1,much:1,must:1,my:1,near:1,need:1,never:1,new:1,next:1,night:1,no:1,north:1,not:1,nothing:1,now:1,off:1,old:1,on:1,once:1,one:1,only:1,open:1,other:1,our:1,out:1,outside:1,over:1,own:1,pass:1,path:1,pay:1,pick:1,place:1,plan:1,point:1,potion:1,pull:1,push:1,put:1,quick:1,quiet:1,quietly:1,read:1,ready:1,rest:1,return:1,ride:1,ridge:1,right:1,river:1,road:1,rock:1,roll:1,room:1,rope:1,run:1,said:1,same:1,save:1,say:1,scout:1,search:1,see:1,sell:1,send:1,set:1,shield:1,ship:1,shoot:1,shop:1,short:1,should:1,show:1,side:1,signal:1,sit:1,sleep:1,slow:1,slowly:1,small:1,sneak:1,so:1,some:1,someone:1,something:1,soon:1,south:1,speak:1,spell:1,stab:1,stand:1,start:1,stay:1,steal:1,step:1,still:1,stone:1,stop:1,street:1,strike:1,such:1,swim:1,sword:1,take:1,talk:1,tavern:1,tell:1,than:1,that:1,the:1,their:1,them:1,then:1,there:1,these:1,they:1,think:1,this:1,those:1,three:1,through:1,throw:1,time:1,to:1,together:1,told:1,too:1,torch:1,toward:1,town:1,track:1,trade:1,trail:1,tree:1,try:1,turn:1,two:1,under:1,until:1,up:1,upon:1,us:1,use:1,very:1,view:1,village:1,wait:1,wake:1,walk:1,wall:1,want:1,warn:1,watch:1,water:1,way:1,we:1,weapon:1,wear:1,well:1,went:1,were:1,west:1,what:1,when:1,where:1,which:1,while:1,who:1,why:1,will:1,window:1,with:1,within:1,without:1,woman:1,wood:1,woods:1,word:1,work:1,would:1,yes:1,yet:1,you:1,your:1};
// Function words that may not LEAD a bigram (joining "the"+noun makes phantom names); "a" is
// deliberately allowed — "a mutt" → Ammut is a real recognizer split.
// #78 (2026-07-27): the menu/ordinal vocabulary joins STT_COMMON. The list already protected
// one/two/three/first/last/again but NOT second/third/option/repeat — so a roster holding
// "Theros" silently rewrote a spoken "third" into a name, eating the driver's pick (and, before
// Car Mode existed, mangling any ordinary "take the third door"). These are plain English words;
// by this table's own rule they are (almost) never a mangled fantasy name.
"second third fourth option options number choice choices repeat everything scene story".split(" ").forEach(function(w){ STT_COMMON[w]=1; });
var STT_BIGRAM_NOLEAD={the:1,to:1,of:1,in:1,on:1,at:1,is:1,it:1,and:1,or:1,for:1,with:1,my:1,we:1,he:1,she:1,they:1,i:1};
// One roster word ↔ one transcript candidate. Returns a match quality (lower = better) or -1.
function sttWordScore(candRaw,nameWord){
  var kC=sttPhoneticKey(candRaw),kN=sttPhoneticKey(nameWord);
  if(!kC||!kN)return -1;
  if(kC.charAt(0)!==kN.charAt(0))return -1;                       // first-sound gate
  var dK=sttLev(kC,kN),mK=Math.max(kC.length,kN.length);
  if(!(dK===0||(dK===1&&mK>=3)||(dK===2&&mK>=4)))return -1;       // layer 1: skeleton distance
  var fC=sttFold(candRaw),fN=sttFold(nameWord);
  if(Math.abs(fC.length-fN.length)>4)return -1;                    // length window
  var dF=sttLev(fC,fN),mF=Math.max(fC.length,fN.length);
  if(dF>Math.ceil(mF/2))return -1;                                 // layer 2: folded-form precision
  return dK*10+dF;                                                 // rank: skeleton first, folded tiebreak
}
// Canonical roster from live state: PC, NPCs (+aliases), memory keys (+aliases), locations.
// Returns [{word, full}] — `word` is the substitutable canonical token, `full` the source name.
function sttNameRoster(ws,mem){
  var seen={},out=[];
  function addName(full){
    if(!full)return;
    var parts=String(full).split(/\s+/),i;
    for(i=0;i<parts.length;i++){
      var w=parts[i].replace(/[^A-Za-z']/g,"");
      if(w.replace(/[^A-Za-z]/g,"").length<4)continue;             // short/honorific-ish tokens skipped
      var k=w.toLowerCase();
      if(!seen[k]){seen[k]=1;out.push({word:w,full:String(full)});}
    }
  }
  if(ws&&ws.character)addName(ws.character.name);
  var i,j;
  for(i=0;i<((ws&&ws.npcs)||[]).length;i++){var n=ws.npcs[i];addName(n.name);for(j=0;j<((n.aliases)||[]).length;j++)addName(n.aliases[j]);}
  if(mem&&mem.npcs){for(var k2 in mem.npcs){addName(k2);var als=mem.npcs[k2].aliases||[];for(j=0;j<als.length;j++)addName(als[j]);}}
  if(ws&&ws.world)addName(ws.world.location);
  if(mem&&mem.locations){for(var k3 in mem.locations)addName(k3);}
  return out;
}
// Correct a transcript against the roster. Bigrams first ("more when" → Morwen), then single
// tokens; exact roster words pass through untouched; an ambiguous tie between two DIFFERENT
// canonical words is skipped (never guess between people). Punctuation/casing of the
// surrounding text is preserved; substitutions use the roster's canonical casing.
// ── #113 §4a (DOC/Research/DOC_whisper_stt.html, user go 2026-08-03): the Whisper prompt bias ────────
// The cloud STT request never told Whisper the campaign's vocabulary, so fantasy nouns decoded
// to their nearest English homophones (Frizwick→Physics, Morwen→"more when") and the repair
// fell entirely on sttCorrectNames after the fact. This builds the words the campaign actually
// uses — party, roster, current place, live quest titles — deduped, budget-capped well under
// Whisper's ~224-token prompt window. PURE read; "" when no campaign is loaded (creation
// screen dictation gets no bias, correctly). Caution from the findings doc: a bias can also
// PULL — it may hallucinate a roster name into unrelated speech; that residual class is #77's
// confidence-gate territory, not a reason to stay silent about our own vocabulary.
function sttBiasPrompt(){
  if(typeof worldState==="undefined"||!worldState)return"";
  var parts=[],seen={},i;
  function add(nm){
    if(!nm)return;
    var k=String(nm).trim();
    if(!k||seen[k.toLowerCase()])return;
    seen[k.toLowerCase()]=1;parts.push(k);
  }
  try{
    if(worldState.character)add(worldState.character.name);
    var ns=worldState.npcs||[];for(i=0;i<ns.length;i++)add(ns[i]&&ns[i].name);
    if(worldState.world){add(worldState.world.location);add(worldState.world.sublocation);}
    var qs=worldState.questLog||[];for(i=0;i<qs.length;i++)add(qs[i]&&qs[i].title);
  }catch(e){return"";}
  var s=parts.join(", ");
  if(s.length>800){s=s.slice(0,800);var cut=s.lastIndexOf(", ");if(cut>0)s=s.slice(0,cut);}/* cap at a clean name boundary */
  return s;
}
// ── #77 confirm gate — the pure half (v1.548; design record DOC/Research/DOC_nonsense_filter.html §4) ──
// Layer 0: sttConfidence turns the OpenAI logprobs array (or nothing) into one 0..1 number.
// Layer 1-gate: sttSuspicion decides whether an utterance auto-sends or earns the Layer-2
// read-back. The thresholds are DELIBERATELY data — tune from the sttLogEvent record, never
// from vibes (the review's "measure, then tune" ruling).
var STT_CONF_MIN=0.66;    // transcript-level confidence below this = suspect
var STT_FAR_EDIT_SC=10;   // sttWordScore >= 10 means skeleton distance >=1 — a BOLD substitution
var STT_LOG_K="tnd_stt_log_v1",STT_LOG_CAP=100;
function sttConfidence(logprobs){
  if(!logprobs||!logprobs.length)return null;
  var s=0,n=0,i,lp;
  for(i=0;i<logprobs.length;i++){lp=logprobs[i]&&logprobs[i].logprob;if(typeof lp==="number"&&isFinite(lp)){s+=lp;n++;}}
  return n?Math.exp(s/n):null;
}
// The suspicion verdict. Reasons (each independently sufficient):
//   low-confidence        — the transcriber itself was unsure (conf===null NEVER flags: the
//                           native path often has no signal, and flagging everything is the
//                           confirmation-fatigue failure the literature warns about)
//   far-correction        — a unigram substitution at skeleton distance >=1 (physics→Frizwick):
//                           right or wrong, it rewrote a real word boldly — worth one "send it?"
//   common-bigram         — a bigram merge whose halves are ordinary words ("there is"→Daeris,
//                           the review's measured false-positive class; "more when"→Morwen pays
//                           the same toll, an accepted trade)
//   multiple-corrections  — two+ substitutions in one utterance
//   unknown-name          — a mid-utterance capitalized noun matching no roster word (cloud
//                           transcripts capitalize proper nouns; the bias-prompt PULL class)
function sttSuspicion(text,corrections,conf,roster){
  var reasons=[],i;
  if(typeof conf==="number"&&conf<STT_CONF_MIN)reasons.push("low-confidence");
  var corr=corrections||[];
  if(corr.length>=2)reasons.push("multiple-corrections");
  for(i=0;i<corr.length;i++){
    if(!corr[i].bigram&&corr[i].sc>=STT_FAR_EDIT_SC&&reasons.indexOf("far-correction")<0)reasons.push("far-correction");
    if(corr[i].bigram&&reasons.indexOf("common-bigram")<0){
      var h=String(corr[i].from||"").toLowerCase().split(/\s+/);
      if((h[0]&&STT_COMMON[h[0]])||(h[1]&&STT_COMMON[h[1]]))reasons.push("common-bigram");
    }
  }
  var toks=String(text||"").split(/\s+/);
  for(i=1;i<toks.length;i++){
    if(/^i['’]/i.test(toks[i])||toks[i]==="I")continue;            // I'll / I'm / bare I are never names
    var a=toks[i].replace(/[^A-Za-z]/g,"");
    if(a.length<3||!/^[A-Z][a-z]/.test(a)||STT_COMMON[a.toLowerCase()])continue;
    var known=false,ri;
    if(roster){for(ri=0;ri<roster.length;ri++){if(roster[ri].word.toLowerCase()===a.toLowerCase()){known=true;break;}}}
    if(!known){reasons.push("unknown-name");break;}
  }
  return {suspicious:reasons.length>0,reasons:reasons};
}
// Layer-0 measurement channel — the ring the review found missing ("measure, then tune" had
// nothing to read). Compact entries only (counts + reasons + outcome, never the transcript);
// read it back in the console via sttLogAll().
function sttLogEvent(e){
  try{
    var raw=(typeof store!=="undefined")?store.get(STT_LOG_K):null;
    var arr=raw?JSON.parse(raw):[];
    arr.push(e);
    if(arr.length>STT_LOG_CAP)arr=arr.slice(arr.length-STT_LOG_CAP);
    store.set(STT_LOG_K,JSON.stringify(arr));
  }catch(err){if(typeof console!=="undefined")console.warn("[stt] log write failed:",err&&err.message);}
}
function sttLogAll(){
  try{var raw=(typeof store!=="undefined")?store.get(STT_LOG_K):null;return raw?JSON.parse(raw):[];}catch(e){return [];}
}
function sttCorrectNames(text,roster,collector){
  if(!text||!roster||!roster.length)return text;
  var toks=String(text).split(/(\s+)/),i,r;   // words + separator tokens interleaved
  function alpha(s){return String(s||"").replace(/[^A-Za-z]/g,"");}
  function best(cand){
    var b=null,tie=false;
    for(var ri=0;ri<roster.length;ri++){
      var sc=sttWordScore(cand,roster[ri].word);
      if(sc<0)continue;
      if(b===null||sc<b.sc){b={sc:sc,word:roster[ri].word};tie=false;}
      else if(sc===b.sc&&roster[ri].word.toLowerCase()!==b.word.toLowerCase())tie=true;
    }
    return (b&&!tie)?b:null;
  }
  function isRosterWord(cand){
    var c=cand.toLowerCase();
    for(var ri=0;ri<roster.length;ri++){if(roster[ri].word.toLowerCase()===c)return true;}
    return false;
  }
  function subst(tok,canon){
    // keep leading/trailing punctuation around the alpha core
    return tok.replace(/[A-Za-z][A-Za-z']*/,canon);
  }
  for(i=0;i<toks.length;i++){
    var w1=alpha(toks[i]);
    if(!w1)continue;
    if(isRosterWord(w1))continue;                                  // already canonical
    // bigram first: this word + the next word joined (recognizers split names into real words).
    // Bigrams demand a PERFECT phonetic-skeleton match (sc<10 ⇒ key distance 0) — every real
    // split-name pair is exact at the skeleton level ("more when"→Morwen, "a mutt"→Ammut,
    // "sand point"→Sandpoint), and every battery false positive ("the wards"→Daeris) was not.
    var ni=i+2;                                                    // toks[i+1] is the separator
    var w2=ni<toks.length?alpha(toks[ni]):"";
    if(w2&&!isRosterWord(w2)&&(w1.length+w2.length)>=4&&!STT_BIGRAM_NOLEAD[w1.toLowerCase()]){
      var bg=best(w1+w2);
      if(bg&&bg.sc<10){                                            // perfect skeleton only
        toks[i]=subst(toks[i],bg.word);toks[i+1]="";toks[ni]=toks[ni].replace(/[A-Za-z][A-Za-z']*/,"");
        if(collector)collector.push({from:w1+" "+w2,to:bg.word,sc:bg.sc,bigram:true});/* #77 Layer-0 record */
        if(typeof console!=="undefined")console.info("[stt] name-corrected: \""+w1+" "+w2+"\" → "+bg.word);
        continue;
      }
    }
    if(w1.length<3)continue;                                       // too short to judge alone
    if(STT_COMMON[w1.toLowerCase()])continue;                      // a common word the player said is (almost) never a mangled name
    var sg=best(w1);
    if(sg){
      toks[i]=subst(toks[i],sg.word);
      if(collector)collector.push({from:w1,to:sg.word,sc:sg.sc,bigram:false});/* #77 Layer-0 record */
      if(typeof console!=="undefined")console.info("[stt] name-corrected: \""+w1+"\" → "+sg.word);
    }
  }
  return toks.join("").replace(/\s{2,}/g," ");
}

// ── #130: prior-campaign story-beat boundary ────────────────────────────────────────────────
// storyBeats ride the character schema across campaign imports BY DESIGN (carried history is a
// user-ruled feature, never pruned) — but until v1.527 they carried no campaign stamp, so an
// imported character's beats displayed foreign turn numbers as if they were this campaign's
// timeline (the field case: Ammut's sheet showed a "turn 1391" beat in a campaign at turn 1385;
// an external reviewer read it as branch contamination). New beats stamp camp:campName at write
// (the fileCoreMemory pattern). For legacy unstamped beats, this helper finds the provable
// import boundary from the append-only order rule: beats written IN this campaign are exactly
// the maximal trailing run whose turns never decrease and never exceed the campaign's current
// turn (in-campaign writes append in turn order; a violation can only come from an imported
// prefix). Conservative by construction — an all-monotonic history (never imported, or an
// import whose numbering happens to blend in) returns 0, i.e. everything renders as native;
// beats are only ever labeled foreign when the order proves it.
function priorBeatBoundary(beats,currentTurn){
  if(!beats||!beats.length)return 0;
  var cur=Number(currentTurn);if(!isFinite(cur))cur=Infinity;
  var b=beats.length,next=Infinity,i;
  for(i=beats.length-1;i>=0;i--){
    var t=Number(beats[i]&&beats[i].turn)||0;
    if(t>cur||t>next)break;                 // order violation or future turn → everything before is pre-import
    next=t;b=i;
  }
  return b;
}

// ─── #17: drift health readout ──────────────────────────────────────────────────────────────
// LEADING indicators over the anti-drift stack, computed from data the save already carries
// (healthLog ring, tagLog ring, questLog, W2 state). Pure read — no writes, no prompt contact.
// ONE renderer: the membar dot (updateHealthDot, ui-panels.js) and the detail modal
// (showHealthModal, ui-modals.js) are thin DOM shells over this function (the csSheetSections
// one-renderer rule). Levels: "ok" | "warn" | "bad" | "na" (not enough data / not applicable).
// Every threshold below targets a MEASURED failure class, named inline.
// P2-03: expensive byte measurement is opt-in so the tiny membar dot never JSON-stringifies a
// mature save on every syncUI. The modal passes `withGrowth=true`; logical slices deliberately
// overlap (this is diagnosis, not accounting) and nothing here trims, compacts, or writes.
function healthGrowthTelemetry(ws,mem){
  var stores=[];
  function bytes(v){
    var s;try{s=JSON.stringify(v);}catch(e){return null;}
    if(s===undefined)return 0;
    var n=0,i,c;
    for(i=0;i<s.length;i++){
      c=s.charCodeAt(i);
      if(c<=127)n++;
      else if(c<=2047)n+=2;
      else if(c>=55296&&c<=56319&&i+1<s.length&&s.charCodeAt(i+1)>=56320&&s.charCodeAt(i+1)<=57343){n+=4;i++;}
      else n+=3;
    }
    return n;
  }
  function add(id,label,value,count,unit){stores.push({id:id,label:label,bytes:bytes(value),count:count,unit:unit});}
  ws=ws||{};
  var tr=Array.isArray(ws.transcript)?ws.transcript:[],ql=Array.isArray(ws.questLog)?ws.questLog:[],roster=Array.isArray(ws.npcs)?ws.npcs:[];
  add("transcript","Sacred transcript",tr,tr.length,"entries");
  add("quest-log","Live quest journal",ql,ql.length,"quests");
  add("roster","World NPC roster",roster,roster.length,"NPCs");
  if(mem){
    var mn=mem.npcs&&typeof mem.npcs==="object"?mem.npcs:{};
    var mq=mem.quests&&typeof mem.quests==="object"?mem.quests:{};
    var map=mem.map&&typeof mem.map==="object"?mem.map:{};
    var nodes=map.nodes&&typeof map.nodes==="object"?map.nodes:{};
    var arch=mem.archive&&typeof mem.archive==="object"?mem.archive:{};
    var archCount=0,ak=Object.keys(arch),i,v;
    for(i=0;i<ak.length;i++){v=arch[ak[i]];if(Array.isArray(v))archCount+=v.length;else if(v&&typeof v==="object")archCount+=Object.keys(v).length;else if(v!=null)archCount++;}
    add("npc-memory","Remembered NPCs",mn,Object.keys(mn).length,"NPCs");
    add("quest-history","Quest history",mq,Object.keys(mq).length,"quests");
    add("map","Location map",map,Object.keys(nodes).length,"nodes");
    add("archive","Memory archive",arch,archCount,"records");
  }
  return stores;
}
// #371: successes / filed rolls over the last window of the dice record (#350). Pure.
function diceOutcomeRatio(ws,window){var log=(ws&&ws.diceLog)||[],n=(typeof window==="number")?window:40,i,filed=0,s=0,f=0;
  for(i=Math.max(0,log.length-n);i<log.length;i++){var o=String(log[i].outcome||"").toLowerCase();if(!o)continue;if(/succ|pass|hit|crit/.test(o)){filed++;s++;}else if(/fail|miss/.test(o)){filed++;f++;}}
  return {filed:filed,successes:s,failures:f};}
// The tag ring bounds what the display can know; an older dice failure cannot certify
// that no intervening HP loss or expense was evicted. No state is written by this measurement.
function turnsSinceRisk(ws){
  ws=ws||{};var now=ws.turn||0,cap=typeof TAG_LOG_CAP==="number"?TAG_LOG_CAP:40;
  var tl=ws.tagLog||[],dl=ws.diceLog||[],seen={},last=-1,kind=null,i,j,e,age;
  var rules=[
    {tag:"HP",pattern:/^Took [1-9][0-9]* damage$/,kind:"HP loss"},
    {tag:"GOLD",pattern:/^-[1-9][0-9]* gp$/,kind:"gold spent"},
    {tag:"COMPANION_HP",pattern:/^.+ took [1-9][0-9]* HP$/,kind:"companion HP loss"},
    {tag:"CONDITION",pattern:null,kind:"condition"},
    {tag:"COMPANION_CONDITION",pattern:null,kind:"companion condition"}
  ];
  function risk(t,k){if(typeof t==="number"&&t<=now&&t>last&&now-t<cap){last=t;kind=k;}}
  for(i=tl.length-1;i>=Math.max(0,tl.length-cap);i--){
    e=tl[i];if(!e||typeof e.t!=="number"||e.t>now)continue;seen[e.t]=true;
    for(j=0;j<rules.length;j++){var rule=rules[j];if((e.tags||[]).indexOf(rule.tag)<0)continue;
      if(!rule.pattern){var rejected=(e.refused||[]).concat(e.stripped||[]).some(function(x){return String(x).indexOf("["+rule.tag+":")>=0;});if(!rejected)risk(e.t,rule.kind);continue;}
      var muts=e.m||[];for(var k=0;k<muts.length;k++)if(rule.pattern.test(String(muts[k]))){risk(e.t,rule.kind);break;}
    }
  }
  for(i=dl.length-1;i>=0;i--){e=dl[i];if(e&&/\b(fail|failed|failure|miss|missed|fumble)\b/i.test(String(e.outcome||"")))risk(e.t,"failed roll");}
  // scheduleDue's dueMin <= min projection, without its clockEnsure migration/repair side effects.
  var c=ws.clock,schedule=c&&c.schedule||[];
  if(c&&typeof c.min==="number"&&isFinite(c.min))for(i=0;i<schedule.length;i++){
    e=schedule[i];if(e&&typeof e.dueMin==="number"&&isFinite(e.dueMin)&&c.min>=e.dueMin)return {turns:0,kind:"schedule due",capped:false};
  }
  if(last>=0)return {turns:now-last,kind:kind,capped:false};
  age=0;while(age<cap&&seen[now-age])age++;
  return {turns:age,kind:null,capped:true};
}
function stakesFiledTurns(ws){
  var logs=[ws.tagLog||[],ws.diceLog||[]],seen={},n=0,i,j,e;
  for(i=0;i<logs.length;i++)for(j=logs[i].length-1;j>=0;j--){e=logs[i][j];if(e&&typeof e.t==="number"&&e.t<=ws.turn&&!seen[e.t]){seen[e.t]=true;n++;if(n>=3)return n;}}
  return n;
}
// The caches the health dot can judge — ONE row each; a ring entry with no row is not judged (cacheJudgeKey). Adding a cache
// means adding a row, not another branch in healthIndicators.
//   anthropic      by RATIO: its input count EXCLUDES cached tokens, so cr/(cr+in) is a real hit ratio (under 20% warns).
//   gemini-server  by PRESENCE (#334): the server's explicit cache serves the same cached tokens on every turn, so three recent
//                  turns reading ZERO mean its switch is off or it is failing. That was the 2026-09-10 → 09-30 outage, and the
//                  dot said "not enough Anthropic gameplay calls to judge". A mature campaign caches about 30% of its input, so
//                  the share is no signal. The entry's gw stamp (recordUsage) marks the server route.
// Not judged: own-key Gemini (no explicit cache) and the OpenAI shape (its input count INCLUDES cached tokens).
var CACHE_JUDGES={
  "anthropic":{label:"Anthropic",byRatio:true,counts:function(he){return ((he.in||0)+(he.cr||0))>1000;},
    dead:"turns read ZERO cached tokens — the stable half is not caching"},
  "gemini-server":{label:"Gemini",byRatio:false,counts:function(he){return (he.in||0)>1000;},
    dead:"Gemini turns through the server read ZERO cached tokens — the server's explicit cache is off or failing"}
};
function cacheJudgeKey(he){return !he?null:he.prov==="anthropic"?"anthropic":(he.prov==="gemini"&&he.gw)?"gemini-server":null;}
function healthIndicators(ws,mem,withGrowth){
  var items=[],i,j;
  function push(id,label,level,detail){items.push({id:id,label:label,level:level,detail:detail});}
  if(!ws)return {overall:"na",items:items,growth:withGrowth?[]:undefined};
  var hl=ws.healthLog||[],tl=ws.tagLog||[];
  // ① RAG serve rate — a mature campaign whose retrieval serves NOTHING for a full window is
  // the wine-cellar-confabulation precondition (#188): the GM answers memory asks from vibes.
  var tr=ws.transcript||[],ragSamples=[];
  for(i=hl.length-1;i>=0&&ragSamples.length<12;i--)if(hl[i].rag===0||hl[i].rag===1)ragSamples.push(hl[i].rag);
  if(ws.ragMemory===false)push("rag","Episodic recall (RAG)","na","disabled by the diagnosis flag");
  else if(tr.length<30||ragSamples.length<4)push("rag","Episodic recall (RAG)","na","young campaign — not enough history to judge ("+ragSamples.length+" samples)");
  else{
    var served=0;for(i=0;i<ragSamples.length;i++)served+=ragSamples[i];
    push("rag","Episodic recall (RAG)",served>0?"ok":(ragSamples.length>=12?"bad":"warn"),
      served+" of last "+ragSamples.length+" turns served past-scene excerpts"+(served===0?" — a mature campaign serving nothing may mean retrieval is broken":""));
  }
  // ② prompt cache — the #11 killer: a perturbed stable half silently pays full price every turn. The cache NOW in play is
  // the one judged: the newest ring entry picks its CACHE_JUDGES row (below), and that row's last six entries are read.
  var _cjKey=cacheJudgeKey(hl.length?hl[hl.length-1]:null),_cj=_cjKey?CACHE_JUDGES[_cjKey]:null,cs=[];
  for(i=hl.length-1;_cj&&i>=0&&cs.length<6;i--){var he=hl[i];if(cacheJudgeKey(he)===_cjKey&&_cj.counts(he))cs.push(he);}
  if(!_cj)push("cache","Prompt cache","na",!hl.length?"no gameplay calls recorded yet":hl[hl.length-1].prov==="gemini"?"not judged: own-key Gemini has no explicit cache":"not judged for this provider (its input count includes cached tokens)");
  else if(cs.length<2)push("cache","Prompt cache","na","not enough "+_cj.label+" gameplay calls to judge");
  else{
    var dead=0,low=0;
    for(i=0;i<cs.length;i++){var ratio=(cs[i].cr||0)/((cs[i].cr||0)+(cs[i].in||0));if((cs[i].cr||0)===0)dead++;if(_cj.byRatio&&ratio<0.2)low++;}
    push("cache","Prompt cache",dead>=3?"bad":(low>cs.length/2?"warn":"ok"),
      dead>=3?dead+" recent "+_cj.dead+"; every turn pays full input price":"cache reads healthy on recent turns");
  }
  // ③ tag discipline — consecutive tagless responses are the gpt-4o desync class: narration
  // moves the story while the sheet stands still.
  var zt=0;
  for(i=tl.length-1;i>=0&&i>=tl.length-8;i--){if((tl[i].tags||[]).length===0)zt++;else break;}
  if(tl.length<3)push("tags","State-tag emission","na","not enough responses recorded");
  else push("tags","State-tag emission",zt>=5?"bad":(zt>=3?"warn":"ok"),
    zt===0?"recent responses all carry state tags":zt+" consecutive responses with ZERO state tags"+(zt>=3?" — narration may be desyncing from the sheet":""));
  // ④ quest credit — two blind-spot classes: an active quest with every objective done that
  // never completes (#20 silence — rewards at risk), and #191's letter-of-the-law class: a
  // quest overtaken by events whose boxes never check. Spirit-satisfaction isn't detectable;
  // tag SILENCE is (lastTouch vs QUEST_STALE_TURNS; legacy rows without the stamp read old).
  var ql=ws.questLog||[],stuck=[],stalled=[];
  var qStale=(typeof QUEST_STALE_TURNS!=="undefined")?QUEST_STALE_TURNS:30;
  for(i=0;i<ql.length;i++){var q=ql[i];
    if(q.status!=="active")continue;
    if(q.objectives&&q.objectives.length){
      var d=0;for(j=0;j<q.objectives.length;j++)if(q.objectives[j].done)d++;
      if(d===q.objectives.length)stuck.push(q.title);
    }
    var qlt=q.lastTouch!=null?q.lastTouch:-1;
    if(((ws.turn||0)-qlt)>qStale)stalled.push(q.title);
  }
  var qBits=[];
  if(stuck.length)qBits.push("all objectives complete but quest still open: "+stuck.join(", "));
  if(stalled.length)qBits.push("possibly stalled or overtaken (no progress tags in "+qStale+"+ turns): "+stalled.join(", "));
  push("quest","Quest credit",qBits.length?"warn":"ok",
    qBits.length?qBits.join("; "):"no quest sitting complete-but-uncredited or stalled");
  // ⑤ standing anomalies — the engine is already telling itself something is wrong; this
  // surfaces it to the player BEFORE broken fiction does (the t1781 'survived as a proxy' class).
  // NAMED, never counted (owner ruling 2026-08-14 — "you have the information"): subject, quest,
  // turn, and refusal reason reach the detail line. And ACTIVE vs HISTORICAL matters: quarantined
  // receipts never retire by W2 contract (poisoning is a memory), so a long-healed refusal must
  // read as a scar, not a forever-red dot — a quarantine is ACTIVE only while recent
  // (within CANON_TXN_RETIRE_TURNS) or while its subject still has an open conflict.
  var anom=[],unresolved=0,activeQ=0,histQ=0,turnNow=ws.turn||0;
  var openSubjects={},ic=ws.identityConflicts||[];
  for(i=0;i<ic.length;i++){var cf=ic[i];
    if(cf.resolved||cf.stale)continue;
    unresolved++;openSubjects[cf.subject]=1;
    if(anom.length<3)anom.push("open identity conflict: "+(cf.subject||"?")+" — "+String(cf.reason||"no reason recorded").slice(0,90)+" (since t"+cf.turn+(cf.attempts?", "+cf.attempts+" nudges":"")+")");
  }
  var ct=ws.canonTxns||[];
  for(i=0;i<ct.length;i++){var r=ct[i];
    if(r.status!=="quarantined")continue;
    var lastAct=r.lastAttemptTurn!=null?r.lastAttemptTurn:(r.quarantinedTurn!=null?r.quarantinedTurn:r.turn||0);
    var active=(turnNow-lastAct)<=CANON_TXN_RETIRE_TURNS||openSubjects[r.subject];
    // 2026-08-17 (the Xanesha field question "should I just ignore this?"): a recent refusal whose
    // own recovery already RAN — dispute resolved AND a later claim for the same subject committed —
    // must not keep shouting PROBLEM/"withholding"/"submit a report". The refusal stays visible
    // (recent news, and the receipt is poisoned forever by contract) but reads as what it is: a
    // refusal the machinery already answered. Detection is receipts-only, same as everything here.
    var healedLater=false,hj;
    if(active&&!openSubjects[r.subject]&&r.subject&&r.subject!=="-"){
      for(hj=0;hj<ct.length;hj++){var hr=ct[hj];
        if(hr.status==="committed"&&hr.subject===r.subject&&(hr.committedTurn!=null?hr.committedTurn:hr.turn||0)>=(r.quarantinedTurn!=null?r.quarantinedTurn:r.turn||0)){healedLater=true;break;}}
    }
    if(active&&!healedLater){activeQ++;
      if(anom.length<3)anom.push("refused canon claim \""+(r.id||"?")+"\": "+(r.subject&&r.subject!=="-"?r.subject:"(no subject)")+(r.quest?", withholding quest \""+r.quest+"\"":"")+" — t"+(r.quarantinedTurn!=null?r.quarantinedTurn:r.turn)+": "+String(r.reason||"no reason recorded").slice(0,90));
    }else if(active){
      if(anom.length<3)anom.push("refused canon claim \""+(r.id||"?")+"\" ("+r.subject+", t"+(r.quarantinedTurn!=null?r.quarantinedTurn:r.turn)+") — RESOLVED: a later claim for "+r.subject+" committed"+(r.quest?"; verify \""+r.quest+"\" paid out in the journal":""));
    }else histQ++;
  }
  // #194/ruling ③ (observation only, by design): legacy-grade authorizations are the fail-open
  // window — pre-epoch mention-fed evidence that still authorized a death. Monotonically
  // shrinking (re-witnessed or mood-restamped NPCs leave the grandfathered set) and self-
  // clearing (committed receipts retire after structured summaries), but while present it is
  // exactly the evidence a later fail-closed flip would want to see.
  var legacyN=0;
  for(i=0;i<ct.length;i++)if(ct[i].status==="committed"&&ct[i].evidenceGrade==="legacy")legacyN++;
  if(legacyN)anom.push(legacyN+" death authorization"+(legacyN>1?"s":"")+" rode legacy-grade (pre-epoch) evidence — receipted under the #194 fail-open window, closed at v1.760 (historical)");
  if(ws.summaryFailure&&(ws.summaryFailure.count||0)>=1)anom.push("memory filing failing ("+ws.summaryFailure.count+" strike"+(ws.summaryFailure.count>1?"s":"")+", "+(ws.summaryFailure.kind||"extraction")+": "+String(ws.summaryFailure.reason||"").slice(0,60)+")");
  if(ws.phaseMismatch)anom.push("clock/narration phase mismatch armed (t"+(ws.phaseMismatch.turn||"?")+")");
  var extra=histQ?((anom.length?"; ":"")+histQ+" historical refusal"+(histQ>1?"s":"")+" on record (healed — receipts never retire by contract)"):"";
  push("anomaly","Standing anomalies",(activeQ||unresolved)?"bad":(anom.length?"warn":"ok"),
    anom.length||extra?(anom.join("; ")+extra):"none");
  // ⑥ transport (#29) — absorbed transient auto-retries, stamped rt into the ring by recordUsage.
  // Retries the player never saw are exactly the class this readout exists for: a provider
  // degrading QUIETLY (each call still succeeds, just late) before it starts failing loud.
  // Surfacing them here is the deal that made absorbing transients honest (no-silent-failures).
  var rtCalls=0,rtTotal=0;
  for(i=0;i<hl.length;i++)if(hl[i].rt){rtCalls++;rtTotal+=hl[i].rt;}
  if(hl.length<3)push("transport","Provider transport","na","not enough calls recorded");
  else push("transport","Provider transport",rtCalls>=8?"bad":(rtCalls>=3?"warn":"ok"),
    rtCalls?rtCalls+" of the last "+hl.length+" recorded turns needed transient retries ("+rtTotal+" absorbed) — the provider is load-shedding":"no absorbed transient retries in the recent window");
  // Plain-language action hints (owner ruling 2026-08-14: every WATCH/PROBLEM carries a
  // <25-word "what this means / what to do" line — the raw detail is accurate but useless
  // to a player). The word cap is CONTRACT, enforced by an engine test, not by discipline.
  // #371: rolled-outcome ratio — "10/10" is a number a human can judge (a high-level ladder working, or a
  // narrator declining to roll); measurement only, never a note.
  var dr=diceOutcomeRatio(ws);
  if(dr.filed<3)push("dice","Rolled outcomes","na","too few filed rolls to judge ("+dr.filed+")");
  else push("dice","Rolled outcomes",(dr.failures===0&&dr.filed>=8)?"warn":"ok",dr.successes+" of the last "+dr.filed+" filed rolls succeeded"+(dr.failures===0?" — not one failure on record":""));
  var riskRead=turnsSinceRisk(ws),inCoda=codaState(),ended=!!(ws&&ws.ended);
  /* #374b (owner, the finished Long Walk read "38 turns since recorded risk; coda: no — WATCH"): a finished campaign is
     not a coda by the predicate (the campaign is closed), so the ending read as a suspicious quiet stretch. A story that
     is over has nothing to watch — it is its own reading, never a warning. */
  push("stakes","At risk",ended?"na":(stakesFiledTurns(ws)<3?"na":(inCoda||riskRead.turns<20?"ok":"warn")),
    riskRead.turns+(riskRead.capped?"+":"")+" turns since recorded risk"+(riskRead.kind?" ("+riskRead.kind+")":" — retained record only")+"; "+(ended?"campaign ended (t"+(ws.ended.turn||ws.turn||0)+")":"coda: "+(inCoda?"yes":"no")));
  // #372: the register census — #355's narration slips plus the three channels it could not reach, counted. A
  // standing SOURCE (a sheet field the GM reads every turn, a chapter that stayed dirty after its one re-ask) is
  // the actionable WATCH; counts alone are a reading. Sits after the stakes item (#374 pins stakes beside dice).
  var rgN=(ws.registerSlips||[]).length,rgC=registerCensusStats(ws),rgSheet=sheetRegisterReport(ws),rgBits=[],rgSrc=[];
  if(rgN||rgC.chapter||rgC.label||rgC.idiom)rgBits.push("narration "+rgN+", chapters "+rgC.chapter+(rgC.chapterDirty?" ("+rgC.chapterDirty+" still carried it after the re-ask)":"")+", labels "+rgC.label+", modern idiom "+rgC.idiom);
  for(i=0;i<rgSheet.length&&rgSrc.length<3;i++)rgSrc.push(rgSheet[i].name+" — "+rgSheet[i].field+": "+rgSheet[i].words.join(", "));
  if(rgSrc.length)rgBits.push("sheet text carries register words ("+rgSrc.join("; ")+(rgSheet.length>3?"; +"+(rgSheet.length-3)+" more":"")+")");
  if(!rgBits.length)push("register","Register (clerical images, modern idiom)","na","nothing recorded");
  else push("register","Register (clerical images, modern idiom)",(rgSheet.length||rgC.chapterDirty)?"warn":"ok",rgBits.join("; "));
  var HINTS={
    rag:{bad:"Past scenes aren't reaching the GM — memory questions get invented answers. Submit a report if this stays red.",
         warn:"Past scenes aren't reaching the GM lately. Watch it — submit a report if it goes red."},
    cache:{bad:"Every turn is paying full price instead of reading the prompt cache. Submit a report if this stays red across a session.",
           warn:"Cache reads are running low — worth a report if it persists."},
    tags:{bad:"The story may be moving without the sheet updating. Open the Sheet and tap ⟳ Sync to re-audit.",
          warn:"The story may be moving without the sheet updating. Open the Sheet and tap ⟳ Sync to re-audit."},
    quest:{warn:"The engine is nudging the GM to review or close it — if it lingers a few turns, ask about it in-story."},
    anomaly:{bad:"A canon claim (often a death or its rewards) was refused and withheld. If the story owes you something, submit a report.",
             warn:"Self-correcting state (memory retries or a clock check) — no action needed unless it persists; then submit a report."},
    stakes:{warn:"No recent recorded risk outside a coda. Judge the quiet stretch by the scenes; this measurement does not change play."},
    dice:{warn:"Every filed roll succeeded. Either a high-level skills ladder is doing its job or the GM is not rolling when something is at risk — judge by the scenes, and check File ▸ Settings ▸ Name the stake before a roll."},
    transport:{bad:"Heavy provider load-shedding — most turns need retries. Consider switching model for this session; report if it continues.",
               warn:"The AI provider is shedding load — turns retry and feel slower. Usually clears on its own; report if it lasts all session."},
    register:{warn:"A character's own text or a chapter keeps clerical words the GM argues with every turn. Edit the text in the character editor."}
  };
  for(i=0;i<items.length;i++){var hh=HINTS[items[i].id];if(hh&&hh[items[i].level])items[i].hint=hh[items[i].level];}
  var rank={ok:0,warn:1,bad:2},worst="ok",any=false;
  for(i=0;i<items.length;i++){var lv=items[i].level;if(lv==="na")continue;any=true;if(rank[lv]>rank[worst])worst=lv;}
  var out={overall:any?worst:"na",items:items};
  if(withGrowth)out.growth=healthGrowthTelemetry(ws,mem);
  return out;
}

// #307: the quick-start payload gate — pure, engine-tested; consumeHomeQuickStart (ui-browsers.js) is its one caller.
function quickStartPayloadValid(rec){
  if(!rec||typeof rec!=="object")return "payload unreadable";
  if(rec.at&&Date.now()-rec.at>3600*1000)return "stale (>1h)";
  var c=rec.char;if(!c||typeof c!=="object"||!c.name||!c.cls)return "hero sheet missing a name or class";
  if(typeof classDef==="function"&&!classDef(c.cls))return "hero class '"+c.cls+"' is unknown";
  if(!rec.bp||typeof rec.bp!=="object")return "blueprint missing";
  var err=(typeof validateBlueprint==="function")?validateBlueprint(rec.bp):null;
  return err?("blueprint refused: "+err):null;
}

// #308: the spoken "previously on" — the last chapter summary and where the party stands. Pure.
function carRecapText(){
  if(typeof kindDef==="function"&&kindDef().recap==="state"&&typeof villageRecapText==="function")return villageRecapText();/* #6 C3: the village speaks state */
  var ch=(typeof memory!=="undefined"&&memory&&memory.chapters)||[];
  var where=(typeof worldState!=="undefined"&&worldState&&worldState.world)?(worldState.world.sublocation||worldState.world.location||""):"";
  if(!ch.length)return "No chapters yet — this is the beginning."+(where?" You are at "+where+".":"");
  var last=ch[ch.length-1];
  return "Previously: "+String(last.summary||"").trim()+(where?" You are at "+where+".":"");
}

/* #19 fourth pass (owner ruling 2026-09-23): Car Mode's ENTRY read. "When car-mode starts, just read the current scene, and
   jump to options." The full recap (carRecapText — in the Village every stash item and three residents, elsewhere the last
   chapter) stays on the spoken "previously" command; the entry reads WHERE you are and the TAIL of the last narration — the
   last CAR_BRIEF_SENTENCES sentences, capped at CAR_BRIEF_MAX_CHARS on a word boundary — and the options step follows. Pure:
   the transcript's last GM entry (clean text; bookkeeping and refusal entries skipped). "" when there is nothing to say. */
var CAR_BRIEF_SENTENCES=2,CAR_BRIEF_MAX_CHARS=320;
function carSceneBrief(ws){
  ws=ws||((typeof worldState!=="undefined")?worldState:null);if(!ws)return "";
  var tr=ws.transcript||[],i,last=null,e;
  for(i=tr.length-1;i>=0;i--){e=tr[i];if(e&&e.r==="gm"&&!e.bk&&!e.rf&&e.x){last=e;break;}}
  var where=(ws.world&&(ws.world.sublocation||ws.world.location))||"";
  var lead=where?"You are at "+where+".":"";
  if(!last)return lead;
  var text=String(last.x).replace(/\s+/g," ").trim();
  var sents=text.match(/[^.!?]+[.!?]+["'\u201d\u2019)]*|[^.!?]+$/g)||[text];
  var tail=sents.slice(-CAR_BRIEF_SENTENCES).join(" ").replace(/\s+/g," ").trim();
  if(tail.length>CAR_BRIEF_MAX_CHARS){tail=tail.slice(tail.length-CAR_BRIEF_MAX_CHARS);var sp=tail.indexOf(" ");if(sp>=0)tail=tail.slice(sp+1);}
  return (lead?lead+" ":"")+tail;
}

// #315 (review C5): clamp helpers for imported text. Pure; the caps live in IMPORT_CAPS (globals.js).
function clampStr(v,max){if(typeof v!=="string")return v;var lim=(typeof max==="number"&&max>0)?max:800;return v.length>lim?v.slice(0,lim):v;}
// Clamp a portable character sheet's prose in place. Returns {clamped:N} so the import surface can say so.
function clampImportedCharacter(c){
  if(!c||typeof c!=="object")return {clamped:0};
  var caps=(typeof IMPORT_CAPS!=="undefined")?IMPORT_CAPS:{backstory:2500,field:800},n=0,i;
  function one(obj,k,lim){if(typeof obj[k]==="string"&&obj[k].length>lim){obj[k]=obj[k].slice(0,lim);n++;}}
  one(c,"backstory",caps.backstory);["appear","mark","trait","flaw","motivation","name","deity"].forEach(function(k){one(c,k,caps.field);});
  ["inventory","languages"].forEach(function(k){if(Array.isArray(c[k]))for(i=0;i<c[k].length;i++){if(typeof c[k][i]==="string"&&c[k][i].length>caps.field){c[k][i]=c[k][i].slice(0,caps.field);n++;}else if(c[k][i]&&typeof c[k][i]==="object")one(c[k][i],"name",caps.field);}});
  ["abilities","spells","storyBeats","coreMemories","conditions","relationships","saveModifiers"].forEach(function(k){if(Array.isArray(c[k]))for(i=0;i<c[k].length;i++){var it=c[k][i];if(!it||typeof it!=="object")continue;["nm","ds","text","name","bond","dynamic","duration","cause","source"].forEach(function(f){one(it,f,caps.field);});}});
  if(n&&typeof console!=="undefined")console.warn("[import] "+n+" over-long field(s) on "+(c.name||"the sheet")+" clamped at import (#315)");
  return {clamped:n};
}
/* #6 THE VILLAGE (phase A): the kind readers. campaignKind() never throws and never returns an unknown kind — a legacy save
   with no `kind`, or a junk value, reads as adventure. kindDef() is the ONE dispatch point every kind-aware site uses. */
function campaignKind(){var k=(typeof worldState!=="undefined"&&worldState)?worldState.kind:null;return (k&&typeof CAMPAIGN_KINDS!=="undefined"&&CAMPAIGN_KINDS[k])?k:"adventure";}
function kindDef(){return CAMPAIGN_KINDS[campaignKind()];}
/* A resident's house is a sub-location of the village node: "<village>|<Name>'s house". The map graph already keys
   sub-locations as parent|leaf, so the house rides every existing reader (items, presence, hours) unchanged. */
/* #6 F1 (2026-09-12): is this node a SHOP? Decided by the kind's data (shopWords / hallWords) and the node (owner, shop
   flag) — never a name test at a call site. A house (owner) and the Hall are never shops; the settlement itself is not;
   a kind without waresPerShop (the adventure) has no shop nodes at all. */
function isShopNode(key,node){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.waresPerShop||!node)return false;
  if(node.owner)return false;var k=String(key||"");if(k.indexOf("|")<0)return false;
  var leaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(k):k.split("|").pop();
  if(def.hallWords&&def.hallWords.test(leaf))return false;
  if(node.shop===true)return true;
  return !!(def.shopWords&&def.shopWords.test(leaf));
}
/* #6 F5: THE trade gate — where and with whom coin may change hands. {ok:true} outside a tradeOnlyInShops kind; in the
   village ok only when the hero stands in a shop sub-location with a present, living, non-party NPC (the keeper —
   residents roam, so a resident behind the counter counts). Every refusal carries a reason the mutation log can print. */
function villageTradeContext(text,R){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.tradeOnlyInShops)return {ok:true};
  var key=(typeof currentNodeKey==="function")?currentNodeKey():null;if(!key||typeof memory==="undefined"||!memory||!memory.map)return {ok:false,reason:"no place on record"};
  /* #6 F10 → #481 A4: the coin moves where the reply's FIRST [GOLD:] happens — the ONE place timeline (R.places, or the same
     pure placeTimeline over the text) says where that is, so pay-then-leave pays in the shop and leave-then-pay outside. The F10
     keeper rule stays: an arrival in the reply before the coin moved resets the room, and only the reply's own speakers are
     known to be inside. State-only callers pass nothing. */
  var _t=String(text||""),_spk=[],_arrived=false;
  if(_t){var _tl=(R&&R.places)?R.places:placeTimeline(_t),_go=_t.search(/\[GOLD:/),_st=placeStateAt(_tl,_go>=0?_go:null),_ei;
    if(_st&&_st.key)key=_st.key;
    for(_ei=0;_ei<_tl.events.length;_ei++){var _e=_tl.events[_ei];if((_go<0||_e.off<_go)&&(_e.kind==="sub"||(_e.kind==="world"&&!_e.twin)))_arrived=true;}
    var _sm=_t.match(/\[SAY:[^\]]+\]/g)||[],_si;for(_si=0;_si<_sm.length;_si++)_spk.push(_sm[_si].slice(5,-1).split("|")[0].trim());/* #458: the |mood is not part of the name — "Name|bright" is nobody on the roster */}
  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk],leaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(rk):rk;
  if(!isShopNode(rk,node))return {ok:false,reason:"not in a shop ("+leaf+")"};
  var man=(typeof buildSceneManifest==="function")?buildSceneManifest():{local:[]},local,i,keeper=null;
  /* #481 B4 (owner ruling 2026-09-29, "a shop's owner counts as present while the shop is open"): a shop with a KEEPER OF
     RECORD ([SHOP_KEEPER:]) counts that keeper at the counter while it is open (shopOpenNow: its hours, or none on record);
     anyone else — and the keeper out of hours — only in the scene now (man.local) or speaking in this reply. A shop with no
     keeper on record keeps the stale-tolerant exact-spot rule (man.seenHere) until the GM files one. */
  var _kName=(node&&node.keeper)?node.keeper:null,_kOpen=_kName?shopOpenNow(node):true;
  if(_kName){local=_arrived?_spk.slice():(man.local||[]).concat(_spk);if(_kOpen)local.unshift((typeof resolveNpcName==="function")?resolveNpcName(_kName):_kName);}
  else local=_arrived?_spk:(man.seenHere||man.local||[]).concat(_spk);/* an arrival in the text resets the room: only this response's speakers are known to be inside */
  for(i=0;i<local.length&&!keeper;i++){var n=(typeof wsNpcByName==="function")?wsNpcByName(local[i]):null;if(n&&!n.partyMember&&!(typeof npcIsDead==="function"&&npcIsDead(n)))keeper=n.name;}
  if(!keeper)return {ok:false,reason:(_kName&&!_kOpen)?leaf+" is closed at this hour ("+_kName+" keeps it) and nobody in the scene can trade":"no counterparty present in "+leaf};
  return {ok:true,keeper:keeper,shop:leaf,node:node,key:rk};
}
/* #501 (owner 2026-10-01): is there a counter to open RIGHT NOW? The ONE rule both doors to the counter read — the
   narration's Shop button (syncShopButton, ui-shell.js) and the inventory panel's Trade row (ui-panels.js): the trade gate
   is open AND names a shop (villageTradeContext: a shop node, someone to trade with). Only a kind with a counter has shop
   nodes (isShopNode), and the adventure's always-open gate names none, so no kind test is needed here. Returns
   {shop,keeper}, or null. Pure over the live state, so nothing about it is stored with a turn. */
function shopOpportunity(){
  var t=(typeof villageTradeContext==="function")?villageTradeContext():null;
  return (t&&t.ok&&t.shop)?{shop:t.shop,keeper:t.keeper}:null;
}

/* #407 THE SHOP INTERFACE (owner drawing 2026-09-16; four rulings in the TODO row). A pure view model and plan over the
   village's own teeth: villageTradeContext (a shop with its keeper present), the shop node's LIVE wares and WANTED list,
   and bible canon. Sell price = HALF canon, FULL when the keeper WANTS it (a WANTED offer prices a no-canon item); with
   neither, the item is not sellable at the counter (ask the keeper in prose). Buy price = the ware's pinned price; each
   ware row is one unit. Coin is whole gp ([GOLD:] is an integer): the total rounds to the nearest gp and a non-zero
   purchase never rounds to free. Nothing here writes state — shopTradeApply (game.js) lands the plan as tags. */
var SHOP_SELL_FRACTION=0.5;
function shopTradeCatalog(){
  var vtc=(typeof villageTradeContext==="function")?villageTradeContext():{ok:false,reason:"no trade context"};
  if(!vtc.ok||!vtc.node)return {ok:false,reason:vtc.reason||"not in a shop"};
  var c=(typeof worldState!=="undefined"&&worldState&&worldState.character)||{},inv=c.inventory||[],hero={},order=[],i;
  for(i=0;i<inv.length;i++){var base=(typeof _invBase==="function")?_invBase(inv[i]):String(inv[i]),n=(typeof _invCount==="function")?_invCount(inv[i]):1,k=base.toLowerCase();
    if(!hero[k]){hero[k]={name:base,qty:0,worn:false,canonGp:null,wanted:false,sellGp:null};order.push(k);}
    hero[k].qty+=n;if(typeof isWorn==="function"&&isWorn(c,inv[i]))hero[k].worn=true;}
  var wanted={},wl=(typeof nodeWantedLive==="function")?nodeWantedLive(vtc.node):(vtc.node.wanted||[]);/* #481 D4: live wants only */for(i=0;i<wl.length;i++)wanted[String(wl[i].item||"").toLowerCase()]=wl[i];
  var sell=[];for(i=0;i<order.length;i++){var r=hero[order[i]],canon=(typeof itemLookup==="function")?itemLookup(r.name):null,gp=(typeof itemValueGp==="function")?itemValueGp(canon):null;
    var w=wanted[order[i]]||wanted[String((typeof itemBaseName==="function")?itemBaseName(r.name):r.name).toLowerCase()]||null;
    r.canonGp=gp;r.wanted=!!w;
    /* #481 D4 (ruled 2026-09-29; amends #407 ruling ①): a WANTED item sells at the keeper's STATED offer, parsed by the one
       coin parser, for ONE unit (the want retires when met); an offer in words is no counter price — ask the keeper. */
    if(w){var oc=(typeof parseCoin==="function")?parseCoin(w.offer):null;r.offer=String(w.offer||"");if(oc&&oc.unit)r.sellGp=oc.unitGp;else r.offerWords=true;}
    else if(gp)r.sellGp=gp*SHOP_SELL_FRACTION;
    sell.push(r);}
  var live=(typeof nodeWaresLive==="function")?nodeWaresLive(vtc.node):(vtc.node.wares||[]),buy=[];
  for(i=0;i<live.length;i++){var ware=live[i],bg=(typeof itemValueGp==="function")?itemValueGp({value:ware.price}):null,pc=(typeof parseCoin==="function")?parseCoin(ware.price):null;
    buy.push({name:ware.item,price:ware.price,buyGp:bg,per:(bg!=null&&pc&&pc.per>1)?pc.per:1,note:ware.note||""});}/* #481 D5: "1 gp per 20" sells by the one, up to twenty */
  return {ok:true,keeper:vtc.keeper,shop:vtc.shop,key:vtc.key,node:vtc.node,gold:Number(c.gold)||0,sell:sell,buy:buy};
}
/* marks = {sell:{<lowercase name>:qty}, buy:{<lowercase name>:1}} — what the player has clicked. */
function shopTradePlan(cat,marks){
  marks=marks||{};var ms=marks.sell||{},mb=marks.buy||{},lines=[],under=[],sellGp=0,buyGp=0,i,k;
  /* #481 D7 (ruled 2026-09-29): the floor is on the LINE total — a sale line worth under half a gold piece would round to
     0 gp while the item left the pack. It is refused with the reason and nothing moves; two 3 sp whistles (6 sp) sell for 1 gp. */
  for(i=0;i<cat.sell.length;i++){var r=cat.sell[i];k=r.name.toLowerCase();var q=ms[k]|0;if(q<=0||r.worn||r.sellGp==null)continue;q=Math.min(q,r.qty);if(Math.round(r.sellGp*q)===0){under.push(q+" "+r.name+" ("+shopFmtGp(r.sellGp*q)+")");continue;}lines.push({kind:"sell",name:r.name,qty:q,unitGp:r.sellGp,gp:r.sellGp*q});sellGp+=r.sellGp*q;}
  for(i=0;i<cat.buy.length;i++){var b=cat.buy[i];k=b.name.toLowerCase();var bq=Math.min(mb[k]|0,b.per||1);if(bq<=0||b.buyGp==null)continue;lines.push({kind:"buy",name:b.name,qty:bq,unitGp:b.buyGp,gp:b.buyGp*bq,price:b.price});buyGp+=b.buyGp*bq;}/* #481 D5: the line is the unit price times the count */
  var net=buyGp-sellGp,rounded=net>=0?Math.round(net):-Math.round(-net);/* whole gp, halves away from zero: a half-gp sale still pays 1 gp */
  if(buyGp>0&&net>0&&rounded===0)rounded=1;/* the keeper never gives a thing away */
  var goldAfter=cat.gold-rounded,ok=lines.length>0&&goldAfter>=0&&!under.length;
  var why=under.length?"the keeper pays nothing for "+under.join(", ")+" — under half a gold piece; mark more of it, or keep it":(!lines.length?"nothing marked":(goldAfter<0?"short "+(rounded-cat.gold)+" gp":""));
  return {lines:lines,under:under,sellGp:sellGp,buyGp:buyGp,netGp:rounded,goldAfter:goldAfter,ok:ok,reason:why};
}
/* The plan as the tags the parser already understands — every move lands in the mutation log through the trade gate. */
function shopTradeTagText(plan){
  var t="",i;if(plan.netGp!==0)t+="[GOLD:"+(plan.netGp>0?"-":"+")+Math.abs(plan.netGp)+"]";
  for(i=0;i<plan.lines.length;i++){var l=plan.lines[i];if(l.qty>0)t+="["+(l.kind==="sell"?"ITEM_LOST":"ITEM_GAINED")+":"+l.name+(l.qty>1?" x"+l.qty:"")+"]";}/* #481 D3: the parser reads any count — no x9 chunking */
  return t;
}
function shopFmtGp(gp){
  var a=Math.abs(gp);if(a>0&&a<1){var sp=a*10;return (gp<0?"-":"")+(Math.abs(sp-Math.round(sp))<1e-9?Math.round(sp)+" sp":Math.max(1,Math.round(a*100))+" cp");}/* #481 D5: under a gold piece, in silver or copper */
  var v=Math.round(gp*10)/10;return (v%1===0?String(v):v.toFixed(1))+" gp";}

/* #407 ⑤ (owner 2026-09-16): ONE two-column LEDGER shape, used by the shop and the stash (and whatever comes next).
   A spec is data: two titled columns of rows {key,label,max,worn,off,offReason,tag,sub}, an amount rule, a plan and a
   complete function. showLedgerModal (ui-modals) renders any spec; the builders below stay pure and engine-tested.
   Rows without a price sort to the bottom of their column (owner ask); worn rows keep their place, greyed. */
/* #497 (owner 2026-09-30): how a tap steps a ledger row's count — the shop's counter and the chest share it. Up by one to the
   row's maximum, then back to none: "14/14" used to be a dead end, cleared only by a tap on the small count badge. A single
   item toggles. A count above the maximum (the stock shrank under an open modal) resets to none. Pure. */
function ledgerNextMark(cur,max){cur=cur|0;max=Math.max(1,max|0);return cur>=max?0:cur+1;}
function shopLedgerRows(cat){
  var sell=cat.sell.map(function(r){return {key:r.name.toLowerCase(),label:r.name,max:r.wanted?Math.min(1,r.qty):r.qty,/* #481 D4: a want buys one */worn:r.worn,off:r.worn||r.sellGp==null,unit:r.sellGp,
    offReason:r.worn?"Worn \u2014 take it off first":(r.sellGp==null?(r.offerWords?"Wanted, but the offer is in words (\u201c"+r.offer+"\u201d) \u2014 ask "+cat.keeper:"No price on record here \u2014 ask "+cat.keeper):""),tag:r.wanted?"wanted":"",hint:r.wanted?"Wanted here: the keeper's offer ("+r.offer+"), for one":"Half its listed value"};});
  sell.sort(function(a,b){var ap=a.unit==null?1:0,bp=b.unit==null?1:0;return ap-bp;});/* stable in ES2019+; a priced row never sinks below an unpriced one */
  var buy=cat.buy.map(function(b){return {key:b.name.toLowerCase(),label:b.name,max:b.per||1,/* #481 D5 */worn:false,off:b.buyGp==null,unit:b.buyGp,offReason:b.buyGp==null?"Priced in words \u2014 ask "+cat.keeper:"",tag:"",hint:b.price+(b.note?" \u00b7 "+b.note:""),price:b.price};});
  buy.sort(function(a,b){var ap=a.unit==null?1:0,bp=b.unit==null?1:0;return ap-bp;});
  return {left:sell,right:buy};
}
/* THE STASH LEDGER (#6 E11) — carried on the left (stow: green), in the house on the right (take: pink). Only in the hero's
   OWN house (node.owner = the hero); the tags it emits are the ones the stash already honours: [ITEM_LOST:] + a
   [LOCATION_ITEM:x|placed] per unit to stow, [ITEM_GAINED:] per unit to take (the gated auto-take path, E5). */
function stashTradeCatalog(){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.stashQuantities)return {ok:false,reason:"no stash in this campaign"};
  var c=(typeof worldState!=="undefined"&&worldState&&worldState.character)||null;if(!c||!worldState.world)return {ok:false,reason:"no hero"};
  var key=(typeof currentNodeKey==="function")?currentNodeKey():null;if(!key||typeof memory==="undefined"||!memory||!memory.map)return {ok:false,reason:"no place on record"};
  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk],leaf=(typeof locDisplayLeaf==="function")?locDisplayLeaf(rk):rk;
  if(!node||!node.owner)return {ok:false,reason:"not in a house ("+leaf+")"};
  if(node.owner!==c.name)return {ok:false,reason:"this is "+node.owner+"'s house \u2014 only its owner opens the chest"};
  var inv=c.inventory||[],carried={},order=[],i;
  for(i=0;i<inv.length;i++){var base=(typeof _invBase==="function")?_invBase(inv[i]):String(inv[i]),n=(typeof _invCount==="function")?_invCount(inv[i]):1,k=(typeof stashKey==="function")?stashKey(base):base.toLowerCase();/* #481 D2 */
    if(!carried[k]){carried[k]={name:base,qty:0,worn:false};order.push(k);}carried[k].qty+=n;if(typeof isWorn==="function"&&isWorn(c,inv[i]))carried[k].worn=true;}
  var stored=(typeof villageStash==="function")?villageStash(rk):[];
  return {ok:true,house:leaf,key:rk,node:node,hero:c.name,carried:order.map(function(k){return carried[k];}),stored:stored.map(function(r){return {name:r.name,qty:r.qty,room:r.room||null};})};
}
function stashLedgerRows(cat){
  return {left:cat.carried.map(function(r){return {key:(typeof stashKey==="function")?stashKey(r.name):r.name.toLowerCase(),/* #481 D2: the one stash identity */label:r.name,max:r.qty,worn:r.worn,off:r.worn,unit:null,offReason:r.worn?"Worn \u2014 take it off first":"",tag:"",hint:"Stow it in the house"};}),
    right:cat.stored.map(function(r){return {key:(typeof stashKey==="function")?stashKey(r.name):r.name.toLowerCase(),label:r.name,max:r.qty,worn:false,off:false,unit:null,offReason:"",tag:r.room||"",hint:"Take it with you"};})};
}
/* marks = {stow:{<lowercase name>:qty}, take:{<lowercase name>:qty}} */
function stashTradePlan(cat,marks){
  marks=marks||{};var ms=marks.stow||{},mt=marks.take||{},lines=[],i,k,stow=0,take=0;
  function _mk(m,name){var a=(typeof stashKey==="function")?stashKey(name):name.toLowerCase();return (m[a]|0)||(m[name.toLowerCase()]|0);}/* #481 D2: marks keyed by the stash identity (a lowercase name still reads) */
  for(i=0;i<cat.carried.length;i++){var r=cat.carried[i];var q=_mk(ms,r.name);if(q<=0||r.worn)continue;q=Math.min(q,r.qty);lines.push({kind:"stow",name:r.name,qty:q});stow+=q;}
  for(i=0;i<cat.stored.length;i++){var s=cat.stored[i];var tq=_mk(mt,s.name);if(tq<=0)continue;tq=Math.min(tq,s.qty);lines.push({kind:"take",name:s.name,qty:tq});take+=tq;}
  return {lines:lines,stowed:stow,taken:take,ok:lines.length>0,reason:lines.length?"":"nothing marked"};
}
function stashTradeTagText(plan){
  var t="",i,j;for(i=0;i<plan.lines.length;i++){var l=plan.lines[i];
    if(l.kind==="stow"){if(l.qty>0)t+="[ITEM_LOST:"+l.name+(l.qty>1?" x"+l.qty:"")+"]";/* #481 D3: one tag, any count */for(j=0;j<l.qty;j++)t+="[LOCATION_ITEM:"+l.name+"|placed]";}
    else{for(j=0;j<l.qty;j++)t+="[ITEM_GAINED:"+l.name+"]";}}
  return t;
}
/* #6 E8: the stash as data — the untaken rows of a node with qty and provenance. Pure; the geo block, the inventory panel
   and Car Mode all read this one function. */
function villageStash(key){
  if(typeof memory==="undefined"||!memory||!memory.map||!key)return [];
  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk];if(!node||!node.items)return [];
  return node.items.filter(function(it){return !it.taken&&(it.qty===undefined||it.qty>0);}).map(function(it){return {name:it.name,qty:it.qty||1,placed:it.placed,by:it.by||null,room:it.room||null};});/* #408 ④: room rides the row */
}
/* #408 ②: arm the layout ask for a place anywhere (Table Talk's "no floor plan is recorded" offers it as one click; the
   village house fires it unasked). buildLayoutNote consumes the arm on its next run. Pure over worldState. */
function armLayoutAsk(key){
  if(typeof worldState==="undefined"||!worldState||!key)return false;
  worldState.layoutAskArmed=(typeof locResolve==="function")?locResolve(key):key;return true;
}
/* #408 ② the Table Talk offer: after an answer, offer "ask the GM to record this place's layout" as one click — decided
   from the PLAYER's own question (a spatial word), never by sniffing the model's answer (ruling ③'s principle: the
   player's words are the authoritative side). Pure: {key,label} when the place exists and holds no record, else null. */
var LAYOUT_SPATIAL_RE=/\b(room|rooms|floor ?plan|layout|kitchen|cellar|attic|loft|stair|stairs|upstairs|downstairs|door|doors|window|windows|hall|hallway|corridor|pantry|how (?:big|large|many rooms)|where (?:is|are) the)\b/i;
function layoutAskOfferFor(question,key){
  var q=String(question==null?"":question);if(!q.trim()||!key)return null;
  if(typeof memory==="undefined"||!memory||!memory.map)return null;
  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk];
  if(!node||node.layout)return null;
  if(!LAYOUT_SPATIAL_RE.test(q))return null;
  return {key:rk,label:(typeof locDisplayLeaf==="function")?locDisplayLeaf(rk):rk};
}
/* #431 (owner 2026-09-21): what lies at the CURRENT node, as ONE readout for the turn's summary line —
   "Here: Folding camp stove, Rope ×2 (main room)". Every kind: placed items live on every map node (fileLocationItem
   keys by the current node), so the line works in an adventure's tavern as in the village house. Rows the party took
   (adventure toggle) or emptied (village qty 0) are excluded; "" when nothing lies here. This REPLACES the side panel's
   "Your house" group (#6 E8, villageHouseGroup — deleted): the readout rides the info chunk beside "Present:", the
   panel keeps only the counter/chest/design rows. It is a UI line only — never the transcript, never the prompt. */
/* #452 (owner 2026-09-24): the turn's summary line links each PRESENT name to its sheet. Pure: takes the summary
   lines, returns the HTML addMsg renders. Only a "Present:" line changes, and only a name the roster or memory
   knows becomes a link — an unknown name stays text; every other line is escaped exactly as before (the #431 byte
   pins hold). The link is a data-npc span (audit E69: never a name inside an inline onclick); ui-shell.js binds ONE
   delegated click on the story pane (wireSummaryNpcLinks). */
/* #481 A7 (audit 2026-09-29, Fable-approved): a mutation line that did NOT land as written — refused, ignored, withheld or
   kept — starts with "⚠ " where it is WRITTEN (tag_table.js, identity.js, api.js; the "#481 A7 source" test lints every
   push). Everything that sorts refusals from receipts keys on that leading glyph through this one predicate, never on
   the words: the summary renderer, the chest, the counter, the undo and the sheet sync. A ⚠ inside a receipt
   ("+Rope (⚠ count clamped …)") is not a refusal. */
var MUT_WARN_GLYPH="⚠ ";
function mutLineWarns(line){return line!=null&&String(line).indexOf(MUT_WARN_GLYPH)===0;}
function summaryLineHTML(lines){
  var out=[],i;
  for(i=0;i<lines.length;i++){
    var line=String(lines[i]);
    if(mutLineWarns(line)){out.push("<span class=\"sum-warn\">"+escHtml(line)+"</span>");continue;}/* #481 A7: only a glyph line changes */
    if(line.indexOf("Present: ")!==0){out.push(escHtml(line));continue;}
    var labels=line.slice(9).split(", "),parts=[],j;
    for(j=0;j<labels.length;j++){
      var lab=labels[j],m=lab.match(/^(.*?)( \([^()]*\))?$/),nm=m?m[1]:lab,suf=(m&&m[2])||"";
      var known=!!((typeof wsNpcByName==="function"&&wsNpcByName(nm))||(typeof memory!=="undefined"&&memory&&memory.npcs&&memory.npcs[nm]));
      parts.push(known?"<span class=\"sum-npc\" data-npc=\""+escHtml(nm)+"\">"+escHtml(nm)+"</span>"+escHtml(suf):escHtml(lab));
    }
    out.push("Present: "+parts.join(", "));
  }
  return out.join(" | ");
}
function hereItemsLine(){
  if(typeof worldState==="undefined"||!worldState||!worldState.world||typeof memory==="undefined"||!memory||!memory.map||!memory.map.nodes)return "";
  var key=(typeof currentNodeKey==="function")?currentNodeKey():null;if(!key)return "";
  var rk=(typeof locResolve==="function")?locResolve(key):key,node=memory.map.nodes[rk];
  if(!node||!node.items||!node.items.length)return "";
  var parts=[],units=0,i;
  for(i=0;i<node.items.length;i++){var it=node.items[i];if(!it||!it.name||it.taken||it.qty===0)continue;units+=(it.qty>1?it.qty:1);parts.push(it.name+(it.qty>1?" ×"+it.qty:"")+(it.room?" ("+it.room+")":""));}
  if(!parts.length)return "";
  /* #432 (owner 2026-09-21): the chest holds a LOT — ONE entry with the count, never the contents (the chest modal lists
     them). #481 A6 (ruled 2026-09-29): decided by the NODE, not the kind — only the hero's OWN house has a chest the
     hero opens (stashTradeCatalog's gate), so only there does a container show by name with its count; the Hall, a shop
     and another resident's house name what lies there, as an adventure always has. No container model yet. */
  var hero=worldState.character&&worldState.character.name;
  if(node.owner&&hero&&node.owner===hero)return "Here: chest ("+units+" item"+(units===1?"":"s")+")";
  return "Here: "+parts.join(", ");
}
/* #6 G: the Hall's node key — one place, one key. */
function villageHallKey(base){var v=base||(typeof worldState!=="undefined"&&worldState&&worldState.world&&worldState.world.location)||"The Village";return v+"|the Village Hall";}
/* #6 D3: the commons a resident may be found in — the map's filed shops first (the GM's own geography), then the kind's
   fallback list; leaf names, deduped, in a stable order. */
function villageCommons(){
  var def=(typeof kindDef==="function")?kindDef():null,out=[],seen={},k;if(!def)return out;
  var v=(typeof worldState!=="undefined"&&worldState&&worldState.world&&worldState.world.location)||"The Village";
  function add(x){var s=String(x||"").trim();if(!s)return;var low=s.toLowerCase();if(seen[low])return;seen[low]=1;out.push(s);}
  if(typeof memory!=="undefined"&&memory&&memory.map){var keys=Object.keys(memory.map.nodes).sort();for(k=0;k<keys.length;k++){var n=memory.map.nodes[keys[k]];if(n&&n.parent&&(typeof locSame==="function"?locSame(n.parent,v):n.parent===v)&&isShopNode(keys[k],n))add(typeof locDisplayLeaf==="function"?locDisplayLeaf(keys[k]):keys[k].split("|").pop());}}
  (def.commons||[]).forEach(add);
  return out;
}
/* #6 D3: residents ROAM (owner, 2026-09-12). Pure and deterministic over the name and the campaign clock: at home through the
   night, otherwise a commons chosen by a name hash and the three-hour block, so the same resident is in the same place for a
   while and somewhere else later. A whereabouts line, not a presence stamp — the story places them with tags. */
/* #481 B6 (audit 2026-09-29, Fable-approved): the ONE open-at-the-hour predicate — the geo block's OPEN/CLOSED line and the
   residents' whereabouts both read it. null = no hours on record (read as open). Overnight ranges (20-4) wrap. Pure. */
function nodeOpenAtHour(node,hr){if(!node||!node.hours)return null;var h=node.hours;return (h.open<=h.close)?(hr>=h.open&&hr<h.close):(hr>=h.open||hr<h.close);}
/* #481 B4: is this shop open NOW? Its hours at the clock's hour (nodeOpenAtHour, the one predicate); a place with no hours on
   record — none filed yet, or [LOCATION_HOURS:none] — counts as open, so a keeper of record is never lost to a missing record. */
function shopOpenNow(node){
  if(!node||!node.hours||typeof clockMinuteOfDay!=="function")return true;
  return nodeOpenAtHour(node,Math.floor(clockMinuteOfDay()/60))!==false;
}
/* #481 B6: ONE renderer for a resident's whereabouts — "<name> is at home" / "<name> is at <place>". The RESIDENTS note used to
   join a name and a place with a bare "is" ("Thessa Saltborn is the animal handler's yard"). Serves RESIDENTS ABOUT, the
   RETURN change, the whispers facts and the Car Mode recap. */
function residentWhereText(name,wh){if(!wh)return "";return name+" is "+(wh.home?"at home":"at "+wh.place);}
/* #481 B6: the ONE leading-travel parse — validateSuggestion's rule ⑦ and the RESIDENTS note's travel wait both read it.
   Returns the named destination, or null. Pure. */
function travelActionTarget(t){var m=String(t==null?"":t).match(/^\s*(?:press on (?:toward|to)|head (?:back )?(?:to|for|toward|towards)|travel (?:back )?to|return to|go back to|set out (?:for|toward|towards)|ride (?:back )?(?:to|toward|towards)|march (?:to|toward|towards)|journey (?:to|toward|towards)|make for)\s+(.+)$/i);return m?m[1]:null;}
function residentWhereabouts(name,min){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.roam)return null;
  var m=(typeof min==="number")?min:((typeof clockNow==="function")?clockNow():0),day=(typeof MIN_PER_DAY==="number")?MIN_PER_DAY:1440;
  /* the campaign clock counts ELAPSED minutes and clock%day==0 is dawn (clock.js #89/#106b): the hour of day comes from
     clockMinuteOfDay (#409, the ONE reader); the inline form survives only for a load order where clock.js is absent */
  var dawn=(typeof DAWN_OFFSET_MIN==="number")?DAWN_OFFSET_MIN:360,hour=Math.floor(((typeof clockMinuteOfDay==="function")?clockMinuteOfDay(m):((((m%day)+day)%day+dawn)%day))/60);
  if(hour>=22||hour<6)return {place:null,home:true};
  /* #481 B6: a commons CLOSED at the hour is nobody's whereabouts (Nyla "in the tavern" at 7:40, its hours 10-24) */
  var v=(typeof worldState!=="undefined"&&worldState&&worldState.world&&worldState.world.location)||"The Village";
  var list=villageCommons().filter(function(c){var nd=(typeof memory!=="undefined"&&memory&&memory.map)?memory.map.nodes[(typeof locResolve==="function")?locResolve(v+"|"+c):v+"|"+c]:null;return nodeOpenAtHour(nd,hour)!==false;});
  if(!list.length)return {place:null,home:true};
  var h=0,s=String(name||""),i;for(i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return {place:list[(h+Math.floor(hour/3))%list.length],home:false};
}
/* #6 G4: the File-menu row shows for an open, closable campaign with at least one turn behind it. */
function closeMenuVisible(){var def=(typeof kindDef==="function")?kindDef():null;return !!(typeof worldState!=="undefined"&&worldState&&def&&def.closable&&!campaignEnded()&&(worldState.turn||0)>=1);}
/* #6 C3: Car Mode speaks STATE in the village — who you are, where, the day and hour, the purse, the house, who is about. */
function villageRecapText(){
  var ws=worldState,c=ws.character||{},v=(ws.world&&ws.world.location)||"The Village",sub=ws.world&&ws.world.sublocation;
  var dn=(typeof clockDayNumber==="function")?clockDayNumber():1,tod=(typeof clockTimeOfDay==="function")?clockTimeOfDay():"";/* the ONE player-facing stamp, same as the caption */
  var s="You are "+(c.name||"the hero")+", in "+v+(sub?", at "+sub:"")+". Day "+dn+(tod?", "+tod:"")+". "+(c.gold||0)+" gold.";
  var st=(typeof villageStash==="function")?villageStash(villageHouseKey(c.name)):[];
  s+=st.length?" Your house holds "+st.map(function(r){return r.name+(r.qty>1?", "+r.qty+" of them":"");}).join("; ")+".":" Your house holds nothing.";
  var about=[],i,npcs=ws.npcs||[];for(i=0;i<npcs.length&&about.length<3;i++){var n=npcs[i];if(!n.resident||(typeof npcIsDead==="function"&&npcIsDead(n)))continue;var w=residentWhereabouts(n.name);if(w&&!(typeof scenePresentNow==="function"&&scenePresentNow(n.name)))about.push(residentWhereText(n.name,w));/* #481 B6: one renderer; nobody in the scene gets whereabouts */}
  if(about.length)s+=" About the village: "+about.join("; ")+".";
  return s;
}
/* #6 E10 (owner, 2026-09-13): a house is a SUB-LOCATION with ONE key. The GM writes "Ammut's home", "the cottage of Frizwick",
   "my house"; the engine keys the house as <Owner>'s house. Returns the owner's exact name when a sub-location name is a
   house of the hero or a living resident, else null. Village only; the adventure never rewrites a name. */
function villageHouseOwnerFor(subName){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.stashQuantities||typeof worldState==="undefined"||!worldState)return null;
  var s=String(subName||"").toLowerCase().replace(/[’]/g,"'").trim();if(!/\b(house|home|cottage|hut|manor|quarters|lodgings|place)\b/.test(s))return null;
  var names=[],i;if(worldState.character&&worldState.character.name)names.push(worldState.character.name);
  var npcs=worldState.npcs||[];for(i=0;i<npcs.length;i++)if(npcs[i].resident&&!(typeof npcIsDead==="function"&&npcIsDead(npcs[i])))names.push(npcs[i].name);
  if(/^(my|your|own|the hero's)\b/.test(s)||/\b(my|your)\s+(own\s+)?(house|home|cottage|hut|manor|quarters|lodgings|place)\b/.test(s))return names[0]||null;
  /* #482 (found building #481 A7): a name owns a house as the WHOLE name (word-bounded, a leading article optional) or as
     one of its own words in a NAME position — a possessive ("Maud's cottage", "Daeris' house") or after "of" ("the cottage
     of Frizwick"). A bare word is never enough: the first-word rule let "The Entity" own every "the … house" (the well
     house, the market place — and "the cottage of Frizwick", the longest match winning), and "Old Maud" "the old house".
     A whole-name match outranks a word match; within a class the longer name wins. */
  function esc(x){return x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
  var best=null,bestScore=-1,j;
  for(i=0;i<names.length;i++){var full=String(names[i]).toLowerCase().replace(/[’]/g,"'").trim(),bare=full.replace(/^(the|a|an)\s+/,""),hit=0;
    if(new RegExp("(^|[^a-z0-9])(?:"+esc(full)+"|"+esc(bare)+")(?![a-z0-9])").test(s))hit=2;
    else{var toks=bare.split(/\s+/);for(j=0;j<toks.length&&!hit;j++){if(toks[j].length<2)continue;var e=esc(toks[j]);
      if(new RegExp("(^|[^a-z0-9])"+e+"'(?:s(?![a-z0-9])|\\s|$)").test(s)||new RegExp("(^|[^a-z0-9])of\\s+(?:the\\s+)?"+e+"(?![a-z0-9])").test(s))hit=1;}}
    if(hit&&hit*1000+full.length>bestScore){bestScore=hit*1000+full.length;best=names[i];}}
  return best;
}
/* #6 E11 (owner, 2026-09-13): the commons are pre-minted, and a GM naming that carries a commons word folds into the
   pre-minted node — "tavern common room" is the tavern, "the alchemist's shop with the green door" is the alchemist's —
   so wares, hours and presence keep ONE node per shop. Returns the commons leaf or null. Village only. */
function villageCommonFor(subName){
  var def=(typeof kindDef==="function")?kindDef():null;if(!def||!def.commons||typeof worldState==="undefined"||!worldState||!memory||!memory.map)return null;
  var s=String(subName||"").toLowerCase().replace(/[’]/g,"'"),v=(worldState.world&&worldState.world.location)||"The Village",i;
  for(i=0;i<def.commons.length;i++){var leaf=def.commons[i];if(!memory.map.nodes[v+"|"+leaf])continue;if(s===leaf.toLowerCase())return leaf;
    var stem=leaf.toLowerCase().replace(/^the\s+/,"").replace(/'s$/,"").replace(/'s\s+\w+$/,"");/* the tavern → tavern; the alchemist's → alchemist; the animal handler's yard → animal handler */
    if(stem&&new RegExp("\\b"+stem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(s))return leaf;}
  return null;
}
function villageHouseKey(name,base){var v=base||(typeof worldState!=="undefined"&&worldState&&worldState.world&&worldState.world.location)||"The Village";return v+"|"+String(name||"").trim()+"'s house";}

// #458 (owner ask 2026-09-25): the ONE shape gate for a SAY mood — the optional |mood field of [SAY:Name|mood], HOW a
// line is spoken. A short phrase only: letters, spaces, commas and hyphens, at most SAY_MOOD_MAX characters after
// whitespace is collapsed. Anything else (a sentence, digits, quotes, brackets, a colon, a pipe) returns "" — the caller
// drops the mood and says so in the console; the speaker binding is never at stake. Pure; shared by the deriver
// (deriveSpeakerMapFromTags, game.js) and the request builder (_markupGroup, tts.js — re-checked at send time so nothing
// hand-edited into a save reaches a provider). Hyphens admitted at build ("matter-of-fact", "sing-song").
var SAY_MOOD_MAX=40;
/* #477 (owner 2026-09-28, Village t198): Thessa's [SAY:…|speaking carefully] reached Inworld as "[speak speaking carefully]"
   and the model paced her like a dirge; her next line ("sound amused") was fine. A mood that names a MANNER OF SPEAKING is
   a stage direction, not a feeling: the speech verb is dropped, a bare pacing phrase is dropped (the model over-renders
   pace), a feeling passes, and volume (whisper, shout, softly) stays because the model renders it well. Pure; the Inworld
   prefix (tts.js _markupPrefix) routes every non-sound part through it. The doc may still teach "slow and measured" —
   other readers render pace sanely; this is the one boundary where it does harm. */
var SAY_SPEECH_VERB_RE=/^(speak|speaking|speaks|say|saying|says|sound|sounding|sounds|talk|talking|talks|tell|telling|tells|voice|voiced|tone|toned|reply|replying|replies|answer|answering|answers|add|adding|adds|note|noting|notes|remark|remarking|remarks|observe|observing|observes)\b\s*/i;
var SAY_PACING_RE=/^(careful|carefully|slow|slowly|deliberate|deliberately|halting|haltingly|measured|even|evenly|flat|flatly|clipped|precise|precisely|methodical|methodically|pointed|pointedly|hesitant|hesitantly|hesitating|steady|steadily|unhurried|unhurriedly|thoughtful|thoughtfully|paced|pacing|slow and measured|slow and steady|slow and careful|slow and deliberate)$/i;
function sayMoodSteer(part){
  var p=String(part||"").replace(/\s+/g," ").replace(/^\s+|\s+$/g,"");
  p=p.replace(SAY_SPEECH_VERB_RE,"");
  if(!p||SAY_PACING_RE.test(p))return "";
  return p;
}
/* #481 C4 (audit 2026-09-29, Fable-approved): the ONE skeleton title key — the prompt SHOWS acts and arcs as "Act 1: title" /
   "Arc 3: title", and the GM's close tag may drop the numbering (the Necrotic act closed 8 turns late) or copy it (a fae arc
   was ignored). A leading "Act|Arc <n>" with its separator, and case, are not part of the identity. Pure. */
function skeletonTitleKey(t){return String(t==null?"":t).trim().replace(/^(?:act|arc)\s*\d+\s*[:.\-–—]\s*/i,"").trim().toLowerCase();}
function sayMoodShape(raw){
  var s=String(raw==null?"":raw).replace(/\s+/g," ").replace(/^\s+|\s+$/g,"");
  /* #481 E1 (audit 2026-09-29, Fable-approved): since t202 the GM writes a LABEL in front of the mood — "mood:bright, giggle" —
     and the colon failed the shape, so every mood (and every laugh, giggle and sigh) was dropped. The label is stripped
     BEFORE the cap and the shape test; everything else the #458 gate refuses stays refused. */
  s=s.replace(/^(?:mood|emotion|tone)\s*[:=]\s*/i,"");
  if(!s||s.length>SAY_MOOD_MAX)return "";
  return /^[A-Za-z][A-Za-z ,-]*$/.test(s)?s:"";
}

// #460 ① (owner 2026-09-25, village Nyla "still isn't coming through"): a sheeted resident's GM-written mood is kept to
// what they are DOING — the sheet plays their disposition. Comma-separated parts survive when they read as an activity
// (a present participle: "sorting dried goods", "watching the door") or a place ("at the market with her basket");
// bare disposition words ("pleasant", "cheerful, warm") are dropped by the tag handler, loudly. A proxy, not a judge:
// an adjective ending in -ing ("charming") passes as a doing — accepted, recorded on the row.
var MOOD_PLACE_RE=/^(?:at|in|on|by|with|behind|before|beside|near|under|over|inside|outside|out|up|down|to|from|among|beneath|atop|toward|towards|about|around|through|across|against|along|between|into|onto|upon|off|back|away|home|abroad|alone)\b/i;
/* #506 (owner ruling 2026-10-01): a CONDITION is not a disposition. Where the kind says so (moodConditions: the adventure, never
   the Village) a part that names one of these survives beside the doing words — "terrified, captured by the slavers" keeps
   "captured by the slavers" — so the roster tells the GM a sheeted character is unconscious or held, and it cannot play them
   free the next turn. ONE list; each entry is a regex source ("sick of your excuses" is a disposition, so "sick" refuses "of"). */
var MOOD_CONDITION_WORDS=["unconscious","comatose","asleep","captured","captive","hostage","prisoner","imprisoned","bound","restrained","chained","wounded","injured","poisoned","sick(?!\\s+of\\b)","missing","fled","petrified","paralyzed","paralysed"];
var MOOD_CONDITION_RE=new RegExp("\\b(?:"+MOOD_CONDITION_WORDS.join("|")+")\\b","i");
function moodDoingOnly(mood,keepConditions){
  var parts=String(mood||"").split(/[,;]/),out=[],i,p;
  for(i=0;i<parts.length;i++){p=parts[i].replace(/^\s+|\s+$/g,"");if(!p)continue;
    if(/\b[a-z]{2,}ing\b/i.test(p)||MOOD_PLACE_RE.test(p)||(keepConditions&&MOOD_CONDITION_RE.test(p)))out.push(p);}
  return out.join(", ");
}
// #460 ①: does the SHEET lead this character's entry? A present-or-absent non-party resident with a sheet trait — the
// roster leads with "plays as", and the memory attitude line (the summariser's slower, GM-fed reading) is omitted in the
// NPC detail and the graph node, so one clause from the sheet no longer loses to a hundred remembered lines.
function sheetTraitLeads(name){
  var n=(typeof wsNpcByName==="function")?wsNpcByName(name):null;
  return !!(n&&!n.partyMember&&n.charSheet&&typeof n.charSheet.trait==="string"&&n.charSheet.trait.trim());
}
