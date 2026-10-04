// #221: real edits, partial file round trips, corrupt imports, and exact Bible-card destinations.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-names-'));
let failed=0;
async function check(name,fn){try{await fn();console.log('PASS #221 '+name);}catch(e){failed++;console.error('FAIL #221 '+name+' — '+e.message);}}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
    await ctx.route('**/*',async route=>{
      const u=new URL(route.request().url());if(u.hostname!=='names.test')return route.abort();
      const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))return route.abort();
      try{return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(file)});}
      catch(e){return route.fulfill({status:404,body:'Not found'});}
    });
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto('http://names.test/capability-names.html');
    await page.waitForFunction(()=>document.querySelector('#names input'));
    const originals=await page.evaluate(()=>Object.keys(CAPABILITY_BIBLE).sort());
    const first='#names tr:first-child input',second='#names tr:nth-child(2) input';
    await check('every real capability starts blank and drafts can export',async()=>{
      const s=await page.evaluate(()=>({names:[...document.querySelectorAll('#names a')].map(a=>a.textContent),blank:[...document.querySelectorAll('#names input')].every(e=>e.value===''),disabled:document.getElementById('export').disabled,count:document.getElementById('count').textContent}));
      assert.deepEqual(s.names,originals);assert.ok(s.blank);assert.equal(s.disabled,false);assert.match(s.count,/0 of/);
    });
    await check('unfinished edits survive reload and file export',async()=>{
      await page.locator(first).fill('Ashen Memory');await page.reload();
      assert.equal(await page.locator(first).inputValue(),'Ashen Memory');
      const download=page.waitForEvent('download');await page.locator('#export').click();
      const exported=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
      assert.equal(exported.readyToApply,false);assert.equal(exported.names.length,originals.length);
      assert.equal(exported.names[0].to,'Ashen Memory');assert.equal(exported.names[1].to,'');
      fs.writeFileSync(path.join(scratch,'partial.json'),JSON.stringify(exported));
      await page.locator(first).fill('A later choice');
      await page.locator('#import-file').setInputFiles(path.join(scratch,'partial.json'));
      await page.waitForFunction(()=>document.querySelector('#names input').value==='Ashen Memory');
      assert.equal(await page.locator(second).inputValue(),'');
    });
    await check('invalid import preserves the current choices visibly',async()=>{
      fs.writeFileSync(path.join(scratch,'bad.json'),'{"names":[]}');
      await page.locator('#import-file').setInputFiles(path.join(scratch,'bad.json'));
      await page.waitForFunction(()=>document.getElementById('notice').textContent.indexOf('Import stopped')>=0);
      assert.equal(await page.locator(first).inputValue(),'Ashen Memory');
    });
    await check('literal text stays text and normalized duplicates prevent readiness',async()=>{
      await page.locator(first).fill('<img src=x onerror=alert(1)>');
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#names img').length),0);
      await page.locator(first).fill('Ashen Memory');await page.locator(second).fill('ASHEN MEMORY (Tier 2)');
      assert.equal(await page.locator(first).getAttribute('aria-invalid'),'true');
      assert.equal(await page.locator(second).getAttribute('aria-invalid'),'true');
      assert.match(await page.locator('#readiness').textContent(),/Draft/);
      // Narrow viewport plus a long input is the overflow case, not an empty benign page.
      await page.setViewportSize({width:320,height:850});
      const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(bounds.scroll<=bounds.width,'horizontal overflow: '+JSON.stringify(bounds));
      if(process.env.NAMES_SCREENSHOT_DIR){fs.mkdirSync(process.env.NAMES_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-mobile.png')});}
      await page.setViewportSize({width:1150,height:900});
    });
    await check('complete import includes explicit unchanged names and permits review',async()=>{
      const data=await page.evaluate(()=>({format:'traffic-and-dragons/capability-names/v1',names:Object.keys(CAPABILITY_BIBLE).sort().map(from=>({from,to:from}))}));
      data.names[0].to='Ashen Memory';
      fs.writeFileSync(path.join(scratch,'complete.json'),JSON.stringify(data));
      await page.locator('#import-file').setInputFiles(path.join(scratch,'complete.json'));
      await page.waitForFunction(()=>document.getElementById('readiness').textContent.indexOf('Ready for implementation')===0);
      assert.equal(await page.locator(second).inputValue(),originals[1]);
      const download=page.waitForEvent('download');await page.locator('#export').click();
      const result=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
      assert.equal(result.readyToApply,true);assert.equal(result.names.length,originals.length);
      assert.equal(result.names[1].from,result.names[1].to);
      await page.locator(first).fill('');
      assert.match(await page.locator('#readiness').textContent(),/Draft/);
      await page.locator('#search').fill(originals[originals.length-1]);
      assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#names tr')].filter(r=>!r.hidden).length<10));
      await page.locator('#search').fill('');
    });
    await check('Bible links reveal the exact card even after filtering',async()=>{
      const links=await page.evaluate(()=>[...document.querySelectorAll('#names a')].map(a=>a.href));
      const reference=await ctx.newPage();reference.on('pageerror',e=>errors.push(e.message));
      await reference.goto(links[0]);
      assert.equal(await reference.evaluate(()=>document.activeElement.id),'capability-'+originals[0]);
      await reference.locator('#q').fill('no such capability zzz');
      await reference.evaluate(h=>{location.hash=new URL(h).hash;},links[links.length-1]);
      await reference.waitForFunction(()=>document.getElementById('q').value==='');
      const target=await reference.evaluate(()=>({id:document.activeElement.id,top:document.activeElement.getBoundingClientRect().top,bottom:document.activeElement.getBoundingClientRect().bottom,height:innerHeight}));
      assert.equal(target.id,'capability-'+originals[originals.length-1]);assert.ok(target.top>=0&&target.bottom<=target.height);
      if(process.env.NAMES_SCREENSHOT_DIR)await reference.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'bible-card.png')});
    });
    await check('storage refusal is visible and draft export remains available',async()=>{
      const blocked=await ctx.newPage();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Simulated quota failure');};});
      await blocked.goto('http://names.test/capability-names.html');
      await blocked.locator(first).fill('Portable Choice');
      assert.match(await blocked.locator('#notice').textContent(),/storage is unavailable or full/i);
      const download=blocked.waitForEvent('download');await blocked.locator('#export').click();
      assert.equal(JSON.parse(fs.readFileSync(await (await download).path(),'utf8')).names[0].to,'Portable Choice');
    });
    if(process.env.NAMES_SCREENSHOT_DIR){await page.locator(first).fill('Ashen Memory');await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-desktop.png')});console.log('Screenshots: '+process.env.NAMES_SCREENSHOT_DIR);}
    await check('no unexpected browser exceptions',async()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();fs.rmSync(scratch,{recursive:true,force:true});}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
