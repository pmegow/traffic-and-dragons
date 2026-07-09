function buildDots(){
  var el=document.getElementById("stepdots");if(!el)return;
  var lvlEl=document.getElementById("rv-start-level");
  var needPerks=lvlEl&&parseInt(lvlEl.value)>=3;
  var total=needPerks?7:6;
  var h="",i;for(i=1;i<=total;i++){h+='<div class="dot '+(i<cs.step?"done":i===cs.step?"active":"")+'"></div>';}
  el.innerHTML=h;
}
function buildDnaStep(){
  var ts=document.getElementById("tone-sel"),as=document.getElementById("author-sel");
  if(!ts||!as)return;
  if(!ts.options.length){
    var i;for(i=0;i<TONES.length;i++){var ot=document.createElement("option");ot.value=TONES[i].id;ot.textContent=TONES[i].nm;ts.appendChild(ot);}
    ts.addEventListener("change",function(){cs.tone=ts.value;var cw=document.getElementById("tone-cw");if(cw)cw.style.display=cs.tone==="custom"?"block":"none";_syncDnaBlurb();});
  }
  if(!as.options.length){
    var j;for(j=0;j<AUTHORS.length;j++){var oa=document.createElement("option");oa.value=AUTHORS[j].id;oa.textContent=AUTHORS[j].nm;as.appendChild(oa);}
    as.addEventListener("change",function(){cs.author=as.value;_syncDnaBlurb();});
  }
  if(!cs.tone)cs.tone="swords";
  ts.value=cs.tone;
  as.value=cs.author||"";
  var cw=document.getElementById("tone-cw");
  if(cw)cw.style.display=cs.tone==="custom"?"block":"none";
  _syncDnaBlurb();
}
function _syncDnaBlurb(){
  var pv=document.getElementById("tone-prev");if(!pv)return;
  var parts=[],ti,ai;
  if(cs.tone&&cs.tone!=="custom"){for(ti=0;ti<TONES.length;ti++){if(TONES[ti].id===cs.tone){parts.push("Magic: "+TONES[ti].mg+" · Violence: "+TONES[ti].vi);break;}}}
  if(cs.author){for(ai=0;ai<AUTHORS.length;ai++){if(AUTHORS[ai].id===cs.author&&AUTHORS[ai].blurb){parts.push(AUTHORS[ai].nm+": "+AUTHORS[ai].blurb);break;}}}
  pv.textContent=parts.join(" | ");
}
function buildAncGrid(){var el=document.getElementById("anc-grid");if(!el)return;var h="",i;for(i=0;i<ANCS.length;i++){var a=ANCS[i];h+='<div class="sc'+(cs.ancestry===a.id?" sel":"")+'" onclick="pickAnc('+i+')"><div class="nm">'+a.nm+'</div><div class="sb">'+a.bonus+'</div></div>';}el.innerHTML=h;}
function pickAnc(idx){cs.ancestry=ANCS[idx].id;cs.fp=[];cs.subrace=null;cs.heritageVariant=null;showAncDetail(cs.ancestry);}
function showAncDetail(ancId){
  var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===ancId){a=ANCS[i];break;}}if(!a)return;
  var gw=document.getElementById("anc-grid-wrap"),det=document.getElementById("anc-detail");if(gw)gw.style.display="none";if(det)det.style.display="block";
  var body=document.getElementById("anc-detail-body");if(!body)return;
  var isFlexRace=(a.fc>0),tHtml="",ti;
  if(a.traits){for(ti=0;ti<a.traits.length;ti++){var tr=a.traits[ti],di=tr.indexOf(" -- ");var bold=di>=0?tr.slice(0,di):tr,rest=di>=0?tr.slice(di+4):"";tHtml+='<div class="trbox"><span class="trb">'+bold+'</span>'+(rest?'<span class="trr"> -- '+rest+'</span>':"")+'</div>';}}
  var srHtml='<div class="slab">'+(ancId==="halfblood"?"Heritage":"Subrace")+'</div>',si2;
  if(a.subraces){for(si2=0;si2<a.subraces.length;si2++){var sr=a.subraces[si2];var isSel=cs.subrace===sr.id;var lgBadge="";if(isSel&&cs.heritageVariant&&sr.lineages){var lgi;for(lgi=0;lgi<sr.lineages.length;lgi++){if(sr.lineages[lgi].id===cs.heritageVariant){lgBadge='<div style="font-size:10px;color:var(--acc);margin-top:4px;text-transform:uppercase;letter-spacing:.07em;">'+sr.lineages[lgi].nm+' lineage ✓</div>';break;}}}var chevron=sr.lineages&&sr.lineages.length?'<span style="font-size:10px;color:var(--t2);margin-left:6px;">▾</span>':"";srHtml+='<div class="sc sr-c'+(isSel?" sel":"")+'" onclick="pickSub('+si2+')"><div class="nm" style="margin-bottom:2px;">'+sr.nm+chevron+'</div><div style="font-size:12px;color:var(--t1);line-height:1.5;">'+sr.desc+'</div>'+lgBadge+'</div>';}}
  body.innerHTML='<div style="font-size:18px;color:var(--acc);margin-bottom:4px;">'+a.nm+'</div><div style="font-size:12px;color:var(--t2);margin-bottom:10px;">'+a.bonus+'</div><div style="font-size:13px;color:var(--t1);line-height:1.7;margin-bottom:16px;">'+a.desc+'</div><div class="slab">Racial Traits</div>'+tHtml+srHtml;
  var fw=document.getElementById("flex-wrap");if(isFlexRace){if(fw)fw.style.display="block";buildFlexPick();}else{if(fw)fw.style.display="none";}
}
function pickSub(idx){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a||!a.subraces||idx>=a.subraces.length)return;var sr=a.subraces[idx];if(sr.lineages&&sr.lineages.length){cs.subrace=sr.id;cs.heritageVariant=null;showLineagePopup(sr);return;}cs.subrace=sr.id;cs.heritageVariant=null;showAncDetail(cs.ancestry);buildStatGrid();}
function pickHeritageVariant(varId){cs.heritageVariant=varId;closeLineagePopup();showAncDetail(cs.ancestry);buildStatGrid();}
function showLineagePopup(sr){
  var pop=document.getElementById("lineage-popup");if(!pop)return;
  document.getElementById("lp-title").textContent=sr.nm;
  var cards="",i;for(i=0;i<sr.lineages.length;i++){var lg=sr.lineages[i];cards+='<div class="sc sr-c" onclick="pickHeritageVariant(\''+lg.id+'\')" style="text-align:left;padding:12px 14px;margin-bottom:8px;cursor:pointer;"><div class="nm" style="margin-bottom:3px;">'+lg.nm+' lineage</div><div style="font-size:12px;color:var(--t1);line-height:1.5;">'+lg.desc+'</div></div>';}
  document.getElementById("lp-cards").innerHTML=cards;
  pop.style.display="flex";
}
function closeLineagePopup(){var pop=document.getElementById("lineage-popup");if(pop)pop.style.display="none";}
function hideAncDetail(){var gw=document.getElementById("anc-grid-wrap"),det=document.getElementById("anc-detail"),fw=document.getElementById("flex-wrap");if(gw)gw.style.display="block";if(det)det.style.display="none";if(fw)fw.style.display="none";buildAncGrid();}
function buildFlexPick(){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a||a.fc===0)return;var lim=a.fc,lbl=document.getElementById("flex-lbl");if(lbl)lbl.textContent="Choose "+lim+" stat"+(lim>1?"s":"")+" for +1 ("+cs.fp.length+"/"+lim+"):";var fg=document.getElementById("flex-grid");if(!fg)return;var h="",si;for(si=0;si<STATS.length;si++){var s=STATS[si],isSel=cs.fp.indexOf(s)>=0,isFull=!isSel&&cs.fp.length>=lim;h+='<div class="fp'+(isSel?" sel":"")+(isFull?" dis":"")+'" onclick="pickFlex(\''+s+'\')">'+s+'</div>';}fg.innerHTML=h;}
function pickFlex(s){var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(!a)return;var idx=cs.fp.indexOf(s);if(idx>=0)cs.fp.splice(idx,1);else if(cs.fp.length<a.fc)cs.fp.push(s);buildFlexPick();buildStatGrid();}
function buildClsGrid(){var el=document.getElementById("cls-grid");if(!el)return;var h="",i;for(i=0;i<CLSS.length;i++){var c=CLSS[i];h+='<div class="sc'+(cs.cls===c.id?" sel":"")+'" onclick="pickCls('+i+')"><div class="nm">'+c.id+'</div><div class="sb">'+c.desc+'</div><div class="sb">d'+c.hd+' HP &middot; '+c.prime+'</div></div>';}el.innerHTML=h;}
function pickCls(idx){cs.cls=CLSS[idx].id;
  // Re-map already-rolled stats onto the new class's STAT_PRIORITY (audit E57) — keeps the rolled
  // numbers (no re-roll fishing) but re-prioritizes them, so switching class after rolling can't
  // leave a Sorcerer with INT as a dump stat. Point-buy mode (cs.rolled false) is untouched.
  if(cs.rolled){var _vals=STATS.map(function(s){return cs.bs[s];}).sort(function(a,b){return b-a;});var _prio=STAT_PRIORITY[cs.cls]||STATS,_vi;for(_vi=0;_vi<_prio.length;_vi++)cs.bs[_prio[_vi]]=_vals[_vi];}
  buildClsGrid();var gp=document.getElementById("gear-prev");if(!gp)return;var archs=ARCHETYPES[CLSS[idx].id]||[];var archNames=[],ai;for(ai=0;ai<archs.length;ai++)archNames.push(archs[ai].nm);gp.innerHTML='<span style="color:#555;font-size:11px;">STARTING GEAR</span><br>'+CLSS[idx].gear+'<br><span style="font-size:11px;color:#555;">Prime: '+CLSS[idx].prime+'</span>'+(archNames.length?'<br><span style="font-size:11px;color:#555;">Specializations: '+archNames.join(", ")+'</span>':"");}
