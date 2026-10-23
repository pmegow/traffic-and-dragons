const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),pages=require('./theme-pages.js')(root);
const shots=process.env.THEME_SHOTS,only=process.argv.includes('--focused');
let failed=0,passed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS #664 '+name);}catch(e){failed++;console.error('FAIL #664 '+name+' — '+e.message);}}
async function read(page){return page.evaluate(()=>({theme:document.documentElement.dataset.theme,scheme:getComputedStyle(document.documentElement).colorScheme,bg:getComputedStyle(document.body).backgroundColor,fg:getComputedStyle(document.body).color}));}
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='theme.test')return route.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json'})[path.extname(f)]||'text/plain',body:fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}});
 const page=await ctx.newPage(),peer=await ctx.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push({file:currentFile,message:e.message}));await peer.goto('http://theme.test/faq.html');
 let currentFile='';const results=[];
 for(const file of (only?['home.html','blueprint-designer.html','bible_study.html','map_viewer.html','website/index.html']:pages)){
  currentFile=file;const modes={};
  await check(file+' applies its preference before styles',async()=>{
   if(file==='index.html')return; // Its cache-first inline bootstrap is pinned by the theme palette contract.
   const head=fs.readFileSync(path.join(root,file),'utf8').split('</head>')[0],script=head.match(/<script src="([^"]*game-theme\.js)"><\/script>/);
   assert.ok(script,'shared controller in head');assert.ok(head.indexOf(script[0])<head.search(/<link[^>]*rel="stylesheet"|<style/),'theme before styles');assert.equal(path.resolve(root,path.dirname(file),script[1]),path.join(root,'website','game-theme.js'));
  });
  for(const mode of ['light','dark']){
   await peer.evaluate(mode=>localStorage.setItem('tnd_theme_v1',mode),mode);
   await page._send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode==='light'?'dark':'light'}]});
   await page.goto('http://theme.test/'+file);await page.waitForTimeout(150);
   modes[mode]=await read(page);
   if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,file.replace(/\W/g,'_')+'-'+mode+'.png')});}
   await check(file+' saved '+mode+' wins over device preference',async()=>{assert.equal(modes[mode].theme,mode);assert.equal(modes[mode].scheme,mode);});
  }
  await check(file+' paints both palettes',async()=>{assert.notEqual(modes.light.bg,modes.dark.bg);assert.notEqual(modes.light.fg,modes.dark.fg);});
  await check(file+' follows the game in another tab',async()=>{await page.evaluate(()=>window.themeBody=document.body);await peer.evaluate(()=>localStorage.setItem('tnd_theme_v1','light'));await page.waitForTimeout(100);assert.equal((await read(page)).theme,'light');assert.ok(await page.evaluate(()=>window.themeBody===document.body),'theme changes preserve the DOM');});
  results.push({file,...modes});
 }

 await check('public site follows the device with no saved choice',async()=>{
  await peer.evaluate(()=>localStorage.removeItem('tnd_theme_v1'));await page.goto('http://theme.test/website/index.html');
  for(const mode of ['light','dark']){await page._send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});await page.waitForTimeout(100);assert.equal((await read(page)).theme,mode);}
 });
 await check('dialog surfaces and primary labels follow both palettes',async()=>{
  await page.goto('http://theme.test/index.html');await page.waitForFunction(()=>typeof showRespawnModal==='function');
  for(const mode of ['light','dark']){
   await peer.evaluate(mode=>localStorage.setItem('tnd_theme_v1',mode),mode);await page.waitForTimeout(100);
   assert.equal((await read(page)).theme,mode,'game follows the other tab');
   for(const [open,id] of [['showRespawnModal','respawn-modal'],['showOnwardConfirmModal','onward-modal'],['showCampaignEndedModal','ended-modal']]){
    const appearance=await page.evaluate(({open,id})=>{window[open]({camp:'Test camp',respawn:1},'test');const box=document.querySelector('#'+id+'>div'),button=box.querySelector('button:last-child');const token=document.createElement('div');token.style.cssText='background:var(--modal-bg);color:var(--on-acc)';document.body.appendChild(token);const result={bg:getComputedStyle(box).backgroundColor,want:getComputedStyle(token).backgroundColor,ink:getComputedStyle(button).color,wantInk:getComputedStyle(token).color};token.remove();return result;},{open,id});
    if(shots)await page.screenshot({path:path.join(shots,id+'-'+mode+'.png')});
    assert.equal(appearance.bg,appearance.want,id+' '+mode+' surface');assert.equal(appearance.ink,appearance.wantInk,id+' '+mode+' button');
    await page.evaluate(id=>document.getElementById(id).remove(),id);
   }
  }
 });
 await check('character wizard controls follow both palettes',async()=>{
  await page.goto('http://theme.test/index.html');await page.waitForFunction(()=>typeof showCreationStatBump==='function');
  await page.evaluate(()=>{document.querySelectorAll('#api-screen,#char-screen,#game-screen').forEach(e=>e.style.display='none');pendingChar={cls:'Warrior',level:4,stats:{STR:12,DEX:12,CON:12,INT:12,WIS:12,CHA:12}};pendingBumps=1;currentBump=1;showCreationStatBump();});
  for(const mode of ['light','dark']){
   await peer.evaluate(mode=>localStorage.setItem('tnd_theme_v1',mode),mode);await page.waitForTimeout(100);
   const colors=await page.evaluate(()=>{const b=document.querySelector('#creation-bump button'),primary=document.querySelector('#creation-bump button[onclick="cbConfirm()"]');return {bg:getComputedStyle(b).backgroundColor,fg:getComputedStyle(primary).color};});
   if(shots)await page.screenshot({path:path.join(shots,'wizard-'+mode+'.png')});
   assert.equal(colors.bg,mode==='light'?'rgb(246, 237, 207)':'rgb(27, 30, 39)','stat buttons use the themed surface');assert.equal(colors.fg,mode==='light'?'rgb(255, 245, 217)':'rgb(0, 0, 0)','wizard primary label follows the accent');
  }
 });
 await check('map nodes and standalone SVG preserve the selected palette',async()=>{
  await page.goto('http://theme.test/map_viewer.html');
  await page.evaluate(()=>__mapTest.load({memory:{map:{nodes:{Harbor:{description:'A busy harbor'},Road:{description:'A winding road'}},edges:[{from:'Harbor',to:'Road'}]}},worldState:{world:{location:'Harbor'},character:{name:'Rin'}}}));
  for(const mode of ['light','dark']){
   await peer.evaluate(mode=>localStorage.setItem('tnd_theme_v1',mode),mode);await page.waitForTimeout(100);
   const svg=await page.evaluate(()=>__mapTest.exportSVG('Theme check'));assert.ok(svg.includes('Harbor'));assert.ok(!svg.includes('var(--'),'export resolves palette variables without the app stylesheet');
   if(shots)await page.screenshot({path:path.join(shots,'map-populated-'+mode+'.png')});
  }
 });
 await check('compiled preview follows the app while the export remains standalone',async()=>{
  await page.goto('http://theme.test/story_compiler.html');
  await page.evaluate(()=>{__storyTest.load({worldState:{campName:'Theme check',character:{name:'Rin'},turn:1,transcript:[{r:'gm',t:1,x:'The harbor lights shimmer across the water.'}]}});document.getElementById("compile").click();});
  await page.waitForFunction(()=>document.getElementById('preview').contentDocument.body.textContent.includes('harbor lights'));
  for(const mode of ['light','dark']){
   await peer.evaluate(mode=>localStorage.setItem('tnd_theme_v1',mode),mode);await page.waitForTimeout(100);
   const preview=await page.evaluate(()=>{const d=document.getElementById('preview').contentDocument;return {text:d.body.textContent,theme:d.documentElement.getAttribute('data-theme'),bg:d.defaultView.getComputedStyle(d.body).backgroundColor};});
   assert.ok(preview.text.includes('harbor lights'),'compiled content exists');assert.equal(preview.theme,mode,'preview follows explicit choice');assert.equal(preview.bg,mode==='light'?'rgb(234, 221, 185)':'rgb(19, 21, 28)');
   if(shots)await page.screenshot({path:path.join(shots,'story-populated-'+mode+'.png')});
  }
  assert.ok(!(await page.evaluate(()=>__storyTest.doc())).includes('website/game-theme.js'),'download is self-contained');
 });
 // test.html deliberately executes the legacy engine harness without the game DOM. The unchanged
 // HEAD page also throws in game.js sendAction and reports 176 harness failures / 3005 passes.
 // Its appearance is covered here; node dev/run-tests.js remains the authoritative engine gate.
 await check('no unexpected uncaught page errors',async()=>assert.deepEqual(pageErrors.filter(e=>!(e.file==='test.html'&&e.message==="Cannot set properties of null (setting 'value')")),[]));
 if(shots)fs.writeFileSync(path.join(shots,'results.json'),JSON.stringify(results,null,2));
 console.log('#664 themes: '+passed+' passed, '+failed+' failed ('+results.length+' pages)');process.exitCode=failed?1:0;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
