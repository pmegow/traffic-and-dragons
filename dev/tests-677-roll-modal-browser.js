// dev/tests-677-roll-modal-browser.js — #677 (owner 2026-10-30: "It's too easy currently to miss the 'roll?' dialog. Let's
// make it a modal" / "block typing"): while a [CHECK:] waits, the roll is a MODAL and the die and Hold back are the only
// ways out. In the real page, at a 375×667 phone (where the dialog was being missed):
//   ① a landed check opens the modal in place of the buttons; the keyboard is inside it and the composer is under its backdrop;
//   ② Escape and a click outside do nothing; a take while the turn is still landing (busy) keeps the modal and says so;
//   ③ Hold back runs reconsiderPendingCheck: modal gone, check withdrawn, the GM's note armed, the composer asked;
//   ④ the transcript rebuild reopens it (a reload is not a way out);
//   ⑤ Roll runs rollPendingCheck: the modal is gone BEFORE the dice are thrown (they are clicked away), the silent
//     continuation carries the [DICE:] record, the roll is logged as the player's;
//   ⑥ Car Mode skips it (its screen covers the page; "roll" is spoken there) and leaving Car Mode brings it back;
//   ⑦ the modal fits the phone and its buttons are finger-sized;
//   ⑧ (dice-sim 0.80.0, 2026-10-31) the check's d20 lies READY at the bottom of the story, above the backdrop (the layer
//     lifted, pointer-events none: the modal's buttons still take the clicks), and Hold back takes it away;
//   ⑨ Roll throws it from where it lies onto the engine's face (dice-sim's aimed throw) and the click dismisses it;
//   ⑩ dice still showing from the last roll leave by the exit first, then the die lies ready;
//   ⑪ closeRollModal keeps the die only for a roll; a close before the drop cancels it.
// A browser suite (dev/cdp-browser.js): a CI step after the Chrome check, and the pre-push gate (#652).
// TND_SHOT_DIR=<dir> keeps ⑧'s screenshot (roll-modal-ready-375.png) there; the OS temp dir otherwise.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');
const TYPES={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.mp3':'audio/mpeg','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.transcript=[{r:'gm',x:'The sentinel raises its blade.',t:1}];return JSON.parse(JSON.stringify({world:worldState,memory}));}
const CHECK='You swing. [CHECK:Longsword attack|+5|DC 14|1d8+3]';
let failed=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:375,height:667},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='roll.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:'not found'});}});
 await ctx.addInitScript(()=>localStorage.setItem('tnd_ambient_enabled_v1','0'));
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://roll.test/index.html');await page.waitForFunction(()=>typeof showRollModal==='function'&&typeof generateActions==='function'&&typeof syncUI==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI();playerRollsDice=true;window.__toasts=[];const _t=showToast;showToast=function(m,ms){__toasts.push(String(m));return _t(m,ms);};},fx);

 await check('① a landed check opens the modal in place of the buttons; the keyboard is inside it and the composer is under the backdrop',async()=>{
   const r=await page.evaluate(async c=>{applyMuts(c);await generateActions(document.createElement('div'));const m=document.getElementById('roll-modal'),inp=document.getElementById('action-input'),sb=document.getElementById('sendbtn');const under=el=>{const b=el.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return !!(m&&h&&(h===m||m.contains(h)));};return {modal:!!m,pending:worldState.pendingCheck&&worldState.pendingCheck.label,lastActions:worldState.lastActions,text:m?m.textContent:'',focusInside:!!(m&&m.contains(document.activeElement)),inputCovered:under(inp),sendCovered:under(sb),buttons:m?m.querySelectorAll('button').length:0};},CHECK);
   assert.equal(r.pending,'Longsword attack','fixture: the check is pending');
   assert.equal(r.modal,true,'the modal opened');assert.equal(r.lastActions,null,'no buttons beside the die');
   assert.match(r.text,/Longsword attack/);assert.match(r.text,/d20\+5 vs DC 14/);assert.match(r.text,/1d8\+3 on a hit/);
   assert.equal(r.buttons,2,'two ways out');assert.equal(r.focusInside,true,'the keyboard is inside the modal');
   assert.equal(r.inputCovered,true,'the composer is under the backdrop');assert.equal(r.sendCovered,true,'Send is under the backdrop');
 });

 await check('② Escape and a click outside do nothing; a take while the turn is still landing keeps the modal and says so',async()=>{
   const r=await page.evaluate(()=>{const m=document.getElementById('roll-modal');m.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const a=!!document.getElementById('roll-modal');m.click();const b=!!document.getElementById('roll-modal');busy=true;const n=__toasts.length;document.getElementById('roll-modal-roll').click();const c=!!document.getElementById('roll-modal'),p=!!worldState.pendingCheck;document.getElementById('roll-modal-hold').click();const d=!!document.getElementById('roll-modal'),q=!!worldState.pendingCheck,t=__toasts.slice(n);busy=false;return {a,b,c,p,d,q,t};});
   assert.equal(r.a,true,'Escape must not close it');assert.equal(r.b,true,'an outside click must not close it');
   assert.equal(r.c,true,'Roll while busy keeps the modal');assert.equal(r.p,true,'Roll while busy keeps the check');
   assert.equal(r.d,true,'Hold back while busy keeps the modal');assert.equal(r.q,true,'Hold back while busy keeps the check');
   assert.equal(r.t.filter(x=>/still landing/.test(x)).length,2,'both refusals were said: '+JSON.stringify(r.t));
 });

 await check('③ Hold back: modal gone, the check withdrawn, the GM told, the composer asked',async()=>{
   const r=await page.evaluate(()=>{const before=(worldState.diceLog||[]).length;document.getElementById('roll-modal-hold').click();const dl=worldState.diceLog||[];return {modal:!!document.getElementById('roll-modal'),pending:!!worldState.pendingCheck,ping:worldState.checkWithdrawnPing&&worldState.checkWithdrawnPing.label,rec:dl.length===before+1?dl[dl.length-1]:null,placeholder:document.getElementById('action-input').placeholder,note:buildEngineNotes()};});
   assert.equal(r.modal,false,'the modal is gone');assert.equal(r.pending,false,'the check is gone');assert.equal(r.ping,'Longsword attack','the CHECK WITHDRAWN ping is armed');
   assert.ok(r.rec&&r.rec.outcome==='withdrawn'&&r.rec.face==null&&r.rec.by==='player','the withdrawn record: '+JSON.stringify(r.rec));
   assert.match(r.placeholder,/hold back/i);assert.match(r.note,/CHECK WITHDRAWN[\s\S]*Longsword attack/);
 });

 await check('④ the transcript rebuild reopens a waiting roll — a reload is not a way out',async()=>{
   const r=await page.evaluate(c=>{applyMuts(c);const a=!!document.getElementById('roll-modal');rebuildNarrativeFromTranscript(20,true);return {before:a,modal:!!document.getElementById('roll-modal'),pending:!!worldState.pendingCheck,card:!!document.querySelector('.dice-pending')};},CHECK);
   assert.equal(r.before,false,'fixture: no modal before the rebuild');assert.equal(r.pending,true);assert.equal(r.modal,true,'the rebuild reopened the modal');
 });

 await check('⑤ Roll: the modal is gone before the dice fly, the silent continuation carries the [DICE:] record, the roll is logged as the player\'s',async()=>{
   const r=await page.evaluate(()=>{window.__sent=[];sendAction=function(t,o){__sent.push({t:t,o:o});};window.__modalAtRoll=null;window.__realShowDiceRoll=showDiceRoll;showDiceRoll=function(){__modalAtRoll=!!document.getElementById('roll-modal');return false;};const before=(worldState.diceLog||[]).length;document.getElementById('roll-modal-roll').click();const dl=worldState.diceLog||[];return {modal:!!document.getElementById('roll-modal'),pending:!!worldState.pendingCheck,modalAtRoll:__modalAtRoll,sent:__sent,rec:dl.length===before+1?dl[dl.length-1]:null};});
   assert.equal(r.modal,false,'the modal is gone');assert.equal(r.pending,false,'the check is gone');
   assert.equal(r.modalAtRoll,false,'the modal must be gone when the dice are thrown — they are clicked away');
   assert.equal(r.sent.length,1,'one silent continuation');assert.equal(r.sent[0].o.silent,true);assert.match(String(r.sent[0].o.rollTag),/^\[DICE:Longsword attack\|/);
   assert.ok(r.rec&&r.rec.by==='player'&&r.rec.face>=1&&r.rec.face<=20,'the player\'s roll: '+JSON.stringify(r.rec));
 });

 await check('⑥ Car Mode skips the modal (its screen covers the page; "roll" is spoken there); leaving Car Mode brings it back',async()=>{
   const r=await page.evaluate(c=>{applyMuts(c);carMode=true;const shown=showRollModal();const a=!!document.getElementById('roll-modal');carMode=false;hideCarMode();return {shown,a,b:!!document.getElementById('roll-modal')};},CHECK);
   assert.equal(r.shown,false,'showRollModal refuses in Car Mode');assert.equal(r.a,false,'no modal over the car screen');assert.equal(r.b,true,'hideCarMode reopens the waiting roll');
 });

 await check('⑦ the modal fits a 375×667 phone and its buttons are finger-sized',async()=>{
   const r=await page.evaluate(()=>{const m=document.getElementById('roll-modal'),b=m.firstChild.getBoundingClientRect(),rb=document.getElementById('roll-modal-roll').getBoundingClientRect(),hb=document.getElementById('roll-modal-hold').getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),vh:innerHeight,roll:rb.height,hold:hb.height};});
   assert.ok(r.top>=0&&r.bottom<=r.vh,`the box sits on the screen (${r.top}–${r.bottom} of ${r.vh})`);
   assert.ok(r.roll>=44&&r.hold>=44,`finger-sized buttons (${r.roll}, ${r.hold})`);
   await page.evaluate(()=>{closeRollModal();delete worldState.pendingCheck;});
 });

 // ⑧–⑪ (dice-sim 0.80.0, 2026-10-31): the ready die. The dice module is served from roller/ by the route above.
 await page.waitForFunction(()=>!!window.DiceSim,null,{timeout:20000});
 const DICE_MS=45000;/* a bake runs in a worker; CI's GPU-less runner draws at ~5 fps and a Smoke puff takes 11–13 s there (the #669 suite's measure) */
 const presented=async()=>page.waitForFunction(()=>{const s=diceLiveState();return !!(s.presented&&s.presented.join()==='d20'&&s.ready);},null,{timeout:DICE_MS});

 await check('⑧ the check\'s d20 lies ready at the bottom of the story, above the backdrop, and the modal\'s buttons still take the clicks',async()=>{
   await page.evaluate(async c=>{applyMuts(c);await generateActions(document.createElement('div'));},CHECK);
   await presented();
   const r=await page.evaluate(()=>{const m=document.getElementById('roll-modal'),layer=document.getElementById('dice-layer'),rb=document.getElementById('roll-modal-roll'),b=rb.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
     const contexts=[];for(let el=layer.parentElement;el&&el!==document.documentElement;el=el.parentElement){const s=getComputedStyle(el);if((s.position!=='static'&&s.zIndex!=='auto')||s.transform!=='none'||Number(s.opacity)<1||s.filter!=='none'||s.isolation==='isolate'||/transform|opacity/.test(s.willChange)||/paint|layout|strict|content/.test(s.contain)||s.mixBlendMode!=='normal'||(s.backdropFilter&&s.backdropFilter!=='none')||s.perspective!=='none')contexts.push(el.id||el.className||el.tagName);}
     const st=diceLiveState();return {modal:!!m,modalZ:Number(getComputedStyle(m).zIndex),layerZ:Number(getComputedStyle(layer).zIndex),pointer:getComputedStyle(layer).pointerEvents,ready:st.ready,showing:st.showing,presented:st.presented,rollHit:hit===rb||rb.contains(hit),contexts,layerRect:layer.getBoundingClientRect().toJSON(),box:m.firstChild.getBoundingClientRect().toJSON()};});
   assert.equal(r.modal,true);assert.deepEqual(r.presented,['d20'],'the d20 is laid out');assert.equal(r.ready,true,'the layer is lifted');assert.equal(r.showing,true);
   assert.ok(r.layerZ>r.modalZ,`the die paints above the modal (layer z ${r.layerZ}, modal z ${r.modalZ})`);
   assert.deepEqual(r.contexts,[],'no ancestor of the dice layer forms a stacking context (the z-index would not reach the modal): '+JSON.stringify(r.contexts));
   assert.equal(r.pointer,'none','the lifted layer takes no clicks');assert.equal(r.rollHit,true,'the Roll button is hit through the lifted layer');
   assert.ok(r.box.bottom<r.layerRect.bottom-40,`the modal box ends above the strip the die lies on (box bottom ${Math.round(r.box.bottom)}, layer bottom ${Math.round(r.layerRect.bottom)})`);
   await page.screenshot({path:require('path').join(process.env.TND_SHOT_DIR||require('os').tmpdir(),'roll-modal-ready-375.png')});
   const h=await page.evaluate(()=>{document.getElementById('roll-modal-hold').click();const s=diceLiveState();return {modal:!!document.getElementById('roll-modal'),presented:s.presented,ready:s.ready,showing:s.showing};});
   assert.equal(h.modal,false);assert.equal(h.presented,null,'Hold back takes the die away');assert.equal(h.ready,false);assert.equal(h.showing,false,'the layer is hidden');
 });

 await check('⑨ Roll throws the ready die from where it lies, onto the face the engine rolled; the click then dismisses it as any roll',async()=>{
   await page.evaluate(async c=>{applyMuts(c);await generateActions(document.createElement('div'));},CHECK);
   await presented();
   const face=await page.evaluate(()=>{showDiceRoll=window.__realShowDiceRoll;const before=(worldState.diceLog||[]).length;document.getElementById('roll-modal-roll').click();const dl=worldState.diceLog||[];return dl.length===before+1?dl[dl.length-1].face:null;});
   assert.ok(face>=1&&face<=20,'the engine rolled: '+face);
   const at=await page.evaluate(()=>{const s=diceLiveState();return {modal:!!document.getElementById('roll-modal'),ready:s.ready,showing:s.showing,presented:s.presented,clickable:typeof document.getElementById('dice-layer').onclick==='function'};});
   assert.equal(at.modal,false);assert.equal(at.ready,false,'the layer is back under the modal level');assert.equal(at.showing,true);assert.equal(at.presented,null,'the die is in the air, no longer laid out');assert.equal(at.clickable,true,'the click dismisses');
   await page.waitForFunction(f=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:'+f;},face,{timeout:DICE_MS});
   const landed=await page.evaluate(()=>diceLiveState());
   assert.equal(landed.lastAimed,true,'the die was thrown from where it lay (dice-sim\'s aimed throw), not rolled in from the edge');
   await page.evaluate(()=>document.getElementById('dice-layer').click());
   /* a hit rolls the damage dice (1d8+3) as the d20 leaves (#654) and they too stay until a click; a miss just leaves */
   await page.waitForFunction(()=>{const s=diceLiveState();return !s.showing||(s.last&&/^d8:/.test(s.last.join()));},null,{timeout:DICE_MS});
   const dmg=await page.evaluate(()=>{const s=diceLiveState();if(!s.showing)return null;document.getElementById('dice-layer').click();return s.last.join();});
   await page.waitForFunction(()=>!diceLiveState().showing,null,{timeout:DICE_MS});
   console.log('   (the d20 landed '+face+(dmg?'; the damage dice '+dmg+' were clicked away too':'; a miss, no damage dice')+')');
 });

 await check('⑩ the next check landing before the dice were clicked away: they leave by the exit first, then the die lies ready',async()=>{
   await page.evaluate(()=>window.__realShowDiceRoll(12));
   await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:12';},null,{timeout:DICE_MS});
   const r=await page.evaluate(async c=>{applyMuts(c);await generateActions(document.createElement('div'));const l=document.getElementById('dice-layer');return {modal:!!document.getElementById('roll-modal'),leaving:l.classList.contains('leaving'),ready:l.classList.contains('ready'),exit:diceLiveState().exit};},CHECK);
   assert.equal(r.modal,true);assert.notEqual(r.exit,'none','fixture: the exit plays');assert.equal(r.leaving,true,'the settled dice are leaving by the exit');assert.equal(r.ready,false,'the die is not laid out while they go');
   await presented();
   const after=await page.evaluate(()=>{const l=document.getElementById('dice-layer');return {leaving:l.classList.contains('leaving'),exiting:diceLiveState().exiting};});
   assert.equal(after.leaving,false);assert.equal(after.exiting,0,'the old dice have gone');
   await page.evaluate(()=>document.getElementById('roll-modal-hold').click());
 });

 await check('⑪ closeRollModal keeps the die only for a roll; the car screen\'s close and a close before the die has dropped take it away',async()=>{
   await page.evaluate(async c=>{applyMuts(c);await generateActions(document.createElement('div'));},CHECK);
   await presented();
   const r=await page.evaluate(()=>{closeRollModal(true);const a=diceLiveState();const took=diceLiveUnpresent();const b=diceLiveState();showRollModal();closeRollModal();const c=diceLiveState();return {kept:a.presented,keptReady:a.ready,took,gone:b.presented,goneShowing:b.showing,c:c.presented,cShowing:c.showing};});
   assert.deepEqual(r.kept,['d20'],'closeRollModal(true) keeps the die for the roll');assert.equal(r.keptReady,true);
   assert.equal(r.took,true);assert.equal(r.gone,null);assert.equal(r.goneShowing,false,'diceLiveUnpresent hides the layer');
   assert.equal(r.c,null,'a close before the die has dropped cancels the drop');assert.equal(r.cShowing,false);
   await new Promise(res=>setTimeout(res,2500));
   const later=await page.evaluate(()=>{const s=diceLiveState();return {presented:s.presented,showing:s.showing,ready:s.ready,modal:!!document.getElementById('roll-modal')};});
   assert.deepEqual(later,{presented:null,showing:false,ready:false,modal:false},'nothing drops later: '+JSON.stringify(later));
   await page.evaluate(()=>{delete worldState.pendingCheck;});
 });

 assert.deepEqual(errors,[],'page errors');
 if(failed)throw new Error(failed+' check(s) failed');
 console.log('PASS #677 roll modal — the roll is a modal; the die and Hold back are the only ways out');
}finally{await browser.close();}})().catch(e=>{console.error('FAIL #677 roll modal: '+(e&&e.stack||e));process.exit(1);});
