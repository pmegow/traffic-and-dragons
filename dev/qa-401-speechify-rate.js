// Synthetic credentials; real controls and scheduler, with all external requests blocked.
const assert = require('assert/strict');
const qa = require('./browser-voice-qa.js');
qa(process.cwd(), async b => {
  const ev = b.evaluate;
  await ev(`providerKeys.openai='fixture';store.set(TTS._openai.keys.on,'1');
    window.__change=function(id,value,type){var n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event(type||'change'));};
    TTS.showSettingsModal();__change('tts-model','speechify');__change('tts-api-key','fixture','input');
    window.fetch=function(){return Promise.resolve({ok:true,json:function(){return Promise.resolve({voices:[{id:'alicia',display_name:'Alicia',gender:'female',models:[{name:'simba-3.2'}]}],has_more:false})}})};
    document.getElementById('tts-load-voices').click();`);
  await b.sleep(100);
  assert.equal(await ev(`document.getElementById('tts-model').value`), 'speechify');
  await ev(`window.__requests=[];window.fetch=function(u,o){__requests.push({url:u,body:JSON.parse(o.body)});return new Promise(function(resolve,reject){o.signal.addEventListener('abort',function(){reject(new DOMException('Aborted','AbortError'))})})};`);
  const passages = [await ev('TTS.settings.sample'), 'The door opens. We have arrived.'];
  for (const text of passages) {
    await ev(`__change('tts-test-text',${JSON.stringify(text)},'input')`);
    for (const [value,expected] of [[0.8,'-20%'],[1,'medium'],[1.3,'+30%']]) {
      await ev(`__change('tts-speed','${value}','input');__requests.length=0;`);
      await b.send('Runtime.evaluate',{expression:"document.getElementById('tts-test-btn').click()",userGesture:true});
      for(let i=0;!(await ev('__requests.length'));i++){if(i>30)throw Error('audition did not send');await b.sleep(50);}
      const req=await ev('__requests[0]');
      assert.equal(req.url,'https://api.speechify.ai/v1/audio/stream');
      assert(req.body.input.includes('rate="'+expected+'"'), JSON.stringify({value,request:req.body.input}));
      assert.equal(req.body.voice_id,'alicia');
      assert.equal(await ev(`document.getElementById('tts-model').value`),'speechify');
      assert.equal(await ev('TTS.settings.draft().primary'),'openai');
      await ev("document.getElementById('tts-stop-btn').click()");
    }
  }
  // Closing without Save restores the prior model; saving must retain the trial model.
  await ev("document.getElementById('tts-modal-x').click();TTS.showSettingsModal()");
  assert.equal(await ev("document.getElementById('tts-model').value"),'openai');
  await ev(`document.getElementById('tts-modal-x').click();var d=TTS.settings.draft();d.keys.speechify='fixture';d.models.speechify.voices=[{id:'alicia',label:'Alicia',g:'F'}];d.models.speechify.narrator='alicia';TTS.settings.save(d);TTS.showSettingsModal();__change('tts-model','speechify');__change('tts-speed','0.8','input');document.getElementById('tts-save-btn').click();TTS.showSettingsModal();`);
  assert.equal(await ev("document.getElementById('tts-model').value"),'speechify');
  assert.equal(await ev("document.getElementById('tts-speed').value"),'0.8');
  await ev("document.getElementById('tts-modal-x').click();__requests.length=0;");
  await b.send('Runtime.evaluate',{expression:"TTS.speak('A saved narration.');",userGesture:true});
  for(let i=0;!(await ev('__requests.length'));i++){if(i>30)throw Error('saved narration did not send');await b.sleep(50);}
  const saved=await ev('__requests[0]');
  assert.equal(saved.url,'https://api.speechify.ai/v1/audio/stream');
  assert(saved.body.input.includes('rate="-20%"'));
  await ev('TTS.stop()');
  console.log('ALL GREEN — Speechify UI: two passages at slow/normal/fast, draft provider stable, Close discards, Save/reopen retains provider and rate, gameplay uses saved rate. No paid requests.');
}).catch(e=>{console.error(e);process.exitCode=1});
