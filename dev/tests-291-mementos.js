var fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
var root=path.join(__dirname,".."),passed=0,failed=[];
function read(f){return fs.readFileSync(path.join(root,f),"utf8");}
async function test(name,fn){try{await fn();passed++;}catch(e){failed.push("#291 mementos > "+name+": "+e.message);}}
function fixture(){
  var nodes={},warns=[],downloads=[],revoked=[],deletes=[],confirm=true;
  function Node(tag){this.tagName=tag;this.children=[];this.style={};this.handlers={};this.hidden=false;this.value="";}
  Object.defineProperty(Node.prototype,"textContent",{get:function(){return(this.text||"")+this.children.map(function(n){return n.textContent;}).join(" ");},set:function(s){this.text=String(s);this.children=[];}});
  Object.defineProperty(Node.prototype,"innerHTML",{set:function(){throw new Error("HTML reached parent DOM");}});
  Node.prototype.appendChild=function(n){this.children.push(n);return n;};Node.prototype.setAttribute=function(k,v){this[k]=v;};Node.prototype.addEventListener=function(k,f){this.handlers[k]=f;};Node.prototype.click=function(){if(this.tagName==="a")downloads.push(this);};
  var adapter={connected:false,list:{mementos:[],limits:{maxBytes:4194304,maxCount:100}},reads:[],hasToken:function(){return adapter.connected;},
    fetchAccount:function(cb){cb(null,{username:"Reader"});},listMementos:function(cb){if(adapter.holdList)adapter.listCb=cb;else cb(adapter.error,adapter.list);},
    getMemento:function(id,cb){adapter.reads.push({id:id,cb:cb});},deleteMemento:function(id,cb){deletes.push(id);cb(adapter.deleteError,{ok:true});}};
  var box={document:{getElementById:function(id){return nodes[id]||(nodes[id]=new Node("div"));},createElement:function(tag){return new Node(tag);}},window:{confirm:function(){return confirm;}},storageAdapter:adapter,
    Blob:function(parts){this.parts=parts;},URL:{createObjectURL:function(){return "blob:test";},revokeObjectURL:function(u){revoked.push(u);}},setTimeout:function(f){f();},console:{warn:function(s){warns.push(s);}},Date:Date};
  vm.createContext(box);var html=read("mementos.html"),re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g,m;while((m=re.exec(html)))if(m[1].trim())vm.runInContext(m[1],box);
  return {seam:box.window.__mementoTest,nodes:nodes,adapter:adapter,warns:warns,downloads:downloads,revoked:revoked,deletes:deletes,confirm:function(v){confirm=v;}};
}
async function main(){
  var calls=[],response={ok:true,status:200,json:function(){return Promise.resolve({ok:true});}},b={setTimeout:setTimeout,clearTimeout:clearTimeout,AbortController:AbortController,console:console,fetch:function(url,opts){calls.push({url:url,opts:opts});return Promise.resolve(response);}};
  vm.createContext(b);vm.runInContext(read("storage-adapter.js"),b);var a=b.storageAdapter;
  function call(name,args){return new Promise(function(resolve){a[name].apply(a,args.concat(function(err,data){resolve({err:err,data:data});}));});}
  await test("memento API methods encode ids and share authenticated deadline transport",async function(){
    a.setServer("https://unit.test","TEST_ONLY");
    for(var s of [["listMementos",[],"/api/mementos",undefined],["getMemento",["a b"],"/api/mementos/a%20b",undefined],["putMemento",["a b",{title:"Story",html:"<p>x</p>"}],"/api/mementos/a%20b","PUT"],["deleteMemento",["a b"],"/api/mementos/a%20b","DELETE"]]){
      assert.ifError((await call(s[0],s[1])).err);var c=calls[calls.length-1];assert.equal(c.url,"https://unit.test"+s[2]);assert.equal(c.opts.method,s[3]);assert.equal(c.opts.headers.Authorization,"Bearer TEST_ONLY");assert(c.opts.signal);if(s[3]==="PUT")assert.deepEqual(JSON.parse(c.opts.body),s[1][1]);
    }
  });
  await test("quota refusal reaches the memento caller and disconnected writes do not fetch",async function(){
    response={ok:false,status:413,json:function(){return Promise.resolve({error:"Memento too large"});}};
    assert((await call("putMemento",["x",{}])).err.includes("Memento too large"));a.setServer(null,null);calls=[];assert.equal((await call("putMemento",["x",{}])).err,"Not connected");assert.equal(calls.length,0);
  });
  await test("account save reuses the narrative exporter without mutating the transcript",function(){
    var sent=[],toasts=[],ws={campName:"Ashfen",turn:8,character:{name:"Tess"},transcript:[{r:"gm",t:8,x:"<script>hostile prose</script>"}]};
    var box={worldState:ws,APP_VERSION:"test",console:{warn:function(){}},showToast:function(s){toasts.push(s);},storageAdapter:{hasToken:function(){return true;},putMemento:function(id,body,cb){sent.push({id:id,body:body,cb:cb});}}};
    vm.createContext(box);vm.runInContext(read("ui-files.js"),box);var before=JSON.stringify(ws),expected=box.buildNarrativeHtml(ws);box.saveNarrativeMemento();box.saveNarrativeMemento();
    assert.equal(sent.length,1);assert.equal(sent[0].body.html,expected);assert.equal(sent[0].body.sourceTurn,8);assert.equal(JSON.stringify(ws),before);
    sent[0].cb("HTTP 413 — storage quota exceeded");assert(toasts.some(function(s){return s.indexOf("storage quota exceeded")>=0;}));
    box.saveNarrativeMemento();assert.equal(sent.length,2);sent[1].cb(null,{ok:true});assert(toasts.some(function(s){return s.indexOf("account")>=0&&s.indexOf("saved")>=0;}));
  });
  await test("empty and disconnected campaigns cannot create hollow mementos",function(){
    var n=0,toasts=[],box={worldState:{transcript:[]},console:{warn:function(){}},showToast:function(s){toasts.push(s);},storageAdapter:{hasToken:function(){return false;},putMemento:function(){n++;}}};
    vm.createContext(box);vm.runInContext(read("ui-files.js"),box);box.saveNarrativeMemento();assert.equal(n,0);assert(toasts.length);
    box.storageAdapter.hasToken=function(){return true;};box.saveNarrativeMemento();assert.equal(n,0);
  });
  await test("reader contracts retain sandbox, CSP, palette and navigation seams",function(){
    var h=read("mementos.html");assert(h.includes('href="satellite.css"'));assert(h.includes('sandbox=""'));assert(h.includes('referrerpolicy="no-referrer"'));assert(!h.includes("allow-scripts")&&!h.includes("allow-same-origin"));
    assert(!/\b(saveCore|saveAll|syncToServer|pushCampaignState)\s*\(/.test(h));assert(!/localStorage|tnd_server_tok/.test(h));
    assert(read("sw.js").match(/if\(\/[^\n]*\|mementos\|[^\n]*\/\.test/));assert(read("home.html").includes('href="mementos.html"'));
    assert(read("ui-boot.js").includes('addEventListener("click",saveNarrativeMemento)'));
    var c=fixture(),hostile="<script>parent.alert(1)</script><img src=https://evil.test/x>";var doc=c.seam.readerDocument(hostile);
    assert(doc.indexOf("Content-Security-Policy")<doc.indexOf(hostile));assert(doc.includes("default-src 'none'"));assert(doc.includes("form-action 'none'"));
  });
  await test("signed-out reader and expired session clear saved stories and preview",function(){
    var c=fixture();assert(c.nodes.status.textContent.includes("Sign in"));c.adapter.connected=true;c.adapter.error="HTTP 401 — expired";c.seam.refresh();assert(c.nodes.status.textContent.includes("401"));assert.equal(c.nodes.reader.srcdoc,"");assert(c.warns.length);
  });
  await test("roster titles are inert and HTML is fetched only on demand",function(){
    var c=fixture();c.adapter.connected=true;c.adapter.list.mementos=[{id:"one",title:"<img onerror=alert(1)>",bytes:44,sourceTurn:8}];c.seam.refresh();assert(c.nodes.stories.textContent.includes("<img onerror=alert(1)>"));assert.equal(c.adapter.reads.length,0);
  });
  await test("older story or list responses cannot replace the current selection",function(){
    var c=fixture();c.adapter.connected=true;c.seam.refresh();c.seam.open("one");c.seam.open("two");
    c.adapter.reads[1].cb(null,{id:"two",title:"Newer",html:"<p>newer</p>"});var doc=c.nodes.reader.srcdoc;c.adapter.reads[0].cb(null,{id:"one",title:"Older",html:"old"});assert.equal(c.nodes.reader.srcdoc,doc);
    c.adapter.holdList=true;c.seam.refresh();c.adapter.connected=false;c.seam.refresh();c.adapter.listCb(null,{mementos:[{id:"leak",title:"STALE"}],limits:{}});assert(!c.nodes.stories.textContent.includes("STALE"));assert.equal(c.nodes.reader.srcdoc,"");
  });
  await test("download URLs are released and delete needs confirmation",function(){
    var c=fixture();c.adapter.connected=true;c.seam.refresh();c.seam.open("one");c.adapter.reads[0].cb(null,{id:"one",title:"Story",html:"<p>safe</p>"});c.seam.download();assert.equal(c.downloads.length,1);assert.deepEqual(c.revoked,["blob:test"]);
    c.confirm(false);c.seam.remove("one","Story");assert.equal(c.deletes.length,0);c.confirm(true);c.adapter.deleteError="HTTP 500 — failed";c.seam.remove("one","Story");assert(c.nodes.status.textContent.includes("failed"));assert.equal(c.deletes.length,1);
  });
  failed.forEach(function(f){console.error(f);});console.log("#291 mementos: "+passed+" passed, "+failed.length+" failed");process.exitCode=failed.length?1:0;
}
main().catch(function(e){console.error(e);process.exitCode=1;});
