// ui-modals.js — settings & utility modals: narrative rules, font size, adult mode, legacy
// toggles, sync (world-state editor), render options, provider, usage, RAG, prose, quests.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// ── #15①: shared radio-row picker (Render Options / Provider / Prose) ─────────
// One markup builder + one restyle-on-click loop for the dot+amber-row triplet that was
// hand-rolled ×3. items: array of objects with .id; labelFn(item, sel) returns the caller's
// label markup (the three modals' labels genuinely differ — plain span vs name+blurb block).
// opts: {align:"flex-start", dotTop:true} — Prose's two deviations from the shared skeleton.
// Markup is byte-identical to the three original inline builders (parity-pinned in
// dev/_tests_dedupB.js).
function radioRowsHTML(cls,items,selId,labelFn,opts){
  opts=opts||{};var h="",i;
  for(i=0;i<items.length;i++){var it=items[i],sel=(it.id===selId);
    h+="<div class='"+cls+"' data-id='"+it.id+"' style='display:flex;align-items:"+(opts.align||"center")+";gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid "+(sel?"var(--acc)":"var(--brd)")+";background:"+(sel?"rgba(184,147,90,.08)":"var(--bg2)")+";margin-bottom:6px;'>"
      +"<div style='width:13px;height:13px;border-radius:50%;border:2px solid "+(sel?"var(--acc)":"var(--brd2)")+";background:"+(sel?"var(--acc)":"transparent")+";flex-shrink:0;"+(opts.dotTop?"margin-top:2px;":"")+"'></div>"
      +labelFn(it,sel)
      +"</div>";
  }
  return h;
}
// labelSel: "span" (Render/Provider) or "div>div" (Prose — NOTE this preserves the original
// verbatim: querySelector("div>div") actually first-matches the DOT (a div child of the row
// div), so Prose's name text never recolored on click. Latent pre-existing quirk, kept —
// this pass is pure behavior preservation. Reported in the #54 lane-B notes.)
function radioRowsRefresh(container,cls,selId,labelSel){
  Array.prototype.forEach.call(container.querySelectorAll("."+cls),function(r){
    var s=(r.getAttribute("data-id")===selId);
    r.style.borderColor=s?"var(--acc)":"var(--brd)";r.style.background=s?"rgba(184,147,90,.08)":"var(--bg2)";
    var dot=r.querySelector("div");if(dot){dot.style.borderColor=s?"var(--acc)":"var(--brd2)";dot.style.background=s?"var(--acc)":"transparent";}
    var lbl=r.querySelector(labelSel||"span");if(lbl)lbl.style.color=s?"var(--acc)":"var(--t1)";
  });
}
function showRulesModal(){
  /* #14: re-rendering modal — × wired per render below, so wireClose:false */
  var modal=modalShell("rules-modal","",{align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:520,boxExtra:"margin-top:40px;",wireClose:false});
  var inner=modal.firstChild;
  function renderRules(){
    var h="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Narrative Rules</span><button id='rules-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div><div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>Strictly enforced on every GM response.</div>",i;
    for(i=0;i<DEFAULT_RULES.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);margin-bottom:6px;font-size:12px;display:flex;gap:8px;'><span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-top:1px;'>DEFAULT</span><span style='color:var(--t1);'>"+DEFAULT_RULES[i]+"</span></div>";}
    for(i=0;i<customRules.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--acc);border-radius:var(--r);margin-bottom:6px;font-size:12px;color:var(--t0);display:flex;justify-content:space-between;align-items:flex-start;gap:8px;'><span>"+customRules[i]+"</span><button onclick='removeRule("+i+")' style='background:none;border:none;color:var(--dng);cursor:pointer;font-size:16px;flex-shrink:0;line-height:1;'>&#215;</button></div>";}
    h+="<div style='display:flex;gap:6px;margin-top:14px;'><input id='rules-new' type='text' placeholder='Add a custom rule...' class='sc-inp' style='flex:1;'/><button id='rules-add' style='padding:7px 14px;font-size:12px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>Add</button></div>";
    inner.innerHTML=h;
    document.getElementById("rules-x").addEventListener("click",function(){modal.remove();});
    document.getElementById("rules-add").addEventListener("click",function(){var v=document.getElementById("rules-new").value.trim();if(!v)return;customRules.push(v);saveRules();renderRules();});
  }
  renderRules();
}
function removeRule(idx){customRules.splice(idx,1);saveRules();showRulesModal();}
var FONT_KEY="tnd_font_v1";
function loadFontSize(){
  var saved=store.get(FONT_KEY);
  // Default to large on iOS if no preference saved
  var isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  var large=saved!==null?(saved==="1"):(isIOS?true:false);
  if(large)document.body.classList.add("font-large");
  else document.body.classList.remove("font-large");
  eachMenuEl("font-lg",function(el){el.checked=large;});
}
function toggleFontSize(){
  var large=document.body.classList.toggle("font-large");
  store.set(FONT_KEY,large?"1":"0");
  eachMenuEl("font-lg",function(el){el.checked=large;});
}
function toggleAdultMode(){adultMode=!adultMode;store.set(ADK,adultMode?"1":"");eachMenuEl("adult-cb",function(cb){cb.checked=adultMode;});showToast(adultMode?"18+ content enabled":"18+ content disabled");}
function loadAdultMode(){var v=store.get(ADK);adultMode=!!(v&&v==="1");eachMenuEl("adult-cb",function(cb){cb.checked=adultMode;});}
function loadLegacySettings(){legacyCharsOn=store.get(LEGACY_ON_K)==="1";var pv=parseInt(store.get(LEGACY_PCT_K)||"5",10);legacyChancePct=(isNaN(pv)||pv<1)?5:Math.min(100,pv);eachMenuEl("legacy-cb",function(el){el.checked=legacyCharsOn;});eachMenuEl("legacy-pct",function(el){el.value=legacyChancePct;});}
function saveLegacySettings(){store.set(LEGACY_ON_K,legacyCharsOn?"1":"");store.set(LEGACY_PCT_K,String(legacyChancePct));}

