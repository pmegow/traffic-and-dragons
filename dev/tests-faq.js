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
if(failed.length){console.error("FAQ PAGE TESTS FAILED ("+failed.length+" of "+(passed+failed.length)+"):");failed.forEach(function(f){console.error("  ✗ "+f);});process.exit(1);}
console.log("ALL GREEN — "+passed+" assertions (#642 player FAQ page)");
