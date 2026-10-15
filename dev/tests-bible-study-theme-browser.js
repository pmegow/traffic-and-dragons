const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.BIBLE_THEME_SCREENSHOT_DIR;
let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS Bible theme: '+name);}catch(e){failed++;console.error('FAIL Bible theme: '+name+' — '+e.message);}}
async function scheme(page,value){await page._send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value}]});}
async function snapshot(page,name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png')});}}
async function appearance(page){return page.evaluate(()=>({theme:document.documentElement.getAttribute('data-theme'),scheme:getComputedStyle(document.documentElement).colorScheme,bg:getComputedStyle(document.body).backgroundColor,count:document.querySelectorAll('.card').length}));}
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='bible.test')return route.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['light','dark'])await check('initial '+mode+' preference paints the shared palette',async()=>{
  await scheme(page,mode);await page.goto('http://bible.test/bible_study.html');await page.waitForFunction(()=>document.querySelector('.card'));
  await snapshot(page,'bible-'+mode);const s=await appearance(page);assert.ok(s.count>20,'reference content loaded');assert.equal(s.theme,mode);assert.equal(s.scheme,mode);
 });
 await check('a preference change repaints without losing filter or card nodes',async()=>{
  await page.locator('#q').fill('fire');await page.evaluate(()=>window.themeProbeCard=document.querySelector('.card'));const dark=await appearance(page);
  await scheme(page,'light');await page.waitForFunction(()=>matchMedia('(prefers-color-scheme: light)').matches);await new Promise(r=>setTimeout(r,100));
  const light=await appearance(page);assert.equal(light.theme,'light');assert.notEqual(light.bg,dark.bg);assert.equal(await page.locator('#q').inputValue(),'fire');assert.ok(await page.evaluate(()=>window.themeProbeCard===document.querySelector('.card')));
  await scheme(page,'dark');await page.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='dark');assert.equal((await appearance(page)).bg,dark.bg);
 });
 await check('light-mode semantic badges remain readable',async()=>{
  // Isolate palette contrast even when automatic theme selection itself is broken.
  await scheme(page,'light');await page.evaluate(()=>{document.documentElement.setAttribute('data-theme','light');document.getElementById('q').value='';render('');});
  const ratios=await page.evaluate(()=>{
   function rgba(c){return c.match(/[\d.]+/g).map(Number);}
   function blend(a,b){const x=a.length===4?a[3]:1;return a.slice(0,3).map((v,i)=>v*x+b[i]*(1-x));}
   function lum(c){return c.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
   return ['magical','trained only','hard untrained'].map(label=>{const el=Array.from(document.querySelectorAll('.card span')).find(e=>e.textContent.replace('✦','').trim()===label||e.textContent.replace('✧','').trim()===label||e.textContent.endsWith(' '+label));if(!el)throw Error('Missing badge '+label);const s=getComputedStyle(el),bg=blend(rgba(s.backgroundColor),rgba(getComputedStyle(el.closest('.card')).backgroundColor)),a=lum(rgba(s.color)),b=lum(bg);return {label,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  });
  await snapshot(page,'bible-light-badges');for(const r of ratios)assert.ok(r.ratio>=4.5,r.label+' contrast '+r.ratio.toFixed(2));
 });
 assert.deepEqual(errors,[],'page errors');console.log('Bible theme: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
