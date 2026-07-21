// ui-sheets.js — character/NPC sheet rendering (csSheetSections: one renderer, three hosts),
// sheet actions (drop item, reject epithet, part ways, play-as swap), capability card,
// NPC sheet generation, read-only library sheet viewer.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).

// E60/UA22 (v1.326): ONE offset-resolution rule for both sheet avatars. The copy-pasta pair
// meant the E60 fallback (sheet-carried framing survives a PC↔companion swap) existed only on
// the NPC side — fixes kept landing on one side. char is the sheet object (worldState.character
// for the PC, wsNpc.charSheet for a companion); ownerNpc is the worldState.npcs entry when one
// exists (companions), null for the PC. No behavior delta for today's PC saves
// (character.portraitOffset is the PC's only home) — the divergence CLASS is what dies here.
function sheetOffsetGet(ownerNpc,char){
  return (ownerNpc&&ownerNpc.portraitOffset)||(char&&char.portraitOffset)||{x:0.5,y:0.5,zoom:1};
}
// ── Shared character-sheet helpers ────────────────────────────────────────────
function csSec(title,body){return'<div class="cs-sec"><div class="cs-sec-hd cs-sec-tog" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">'+title+'<span class="cs-tog-arr" style="font-size:10px;color:var(--t2);flex-shrink:0;margin-left:8px;">&#9654;</span></div><div class="cs-sec-body" style="display:none;">'+body+'</div></div>';}
function csKv(k,v){return'<div class="cs-kv"><span class="cs-k">'+k+'</span><span class="cs-v">'+v+'</span></div>';}
// csInitials moved to helpers.js (#15③) — canonical home, loads before every consumer.
function csHeroHeader(c){
  var genderLbl=genderLabel(c.gender);/* #11③: shared mapping */
  var subnm=c.subraceNm?c.subraceNm+" ":"";
  var clsLine=escHtml(subnm+(c.ancestry||"")+" "+(c.cls||"")+(c.archetypeNm?" ["+c.archetypeNm+"]":""));/* companion sheets are model-generated (#22/UA18) */
  var lvl=c.level||1,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
  var xpPct=lvl>=10?100:Math.max(0,Math.min(100,Math.round((((c.xp||0)-prevXP)/Math.max(1,nextXP-prevXP))*100)));// low clamp: xp below the level floor rendered width:-N% — invalid CSS, dropped, div defaulted to FULL (the Morwen full-bar lie)
  return {genderLbl:genderLbl,clsLine:clsLine,lvl:lvl,nextXP:nextXP,xpPct:xpPct};
}
// #50 QOL: drop an inventory item from a live sheet. owner ""=player, else companion name.
// Native confirm guards the misclick; the drop is a player edit (like the Sync modal), saved
// and synced immediately, and the sheet re-renders in place.
function dropInvItem(owner,idx,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  idx=parseInt(idx,10);if(isNaN(idx)||!worldState)return;
  var inv=null,i;
  if(owner===""){inv=worldState.character&&worldState.character.inventory;}
  else{for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];if(n&&n.name===owner&&n.charSheet){inv=n.charSheet.inventory;break;}}}
  if(!inv||idx<0||idx>=inv.length)return;
  var nm=inv[idx];
  if(!window.confirm('Drop "'+nm+'"?'))return;
  inv.splice(idx,1);saveAll();
  if(typeof showToast==="function")showToast("Dropped: "+nm);
  if(owner===""){var ex=document.getElementById("cs-modal");if(ex){ex.remove();showCharSheet();}if(typeof updateInvPanel==="function")updateInvPanel();}
  else{var ex2=document.getElementById("npc-modal");if(ex2){ex2.remove();showNpcSheet(owner);}}
}
// #47 policy (user ruling 2026-07-12): epithets are GM-granted only, but the PLAYER may reject
// one — the × beside each "Also known as" entry on live sheets. Same owner-routing as dropInvItem.
function rejectEpithet(owner,idx,ev){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  idx=parseInt(idx,10);if(isNaN(idx)||!worldState)return;
  var al=null,i;
  if(owner===""){al=worldState.character&&worldState.character.aliases;}
  else{for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];if(n&&n.name===owner&&n.charSheet){al=n.charSheet.aliases;break;}}}
  if(!al||idx<0||idx>=al.length)return;
  var nm=al[idx];
  if(!window.confirm('Reject the epithet "'+nm+'"? The GM will stop using it.'))return;
  al.splice(idx,1);saveAll();
  if(typeof showToast==="function")showToast("Epithet rejected: "+nm);
  if(owner===""){var ex=document.getElementById("cs-modal");if(ex){ex.remove();showCharSheet();}}
  else{var ex2=document.getElementById("npc-modal");if(ex2){ex2.remove();showNpcSheet(owner);}}
}
// invOwner (#50 QOL): ""=live player sheet, "<npc name>"=live companion sheet — inventory rows
// get a drop ×. undefined = read-only viewer (library/import preview): no drop buttons.
// #9: per-character voice control — the AUDIO twin of the portrait, so it sits on the sheet where
// the character is defined. Writes char.voiceId ("" = narrator default). Shown on any sheet that
// has a character object to write to (the player always; a companion/NPC only once it HAS a
// charSheet — a sheetless NPC stays narrator-tier by design). Reads the curated set from TTS.
function csVoiceControlHtml(char){
  if(typeof TTS==="undefined"||typeof TTS.voices!=="function")return "";
  var vs=TTS.voices(),cur=(char&&char.voiceId)||"",i;
  var opts="<option value=''"+(cur?"":" selected")+">Narrator voice (default)</option>";
  for(i=0;i<vs.length;i++){opts+="<option value='"+escHtml(vs[i].id)+"'"+(vs[i].id===cur?" selected":"")+">"+escHtml(vs[i].label)+"</option>";}
  return "<div class='cs-voice-row' style='display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:var(--t1);'>"
    +"<span title='This character speaks in this voice (rides exports and library imports)'>&#128266; Voice</span>"
    +"<select id='cs-voice-sel' style='flex:1;min-width:0;font-family:var(--font);font-size:12px;background:var(--bg2);color:var(--t0);border:1px solid var(--brd);border-radius:var(--r);padding:5px 8px;cursor:pointer;'>"+opts+"</select>"
    +"<button id='cs-voice-test' type='button' style='flex-shrink:0;padding:5px 10px;font-family:var(--font);font-size:12px;background:none;border:1px solid var(--brd2);border-radius:var(--r);color:var(--t1);cursor:pointer;white-space:nowrap;'>&#9654; Test</button>"
    +"</div>";
}
function csWireVoice(char){
  var sel=document.getElementById("cs-voice-sel");if(!sel||!char)return;
  sel.addEventListener("change",function(){
    var v=sel.value;
    if(v){char.voiceId=v;}else{delete char.voiceId;}
    if(typeof saveAll==="function")saveAll();
    if(typeof showToast==="function")showToast("&#128266; Voice: "+(v&&typeof TTS!=="undefined"?TTS.voiceLabel(v):"narrator default"));
  });
  // #9: Test button — auditions the CURRENTLY-selected voice ("" → narrator). First test of an
  // undownloaded voice triggers its one-time Piper download, same as the Voice Settings Test.
  var tb=document.getElementById("cs-voice-test");
  if(tb)tb.addEventListener("click",function(){
    if(typeof TTS!=="undefined"&&typeof TTS.testVoice==="function")TTS.testVoice(sel.value);
    else if(typeof showToast==="function")showToast("Voice engine not ready");
  });
}
function csSheetSections(c,invOwner){
  var i;
  var statHtml="<div class='cs-stat-grid'>";
  for(i=0;i<STATS.length;i++){var s=STATS[i],v=(c.stats&&c.stats[s])||"—";statHtml+="<div class='cs-stat'><div class='cs-sn'>"+s+"</div><div class='cs-sv'>"+v+"</div><div class='cs-sm'>"+(c.stats&&c.stats[s]?smod(c.stats[s]):"")+"</div></div>";}
  statHtml+="</div>";
  var earnedSkills=[],si2;
  if(c.skills){for(si2=0;si2<SKILLS.length;si2++){var skl=SKILLS[si2],succ=(typeof c.skills[skl.id]==="number")?c.skills[skl.id]:0;if(succ>0)earnedSkills.push(skl.label+" ("+SKILL_LEVELS[skillLevel(succ)]+")");}  }
  var skillHtml=earnedSkills.length?'<div class="cs-v">'+earnedSkills.join(", ")+"</div>":'<span class="cs-none">None yet</span>';
  var condHtml;
  // #46: conditions carry effect · turn it landed · why (turn engine-stamped since v1.247;
  // cause arrives with the Phase-B tag extension). Older conditions lack both — render plain.
  if(c.conditions&&c.conditions.length){condHtml="<div class='cs-list'>";for(i=0;i<c.conditions.length;i++){var _cd=c.conditions[i],_cdm=[];if(_cd.turn)_cdm.push("t"+_cd.turn);if(_cd.cause)_cdm.push(escHtml(_cd.cause));if(_cd.duration)_cdm.push(escHtml(_cd.duration));if(_cd.until!=null)_cdm.push("expires ~t"+_cd.until);condHtml+='<div class="cs-list-row"><span style="color:var(--hp)">'+escHtml(_cd.name)+'</span><span class="cs-dim">'+(_cdm.length?" — "+_cdm.join(" · "):"")+'</span></div>';}condHtml+="</div>";}else condHtml='<span class="cs-none">None</span>';/* GM-tag text (#22/UA18) */
  var relHtml;
  if(c.relationships&&c.relationships.length){relHtml="<div class='cs-list'>";for(i=0;i<c.relationships.length;i++)relHtml+='<div class="cs-list-row"><span style="color:var(--acc)">'+escHtml(c.relationships[i].entity)+'</span><span class="cs-dim"> — '+escHtml(c.relationships[i].descriptor)+'</span></div>';relHtml+="</div>";}else relHtml='<span class="cs-none">None</span>';/* GM-tag text (#22/UA18) */
  var langHtml,langParts=[];
  if(c.languages&&c.languages.length){for(i=0;i<c.languages.length;i++){var lang=c.languages[i];langParts.push(lang.broken?'<span style="color:var(--warn)">'+escHtml(lang.name)+' (broken)</span>':escHtml(lang.name));}langHtml='<div class="cs-v">'+langParts.join(", ")+"</div>";}else langHtml='<span class="cs-none">Common</span>';
  var saveHtml="";
  if(c.saveModifiers&&c.saveModifiers.length){saveHtml="<div class='cs-list'>";for(i=0;i<c.saveModifiers.length;i++){var sm=c.saveModifiers[i],sv=sm.amount>=0?"+"+sm.amount:""+sm.amount;saveHtml+='<div class="cs-list-row"><span>'+sv+' vs '+escHtml(sm.type)+'</span><span class="cs-dim"> ['+escHtml(sm.source)+']</span></div>';}saveHtml+="</div>";}
  var beatsHtml="";
  if(c.storyBeats&&c.storyBeats.length){for(i=c.storyBeats.length-1;i>=0;i--)beatsHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+c.storyBeats[i].turn+'</span>'+escHtml(c.storyBeats[i].text)+'</div>';}/* GM-tag text (#22/UA18) */
  // #63 Core Memory — lives on the character schema (witnessed-by-all), so EVERY sheet shows its
  // own carried history: companions display theirs too, and an imported character keeps moments
  // from earlier adventures — labeled with the campaign name instead of a meaningless turn number.
  var cmHtml="",_cmList=c.coreMemories||[];
  if(_cmList.length){for(i=_cmList.length-1;i>=0;i--){var _cmLbl=(_cmList[i].camp&&worldState&&_cmList[i].camp!==worldState.campName)?escHtml(_cmList[i].camp):"Turn "+_cmList[i].turn;cmHtml+='<div class="cs-beat"><span class="cs-beat-turn">'+_cmLbl+'</span>'+escHtml(_cmList[i].text)+'</div>';}}
  var abilHtml="";
  if(c.abilities&&c.abilities.length){for(i=0;i<c.abilities.length;i++){var _abN=c.abilities[i].nm,_abCanon=(typeof capabilityLookup==="function")&&capabilityLookup(_abN);var _abNm=_abCanon?'<span class="cs-abil-nm cs-cap" data-cap="'+escHtml(_abN)+'" onclick="showCapabilityCard(this.dataset.cap)" style="cursor:pointer;border-bottom:1px dotted var(--acc);">'+escHtml(_abN)+'</span>':'<span class="cs-abil-nm">'+escHtml(_abN)+'</span>';abilHtml+='<div class="cs-abil">'+_abNm+'<span class="cs-abil-ds">'+escHtml(c.abilities[i].ds||"")+'</span></div>';}}else abilHtml='<span class="cs-none">None yet</span>';
  var spellHtml="";
  if(c.spells&&c.spells.length){var spParts=[];for(i=0;i<c.spells.length;i++){var sp2=c.spells[i],stag=sp2.lvl===0?"C":String(sp2.lvl);var nm2=sp2.nm.indexOf("(")>=0?sp2.nm.slice(0,sp2.nm.indexOf("(")).trim():sp2.nm;var spTxt="["+stag+"] "+escHtml(nm2);var _spInner=sp2.used?'<span style="color:var(--t2);text-decoration:line-through">'+spTxt+'</span>':spTxt;var _spCanon=(typeof capabilityLookup==="function")&&capabilityLookup(sp2.nm);spParts.push(_spCanon?'<span class="cs-cap" data-cap="'+escHtml(sp2.nm)+'" onclick="showCapabilityCard(this.dataset.cap)" style="cursor:pointer;border-bottom:1px dotted var(--acc);">'+_spInner+'</span>':_spInner);}spellHtml='<div class="cs-v" style="line-height:1.9">'+spParts.join(", ")+"</div>";}
  var invHtml;
  if(c.inventory&&c.inventory.length){/* #50(b): one line per item (was a comma run); live sheets get a drop × */
    var invRows="",ivi,_canDrop=(invOwner!==undefined);
    for(ivi=0;ivi<c.inventory.length;ivi++){
      var _dropBtn=_canDrop?'<button class="inv-x" data-own="'+escHtml(invOwner)+'" data-idx="'+ivi+'" onclick="dropInvItem(this.dataset.own,this.dataset.idx,event)" title="Drop this item" style="background:none;border:none;color:var(--t2);cursor:pointer;font-size:13px;padding:0 4px;line-height:1;flex-shrink:0;" onmouseover="this.style.color=\'var(--dng)\'" onmouseout="this.style.color=\'var(--t2)\'">&#10005;</button>':"";
      invRows+='<div class="cs-list-row" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;"><span>'+invItemHtml(c.inventory[ivi])+'</span>'+_dropBtn+'</div>';
    }
    invHtml='<div class="cs-list">'+invRows+"</div>";}
  else invHtml='<span class="cs-none">Empty</span>';
  // #47: earned epithets/titles ride the character schema (c.aliases) so they survive PC↔NPC
  // swaps — "Player today is NPC tomorrow is Player again; the sheets stay sympatico" (user).
  var akaHtml="";
  if(c.aliases&&c.aliases.length){var _akaParts=[],aki,_canRej=(invOwner!==undefined);
    for(aki=0;aki<c.aliases.length;aki++){
      var _rejBtn=_canRej?'<button class="epi-x" data-own="'+escHtml(invOwner)+'" data-idx="'+aki+'" onclick="rejectEpithet(this.dataset.own,this.dataset.idx,event)" title="Reject this epithet" style="background:none;border:none;color:var(--t2);cursor:pointer;font-size:11px;padding:0 2px;line-height:1;" onmouseover="this.style.color=\'var(--dng)\'" onmouseout="this.style.color=\'var(--t2)\'">&#10005;</button>':"";
      _akaParts.push('<span style="white-space:nowrap">'+escHtml(c.aliases[aki])+_rejBtn+'</span>');}
    akaHtml=csKv("Also known as",_akaParts.join(", "));}
  var charKv=akaHtml+(c.appear?csKv("Appearance",escHtml(c.appear)):"")+(c.mark?csKv("Distinguishing Mark",escHtml(c.mark)):"")+(c.trait?csKv("Trait",escHtml(c.trait)):"")+(c.flaw?csKv("Flaw",escHtml(c.flaw)):"")+(c.motivation?csKv("Motivation",escHtml(c.motivation)):"")+(c.backstory?csKv("Backstory",escHtml(c.backstory)):"");/* user/model-authored prose (#22/UA18) */
  return csSec("Attributes",statHtml)+csSec("Character",charKv)+csSec("Conditions",condHtml)+csSec("Relationships",relHtml)+csSec("Languages",langHtml)+(c.saveModifiers&&c.saveModifiers.length?csSec("Save Modifiers",saveHtml):"")+csSec("Skills",skillHtml)+(cmHtml?csSec("Defining Moments",cmHtml):"")+(c.storyBeats&&c.storyBeats.length?csSec("Story Beats",beatsHtml):"")+csSec("Abilities",abilHtml)+(c.spells&&c.spells.length?csSec("Spells",spellHtml):"")+csSec("Inventory",invHtml);
}
// showCapabilityCard (TODO #10) — the player-facing click-card. Renders a spell/ability's canon via
// the SHARED bibleCardHTML (same render as the bible_study.html viewer). Wired onto clickable spell
// and ability names in the character sheet (data-cap).
function showCapabilityCard(name){
  var e=(typeof capabilityLookup==="function")?capabilityLookup(name):null;
  /* #14: bg .9 + padless position:relative box — the card carries its own chrome */
  modalShell("cap-card-modal",
    bibleCardHTML(name,e)+"<button id='cap-card-x' style='position:absolute;top:6px;right:10px;background:none;border:none;color:var(--t2);font-size:24px;line-height:1;cursor:pointer;'>&times;</button>",
    {z:400,bg:".9",boxCss:"background:var(--modal-bg,#181818);border:1px solid var(--acc);border-radius:12px;max-width:420px;width:100%;position:relative;",closeId:"cap-card-x",outside:true});
}
function csWireToggles(modal){var hdrs=modal.querySelectorAll(".cs-sec-tog"),hi;for(hi=0;hi<hdrs.length;hi++){hdrs[hi].addEventListener("click",function(){var body=this.parentNode.querySelector(".cs-sec-body"),arr=this.querySelector(".cs-tog-arr"),open=body.style.display!=="none";body.style.display=open?"none":"block";arr.style.transform=open?"":"rotate(90deg)";});}}

