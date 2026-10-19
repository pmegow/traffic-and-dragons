// dev/tests-faq.js — the player FAQ page (#642, owner 2026-10-16): faq.html renders TABLE_TALK_FAQ (data.js) — the SAME
// authored answers the Table Talk help desk speaks from — once each and escaped, says so loudly when the list is missing,
// links the long-form guide and Bible Study, defines no palette tokens of its own, is network-first in sw.js, and has its
// two doors: Home ▸ Reference and File ▸ Player FAQ (the generated menu spec in ui-boot.js, opened in a new tab).
//   node dev/tests-faq.js
var fs=require("fs"),path=require("path"),vm=require("vm");
var root=path.join(__dirname,".."),passed=0,failed=[];
function read(f){return fs.readFileSync(path.join(root,f),"utf8");}
function t(name,fn){try{var r=fn();if(r===true)passed++;else failed.push(name+" — "+r);}catch(e){failed.push(name+" — THREW "+(e&&e.message));}}
/* load the page's inline scripts into a sandbox: a stub document whose faq-out captures innerHTML, document.write a no-op
   (the cache-buster tag), data.js run first when `withData` */
function page(withData,dataOverride){
  var nodes={},writes=[],errors=[];
  function Node(id){this.id=id;this.html=null;}
  Object.defineProperty(Node.prototype,"innerHTML",{get:function(){return this.html;},set:function(s){this.html=String(s);}});
  var box={document:{getElementById:function(id){return nodes[id]||(nodes[id]=new Node(id));},write:function(s){writes.push(String(s));}},window:{},console:{error:function(s){errors.push(String(s));},warn:function(){},log:function(){}},Date:Date};
  vm.createContext(box);
  if(withData){vm.runInContext(read("data.js"),box);if(dataOverride!==undefined)vm.runInContext("TABLE_TALK_FAQ="+JSON.stringify(dataOverride)+";",box);}
  var html=read("faq.html"),re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g,m;
  while((m=re.exec(html)))if(m[1].trim())vm.runInContext(m[1],box);
  return {seam:box.window.__faqTest,out:nodes["faq-out"]?nodes["faq-out"].html:null,writes:writes,errors:errors,faq:box.TABLE_TALK_FAQ};
}
t("faq.html renders every TABLE_TALK_FAQ entry exactly once, question and answer, from data.js (one source — the help desk's own answers)",function(){
  var p=page(true);if(!p.seam)return "no window.__faqTest seam";
  if(!p.faq||!p.faq.length)return "data.js carries no TABLE_TALK_FAQ";
  if(p.seam.count!==p.faq.length||p.seam.source!=="TABLE_TALK_FAQ")return "seam count/source: "+JSON.stringify({count:p.seam.count,source:p.seam.source,n:p.faq.length});
  var i,q,a,n;for(i=0;i<p.faq.length;i++){q=p.seam.esc(p.faq[i].q);a=p.seam.esc(p.faq[i].a);n=p.out.split("<h3>"+q+"</h3>").length-1;if(n!==1)return "question "+(i+1)+" rendered "+n+" times: "+p.faq[i].q;if(p.out.indexOf("<p>"+a+"</p>")<0)return "answer "+(i+1)+" missing or altered";}
  if((p.out.match(/class='q'/g)||[]).length!==p.faq.length)return "card count differs from the list";
  if(p.errors.length)return "a loud line on a healthy load: "+p.errors[0];
  if(!p.writes.length||!/data\.js\?fresh=/.test(p.writes[0]))return "data.js is loaded with the per-open cache-buster";
  return true;
});
t("every string is escaped before it reaches innerHTML — a '<' in a question or answer never opens a tag",function(){
  var p=page(true,[{q:"Is <b>this</b> bold?",a:"No & never — \"quotes\" stay text"}]);
  if(p.out.indexOf("<b>")>=0||p.out.indexOf("&lt;b&gt;this&lt;/b&gt;")<0)return "the question's tag reached the DOM: "+p.out;
  if(p.out.indexOf("No &amp; never")<0||p.out.indexOf("&quot;quotes&quot;")<0)return "the answer's & or quotes were not escaped: "+p.out;
  var h=p.seam.render([{q:"<script>",a:"</p>"}]);if(h.indexOf("<script>")>=0||h.indexOf("</p></p>")>=0)return "the seam's renderer escapes too";
  return true;
});
t("a missing or empty list is said, never silently blank",function(){
  var p=page(true,[]);
  if(!/could not be loaded|ask the Table Talk tab/.test(p.out||""))return "the page shows a loud fallback: "+p.out;
  if(!p.errors.length||!/TABLE_TALK_FAQ/.test(p.errors[0]))return "the console names the missing list";
  var q=page(false);if(!/could not be loaded/.test(q.out||"")||q.seam.count!==0)return "without data.js at all: the same fallback, count 0";
  return true;
});
t("the page is a satellite: satellite.css linked, no palette tokens of its own, read-only, network-first in sw.js, links the long-form guide and Bible Study",function(){
  var h=read("faq.html");
  if(h.indexOf('<link rel="stylesheet" href="satellite.css">')<0)return "satellite.css is the palette";
  if(/:root\s*\{/.test(h)||/--acc\s*:/.test(h))return "the page defines palette tokens of its own (#312 forbids a fork)";
  if(/localStorage\.setItem|saveAll\(|saveCore\(|store\.set\(/.test(h))return "the page writes — it is a read surface";
  if(h.indexOf('href="DOC/beta-guide.html"')<0||!fs.existsSync(path.join(root,"DOC/beta-guide.html")))return "the long-form guide is linked and exists";
  if(h.indexOf('href="bible_study.html"')<0)return "Bible Study is linked";
  var sw=read("sw.js"),m=/if\(\/(.*?)\/\.test\(e\.request\.url\)\)\{/.exec(sw);if(!m)return "sw.js network-first regex not found";
  if(m[1].indexOf("faq\\.html(?:$|[?#])")<0)return "sw.js's network-first regex lacks faq.html — the SW would pin it stale";
  return true;
});
t("two doors open the GUIDE (owner 2026-10-18: it is the default): Home's Reference card links DOC/beta-guide.html and the File menu spec carries a Beta guide row that opens it in a new tab; the guide links the FAQ and the FAQ links the guide",function(){
  var home=read("home.html"),ub=read("ui-boot.js"),g=read("DOC/beta-guide.html");
  var card=home.slice(home.indexOf("<h3>Reference</h3>"),home.indexOf("<h3>Mementos</h3>"));if(card.indexOf('href="DOC/beta-guide.html"')<0)return "the Reference card links the guide";
  if(ub.indexOf('btn(p+"guide","&#10067; Beta guide",0)')<0)return "the generated menu spec has the Beta guide row (never index.html)";
  if(ub.indexOf('["guide",function(){closeAllMenus();window.open("DOC/beta-guide.html","_blank","noopener");}]')<0)return "the row opens the guide in a new tab, closing the menu first";
  if(/btn\(p\+"faq"|"faq",function/.test(ub))return "the old Player FAQ row is gone (one door per page)";
  if((g.match(/href="\.\.\/faq\.html"/g)||[]).length<2)return "the guide links the FAQ (subtitle and TOC)";
  if(read("faq.html").indexOf('href="DOC/beta-guide.html"')<0)return "the FAQ links the guide";
  return true;
});
/* owner 2026-10-18: the guide's table of contents is live, Optional accounts is gone, and every numbered callout explains itself */
t("the guide's TOC links every section (each href has its h2 id, nine steps numbered in order) and the Optional accounts section is gone",function(){
  var g=read("DOC/beta-guide.html"),toc=g.slice(g.indexOf('<div class="toc">'),g.indexOf("</div>",g.indexOf('<div class="toc">')));
  var hrefs=(toc.match(/<li><a href="#([a-z-]+)">/g)||[]).map(function(x){return x.slice(14,-2);});
  if(hrefs.length!==9)return "nine linked TOC entries, got "+hrefs.length;
  for(var i=0;i<hrefs.length;i++)if(g.indexOf('<h2 id="'+hrefs[i]+'"><span class="stepnum">'+(i+1)+'</span>')<0)return "TOC entry "+(i+1)+" (#"+hrefs[i]+") has no matching numbered h2";
  if((toc.match(/<li>/g)||[]).length!==hrefs.length)return "a TOC entry is not a link";
  if(/Optional accounts/.test(g))return "Optional accounts survives";
  var nums=(g.match(/<span class="stepnum">(\d+)<\/span>/g)||[]).map(function(x){return +x.replace(/\D/g,"");});
  if(nums.join(",")!=="1,2,3,4,5,6,7,8,9")return "step numbers run 1..9: "+nums.join(",");
  if(g.indexOf("link in step 3")<0)return "the sign-in step points at the renumbered Open the game step";
  return true;
});
t("the tour's callouts carry a hint: every callout is a button with a TIPS entry, a hover tooltip for mouse users (hover:hover), a press-and-hold modal for touch (pointer:coarse, HOLD_MS) and a target section to jump to",function(){
  var g=read("DOC/beta-guide.html"),calls=g.match(/<button type="button" class="callout[^"]*" data-n="(\d)"/g)||[];
  if(calls.length<8)return "eight numbered callout buttons, got "+calls.length;
  var script=g.slice(g.indexOf("var TIPS={"),g.indexOf("};",g.indexOf("var TIPS={"))),keys=(script.match(/^\s*(\d):\[/gm)||[]).map(function(x){return x.replace(/\D/g,"");});
  for(var i=0;i<calls.length;i++){var nn=/data-n="(\d)"/.exec(calls[i])[1];if(keys.indexOf(nn)<0)return "callout "+nn+" has no TIPS entry";if(g.indexOf('<h3 id="ui-'+nn+'">')<0)return "callout "+nn+" has no section id ui-"+nn+" to jump to";}
  if(/<span class="callout"/.test(g))return "a callout is still a bare span (no hint, not focusable)";
  for(i=0;i<calls.length;i++)if(!/class="callout(?: [a-z-]+)* pt-[rld](?: [a-z-]+)*"/.test(calls[i]))return "a callout has no beak direction (pt-r / pt-l / pt-d): "+calls[i];
  if(g.indexOf(".callout::before{content:\"\";")<0||g.indexOf(".callout.pt-d::before{top:100%")<0)return "the beak CSS is gone";
  var six=/<button type="button" class="callout flip pt-d" data-n="6" style="left:[0-9.]+%;top:([0-9.]+)%;">/.exec(g);if(!six||parseFloat(six[1])>=49)return "the story figure's ⑥ sits ABOVE the handle (top < 49%) with its beak pointing down (owner 2026-10-18: it hid the handle)";
  if(g.indexOf(".callout::after{content:attr(data-tip)")<0||g.indexOf("@media (hover:hover){.callout:hover::after")<0)return "the hover tooltip CSS is gone";
  if(g.indexOf('matchMedia("(pointer:coarse)")')<0||g.indexOf('el.addEventListener("pointerdown",function(e){if(!coarse)return;')<0||g.indexOf("hold.fired=true;openModal(n)")<0||!/},HOLD_MS\)/.test(g))return "the press-and-hold modal path is gone (the pointerdown handler that arms HOLD_MS and opens the modal)";
  if(g.indexOf('el.setAttribute("data-tip",tip[0]')<0)return "the hint text is written onto the callout for the tooltip";
  return true;
});
t("a way back on both pages (owner 2026-10-18): the shared satellite header carries Home and Game links — the guide from DOC/ with ../, the FAQ from the root",function(){
  var g=read("DOC/beta-guide.html"),f=read("faq.html");
  /* owner 2026-10-18 (second ruling): the links FLOAT on their own — a sticky nav pill right after the header card, never the whole header */
  function nav(h){var a=h.indexOf('<nav class="sat-nav"');if(a<0)return "";return h.slice(h.indexOf(">",a)+1,h.indexOf("</nav>",a));}
  var gn=nav(g),fn=nav(f);
  if(!gn||gn.indexOf('href="../home.html"')<0||gn.indexOf('href="../index.html"')<0||gn.indexOf('href="../faq.html"')<0)return "the guide's header nav links Home, Game and the FAQ (from DOC/, so ../)";
  if(!fn||fn.indexOf('href="home.html"')<0||fn.indexOf('href="index.html"')<0||fn.indexOf('href="DOC/beta-guide.html"')<0)return "the FAQ's header nav links Home, Game and the guide";
  if(g.indexOf("<h1>")<0||g.indexOf("<h1>")>g.indexOf('<header class="sat-header">')+40)return "the guide's title lives in the header";
  if(g.indexOf(".sat-nav{position:sticky;")<0||f.indexOf(".sat-nav{position:sticky;")<0)return "the nav pill is the sticky element";
  function headerSticks(h){var i=h.indexOf(".sat-header{");return i>=0&&h.slice(i,h.indexOf("}",i)).indexOf("position:sticky")>=0;}
  if(headerSticks(g)||headerSticks(f))return "the whole header must not stick (owner 2026-10-18)";
  return true;
});
t("the staged world and the guide name no licensed setting (the Runelords names were the owner's catch)",function(){
  var bad=/Sandpoint|Runelords|Skinsaw|Swallowtail|Shalelu|Rusty Dragon|Golarion|Pathfinder|Varisia|Thistletop/i,f=["DOC/beta-guide.html","dev/shoot-beta-guide.js"],i,m;
  for(i=0;i<f.length;i++){m=bad.exec(read(f[i]));if(m)return f[i]+" names "+m[0];}
  return true;
});
/* #642 follow-up (owner 2026-10-17): the FAQ and the beta guide paint in the GAME's colour scheme — game-theme.js reads the
   game's own key (dark unless the player chose light; follows the storage event from the game's tab), never the device. */
function themeScript(stored){
  var attrs={},listeners={};
  var box={document:{documentElement:{setAttribute:function(k,v){attrs[k]=v;}}},localStorage:{getItem:function(k){return k==="tnd_theme_v1"?stored:null;}},window:{addEventListener:function(ev,fn){listeners[ev]=fn;}}};
  vm.createContext(box);vm.runInContext(read("game-theme.js"),box);
  return {attrs:attrs,fire:function(key,next){stored=next;if(!listeners.storage)return false;listeners.storage({key:key});return true;}};
}
t("faq.html paints in the game's own colour scheme: game-theme.js in the head (never the device-following system-theme.js); dark when nothing is stored, light when the game stored light, and it follows a storage event from the game's tab",function(){
  var h=read("faq.html"),head=h.slice(0,h.indexOf("</head>"));
  if(head.indexOf('<script src="game-theme.js"></script>')<0||head.indexOf("system-theme.js")>=0)return "the head loads game-theme.js and not system-theme.js";
  if(head.indexOf('<script src="game-theme.js"></script>')>head.indexOf('href="satellite.css"'))return "the theme is applied before the stylesheet (no flash of the other scheme)";
  var a=themeScript(null);if(a.attrs["data-theme"]!=="dark")return "nothing stored → dark (the game's default), got "+a.attrs["data-theme"];
  var b=themeScript("light");if(b.attrs["data-theme"]!=="light")return "stored light → light, got "+b.attrs["data-theme"];
  var c=themeScript("dark");if(c.attrs["data-theme"]!=="dark")return "stored dark → dark";
  if(!a.fire("tnd_theme_v1","light")||a.attrs["data-theme"]!=="light")return "a storage event for the game's key re-applies the scheme (got "+a.attrs["data-theme"]+")";
  a.fire("tnd_ak_v1","x");if(a.attrs["data-theme"]!=="light")return "an unrelated key's event changes nothing";
  a.fire(null,null);if(a.attrs["data-theme"]!=="dark")return "a clear() (key null) re-reads → dark";
  return true;
});
t("the beta guide is on the satellite palette and the game's scheme: ../satellite.css linked, ../game-theme.js in the head, no palette tokens or hex colours of its own, both screenshots on disk",function(){
  var g=read("DOC/beta-guide.html"),head=g.slice(0,g.indexOf("</head>"));
  if(head.indexOf('<link rel="stylesheet" href="../satellite.css">')<0)return "the guide links ../satellite.css";
  if(head.indexOf('<script src="../game-theme.js"></script>')<0||head.indexOf("system-theme.js")>=0)return "the guide loads ../game-theme.js in its head";
  if(/:root\s*\{/.test(g)||/--acc\s*:/.test(g))return "the guide defines palette tokens of its own (#312 forbids a fork)";
  var styled=(g.match(/<style>[\s\S]*?<\/style>/g)||[]).concat(g.match(/style="[^"]*"/g)||[]).join("\n").replace(/\/\*[\s\S]*?\*\//g,"");/* comments may cite a #row */
  var hex=styled.match(/#[0-9a-fA-F]{3,8}\b/g);if(hex)return "a hex colour survives the restyle: "+hex.slice(0,4).join(", ");
  var imgs=g.match(/src="([^"]+\.png)"/g)||[];if(imgs.length<2)return "the tour shows two screenshots";
  for(var i=0;i<imgs.length;i++){var f=imgs[i].slice(5,-1);if(!fs.existsSync(path.join(root,"DOC",f)))return "screenshot missing on disk: DOC/"+f;}
  return true;
});
t("the Rest answer says the same thing everywhere: data.js, faq.html and the beta guide all say restores party health and mana to full",function(){
  var want="restores party health and mana to full",files=["data.js","faq.html","DOC/beta-guide.html"],i;
  for(i=0;i<files.length;i++)if(read(files[i]).indexOf(want)<0)return files[i]+" lost the owner's wording ("+want+")";
  var all=read("data.js")+read("faq.html")+read("DOC/beta-guide.html");
  if(/heals the party to full|recovers spent spells|restores spells/.test(all))return "the old wording survives somewhere";
  if(/Rest button|Sheet button|Re-roll/.test(all))return "a control that no longer exists is named (the sheet opens from your name in Party; rest happens in the story; Re-roll left at #634)";
  return true;
});
if(failed.length){console.error("FAQ PAGE TESTS FAILED ("+failed.length+" of "+(passed+failed.length)+"):");failed.forEach(function(f){console.error("  ✗ "+f);});process.exit(1);}
console.log("ALL GREEN — "+passed+" assertions (#642 player FAQ page)");
