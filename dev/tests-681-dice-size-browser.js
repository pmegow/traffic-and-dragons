// #681: the real host frames dice about twice as large; a ready d20 and ten damage dice stay usable.
// TND_SHOT_DIR keeps rendered evidence. All requests are local fixtures; no account or model calls.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.TND_SHOT_DIR||path.join(os.tmpdir(),'tnd-dice-size');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.ttf':'font/ttf','.png':'image/png'};
let failed=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1150,height:900},serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='dice-size.test')return route.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:mime[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch{return route.fulfill({status:404,body:'not found'});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');localStorage.setItem('tnd_dice_exit_v1','none');});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://dice-size.test/index.html');await page.waitForFunction(()=>typeof showGame==='function');
 await page.evaluate(()=>{document.getElementById('api-screen').style.display='none';showGame();AudioMaster.setMuted(true);});
 await page.waitForFunction(()=>!!_diceLive.overlay);
 await page.evaluate(()=>_diceLive.overlay.view.warmUp());
 await page.evaluate(async()=>{const THREE=await import('three');window.dieBox=function(mesh){mesh.updateMatrixWorld(true);const a=mesh.geometry.attributes.position;const xs=[],ys=[];for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld).project(_diceLive.overlay.view.camera);xs.push(p.x);ys.push(p.y);}return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};};});
 const results=[];
 for(const [label,width,height]of [['desktop',1150,900],['phone',375,667]]){
  await page.setViewportSize({width,height});
  await check(label+' dice project at about twice their former width and height',async()=>{
   const r=await page.evaluate(()=>{const v=_diceLive.overlay.view;const layer=document.getElementById('dice-layer');layer.classList.add('on');v.o.supersample=false;v.resize();v.clear();v.show(v.bake({dice:['d20'],seed:77}));const d=v.dice[0].mesh;d.position.x=0;d.position.z=0;const actual={...v.tray},pose={...v.orbitPose};const enlarged=dieBox(d);v.setTray({...actual,width:.15,depth:.10});v.setOrbit({zoom:1});const old=dieBox(d);v.setTray(actual);v.setOrbit(pose);v.render();return {width:(enlarged.right-enlarged.left)/(old.right-old.left),height:(enlarged.bottom-enlarged.top)/(old.bottom-old.top),canvas:[v.renderer.domElement.width,v.renderer.domElement.height],tray:actual};});
   results.push({label,...r});await page.screenshot({path:path.join(out,'dice-size-'+label+'.png')});
   assert.ok(r.canvas.every(n=>n>=100),'visible canvas');assert.ok(r.width>=1.9&&r.width<=2.4,'width ratio '+r.width);assert.ok(r.height>=1.9&&r.height<=2.4,'height ratio '+r.height);
  });
  await check(label+' ready d20 remains entirely visible',async()=>{
   await page.evaluate(()=>{_diceLive.overlay.clear();diceLivePresent([{type:'d20'}]);});
   await page.waitForFunction(()=>!!_diceLive.overlay.presented,null,{timeout:30000});
   const b=await page.evaluate(()=>dieBox(_diceLive.overlay.view.dice[0].mesh));
   await page.screenshot({path:path.join(out,'dice-ready-'+label+'.png')});
   assert.ok(b.left>=-1.01&&b.right<=1.01&&b.top>=-1.01&&b.bottom<=1.01,'ready die bounds '+JSON.stringify(b));
  });
  await check(label+' forced d20 and the maximum ten damage dice land on requested faces and dismiss once',async()=>{
   await page.evaluate(()=>{window.__closed=0;showDiceRoll(17,{onClose:function(){__closed++;}});});
   await page.waitForFunction(()=>diceLiveState().last?.join()==='d20:17',null,{timeout:60000});
   await page.evaluate(()=>document.getElementById('dice-layer').click());
   await page.waitForFunction(()=>__closed===1&&!diceLiveState().showing);
   await page.evaluate(()=>{window.__damageClosed=0;showDamageRoll(12,[1,2,3,4,5,6,7,8,9,10],{onClose:function(){__damageClosed++;}});});
   await page.waitForFunction(()=>diceLiveState().last?.join()==='d12:1,d12:2,d12:3,d12:4,d12:5,d12:6,d12:7,d12:8,d12:9,d12:10',null,{timeout:60000});
   const boxes=await page.evaluate(()=>_diceLive.overlay.view.dice.map(d=>dieBox(d.mesh)));
   await page.screenshot({path:path.join(out,'dice-damage-'+label+'.png')});
   assert.equal(boxes.length,10);for(const b of boxes)assert.ok(b.left>=-1.01&&b.right<=1.01&&b.top>=-1.01&&b.bottom<=1.01,'damage die outside frame '+JSON.stringify(b));
   await page.evaluate(()=>document.getElementById('dice-layer').click());await page.waitForFunction(()=>__damageClosed===1&&!diceLiveState().showing);
  });
 }
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'dice-size.json'),JSON.stringify(results,null,2));
 await check('no page errors',async()=>assert.deepEqual(errors,[]));
}finally{await browser.close();}process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1});
