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
function partyMemberVitals(npc){
  var sheet=npc.charSheet||null;
  return {
    name:npc.name,
    sheet:sheet,
    hp:sheet?sheet.hp:null,
    maxHp:sheet?sheet.maxHp:null,
    pct:(sheet&&sheet.maxHp)?Math.max(0,Math.min(100,Math.round((sheet.hp||0)/sheet.maxHp*100))):null,
    ratio:sheet?(sheet.maxHp?sheet.hp/sheet.maxHp:1):null,
    cls:sheet?(sheet.cls||""):(npc.role||"")
  };
}
var _cpanelWasActive=false;/* TODO #7: module-local previous-state latch — lets syncUI detect the hidden->shown edge (combat just started) instead of firing a sound on every sync while combat persists */
function syncUI(){if(!worldState)return;updateHUD();updatePartyPanel();updateQuestPanel();updateInvPanel();updateAbPanel(false);updateSpPanel();updateMemStatus();var _combatNowActive=!!worldState.combat;if(_combatNowActive){document.getElementById("cpanel").classList.add("active");updateCombat();}else{document.getElementById("cpanel").classList.remove("active");}if(_combatNowActive&&!_cpanelWasActive&&typeof Sound!=="undefined")Sound.play("click_glass");/* #7: combat starting is an attention event — same glass as quests/level-ups (no toast here, so no window contention) */_cpanelWasActive=_combatNowActive;if(typeof carMode!=="undefined"&&carMode&&typeof _carUpdate==="function")_carUpdate();/* rank 10 (todo_carplay) — keep the car overlay's portrait/party/vitals fresh off the same funnel every other panel uses */}
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
  if(listEl)listEl.innerHTML=h||"<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No active quests</div>";
}
function updateHUD(){
  /* TODO #1 P2 (D6/D7): the hero slot shows activePlayer() — the spotlight PC — while the
     sidebar party section stays hero-anchored (playerBtn always opens the hero's sheet). */
  if(!worldState)return;var c=activePlayer(),hero=worldState.character,w=worldState.world;
  document.getElementById("hud-name").textContent=c.name;
  document.getElementById("hud-cls").textContent=(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" Lv"+c.level;
  document.getElementById("hud-hp").textContent=c.hp+"/"+c.maxHp+" HP";
  document.getElementById("hud-gold").textContent=(c.gold!=null?c.gold:0)+" gp";/* companion sheets may lack gold */
  document.getElementById("hud-align").textContent=c.actualAlignment||c.statedAlignment||"Neutral";
  document.getElementById("hud-loc").textContent=pcEffectiveLoc(c).location;/* P5: camera follows the spotlight PC (a split PC shows THEIR location) */
  var xpEl=document.getElementById("hud-xp");if(xpEl){var nxp=XP_LEVELS[c.level];var xpTxt=nxp!==undefined?c.xp+" / "+nxp+" xp":c.xp+" xp (max)";var prevXp=xpEl.getAttribute("data-xp");if(prevXp!==null&&prevXp!==String(c.xp)){xpEl.className="";void xpEl.offsetWidth;/* force reflow so the animation retriggers on rapid gains */xpEl.className="xp-pulse";setTimeout(function(){xpEl.className="";},900);}xpEl.setAttribute("data-xp",String(c.xp));xpEl.textContent=xpTxt;}
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
      cards.push({name:n.name,vitals:partyMemberVitals(n),status:n.status||"ally",open:(function(nm){return function(){showNpcSheet(nm);};})(n.name)});
    });
    if(cards.length){
      hudParty.style.display="flex";hudParty.innerHTML="";
      for(var pi=0;pi<cards.length;pi++){
        var pm=cards[pi],pv=pm.vitals,pmSheet=pv.sheet;/* UA21③ */
        var card=document.createElement("div");
        card.style.cssText="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t1);cursor:pointer;padding:2px 8px 2px 6px;border-radius:var(--r);background:var(--bg2);border:1px solid var(--brd);";
        card.addEventListener("click",pm.open);/* P2: hero card opens showCharSheet, companions showNpcSheet */
        /* P5: location chip when this member's effective location differs from the spotlight PC's */
        var pmLoc=pcEffectiveLoc(pv.sheet),actLoc=pcEffectiveLoc(c);
        var locChip=(pmLoc.location&&pmLoc.location!==actLoc.location)?"<span style='color:var(--t2);font-size:9px;flex-shrink:0;'>· "+escHtml(pmLoc.location)+"</span>":"";
        var nameSpan="<span style='color:var(--t0);font-weight:bold;max-width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:inline-block;'>"+escHtml(pm.name)+"</span>"+locChip;
        if(pmSheet&&pmSheet.maxHp){
          var pct=pv.pct;
          var hpClr=pct>50?"var(--grn)":pct>25?"var(--acc)":"var(--red)";/* HUD mapping — Car Mode's differs, kept separate (UA21③) */
          var pmXpHtml="";if(pmSheet.xp!==undefined&&pmSheet.level!==undefined){var pmNextXp=XP_LEVELS[pmSheet.level];pmXpHtml="<span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-left:2px;'>"+pmSheet.xp+"/"+(pmNextXp!==undefined?pmNextXp:"max")+" xp</span>";}
          card.innerHTML=nameSpan
            +"<div style='width:48px;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;flex-shrink:0;'>"
            +"<div style='width:"+pct+"%;height:100%;background:"+hpClr+";border-radius:3px;'></div></div>"
            +"<span style='color:var(--hp);flex-shrink:0;'>"+(pv.hp||0)+"/"+pv.maxHp+"</span>"
            +pmXpHtml;
        }else{
          card.innerHTML=nameSpan+"<span style='color:var(--t2);'>"+escHtml(pm.status||"ally")+"</span>";
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
  var npcR="";for(i=0;i<worldState.npcs.length;i++){if(!worldState.npcs[i].partyMember)npcR+=sr(escHtml(worldState.npcs[i].name),escHtml(worldState.npcs[i].status+" / "+worldState.npcs[i].rel));}
  var qR="",qOffered=0;for(i=0;i<worldState.questLog.length;i++){var _q=worldState.questLog[i];if(_q.status==="offered")qOffered++;qR+="<div class='sb-row' style='cursor:pointer;' onclick='showQuestModal()'><span class='sb-k'>"+escHtml(_q.title)+"</span><span class='sb-v'>"+escHtml(_q.status)+"</span></div>";}
  var questSec=worldState.questLog.length?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;cursor:pointer;" onclick="showQuestModal()">Quests'+(qOffered?' &middot; <span style="color:var(--warn);">⚑ '+qOffered+' opportunit'+(qOffered>1?'ies':'y')+'</span>':'')+'</div>'+qR+'</div>':"";
  // Factions
  var facR="";if(memory&&memory.npcGraph&&memory.npcGraph.factions){var facNames=Object.keys(memory.npcGraph.factions);if(facNames.length){for(var fi=0;fi<facNames.length;fi++){var fn=facNames[fi],fd=memory.npcGraph.factions[fn];facR+=sr(escHtml(fn),escHtml(fd.desc||"faction"));}}}
  sb.innerHTML='<div class="sb-sec" id="sb-party-sec" style="border-top:1px solid var(--brd);padding-top:14px;"></div>'
    +'<div class="sb-sec">'+sr(escHtml("Location"),escHtml(w.location))+sr(escHtml("Time"),escHtml(w.time))+sr(escHtml("Weather"),escHtml(w.weather))+'</div>'
    +(npcR?'<div class="sb-sec">'+npcR+'</div>':"")
    +(facR?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;">Factions</div>'+facR+'</div>':"")
    +questSec;
  // ── Party section — built programmatically to avoid onclick string escaping ──
  var partySec=document.getElementById("sb-party-sec");
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
    +"<div style='font-size:10px;color:var(--hp);'>HP "+c.hp+"/"+c.maxHp+"</div>"
    +"</div>";
  if(c!==hero){
    h+="<div onclick='showCharSheet()' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(hero.name)+"</div>"
      +"<div style='font-size:10px;color:var(--t2);'>"+escHtml(hero.cls||"")+"</div>"
      +"<div style='font-size:10px;color:var(--hp);'>HP "+hero.hp+"/"+hero.maxHp+"</div>"
      +"</div>";
  }
  var _ppActLoc=pcEffectiveLoc(c);/* P5: chip reference — where the spotlight PC is */
  for(i=0;i<npcs.length;i++){
    m=npcs[i];pv=partyMemberVitals(m);/* UA21③ */
    hp=pv.hp;maxHp=pv.maxHp;cls=pv.cls;
    var _ppLoc=pcEffectiveLoc(m.charSheet);
    var _ppChip=(_ppLoc.location&&_ppLoc.location!==_ppActLoc.location)?" <span style='color:var(--t2);font-weight:normal;font-size:9px;'>· "+escHtml(_ppLoc.location)+"</span>":"";
    // data-npc + delegated wiring below (audit E69) — an inline onclick with the name in a JS string
    // literal breaks when the name contains a double quote (escHtml's &quot; decodes back to ").
    h+="<div class='party-row' data-npc='"+escHtml(m.name)+"' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(m.name)+_ppChip+"</div>"
      +(cls?"<div style='font-size:10px;color:var(--t2);'>"+escHtml(cls)+"</div>":"")
      +(hp!==null?"<div style='font-size:10px;color:var(--hp);'>HP "+hp+(maxHp?"/"+maxHp:"")+"</div>":"")
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
function updateInvPanel(){
  if(!worldState)return;var _ap=activePlayer(),inv=_ap.inventory||[],gold=(_ap.gold!=null?_ap.gold:0);/* P2: panel follows the spotlight PC */
  var weps=["sword","blade","axe","bow","staff","crossbow","knife","dagger","spear","mace","hammer","blades"];
  var arm=["armor","chainmail","leather","hide","shield","helm","cloak","mail","scale"];
  document.getElementById("inv-cnt").textContent=inv.length;document.getElementById("inv-gold").textContent=gold+" gp";
  var h="",i;for(i=0;i<inv.length;i++){var lc=inv[i].toLowerCase(),eq=false,j;for(j=0;j<weps.length;j++){if(lc.indexOf(weps[j])>=0){eq=true;break;}}if(!eq)for(j=0;j<arm.length;j++){if(lc.indexOf(arm[j])>=0){eq=true;break;}}h+='<div class="ii'+(eq?' eq':'')+'" title="'+escHtml(inv[i])+'">'+invItemHtml(inv[i])+'</div>';}
  document.getElementById("inv-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">Empty</div>';
}
function updateAbPanel(hl){
  if(!worldState)return;var abs=activePlayer().abilities||[];/* P2: follows the spotlight PC */document.getElementById("ab-cnt").textContent=abs.length;
  var h="",i;for(i=0;i<abs.length;i++){h+='<div class="ai'+(hl&&i===abs.length-1?" nw":"")+'"><span class="an">'+escHtml(abs[i].nm)+'</span><span class="ad">'+escHtml(abs[i].ds)+'</span></div>';}/* GM-authored ability text (audit E11) */
  document.getElementById("ab-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">None yet</div>';
}
function updateSpPanel(){
  if(!worldState)return;
  var _ap=activePlayer(),spells=_ap.spells||[];/* P2: follows the spotlight PC */
  var avail=spells.filter(function(s){return !s.used;}).length;
  document.getElementById("sp-cnt").textContent=avail+"/"+spells.length;
  var h="",i,sp,tag,nm,ds;
  for(i=0;i<spells.length;i++){
    sp=spells[i];
    tag=sp.lvl===0?"C":String(sp.lvl);
    nm=sp.nm.indexOf("(")>=0?sp.nm.slice(0,sp.nm.indexOf("(")).trim():sp.nm;
    ds=sp.nm.indexOf("(")>=0?sp.nm.slice(sp.nm.indexOf("(")+1).replace(")",""):"";
    h+="<div class='sp-item"+(sp.used?" used":"")+"'>";
    h+="<span class='sp-nm'>["+tag+"] "+escHtml(nm)+"</span>";/* GM-grantable spell names (#22/UA18) */
    if(ds||sp.used)h+="<span class='sp-ds'>"+escHtml(ds||"")+(sp.used?" -- expended":"")+"</span>";
    h+="</div>";
  }
  if(!h)h="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No spells</div>";
  /* P2: restSpells() writes the HERO's spells — hide the button while a companion PC holds the
     spotlight, or resting would restore the wrong sheet (writes stay on their true owner). */
  else if(_ap===worldState.character)h+="<button onclick='restSpells()' style='width:100%;margin-top:6px;padding:5px;font-size:10px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Rest (restore spells)</button>";
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
    for(fi=0;fi<ordered.length&&fi<4;fi++){var f=ordered[fi];
      if(!f.down&&f.hp>0){
        var pct=Math.max(0,Math.round((f.hp/(f.maxHp||f.hp||1))*100));
        h+="<div class='crow'><span class='cname en'"+(cm.engaged===f.name?" title='engaged'":"")+">"+(cm.engaged===f.name?"◆ ":"")+escHtml(f.name)+"</span><div class='hbw'><div class='hb eb' style='width:"+pct+"%'></div></div><span class='hpt'>"+f.hp+"/"+f.maxHp+"</span>"+(f.morale?"<span class='mbdg'>"+escHtml(f.morale)+"</span>":"")+"</div>";
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
// #73 campaign clock: show the in-game day next to the turn counter. Same day number the
// clock block feeds the GM (clockParts(clockNow()).d) so player and GM never see a contradictory
// day. Elapsed since the clock's epoch (campaign start / migration), so a save that predates the
// clock reads "Day 0" until time is advanced — accurate, not a bug.
var dayPart=(typeof clockNow==="function"&&typeof clockParts==="function")?" | Day "+clockParts(clockNow()).d:"";
txt.textContent="Session: ~"+t+"tk"+actPart+" | Chapters: "+memory.chapters.length+" | NPCs: "+Object.keys(memory.npcs).length+" | Turn "+worldState.turn+dayPart+" | "+APP_VERSION+(mdl?" | "+mdl:"");updateSyncBadge();}
// Sync failure badge (TODO #24) — red ☁ in the membar whenever the server-ACKed turn lags
// the local turn or syncs are failing. Called from updateMemStatus (every turn) AND directly
// by the storage adapter on every sync success/failure, so it never waits for a turn to refresh.
function updateSyncBadge(){
  var mb=document.getElementById("membar");if(!mb)return;
  var el=document.getElementById("syncbadge");
  var st=(typeof storageAdapter!=="undefined"&&storageAdapter.syncStatus)?storageAdapter.syncStatus():null;
  var show=st&&st.serverMode&&(st.failing||st.unsynced>0||st.conflict);
  if(!show){if(el)el.style.display="none";return;}
  if(!el){el=document.createElement("span");el.id="syncbadge";el.style.cssText="margin-left:10px;font-size:11px;color:var(--dng);font-weight:bold;";mb.appendChild(el);}
  el.style.display="inline";
  if(st.conflict){/* CAS 409 (Known issue #5) — sticky pause, distinct from ordinary failures */
    el.textContent="☁ conflict — sync paused";
    el.title="Another device holds newer state (turn "+(st.conflict.serverTurn!=null?st.conflict.serverTurn:"?")+"). Auto-sync is paused so nothing gets overwritten. Reload to adopt the newer state, or export this save first.";
    return;
  }
  el.textContent="☁ "+(st.unsynced>0?st.unsynced+" turn"+(st.unsynced===1?"":"s")+" unsynced":"sync failing");
  el.title=st.failing?"Cloud sync is failing ("+st.failCount+" consecutive). Progress is saved on this device and uploads automatically when the server is reachable.":"Turns not yet uploaded to the server.";
}
