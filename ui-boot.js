// ui-boot.js — file-menu generation (one spec, three menus), wireButtons (ONE intact function),
// settings init, transcript repaint, replay-session rebuild, boot sequence. LOADS LAST —
// ends with the window load listener as its final statement.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).

// ── File-menu generator (v1.159) ────────────────────────────────────────────
// ONE spec renders all three File menus (#file-menu / #cs-file-menu / #api-file-menu)
// at boot. Replaces the hand-synced triplicate HTML — the old "three menus must stay
// in sync" convention is dead: edit this spec and all three surfaces change together.
// Emits the EXACT ids the rest of wireButtons has always bound to (fm-/cs-fm-/api-fm-
// prefixes; import inputs use their own ""/"cs-"/"api-" prefix), so no other wiring
// changes. Per-surface differences: the char/API screens grey out game-dependent items
// (no active game yet) and swap the game menu's mobile-only quick actions for
// always-visible disabled placeholders.
function buildFileMenus(){
  function hov(bg){return " onmouseover=\"this.style.background='"+(bg||"var(--bg2)")+"'\" onmouseout=\"this.style.background='none'\"";}
  function padFor(depth){return depth===2?"7px 30px":depth===1?"7px 22px":"8px 14px";}
  function baseStyle(depth,color,extra){return "width:100%;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);background:none;border:none;color:"+(color||"var(--t1)")+";text-align:left;"+(extra||"");}
  // opts: {color, extra, cls, hidden, dim, hovBg}
  function btn(id,label,depth,opts){
    opts=opts||{};
    if(opts.dim)return "<button style='display:block;"+baseStyle(depth,opts.color)+"opacity:0.4;cursor:default;pointer-events:none;'>"+label+"</button>";
    return "<button id='"+id+"'"+(opts.cls?" class='"+opts.cls+"'":"")+" style='display:"+(opts.hidden?"none":"block")+";"+baseStyle(depth,opts.color,opts.extra)+"cursor:pointer;'"+hov(opts.hovBg)+">"+label+"</button>";
  }
  function fileLbl(inpId,label,depth){return "<label style='display:block;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'"+hov()+"><input type='file' id='"+inpId+"' accept='.tnd,.json' style='display:none;'/>"+label+"</label>";}
  function chk(cbId,label,depth,lblId){return "<label"+(lblId?" id='"+lblId+"'":"")+" style='display:flex;align-items:center;gap:8px;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'"+hov()+"><input type='checkbox' id='"+cbId+"' style='accent-color:var(--acc);cursor:pointer;width:13px;height:13px;'/> "+label+"</label>";}
  function sep(inner){return "<div style='border-top:1px solid var(--brd"+(inner?"2":"")+");margin:4px 0;'></div>";}
  // Drawers render as SIDE FLYOUTS on desktop and inline accordions ≤768px — the
  // positioning/skin lives on the fm-subwrap/fm-sub CSS classes (index.html), only
  // the open/closed display state is inline (the JS toggle flips it).
  function drawerBtn(id,label,depth,color){return "<button id='"+id+"' style='display:flex;width:100%;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);background:none;border:none;color:"+(color||"var(--t1)")+";cursor:pointer;text-align:left;justify-content:space-between;align-items:center;box-sizing:border-box;'"+hov()+"><span>"+label+"</span><span id='"+id+"-arrow' style='font-size:10px;transition:transform .15s;'>▶</span></button>";}
  function drawer(btnId,boxId,label,depth,color,inner){return "<div class='fm-subwrap'>"+drawerBtn(btnId,label,depth,color)+"<div id='"+boxId+"' class='fm-sub' style='display:none;'>"+inner+"</div></div>";}
  [{mount:"file-menu",p:"fm-",imp:"",game:true},
   {mount:"cs-file-menu",p:"cs-fm-",imp:"cs-",game:false},
   {mount:"api-file-menu",p:"api-fm-",imp:"api-",game:false}].forEach(function(sf){
    var el=document.getElementById(sf.mount);if(!el)return;
    var p=sf.p,g=sf.game,h="";
    h+="<div id='"+p+"version' style='padding:6px 14px;font-size:10px;color:var(--t2);letter-spacing:.05em;user-select:none;border-bottom:1px solid var(--brd);'></div>";
    if(g){
      h+=btn("fm-sync-mob","Sync state",0,{cls:"fm-mobile-only",hidden:true})
        +btn("fm-state-mob","World state",0,{cls:"fm-mobile-only",hidden:true})
        +btn("fm-render-mob","Render prompt",0,{cls:"fm-mobile-only",hidden:true})
        +"<div class='fm-mobile-only' style='display:none;border-top:1px solid var(--brd);margin:4px 0;'></div>";
    }else{
      h+=btn(null,"Sync state",0,{dim:true})+btn(null,"World state",0,{dim:true})+btn(null,"Render prompt",0,{dim:true})+sep();
    }
    h+=btn(p+"campaigns","&#128193; Campaigns&hellip;",0,{color:"var(--acc)",extra:"font-weight:bold;"});
    h+=g?btn(p+"carmode","&#128663; Car Mode",0):btn(null,"&#128663; Car Mode",0,{dim:true});
    h+=sep();
    var sl=(g?btn(p+"export","Save Game (local)",0):btn(null,"Save Game (local)",0,{dim:true}))
      +fileLbl(sf.imp+"import-inp","Load Game (local)",0)
      +(g?btn(p+"export-char","Export Character",0):btn(null,"Export Character",0,{dim:true}))
      +btn(sf.imp+"import-char-btn","Import Character",0)
      +(g?btn(p+"export-bp","Export as Blueprint",0):btn(null,"Export as Blueprint",0,{dim:true}))
      +(g?btn(p+"export-narr","&#128220; Export Narrative",0):btn(null,"&#128220; Export Narrative",0,{dim:true}));
    h+=drawer(p+"saveload",p+"saveloadmenu","&#128190; Save / Load",0,null,sl);
    h+=btn(p+"blueprints","&#9729; Blueprint Library&hellip;",0);
    h+=g?btn(p+"bugreport","⚠ Report bug&hellip;",0):btn(null,"⚠ Report bug&hellip;",0,{dim:true});/* #16b: game screen only — it reports on live play */
    h+=sep();
    var narr=btn(p+"rules","Narrative rules",0)
      +btn(p+"prose","✍ Prose inspiration&hellip;",0)
      +chk(p+"adult-cb","18+ Adult content",0,p+"adult-label");
    var dm=btn(p+"tts-settings","🔊 Voice Settings&hellip;",0)
      // TODO #7: UI sound library toggle + test. Deliberately NOT inside the Voice Settings modal
      // (that modal is built entirely in tts.js, which is drift-protected/off-limits) — lives here
      // as an inline menu row instead, matching this file's own established pattern for a boolean
      // pref + inline action (font-lg/autosend/autolisten/legacy-cb checkboxes above).
      +"<div style='display:flex;align-items:center;gap:8px;padding:2px 14px 7px;'>"
        +"<label style='display:flex;align-items:center;gap:8px;flex:1;font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'><input type='checkbox' id='"+p+"sound-cb' style='accent-color:var(--acc);cursor:pointer;width:13px;height:13px;'/> &#9834; UI sounds</label>"
        +"<button id='"+p+"sound-test' title='Audition every UI sound' style='font-size:11px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);cursor:pointer;padding:2px 8px;'>&#9834; Sounds&hellip;</button>"/* was a chime-only Test button — replaced by the audition modal (a one-sound test could not serve judging the set) */
      +"</div>"
      +drawer(p+"narropts",p+"narroptsmenu","&#128214; Narrative options",0,null,narr)
      +btn(p+"llm","🧠 Language Model&hellip;",0)
      +btn(p+"usage","📊 Usage &amp; cost&hellip;",0)
      +btn(p+"fal-key","🖼 Render Options&hellip;",0)
      +chk(p+"font-lg","Large text",0)
      +chk(p+"autosend","&#127908; Auto-send voice input",0)
      +chk(p+"autolisten","&#128663; Auto-listen after narration",0)
      +chk(p+"legacy-cb","&#9760; Legacy characters as NPCs",0)
      +"<div style='display:flex;align-items:center;gap:6px;padding:2px 14px 7px;'><span style='font-size:11px;color:var(--t2);'>Chance per session:</span><input type='number' id='"+p+"legacy-pct' min='1' max='100' value='5' style='width:44px;padding:3px 5px;background:var(--bg2);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);font-size:12px;font-family:var(--font);'/><span style='font-size:11px;color:var(--t2);'>%</span></div>"
      +sep(true)
      +btn(p+"set-folder","📁 Set campaign folder&hellip;",0)
      +btn(p+"clear-folder","📁 &times;",0,{hidden:true,color:"var(--acc)",extra:"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"})
      +btn(p+"server-connect","☁ Connect to server",0)
      +btn(p+"server-disconnect","☁ Disconnect (<span id='"+p+"server-user'></span>)",0,{hidden:true})
      +btn(p+"clearcache","⟳ Clear cache &amp; reload",0,{color:"var(--t2)"});
    h+=drawer(p+"devmode",p+"devmenu","⚙ Admin",0,"var(--t2)",dm);
    h+=btn(p+"clearcache-top","⟳ Clear cache &amp; reload",0,{color:"var(--t2)"});
    h+=sep();
    h+=g?btn(p+"newgame","New Game",0,{color:"var(--dng)",hovBg:"var(--dng-faint)"}):btn(null,"New Game",0,{dim:true,color:"var(--dng)"});
    el.innerHTML=h;
  });
}
// Close every flyout/drawer in a menu and reset its arrows — called when a File menu
// OPENS, so a flyout left open last time doesn't pop back as a floating panel.
function resetFileSubmenus(menuEl){
  if(!menuEl)return;
  Array.prototype.forEach.call(menuEl.querySelectorAll(".fm-sub"),function(s){s.style.display="none";s.style.left="";s.style.right="";});
  Array.prototype.forEach.call(menuEl.querySelectorAll("[id$='-arrow']"),function(a){a.style.transform="";});
}
function wireButtons(){
  buildFileMenus(); // all three File menus render from ONE spec before any wiring binds to them
  document.getElementById("api-btn").addEventListener("click",submitKey);
  document.getElementById("api-input").addEventListener("keydown",function(e){if(e.key==="Enter")submitKey();});
  document.getElementById("tone-next").addEventListener("click",function(){if(cs.tone==="custom"){var t=document.getElementById("tone-ct");if(!t||!t.value.trim()){document.getElementById("s1-warn").textContent="Describe your custom tone.";return;}}document.getElementById("s1-warn").textContent="";goStep(2);});
  document.getElementById("id-back").addEventListener("click",function(){goStep(1);});
  document.getElementById("anc-back-detail").addEventListener("click",hideAncDetail);
  document.getElementById("anc-next").addEventListener("click",function(){cs.gender=document.getElementById("char-gender").value;cs.age=document.getElementById("char-age").value;if(!cs.ancestry){document.getElementById("s2-warn").textContent="Choose an ancestry.";return;}if(!cs.subrace){document.getElementById("s2-warn").textContent="Choose a subrace.";return;}var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(cs.ancestry==="halfblood"&&cs.subrace&&a&&a.subraces){var selH=null,hk2;for(hk2=0;hk2<a.subraces.length;hk2++){if(a.subraces[hk2].id===cs.subrace){selH=a.subraces[hk2];break;}}if(selH&&selH.lineages&&selH.lineages.length&&!cs.heritageVariant){document.getElementById("s2-warn").textContent="Choose a "+selH.nm+" lineage.";return;}}if(a&&a.fc>0&&cs.fp.length<a.fc){document.getElementById("s2-warn").textContent="Choose "+a.fc+" stat bonuses.";return;}document.getElementById("s2-warn").textContent="";goStep(3);});
  document.getElementById("cls-back").addEventListener("click",function(){goStep(2);});
  document.getElementById("cls-next").addEventListener("click",function(){if(!cs.cls){document.getElementById("s3-warn").textContent="Choose a class.";return;}document.getElementById("s3-warn").textContent="";goStep(4);});
  document.getElementById("sts-back").addEventListener("click",function(){goStep(3);});
  document.getElementById("sts-next").addEventListener("click",function(){if(!cs.rolled&&cs.statMode==="roll"){document.getElementById("s4-warn").textContent="Roll your stats first.";return;}document.getElementById("s4-warn").textContent="";goStep(5);});
  document.getElementById("roll-btn").addEventListener("click",rollAllStats);
  document.getElementById("char-alignment").addEventListener("change",function(){if(!cs.deityEdited)buildStep6Deity();});
  document.getElementById("char-deity").addEventListener("input",function(){cs.deityEdited=this.value!==getDefaultDeity();});
  document.getElementById("ft-back").addEventListener("click",function(){goStep(4);});
  document.getElementById("ft-next").addEventListener("click",function(){cs.appear=document.getElementById("char-appear").value.trim();cs.backstory=document.getElementById("char-backstory").value.trim();goStep(6);});
  document.getElementById("ft-upload").addEventListener("click",function(){document.getElementById("ft-portrait-file").click();});
  document.getElementById("ft-portrait-file").addEventListener("change",function(){var file=this.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(e){compressPortrait(e.target.result,function(compressed){cs.portrait=compressed;refreshFtPortrait();});};reader.readAsDataURL(file);this.value="";});
  document.getElementById("ft-render").addEventListener("click",function(){ftRenderPortrait();});
  document.getElementById("ft-derive").addEventListener("click",function(){ftDeriveAppearance();});
  document.getElementById("rv-back").addEventListener("click",function(){pendingImportChar=null;goStep(5);});
  document.getElementById("rv-go").addEventListener("click",confirmChar);
  document.getElementById("rv-randomise").addEventListener("click",function(){aiRandomiseAll(this);});
  injectSparkleButtons();
  document.getElementById("rv-start-loc").addEventListener("change",function(){document.getElementById("rv-start-loc-custom").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("rv-start-level").addEventListener("change",function(){var b=document.getElementById("rv-go");if(b)b.textContent=parseInt(this.value)>=3?"Assign level perks":"Begin your journey";buildDots();});
  // Audit 07/16 #4: rebuild the review card only when it's visible (step 6) — goStep(6) always
  // calls buildReview() on entry (char-creation.js goStep), so a name typed earlier can't go stale.
  document.getElementById("char-name").addEventListener("input",function(){cs.name=this.value.trim();if(cs.step===6)buildReview();});
  document.getElementById("state-btn").addEventListener("click",function(){document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("sb-close").addEventListener("click",function(){document.getElementById("sidebar").classList.remove("open");});
  document.getElementById("sendbtn").addEventListener("click",function(){sendAction(null);});
  // #49 phase 1: on-screen keyboards fat-finger Enter mid-thought and each accidental send is a
  // real turn — on mobile (same ≤768px breakpoint as the menu fallback) ONLY the Send button
  // submits. Desktop keeps Enter-sends. Phase 2 (true multiline = textarea swap) is TODO #49.
  // Width 0 (hidden/prerendered tab) must FAIL OPEN to desktop behavior — a swallowed desktop
  // Enter reads as "game broken"; a fat-finger send is merely annoying.
  document.getElementById("action-input").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey){var _w=window.innerWidth||document.documentElement.clientWidth||9999;if(_w>0&&_w<=768){e.preventDefault();return;}sendAction(null);}});
  // × clear (#33) — visibility is pure CSS (:placeholder-shown), so programmatic clears (send, Car Mode mic) hide it for free
  document.getElementById("input-clear").addEventListener("click",function(){var inp=document.getElementById("action-input");inp.value="";inp.focus();});
  document.getElementById("sync-btn").addEventListener("click",showSyncModal);
  document.getElementById("render-btn").addEventListener("click",doRender);
  var _rrb=document.getElementById("reroll-btn");if(_rrb)_rrb.addEventListener("click",rerollLast);
  document.getElementById("file-btn").addEventListener("click",function(e){e.stopPropagation();var fm=document.getElementById("file-menu");var opening=fm.style.display!=="block";if(opening)resetFileSubmenus(fm);fm.style.display=opening?"block":"none";});
  document.addEventListener("click",closeAllMenus);/* #15④: was the closeAllMenus body unrolled inline */
  // ── Shared menu wiring across all three File menus (fm-, cs-fm-, api-fm-) ──
  var _menus=[{pfx:"fm-",menu:"file-menu",imp:""},{pfx:"cs-fm-",menu:"cs-file-menu",imp:"cs-"},{pfx:"api-fm-",menu:"api-file-menu",imp:"api-"}];
  _menus.forEach(function(m){
    var close=function(){document.getElementById(m.menu).style.display="none";};
    var vd=document.getElementById(m.pfx+"version");if(vd)vd.textContent=APP_VERSION;
    // Toggle button
    if(m.pfx!=="fm-"){var tb=document.getElementById(m.imp+"file-btn");if(tb)tb.addEventListener("click",function(e){e.stopPropagation();var mu=document.getElementById(m.menu);var opening=mu.style.display!=="block";if(opening)resetFileSubmenus(mu);mu.style.display=opening?"block":"none";});}
    // Items that close the menu then call a function
    [["campaigns",showCampaignPicker],["blueprints",showBlueprintBrowser],["bugreport",showBugReportModal],["rules",showRulesModal],["llm",showProviderModal],["prose",showProseModal],["usage",showUsageModal],["fal-key",showRenderOptionsModal],["server-connect",connectToServer],["server-disconnect",disconnectFromServer],["set-folder",setCampaignFolder],["clear-folder",clearCampaignFolder]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("click",function(){close();it[1]();});
    });
    // Direct click handlers (no close needed)
    [["clearcache",clearCacheAndReload],["clearcache-top",clearCacheAndReload]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("click",it[1]);
    });
    // Change handlers
    [["adult-cb",toggleAdultMode],["font-lg",toggleFontSize]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("change",it[1]);
    });
    // Cascading submenu toggles: Admin, Save/Load, Narrative options (nested in Admin).
    // Desktop flyouts pick their side from the PARENT ITEM's position before opening:
    // whichever side of the screen has more room gets the panel (away from the closest
    // edge). CSS default is leftward (right:100%); rightward is the inline override.
    [["devmode","devmenu"],["saveload","saveloadmenu"],["narropts","narroptsmenu"]].forEach(function(sm){
      var tg=document.getElementById(m.pfx+sm[0]);
      if(tg)tg.addEventListener("click",function(e){
        e.stopPropagation();
        var sub=document.getElementById(m.pfx+sm[1]),arrow=document.getElementById(m.pfx+sm[0]+"-arrow");
        var open=sub.style.display!=="none";
        if(open){sub.style.display="none";}
        else{
          sub.style.left="";sub.style.right="";
          var a=tg.getBoundingClientRect();
          if(window.innerWidth-a.right>a.left){sub.style.right="auto";sub.style.left="100%";}
          sub.style.display="block";
        }
        if(arrow)arrow.style.transform=open?"":"rotate(90deg)";
      });
    });
    // Import inputs (different prefix pattern: "", "cs-", "api-")
    var ii=document.getElementById(m.imp+"import-inp");if(ii)ii.addEventListener("change",importSave);
    var ic=document.getElementById(m.imp+"import-char-btn");if(ic)ic.addEventListener("click",showCharacterBrowser);
  });
  // Stop checkbox label clicks from bubbling to the document close-menu handler
  ["adult-cb","font-lg","legacy-cb","autosend","autolisten","sound-cb"].forEach(function(sfx){/* autosend/autolisten added so toggling them doesn't close the File menu (audit E67); walks via eachMenuEl (#15⑤) */
    eachMenuEl(sfx,function(el){
      var lbl=el.closest("label")||el.parentElement;
      if(lbl)lbl.addEventListener("click",function(e){e.stopPropagation();});
    });
  });
  // Legacy characters checkbox + chance input (synced across all three menus)
  eachMenuEl("legacy-cb",function(el){
    el.addEventListener("change",function(){
      legacyCharsOn=el.checked;saveLegacySettings();
      if(el.checked&&typeof loadLegacyLibrary==="function")loadLegacyLibrary();
      eachMenuEl("legacy-cb",function(o){if(o!==el)o.checked=el.checked;});
    });
  });
  eachMenuEl("legacy-pct",function(el){
    el.addEventListener("change",function(){
      var v=parseInt(el.value,10);if(isNaN(v)||v<1)v=1;if(v>100)v=100;
      el.value=v;legacyChancePct=v;saveLegacySettings();
      eachMenuEl("legacy-pct",function(o){if(o!==el)o.value=v;});
    });
    el.addEventListener("click",function(e){e.stopPropagation();});
  });
  // ── Game-screen-only menu items ──
  document.getElementById("fm-export").addEventListener("click",exportSave);
  document.getElementById("import-step1").addEventListener("change",importSave);
  document.getElementById("open-blueprint-browser").addEventListener("click",showBlueprintBrowser);
  document.getElementById("blueprint-clear").addEventListener("click",clearBlueprint);
  document.getElementById("fm-sync-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";showSyncModal();});
  document.getElementById("fm-state-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("fm-render-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";doRender();});
  document.getElementById("fm-export-char").addEventListener("click",exportCharacter);
  document.getElementById("fm-export-bp").addEventListener("click",exportBlueprint);
  document.getElementById("fm-export-narr").addEventListener("click",exportNarrativeHtml);
  // (import-char-btn is already wired in the shared _menus loop above — audit E66 removed the duplicate here)
  document.getElementById("fm-newgame").addEventListener("click",newGame);
  document.getElementById("fm-carmode").addEventListener("click",function(){closeAllMenus();showCarMode();});
  document.getElementById("car-close-btn").addEventListener("click",hideCarMode);
  document.getElementById("car-tap-btn").addEventListener("click",_carTap);
  document.getElementById("car-prev-btn").addEventListener("click",_carPrev);
  document.getElementById("car-next-btn").addEventListener("click",_carNext);
  // TTS
  document.getElementById("tts-btn").addEventListener("click",function(){if(typeof TTS!=="undefined")TTS.toggle();});
  eachMenuEl("tts-settings",function(el){el.addEventListener("click",function(){closeAllMenus();if(typeof TTS!=="undefined")TTS.showSettingsModal();});});
  if(typeof TTS!=="undefined")TTS.loadSettings();
  // TODO #7: UI sound library toggle + test (see the buildFileMenus comment above for why this
  // lives here instead of inside the Voice Settings modal).
  eachMenuEl("sound-cb",function(el){el.addEventListener("change",function(){if(typeof Sound!=="undefined")Sound.setEnabled(el.checked);eachMenuEl("sound-cb",function(o){if(o!==el)o.checked=el.checked;});});});
  if(typeof Sound!=="undefined"){var _sndOn=Sound.enabled();eachMenuEl("sound-cb",function(el){el.checked=_sndOn;});}
  eachMenuEl("sound-test",function(el){el.addEventListener("click",function(e){e.stopPropagation();if(typeof showSoundModal==="function")showSoundModal();});});
  // STT (speech-to-text dictation) — Car Mode foundation
  document.getElementById("mic-btn").addEventListener("click",function(){if(typeof STT!=="undefined")STT.toggle();});
  eachMenuEl("autosend",function(el){el.addEventListener("change",function(){if(typeof STT!=="undefined")STT.setAutoSend(el.checked);});});
  // rank 6 (todo_carplay) — "Auto-listen after narration" pref: default ON (today's auto-mic
  // behavior) whenever STT.isAutoListen isn't wired up yet, per the cross-lane contract in
  // ui-carmode.js's _carAutoMic. Wired/initialized exactly like autosend above.
  eachMenuEl("autolisten",function(el){el.addEventListener("change",function(){if(typeof STT!=="undefined"&&STT.setAutoListen)STT.setAutoListen(el.checked);});});
  if(typeof STT!=="undefined")STT.loadSettings();
  if(typeof STT!=="undefined"&&typeof STT.isAutoListen==="function"){var _alOn=STT.isAutoListen();eachMenuEl("autolisten",function(el){el.checked=_alOn;});}
  // Suggested-action buttons: plain tap = fill input (editable); long-press (~500ms) = execute the turn.
  // (Ctrl/Cmd-click is handled in sendSuggestedAction.) Delegated so it covers dynamically-added buttons.
  (function(){
    var area=document.getElementById("story-narrative");if(!area)return;
    var timer=null,sx=0,sy=0,armed=null;
    function clear(){if(timer){clearTimeout(timer);timer=null;}if(armed){armed.classList.remove("qa-hold");armed=null;}}
    area.addEventListener("pointerdown",function(e){
      var btn=e.target&&e.target.closest?e.target.closest(".qa"):null;if(!btn)return;
      sx=e.clientX;sy=e.clientY;armed=btn;btn.classList.add("qa-hold");
      timer=setTimeout(function(){
        timer=null;if(!armed)return;var b=armed;armed=null;b.classList.remove("qa-hold");
        _qaSuppressUntil=Date.now()+900;          // swallow the trailing click
        var a=b.getAttribute("data-action");if(a&&!busy)sendAction(toFirstPerson(a));
      },500);
    });
    area.addEventListener("pointermove",function(e){if(timer&&(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10))clear();});
    area.addEventListener("pointerup",clear);
    area.addEventListener("pointercancel",clear);
    area.addEventListener("pointerleave",clear);
    area.addEventListener("contextmenu",function(e){if(e.target&&e.target.closest&&e.target.closest(".qa"))e.preventDefault();});
  })();
  // Flush the debounced server sync on exit/background so the 1.5s window can't drop the last
  // turn (best-effort — same fetch guarantees as before, minus the window).
  window.addEventListener("beforeunload",function(){snapshotActiveCamp();if(typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow(true);/* keepalive flush — plain fetch is abandoned on unload (E34) */});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow(true);/* page-hide can precede unload on mobile — keepalive (E34) */});
  // Start panel collapsed on mobile so first tap expands (not collapses)
  if(window.innerWidth<=600){panelCol=true;var rp=document.getElementById("rpanel");if(rp)rp.classList.add("col");}
  document.getElementById("panel-tog").addEventListener("click",function(){panelCol=!panelCol;document.getElementById("rpanel").classList.toggle("col",panelCol);});
  // Swipe right to collapse, swipe left to expand
  (function(){
    var rp=document.getElementById("rpanel"),tx=0;
    rp.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});
    rp.addEventListener("touchend",function(e){
      var dx=e.changedTouches[0].clientX-tx;
      if(Math.abs(dx)<30)return;
      panelCol=dx>0;  // swipe right → collapse, swipe left → expand
      rp.classList.toggle("col",panelCol);
    },{passive:true});
  })();
  document.getElementById("psh-party").addEventListener("click",function(){secCol.party=!secCol.party;document.getElementById("pss-party").classList.toggle("col",secCol.party);});
  document.getElementById("psh-quest").addEventListener("click",function(){secCol.quest=!secCol.quest;document.getElementById("pss-quest").classList.toggle("col",secCol.quest);});
  document.getElementById("psh-inv").addEventListener("click",function(){secCol.inv=!secCol.inv;document.getElementById("pss-inv").classList.toggle("col",secCol.inv);});
  document.getElementById("psh-ab").addEventListener("click",function(){secCol.ab=!secCol.ab;document.getElementById("pss-ab").classList.toggle("col",secCol.ab);});
  document.getElementById("psh-sp").addEventListener("click",function(){secCol.sp=!secCol.sp;document.getElementById("pss-sp").classList.toggle("col",secCol.sp);});
}
function submitKey(){var k=document.getElementById("api-input").value.trim();if(!k){document.getElementById("api-warn").textContent="Enter an API key.";return;}apiKey=k;providerKeys[activeProvider]=k;store.set(AKK,k);saveProviderSettings();var falEl=document.getElementById("fal-input");var fk=falEl?falEl.value.trim():"";if(fk){falKey=fk;store.set(FAL_KEY_K,fk);}document.getElementById("api-screen").style.display="none";init();}
function initSettings(){
  loadRules();loadAdultMode();loadProseAuthor();loadLegacySettings();
  if(typeof loadLegacyLibrary==="function")loadLegacyLibrary();
  loadFontSize();updateServerUI();
}
// Rebuild the story pane from worldState.transcript — the canonical narrative record (audit #18).
// Replaces the old narrativeHtml DOM-snapshot round-trip: the transcript survives reloads and
// device hops complete and ordered, where the DOM copy was truncated and UI-polluted. Renders the
// last `maxEntries` entries (default 20) with an "earlier turns omitted" note when trimmed.
// Dice blocks and system messages are not in the transcript by design (story prose only).
// Returns true if it painted anything. clearFirst wipes the pane before painting (server
// reconcile, where stale content must be replaced); without it, entries append after whatever
// header lines the caller already wrote (init/campaign-load "Welcome back" messages).
function rebuildNarrativeFromTranscript(maxEntries,clearFirst){
  if(!worldState||!worldState.transcript)return false;
  // v1.240 (no-silent-failures): a NON-ARRAY transcript (the {__lz:…} compressed shape leaking
  // in-memory — the poisoned-blob class UA3 guards at the localStorage boundary) used to fall
  // through the .length check SILENTLY, leaving stale story content under fresh state (the
  // Ammut F5 incident). Shout and bail; the next loadState self-heals via parseWorldState.
  if(!(worldState.transcript instanceof Array)){console.warn("[replay] worldState.transcript is not an array ("+(worldState.transcript.__lz?"compressed {__lz} blob":"unknown shape")+") — story pane NOT rebuilt; a reload will self-heal via parseWorldState");if(typeof showToast==="function")showToast("⚠ Story pane could not rebuild — reload to fix.");return false;}
  if(!worldState.transcript.length)return false;
  var story=document.getElementById("story-narrative");if(!story)return false;
  if(clearFirst)story.innerHTML="";
  var tr=worldState.transcript,n=maxEntries||20,start=Math.max(0,tr.length-n),i,lastNar=null;
  if(start>0)addMsg("system","… "+start+" earlier entr"+(start===1?"y":"ies")+" omitted — the full story lives in the transcript.");
  for(i=start;i<tr.length;i++){var e=tr[i];
    if(e.r==="player")addMsg("player",escHtml(e.x));
    else lastNar=addMsg("narrator","<p>"+escProse(e.x)+"</p>",{replayText:e.x,turn:e.t});/* transcript is model/user text — escape on replay (audit E11) */
  }
  if(lastNar&&worldState.lastActions){var bd=document.createElement("div");bd.innerHTML=buildActionButtons(worldState.lastActions);if(bd.firstChild)lastNar.appendChild(bd.firstChild);}
  story.scrollTop=story.scrollHeight;
  return true;
}
function initReplaySession(){
  if(rebuildNarrativeFromTranscript())return; // transcript-based replay (v1.146)
  // Fallbacks for saves without a transcript (pre-v1.62): last sessionLog exchange, else recap.
  var sll=sessionLog.length;
  if(sll>=2){
    var slu=sessionLog[sll-2],sla=sessionLog[sll-1];
    if(slu&&slu.role==="user")addMsg("player",escHtml(slu.content));
    if(sla&&sla.role==="assistant"){
      var slc=cleanTxt(sla.content),sld=diceTxt(sla.content);
      var _rab=worldState.lastActions?buildActionButtons(worldState.lastActions):parseActions(slc,sla.content).btns||"";
      addMsg("narrator",(sld||"")+"<p>"+escProse(slc)+"</p>"+_rab);/* escape on replay (audit E11) */
    }
  }else{
    var wbSrc=memory&&memory.chapters&&memory.chapters.length?memory.chapters[memory.chapters.length-1].summary:null;
    if(!wbSrc&&worldState.eventHistory&&worldState.eventHistory.length){
      var wbE=worldState.eventHistory[worldState.eventHistory.length-1];
      wbSrc=typeof wbE==="string"?wbE:(wbE&&wbE.summary)||null;
    }
    if(wbSrc)addMsg("narrator","<p><em>Previously:</em> "+escHtml(wbSrc)+"</p>");
  }
}
function initState(saved){
  if(saved&&worldState){
    if(!getActiveCampId())migrateToCampaigns();
    dedupeActiveCampSlots();/* B4: free the active campaign's ~590K standing slot duplicate for this session (recreated at unload) */
    checkLegacyCharacter();showGame();syncUI();initAbilities();initSpells();
    addMsg("system","Welcome back, "+worldState.character.name+".");
    addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");
    initReplaySession();
    if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}
    if(typeof migratePendingCompanionSheets==="function")migratePendingCompanionSheets();// backfill sheet-less party members in existing saves (audit P2)
    // rank 13 (todo_carplay) — restore Car Mode across a reload/tab-reclaim mid-drive; flag
    // expires after 6h so a desktop session weeks later doesn't boot back into the car UI. The
    // × close button (hideCarMode) always clears the flag, so it stays the escape hatch either way.
    try{
      var _cmFlag=store.get("tnd_carmode_v1");
      if(_cmFlag){
        var _cmData=JSON.parse(_cmFlag);
        if(_cmData&&_cmData.on&&(Date.now()-_cmData.t)<6*3600*1000&&typeof showCarMode==="function")showCarMode();
        else store.del("tnd_carmode_v1");
      }
    }catch(e){store.del("tnd_carmode_v1");}
  }else{
    showChar();
  }
}
function init(){initSettings();storageAdapter.load(initState);}
window.addEventListener("load",function(){wireButtons();loadFalKey();loadRenderModel();loadProviderSettings();var k=providerKeys[activeProvider];if(k){apiKey=k;document.getElementById("api-screen").style.display="none";init();}});
