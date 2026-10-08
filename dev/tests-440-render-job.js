// tests-440-render-job.js — #440 (Astra review R3): a delayed scene render must never land in the campaign loaded
// afterward. Drives the REAL doRender with a held prompt writer and a held image service, switching the campaign
// in between (the review's reproduction), through DOM stubs.
//   • prompt boundary: the writer answers after a switch → nothing added to the new story, a loud drop
//   • control: no switch → the render-out block lands with the prompt
//   • image boundary: the image arrives after a switch → the block is removed, no <img>, a loud drop
//   • the Save pointer stamps the turn the render STARTED on, not the turn Save is clicked on
//   node dev/tests-440-render-job.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();

function stubEl() {
  var e = { style: {}, children: [], listeners: {}, textContent: "", innerHTML: "", disabled: false, isConnected: true, parentNode: null, removed: false,
    appendChild: function (c) { e.children.push(c); c.parentNode = e; return c; }, remove: function () { e.removed = true; },
    addEventListener: function (k, f) { (e.listeners[k] = e.listeners[k] || []).push(f); }, querySelector: function () { return null; },
    setAttribute: function () {}, insertBefore: function () {} };
  return e;
}
global.window = global;
global.document = { createElement: function () { return stubEl(); }, getElementById: function () { return null; }, querySelector: function () { return null; }, body: { appendChild: function () {} } };
var msgs = [], toasts = [], warns = [];
addMsg = function (kind) { var e = stubEl(); e.kind = kind; msgs.push(e); return e; };
showToast = function (m) { toasts.push(String(m)); };
console.warn = function (m) { warns.push(String(m)); };
saveAll = function () {}; buildFilename = function () { return "render.png"; };
if (typeof escHtml !== "function") escHtml = function (s) { return String(s); };
renderAllowanceExhausted = function () { return null; };
function fresh(id, name) { var w = loader.makeTestWorld(); worldState = w; worldState.campId = id; worldState.campName = name; worldState.turn = 10; msgs.length = 0; toasts.length = 0; warns.length = 0; return w; }
function renderOut() { return msgs.filter(function (m) { return m.kind === "render-out"; }); }
function tick(n) { return new Promise(function (r) { setTimeout(r, n || 20); }); }
function findBtn(div, label) { var out = null; (function walk(e) { (e.children || []).forEach(function (c) { if (c.textContent === label) out = c; walk(c); }); })(div); return out; }

var pass = 0, fails = [], chain = Promise.resolve();
function t(name, fn) { chain = chain.then(function () { return Promise.resolve().then(fn).then(function (why) { if (!why) { pass++; console.log("PASS " + name); } else { fails.push(name + " — " + why); console.error("FAIL " + name + " — " + why); } }, function (e) { fails.push(name + " — threw: " + (e && e.message)); console.error("FAIL " + name + " — threw: " + (e && e.stack || e)); }); }); }

