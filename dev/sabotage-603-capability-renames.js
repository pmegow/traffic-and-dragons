const sabotage=require('./sabotage.js');
let failed=0;
failed+=sabotage.prove({file:'data.js',command:['node',['dev/tests-603-capability-renames.js']],cases:[{label:'approved rename loses save migration',find:'  {from:"a natural death",to:"Set the Scene"},',replace:'',mustFail:'migration missing: a natural death'}]});
failed+=sabotage.prove({file:'capability-names.html',command:['node',['dev/tests-603-capability-renames.js']],cases:[{label:'legacy worksheet draft no longer resolves applied names',find:'key=capBaseName(rename.to);return true;',replace:'return true;',mustFail:'unknown, repeated, or malformed original name'}]});
process.exit(failed?1:0);