// TODO #1 P1: shared PC/NPC toggle button style — one renderer for the hero sheet and every
// companion sheet (radio-style pair, highlighted side = current status, per D1).
function _pcTogBtnCss(on){return "padding:3px 14px;font-size:11px;font-family:var(--font);border-radius:var(--r);cursor:pointer;border:1px solid "+(on?"var(--acc)":"var(--brd)")+";background:"+(on?"var(--acc)":"none")+";color:"+(on?"var(--on-acc)":"var(--t2)")+";font-weight:"+(on?"bold":"normal")+";";}
// D2 confirm — demoting the LAST player character is allowed (AI-plays-everyone mode) but never
// silent. cb runs only on explicit confirm.
function _confirmLastPcDemote(cb){
  var m=modalShell("lastpc-confirm",
    "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>No active player specified — pure NPC turn?</div>"
    +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>With no player characters, the GM plays the whole party. You can flip anyone back to PC at any time.</div>"
    +"<div style='display:flex;gap:10px;justify-content:center;'>"
    +"<button id='lp-ok' style='padding:10px 24px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Yes — GM plays everyone</button>"
    +"<button id='lp-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div>",
    {z:500,maxWidth:380,boxPad:"28px 24px",boxExtra:"text-align:center;",wireClose:false});
  document.getElementById("lp-ok").addEventListener("click",function(){m.remove();cb();});
  document.getElementById("lp-cancel").addEventListener("click",function(){m.remove();});
}