t("prompt boundary: the writer answers after a campaign switch → nothing lands in the new story, a loud drop, the latch clears", function () {
  fresh("camp_A", "Alpha"); var held; callGM = function () { return new Promise(function (r) { held = r; }); }; falAvailable = function () { return false; };
  var p = doRender();
  return tick().then(function () {
    if (!held) return "the writer was not called";
    fresh("camp_B", "Beta");/* the review's campLoad — a different campaign is live now */
    held("A moonlit vault, Ammut at the door.");
    return p;
  }).then(function () {
    if (renderOut().length) return "the old campaign's render-out block landed in the new story";
    if (!warns.some(function (w) { return /#440/.test(w) && /Alpha/.test(w) && /scene prompt/.test(w); })) return "no loud drop: " + JSON.stringify(warns);
    if (!toasts.some(function (x) { return /discarded/.test(x); })) return "no toast: " + JSON.stringify(toasts);
    if (_rendering) return "the render latch stayed up";
    return null;
  });
});
t("control: no switch → the render-out block lands with the prompt text", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return false; };
  return doRender().then(function () {
    var ro = renderOut(); if (ro.length !== 1) return "expected one render-out block, got " + ro.length;
    if (!ro[0].children.some(function (c) { return c.textContent === "A moonlit vault."; })) return "the prompt panel is missing";
    if (warns.some(function (w) { return /#440/.test(w); })) return "a live render was dropped";
    return null;
  });
});
t("image boundary: the image arrives after a campaign switch → the block is removed, no <img>, a loud drop", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return true; };
  var mdl = RENDER_MODELS.filter(function (m) { return !m.slow; })[0]; if (!mdl) return "fixture: no non-queued render model"; renderModel = mdl.id;
  var heldFal; falFetch = function () { return new Promise(function (r) { heldFal = r; }); };
  var p = doRender();
  return tick(40).then(function () {
    if (!heldFal) return "the image service was not called";
    var div = renderOut()[0]; if (!div) return "the render-out block was not created before the image call";
    fresh("camp_B", "Beta");
    heldFal({ ok: true, json: function () { return Promise.resolve({ images: [{ url: "https://img.test/scene.png" }] }); } });
    return p.then(function () { return div; });
  }).then(function (div) {
    if (!div.removed) return "the stale block was not removed from the story";
    if (div.children.some(function (c) { return c.alt === "Scene illustration"; })) return "an <img> was appended to a stale render";
    if (!warns.some(function (w) { return /#440/.test(w) && /the image/.test(w); })) return "no loud drop: " + JSON.stringify(warns);
    if (_rendering) return "the render latch stayed up";
    return null;
  });
});
t("the Save pointer stamps the turn the render STARTED on (turn 10), not the turn Save is clicked on (turn 11); a stale job refuses to save", function () {
  fresh("camp_A", "Alpha"); callGM = function () { return Promise.resolve("A moonlit vault."); }; falAvailable = function () { return true; };
  var mdl = RENDER_MODELS.filter(function (m) { return !m.slow; })[0]; renderModel = mdl.id;
  falFetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ images: [{ url: "https://img.test/scene.png" }] }); } }); };
  var captured = null; saveRenderImage = function (blob, fname, turn) { captured = turn; return Promise.resolve(true); };
  global.fetch = function () { return Promise.resolve({ blob: function () { return Promise.resolve("BLOB"); } }); };
  return doRender().then(function () {
    var div = renderOut()[0]; if (!div) return "no render-out block";
    var save = findBtn(div, "↓ Save"); if (!save || !save.listeners.click) return "no Save button with a click handler";
    worldState.turn = 11;/* the player played on before saving */
    save.listeners.click[0]();
    return tick(30);
  }).then(function () {
    if (captured !== 10) return "the pointer stamped turn " + captured + " — it must be the render's own turn 10";
    var div = renderOut()[0], save = findBtn(div, "↓ Save"); captured = null; toasts.length = 0;
    fresh("camp_B", "Beta");/* the scene's campaign is gone */
    save.listeners.click[0]();
    return tick(30);
  }).then(function () {
    if (captured !== null) return "a stale render saved into the new campaign";
    if (!toasts.some(function (x) { return /no longer loaded/.test(x); })) return "a refused save must say why: " + JSON.stringify(toasts);
    return null;
  });
});
t("portrait action: a current scene applies, but a campaign switch refuses before fetching or writing", function () {
  fresh("camp_A","Alpha");callGM=function(){return Promise.resolve("A moonlit vault.");};falAvailable=function(){return true;};
  renderModel=RENDER_MODELS.filter(function(m){return !m.slow;})[0].id;
  falFetch=function(){return Promise.resolve({ok:true,json:function(){return Promise.resolve({images:[{url:"https://img.test/scene.png"}]});}});};
  var reads=0,writes=0,button;
  global.fetch=function(){reads++;return Promise.resolve({blob:function(){return Promise.resolve("BLOB");}});};
  global.FileReader=function(){this.readAsDataURL=function(){this.onload({target:{result:"data:image/png;base64,fixture"}});};};
  compressPortrait=function(data,done){done(data);};storageAdapter.markPortraitDirty=function(){writes++;};
  return doRender().then(function(){button=findBtn(renderOut()[0],"⧉ Portrait");if(!button)throw Error("fixture: Portrait button missing");button.listeners.click[0]();return tick();}).then(function(){
    if(reads!==1||writes!==1||worldState.character.portrait!=="data:image/png;base64,fixture")return "the live scene did not apply";
    fresh("camp_B","Beta");worldState.character.portrait="original portrait";button.listeners.click[0]();return tick().then(function(){
      if(reads!==1||writes!==1||worldState.character.portrait!=="original portrait")return "a stale Portrait action fetched or overwrote the new campaign's portrait";
      return toasts.some(function(x){return /portrait was not changed/.test(x);})?null:"the refusal was not visible";
    });
  });
});

