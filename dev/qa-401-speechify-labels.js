// Phone-width regression for verbose Speechify catalogs; synthetic keys and no network.
const assert=require('assert/strict'),path=require('path'),qa=require('./browser-voice-qa.js');
const before=process.argv.includes('--before');
qa(process.cwd(),async b=>{
 const ev=b.evaluate;
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await ev(`var d=TTS.settings.draft();d.primary='speechify';d.keys.speechify='fixture';d.models.speechify.voices=Array.from({length:125},function(_,i){return{id:'actor-'+i,label:i===0?'Alec':i===1?'Arun':'Actor '+i,g:i%2?'F':'M',note:'use-case:voice-over, use-case:advertisement, label:new-voice, use-case:animation, use-case:narration, use-case:movies, pitch:low, use-case:work, use-case:video-narration, timbre:relaxed, use-case:non-fiction, pitch:mid, accent:british, fictiongenre:mystery, use-case:audiobook, use-case:meditation, use-case:podcast, content-type:news, style:classic, use-case:audiobook-long-form'}});d.models.speechify.narrator='actor-0';TTS.settings.save(d);TTS.showSettingsModal();window.__change=function(id,value,type){var n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event(type||'change'));};`);
 const out=path.join(process.cwd(),'audits/screenshots/401-speechify-labels-'+(before?'before':'after')+'.png');
 await b.screenshot(out);
 const labels=await ev("Array.from(document.getElementById('tts-narrator').options).map(function(o){return o.textContent})");
 if(before){assert(labels[0].includes('use-case:'));console.log('REPRODUCED — '+labels[0].length+' characters in one option; screenshot '+out);return;}
 assert.equal(labels[0],'Alec · Male','Speechify narrator options must contain only name and gender');assert.equal(labels[1],'Arun · Female');
 assert.equal(await ev("document.getElementById('tts-actor-note').textContent"),'Alec · Male · British accent · Low pitch · Relaxed');
 assert(await ev('document.documentElement.scrollWidth<=innerWidth'));
 await ev("__change('tts-actor-search','british','input')");assert.equal(await ev("document.getElementById('tts-narrator').options.length"),125);
 assert.equal(await ev("document.getElementById('tts-narrator').options[1].textContent"),'Arun · Female');
 await ev("__change('tts-narrator','actor-1');document.getElementById('tts-tab-cast').click()");
 assert(await ev("Array.from(document.querySelectorAll('#tts-tab-panel select option')).every(function(o){return o.value===''||o.textContent.split(' · ').length===2})"));
 await ev("__change('tts-cast-search','british','input')");
 assert(await ev("Array.from(document.querySelectorAll('#tts-tab-panel select option')).every(function(o){return o.value===''||o.textContent.split(' · ').length===2})"));
 await ev("__change('tts-cast-0','actor-1')");
 await b.screenshot(path.join(process.cwd(),'audits/screenshots/401-speechify-labels-cast.png'));
 await ev("document.getElementById('tts-save-btn').click();TTS.showSettingsModal()");
 assert.equal(await ev("document.getElementById('tts-narrator').value"),'actor-1');assert.equal(await ev("document.getElementById('tts-narrator').selectedOptions[0].textContent"),'Arun · Female');
 console.log('ALL GREEN — phone-width Speechify labels, useful traits, narrator/cast search, saved IDs and existing catalog cleanup');
}).catch(e=>{console.error(e);process.exitCode=1});
