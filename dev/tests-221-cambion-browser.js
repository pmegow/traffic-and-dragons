// #221: drive creation and both portable-character surfaces with the retired ancestry.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');let failed=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
    await ctx.route('**/*',async route=>{
      const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();
      const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root+path.sep))return route.abort();
      try{return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(file)});}catch(e){return route.fulfill({status:404,body:'Not found'});}
    });
    const page=await ctx.newPage();await page.goto('http://127.0.0.1/index.html');
    await page.waitForFunction(()=>typeof confirmChar==='function');
    await check('Cambion creation retains Infernal and racial grants',async()=>{
      const result=await page.evaluate(()=>{
        document.getElementById("api-screen").style.display="none";showChar();cs=blankWizardState();cs.cls='Warrior';cs.name='Cambion Test';cs.bs={STR:12,DEX:12,CON:12,INT:12,WIS:12,CHA:12};
        goStep(2);buildAncGrid();const grid=document.getElementById('anc-grid').textContent;
        pickAnc(ANCS.findIndex(a=>a.id==='cambion'));pickSub(2);
        document.getElementById('char-name').value='Cambion Test';document.getElementById('rv-start-level').value='1';
        window.__created=null;startGame=function(c){window.__created=c;};confirmChar();
        return {grid,detail:document.getElementById('anc-detail-body').textContent,char:window.__created};
      });
      assert.match(result.grid,/Cambion/);assert.doesNotMatch(result.grid,/Tiefling/);
      assert.equal(result.char.ancestry,'Cambion');assert.equal(result.char.subrace,'fey_tie');assert.equal(result.char.stats.CHA,14);assert.equal(result.char.stats.INT,13);
      assert.ok(result.char.languages.some(l=>l.name==='Infernal'));
      assert.ok(result.char.spells.some(s=>s.nm==='Misty Step (1/day)'&&s.racial));
      assert.ok(result.char.abilities.some(s=>s.nm==='Hellish Rebuke (1/day)'&&s.racial));
      assert.ok(result.char.abilities.some(a=>a.nm==='Fire Resistance'&&a.racial));
      if(process.env.CAMBION_SCREENSHOT_DIR){fs.mkdirSync(process.env.CAMBION_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CAMBION_SCREENSHOT_DIR,'cambion-creation.png')});}
    });
    await check('portable import preview migrates the ancestry before acceptance',async()=>{
      const result=await page.evaluate(()=>{const c=JSON.parse(JSON.stringify(window.__created));c.ancestry='Tiefling';c.subraceNm='';showCharImportPreview(c,function(){},function(){});return {ancestry:c.ancestry,text:document.getElementById('char-import-preview').textContent};});
      assert.equal(result.ancestry,'Cambion');assert.match(result.text,/Cambion/);assert.doesNotMatch(result.text,/Tiefling/);
    });
    await page.goto('http://127.0.0.1/character_editor.html');await page.waitForFunction(()=>!!window.__ceTest);
    await check('editor imports old name and id with Cambion visibly selected',async()=>{
      for(const old of ['Tiefling','tiefling']){
        const result=await page.evaluate(old=>{const c=__ceTest.blank();c.name='Old Cambion';c.ancestry=old;c.subrace='fey_tie';__ceTest.load({type:'character',character:c});const el=document.getElementById('f-ancestry');return {selected:el.selectedOptions[0].textContent,out:__ceTest.out().character};},old);
        if(process.env.CAMBION_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.CAMBION_SCREENSHOT_DIR,'cambion-editor-'+old+'.png')});
        assert.equal(result.selected,'Cambion');assert.equal(result.out.ancestry,old==='Tiefling'?'Cambion':'cambion');assert.equal(result.out.subrace,'fey_tie');
      }
      if(process.env.CAMBION_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.CAMBION_SCREENSHOT_DIR,'cambion-editor.png')});
    });
  }finally{await browser.close();}
  process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