function buildStatGrid(){var fs=getFin();var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}var bst=[];if(a){if(a.fc>0)bst=cs.fp.slice();else{var keys=Object.keys(a.stats);for(i=0;i<keys.length;i++)bst.push(keys[i]);}}var has=cs.rolled||cs.statMode==="pb";var el=document.getElementById("stat-grid");if(!el)return;var h="",si;for(si=0;si<STATS.length;si++){var s=STATS[si],base=cs.bs[s],fin=fs[s],bon=fin-base,ib=bst.indexOf(s)>=0;h+='<div class="sbox'+(ib?" bst":"")+'"><div class="sn">'+s+'</div><div class="sv">'+(has?base:"--")+'</div><div class="sf">'+(has&&bon>0?fin+" (+"+bon+")":"&nbsp;")+'</div><div class="sm">'+(has?smod(fin):"")+'</div></div>';}el.innerHTML=h;}
function rollAllStats(){var rolls=[],i;for(i=0;i<6;i++)rolls.push(r4d6());rolls.sort(function(a,b){return b-a;});var prio=STAT_PRIORITY[cs.cls]||STATS;for(i=0;i<prio.length;i++)cs.bs[prio[i]]=rolls[i];cs.rolled=true;buildStatGrid();}
function setStatMode(m){cs.statMode=m;cs.rolled=false;if(m==="pb"){var i;for(i=0;i<STATS.length;i++)cs.bs[STATS[i]]=8;}document.getElementById("mode-roll").className=m==="roll"?"active":"";document.getElementById("mode-pb").className=m==="pb"?"active":"";document.getElementById("roll-sec").style.display=m==="roll"?"block":"none";document.getElementById("pb-sec").style.display=m==="pb"?"block":"none";if(m==="pb")buildPBCtrls();buildStatGrid();}
function buildPBCtrls(){var fs=getFin(),el=document.getElementById("pb-ctrls");if(!el)return;var h="",i;for(i=0;i<STATS.length;i++){var s=STATS[i],v=cs.bs[s],fv=fs[s],bon=fv-v;h+='<div class="pb-row"><span class="pn">'+s+'</span><input type="range" min="8" max="15" value="'+v+'" onchange="pbChange(this,\''+s+'\')"/><span class="pv">'+v+'</span><span class="pf">'+(bon>0?"->"+fv:"")+'</span></div>';}el.innerHTML=h;var rem=PBM-pbSp(),el2=document.getElementById("pb-rem");if(el2){el2.textContent=rem;el2.style.color=rem<5?"#c04040":"inherit";}}
function pbChange(sl,s){var val=parseInt(sl.value),prev=PBC[cs.bs[s]]||0,next=PBC[val]||0;if(pbSp()-prev+next>PBM){sl.value=cs.bs[s];return;}cs.bs[s]=val;buildPBCtrls();buildStatGrid();}
function rvSyncXp(){
  var lvlEl=document.getElementById("rv-start-level");
  var xpEl=document.getElementById("rv-start-xp");
  var hintEl=document.getElementById("rv-xp-hint");
  if(!lvlEl||!xpEl)return;
  var lvl=parseInt(lvlEl.value)||1;
  var floor=XP_LEVELS[lvl-1]||0;
  // Preserve an in-band typed value instead of always resetting to the floor (audit E56) — this
  // fires on every name keystroke via buildReview, which used to wipe a tester's XP override.
  var cap=lvl<10?XP_LEVELS[lvl]-1:Infinity,cur=parseInt(xpEl.value);
  xpEl.value=(!isNaN(cur)&&cur>=floor&&cur<=cap)?cur:floor;
  xpEl.min=floor;
  if(hintEl)hintEl.textContent="Floor for level "+lvl+": "+floor+" XP"+(lvl<10?" | Next level at: "+XP_LEVELS[lvl]+" XP":"");
  var goBtn=document.getElementById("rv-go");
  if(goBtn)goBtn.textContent=lvl>=3?"Assign level perks":"Begin your journey";
  buildDots();
}
function buildFinishingTouches(){
  var ap=document.getElementById("char-appear"),bs=document.getElementById("char-backstory");
  if(ap&&cs.appear&&!ap.value)ap.value=cs.appear;
  if(bs&&cs.backstory&&!bs.value)bs.value=cs.backstory;
  var prev=document.getElementById("ft-portrait-preview");
  if(prev)refreshFtPortrait();
}
function refreshFtPortrait(){
  var prev=document.getElementById("ft-portrait-preview");if(!prev)return;
  var derive=document.getElementById("ft-derive");
  if(cs.portrait){
    prev.innerHTML="<img id='ft-portrait-img' src='"+cs.portrait+"' style='width:100%;height:100%;object-fit:cover;display:block;cursor:grab;'/>";
    if(derive)derive.style.display="block";
    var img=document.getElementById("ft-portrait-img");
    if(img){
      wirePortraitDrag(img,
        function(){return cs.portraitOffset||{x:0.5,y:0.5,zoom:1};},
        function(x,y,zoom){cs.portraitOffset={x:x,y:y,zoom:zoom};}
      );
    }
  }else{
    prev.innerHTML="<span style='font-size:11px;color:var(--t2);'>No portrait</span>";
    if(derive)derive.style.display="none";
  }
}
async function ftRenderPortrait(){
  var status=document.getElementById("ft-portrait-status");
  if(!falKey){status.innerHTML="<span style='color:var(--red);'>No fal.ai key — add one via File &#9656; fal.ai image key…</span>";return;}
  if(busy){status.innerHTML="<span style='color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
  var genderWord=cs.gender==="F"?"female":cs.gender==="NB"?"androgynous":"male";
  var d=cs.name||"A character";
  var anc=cs.ancestry?ANCS.filter(function(a){return a.id===cs.ancestry;})[0]:null;
  if(anc)d+=", a "+genderWord+" "+(cs.age||"")+(" "+anc.nm)+(cs.cls?" "+cs.cls:"");
  else d+=", a "+genderWord+(cs.age?" "+cs.age:"")+(cs.cls?" "+cs.cls:"");
  var ap=document.getElementById("char-appear");
  if(ap&&ap.value.trim())d+=", "+ap.value.trim();
  var promptReq="Write a detailed image generation prompt for a fantasy character portrait. "
    +"Base character description: "+d+". "
    +"Spell out hair, eyes, skin tone, clothing, and visible gear explicitly. "
    +"Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly. 2-3 sentences. Output ONLY the prompt, no commentary, no tags.";
  status.innerHTML="<span style='color:var(--t2);font-style:italic;'>Writing portrait prompt…</span>";
  busy=true;
  try{
    var prompt=await callGM(promptReq,"You are a portrait image prompt writer for a dark fantasy RPG. Output ONLY the image prompt. No narration, no game tags.",600);
    status.innerHTML="<span style='color:var(--t2);font-style:italic;'>Generating portrait…</span>";
    var mdlCfg=RENDER_MODELS[0],mi;
    for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
    var falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
      headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
      body:JSON.stringify(portraitRenderBody(mdlCfg,prompt))});
    if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
    var falData=await falRes.json();
    if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
    var imgUrl=falData.images[0].url;
    var resp=await fetch(imgUrl);var blob=await resp.blob();
    var reader=new FileReader();
    reader.onload=function(e){
      compressPortrait(e.target.result,function(compressed){
        cs.portrait=compressed;refreshFtPortrait();
        status.innerHTML="<span style='color:var(--grn);'>Portrait generated.</span>";
      });
    };
    reader.readAsDataURL(blob);
  }catch(err){
    status.innerHTML="<span style='color:var(--red);'>"+err.message+"</span>";
  }
  busy=false;
}
async function ftDeriveAppearance(){
  var status=document.getElementById("ft-portrait-status");
  if(!cs.portrait){status.innerHTML="<span style='color:var(--red);'>No portrait to read.</span>";return;}
  if(busy){status.innerHTML="<span style='color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
  status.innerHTML="<span style='color:var(--t2);font-style:italic;'>Reading the portrait…</span>";
  busy=true;
  try{
    var desc=await describePortraitImage(cs.portrait,cs.name);
    if(desc){
      var ap=document.getElementById("char-appear");
      if(ap)ap.value=desc;
      cs.appear=desc;
      status.innerHTML="<span style='color:var(--grn);'>Appearance derived from portrait.</span>";
    }else{
      status.innerHTML="<span style='color:var(--red);'>Empty description returned.</span>";
    }
  }catch(err){
    status.innerHTML="<span style='color:var(--red);'>"+(err.message||"Failed")+"</span>";
  }
  busy=false;
}
function buildReview(){
  var el=document.getElementById("rv-card");if(!el)return;
  // Imported character path — show as-is summary, no re-roll
  if(pendingImportChar){
    var ch=pendingImportChar,nameEl=document.getElementById("char-name");
    var dispName=nameEl&&nameEl.value.trim()?nameEl.value.trim():ch.name;
    var init2=(dispName||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";
    var avHtml2=ch.portrait?'<div class="rv-av" style="overflow:hidden;"><img src="'+ch.portrait+'" style="width:100%;height:100%;object-fit:cover;display:block;"/></div>':'<div class="rv-av">'+init2+'</div>';
    var fs2=ch.stats||{};
    el.innerHTML='<div class="rv-head">'+avHtml2+'<div><div class="rv-nm">'+(dispName||'<span style="color:var(--t2)">Enter a name above</span>')+'</div>'
      +'<div class="rv-sub">'+(ch.subraceNm||ch.subrace||ch.ancestry||"")+" "+(ch.cls||"")+" &middot; Lv"+(ch.level||1)+" &middot; "+(ch.gender==="F"?"Female":ch.gender==="NB"?"Non-binary":"Male")+'</div></div></div>'
      +'<div class="rsgd">'+STATS.map(function(s){return'<div class="rsb"><div class="rn">'+s+'</div><div class="rv2">'+(fs2[s]||"—")+'</div><div class="rm">'+(fs2[s]?smod(fs2[s]):"")+'</div></div>';}).join("")+'</div>'
      +'<div class="rv-2c"><div class="rv-row"><span class="rk">Max HP</span><span class="rv">'+(ch.maxHp||ch.hp||0)+'</span></div><div class="rv-row"><span class="rk">Gold</span><span class="rv">'+(ch.gold||0)+' gp</span></div><div class="rv-row"><span class="rk">Level</span><span class="rv">'+(ch.level||1)+'</span></div><div class="rv-row"><span class="rk">XP</span><span class="rv">'+(ch.xp||0)+'</span></div></div>'
      +(ch.appear?'<div class="desc-pre">"'+ch.appear+'"</div>':"")
      +'<div style="font-size:11px;color:var(--t2);margin-top:8px;text-align:center;">Importing at level '+(ch.level||1)+" — no re-roll.</div>";
    var cnInp2=document.getElementById("rv-camp-name");if(cnInp2){if(pendingBlueprint&&pendingBlueprint.name){var _ibpNms=[dispName];var _ibpci;for(_ibpci=0;_ibpci<pendingCompanions.length;_ibpci++)_ibpNms.push(pendingCompanions[_ibpci].name);cnInp2.value=pendingBlueprint.name+" ("+_ibpNms.join(", ")+")"}else if(!cnInp2.value)cnInp2.value=dispName;}
    if(typeof _renderCompanionSlots==="function")_renderCompanionSlots();
    return;
  }
  var i,cls=null,anc=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===cs.cls){cls=CLSS[i];break;}}for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){anc=ANCS[i];break;}}
  var fs=getFin(),hp=getMHP();if(!rvGoldRolled){rvGold=15+droll(10);rvGoldRolled=true;}
  var dispNm=cs.name||(document.getElementById("char-name")?document.getElementById("char-name").value.trim():"");
  var init=(dispNm||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";
  var subnm=getSubNm();
  var alignEl=document.getElementById("char-alignment"),statedAlign=alignEl?alignEl.value:"Chaotic Neutral";
  var genderLbl=cs.gender==="F"?"Female":cs.gender==="NB"?"Non-binary":"Male";
  var avHtml=cs.portrait?'<div class="rv-av" style="overflow:hidden;"><img src="'+cs.portrait+'" style="width:100%;height:100%;object-fit:cover;display:block;"/></div>':'<div class="rv-av">'+init+'</div>';
  el.innerHTML='<div class="rv-head">'+avHtml+'<div><div class="rv-nm">'+(dispNm||'<span style="color:var(--t2)">Enter a name above</span>')+'</div><div class="rv-sub">'+(subnm||(anc?anc.nm:"?"))+" "+(cs.cls||"?")+" &middot; "+cs.age+" &middot; "+genderLbl+'</div></div></div>'
    +'<div class="rsgd">'+STATS.map(function(s){return'<div class="rsb"><div class="rn">'+s+'</div><div class="rv2">'+fs[s]+'</div><div class="rm">'+smod(fs[s])+'</div></div>';}).join("")+'</div>'
    +'<div class="rv-2c"><div class="rv-row"><span class="rk">Max HP</span><span class="rv">'+hp+'</span></div><div class="rv-row"><span class="rk">Gold</span><span class="rv">'+rvGold+' gp</span></div><div class="rv-row"><span class="rk">Prime</span><span class="rv">'+(cls?cls.prime:"?")+'</span></div><div class="rv-row"><span class="rk">Hit die</span><span class="rv">'+(cls?"d"+cls.hd:"?")+'</span></div></div>'
    +(cs.appear?'<div class="desc-pre">"'+cs.appear+'"</div>':"")
    +'<div class="rv-row"><span class="rk">Alignment</span><span class="rv" style="font-weight:normal;">'+statedAlign+'</span></div>'
    +(DEITY_CENTRIC.indexOf(cs.cls)>=0&&document.getElementById("char-deity")&&document.getElementById("char-deity").value.trim()?'<div class="rv-row"><span class="rk">Deity</span><span class="rv" style="font-weight:normal;">'+document.getElementById("char-deity").value.trim()+'</span></div>':"")
    +'<div><div class="rk" style="margin-bottom:6px;">Starting gear</div><div class="tags">'+(cls?cls.gear:"").split(", ").map(function(g){return'<span class="tag">'+g+'</span>';}).join("")+'</div></div>';
  var lvlSel=document.getElementById("rv-start-level"),goBtn=document.getElementById("rv-go");
  if(lvlSel&&goBtn)goBtn.textContent=parseInt(lvlSel.value)>=3?"Assign level perks":"Begin your journey";
  // Pre-fill campaign name with character name if not yet set
  var cnInp=document.getElementById("rv-camp-name");if(cnInp&&!cnInp.value)cnInp.value=dispNm;
  // Blueprint overrides: campaign name and starting location
  var locField=document.getElementById("rv-loc-field"),locFixed=document.getElementById("rv-loc-fixed");
  if(pendingBlueprint){
    if(cnInp&&pendingBlueprint.name){var _bpNms=[dispNm||cs.name];var _bpci;for(_bpci=0;_bpci<pendingCompanions.length;_bpci++)_bpNms.push(pendingCompanions[_bpci].name);cnInp.value=pendingBlueprint.name+(_bpNms[0]?" ("+_bpNms.join(", ")+")":"");}
    var bpLoc=pendingBlueprint.startingLocation;
    if(bpLoc){
      if(locField)locField.style.display="none";
      if(locFixed){locFixed.style.display="block";locFixed.querySelector("span").textContent=bpLoc;}
    }
  }else{
    if(locField)locField.style.display="block";
    if(locFixed)locFixed.style.display="none";
  }
  rvSyncXp();
  if(typeof _renderCompanionSlots==="function")_renderCompanionSlots();
}
function getDefaultDeity(){
  var cls=cs.cls;if(!cls||DEITY_CENTRIC.indexOf(cls)<0)return"";
  var alignEl=document.getElementById("char-alignment");
  var align=alignEl?alignEl.value:"True Neutral";
  var anc=cs.ancestry||"",sub=cs.subrace||"",evil=align.indexOf("Evil")>=0;
  if(anc==="elf"&&cls!=="Paladin")return"Corellon, God of Spring and Beauty";
  if(anc==="dwarf")return"Moradin, Soul Forger of the Dwarves";
  if(anc==="gnome"&&cls!=="Paladin")return"Ioun, Goddess of Knowledge and Prophecy";
  if(anc==="halfblood"){
    if(sub==="half_elven"&&!evil)return"Sehanine, Goddess of Moonlight and Illusion";
    if(sub==="half_orcish"&&evil)return"Gruumsh, the One-Eyed Destroyer";
    if(sub==="half_infernal"&&evil)return"Asmodeus, God of Tyranny";
    if(sub==="half_fey")return"Sehanine, Goddess of Moonlight and Illusion";
    if(sub==="half_hollow")return"The Raven Queen, Mistress of Fate";
    if(sub==="half_draconic")return evil?"Tiamat, the Dragon Queen":"Bahamut, the Platinum Dragon";
  }
  return(DEITY_MAP[cls]&&DEITY_MAP[cls][align])||"Unknown";
}
function buildStep6Deity(){
  var wrap=document.getElementById("deity-wrap");if(!wrap)return;
  var isDeity=DEITY_CENTRIC.indexOf(cs.cls)>=0;
  wrap.style.display=isDeity?"block":"none";
  var inp=document.getElementById("char-deity");
  if(!isDeity){
    // Clear a deity auto-filled during an earlier Cleric/Paladin/Druid visit (audit E39) — otherwise
    // the hidden value survives a class switch and confirmChar stores it on a non-deity character.
    if(inp)inp.value="";cs.deityEdited=false;return;
  }
  if(inp&&!cs.deityEdited){inp.value=getDefaultDeity();}
}
function goStep(n){
  document.getElementById("step"+cs.step).classList.remove("active");cs.step=n;document.getElementById("step"+n).classList.add("active");buildDots();
  if(n===1)buildDnaStep();
  if(n===2){if(cs.ancestry){showAncDetail(cs.ancestry);}else{var gw=document.getElementById("anc-grid-wrap"),det=document.getElementById("anc-detail");if(gw)gw.style.display="block";if(det)det.style.display="none";buildAncGrid();}}
  if(n===3)buildClsGrid();if(n===4){buildStatGrid();if(cs.statMode==="pb")buildPBCtrls();buildStep6Deity();}if(n===5)buildFinishingTouches();if(n===6)buildReview();window.scrollTo(0,0);
}
function confirmChar(){
  var nameEl=document.getElementById("char-name"),enteredName=nameEl?nameEl.value.trim():"";
  // Imported character path: skip normal build, just apply review-step fields and start game
  if(pendingImportChar){
    var ic=pendingImportChar;pendingImportChar=null;
    ic.name=enteredName||ic.name;
    var cn2El=document.getElementById("rv-camp-name"),campNm2=cn2El&&cn2El.value.trim()?cn2El.value.trim():ic.name;
    var slEl2=document.getElementById("rv-start-loc"),startLoc2=slEl2?slEl2.value:"The Crossroads of Ashenveil";
    if(startLoc2==="custom"){var clEl2=document.getElementById("rv-start-loc-text");startLoc2=clEl2&&clEl2.value.trim()?clEl2.value.trim():"A place of your choosing";}
    ic._campName=campNm2;ic._startLoc=startLoc2;
    snapshotActiveCamp();
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    var nid=newCampaignId();setActiveCampId(nid);
    worldState=null;sessionLog=[];memory=blankMemory();
    document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
    startGame(ic,getToneNm(),getToneVc(),cs.author||"");
    return;
  }
  if(!enteredName){showToast("Enter a character name first.");return;}
  cs.name=enteredName;
  var i,cls=null,anc=null;for(i=0;i<CLSS.length;i++){if(CLSS[i].id===cs.cls){cls=CLSS[i];break;}}for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){anc=ANCS[i];break;}}
  var fs=getFin(),hp=getMHP(),subnm=getSubNm();
  var alignEl=document.getElementById("char-alignment"),statedAlign=alignEl?alignEl.value:"Chaotic Neutral";
  var slEl=document.getElementById("rv-start-level"),startLvl=slEl?parseInt(slEl.value)||1:1;
  // Clamp the starting-XP override into the level's band [floor, next-1] (audit E56) — an unclamped
  // value at/above the next threshold made the first in-play [XP:] jump multiple levels (now safe
  // via E1's loop, but the character should still start inside its own band).
  var xpEl=document.getElementById("rv-start-xp"),_xpFloor=XP_LEVELS[startLvl-1]||0,_xpCap=startLvl<10?XP_LEVELS[startLvl]-1:Infinity;
  var startXp=xpEl?Math.min(Math.max(parseInt(xpEl.value)||0,_xpFloor),_xpCap):_xpFloor;
  var startLoc;
  if(pendingBlueprint&&pendingBlueprint.startingLocation){startLoc=pendingBlueprint.startingLocation;}
  else{var locEl=document.getElementById("rv-start-loc");startLoc=locEl?locEl.value:"The Crossroads of Ashenveil";if(startLoc==="custom"){var custLocEl=document.getElementById("rv-start-loc-text");startLoc=custLocEl&&custLocEl.value.trim()?custLocEl.value.trim():"A place of your choosing";}}
  var cnEl=document.getElementById("rv-camp-name"),campNameVal=cnEl&&cnEl.value.trim()?cnEl.value.trim():null;
  var deityEl=document.getElementById("char-deity");var charDeity=(DEITY_CENTRIC.indexOf(cs.cls)>=0&&deityEl&&deityEl.value.trim())?deityEl.value.trim():null;/* gate: only deity classes carry a deity (audit E39) */
  // Derive starting languages from ancestry and subrace
  var startLangs=["Common"];
  var ancLangMap={elf:"Elvish",dwarf:"Dwarvish",gnome:"Gnomish",tiefling:"Infernal",hollow:"Umbral"};
  if(ancLangMap[cs.ancestry])startLangs.push(ancLangMap[cs.ancestry]);
  if(cs.ancestry==="halfblood"&&cs.subrace){var subLangMap={half_elven:"Elvish",half_orcish:"Orcish",half_draconic:"Draconic",half_infernal:"Infernal",half_fey:"Sylvan",half_gnomish:"Gnomish"};if(subLangMap[cs.subrace]&&startLangs.indexOf(subLangMap[cs.subrace])<0)startLangs.push(subLangMap[cs.subrace]);}
  var char={name:cs.name,gender:cs.gender||"M",age:cs.age,appear:cs.appear,mark:"",backstory:cs.backstory||"",ancestry:anc?anc.nm:"Unknown",subrace:cs.subrace,subraceNm:subnm,heritageVariant:cs.heritageVariant||null,cls:cs.cls,stats:fs,hp:hp,maxHp:hp,gold:rvGold,inventory:(cls?cls.gear.split(", "):[]).concat(["First aid kit"]),level:1,xp:0,abilities:[],spells:[],archetype:null,archetypeNm:null,statedAlignment:statedAlign,actualAlignment:statedAlign,alignLaw:0,alignGood:0,deity:charDeity,trait:null,flaw:null,motivation:null,languages:startLangs.map(function(l){return{name:l,broken:false};}),skills:null,conditions:[],relationships:[],saveModifiers:[],portrait:cs.portrait||null,portraitOffset:cs.portraitOffset||null,storyBeats:[],partyMember:true};
  char.xp=startXp; // apply the (clamped) starting XP at level 1 too — was silently dropped (audit E56)
  if(startLvl>1){char.level=startLvl;var hpB=0,si;for(si=2;si<=startLvl;si++){var hg=cls?(Math.ceil(cls.hd/2)+1+Math.floor((char.stats.CON-10)/2)):3;hpB+=Math.max(1,hg);}char.hp+=hpB;char.maxHp+=hpB;}
  // Racial capabilities — single-sourced in the capability bible (TODO #10). Resolve racial_caps from
  // ancestry, then the chosen subrace, then its lineage, against capabilityLookup: bible spells land in
  // char.spells (racial:true), bible abilities in char.abilities (ds pulled from the bible effect). A bare
  // string is a passive/at-will grant; {cap,use} adds a recharge to the display name. The subrace/lineage
  // still contributes ONE flavor "[Racial] X" identity ability. Mechanics live ONLY in the bible now.
  if(anc){
    var rsab=null,_lineage=null,rsj,rlk,_ci;
    if(anc.subraces&&cs.subrace){for(rsj=0;rsj<anc.subraces.length;rsj++){if(anc.subraces[rsj].id===cs.subrace){rsab=anc.subraces[rsj];break;}}}
    if(rsab&&cs.heritageVariant&&rsab.lineages){for(rlk=0;rlk<rsab.lineages.length;rlk++){if(rsab.lineages[rlk].id===cs.heritageVariant){_lineage=rsab.lineages[rlk];break;}}}
    if(rsab){var rlbl=cs.ancestry==="halfblood"?"[Racial] One parent trait":"[Racial] "+rsab.nm;char.abilities.push({nm:rlbl,ds:(_lineage?_lineage.desc:rsab.desc)||"",gained:0});}
    var _caps=[].concat(anc.racial_caps||[],(rsab&&rsab.racial_caps)||[],(_lineage&&_lineage.racial_caps)||[]),_seenCap={};
    // A broader innate sense supersedes the narrower one on the same character (Superior Darkvision > Darkvision).
    var _hasSuperior=false;for(_ci=0;_ci<_caps.length;_ci++){if(capBaseName(typeof _caps[_ci]==="string"?_caps[_ci]:_caps[_ci].cap)==="superior darkvision")_hasSuperior=true;}
    for(_ci=0;_ci<_caps.length;_ci++){
      var _it=typeof _caps[_ci]==="string"?{cap:_caps[_ci]}:_caps[_ci],_key=capBaseName(_it.cap);
      if(_seenCap[_key]||(_hasSuperior&&_key==="darkvision"))continue;_seenCap[_key]=1;
      var _e=(typeof capabilityLookup==="function")?capabilityLookup(_it.cap):null;if(!_e)continue;// unknown cap — the coverage-guard test blocks this shipping
      var _nm=_it.cap+((_it.use&&_it.use!=="passive"&&_it.use!=="at-will")?" ("+_it.use+")":"");
      if(_e.kind==="spell")char.spells.push({nm:_nm,lvl:_e.tier||0,used:false,racial:true});
      else char.abilities.push({nm:_nm,ds:_e.effect||"",gained:0,racial:true});
    }
  }
  var clsAbs=ABILS[cs.cls]||[],clsi;for(clsi=0;clsi<clsAbs.length;clsi++){char.abilities.push({nm:clsAbs[clsi].nm,ds:clsAbs[clsi].ds,gained:0});}
  // Level-band class features for a high-level start (audit E38). Previously these were added
  // ONLY in pickCreationArch (the level>=3 archetype path), so a level-2 start never received its
  // level-2 feature (Action Surge, Cunning Action, …) — and checkLevelUp only backfills features
  // for levels crossed AFTER creation, so the slot stayed permanently empty. Grant them here for
  // every startLvl>1 (level 1 has no features); pickCreationArch no longer adds them, so no double.
  if(startLvl>1){var _cf=CLASS_FEATURES[cs.cls]||{},_cfi;for(_cfi=2;_cfi<=startLvl;_cfi++){if(_cf[_cfi])char.abilities.push({nm:"Lv"+_cfi,ds:_cf[_cfi],gained:0});}}
  char._campName=campNameVal;
  if(startLvl>=3){pendingChar=char;pendingTone=getToneNm();pendingVoice=getToneVc();pendingAuthor=cs.author||"";pendingLoc=startLoc;
    // Snapshot for perk-flow Back (E2) + revert-safe CON→HP (E55): stats, abilities length, and the
    // pre-bump HP/CON-mod, so HP can be recomputed from base on every apply/revert.
    pendingPerkBase={stats:Object.assign({},char.stats),abilLen:char.abilities.length,maxHp:char.maxHp,hp:char.hp,conMod:Math.floor((char.stats.CON-10)/2)};_cbApplied=[];
    showCreationArchetype();}
  else{char._startLoc=startLoc;if(buildPendingSpellPool(char)){pendingChar=char;pendingTone=getToneNm();pendingVoice=getToneVc();pendingAuthor=cs.author||"";pendingLoc=startLoc;showCreationSpellPick();}else{startGame(char,getToneNm(),getToneVc(),cs.author||"");}}
}
function showCreationArchetype(){
  var c=pendingChar;if(!c)return;var archs=ARCHETYPES[c.cls]||[];
  document.getElementById("char-screen").style.display="none";
  var wrap=document.createElement("div");wrap.id="creation-arch";wrap.style.cssText="max-width:700px;margin:0 auto;padding:24px 20px;";
  var ch="",i;for(i=0;i<archs.length;i++){ch+="<div class='sc' id='arch-card-"+i+"' onclick='selectCreationArch("+i+")' style='text-align:left;padding:16px 18px;margin-bottom:10px;'><div class='nm' style='margin-bottom:6px;'>"+archs[i].nm+"</div><div style='font-size:12px;color:var(--t1);line-height:1.6;'>"+archs[i].desc+"</div></div>";}
  var featHtml="",features=CLASS_FEATURES[c.cls]||{};
  for(i=2;i<=c.level;i++){var f=features[i];if(!f)continue;var col=i===3?"var(--acc)":"var(--t0)";var bc=i===3?"var(--acc)":"var(--brd)";featHtml+="<div style='padding:6px 10px;background:var(--bg2);border:1px solid "+bc+";border-radius:6px;margin-bottom:6px;'><span style='font-size:11px;font-weight:bold;color:"+col+";'>Lv"+i+"</span><span style='font-size:10px;color:var(--t2);display:block;margin-top:2px;'>"+f+"</span></div>";}
  for(i=0;i<STAT_BUMP_LEVELS.length;i++){if(STAT_BUMP_LEVELS[i]<=c.level)featHtml+="<div style='padding:6px 10px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;margin-bottom:6px;'><span style='font-size:11px;font-weight:bold;color:var(--t0);'>Lv"+STAT_BUMP_LEVELS[i]+": Stat bump</span><span style='font-size:10px;color:var(--t2);display:block;margin-top:2px;'>+2 to one or +1 to two. Max 20.</span></div>";}
  wrap.innerHTML="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--acc);margin-bottom:6px;'>Starting level "+c.level+" -- required</div><h2 style='font-size:20px;color:var(--acc);margin-bottom:4px;'>Choose your archetype</h2><p style='font-size:13px;color:var(--t1);margin-bottom:20px;'>You are a <strong style='color:var(--t0);'>"+c.cls+"</strong>. At level 3, every "+c.cls.toLowerCase()+" commits to a path.</p>"+ch+(featHtml?"<div style='border:1px solid var(--brd);border-radius:10px;background:var(--bg1);padding:16px 18px;margin-top:20px;'><div style='font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--t2);margin-bottom:10px;'>Abilities at level "+c.level+"</div>"+featHtml+"</div>":"")+"<p id='arch-warn' style='font-size:12px;color:#c04040;min-height:16px;margin-top:12px;'></p><button id='arch-confirm-btn' onclick='confirmCreationArch()' style='width:100%;margin-top:6px;padding:13px;font-size:15px;font-family:var(--font);background:#333;color:#666;border:1px solid #444;border-radius:var(--r);cursor:default;font-weight:bold;' disabled>Choose an archetype above</button>";
  document.body.appendChild(wrap);
  window._selectedArchIdx=-1;
}
function selectCreationArch(idx){
  var archs=ARCHETYPES[pendingChar.cls]||[],i;
  for(i=0;i<archs.length;i++){var el=document.getElementById("arch-card-"+i);if(el){el.style.borderColor=i===idx?"var(--acc)":"var(--brd)";el.style.background=i===idx?"#1e1800":"var(--bg1)";var nm=el.querySelector(".nm");if(nm)nm.style.color=i===idx?"var(--acc)":"var(--t0)";}}
  window._selectedArchIdx=idx;
  var btn=document.getElementById("arch-confirm-btn");
  if(btn){btn.disabled=false;btn.style.background="var(--acc)";btn.style.color="#000";btn.style.cursor="pointer";btn.textContent="Confirm: "+archs[idx].nm;}
  var w=document.getElementById("arch-warn");if(w)w.textContent="";
}
function confirmCreationArch(){
  if(window._selectedArchIdx<0){var w=document.getElementById("arch-warn");if(w)w.textContent="Choose an archetype first.";return;}
  pickCreationArch(window._selectedArchIdx);
}
// Restore the character to its pre-perk-flow snapshot (audit E2) — used by every Back path so
// re-picking an archetype or re-confirming a bump can't stack duplicate abilities or double stats.
function restorePerkBase(){
  if(!pendingPerkBase||!pendingChar)return;
  pendingChar.stats=Object.assign({},pendingPerkBase.stats);
  pendingChar.abilities=pendingChar.abilities.slice(0,pendingPerkBase.abilLen);
  syncPerkHp();
}
// Recompute max/current HP from the pre-bump snapshot + the CURRENT CON modifier (audit E55).
// A creation stat bump that raises CON's modifier retroactively adds HP for every level the
// character starts with (CON mod is in level 1's HP and each per-level roll); the old flow rolled
// HP with pre-bump CON and never revisited it, so a +2 CON bump on a high-level start added no HP.
// Computed from base, so it is idempotent and correct under any sequence of applies and Back-reverts.
function syncPerkHp(){
  if(!pendingPerkBase||!pendingChar)return;
  var c=pendingChar,cm=Math.floor(((c.stats.CON||10)-10)/2);
  var d=(cm-pendingPerkBase.conMod)*(c.level||1);
  c.maxHp=pendingPerkBase.maxHp+d;c.hp=pendingPerkBase.hp+d;
}
function pickCreationArch(idx){
  var c=pendingChar;if(!c)return;var archs=ARCHETYPES[c.cls]||[];if(idx>=archs.length)return;
  // Idempotent (E2): reset to the snapshot first, so re-entering the archetype screen (via Back)
  // and picking again — the same OR a different archetype — never leaves a stale archetype ability
  // or previously-applied stat bumps behind. Features were granted once in confirmChar (E38).
  restorePerkBase();_cbApplied=[];
  c.archetype=archs[idx].id;c.archetypeNm=archs[idx].nm;
  if(!c.abilities)c.abilities=[];c.abilities.push({nm:archs[idx].nm,ds:archs[idx].desc,gained:0});
  var wrap=document.getElementById("creation-arch"),i;if(wrap)wrap.remove();
  var bumpsNeeded=0;for(i=0;i<STAT_BUMP_LEVELS.length;i++){if(STAT_BUMP_LEVELS[i]<=c.level)bumpsNeeded++;}
  if(bumpsNeeded>0){pendingBumps=bumpsNeeded;currentBump=1;showCreationStatBump();}
  else if(buildPendingSpellPool(c)){showCreationSpellPick();}
  else{c._startLoc=pendingLoc;startGame(c,pendingTone,pendingVoice,pendingAuthor);}
}
function buildPendingSpellPool(c){
  var src=SPELLS[c.cls]||(c.archetype?ARCH_SPELLS[c.archetype]:null);
  if(!src)return false;
  var maxSlot=c.level>=5?3:c.level>=3?2:1,sl;
  pendingSpellPool={};
  // Count racial spells already on the character — each grants +1 pick in that tier
  pendingRacialBonus={};
  var rs=c.spells||[];for(var ri=0;ri<rs.length;ri++){if(rs[ri].racial){var rk=rs[ri].lvl===0?"cantrips":String(rs[ri].lvl);pendingRacialBonus[rk]=(pendingRacialBonus[rk]||0)+1;}}
  if(src.cantrips&&src.cantrips.length)pendingSpellPool.cantrips=src.cantrips.map(function(nm){return{nm:nm,sel:false};});
  for(sl=1;sl<=maxSlot;sl++){if(src[sl]&&src[sl].length)pendingSpellPool[sl]=src[sl].map(function(nm){return{nm:nm,sel:false};});}
  return Object.keys(pendingSpellPool).length>0;
}
function showCreationSpellPick(){
  var c=pendingChar;if(!c)return;var ex=document.getElementById("creation-spells");if(ex)ex.remove();
  document.getElementById("char-screen").style.display="none";
  var tiers=["cantrips","1","2","3"].filter(function(t){return pendingSpellPool[t]&&pendingSpellPool[t].length;});
  if(!tiers.length){c._startLoc=pendingLoc;startGame(c,pendingTone,pendingVoice,pendingAuthor);return;}
  var wrap=document.createElement("div");wrap.id="creation-spells";wrap.style.cssText="max-width:600px;margin:0 auto;padding:24px 20px;";
  var html="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--acc);margin-bottom:6px;'>Character creation</div><h2 style='font-size:20px;color:var(--acc);margin-bottom:4px;'>Choose your spells</h2><p style='font-size:13px;color:var(--t1);margin-bottom:20px;'>Select the spells "+c.name+" begins with.</p>";
  tiers.forEach(function(tier){
    var spells=pendingSpellPool[tier],base=SPELL_PICK_LIMITS[tier]||2,bonus=pendingRacialBonus[tier]||0,lim=base+bonus;
    var lbl=tier==="cantrips"?"Cantrips":"Level "+tier+" Spells";
    var hint=spells.length<=lim?"take all":"pick "+base+(bonus?"+"+bonus+" racial bonus":"");
    html+="<div style='margin-bottom:20px;'><div class='slab'>"+lbl+" <span style='font-size:9px;color:var(--t2);font-weight:normal;'>("+hint+")</span></div>";
    spells.forEach(function(sp,idx){
      var nm=sp.nm.indexOf("(")>=0?sp.nm.slice(0,sp.nm.indexOf("(")).trim():sp.nm;
      var ds=sp.nm.indexOf("(")>=0?sp.nm.slice(sp.nm.indexOf("(")+1).replace(")",""):"";
      html+="<div id='spc-"+tier+"-"+idx+"' class='sc sr-c' onclick='toggleSpellPick(\""+tier+"\","+idx+")' style='text-align:left;padding:10px 14px;margin-bottom:6px;cursor:pointer;'><div class='nm' style='margin-bottom:2px;'>"+nm+"</div>"+(ds?"<div style='font-size:11px;color:var(--t1);'>"+ds+"</div>":"")+"</div>";
    });
    html+="</div>";
  });
  html+="<p id='sp-warn' style='font-size:12px;color:#c04040;min-height:16px;margin-top:4px;'></p><button onclick='confirmCreationSpells()' style='width:100%;padding:13px;font-size:15px;font-family:var(--font);background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;margin-top:4px;'>Confirm spells &rarr; Begin</button>";
  wrap.innerHTML=html;document.body.appendChild(wrap);
}
function toggleSpellPick(tier,idx){
  var sp=pendingSpellPool[tier];if(!sp)return;
  var lim=(SPELL_PICK_LIMITS[tier]||2)+(pendingRacialBonus[tier]||0);
  var cur=sp.filter(function(s){return s.sel;}).length;
  if(sp[idx].sel){sp[idx].sel=false;}
  else{if(cur>=lim){document.getElementById("sp-warn").textContent="Max "+lim+" for this tier.";return;}sp[idx].sel=true;}
  document.getElementById("sp-warn").textContent="";
  var card=document.getElementById("spc-"+tier+"-"+idx);
  if(card){card.style.borderColor=sp[idx].sel?"var(--acc)":"var(--brd)";card.style.background=sp[idx].sel?"#1e1800":"var(--bg1)";var nm=card.querySelector(".nm");if(nm)nm.style.color=sp[idx].sel?"var(--acc)":"var(--t0)";}
}
function confirmCreationSpells(){
  var c=pendingChar;if(!c)return;
  var tiers=["cantrips","1","2","3"].filter(function(t){return pendingSpellPool[t]&&pendingSpellPool[t].length;}),ok=true;
  tiers.forEach(function(tier){
    var sp=pendingSpellPool[tier],lim=(SPELL_PICK_LIMITS[tier]||2)+(pendingRacialBonus[tier]||0),need=Math.min(lim,sp.length);
    if(sp.length<=lim){sp.forEach(function(s){s.sel=true;});}
    else if(sp.filter(function(s){return s.sel;}).length<need){if(ok){document.getElementById("sp-warn").textContent="Choose "+need+" "+(tier==="cantrips"?"cantrips":"level "+tier+" spells")+".";ok=false;}}
  });
  if(!ok)return;
  if(!c.spells)c.spells=[];
  tiers.forEach(function(tier){
    var lvl=tier==="cantrips"?0:parseInt(tier);
    pendingSpellPool[tier].forEach(function(s){if(s.sel)c.spells.push({nm:s.nm,lvl:lvl,used:false});});
  });
  var wrap=document.getElementById("creation-spells");if(wrap)wrap.remove();
  // 4th arg matters: a 3-arg call drops the Step-1 prose author and the campaign silently
  // inherits the device default — audit #1. Same fix in the stat-bump and no-tiers paths.
  c._startLoc=pendingLoc;startGame(c,pendingTone,pendingVoice,pendingAuthor);
}
function showCreationStatBump(){
  var c=pendingChar;if(!c)return;var ex=document.getElementById("creation-bump");if(ex)ex.remove();
  var wrap=document.createElement("div");wrap.id="creation-bump";wrap.style.cssText="max-width:500px;margin:40px auto;padding:24px 20px;";
  var rh="",i;for(i=0;i<STATS.length;i++){var s=STATS[i];rh+="<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'><span style='width:36px;font-weight:bold;color:var(--t1);'>"+s+"</span><span style='width:32px;font-size:16px;font-weight:bold;' id='cb-cur-"+s+"'>"+c.stats[s]+"</span><button onclick=\"cbPick('"+s+"',1,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+1</button><button onclick=\"cbPick('"+s+"',2,this)\" style='padding:5px 14px;border:1px solid #444;border-radius:4px;background:#222;color:var(--t0);cursor:pointer;font-family:var(--font);'>+2</button></div>";}
  wrap.innerHTML="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--acc);margin-bottom:6px;'>Stat improvement "+currentBump+" of "+pendingBumps+"</div><h2 style='font-size:20px;color:var(--acc);margin-bottom:4px;'>Improve your stats</h2><p style='font-size:13px;color:var(--t2);margin-bottom:18px;'>+2 to one stat or +1 to two. Max 20.</p>"+rh+"<p id='cb-warn' style='font-size:12px;color:#c04040;min-height:16px;'></p><div style='display:flex;gap:10px;'><button onclick='cbBack()' style='padding:10px 18px;font-family:var(--font);border:1px solid var(--brd);border-radius:var(--r);background:var(--bg1);color:var(--t0);cursor:pointer;'>Back</button><button onclick='cbConfirm()' style='flex:1;padding:12px;font-size:14px;font-family:var(--font);background:var(--acc);color:#000;border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Confirm</button></div>";
  document.body.appendChild(wrap);window._cbPicks=[];
}
function cbPick(s,v,btn){
  var c=pendingChar,picks=window._cbPicks||[],pi;
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s&&picks[pi].v===v){picks.splice(pi,1);window._cbPicks=picks;btn.style.borderColor="#444";btn.style.color="var(--t0)";document.getElementById("cb-cur-"+s).textContent=c.stats[s];document.getElementById("cb-cur-"+s).style.color="var(--t0)";document.getElementById("cb-warn").textContent="";return;}}
  if(c.stats[s]+v>20){document.getElementById("cb-warn").textContent=s+" at max.";return;}
  var total=0;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total+v>2){document.getElementById("cb-warn").textContent="Max +2 total.";return;}
  if(v===2&&picks.length>0){document.getElementById("cb-warn").textContent="+2 = one stat only.";return;}
  if(v===1){for(pi=0;pi<picks.length;pi++){if(picks[pi].v===2){document.getElementById("cb-warn").textContent="Can't mix +2 and +1.";return;}}}
  for(pi=0;pi<picks.length;pi++){if(picks[pi].s===s){document.getElementById("cb-warn").textContent=s+" already picked.";return;}}
  picks.push({s:s,v:v});window._cbPicks=picks;document.getElementById("cb-warn").textContent="";btn.style.borderColor="var(--acc)";btn.style.color="var(--acc)";document.getElementById("cb-cur-"+s).textContent=c.stats[s]+v;document.getElementById("cb-cur-"+s).style.color="var(--acc)";
}
// ── AI character assist ───────────────────────────────────────────────────
function _csContext(){
  var ctx="";
  var tone=cs.tone?TONES.filter(function(t){return t.id===cs.tone;})[0]:null;
  if(tone)ctx+="World tone: "+tone.nm+(tone.vc?" — "+tone.vc:"")+"\n";
  var anc=cs.ancestry?ANCS.filter(function(a){return a.id===cs.ancestry;})[0]:null;
  if(anc)ctx+="Ancestry: "+(getSubNm()||anc.nm)+"\n";/* cs.subraceNm is never set — use getSubNm() so subrace/lineage reaches the AI-assist context (audit E58) */
  var cls=cs.cls?CLSS.filter(function(c){return c.id===cs.cls;})[0]:null;
  if(cls)ctx+="Class: "+cls.id+"\n";
  if(cs.name)ctx+="Name: "+cs.name+"\n";
  if(cs.gender)ctx+="Gender: "+(cs.gender==="F"?"Female":cs.gender==="NB"?"Non-binary":"Male")+"\n";
  if(cs.age)ctx+="Age: "+cs.age+"\n";
  return ctx;
}
async function aiSuggestField(fieldId,fieldLabel,btn){
  if(btn){btn.classList.add("spinning");btn.disabled=true;}
  var ctx=_csContext();
  var el=document.getElementById(fieldId);
  var current=el?el.value.trim():"";
  var prompt="Generate a "+(fieldLabel)+" for a dark fantasy sword & sorcery RPG character."
    +(ctx?"\n\nCharacter so far:\n"+ctx:"")
    +(current?"\n\nCurrent value (improve or replace): "+current:"")
    +"\n\nOutput ONLY the "+fieldLabel+" itself — no labels, no explanation, no quotes. 1-2 sentences max.";
  try{
    var result=await callGM(prompt,"You are a dark fantasy character creation assistant. Output ONLY the requested content, nothing else.",300);
    if(el)el.value=result.trim();
  }catch(e){if(typeof showToast==="function")showToast("Suggest failed: "+(e&&e.message?e.message:"unknown error"));}/* was a silent empty catch (audit E37) */
  if(btn){btn.classList.remove("spinning");btn.disabled=false;}
}
async function aiRandomiseAll(btn){
  if(btn){btn.classList.add("spinning");btn.disabled=true;btn.textContent="✦ …";}
  var ctx=_csContext();
  var prompt="Generate a complete dark fantasy RPG character identity. Return ONLY valid JSON, no markdown:\n"
    +'{"name":"string","appear":"1-2 sentence physical description","backstory":"1-2 sentences of history"}'
    +"\n\nContext:\n"+ctx;
  try{
    var raw=await callGM(prompt,"You are a dark fantasy character creation assistant. Output ONLY a single valid JSON object, no markdown, no commentary.",600);
    var c=JSON.parse(repairModelJson(raw));
    if(c.name&&document.getElementById("char-name"))document.getElementById("char-name").value=c.name;
    if(c.appear&&document.getElementById("char-appear"))document.getElementById("char-appear").value=c.appear;
    if(c.backstory&&document.getElementById("char-backstory"))document.getElementById("char-backstory").value=c.backstory;
    cs.name=c.name||cs.name;cs.appear=c.appear||cs.appear;cs.backstory=c.backstory||cs.backstory;
    buildReview();
    showToast("Character generated — review and adjust below.");
  }catch(e){showToast("Generate failed: "+e.message);}
  if(btn){btn.classList.remove("spinning");btn.disabled=false;btn.textContent="✦ Randomise";}
}
// Inject sparkle buttons next to field labels in step 2
function injectSparkleButtons(){
  var fields=[
    {id:"char-name",      label:"character name"},
    {id:"char-appear",    label:"physical appearance"},
    {id:"char-backstory", label:"backstory"}
  ];
  fields.forEach(function(f){
    var el=document.getElementById(f.id);if(!el)return;
    var lbl=el.parentNode.querySelector("label");if(!lbl||lbl.querySelector(".ai-spark"))return;
    var btn=document.createElement("button");
    btn.type="button";btn.className="ai-spark";btn.textContent="✦";btn.title="AI suggest";
    btn.addEventListener("click",function(){aiSuggestField(f.id,f.label,btn);});
    lbl.appendChild(btn);
  });
}
function cbBack(){
  var wrap=document.getElementById("creation-bump");if(wrap)wrap.remove();
  if(currentBump>1){
    // Revert the previously-confirmed bump so re-confirming it applies cleanly (E2 — was a silent double).
    var last=_cbApplied.pop(),c=pendingChar,pi;if(last&&c)for(pi=0;pi<last.length;pi++)c.stats[last[pi].s]-=last[pi].v;
    syncPerkHp();currentBump--;showCreationStatBump();
  }else{
    restorePerkBase();_cbApplied=[];showCreationArchetype(); // back past bump 1 → clean archetype re-pick
  }
}
function cbConfirm(){var picks=window._cbPicks||[];var total=0,pi;for(pi=0;pi<picks.length;pi++)total+=picks[pi].v;if(total!==2){document.getElementById("cb-warn").textContent="Must spend exactly +2.";return;}var c=pendingChar;for(pi=0;pi<picks.length;pi++)c.stats[picks[pi].s]+=picks[pi].v;_cbApplied.push(picks.slice());syncPerkHp();/* record for Back-revert (E2) + retroactive CON HP (E55) */var wrap=document.getElementById("creation-bump");if(wrap)wrap.remove();currentBump++;if(currentBump<=pendingBumps){showCreationStatBump();}else if(buildPendingSpellPool(c)){showCreationSpellPick();}else{c._startLoc=pendingLoc;startGame(c,pendingTone,pendingVoice,pendingAuthor);}}
