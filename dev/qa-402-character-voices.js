const assert=require('assert/strict'),path=require('path'),qa=require('./browser-voice-qa.js');
const before=process.argv.includes('--before');
qa(process.cwd(),async b=>{
 const ev=b.evaluate;
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await ev(`var d=TTS.settings.draft();d.primary='speechify';d.keys.speechify='synthetic-key';d.models.speechify.voices=[{id:'alicia',label:'Alicia',g:'F'},{id:'belinda',label:'Belinda',g:'F'},{id:'adam',label:'Adam',g:'M'}];d.models.speechify.narrator='adam';TTS.settings.save(d);window.__char={name:'Lysa',gender:'F',speechifyVoiceId:'belinda',voiceId:'en_US-libritts_r-medium#3'};window.__saves=0;window.saveAll=function(){__saves++};window.__show=function(){modalShell('character-voice-qa','<h2>Lysa</h2>'+csVoiceControlHtml(__char),{maxWidth:350});csWireVoice(__char)};__show();window.__change=function(id,value){var n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event('change'));};`);
 await b.screenshot(path.join(process.cwd(),'audits/screenshots/402-character-voices-'+(before?'before':'after')+'.png'));
 if(before){assert.equal(await ev("!!document.getElementById('cs-primary-voice-sel')"),false);console.log('REPRODUCED — sheet has only Piper selector');return;}
 assert.equal(await ev("document.getElementById('cs-primary-voice-sel').value"),'belinda');
 assert.equal(await ev("document.getElementById('cs-voice-sel').value"),'en_US-libritts_r-medium#3');
 assert(await ev("document.getElementById('character-voice-qa').textContent.includes('Primary voice') && document.getElementById('character-voice-qa').textContent.includes('Backup voice')"));
 await ev("__change('cs-primary-voice-sel','alicia')");assert.equal(await ev('__char.speechifyVoiceId'),'alicia');assert.equal(await ev('__char.voiceId'),'en_US-libritts_r-medium#3');assert.equal(await ev('__saves'),1);
 await ev("__show()");assert.equal(await ev("document.getElementById('cs-primary-voice-sel').value"),'alicia');
 await ev(`window.__requests=[];window.fetch=function(u,o){__requests.push({url:u,body:JSON.parse(o.body),signal:o.signal});return new Promise(function(){})};`);
 await b.send('Runtime.evaluate',{expression:"document.getElementById('cs-primary-voice-test').click()",userGesture:true});await b.sleep(100);
 assert.equal(await ev('__requests[0].body.voice_id'),'alicia');
 await ev('TTS.stop()');assert(await ev('__requests[0].signal.aborted'));
 await ev("window.__backupSlot=TTS.characterVoiceSlots()[1];window.__oldBackupTest=__backupSlot.test;window.__oldRelease=__backupSlot.release;__backupSlot.test=function(c,id){window.__backupTestId=id};__backupSlot.release=function(id){window.__released=id};__change('cs-voice-sel','en_GB-alba-medium');document.getElementById('cs-voice-test').click()");
 assert.equal(await ev('__char.speechifyVoiceId'),'alicia');assert.equal(await ev('__char.voiceId'),'en_GB-alba-medium');assert.equal(await ev('__backupTestId'),'en_GB-alba-medium');assert.equal(await ev('__released'),'en_US-libritts_r-medium#3');
 await ev('__backupSlot.test=__oldBackupTest;__backupSlot.release=__oldRelease');
 assert(await ev('document.documentElement.scrollWidth<=innerWidth'));

 await ev("document.getElementById('character-voice-qa').remove();worldState={character:Object.assign(__char,{age:'28',ancestry:'Human',cls:'Rogue',stats:{STR:12,DEX:15,CON:12,INT:10,WIS:10,CHA:13},level:1,hp:10,maxHp:10,gold:20,xp:0,skills:{},abilities:[],spells:[],inventory:[],conditions:[],languages:[],relationships:[],saveModifiers:[],storyBeats:[],coreMemories:[]}),npcs:[],world:{location:'Ashfen'},questLog:[],turn:0,transcript:[]};memory=blankMemory();document.querySelectorAll('.tnd-toast').forEach(function(n){n.remove()});showCharSheet()");
 await b.screenshot(path.join(process.cwd(),'audits/screenshots/402-full-sheet-phone.png'));
 assert(await ev('document.documentElement.scrollWidth<=innerWidth'));
 console.log('ALL GREEN — phone character voice controls, independent saved selections, primary audition request and Stop cancellation, full player sheet');
}).catch(e=>{console.error(e);process.exitCode=1});
