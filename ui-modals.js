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
  var ex=document.getElementById("rules-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="rules-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modal.appendChild(inner);document.body.appendChild(modal);
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
  var dir="ui";var modalDiv=document.createElement("div");modalDiv.id="sync-modal";modalDiv.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modalDiv.appendChild(inner);document.body.appendChild(modalDiv);
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
      +"<div><label class='sc-lbl'>Level</label><input id='sc-level' type='number' min='1' max='10' class='sc-inp' value='"+c.level+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Location</label><input id='sc-loc' type='text' class='sc-inp' value='"+escHtml(w.location)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Time</label><input id='sc-time' type='text' class='sc-inp' value='"+escHtml(w.time)+"' "+ro+"/></div>"
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
      if(!isNaN(lvl2)&&lvl2>=1&&lvl2<=10)c2.level=lvl2;if(loc2)w2.location=loc2;if(tm2)w2.time=tm2;if(wx2)w2.weather=wx2;
      c2.inventory=inv2;/* always assign so emptying the textarea actually clears inventory (audit E63) */syncUI();saveAll();renderSync();
      var msg=document.getElementById("sc-msg");if(msg){msg.textContent="Applied.";msg.style.color="var(--grn)";}
    });}
  }
  renderSync();
}
function loadFalKey(){var fk=store.get(FAL_KEY_K);if(fk){falKey=fk;var fi=document.getElementById("fal-input");if(fi)fi.value=fk;}}
function loadRenderModel(){
  var m=store.get(RENDER_MDL_K);if(m)renderModel=m;
  try{var s=store.get(RENDER_STR_K);if(s)renderStrength=JSON.parse(s)||{};}catch(e){renderStrength={};}
}
function showRenderOptionsModal(){
  document.getElementById("file-menu").style.display="none";
  var ex=document.getElementById("render-opts-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="render-opts-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  // Build model rows — shared radio-row builder (#15①)
  var mhtml=radioRowsHTML("ro-row",RENDER_MODELS,renderModel,function(m,sel){return "<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+m.label+"</span>";});
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:400px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🖼 Render Options</span><button id='ro-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>fal.ai API Key</div>"
    +"<input type='password' id='ro-fal-inp' placeholder='fal_key_...' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:8px;box-sizing:border-box;'/>"
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
    +"<p id='ro-msg' style='font-size:12px;min-height:16px;margin-top:10px;text-align:center;'></p>"
    +"</div>";
  document.body.appendChild(modal);
  var inp=document.getElementById("ro-fal-inp");if(falKey)inp.value=falKey;
  document.getElementById("ro-x").addEventListener("click",function(){modal.remove();});
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
  var ex=document.getElementById("provider-modal");if(ex)ex.remove();
  var selProv=PROVIDERS[activeProvider]?activeProvider:"anthropic";
  // Stage key edits locally and commit only on Save (audit E88) — the old row-click wrote the typed
  // key straight into the LIVE providerKeys, so editing one provider's key then switching + cancelling
  // left the change applied for the rest of the session.
  var _pvStaged={};(function(){var _k=Object.keys(providerKeys),_i;for(_i=0;_i<_k.length;_i++)_pvStaged[_k[_i]]=providerKeys[_k[_i]];})();
  var modal=document.createElement("div");modal.id="provider-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  function provRows(){var ids=Object.keys(PROVIDERS),items=[],i;for(i=0;i<ids.length;i++)items.push({id:ids[i],label:PROVIDERS[ids[i]].label});return radioRowsHTML("pv-row",items,selProv,function(p,sel){return "<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+p.label+"</span>";});}
  function modelOpts(){var p=PROVIDERS[selProv],cur=providerModels[selProv]||p.defaultModel,o="",i;for(i=0;i<p.models.length;i++){o+="<option value='"+p.models[i]+"'"+(p.models[i]===cur?" selected":"")+">"+p.models[i]+"</option>";}return o;}
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🧠 Language Model</span><button id='pv-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Provider</div>"
    +"<div id='pv-rows'>"+provRows()+"</div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>API Key</div>"
    +"<input type='password' id='pv-key' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'/>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>Model</div>"
    +"<select id='pv-model' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'>"+modelOpts()+"</select>"
    +"<label style='display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer;'><input type='checkbox' id='pv-upgrade'"+(allowModelUpgrade?" checked":"")+"><span style='font-size:12px;color:var(--t2);'>Allow model upgrade for complex tasks</span></label>"
    +"<p id='pv-msg' style='font-size:12px;min-height:16px;margin:12px 0;text-align:center;'></p>"
    +"<button id='pv-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save &amp; Use</button>"
    +"</div>";
  document.body.appendChild(modal);
  var keyInp=document.getElementById("pv-key"),modelSel=document.getElementById("pv-model");
  function refreshSel(){
    keyInp.value=_pvStaged[selProv]||"";keyInp.placeholder=PROVIDERS[selProv].keyHint;modelSel.innerHTML=modelOpts();
    radioRowsRefresh(modal,"pv-row",selProv,"span");/* #15① */
  }
  Array.prototype.forEach.call(modal.querySelectorAll(".pv-row"),function(row){row.addEventListener("click",function(){_pvStaged[selProv]=keyInp.value.trim();selProv=this.getAttribute("data-id");refreshSel();});});
  refreshSel();
  document.getElementById("pv-x").addEventListener("click",function(){modal.remove();});
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
  var ex=document.getElementById("usage-modal");if(ex)ex.remove();
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
  var order=["turn","actions","summarize","skeleton","sync","other"],rows="",i;
  var kinds=order.filter(function(k){return u.byKind[k];}).concat(Object.keys(u.byKind).filter(function(k){return order.indexOf(k)<0;}));
  for(i=0;i<kinds.length;i++)rows+=row(kinds[i],u.byKind[kinds[i]]);
  if(!kinds.length)rows="<tr><td colspan='8' style='padding:14px;text-align:center;font-size:12px;color:var(--t2);font-style:italic;'>No API calls recorded yet — play a turn.</td></tr>";
  rows+=row("total",u,true);
  var hd="padding:5px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--t2);text-align:right;white-space:nowrap;";
  var modal=document.createElement("div");modal.id="usage-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>📊 Usage &amp; Cost</span><button id='us-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;'>"
    +"<table style='width:100%;min-width:500px;border-collapse:collapse;'>"
    +"<tr><th style='"+hd+"text-align:left;'>Kind</th><th style='"+hd+"'>Calls</th><th style='"+hd+"'>Input</th><th style='"+hd+"'>In/call</th><th style='"+hd+"'>Cache rd</th><th style='"+hd+"'>Cache wr</th><th style='"+hd+"'>Output</th><th style='"+hd+"'>~Cost</th></tr>"
    +rows+"</table></div>"
    +(function(){var tb=u.byKind&&u.byKind.turn;if(!tb||!(tb.in+tb.cacheRead))return "";var pct=Math.round(100*tb.cacheRead/(tb.in+tb.cacheRead));var col=pct>=50?"var(--grn)":pct>0?"var(--acc)":"var(--dng)";return "<p style='font-size:11px;margin:12px 0 0;color:"+col+";'>Prompt-cache health: <b>"+pct+"%</b> of turn input served from cache"+(pct===0?" — the cache is DEAD (stable-half purity leak, see console)":pct<50?" — low; long idle gaps between turns, or a purity leak":"")+".</p>";})()
    +(function(){var np=u.unpriced||0;if(!np)return "";return "<p style='font-size:11px;margin:6px 0 0;color:var(--dng);'>Unpriced calls: <b>"+np+"</b> — tokens recorded under a model id with no MODEL_PRICING entry, so the cost column UNDERCOUNTS real spend (console names the id — #30).</p>";})()
    +"<p style='font-size:11px;color:var(--t2);margin:12px 0 0;'>Token counts are exact (API-reported). Cost is an estimate for known Anthropic models; other providers count tokens but contribute $0."+(u.since?" Collecting since "+new Date(u.since).toLocaleDateString()+".":"")+"</p>"
    +"<button id='us-reset' style='width:100%;margin-top:14px;padding:9px;font-size:12px;font-family:var(--font);background:var(--bg2);color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Reset counters (start a fresh measurement window)</button>"
    +"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("us-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("us-reset").addEventListener("click",function(){
    if(worldState){worldState.usage=blankUsage();saveCore();}
    modal.remove();showUsageModal();
  });
}
// ── RAG episodic memory toggle (#27 Phase 1 — RAG_MEMORY.md) ───────────────────
// Per-campaign flag on worldState.ragMemory (rides the sync blob, read live each turn —
// the proseAuthor pattern). Modal is built fresh on open so it always reads live state.
function showRagModal(){
  closeAllMenus();/* #15④ */
  var ex=document.getElementById("rag-modal");if(ex)ex.remove();
  var hasGame=!!(worldState&&worldState.character);
  var on=!(worldState&&worldState.ragMemory===false); // default ON (v1.230) — checked unless explicitly disabled
  var modal=document.createElement("div");modal.id="rag-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:440px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🗂 Episodic Memory (RAG)</span><button id='rag-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 10px;'>The GM recalls verbatim moments from earlier in this campaign when the people, places, or quests involved come up again — exact promises, shared history, callbacks. Also trims long-tail lore from the prompt in mature campaigns.</p>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'><b>On by default.</b> Per-campaign and fully reversible — switching it off restores the standard prompt exactly. Takes effect next turn. Young campaigns won't notice it (there is no history to recall yet); it earns its keep on mature ones.</p>"
    +(hasGame
      ?"<label style='display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);cursor:pointer;font-size:13px;color:var(--t1);'><input type='checkbox' id='rag-cb' style='accent-color:var(--acc);cursor:pointer;width:14px;height:14px;'"+(on?" checked":"")+"/> Enable for this campaign</label>"
      :"<p style='font-size:12px;color:var(--t2);font-style:italic;padding:10px 12px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);margin:0;'>Start or load a campaign first — the setting lives on the campaign.</p>")
    +"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("rag-x").addEventListener("click",function(){modal.remove();});
  var cb=document.getElementById("rag-cb");
  if(cb)cb.addEventListener("change",function(){
    if(cb.checked)delete worldState.ragMemory; // ON is the default — drop the field, keep the save byte-clean
    else worldState.ragMemory=false; // explicit opt-out (default-on semantics: only false disables)
    if(typeof saveAll==="function")saveAll();
    showToast(cb.checked?"Episodic memory ON — this campaign":"Episodic memory OFF");
  });
}
// ── Prose inspiration (TODO #23) ───────────────────────────────────────────────
function loadProseAuthor(){var v=store.get(PROSE_K);proseAuthor=(typeof v==="string")?v:"";}
function showProseModal(){
  closeAllMenus();/* #15④ */
  var ex=document.getElementById("prose-modal");if(ex)ex.remove();
  var sel=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:(proseAuthor||"");
  function rows(){return radioRowsHTML("pr-row",AUTHORS,sel,function(a,s){
    return "<div><div style='font-size:13px;color:"+(s?"var(--acc)":"var(--t1)")+";'>"+escHtml(a.nm)+(a.profane?" <span style=\"font-size:10px;color:var(--t2);\">· 18+ for full voice</span>":"")+"</div>"
      +(a.blurb?"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(a.blurb)+"</div>":"")+"</div>";
  },{align:"flex-start",dotTop:true});}
  var modal=document.createElement("div");modal.id="prose-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:440px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>✍ Prose Inspiration</span><button id='pr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'>The GM imitates this author's voice. Takes effect on the next turn — switch any time.</p>"
    +"<div id='pr-rows'>"+rows()+"</div>"
    +"<button id='pr-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;margin-top:8px;'>Save</button>"
    +"</div>";
  document.body.appendChild(modal);
  function refresh(){radioRowsRefresh(modal,"pr-row",sel,"div>div");}/* #15① — "div>div" preserved verbatim, see radioRowsRefresh note */
  Array.prototype.forEach.call(modal.querySelectorAll(".pr-row"),function(row){row.addEventListener("click",function(){sel=this.getAttribute("data-id");refresh();});});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("pr-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("pr-save").addEventListener("click",function(){
    proseAuthor=sel;store.set(PROSE_K,sel);   // device default for new/unset campaigns
    if(worldState){worldState.proseAuthor=sel;if(typeof saveAll==="function")saveAll();} // pin to THIS campaign; rides the sync blob across devices
    var a=null,i;for(i=0;i<AUTHORS.length;i++){if(AUTHORS[i].id===sel){a=AUTHORS[i];break;}}
    showToast(sel?("Prose voice: "+(a?a.nm:sel)+(worldState?" · this campaign":"")):"Prose voice: house default");
    modal.remove();
  });
}
// ── Quest journal ─────────────────────────────────────────────────────────────
function showQuestModal(){
  var ex=document.getElementById("quest-modal");if(ex)ex.remove();
  var ql=(worldState&&worldState.questLog)||[];
  function objList(q){if(!q.objectives||!q.objectives.length)return"";var h="<div style='margin-top:6px;'>",oj;for(oj=0;oj<q.objectives.length;oj++){var o=q.objectives[oj];h+="<div style='font-size:12px;color:"+(o.done?"var(--t2)":"var(--t1)")+";margin:2px 0;'>"+(o.done?"☑":"☐")+" "+escHtml(o.text)+"</div>";}return h+"</div>";}
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
      activeHtml+="<div style='border-bottom:1px solid var(--brd);padding:10px 0;'>"
        +"<div style='font-size:14px;color:var(--t0);'>"+escHtml(q.title)+"</div>"
        +(q.desc?"<div style='font-size:12px;color:var(--t2);margin-top:3px;'>"+escHtml(q.desc)+"</div>":"")+objList(q)+"</div>";
    }
  }
  var arch=(memory&&memory.quests)?Object.keys(memory.quests).map(function(k){return memory.quests[k];}):[];
  var histHtml="";for(i=0;i<arch.length;i++){var aq=arch[i];var clr=aq.status==="completed"?"var(--grn)":aq.status==="failed"?"var(--red)":"var(--t2)";var sym=aq.status==="completed"?"✓":aq.status==="failed"?"✗":"—";histHtml+="<div style='font-size:12px;color:var(--t2);padding:3px 0;'><span style='color:"+clr+";'>"+sym+"</span> "+escHtml(aq.title)+" <span style='font-size:10px;'>("+escHtml(aq.status)+")</span></div>";}
  var body="";
  if(offeredHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);margin:2px 0 8px;'>⚑ Opportunities</div>"+offeredHtml;
  body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin:14px 0 8px;'>Active</div>"+(activeHtml||"<div style='font-size:12px;color:var(--t2);font-style:italic;'>No active quests.</div>");
  if(histHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2);margin:14px 0 8px;'>History</div>"+histHtml;
  var modal=document.createElement("div");modal.id="quest-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Quest Journal</span><button id='qm-x' style='background:none;border:none;color:var(--t2);font-size:22px;cursor:pointer;'>&#215;</button></div>"+body+"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("qm-x").addEventListener("click",function(){modal.remove();});
  // Wire by TITLE, not render-time index (audit E24): applyMuts can splice the questLog while the
  // modal is open (a completed quest archives), and an index baked into onclick would then hit the
  // wrong quest — declineQuest could even archive a still-active quest.
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qacc]"),function(b){b.addEventListener("click",function(){acceptQuest(b.getAttribute("data-qacc"));});});
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qdec]"),function(b){b.addEventListener("click",function(){declineQuest(b.getAttribute("data-qdec"));});});
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
