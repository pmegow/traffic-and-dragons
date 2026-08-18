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
// #163b: fal.ai failures carry the REAL complaint in the response body ({detail:[{loc,msg}]}
// validation arrays, or a detail string) — the old bare "fal.ai HTTP 422" cost a live round
// trip to learn WHICH field failed (the bare loras[].path id). Pure string builder so it's
// engine-testable; the three fal fetch sites await res.text() and route through here.
// Clamped + whitespace-collapsed: this lands in one-line status displays, not logs.
function falErrorMsg(status,bodyText){
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
    vm=tail.match(/^([^.!?;]{0,45}?)(?:(?:stay(?:s|ing)|remain(?:s|ing)|wait(?:s|ing))[\s,]+(?:behind|here|there|put|at\b|outside|below|above|by\b)|hang(?:s|ing)?\s+back|keep(?:s|ing)?\s+watch|left\s+behind|isn['’]?t\s+coming|is\s+not\s+coming|not\s+coming\s+(?:along|down|inside)|leaves|left|depart(?:s|ed)|is\s+gone|(?:rides|rode)\s+ahead|heads\s+back|goes\s+ahead)/i);
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
function detectPartyAbsenceCorrection(text,partyNames){
  var t=String(text||"");if(!/^\s*(?:GM|OOC)\s*:/i.test(t)||!partyNames||!partyNames.length)return null;
  var hits=_partyNameHits(t,partyNames),i,h,tail;
  for(i=0;i<hits.length;i++){
    h=hits[i];if(/^['’]s\b/i.test(t.slice(h.end)))continue;tail=t.slice(h.end,h.end+80);
    if(/^\s+(?:(?:(?:is|was)\s+(?:(?:currently\s+)?not|not\s+currently|no\s+longer)|isn['’]?t|wasn['’]?t)\s+(?:with\s+(?:us|the\s+party)|here\b|present\b|in\s+this\s+scene\b)|(?:is|was)\s+absent\b)/i.test(tail))return h.name;
  }
  return null;
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
var _classDefsArr=null;
function classDefs(){
  if(_classDefsArr)return _classDefsArr;
  _classDefsArr=[];var k;for(k in CLASS_BIBLE)_classDefsArr.push(CLASS_BIBLE[k]);
  return _classDefsArr;
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
  return w.sublocation?w.location+"|"+w.sublocation:w.location;
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
// flags = exactly 1: the single-player invariant every existing save relies on (DOC_multiplayer
// "activePlayer() migration" anchor). Same dead-filter as partyCompanionCount above.
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
function itemBaseName(nm){
  var s=String(nm||"");
  s=s.replace(/\s+x\d+\s*$/i,"");        // trailing count: "… x6"
  var cut=s.search(/\s+[—–-]\s+/);        // first spaced dash begins the provenance clause
  if(cut>=0)s=s.slice(0,cut);
  s=s.replace(/\s*\(.*\)/,"");           // parenthetical provenance (the capBaseName pattern)
  s=s.replace(/\s+x\d+\s*$/i,"");        // count that sat before a stripped clause
  return s.toLowerCase().replace(/\s+/g," ").trim();
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
function itemLookup(nm){
  var key=itemBaseName(nm);
  if(!key)return null;
  if(typeof worldState!=="undefined"&&worldState&&worldState.itemBible&&worldState.itemBible[key])return worldState.itemBible[key];
  if(typeof ITEM_BIBLE!=="undefined"&&ITEM_BIBLE[key])return ITEM_BIBLE[key];
  var canon=_itemAliasIndex()[key];
  if(!canon)return null;
  if(typeof worldState!=="undefined"&&worldState&&worldState.itemBible&&worldState.itemBible[canon])return worldState.itemBible[canon];
  return (typeof ITEM_BIBLE!=="undefined"&&ITEM_BIBLE[canon])||null;
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
// Player verdicts on [ITEM_DEF:] proposals — the ONLY writers of worldState.itemBible (#81).
// Pure state ops (no DOM) so the confirm modal stays a thin veneer and the flow is engine-
// testable. Accept = write-once overlay entry (an existing key refuses — the SPELL_DEF rule);
// decline = dropped LOUDLY. Both remove the pending record; both return true only on action.
function itemDefAccept(key){
  if(typeof worldState==="undefined"||!worldState||!worldState.pendingItemDefs)return false;
  var i,p=null;
  for(i=0;i<worldState.pendingItemDefs.length;i++){if(worldState.pendingItemDefs[i].key===key){p=worldState.pendingItemDefs[i];break;}}
  if(!p)return false;
  worldState.pendingItemDefs.splice(i,1);
  if(!worldState.itemBible)worldState.itemBible={};
  if(worldState.itemBible[key]){if(typeof console!=="undefined")console.warn("[items] accept refused — '"+key+"' already canon (write-once, #81)");return false;}
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
function healthIndicators(ws){
  var items=[],i,j;
  function push(id,label,level,detail){items.push({id:id,label:label,level:level,detail:detail});}
  if(!ws)return {overall:"na",items:items};
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
  // ② prompt cache — the #11 killer: a perturbed stable half silently pays full price every
  // turn. Judged for Anthropic only (its input count EXCLUDES cached tokens, so cr/(cr+in)
  // is a real hit ratio; the OpenAI shape INCLUDES them and cannot be judged this way).
  var cs=[];
  for(i=hl.length-1;i>=0&&cs.length<6;i--){var he=hl[i];if(he.prov==="anthropic"&&((he.in||0)+(he.cr||0))>1000)cs.push(he);}
  if(cs.length<2)push("cache","Prompt cache","na","not enough Anthropic gameplay calls to judge");
  else{
    var dead=0,low=0;
    for(i=0;i<cs.length;i++){var ratio=(cs[i].cr||0)/((cs[i].cr||0)+(cs[i].in||0));if((cs[i].cr||0)===0)dead++;if(ratio<0.2)low++;}
    push("cache","Prompt cache",dead>=3?"bad":(low>cs.length/2?"warn":"ok"),
      dead>=3?dead+" recent turns read ZERO cached tokens — the stable half is not caching; every turn pays full input price":"cache reads healthy on recent turns");
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
  if(legacyN)anom.push(legacyN+" death authorization"+(legacyN>1?"s":"")+" rode legacy-grade (pre-epoch) evidence — the #194 fail-open window, shrinking as characters are re-witnessed");
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
    transport:{bad:"Heavy provider load-shedding — most turns need retries. Consider switching model for this session; report if it continues.",
               warn:"The AI provider is shedding load — turns retry and feel slower. Usually clears on its own; report if it lasts all session."}
  };
  for(i=0;i<items.length;i++){var hh=HINTS[items[i].id];if(hh&&hh[items[i].level])items[i].hint=hh[items[i].level];}
  var rank={ok:0,warn:1,bad:2},worst="ok",any=false;
  for(i=0;i<items.length;i++){var lv=items[i].level;if(lv==="na")continue;any=true;if(rank[lv]>rank[worst])worst=lv;}
  return {overall:any?worst:"na",items:items};
}