// #527(21): the campaign owns the scene; one immutable cast supplies both writer and painter.
function roleRenderFixture(){
  fresh("camp_A","Alpha");worldState.kind="village";worldState.character.portrait="data:image/png;base64,HERO";
  var companion=JSON.parse(JSON.stringify(worldState.character));companion.name="Bram";companion.portrait="data:image/png;base64,BRAM";
  worldState.npcs=[{name:"Bram",partyMember:true,charSheet:companion}];
  renderModel=RENDER_MODELS.filter(function(m){return m.img2img&&m.img2img.partyRefs;})[0].id;
  falAvailable=function(){return true;};elapsedTicker=function(){return {stop:function(){},base:function(){return "";},set:function(){}};};
}
function changedHero(){var c=JSON.parse(JSON.stringify(worldState.character));c.name="Nyla";c.portrait="data:image/png;base64,NYLA";worldState.character=c;return c;}
function imageReply(){return {ok:true,json:function(){return Promise.resolve({images:[{url:"https://img.test/scene.png"}]});}};}
function demand(ok,why){if(!ok)throw Error(why);}
t("#527 same-campaign hero swap at prompt await keeps original detached hero and companion references",async function(){
  roleRenderFixture();var held,body,request,old=worldState.character,comp=worldState.npcs[0].charSheet;
  callGM=function(r){request=r;return new Promise(function(resolve){held=resolve;});};falFetch=function(e,b){body=b;return Promise.resolve(imageReply());};
  var pending=doRender();await tick();changedHero();old.portrait="mutated old hero";comp.portrait="mutated companion";comp.name="Other";
  held("Tess and Bram beside the mill.");await pending;
  demand(body,"hero swap discarded the image request");demand(request.indexOf("Tess")>=0&&request.indexOf("Bram")>=0,"writer lost original subjects");
  demand(JSON.stringify(body.image_urls)===JSON.stringify(["data:image/png;base64,HERO","data:image/png;base64,BRAM"]),"references mixed live or shallow subjects");
  demand(/Reference image 1 is Tess/.test(body.prompt)&&/Reference image 2 is Bram/.test(body.prompt),"legend lost original cast");
  demand(renderOut()[0].children.some(function(e){return e.alt==="Scene illustration";}),"same campaign image absent");demand(!_rendering,"render latch stuck");
});
t("#527 same-campaign hero swap at image await keeps the finished scene",async function(){
  roleRenderFixture();callGM=function(){return Promise.resolve("Tess beside Bram.");};var held;
  falFetch=function(){return new Promise(function(r){held=r;});};var pending=doRender();await tick();var div=renderOut()[0];changedHero();held(imageReply());await pending;
  demand(!div.removed&&div.children.some(function(e){return e.alt==="Scene illustration";}),"same campaign scene discarded after image await");demand(!_rendering,"render latch stuck");
});
t("#527 in-place subject changes at prompt await cannot alter detached portrait seeds",async function(){
  roleRenderFixture();var held,body;callGM=function(){return new Promise(function(r){held=r;});};falFetch=function(e,b){body=b;return Promise.resolve(imageReply());};
  var pending=doRender();await tick();worldState.character.portrait="changed hero";worldState.npcs[0].charSheet.portrait="changed party";held("Tess beside Bram.");await pending;
  demand(JSON.stringify(body.image_urls)===JSON.stringify(["data:image/png;base64,HERO","data:image/png;base64,BRAM"]),"mutable portrait references leaked into painter");
});
async function readyScene(){roleRenderFixture();callGM=function(){return Promise.resolve("Tess beside Bram.");};falFetch=function(){return Promise.resolve(imageReply());};await doRender();return renderOut()[0];}
t("#527 Portrait captures click target and refuses hero swap during compression",async function(){
  var div=await readyScene(),button=findBtn(div,"⧉ Portrait"),done,writes=0,old=worldState.character;
  fetch=function(){return Promise.resolve({blob:function(){return Promise.resolve("blob");}});};FileReader=function(){this.readAsDataURL=function(){this.onload({target:{result:"image"}});};};
  compressPortrait=function(d,fn){done=fn;};storageAdapter.markPortraitDirty=function(){writes++;};button.listeners.click[0]();await tick();var target=changedHero();done("compressed");
  demand(target.portrait==="data:image/png;base64,NYLA"&&old.portrait==="data:image/png;base64,HERO"&&writes===0,"compression wrote after target changed");
  demand(!button.disabled&&toasts.some(function(x){return /portrait.*not changed/i.test(x);}),"stale portrait must restore button and explain refusal");
  // A deliberate click after the swap belongs to the actor chosen at that click.
  button.listeners.click[0]();await tick();done("chosen portrait");demand(target.portrait==="chosen portrait"&&writes===1,"explicit new actor portrait choice failed");
});
t("#527 Portrait refuses campaign change during compression even with same hero object",async function(){
  var div=await readyScene(),button=findBtn(div,"⧉ Portrait"),done,writes=0,old=worldState.character;
  fetch=function(){return Promise.resolve({blob:function(){return Promise.resolve("blob");}});};FileReader=function(){this.readAsDataURL=function(){this.onload({target:{result:"image"}});};};compressPortrait=function(d,fn){done=fn;};storageAdapter.markPortraitDirty=function(){writes++;};
  button.listeners.click[0]();await tick();worldState.campId="camp_B";done("wrong portrait");demand(writes===0&&old.portrait==="data:image/png;base64,HERO","cross-campaign portrait write");demand(!button.disabled,"portrait button stuck");
});
t("#527 Save checks campaign after blob await before deriving filename or writing",async function(){
  var div=await readyScene(),button=findBtn(div,"↓ Save"),held,writes=0,names=0;
  fetch=function(){return Promise.resolve({blob:function(){return new Promise(function(r){held=r;});}});};buildFilename=function(){names++;return "scene.png";};saveRenderImage=function(){writes++;};
  button.listeners.click[0]();await tick();worldState.campId="camp_B";held("blob");await tick();demand(writes===0&&names===0,"stale Save reached filename or campaign writer");demand(toasts.some(function(x){return /discarded|nothing saved/.test(x);}),"stale save was silent");
});


