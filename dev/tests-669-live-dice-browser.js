// #669: the live dice in the real game page (dice-sim from roller/, through ui-dice.js) — a check's d20 lands on its face,
// the click dismisses it and runs onClose, the damage dice land on theirs, Car Mode skips, the master mute silences them,
// and File ▸ Settings ▸ Dice appearance changes the look (Bone by default).
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');let failed=0;
const TYPES={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.mp3':'audio/mpeg','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
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
    await page.waitForFunction(()=>!!window.DiceSim,null,{timeout:20000});

    await check('a check\'s d20 is thrown live and lands on the engine\'s face; the click dismisses it and runs onClose',async()=>{
      const shown=await page.evaluate(()=>{window.__closed=0;return showDiceRoll(17,{onClose:function(){window.__closed++;}});});
      assert.equal(shown,true);
      await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:17';},null,{timeout:30000});
      const s=await page.evaluate(()=>diceLiveState());
      assert.equal(s.showing,true,'the layer shows over the story');
      assert.equal(s.overlay,true,'one overlay');
      await page.evaluate(()=>document.getElementById('dice-layer').click());
      await page.waitForFunction(()=>window.__closed===1&&!diceLiveState().showing,null,{timeout:5000});
    });

    await check('the damage dice land on theirs, through the same overlay (one WebGL context for the session)',async()=>{
      const before=await page.evaluate(()=>document.querySelectorAll('#dice-layer canvas').length);
      assert.equal(await page.evaluate(()=>showDamageRoll(6,[3,5])),true);
      await page.waitForFunction(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d6:3,d6:5';},null,{timeout:30000});
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#dice-layer canvas').length),before,'no second canvas');
      await page.evaluate(()=>document.getElementById('dice-layer').click());
      await page.waitForFunction(()=>!diceLiveState().showing,null,{timeout:5000});
    });

    await check('faces outside their die, and Car Mode, show nothing',async()=>{
      const r=await page.evaluate(()=>{const out=[showDiceRoll(21),showDiceRoll(0),showDamageRoll(6,[7]),showDamageRoll(7,[1])];carMode=true;out.push(showDiceRoll(5));carMode=false;return out;});
      assert.deepEqual(r,[false,false,false,false,false]);
    });

    await check('the master mute silences the dice',async()=>{
      const m=await page.evaluate(()=>{AudioMaster.setMuted(true);const a=diceLiveState().muted;AudioMaster.setMuted(false);return [a,diceLiveState().muted];});
      assert.deepEqual(m,[true,false]);
    });

    await check('File ▸ Settings ▸ Dice appearance: Bone by default, a choice kept and worn',async()=>{
      const r=await page.evaluate(async()=>{
        const before=diceLiveState().look;
        showDiceLookModal();
        await new Promise(res=>setTimeout(res,200));
        const radios=[...document.querySelectorAll("#dice-look-list input[name='dice-look']")];
        const labels=radios.map(x=>x.parentNode.textContent);
        const checked=labels[radios.findIndex(x=>x.checked)];
        const carrara=radios[labels.findIndex(t=>/^6?Carrara/.test(t.replace(/\s+/g,'')))];
        carrara.checked=true;carrara.dispatchEvent(new Event('change'));
        await new Promise(res=>setTimeout(res,300));
        const kept=JSON.parse(localStorage.getItem('tnd_dice_look_v1'));
        document.getElementById('dice-look-done').click();
        return {before,checked,kept,menu:!!document.querySelector('[id$="dice-look"]')};
      });
      assert.equal(r.before,'Bone');
      assert.match(r.checked,/Bone/);
      assert.equal(r.kept.name,'Carrara');
      assert.equal(r.kept.style.finish,'marble');
      assert.equal(r.menu,true,'the Settings row is there');
    });

    // #670 (owner 2026-10-26): the dice leave by an exit — Smoke puff until the player picks; the damage dice roll as the d20 leaves.
    const until=`var until=async(f,ms)=>{const t=Date.now();while(!f()){if(Date.now()-t>(ms||30000))throw new Error('timed out: '+f);await new Promise(r=>setTimeout(r,40));}};`;
    await check('#670 a dismiss plays the exit (Smoke puff until the player picks): the story stays clickable while the dice go, the layer hides once they have gone',async()=>{
      const r=await page.evaluate(until+`(async()=>{
        const exit=diceLiveState().exit;
        showDiceRoll(9);
        await until(()=>{const s=diceLiveState();return s.last&&s.last.join()==='d20:9';});
        const layer=document.getElementById('dice-layer');
        layer.click();
        const going={leaving:layer.classList.contains('leaving'),pointer:getComputedStyle(layer).pointerEvents,showing:diceLiveState().showing,exiting:diceLiveState().exiting};
        await until(()=>!diceLiveState().showing,5000);
        return {exit,going,after:diceLiveState().exiting};
      })()`);
      assert.equal(r.exit,'smoke','Smoke puff until the player picks');
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
        await until(()=>!diceLiveState().showing,5000);
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
      assert.equal(r.options.join(', '),'none=None, burn=Burn out, smoke=Smoke puff, pit=Going down, fade=Fade, scurry=Scurry off, random=Random');
      assert.equal(r.selected,'smoke');
      assert.equal(r.kept,'none');
      assert.equal(r.worn,'none','the overlay wears it at once');
      assert.equal(r.exiting,0,'None: the dice go with the fade, no exit');
      assert.equal(r.unknown,'smoke','an exit the dice no longer have is replaced by the default');
    });

    await check('no page errors',async()=>{assert.deepEqual(errors,[]);});
  }finally{await browser.close();}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