function showCharSheet(){
  if(!worldState)return;
  var c=worldState.character;

  var initials=csInitials(c.name);
  var hdr=csHeroHeader(c);

  // ── compose ───────────────────────────────────────────────────────────────
  var modal=modalShell("cs-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'><button id='cs-export-btn' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>Export Character</button><div style='display:flex;gap:6px;align-items:center;'><button id='cs-sync-btn' title='Ask GM to update relationships, conditions and quests' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>&#8635; Sync</button><button id='cs-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div></div>"

    +"<div class='cs-hero'>"
    +"<div style='position:relative;flex-shrink:0;'>"
    +"<div class='cs-avatar' id='cs-avatar-btn' title='Drag to reframe · Click to edit'>"+(c.portrait?"<img id='cs-portrait-img' src='"+c.portrait+"' alt='"+escHtml(c.name)+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    +"</div>"
    +"<div class='cs-hero-info'>"
    +"<div class='cs-hero-name'>"+escHtml(c.name)+"</div>"
    +"<div class='cs-hero-cls'>"+hdr.clsLine+"</div>"
    +"<div class='cs-hero-sub'>"+hdr.genderLbl+" · "+escHtml(c.age)+(c.deity?" · "+escHtml(c.deity):"")+"</div>"
    /* TODO #1 P1 (user call 2026-07-17): the hero gets the SAME PC/NPC toggle as companions.
       isPC===false is the only demoted state (undefined = PC — every legacy save). Demoting the
       LAST PC triggers the D2 confirm ("pure NPC turn?") — allowed, it's the AI-plays-everyone mode. */
    +"<div style='display:flex;gap:6px;margin-top:6px;align-items:center;'>"
    +"<button id='cs-tog-pc' style='"+_pcTogBtnCss(c.isPC!==false)+"'>PC</button>"
    +"<button id='cs-tog-npc' style='"+_pcTogBtnCss(c.isPC===false)+"'>NPC</button>"
    +"<span style='font-size:10px;color:var(--t2);'>"+(c.isPC!==false?"player character":"GM-played — no active player")+"</span>"
    +"</div>"
    /* TODO #1 P2 (D6/D7): manual spotlight pick — shown only while a companion PC holds the
       display pointer, to hand the hero slot back. P3's turn loop drives the same pointer. */
    +(activePlayer()!==c?"<div style='margin-top:6px;'><button id='cs-spot-btn' style='font-size:10px;font-family:var(--font);padding:3px 10px;border:1px solid var(--acc);border-radius:var(--r);background:none;color:var(--acc);cursor:pointer;'>&#9728; Take the spotlight</button></div>":"")
    +"<div style='margin-top:8px;font-size:13px;'>"
    +"<span style='color:var(--acc)'>Lv "+hdr.lvl+"</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+c.hp+"/"+c.maxHp+" HP</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+c.gold+" gp</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(c.actualAlignment||c.statedAlignment||"Neutral")+"</span>"
    +"</div>"
    +"<div class='cs-xp-wrap'>"
    +"<div class='cs-xp-lbl'><span>"+c.xp+" XP</span><span>"+(hdr.lvl<10?"Next: "+hdr.nextXP+" XP":"Max level")+"</span></div>"
    +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+hdr.xpPct+"%;'></div></div>"
    +"</div>"
    +csVoiceControlHtml(c)/* #9: per-character voice, next to the portrait */
    +"</div></div>"

    +csSheetSections(c,"")/* ""=live player sheet — inventory rows get the drop × (#50) */,
    {align:"flex-start",overlayExtra:"overflow-y:auto;-webkit-overflow-scrolling:touch;",maxWidth:560,boxExtra:"margin:20px 0 40px;",closeId:"cs-x",outside:true});

  document.getElementById("cs-export-btn").addEventListener("click",function(){_showCharExportOptions(c);});
  document.getElementById("cs-sync-btn").addEventListener("click",function(){if(typeof syncCharSheet==="function")syncCharSheet();});
  csWireToggles(modal);
  csWireVoice(c);/* #9 */

  // ── PC/NPC toggle on the hero (TODO #1 P1, D1/D2) ─────────────────────────
  document.getElementById("cs-tog-pc").addEventListener("click",function(){
    if(c.isPC!==false)return;
    delete c.isPC;/* undefined = PC — keeps legacy saves byte-clean, same convention as ragMemory */
    if(worldState.mpEnded&&playerCount()>1)worldState.mpEnded=null;/* D12: back into multiplayer — cancel the exit reinforcement */
    saveAll();showToast("★ "+c.name+" is a PLAYER character — "+playerCount()+" player"+(playerCount()===1?"":"s"),4000);
    modal.remove();showCharSheet();
  });
  document.getElementById("cs-tog-npc").addEventListener("click",function(){
    if(c.isPC===false)return;
    var demote=function(){c.isPC=false;saveAll();showToast(c.name+" is GM-played — "+(playerCount()===0?"no active player (pure NPC turns)":playerCount()+" player"+(playerCount()===1?"":"s")+" remain"),5000);modal.remove();showCharSheet();};
    if(playerCount()<=1)_confirmLastPcDemote(demote);else demote();
  });
  // ── Spotlight return (TODO #1 P2, D6/D7) ──────────────────────────────────
  if(document.getElementById("cs-spot-btn")){
    document.getElementById("cs-spot-btn").addEventListener("click",function(){
      setActivePC(null);saveAll();if(typeof syncUI==="function")syncUI();
      showToast("☀ "+c.name+" has the spotlight",3500);
      modal.remove();showCharSheet();
    });
  }

  // ── portrait handlers ─────────────────────────────────────────────────────
  function refreshAvatar(){
    var av=document.getElementById("cs-avatar-btn");if(!av)return;
    var c2=worldState.character;
    av.innerHTML=(c2.portrait?"<img id='cs-portrait-img' src='"+c2.portrait+"' alt='"+escHtml(c2.name)+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
    wireAvatarDrag();
  }
  function wireAvatarDrag(){
    var img=document.getElementById("cs-portrait-img");if(!img)return;
    wirePortraitDrag(img,
      function(){return sheetOffsetGet(null,worldState.character);},
      function(x,y,zoom){worldState.character.portraitOffset={x:x,y:y,zoom:zoom};saveAll();});
  }
  wireAvatarDrag();
  document.getElementById("cs-avatar-btn").addEventListener("click",function(){
    var img=document.getElementById("cs-portrait-img");
    if(img&&img._wasDragged&&img._wasDragged())return;
    showPortraitModal(refreshAvatar);
  });
}
async function generateNpcSheet(name,doneCb){
  if(!worldState)return;
  if(busy){showToast("Game is busy — try again in a moment.");return;}
  var wsNpc=wsNpcByName(name),i;/* #7: shared lookup */
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc){showToast("NPC not found.");return;}
  // Build context from all known data
  var ctx="NPC name: "+name+"\nStatus: "+(wsNpc.status||"unknown")+"\nRelation to player: "+(wsNpc.rel||"unknown")+"\n";
  if(wsNpc.pronouns)ctx+="Pronouns: "+wsNpc.pronouns+"\n";
  if(memNpc){
    if(memNpc.attitude)ctx+="Attitude/personality: "+memNpc.attitude+"\n";
    if(memNpc.knowledge&&memNpc.knowledge.length)ctx+="Known facts: "+memNpc.knowledge.join("; ")+"\n";
    if(memNpc.events&&memNpc.events.length){ctx+="Event log:\n";for(i=0;i<memNpc.events.length;i++)ctx+="  Turn "+memNpc.events[i].turn+": "+memNpc.events[i].note+"\n";}
  }
  var prompt="Generate a full D&D-style character sheet for a party member NPC. Use the game world, tone, and lore you already know. "
    +"Be creative but strictly consistent with all known facts listed below.\n\nKnown information:\n"+ctx+"\n"
    +"Output ONLY a single valid JSON object — no markdown, no code fences, no commentary:\n"
    +'{"gender":"M/F/NB","age":"age as string","appear":"full physical description","mark":"distinguishing mark or empty string","backstory":"2-3 sentence backstory consistent with known events",'
    +'"ancestry":"Human/Elf/Dwarf/Gnome/Tiefling/Hollow-Born/Half-Blood","subraceNm":"specific subrace name",'
    +'"cls":"Warrior/Rogue/Sorcerer/Ranger/Berserker/Paladin/Cleric/Druid","archetypeNm":"archetype or empty string",'
    +'"stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},'
    +'"hp":20,"maxHp":20,"gold":10,"level":1,"xp":0,'
    +'"trait":"personality trait","flaw":"character flaw","motivation":"core motivation",'
    +'"statedAlignment":"alignment string","actualAlignment":"alignment string","deity":"deity name or empty string",'
    +'"abilities":[{"nm":"ability name","ds":"description"}],'
    +'"spells":[{"nm":"spell name","lvl":1,"used":false}],'
    +'"inventory":["item1","item2"],'
    +'"languages":[{"name":"Common","broken":false}]}';
  busy=true;
  var removeLoader=showLoadingModal("Generating character sheet…");
  try{
    var resp=await callGM(prompt,"You are a D&D character sheet generator for a fantasy RPG. Output ONLY a single valid JSON object. No markdown fences, no extra text.",2000);
    var json=resp.trim().replace(/^```[a-z]*\n?/,"").replace(/\n?```$/,"").trim();
    var sheet=JSON.parse(json);
    sheet.name=name;
    if(!sheet.stats||typeof sheet.stats!=="object")sheet.stats={STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10};
    ["STR","DEX","CON","INT","WIS","CHA"].forEach(function(s){sheet.stats[s]=parseInt(sheet.stats[s])||10;});
    sheet.hp=parseInt(sheet.hp)||8;sheet.maxHp=parseInt(sheet.maxHp)||8;
    sheet.level=parseInt(sheet.level)||1;sheet.gold=parseInt(sheet.gold)||0;sheet.xp=parseInt(sheet.xp)||0;
    if(!sheet.abilities)sheet.abilities=[];
    if(!sheet.spells)sheet.spells=[];
    sheet.inventory=sanitizeModelInventory(sheet.inventory);/* #50d: this regeneration path copied the model's inventory array VERBATIM (no type check, no dedupe) — the byte-identical-pairs faucet */
    if(!sheet.languages)sheet.languages=[{name:"Common",broken:false}];
    if(!sheet.conditions)sheet.conditions=[];
    if(!sheet.relationships)sheet.relationships=[];
    if(!sheet.saveModifiers)sheet.saveModifiers=[];
    if(!sheet.storyBeats)sheet.storyBeats=[];
    if(!sheet.skills){sheet.skills={};var sk2;for(sk2=0;sk2<SKILLS.length;sk2++)sheet.skills[SKILLS[sk2].id]=0;}
    sheet.portrait=npcPortrait(wsNpc);wsNpc.portrait=null; // #3 dedupe: the sheet is the portrait's single home now
    sheet.partyMember=true;
    // Preserve earned progression on a REGENERATE (audit E59): the generation prompt uses a
    // level-1/xp-0/hp-20 template, so regenerating an advanced companion would silently reset them.
    // Carry the existing sheet's level/xp/hp/maxHp over the freshly-generated (default) values.
    var _prior=wsNpc.charSheet;
    if(_prior){if(typeof _prior.level==="number")sheet.level=_prior.level;if(typeof _prior.xp==="number")sheet.xp=_prior.xp;if(typeof _prior.hp==="number")sheet.hp=_prior.hp;if(typeof _prior.maxHp==="number")sheet.maxHp=_prior.maxHp;
      if(_prior.voiceId)sheet.voiceId=_prior.voiceId;/* #9: the assigned voice is a SETTING, not LLM content — carry it across a regenerate like portrait/level */}
    // Seed the player↔NPC relationship from live tracking data
    if(!sheet.relationships)sheet.relationships=[];
    if(worldState&&worldState.character){
      var pcn=worldState.character.name,hasPC=false,rki;
      for(rki=0;rki<sheet.relationships.length;rki++){if(sheet.relationships[rki].entity===pcn){hasPC=true;break;}}
      if(!hasPC&&wsNpc.rel&&wsNpc.rel!=="unknown")sheet.relationships.push({entity:pcn,descriptor:wsNpc.rel});
    }
    wsNpc.charSheet=sheet;
    saveAll();removeLoader();showToast("Character sheet ready!");
    if(doneCb)doneCb();
  }catch(err){removeLoader();showToast("Sheet generation failed: "+err.message);}
  busy=false;
}
// Remove a companion from the party (manual "part ways"). Flips partyMember off and sets a
// transient worldState.recentlyLeft marker so buildSysPrompt tells the GM they've left — without
// it the GM keeps narrating them as present. Auto-cleared in sendAction after ~2 turns.
function partWaysWithCompanion(name){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  if(!worldState||!worldState.npcs)return;
  var n=(typeof resolveNpcName==="function")?resolveNpcName(name):name;
  var pwNpc=wsNpcByName(n);/* #7: shared lookup */
  if(!pwNpc||!pwNpc.partyMember)return;
  pwNpc.partyMember=false;
  if(worldState.activePC===n)delete worldState.activePC;/* TODO #1 P2: a departed companion can't keep the display spotlight */
  if(pwNpc.charSheet&&pwNpc.charSheet.splitLoc)delete pwNpc.charSheet.splitLoc;/* P5: leaving the party ends their thread — lastSeenAt keeps where they went */
  if(memory.npcs[n])memory.npcs[n].partyMember=false;
  if(!worldState.recentlyLeft)worldState.recentlyLeft=[];
  worldState.recentlyLeft.push({name:n,turn:worldState.turn||0});
  saveAll();syncUI();
  if(typeof showToast==="function")showToast(n+" has left the party.");
}
function showNpcSheet(name){
  if(!worldState)return;
  var wsNpc=wsNpcByName(name),i;/* #7: shared lookup */
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc&&!memNpc)return;
  var isParty=!!(wsNpc&&wsNpc.partyMember);
  var sheet=isParty&&wsNpc&&wsNpc.charSheet?wsNpc.charSheet:null;

  var initials=csInitials(name);
  var portrait=npcPortrait(wsNpc); // charSheet-first (#3 dedupe) — also fixes companions whose portrait arrived in the blob but not the separate store (known issue #6)

  // ── Avatar ────────────────────────────────────────────────────────────────
  var avatarHtml=isParty
    ?"<div class='cs-avatar' id='npc-avatar-btn' title='Drag to reframe · Click to edit'>"+(portrait?"<img id='npc-portrait-img' src='"+portrait+"' alt='"+escHtml(name)+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    :"<div class='cs-avatar' style='font-size:16px;cursor:default;'>"+initials+"</div>";

  // ── Hero info block ───────────────────────────────────────────────────────
  var heroInfo;
  if(sheet){
    var gLbl=genderLabel(sheet.gender);/* #11③: shared mapping */
    var clsLine=escHtml((sheet.subraceNm?sheet.subraceNm+" ":"")+(sheet.ancestry||"")+" "+(sheet.cls||"")+(sheet.archetypeNm?" ["+sheet.archetypeNm+"]":""));/* model-generated sheet fields (#22/UA18) */
    var lvl=sheet.level||1,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
    var xpPct=lvl>=10?100:Math.max(0,Math.min(100,Math.round((((sheet.xp||0)-prevXP)/Math.max(1,nextXP-prevXP))*100)));// (sheet.xp||0) guard so a missing xp doesn't render NaN → full bar (audit E62)
    var playBtn=isParty?"<button id='npc-play-btn' title='Switch to playing as "+escHtml(name)+"' style='background:none;border:none;color:var(--acc);cursor:pointer;font-size:16px;padding:0 4px;margin-left:6px;vertical-align:middle;line-height:1;opacity:0.8;' onmouseover='this.style.opacity=1' onmouseout='this.style.opacity=0.8'>▶</button>":"";
    // TODO #1 P1 (multiplayer D1/D8): the PC/NPC toggle — radio-style pair, highlighted side =
    // current status. Flips wsNpc.isPC (roster-level; rides the sync blob). The ▶ play button
    // (anchor swap) deliberately SURVIVES until P3 gives the toggle real turn semantics — D1's
    // full replacement lands there, else P1 would regress a working feature for a no-op flag.
    var _isPC=!!(wsNpc&&wsNpc.isPC);
    var pcToggle=isParty?"<div style='display:flex;gap:6px;margin-top:6px;align-items:center;'>"
      +"<button id='npc-tog-pc' style='"+_pcTogBtnCss(_isPC)+"'>PC</button>"
      +"<button id='npc-tog-npc' style='"+_pcTogBtnCss(!_isPC)+"'>NPC</button>"
      +"<span style='font-size:10px;color:var(--t2);'>"+(_isPC?"player character (hot-seat)":"companion — the GM plays them")+"</span>"
      +"</div>"
      /* TODO #1 P2 (D6/D7): manual spotlight pick — HUD/panels/Car Mode display this PC. Only a
         living isPC party member qualifies (setActivePC validates); hidden when already spotlit. */
      +(_isPC&&worldState&&worldState.activePC!==name?"<div style='margin-top:6px;'><button id='npc-spot-btn' style='font-size:10px;font-family:var(--font);padding:3px 10px;border:1px solid var(--acc);border-radius:var(--r);background:none;color:var(--acc);cursor:pointer;'>&#9728; Take the spotlight</button></div>":""):"";
    heroInfo="<div style='display:flex;align-items:center;flex-wrap:wrap;gap:4px;'><span class='cs-hero-name'>"+escHtml(name)+"</span>"+playBtn+"</div>"
      +"<div class='cs-hero-cls'>"+clsLine+"</div>"
      +"<div class='cs-hero-sub'>"+gLbl+" · "+escHtml(sheet.age||"?")+(sheet.deity?" · "+escHtml(sheet.deity):"")+"</div>"
      +pcToggle
      +"<div style='margin-top:8px;font-size:13px;'>"
      +"<span style='color:var(--acc)'>Lv "+lvl+"</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+(sheet.hp||0)+"/"+(sheet.maxHp||0)+" HP</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+(sheet.gold||0)+" gp</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(sheet.actualAlignment||sheet.statedAlignment||"Neutral")+"</span></div>"
      +"<div class='cs-xp-wrap'><div class='cs-xp-lbl'><span>"+(sheet.xp||0)+" XP</span>"
      +"<span>"+(lvl<10?"Next: "+nextXP+" XP":"Max level")+"</span></div>"
      +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+xpPct+"%;'></div></div></div>";
  }else{
    heroInfo="<div class='cs-hero-name'>"+escHtml(name)+"</div>"/* model-invented NPC name (#22/UA18) */
      +(isParty?"<div class='cs-hero-cls'>Party Member</div>":"<div class='cs-hero-cls'>NPC</div>")
      +(wsNpc&&wsNpc.met?"<div class='cs-hero-sub'>First met: turn "+wsNpc.met+"</div>":"");
  }

  // ── Full character sheet sections (when charSheet exists) ─────────────────
  var sheetSections="";
  if(sheet){
    // Merge live player relationship in case sheet was generated before this fix
    var origRels=sheet.relationships;
    var sheetRels=sheet.relationships?sheet.relationships.slice():[];
    if(worldState&&worldState.character){var pcn2=worldState.character.name,hasPC2=false,rki2;for(rki2=0;rki2<sheetRels.length;rki2++){if(sheetRels[rki2].entity===pcn2){hasPC2=true;break;}}if(!hasPC2&&wsNpc&&wsNpc.rel&&wsNpc.rel!=="unknown")sheetRels.push({entity:pcn2,descriptor:wsNpc.rel});}
    sheet.relationships=sheetRels;
    sheetSections=csSheetSections(sheet,name);/* live companion sheet — drop × routes to this NPC (#50) */
    sheet.relationships=origRels;
  }

  // ── NPC sections (always shown) ───────────────────────────────────────────
  var statusBlock="";
  if(wsNpc){statusBlock+=csKv("Status",escHtml(wsNpc.status||"—"));if(wsNpc.pronouns)statusBlock+=csKv("Pronouns",escHtml(wsNpc.pronouns));}/* model-authored (#22/UA18) */
  // #47: identity aliases (memory — the resolution spine, e.g. a merged "Woman in Bronze")
  // + schema epithets (charSheet.aliases), deduped. The merge machinery's work, made visible.
  var _aka=[],_ak;
  if(memNpc&&memNpc.aliases){for(_ak=0;_ak<memNpc.aliases.length;_ak++)_aka.push(memNpc.aliases[_ak]);}
  if(sheet&&sheet.aliases){for(_ak=0;_ak<sheet.aliases.length;_ak++){if(_aka.indexOf(sheet.aliases[_ak])<0)_aka.push(sheet.aliases[_ak]);}}
  if(_aka.length)statusBlock+=csKv("Also known as",_aka.map(escHtml).join(", "));
  var pcRel=null;var pcRels=worldState&&worldState.character&&worldState.character.relationships?worldState.character.relationships:[];
  for(var pri=0;pri<pcRels.length;pri++){if(pcRels[pri].entity===name){pcRel=pcRels[pri].descriptor;break;}}
  var relDisplay=pcRel||(wsNpc&&wsNpc.rel&&wsNpc.rel!=="unknown"?wsNpc.rel:null);
  if(relDisplay)statusBlock+=csKv("Relationship",escHtml(relDisplay));
  var nfEntries=memory&&memory.npcGraph&&memory.npcGraph.npcFactions?memory.npcGraph.npcFactions[name]||[]:[];
  if(nfEntries.length)statusBlock+=csKv("Factions",escHtml(nfEntries.map(function(e){return e.faction+(e.role?" ["+e.role+"]":"");}).join(", ")));
  var npcLinks2="";if(memory&&memory.npcGraph&&memory.npcGraph.edges){var nlEdges=memory.npcGraph.edges;for(var nle=0;nle<nlEdges.length;nle++){var e2=nlEdges[nle];if(e2.a===name)npcLinks2+=(npcLinks2?", ":"")+e2.b+" ("+e2.rel+")";else if(e2.b===name)npcLinks2+=(npcLinks2?", ":"")+e2.a+" ("+e2.rel+")";}}
  if(npcLinks2)statusBlock+=csKv("Links",escHtml(npcLinks2));
  var memBlock="";
  if(memNpc){if(memNpc.attitude)memBlock+=csKv("Attitude",escHtml(memNpc.attitude));if(memNpc.knowledge&&memNpc.knowledge.length)memBlock+=csKv("Knows",escHtml(memNpc.knowledge.join("; ")));}/* model-authored memory (#22/UA18) */
  var evHtml="";
  if(memNpc&&memNpc.events&&memNpc.events.length){for(i=memNpc.events.length-1;i>=0;i--)evHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+memNpc.events[i].turn+'</span>'+escHtml(memNpc.events[i].note)+'</div>';}
  var npcSections=csSec("Status",statusBlock||'<span class="cs-none">No data</span>')+(memBlock?csSec("Profile",memBlock):"")+(evHtml?csSec("History",evHtml):"");

  // ── Generate / Regenerate button ──────────────────────────────────────────
  var genBtnHtml=isParty?"<div style='margin-top:16px;'><button id='npc-gen-sheet' style='display:block;width:100%;padding:11px 14px;font-size:13px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;'>"+(sheet?"&#8635; Regenerate Sheet":"&#10022; Generate Character Sheet")+"</button></div>":"";
  var partWaysHtml=isParty?"<div style='margin-top:10px;'><button id='npc-part-btn' style='display:block;width:100%;padding:9px 14px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;background:none;border:1px solid var(--brd2);color:var(--t2);' onmouseover=\"this.style.borderColor='#c04040';this.style.color='#c04040'\" onmouseout=\"this.style.borderColor='var(--brd2)';this.style.color='var(--t2)'\">Part ways with "+escHtml(name)+"</button></div>":"";

  var modal=modalShell("npc-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'>"+(isParty&&sheet?"<button id='npc-export-btn' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>Export Character</button>":"<span></span>")+"<button id='npc-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div>"
    +"<div class='cs-hero'><div style='position:relative;flex-shrink:0;'>"+avatarHtml+"</div>"
    +"<div class='cs-hero-info'>"+heroInfo+(sheet?csVoiceControlHtml(sheet):"")/* #9: voice only when a sheet exists to hold it (sheetless NPC = narrator tier) */+"</div></div>"
    +sheetSections
    +(sheetSections?"<div style='height:1px;background:var(--brd);margin:18px 0;'></div>":"")
    +npcSections
    +genBtnHtml
    +partWaysHtml,
    {align:"flex-start",overlayExtra:"overflow-y:auto;-webkit-overflow-scrolling:touch;",maxWidth:560,boxExtra:"margin:20px 0 40px;",closeId:"npc-x",outside:true});

  if(document.getElementById("npc-export-btn")){document.getElementById("npc-export-btn").addEventListener("click",function(){_showCharExportOptions(sheet);});}
  csWireToggles(modal);
  if(sheet)csWireVoice(sheet);/* #9: writes the companion/NPC charSheet.voiceId */

  // ── PC/NPC toggle (TODO #1 P1, D1/D8) ─────────────────────────────────────
  if(document.getElementById("npc-tog-pc")){
    document.getElementById("npc-tog-pc").addEventListener("click",function(){
      if(wsNpc.isPC)return;
      wsNpc.isPC=true;if(worldState.mpEnded)worldState.mpEnded=null;/* D12: re-entering multiplayer cancels the exit reinforcement — the third-person override takes back over */saveAll();
      showToast("★ "+name+" is now a PLAYER character — "+playerCount()+" players in the party",4000);
      modal.remove();showNpcSheet(name);
    });
    document.getElementById("npc-tog-npc").addEventListener("click",function(){
      if(!wsNpc.isPC)return;
      var demote=function(){var _wasMulti=playerCount()>1;wsNpc.isPC=false;if(worldState.activePC===name)delete worldState.activePC;/* P2: a demoted PC can't keep the spotlight — deliberate clear (the accessor's loud heal is the backstop) */if(_wasMulti&&playerCount()<=1&&worldState.character.isPC!==false)worldState.mpEnded={turn:worldState.turn||0};/* D12 exit: the sessionLog is full of third-person narration — arm the 2-turn second-person reinforcement (the recentSwitch pattern). Hero-is-PC guard: in the all-NPC/D2 corner "you = hero" would be wrong */saveAll();if(typeof syncUI==="function")syncUI();/* P2: repaint — the HUD may have been showing this PC */showToast(name+" is a companion again — the GM plays them",4000);modal.remove();showNpcSheet(name);};
      // D2 guard here too: if the hero is demoted, this companion can be the LAST PC
      if(playerCount()<=1)_confirmLastPcDemote(demote);else demote();
    });
  }
  // ── Spotlight pick (TODO #1 P2, D6/D7) ────────────────────────────────────
  if(document.getElementById("npc-spot-btn")){
    document.getElementById("npc-spot-btn").addEventListener("click",function(){
      if(!setActivePC(name)){showToast("⚠ "+name+" can't take the spotlight (not a living PC party member)");return;}
      saveAll();if(typeof syncUI==="function")syncUI();
      showToast("☀ "+name+" has the spotlight — HUD and panels now show them",4000);
      modal.remove();showNpcSheet(name);
    });
  }

  // ── Play as this character ────────────────────────────────────────────────
  if(document.getElementById("npc-play-btn")){
    document.getElementById("npc-play-btn").addEventListener("click",function(){
      /* #14: converted to the shell — id "switch-confirm" is NEW (the legacy div was
         anonymous; it sat under a full-screen overlay so a duplicate could never stack) */
      var confirm=modalShell("switch-confirm",
        "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Switch character?</div>"
        +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>"+escHtml(name)+" will take the lead. "+escHtml(worldState.character.name)+" becomes a companion.</div>"
        +"<div style='display:flex;gap:10px;justify-content:center;'>"
        +"<button id='sw-ok' style='padding:10px 28px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Switch</button>"
        +"<button id='sw-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
        +"</div>",
        {z:500,maxWidth:360,boxPad:"28px 24px",boxExtra:"text-align:center;",wireClose:false});
      document.getElementById("sw-ok").addEventListener("click",function(){confirm.remove();modal.remove();_switchPlayerCharacter(name);});
      document.getElementById("sw-cancel").addEventListener("click",function(){confirm.remove();});
    });
  }
  // ── Generate / Regenerate ─────────────────────────────────────────────────
  if(document.getElementById("npc-gen-sheet")){
    document.getElementById("npc-gen-sheet").addEventListener("click",function(){
      var doGen=function(){modal.remove();generateNpcSheet(name,function(){showNpcSheet(name);});};
      if(!sheet){doGen();return;}/* first-time GENERATE — nothing to lose, no confirm */
      // REGENERATE rebuilds the whole sheet from a fresh GM call and REPLACES the current one.
      // Easy to hit by accident (the "Yikes" report) — confirm first. Progression, portrait, and
      // voice are carried over (generateNpcSheet), but personality/abilities/spells/inventory are
      // rebuilt, so this is destructive of hand-tuned content.
      var cf=modalShell("regen-confirm",
        "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Regenerate "+escHtml(name)+"'s sheet?</div>"
        +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;line-height:1.5;'>This rebuilds the entire character sheet from scratch (a new GM call) and <b>replaces</b> the current one. Level, HP, XP, portrait, and the assigned voice are kept; personality, abilities, spells, inventory, and relationships are regenerated.</div>"
        +"<div style='display:flex;gap:10px;justify-content:center;'>"
        +"<button id='regen-ok' style='padding:10px 24px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Regenerate</button>"
        +"<button id='regen-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
        +"</div>",
        {z:500,maxWidth:380,boxPad:"28px 24px",boxExtra:"text-align:center;",wireClose:false});
      document.getElementById("regen-ok").addEventListener("click",function(){cf.remove();doGen();});
      document.getElementById("regen-cancel").addEventListener("click",function(){cf.remove();});
    });
  }
  // ── Part ways (remove from party) ─────────────────────────────────────────
  if(document.getElementById("npc-part-btn")){
    document.getElementById("npc-part-btn").addEventListener("click",function(){
      /* #14: converted to the shell — id "partways-confirm" is NEW (legacy div was anonymous) */
      var pc=modalShell("partways-confirm",
        "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Part ways with "+escHtml(name)+"?</div>"
        +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>They leave the party and become an ordinary NPC. You can recruit them again later, and a party slot frees up.</div>"
        +"<div style='display:flex;gap:10px;justify-content:center;'>"
        +"<button id='pw-ok' style='padding:10px 24px;font-size:13px;font-family:var(--font);background:var(--dng);color:var(--on-dng);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Part ways</button>"
        +"<button id='pw-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
        +"</div>",
        {z:500,maxWidth:360,boxPad:"28px 24px",boxExtra:"text-align:center;",wireClose:false});
      document.getElementById("pw-ok").addEventListener("click",function(){pc.remove();modal.remove();partWaysWithCompanion(name);});
      document.getElementById("pw-cancel").addEventListener("click",function(){pc.remove();});
    });
  }

  // ── Portrait (party members only) ─────────────────────────────────────────
  if(isParty&&document.getElementById("npc-avatar-btn")){
    // Offset is stored per-companion (mirrored onto charSheet so it survives a swap-to-PC).
    // Without dedicated get/setOffset the portrait modal would fall back to the PLAYER's
    // offset — editing a companion's framing would silently rewrite the player's.
    function npcGetOff(){return sheetOffsetGet(wsNpc,wsNpc.charSheet);}/* E60 fallback now lives in the shared accessor (UA22) */
    function npcSetOff(x,y,zoom){wsNpc.portraitOffset={x:x,y:y,zoom:zoom};if(wsNpc.charSheet)wsNpc.charSheet.portraitOffset=wsNpc.portraitOffset;saveAll();}
    function wireNpcAvatarDrag(){var img=document.getElementById("npc-portrait-img");if(img)wirePortraitDrag(img,npcGetOff,npcSetOff);}
    function refreshNpcAvatar(){
      var av=document.getElementById("npc-avatar-btn");if(!av)return;
      var port=npcPortrait(wsNpc);
      av.innerHTML=(port?"<img id='npc-portrait-img' src='"+port+"' alt='"+escHtml(name)+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
      wireNpcAvatarDrag();
    }
    wireNpcAvatarDrag(); // apply saved offset on initial render
    // Use charSheet as portrait subject if available — richer prompt
    var npcSubject=sheet||{name:name,gender:"NB",age:"",ancestry:"",cls:"",archetypeNm:null,appear:"",mark:"",inventory:[]};
    var npcPortOpts={
      getPortrait:function(){return npcPortrait(wsNpc);},
      setPortrait:function(url){if(wsNpc.charSheet){wsNpc.charSheet.portrait=url;wsNpc.portrait=null;}else wsNpc.portrait=url;storageAdapter.markPortraitDirty();saveAll();},/* mark dirty on removal too (E28) */
      getOffset:npcGetOff,
      setOffset:npcSetOff,
      subject:npcSubject
    };
    document.getElementById("npc-avatar-btn").addEventListener("click",function(){var img=document.getElementById("npc-portrait-img");if(img&&img._wasDragged&&img._wasDragged())return;showPortraitModal(refreshNpcAvatar,npcPortOpts);});
  }
}
function _switchPlayerCharacter(name){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23 — a mid-flight swap mis-targets the response's tags and drops the handoff message
  // Find the NPC and their charSheet
  var npcIdx=-1,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){npcIdx=i;break;}}
  if(npcIdx<0){showToast("Companion not found.");return;}
  var npc=worldState.npcs[npcIdx];
  var newChar=npc.charSheet;
  if(!newChar){showToast(name+" has no character sheet. Generate one first.");return;}
  // Demote current player character to companion NPC
  var oldChar=worldState.character;
  var oldNpc={name:oldChar.name,status:"ally",rel:"companion",met:worldState.turn,partyMember:true,pronouns:pronounsForGender(oldChar.gender),portrait:null,portraitOffset:oldChar.portraitOffset||null,charSheet:oldChar}; // portrait rides on charSheet only (#3 dedupe); carry the framing (audit E60)
  // Swap
  worldState.npcs.splice(npcIdx,1);         // remove new char from npcs
  worldState.npcs.push(oldNpc);             // add old char as npc
  newChar.portraitOffset=newChar.portraitOffset||npc.portraitOffset||{x:0.5,y:0.5,zoom:1};/* UA22: adopt the npc-wrapper framing the NPC sheet was showing (npcGetOff's E60 fallback, mirrored) — else a promotion silently resets it to center */
  worldState.character=newChar;
  delete worldState.activePC;/* TODO #1 P2: the heavy anchor swap resets the light display pointer — the new hero IS the spotlight */
  // Mark the switch so buildSysPrompt re-injects a forceful POV-reassignment block for
  // the next couple of turns — the sessionLog is full of the OLD character as "you", and a
  // single handoff line can't overpower that momentum. Cleared in sendAction after ~2 turns.
  worldState.recentSwitch={to:newChar.name,from:oldChar.name,turn:worldState.turn};
  // Update knowledge graph link
  npcLinkUpsert(newChar.name,oldChar.name,"companions");
  // The swap re-homes portraits (PC<->companion) WITHOUT calling a portrait setter, so
  // the dirty flag stays false and the separate /portrait upload would be skipped mid-session
  // (_portraitSyncedOnce). Result: the server's portrait store keeps the pre-swap mapping and a
  // second device loads cross-wired portraits (new PC shows old PC's image). Mark dirty so the
  // next sync re-uploads {portrait: new PC, npcPortraits: {old PC: ...}}.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.markPortraitDirty)storageAdapter.markPortraitDirty();
  saveAll();syncUI();initAbilities();initSpells();
  showToast("Now playing as "+name+".");
  // Forceful, explicit control-reassignment directive — sent silently (it's out-of-character,
  // not a player action). The old handoff ("steps into the lead") read as narrative flavor and
  // never told the GM that the second-person referent had changed.
  var handoff="[CONTROL SWITCH — out-of-character instruction, NOT a player action] The player now controls "+newChar.name+". From this moment on, the player character IS "+newChar.name+": every second-person reference ('you', 'your') means "+newChar.name+", a "+(newChar.subraceNm?newChar.subraceNm+" ":"")+(newChar.ancestry||"")+" "+(newChar.cls||"")+". "+oldChar.name+" is now a non-player companion travelling with the party — refer to "+oldChar.name+" in the THIRD person by name, never as 'you'. The earlier story was told with "+oldChar.name+" as the player; that has changed. Give ONE brief in-world beat acknowledging "+newChar.name+" taking the lead, then continue the scene from "+newChar.name+"'s eyes.";
  sendAction(handoff,{silent:true});
}
// Read-only character-sheet viewer — renders any character object (e.g. a library snapshot)
// using the same cs-* styling as showCharSheet, with none of the live-game editing wiring.
// opts.onImport, if supplied, adds an Import button to the header.
function showReadOnlyCharSheet(c,opts){
  if(!c)return;
  opts=opts||{};
  var initials=csInitials(c.name||"?");
  var hdr=csHeroHeader(c);
  var importBtn=opts.onImport?"<button id='ro-cs-import' style='font-size:11px;font-family:var(--font);padding:4px 12px;border:none;border-radius:var(--r);background:var(--acc);color:var(--on-acc);font-weight:bold;cursor:pointer;'>Import</button>":"";
  var modal=modalShell("ro-cs-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'><span style='font-size:11px;color:var(--t2);font-style:italic;'>Character library snapshot &middot; read-only</span><div style='display:flex;gap:8px;align-items:center;'>"+importBtn+"<button id='ro-cs-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div></div>"
    +"<div class='cs-hero'>"
    +"<div style='position:relative;flex-shrink:0;'>"
    +"<div class='cs-avatar'>"+(c.portrait?"<img src='"+c.portrait+"' alt='"+escHtml(c.name||"")+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"</div>"
    +"</div>"
    +"<div class='cs-hero-info'>"
    +"<div class='cs-hero-name'>"+escHtml(c.name||"—")+"</div>"
    +"<div class='cs-hero-cls'>"+hdr.clsLine+"</div>"
    +"<div class='cs-hero-sub'>"+hdr.genderLbl+(c.age?" · "+c.age:"")+(c.deity?" · "+c.deity:"")+"</div>"
    +"<div style='margin-top:8px;font-size:13px;'>"
    +"<span style='color:var(--acc)'>Lv "+hdr.lvl+"</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+(c.hp!=null?c.hp:"—")+"/"+(c.maxHp!=null?c.maxHp:"—")+" HP</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+(c.gold!=null?c.gold:0)+" gp</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(c.actualAlignment||c.statedAlignment||"Neutral")+"</span>"
    +"</div>"
    +"<div class='cs-xp-wrap'>"
    +"<div class='cs-xp-lbl'><span>"+(c.xp||0)+" XP</span><span>"+(hdr.lvl<10?"Next: "+hdr.nextXP+" XP":"Max level")+"</span></div>"
    +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+hdr.xpPct+"%;'></div></div>"
    +"</div>"
    +"</div></div>"
    +csSheetSections(c),
    {z:420,align:"flex-start",overlayExtra:"overflow-y:auto;-webkit-overflow-scrolling:touch;",maxWidth:560,boxExtra:"margin:20px 0 40px;",closeId:"ro-cs-x",outside:true});
  if(opts.onImport){document.getElementById("ro-cs-import").addEventListener("click",function(){modal.remove();opts.onImport();});}
  csWireToggles(modal);
}
