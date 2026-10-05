const sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'dev/capability-review-store.js',command:['node',['dev/tests-603-capability-review.js']],cases:[
 {label:'stale review overwrites a newer file',find:'if(payload.revision!==current.revision)',replace:'if(false)',mustFail:'stale review must be refused'},
 {label:'failed atomic replacement destroys the saved review',find:'fs.renameSync(temp,file);',replace:'fs.writeFileSync(file,text);fs.renameSync(temp,file);',mustFail:'failed replacement must preserve previous review'}
]})?1:0);
