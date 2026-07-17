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
function pval(si,ci){var s=document.getElementById(si);if(!s)return"";if(s.value==="custom"){var c=document.getElementById(ci);return c?c.value.trim():"";}return s.value;}
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