function showSyncModal(){
  var ex=document.getElementById("sync-modal");if(ex)ex.remove();if(!worldState){showToast("No active game.");return;}
  /* #14: re-rendering modal — × wired per render below, so wireClose:false */
  var dir="ui";var modalDiv=modalShell("sync-modal","",{align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:520,boxExtra:"margin-top:40px;",wireClose:false});
  var inner=modalDiv.firstChild;
  function renderSync(){
    var c=worldState.character,w=worldState.world,isUI=(dir==="ui"),ro=isUI?"":"readonly";
    inner.innerHTML="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Sync World State</span><button id='sc-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +"<div style='font-size:11px;color:var(--t2);font-family:var(--font-mono);background:var(--bg2);padding:6px 10px;border-radius:4px;margin-bottom:14px;'>Lv "+c.level+" | XP "+c.xp+" | HP "+c.hp+"/"+c.maxHp+" | Gold "+c.gold+" | Turn "+worldState.turn+"</div>"
      +"<div style='display:flex;gap:8px;margin-bottom:16px;'><button id='sc-ui' class='sc-dir"+(isUI?" active":"")+"'>UI -> Game</button><button id='sc-gm' class='sc-dir"+(!isUI?" active":"")+"'>Game -> UI</button></div>"
      +"<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;'>"
      +"<div><label class='sc-lbl'>HP</label><input id='sc-hp' type='number' class='sc-inp' value='"+c.hp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Max HP</label><input id='sc-maxhp' type='number' class='sc-inp' value='"+c.maxHp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Gold</label><input id='sc-gold' type='number' class='sc-inp' value='"+c.gold+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>XP</label><input id='sc-xp' type='number' class='sc-inp' value='"+c.xp+"' "+ro+"/></div>"
      +((typeof manaMax==="function"&&manaMax(c)>0)?"<div><label class='sc-lbl'>Mana (max "+manaMax(c)+")</label><input id='sc-mana' type='number' min='0' max='"+manaMax(c)+"' class='sc-inp' value='"+manaCur(c)+"' "+ro+"/></div>":"")/* #110: the manual patch path for a desynced pool */
      +"<div><label class='sc-lbl'>Level</label><input id='sc-level' type='number' min='1' max='10' class='sc-inp' value='"+c.level+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Location</label><input id='sc-loc' type='text' class='sc-inp' value='"+escHtml(w.location)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Time flavor (clock is authoritative)</label><input id='sc-time' type='text' class='sc-inp' value='"+escHtml(w.time)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Weather</label><input id='sc-weather' type='text' class='sc-inp' value='"+escHtml(w.weather)+"' "+ro+"/></div></div>"
      +"<div style='margin-bottom:12px;'><label class='sc-lbl'>Inventory (one per line)</label><textarea id='sc-inv' class='sc-inp' style='height:80px;resize:vertical;' "+ro+">"+escHtml(c.inventory.join("\n"))+"</textarea></div>"
      +(isUI?"<button id='sc-apply' style='width:100%;padding:13px;font-size:15px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>APPLY</button>":"<div style='text-align:center;font-size:12px;color:var(--t2);padding:8px;'>Showing live game state. Switch to UI -> Game to edit.</div>")
      +"<p id='sc-msg' style='font-size:12px;min-height:16px;margin-top:8px;text-align:center;'></p>";
    document.getElementById("sc-x").addEventListener("click",function(){modalDiv.remove();});
    document.getElementById("sc-ui").addEventListener("click",function(){dir="ui";renderSync();});
    document.getElementById("sc-gm").addEventListener("click",function(){dir="game";syncUI();renderSync();});
    if(isUI){document.getElementById("sc-apply").addEventListener("click",function(){
      var c2=worldState.character,w2=worldState.world;
      var hp2=parseInt(document.getElementById("sc-hp").value),mhp2=parseInt(document.getElementById("sc-maxhp").value);
      var gld2=parseInt(document.getElementById("sc-gold").value),xp2=parseInt(document.getElementById("sc-xp").value),lvl2=parseInt(document.getElementById("sc-level").value);
      var loc2=document.getElementById("sc-loc").value.trim(),tm2=document.getElementById("sc-time").value.trim(),wx2=document.getElementById("sc-weather").value.trim();
      var rawInv=document.getElementById("sc-inv").value.trim();
      var inv2=rawInv?rawInv.split("\n").map(function(x){return x.trim();}).filter(function(x){return x.length>0;}):[];
      if(!isNaN(mhp2)&&mhp2>0)c2.maxHp=mhp2;if(!isNaN(hp2))c2.hp=Math.min(c2.maxHp,Math.max(0,hp2));
      if(!isNaN(gld2))c2.gold=Math.max(0,gld2);if(!isNaN(xp2))c2.xp=Math.max(0,xp2);
      if(!isNaN(lvl2)&&lvl2>=1&&lvl2<=classXpLevels().length)c2.level=lvl2;/* the curve length (20) is the cap since C6 — the old <=10 silently refused L11+ */if(loc2)w2.location=loc2;if(tm2)w2.time=tm2;if(wx2)w2.weather=wx2;
      var _scMana=document.getElementById("sc-mana");if(_scMana){var mn2=parseInt(_scMana.value);if(!isNaN(mn2))c2.mana=Math.max(0,Math.min(manaMax(c2),mn2));}/* #110 */
      c2.inventory=inv2;/* always assign so emptying the textarea actually clears inventory (audit E63) */syncUI();saveAll();renderSync();
      var msg=document.getElementById("sc-msg");if(msg){msg.textContent="Applied.";msg.style.color="var(--grn)";}
    });}
  }
  renderSync();
}
function loadFalKey(){var fk=store.get(FAL_KEY_K);if(fk){falKey=fk;var fi=document.getElementById("fal-input");if(fi)fi.value=fk;}}
function loadRenderModel(){
  renderModel=resolveRenderModel(store.get(RENDER_MDL_K));/* #208a: departed ids (the dropped Flux pair) fall back to the default instead of dangling */
  try{var s=store.get(RENDER_STR_K);if(s)renderStrength=JSON.parse(s)||{};}catch(e){renderStrength={};}
}
function showRenderOptionsModal(){
  document.getElementById("file-menu").style.display="none";
  // Build model rows — shared radio-row builder (#15①)
  var mhtml=radioRowsHTML("ro-row",RENDER_MODELS,renderModel,function(m,sel){return "<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+m.label+"</span>";});
  var modal=modalShell("render-opts-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🖼 Render Options</span><button id='ro-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>fal.ai API Key</div>"
    +"<input type='password' id='ro-fal-inp' placeholder='fal_key_...' autocomplete='one-time-code' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:8px;box-sizing:border-box;'/>"
    +"<div style='display:flex;gap:6px;margin-bottom:22px;'><button id='ro-fal-clear' style='padding:7px 13px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Clear</button><button id='ro-fal-save' style='flex:1;padding:8px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save Key</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Image Model</div>"
    +mhtml
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>Portrait influence (img2img strength)</div>"
    +"<div id='ro-str-wrap'>"
    +"<div style='display:flex;align-items:center;gap:10px;'>"
    +"<input type='range' id='ro-str' min='0.2' max='0.95' step='0.05' style='flex:1;accent-color:var(--acc);'/>"
    +"<span id='ro-str-val' style='font-size:13px;color:var(--acc);font-family:var(--font-mono);min-width:34px;text-align:right;'></span>"
    +"<button id='ro-str-reset' title='Reset to this model&#39;s default' style='padding:4px 9px;font-size:13px;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;'>&#8634;</button>"
    +"</div>"
    +"<p style='font-size:11px;color:var(--t2);margin:6px 0 0;'>Higher follows the scene prompt more; lower stays closer to your portrait. Applies when a portrait seeds the scene render.</p>"
    +"</div>"
    +"<p id='ro-str-na' style='display:none;font-size:11px;color:var(--t2);font-style:italic;margin:0;'>This model's img2img has no strength control.</p>"
    +"<p id='ro-msg' style='font-size:12px;min-height:16px;margin-top:10px;text-align:center;'></p>",
    {maxWidth:400,closeId:"ro-x"});
  var inp=document.getElementById("ro-fal-inp");if(falKey)inp.value=falKey;
  document.getElementById("ro-fal-save").addEventListener("click",function(){var v=inp.value.trim();if(v){falKey=v;store.set(FAL_KEY_K,v);var msg=document.getElementById("ro-msg");msg.textContent="Key saved.";msg.style.color="var(--grn)";}else{document.getElementById("ro-msg").textContent="Enter a key.";}});
  document.getElementById("ro-fal-clear").addEventListener("click",function(){falKey="";store.del(FAL_KEY_K);inp.value="";var msg=document.getElementById("ro-msg");msg.textContent="Key cleared.";msg.style.color="var(--t2)";});
  // Strength slider (#42) — shows the SELECTED model's effective strength (override or default);
  // hidden for models whose img2img API has no strength knob (nano-banana edit).
  function _roStrSync(){
    var cfg=null,ci;for(ci=0;ci<RENDER_MODELS.length;ci++){if(RENDER_MODELS[ci].id===renderModel){cfg=RENDER_MODELS[ci];break;}}
    var wrap=document.getElementById("ro-str-wrap"),na=document.getElementById("ro-str-na"),s=img2imgStrength(cfg);
    if(s===null){wrap.style.display="none";na.style.display="block";return;}
    wrap.style.display="block";na.style.display="none";
    document.getElementById("ro-str").value=s;
    document.getElementById("ro-str-val").textContent=s.toFixed(2);
  }
  document.getElementById("ro-str").addEventListener("input",function(){
    var v=parseFloat(this.value);
    document.getElementById("ro-str-val").textContent=v.toFixed(2);
    renderStrength[renderModel]=v;store.set(RENDER_STR_K,JSON.stringify(renderStrength));
  });
  document.getElementById("ro-str-reset").addEventListener("click",function(){
    delete renderStrength[renderModel];store.set(RENDER_STR_K,JSON.stringify(renderStrength));_roStrSync();
    var msg=document.getElementById("ro-msg");msg.textContent="Strength reset to model default.";msg.style.color="var(--t2)";
  });
  _roStrSync();
  // Model rows — update in place on click (restyle via the shared refresh, #15①)
  Array.prototype.forEach.call(modal.querySelectorAll(".ro-row"),function(row){
    row.addEventListener("click",function(){
      renderModel=this.getAttribute("data-id");store.set(RENDER_MDL_K,renderModel);
      radioRowsRefresh(modal,"ro-row",renderModel,"span");
      var mdlName=renderModel.split("/").pop();var msg=document.getElementById("ro-msg");if(msg){msg.textContent="Model: "+mdlName;msg.style.color="var(--grn)";}
      _roStrSync();
    });
  });
}
// loadProviderSettings moved to state.js (v1.180) — pure data logic the Blueprint Designer
// also needs (its LLM features call callGM without loading ui.js). CLAUDE.md already
// documented it as state-side; the code now matches.
function saveProviderSettings(){
  store.set(PROV_K,activeProvider);
  store.set(PKEYS_K,JSON.stringify(providerKeys));
  store.set(PMDL_K,JSON.stringify(providerModels));
  store.set(UPGRADE_K,allowModelUpgrade?"true":"false");
}
function showProviderModal(){
  closeAllMenus();/* #15④: was the closeAllMenus body inlined verbatim */
  var selProv=PROVIDERS[activeProvider]?activeProvider:"anthropic";
  // Stage key edits locally and commit only on Save (audit E88) — the old row-click wrote the typed
  // key straight into the LIVE providerKeys, so editing one provider's key then switching + cancelling
  // left the change applied for the rest of the session.
  var _pvStaged={};(function(){var _k=Object.keys(providerKeys),_i;for(_i=0;_i<_k.length;_i++)_pvStaged[_k[_i]]=providerKeys[_k[_i]];})();
  function provRows(){var ids=Object.keys(PROVIDERS),items=[],i;for(i=0;i<ids.length;i++)items.push({id:ids[i],label:PROVIDERS[ids[i]].label});return radioRowsHTML("pv-row",items,selProv,function(p,sel){return "<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+p.label+"</span>";});}
  function modelOpts(){var p=PROVIDERS[selProv],cur=providerModels[selProv]||p.defaultModel,o="",i;for(i=0;i<p.models.length;i++){o+="<option value='"+p.models[i]+"'"+(p.models[i]===cur?" selected":"")+">"+p.models[i]+"</option>";}return o;}
  var modal=modalShell("provider-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🧠 Language Model</span><button id='pv-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Provider</div>"
    +"<div id='pv-rows'>"+provRows()+"</div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>API Key</div>"
    +"<input type='password' id='pv-key' autocomplete='one-time-code' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'/>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>Model</div>"
    +"<select id='pv-model' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'>"+modelOpts()+"</select>"
    +"<label style='display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer;'><input type='checkbox' id='pv-upgrade'"+(allowModelUpgrade?" checked":"")+"><span style='font-size:12px;color:var(--t2);'>Allow model upgrade for complex tasks</span></label>"
    +"<p id='pv-msg' style='font-size:12px;min-height:16px;margin:12px 0;text-align:center;'></p>"
    +"<button id='pv-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save &amp; Use</button>",
    {maxWidth:420,closeId:"pv-x"});
  var keyInp=document.getElementById("pv-key"),modelSel=document.getElementById("pv-model");
  function refreshSel(){
    keyInp.value=_pvStaged[selProv]||"";keyInp.placeholder=PROVIDERS[selProv].keyHint;modelSel.innerHTML=modelOpts();
    radioRowsRefresh(modal,"pv-row",selProv,"span");/* #15① */
  }
  Array.prototype.forEach.call(modal.querySelectorAll(".pv-row"),function(row){row.addEventListener("click",function(){_pvStaged[selProv]=keyInp.value.trim();selProv=this.getAttribute("data-id");refreshSel();});});
  refreshSel();
  document.getElementById("pv-save").addEventListener("click",function(){
    _pvStaged[selProv]=keyInp.value.trim();
    // Commit the staged keys into the live map now (E88) — this is the only place providerKeys is mutated.
    Object.keys(_pvStaged).forEach(function(pid){if(_pvStaged[pid])providerKeys[pid]=_pvStaged[pid];else delete providerKeys[pid];});
    providerModels[selProv]=modelSel.value;activeProvider=selProv;apiKey=providerKeys[activeProvider]||"";
    allowModelUpgrade=document.getElementById("pv-upgrade").checked;
    if(activeProvider==="anthropic"&&apiKey)store.set(AKK,apiKey);
    saveProviderSettings();
    var msg=document.getElementById("pv-msg");
    if(!apiKey){msg.textContent="No key set for "+PROVIDERS[activeProvider].label+".";msg.style.color="var(--red)";return;}
    msg.textContent="Using "+PROVIDERS[activeProvider].label+" · "+modelSel.value;msg.style.color="var(--grn)";
    setTimeout(function(){var m=document.getElementById("provider-modal");if(m)m.remove();},900);
  });
}
// ── Usage & cost telemetry (TODO #21) ─────────────────────────────────────────
// Read-only view of worldState.usage (accumulated per campaign by recordUsage in
// api.js). "turn" is the bucket that prompt caching (#11) will move — compare its
// avg input/call before and after. Cost is an estimate priced from MODEL_PRICING.
function showUsageModal(){
  closeAllMenus();/* #15④ */
  var u=(worldState&&worldState.usage)||blankUsage();
  function n(v){return (v||0).toLocaleString();}
  function row(label,b,bold){
    var avg=b.calls?Math.round(b.in/b.calls):0;
    var st="padding:5px 8px;font-size:12px;font-family:var(--font-mono);text-align:right;white-space:nowrap;color:"+(bold?"var(--t0)":"var(--t1)")+";"+(bold?"border-top:1px solid var(--brd2);font-weight:bold;":"");
    return "<tr><td style='"+st+"text-align:left;font-family:var(--font);'>"+label+"</td>"
      +"<td style='"+st+"'>"+n(b.calls)+"</td><td style='"+st+"'>"+n(b.in)+"</td><td style='"+st+"'>"+n(avg)+"</td>"
      +"<td style='"+st+"'>"+n(b.cacheRead)+"</td><td style='"+st+"'>"+n(b.cacheWrite)+"</td><td style='"+st+"'>"+n(b.out)+"</td>"
      +"<td style='"+st+"'>$"+(b.costUSD||0).toFixed(4)+"</td></tr>";
  }
  var order=["turn","actions","speakers","summarize","skeleton","sync","other"],rows="",i;
  var kinds=order.filter(function(k){return u.byKind[k];}).concat(Object.keys(u.byKind).filter(function(k){return order.indexOf(k)<0;}));
  for(i=0;i<kinds.length;i++)rows+=row(kinds[i],u.byKind[kinds[i]]);
  if(!kinds.length)rows="<tr><td colspan='8' style='padding:14px;text-align:center;font-size:12px;color:var(--t2);font-style:italic;'>No API calls recorded yet — play a turn.</td></tr>";
  rows+=row("total",u,true);
  var hd="padding:5px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--t2);text-align:right;white-space:nowrap;";
  var modal=modalShell("usage-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>📊 Usage &amp; Cost</span><button id='us-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;'>"
    +"<table style='width:100%;min-width:500px;border-collapse:collapse;'>"
    +"<tr><th style='"+hd+"text-align:left;'>Kind</th><th style='"+hd+"'>Calls</th><th style='"+hd+"'>Input</th><th style='"+hd+"'>In/call</th><th style='"+hd+"'>Cache rd</th><th style='"+hd+"'>Cache wr</th><th style='"+hd+"'>Output</th><th style='"+hd+"'>~Cost</th></tr>"
    +rows+"</table></div>"
    +(function(){var tb=u.byKind&&u.byKind.turn;if(!tb||!(tb.in+tb.cacheRead))return "";var pct=Math.round(100*tb.cacheRead/(tb.in+tb.cacheRead));var col=pct>=50?"var(--grn)":pct>0?"var(--acc)":"var(--dng)";return "<p style='font-size:11px;margin:12px 0 0;color:"+col+";'>Prompt-cache health: <b>"+pct+"%</b> of turn input served from cache"+(pct===0?" — the cache is DEAD (stable-half purity leak, see console)":pct<50?" — low; long idle gaps between turns, or a purity leak":"")+".</p>";})()
    +(function(){var np=u.unpriced||0;if(!np)return "";return "<p style='font-size:11px;margin:6px 0 0;color:var(--dng);'>Unpriced calls: <b>"+np+"</b> — tokens recorded under a model id with no MODEL_PRICING entry, so the cost column UNDERCOUNTS real spend (console names the id — #30).</p>";})()
    +(function(){/* #67: display-time only, reads worldState.usage — nothing recorded here */
      var lastB=u.lastSyncBytes,totB=u.syncBytes,posts=u.syncPosts;
      var lastS=lastB?n(Math.round(lastB/1024))+" KB":"—",totS=totB?(totB/1024/1024).toFixed(2)+" MB":"—",postS=posts?n(posts):"—";
      return "<p style='font-size:11px;color:var(--t2);margin:6px 0 0;'>Sync upload: last "+lastS+" &middot; total "+totS+" across "+postS+" posts</p>";
    })()
    +(function(){/* #65 phase 1: read-only archive size — never writes to memory, JSON.stringify is for measurement only */
      if(typeof memory==="undefined"||!memory)return "";
      var a=memory.archive||{};
      var kb=Math.round(JSON.stringify(a).length/1024);
      return "<p style='font-size:11px;color:var(--t2);margin:6px 0 0;'>Memory archive: "+kb+" KB (lore "+n((a.lore||[]).length)+" &middot; decisions "+n((a.decisions||[]).length)+" &middot; chapters "+n((a.chapters||[]).length)+" &middot; superseded "+n((a.superseded||[]).length)+" &middot; coreMemories "+n((a.coreMemories||[]).length)+")</p>";
    })()
    +"<p style='font-size:11px;color:var(--t2);margin:12px 0 0;'>Token counts are exact (API-reported). Cost is an estimate for known Anthropic models; other providers count tokens but contribute $0."+(u.since?" Collecting since "+new Date(u.since).toLocaleDateString()+".":"")+"</p>"
    +"<button id='us-reset' style='width:100%;margin-top:14px;padding:9px;font-size:12px;font-family:var(--font);background:var(--bg2);color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Reset counters (start a fresh measurement window)</button>",
    {maxWidth:560,closeId:"us-x",outside:true});
  document.getElementById("us-reset").addEventListener("click",function(){
    if(worldState){worldState.usage=blankUsage();saveCore();}
    modal.remove();showUsageModal();
  });
}
// ── RAG episodic memory toggle (#27 Phase 1 — RAG_MEMORY.md) ───────────────────
// Per-campaign flag on worldState.ragMemory (rides the sync blob, read live each turn —
// the proseAuthor pattern). Modal is built fresh on open so it always reads live state.
// showRagModal removed v1.349 (user call 2026-07-17, after closing #55 on field evidence): episodic
// memory is standard behavior, not a setting. ragEnabled()'s flag machinery + the engine-tested
// flag-off prompt path survive intact (console `worldState.ragMemory=false` = diagnosis-only escape
// hatch; migrateWorldState clears it on next load so it can never silently stick).
// ── Prose inspiration (TODO #23) ───────────────────────────────────────────────
function loadProseAuthor(){var v=store.get(PROSE_K);proseAuthor=(typeof v==="string")?v:"";}
// TODO #7 audition surface — the Sound Library modal. Built because the console/one-button route
// was unusable for actually JUDGING these: a 50ms blip you have to wait 45 seconds for and might
// miss entirely is not a review tool (user, 2026-07-18). Three properties make it usable:
//   ① one ▶ per sound, replayable on tap — compare by ear, back to back, in any order;
//   ② a visual PULSE on the row that fires with the audio — you can SEE which one played, so a
//      sound you missed (or that failed to emit) is never ambiguous;
//   ③ Sound.preview() plays even when UI sounds are OFF — clicking ▶ is an explicit request, and
//      it reports honestly (⚠ row) when nothing could be scheduled instead of silently doing nothing.
// DATA-DRIVEN: rows are generated from SOUND_LIB, so adding a sound adds a row for free — no
// per-sound UI code, same registry philosophy as the tag table and the capability bible.
function showSoundModal(){
  closeAllMenus();/* #15④ */
  if(typeof Sound==="undefined"){showToast("Sound library unavailable.");return;}
  var ids=Object.keys(Sound.SOUND_LIB||{});
  // Where each sound fires today — audition without this is judging a noise out of context.
  var WIRED={click_bone:"Every toast (general poke)",click_glass:"Quest · level up · defining moment · combat"};
  var rows="",i,grp=null;
  for(i=0;i<ids.length;i++){
    var id=ids[i],e=Sound.SOUND_LIB[id],w=WIRED[id]||"Not wired yet";
    var unwired=/Not wired/.test(w);
    // Section header whenever the group changes — the click palette is a different KIND of
    // thing from the event motifs and shouldn't read as one undifferentiated list.
    var g=e.group||"event";
    if(g!==grp){grp=g;
      rows+="<div style='font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--acc);padding:14px 0 4px;'>"+(g==="click"?"Click palette — pick by material":"Event sounds")+"</div>";}
    rows+="<div class='snd-row' data-id='"+escHtml(id)+"' style='display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--brd);'>"
      +"<button class='snd-play' data-id='"+escHtml(id)+"' title='Play "+escHtml(id)+"' style='flex-shrink:0;width:30px;height:30px;border-radius:50%;border:1px solid var(--acc);background:none;color:var(--acc);cursor:pointer;font-size:12px;line-height:1;'>&#9654;</button>"
      +"<div style='flex:1;min-width:0;'>"
        +"<div style='font-size:13px;color:var(--t0);'>"+escHtml(id)+"</div>"
        +"<div style='font-size:11px;color:var(--t2);'>"+escHtml(e&&e.label?e.label:"")+"</div>"
      +"</div>"
      +"<div style='flex-shrink:0;font-size:10px;color:"+(unwired?"var(--t2)":"var(--acc)")+";text-align:right;max-width:118px;'>"+escHtml(unwired?"":w)+"</div>"/* wired sounds name where they fire; unwired ones show nothing rather than shouting "Not wired yet" 15 times */
      +"</div>";
  }
  var on=Sound.enabled();
  var modal=modalShell("snd-modal",
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>&#9834; Sound Library</span><button id='snd-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 12px;'>Tap &#9654; to hear a sound — the row flashes as it plays, so a short blip is never ambiguous. Preview works even with UI sounds switched off.</p>"
    +"<div id='snd-rows'>"+rows+"</div>"
    +"<div style='display:flex;align-items:center;gap:10px;margin-top:14px;'>"
      +"<label style='display:flex;align-items:center;gap:8px;flex:1;font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'><input type='checkbox' id='snd-on' "+(on?"checked":"")+" style='accent-color:var(--acc);cursor:pointer;width:13px;height:13px;'/> UI sounds on during play</label>"
      +"<button id='snd-all' style='font-size:11px;font-family:var(--font);background:none;border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;padding:4px 10px;'>Play all</button>"
    +"</div>",
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:440,boxExtra:"margin-top:40px;",closeId:"snd-x",outside:true});
  // Pulse the row so the eye confirms what the ear may have missed (property ② above).
  function flash(id,ok){
    var row=modal.querySelector(".snd-row[data-id='"+id+"']");if(!row)return;
    row.style.transition="";row.style.background=ok?"rgba(184,147,90,.28)":"rgba(192,106,90,.28)";
    setTimeout(function(){row.style.transition="background .45s";row.style.background="";},90);
  }
  function playOne(id){
    var ok=Sound.preview(id);
    flash(id,ok);
    if(!ok)showToast("⚠ '"+id+"' could not play — check the console for the reason");
  }
  Array.prototype.forEach.call(modal.querySelectorAll(".snd-play"),function(b){
    b.addEventListener("click",function(){playOne(b.getAttribute("data-id"));});
  });
  document.getElementById("snd-on").addEventListener("change",function(){
    Sound.setEnabled(this.checked);
    eachMenuEl("sound-cb",function(el){el.checked=Sound.enabled();});/* keep the menu checkboxes in step */
  });
  // Play all: 700ms apart — long enough to separate two ~0.5s motifs, short enough to compare.
  document.getElementById("snd-all").addEventListener("click",function(){
    var k;for(k=0;k<ids.length;k++)(function(id,n){setTimeout(function(){if(document.getElementById("snd-modal"))playOne(id);},n*700);})(ids[k],k);
  });
}
function showProseModal(){
  closeAllMenus();/* #15④ */
  var sel=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:(proseAuthor||"");
  function rows(){return radioRowsHTML("pr-row",AUTHORS,sel,function(a,s){
    return "<div><div style='font-size:13px;color:"+(s?"var(--acc)":"var(--t1)")+";'>"+escHtml(a.nm)+(a.profane?" <span style=\"font-size:10px;color:var(--t2);\">· 18+ for full voice</span>":"")+"</div>"
      +(a.blurb?"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(a.blurb)+"</div>":"")+"</div>";
  },{align:"flex-start",dotTop:true});}
  var modal=modalShell("prose-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>✍ Prose Inspiration</span><button id='pr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'>The GM imitates this author's voice. Takes effect on the next turn — switch any time.</p>"
    +"<div id='pr-rows'>"+rows()+"</div>"
    +"<button id='pr-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;margin-top:8px;'>Save</button>",
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:440,boxExtra:"margin-top:40px;",closeId:"pr-x",outside:true});
  function refresh(){radioRowsRefresh(modal,"pr-row",sel,"div>div");}/* #15① — "div>div" preserved verbatim, see radioRowsRefresh note */
  Array.prototype.forEach.call(modal.querySelectorAll(".pr-row"),function(row){row.addEventListener("click",function(){sel=this.getAttribute("data-id");refresh();});});
  document.getElementById("pr-save").addEventListener("click",function(){
    proseAuthor=sel;store.set(PROSE_K,sel);   // device default for new/unset campaigns
    if(worldState){worldState.proseAuthor=sel;if(typeof saveAll==="function")saveAll();} // pin to THIS campaign; rides the sync blob across devices
    var a=null,i;for(i=0;i<AUTHORS.length;i++){if(AUTHORS[i].id===sel){a=AUTHORS[i];break;}}
    showToast(sel?("Prose voice: "+(a?a.nm:sel)+(worldState?" · this campaign":"")):"Prose voice: house default");
    modal.remove();
  });
}
// ── #81: item-canon confirm — the ONLY path from an [ITEM_DEF:] proposal to canon ────────────
// #215: the reward-claim modal. Thin veneer over rewardClaimAccept/rewardClaimDecline
// (helpers.js — the pure, engine-tested writers). Shown when a dispute shelves owing the player
// a reward, and re-surfaced on boot/campaign load like the item-def queue, so a claim can never
// be lost by closing the tab. The DOUBT IS STATED: this reward was withheld because the GM's
// account of the scene did not hold up, so it may not have been earned. The player rules.
function showRewardClaimModal(){
  var pend=(worldState&&worldState.pendingRewardClaims)||[];
  if(!pend.length)return;
  function rowsHtml(){
    var h="",i;
    for(i=0;i<pend.length;i++){var p=pend[i];
      var sum=(typeof w2WithheldSummary==="function")?w2WithheldSummary(p.tokens):p.tokens.join(", ");
      var why=(typeof w2RefusalCopy==="function")?w2RefusalCopy(p.reason):p.reason;
      h+="<div style='border:1px solid var(--brd2);border-radius:var(--r);padding:12px;margin-bottom:10px;background:var(--bg2);'>"
        +"<div style='font-size:14px;color:var(--acc);font-weight:bold;'>"+escHtml(sum||"(nothing recorded)")+"</div>"
        +"<div style='font-size:11.5px;color:var(--t1);margin:6px 0 3px;'>Held back around <b>"+escHtml(p.subject)+"</b> on turn "+escHtml(String(p.turn))+".</div>"
        +"<div style='font-size:11px;color:var(--t2);margin:0 0 10px;'>Why it was held: "+escHtml(why)+".</div>"
        +"<div style='display:flex;gap:8px;'>"
        +"<button class='rc-acc' data-id='"+escHtml(p.id)+"' style='flex:1;padding:8px;font-size:12px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Award it</button>"
        +"<button class='rc-dec' data-id='"+escHtml(p.id)+"' style='flex:1;padding:8px;font-size:12px;font-family:var(--font);background:none;color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Let it go</button>"
        +"</div></div>";}
    return h;
  }
  var modal=modalShell("rewardclaim-modal",
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>\u2726 A reward is waiting on your call</span><button id='rc-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;line-height:1.5;'>The engine held these back because the GM\u2019s account of the scene didn\u2019t hold up, and the GM never sorted it out. They may still be yours \u2014 or they may have been paid for something that never happened. Your call. Closing this keeps them waiting.</p>"
    +"<div id='rc-rows'>"+rowsHtml()+"</div>",
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:420,boxExtra:"margin-top:40px;",closeId:"rc-x",outside:true});
  function wire(){
    Array.prototype.forEach.call(modal.querySelectorAll(".rc-acc"),function(b){b.addEventListener("click",function(){
      rewardClaimAccept(this.getAttribute("data-id"));
      pend=(worldState&&worldState.pendingRewardClaims)||[];
      if(!pend.length){modal.remove();if(typeof syncUI==="function")syncUI();return;}
      document.getElementById("rc-rows").innerHTML=rowsHtml();wire();
    });});
    Array.prototype.forEach.call(modal.querySelectorAll(".rc-dec"),function(b){b.addEventListener("click",function(){
      if(rewardClaimDecline(this.getAttribute("data-id")))showToast("Left as it stands.");
      pend=(worldState&&worldState.pendingRewardClaims)||[];
      if(!pend.length){modal.remove();return;}
      document.getElementById("rc-rows").innerHTML=rowsHtml();wire();
    });});
  }
  wire();
}
// Thin veneer over itemDefAccept/itemDefDecline (helpers.js — the pure, engine-tested writers).
// Lists every pending proposal with its full fixed-attribute definition; Accept writes the
// write-once overlay entry, Decline drops it loudly. Re-renders in place until the queue is
// empty, then closes. Proposals ride the save (worldState.pendingItemDefs), so an unanswered
// queue re-surfaces via init()/campLoad rather than vanishing with the session.
function showItemDefConfirmModal(){
  var pend=(worldState&&worldState.pendingItemDefs)||[];
  if(!pend.length)return;
  function rowsHtml(){
    var h="",i,ci;
    for(i=0;i<pend.length;i++){var p=pend[i];
      /* #157: inventory-category checkboxes, seeded from the proposal (its array when present,
         else the primary category). The PRIMARY category is locked on — the scalar mechanics
         contract stays authoritative; the player may only ADD applicable sections (Sol §7.4). */
      var _sel={},_seed=(p.entry.inventoryCategories instanceof Array&&p.entry.inventoryCategories.length)?p.entry.inventoryCategories:[p.entry.category];
      for(ci=0;ci<_seed.length;ci++)_sel[_seed[ci]]=1;
      var cats="";
      for(ci=0;ci<INVENTORY_CATEGORY_REGISTRY.length;ci++){var _c=INVENTORY_CATEGORY_REGISTRY[ci],_prim=_c.id===p.entry.category;
        cats+="<label style='font-size:10.5px;color:var(--t1);margin-right:9px;white-space:nowrap;'><input type='checkbox' class='idf-cat' data-key='"+escHtml(p.key)+"' value='"+_c.id+"'"+(_sel[_c.id]||_prim?" checked":"")+(_prim?" disabled":"")+" style='vertical-align:middle;margin-right:3px;'>"+escHtml(_c.label)+"</label>";}
      h+="<div style='border:1px solid var(--brd2);border-radius:var(--r);padding:12px;margin-bottom:10px;background:var(--bg2);'>"
        +"<div style='font-size:13px;color:var(--t0);font-weight:bold;'>"+escHtml(p.name)+"</div>"
        +"<div style='font-size:11px;color:var(--t2);margin:4px 0 8px;'>"+escHtml(p.entry.category)+" · effect: "+escHtml(p.entry.effect)+" · uses: "+escHtml(p.entry.uses)+" · value: "+escHtml(p.entry.value)+"</div>"
        +"<div style='margin:0 0 9px;line-height:1.9;'><span style='font-size:10px;color:var(--t2);letter-spacing:.5px;text-transform:uppercase;margin-right:8px;'>Files under</span>"+cats+"</div>"
        +"<div style='display:flex;gap:8px;'>"
        +"<button class='idf-acc' data-key='"+escHtml(p.key)+"' style='flex:1;padding:8px;font-size:12px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Accept as canon</button>"
        +"<button class='idf-dec' data-key='"+escHtml(p.key)+"' style='flex:1;padding:8px;font-size:12px;font-family:var(--font);background:none;color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Decline</button>"
        +"</div></div>";}
    return h;
  }
  var modal=modalShell("itemdef-modal",
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>⚗ Item canon proposed</span><button id='idf-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'>The GM proposes fixed mechanics for these items. Accepted definitions become permanent campaign canon (re-injected every turn, shown in tooltips); declined ones are dropped. Closing keeps them pending.</p>"
    +"<div id='idf-rows'>"+rowsHtml()+"</div>",
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:440,boxExtra:"margin-top:40px;",closeId:"idf-x",outside:true});
  function wire(){
    Array.prototype.forEach.call(modal.querySelectorAll(".idf-acc"),function(b){b.addEventListener("click",function(){
      var k=this.getAttribute("data-key");
      /* #157: collect the checked sections in REGISTRY order onto the pending entry before the
         accept writes it — the primary category always rides (its box is locked+checked). */
      var _pi,_pp=null,_pl=(worldState&&worldState.pendingItemDefs)||[];
      for(_pi=0;_pi<_pl.length;_pi++){if(_pl[_pi].key===k){_pp=_pl[_pi];break;}}
      if(_pp){
        var _checked={},_boxes=modal.querySelectorAll(".idf-cat[data-key='"+k.replace(/'/g,"\\'")+"']"),_bi;
        for(_bi=0;_bi<_boxes.length;_bi++){if(_boxes[_bi].checked||_boxes[_bi].disabled)_checked[_boxes[_bi].value]=1;}
        _checked[_pp.entry.category]=1;
        var _arr=[],_ci2;
        for(_ci2=0;_ci2<INVENTORY_CATEGORY_REGISTRY.length;_ci2++){if(_checked[INVENTORY_CATEGORY_REGISTRY[_ci2].id])_arr.push(INVENTORY_CATEGORY_REGISTRY[_ci2].id);}
        _pp.entry.inventoryCategories=_arr;
      }
      if(itemDefAccept(k))showToast("⚗ Item canon accepted");
      pend=(worldState&&worldState.pendingItemDefs)||[];
      if(!pend.length){modal.remove();return;}
      document.getElementById("idf-rows").innerHTML=rowsHtml();wire();
    });});
    Array.prototype.forEach.call(modal.querySelectorAll(".idf-dec"),function(b){b.addEventListener("click",function(){
      var k=this.getAttribute("data-key");
      if(itemDefDecline(k))showToast("Item definition declined");
      pend=(worldState&&worldState.pendingItemDefs)||[];
      if(!pend.length){modal.remove();return;}
      document.getElementById("idf-rows").innerHTML=rowsHtml();wire();
    });});
  }
  wire();
}
// ── Quest journal ─────────────────────────────────────────────────────────────
function showQuestModal(){
  var ql=(worldState&&worldState.questLog)||[];
  function objList(q){if(!q.objectives||!q.objectives.length)return"";var h="<div style='margin-top:6px;'>",oj;for(oj=0;oj<q.objectives.length;oj++){var o=q.objectives[oj];h+="<div style='font-size:12px;color:"+(o.done?"var(--t2)":"var(--t1)")+";margin:2px 0;'>"+(o.done?"☑":"☐")+" "+escHtml(o.text)+(o.optional?" <span style='color:var(--t2);'>(optional)</span>":"")+"</div>";}return h+"</div>";}
  var offeredHtml="",activeHtml="",i;
  for(i=0;i<ql.length;i++){var q=ql[i];
    if(q.status==="offered"){
      offeredHtml+="<div style='border:1px solid var(--brd2);border-radius:var(--r);padding:12px;margin-bottom:10px;background:var(--bg2);'>"
        +"<div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+escHtml(q.title)+"</div>"
        +(q.desc?"<div style='font-size:12px;color:var(--t2);margin-top:3px;'>"+escHtml(q.desc)+"</div>":"")+objList(q)
        +"<div style='display:flex;gap:8px;margin-top:10px;'>"
        +"<button class='qa' data-qacc='"+escHtml(q.title)+"' style='background:var(--acc);color:var(--on-acc);border:none;font-weight:bold;'>Accept</button>"
        +"<button class='qa' data-qdec='"+escHtml(q.title)+"'>Decline</button></div></div>";
    }else if(q.status==="active"){
      // #229: two per-quest actions (owner request 2026-08-24). Suggest completion = a GM review
      // call (suggestQuestCompletion, game.js) that checks achieved objectives off and explains
      // itself in a decisions modal; Abandon = confirm → abandonQuestState (api.js). Active
      // quests only — offered quests keep Accept/Decline, and neither action means anything there.
      activeHtml+="<div style='border-bottom:1px solid var(--brd);padding:10px 0;'>"
        +"<div style='font-size:14px;color:var(--t0);'>"+escHtml(q.title)+"</div>"
        +(q.desc?"<div style='font-size:12px;color:var(--t2);margin-top:3px;'>"+escHtml(q.desc)+"</div>":"")+objList(q)
        +"<div style='display:flex;gap:8px;margin-top:10px;'>"
        +"<button class='qa' data-qsug='"+escHtml(q.title)+"' title='Ask the GM to review this quest against the story so far: objectives already achieved get checked off, and if the end condition has truly happened the quest completes with its rewards. Shows the reasoning afterward.'>Suggest completion</button>"
        +"<button class='qa' data-qaband='"+escHtml(q.title)+"' title='Drop this quest deliberately: it moves to History as abandoned and the GM stops steering toward it. It can only ever return as a fresh offer. Asks for confirmation.'>Abandon quest</button></div></div>";
    }
  }
  var arch=(memory&&memory.quests)?Object.keys(memory.quests).map(function(k){return memory.quests[k];}):[];
  // History entries render like Active ones — desc + the objective checklist — but collapsed
  // (user call 2026-08-07: a quest completing a few turns after its last objective reads as
  // "WTH, how?" when History shows only a title; the checklist IS the how). archiveQuest has
  // always kept desc/objectives; older or declined records may lack either — degrade to the
  // old title-only line inside the summary, never break.
  // #235: "abandoned" has three authors (player drop / arc wall / a never-accepted hook lapsing
  // with its arc) and the bare status rendered all three identically — beside an Abandon button
  // whose own tooltip teaches that abandoned means the PLAYER's deliberate drop. The label comes
  // from the one pure renderer (questArchiveWording, helpers.js); a legacy record with no `by`
  // still reads the old neutral "abandoned".
  var histHtml="";for(i=0;i<arch.length;i++){var aq=arch[i];var clr=aq.status==="completed"?"var(--grn)":aq.status==="failed"?"var(--red)":"var(--t2)";var sym=aq.status==="completed"?"✓":aq.status==="failed"?"✗":"—";
    var qLbl=aq.status==="abandoned"?questArchiveWording(aq).label:aq.status;
    histHtml+="<details style='padding:3px 0;'>"
      +"<summary style='cursor:pointer;font-size:12px;color:var(--t2);'><span style='color:"+clr+";'>"+sym+"</span> "+escHtml(aq.title)+" <span style='font-size:10px;'>("+escHtml(qLbl)+(aq.turn?" · t"+aq.turn:"")+")</span></summary>"
      +(aq.desc?"<div style='font-size:12px;color:var(--t2);margin:4px 0 0 16px;'>"+escHtml(aq.desc)+"</div>":"")
      +"<div style='margin-left:16px;'>"+objList(aq)+"</div>"
      +"</details>";}
  var body="";
  if(offeredHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);margin:2px 0 8px;'>⚑ Opportunities</div>"+offeredHtml;
  body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin:14px 0 8px;'>Active</div>"+(activeHtml||"<div style='font-size:12px;color:var(--t2);font-style:italic;'>No active quests.</div>");
  if(histHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2);margin:14px 0 8px;'>History</div>"+histHtml;
  var modal=modalShell("quest-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Quest Journal</span><button id='qm-x' style='background:none;border:none;color:var(--t2);font-size:22px;cursor:pointer;'>&#215;</button></div>"+body,
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:480,boxExtra:"margin-top:40px;",closeId:"qm-x",outside:true});
  // Wire by TITLE, not render-time index (audit E24): applyMuts can splice the questLog while the
  // modal is open (a completed quest archives), and an index baked into onclick would then hit the
  // wrong quest — declineQuest could even archive a still-active quest.
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qacc]"),function(b){b.addEventListener("click",function(){acceptQuest(b.getAttribute("data-qacc"));});});
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qdec]"),function(b){b.addEventListener("click",function(){declineQuest(b.getAttribute("data-qdec"));});});
  // #229 — wired by TITLE like the pair above (audit E24: applyMuts can splice while open).
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qsug]"),function(b){b.addEventListener("click",function(){
    if(typeof busy!=="undefined"&&busy){if(typeof showToast==="function")showToast("The GM is busy — try again in a moment.");return;}
    modal.remove();suggestQuestCompletion(b.getAttribute("data-qsug"));
  });});
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qaband]"),function(b){b.addEventListener("click",function(){_confirmAbandonQuest(b.getAttribute("data-qaband"));});});
}
// #229: the Abandon confirmation (state op = abandonQuestState, api.js — this is only the shell).
function _confirmAbandonQuest(title){
  var m=modalShell("quest-abandon-confirm",
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:10px;'>Abandon quest?</div>"
    +"<div style='font-size:13px;color:var(--t1);margin-bottom:6px;'>"+escHtml(title)+"</div>"
    +"<div style='font-size:12px;color:var(--t2);margin-bottom:14px;'>The quest moves to History as abandoned and the GM stops steering toward it. It can only ever come back as a fresh offer for you to accept or refuse.</div>"
    +"<div style='display:flex;gap:8px;justify-content:flex-end;'>"
    +"<button class='qa' id='qab-no'>Cancel</button>"
    +"<button class='qa' id='qab-yes' style='background:var(--red);color:#fff;border:none;font-weight:bold;'>Abandon</button></div>",
    {z:320,maxWidth:380,closeId:"qab-no",outside:true});
  var yes=document.getElementById("qab-yes");
  if(yes)yes.addEventListener("click",function(){
    m.remove();
    if(abandonQuestState(title)){saveAll();if(typeof syncUI==="function")syncUI();if(typeof showToast==="function")showToast("Quest abandoned: "+title);}
    else if(typeof showToast==="function")showToast("Could not abandon — quest not found or not active.");
    showQuestModal();
  });
}
// #229: the decisions modal — what the completion review changed, and the GM's reasoning.
// Rendered from applyMuts' muts lines (ground truth of what actually happened) + cleanTxt prose.
function showQuestDecisionsModal(title,changed,explanation){
  var chHtml=changed&&changed.length
    ?changed.map(function(c){return "<div style='font-size:12px;color:var(--grn);margin:2px 0;'>• "+escHtml(c)+"</div>";}).join("")
    :"<div style='font-size:12px;color:var(--t2);font-style:italic;'>No state changes — nothing new qualified.</div>";
  modalShell("quest-decisions-modal",
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>Completion review — "+escHtml(title)+"</span><button id='qdm-x' style='background:none;border:none;color:var(--t2);font-size:22px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin-bottom:6px;'>Changes applied</div>"+chHtml
    +(explanation?"<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin:12px 0 6px;'>The GM's reasoning</div><div style='font-size:12px;color:var(--t1);white-space:pre-wrap;'>"+escHtml(explanation)+"</div>":"")
    +"<div style='display:flex;justify-content:flex-end;margin-top:14px;'><button class='qa' id='qdm-back'>Back to journal</button></div>",
    {z:320,maxWidth:440,closeId:"qdm-x",outside:true,overlayExtra:"overflow-y:auto;",align:"flex-start",boxExtra:"margin-top:40px;"});
  var back=document.getElementById("qdm-back");
  if(back)back.addEventListener("click",function(){var ex=document.getElementById("quest-decisions-modal");if(ex)ex.remove();showQuestModal();});
}
// Resolve by title + offered status (audit E24) so a shifted index can't accept/decline the wrong quest.
function acceptQuest(title){
  if(!worldState||!worldState.questLog)return;
  var i;for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].title===title&&worldState.questLog[i].status==="offered"){worldState.questLog[i].status="active";saveAll();syncUI();if(typeof showToast==="function")showToast("Quest accepted: "+title);break;}}
  showQuestModal();
}
function declineQuest(title){
  if(!worldState||!worldState.questLog)return;
  var i;for(i=0;i<worldState.questLog.length;i++){var q=worldState.questLog[i];if(q.title===title&&q.status==="offered"){if(!memory.quests)memory.quests={};memory.quests[q.title]={title:q.title,desc:q.desc||"",objectives:q.objectives||[],status:"declined",turn:worldState.turn||0};worldState.questLog.splice(i,1);saveAll();syncUI();if(typeof showToast==="function")showToast("Quest declined: "+title);break;}}
  showQuestModal();
}
// ── Bug report modal (#16b) — File ▸ ⚠ Report bug ────────────────────────────────────────────
// Flow: menu already closed by the caller → screenshot FIRST (so the report shows the game, not
// this modal) → modal with thumbnail + textarea + Send. Screenshot is a DOM re-render via the
// vendored html-to-image (loaded lazily below — 20KB, only fetched on first report; the real
// screen-capture API needs a permission picker and doesn't exist on iOS). Capture failure is
// non-fatal and VISIBLE: the modal says the report will go text-only.
var _h2iLoading=false;
function _loadHtml2Image(cb){
  if(typeof htmlToImage!=="undefined"){cb(htmlToImage);return;}
  if(_h2iLoading){cb(null);return;}
  _h2iLoading=true;
  var s=document.createElement("script");
  s.src="vendor/html-to-image/html-to-image.js";
  s.onload=function(){_h2iLoading=false;cb(typeof htmlToImage!=="undefined"?htmlToImage:null);};
  s.onerror=function(){_h2iLoading=false;console.warn("[bug-report] html-to-image failed to load — report will go without a screenshot");cb(null);};
  document.head.appendChild(s);
}
// Capture = html-to-image's toSvg (the DOM→SVG style-inliner, the genuinely hard part) + OUR OWN
// Image/canvas/JPEG encode. Deliberately NOT the lib's toJpeg: its internal helper awaits
// img.decode() + requestAnimationFrame, and BOTH can stall forever in embedded/backgrounded
// Chromium (live-verified 2026-07-18: toJpeg hung >8s on a 2-element div while toSvg + manual
// onload/drawImage of the same SVG succeeded instantly). Plain Image.onload + drawImage avoids
// both. Every failure path lands cb(null) exactly once — the report then goes text-only, LOUDLY.
// Known WebKit limit: iOS Safari taints a canvas that drew a foreignObject SVG, so toDataURL
// throws there → text-only report on iPhones (the catch below). skipFonts always: the UI is
// system-font, embedding is pure cost/risk.
var BUG_SHOT_TIMEOUT_MS=8000;
var BUG_SHOT_PLACEHOLDER="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // 1×1 transparent GIF
// Clone-time node filter — ONE bad <img> anywhere in the captured subtree used to kill the WHOLE
// capture (root-caused live 2026-07-18, the reason no field report has ever carried a screenshot):
// an <img> with a missing/empty src attribute resolves to the PAGE URL itself, html-to-image
// fetches it, embeds the returned text/html as the "image", and that img's error event rejects
// toSvg (proven breaker: the src-less #car-portrait-img). Src-less imgs paint nothing, so
// dropping them is visually free. The OTHER half of the class — non-empty but unfetchable srcs
// (CORS-blocked fal.media scene renders, 404s, dead hosts) — is absorbed by imagePlaceholder in
// the toSvg options: the lib swaps failed fetches for the placeholder instead of breaking.
function _bugShotFilter(node){
  return !(node&&node.tagName==="IMG"&&!node.getAttribute("src"));
}
function _bugCapture(cb){
  _loadHtml2Image(function(lib){
    if(!lib){cb(null);return;}
    var el=document.getElementById("game-screen");
    if(!el||el.style.display==="none"||!el.offsetWidth)el=document.body;
    var W=el.offsetWidth||document.documentElement.clientWidth||800;
    var H=el.offsetHeight||document.documentElement.clientHeight||600;
    var done=false;
    function fin(d){if(done)return;done=true;cb(d);}
    setTimeout(function(){if(!done){console.warn("[bug-report] screenshot timed out ("+BUG_SHOT_TIMEOUT_MS+"ms) — sending text-only");fin(null);}},BUG_SHOT_TIMEOUT_MS);
    lib.toSvg(el,{skipFonts:true,filter:_bugShotFilter,imagePlaceholder:BUG_SHOT_PLACEHOLDER})
      .then(function(svg){
        var im=new Image();
        im.onload=function(){
          try{
            var cv=document.createElement("canvas");
            cv.width=W;cv.height=H;
            var cx=cv.getContext("2d");
            cx.fillStyle="#0d0d0d";cx.fillRect(0,0,W,H);
            cx.drawImage(im,0,0,W,H);
            fin(cv.toDataURL("image/jpeg",0.55));
          }catch(e){console.warn("[bug-report] canvas encode failed (WebKit foreignObject taint?) — sending text-only:",e&&e.message);fin(null);}
        };
        im.onerror=function(){console.warn("[bug-report] snapshot image failed to load — sending text-only");fin(null);};
        im.src=svg;
      })
      .catch(function(e){console.warn("[bug-report] DOM snapshot failed — sending text-only:",e&&e.message);fin(null);});
  });
}
function showBugReportModal(){
  if(typeof ERROR_WEBHOOK_URL==="undefined"||!ERROR_WEBHOOK_URL){
    if(typeof showToast==="function")showToast("⚠ Bug reporting isn't configured — ERROR_WEBHOOK_URL is empty (error-report.js)",6000);
    return;
  }
  _bugCapture(function(dataUrl){_bugReportModal(dataUrl);});
}
function _bugReportModal(shot){
  var inner="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'><h3 style='color:var(--acc);font-size:15px;font-weight:bold;'>⚠ Report a problem</h3><button id='bug-close' style='background:none;border:none;color:var(--t2);font-size:18px;cursor:pointer;line-height:1;'>&times;</button></div>"
    +(shot
      ?"<img src='"+shot+"' alt='screenshot' style='display:block;max-width:100%;max-height:120px;border:1px solid var(--brd);border-radius:6px;margin:0 auto 10px;'/>"
      :"<div style='font-size:11px;color:var(--t2);margin-bottom:10px;'>(screenshot unavailable — the report will be text-only)</div>")
    +"<textarea id='bug-text' rows='5' placeholder='What happened? A nonsense suggestion, a hallucination, drift, a broken screen — describe what you saw and what you expected.' style='width:100%;box-sizing:border-box;padding:10px;background:var(--bg2);border:1px solid var(--brd2);border-radius:6px;color:var(--t0);font-size:13px;font-family:var(--font);resize:vertical;'></textarea>"
    +"<div style='font-size:10px;color:var(--t2);margin-top:8px;line-height:1.5;'>Attached automatically: the screenshot above, your last 5 exchanges, the suggested actions on screen, and a game-state summary. Mentioning quests, rendering, the model, voice, combat, memory, or sync attaches those settings too. Never sent: API keys or tokens.</div>"
    +"<div id='bug-err' style='display:none;color:var(--hp);font-size:12px;margin-top:8px;'></div>"
    +"<div style='display:flex;gap:8px;justify-content:flex-end;margin-top:12px;'>"
    +"<button id='bug-cancel' style='padding:8px 14px;background:var(--bg2);border:1px solid var(--brd2);border-radius:6px;color:var(--t1);font-size:13px;font-family:var(--font);cursor:pointer;'>Cancel</button>"
    +"<button id='bug-send' style='padding:8px 16px;background:var(--acc);border:none;border-radius:6px;color:#141210;font-size:13px;font-family:var(--font);font-weight:bold;cursor:pointer;'>Send report</button>"
    +"</div>";
  var modal=modalShell("bug-modal",inner,{closeId:"bug-close",outside:true,maxWidth:520});
  document.getElementById("bug-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("bug-send").addEventListener("click",function(){
    var ta=document.getElementById("bug-text");
    var txt=ta.value.trim();
    if(!txt){ta.focus();ta.style.borderColor="var(--acc)";return;}
    var btn=document.getElementById("bug-send");
    btn.disabled=true;btn.style.opacity="0.6";btn.textContent="Sending…";
    sendUserReport(txt,shot,function(ok,err,body){
      if(ok){
        modal.remove();
        // GAS reports per-half store failures in its response body — a report that "sent" but
        // lost its screenshot/sheet/email half must say so (the Drive-permission lesson, v1.365).
        var partial=body&&(body.screenshot?"screenshot":body.sheet?"sheet record":body.email?"email":null);
        if(typeof showToast==="function")showToast(partial?("⚠ Report sent, but the server couldn't store the "+partial+" — see console"):"✓ Report sent — thank you",partial?7000:4000);
      }
      else{
        btn.disabled=false;btn.style.opacity="1";btn.textContent="Send report";
        var ee=document.getElementById("bug-err");
        if(ee){ee.style.display="block";ee.textContent="⚠ Send failed: "+err+" — your text is preserved, try again.";}
      }
    });
  });
  setTimeout(function(){var t=document.getElementById("bug-text");if(t)t.focus();},50);
}