t("#527 historical render keeps frame party and no-history request across a hero swap",async function(){
  roleRenderFixture();worldState.transcript=[{r:"gm",t:5,x:"Tess alone beside the old mill.",l:"Old Mill",sl:"the attic",p:[]}];
  var held,body,request,options;callGM=function(r,sys,unused,u,opt){request=r;options=opt;return new Promise(function(resolve){held=resolve;});};falFetch=function(e,b){body=b;return Promise.resolve(imageReply());};
  var pending=doRender({turn:5});await tick();changedHero();held("Tess alone at the mill.");await pending;
  demand(options&&options.noHistory&&request.indexOf("Old Mill")>=0&&request.indexOf("Bram")<0,"historical context mixed with live party/history");
  demand(body&&JSON.stringify(body.image_urls)===JSON.stringify(["data:image/png;base64,HERO"]),"historical seed did not keep original hero alone");
});
t("#527 Save failed fetch after campaign switch cannot open stale download fallback",async function(){
  var div=await readyScene(),button=findBtn(div,"↓ Save"),reject,opened=0;fetch=function(){return new Promise(function(r,j){reject=j;});};window.open=function(){opened++;};
  button.listeners.click[0]();worldState.campId="camp_B";reject(Error("network"));await tick();demand(opened===0,"stale save opened download fallback");demand(toasts.some(function(x){return /discarded/.test(x);}),"failed stale fetch silent");
});
t("#527 Portrait target remains protected when hero changes during image fetch",async function(){
  var div=await readyScene(),button=findBtn(div,"⧉ Portrait"),held,writes=0;fetch=function(){return new Promise(function(r){held=r;});};FileReader=function(){this.readAsDataURL=function(){this.onload({target:{result:"image"}});};};compressPortrait=function(d,fn){fn("compressed");};storageAdapter.markPortraitDirty=function(){writes++;};
  button.listeners.click[0]();var target=changedHero();held({blob:function(){return Promise.resolve("blob");}});await tick();demand(writes===0&&target.portrait==="data:image/png;base64,NYLA"&&!button.disabled,"fetch-time swap wrote portrait or left button stuck");
});

