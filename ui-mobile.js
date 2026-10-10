// #611: a thin phone shell over the existing renderers and controls. No saved game writes.
var mobileUI={ready:false,width:0,selected:"party",desktopCol:false,phone:false};
function mobilePhone(){return window.matchMedia("(max-width:600px)").matches;}
function mobileEl(id){return document.getElementById(id);}
function mobileDrawerWidth(width){
  var max=Math.max(0,mobileEl("story-area").clientWidth-32-8-120);
  mobileUI.width=Math.max(0,Math.min(max,width));
  mobileEl("rpanel").style.setProperty("--mobile-drawer",mobileUI.width+"px");
  var g=mobileEl("mobile-grab");g.setAttribute("aria-valuenow",Math.round(mobileUI.width));g.setAttribute("aria-valuemax",max);
}
function mobileSelectPanel(key){
  mobileUI.selected=key;
  ["party","quest","inv","ab","sp"].forEach(function(k){mobileEl("pss-"+k).classList.toggle("mobile-selected",key===k);mobileEl("mobile-tab-"+k).setAttribute("aria-selected",key===k?"true":"false");});
}
function mobileLayout(){
  if(!mobileUI.ready)return;
  var phone=mobilePhone(),rp=mobileEl("rpanel"),tts=mobileEl("tts-btn");
  if(phone!==mobileUI.phone){
    if(phone){mobileUI.desktopCol=panelCol;mobileEl("mobile-panel-tabs").appendChild(tts);rp.classList.remove("col");}
    else{mobileEl("hud-btns").insertBefore(tts,mobileEl("hud-btns").lastElementChild);panelCol=mobileUI.desktopCol;rp.classList.toggle("col",panelCol);}
    mobileUI.phone=phone;
  }
  if(phone)mobileDrawerWidth(mobileUI.width);
  if(worldState&&worldState.combat)updateCombat();
}
function mobileRenderWays(w){
  if(!mobileUI.ready)return;
  var place=mobileEl("mobile-place"),sel=mobileEl("mobile-ways");
  place.textContent=w?w.here.world+(w.here.sub?" › "+w.here.sub:""):"";place.title=place.textContent;
  sel.innerHTML="";sel.appendChild(new Option("Connected locations ("+(w?w.ways.length:0)+")",""));
  (w?w.ways:[]).forEach(function(x,i){var o=new Option(x.label+(x.unexplored?" ?":""),String(i));o.title=x.note||x.action;sel.appendChild(o);});
  sel.disabled=!w||!w.ways.length;
  sel.onchange=function(){if(sel.value===""||!w)return;var x=w.ways[Number(sel.value)],inp=mobileEl("action-input");inp.value=x.action;inp.dispatchEvent(new Event("input"));sel.value="";focusStoryBox();};
}
function mobileRenderStatus(act,day){
  if(!mobileUI.ready)return;
  mobileEl("mobile-act").textContent=act?(act.done?"Act Complete":act.text):"Act —";
  mobileEl("mobile-act").title=act?act.text:"No active act recorded";
  mobileEl("mobile-clock").textContent=day.replace(/^\s*\|\s*/,"");mobileEl("mobile-version").textContent=APP_VERSION;
  mobileEl("hud-cls").title=mobileEl("hud-cls").textContent;
}
// Native File options are projected from buildFileMenus' ONE generated menu. Invoke its existing
// controls, including checkbox/file-input handlers, rather than maintaining a second action list.
function mobileRenderFile(){
  if(!mobileUI.ready)return;
  var sel=mobileEl("mobile-file"),menu=mobileEl("file-menu"),targets=[];sel.innerHTML="";sel.appendChild(new Option("File",""));
  function walk(host,prefix){Array.prototype.forEach.call(host.children,function(el){
    if(el.classList.contains("fm-dev-only")&&getComputedStyle(el).display==="none")return;
    if(el.classList.contains("fm-subwrap")){var title=el.firstElementChild.textContent.replace(/▶/g,"").trim();walk(el.lastElementChild,prefix+title+" / ");return;}
    var tag=el.tagName,input=tag==="LABEL"?el.querySelector("input"):null;
    if(tag==="BUTTON"||input||tag==="INPUT"){
      if(el.style.display==="none"&&!el.classList.contains("fm-mobile-only"))return;
      var target=input||el;if(tag==="INPUT"&&target.type==="checkbox")return;
      var label=input?el.textContent.trim():tag==="INPUT"?(el.parentNode.textContent.trim()):el.textContent.trim();
      var option=new Option(prefix+(target.type==="checkbox"?(target.checked?"✓ ":"○ "):"")+label,String(targets.length));
      option.disabled=!!target.disabled||el.style.pointerEvents==="none";targets.push(target);sel.appendChild(option);return;
    }
    if(tag!=="LABEL"&&el.id!=="fm-version"&&el.style.display!=="none")walk(el,prefix);
  });}
  walk(menu,"");
  sel.onchange=function(){if(sel.value==="")return;var target=targets[Number(sel.value)];sel.value="";closeAllMenus();
    if(target.type==="range"||target.type==="number"){
      var modal=modalShell("mobile-setting-modal","<label id='mobile-setting-label'></label><div style='margin:16px 0' id='mobile-setting-control'></div><button class='ib' id='mobile-setting-close'>Done</button>",{closeId:"mobile-setting-close",outside:true});
      modal.querySelector("#mobile-setting-label").textContent=target.parentNode.textContent.trim();var copy=target.cloneNode();copy.removeAttribute("id");copy.value=target.value;copy.addEventListener("input",function(){target.value=copy.value;target.dispatchEvent(new Event("input",{bubbles:true}));});copy.addEventListener("change",function(){target.value=copy.value;target.dispatchEvent(new Event("change",{bubbles:true}));});modal.querySelector("#mobile-setting-control").appendChild(copy);copy.focus();
    }else target.click();
    mobileRenderFile();
  };
}
function mobileInit(){
  if(mobileUI.ready)return;mobileUI.ready=true;
  var top=mobileEl("topbar"),place=document.createElement("div"),ways=document.createElement("select"),file=document.createElement("select"),status=document.createElement("span");
  place.id="mobile-place";place.className="mobile-only";ways.id="mobile-ways";ways.className="mobile-only mobile-select";ways.setAttribute("aria-label","Connected locations");top.appendChild(place);top.appendChild(ways);
  file.id="mobile-file";file.className="mobile-only mobile-select";file.setAttribute("aria-label","File");mobileEl("file-btn").parentNode.appendChild(file);
  file.addEventListener("pointerdown",mobileRenderFile);file.addEventListener("focus",mobileRenderFile);
  status.id="mobile-status";status.className="mobile-only";status.innerHTML="<span id='mobile-act'></span><span id='mobile-clock'></span><span id='mobile-version'></span>";mobileEl("membar").insertBefore(status,mobileEl("healthdot"));
  var grip=document.createElement("div");grip.id="mobile-grip";grip.className="mobile-only";
  grip.innerHTML="<button id='mobile-grab' type='button' role='separator' aria-label='Resize side panel' aria-orientation='vertical' aria-valuemin='0' aria-valuenow='0' title='Drag to resize side panel; arrow keys also resize'></button>";
  mobileEl("story-area").insertBefore(grip,mobileEl("rpanel"));
  var tabs=document.createElement("div");tabs.id="mobile-panel-tabs";tabs.className="mobile-only";tabs.setAttribute("role","tablist");tabs.setAttribute("aria-label","Side panel");
  [{key:"party",label:"Pty",name:"Party"},{key:"quest",label:"Qst",name:"Quests"},{key:"inv",label:"Inv",name:"Inventory"},{key:"ab",label:"Ab",name:"Abilities"},{key:"sp",label:"Sp",name:"Spells"}].forEach(function(x){var b=document.createElement("button");b.id="mobile-tab-"+x.key;b.textContent=x.label;b.title=x.name;b.setAttribute("aria-label",x.name);b.setAttribute("role","tab");b.setAttribute("aria-controls","pss-"+x.key);b.addEventListener("click",function(){mobileSelectPanel(x.key);if(!mobileUI.width)mobileDrawerWidth(164);});tabs.appendChild(b);});mobileEl("rpanel").appendChild(tabs);
  var grab=mobileEl("mobile-grab"),drag=null;
  grab.addEventListener("pointerdown",function(e){if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,width:mobileUI.width};grab.setPointerCapture(e.pointerId);e.preventDefault();});
  grab.addEventListener("pointermove",function(e){if(drag&&drag.id===e.pointerId)mobileDrawerWidth(drag.width+drag.x-e.clientX);});
  grab.addEventListener("pointerup",function(e){if(!drag||drag.id!==e.pointerId)return;mobileDrawerWidth(drag.width+drag.x-e.clientX);drag=null;grab.releasePointerCapture(e.pointerId);});
  grab.addEventListener("pointercancel",function(){drag=null;});grab.addEventListener("lostpointercapture",function(){drag=null;});
  grab.addEventListener("keydown",function(e){var delta={ArrowLeft:10,ArrowRight:-10};if(delta[e.key]){mobileDrawerWidth(mobileUI.width+delta[e.key]);e.preventDefault();}else if(e.key==="Home"){mobileDrawerWidth(0);e.preventDefault();}else if(e.key==="End"){mobileDrawerWidth(Infinity);e.preventDefault();}});
  mobileSelectPanel("party");mobileLayout();mobileRenderFile();window.addEventListener("resize",mobileLayout);
}
// Enemy cards read the live foe and exact-name bestiary entry. No fuzzy identity joins and no
// headcounts guessed from aggregate HP. Counts explicitly authored in a name stay intact.
function wireEnemyDetails(ordered){
  var rows=mobileEl("en-rows");if(!rows)return;
  Array.prototype.forEach.call(rows.querySelectorAll(".cname.en"),function(el,i){var foe=ordered[i];el.setAttribute("role","button");el.tabIndex=0;el.setAttribute("aria-label","Details for "+foe.name);el.onclick=function(){showEnemyDetails(foe);};el.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();showEnemyDetails(foe);}};});
}
function showEnemyDetails(foe){
  var h="<h2 style='font-size:18px;color:var(--acc)'>"+escHtml(foe.name)+"</h2><dl class='enemy-facts'>";
  function row(label,v){if(v!==undefined&&v!==null&&v!=="")h+="<dt>"+escHtml(label)+"</dt><dd>"+escHtml(Array.isArray(v)?v.join(", "):String(v))+"</dd>";}
  row("HP",foe.hp+" / "+foe.maxHp);
  [{key:"ac",label:"Armor class"},{key:"atk",label:"Attack"},{key:"dmg",label:"Damage"},{key:"morale",label:"Morale"},{key:"down",label:"State"},{key:"immune",label:"Immune"},{key:"resist",label:"Resistant"},{key:"vuln",label:"Vulnerable"}].forEach(function(x){row(x.label,foe[x.key]);});
  if(foe.stats)Object.keys(foe.stats).forEach(function(k){row(k,foe.stats[k]);});
  var record=null;(worldState.bestiary||[]).some(function(b){if(String(b.name).toLowerCase()===String(foe.name).toLowerCase()){record=b;return true;}return false;});
  if(record)[{key:"kind",label:"Type"},{key:"threat",label:"Threat"},{key:"desc",label:"Description"},{key:"notes",label:"Creature notes"}].forEach(function(x){row(x.label,record[x.key]);});
  if(/\b(pack|gang|swarm|mob|horde)\b/i.test(foe.name)&&!/[\(\[]\s*\d+\s*[\)\]]/.test(foe.name))row("Group size","Not recorded");
  h+="</dl><button class='ib' id='enemy-close'>Close</button>";modalShell("enemy-modal",h,{closeId:"enemy-close",outside:true,maxWidth:420});
}
