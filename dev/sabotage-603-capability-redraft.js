const sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'dev/capability-redraft.js',command:['node',['dev/tests-603-capability-redraft.js']],cases:[
 {label:'a different model is presented as Astra',find:"const MODEL='gpt-6-astra';",replace:"const MODEL='gpt-6-sol';",mustFail:'redraft must use Astra'},
 {label:'parallel redrafts bypass the single active request limit',find:'if(active){',replace:'if(false){',mustFail:'parallel drafting must be refused'}
]})?1:0);