function realSaveFunnel(){(0,eval)(fs.readFileSync(path.join(ROOT,"ui-files.js"),"utf8"));}
t("#527 real Save permission await cannot write or record into a changed campaign",async function(){
  fresh("camp_A","Alpha");realSaveFunnel();var held,downloads=0;window.showDirectoryPicker=function(){};_ensureFolderPerm=function(){return new Promise(function(r){held=r;});};_downloadBlob=function(){downloads++;};
  var pending=saveRenderImage({type:"image/png"},"Alpha.png",10);fresh("camp_B","Beta");held(false);await pending;
  demand(!worldState.renders&&downloads===0,"permission wait redirected download or pointer into Beta");demand(toasts.some(function(x){return /discarded/.test(x);}),"stale permission completion silent");
});
t("#527 real Save folder await uses captured destination and cannot record into changed campaign",async function(){
  fresh("camp_A","Alpha");realSaveFunnel();var held,args;_ensureFolderPerm=function(){return Promise.resolve(true);};exportToFolder=function(){args=Array.prototype.slice.call(arguments);return new Promise(function(r){held=r;});};
  var pending=saveRenderImage({type:"image/png"},"Alpha.png",10);await tick();demand(args[3]==="camp_A"&&args[4]==="Alpha","folder destination was not captured");fresh("camp_B","Beta");held(true);await pending;demand(!worldState.renders,"folder completion recorded into Beta");
});
t("#527 real Save share await rejects stale pointer and download but live hero swap records correctly",async function(){
  fresh("camp_A","Alpha");realSaveFunnel();delete window.showDirectoryPicker;var held,downloads=0;_ensureFolderPerm=function(){return Promise.resolve(false);};shareImageFile=function(){return new Promise(function(r){held=r;});};_downloadBlob=function(){downloads++;};
  var pending=saveRenderImage({type:"image/png"},"Alpha.png",10);await tick();fresh("camp_B","Beta");held(false);await pending;demand(!worldState.renders&&downloads===0,"share completion redirected fallback or pointer into Beta");
  fresh("camp_A","Alpha");pending=saveRenderImage({type:"image/png"},"Alpha.png",10);await tick();changedHero();held(true);await pending;demand(worldState.renders&&worldState.renders[0].t===10,"same-campaign hero swap prevented explicit save");
});

t("#527 real folder write finishes original destination and names it after campaign switch",async function(){
  fresh("camp_A","Alpha");realSaveFunnel();var held,destination,filename;_ensureFolderPerm=function(){return Promise.resolve(true);};_campRootHandle={name:"Campaigns"};
  campaignFolderFor=function(id,name){destination=[id,name];return Promise.resolve({name:"Alpha-folder",getDirectoryHandle:function(){return Promise.resolve({getFileHandle:function(f){filename=f;return Promise.resolve({createWritable:function(){return Promise.resolve({write:function(){return new Promise(function(r){held=r;});},close:function(){return Promise.resolve();}});}});}});}});};
  var pending=saveRenderImage({type:"image/png"},"Alpha.png",10);await tick();fresh("camp_B","Beta");held();await pending;
  demand(JSON.stringify(destination)===JSON.stringify(["camp_A","Alpha"])&&filename==="Alpha.png","file selected wrong destination");demand(!worldState.renders,"completed original file recorded in Beta");
  demand(toasts.some(function(x){return /Saved to.*Alpha-folder/.test(x);})&&!toasts.some(function(x){return /Saved to.*Beta/.test(x);}),"completion toast named live campaign instead of destination");
});
t("#527 successful share completion after switch cannot record into another campaign",async function(){
  fresh("camp_A","Alpha");realSaveFunnel();delete window.showDirectoryPicker;var held;_ensureFolderPerm=function(){return Promise.resolve(false);};shareImageFile=function(){return new Promise(function(r){held=r;});};
  var pending=saveRenderImage({type:"image/png"},"Alpha.png",10);await tick();fresh("camp_B","Beta");held(true);await pending;demand(!worldState.renders,"successful old share recorded in Beta");
});

chain.then(function () {
  console.log("#440 RENDER JOB: " + fails.length + " failed, " + pass + " passed");
  process.exit(fails.length ? 1 : 0);
});
