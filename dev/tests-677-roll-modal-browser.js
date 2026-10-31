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
//   ⑦ the modal fits the phone and its buttons are finger-sized.
// A browser suite (dev/cdp-browser.js): a CI step after the Chrome check, and the pre-push gate (#652).
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
   const r=await page.evaluate(()=>{window.__sent=[];sendAction=function(t,o){__sent.push({t:t,o:o});};window.__modalAtRoll=null;showDiceRoll=function(){__modalAtRoll=!!document.getElementById('roll-modal');return false;};const before=(worldState.diceLog||[]).length;document.getElementById('roll-modal-roll').click();const dl=worldState.diceLog||[];return {modal:!!document.getElementById('roll-modal'),pending:!!worldState.pendingCheck,modalAtRoll:__modalAtRoll,sent:__sent,rec:dl.length===before+1?dl[dl.length-1]:null};});
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

 assert.deepEqual(errors,[],'page errors');
 if(failed)throw new Error(failed+' check(s) failed');
 console.log('PASS #677 roll modal — the roll is a modal; the die and Hold back are the only ways out');
}finally{await browser.close();}})().catch(e=>{console.error('FAIL #677 roll modal: '+(e&&e.stack||e));process.exit(1);});
