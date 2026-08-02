// ui-portrait.js — portrait mechanics: offset normalization, pan/zoom transform, shared drag
// dispatch (E61), compression, portrait-aspect render body, and the fal.ai portrait modal.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// ── Portrait pan + zoom ───────────────────────────────────────────────────────
// Offset model: {x, y, zoom}. x,y are 0..1 = fraction of the pannable overflow
// (0 shows the left/top edge, 1 the right/bottom); zoom >= 1 (1 = cover-fit). Two-axis
// pan only has slack once zoomed in (a landscape image cover-fit to a portrait oval
// overflows horizontally only — zooming creates vertical slack too). Legacy saves stored
// object-position percentages (0..100); normPortraitOff() upconverts them.
function normPortraitOff(off){
  off=off||{};
  var x=(typeof off.x==="number")?off.x:0.5, y=(typeof off.y==="number")?off.y:0.5;
  if(x>1||y>1){x=x/100;y=y/100;}
  return {x:Math.min(1,Math.max(0,x)),y:Math.min(1,Math.max(0,y)),zoom:Math.max(1,(off&&off.zoom)||1)};
}
// Apply the pan+zoom transform to a cover-style portrait <img>. Needs the image's natural
// dimensions, so call after it has loaded. The parent is the clipping oval.
function applyPortraitTransform(img,off){
  var c=img.parentNode;if(!c)return;
  var o=normPortraitOff(off);
  var natW=img.naturalWidth||400,natH=img.naturalHeight||600;
  var cW=c.offsetWidth||90,cH=c.offsetHeight||135;
  var s=Math.max(cW/natW,cH/natH)*o.zoom; // cover scale x user zoom
  var ovX=natW*s-cW,ovY=natH*s-cH; if(ovX<0)ovX=0; if(ovY<0)ovY=0;
  img.style.position="absolute";img.style.top="0";img.style.left="0";
  img.style.width=natW+"px";img.style.height=natH+"px";img.style.maxWidth="none";
  img.style.objectFit="";img.style.objectPosition="";img.style.transformOrigin="0 0";
  img.style.transform="translate("+(-ovX*o.x)+"px,"+(-ovY*o.y)+"px) scale("+s+")";
}
// Wires drag-to-pan + wheel/pinch-to-zoom on a portrait <img>.
// getOff() -> {x,y,zoom}; setOff(x,y,zoom) persists on change. Exposes img._zoomBy(factor).
// Shared document-level drag dispatch (audit E61): wirePortraitDrag used to add a NEW mousemove +
// mouseup listener to `document` on every call — and it's called on every sheet open AND every
// drag-end/zoom refresh, so the listeners accumulated unbounded. Wire the pair ONCE and route to
// whichever image is currently being dragged.
var _pdActive=null,_pdDocWired=false;
function _pdEnsureDoc(){
  if(_pdDocWired)return;_pdDocWired=true;
  document.addEventListener("mousemove",function(e){if(_pdActive)_pdActive.m(e.clientX,e.clientY);});
  document.addEventListener("mouseup",function(){if(_pdActive){var a=_pdActive;_pdActive=null;a.u();}});
}
function wirePortraitDrag(img,getOff,setOff){
  _pdEnsureDoc();
  var dragging=false,sx,sy,sox,soy,moved,liveX,liveY,pinchStart=0,pinchZoom=1;
  var p=img.parentNode;if(p){if(!p.style.position)p.style.position="relative";p.style.overflow="hidden";}
  img.style.cursor="grab";img.style.touchAction="none";
  function reapply(){applyPortraitTransform(img,getOff());}
  if(img.complete&&img.naturalWidth)reapply(); else img.addEventListener("load",reapply);
  function overflow(){var o=normPortraitOff(getOff()),natW=img.naturalWidth||400,natH=img.naturalHeight||600,cW=p.offsetWidth||90,cH=p.offsetHeight||135;var s=Math.max(cW/natW,cH/natH)*o.zoom;return {x:Math.max(1,natW*s-cW),y:Math.max(1,natH*s-cH)};}
  function onDown(cx,cy){dragging=true;moved=false;sx=cx;sy=cy;var o=normPortraitOff(getOff());sox=o.x;soy=o.y;liveX=o.x;liveY=o.y;img.style.cursor="grabbing";_pdActive={m:onMove,u:onUp};/* this image is now the active drag (E61) */}
  function onMove(cx,cy){if(!dragging)return;moved=true;var ov=overflow(),o=normPortraitOff(getOff());
    // An axis with no real pannable overflow (~1px, floored by overflow()) divides pixel jitter by ~1
    // and slams the offset to an extreme (audit E87) — only pan an axis that actually has slack.
    liveX=ov.x>2?Math.min(1,Math.max(0,sox-(cx-sx)/ov.x)):o.x;
    liveY=ov.y>2?Math.min(1,Math.max(0,soy-(cy-sy)/ov.y)):o.y;
    applyPortraitTransform(img,{x:liveX,y:liveY,zoom:o.zoom});}
  function onUp(){if(!dragging)return;dragging=false;img.style.cursor="grab";if(moved)setOff(liveX,liveY,normPortraitOff(getOff()).zoom);}
  function applyZoom(factor){var o=normPortraitOff(getOff());var z=Math.min(4,Math.max(1,o.zoom*factor));applyPortraitTransform(img,{x:o.x,y:o.y,zoom:z});setOff(o.x,o.y,z);}
  function tdist(e){var a=e.touches[0],b=e.touches[1],dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy);}
  img.addEventListener("mousedown",function(e){e.preventDefault();e.stopPropagation();onDown(e.clientX,e.clientY);});
  // (document mousemove/mouseup are wired once by _pdEnsureDoc and dispatched via _pdActive — audit E61)
  img.addEventListener("wheel",function(e){e.preventDefault();applyZoom(e.deltaY<0?1.1:0.9);},{passive:false});
  img.addEventListener("touchstart",function(e){if(e.touches.length===2){pinchStart=tdist(e);pinchZoom=normPortraitOff(getOff()).zoom;dragging=false;}else{var t=e.touches[0];onDown(t.clientX,t.clientY);}},{passive:true});
  img.addEventListener("touchmove",function(e){e.preventDefault();if(e.touches.length===2&&pinchStart){var z=Math.min(4,Math.max(1,pinchZoom*tdist(e)/pinchStart)),o=normPortraitOff(getOff());applyPortraitTransform(img,{x:o.x,y:o.y,zoom:z});setOff(o.x,o.y,z);}else if(e.touches.length===1){var t=e.touches[0];onMove(t.clientX,t.clientY);}},{passive:false});
  img.addEventListener("touchend",function(e){if(pinchStart&&e.touches.length<2)pinchStart=0;onUp();});
  img._wasDragged=function(){return moved;};
  img._zoomBy=applyZoom;
}
// Portraits should be portrait-oriented (3:4), not the landscape aspect the render models
// bake in for scene renders. Override the aspect field on the built request body.
function portraitRenderBody(cfg,prompt){var b=cfg.body(prompt);if(b.image_size)b.image_size="portrait_4_3";if(b.aspect_ratio)b.aspect_ratio="3:4";return b;}
function compressPortrait(dataUrl,cb){
  var img=new Image();
  img.onload=function(){
    var maxW=400,maxH=600,scale=Math.min(1,maxW/img.width,maxH/img.height);
    var cw=Math.round(img.width*scale),ch=Math.round(img.height*scale);
    var canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
    canvas.getContext("2d").drawImage(img,0,0,cw,ch);
    cb(canvas.toDataURL("image/jpeg",0.8));
  };
  img.onerror=function(){cb(dataUrl);}; // fallback: store as-is if canvas fails
  img.src=dataUrl;
}
// UA21 ②: the ONE fal.ai portrait-generation fetch — formerly triplicated byte-identically in
// showPortraitModal's runGenerate + runGenerateWithPrompt (which differed ONLY by the callGM
// prompt-writing step, kept in the callers) and char-creation.js's ftRenderPortrait.
// prompt: the finished image prompt; withImgStyle() is applied HERE (all three copies did).
// refSrc: reference-image URL → img2img on flux/dev at the portrait paths' pinned 0.75
//         strength (NOT the #42 scene-render slider); null/absent → text-to-image on the
//         player's selected render model (renderModel lookup, default RENDER_MODELS[0]) with
//         portraitRenderBody's 3:4 aspect override.
// Resolves to the generated image URL; rejects with the exact Error messages the inline
// copies threw ("fal.ai HTTP <n>" / "No image returned."). Callers own guards (falKey/busy),
// status lines, and result handling — those genuinely differ per surface.
// Load-order note: char-creation.js loads BEFORE ui-portrait.js in index.html, but
// ftRenderPortrait only RUNS on user action (wizard step 5) long after all scripts have
// loaded — call-time resolution makes the cross-file call safe.
async function generatePortraitImage(prompt,refSrc){
  var falRes,mdlCfg=RENDER_MODELS[0],mi,stPrompt=withImgStyle(prompt);
  if(refSrc){
    falRes=await fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
      headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
      body:JSON.stringify({image_url:refSrc,prompt:stPrompt,strength:0.75,num_inference_steps:28,num_images:1})});
  }else{
    for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
    falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
      headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
      body:JSON.stringify(portraitRenderBody(mdlCfg,stPrompt))});
  }
  if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
  var falData=await falRes.json();
  if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
  return falData.images[0].url;
}
async function showPortraitModal(refreshFn,opts){
  // opts = {getPortrait, setPortrait, getOffset, setOffset, subject} — defaults to player character
  var getPort=opts&&opts.getPortrait?opts.getPortrait:function(){return worldState.character.portrait;};
  var setPort=opts&&opts.setPortrait?opts.setPortrait:function(url){worldState.character.portrait=url;storageAdapter.markPortraitDirty();saveAll();};/* mark dirty on removal too so it propagates (E28) */
  var getOff=opts&&opts.getOffset?opts.getOffset:function(){return worldState.character.portraitOffset||{x:0.5,y:0.5,zoom:1};};
  var setOff=opts&&opts.setOffset?opts.setOffset:function(x,y,zoom){worldState.character.portraitOffset={x:x,y:y,zoom:zoom};saveAll();};
  var c=opts&&opts.subject?opts.subject:worldState.character;
  // WRITER for the appearance field, same caller-supplied-seam pattern as get/setPortrait above.
  // It exists because writing through `c` was wrong twice over (bug report 2026-07-27, "Replace
  // appearance doesn't replace"): ① for a sheet-less party member `c` is a THROWAWAY object
  // literal built by showNpcSheet, so the text was written to garbage and lost silently; and
  // ② nothing repainted the sheet underneath, so even a correct write looked like a no-op until
  // the sheet was closed and reopened. Returning false means "refused, and I already said why" —
  // the caller then leaves the generated text on screen instead of discarding it.
  var setAppear=opts&&opts.setAppearance?opts.setAppearance:function(text){
    worldState.character.appear=text;saveAll();return true;
  };
  // The sheet UNDERNEATH this modal is a static render — it paints its Appearance row once, when
  // it opens (ui-sheets.js). So an edit made here never showed until the sheet was closed and
  // reopened; that, not the write, was the "Replace appearance doesn't replace" report.
  // Repainting at CLOSE rather than per-write (user's call 2026-07-27, and the better design):
  // this modal sits at z-index 400 over the sheet's 300, so a mid-flow repaint is invisible
  // anyway, and one repaint on the way out covers EVERY edit made here — appearance, portrait,
  // and framing — instead of only the one handler that remembered to ask for it.
  var refreshSheet=opts&&opts.refreshSheet?opts.refreshSheet:function(){
    if(typeof showCharSheet==="function"&&document.getElementById("cs-modal"))showCharSheet();
  };
  var _pmDirty=false;   // only repaint if something actually changed — a look-and-leave close must not reset the sheet's scroll
  /* #11③ DIVERGENCE PRESERVED: this portrait path defaults an UNSET gender to "androgynous"
     (every other image site defaults unset to "male") — expressed via the explicit 2nd arg,
     deliberately NOT unified. Local renamed so it can't shadow the helper. */
  var gw=genderWord(c.gender,"androgynous");
  var pmRefSrc=getPort()||null;
  var hasPortrait=!!(getPort());

  function buildCharDesc(){
    var d=c.name;
    if(c.age||c.ancestry||c.cls)d+=", a "+gw+(c.age?" "+c.age:"")+(c.ancestry?" "+c.ancestry:"")+(c.cls?" "+c.cls:"")+(c.archetypeNm?" ["+c.archetypeNm+"]":"");
    if(c.appear)d+=", "+c.appear;
    if(c.mark)d+=", "+c.mark;
    if(c.inventory&&c.inventory.length)d+=". Visible wardrobe/gear: "+c.inventory.join(", ");
    return d;
  }

  var IS="width:100%;padding:9px 12px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:10px;box-sizing:border-box;";
  var BA="display:block;width:100%;padding:10px 14px;font-size:13px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:left;box-sizing:border-box;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;";
  function div(lbl){return "<div style='display:flex;align-items:center;gap:8px;margin:14px 0;'><div style='flex:1;height:1px;background:var(--brd);'></div><span style='font-size:11px;color:var(--t2);'>"+lbl+"</span><div style='flex:1;height:1px;background:var(--brd);'></div></div>";}
  function lbl(t){return "<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>"+t+"</div>";}


  /* #14: legacy overlay had overflow-y:auto BEFORE display:flex — same declaration set, order
     normalized to the shared scaffold (rendering identical; no conflicting properties). */
  var modal=modalShell("portrait-modal",
    // Header
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'>"
    +"<span style='font-size:15px;color:var(--t0);font-weight:bold;'>&#129718; Edit Portrait</span>"
    +"<button id='pm-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;line-height:1;'>&#215;</button>"
    +"</div>"
    // ── Current portrait preview ───────────────────────────────────────────
    +(hasPortrait?"<div style='text-align:center;margin-bottom:8px;'><div style='width:90px;height:135px;border-radius:50%;border:2px solid var(--acc);display:inline-block;overflow:hidden;position:relative;'><img id='pm-preview-img' src='"+getPort()+"' style='width:100%;height:100%;object-fit:cover;display:block;cursor:grab;'></div></div>"
    +"<div style='text-align:center;margin-bottom:18px;font-size:11px;color:var(--t2);'>drag to reframe &middot; scroll / pinch to zoom &nbsp; <button id='pm-zoom-out' style='font-family:var(--font);font-size:14px;line-height:1;padding:2px 10px;background:var(--bg3);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);cursor:pointer;'>&minus;</button> <button id='pm-zoom-in' style='font-family:var(--font);font-size:14px;line-height:1;padding:2px 9px;background:var(--bg3);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);cursor:pointer;'>+</button></div>":"")
    // ── 1. Upload / Save / Remove (same row) ──────────────────────────────
    +"<div style='display:flex;gap:6px;margin-bottom:4px;'>"
    +"<button id='pm-upload' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;'>&#8593; Upload</button>"
    +(hasPortrait?"<button id='pm-save-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);' title='Download a copy of this image to a file'>&#8595; Download</button>":"")
    +(hasPortrait?"<button id='pm-remove-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);'>&#10005; Remove</button>":"")
    +"</div>"
    +"<input type='file' id='pm-file' accept='image/*' style='display:none;'>"
    // ── Describe appearance from the image (vision; reverse of Generate) ────
    +(hasPortrait?"<button id='pm-describe' style='display:block;width:100%;margin-top:6px;padding:9px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);' title='Use Claude vision to read this image into the appearance field'>&#128269; Describe appearance from image</button>":"")
    // ── 2. Generate from scratch ───────────────────────────────────────────
    +div("or generate from scratch")
    +lbl("Additional details (optional):")
    +"<input type='text' id='pm-details-gen' placeholder='e.g. wearing a hood, battle-scarred, torch light' style='"+IS+"'/>"
    +"<button id='pm-gen' style='"+BA+"'>&#129718; Generate from Character Sheet</button>"
    // ── 3. Update current portrait (only when one exists) ─────────────────
    +(hasPortrait?div("update current portrait"):"")
    +(hasPortrait?lbl("Additional details (optional):"):"")
    +(hasPortrait?"<input type='text' id='pm-details-upd' placeholder='e.g. now wearing plate armour, older, battle-worn' style='"+IS+"'/>":"")
    +(hasPortrait?"<button id='pm-upd' style='"+BA+"'>&#10024; Update from Character Sheet</button>":"")
    // ── Result ─────────────────────────────────────────────────────────────
    +"<div id='pm-status' style='margin-top:14px;'></div>",
    {z:400,align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:420,boxExtra:"margin:20px 0 40px;",closeId:"pm-x",outside:true,onClose:function(){pmClose();}});

  // THE single exit. Routed through modalShell's onClose above as well, so the × button and an
  // outside-click repaint too — not just the three internal callers below. (pmClose is a hoisted
  // function declaration, so naming it in the opts object above is safe.)
  function pmClose(){modal.remove();if(_pmDirty)refreshSheet();}
  var pmImg=document.getElementById("pm-preview-img");
  if(pmImg)wirePortraitDrag(pmImg,getOff,function(x,y,zoom){setOff(x,y,zoom);_pmDirty=true;if(refreshFn)refreshFn();});
  if(document.getElementById("pm-zoom-in"))document.getElementById("pm-zoom-in").addEventListener("click",function(){if(pmImg&&pmImg._zoomBy)pmImg._zoomBy(1.2);});
  if(document.getElementById("pm-zoom-out"))document.getElementById("pm-zoom-out").addEventListener("click",function(){if(pmImg&&pmImg._zoomBy)pmImg._zoomBy(0.83);});
  if(document.getElementById("pm-save-portrait")){
    document.getElementById("pm-save-portrait").addEventListener("click",function(){
      var purl=getPort();if(!purl)return;
      var fname=buildFilename("portrait");
      fetch(purl).then(function(r){return r.blob();}).then(function(blob){exportToFolder("portrait",blob,fname);}).catch(function(){var a=document.createElement("a");a.href=purl;a.download=fname;a.click();});
    });
  }
  if(document.getElementById("pm-remove-portrait")){
    document.getElementById("pm-remove-portrait").addEventListener("click",function(){
      setPort(null);_pmDirty=true;if(refreshFn)refreshFn();pmClose();
    });
  }

  // ── Shared: show image result ────────────────────────────────────────────
  function showResult(imgUrl,isImg2Img,genPrompt){
    var status=document.getElementById("pm-status");
    status.innerHTML="";
    var prev=document.createElement("div");
    prev.style.cssText="border:1px solid var(--acc);border-radius:var(--r);padding:12px;margin-top:8px;background:var(--bg2);";
    var hd=document.createElement("div");hd.textContent="New image — tap Apply to set it";hd.style.cssText="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;text-align:center;";
    var img=document.createElement("img");img.src=imgUrl;img.style.cssText="width:100%;max-height:280px;object-fit:contain;border-radius:var(--r);display:block;margin-bottom:10px;";
    var BS2="padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;margin-right:5px;margin-bottom:6px;";
    var useBtn=document.createElement("button");useBtn.textContent="✓ Apply";useBtn.style.cssText="display:block;width:100%;padding:12px;font-family:var(--font);font-size:15px;font-weight:bold;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;margin-bottom:8px;";
    var editBtn=document.createElement("button");editBtn.textContent="Edit Prompt";editBtn.style.cssText=BS2;
    var discardBtn=document.createElement("button");discardBtn.textContent="Discard";discardBtn.style.cssText=BS2;
    var btnRow=document.createElement("div");if(genPrompt)btnRow.appendChild(editBtn);btnRow.appendChild(discardBtn);
    var editArea=document.createElement("div");editArea.style.cssText="margin-top:8px;display:none;";
    var promptTA=document.createElement("textarea");promptTA.value=genPrompt||"";
    promptTA.style.cssText="width:100%;height:80px;padding:8px;font-size:12px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;resize:vertical;margin-bottom:6px;";
    var regenBtn=document.createElement("button");regenBtn.textContent="Regenerate with this prompt";regenBtn.style.cssText="display:block;width:100%;padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;font-weight:bold;";
    editArea.appendChild(promptTA);editArea.appendChild(regenBtn);
    prev.appendChild(hd);prev.appendChild(img);prev.appendChild(useBtn);prev.appendChild(btnRow);prev.appendChild(editArea);
    status.appendChild(prev);
    try{status.scrollIntoView({behavior:"smooth",block:"center"});}catch(e){}
    useBtn.addEventListener("click",function(){
      useBtn.disabled=true;useBtn.textContent="Applying…";
      // Uploaded images are already a compressed data: URL — commit directly (no double-compress).
      // fal.ai results are http(s) URLs — fetch, then compress before storing.
      if(imgUrl.indexOf("data:")===0){setPort(imgUrl);_pmDirty=true;if(refreshFn)refreshFn();pmClose();return;}
      fetch(imgUrl).then(function(r){return r.blob();}).then(function(blob){
        var fr=new FileReader();
        fr.onload=function(e2){compressPortrait(e2.target.result,function(compressed){setPort(compressed);_pmDirty=true;if(refreshFn)refreshFn();pmClose();});};
        fr.readAsDataURL(blob);
      }).catch(function(){useBtn.disabled=false;useBtn.textContent="Apply";});
    });
    editBtn.addEventListener("click",function(){
      var open=editArea.style.display!=="none";
      editArea.style.display=open?"none":"block";
    });
    regenBtn.addEventListener("click",function(){runGenerateWithPrompt(isImg2Img,promptTA.value.trim());});
    discardBtn.addEventListener("click",function(){status.innerHTML="";});
  }

  // ── Describe appearance FROM the image (Claude vision; reverse of Generate) ──
  async function runDescribe(){
    var status=document.getElementById("pm-status");
    var src=getPort();if(!src)return;
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Reading the portrait&hellip;</span>";
    busy=true;
    try{
      var desc=await describePortraitImage(src,c.name);
      showDescribeResult(desc);
    }catch(err){status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+escHtml(err.message||"Failed")+"</span>";}/* escape — untrusted error text (review 2026-08-01) */
    busy=false;
  }
  function showDescribeResult(desc){
    var status=document.getElementById("pm-status");status.innerHTML="";
    if(!desc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Empty description.</span>";return;}
    var box=document.createElement("div");box.style.cssText="border:1px solid var(--acc);border-radius:var(--r);padding:12px;margin-top:8px;background:var(--bg2);";
    var hd=document.createElement("div");hd.textContent="Appearance read from the portrait";hd.style.cssText="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;";
    var p=document.createElement("div");p.textContent=desc;p.style.cssText="font-size:13px;color:var(--t0);line-height:1.5;margin-bottom:10px;font-family:var(--font);";
    var sec="padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;margin-right:6px;";
    var repl=document.createElement("button");repl.textContent=c.appear?"Replace appearance":"Use as appearance";repl.style.cssText="padding:9px 12px;font-family:var(--font);font-size:12px;font-weight:bold;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;margin-right:6px;";
    var app=document.createElement("button");app.textContent="Append";app.style.cssText=sec;
    var disc=document.createElement("button");disc.textContent="Discard";disc.style.cssText=sec;
    box.appendChild(hd);box.appendChild(p);box.appendChild(repl);if(c.appear)box.appendChild(app);box.appendChild(disc);
    status.appendChild(box);
    // On a REFUSAL (false) the panel deliberately stays up — the description cost a vision call
    // and clearing it would throw the user's work away along with the write.
    repl.addEventListener("click",function(){
      if(setAppear(desc)===false)return;
      _pmDirty=true;
      status.innerHTML="";if(typeof showToast==="function")showToast("Appearance updated from portrait.");
    });
    app.addEventListener("click",function(){
      if(setAppear((c.appear?c.appear+" ":"")+desc)===false)return;
      _pmDirty=true;
      status.innerHTML="";if(typeof showToast==="function")showToast("Appended to appearance.");
    });
    disc.addEventListener("click",function(){status.innerHTML="";});
  }
  // ── Shared: generate / img2img ───────────────────────────────────────────
  async function runGenerate(isImg2Img,details){
    var status=document.getElementById("pm-status");
    if(!falKey){status.innerHTML="<span style='font-size:12px;color:var(--red);'>No fal.ai key — add one via File → fal.ai image key…</span>";return;}
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    var charDesc=buildCharDesc();
    var promptReq=isImg2Img
      ?"Write an image generation prompt to update a fantasy character portrait using a reference photo. "
        +"Maintain the person's likeness from the reference but render them as: "+charDesc+". "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Dark fantasy painterly style, dramatic lighting, upper body portrait. 2-3 sentences. Output ONLY the prompt."
      :"Write a detailed image generation prompt for a fantasy character portrait. "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Base character description (use where not overridden): "+charDesc+". "
        +"Spell out hair, eyes, skin tone, clothing, and visible gear explicitly. "
        +"Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly. 2-3 sentences. Output ONLY the prompt, no commentary, no tags.";
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Writing portrait prompt…</span>";
    busy=true;
    try{
      var prompt=await callGM(promptReq,"You are a portrait image prompt writer for a dark fantasy RPG. Output ONLY the image prompt. No narration, no game tags.",600);
      status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
      showResult(await generatePortraitImage(prompt,isImg2Img?pmRefSrc:null),isImg2Img,prompt);/* UA21 ②: shared fetch */
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+escHtml(err.message)+"</span>";
    }
    busy=false;
  }

  // ── Shared: regenerate with edited prompt (skips Claude step — the ONLY way the twins
  // ever differed; both now ride generatePortraitImage, UA21 ②) ───────────
  async function runGenerateWithPrompt(isImg2Img,prompt){
    var status=document.getElementById("pm-status");
    if(!falKey||!prompt)return;
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
    busy=true;
    try{
      showResult(await generatePortraitImage(prompt,isImg2Img?pmRefSrc:null),isImg2Img,prompt);/* UA21 ②: shared fetch */
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+escHtml(err.message)+"</span>";
    }
    busy=false;
  }

  // ── 1. Upload ────────────────────────────────────────────────────────────
  document.getElementById("pm-upload").addEventListener("click",function(){document.getElementById("pm-file").click();});
  document.getElementById("pm-file").addEventListener("change",function(){
    var file=this.files[0];if(!file)return;
    var reader=new FileReader();
    // Preview the chosen image with an explicit Apply (no genPrompt → no "Edit Prompt"); nothing is
    // saved until Apply, so picking a file can't silently set or fail to set the portrait.
    reader.onload=function(e){compressPortrait(e.target.result,function(compressed){showResult(compressed,false,null);});};
    reader.readAsDataURL(file);this.value="";
  });

  // ── Describe appearance from image ───────────────────────────────────────
  if(document.getElementById("pm-describe"))document.getElementById("pm-describe").addEventListener("click",runDescribe);
  // ── 2. Generate ──────────────────────────────────────────────────────────
  document.getElementById("pm-gen").addEventListener("click",function(){
    runGenerate(false,document.getElementById("pm-details-gen").value.trim());
  });

  // ── 3. Update ────────────────────────────────────────────────────────────
  if(document.getElementById("pm-upd")){
    document.getElementById("pm-upd").addEventListener("click",function(){
      runGenerate(true,document.getElementById("pm-details-upd").value.trim());
    });
  }
}
