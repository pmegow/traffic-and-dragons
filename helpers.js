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
// AUDIT_FABLE_07_16 #6: THE party-companion scan — partyMember NPCs that carry a charSheet, in
// worldState.npcs order. includeDead=true skips the dead filter: a handful of call sites
// (restSpells, the [XP:] mirror, syncCharSheet, and the snapshot/consume passes) historically
// had NO dead check — each routes through includeDead=true with a marker comment, preserving
// today's behavior until the user rules on whether dead companions earn XP/rest/audit.
function partyCompanionsWithSheets(includeDead){
  var out=[],ns=(typeof worldState!=="undefined"&&worldState&&worldState.npcs)||[],i;
  for(i=0;i<ns.length;i++){var n=ns[i];if(n&&n.partyMember&&n.charSheet&&(includeDead||!/\bdead\b/i.test(n.status||"")))out.push(n);}
  return out;
}
// Living party companions — partyMember NPCs that carry a charSheet and are not dead. The party-aware
// scene render iterates this to describe (all models) and seed portraits (Nano Banana 2 only). Returns
// the worldState.npcs entries; charSheet holds the v10 sheet, npcPortrait() the image.
function livingPartyCompanions(){return partyCompanionsWithSheets(false);}
function droll(s){return Math.floor(Math.random()*s)+1;}
function r4d6(){var d=[droll(6),droll(6),droll(6),droll(6)];d.sort(function(a,b){return a-b;});return d[1]+d[2]+d[3];}
function getFin(){
  var b={STR:cs.bs.STR,DEX:cs.bs.DEX,CON:cs.bs.CON,INT:cs.bs.INT,WIS:cs.bs.WIS,CHA:cs.bs.CHA};
  var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}
  if(!a)return b;
  if(a.fc>0){for(i=0;i<cs.fp.length;i++){b[cs.fp[i]]=(b[cs.fp[i]]||8)+1;}}
  else{var keys=Object.keys(a.stats);for(i=0;i<keys.length;i++){b[keys[i]]=(b[keys[i]]||8)+a.stats[keys[i]];}}
  return b;
}
function getMHP(){var i,c=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===cs.cls){c=CLSS[i];break;}}if(!c)return 8;return c.hd+Math.floor((getFin().CON-10)/2);}
function pbSp(){var t=0,i;for(i=0;i<STATS.length;i++){t+=(PBC[cs.bs[STATS[i]]]||0);}return t;}
function getToneNm(){if(!cs.tone)return"Unspecified";if(cs.tone==="custom")return"Custom";var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].nm;}return"Unspecified";}
function getToneVc(){if(!cs.tone)return"";if(cs.tone==="custom"){var el=document.getElementById("tone-ct");return el?el.value.trim():"";}var i;for(i=0;i<TONES.length;i++){if(TONES[i].id===cs.tone)return TONES[i].vc;}return"";}
function getSubNm(){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a||!a.subraces)return"";var j,k;for(j=0;j<a.subraces.length;j++){if(a.subraces[j].id===cs.subrace){if(cs.heritageVariant&&a.subraces[j].lineages){for(k=0;k<a.subraces[j].lineages.length;k++){if(a.subraces[j].lineages[k].id===cs.heritageVariant)return a.subraces[j].lineages[k].nm;}}return a.subraces[j].nm;}}return"";}
function getLvl(xp){var i,l=1;for(i=1;i<XP_LEVELS.length;i++){if(xp>=XP_LEVELS[i])l=i+1;else break;}return Math.min(l,10);}
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
  return w.sublocation?w.location+"|"+w.sublocation:w.location;
}
// Party cap helpers (PARTY_MAX total = players + companions). playerCount is 1 today; multiplayer (#1) will make it dynamic.
function partyCompanionCap(){return PARTY_MAX-1;}
function partyCompanionCount(){if(!worldState||!worldState.npcs)return 0;var n=0,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].partyMember&&!/\bdead\b/i.test(worldState.npcs[i].status||""))n++;}return n;}
// TODO #1 P1 (multiplayer, D8): players = the hero (unless explicitly demoted via isPC===false —
// no UI for that until P3's all-NPC rounds exist) + every living party member flagged isPC. Absent
// flags = exactly 1: the single-player invariant every existing save relies on (DOC_multiplayer
// "activePlayer() migration" anchor). Same dead-filter as partyCompanionCount above.
function playerCount(){
  var n=(worldState&&worldState.character&&worldState.character.isPC===false)?0:1;
  if(worldState&&worldState.npcs){var i;for(i=0;i<worldState.npcs.length;i++){var p=worldState.npcs[i];if(p&&p.partyMember&&p.isPC&&!/\bdead\b/i.test(p.status||""))n++;}}
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
        if(p.partyMember&&p.isPC&&p.charSheet&&!/\bdead\b/i.test(p.status||""))return p.charSheet;
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
    if(p&&p.name===nm&&p.partyMember&&p.isPC&&p.charSheet&&!/\bdead\b/i.test(p.status||""))
      {worldState.activePC=nm;return true;}}}
  console.warn("[multiplayer] setActivePC('"+nm+"') rejected — not a living PC party member with a sheet");
  return false;
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
// bibleCardHTML (TODO #10) — the shared capability-card renderer. Pure: name + bible entry in,
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
function sttCorrectNames(text,roster){
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
        if(typeof console!=="undefined")console.info("[stt] name-corrected: \""+w1+" "+w2+"\" → "+bg.word);
        continue;
      }
    }
    if(w1.length<3)continue;                                       // too short to judge alone
    if(STT_COMMON[w1.toLowerCase()])continue;                      // a common word the player said is (almost) never a mangled name
    var sg=best(w1);
    if(sg){
      toks[i]=subst(toks[i],sg.word);
      if(typeof console!=="undefined")console.info("[stt] name-corrected: \""+w1+"\" → "+sg.word);
    }
  }
  return toks.join("").replace(/\s{2,}/g," ");
}
