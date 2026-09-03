// ui-panels.js — syncUI + the live game panels: HUD/sidebar, party, quests, inventory,
// abilities, spells, combat tracker, membar status + sync badge.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// ── UA21③: ONE derivation of a party member's vitals ─────────────────────────
// PURE (no DOM) — consumed by the three party renderers: updateHUD's compact cards +
// updatePartyPanel (this file) and _carUpdateParty (ui-carmode.js). Each renderer keeps
// its own markup AND its own color mapping: the HUD colors on the clamped/rounded pct
// (hp||0) at >50/>25 → grn/acc/red, Car Mode on the RAW ratio (default 1 when maxHp is
// missing) at >0.5/>0.25 → grn/warn/dng. Different semantics near the boundaries AND a
// different palette — deliberately NOT unified (pure-preservation pass; see lane-B notes).
// Fields (null when no sheet / no maxHp, matching each original guard):
//   name, sheet, hp (raw sheet.hp), maxHp, pct (HUD's clamped 0-100 int), ratio (Car's
//   raw fraction), cls (sheet.cls || npc.role fallback — the party panel's line 2).
/* #110 (v1.510): the one MP fragment for every party surface — "MP n/m" in mana blue, or ""
   for pool-less sheets. Parity rule (user, 2026-07-31): a player can hop control to any party
   member, so every surface that shows a member's HP shows their mana beside it. */
