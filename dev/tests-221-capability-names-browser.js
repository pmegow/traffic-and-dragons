// #221: real edits, partial file round trips, corrupt imports, and exact Bible-card destinations.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-names-'));
for(const file of ['capability-names.html','capability_bible.js','data.js'])fs.copyFileSync(path.join(root,file),path.join(scratch,file));
const store=require('./capability-names-store.js').createStore(scratch);
let failed=0,downloads=0,refuseSave=false,holdSave=null;
async function savePage(page){await page.waitForFunction(()=>!document.getElementById('save').disabled);await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('file-state').textContent.indexOf('Saved capability-names.json')===0);return JSON.parse(store.read().text);}
async function check(name,fn){try{await fn();console.log('PASS #221 '+name);}catch(e){failed++;console.error('FAIL #221 '+name+' — '+e.message);}}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
    await ctx.route('**/*',async route=>{
      const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
      if(u.pathname==='/capability-names'){
        if(holdSave&&route.request().method()==='POST')await holdSave;
        try{if(refuseSave&&route.request().method()==='POST')throw Error('Simulated disk failure');const result=route.request().method()==='POST'?store.write(route.request().postDataJSON()):store.read();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});}
        catch(e){return route.fulfill({status:e.status||422,contentType:'application/json',body:JSON.stringify({ok:false,output:e.message})});}
      }
      const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))return route.abort();
      try{return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(file)});}
      catch(e){return route.fulfill({status:404,body:'Not found'});}
    });
    const page=await ctx.newPage(),errors=[];
    page.on('download',()=>downloads++);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto('http://127.0.0.1/capability-names.html');
    await page.waitForFunction(()=>document.querySelector('#names input')&&!document.getElementById('save').disabled);
    const originals=await page.evaluate(()=>Object.keys(CAPABILITY_BIBLE).sort());
    const first='#names tr:first-child input',second='#names tr:nth-child(2) input';
    await check('every real capability starts blank and drafts can save',async()=>{
      const s=await page.evaluate(()=>({names:[...document.querySelectorAll('#names .cap-name')].map(a=>a.textContent),blank:[...document.querySelectorAll('#names input')].every(e=>e.value===''),disabled:document.getElementById('save').disabled,count:document.getElementById('count').textContent}));
      assert.deepEqual(s.names,await page.evaluate(()=>Object.keys(CAPABILITY_BIBLE).sort().map(CapabilityNames.titleName)));assert.ok(s.blank);assert.equal(s.disabled,false);assert.match(s.count,/0 of/);
    });
    await check('middle copy buttons keep one original explicitly and persist the choice',async()=>{
      assert.equal(await page.locator('#names .keep-name').count(),originals.length,'one copy button per row');
      await page.locator(first).fill('An earlier choice');
      await page.locator('#names tr:first-child .keep-name').click();
      assert.equal(await page.locator(first).inputValue(),'A Call to Arms');
      assert.equal(await page.locator(second).inputValue(),'');
      assert.match(await page.locator('#count').textContent(),/1 of .* · 0 renamed/);
      assert.ok(await page.evaluate(()=>document.activeElement===document.querySelector('#names input')));
      const saved=await savePage(page);assert.equal(saved.names[0].from,originals[0]);assert.equal(saved.names[0].to,'A Call to Arms');assert.equal(saved.readyToApply,false);
      await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);
      assert.equal(await page.locator(first).inputValue(),'A Call to Arms');
      assert.equal(await page.locator(second).inputValue(),'');
      for(const width of [1150,320]){
        await page.setViewportSize({width,height:850});
        const placement=await page.evaluate(()=>{const row=document.querySelector('#names tr'),cells=row.cells,button=row.querySelector('.keep-name').getBoundingClientRect();return {cells:cells.length,middle:cells[1].contains(row.querySelector('.keep-name')),left:cells[0].getBoundingClientRect().right,right:cells[2].getBoundingClientRect().left,x:button.left,end:button.right,width:innerWidth,scroll:document.documentElement.scrollWidth};});
        assert.equal(placement.cells,3);assert.ok(placement.middle);assert.ok(placement.x>=placement.left&&placement.end<=placement.right,JSON.stringify(placement));assert.ok(placement.scroll<=width,JSON.stringify(placement));
        if(process.env.NAMES_SCREENSHOT_DIR){fs.mkdirSync(process.env.NAMES_SCREENSHOT_DIR,{recursive:true});await page.evaluate(()=>document.querySelector('#names').scrollIntoView({block:'start'}));await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-copy-'+width+'.png')});}
      }
      await page.setViewportSize({width:1150,height:900});
    });
    await check('new-name fields enable English spellchecking',async()=>{
      assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('#names input')).every(e=>e.spellcheck&&e.lang==='en')));
    });
    await check('unfinished edits survive reload and project save',async()=>{
      await page.locator(first).fill('Ashen Memory');await page.reload();
      assert.equal(await page.locator(first).inputValue(),'Ashen Memory');
      const exported=await savePage(page);
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
      const result=await savePage(page);
      assert.equal(result.readyToApply,true);assert.equal(result.names.length,originals.length);
      assert.equal(result.names[1].from,result.names[1].to);
      await page.locator(first).fill('');
      assert.match(await page.locator('#readiness').textContent(),/Draft/);
      await page.locator('#search').fill(originals[originals.length-1]);
      assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#names tr')].filter(r=>!r.hidden).length<10));
      await page.locator('#search').fill('');
    });
    await check('original names open the game card in one modal without navigation',async()=>{
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#names a[target]').length),0,'names still open separate tabs');
      await page.locator(first).fill('Draft remains here');
      const before=await page.evaluate(()=>({url:location.href,draft:localStorage.getItem('tnd_capability_names_v1')}));
      await page.locator('#names tr:first-child .cap-name').click();
      const card=await page.evaluate(name=>{
        const modal=document.getElementById('name-card-modal'),expected=document.createElement('div');expected.innerHTML=bibleCardHTML(name,CAPABILITY_BIBLE[name]);
        return {count:document.querySelectorAll('[role="dialog"]').length,html:document.getElementById('name-card-content').innerHTML,
          expected:expected.innerHTML,focused:modal.contains(document.activeElement),url:location.href,draft:localStorage.getItem('tnd_capability_names_v1')};
      },originals[0]);
      assert.equal(card.count,1);assert.equal(card.html,card.expected);assert.ok(card.focused);assert.equal(card.url,before.url);assert.equal(card.draft,before.draft);
      await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
      assert.ok(await page.evaluate(()=>document.getElementById('name-card-modal').contains(document.activeElement)));
      await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#name-card-modal').length),0);
      assert.ok(await page.evaluate(()=>document.activeElement===document.querySelector('#names .cap-name')));
      await page.locator('#names tr:last-child .cap-name').click();
      assert.equal(await page.locator('#name-card-content').textContent(),await page.evaluate(name=>{
        const div=document.createElement('div');div.innerHTML=bibleCardHTML(name,CAPABILITY_BIBLE[name]);return div.textContent;
      },originals[originals.length-1]));
      await page.locator('#name-card-close').click();
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#name-card-modal').length),0);
      assert.equal(await page.locator(first).inputValue(),'Draft remains here');
      await page.evaluate(()=>{document.querySelector('#names .cap-name').click();document.querySelector('#names .cap-name').click();});
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#name-card-modal').length),1);
      await page.evaluate(()=>document.getElementById('name-card-modal').click());
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#name-card-modal').length),0);
    });
    await check('long game cards fit a narrow viewport and keep the close button reachable',async()=>{
      await page.setViewportSize({width:320,height:360});
      const longest=await page.evaluate(()=>Object.keys(CAPABILITY_BIBLE).sort((a,b)=>CAPABILITY_BIBLE[b].effect.length-CAPABILITY_BIBLE[a].effect.length)[0]);
      await page.locator('#search').fill(longest);
      await page.evaluate(name=>[...document.querySelectorAll('#names .cap-name')].find(b=>b.textContent===CapabilityNames.titleName(name)).click(),longest);
      const size=await page.evaluate(()=>{const box=document.getElementById('name-card-modal').firstChild,close=document.getElementById('name-card-close').getBoundingClientRect(),r=box.getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scrollWidth:box.scrollWidth,clientWidth:box.clientWidth,scrollHeight:box.scrollHeight,clientHeight:box.clientHeight,closeTop:close.top,closeBottom:close.bottom};});
      assert.ok(size.left>=0&&size.right<=size.width&&size.top>=0&&size.bottom<=size.height,JSON.stringify(size));
      assert.ok(size.scrollWidth<=size.clientWidth,JSON.stringify(size));assert.ok(size.scrollHeight>size.clientHeight,"long card must scroll inside the modal");assert.ok(size.closeTop>=0&&size.closeBottom<=size.height);
      if(process.env.NAMES_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-card-mobile.png')});
      await page.evaluate(()=>{const box=document.getElementById('name-card-modal').firstChild;box.scrollTop=box.scrollHeight;});
      if(process.env.NAMES_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-card-mobile-scrolled.png')});
      await page.locator('#name-card-close').click();await page.setViewportSize({width:1150,height:900});
      await page.evaluate(name=>[...document.querySelectorAll('#names .cap-name')].find(b=>b.textContent===CapabilityNames.titleName(name)).click(),longest);
      if(process.env.NAMES_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-card-desktop.png')});
      await page.locator('#name-card-close').click();await page.locator('#search').fill('');
    });
    await check('Bible links reveal the exact card even after filtering',async()=>{
      const links=originals.map(name=>'http://127.0.0.1/bible_study.html#'+encodeURIComponent('capability-'+name));
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
    await check('storage refusal is visible and project Save remains available',async()=>{
      const blocked=await ctx.newPage();await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Simulated quota failure');};});
      await blocked.goto('http://127.0.0.1/capability-names.html');
      await blocked.waitForFunction(()=>!document.getElementById('save').disabled);
      await blocked.locator(first).fill('Portable Choice');
      assert.match(await blocked.locator('#notice').textContent(),/storage is unavailable or full/i);
      assert.equal((await savePage(blocked)).names[0].to,'Portable Choice');
    });
    await check('usage appears by tier and is searchable by race or class',async()=>{
      await page.locator('#search').fill('faerie fire');
      const label=await page.evaluate(()=>[...document.querySelectorAll('#names tr')].find(r=>r.querySelector('.cap-name').textContent==='Faerie Fire').querySelector('.kind').textContent);
      assert.match(label,/Spell \/ Racial Ability/);assert.match(label,/Druid/);assert.match(label,/Half-Elven \(Drow\)/);
      await page.locator('#search').fill('Primal (Totemborn)');assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#names tr')].filter(r=>!r.hidden).length>0));
      await page.locator('#search').fill('');
    });
    await check('failed project saves preserve the file and create no Downloads copy',async()=>{
      await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);
      const before=store.read().text;await page.locator(first).fill('Still in my draft');refuseSave=true;
      await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('notice').textContent.indexOf('Save failed')>=0);refuseSave=false;
      assert.equal(store.read().text,before);assert.equal(await page.locator(first).inputValue(),'Still in my draft');assert.equal(downloads,0);
      await savePage(page);
      await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);
      assert.equal(await page.locator(first).inputValue(),'Still in my draft');
    });
    await check('edits typed during a save remain an unsaved recoverable draft',async()=>{
      let release;holdSave=new Promise(resolve=>release=resolve);await page.locator(first).fill('Earlier edit');await page.locator('#save').click();
      await page.locator(first).fill('Later edit');release();holdSave=null;
      await page.waitForFunction(()=>document.getElementById('file-state').textContent.indexOf('newer edits')>=0);
      assert.equal(JSON.parse(store.read().text).names[0].to,'Earlier edit');await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);
      assert.equal(await page.locator(first).inputValue(),'Later edit');
    });
    if(process.env.NAMES_SCREENSHOT_DIR){await page.locator(first).fill('Ashen Memory');await page.screenshot({path:path.join(process.env.NAMES_SCREENSHOT_DIR,'names-desktop.png')});console.log('Screenshots: '+process.env.NAMES_SCREENSHOT_DIR);}
    await check('no unexpected browser exceptions',async()=>assert.deepEqual(errors,[]));
  }finally{await browser.close();fs.rmSync(scratch,{recursive:true,force:true});}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
