const sabotage=require('./sabotage.js');let rc=0;function prove(file,cases,standalone){rc|=sabotage.prove({file,command:['node',standalone?['dev/tests-525-adversarial.js']:['dev/run-tests.js','#525']],cases});}
prove('api.js',[{label:'remove second-person ending instruction',find:/(var DENOUEMENT_SYS="[^"\n]*)Write the narration in the second person, addressing the hero as you\/your, never as the hero speaking I\./,replace:'$1Write the narration.',mustFail:'#525 ending prompt pins second person'}]);
prove('game.js',[{label:'display raw metadata as narration',find:'parts=denouementSplit(text),t=parts.prose',replace:'parts=denouementSplit(text),t=String(text)',mustFail:'#525 file ending keeps RECORD'}]);
prove('helpers.js',[
 {label:'use surname for ending attribution',find:'first=endingNameToken(w),i,other',replace:'first=w.split(/\\s+/).pop(),i,other',mustFail:'#525 owner attribution'},
 {label:'repair with holder instead of recorded hero',find:'endingMomentText(m.who,m.text,people)',replace:'endingMomentText(ws.character.name,m.text,people)',mustFail:'#525 repair'},
 {label:'allow repair label to raise held past',find:'pastWords(endingMomentBody(mo),ex2)',replace:'pastWords(mo.text,ex2)',mustFail:'#525 repair'},
 {label:'file truncated metadata as a complete record',find:'function endingRecordComplete(text){return ',replace:'function endingRecordComplete(text){return true||',mustFail:'#525 incomplete'}
]);
prove('helpers.js',[{label:'drop wrapped-label support',find:'stack.push(p[1]);',replace:'return null;stack.push(p[1]);',mustFail:'decorated label leaked'}],true);
for(const seam of ['buildSysPrompt','buildEngineNotes','buildDenouementPrompt'])prove('api.js',[{label:'omit '+seam+' normalization for mid-session library arrivals',find:'function '+seam+'(){\n  healEndingMoments(worldState,memory);',replace:'function '+seam+'(){',mustFail:seam+' missed adopted resident'}],true);
prove('state.js',[{label:'omit saved-world ending repair',find:'if(typeof healEndingMoments==="function"&&healEndingMoments(worldState,memory))_mig=true;',replace:'',mustFail:'migrateWorldState missed adopted resident'}],true);
process.exit(rc);