function _ppManaHtml(sheet){
  var mx=(typeof manaMax==="function"&&sheet)?manaMax(sheet):0;
  return mx>0?" <span style='color:var(--mana);flex-shrink:0;'>MP "+manaCur(sheet)+"/"+mx+"</span>":"";
}
function partyMemberVitals(npc){
  var sheet=npc.charSheet||null;
  return {
    name:npc.name,
    sheet:sheet,
    hp:sheet?sheet.hp:null,
    maxHp:sheet?sheet.maxHp:null,
    pct:(sheet&&sheet.maxHp)?Math.max(0,Math.min(100,Math.round((sheet.hp||0)/sheet.maxHp*100))):null,
    ratio:sheet?(sheet.maxHp?sheet.hp/sheet.maxHp:1):null,
    cls:sheet?(sheet.cls||""):(npc.role||""),
    /* #133c (user design 2026-08-04): a split member's vitals are UNKNOWN to the player — they're
       elsewhere. Renderers show "(split: location)" instead of HP/MP. Reads the SAME definitive
       charSheet.splitLoc the prompt/audit/auto-rejoin use — no second store, nothing to desync —
       and doubles as the standing visual tripwire on stale splits (the 166-turn Frizwick class
       would have been player-visible from turn one). Sheet MODAL stays complete (the record). */
    split:(sheet&&sheet.splitLoc&&sheet.splitLoc.location)?{location:sheet.splitLoc.location,sublocation:sheet.splitLoc.sublocation||null}:null
  };
}
var _cpanelWasActive=false;/* TODO #7: module-local previous-state latch — lets syncUI detect the hidden->shown edge (combat just started) instead of firing a sound on every sync while combat persists */
function syncUI(){_ensureLongPressTips();/* #83: idempotent — wires the mobile long-press tooltip once */if(!worldState)return;updateHUD();updatePartyPanel();updateQuestPanel();updateInvPanel();updateAbPanel(false);updateSpPanel();updateMemStatus();var _combatNowActive=!!worldState.combat;if(_combatNowActive){document.getElementById("cpanel").classList.add("active");updateCombat();}else{document.getElementById("cpanel").classList.remove("active");}if(_combatNowActive&&!_cpanelWasActive&&typeof Sound!=="undefined")Sound.play("click_glass");/* #7: combat starting is an attention event — same glass as quests/level-ups (no toast here, so no window contention) */_cpanelWasActive=_combatNowActive;if(typeof carMode!=="undefined"&&carMode&&typeof _carUpdate==="function")_carUpdate();/* rank 10 (todo_carplay) — keep the car overlay's portrait/party/vitals fresh off the same funnel every other panel uses */}
function updateQuestPanel(){
  if(!worldState)return;var ql=worldState.questLog||[];
  var live=[];for(var li=0;li<ql.length;li++){if(ql[li].status==="offered"||ql[li].status==="active")live.push(ql[li]);}
  var cntEl=document.getElementById("quest-cnt");if(cntEl)cntEl.textContent=live.length;
  var h="",i;
  for(i=0;i<live.length;i++){
    var q=live[i],offered=q.status==="offered",prog="";
    if(!offered&&q.objectives&&q.objectives.length){var done=0,oj;for(oj=0;oj<q.objectives.length;oj++)if(q.objectives[oj].done)done++;prog=" "+done+"/"+q.objectives.length;}
    h+="<div class='qp-item"+(offered?" off":"")+"' onclick='showQuestModal()' title='"+escHtml(q.desc||q.title)+"'>"
      +"<span class='qp-nm'>"+(offered?"⚑ ":"")+escHtml(q.title)+"</span>"
      +"<span class='qp-st'>"+(offered?"opportunity":("active"+prog))+"</span>"
      +"</div>";
  }
  var listEl=document.getElementById("quest-list");
  if(listEl){
    if(!h){
      /* #23② (owner request 2026-08-14): completed history lives in showQuestModal's History
         section, but with zero live quests the panel rendered a dead italic line — no clickable
         path to the journal at all. An archive-backed row restores the entry point. */
      h="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No active quests</div>";
      var _qk=(typeof memory!=="undefined"&&memory&&memory.quests)?Object.keys(memory.quests):[];
      if(_qk.length){
        var _qc=0,_qi2;for(_qi2=0;_qi2<_qk.length;_qi2++)if(memory.quests[_qk[_qi2]].status==="completed")_qc++;
        h+="<div class='qp-item' onclick='showQuestModal()' title='Open the quest journal'><span class='qp-nm'>✓ Completed quests</span><span class='qp-st'>"+_qc+"</span></div>";
      }
    }
    listEl.innerHTML=h;
  }
}
function updateHUD(){
  /* TODO #1 P2 (D6/D7): the hero slot shows activePlayer() — the spotlight PC — while the
     sidebar party section stays hero-anchored (playerBtn always opens the hero's sheet). */
  if(!worldState)return;var c=activePlayer(),hero=worldState.character,w=worldState.world;
  document.getElementById("hud-name").textContent=c.name;
  document.getElementById("hud-cls").textContent=(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" Lv"+c.level;
  document.getElementById("hud-hp").textContent=c.hp+"/"+c.maxHp+" HP";
  /* #110: mana rides beside HP — blue (var(--mana)), hidden entirely for pool-less characters */
  var _hudMana=document.getElementById("hud-mana");
  if(_hudMana){var _hmMx=(typeof manaMax==="function")?manaMax(c):0;
    _hudMana.style.display=_hmMx>0?"":"none";
    if(_hmMx>0)_hudMana.textContent=manaCur(c)+"/"+_hmMx+" MP";}
  document.getElementById("hud-gold").textContent=(c.gold!=null?c.gold:0)+" gp";/* companion sheets may lack gold */
  document.getElementById("hud-align").textContent=c.actualAlignment||c.statedAlignment||"Neutral";
  document.getElementById("hud-loc").textContent=pcEffectiveLoc(c).location;/* P5: camera follows the spotlight PC (a split PC shows THEIR location) */
  var xpEl=document.getElementById("hud-xp");if(xpEl){var nxp=classXpLevels()[c.level];/* C6 ② */var xpTxt=nxp!==undefined?c.xp+" / "+nxp+" xp":c.xp+" xp (max)";var prevXp=xpEl.getAttribute("data-xp");if(prevXp!==null&&prevXp!==String(c.xp)){xpEl.className="";void xpEl.offsetWidth;/* force reflow so the animation retriggers on rapid gains */xpEl.className="xp-pulse";setTimeout(function(){xpEl.className="";},900);}xpEl.setAttribute("data-xp",String(c.xp));xpEl.textContent=xpTxt;}
  // ── Party HUD (compact cards — second topbar row) ─────────────────────────
  var hudParty=document.getElementById("hud-party");
  if(hudParty){
    /* P2: the spotlight PC lives in the hero slot, so their card leaves the bar; the hero
       (when NOT spotlit) joins it as an ordinary card that opens showCharSheet. */
    var cards=[];
    if(c!==hero)cards.push({name:hero.name,vitals:{sheet:hero,hp:hero.hp,maxHp:hero.maxHp,pct:Math.max(0,Math.round((hero.hp/(hero.maxHp||1))*100))},status:"the hero",open:function(){showCharSheet();}});
    (worldState.npcs||[]).forEach(function(n){
      if(!n.partyMember)return;
      if(c!==hero&&n.name===c.name)return;/* spotlit companion is in the hero slot */
      /* v1.439 (F3, brief B): mood-else-relation-else-nothing — never the invented relation word
         "ally" in a MOOD slot (the same category error the v1.379 separation fixed) */
      cards.push({name:n.name,vitals:partyMemberVitals(n),status:n.status||n.rel||"",open:(function(nm){return function(){showNpcSheet(nm);};})(n.name)});
    });
    /* #172: WHY IS THE NARRATION IN THIRD PERSON. buildSysPrompt flips to the multiplayer
       third-person override whenever playerCount()>1, and until now the only place a second PC was
       visible was inside that companion's own sheet — so one forgotten hot-seat promotion silently
       narrated the whole campaign in third person with no indicator anywhere on the game screen
       (the field report that opened #172). The chip names the mode, names who caused it, and opens
       their sheet, where the PC/NPC toggle undoes it. Hidden entirely in ordinary single-player, so
       nothing changes for the common case. */
    var _extraPCs=(worldState.npcs||[]).filter(function(n){return n&&n.partyMember&&n.isPC&&!(typeof npcIsDead==="function"&&npcIsDead(n));});
    if(typeof playerCount==="function"&&playerCount()>1&&_extraPCs.length){
      var mpChip=document.createElement("div");
      mpChip.id="hud-mp-chip";
      mpChip.title="Multiple player characters are active, so the GM narrates everyone by name in third person instead of \"you\". Click to open "+_extraPCs[0].name+"'s sheet and switch them back to a companion.";
      mpChip.style.cssText="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;padding:2px 8px;border-radius:12px;background:#221a10;border:1px solid var(--acc);color:rgba(255,255,255,.75);";
      mpChip.innerHTML="<span style='color:var(--acc);font-weight:bold;'>⚑ "+playerCount()+" players</span>"
        +"<span style='color:var(--t2);'>third-person narration · "+escHtml(_extraPCs.map(function(n){return n.name;}).join(", "))+"</span>";
      mpChip.addEventListener("click",(function(nm){return function(){showNpcSheet(nm);};})(_extraPCs[0].name));
      cards.unshift({__el:mpChip});
    }
    if(cards.length){
      hudParty.style.display="flex";hudParty.innerHTML="";
      for(var pi=0;pi<cards.length;pi++){
        if(cards[pi].__el){hudParty.appendChild(cards[pi].__el);continue;}
        var pm=cards[pi],pv=pm.vitals,pmSheet=pv.sheet;/* UA21③ */
        var card=document.createElement("div");
        card.style.cssText="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t1);cursor:pointer;padding:2px 8px 2px 6px;border-radius:var(--r);background:var(--bg2);border:1px solid var(--brd);";
        card.addEventListener("click",pm.open);/* P2: hero card opens showCharSheet, companions showNpcSheet */
        /* P5: location chip when this member's effective location differs from the spotlight PC's */
        var pmLoc=pcEffectiveLoc(pv.sheet),actLoc=pcEffectiveLoc(c);
        var locChip=(!pv.split&&pmLoc.location&&pmLoc.location!==actLoc.location)?"<span style='color:var(--t2);font-size:9px;flex-shrink:0;'>· "+escHtml(pmLoc.location)+"</span>":"";/* #133c: the split text below names the place — no double chip */
        var nameSpan="<span style='color:var(--t0);font-weight:bold;max-width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:inline-block;'>"+escHtml(pm.name)+"</span>"+locChip;
        if(pv.split){/* #133c: vitals unknown while elsewhere */
          card.innerHTML=nameSpan+"<span style='color:var(--acc);font-size:10px;flex-shrink:0;'>(split: "+escHtml(pv.split.location)+")</span>";
        }else if(pmSheet&&pmSheet.maxHp){
          var pct=pv.pct;
          var hpClr=pct>50?"var(--grn)":pct>25?"var(--acc)":"var(--red)";/* HUD mapping — Car Mode's differs, kept separate (UA21③) */
          var pmXpHtml="";if(pmSheet.xp!==undefined&&pmSheet.level!==undefined){var pmNextXp=classXpLevels()[pmSheet.level];/* C6 ② */pmXpHtml="<span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-left:2px;'>"+pmSheet.xp+"/"+(pmNextXp!==undefined?pmNextXp:"max")+" xp</span>";}
          card.innerHTML=nameSpan
            +"<div style='width:48px;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;flex-shrink:0;'>"
            +"<div style='width:"+pct+"%;height:100%;background:"+hpClr+";border-radius:3px;'></div></div>"
            +"<span style='color:var(--hp);flex-shrink:0;'>"+(pv.hp||0)+"/"+pv.maxHp+"</span>"
            +_ppManaHtml(pmSheet)/* #110: card MP chip, blue beside the red HP */
            +pmXpHtml;
        }else{
          card.innerHTML=nameSpan+"<span style='color:var(--t2);'>"+escHtml(pm.status||"")+"</span>";/* v1.439 (F3): card status already resolved mood-else-rel above */
        }
        hudParty.appendChild(card);
      }
    }else{
      hudParty.style.display="none";
    }
  }
  function sr(k,v){return'<div class="sb-row"><span class="sb-k">'+k+'</span><span class="sb-v">'+v+'</span></div>';}
  var sb=document.getElementById("sb-content");if(!sb)return;
  var i;
  // ── NPCs (non-party) ─────────────────────────────────────────────────────
  /* v1.439 (F3, brief B): present-parts render — the old concat printed "undefined / rel" for an
     absent mood and a dangling " / " for the now-legal empty one (same fix class as api.js:479) */
  /* #96 follow-up (2026-07-26): non-party rows are CLICKABLE → showNpcSheet — before this there
     was NO UI path to a non-party NPC's sheet at all, so one could never be generated and voice
     casting had nothing to resolve against ("why does Hemlock read as the narrator?"). Same
     data-npc + delegated-binding pattern as the party rows below (escHtml covers the attribute). */
  var npcR="";for(i=0;i<worldState.npcs.length;i++){if(!worldState.npcs[i].partyMember){var _sbBits=[];if(worldState.npcs[i].status)_sbBits.push(worldState.npcs[i].status);if(worldState.npcs[i].rel&&worldState.npcs[i].rel!=="unknown")_sbBits.push(worldState.npcs[i].rel);npcR+='<div class="sb-row sb-npc-row" data-npc="'+escHtml(worldState.npcs[i].name)+'" style="cursor:pointer;" title="Open '+escHtml(worldState.npcs[i].name)+'’s sheet"><span class="sb-k">'+escHtml(worldState.npcs[i].name)+'</span><span class="sb-v">'+escHtml(_sbBits.join(" / ")||"—")+'</span></div>';}}
  var qR="",qOffered=0;for(i=0;i<worldState.questLog.length;i++){var _q=worldState.questLog[i];if(_q.status==="offered")qOffered++;qR+="<div class='sb-row' style='cursor:pointer;' onclick='showQuestModal()'><span class='sb-k'>"+escHtml(_q.title)+"</span><span class='sb-v'>"+escHtml(_q.status)+"</span></div>";}
  var questSec=worldState.questLog.length?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;cursor:pointer;" onclick="showQuestModal()">Quests'+(qOffered?' &middot; <span style="color:var(--warn);">⚑ '+qOffered+' opportunit'+(qOffered>1?'ies':'y')+'</span>':'')+'</div>'+qR+'</div>':"";
  // Factions
  var facR="";if(memory&&memory.npcGraph&&memory.npcGraph.factions){var facNames=Object.keys(memory.npcGraph.factions);if(facNames.length){for(var fi=0;fi<facNames.length;fi++){var fn=facNames[fi],fd=memory.npcGraph.factions[fn];facR+=sr(escHtml(fn),escHtml(fd.desc||"faction"));}}}
  sb.innerHTML='<div class="sb-sec" id="sb-party-sec" style="border-top:1px solid var(--brd);padding-top:14px;"></div>'
    +'<div class="sb-sec">'+sr(escHtml("Location"),escHtml(w.location))+sr(escHtml("Time"),escHtml(worldTimeDisplay()))+sr(escHtml("Weather"),escHtml(w.weather))+'</div>'
    +(npcR?'<div class="sb-sec">'+npcR+'</div>':"")
    +(facR?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;">Factions</div>'+facR+'</div>':"")
    +questSec;
  // ── Party section — built programmatically to avoid onclick string escaping ──
  var partySec=document.getElementById("sb-party-sec");
  Array.prototype.forEach.call(sb.querySelectorAll(".sb-npc-row[data-npc]"),function(r){r.addEventListener("click",function(){showNpcSheet(r.getAttribute("data-npc"));});});/* #96: non-party NPC rows open the sheet (offers Generate when none exists) */
  var playerBtn=document.createElement("button");playerBtn.className="sb-party-btn sb-pb-player";playerBtn.textContent=hero.name;/* P2: hero-anchored — always the hero's sheet, whoever holds the spotlight */playerBtn.addEventListener("click",showCharSheet);partySec.appendChild(playerBtn);
  for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].partyMember){(function(nm){var btn=document.createElement("button");btn.className="sb-party-btn";btn.textContent=nm;btn.addEventListener("click",function(){showNpcSheet(nm);});partySec.appendChild(btn);})(worldState.npcs[i].name);}}
}
function updatePartyPanel(){
  if(!worldState)return;
  /* TODO #1 P2 (D6/D7): the spotlight PC leads the list as "YOU"; the hero (when not spotlit)
     drops to an ordinary row that opens showCharSheet. Writes untouched — display routing only. */
  var c=activePlayer(),hero=worldState.character;
  var npcs=(worldState.npcs||[]).filter(function(n){return n.partyMember&&n.name!==c.name;});
  var pss=document.getElementById("pss-party");if(!pss)return;
  pss.style.display="";
  document.getElementById("party-cnt").textContent=(c!==hero?1:0)+1+npcs.length;/* spotlit companion left npcs[], hero re-enters as a row — total unchanged */
  var h="",i,m,pv,hp,maxHp,cls;
  // Spotlight PC always first
  h+="<div "+(c===hero?"onclick='showCharSheet()'":"class='party-row' data-npc='"+escHtml(c.name)+"'")+" style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
    +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(c.name)+" <span style='color:var(--t2);font-weight:normal;font-size:9px;'>YOU</span></div>"
    +"<div style='font-size:10px;color:var(--t2);'>"+escHtml(c.cls||"")+"</div>"
    +"<div style='font-size:10px;'><span style='color:var(--hp);'>HP "+c.hp+"/"+c.maxHp+"</span>"+_ppManaHtml(c)+"</div>"
    +"</div>";
  if(c!==hero){
    h+="<div onclick='showCharSheet()' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(hero.name)+"</div>"
      +"<div style='font-size:10px;color:var(--t2);'>"+escHtml(hero.cls||"")+"</div>"
      +"<div style='font-size:10px;'><span style='color:var(--hp);'>HP "+hero.hp+"/"+hero.maxHp+"</span>"+_ppManaHtml(hero)+"</div>"
      +"</div>";
  }
  var _ppActLoc=pcEffectiveLoc(c);/* P5: chip reference — where the spotlight PC is */
  for(i=0;i<npcs.length;i++){
    m=npcs[i];pv=partyMemberVitals(m);/* UA21③ */
    hp=pv.hp;maxHp=pv.maxHp;cls=pv.cls;
    var _ppLoc=pcEffectiveLoc(m.charSheet);
    var _ppChip=(!pv.split&&_ppLoc.location&&_ppLoc.location!==_ppActLoc.location)?" <span style='color:var(--t2);font-weight:normal;font-size:9px;'>· "+escHtml(_ppLoc.location)+"</span>":"";/* #133c: split line names the place — no double chip */
    // data-npc + delegated wiring below (audit E69) — an inline onclick with the name in a JS string
    // literal breaks when the name contains a double quote (escHtml's &quot; decodes back to ").
    h+="<div class='party-row' data-npc='"+escHtml(m.name)+"' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(m.name)+_ppChip+"</div>"
      +(cls?"<div style='font-size:10px;color:var(--t2);'>"+escHtml(cls)+"</div>":"")
      +(pv.split?"<div style='font-size:10px;color:var(--acc);'>(split: "+escHtml(pv.split.location+(pv.split.sublocation?" — "+pv.split.sublocation:""))+")</div>"
        :(hp!==null?"<div style='font-size:10px;'><span style='color:var(--hp);'>HP "+hp+(maxHp?"/"+maxHp:"")+"</span>"+(pv.sheet?_ppManaHtml(pv.sheet):"")+"</div>":""))
      +"</div>";
  }
  var _pl=document.getElementById("party-list");_pl.innerHTML=h;
  Array.prototype.forEach.call(_pl.querySelectorAll(".party-row[data-npc]"),function(r){r.addEventListener("click",function(){showNpcSheet(r.getAttribute("data-npc"));});});
}
// #32: inventory entries are plain strings, often "Name — description" or "Name (description)".
// Bold the NAME segment only (split at the first spaced dash or opening paren) so lists scan;
// the description stays regular. No separator = the whole entry is the name.
function invItemHtml(s){
  s=String(s);
  // #50(b): render stacked quantities as "Blasting charge (4)" instead of the stored "x4"
  // suffix — DISPLAY transform only; the stored format and the stacking parsers are untouched.
  var _qty=null,_qm=s.match(/^(.*?)\s+x(\d+)\s*$/);
  if(_qm){s=_qm[1];_qty=_qm[2];}
  var _qh=_qty?"<span style='opacity:.7'> ("+_qty+")</span>":"";
  // Name/description split at the EARLIEST of: spaced dash, opening paren, comma, or a
  // clause lead-in word — GM-written entries carry free-prose descriptions with no dash
  // ("Small river stone, smooth…", "Folded camp kit including a second ground cloth…",
  // "Letter of introduction written in a dead contractual script"). The lead-in list is
  // whack-a-mole by design (2026-07-04 user call: report new escapes as they show up).
  var m=s.match(/^(.*?)(\s+[—–-]\s+|\s*\(|,\s+|\s+(?:with|including|containing|written|engraved|carved|marked|labeled|labelled|covered|wrapped|bearing|holding|filled|etched|inscribed|stamped)\s+)/);
  if(!m)return "<b>"+escHtml(s)+"</b>"+_qh;
  return "<b>"+escHtml(m[1])+"</b><span style='opacity:.8'>"+escHtml(s.slice(m[1].length))+"</span>"+_qh;
}
/* #157: ephemeral per-page collapse state for the inventory category sections — keyed by
   category id, default OPEN so nothing hides on first use. Deliberately NOT persisted: this is
   page UI state, never campaign state (Sol §6.2). */
var _invSecOpen={};
function invToggleSec(id){_invSecOpen[id]=(_invSecOpen[id]===false);updateInvPanel();}
/* Tooltip suffix for multi-category items — the row renders ONCE (highest-priority section);
   the tooltip names the rest: "Categories: Weapon, Quest · Filed under: Weapons" (Sol §6.1). */
function _invTipCats(row,filedId){
  if(!row.categories||row.categories.length<2)return"";
  var lbl={},i;for(i=0;i<INVENTORY_CATEGORY_REGISTRY.length;i++)lbl[INVENTORY_CATEGORY_REGISTRY[i].id]=INVENTORY_CATEGORY_REGISTRY[i].label;
  var names=[];for(i=0;i<row.categories.length;i++)names.push(lbl[row.categories[i]]||row.categories[i]);
  return "\nCategories: "+names.join(", ")+" · Filed under: "+(lbl[filedId]||filedId);
}
function updateInvPanel(){
  if(!worldState)return;var _ap=activePlayer(),inv=_ap.inventory||[],gold=(_ap.gold!=null?_ap.gold:0);/* P2: panel follows the spotlight PC */
  document.getElementById("inv-cnt").textContent=inv.length;/* badge stays the stored-row count — never the stack sum (Sol §6.2) */
  document.getElementById("inv-gold").textContent=gold+" gp";
  /* #157: item-bible-driven grouping through the ONE shared view model — the old substring
     weapon/armor guess is retired (canon decides; a miss shows honestly as Unclassified).
     Weapon/armor row emphasis (.eq) now derives from the SELECTED canonical section. */
  var groups=groupInventory(inv),h="",i,j;
  for(i=0;i<groups.length;i++){
    var grp=groups[i],open=_invSecOpen[grp.id]!==false,unc=grp.id==="unclassified";
    h+='<div class="inv-cat'+(unc?' unc':'')+' has-tip" data-sec="'+grp.id+'" onclick="invToggleSec(this.dataset.sec)"'+(unc?' title="These items have no item-bible classification yet — they are shown here rather than guessed (#157)"':'')+'>'+(open?"&#9662; ":"&#9656; ")+escHtml(grp.label)+' <span class="inv-cat-n">'+grp.rows.length+"</span></div>";
    if(!open)continue;
    for(j=0;j<grp.rows.length;j++){
      var row=grp.rows[j],eq=(grp.id==="weapon"||grp.id==="armor");
      /* #295: every item row opens the item-bible click-card (showItemCard, ui-sheets) — same
         canon as the hover tooltip, readable on touch where title-tooltips need a long-press. */
      h+='<div class="ii has-tip'+(eq?' eq':'')+'" data-item="'+escHtml(row.raw)+'" onclick="showItemCard(this.dataset.item)" style="cursor:pointer;" title="'+escHtml(itemTip(row.raw)+_invTipCats(row,grp.id))+'">'+invItemHtml(row.raw)+'</div>';
    }
  }
  document.getElementById("inv-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">Empty</div>';
}
function updateAbPanel(hl){
  if(!worldState)return;var abs=activePlayer().abilities||[];/* P2: follows the spotlight PC */document.getElementById("ab-cnt").textContent=abs.length;
  var h="",i;for(i=0;i<abs.length;i++){h+='<div class="ai'+(hl&&i===abs.length-1?" nw":"")+'"><span class="an">'+escHtml(abs[i].nm)+'</span><span class="ad">'+escHtml(abs[i].ds)+'</span></div>';}/* GM-authored ability text (audit E11) */
  document.getElementById("ab-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">None yet</div>';
}
// #8: side-panel spell tooltip — the description pulled from the capability bible (the SAME
// canon the GM is fed and the click-card shows; one data source). #83: a spell with no bible
// entry (a GM-granted spell, say) falls back to the explicit "no description available" line
// rather than nothing — most spells ARE covered, so the fallback is rare.
function spellTip(nm){
  var e=(typeof capabilityLookup==="function")?capabilityLookup(nm):null;
  if(e){
    var meta=[];
    if(e.range&&e.range!=="N/A")meta.push("Range: "+e.range);
    if(e.duration&&e.duration!=="N/A")meta.push("Duration: "+e.duration);
    if(e.save&&e.save!=="N/A")meta.push("Save: "+e.save);
    var body=(meta.length?meta.join(" · ")+"\n":"")+(e.effect||"");
    if(body.replace(/\s/g,""))return body;
  }
  return "no description available for: "+String(nm||"");
}
// #83/#82: inventory item tooltip — DATA GAP CLOSED by #81: itemLookup resolves the carried
// string (player-confirmed overlay first, then the curated ITEM_BIBLE base) and shows the
// fixed-attribute definition. The fallback survives for genuine misses — most flavor items
// are deliberately uncurated (curation is the user's editor pass).
function itemTip(nm){
  var e=(typeof itemLookup==="function")?itemLookup(nm):null;
  if(e)return e.category+(e.effect!=="N/A"?" — "+e.effect:"")+(e.uses!=="N/A"?"\nUses: "+e.uses:"")+(e.value!=="N/A"?"\nValue: "+e.value:"");
  return "no description available for: "+String(nm||"");
}
// #80: clicking a side-panel spell appends "Cast <name>." to the input (a quick-cast affordance;
// the player still edits/sends). Name rides a data attribute (escHtml'd, so apostrophes like
// "Hunter's Mark" can't break the handler); appends with a space when the box already has text.
function spellQuickCast(el){
  var nm=el&&el.getAttribute("data-cast");if(!nm)return;
  var inp=document.getElementById("action-input");if(!inp)return;
  var add="Cast "+nm+".";
  var cur=String(inp.value||"").replace(/\s+$/,"");
  inp.value=cur?cur+" "+add:add;
  inp.focus();
}
// ── #83: long-press → tooltip on mobile ──────────────────────────────────────────────────────
// On touch there is no hover, so the desktop `title` tooltips (spells #8, inventory) are invisible,
// and a long-press pops the native text-selection/copy callout. We suppress that callout on
// .has-tip elements (CSS: -webkit-touch-callout:none + user-select:none) and detect a long-press
// ourselves: a ~500ms hold shows a custom tooltip carrying the element's OWN title text (one
// source, two surfaces — native hover on desktop, this on touch). The tap that follows a fired
// long-press is swallowed in the capture phase so a spell long-press never ALSO casts.
var _lpTipEl=null,_lpTimer=null,_lpFired=false,_lpWired=false;
function _lpClearTimer(){if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}}
function _lpHide(){if(_lpTipEl)_lpTipEl.style.display="none";}
function _lpShow(text){
  if(!_lpTipEl){_lpTipEl=document.createElement("div");_lpTipEl.className="lp-tip";document.body.appendChild(_lpTipEl);}
  _lpTipEl.textContent=text;_lpTipEl.style.display="block";
  /* Centered on screen (CSS handles left/top/transform) — the finger is on the chip, well clear
     of the middle, so a center-screen peek is never covered (user call). */
}
function _ensureLongPressTips(){
  if(_lpWired||typeof document==="undefined")return;_lpWired=true;
  document.addEventListener("touchstart",function(e){
    _lpFired=false;_lpClearTimer();_lpHide();/* a fresh gesture: drop any stale state + hide a shown tip */
    var el=e.target&&e.target.closest?e.target.closest(".has-tip"):null;if(!el)return;
    var tip=el.getAttribute("title")||el.getAttribute("data-tip");if(!tip)return;
    _lpTimer=setTimeout(function(){_lpFired=true;_lpShow(tip);},500);
  },{passive:true});
  document.addEventListener("touchmove",_lpClearTimer,{passive:true});
  // Release hides the tooltip — "hold to peek, lift to dismiss". _lpFired stays set so the
  // capture-phase click handler below still swallows the tap that follows a fired long-press.
  document.addEventListener("touchend",function(){_lpClearTimer();_lpHide();},{passive:true});
  document.addEventListener("touchcancel",function(){_lpClearTimer();_lpHide();},{passive:true});
  // Capture-phase: if a long-press just fired, eat the synthetic click so the tap action
  // (e.g. spellQuickCast) does NOT also run. One-shot — reset so later real taps pass through.
  document.addEventListener("click",function(e){if(_lpFired){_lpFired=false;e.stopPropagation();e.preventDefault();}},true);
  document.addEventListener("scroll",_lpHide,true);
}
// #80: clicking a side-panel spell appends "Cast <name>." to the input (a quick-cast affordance;
// the player still edits/sends). Name rides a data attribute (escHtml'd, so apostrophes like
// "Hunter's Mark" can't break the handler); appends with a space when the box already has text.
function spellQuickCast(el){
  var nm=el&&el.getAttribute("data-cast");if(!nm)return;
  var inp=document.getElementById("action-input");if(!inp)return;
  var add="Cast "+nm+".";
  var cur=String(inp.value||"").replace(/\s+$/,"");
  inp.value=cur?cur+" "+add:add;
  inp.focus();
}
function updateSpPanel(){
  if(!worldState)return;
  var _ap=activePlayer(),spells=_ap.spells||[];/* P2: follows the spotlight PC */
  /* #110: the header counts MANA, not slots — availability is the pool. The per-spell "used"
     style now marks only the racial 1/day hard gate; a pooled spell is castable while the
     pool covers its tier, however many times it was cast today. */
  var _spMx=(typeof manaMax==="function")?manaMax(_ap):0;
  document.getElementById("sp-cnt").textContent=_spMx>0?(manaCur(_ap)+"/"+_spMx+" mana"):(spells.length+"");
  var h="",i,sp,tag,nm,ds;
  for(i=0;i<spells.length;i++){
    sp=spells[i];
    tag=sp.lvl===0?"C":String(sp.lvl);
    nm=sp.nm.indexOf("(")>=0?sp.nm.slice(0,sp.nm.indexOf("(")).trim():sp.nm;
    ds=sp.nm.indexOf("(")>=0?sp.nm.slice(sp.nm.indexOf("(")+1).replace(")",""):"";
    var _tip=spellTip(nm);/* #8 bible description; #83 always non-empty (fallback) */
    var _gated=sp.racial&&sp.used&&sp.lvl>0;/* the 1/day heritage gate — the one per-spell state left */
    h+="<div class='sp-item has-tip"+(_gated?" used":"")+"' data-cast=\""+escHtml(nm)+"\" onclick=\"spellQuickCast(this)\" title=\""+escHtml(_tip)+"\" style='cursor:pointer;'>";/* #8 tooltip + #80 click-to-cast + #83 long-press */
    h+="<span class='sp-nm'>["+tag+"] "+escHtml(nm)+"</span>";/* GM-grantable spell names (#22/UA18) */
    if(ds||_gated)h+="<span class='sp-ds'>"+escHtml(ds||"")+(_gated?" -- 1/day, expended":"")+"</span>";
    h+="</div>";
  }
  if(!h)h="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No spells</div>";
  /* P2: restSpells() writes the HERO's spells — hide the button while a companion PC holds the
     spotlight, or resting would restore the wrong sheet (writes stay on their true owner). */
  else if(_ap===worldState.character)h+="<button onclick='restSpells()' style='width:100%;margin-top:6px;padding:5px;font-size:10px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Rest (restore mana)</button>";
  document.getElementById("sp-list").innerHTML=h;
}
function updateCombat(){
  // UA26 multi-foe panel (MULTI_ENEMY_COMBAT §5): one compact row per foe, living first; down
  // foes struck through + dimmed, no bar; cap 4 rows + "+N more" (mobile #cpanel is shallow).
  // The statblock renders for the ENGAGED foe (else the first living foe that has stats).
  // Names/morale/immunities are model-authored — escHtml every sink.
  if(!worldState||!worldState.combat)return;
  var cm=worldState.combat,pc=activePlayer();/* P2: the player HP row tracks the spotlight PC */
  document.getElementById("ct-round").textContent="Round "+cm.round;
  var rows=document.getElementById("en-rows");
  if(rows){
    var foes=cm.foes||[],living=[],downs=[],fi;
    for(fi=0;fi<foes.length;fi++){if(!foes[fi].down&&foes[fi].hp>0)living.push(foes[fi]);else downs.push(foes[fi]);}
    var ordered=living.concat(downs),h="",sbFoe=null;
    /* Shared name-column width so every HP bar starts at the SAME x (owner report, t2075: the
       per-row flex widths from the v1.673 truncation fix left each bar's left edge where its own
       name happened to end). Measure the longest VISIBLE name with the real computed font via a
       scratch .cname (width:auto), clamp to [80px, 45% of the panel], publish as --cnw; the CSS
       width:var(--cnw) puts every row — foes, downed, and the player — on one column edge, with
       ellipsis still guarding names past the cap. */
    var _cp=document.getElementById("cpanel");
    if(_cp){
      var _ms=document.createElement("span");_ms.className="cname";
      _ms.style.cssText="position:absolute;visibility:hidden;width:auto;max-width:none;";
      _cp.appendChild(_ms);
      var _mw=80,_mn=[],_mi;
      for(_mi=0;_mi<ordered.length&&_mi<4;_mi++)_mn.push((cm.engaged===ordered[_mi].name?"◆ ":"")+ordered[_mi].name);
      _mn.push((pc&&pc.name)||"You");
      for(_mi=0;_mi<_mn.length;_mi++){_ms.textContent=_mn[_mi];var _w=_ms.offsetWidth;if(_w>_mw)_mw=_w;}
      _cp.removeChild(_ms);
      var _cap=Math.floor(_cp.clientWidth*0.45)||_mw;
      _cp.style.setProperty("--cnw",Math.min(_mw+2,_cap)+"px");/* +2: breathing room so the widest name never kisses its own ellipsis */
    }
    for(fi=0;fi<ordered.length&&fi<4;fi++){var f=ordered[fi];
      if(!f.down&&f.hp>0){
        var pct=Math.max(0,Math.round((f.hp/(f.maxHp||f.hp||1))*100));
        h+="<div class='crow'><span class='cname en' title='"+escHtml(f.name)+(cm.engaged===f.name?" — engaged":"")+"'>"+(cm.engaged===f.name?"◆ ":"")+escHtml(f.name)+"</span><div class='hbw'><div class='hb eb' style='width:"+pct+"%'></div></div><span class='hpt'>"+f.hp+"/"+f.maxHp+"</span>"+(f.morale?"<span class='mbdg'>"+escHtml(f.morale)+"</span>":"")+"</div>";
        if(!sbFoe&&f.stats&&cm.engaged===f.name)sbFoe=f;
      }else{
        h+="<div class='crow' style='opacity:.45'><span class='cname en' style='text-decoration:line-through'>"+escHtml(f.name)+"</span><span class='hpt' style='width:auto'>"+escHtml(f.down||"slain")+"</span></div>";
      }
    }
    if(ordered.length>4)h+="<div style='font-size:10px;color:var(--t2);margin-bottom:4px;'>+"+(ordered.length-4)+" more</div>";
    if(!sbFoe){for(fi=0;fi<living.length;fi++){if(living[fi].stats){sbFoe=living[fi];break;}}}
    if(sbFoe){
      var sbh="";
      var sm2=function(v){var m=Math.floor((v-10)/2);return(m>=0?"+":"")+m;};
      if(sbFoe.stats){
        sbh+=(living.length>1?"<span style='color:var(--t1);'>"+escHtml(sbFoe.name)+":</span> ":"")
            +"STR "+sbFoe.stats.STR+"("+sm2(sbFoe.stats.STR)+") "
            +"DEX "+sbFoe.stats.DEX+"("+sm2(sbFoe.stats.DEX)+") "
            +"CON "+sbFoe.stats.CON+"("+sm2(sbFoe.stats.CON)+") "
            +"INT "+sbFoe.stats.INT+"("+sm2(sbFoe.stats.INT)+") "
            +"WIS "+sbFoe.stats.WIS+"("+sm2(sbFoe.stats.WIS)+") "
            +"CHA "+sbFoe.stats.CHA+"("+sm2(sbFoe.stats.CHA)+") "
            +"<span style='color:var(--acc);'>CR "+sbFoe.stats.CR+"</span>";
      }
      if(sbFoe.immune&&sbFoe.immune.length)sbh+="<span style='color:var(--hp);margin-left:8px;'>Immune: "+escHtml(sbFoe.immune.join(", "))+"</span>";
      if(sbFoe.resist&&sbFoe.resist.length)sbh+="<span style='color:var(--t2);margin-left:8px;'>Resist: "+escHtml(sbFoe.resist.join(", "))+"</span>";
      if(sbFoe.vuln&&sbFoe.vuln.length)sbh+="<span style='color:var(--acc);margin-left:8px;'>Vuln: "+escHtml(sbFoe.vuln.join(", "))+"</span>";
      if(sbh)h+="<div style='font-size:10px;color:var(--t2);padding:2px 0 4px;line-height:1.7;font-family:var(--font);'>"+sbh+"</div>";
    }
    rows.innerHTML=h;
  }
  document.getElementById("pl-name").textContent=pc.name;
  document.getElementById("pl-hpt").textContent=pc.hp+"/"+pc.maxHp;
  document.getElementById("pl-hpbar").style.width=Math.max(0,Math.round((pc.hp/pc.maxHp)*100))+"%";
}
// Compact model label for the session bar: drop the vendor prefix and a trailing date stamp
// ("claude-haiku-4-5-20251001" → "haiku-4-5"); non-Claude ids (gpt-4o, grok-4.3) pass through.
function activeModelLabel(){
  var prov=(typeof PROVIDERS!=="undefined"&&PROVIDERS[activeProvider])||null;if(!prov)return"";
  var m=(typeof providerModels!=="undefined"&&providerModels[activeProvider])||prov.defaultModel||"";
  return String(m).replace(/^claude-/,"").replace(/-20\d{6}$/,"");
}
function updateMemStatus(){if(!worldState)return;var dot=document.getElementById("memdot"),txt=document.getElementById("memstatus");var t=sessionTokens();dot.className=t>=SUMMARIZE_AT?"mdot c":t>=SUMMARIZE_AT*0.8?"mdot w":"mdot";var actPart="",sk=worldState.skeleton,i;if(sk&&sk.acts){for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="active"){var at=sk.acts[i].title;actPart=" | "+(/^act\s/i.test(at)?at:"Act "+(i+1)+": "+at);break;}}}var mdl=activeModelLabel();
// #73 campaign clock: show the in-game day next to the turn counter. Same day number the clock
// block feeds the GM (clockDayNumber) so player and GM never see a contradictory day. Elapsed
// since the clock's epoch (campaign start / migration), so a save that predates the clock reads
// "Day 1" until time is advanced — accurate, not a bug.
// #106b: the wall-clock time rides alongside the day, via the SAME clockStamp() the turn caption
// uses — one formatter, so the session bar and the story frames can never disagree about the hour.
// #106c: the fallback routes through clockDayNumber too, or a missing clockStamp would silently
// hand the player the 0-based number the rest of the app stopped using.
var dayPart=(typeof clockStamp==="function")?" | "+clockStamp():
  ((typeof clockDayNumber==="function")?" | Day "+clockDayNumber():"");
txt.textContent="Memory ~"+(t>=1000?(t/1000).toFixed(1)+"k":t)+" tokens"+actPart+" | Chapters: "+memory.chapters.length+" | NPCs: "+Object.keys(memory.npcs).length+" | Turn "+worldState.turn+dayPart+" | "+APP_VERSION+(mdl?" | "+mdl:"");updateSyncBadge();updateHealthDot();}
// #17 drift-health dot — thin shell over healthIndicators (helpers.js, engine-tested there).
// Same green/amber/red classes as the token dot beside it; n/a dims. Click opens the modal.
function updateHealthDot(){
  var d=document.getElementById("healthdot");if(!d)return;
  if(!worldState||typeof healthIndicators!=="function"){d.style.display="none";return;}
  var h=healthIndicators(worldState);
  if(h.overall==="bad"){
    /* owner ruling 2026-08-14: a 6px red dot under-sells a real problem — bad renders as a SOLID
       red warning triangle with a white '!' (inline SVG; the ⚠ text glyph is outline-only).
       warn/ok/na keep the dot family. */
    d.className="";
    d.innerHTML="<svg width='12' height='12' viewBox='0 0 12 12' style='display:block;'><path d='M6 1 L11.3 10.8 L0.7 10.8 Z' fill='var(--red)' stroke='var(--red)' stroke-width='1' stroke-linejoin='round'/><text x='6' y='9.6' text-anchor='middle' font-size='7.5' font-weight='bold' fill='#fff'>!</text></svg>";
    d.style.cssText="display:inline-block;margin-left:4px;line-height:0;cursor:pointer;";
  }else{
    d.textContent="";
    d.className=h.overall==="warn"?"mdot w":"mdot";
    d.style.cssText="display:inline-block;margin-left:4px;cursor:pointer;"+(h.overall==="na"?"opacity:0.35;":"");
  }
  d.title="Story health: "+(h.overall==="na"?"not enough data yet":h.overall)+" — tap for detail";
  if(!d._wired){d._wired=true;d.onclick=function(){if(typeof showHealthModal==="function")showHealthModal();};}
}
// Sync failure badge (TODO #24) — red ☁ in the membar whenever the server-ACKed turn lags
// the local turn or syncs are failing. Called from updateMemStatus (every turn) AND directly
// by the storage adapter on every sync success/failure, so it never waits for a turn to refresh.
function updateSyncBadge(){
  var mb=document.getElementById("membar");if(!mb)return;
  var el=document.getElementById("syncbadge");
  var st=(typeof storageAdapter!=="undefined"&&storageAdapter.syncStatus)?storageAdapter.syncStatus():null;
  var show=st&&st.serverMode&&(st.failing||st.unsynced>0||st.conflict);
  if(!show){if(el)el.style.display="none";return;}
  if(!el){el=document.createElement("span");el.id="syncbadge";el.style.cssText="margin-left:10px;font-size:11px;color:var(--dng);font-weight:bold;cursor:pointer;";mb.appendChild(el);}
  el.style.display="inline";
  // #7② (#23① sweep): the badge is TAPPABLE — title tooltips are invisible on mobile, which is
  // exactly where the badge was missed twice in the field. A tap surfaces the explanation as a
  // toast; when the failure is an expired session (401), the tap runs the reconnect flow itself.
  el.onclick=function(){
    if(st.authExpired&&typeof connectToServer==="function"){showToast("Reconnecting to the server…");connectToServer();return;}
    if(typeof showToast==="function")showToast(el.title);
  };
  if(st.conflict){/* CAS 409 (Known issue #5) — sticky pause, distinct from ordinary failures */
    el.textContent="☁ conflict — sync paused";
    el.title="Another device holds newer state (turn "+(st.conflict.serverTurn!=null?st.conflict.serverTurn:"?")+"). Auto-sync is paused so nothing gets overwritten. Reload to adopt the newer state, or export this save first.";
    return;
  }
  el.textContent=st.authExpired?"☁ session expired — tap to reconnect":"☁ "+(st.unsynced>0?st.unsynced+" turn"+(st.unsynced===1?"":"s")+" unsynced":"sync failing");
  el.title=st.authExpired?"The server session expired (~30-day limit). Tap to reconnect — progress is saved on this device meanwhile.":st.failing?"Cloud sync is failing ("+st.failCount+" consecutive). Progress is saved on this device and uploads automatically when the server is reachable.":"Turns not yet uploaded to the server.";
}
