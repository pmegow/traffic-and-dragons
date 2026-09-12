const assert=require('assert/strict'),path=require('path'),qa=require('./browser-voice-qa.js');
const before=process.argv.includes('--before');
qa(process.cwd(),async b=>{
 const ev=b.evaluate;
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});
 await ev("var d=TTS.settings.draft();d.primary='speechify';d.keys.speechify='synthetic-key';d.models.speechify.narrator='alicia';d.models.speechify.voices=[{id:'alicia',label:'Alicia',g:'F'},{id:'adam',label:'Adam',g:'M'},{id:'belinda',label:'Belinda',g:'F'},{id:'arun',label:'Arun',g:'M'},{id:'mystery',label:'Mystery',g:''}];TTS.settings.save(d);store.set('tnd_speaker_stars_v1',JSON.stringify([{id:'en_US-libritts_r-medium#9',label:'Cast female (F)',g:'F'},{id:'en_US-libritts_r-medium#3',label:'Cast male (M)',g:'M'}]));window.__c={name:'Lysa',gender:'F',speechifyVoiceId:'alicia',voiceId:'en_US-libritts_r-medium#9'};window.__saves=0;saveAll=function(){__saves++};window.__show=function(){modalShell('filter-qa','<h2>'+__c.name+' · '+__c.gender+'</h2>'+csVoiceControlHtml(__c),{maxWidth:350});csWireVoice(__c);['cs-primary-voice-sel','cs-voice-sel'].forEach(function(id){document.getElementById(id).size=5})};window.__choices=function(id){return Array.from(document.getElementById(id).options).filter(function(o){return o.value&&!o.disabled&&!o.hidden}).map(function(o){return o.value})};__show();");
 await b.screenshot(path.join(process.cwd(),'audits/screenshots/402-voice-filter-'+(before?'before':'after')+'.png'));
 if(before){assert((await ev("__choices('cs-primary-voice-sel')")).includes('adam'));assert((await ev("__choices('cs-voice-sel')")).includes('en_US-libritts_r-medium#3'));console.log('REPRODUCED — female sheet offers both genders in both lists');return;}
 assert.deepEqual(await ev("__choices('cs-primary-voice-sel')"),['alicia','belinda']);
 assert(!(await ev("__choices('cs-voice-sel')")).includes('en_US-libritts_r-medium#3'));
 assert((await ev("__choices('cs-voice-sel')")).includes('en_GB-alba-medium'));
 const pin=await ev('JSON.stringify(__c)');
 await ev("__c.gender='M';__show()");
 assert.deepEqual(await ev("__choices('cs-primary-voice-sel')"),['adam','arun']);
 assert(!(await ev("__choices('cs-voice-sel')")).includes('en_GB-alba-medium'));
 assert((await ev("__choices('cs-voice-sel')")).includes('en_US-ryan-high'));
 assert.equal(await ev("document.getElementById('cs-primary-voice-sel').value"),'alicia');
 assert.equal(await ev("document.getElementById('cs-voice-sel').value"),'en_US-libritts_r-medium#9');
 assert.equal(await ev('__saves'),0);
 await ev("__c.gender='NB';__show()");assert((await ev("__choices('cs-primary-voice-sel')")).includes('alicia'));assert((await ev("__choices('cs-primary-voice-sel')")).includes('adam'));assert((await ev("__choices('cs-voice-sel')")).includes('en_US-libritts_r-medium#9'));assert((await ev("__choices('cs-voice-sel')")).includes('en_US-libritts_r-medium#3'));
 await ev("__c.gender='';__show()");assert.deepEqual(await ev("__choices('cs-primary-voice-sel')"),[]);assert.deepEqual(await ev("__choices('cs-voice-sel')"),[]);
 await ev("__c.gender='F';__c.speechifyVoiceId='adam';__c.voiceId='en_US-libritts_r-medium#3';__show();window.__change=function(id,v){var s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change'))};__change('cs-primary-voice-sel','belinda');__change('cs-voice-sel','en_GB-alba-medium');__show()");assert.equal(await ev('__c.speechifyVoiceId'),'belinda');assert.equal(await ev('__c.voiceId'),'en_GB-alba-medium');assert.equal(await ev('__saves'),2);
 assert(await ev('document.documentElement.scrollWidth<=innerWidth'));
 console.log('ALL GREEN — both gender-filtered lists, non-binary full bank, unknown gender, existing pins and independent changes at phone width');
}).catch(e=>{console.error(e);process.exitCode=1});
