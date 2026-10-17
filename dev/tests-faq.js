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
t("two doors: Home's Reference card links the FAQ, and the File menu spec carries a Player FAQ row that opens faq.html in a new tab",function(){
  var home=read("home.html"),ub=read("ui-boot.js");
  if(home.indexOf('href="faq.html"')<0)return "home.html links faq.html";
  var card=home.slice(home.indexOf("<h3>Reference</h3>"),home.indexOf("<h3>Mementos</h3>"));if(card.indexOf('href="faq.html"')<0)return "the link sits in the Reference card";
  if(ub.indexOf('btn(p+"faq","&#10067; Player FAQ",0)')<0)return "the generated menu spec has the Player FAQ row (never index.html)";
  if(ub.indexOf('["faq",function(){closeAllMenus();window.open("faq.html","_blank","noopener");}]')<0)return "the row opens faq.html in a new tab, closing the menu first";
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
