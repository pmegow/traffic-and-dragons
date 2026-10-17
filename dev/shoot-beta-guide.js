// dev/shoot-beta-guide.js — the beta guide's two phone screenshots (DOC/beta-ui-story.png, DOC/beta-ui-panel.png) from a
// STAGED world in headless Chrome: a phone viewport at 2×, the default (dark) scheme, the same renderers the game uses.
// Re-run it whenever the phone layout changes — the v1.206 iPhone shots the guide carried until #642 showed a rail of tabs,
// a Re-roll button and a Sync button that #611 and #634 removed. Prints the callout anchors (% of the frame, measured from
// the DOM) that the guide's §8 overlays use, so the numbers are never eyeballed.
//   node dev/shoot-beta-guide.js            → writes the two PNGs into DOC/ and prints the anchors
//   node dev/shoot-beta-guide.js --out DIR  → writes them elsewhere (a dry look)
const fs=require("fs"),path=require("path");
const {chromium}=require("./cdp-browser.js");
const root=path.resolve(__dirname,".."),outAt=process.argv.indexOf("--out"),out=outAt>0?path.resolve(process.argv[outAt+1]):path.join(root,"DOC");
const TYPES={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".ico":"image/x-icon"};
function fixture(){
  const e=require("./load-engine.js");e.loadEngine();e.makeTestWorld();
  Object.assign(worldState.character,{name:"Ammut",subraceNm:"Half-Fey",ancestry:"Half-Blood",cls:"Rogue",archetypeNm:"Arcane Trickster",level:8,hp:42,maxHp:68,coin:10300,mana:9,spells:[{nm:"Mage Hand",lvl:0,used:false},{nm:"Message",lvl:0,used:false},{nm:"Charm Person",lvl:1,used:true},{nm:"Silent Image",lvl:1,used:false}]});
  worldState.world.location="Sandpoint";worldState.world.sublocation="the treeline above the Swallowtail camp";worldState.spineComplete=false;worldState.skeleton={acts:[{title:"The Skinsaw Murders",status:"active"}]};worldState.clock={min:6*1440+15*60+55};/* Day 7, 3:55 pm */
  memory.map.nodes["Sandpoint"]={parent:null,visits:12};
  ["The Rusty Dragon","Shalelu's camp","The glassworks","The Old Light","Junker's Edge"].forEach(n=>{memory.map.nodes["Sandpoint|"+n]={parent:"Sandpoint",visits:1};});
  [["Morwen Zethran","Rogue",67,67,"F"],["Frizwick","Rogue",34,34,"M"],["Daeris","Cleric",38,38,"F"]].forEach(([name,cls,hp,maxHp,gender])=>{
    worldState.npcs.push({name,status:"ally",rel:"companion",met:0,partyMember:true,portrait:null,charSheet:{name,cls,hp,maxHp,level:8,gender,inventory:[],spells:[],abilities:[],partyMember:true}});
    memory.npcs[name]={attitude:"ally",knowledge:[],events:[],partyMember:true};
  });
  worldState.turn=203;
  const prose="Morwen clocks it immediately. The way you stand. The angle of your weight. \"Don't,\" she says. Flat.\n\nYou cast anyway.\n\nThe world doesn't change. You do. The fire still throws light. The trees are still dark. But nothing can see you walk into them.\n\nThe cold hits fast past the treeline. Pine needle floor, soft underfoot. Good. Quiet.\n\nYou move thirty feet in. Stop. Listen. Wind through the canopy. An owl, somewhere north. The fire behind you, Daeris laughing at something Frizwick said.";
  worldState.transcript=[{r:"player",x:"I slip out of the firelight and into the treeline.",t:203},{r:"gm",x:prose,t:203}];
  worldState.lastActions=["Follow the owl's call north through the pines.","Circle back and watch the camp from the dark.","Go invisible deeper and look for the goblin trail."];
  return JSON.parse(JSON.stringify({world:worldState,memory}));
}
(async()=>{
  const fx=fixture(),browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844,deviceScaleFactor:2},serviceWorkers:"block"});
    await ctx.route("**/*",async r=>{const u=new URL(r.request().url());if(u.hostname!=="guide.test")return r.abort();const f=path.resolve(root,"."+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:TYPES[path.extname(f)]||"application/octet-stream",body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:""});}});
    await ctx.addInitScript(()=>localStorage.setItem("tnd_ambient_enabled_v1","0"));
    const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://guide.test/index.html");await page.waitForFunction(()=>typeof syncUI==="function");
    await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById("api-screen").style.display="none";showGame();syncUI();rebuildNarrativeFromTranscript(20,true);
      document.getElementById("mic-btn").style.display="block";document.getElementById("tts-bar").style.display="flex";/* the strip as it stands while the narrator reads */
      const s=document.getElementById("story-narrative");s.scrollTop=s.scrollHeight;},fx);
    await page.waitForTimeout(300);
    const rects=()=>page.evaluate(()=>{
      const W=innerWidth,H=innerHeight,pct=(r,ax,ay)=>({x:+(100*(r.x+r.width*ax)/W).toFixed(1),y:+(100*(r.y+r.height*ay)/H).toFixed(1)});
      const g=id=>document.getElementById(id),q=sel=>document.querySelector(sel),R=el=>el?el.getBoundingClientRect():null;
      const nars=document.querySelectorAll("#story-narrative .msg.narrator"),last=nars[nars.length-1];
      const o={};
      o.topbar=pct(R(g("hud-stats")),0,0.5);o.place=pct(R(g("mobile-ways")),0,0.5);o.status=pct(R(g("membar")),0,0.5);
      o.story=pct(R(last),0,0.35);o.actions=pct(R(q("button.qa")),0,0.5);
      const grab=R(g("mobile-grab"));o.handle=pct(grab,0.9,0.5);
      const tabs=g("mobile-panel-tabs");o.tabs=tabs&&R(tabs).width?pct(R(tabs),0.5,0.1):null;
      const party=g("pss-party");o.party=party&&R(party).width?pct(R(party),0.5,0.45):null;
      o.voice=pct(R(g("tts-bar")),0,0.5);o.input=pct(R(g("inrow")),0,0.5);o.file=pct(R(g("file-btn")),0.5,0.5);
      o.drawerOpen=!!document.getElementById("rpanel").classList.contains("mobile-open");
      return o;});
    fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,"beta-ui-story.png")});const a=await rects();
    await page.evaluate(()=>{mobileSelectPanel("party");mobileDrawerWidth(Math.round(innerWidth*0.46));});await page.waitForTimeout(200);
    await page.screenshot({path:path.join(out,"beta-ui-panel.png")});const b=await rects();
    if(errors.length)throw new Error("page errors: "+errors.join(" | "));
    if(!a.actions||!b.party||b.tabs===null)throw new Error("a staged element is missing: "+JSON.stringify({actions:a.actions,party:b.party,tabs:b.tabs}));
    console.log("wrote "+path.join(out,"beta-ui-story.png")+" and beta-ui-panel.png (390x844 @2x, dark)");
    console.log("story anchors  "+JSON.stringify(a));
    console.log("panel anchors  "+JSON.stringify(b));
  }finally{await browser.close();}
})().catch(e=>{console.error("shoot-beta-guide: "+(e&&e.message||e));process.exit(1);});
