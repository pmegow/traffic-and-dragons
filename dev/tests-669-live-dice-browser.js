// #669: the live dice in the real game page (dice-sim from roller/, through ui-dice.js) — a check's d20 lands on its face,
// the click dismisses it and runs onClose, the damage dice land on theirs, Car Mode skips, the master mute silences them,
// and File ▸ Settings ▸ Dice appearance changes the look (Sketch by default since 2026-11-09; Bone before) and the exit
// (Fade by default since 2026-11-09; Smoke puff before).
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');let failed=0;
const TYPES={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.mp3':'audio/mpeg','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
// A dismiss plays the exit (#670), and an exit advances at most 1/30 s a frame (dice-sim's EXIT_FRAME_MAX): on CI's
// GPU-less runner the dice draw at about 5 frames a second, so the 1.8 s Smoke puff took 11-13 s there (the default exit
// until 2026-11-09; Fade is 0.6 s, but a saved exit can be any of them). The old 5 s
// budget was the fade's (250 ms) and turned CI red on dacc10b2; a dismiss that never ends still fails.
const DISMISS_MS=30000;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
    await ctx.route('**/*',async route=>{
      const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
      const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))return route.abort();
      try{return route.fulfill({status:200,contentType:TYPES[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch(e){return route.fulfill({status:404,body:'not found'});}
    });
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1/index.html');
    await page.waitForFunction(()=>typeof showDiceRoll==='function'&&typeof showGame==='function');
    await page.evaluate(()=>{document.getElementById('api-screen').style.display='none';showGame();});
    /* named, so a refusal grown too wide (B60: only a local file is refused) is read as that and not as a timeout */
    await page.waitForFunction(()=>!!window.DiceSim,null,{timeout:20000}).catch(e=>{throw new Error('FAIL the dice module loads on an http page (localhost keeps its dice) — '+e.message);});

    await check('a check\'s d20 is thrown live and lands on the engine\'s face; the click dismisses it and runs onClose',async()=>{
      const shown=await page.evaluate(()=>{window.__closed=0;return showDiceRoll(17,{onClose:function(){window.__closed++;}});});
      assert.equal(shown,true);
      await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:17';},null,{timeout:30000});
      const s=await page.evaluate(()=>diceLiveState());
      assert.equal(s.showing,true,'the layer shows over the story');
      assert.equal(s.overlay,true,'one overlay');
      await page.evaluate(()=>document.getElementById('dice-layer').click());
      await page.waitForFunction(()=>window.__closed===1&&!diceLiveState().showing,null,{timeout:DISMISS_MS});
    });

    await check('the damage dice land on theirs, through the same overlay (one WebGL context for the session)',async()=>{
      const before=await page.evaluate(()=>document.querySelectorAll('#dice-layer canvas').length);
      assert.equal(await page.evaluate(()=>showDamageRoll(6,[3,5])),true);
      await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d6:3,d6:5';},null,{timeout:30000});
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#dice-layer canvas').length),before,'no second canvas');
      await page.evaluate(()=>document.getElementById('dice-layer').click());
      await page.waitForFunction(()=>!diceLiveState().showing,null,{timeout:DISMISS_MS});
    });

    await check('faces outside their die, and Car Mode, show nothing',async()=>{
      const r=await page.evaluate(()=>{const out=[showDiceRoll(21),showDiceRoll(0),showDamageRoll(6,[7]),showDamageRoll(7,[1])];carMode=true;out.push(showDiceRoll(5));carMode=false;return out;});
      assert.deepEqual(r,[false,false,false,false,false]);
    });

    await check('the master mute silences the dice',async()=>{
      const m=await page.evaluate(()=>{AudioMaster.setMuted(true);const a=diceLiveState().muted;AudioMaster.setMuted(false);return [a,diceLiveState().muted];});
      assert.deepEqual(m,[true,false]);
    });

    await check('File ▸ Settings ▸ Dice appearance: Sketch by default (owner 2026-11-09), a choice kept and worn',async()=>{
      const r=await page.evaluate(async()=>{
        const before=diceLiveState().look;
        showDiceLookModal();
        await new Promise(res=>setTimeout(res,200));
        const radios=[...document.querySelectorAll("#dice-look-list input[name='dice-look']")];
        const labels=radios.map(x=>x.parentNode.textContent);
        const checked=labels[radios.findIndex(x=>x.checked)].replace(/\s+/g,'');
        const carrara=radios[labels.findIndex(t=>/^6?Carrara/.test(t.replace(/\s+/g,'')))];
        carrara.checked=true;carrara.dispatchEvent(new Event('change'));
        await new Promise(res=>setTimeout(res,300));
        const kept=JSON.parse(localStorage.getItem('tnd_dice_look_v1'));
        document.getElementById('dice-look-done').click();
        return {before,checked,kept,menu:!!document.querySelector('[id$="dice-look"]')};
      });
      assert.equal(r.before,'Sketch','a new device starts as Sketch');
      assert.match(r.checked,/^6?Sketch/,'Sketch is the checked look, not Ink Sketch: '+r.checked);
      assert.equal(r.kept.name,'Carrara');
      assert.equal(r.kept.style.finish,'marble');
      assert.equal(r.menu,true,'the Settings row is there');
    });

    // #670 (owner 2026-10-26): the dice leave by an exit — Fade until the player picks (owner 2026-11-09; Smoke puff before); the damage dice roll as the d20 leaves.
    const until=`var until=async(f,ms)=>{const t=Date.now();while(!f()){if(Date.now()-t>(ms||30000))throw new Error('timed out: '+f);await new Promise(r=>setTimeout(r,40));}};`;
    await check('#670 a dismiss plays the exit (Fade until the player picks): the story stays clickable while the dice go, the layer hides once they have gone',async()=>{
      const r=await page.evaluate(until+`(async()=>{
        const exit=diceLiveState().exit;
        showDiceRoll(9);
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:9';});
        const layer=document.getElementById('dice-layer');
        layer.click();
        const going={leaving:layer.classList.contains('leaving'),pointer:getComputedStyle(layer).pointerEvents,showing:diceLiveState().showing,exiting:diceLiveState().exiting};
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        return {exit,going,after:diceLiveState().exiting};
      })()`);
      assert.equal(r.exit,'fade','Fade until the player picks');
      assert.deepEqual(r.going,{leaving:true,pointer:'none',showing:true,exiting:1},'the die leaves on the layer, which lets the story be clicked');
      assert.equal(r.after,0,'gone, and the layer hidden');
    });
    await check('#670 after a hit the damage dice roll as the d20 leaves',async()=>{
      const r=await page.evaluate(until+`(async()=>{
        window.__dmg=null;
        showDiceRoll(15,{onClose:function(){window.__dmg=showDamageRoll(8,[5]);}});
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:15';});
        document.getElementById('dice-layer').click();
        const atClick={dmg:window.__dmg,exiting:diceLiveState().exiting,leaving:document.getElementById('dice-layer').classList.contains('leaving')};
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d8:5';});
        const landed=diceLiveState();
        document.getElementById('dice-layer').click();
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        return {atClick,showingWhenLanded:landed.showing};
      })()`);
      assert.deepEqual(r.atClick,{dmg:true,exiting:1,leaving:false},'the damage dice are thrown at the click, while the d20 is still leaving, and take the layer');
      assert.equal(r.showingWhenLanded,true,'the damage dice land on theirs, on show');
    });
    await check('#670 Dice appearance lists the exits; a choice is kept and worn; None goes at once',async()=>{
      const r=await page.evaluate(until+`(async()=>{
        showDiceLookModal();
        await until(()=>document.querySelectorAll('#dice-exit option').length>0,5000);
        const sel=document.getElementById('dice-exit');
        const options=[...sel.options].map(o=>o.value+'='+o.textContent),selected=sel.value;
        sel.value='none';sel.dispatchEvent(new Event('change'));
        const kept=localStorage.getItem('tnd_dice_exit_v1'),worn=_diceLive.overlay.exit;
        document.getElementById('dice-look-done').click();
        showDiceRoll(4);
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:4';});
        document.getElementById('dice-layer').click();
        const exiting=diceLiveState().exiting;
        await until(()=>!diceLiveState().showing,2000);
        localStorage.setItem('tnd_dice_exit_v1','teleport');
        const unknown=diceExitName();
        localStorage.removeItem('tnd_dice_exit_v1');
        return {options,selected,kept,worn,exiting,unknown};
      })()`);
      assert.equal(r.options.join(', '),'none=None, burn=Burn out, smoke=Smoke puff, pit=Going down, fade=Fade, scurry=Scurry off, shatter=Shatter, random=Random, mixed=Mixed bag');
      assert.equal(r.selected,'fade','the menu shows the default, Fade');
      assert.equal(r.kept,'none');
      assert.equal(r.worn,'none','the overlay wears it at once');
      assert.equal(r.exiting,0,'None: the dice go with the fade, no exit');
      assert.equal(r.unknown,'fade','an exit the dice no longer have is replaced by the default');
    });

    await check('#691 retired Melt is absent and a saved selection dismisses through the default exit',async()=>{
      await page.evaluate(()=>localStorage.setItem('tnd_dice_exit_v1','melt'));
      await page.reload();
      await page.waitForFunction(()=>typeof showDiceRoll==='function'&&typeof showGame==='function');
      await page.evaluate(()=>{document.getElementById('api-screen').style.display='none';showGame();});
      await page.waitForFunction(()=>!!window.DiceSim&&!!_diceLive.overlay,null,{timeout:20000});
      const r=await page.evaluate(until+`(async()=>{
        showDiceLookModal();
        await until(()=>document.querySelectorAll('#dice-exit option').length>0,5000);
        const sel=document.getElementById('dice-exit');
        const offered=[...sel.options].some(o=>o.value==='melt'),selected=sel.value;
        document.getElementById('dice-look-done').click();
        const view=_diceLive.overlay.view;view.o.supersample=false;view.resize();
        window.__retiredExitClosed=0;
        showDiceRoll(19,{onClose:function(){window.__retiredExitClosed++;}});
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:19';});
        const worn=_diceLive.overlay.exit;
        document.getElementById('dice-layer').click();
        const started=diceLiveState().exiting;
        if(view.renderer.domElement.width<100||view.renderer.domElement.height<100)throw Error('The fallback must render in the visible game layer');
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        localStorage.removeItem('tnd_dice_exit_v1');
        return {offered,selected,worn,started,remaining:diceLiveState().exiting,closed:window.__retiredExitClosed};
      })()`);
      assert.deepEqual(r,{offered:false,selected:'fade',worn:'fade',started:1,remaining:0,closed:1});
    });

    // Owner 2026-11-13: the test d20 rolls OVER the Dice appearance modal, which stays open so the looks can be browsed.
    await check('Roll a test d20 rolls over the Dice appearance modal, which stays open and usable; closing it sends the dice away',async()=>{
      const r=await page.evaluate(until+`(async()=>{
        const landed=async()=>{_diceLive.last=null;document.getElementById('dice-look-test').click();await until(()=>{const s=diceLiveState();return s.last&&/^d20:/.test(s.last.join());});};
        showDiceLookModal();
        await until(()=>document.querySelectorAll("#dice-look-list input[name='dice-look']").length>0,5000);
        await landed();
        const modal=document.getElementById('dice-look-modal'),layer=document.getElementById('dice-layer'),o={};
        o.modalOpen=!!modal&&document.body.contains(modal);
        if(!o.modalOpen)return o;
        o.showing=diceLiveState().showing;
        o.above=Number(getComputedStyle(layer).zIndex)>Number(getComputedStyle(modal).zIndex);
        o.pointer=getComputedStyle(layer).pointerEvents;
        const done=document.getElementById('dice-look-done'),b=done.getBoundingClientRect();
        o.doneTakesClick=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===done;
        const radios=[...document.querySelectorAll("#dice-look-list input[name='dice-look']")],other=radios.find(x=>!x.checked);
        other.checked=true;other.dispatchEvent(new Event('change'));
        await new Promise(res=>setTimeout(res,300));
        o.afterLook={modal:!!document.getElementById('dice-look-modal'),showing:diceLiveState().showing};
        await landed();
        o.second={modal:!!document.getElementById('dice-look-modal'),canvases:layer.querySelectorAll('canvas').length};
        /* #737: Dismiss, between the two buttons — the die leaves by the exit ABOVE the modal, which stays open */
        const dis=document.getElementById('dice-look-dismiss');
        o.order=[...done.parentNode.querySelectorAll('button')].map(x=>x.id).join();
        if(!dis)return o;
        dis.click();
        o.dismissing={modal:!!document.getElementById('dice-look-modal'),exiting:diceLiveState().exiting,above:Number(getComputedStyle(layer).zIndex)>Number(getComputedStyle(modal).zIndex),pointer:getComputedStyle(layer).pointerEvents};
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        dis.click();/* nothing on show: nothing happens, nothing throws */
        o.dismissed={modal:!!document.getElementById('dice-look-modal'),showing:diceLiveState().showing};
        await landed();
        o.third={modal:!!document.getElementById('dice-look-modal'),showing:diceLiveState().showing,above:Number(getComputedStyle(layer).zIndex)>Number(getComputedStyle(modal).zIndex)};
        done.click();
        o.closed=!document.getElementById('dice-look-modal');
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        o.gone=true;
        showDiceRoll(6);
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:6';});
        o.game={pointer:getComputedStyle(layer).pointerEvents,z:getComputedStyle(layer).zIndex};
        layer.click();
        await until(()=>!diceLiveState().showing,${DISMISS_MS});
        localStorage.removeItem('tnd_dice_look_v1');
        return o;
      })()`);
      assert.equal(r.modalOpen,true,'the modal stays open after the test roll');
      assert.equal(r.showing,true,'the test die is on show');
      assert.equal(r.above,true,'the dice are drawn above the modal');
      assert.equal(r.pointer,'none','the dice take no clicks: the modal stays usable');
      assert.equal(r.doneTakesClick,true,'the modal\'s buttons are what a click reaches');
      assert.deepEqual(r.afterLook,{modal:true,showing:true},'choosing another look keeps the modal and the die');
      assert.deepEqual(r.second,{modal:true,canvases:1},'a second test roll, same modal, one canvas');
      assert.equal(r.order,'dice-look-test,dice-look-dismiss,dice-look-done','#737 Dismiss sits between Roll a test d20 and Done');
      assert.deepEqual(r.dismissing,{modal:true,exiting:1,above:true,pointer:'none'},'#737 Dismiss plays the exit above the modal, which stays open');
      assert.deepEqual(r.dismissed,{modal:true,showing:false},'#737 the die is gone and the modal is still there');
      assert.deepEqual(r.third,{modal:true,showing:true,above:true},'#737 a test roll after a dismiss is thrown above the modal again');
      assert.equal(r.closed,true);
      assert.equal(r.gone,true,'closing the modal sends the test dice away');
      assert.deepEqual(r.game,{pointer:'auto',z:'50'},'a game roll afterwards is under the modal level again and takes the dismissing click');
    });

    /* B60 / B59 (field reports, 2026-11-13). Each check puts the session's dice state back as it found it. */
    const stash=()=>page.evaluate(()=>{window.__dl={state:_diceLive.state,overlay:_diceLive.overlay,reported:_diceLive.reported,sim:window.DiceSim,report:window.reportError,toast:window.showToast,refusal:window.diceLivePageRefusal,warn:console.warn};
      window.__reports=[];window.__toasts=[];window.__warns=[];window.reportError=function(ctx,msg,detail){__reports.push({ctx:ctx,msg:String(msg),detail:detail});};window.showToast=function(m){__toasts.push(String(m));};console.warn=function(m){__warns.push(String(m));};
      _diceLive.overlay=null;_diceLive.reported=false;_diceLive.tries=0;_diceLive.said=false;_diceLive.why=null;[].forEach.call(document.querySelectorAll('#dice-look-modal'),m=>m.remove());});
    const unstash=()=>page.evaluate(()=>{const d=window.__dl;window.DiceSim=d.sim;window.reportError=d.report;window.showToast=d.toast;console.warn=d.warn;if(d.refusal)window.diceLivePageRefusal=d.refusal;
      _diceLive.state=d.state;_diceLive.overlay=d.overlay;_diceLive.reported=d.reported;_diceLive.tries=0;_diceLive.said=false;_diceLive.why=null;[].forEach.call(document.querySelectorAll('#dice-look-modal'),m=>m.remove());});
    await check('B60 a page opened as a local file refuses the dice before the module is asked for: nothing is fetched, nothing is reported to the bug feed, the console says why, the first roll says it once on screen, and Dice appearance names the cause',async()=>{
      assert.equal(await page.evaluate(()=>typeof diceLivePageRefusal),'function','the one refusal rule');
      const pure=await page.evaluate(()=>({file:diceLivePageRefusal('file:'),http:diceLivePageRefusal('http:'),https:diceLivePageRefusal('https:'),here:diceLivePageRefusal()}));
      assert.match(String(pure.file),/hosted game or localhost/);assert.equal(pure.http,null,'localhost keeps its dice');assert.equal(pure.https,null);assert.equal(pure.here,null,'this page is http');
      await stash();
      try{
        const r=await page.evaluate(()=>{const real=window.diceLivePageRefusal;window.diceLivePageRefusal=function(){return real('file:');};_diceLive.state='idle';
          const tags=()=>document.querySelectorAll('script[src*="roller/embed/global.js"]').length,before=tags();diceLivePreload();
          const o={state:_diceLive.state,tags:tags()-before,reports:__reports.length,warns:__warns.slice()};
          o.roll=showDiceRoll(5);o.present=diceLivePresent([{type:'d20'}],'x');o.roll2=showDiceRoll(6);o.toasts=__toasts.slice();o.reportsAfter=__reports.length;
          showDiceLookModal();o.list=document.getElementById('dice-look-list').textContent;return o;});
        assert.equal(r.state,'failed','the dice are off for this page');assert.equal(r.tags,0,'the module is never asked for');assert.equal(r.reports,0,'a local file is no crash: nothing goes to the bug feed');
        assert.equal(r.warns.filter(w=>/hosted game or localhost/.test(w)).length,1,'said once on the console: '+JSON.stringify(r.warns));
        assert.equal(r.roll,false);assert.equal(r.present,false);assert.equal(r.roll2,false);assert.equal(r.reportsAfter,0);
        assert.equal(r.toasts.length,1,'said once on screen, at the first roll: '+JSON.stringify(r.toasts));assert.match(r.toasts[0],/hosted game or localhost/);
        assert.match(r.list,/hosted game or localhost/,'Dice appearance names the page, not the device: '+r.list);
      }finally{await unstash();}
    });
    await check('B59 a dice start that fails at preload is not final: the report\'s detail is readable, the first roll tries again and the dice are thrown',async()=>{
      await stash();
      try{
        const r=await page.evaluate(()=>{const sim=window.DiceSim;window.__made=0;window.DiceSim=Object.assign({},sim,{createDiceOverlay:function(o){__made++;if(__made===1)throw new Error('context lost (injected)');return sim.createDiceOverlay(o);}});
          _diceLive.state='ready';diceLiveWarm();return {state:_diceLive.state,reports:__reports.slice(),toasts:__toasts.length};});
        assert.equal(r.state,'ready','one failed start does not switch the dice off for the session');assert.equal(r.reports.length,1,'reported');assert.match(r.reports[0].msg,/could not start \(context lost \(injected\)\)/);
        assert.equal(typeof r.reports[0].detail,'string','the detail is text, never an object the reporter prints as [object Object]');assert.match(r.reports[0].detail,/"at":"preload"/);assert.match(r.reports[0].detail,/"attempt":1/);
        assert.equal(r.toasts,0,'a preload failure the next roll may mend is not announced');
        assert.equal(await page.evaluate(()=>showDiceRoll(9)),true);
        await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:9';},null,{timeout:30000});
        const after=await page.evaluate(()=>({made:__made,reports:__reports.length,toasts:__toasts.length,overlay:diceLiveState().overlay}));
        assert.deepEqual(after,{made:2,reports:1,toasts:0,overlay:true},'the retry made the overlay and nothing more was said');
        await page.evaluate(()=>{document.getElementById('dice-layer').click();});await page.waitForFunction(()=>!diceLiveState().showing,null,{timeout:DISMISS_MS});
        await page.evaluate(()=>{try{_diceLive.overlay.clear();}catch(e){}const l=document.getElementById('dice-layer');if(l)l.innerHTML='';});
      }finally{await unstash();}
    });
    await check('B59 a device that cannot start the dice: three tries and no more, one report, the player told that rolls still count, and Dice appearance keeps its presets',async()=>{
      await stash();
      try{
        const r=await page.evaluate(()=>{window.__made=0;window.DiceSim=Object.assign({},window.DiceSim,{createDiceOverlay:function(){__made++;throw new Error('no context (injected)');}});
          _diceLive.state='ready';diceLiveWarm();const o={afterWarm:_diceLive.state};o.r1=showDiceRoll(3);o.after1=_diceLive.state;o.toasts1=__toasts.length;o.r2=showDiceRoll(4);o.after2=_diceLive.state;
          o.r3=showDiceRoll(5);o.p=diceLivePresent([{type:'d20'}],'x');o.made=__made;o.reports=__reports.length;o.toasts=__toasts.slice();
          showDiceLookModal();o.radios=document.querySelectorAll('#dice-look-list input[name="dice-look"]').length;o.list=document.getElementById('dice-look-list').textContent;
          document.getElementById('dice-look-test').style.display='';document.getElementById('dice-look-test').click();o.toastsAfterTest=__toasts.length;return o;});
        assert.equal(r.afterWarm,'ready');assert.equal(r.r1,true,'the first roll tries');assert.equal(r.after1,'ready','two failures are not yet final');assert.equal(r.toasts1,1,'the roll that showed no dice says so');
        assert.equal(r.after2,'failed','the third failure is final for this page');assert.equal(r.r3,false);assert.equal(r.p,false);
        assert.equal(r.made,3,'three starts and no more (each makes a canvas and a context): '+r.made);assert.equal(r.reports,1,'one report a session');
        assert.equal(r.toasts.length,2,'told at the first roll that showed nothing, and once more when it is final: '+JSON.stringify(r.toasts));assert.match(r.toasts[0],/this roll still counts/i);assert.match(r.toasts[1],/rolls still count/i);assert.match(r.toasts[1],/reload/i);
        assert.ok(r.radios>0,'the module loaded, so the presets are listed (the list was overwritten with "could not load"): '+r.list);
        assert.equal(r.toastsAfterTest,3,'Roll a test d20 says why nothing rolls instead of doing nothing');
      }finally{await unstash();}
    });
    await check('no page errors',async()=>{assert.deepEqual(errors,[]);});
  }finally{await browser.close();}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
