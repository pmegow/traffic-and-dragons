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

    await check('no page errors',async()=>{assert.deepEqual(errors,[]);});
  }finally{await browser.close();}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
