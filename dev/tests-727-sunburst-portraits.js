// Executes the shared portrait transport; no paid provider calls.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({console,setTimeout,clearTimeout});
['globals.js','helpers.js','ui-portrait.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}));
let checks=0,failures=0;
async function test(name,fn){try{await fn();checks++;console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+' — '+e.message);}}
const sun='openai/gpt-image-2.6/sunburst/text-to-image';
(async()=>{
 await test('#727 slow portrait models use one queued request with portrait framing',async()=>{
  const models=ctx.RENDER_MODELS.filter(m=>m.slow);assert(models.some(m=>m.id===sun),'Sunburst missing');assert(models.some(m=>m.id==='openai/gpt-image-2.5/flare/text-to-image'),'Flare missing');
  for(const m of models){let calls=[];ctx.renderModel=m.id;ctx.falFetch=async()=>{throw Error('Sync transport used for slow model');};ctx.falQueueRender=async(id,body)=>{calls.push({id,body});return {images:[{url:'https://image.test/portrait.png'}]};};
   assert.equal(await ctx.generatePortraitImage('Human face, fox ears.'),'https://image.test/portrait.png');assert.equal(calls.length,1);assert.equal(calls[0].id,m.id);assert.equal(calls[0].body.image_size,'portrait_4_3');assert.equal(calls[0].body.prompt,ctx.withImgStyle('Human face, fox ears.'));
  }
 });
 await test('#727 fast and reference portraits retain their synchronous transport',async()=>{
  let calls=[];ctx.falQueueRender=async()=>{throw Error('Unexpected queue');};ctx.falFetch=async(id,body)=>{calls.push({id,body});return {ok:true,json:async()=>({images:[{url:'https://image.test/fast.png'}]})};};
  ctx.renderModel=ctx.RENDER_MODELS[0].id;await ctx.generatePortraitImage('A named character');assert.equal(calls[0].body.aspect_ratio,'3:4');
  ctx.renderModel=sun;await ctx.generatePortraitImage('Reference portrait','data:image/png;base64,AAA');assert.equal(calls[1].id,'fal-ai/flux/dev/image-to-image');assert.equal(calls[1].body.image_url,'data:image/png;base64,AAA');assert.equal(calls[1].body.strength,0.75);assert.equal(calls.length,2);
 });
 await test('#727 queue errors stay loud without a second paid attempt',async()=>{
  ctx.renderModel=sun;let sync=0,queued=0;ctx.falFetch=async()=>{sync++;throw Error('Sync fallback');};ctx.falQueueRender=async()=>{queued++;throw Error('Provider queue refused');};
  await assert.rejects(ctx.generatePortraitImage('Appearance'),/Provider queue refused/);assert.equal(sync,0);assert.equal(queued,1);
 });
 await test('#727 empty queued results fail instead of returning an absent image',async()=>{
  ctx.renderModel=sun;ctx.falQueueRender=async()=>({images:[]});await assert.rejects(ctx.generatePortraitImage('Appearance'),/No image returned/);
 });
 await test('#727 synchronous provider errors retain their detail',async()=>{
  ctx.renderModel=ctx.RENDER_MODELS[0].id;ctx.falFetch=async()=>({ok:false,status:422,text:async()=>JSON.stringify({detail:'Bad input size'})});await assert.rejects(ctx.generatePortraitImage('Appearance'),/422.*Bad input size/);
 });
 console.log('SUNBURST PORTRAITS: '+checks+' passed, '+failures+' failed');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