// ─── #17: Drift health modal — thin DOM shell over healthIndicators() (helpers.js) ─────────
// Opened by the membar health dot (updateHealthDot, ui-panels.js). The ⚠ Submit report button
// files the indicator snapshot through the #16b sendUserReport path so a bad reading becomes
// a bug report in one tap.
function showHealthModal(){
  closeAllMenus();
  var old=document.getElementById("health-modal");if(old)old.remove();
  var h=(typeof healthIndicators==="function"&&worldState)?healthIndicators(worldState,(typeof memory!=="undefined"?memory:null),true):{overall:"na",items:[],growth:[]};
  function col(lv){return lv==="bad"?"var(--red)":lv==="warn"?"var(--acc)":lv==="ok"?"var(--grn)":"var(--t2)";}
  function word(lv){return lv==="bad"?"PROBLEM":lv==="warn"?"WATCH":lv==="ok"?"HEALTHY":"N/A";}
  var m=document.createElement("div");m.id="health-modal";
  m.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;";
  var rows="",i;
  for(i=0;i<h.items.length;i++){var it=h.items[i];
    rows+="<div style='display:flex;gap:8px;align-items:flex-start;padding:7px 2px;border-bottom:1px solid var(--brd);'>"
      +"<div class='mdot' style='margin-top:4px;background:"+col(it.level)+";"+(it.level==="na"?"opacity:.35;":"")+"'></div>"
      +"<div style='flex:1;'><div style='font-size:12px;color:var(--t0);'>"+escHtml(it.label)+" — <span style='color:"+col(it.level)+";'>"+word(it.level)+"</span></div>"
      +"<div style='font-size:11px;color:var(--t2);margin-top:1px;'>"+escHtml(it.detail)+"</div>"
      +(it.hint?"<div style='font-size:11px;color:var(--t1);margin-top:3px;'>&#8594; "+escHtml(it.hint)+"</div>":"")
      +"</div></div>";
  }
  var growthRows="",growth=h.growth||[];
  function growthSize(n){if(n==null)return "measurement unavailable";if(n<1024)return n+" B";if(n<1048576)return (n/1024).toFixed(1)+" KB";return (n/1048576).toFixed(2)+" MB";}
  for(i=0;i<growth.length;i++){var gr=growth[i],grUnit=gr.count===1?gr.unit.replace(/s$/i,""):gr.unit;
    growthRows+="<div style='display:flex;justify-content:space-between;gap:10px;padding:4px 2px;font-size:11px;color:var(--t2);'>"
      +"<span>"+escHtml(gr.label)+" — "+gr.count.toLocaleString()+" "+escHtml(grUnit)+"</span>"
      +"<span style='white-space:nowrap;color:var(--t1);'>"+growthSize(gr.bytes)+"</span></div>";
  }
  m.innerHTML="<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:16px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;'><b style='color:var(--t0);'>Drift health</b><span id='hm-close' style='cursor:pointer;color:var(--t2);font-size:18px;padding:0 4px;'>&times;</span></div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:8px;'>Leading indicators computed from this save's own rings — green means the anti-drift stack looks alive, not that the story is good. Overall: <span style='color:"+col(h.overall)+";font-weight:bold;'>"+word(h.overall)+"</span></div>"
      +rows
      +"<div style='font-size:12px;color:var(--t0);margin-top:12px;padding-top:9px;border-top:1px solid var(--brd);'>Growth telemetry</div>"
      +"<div style='font-size:10px;color:var(--t2);margin:2px 0 5px;'>Observation only · UTF-8 JSON bytes · logical slices overlap · nothing is trimmed or compacted.</div>"
      +growthRows
    +"<div style='display:flex;gap:8px;margin-top:12px;justify-content:flex-end;'>"
    +"<button id='hm-report' style='padding:7px 12px;font-size:12px;font-family:var(--font);background:var(--bg2);color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>&#9888; Submit report</button>"
    +"<button id='hm-ok' style='padding:7px 12px;font-size:12px;font-family:var(--font);background:var(--bg2);color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Close</button></div></div>";
  document.body.appendChild(m);
  m.addEventListener("click",function(ev){if(ev.target===m)m.remove();});
  document.getElementById("hm-close").onclick=function(){m.remove();};
  document.getElementById("hm-ok").onclick=function(){m.remove();};
  document.getElementById("hm-report").onclick=function(){
    var btn=this;btn.disabled=true;btn.textContent="Sending…";
      var lines=["HEALTH REPORT (user-initiated from the drift-health modal)","Overall: "+h.overall],j;
      for(j=0;j<h.items.length;j++)lines.push(h.items[j].id+" ["+h.items[j].level+"]: "+h.items[j].detail);
      for(j=0;j<(h.growth||[]).length;j++)lines.push("growth "+h.growth[j].id+": "+h.growth[j].bytes+" UTF-8 bytes / "+h.growth[j].count+" "+h.growth[j].unit);
    if(typeof sendUserReport!=="function"){showToast("Bug reporting unavailable");btn.disabled=false;btn.innerHTML="&#9888; Submit report";return;}
    sendUserReport(lines.join("\n"),null,function(ok,err){
      if(ok){showToast("Health report sent ✓");m.remove();}
      else{showToast("Report failed: "+err);btn.disabled=false;btn.innerHTML="&#9888; Submit report";}
    });
  };
}
